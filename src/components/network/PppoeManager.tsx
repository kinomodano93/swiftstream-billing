import React, { useState, useMemo, useEffect } from 'react';
import {
  Radio,
  Users,
  ShieldCheck,
  Zap,
  Sliders,
  Server,
  Activity,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  Power,
  RotateCcw,
  Layers,
  Lock,
  Globe,
  Terminal,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  Key,
  RefreshCw,
  ShieldAlert,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Sparkles,
  Play,
  Smartphone,
  Monitor,
  Tablet,
  Maximize2,
  Minimize2,
  Edit3,
  Save,
  Code,
  Layout,
  FileCode,
  UploadCloud,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, Plan, WalledGardenSettings } from '../../types';
import {
  generateIsolationScript,
} from '../../utils/sstpService';
import {
  kickActivePppoeSession,
  syncPppoeSecretToRouter,
  fetchPppoeSecretsDetailed,
  fetchPppoeActiveSessions,
  fetchPppoeProfilesDetailed,
  fetchIpPools,
  bulkSyncAllSimpleQueues,
  syncSimpleQueue,
  deployWalledGardenToRouter,
  uploadWalledGardenHtmlToRouter,
  deployAutoIsolationSchedulerToRouter,
  isolateOverdueSubscriber,
  reconnectSubscriber,
  PppoeSecretItem,
  PppoeActiveSessionItem,
  PppoeProfileItem,
  IpPoolItem,
} from '../../services/mikrotikApiService';
import { formatCurrency } from '../../utils/formatters';
import { generateWalledGardenHtml, getDefaultWalledGardenSettings } from '../../utils/walledGardenTemplate';

interface PppoeManagerProps {
  onSelectCustomer?: (customerId: string) => void;
  selectedDeviceId?: string;
}

