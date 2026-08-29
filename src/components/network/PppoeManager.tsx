import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, Plan, PppoeActiveSession, PppoeProfile, PppoeIpPool } from '../../types';
import { generateId, formatCurrency } from '../../utils/formatters';

interface PppoeManagerProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const PppoeManager: React.FC<PppoeManagerProps> = ({ onSelectCustomer }) => {
  const { customers, plans, updateCustomer, showToast, logAuditEvent, syncCustomerMikrotik } = useApp();

  const [activeTab, setActiveTab] = useState<'sessions' | 'secrets' | 'profiles' | 'ippool' | 'isolation'>('sessions');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPlanFilter, setSelectedPlanFilter] = useState<string>('all');
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  // Kicked sessions state to simulate termination
  const [kickedSessionIds, setKickedSessionIds] = useState<Set<string>>(new Set());

  // Add/Edit Secret Modal State
  const [showSecretModal, setShowSecretModal] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [secretForm, setSecretForm] = useState({
    username: '',
    password: '',
    planId: plans[0]?.id || '',
    ipAddress: '',
    macAddress: '',
    vlanId: '100',
  });

  // Add/Edit Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [customProfiles, setCustomProfiles] = useState<PppoeProfile[]>([
    {
      id: 'prof-25m',
      name: 'Plan-25M',
      rateLimitRx: '25M',
      rateLimitTx: '25M',
      localAddress: '192.168.10.1',
      remoteAddressPool: 'pppoe-pool-lagonoy',
      dnsServers: '1.1.1.1, 8.8.8.8',
      onlyOne: 'yes',
      useEncryption: 'yes',
      comment: 'SwiftStream Fiber 25 Mbps Residential Plan',
    },
    {
      id: 'prof-50m',
      name: 'Plan-50M',
      rateLimitRx: '50M',
      rateLimitTx: '50M',
      localAddress: '192.168.10.1',
      remoteAddressPool: 'pppoe-pool-lagonoy',
      dnsServers: '1.1.1.1, 8.8.8.8',
      onlyOne: 'yes',
      useEncryption: 'yes',
      comment: 'SwiftStream Fiber 50 Mbps Power Plan',
    },
    {
      id: 'prof-100m',
      name: 'Plan-100M',
      rateLimitRx: '100M',
      rateLimitTx: '100M',
      localAddress: '192.168.10.1',
      remoteAddressPool: 'pppoe-pool-lagonoy',
      dnsServers: '1.1.1.1, 8.8.8.8',
      onlyOne: 'yes',
      useEncryption: 'yes',
      comment: 'SwiftStream Fiber 100 Mbps Ultra Plan',
    },
    {
      id: 'prof-isolated',
      name: 'ISOLATED-PROFILE',
      rateLimitRx: '256k',
      rateLimitTx: '256k',
      localAddress: '192.168.10.1',
      remoteAddressPool: 'pppoe-pool-lagonoy',
      dnsServers: '192.168.10.1',
      onlyOne: 'yes',
      useEncryption: 'no',
      comment: 'Non-payment Walled Garden Redirect Profile',
    },
  ]);

  // Derived Active PPPoE Sessions
  const activeSessions: PppoeActiveSession[] = useMemo(() => {
    return customers
      .filter((c) => c.status === 'active' && !kickedSessionIds.has(c.id))
      .map((c, index) => {
        const plan = plans.find((p) => p.id === c.planId);
        const speed = plan ? plan.speedMbps : 25;
        const rxBps = Math.round((speed * 0.45 + (index % 3) * 1.8) * 1000000);
        const txBps = Math.round((speed * 0.15 + (index % 2) * 0.9) * 1000000);

        return {
          id: `sess-${c.id}`,
          username: c.network.pppoeUsername || c.accountNo.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          customerId: c.id,
          customerName: c.fullName,
          accountNo: c.accountNo,
          service: 'pppoe',
          callerIdMac: c.network.macAddress || 'BC:24:11:89:AF:01',
          assignedIp: c.network.ipAddress,
          uptime: `${(index % 5) + 1}d ${((index * 3) % 24).toString().padStart(2, '0')}h 42m`,
          rxBps,
          txBps,
          rxBytes: (index + 4) * 8420194820,
          txBytes: (index + 2) * 2194018204,
          encoding: 'MPPE 128-bit stateless',
          status: 'active',
        };
      });
  }, [customers, plans, kickedSessionIds]);

  // IP Pool Statistics
  const ipPoolData: PppoeIpPool = useMemo(() => {
    const totalIps = 241; // 192.168.10.10 - 192.168.10.250
    const usedIps = customers.length;
    return {
      id: 'pool-01',
      name: 'pppoe-pool-lagonoy',
      subnet: '192.168.10.0/24',
      rangeStart: '192.168.10.10',
      rangeEnd: '192.168.10.250',
      totalIps,
      usedIps,
    };
  }, [customers]);

  // Kick / Terminate Active Session
  const handleKickSession = (session: PppoeActiveSession) => {
    setKickedSessionIds((prev) => new Set([...prev, session.customerId || '']));
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'PPPOE_SESSION_TERMINATED',
      category: 'network',
      severity: 'warning',
      details: `Terminated active PPPoE tunnel for "${session.username}" (${session.assignedIp} / ${session.callerIdMac}).`,
      status: 'success',
    });
    showToast('warning', 'PPPoE Session Terminated', `Kicked tunnel for ${session.username}. Client will re-authenticate.`);

    // Auto reconnect after 6 seconds
    setTimeout(() => {
      setKickedSessionIds((prev) => {
        const next = new Set(prev);
        if (session.customerId) next.delete(session.customerId);
        return next;
      });
    }, 6000);
  };

  // Toggle Enable / Disable PPPoE Secret
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

  // Generate RouterOS Script for PPPoE
  const fullPppoeScript = useMemo(() => {
    let script = `# ====================================================================\n`;
    script += `# SwiftStream Telecommunication - PPPoE Server Full Configuration\n`;
    script += `# Node: Lagonoy BNG Core | Total Subscribers: ${customers.length}\n`;
    script += `# ====================================================================\n\n`;

    script += `# 1. IP Pools\n/ip pool add name="${ipPoolData.name}" ranges=${ipPoolData.rangeStart}-${ipPoolData.rangeEnd}\n\n`;

    script += `# 2. PPPoE Profiles\n/ppp profile\n`;
    customProfiles.forEach((p) => {
      script += `add name="${p.name}" rate-limit="${p.rateLimitRx}/${p.rateLimitTx}" local-address=${p.localAddress} remote-address=${p.remoteAddressPool} dns-server="${p.dnsServers}" only-one=${p.onlyOne} use-encryption=${p.useEncryption} comment="${p.comment}"\n`;
    });

    script += `\n# 3. PPPoE Server Binding\n/interface pppoe-server server\n`;
    script += `add service-name="SwiftStream-Fiber-Lagonoy" interface=ether3-pppoe max-mtu=1492 max-mru=1492 default-profile=Plan-25M authentication=pap,chap,mschap2 one-session-per-host=yes disabled=no\n\n`;

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
  }, [customers, plans, ipPoolData, customProfiles]);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(fullPppoeScript);
    setCopiedScript(true);
    showToast('success', 'RouterOS Script Copied', 'Paste into MikroTik Terminal or Winbox to apply.');
    setTimeout(() => setCopiedScript(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Header */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-cyan-950 text-cyan-400 border border-cyan-800/50 shadow-inner">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>PPPoE Server Concentrator & Subscriber Sessions Hub</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              MikroTik RouterOS PPPoE Server BNG management, active tunnel monitoring, secret vault, and bandwidth profiles.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 text-xs">
          <button
            onClick={handleCopyScript}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-semibold transition-all hover:scale-105"
          >
            {copiedScript ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
            <span>{copiedScript ? 'Copied to Clipboard!' : 'Export RouterOS Script'}</span>
          </button>

          <button
            onClick={() => {
              setEditingCustomer(null);
              setSecretForm({
                username: `swift_sub_${customers.length + 1}`,
                password: 'swift' + Math.floor(1000 + Math.random() * 9000),
                planId: plans[0]?.id || '',
                ipAddress: `192.168.10.${customers.length + 20}`,
                macAddress: 'BC:24:11:' + Math.floor(10 + Math.random() * 89) + ':AF:01',
                vlanId: '100',
              });
              setShowSecretModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span>Add PPPoE Secret</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3 text-xs">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all ${
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
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'secrets'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>🔐 PPPoE Secrets Vault ({customers.length} Accounts)</span>
        </button>

        <button
          onClick={() => setActiveTab('profiles')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'profiles'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>🏎️ Profiles & Rate Shapers ({customProfiles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ippool')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'ippool'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>🌐 IP Pool & Subnet Manager</span>
        </button>
      </div>

      {/* TAB 1: ACTIVE PPPoE SESSIONS MONITOR */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80 text-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search username, IP, or MAC address..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <span className="text-xs text-slate-400 font-mono">
              Showing <strong className="text-cyan-400">{activeSessions.length}</strong> active tunnels on RouterOS BNG
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-card">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                  <th className="py-3 px-4">User / Subscriber</th>
                  <th className="py-3 px-3">Assigned IP</th>
                  <th className="py-3 px-3">Caller ID (MAC)</th>
                  <th className="py-3 px-3">Session Uptime</th>
                  <th className="py-3 px-3 text-right">Live RX (Download)</th>
                  <th className="py-3 px-3 text-right">Live TX (Upload)</th>
                  <th className="py-3 px-3">Encryption</th>
                  <th className="py-3 px-4 text-center">Session Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/60 font-mono">
                {activeSessions
                  .filter(
                    (s) =>
                      s.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      s.assignedIp.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      s.callerIdMac.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (s.customerName && s.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
                  )
                  .map((session) => {
                    const rxMbps = (session.rxBps / 1000000).toFixed(1);
                    const txMbps = (session.txBps / 1000000).toFixed(1);

                    return (
                      <tr key={session.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                            <div>
                              <strong className="text-slate-100 font-sans text-xs block">{session.customerName}</strong>
                              <span className="text-[10px] text-cyan-400 font-mono">{session.username}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-slate-200">{session.assignedIp}</td>
                        <td className="py-3 px-3 text-slate-400 text-[11px]">{session.callerIdMac}</td>
                        <td className="py-3 px-3 text-emerald-400">{session.uptime}</td>

                        <td className="py-3 px-3 text-right">
                          <span className="text-cyan-400 font-bold">{rxMbps} Mbps</span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <span className="text-purple-400 font-bold">{txMbps} Mbps</span>
                        </td>

                        <td className="py-3 px-3 text-[10px] text-slate-400 font-sans">{session.encoding}</td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleKickSession(session)}
                              className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 rounded-lg text-[10px] font-bold font-sans transition-colors"
                              title="Terminate PPPoE session / Force Re-auth"
                            >
                              Kick Tunnel
                            </button>

                            {onSelectCustomer && session.customerId && (
                              <button
                                onClick={() => onSelectCustomer(session.customerId!)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold font-sans transition-colors"
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
        </div>
      )}

      {/* TAB 2: PPPoE SECRETS CREDENTIALS VAULT */}
      {activeTab === 'secrets' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80 text-xs">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search subscriber username or IP..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Filter Plan:</span>
              <select
                value={selectedPlanFilter}
                onChange={(e) => setSelectedPlanFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Plans</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.speedMbps} Mbps)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-card">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                  <th className="py-3 px-4">Subscriber Name</th>
                  <th className="py-3 px-3">PPPoE Username</th>
                  <th className="py-3 px-3">Secret Password</th>
                  <th className="py-3 px-3">Rate Profile</th>
                  <th className="py-3 px-3">Framed IP</th>
                  <th className="py-3 px-3">Account Status</th>
                  <th className="py-3 px-4 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/60 font-mono">
                {customers
                  .filter((c) => selectedPlanFilter === 'all' || c.planId === selectedPlanFilter)
                  .filter(
                    (c) =>
                      c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (c.network.pppoeUsername && c.network.pppoeUsername.toLowerCase().includes(searchTerm.toLowerCase())) ||
                      c.network.ipAddress.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((cust) => {
                    const plan = plans.find((p) => p.id === cust.planId);
                    const isActive = cust.status === 'active';

                    return (
                      <tr key={cust.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-sans font-bold text-slate-100">
                          {cust.fullName}
                          <span className="text-[10px] text-slate-500 font-mono block">{cust.accountNo}</span>
                        </td>

                        <td className="py-3 px-3 text-cyan-300 font-bold">{cust.network.pppoeUsername}</td>
                        <td className="py-3 px-3 text-slate-400">{cust.network.pppoePassword || '••••••••'}</td>

                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 text-slate-300 border border-slate-800">
                            Plan-{plan?.speedMbps || 25}M
                          </span>
                        </td>

                        <td className="py-3 px-3 text-slate-200">{cust.network.ipAddress}</td>

                        <td className="py-3 px-3 font-sans">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isActive
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                                : 'bg-rose-950 text-rose-300 border border-rose-500/50'
                            }`}
                          >
                            {isActive ? 'Enabled' : 'Disabled / Suspended'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleSecretStatus(cust)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                isActive
                                  ? 'bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40'
                                  : 'bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40'
                              }`}
                              title={isActive ? 'Disable PPPoE Secret' : 'Enable PPPoE Secret'}
                            >
                              {isActive ? 'Disable' : 'Enable'}
                            </button>

                            {onSelectCustomer && (
                              <button
                                onClick={() => onSelectCustomer(cust.id)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition-colors"
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
        </div>
      )}

      {/* TAB 3: PROFILES & BANDWIDTH RATE SHAPERS */}
      {activeTab === 'profiles' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customProfiles.map((prof) => (
              <div key={prof.id} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-card space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-slate-100">{prof.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{prof.comment}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                    {prof.rateLimitRx} / {prof.rateLimitTx}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-slate-800">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-sans block">Local Gateway IP</span>
                    <span className="text-slate-200">{prof.localAddress}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-sans block">Remote IP Pool</span>
                    <span className="text-slate-200">{prof.remoteAddressPool}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>DNS: {prof.dnsServers}</span>
                  <span>Only-One: <strong className="text-emerald-400 uppercase">{prof.onlyOne}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: IP POOL & SUBNET ALLOCATOR */}
      {activeTab === 'ippool' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                <span>PPPoE Dynamic & Static IP Pool Allocation</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Subnet: <strong className="text-slate-200 font-mono">{ipPoolData.subnet}</strong> ({ipPoolData.rangeStart} – {ipPoolData.rangeEnd})
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Allocated IPs</span>
                <span className="text-base font-bold text-cyan-400">{ipPoolData.usedIps}</span>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-slate-500 block text-[10px] uppercase">Available Free</span>
                <span className="text-base font-bold text-emerald-400">{ipPoolData.totalIps - ipPoolData.usedIps}</span>
              </div>
            </div>
          </div>

          {/* Pool Utilization Bar */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Subnet Capacity Utilization:</span>
              <span className="font-mono font-bold text-cyan-400">
                {Math.round((ipPoolData.usedIps / ipPoolData.totalIps) * 100)}% Used
              </span>
            </div>
            <div className="h-3 w-full bg-slate-950 rounded-full p-0.5 border border-slate-800 overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((ipPoolData.usedIps / ipPoolData.totalIps) * 100)}%` }}
              />
            </div>
          </div>

          {/* Subnet Address Map Grid */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300">Live Framed IP Leases</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              {customers.map((c) => (
                <div key={c.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-slate-200 font-bold block text-[11px]">{c.network.ipAddress}</span>
                    <span className="text-[10px] text-slate-500 truncate block">{c.network.pppoeUsername}</span>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
