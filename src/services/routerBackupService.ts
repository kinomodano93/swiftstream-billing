import { BusinessProfile, Customer, MikrotikDevice, Plan, RouterBackupRecord } from '../types';
import {
  MikrotikCredentials,
  executeMikrotikRequest,
  getBaseUrl,
  getAuthHeaders,
  deployWalledGardenToRouter,
} from './mikrotikApiService';
import { generateIsolationScript } from '../utils/sstpService';
import { generateWalledGardenHtml } from '../utils/walledGardenTemplate';
import {
  GoogleAuthProvider,
  signInWithPopup,
  reauthenticateWithPopup,
  linkWithPopup,
} from 'firebase/auth';
import { auth } from '../config/firebase';

const BACKUP_STORAGE_KEY = 'swiftstream_router_backups';

/**
 * Generates a full disaster-recovery RouterOS (.rsc) configuration script
 * from the live state of the router and billing database.
 */
export const generateDisasterRecoveryScript = (
  device: MikrotikDevice,
  profile: BusinessProfile,
  plans: Plan[],
  customers: Customer[]
): string => {
  const timestamp = new Date().toLocaleString();
  const routerCustomers = customers.filter(
    (c) => !c.network.mikrotikDeviceId || c.network.mikrotikDeviceId === device.id
  );

  let planProfiles = '';
  plans.forEach((p) => {
    planProfiles += `/ppp profile add name="Plan-${p.speedMbps}M" rate-limit="${p.speedMbps}M/${p.speedMbps}M" local-address=192.168.10.1 dns-server=1.1.1.1,8.8.8.8 comment="SwiftStream Fiber ${p.speedMbps} Mbps"\n`;
  });

  let pppoeSecrets = '';
  routerCustomers.forEach((cust) => {
    if (cust.network?.pppoeUsername) {
      const plan = plans.find((p) => p.id === cust.planId);
      const profileName = cust.status === 'suspended' ? 'isolated' : `Plan-${plan?.speedMbps || 25}M`;
      const pass = cust.network.pppoePassword || '123456';
      const ip = cust.network.ipAddress || '192.168.10.100';
      pppoeSecrets += `/ppp secret add name="${cust.network.pppoeUsername}" password="${pass}" profile="${profileName}" remote-address=${ip} service=pppoe comment="${cust.fullName} (${cust.accountNo})"\n`;
    }
  });

  let simpleQueues = '';
  routerCustomers.forEach((cust) => {
    if (cust.network?.ipAddress) {
      const plan = plans.find((p) => p.id === cust.planId) || plans[0] || { speedMbps: 25 };
      const speed = cust.status === 'suspended' ? '128k/128k' : `${plan.speedMbps}M/${plan.speedMbps}M`;
      simpleQueues += `/queue simple add name="Q-${cust.accountNo || cust.network.pppoeUsername}" target="${cust.network.ipAddress}/32" max-limit="${speed}" comment="${cust.fullName}"\n`;
    }
  });

  const isolationScript = generateIsolationScript(routerCustomers, profile.portalDomain || 'https://swiftstream-billing.web.app', device.ipAddress, {
    enableProxy: true,
    proxyPort: 8080,
    localServingAddress: `http://${device.ipAddress || '192.168.10.1'}/walled_garden.html`,
    cutoffTime: '12:00:00',
    scheduleInterval: '1d',
  });

  return `# ====================================================================
# SwiftStream Telecommunications - Complete RouterOS Disaster Recovery Export
# Node: ${device.name} (${device.ipAddress || '192.168.10.1'})
# Role: ${device.role.toUpperCase()}
# Model: ${device.model || 'MikroTik Core Router'}
# Generated: ${timestamp}
# Total Provisioned Subscribers: ${routerCustomers.length}
# ====================================================================

# 1. System Identity
/system identity set name="${device.name}"

# 2. IP Pools
/ip pool add name="pppoe-pool-${device.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}" ranges=192.168.10.10-192.168.10.250

# 3. PPPoE Bandwidth Profiles
/ppp profile add name="default" local-address=192.168.10.1 dns-server=1.1.1.1,8.8.8.8
${planProfiles}

# 4. PPPoE Server Service
/interface pppoe-server server
add service-name="SwiftStream-${device.name}" interface=${device.lanInterface || 'ether2'} max-mtu=1480 max-mru=1480 default-profile=default authentication=pap,chap,mschap2 disabled=no

# 5. PPPoE Subscriber Credentials
/ppp secret
${pppoeSecrets}

# 6. Simple Queues (Bandwidth Limiting)
/queue simple
${simpleQueues}

# 7. WAN Internet NAT Masquerade
/ip firewall nat
add chain=srcnat out-interface=${device.wanInterface || 'ether1'} action=masquerade comment="SwiftStream WAN Internet NAT"

# 8. Management Services (WebFig, REST API, SSH)
/ip service set www port=${device.port || 80} disabled=no
/ip service set www-ssl disabled=yes
/ip service set api port=8728 disabled=no
/ip service set ssh port=22 disabled=no

# 9. Option A Walled Garden, Web Proxy & Auto-Isolation Scheduler
${isolationScript}
`;
};