export const PppoeManager: React.FC<PppoeManagerProps> = ({ onSelectCustomer, selectedDeviceId }) => {
  const {
    customers,
    plans,
    mikrotikDevices,
    businessProfile,
    updateBusinessProfile,
    updateCustomer,
    updateMikrotikDevice,
    showToast,
    logAuditEvent,
    syncCustomerMikrotik,
    syncAllSubscribersToMikrotik,
  } = useApp();

  const [targetDeviceId, setTargetDeviceId] = useState<string>(
    selectedDeviceId || mikrotikDevices[0]?.id || 'mtk-core-01'
  );

  // Sync if selectedDeviceId prop changes
  useEffect(() => {
    if (selectedDeviceId) {
      setTargetDeviceId(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  const activeDevice = mikrotikDevices.find((d) => d.id === targetDeviceId) || mikrotikDevices[0];

  const [activeTab, setActiveTab] = useState<'sessions' | 'secrets' | 'profiles' | 'queues' | 'ippool' | 'isolation'>('sessions');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedProfileFilter, setSelectedProfileFilter] = useState<string>('all');
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [isSyncingQueues, setIsSyncingQueues] = useState<boolean>(false);
  const [queueSyncResult, setQueueSyncResult] = useState<{ total: number; synced: number } | null>(null);
  const [syncingSecretId, setSyncingSecretId] = useState<string | null>(null);
  const [kickingSessionId, setKickingSessionId] = useState<string | null>(null);

  // Walled Garden State
  const [portalRedirectUrl, setPortalRedirectUrl] = useState<string>(
    businessProfile?.walledGardenSettings?.portalUrl || businessProfile?.portalDomain || 'https://swiftstream-billing.web.app'
  );
  const [isDeployingWalledGarden, setIsDeployingWalledGarden] = useState<boolean>(false);
  const [walledGardenDeployResult, setWalledGardenDeployResult] = useState<{
    success: boolean;
    message: string;
    commands: string[];
  } | null>(null);
  const [showWalledGardenScriptModal, setShowWalledGardenScriptModal] = useState<boolean>(false);
  const [copiedWalledGardenScript, setCopiedWalledGardenScript] = useState<boolean>(false);
  const [isIsolatingCustomerId, setIsIsolatingCustomerId] = useState<string | null>(null);
  const [isRestoringCustomerId, setIsRestoringCustomerId] = useState<string | null>(null);
  const [isBatchIsolating, setIsBatchIsolating] = useState<boolean>(false);
  const [showLocalTemplateModal, setShowLocalTemplateModal] = useState<boolean>(false);
  const [previewDeviceMode, setPreviewDeviceMode] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');
  const [copiedHtmlTemplate, setCopiedHtmlTemplate] = useState<boolean>(false);
  const [showInlinePreview, setShowInlinePreview] = useState<boolean>(true);
  const [inlinePreviewMode, setInlinePreviewMode] = useState<'mobile' | 'desktop'>('mobile');

  // Direct 1-Click HTML Router Upload State
  const [isUploadingHtmlToRouter, setIsUploadingHtmlToRouter] = useState<boolean>(false);
  const [htmlUploadResult, setHtmlUploadResult] = useState<{
    success: boolean;
    message: string;
    targetPath: string;
    commands?: string[];
  } | null>(null);

  // Router-Side Web Proxy & Offline Serving State
  const [enableWebProxyServing, setEnableWebProxyServing] = useState<boolean>(true);
  const [localProxyPort, setLocalProxyPort] = useState<number>(8080);
  const [localServingAddress, setLocalServingAddress] = useState<string>(() => {
    return activeDevice?.ipAddress ? `http://${activeDevice.ipAddress}/walled_garden.html` : 'http://192.168.10.1/walled_garden.html';
  });

  // On-Router Auto-Isolation Scheduler State
  const [cutoffTimeInput, setCutoffTimeInput] = useState<string>('12:00:00');
  const [schedulerInterval, setSchedulerInterval] = useState<string>('1d');
  const [isDeployingScheduler, setIsDeployingScheduler] = useState<boolean>(false);
  const [schedulerDeployResult, setSchedulerDeployResult] = useState<{
    success: boolean;
    message: string;
    commands?: string[];
  } | null>(null);
  const [showSchedulerScriptModal, setShowSchedulerScriptModal] = useState<boolean>(false);
  const [copiedSchedulerScript, setCopiedSchedulerScript] = useState<boolean>(false);

  // Sync default local serving address when active device IP updates
  useEffect(() => {
    if (activeDevice?.ipAddress) {
      setLocalServingAddress(`http://${activeDevice.ipAddress}/walled_garden.html`);
    }
  }, [activeDevice?.ipAddress]);

  // Walled Garden Template Customizer / Editor State
  const [showEditTemplateModal, setShowEditTemplateModal] = useState<boolean>(false);
  const [editTab, setEditTab] = useState<'form' | 'code'>('form');
  const [editPreviewDevice, setEditPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
  const [mobileEditorView, setMobileEditorView] = useState<'editor' | 'preview'>('editor');
  const [draftSettings, setDraftSettings] = useState<WalledGardenSettings>(() => {
    return businessProfile?.walledGardenSettings || getDefaultWalledGardenSettings(businessProfile);
  });

  // Re-sync draft when business profile updates
  useEffect(() => {
    if (businessProfile?.walledGardenSettings) {
      setDraftSettings(businessProfile.walledGardenSettings);
    } else {
      setDraftSettings(getDefaultWalledGardenSettings(businessProfile));
    }
  }, [businessProfile]);

  useEffect(() => {
    if (businessProfile?.walledGardenSettings?.portalUrl) {
      setPortalRedirectUrl(businessProfile.walledGardenSettings.portalUrl);
    } else if (businessProfile?.portalDomain) {
      setPortalRedirectUrl(businessProfile.portalDomain);
    }
  }, [businessProfile?.walledGardenSettings?.portalUrl, businessProfile?.portalDomain]);

  const localWalledGardenHtml = useMemo(() => {
    return generateWalledGardenHtml(businessProfile, {
      portalUrl: businessProfile?.walledGardenSettings?.portalUrl || portalRedirectUrl,
      settings: businessProfile?.walledGardenSettings,
    });
  }, [businessProfile, portalRedirectUrl]);

  const draftPreviewHtml = useMemo(() => {
    return generateWalledGardenHtml(businessProfile, {
      portalUrl: draftSettings.portalUrl || portalRedirectUrl,
      settings: draftSettings,
    });
  }, [businessProfile, draftSettings, portalRedirectUrl]);

  const handleSaveWalledGardenSettings = () => {
    updateBusinessProfile({
      walledGardenSettings: draftSettings,
      portalDomain: draftSettings.portalUrl || businessProfile?.portalDomain,
    });
    if (draftSettings.portalUrl) {
      setPortalRedirectUrl(draftSettings.portalUrl);
    }
    showToast('success', 'Walled Garden Saved', 'Template settings have been saved and applied to router traffic.');
    setShowEditTemplateModal(false);
  };

  const handleResetWalledGardenDefaults = () => {
    const defaults = getDefaultWalledGardenSettings(businessProfile);
    setDraftSettings(defaults);
    showToast('info', 'Reset to Defaults', 'Default template loaded. Click "Save & Apply Changes" to persist.');
  };

  const handleLoadCurrentTemplateIntoCode = () => {
    const generated = generateWalledGardenHtml(businessProfile, {
      portalUrl: draftSettings.portalUrl || portalRedirectUrl,
      settings: { ...draftSettings, enableCustomHtmlOverride: false },
    });
    setDraftSettings((prev) => ({
      ...prev,
      customHtmlOverride: generated,
      enableCustomHtmlOverride: true,
    }));
    setEditTab('code');
    showToast('info', 'Code Loaded', 'Base HTML loaded into code editor. You can now edit markup directly.');
  };

  // Router Live Data State (No Mock Fallbacks)
  const [secrets, setSecrets] = useState<PppoeSecretItem[]>([]);
  const [activeSessions, setActiveSessions] = useState<PppoeActiveSessionItem[]>([]);
  const [profiles, setProfiles] = useState<PppoeProfileItem[]>([]);
  const [ipPools, setIpPools] = useState<IpPoolItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<{ is401: boolean; message: string; host: string; port: number; username: string } | null>(null);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSavingPassword, setIsSavingPassword] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load Real Data directly from RouterOS REST API
  const loadRouterData = async () => {
    if (!activeDevice) return;
    setIsLoading(true);
    setAuthError(null);

    const creds = {
      id: activeDevice.id,
      name: activeDevice.name,
      ipAddress: activeDevice.ipAddress || activeDevice.remoteAddress || '',
      port: activeDevice.port || activeDevice.webfigPort || 80,
      username: activeDevice.username || 'admin',
      password: activeDevice.password || '',
      useHttps: activeDevice.port === 443 || activeDevice.webfigPort === 443,
    };

    try {
      const [secretsRes, activeRes, profilesRes, poolsRes] = await Promise.all([
        fetchPppoeSecretsDetailed(creds),
        fetchPppoeActiveSessions(creds),
        fetchPppoeProfilesDetailed(creds),
        fetchIpPools(creds),
      ]);

      const is401 = [secretsRes, activeRes, profilesRes, poolsRes].some(
        (r) => r.statusCode === 401 || r.error === 'Unauthorized'
      );

      if (is401) {
        setAuthError({
          is401: true,
          message: secretsRes.message || activeRes.message || 'RouterOS authentication failed (HTTP 401 Unauthorized)',
          host: creds.ipAddress,
          port: creds.port,
          username: creds.username,
        });
      }

      setSecrets(secretsRes.success ? secretsRes.data : []);
      setActiveSessions(activeRes.success ? activeRes.data : []);
      setProfiles(profilesRes.success ? profilesRes.data : []);
      setIpPools(poolsRes.success ? poolsRes.data : []);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Failed to load PPPoE router data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRouterData();
    setPasswordInput('');
  }, [activeDevice?.id, activeDevice?.ipAddress, activeDevice?.password]);

  // Handle in-place password update & instant reconnect
  const handleSavePasswordAndRetry = async () => {
    if (!activeDevice || !passwordInput) return;
    setIsSavingPassword(true);
    try {
      updateMikrotikDevice(activeDevice.id, { password: passwordInput }, true);
      showToast('success', 'Router Password Saved', `Updated password for ${activeDevice.name}. Connecting...`);

      const creds = {
        id: activeDevice.id,
        name: activeDevice.name,
        ipAddress: activeDevice.ipAddress || activeDevice.remoteAddress || '',
        port: activeDevice.port || activeDevice.webfigPort || 80,
        username: activeDevice.username || 'admin',
        password: passwordInput,
        useHttps: activeDevice.port === 443 || activeDevice.webfigPort === 443,
      };

      setIsLoading(true);
      const [secretsRes, activeRes, profilesRes, poolsRes] = await Promise.all([
        fetchPppoeSecretsDetailed(creds),
        fetchPppoeActiveSessions(creds),
        fetchPppoeProfilesDetailed(creds),
        fetchIpPools(creds),
      ]);

      const is401 = [secretsRes, activeRes, profilesRes, poolsRes].some(
        (r) => r.statusCode === 401 || r.error === 'Unauthorized'
      );

      if (is401) {
        setAuthError({
          is401: true,
          message: 'RouterOS still rejected the credentials. Please verify your password.',
          host: creds.ipAddress,
          port: creds.port,
          username: creds.username,
        });
        showToast('error', 'Authentication Failed', 'Router rejected the password (HTTP 401).');
      } else {
        setAuthError(null);
        showToast(
          'success',
          'Connected to RouterOS',
          `Discovered ${secretsRes.data.length} PPPoE secrets and ${activeRes.data.length} active sessions!`
        );
      }

      setSecrets(secretsRes.success ? secretsRes.data : []);
      setActiveSessions(activeRes.success ? activeRes.data : []);
      setProfiles(profilesRes.success ? profilesRes.data : []);
      setIpPools(poolsRes.success ? poolsRes.data : []);
      setLastUpdated(new Date());
    } catch (err: any) {
      showToast('error', 'Update Failed', err?.message || 'Failed to update router password.');
    } finally {
      setIsSavingPassword(false);
      setIsLoading(false);
    }
  };

  // Overdue / Isolated customers from Billing
  const overdueCustomers = useMemo(() => {
    return customers.filter((c) => c.status === 'overdue' || c.status === 'suspended');
  }, [customers]);

  const isolatedCount = useMemo(() => {
    return overdueCustomers.filter((c) => c.status === 'suspended').length;
  }, [overdueCustomers]);

  const totalOverdueBalance = useMemo(() => {
    return overdueCustomers.reduce((acc, c) => acc + (c.balance || 0), 0);
  }, [overdueCustomers]);

  const walledGardenScript = useMemo(() => {
    return generateIsolationScript(customers, portalRedirectUrl, activeDevice?.ipAddress, {
      enableProxy: enableWebProxyServing,
      proxyPort: localProxyPort,
      localServingAddress: localServingAddress || `http://${activeDevice?.ipAddress || '192.168.10.1'}/walled_garden.html`,
      cutoffTime: cutoffTimeInput,
      scheduleInterval: schedulerInterval,
    });
  }, [
    customers,
    portalRedirectUrl,
    activeDevice?.ipAddress,
    enableWebProxyServing,
    localProxyPort,
    localServingAddress,
    cutoffTimeInput,
    schedulerInterval,
  ]);

  const schedulerScriptText = useMemo(() => {
    const cutoff = cutoffTimeInput || '12:00:00';
    const interval = schedulerInterval || '1d';
    return `# ====================================================================
# SwiftStream On-Router Auto-Isolation Scheduler Script
# Automatically sweeps delinquent accounts and drops PPPoE sessions
# Target: ${activeDevice?.name || 'Core Router'} (${activeDevice?.ipAddress || '192.168.10.1'})
# Cutoff Time: ${cutoff} | Schedule Interval: ${interval}
# ====================================================================

/system script
remove [find name="swiftstream_auto_cut"]
add name="swiftstream_auto_cut" policy=read,write,test source=":log info \\"SwiftStream: Commencing daily delinquent line isolation sweep...\\"; :local isolatedCount 0; :foreach item in=[/ip firewall address-list find where list=\\"NON_PAYMENT_ISOLATION\\"] do={ :local targetIp [/ip firewall address-list get \\$item address]; :foreach session in=[/interface pppoe-server find where address=\\$targetIp] do={ :local userName [/interface pppoe-server get \\$session user]; :log warning (\\"SwiftStream Isolation: Terminating active session for overdue line: \\" . \\$userName . \\" (\\" . \\$targetIp . \\")\\"); /interface pppoe-server remove \\$session; :set isolatedCount (\\$isolatedCount + 1); } }; :log info (\\"SwiftStream: Isolation sweep finished. \\" . \\$isolatedCount . \\" delinquent sessions disconnected and redirected.\\");" comment="SwiftStream Automated Delinquent PPPoE Isolation Sweep"

/system scheduler
remove [find name="swiftstream_auto_cut_sched"]
add name="swiftstream_auto_cut_sched" start-time="${cutoff}" interval="${interval}" on-event="swiftstream_auto_cut" comment="SwiftStream Scheduled Overdue Cutoff"`;
  }, [cutoffTimeInput, schedulerInterval, activeDevice]);

  const handleDeployWalledGarden = async () => {
    if (!activeDevice) {
      showToast('error', 'No Router Selected', 'Please select an active MikroTik router first.');
      return;
    }
    setIsDeployingWalledGarden(true);
    try {
      const creds = {
        id: activeDevice.id,
        name: activeDevice.name,
        ipAddress: activeDevice.ipAddress || activeDevice.remoteAddress || '',
        port: activeDevice.port || activeDevice.webfigPort || 80,
        username: activeDevice.username || 'admin',
        password: activeDevice.password || '',
        useHttps: activeDevice.port === 443 || activeDevice.webfigPort === 443,
      };

      const res = await deployWalledGardenToRouter(creds, {
        portalUrl: portalRedirectUrl,
        portalIp: activeDevice.ipAddress,
        enableWebProxyServing,
        localProxyPort,
        localServingAddress: localServingAddress || `http://${activeDevice.ipAddress || '192.168.10.1'}/walled_garden.html`,
      });

      setWalledGardenDeployResult(res);
      showToast('success', 'Walled Garden Deployed', res.message);
      logAuditEvent({
        userName: 'Admin Leonardo Flojo',
        action: 'MIKROTIK_WALLED_GARDEN_DEPLOYED',
        category: 'network',
        severity: 'info',
        details: `Option A Walled Garden deployed to ${activeDevice.name} (${creds.ipAddress}). Captive redirect, proxy serving (${enableWebProxyServing ? 'port ' + localProxyPort : 'disabled'}), and payment whitelist provisioned.`,
        status: 'success',
      });
    } catch (err: any) {
      showToast('error', 'Deployment Failed', err?.message || 'Failed to deploy Walled Garden rules.');
    } finally {
      setIsDeployingWalledGarden(false);
    }
  };

  const handleUploadHtmlToRouter = async () => {
    if (!activeDevice) {
      showToast('error', 'No Router Selected', 'Please select an active MikroTik router first.');
      return;
    }
    setIsUploadingHtmlToRouter(true);
    setHtmlUploadResult(null);
    try {
      const creds = {
        id: activeDevice.id,
        name: activeDevice.name,
        ipAddress: activeDevice.ipAddress || activeDevice.remoteAddress || '',
        port: activeDevice.port || activeDevice.webfigPort || 80,
        username: activeDevice.username || 'admin',
        password: activeDevice.password || '',
        useHttps: activeDevice.port === 443 || activeDevice.webfigPort === 443,
      };

      const res = await uploadWalledGardenHtmlToRouter(creds, localWalledGardenHtml, {
        targetFileName: 'walled_garden.html',
        uploadToHotspotDir: true,
      });

      setHtmlUploadResult(res);
      if (res.success) {
        showToast('success', 'Router Storage Updated', res.message);
        logAuditEvent({
          userName: 'Admin Leonardo Flojo',
          action: 'MIKROTIK_HTML_UPLOADED',
          category: 'network',
          severity: 'info',
          details: `Walled Garden HTML template pushed directly to router flash (${res.targetPath}) on ${activeDevice.name}.`,
          status: 'success',
        });
      } else {
        showToast('warning', 'Direct Upload Notice', res.message);
      }
    } catch (err: any) {
      showToast('error', 'Upload Failed', err?.message || 'Failed to upload HTML template to router.');
    } finally {
      setIsUploadingHtmlToRouter(false);
    }
  };

  const handleDeployScheduler = async () => {
    if (!activeDevice) {
      showToast('error', 'No Router Selected', 'Please select an active MikroTik router first.');
      return;
    }
    setIsDeployingScheduler(true);
    setSchedulerDeployResult(null);
    try {
      const creds = {
        id: activeDevice.id,
        name: activeDevice.name,
        ipAddress: activeDevice.ipAddress || activeDevice.remoteAddress || '',
        port: activeDevice.port || activeDevice.webfigPort || 80,
        username: activeDevice.username || 'admin',
        password: activeDevice.password || '',
        useHttps: activeDevice.port === 443 || activeDevice.webfigPort === 443,
      };

      const res = await deployAutoIsolationSchedulerToRouter(creds, {
        cutoffTime: cutoffTimeInput,
        interval: schedulerInterval,
        scriptName: 'swiftstream_auto_cut',
        schedulerName: 'swiftstream_auto_cut_sched',
      });

      setSchedulerDeployResult(res);
      if (res.success) {
        showToast('success', 'Scheduler Deployed', res.message);
        logAuditEvent({
          userName: 'Admin Leonardo Flojo',
          action: 'MIKROTIK_SCHEDULER_DEPLOYED',
          category: 'network',
          severity: 'info',
          details: `Auto-isolation scheduler installed on ${activeDevice.name} at cutoff ${cutoffTimeInput} (interval ${schedulerInterval}).`,
          status: 'success',
        });
      } else {
        showToast('error', 'Scheduler Deployment Failed', res.message);
      }
    } catch (err: any) {
      showToast('error', 'Deployment Error', err?.message || 'Failed to install auto-isolation scheduler.');
    } finally {
      setIsDeployingScheduler(false);
    }
  };

  const handleIsolateSubscriber = async (cust: Customer) => {
    setIsIsolatingCustomerId(cust.id);
    try {
      if (activeDevice) {
        const creds = {
          id: activeDevice.id,
          name: activeDevice.name,
          ipAddress: activeDevice.ipAddress || activeDevice.remoteAddress || '',
          port: activeDevice.port || activeDevice.webfigPort || 80,
          username: activeDevice.username || 'admin',
          password: activeDevice.password || '',
          useHttps: activeDevice.port === 443 || activeDevice.webfigPort === 443,
        };
        await isolateOverdueSubscriber(creds, cust);
      }
      updateCustomer(cust.id, { status: 'suspended' });
      showToast('warning', 'Subscriber Isolated', `${cust.fullName} placed in Walled Garden.`);
      logAuditEvent({
        userName: 'Admin Leonardo Flojo',
        action: 'SUBSCRIBER_LINE_ISOLATED',
        category: 'network',
        severity: 'warning',
        details: `Account ${cust.accountNo} (${cust.fullName}) moved to Walled Garden isolation.`,
        status: 'success',
      });
    } catch (err: any) {
      showToast('error', 'Isolation Failed', err?.message || 'Failed to isolate subscriber.');
    } finally {
      setIsIsolatingCustomerId(null);
    }
  };

  const handleRestoreSubscriber = async (cust: Customer) => {
    setIsRestoringCustomerId(cust.id);
    try {
      if (activeDevice) {
        const creds = {
          id: activeDevice.id,
          name: activeDevice.name,
          ipAddress: activeDevice.ipAddress || activeDevice.remoteAddress || '',
          port: activeDevice.port || activeDevice.webfigPort || 80,
          username: activeDevice.username || 'admin',
          password: activeDevice.password || '',
          useHttps: activeDevice.port === 443 || activeDevice.webfigPort === 443,
        };
        const plan = plans.find((p) => p.id === cust.planId) || plans[0];
        await reconnectSubscriber(creds, cust, plan);
      }
      updateCustomer(cust.id, { status: 'active' });
      showToast('success', 'Subscriber Restored', `${cust.fullName} restored to active tier.`);
      logAuditEvent({
        userName: 'Admin Leonardo Flojo',
        action: 'SUBSCRIBER_LINE_RESTORED',
        category: 'network',
        severity: 'info',
        details: `Account ${cust.accountNo} (${cust.fullName}) restored from Walled Garden.`,
        status: 'success',
      });
    } catch (err: any) {
      showToast('error', 'Restore Failed', err?.message || 'Failed to restore subscriber.');
    } finally {
      setIsRestoringCustomerId(null);
    }
  };

  const handleBatchIsolate = async () => {
    const unisolatedOverdue = overdueCustomers.filter((c) => c.status !== 'suspended');
    if (unisolatedOverdue.length === 0) {
      showToast('info', 'No Delinquent Accounts', 'All overdue accounts are already in isolation.');
      return;
    }
    setIsBatchIsolating(true);
    let count = 0;
    try {
      for (const cust of unisolatedOverdue) {
        if (activeDevice) {
          const creds = {
            id: activeDevice.id,
            name: activeDevice.name,
            ipAddress: activeDevice.ipAddress || activeDevice.remoteAddress || '',
            port: activeDevice.port || activeDevice.webfigPort || 80,
            username: activeDevice.username || 'admin',
            password: activeDevice.password || '',
            useHttps: activeDevice.port === 443 || activeDevice.webfigPort === 443,
          };
          await isolateOverdueSubscriber(creds, cust);
        }
        updateCustomer(cust.id, { status: 'suspended' });
        count++;
      }
      showToast('success', 'Batch Isolation Complete', `Isolated ${count} delinquent accounts to Walled Garden.`);
      logAuditEvent({
        userName: 'Admin Leonardo Flojo',
        action: 'BATCH_ISOLATION_SWEEP',
        category: 'network',
        severity: 'warning',
        details: `Batch isolated ${count} accounts to Walled Garden on router ${activeDevice?.name}.`,
        status: 'success',
      });
    } catch (err: any) {
      showToast('error', 'Batch Isolation Failed', err?.message || 'Error executing batch isolation.');
    } finally {
      setIsBatchIsolating(false);
    }
  };

  // Kick / Terminate Active Session on Router
  const handleKickSession = async (session: PppoeActiveSessionItem) => {
    setKickingSessionId(session.id);

    if (activeDevice) {
      const res = await kickActivePppoeSession(
        {
          id: activeDevice.id,
          name: activeDevice.name,
          ipAddress: activeDevice.ipAddress || activeDevice.remoteAddress || '',
          port: activeDevice.port || activeDevice.webfigPort || 80,
          username: activeDevice.username || 'admin',
          password: activeDevice.password || '',
          useHttps: activeDevice.port === 443 || activeDevice.webfigPort === 443,
        },
        { username: session.username, sessionId: session.sessionId || session.id }
      );

      if (res.success) {
        logAuditEvent({
          userName: 'Admin Leonardo Flojo',
          action: 'PPPOE_SESSION_TERMINATED',
          category: 'network',
          severity: 'warning',
          details: `Terminated active PPPoE tunnel for "${session.username}" (${session.assignedIp} / ${session.callerIdMac}).`,
          status: 'success',
        });
        showToast('warning', 'Session Terminated', `Terminated PPPoE session for ${session.username}. Client will re-auth.`);
        loadRouterData();
      } else {
        showToast('error', 'Kick Failed', res.message || 'Could not terminate session on router.');
      }
    }
    setKickingSessionId(null);
  };

  // Sync Single Secret to Router
  const handleSyncSecret = async (cust: Customer) => {
    if (!activeDevice) return;
    setSyncingSecretId(cust.id);
    const plan = plans.find((p) => p.id === cust.planId);

    const res = await syncPppoeSecretToRouter(
      {
        id: activeDevice.id,
        name: activeDevice.name,
        ipAddress: activeDevice.ipAddress || activeDevice.remoteAddress || '',
        port: activeDevice.port || activeDevice.webfigPort || 80,
        username: activeDevice.username || 'admin',
        password: activeDevice.password || '',
        useHttps: activeDevice.port === 443 || activeDevice.webfigPort === 443,
      },
      {
        name: cust.network.pppoeUsername || cust.accountNo.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        password: cust.network.pppoePassword || 'swift1234',
        profile: `Plan-${plan?.speedMbps || 25}M`,
        remoteAddress: cust.network.ipAddress,
        disabled: cust.status === 'suspended' || cust.status === 'disconnected',
        comment: `${cust.fullName} - ${cust.accountNo}`,
      }
    );

    setSyncingSecretId(null);
    if (res.success) {
      showToast('success', 'Secret Synchronized', `PPPoE secret for ${cust.fullName} pushed to ${activeDevice.name}`);
      loadRouterData();
    } else {
      showToast('error', 'Sync Failed', res.message);
    }
  };

  // Toggle Enable / Disable PPPoE Secret on local subscriber & router
  const handleToggleSecretStatus = (cust: Customer) => {
    const newStatus = cust.status === 'active' ? 'suspended' : 'active';
    updateCustomer(cust.id, { status: newStatus });
    syncCustomerMikrotik(cust.id);
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: newStatus === 'active' ? 'PPPOE_SECRET_ENABLED' : 'PPPOE_SECRET_DISABLED',
      category: 'network',
      severity: newStatus === 'active' ? 'info' : 'warning',
      details: `${newStatus === 'active' ? 'Enabled' : 'Disabled'} PPPoE secret for "${cust.network.pppoeUsername}" (${cust.fullName}).`,
      status: 'success',
    });
  };

  // Batch Sync All
  const handleBatchSync = async () => {
    setIsSyncingAll(true);
    await syncAllSubscribersToMikrotik();
    setIsSyncingAll(false);
    loadRouterData();
  };

  // Bulk Sync All Simple Queues (Bandwidth limits matching plans)
  const handleBulkSyncQueues = async () => {
    if (!activeDevice) return;
    setIsSyncingQueues(true);
    setQueueSyncResult(null);

    const creds = {
      id: activeDevice.id,
      name: activeDevice.name,
      ipAddress: activeDevice.ipAddress || activeDevice.remoteAddress || '',
      port: activeDevice.port || activeDevice.webfigPort || 80,
      username: activeDevice.username || 'admin',
      password: activeDevice.password || '',
      useHttps: activeDevice.port === 443 || activeDevice.webfigPort === 443,
    };

    try {
      const res = await bulkSyncAllSimpleQueues(creds, customers, plans);
      setQueueSyncResult({ total: res.total, synced: res.synced });
      showToast(
        'success',
        'Speed Limits Synced',
        `Successfully pushed and aligned bandwidth queues for ${res.synced} of ${res.total} subscribers on ${activeDevice.name}.`
      );
      logAuditEvent({
        userName: 'Admin Leonardo Flojo',
        action: 'MIKROTIK_QUEUES_SYNCED',
        category: 'network',
        severity: 'info',
        details: `Bulk synced bandwidth queues for ${res.synced}/${res.total} subscribers on ${activeDevice.name}.`,
        status: 'success',
      });
    } catch (err: any) {
      showToast('error', 'Queue Sync Error', err?.message || 'Failed to sync simple queues to router');
    } finally {
      setIsSyncingQueues(false);
    }
  };

  const handleSyncSingleQueue = async (customer: Customer) => {
    if (!activeDevice || !customer.network?.ipAddress) return;
    const creds = {
      id: activeDevice.id,
      name: activeDevice.name,
      ipAddress: activeDevice.ipAddress || activeDevice.remoteAddress || '',
      port: activeDevice.port || activeDevice.webfigPort || 80,
      username: activeDevice.username || 'admin',
      password: activeDevice.password || '',
      useHttps: activeDevice.port === 443 || activeDevice.webfigPort === 443,
    };
    const plan = plans.find((p) => p.id === customer.planId) || plans[0] || { speedMbps: 25, name: 'Plan 25M' };
    const speed = plan.speedMbps || 25;
    const isCut = customer.status === 'suspended' || customer.status === 'disconnected';
    const limitStr = isCut ? '128k/128k' : `${speed}M/${speed}M`;
    const burstSpeed = Math.round(speed * 1.3);
    const burstThreshold = Math.round(speed * 0.85);

    try {
      const res = await syncSimpleQueue(creds, {
        name: `Q-${customer.accountNo || customer.network?.pppoeUsername || customer.id}`,
        target: customer.network.ipAddress.includes('/') ? customer.network.ipAddress : `${customer.network.ipAddress}/32`,
        maxLimit: limitStr,
        burstLimit: isCut ? undefined : `${burstSpeed}M/${burstSpeed}M`,
        burstThreshold: isCut ? undefined : `${burstThreshold}M/${burstThreshold}M`,
        burstTime: isCut ? undefined : '16s/16s',
        comment: `SwiftStream [${plan.name}] - ${customer.fullName} (${customer.accountNo})`,
        disabled: false,
      });
      if (res.success) {
        showToast('success', 'Queue Synced', `Updated speed queue for ${customer.fullName} (${limitStr}).`);
      } else {
        showToast('error', 'Sync Failed', res.details || 'Failed to sync queue.');
      }
    } catch (err: any) {
      showToast('error', 'Queue Error', err?.message || 'Failed to push queue');
    }
  };

  // Generate RouterOS Script for PPPoE
  const fullPppoeScript = useMemo(() => {
    let script = `# ====================================================================\n`;
    script += `# SwiftStream Telecommunication - PPPoE Server Full Configuration\n`;
    script += `# Router: ${activeDevice?.name || 'Core'} | Total Subscribers: ${customers.length}\n`;
    script += `# ====================================================================\n\n`;

    if (ipPools.length > 0) {
      script += `# 1. IP Pools\n/ip pool\n`;
      ipPools.forEach((pool) => {
        script += `add name="${pool.name}" ranges=${pool.ranges}${pool.nextPool ? ` next-pool=${pool.nextPool}` : ''}${pool.comment ? ` comment="${pool.comment}"` : ''}\n`;
      });
      script += `\n`;
    }

    if (profiles.length > 0) {
      script += `# 2. PPPoE Profiles\n/ppp profile\n`;
      profiles.forEach((p) => {
        script += `add name="${p.name}" rate-limit="${p.rateLimit || ''}" local-address=${p.localAddress || ''} remote-address=${p.remoteAddressPool || ''} dns-server="${p.dnsServers || ''}" only-one=${p.onlyOne || 'default'} use-encryption=${p.useEncryption || 'default'}\n`;
      });
      script += `\n`;
    }

    script += `# 3. PPPoE Server Binding\n/interface pppoe-server server\n`;
    script += `add service-name="SwiftStream-Fiber-Core" interface=ether3-pppoe max-mtu=1492 max-mru=1492 default-profile=default authentication=pap,chap,mschap2 one-session-per-host=yes disabled=no\n\n`;

    script += `# 4. PPPoE Secrets Credentials Vault\n/ppp secret\n`;
    customers.forEach((c) => {
      const plan = plans.find((p) => p.id === c.planId);
      const profileName = `Plan-${plan?.speedMbps || 25}M`;
      const pppUser = c.network.pppoeUsername || c.accountNo.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const pppPass = c.network.pppoePassword || 'swift1234';
      const isDisabled = c.status === 'suspended' || c.status === 'disconnected' ? 'yes' : 'no';
      script += `add name="${pppUser}" password="${pppPass}" service=pppoe profile="${profileName}" remote-address=${c.network.ipAddress} caller-id="${c.network.macAddress || ''}" disabled=${isDisabled} comment="${c.fullName} - ${c.accountNo}"\n`;
    });

    return script;
  }, [customers, plans, ipPools, profiles, activeDevice]);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(fullPppoeScript);
    setCopiedScript(true);
    showToast('success', 'RouterOS Script Copied', 'Paste into MikroTik Terminal or Winbox to apply.');
    setTimeout(() => setCopiedScript(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Header & Router Target Selector */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-cyan-950 text-cyan-400 border border-cyan-800/50 shadow-inner">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-slate-100">
                PPPoE Server Concentrator & Subscriber Sessions Hub
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                  activeSessions.length > 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {activeSessions.length} LIVE TUNNELS
              </span>
              {isLoading && (
                <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-mono">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Querying RouterOS...
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Target Router: <strong className="text-slate-200">{activeDevice?.name}</strong> (
              {activeDevice?.ipAddress || activeDevice?.remoteAddress}:{activeDevice?.port || activeDevice?.webfigPort || 80})
              {lastUpdated && (
                <span className="text-slate-500 ml-2 text-[10px]">
                  • Refreshed {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Router Target Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {mikrotikDevices.length > 1 && (
            <select
              value={targetDeviceId}
              onChange={(e) => setTargetDeviceId(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
            >
              {mikrotikDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.ipAddress || d.remoteAddress})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={loadRouterData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-cyan-800/60 rounded-xl font-bold transition-all cursor-pointer disabled:opacity-50"
            title="Fetch live PPPoE secrets and active tunnels directly from RouterOS"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Router</span>
          </button>

          <button
            onClick={handleBatchSync}
            disabled={isSyncingAll}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 disabled:opacity-50"
          >
            <Zap className={`w-4 h-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
            <span>{isSyncingAll ? 'Syncing...' : `Sync Subscribers (${customers.length})`}</span>
          </button>

          <button
            onClick={handleCopyScript}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-semibold transition-all hover:scale-105"
          >
            {copiedScript ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
            <span>{copiedScript ? 'Copied!' : 'Export Script'}</span>
          </button>
        </div>
      </div>

      {/* IN-PLACE ROUTEROS 401 AUTHENTICATION BANNER */}
      {authError?.is401 && (
        <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-200 shadow-xl space-y-3">
          <div className="flex items-start gap-3.5">
            <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="font-bold text-amber-300 text-sm flex items-center gap-2">
                  <span>RouterOS Authentication Required (HTTP 401 Unauthorized)</span>
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {authError.host}:{authError.port}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                The router at <span className="font-mono text-amber-300 font-semibold">{authError.host}:{authError.port}</span> rejected
                user <span className="font-mono text-amber-300 font-semibold">{authError.username}</span> because a password is required.
                Enter your RouterOS password below to unlock live PPPoE secrets, active sessions, and profiles directly from the router.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-2.5 max-w-xl">
                <div className="relative flex-1 min-w-[240px]">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter RouterOS password..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSavePasswordAndRetry();
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono pr-9 shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  onClick={handleSavePasswordAndRetry}
                  disabled={isSavingPassword || !passwordInput}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  {isSavingPassword ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isSavingPassword ? 'Connecting...' : 'Save & Connect'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3 text-xs">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeTab === 'sessions'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>⚡ Active Sessions ({activeSessions.length} Online)</span>
        </button>

        <button
          onClick={() => setActiveTab('secrets')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeTab === 'secrets'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>🔐 PPPoE Secrets ({secrets.length} on Router)</span>
        </button>

        <button
          onClick={() => setActiveTab('profiles')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeTab === 'profiles'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>🏎️ Profiles & Rates ({profiles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('queues')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeTab === 'queues'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <span>⚡ Simple Queues (Speed Limits)</span>
        </button>

        <button
          onClick={() => setActiveTab('ippool')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeTab === 'ippool'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>🌐 IP Pools ({ipPools.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('isolation')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeTab === 'isolation'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-glow-rose'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>🛡️ Walled Garden ({overdueCustomers.length})</span>
        </button>
      </div>

      {/* TAB 1: LIVE ACTIVE PPPoE SESSIONS MONITOR (RouterOS /rest/ppp/active) */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80 text-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search username, IP, or MAC..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <span className="text-xs text-slate-400 font-mono">
              Live from <strong className="text-cyan-400">{activeDevice?.name}</strong>: <strong className="text-cyan-400">{activeSessions.length}</strong> active tunnels
            </span>
          </div>

          {activeSessions.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
              <Activity className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-slate-300 font-semibold text-sm">
                No active PPPoE sessions currently on {activeDevice?.name}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {authError?.is401
                  ? 'Authentication failed. Please enter the correct router password above to view active sessions.'
                  : 'Subscriber CPE devices will appear here automatically when they establish PPPoE tunnels.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-card">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                    <th className="py-3 px-4">PPPoE User / Subscriber</th>
                    <th className="py-3 px-3">Assigned IP</th>
                    <th className="py-3 px-3">Caller ID (MAC)</th>
                    <th className="py-3 px-3">Session Uptime</th>
                    <th className="py-3 px-3">Encoding</th>
                    <th className="py-3 px-3">Session ID</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/60 font-mono">
                  {activeSessions
                    .filter(
                      (s) =>
                        s.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        s.assignedIp.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        s.callerIdMac.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((session) => {
                      const matchedCust = customers.find(
                        (c) =>
                          (c.network?.pppoeUsername && c.network.pppoeUsername.toLowerCase() === session.username.toLowerCase()) ||
                          (c.network?.ipAddress && c.network.ipAddress === session.assignedIp)
                      );
                      const isKicking = kickingSessionId === session.id;

                      return (
                        <tr key={session.id || session.username} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                              <div>
                                <span className="text-cyan-300 font-bold block">{session.username}</span>
                                {matchedCust ? (
                                  <span className="text-[11px] text-slate-400 font-sans block">
                                    {matchedCust.fullName} ({matchedCust.accountNo})
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500 font-sans block">Router Account</span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3 text-emerald-400 font-bold">{session.assignedIp || '—'}</td>
                          <td className="py-3 px-3 text-slate-400 text-[11px]">{session.callerIdMac || '—'}</td>
                          <td className="py-3 px-3 text-slate-200">{session.uptime || '—'}</td>
                          <td className="py-3 px-3 text-[10px] text-slate-400 font-sans">{session.encoding || '—'}</td>
                          <td className="py-3 px-3 text-[10px] text-slate-500">{session.sessionId || session.id || '—'}</td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 font-sans">
                              <button
                                onClick={() => handleKickSession(session)}
                                disabled={isKicking}
                                className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 rounded-lg text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                                title="Terminate PPPoE session / Force Re-auth"
                              >
                                {isKicking ? 'Kicking...' : 'Kick'}
                              </button>

                              {onSelectCustomer && matchedCust && (
                                <button
                                  onClick={() => onSelectCustomer(matchedCust.id)}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  View
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE PPPoE SECRETS VAULT (RouterOS /rest/ppp/secret) */}
      {activeTab === 'secrets' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80 text-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search secrets by username, IP, profile..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-mono">Filter Profile:</span>
              <select
                value={selectedProfileFilter}
                onChange={(e) => setSelectedProfileFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="all">All Profiles</option>
                {profiles.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {secrets.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
              <Lock className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-slate-300 font-semibold text-sm">
                No PPPoE secrets found on {activeDevice?.name}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {authError?.is401
                  ? 'Authentication failed. Please configure the router password in the banner above.'
                  : 'Click "Sync Subscribers" above to automatically push billing subscriber credentials into RouterOS.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-card">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                    <th className="py-3 px-4">PPPoE Username</th>
                    <th className="py-3 px-3">Service</th>
                    <th className="py-3 px-3">Profile</th>
                    <th className="py-3 px-3">Remote / Framed IP</th>
                    <th className="py-3 px-3">Caller ID (Lock)</th>
                    <th className="py-3 px-3">Comment / Subscriber</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/60 font-mono">
                  {secrets
                    .filter((s) => selectedProfileFilter === 'all' || s.profile === selectedProfileFilter)
                    .filter(
                      (s) =>
                        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (s.remoteAddress && s.remoteAddress.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        (s.comment && s.comment.toLowerCase().includes(searchTerm.toLowerCase()))
                    )
                    .map((secret) => {
                      const matchedCust = customers.find(
                        (c) => c.network?.pppoeUsername && c.network.pppoeUsername.toLowerCase() === secret.name.toLowerCase()
                      );
                      const isDisabled = secret.disabled;

                      return (
                        <tr key={secret.id || secret.name} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-bold text-cyan-300">
                            {secret.name}
                            {matchedCust && (
                              <span className="text-[10px] text-slate-500 font-sans block">
                                Linked: {matchedCust.fullName}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-slate-400 uppercase text-[11px]">{secret.service || 'pppoe'}</td>

                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 text-slate-300 border border-slate-800">
                              {secret.profile || 'default'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-slate-200">{secret.remoteAddress || '—'}</td>
                          <td className="py-3 px-3 text-slate-400 text-[11px]">{secret.callerId || '—'}</td>

                          <td className="py-3 px-3 text-slate-300 font-sans max-w-[200px] truncate" title={secret.comment}>
                            {secret.comment || '—'}
                          </td>

                          <td className="py-3 px-3 font-sans">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                !isDisabled
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                                  : 'bg-rose-950 text-rose-300 border border-rose-500/50'
                              }`}
                            >
                              {!isDisabled ? 'Active' : 'Disabled'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right font-sans">
                            <div className="flex items-center justify-end gap-1.5">
                              {matchedCust ? (
                                <button
                                  onClick={() => handleToggleSecretStatus(matchedCust)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    !isDisabled
                                      ? 'bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40'
                                      : 'bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40'
                                  }`}
                                >
                                  {!isDisabled ? 'Disable' : 'Enable'}
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-mono">Router Only</span>
                              )}

                              {onSelectCustomer && matchedCust && (
                                <button
                                  onClick={() => onSelectCustomer(matchedCust.id)}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PROFILES & BANDWIDTH RATE SHAPERS (RouterOS /rest/ppp/profile) */}
      {activeTab === 'profiles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono">
              Live profiles configured on <strong className="text-cyan-400">{activeDevice?.name}</strong>
            </span>
            <span className="font-mono text-slate-500">{profiles.length} Profiles</span>
          </div>

          {profiles.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3">
              <Sliders className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-slate-300 font-semibold text-sm">
                No PPPoE profiles returned from {activeDevice?.name}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {authError?.is401
                  ? 'Authentication required to inspect profiles.'
                  : 'Check your RouterOS /ppp/profile configuration or export the configuration script.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profiles.map((prof) => (
                <div key={prof.name} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-card space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-100 font-mono">{prof.name}</h4>
                      {prof.comment && <p className="text-xs text-slate-400 mt-0.5">{prof.comment}</p>}
                    </div>
                    {prof.rateLimit ? (
                      <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                        {prof.rateLimit}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-slate-950 border border-slate-800">
                        Default Rates
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-slate-800">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase font-sans block">Local Gateway</span>
                      <span className="text-slate-200">{prof.localAddress || '—'}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase font-sans block">Remote Pool</span>
                      <span className="text-slate-200">{prof.remoteAddressPool || '—'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span>DNS: {prof.dnsServers || '—'}</span>
                    <span>Only-One: <strong className="text-emerald-400 uppercase">{prof.onlyOne || 'default'}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: IP POOL & SUBNET ALLOCATOR (RouterOS /rest/ip/pool) */}
      {activeTab === 'ippool' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                <span>RouterOS IP Pools (/ip/pool)</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Real address ranges and DHCP/PPPoE pools configured on <strong className="text-slate-200">{activeDevice?.name}</strong>
              </p>
            </div>

            <span className="text-xs font-mono font-bold text-cyan-400 px-3 py-1 rounded-xl bg-cyan-950 border border-cyan-800/50">
              {ipPools.length} Configured Pools
            </span>
          </div>

          {ipPools.length === 0 ? (
            <div className="text-center py-12 px-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <Globe className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-slate-300 font-semibold text-sm">No IP Pools configured on this router</p>
              <p className="text-xs text-slate-500">Add an IP pool via RouterOS Winbox or Terminal (/ip/pool add ...)</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
              {ipPools.map((pool) => (
                <div key={pool.name} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-cyan-300">{pool.name}</span>
                    {pool.nextPool && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        Next: {pool.nextPool}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-200 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase font-sans">Ranges</span>
                    {pool.ranges}
                  </div>
                  {pool.comment && <p className="text-[11px] text-slate-400 font-sans">{pool.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: WALLED GARDEN & OVERDUE ISOLATION (OPTION A) */}
      {activeTab === 'isolation' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card space-y-6">
          {/* Header & High-Level KPIs */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>Option A Walled Garden & Overdue Isolation</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800/50 text-[10px] font-mono font-bold uppercase">
                      Captive Redirection + Whitelist
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Strict HTTP (Port 80) redirection, HTTPS (Port 443) TCP-reset captive trigger, and payment gateway whitelisting.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase font-sans">Overdue</span>
                <span className="text-amber-400 font-bold">{overdueCustomers.length} Accounts</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase font-sans">Isolated</span>
                <span className="text-rose-400 font-bold">{isolatedCount} Lines</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase font-sans">Delinquent AR</span>
                <span className="text-cyan-400 font-bold">{formatCurrency(totalOverdueBalance)}</span>
              </div>
            </div>
          </div>

          {/* Option A RouterOS Control Center */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>RouterOS Option A Configuration Center</span>
                <span className="text-slate-500 font-normal font-mono">
                  (Target: <strong className="text-cyan-400">{activeDevice?.name || 'Core Router'}</strong> @ {activeDevice?.ipAddress || '192.168.10.1'})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowWalledGardenScriptModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="View and download RouterOS .rsc script for Option A"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>View .RSC Script</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeployWalledGarden}
                  disabled={isDeployingWalledGarden || !activeDevice}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
                  title="Push Walled Garden filter, NAT, and address-list rules directly to the active MikroTik router"
                >
                  {isDeployingWalledGarden ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5" />
                  )}
                  <span>{isDeployingWalledGarden ? 'Deploying...' : 'Deploy Walled Garden to Router'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-900 text-xs">
              {/* Left Column: Portal Destination */}
              <div className="space-y-2">
                <label className="text-slate-300 font-semibold block">
                  Captive Portal Destination URL / Domain:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={portalRedirectUrl}
                    onChange={(e) => setPortalRedirectUrl(e.target.value)}
                    placeholder="https://swiftstream-billing.web.app"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  HTTP Port 80 web traffic from isolated subscribers is redirected to this portal. Port 443 HTTPS traffic to other destinations is reset with <code className="text-rose-400">tcp-reset</code> to immediately trigger smartphone captive popup notifications.
                </p>
              </div>

              {/* Right Column: Whitelist Domains Badge Overview */}
              <div className="space-y-2">
                <span className="text-slate-300 font-semibold block">
                  Pre-Whitelisted Gateways (Online Payment Permitted):
                </span>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {[
                    { name: 'GCash Web/API', domain: '*.gcash.com', col: 'text-sky-400 bg-sky-950/60 border-sky-800/40' },
                    { name: 'Maya / PayMaya', domain: '*.maya.ph', col: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40' },
                    { name: 'Xendit Gateway', domain: '*.xendit.co', col: 'text-cyan-400 bg-cyan-950/60 border-cyan-800/40' },
                    { name: 'Android Captive Probe', domain: 'connectivitycheck.gstatic.com', col: 'text-amber-400 bg-amber-950/60 border-amber-800/40' },
                    { name: 'iOS Captive Probe', domain: 'captive.apple.com', col: 'text-purple-400 bg-purple-950/60 border-purple-800/40' },
                    { name: 'Windows Probe', domain: 'msftconnecttest.com', col: 'text-blue-400 bg-blue-950/60 border-blue-800/40' },
                    { name: 'DNS Ports 53', domain: 'UDP / TCP 53', col: 'text-slate-300 bg-slate-900 border-slate-800' },
                  ].map((w, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono border ${w.col}`}
                      title={`${w.name}: ${w.domain}`}
                    >
                      <Check className="w-2.5 h-2.5" />
                      <span>{w.domain}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Router-Side Web Proxy & Offline Serving Configuration */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableWebProxyServing}
                    onChange={(e) => setEnableWebProxyServing(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 bg-slate-950 border-slate-700 cursor-pointer"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">
                      Enable Router-Side Web Proxy & Offline Serving
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/40 text-[9px] font-mono font-bold">
                      Zero-WAN Dependency
                    </span>
                  </div>
                </label>

                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-slate-400 font-mono">Proxy Port:</span>
                  <input
                    type="number"
                    value={localProxyPort}
                    onChange={(e) => setLocalProxyPort(Number(e.target.value) || 8080)}
                    disabled={!enableWebProxyServing}
                    className="w-20 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {enableWebProxyServing && (
                <div className="pt-2 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 block">
                      Local Offline Redirect Destination:
                    </label>
                    <input
                      type="text"
                      value={localServingAddress}
                      onChange={(e) => setLocalServingAddress(e.target.value)}
                      placeholder="http://192.168.10.1/walled_garden.html"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center leading-relaxed">
                    Automatically configures <code className="text-cyan-400 font-mono mx-1">/ip proxy</code> and <code className="text-cyan-400 font-mono mx-1">/ip proxy access</code> to serve <code className="text-cyan-400 font-mono mx-1">walled_garden.html</code> directly from router storage.
                  </div>
                </div>
              )}
            </div>

            {/* Deployment Feedback Banner */}
            {walledGardenDeployResult && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{walledGardenDeployResult.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWalledGardenScriptModal(true)}
                  className="text-emerald-400 hover:underline font-bold text-[11px] flex-shrink-0 cursor-pointer"
                >
                  Inspect Rules &rarr;
                </button>
              </div>
            )}
          </div>

          {/* Card: MikroTik Local Storage HTML Template Preview */}
          <div className="p-6 rounded-3xl bg-slate-950 border border-cyan-900/40 shadow-xl shadow-cyan-950/10 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-950/80 border border-cyan-800/50 text-cyan-400 mt-0.5">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-sm font-bold text-slate-100">
                      MikroTik Local Storage Template Preview (<code>walled_garden.html</code>)
                    </h5>
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/50 text-[10px] font-mono font-bold tracking-wide">
                      100% Offline Capable
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 text-[10px] font-mono font-bold">
                      Zero External Dependencies
                    </span>
                    {businessProfile?.walledGardenSettings?.enableCustomHtmlOverride ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/40 text-[10px] font-mono font-bold">
                        Custom HTML Mode
                      </span>
                    ) : businessProfile?.walledGardenSettings ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/40 text-[10px] font-mono font-bold">
                        Customized Content
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Standalone offline HTML stored directly on MikroTik flash memory (<code className="text-cyan-400">/file</code> or <code className="text-cyan-400">/hotspot</code>) to serve delinquent subscribers even during full internet isolation.
                  </p>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Edit Template Button */}
                <button
                  type="button"
                  onClick={() => setShowEditTemplateModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-600/20 cursor-pointer"
                  title="Customize Walled Garden text, payment info, and HTML code"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Template</span>
                </button>

                {/* Inline Preview Toggle */}
                <button
                  type="button"
                  onClick={() => setShowInlinePreview(!showInlinePreview)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title={showInlinePreview ? "Collapse preview window" : "Expand preview window"}
                >
                  {showInlinePreview ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                      <span>Hide Preview</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Show Preview</span>
                    </>
                  )}
                </button>

                {/* Device switch for inline preview */}
                {showInlinePreview && (
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setInlinePreviewMode('mobile')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                        inlinePreviewMode === 'mobile'
                          ? 'bg-cyan-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Smartphone className="w-3 h-3" />
                      <span>Mobile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInlinePreviewMode('desktop')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                        inlinePreviewMode === 'desktop'
                          ? 'bg-cyan-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Monitor className="w-3 h-3" />
                      <span>Desktop</span>
                    </button>
                  </div>
                )}

                {/* Fullscreen Modal Button */}
                <button
                  type="button"
                  onClick={() => setShowLocalTemplateModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold transition-all border border-slate-700 shadow-sm cursor-pointer"
                  title="Expand to Fullscreen Dialog Preview"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Fullscreen Preview</span>
                </button>

                {/* Push Directly to Router Flash */}
                <button
                  type="button"
                  onClick={handleUploadHtmlToRouter}
                  disabled={isUploadingHtmlToRouter || !activeDevice}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                  title="Push HTML directly to router flash (/file or /hotspot) using REST API"
                >
                  {isUploadingHtmlToRouter ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5" />
                  )}
                  <span>{isUploadingHtmlToRouter ? 'Pushing to Router...' : 'Push to Router Flash'}</span>
                </button>

                {/* Download Button */}
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([localWalledGardenHtml], { type: 'text/html;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'walled_garden.html';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    showToast('success', 'Template Downloaded', 'walled_garden.html ready for Winbox upload.');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-600/20 cursor-pointer"
                  title="Download standalone HTML file to upload to MikroTik router"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .html</span>
                </button>
              </div>
            </div>

            {/* Direct Upload Result Feedback Banner */}
            {htmlUploadResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                  htmlUploadResult.success
                    ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-300'
                    : 'bg-amber-950/50 border-amber-800/60 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {htmlUploadResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  )}
                  <div>
                    <span className="font-bold">{htmlUploadResult.message}</span>
                    <span className="text-[11px] block opacity-80 font-mono mt-0.5">
                      Target Path: {htmlUploadResult.targetPath} (Router: {activeDevice?.name})
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHtmlUploadResult(null)}
                  className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Live Inline Preview Container */}
            {showInlinePreview && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-slate-300 font-bold">Live Rendering View</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-cyan-400">Target: /hotspot/walled_garden.html</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([localWalledGardenHtml], { type: 'text/html;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                      }}
                      className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Test in New Window</span>
                    </button>
                  </div>
                </div>

                <div className="w-full min-h-[480px] h-[520px] bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-center p-3 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 shadow-2xl overflow-hidden border border-slate-800 bg-black flex flex-col ${
                      inlinePreviewMode === 'mobile'
                        ? 'w-[380px] rounded-[28px] border-4 border-slate-800'
                        : 'w-full rounded-xl border border-slate-800'
                    }`}
                  >
                    <div className="px-3.5 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-between flex-shrink-0">
                      <span className="text-slate-300">
                        {inlinePreviewMode === 'mobile' ? 'Mobile Viewport (380px)' : 'Full Desktop Viewport'}
                      </span>
                      <span className="text-cyan-400">Offline Standalone Mode</span>
                    </div>
                    <iframe
                      title="Walled Garden Inline Live Preview"
                      srcDoc={localWalledGardenHtml}
                      className="w-full flex-1 border-0"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Quick 3-Step Router Upload Instructions */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 text-xs text-slate-300 space-y-2.5">
              <div className="font-bold text-cyan-400 flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                <span>How to upload & bind to your MikroTik Router:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-300/90 font-sans pl-1 leading-relaxed text-[11.5px]">
                <li>
                  <strong className="text-slate-100">Winbox Drag & Drop:</strong> Open Winbox &rarr; click <strong className="text-cyan-300 font-mono">Files</strong> on the left menu, and drag <code>walled_garden.html</code> into your router files root directory (or into <code>hotspot/</code>).
                </li>
                <li>
                  <strong className="text-slate-100">Web Proxy Configuration:</strong> Run <code className="text-cyan-300 font-mono">/ip proxy set enabled=yes port=8080</code>.
                </li>
                <li>
                  <strong className="text-slate-100">Offline Serving:</strong> Isolated subscribers browsing HTTP will be directed to this local page, which displays your official GCash (<span className="text-cyan-400 font-mono font-bold">{businessProfile?.paymentGateways?.gcashNumber || '09624171684'}</span>), Maya, and hotline without requiring external internet.
                </li>
              </ol>
            </div>
          </div>

          {/* Card: On-Router Auto-Isolation Scheduler (/system script & /system scheduler) */}
          <div className="p-6 rounded-3xl bg-slate-950 border border-amber-900/40 shadow-xl shadow-amber-950/10 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-950/80 border border-amber-800/50 text-amber-400 mt-0.5">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-sm font-bold text-slate-100">
                      On-Router Auto-Isolation Scheduler (<code className="text-amber-400">/system scheduler</code>)
                    </h5>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/50 text-[10px] font-mono font-bold tracking-wide">
                      Router-Side Cron
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 text-[10px] font-mono font-bold">
                      Zero-Browser Dependency
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Installs an automated RouterOS script (<code className="text-cyan-400 font-mono">swiftstream_auto_cut</code>) and scheduler (<code className="text-cyan-400 font-mono">swiftstream_auto_cut_sched</code>) directly into router memory. Automatically disconnects active delinquent PPPoE sessions at your daily cutoff time even if your computer is shut down.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSchedulerScriptModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="View RouterOS script code for the scheduler"
                >
                  <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Inspect Script</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeployScheduler}
                  disabled={isDeployingScheduler || !activeDevice}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50 cursor-pointer"
                  title="Push /system script and /system scheduler directly to the active MikroTik router"
                >
                  {isDeployingScheduler ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                  <span>{isDeployingScheduler ? 'Installing on Router...' : 'Deploy Scheduler to Router'}</span>
                </button>
              </div>
            </div>

            {/* Scheduler Status / Feedback Banner */}
            {schedulerDeployResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                  schedulerDeployResult.success
                    ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-300'
                    : 'bg-rose-950/50 border-rose-800/60 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {schedulerDeployResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  )}
                  <span className="font-bold">{schedulerDeployResult.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSchedulerDeployResult(null)}
                  className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Scheduler Settings Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2 border-t border-slate-900 text-xs">
              {/* Cutoff Time Input + Presets */}
              <div className="space-y-2.5">
                <label className="text-slate-300 font-semibold block">
                  Daily Cutoff Execution Time (24h format):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={cutoffTimeInput}
                    onChange={(e) => setCutoffTimeInput(e.target.value)}
                    placeholder="12:00:00"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-500 font-bold"
                  />
                  <span className="text-[11px] text-slate-500 font-mono shrink-0">HH:MM:SS</span>
                </div>
                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500 block w-full">Quick Presets:</span>
                  {[
                    { label: '12:00 PM (Noon)', value: '12:00:00' },
                    { label: '8:00 AM (Morning)', value: '08:00:00' },
                    { label: '5:00 PM (Afternoon)', value: '17:00:00' },
                    { label: '11:59 PM (Midnight)', value: '23:59:00' },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setCutoffTimeInput(preset.value)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer border ${
                        cutoffTimeInput === preset.value
                          ? 'bg-amber-600 text-white border-amber-500 font-bold'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interval & Trigger frequency */}
              <div className="space-y-2.5">
                <label className="text-slate-300 font-semibold block">
                  Schedule Execution Frequency:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Every 24h', value: '1d', desc: 'Daily sweep' },
                    { label: 'Every 12h', value: '12h', desc: 'Twice daily' },
                    { label: 'Every 6h', value: '6h', desc: 'Quad sweep' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSchedulerInterval(item.value)}
                      className={`p-2 rounded-xl text-left transition-all border cursor-pointer ${
                        schedulerInterval === item.value
                          ? 'bg-amber-950/70 border-amber-600 text-amber-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-xs font-bold block">{item.label}</span>
                      <span className="text-[10px] opacity-75 font-mono">{item.value} ({item.desc})</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  RouterOS will automatically fire the script every <span className="text-amber-400 font-mono font-bold">{schedulerInterval}</span> starting at <span className="text-amber-400 font-mono font-bold">{cutoffTimeInput}</span>.
                </p>
              </div>

              {/* On-Router Execution Logic Preview */}
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-300 space-y-1.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-400 pb-1 border-b border-slate-800">
                    <span>Active Script Sweep Logic</span>
                    <span className="text-slate-500 font-mono text-[10px]">RouterOS v6/v7</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1.5 leading-relaxed">
                    1. Queries <code className="text-rose-400 font-mono">NON_PAYMENT_ISOLATION</code> address list.<br />
                    2. Matches active sessions via <code className="text-cyan-400 font-mono">/interface pppoe-server</code>.<br />
                    3. Drops session with <code className="text-rose-400 font-mono">/interface pppoe-server remove</code> to force client reconnect into the throttled <code className="text-amber-300 font-mono">isolated</code> profile.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Target Router: <strong className="text-cyan-400">{activeDevice?.name || 'Core Router'}</strong></span>
                  <span className="text-emerald-400 font-bold">&bull; Autonomous</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar & Batch Sweep */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              Showing <strong className="text-slate-200 font-mono">{overdueCustomers.length}</strong> delinquent subscribers flagged for isolation.
            </div>

            <button
              type="button"
              onClick={handleBatchIsolate}
              disabled={isBatchIsolating || overdueCustomers.filter((c) => c.status !== 'suspended').length === 0}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow transition-all disabled:opacity-50 cursor-pointer"
              title="Isolate all overdue accounts exceeding grace period into Walled Garden"
            >
              {isBatchIsolating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>
                {isBatchIsolating
                  ? 'Isolating Delinquent Accounts...'
                  : `Batch Isolate (${overdueCustomers.filter((c) => c.status !== 'suspended').length} Pending)`}
              </span>
            </button>
          </div>

          {/* Overdue / Isolated Table */}
          {overdueCustomers.length === 0 ? (
            <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="font-bold text-slate-200">All Subscriber Accounts Current!</p>
              <p className="text-xs text-slate-500 mt-1">No overdue or isolated accounts found in this billing period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <th className="py-3 px-4">Account / Subscriber</th>
                    <th className="py-3 px-3">PPPoE User</th>
                    <th className="py-3 px-3">Assigned IP</th>
                    <th className="py-3 px-3">Overdue Balance</th>
                    <th className="py-3 px-3">Walled Garden Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                  {overdueCustomers.map((c) => {
                    const isIsolated = c.status === 'suspended';
                    const isBusy = isIsolatingCustomerId === c.id || isRestoringCustomerId === c.id;

                    return (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-sans">
                          <button
                            type="button"
                            onClick={() => onSelectCustomer?.(c.id)}
                            className="font-bold text-slate-200 hover:text-cyan-400 text-left cursor-pointer transition-colors"
                          >
                            {c.fullName}
                          </button>
                          <span className="text-[10px] text-slate-500 font-mono block">{c.accountNo}</span>
                        </td>
                        <td className="py-3 px-3 text-cyan-300">
                          {c.network.pppoeUsername}
                          <span className="text-[10px] text-slate-500 block font-sans">{c.planName}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {c.network.ipAddress || '192.168.10.100'}
                        </td>
                        <td className="py-3 px-3 font-bold text-rose-400">
                          {formatCurrency(c.balance || 0)}
                        </td>
                        <td className="py-3 px-3">
                          {isIsolated ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800/60 text-[10px] font-bold uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                              ISOLATED (Walled Garden)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 text-[10px] font-bold uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              OVERDUE (Pending Cut)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-sans">
                          <div className="flex items-center justify-end gap-2">
                            {isIsolated ? (
                              <button
                                type="button"
                                onClick={() => handleRestoreSubscriber(c)}
                                disabled={isBusy}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-all shadow disabled:opacity-50 cursor-pointer flex items-center gap-1"
                                title="Remove from NON_PAYMENT_ISOLATION, restore commercial PPPoE profile and queues"
                              >
                                {isRestoringCustomerId === c.id && <RefreshCw className="w-3 h-3 animate-spin" />}
                                <span>Restore Tier</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleIsolateSubscriber(c)}
                                disabled={isBusy}
                                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-bold transition-all shadow disabled:opacity-50 cursor-pointer flex items-center gap-1"
                                title="Switch profile to isolated, add IP to NON_PAYMENT_ISOLATION, drop active session"
                              >
                                {isIsolatingCustomerId === c.id && <RefreshCw className="w-3 h-3 animate-spin" />}
                                <span>Isolate Line</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onSelectCustomer?.(c.id)}
                              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                              title="View Customer Profile"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal: Option A RouterOS Script (.rsc) Viewer */}
          {showWalledGardenScriptModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <div className="w-full max-w-3xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                      <Terminal className="w-5 h-5 text-cyan-400" />
                      <span>RouterOS Option A Walled Garden Configuration (.rsc)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ready-to-deploy script including NAT redirect, HTTPS reset, and payment gateway whitelisting.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWalledGardenScriptModal(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-400">
                    Includes rules for <strong className="text-rose-400 font-mono">{overdueCustomers.length}</strong> overdue/isolated accounts.
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(walledGardenScript);
                        setCopiedWalledGardenScript(true);
                        showToast('success', 'Copied to Clipboard', 'Option A Walled Garden script copied.');
                        setTimeout(() => setCopiedWalledGardenScript(false), 2000);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-all cursor-pointer"
                    >
                      {copiedWalledGardenScript ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedWalledGardenScript ? 'Copied!' : 'Copy Script'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([walledGardenScript], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `swiftstream_walled_garden_${Date.now()}.rsc`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        showToast('success', 'Downloaded .rsc', 'Script downloaded successfully.');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .rsc</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre leading-relaxed scrollbar-thin">
                  {walledGardenScript}
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowWalledGardenScriptModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: On-Router Auto-Isolation Scheduler Script Viewer */}
          {showSchedulerScriptModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
              <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-400" />
                      <span>RouterOS Auto-Isolation Scheduler Script</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Autonomous /system script and /system scheduler definitions for MikroTik RouterOS.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSchedulerScriptModal(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-400">
                    Cutoff: <strong className="text-amber-400 font-mono">{cutoffTimeInput}</strong> | Interval: <strong className="text-cyan-400 font-mono">{schedulerInterval}</strong>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(schedulerScriptText);
                        setCopiedSchedulerScript(true);
                        showToast('success', 'Copied to Clipboard', 'Scheduler script copied.');
                        setTimeout(() => setCopiedSchedulerScript(false), 2000);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-all cursor-pointer"
                    >
                      {copiedSchedulerScript ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedSchedulerScript ? 'Copied!' : 'Copy Script'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([schedulerScriptText], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `swiftstream_scheduler_${cutoffTimeInput.replace(/:/g, '')}.rsc`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        showToast('success', 'Downloaded .rsc', 'Scheduler script downloaded.');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition-all shadow cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .rsc</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-amber-300/90 whitespace-pre leading-relaxed scrollbar-thin">
                  {schedulerScriptText}
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowSchedulerScriptModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: MikroTik Local Storage HTML Template Preview */}
          {showLocalTemplateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
              <div className="w-full max-w-6xl h-[92vh] min-h-[640px] rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3 flex-shrink-0 bg-slate-900/90">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-cyan-950 border border-cyan-800/40 text-cyan-400">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-100 flex items-center gap-2">
                        <span className="text-base">MikroTik Local Storage Template Preview</span>
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/40 font-mono font-bold">
                          walled_garden.html
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Live interactive preview of how the offline page renders on subscriber devices during service suspension.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Device Mode Switcher */}
                    <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => setPreviewDeviceMode('mobile')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          previewDeviceMode === 'mobile'
                            ? 'bg-cyan-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Mobile (390px)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDeviceMode('tablet')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          previewDeviceMode === 'tablet'
                            ? 'bg-cyan-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Tablet className="w-3.5 h-3.5" />
                        <span>Tablet (768px)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDeviceMode('desktop')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          previewDeviceMode === 'desktop'
                            ? 'bg-cyan-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        <span>Desktop (Full)</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowLocalTemplateModal(false);
                        setShowEditTemplateModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
                      title="Edit this Walled Garden template"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Edit Template</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([localWalledGardenHtml], { type: 'text/html;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                      }}
                      className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Open template in standalone browser tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowLocalTemplateModal(false)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Close preview"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Modal Frame Container */}
                <div className="flex-1 min-h-[500px] h-full bg-slate-950 p-4 sm:p-6 flex items-center justify-center overflow-hidden relative">
                  <div
                    className={`transition-all duration-300 shadow-2xl overflow-hidden border border-slate-700/70 bg-black flex flex-col ${
                      previewDeviceMode === 'mobile'
                        ? 'w-[390px] h-full max-h-[720px] rounded-[32px] border-4 border-slate-700'
                        : previewDeviceMode === 'tablet'
                        ? 'w-[768px] h-full max-h-[720px] rounded-2xl border-2 border-slate-700'
                        : 'w-full h-full rounded-xl border border-slate-800'
                    }`}
                  >
                    <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between flex-shrink-0">
                      <span className="text-slate-300">
                        {previewDeviceMode === 'mobile'
                          ? 'iPhone / Android Preview'
                          : previewDeviceMode === 'tablet'
                          ? 'iPad / Tablet Preview'
                          : 'Desktop / PC Browser Preview'}
                      </span>
                      <span className="text-cyan-400">http://192.168.88.1/walled_garden.html</span>
                    </div>
                    <iframe
                      title="Walled Garden Offline Preview"
                      srcDoc={localWalledGardenHtml}
                      className="w-full flex-1 border-0"
                    />
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs flex-shrink-0">
                  <span className="text-slate-400 font-mono text-[11px]">
                    Configured channels: GCash (<strong className="text-cyan-400">{businessProfile?.paymentGateways?.gcashNumber || '09624171684'}</strong>) & Maya (<strong className="text-emerald-400">{businessProfile?.paymentGateways?.mayaNumber || '09624171684'}</strong>).
                  </span>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(localWalledGardenHtml);
                        setCopiedHtmlTemplate(true);
                        showToast('success', 'HTML Copied', 'Template source code copied to clipboard.');
                        setTimeout(() => setCopiedHtmlTemplate(false), 2000);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold cursor-pointer transition-all border border-slate-700"
                    >
                      {copiedHtmlTemplate ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedHtmlTemplate ? 'Copied!' : 'Copy HTML Code'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([localWalledGardenHtml], { type: 'text/html;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'walled_garden.html';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        showToast('success', 'Downloaded', 'walled_garden.html downloaded successfully.');
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold cursor-pointer shadow-lg shadow-cyan-600/20 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .html</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowLocalTemplateModal(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer transition-all"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Edit Walled Garden Template */}
          {showEditTemplateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
              <div className="w-full max-w-7xl h-[94vh] min-h-[640px] rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-3 flex-shrink-0 bg-slate-900/90">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-cyan-950 border border-cyan-800/40 text-cyan-400">
                      <Edit3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-100 flex items-center gap-2">
                        <span className="text-base">Customize Walled Garden Template</span>
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/40 font-mono font-bold">
                          walled_garden.html
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Customize notice messages, payment settlement info, and branding served to isolated subscribers.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    {/* Mode Switcher: Form vs Code */}
                    <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => setEditTab('form')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          editTab === 'form'
                            ? 'bg-cyan-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Layout className="w-3.5 h-3.5" />
                        <span>Visual Form</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditTab('code')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          editTab === 'code'
                            ? 'bg-cyan-600 text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Code className="w-3.5 h-3.5" />
                        <span>Raw HTML</span>
                      </button>
                    </div>

                    {/* Mobile View Switcher: Editor vs Live Preview */}
                    <div className="lg:hidden flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => setMobileEditorView('editor')}
                        className={`px-2.5 py-1 rounded-lg font-bold ${
                          mobileEditorView === 'editor' ? 'bg-slate-800 text-white' : 'text-slate-400'
                        }`}
                      >
                        Editor
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileEditorView('preview')}
                        className={`px-2.5 py-1 rounded-lg font-bold ${
                          mobileEditorView === 'preview' ? 'bg-slate-800 text-white' : 'text-slate-400'
                        }`}
                      >
                        Preview
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetWalledGardenDefaults}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer"
                      title="Reset all fields to standard SwiftStream defaults"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span className="hidden sm:inline">Reset Defaults</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowEditTemplateModal(false)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Discard and close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Body Split */}
                <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                  {/* Left Column: Editor Inputs */}
                  <div
                    className={`w-full lg:w-1/2 flex-1 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-900/50 border-r border-slate-800 scrollbar-thin ${
                      mobileEditorView === 'preview' ? 'hidden lg:flex' : 'flex'
                    }`}
                  >
                    {editTab === 'form' ? (
                      <div className="space-y-6">
                        {/* Section 1: Notice Header & Branding */}
                        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            <span>Notice Header & Branding</span>
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Notice Headline
                              </label>
                              <input
                                type="text"
                                value={draftSettings.headline || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, headline: e.target.value }))
                                }
                                placeholder="Internet Line Restricted"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Status Badge Text
                              </label>
                              <input
                                type="text"
                                value={draftSettings.badgeText || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, badgeText: e.target.value }))
                                }
                                placeholder="Walled Garden Active"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Company Title / Brand Name
                              </label>
                              <input
                                type="text"
                                value={draftSettings.companyTitle || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, companyTitle: e.target.value }))
                                }
                                placeholder="SwiftStream Fiber Telecommunications"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Suspension Explanation & Instructions (HTML supported)
                              </label>
                              <textarea
                                rows={3}
                                value={draftSettings.description || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, description: e.target.value }))
                                }
                                placeholder="Explain why the line is restricted and how to settle..."
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans leading-relaxed"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Reconnection Assurance Notice
                              </label>
                              <input
                                type="text"
                                value={draftSettings.reconnectNotice || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, reconnectNotice: e.target.value }))
                                }
                                placeholder="✓ Instant Automatic Reconnection..."
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Section 2: Settlement Channels */}
                        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            <span>Payment Settlement Channels</span>
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                GCash Account Number
                              </label>
                              <input
                                type="text"
                                value={draftSettings.gcashNumber || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, gcashNumber: e.target.value }))
                                }
                                placeholder="09624171684"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                GCash Account Name
                              </label>
                              <input
                                type="text"
                                value={draftSettings.gcashName || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, gcashName: e.target.value }))
                                }
                                placeholder="Leonardo Flojo Jr"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Maya Account Number
                              </label>
                              <input
                                type="text"
                                value={draftSettings.mayaNumber || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, mayaNumber: e.target.value }))
                                }
                                placeholder="09624171684"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Maya Account Name
                              </label>
                              <input
                                type="text"
                                value={draftSettings.mayaName || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, mayaName: e.target.value }))
                                }
                                placeholder="Leonardo Flojo Jr"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Bank Name (Optional)
                              </label>
                              <input
                                type="text"
                                value={draftSettings.bankName || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, bankName: e.target.value }))
                                }
                                placeholder="BDO / BPI / UnionBank / Landbank"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Bank Account Number
                              </label>
                              <input
                                type="text"
                                value={draftSettings.bankAccountNumber || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, bankAccountNumber: e.target.value }))
                                }
                                placeholder="1234-5678-9012"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Bank Account Name
                              </label>
                              <input
                                type="text"
                                value={draftSettings.bankAccountName || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, bankAccountName: e.target.value }))
                                }
                                placeholder="Leonardo Flojo Jr"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Section 3: Portal & Support Contact */}
                        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            <span>Portal Link & Support Contact</span>
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Portal Button Text
                              </label>
                              <input
                                type="text"
                                value={draftSettings.portalButtonText || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, portalButtonText: e.target.value }))
                                }
                                placeholder="Open SwiftStream Online Portal →"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Portal Redirect URL
                              </label>
                              <input
                                type="text"
                                value={draftSettings.portalUrl || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, portalUrl: e.target.value }))
                                }
                                placeholder="https://swiftstream-billing.web.app"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Support Phone / Hotline
                              </label>
                              <input
                                type="text"
                                value={draftSettings.supportPhone || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, supportPhone: e.target.value }))
                                }
                                placeholder="09624171684"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Support Email
                              </label>
                              <input
                                type="text"
                                value={draftSettings.supportEmail || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, supportEmail: e.target.value }))
                                }
                                placeholder="billing@swiftstream.ph"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                                Footer Operations Center Note
                              </label>
                              <input
                                type="text"
                                value={draftSettings.footerNote || ''}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, footerNote: e.target.value }))
                                }
                                placeholder="SwiftStream Fiber Telecommunications • Lagonoy, Camarines Sur Operations"
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Raw HTML Code Tab */
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(draftSettings.enableCustomHtmlOverride)}
                                onChange={(e) =>
                                  setDraftSettings((prev) => ({ ...prev, enableCustomHtmlOverride: e.target.checked }))
                                }
                                className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 bg-slate-900 border-slate-700 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-slate-200">
                                Enable Custom Raw HTML Override
                              </span>
                            </label>

                            <button
                              type="button"
                              onClick={handleLoadCurrentTemplateIntoCode}
                              className="text-[11px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold flex items-center gap-1.5 cursor-pointer transition-colors border border-slate-700"
                            >
                              <FileCode className="w-3.5 h-3.5" />
                              <span>Load Generated HTML into Editor</span>
                            </button>
                          </div>

                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            When enabled, the exact HTML markup below will be served from your router storage (<code className="text-cyan-400">walled_garden.html</code>). When disabled, the template is generated dynamically from the Visual Form fields.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                            <span>HTML Source Code Markup</span>
                            <span className="text-cyan-400 font-bold">{draftSettings.customHtmlOverride?.length || 0} characters</span>
                          </div>

                          <textarea
                            value={draftSettings.customHtmlOverride || ''}
                            onChange={(e) =>
                              setDraftSettings((prev) => ({
                                ...prev,
                                customHtmlOverride: e.target.value,
                                enableCustomHtmlOverride: true,
                              }))
                            }
                            placeholder="<!DOCTYPE html><html>...</html>"
                            rows={18}
                            className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-300 leading-relaxed focus:outline-none focus:border-cyan-500 resize-none scrollbar-thin"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Live Real-time Preview */}
                  <div
                    className={`w-full lg:w-1/2 flex-1 flex flex-col min-h-0 bg-slate-950 overflow-hidden ${
                      mobileEditorView === 'editor' ? 'hidden lg:flex' : 'flex'
                    }`}
                  >
                    {/* Live Preview Bar */}
                    <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-3 text-xs flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="font-bold text-slate-200 text-xs">Live Real-time Preview</span>
                        <span className="text-slate-500 font-mono text-[10px] hidden sm:inline">Updates as you type</span>
                      </div>

                      {/* Device Switcher */}
                      <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                        <button
                          type="button"
                          onClick={() => setEditPreviewDevice('mobile')}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                            editPreviewDevice === 'mobile'
                              ? 'bg-cyan-600 text-white shadow'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Smartphone className="w-3 h-3" />
                          <span>Mobile</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditPreviewDevice('desktop')}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                            editPreviewDevice === 'desktop'
                              ? 'bg-cyan-600 text-white shadow'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Monitor className="w-3 h-3" />
                          <span>Desktop</span>
                        </button>
                      </div>
                    </div>

                    {/* Frame Container */}
                    <div className="flex-1 p-3 sm:p-5 flex items-center justify-center overflow-hidden bg-slate-950 relative">
                      <div
                        className={`transition-all duration-300 shadow-2xl overflow-hidden border border-slate-700/70 bg-black flex flex-col ${
                          editPreviewDevice === 'mobile'
                            ? 'w-[380px] h-full max-h-[680px] rounded-[28px] border-4 border-slate-700'
                            : 'w-full h-full rounded-xl border border-slate-800'
                        }`}
                      >
                        <div className="px-3.5 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-between flex-shrink-0">
                          <span className="text-slate-300">
                            {editPreviewDevice === 'mobile' ? 'Mobile Viewport (380px)' : 'Desktop Viewport'}
                          </span>
                          <span className="text-cyan-400">192.168.88.1/walled_garden.html</span>
                        </div>
                        <iframe
                          title="Walled Garden Live Customizer Preview"
                          srcDoc={draftPreviewHtml}
                          className="w-full flex-1 border-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs flex-shrink-0">
                  <span className="text-slate-400 text-[11px]">
                    Saved customizations immediately apply to your router isolation page, downloads, and previews.
                  </span>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowEditTemplateModal(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer transition-all"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveWalledGardenSettings}
                      className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold cursor-pointer shadow-lg shadow-cyan-600/20 transition-all"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save & Apply Changes</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: MIKROTIK SIMPLE QUEUES (BANDWIDTH LIMITS) */}
      {activeTab === 'queues' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative w-full md:w-80 text-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search subscriber, IP, plan..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                Router: <strong className="text-cyan-400">{activeDevice?.name}</strong>
              </span>

              <button
                type="button"
                onClick={handleBulkSyncQueues}
                disabled={isSyncingQueues}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-glow-amber disabled:opacity-50 cursor-pointer"
                title="Push and enforce Simple Queues for all active subscribers matching their assigned plan speeds"
              >
                <Zap className={`w-4 h-4 ${isSyncingQueues ? 'animate-spin' : ''}`} />
                <span>{isSyncingQueues ? 'Syncing Queues...' : 'Sync All Bandwidth Queues'}</span>
              </button>
            </div>
          </div>

          {/* Sync Result Banner */}
          {queueSyncResult && (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold">Bandwidth Queues Successfully Pushed to Router</p>
                  <p className="text-emerald-400/80 text-[11px]">
                    Aligned {queueSyncResult.synced} of {queueSyncResult.total} subscriber queues on {activeDevice?.name}. Traffic shaping active.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQueueSyncResult(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium">Eligible Queue Targets</span>
              <span className="text-lg font-bold font-mono text-cyan-400 mt-1 block">
                {customers.filter((c) => c.network?.ipAddress && c.status !== 'disconnected').length} Subscribers
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium">Aggregated Downlink Allocation</span>
              <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
                {customers
                  .filter((c) => c.status === 'active')
                  .reduce((acc, c) => {
                    const p = plans.find((pl) => pl.id === c.planId);
                    return acc + (p?.speedMbps || 25);
                  }, 0)}{' '}
                Mbps
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] text-slate-400 block font-medium">Suspended / Throttled Queues</span>
              <span className="text-lg font-bold font-mono text-rose-400 mt-1 block">
                {customers.filter((c) => c.status === 'suspended').length} Throttled (128k)
              </span>
            </div>
          </div>

          {/* Queues Table */}
          <div className="rounded-2xl border border-slate-800 overflow-hidden shadow-card">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                  <th className="py-3 px-4">Queue Name & Target IP</th>
                  <th className="py-3 px-4">Subscriber Info</th>
                  <th className="py-3 px-4">Plan & Speed Limit</th>
                  <th className="py-3 px-4">Burst Thresholds</th>
                  <th className="py-3 px-4">Policy Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                {customers
                  .filter((c) => {
                    if (!searchTerm) return true;
                    const st = searchTerm.toLowerCase();
                    return (
                      c.fullName.toLowerCase().includes(st) ||
                      c.accountNo.toLowerCase().includes(st) ||
                      c.network.pppoeUsername.toLowerCase().includes(st) ||
                      c.network.ipAddress.includes(st)
                    );
                  })
                  .map((cust) => {
                    const plan = plans.find((p) => p.id === cust.planId) || plans[0] || { speedMbps: 25, name: 'Plan 25M' };
                    const speed = plan.speedMbps || 25;
                    const isCut = cust.status === 'suspended' || cust.status === 'disconnected';
                    const limitStr = isCut ? '128k / 128k' : `${speed}M / ${speed}M`;
                    const burstSpeed = Math.round(speed * 1.3);
                    const burstThreshold = Math.round(speed * 0.85);

                    return (
                      <tr key={cust.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-cyan-300">
                            Q-{cust.accountNo || cust.network.pppoeUsername}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {cust.network.ipAddress ? `${cust.network.ipAddress}/32` : 'No IP assigned'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <button
                            type="button"
                            onClick={() => onSelectCustomer && onSelectCustomer(cust.id)}
                            className="font-bold text-slate-200 hover:text-cyan-400 text-left block"
                          >
                            {cust.fullName}
                          </button>
                          <span className="text-[10px] text-slate-500 font-mono block">
                            {cust.accountNo} • {cust.network.pppoeUsername}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-bold ${
                              isCut ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {limitStr}
                          </span>
                          <span className="text-[10px] text-slate-400 font-sans block">{plan.name}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {isCut ? (
                            <span className="text-slate-600 text-[11px]">Burst Disabled</span>
                          ) : (
                            <div>
                              <span className="text-amber-300 font-semibold">{burstSpeed}M Peak</span>
                              <span className="text-[10px] text-slate-500 block">
                                Thresh: {burstThreshold}M (16s)
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {cust.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Active Plan
                            </span>
                          ) : cust.status === 'suspended' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              Throttled (128k)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                              {cust.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => handleSyncSingleQueue(cust)}
                            disabled={!cust.network?.ipAddress}
                            className="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white rounded-lg text-[10px] font-bold transition-colors border border-cyan-500/30 disabled:opacity-40 cursor-pointer"
                            title="Push this subscriber's speed limit rule to RouterOS /queue/simple"
                          >
                            Push Queue
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
