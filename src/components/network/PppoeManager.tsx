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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, Plan } from '../../types';
import {
  kickActivePppoeSession,
  syncPppoeSecretToRouter,
  fetchPppoeSecretsDetailed,
  fetchPppoeActiveSessions,
  fetchPppoeProfilesDetailed,
  fetchIpPools,
  PppoeSecretItem,
  PppoeActiveSessionItem,
  PppoeProfileItem,
  IpPoolItem,
} from '../../services/mikrotikApiService';

interface PppoeManagerProps {
  onSelectCustomer?: (customerId: string) => void;
  selectedDeviceId?: string;
}

export const PppoeManager: React.FC<PppoeManagerProps> = ({ onSelectCustomer, selectedDeviceId }) => {
  const {
    customers,
    plans,
    mikrotikDevices,
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

  const [activeTab, setActiveTab] = useState<'sessions' | 'secrets' | 'profiles' | 'ippool' | 'isolation'>('sessions');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedProfileFilter, setSelectedProfileFilter] = useState<string>('all');
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [syncingSecretId, setSyncingSecretId] = useState<string | null>(null);
  const [kickingSessionId, setKickingSessionId] = useState<string | null>(null);

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

      {/* TAB 5: WALLED GARDEN & OVERDUE ISOLATION */}
      {activeTab === 'isolation' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <span>Walled Garden & Delinquent Subscriber Isolation</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Subscribers with overdue invoices flagged for automated redirection and rate-shaping.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-xl bg-rose-950 text-rose-300 border border-rose-800/50 font-bold">
                {overdueCustomers.length} Overdue Accounts
              </span>
            </div>
          </div>

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
                    <th className="py-3 px-4">Account / Name</th>
                    <th className="py-3 px-3">PPPoE User</th>
                    <th className="py-3 px-3">IP Address</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                  {overdueCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-sans font-bold text-slate-200">
                        {c.fullName}
                        <span className="text-[10px] text-slate-500 font-mono block">{c.accountNo}</span>
                      </td>
                      <td className="py-3 px-3 text-cyan-300">{c.network.pppoeUsername}</td>
                      <td className="py-3 px-3 text-slate-300">{c.network.ipAddress}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/50 uppercase text-[10px] font-bold">
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          onClick={() => {
                            updateCustomer(c.id, { status: 'active' });
                            showToast('success', 'Account Restored', `Restored ${c.fullName} to active tier.`);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          Restore Tier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
