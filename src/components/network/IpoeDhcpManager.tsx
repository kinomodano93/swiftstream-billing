import React, { useState, useMemo } from 'react';
import {
  Network,
  Server,
  Search,
  Plus,
  Lock,
  Unlock,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Clock,
  Radio,
  Sliders,
  UserCheck,
  AlertTriangle,
  ChevronRight,
  Filter,
  Layers,
  ArrowDownUp,
  Cpu,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DhcpLease } from '../../types';

export const IpoeDhcpManager: React.FC = () => {
  const { customers, mikrotikDevices } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServer, setSelectedServer] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Mock DHCP Leases / IPoE MAC Bindings
  const [leases, setLeases] = useState<DhcpLease[]>([
    {
      id: 'dhcp-1',
      address: '10.200.20.50',
      macAddress: 'BC:24:11:88:42:19',
      server: 'DHCP-IPOE-BRGY-SANVICENTE',
      clientHostname: 'TP-Link_Archer_AX23',
      activeAddress: '10.200.20.50',
      activeMacAddress: 'BC:24:11:88:42:19',
      activeClientHostname: 'TP-Link_Archer_AX23',
      status: 'static',
      dynamic: false,
      disabled: false,
      expiresAfter: 'Never (Static)',
      lastSeen: '1m ago',
      comment: 'IPoE Plan 50M - Eduardo Dela Cruz',
      rateLimit: '50M/50M',
      circuitId: 'OLT01-PON02-ONT04',
      remoteId: 'SAN-VICENTE-ZONE1',
      customerName: 'Eduardo Dela Cruz',
    },
    {
      id: 'dhcp-2',
      address: '10.200.20.51',
      macAddress: '48:8F:5A:22:99:AA',
      server: 'DHCP-IPOE-BRGY-SANVICENTE',
      clientHostname: 'Huawei_ONT_Router',
      activeAddress: '10.200.20.51',
      activeMacAddress: '48:8F:5A:22:99:AA',
      activeClientHostname: 'Huawei_ONT_Router',
      status: 'bound',
      dynamic: true,
      disabled: false,
      expiresAfter: '23h 42m',
      lastSeen: '30s ago',
      comment: 'Dynamic Lease - Option 82 Verified',
      circuitId: 'OLT01-PON02-ONT07',
      remoteId: 'SAN-VICENTE-ZONE1',
      customerName: 'Maria Theresa Santos',
    },
    {
      id: 'dhcp-3',
      address: '10.200.20.199',
      macAddress: 'D8:07:B6:33:11:F2',
      server: 'DHCP-IPOE-BRGY-SANVICENTE',
      clientHostname: 'Unknown-Android-Device',
      activeAddress: '10.200.20.199',
      activeMacAddress: 'D8:07:B6:33:11:F2',
      status: 'quarantined',
      dynamic: false,
      disabled: true,
      expiresAfter: 'Blocked',
      lastSeen: '4h ago',
      comment: 'QUARANTINE: Rogue DHCP client / Unauthorized MAC bypass attempt',
      circuitId: 'OLT01-PON01-ONT12',
    },
    {
      id: 'dhcp-4',
      address: '10.200.30.12',
      macAddress: '70:A7:41:BB:CC:DD',
      server: 'DHCP-IPOE-BRGY-POBLACION',
      clientHostname: 'Mercusys_Halo_Mesh',
      activeAddress: '10.200.30.12',
      activeMacAddress: '70:A7:41:BB:CC:DD',
      status: 'bound',
      dynamic: true,
      disabled: false,
      expiresAfter: '18h 10m',
      lastSeen: '2m ago',
      comment: 'Dynamic IPoE Lease',
      circuitId: 'OLT02-PON01-ONT02',
      remoteId: 'CABUYAO-POBLACION',
    },
  ]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newMac, setNewMac] = useState('');
  const [newServerName, setNewServerName] = useState('DHCP-IPOE-BRGY-SANVICENTE');
  const [newComment, setNewComment] = useState('');
  const [newRateLimit, setNewRateLimit] = useState('50M/50M');

  const filteredLeases = useMemo(() => {
    return leases.filter((l) => {
      const matchesServer = selectedServer === 'all' || l.server === selectedServer;
      const matchesStatus = selectedStatus === 'all' || l.status === selectedStatus;
      const q = searchQuery.toLowerCase();
      const matchesQuery =
        !q ||
        l.address.includes(q) ||
        l.macAddress.toLowerCase().includes(q) ||
        (l.clientHostname && l.clientHostname.toLowerCase().includes(q)) ||
        (l.comment && l.comment.toLowerCase().includes(q)) ||
        (l.customerName && l.customerName.toLowerCase().includes(q)) ||
        (l.circuitId && l.circuitId.toLowerCase().includes(q));

      return matchesServer && matchesStatus && matchesQuery;
    });
  }, [leases, selectedServer, selectedStatus, searchQuery]);

  const handleRefreshLeases = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('RouterOS DHCP leases (/rest/ip/dhcp-server/lease) refreshed.');
    }, 750);
  };

  const handleMakeStatic = (lease: DhcpLease) => {
    setLeases((prev) =>
      prev.map((l) =>
        l.id === lease.id
          ? {
              ...l,
              status: 'static',
              dynamic: false,
              expiresAfter: 'Never (Static)',
              comment: l.comment ? `${l.comment} (Static Binding)` : 'Static IPoE MAC Binding',
            }
          : l
      )
    );
    showToast(`Lease for MAC ${lease.macAddress} converted to Static MAC Binding!`);
  };

  const handleQuarantineMac = (lease: DhcpLease) => {
    setLeases((prev) =>
      prev.map((l) =>
        l.id === lease.id
          ? {
              ...l,
              status: 'quarantined',
              disabled: true,
              expiresAfter: 'Quarantined / Dropped',
              comment: `QUARANTINE: Blocked by admin on ${new Date().toLocaleDateString()}`,
            }
          : l
      )
    );
    showToast(`MAC ${lease.macAddress} quarantined and added to MikroTik drop firewall.`);
  };

  const handleUnblockMac = (lease: DhcpLease) => {
    setLeases((prev) =>
      prev.map((l) =>
        l.id === lease.id
          ? {
              ...l,
              status: 'bound',
              disabled: false,
              expiresAfter: '24h',
              comment: 'Restored lease',
            }
          : l
      )
    );
    showToast(`MAC ${lease.macAddress} unblocked.`);
  };

  const handleAddStaticBinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIp.trim() || !newMac.trim()) return;

    const newLease: DhcpLease = {
      id: `dhcp-${Date.now()}`,
      address: newIp.trim(),
      macAddress: newMac.trim().toUpperCase(),
      server: newServerName,
      status: 'static',
      dynamic: false,
      disabled: false,
      expiresAfter: 'Never (Static)',
      lastSeen: 'Just added',
      comment: newComment.trim() || 'Static IPoE Binding',
      rateLimit: newRateLimit,
    };

    setLeases([newLease, ...leases]);
    setIsAddModalOpen(false);
    setNewIp('');
    setNewMac('');
    setNewComment('');
    showToast(`Static DHCP binding created for ${newLease.address} (${newLease.macAddress})!`);
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
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-indigo-600/10 via-purple-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                <Network className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                  IPoE / DHCP Server Management
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-medium border border-indigo-500/30">
                    MikroTik Option 82 & MAC Binding
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  Run IPoE with DHCP alongside PPPoE, lock static MAC bindings, inspect Option 82 circuit IDs, and quarantine rogue clients.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshLeases}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              Poll Leases
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Static MAC Binding
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Active Bound Leases</p>
              <p className="text-xl font-bold text-slate-100 font-mono">
                {leases.filter((l) => l.status === 'bound').length}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Static MAC Bindings</p>
              <p className="text-xl font-bold text-slate-100 font-mono">
                {leases.filter((l) => l.status === 'static').length}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Quarantined Rogue MACs</p>
              <p className="text-xl font-bold text-slate-100 font-mono">
                {leases.filter((l) => l.status === 'quarantined').length}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">DHCP Server Pools</p>
              <p className="text-xl font-bold text-slate-100 font-mono">2 Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search IP address, MAC address, hostname, subscriber name, Option 82 circuit ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {['all', 'bound', 'static', 'quarantined'].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedStatus === st
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800/80'
              }`}
            >
              {st === 'all' ? 'All Leases' : st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Leases Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3">MAC Address</th>
                <th className="px-4 py-3">Client Hostname / Subscriber</th>
                <th className="px-4 py-3">Option 82 Circuit ID</th>
                <th className="px-4 py-3">DHCP Server Pool</th>
                <th className="px-4 py-3">Expires / Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLeases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No DHCP leases found matching your search.
                  </td>
                </tr>
              ) : (
                filteredLeases.map((lease) => {
                  const statusBadge =
                    lease.status === 'static'
                      ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                      : lease.status === 'bound'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/30';

                  return (
                    <tr key={lease.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-200">
                        {lease.address}
                      </td>
                      <td className="px-4 py-3 font-mono text-cyan-400">{lease.macAddress}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-200">{lease.customerName || lease.clientHostname || 'Unassigned'}</p>
                          {lease.comment && (
                            <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{lease.comment}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {lease.circuitId ? (
                          <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px] text-amber-300">
                            {lease.circuitId}
                          </span>
                        ) : (
                          'None'
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">{lease.server}</td>
                      <td className="px-4 py-3 text-slate-300 font-mono text-[11px]">{lease.expiresAfter}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge}`}>
                          {lease.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {lease.status === 'bound' && (
                            <button
                              onClick={() => handleMakeStatic(lease)}
                              className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1"
                              title="Make Static MAC Binding"
                            >
                              <Lock className="w-3 h-3" />
                              Make Static
                            </button>
                          )}

                          {lease.status !== 'quarantined' ? (
                            <button
                              onClick={() => handleQuarantineMac(lease)}
                              className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1"
                              title="Quarantine & Drop MAC"
                            >
                              <ShieldAlert className="w-3 h-3" />
                              Block MAC
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnblockMac(lease)}
                              className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1"
                            >
                              <Unlock className="w-3 h-3" />
                              Unblock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Static Lease Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm border-b border-slate-800 pb-3 mb-4">
              <Lock className="w-4 h-4 text-indigo-400" />
              Add Static IPoE / DHCP MAC Binding
            </h3>
            <form onSubmit={handleAddStaticBinding} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Static IP Address *</label>
                <input
                  type="text"
                  required
                  placeholder="10.200.20.X"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Device MAC Address *</label>
                <input
                  type="text"
                  required
                  placeholder="AA:BB:CC:DD:EE:FF"
                  value={newMac}
                  onChange={(e) => setNewMac(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">DHCP Server</label>
                <select
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  <option value="DHCP-IPOE-BRGY-SANVICENTE">DHCP-IPOE-BRGY-SANVICENTE</option>
                  <option value="DHCP-IPOE-BRGY-POBLACION">DHCP-IPOE-BRGY-POBLACION</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">MikroTik Rate-Limit (Optional)</label>
                <select
                  value={newRateLimit}
                  onChange={(e) => setNewRateLimit(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                >
                  <option value="30M/30M">30M/30M (Swift Starter 30 Mbps)</option>
                  <option value="50M/50M">50M/50M (Swift Fiber 50 Mbps)</option>
                  <option value="100M/100M">100M/100M (Swift Turbo 100 Mbps)</option>
                  <option value="200M/200M">200M/200M (Swift Gig 200 Mbps)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Comment / Subscriber Name</label>
                <input
                  type="text"
                  placeholder="e.g. IPoE Binding - Juanita Santos"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl"
                >
                  Bind Static Lease
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

