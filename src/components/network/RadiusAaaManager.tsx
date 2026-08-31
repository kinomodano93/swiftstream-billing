import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Server,
  Users,
  Activity,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Power,
  Key,
  Database,
  Sliders,
  Clock,
  ArrowDownUp,
  Wifi,
  ChevronRight,
  Settings,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RadiusServerConfig, RadiusUser, RadiusSession } from '../../types';

export const RadiusAaaManager: React.FC = () => {
  const { customers, plans } = useApp();

  const [activeTab, setActiveTab] = useState<'sessions' | 'users' | 'servers'>('sessions');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Mock FreeRADIUS Server Configuration
  const [radiusServers, setRadiusServers] = useState<RadiusServerConfig[]>([
    {
      id: 'rad-srv-01',
      name: 'Primary FreeRADIUS Cluster (AAA-01)',
      serverIp: '10.100.0.15',
      authPort: 1812,
      acctPort: 1813,
      secret: 'SwiftStreamRadiusSecretKey2026',
      coaPort: 3799,
      nasIdentifier: 'NAS-MIKROTIK-CORE-CCR',
      isActive: true,
      isDefault: true,
      description: 'Production FreeRADIUS v3.2 on Ubuntu 24.04 LTS (MySQL / MariaDB backend)',
      createdAt: '2026-01-15T00:00:00Z',
    },
    {
      id: 'rad-srv-02',
      name: 'Secondary Backup FreeRADIUS (AAA-02)',
      serverIp: '10.100.0.16',
      authPort: 1812,
      acctPort: 1813,
      secret: 'SwiftStreamRadiusSecretKey2026',
      coaPort: 3799,
      nasIdentifier: 'NAS-MIKROTIK-BACKUP',
      isActive: false,
      isDefault: false,
      description: 'Hot standby failover accounting node',
      createdAt: '2026-03-10T00:00:00Z',
    },
  ]);

  // Mock RADIUS Users (radcheck / radreply)
  const [radiusUsers, setRadiusUsers] = useState<RadiusUser[]>([
    {
      id: 'ru-1',
      username: 'pppoe_edcruz',
      value: 'fiber@2026',
      attribute: 'Cleartext-Password',
      op: ':=',
      planName: 'Swift Fiber 50 Mbps',
      rateLimit: '50M/50M',
      framedIp: '10.200.14.88',
      framedPool: 'FIBER-DHCP-POOL-01',
      simultaneousUse: 1,
      groupName: 'RESIDENTIAL-50M',
      status: 'active',
    },
    {
      id: 'ru-2',
      username: 'pppoe_msantos',
      value: 'swift@pass99',
      attribute: 'Cleartext-Password',
      op: ':=',
      planName: 'Swift Turbo 100 Mbps',
      rateLimit: '100M/100M',
      framedIp: '10.200.14.89',
      framedPool: 'FIBER-DHCP-POOL-01',
      simultaneousUse: 1,
      groupName: 'RESIDENTIAL-100M',
      status: 'active',
    },
    {
      id: 'ru-3',
      username: 'pppoe_bdelrosario',
      value: 'secretPass123',
      attribute: 'Cleartext-Password',
      op: ':=',
      planName: 'Swift Starter 30 Mbps',
      rateLimit: '30M/30M',
      framedIp: '10.200.14.90',
      framedPool: 'FIBER-DHCP-POOL-01',
      simultaneousUse: 1,
      groupName: 'RESIDENTIAL-30M',
      status: 'active',
    },
    {
      id: 'ru-4',
      username: 'pppoe_overdue_user',
      value: 'lockedPass',
      attribute: 'Cleartext-Password',
      op: ':=',
      planName: 'Swift Starter 30 Mbps',
      rateLimit: '512k/512k',
      framedPool: 'ISOLATION-POOL',
      simultaneousUse: 1,
      groupName: 'ISOLATED-USERS',
      status: 'disabled',
    },
  ]);

  // Mock Active Accounting Sessions (radacct)
  const [sessions, setSessions] = useState<RadiusSession[]>([
    {
      id: 'sess-001',
      username: 'pppoe_edcruz',
      nasIpAddress: '10.100.0.1',
      framedIpAddress: '10.200.14.88',
      callingStationId: '48:8F:5A:11:22:33',
      acctSessionId: '8294a001',
      acctSessionTime: 14520, // ~4 hrs
      acctInputOctets: 1245000000, // 1.2 GB
      acctOutputOctets: 8450000000, // 8.4 GB
      acctStartTime: new Date(Date.now() - 14520000).toISOString(),
      nasPortType: 'PPPoE',
      status: 'active',
    },
    {
      id: 'sess-002',
      username: 'pppoe_msantos',
      nasIpAddress: '10.100.0.1',
      framedIpAddress: '10.200.14.89',
      callingStationId: 'E4:8D:8C:44:55:66',
      acctSessionId: '8294a002',
      acctSessionTime: 86400, // 24 hrs
      acctInputOctets: 4500000000, // 4.5 GB
      acctOutputOctets: 34200000000, // 34.2 GB
      acctStartTime: new Date(Date.now() - 86400000).toISOString(),
      nasPortType: 'PPPoE',
      status: 'active',
    },
    {
      id: 'sess-003',
      username: 'pppoe_bdelrosario',
      nasIpAddress: '10.100.0.1',
      framedIpAddress: '10.200.14.90',
      callingStationId: '70:A7:41:77:88:99',
      acctSessionId: '8294a003',
      acctSessionTime: 3600, // 1 hr
      acctInputOctets: 320000000, // 320 MB
      acctOutputOctets: 1900000000, // 1.9 GB
      acctStartTime: new Date(Date.now() - 3600000).toISOString(),
      nasPortType: 'PPPoE',
      status: 'active',
    },
  ]);

  // User creation modal
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRateLimit, setNewRateLimit] = useState('50M/50M');
  const [newFramedIp, setNewFramedIp] = useState('');

  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    return `${h}h ${m}m`;
  };

  const handleDisconnectSession = (sessionId: string, username: string) => {
    // Send RFC 3576 CoA / PoD packet simulation
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    showToast(`PoD Disconnect packet sent for ${username} (Session ${sessionId} terminated).`);
  };

  const handleSyncSessions = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      showToast('FreeRADIUS live accounting table synced with MikroTik NAS!');
    }, 900);
  };

  const handleAddRadiusUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;

    const user: RadiusUser = {
      id: `ru-${Date.now()}`,
      username: newUsername.trim(),
      value: newPassword.trim(),
      attribute: 'Cleartext-Password',
      op: ':=',
      rateLimit: newRateLimit,
      framedIp: newFramedIp.trim() || undefined,
      simultaneousUse: 1,
      groupName: `GROUP-${newRateLimit}`,
      status: 'active',
    };

    setRadiusUsers([user, ...radiusUsers]);
    setIsAddUserOpen(false);
    setNewUsername('');
    setNewPassword('');
    setNewFramedIp('');
    showToast(`RADIUS user ${user.username} created and written to radcheck!`);
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm font-medium">{toastMessage}</p>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-600/10 via-orange-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-amber-600 to-orange-500 rounded-xl text-white shadow-lg shadow-amber-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                  RADIUS / AAA Management
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-medium border border-amber-500/30">
                    FreeRADIUS & MikroTik
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  Centralized FreeRADIUS authentication, bandwidth rate-limiting attributes, live accounting, and CoA disconnects.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncSessions}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync Accounting
            </button>

            <button
              onClick={() => setIsAddUserOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-amber-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add RADIUS User
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Active AAA Sessions</p>
              <p className="text-xl font-bold text-slate-100 font-mono">{sessions.length}</p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Provisioned Users</p>
              <p className="text-xl font-bold text-slate-100 font-mono">{radiusUsers.length}</p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Active RADIUS Servers</p>
              <p className="text-xl font-bold text-slate-100 font-mono">
                {radiusServers.filter((s) => s.isActive).length}/{radiusServers.length}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
              <ArrowDownUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Live Aggregate Traffic</p>
              <p className="text-xl font-bold text-slate-100 font-mono">
                {formatBytes(sessions.reduce((acc, s) => acc + s.acctOutputOctets, 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'sessions'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Active Sessions ({sessions.length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'users'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          RADIUS Users ({radiusUsers.length})
        </button>

        <button
          onClick={() => setActiveTab('servers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'servers'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          Server Cluster Config
        </button>
      </div>

      {/* TAB 1: ACTIVE SESSIONS (radacct) */}
      {activeTab === 'sessions' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Live FreeRADIUS Accounting (radacct)
            </h2>
            <span className="text-xs text-slate-400">
              Auto-updating via RADIUS Interim-Update (1813/UDP)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Subscriber / Username</th>
                  <th className="px-4 py-3">Framed IP</th>
                  <th className="px-4 py-3">Calling Station (MAC)</th>
                  <th className="px-4 py-3">NAS IP</th>
                  <th className="px-4 py-3">Session Uptime</th>
                  <th className="px-4 py-3">Data Download (Rx)</th>
                  <th className="px-4 py-3">Data Upload (Tx)</th>
                  <th className="px-4 py-3 text-right">CoA Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sessions.map((sess) => (
                  <tr key={sess.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        {sess.username}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-cyan-400">{sess.framedIpAddress}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{sess.callingStationId}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{sess.nasIpAddress}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono">{formatUptime(sess.acctSessionTime)}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">{formatBytes(sess.acctOutputOctets)}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">{formatBytes(sess.acctInputOctets)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDisconnectSession(sess.id, sess.username)}
                        className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] font-semibold transition-all"
                        title="Send RFC 3576 Disconnect-Request (PoD) to NAS"
                      >
                        Disconnect (PoD)
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RADIUS USERS (radcheck / radreply) */}
      {activeTab === 'users' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              RADIUS Users Database (radcheck & radreply)
            </h2>
            <span className="text-xs text-slate-400">Total: {radiusUsers.length} accounts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Mikrotik-Rate-Limit</th>
                  <th className="px-4 py-3">Framed IP / Pool</th>
                  <th className="px-4 py-3">Simultaneous-Use</th>
                  <th className="px-4 py-3">Group / Profile</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {radiusUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-200 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      {user.username}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-amber-400">{user.rateLimit || 'Default'}</td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {user.framedIp || user.framedPool || 'Dynamic'}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">{user.simultaneousUse}</td>
                    <td className="px-4 py-3 text-slate-400">{user.groupName || 'None'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          user.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {user.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setRadiusUsers(radiusUsers.filter((u) => u.id !== user.id));
                          showToast(`User ${user.username} removed from RADIUS database.`);
                        }}
                        className="text-rose-400 hover:text-rose-300 text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SERVER CLUSTER CONFIG */}
      {activeTab === 'servers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {radiusServers.map((srv) => (
            <div key={srv.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-400" />
                    {srv.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{srv.description}</p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    srv.isActive
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {srv.isActive ? 'ONLINE' : 'STANDBY'}
                </span>
              </div>

              <div className="bg-slate-950 rounded-xl p-3.5 space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Server IP / Host:</span>
                  <span className="text-slate-200 font-bold">{srv.serverIp}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Auth Port:</span>
                  <span className="text-cyan-400">{srv.authPort} UDP</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Accounting Port:</span>
                  <span className="text-cyan-400">{srv.acctPort} UDP</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>CoA / PoD Port:</span>
                  <span className="text-amber-400">{srv.coaPort || 3799} UDP</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Shared Secret:</span>
                  <span className="text-slate-500">••••••••••••••••</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add RADIUS User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
                <Lock className="w-4 h-4 text-amber-400" />
                Add FreeRADIUS User (radcheck)
              </h3>
              <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddRadiusUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Username (PPPoE / IPoE MAC) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. pppoe_jdelacruz"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Password (Cleartext-Password) *</label>
                <input
                  type="password"
                  required
                  placeholder="Secret password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Mikrotik-Rate-Limit</label>
                <select
                  value={newRateLimit}
                  onChange={(e) => setNewRateLimit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  <option value="30M/30M">30M/30M (Swift Starter 30 Mbps)</option>
                  <option value="50M/50M">50M/50M (Swift Fiber 50 Mbps)</option>
                  <option value="100M/100M">100M/100M (Swift Turbo 100 Mbps)</option>
                  <option value="200M/200M">200M/200M (Swift Gig 200 Mbps)</option>
                  <option value="512k/512k">512k/512k (Overdue Throttled)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Framed-IP-Address (Optional Static IP)</label>
                <input
                  type="text"
                  placeholder="10.200.14.X (Leave blank for dynamic pool)"
                  value={newFramedIp}
                  onChange={(e) => setNewFramedIp(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