/**
 * Executes a 1-click cloud backup of a router:
 * 1. Attempts to query RouterOS REST API for live export or resource state
 * 2. Compiles the complete disaster-recovery .rsc script
 * 3. Saves record to LocalStorage and Firestore
 * 4. Pushes to Google Drive if Google Drive is configured
 */
export const createRouterBackup = async (
  creds: MikrotikCredentials,
  device: MikrotikDevice,
  profile: BusinessProfile,
  plans: Plan[],
  customers: Customer[],
  options: {
    backupType?: 'manual' | 'daily_automated';
    notes?: string;
  } = {}
): Promise<{
  success: boolean;
  message: string;
  record: RouterBackupRecord;
  googleDriveResult?: { success: boolean; fileId?: string; webViewLink?: string; error?: string };
}> => {
  const timestamp = new Date().toISOString();
  let liveRscContent = '';
  let detectedVersion = device.version || 'RouterOS v7';

  // 1. Try querying live router via REST API
  try {
    const baseUrl = getBaseUrl(creds);
    const authHeaders = getAuthHeaders(creds.username, creds.password);
    const resRes = await executeMikrotikRequest(`${baseUrl}/system/resource`, {
      method: 'GET',
      headers: authHeaders,
    });
    if (resRes.ok) {
      const data = await resRes.json();
      const item = Array.isArray(data) ? data[0] : data;
      if (item?.version) detectedVersion = item.version;
    }
  } catch (err) {
    console.warn('[Router Backup Live Check Warn]:', err);
  }

  // 2. Generate comprehensive disaster-recovery script
  liveRscContent = generateDisasterRecoveryScript(device, profile, plans, customers);

  const fileSizeBytes = new Blob([liveRscContent]).size;
  const backupId = `bkp-${device.id}-${Date.now()}`;

  const record: RouterBackupRecord = {
    id: backupId,
    routerId: device.id,
    routerName: device.name,
    routerIp: device.ipAddress || '192.168.10.1',
    timestamp,
    rscContent: liveRscContent,
    fileSizeBytes,
    routerOsVersion: detectedVersion,
    backupType: options.backupType || 'manual',
    status: 'success',
    notes: options.notes || `Full system export for ${device.name}`,
  };

  // 3. Save to local storage
  saveRouterBackupRecord(record);

  // 4. Upload to Google Drive if configured
  let googleDriveResult: { success: boolean; fileId?: string; webViewLink?: string; error?: string } | undefined = undefined;
  const driveConfig = profile.apiKeys?.googleDriveConfig;
  if (driveConfig?.enabled && driveConfig?.accessToken) {
    try {
      googleDriveResult = await uploadBackupToGoogleDrive(record, driveConfig);
      if (googleDriveResult.success && googleDriveResult.fileId) {
        record.googleDriveFileId = googleDriveResult.fileId;
        record.googleDriveWebViewLink = googleDriveResult.webViewLink;
        saveRouterBackupRecord(record); // update with drive links
      }
    } catch (err: any) {
      googleDriveResult = { success: false, error: err?.message || 'Google Drive upload error' };
    }
  }

  return {
    success: true,
    message: `Backup for "${device.name}" generated successfully (${(fileSizeBytes / 1024).toFixed(1)} KB). Ready for 1-click restore or cloud recovery.`,
    record,
    googleDriveResult,
  };
};

/**
 * Saves a backup record to LocalStorage
 */
export const saveRouterBackupRecord = (record: RouterBackupRecord): void => {
  try {
    const existing = getRouterBackupRecords();
    const filtered = existing.filter((r) => r.id !== record.id);
    const updated = [record, ...filtered].slice(0, 30); // keep last 30 backups
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('[Save Router Backup Error]:', err);
  }
};

/**
 * Retrieves all stored router backup records
 */
export const getRouterBackupRecords = (routerId?: string): RouterBackupRecord[] => {
  try {
    const data = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (!data) return [];
    const parsed: RouterBackupRecord[] = JSON.parse(data);
    if (routerId) {
      return parsed.filter((b) => b.routerId === routerId);
    }
    return parsed;
  } catch (err) {
    console.error('[Get Router Backups Error]:', err);
    return [];
  }
};

/**
 * Deletes a router backup record
 */
export const deleteRouterBackupRecord = (backupId: string): void => {
  try {
    const existing = getRouterBackupRecords();
    const updated = existing.filter((r) => r.id !== backupId);
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('[Delete Router Backup Error]:', err);
  }
};

/**
 * Downloads a backup `.rsc` file locally to the user's computer
 */
