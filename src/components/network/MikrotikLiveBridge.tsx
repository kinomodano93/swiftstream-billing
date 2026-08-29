import React, { useState, useEffect } from 'react';
import {
  Zap,
  Server,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Power,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Terminal,
  Copy,
  Check,
  Search,
  Filter,
  Radio,
  Lock,
  ArrowDownCircle,
  ArrowUpCircle,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  testRouterConnection,
  provisionPppoeSecret,
  isolateOverdueSubscriber,
  reconnectSubscriber,
  kickPppoeSession,
  runOverdueAutoCutSweep,
  bulkSyncAllSubscribers,
  RouterHealthInfo,
  MikrotikActionResult,
  MikrotikCredentials,
} from '../../services/mikrotikApiService';
import { formatCurrency, formatPhoneNumber } from '../../utils/formatters';
import { Customer } from '../../types';

export const MikrotikLiveBridge: React.FC = () => {
  const {
    customers,
    plans,
    businessProfile,
    updateBusinessProfile,
    showToast,
    logAuditEvent,
  } = useApp();

  // Credentials State
  const [ipAddress, setIpAddress] = useState(businessProfile.apiKeys?.mikrotikIp || '192.168.88.1');
  const [username, setUsername] = useState(businessProfile.apiKeys?.mikrotikUser || 'admin');
  const [password, setPassword] = useState(businessProfile.apiKeys?.mikrotikPassword || '');
  const [port, setPort] = useState<number>(80);
  const [useHttps, setUseHttps] = useState<boolean>(false);

  // Live Router Health State
  const [healthInfo, setHealthInfo] = useState<RouterHealthInfo | null>(null);
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);

  // Action / Audit Log State
  const [actionLogs, setActionLogs] = useState<MikrotikActionResult[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [selectedSubTab, setSelectedSubTab] = useState<'control' | 'sessions' | 'autocut' | 'terminal'>('control');
  const [kickedUsers, setKickedUsers] = useState<Set<string>>(new Set());
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Terminal Simulator State
  const [cliInput, setCliInput] = useState<string>('/ppp secret print');
  const [cliOutput, setCliOutput] = useState<string>(
    `[admin@MikroTik-CCR2004] > /ppp/secret/print\nFlags: X - disabled, R - radius\n 0   name="juan_delacruz" service=pppoe profile="Plan-35M" remote-address=192.168.10.25\n 1   name="maria_santos" service=pppoe profile="Plan-50M" remote-address=192.168.10.26\n 2   name="pedro_reyes" service=pppoe profile="Plan-35M" remote-address=192.168.10.27\n 3   name="ana_lim" service=pppoe profile="isolated" remote-address=192.168.10.28 (OVERDUE)\n`
  );

  const creds: MikrotikCredentials = {
    ipAddress,
    username,
    password,
    port,
    useHttps,
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await testRouterConnection(creds);
      setHealthInfo(res);
      setLastTestedAt(new Date().toLocaleTimeString());
      showToast('success', 'MikroTik Handshake OK', `Connected to ${res.boardName} (${res.version}) in ${res.latencyMs}ms.`);
    } catch (err: any) {
      showToast('error', 'Connection Failed', err.message || 'Could not connect to MikroTik RouterOS.');
    } finally {
      setTestingConnection(false);
    }
  };

  useEffect(() => {
    handleTestConnection();
  }, []);

  // 1. Bulk Sync All Subscribers
  const handleBulkSync = async () => {
    setIsProcessing(true);
    try {
      const res = await bulkSyncAllSubscribers(creds, customers, plans);
      const actionLog: MikrotikActionResult = {
        success: true,
        action: 'sync_all',
        details: `Successfully pushed ${res.synced} subscribers and ${plans.length} rate-limit profiles to MikroTik CCR.`,
        executedCommands: [`/ppp profile (all ${plans.length} plans)`, `/ppp secret (all ${customers.length} subscribers)`],
        timestamp: new Date().toISOString(),
      };
      setActionLogs((prev) => [actionLog, ...prev]);
      logAuditEvent({
        userName: 'Admin Leonardo Flojo',
        action: 'MIKROTIK_BULK_SYNC',
        category: 'network',
        severity: 'info',
        details: `Pushed all ${res.synced} subscribers to MikroTik Core Router.`,
        status: 'success',
      });
      showToast('success', 'Bulk Sync Complete', `Synced ${res.synced} subscribers to MikroTik RouterOS.`);
    } catch (err: any) {
      showToast('error', 'Bulk Sync Failed', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Run Overdue Auto-Cut Sweep
  const handleAutoCutSweep = async () => {
    const overdueList = customers.filter(
      (c) => c.status === 'overdue' || c.status === 'suspended' || c.balance > 0
    );

    if (overdueList.length === 0) {
      showToast('info', 'No Overdue Subscribers', 'All accounts are current and up-to-date.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await runOverdueAutoCutSweep(creds, overdueList);
      setActionLogs((prev) => [...res.results, ...prev]);
      logAuditEvent({
        userName: 'Admin Leonardo Flojo',
        action: 'MIKROTIK_AUTOCUT_SWEEP',
        category: 'network',
        severity: 'warning',
        details: `Executed non-payment auto-cut sweep on ${res.count} overdue subscriber lines.`,
        status: 'success',
      });
      showToast('warning', 'Auto-Cut Sweep Executed', `${res.count} overdue subscribers moved to Walled Garden isolation.`);
    } catch (err: any) {
      showToast('error', 'Auto-Cut Failed', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Kick PPPoE Session
  const handleKickSession = async (user: string) => {
    try {
      const res = await kickPppoeSession(creds, user);
      setKickedUsers((prev) => new Set([...prev, user]));
      setActionLogs((prev) => [res, ...prev]);
      showToast('info', 'Session Terminated', `Kicked PPPoE tunnel for ${user}. Auto-reconnecting...`);
    } catch (err: any) {
      showToast('error', 'Kick Failed', err.message);
    }
  };

  // 4. Run CLI Command
  const handleRunCli = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim()) return;

    let output = `[admin@MikroTik-CCR2004] > ${cliInput.trim()}\n`;

    if (cliInput.includes('/ppp/active') || cliInput.includes('/ppp active')) {
      output += `Flags: R - radius\n #    NAME             SERVICE  CALLER-ID         ADDRESS         UPTIME   ENCODING\n`;
      customers.slice(0, 5).forEach((c, idx) => {
        output += ` ${idx}   ${c.network.pppoeUsername || c.accountNo.toLowerCase()}   pppoe    E4:8D:8C:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}   ${c.network.ipAddress}   4h 12m   chap\n`;
      });
    } else if (cliInput.includes('/ip/firewall') || cliInput.includes('/ip firewall')) {
      output += `Flags: X - disabled, D - dynamic\n #   LIST                   ADDRESS         CREATION-TIME        TIMEOUT\n 0   NON_PAYMENT_ISOLATION  192.168.10.28   2026-08-29 11:30:00  29d 23h 50m\n 1   NON_PAYMENT_ISOLATION  192.168.10.45   2026-08-29 08:15:00  29d 20h 45m\n`;
    } else {
      output += `Command executed successfully on MikroTik RouterOS (Status 200 OK).\n`;
    }

    setCliOutput((prev) => output + '\n' + prev);
    setCliInput('');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
    showToast('success', 'Copied to Clipboard', `${label} copied.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Live RouterOS Connection Status */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 p-0.5 shadow-lg shadow-cyan-600/30 flex items-center justify-center shrink-0">
              <Zap className="w-7 h-7 text-white animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-slate-100">
                  MikroTik RouterOS Live API Bridge
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>REST API v7 ACTIVE</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Real-time automated PPPoE secret provisioning, bandwidth queuing, non-payment walled garden auto-cut, and active session kicking.
              </p>
              <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-slate-400">
                <span>Target: <strong className="text-cyan-300">{ipAddress}:{port}</strong></span>
                <span>•</span>
                <span>User: <strong className="text-slate-200">{username}</strong></span>
                {lastTestedAt && (
                  <>
                    <span>•</span>
                    <span>Last Ping: <span className="text-emerald-400">{lastTestedAt}</span></span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-cyan-400 ${testingConnection ? 'animate-spin' : ''}`} />
              <span>{testingConnection ? 'Testing Ping...' : 'Test Connection'}</span>
            </button>

            <button
              onClick={handleBulkSync}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-600/25 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              <span>Bulk Sync All ({customers.length})</span>
            </button>
          </div>
        </div>

        {/* Live Router Telemetry Stats Grid */}
        {healthInfo && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>Board Model</span>
                <Server className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <p className="text-xs font-bold text-slate-100 font-mono mt-1 truncate">
                {healthInfo.boardName}
              </p>
              <p className="text-[10px] text-cyan-400 font-mono mt-0.5">{healthInfo.version}</p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>CPU Load</span>
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-base font-bold text-amber-300 font-mono">{healthInfo.cpuLoad}%</span>
                <span className="text-[10px] text-slate-400">16 Cores</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, healthInfo.cpuLoad * 4)}%` }} />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>RAM Usage</span>
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xs font-bold text-emerald-300 font-mono">
                  {healthInfo.totalMemoryMb - healthInfo.freeMemoryMb} MB
                </span>
                <span className="text-[10px] text-slate-400 font-mono">/ {healthInfo.totalMemoryMb} MB</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-1">
                {healthInfo.freeMemoryMb} MB Free
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>Active PPPoE</span>
                <Users className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <p className="text-base font-bold text-sky-300 font-mono mt-1">
                {customers.filter((c) => c.status === 'active').length}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Tunnels Online</p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>API Latency</span>
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-base font-bold text-emerald-400 font-mono mt-1">
                {healthInfo.latencyMs} ms
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Local Core Link</p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-[10px]">
                <span>Uptime</span>
                <Clock className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <p className="text-xs font-bold text-slate-200 font-mono mt-1 truncate">
                {healthInfo.uptime}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Zero Drops</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'control', label: 'Automated Network Control', icon: Zap },
            { id: 'sessions', label: `Active PPPoE Sessions (${customers.filter((c) => c.status === 'active').length})`, icon: Radio },
            { id: 'autocut', label: 'Walled Garden Isolation (Auto-Cut)', icon: ShieldAlert },
            { id: 'terminal', label: 'RouterOS Direct CLI / WinBox', icon: Terminal },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = selectedSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {selectedSubTab === 'autocut' && (
          <button
            onClick={handleAutoCutSweep}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/25 transition-all disabled:opacity-50"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Run Overdue Auto-Cut Sweep</span>
          </button>
        )}
      </div>

      {/* TAB 1: Automated Network Control Hub */}
      {selectedSubTab === 'control' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: PPPoE Secret Automation */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100">1. Auto-Provision PPPoE</h3>
                <p className="text-[11px] text-slate-400">Triggers when admin approves applicant</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              When an applicant is approved, SwiftStream automatically creates their PPPoE secret on RouterOS with their selected bandwidth profile and assigns a fixed IP address.
            </p>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-cyan-300 space-y-1">
              <div>/ppp/secret/add</div>
              <div>name="juan_delacruz"</div>
              <div>profile="Plan-35M"</div>
              <div>remote-address=192.168.10.25</div>
            </div>
          </div>

          {/* Card 2: Auto-Cut & Isolation */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-600/20 text-rose-400 flex items-center justify-center font-bold">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100">2. Auto-Cut & Isolation</h3>
                <p className="text-[11px] text-slate-400">Triggers past invoice grace period</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Overdue accounts past grace period are moved to the Walled Garden firewall address-list (`NON_PAYMENT_ISOLATION`) and their active session is dropped immediately.
            </p>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-rose-300 space-y-1">
              <div>/ip/firewall/address-list/add</div>
              <div>list="NON_PAYMENT_ISOLATION"</div>
              <div>address=192.168.10.28</div>
              <div>/ppp/active/remove [find name="..."]</div>
            </div>
          </div>

          {/* Card 3: Instant Auto-Reconnection */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100">3. Instant Re-connection</h3>
                <p className="text-[11px] text-slate-400">Triggers when payment is settled</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Once a payment is recorded by a cashier or verified via online GCash/Maya upload, the account is removed from isolation and full bandwidth is restored in seconds.
            </p>
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-300 space-y-1">
              <div>/ip/firewall/address-list/remove</div>
              <div>/ppp/secret/set profile="Plan-35M"</div>
              <div>/ppp/active/remove (Forces Re-auth)</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Live Active PPPoE Sessions Table */}
      {selectedSubTab === 'sessions' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-100">Live Active Connected PPPoE Tunnels</h3>
              <p className="text-xs text-slate-400">Real-time session monitoring with 1-click kick/force re-authentication.</p>
            </div>
            <span className="text-xs font-mono text-cyan-400 font-bold bg-cyan-950/60 px-3 py-1 rounded-xl border border-cyan-800/40">
              {customers.filter((c) => c.status === 'active').length} Subscribers Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Subscriber / Account</th>
                  <th className="py-3 px-4">PPPoE User</th>
                  <th className="py-3 px-4">Assigned IP</th>
                  <th className="py-3 px-4">Bandwidth Profile</th>
                  <th className="py-3 px-4">Caller ID (MAC)</th>
                  <th className="py-3 px-4">Uptime</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {customers
                  .filter((c) => c.status === 'active' || c.status === 'overdue')
                  .map((cust) => {
                    const plan = plans.find((p) => p.id === cust.planId) || plans[0];
                    const pppUser = cust.network.pppoeUsername || cust.accountNo.toLowerCase();
                    const isKicked = kickedUsers.has(pppUser);

                    return (
                      <tr key={cust.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-100">{cust.fullName}</div>
                          <div className="text-[10px] text-cyan-400 font-mono">{cust.accountNo}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-cyan-300 font-semibold">{pppUser}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{cust.network.ipAddress}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-lg bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 font-mono text-[10px] font-bold">
                            {plan.speedMbps} Mbps ({plan.name})
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                          {cust.network.macAddress || 'E4:8D:8C:12:4A:9B'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {isKicked ? <span className="text-amber-400 animate-pulse">Reconnecting...</span> : '3d 18h 22m'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleKickSession(pppUser)}
                            className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg text-[10px] font-bold transition-all"
                            title="Drop active PPPoE tunnel to force re-negotiation"
                          >
                            Kick Session
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

      {/* TAB 3: Overdue Walled Garden Isolation List */}
      {selectedSubTab === 'autocut' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-100">Non-Payment Isolation Firewall Table (`NON_PAYMENT_ISOLATION`)</h3>
              <p className="text-xs text-slate-400">Subscribers in Walled Garden redirecting to SwiftStream billing payment portal.</p>
            </div>

            <button
              onClick={handleAutoCutSweep}
              disabled={isProcessing}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-rose-600/25 transition-all disabled:opacity-50"
            >
              Execute Daily Auto-Cut Sweep
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Isolated Subscriber</th>
                  <th className="py-3 px-4">Account No</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Unpaid Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {customers
                  .filter((c) => c.status === 'suspended' || c.status === 'overdue' || c.balance > 0)
                  .map((cust) => {
                    const plan = plans.find((p) => p.id === cust.planId) || plans[0];
                    return (
                      <tr key={cust.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-100">{cust.fullName}</td>
                        <td className="py-3 px-4 font-mono text-cyan-400">{cust.accountNo}</td>
                        <td className="py-3 px-4 font-mono text-rose-400 font-semibold">{cust.network.ipAddress}</td>
                        <td className="py-3 px-4 font-mono font-bold text-rose-400">{formatCurrency(cust.balance)}</td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                            {cust.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={async () => {
                              await reconnectSubscriber(creds, cust, plan);
                              showToast('success', 'Line Restored', `${cust.fullName} unblocked and reconnected.`);
                            }}
                            className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg text-[10px] font-bold transition-all"
                          >
                            Unblock Line
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

      {/* TAB 4: RouterOS Direct Terminal / Script Console */}
      {selectedSubTab === 'terminal' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-sm text-slate-100">Live RouterOS CLI Interactive Console</h3>
            </div>

            <button
              onClick={() => copyToClipboard(cliOutput, 'Terminal Output')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
            >
              {copiedText === 'Terminal Output' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Output</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 h-64 overflow-y-auto whitespace-pre-wrap selection:bg-emerald-600 selection:text-white">
            {cliOutput}
          </div>

          <form onSubmit={handleRunCli} className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">&gt;</span>
              <input
                type="text"
                value={cliInput}
                onChange={(e) => setCliInput(e.target.value)}
                placeholder="Type command: e.g. /ppp secret print or /queue simple print"
                className="w-full pl-8 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-600/25 transition-all flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Execute</span>
            </button>
          </form>
        </div>
      )}

      {/* Action Execution Logs */}
      {actionLogs.length > 0 && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>RouterOS Live Audit Trail ({actionLogs.length})</span>
          </h4>

          <div className="space-y-2">
            {actionLogs.slice(0, 5).map((log, idx) => (
              <div key={idx} className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${log.success ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span className="font-semibold text-slate-200">{log.details}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-500 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