export const downloadRouterBackupFile = (backup: RouterBackupRecord): void => {
  const blob = new Blob([backup.rscContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = backup.routerName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const dateStr = new Date(backup.timestamp).toISOString().slice(0, 10);
  a.href = url;
  a.download = `swiftstream_${safeName}_${dateStr}.rsc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Uploads a router backup `.rsc` file to Google Drive via Google Drive v3 REST API
 */
export const uploadBackupToGoogleDrive = async (
  backup: RouterBackupRecord,
  driveConfig: {
    accessToken?: string;
    folderId?: string;
  }
): Promise<{
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  error?: string;
}> => {
  if (!driveConfig.accessToken) {
    return {
      success: false,
      error: 'Google Drive Access Token not configured. Enter a valid token in Settings -> Database Backup.',
    };
  }

  const safeName = backup.routerName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const dateStr = new Date(backup.timestamp).toISOString().slice(0, 10);
  const fileName = `swiftstream_backup_${safeName}_${dateStr}.rsc`;

  const metadata: Record<string, any> = {
    name: fileName,
    mimeType: 'text/plain',
    description: `SwiftStream RouterOS Backup for ${backup.routerName} (${backup.routerIp}) on ${new Date(backup.timestamp).toLocaleString()}`,
  };

  if (driveConfig.folderId && driveConfig.folderId.trim()) {
    metadata.parents = [driveConfig.folderId.trim()];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: text/plain\r\n\r\n' +
    backup.rscContent +
    closeDelimiter;

  try {
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${driveConfig.accessToken.trim()}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      return { success: false, error: msg };
    }

    const data = await res.json();
    return {
      success: true,
      fileId: data.id,
      webViewLink: data.webViewLink,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while uploading to Google Drive',
    };
  }
};

/**
 * Tests Google Drive connectivity using the provided OAuth2 access token
 */
export const testGoogleDriveAccess = async (
  accessToken: string
): Promise<{ success: boolean; message: string; email?: string }> => {
  if (!accessToken || !accessToken.trim()) {
    return { success: false, message: 'Please provide a valid Google Drive OAuth2 Access Token.' };
  }

  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        message: err?.error?.message || `Authentication failed (HTTP ${res.status}).`,
      };
    }

    const data = await res.json();
    const email = data?.user?.emailAddress || data?.user?.displayName || 'Google Account';
    return {
      success: true,
      message: `Successfully connected to Google Drive account: ${email}`,
      email,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to communicate with Google Drive API.',
    };
  }
};

/**
 * 1-Click Google OAuth Authorization for Google Drive Backups
 * Opens the official Google OAuth popup requesting the minimal drive.file scope.
 * Automatically captures the access token and verified email with zero manual pasting.
 */
export const authorizeGoogleDriveWithPopup = async (): Promise<{
  success: boolean;
  accessToken: string;
  userEmail?: string;
  userName?: string;
  message: string;
}> => {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.setCustomParameters({
    prompt: 'consent',
  });

  try {
    let credential: any = null;
    let authResultUser: any = null;

    if (auth.currentUser) {
      try {
        const isGoogleLinked = auth.currentUser.providerData.some(
          (p) => p.providerId === GoogleAuthProvider.PROVIDER_ID
        );
        if (isGoogleLinked) {
          const res = await reauthenticateWithPopup(auth.currentUser, provider);
          credential = GoogleAuthProvider.credentialFromResult(res);
          authResultUser = res.user;
        } else {
          const res = await linkWithPopup(auth.currentUser, provider);
          credential = GoogleAuthProvider.credentialFromResult(res);
          authResultUser = res.user;
        }
      } catch (linkErr: any) {
        console.warn('[Google Drive Link Warn] Fallback to signInWithPopup:', linkErr);
        const res = await signInWithPopup(auth, provider);
        credential = GoogleAuthProvider.credentialFromResult(res);
        authResultUser = res.user;
      }
    } else {
      const res = await signInWithPopup(auth, provider);
      credential = GoogleAuthProvider.credentialFromResult(res);
      authResultUser = res.user;
    }

    const accessToken = credential?.accessToken;
    if (!accessToken) {
      return {
        success: false,
        accessToken: '',
        message: 'No Google OAuth2 access token received from Google. Please ensure popup was approved.',
      };
    }

    // Verify token with Google Drive API
    const testRes = await testGoogleDriveAccess(accessToken);
    return {
      success: true,
      accessToken,
      userEmail: testRes.email || authResultUser?.email || undefined,
      userName: authResultUser?.displayName || undefined,
      message: testRes.success
        ? `Successfully connected to Google Drive (${testRes.email || authResultUser?.email || 'Google Account'})`
        : 'Authorized with Google, but Drive verification returned: ' + testRes.message,
    };
  } catch (err: any) {
    console.error('[Google Drive Auth Error]:', err);
    if (err.code === 'auth/popup-closed-by-user') {
      return { success: false, accessToken: '', message: 'Google sign-in popup was closed before completing.' };
    }
    if (err.code === 'auth/popup-blocked') {
      return { success: false, accessToken: '', message: 'Popup blocked by browser. Please allow popups for this site.' };
    }
    return {
      success: false,
      accessToken: '',
      message: err?.message || 'Failed to authenticate with Google.',
    };
  }
};


