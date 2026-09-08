import React, { useState, useEffect, useRef } from 'react';
import {
  Flame,
  Play,
  Square,
  RefreshCw,
  Search,
  Filter,
  ShieldAlert,
  ArrowDownRight,
  ArrowUpRight,
  Activity,
  User,
  ExternalLink,
  Clock,
  Layers,
  Download,
  AlertTriangle,
  Server,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MikrotikDevice, TorchFlow, TorchFilterOptions } from '../../types';
import { runMikrotikTorch, MikrotikCredentials } from '../../services/mikrotikApiService';
import { formatCurrency } from '../../utils/formatters';

interface MikrotikTorchMonitorProps {
  device: MikrotikDevice;
  initialInterface?: string;
  initialSubscriberIp?: string;
  onSelectCustomer?: (customerId: string) => void;
}

export const MikrotikTorchMonitor: React.FC<MikrotikTorchMonitorProps> = ({
  device,
  initialInterface,
  initialSubscriberIp,
  onSelectCustomer,
}) => {
  const { customers, showToast } = useApp();

  // Filter & Control States
  const [selectedInterface, setSelectedInterface] = useState<string>(
    initialInterface || 'ether1'
  );
  const [targetIp, setTargetIp] = useState<string>(initialSubscriberIp || '');
  const [protocolFilter, setProtocolFilter] = useState<string>('any');
  const [portFilter, setPortFilter] = useState<string>('any');
  const [viewMode, setViewMode] = useState<'top_talkers' | 'detailed_flows'>('top_talkers');
  const [autoStopDuration, setAutoStopDuration] = useState<number>(30); // seconds

  // Torch Execution States
  const [isRunning, setIsRunning] = useState<boolean>(Boolean(initialSubscriberIp || initialInterface));
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30);
  const [flows, setFlows] = useState<TorchFlow[]>([]);
  const [isLoadingFlows, setIsLoadingFlows] = useState<boolean>(false);
  const [filterSearch, setFilterSearch] = useState<string>('');

  // Interface Options (Physical + Dynamic)
  const interfaceOptions = React.useMemo(() => {
    const list = ['ether1', 'ether2', 'ether3', 'sfp-plus1', 'bridge-LAN'];
    if (device.interfaces && Array.isArray(device.interfaces)) {
      device.interfaces.forEach((iface: any) => {
        const name = iface.name || iface.interface;
        if (name && !list.includes(name)) {
          list.push(name);
        }
      });
    }
    if (initialInterface && !list.includes(initialInterface)) {
      list.unshift(initialInterface);
    }
    return list;
  }, [device, initialInterface]);

  // Polling interval ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const getDeviceCreds = (dev: MikrotikDevice): MikrotikCredentials => ({
    id: dev.id,
    name: dev.name,
    ipAddress: dev.remoteAddress || dev.ipAddress,
    port: dev.port || dev.webfigPort || dev.apiPort || 10988,
    username: dev.username || 'admin',
    password: dev.password || '',
    useHttps: dev.useSsl || false,
  });

  const fetchTorchSnapshot = async () => {
    const creds = getDeviceCreds(device);
    const options: TorchFilterOptions = {
      interfaceName: selectedInterface,
      srcAddress: targetIp.trim() || undefined,
      protocol: protocolFilter !== 'any' ? protocolFilter : undefined,
      port: portFilter !== 'any' ? portFilter : undefined,
    };

    setIsLoadingFlows(true);
    try {
      const res = await runMikrotikTorch(creds, options, customers);
      if (res.success && Array.isArray(res.flows)) {
        setFlows(res.flows);
      }
    } catch (err: any) {
      console.warn('[Torch Monitor Error]:', err.message);
    } finally {
      setIsLoadingFlows(false);
    }
  };

  // Start / Stop Handlers
  const handleStartTorch = () => {
    setRemainingSeconds(autoStopDuration);
    setIsRunning(true);
    fetchTorchSnapshot();
    showToast('info', 'Torch Started', `Analyzing live packets on ${selectedInterface}`);
  };

  const handleStopTorch = () => {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    showToast('info', 'Torch Stopped', 'Traffic flow sampling paused');
  };

  // Manage Sampling Interval & Auto-stop Countdown
  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    // Immediate sample
    fetchTorchSnapshot();

    // Sample every 2.5 seconds
    timerRef.current = setInterval(() => {
      fetchTorchSnapshot();
    }, 2500);

    // Countdown timer
    countdownRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          handleStopTorch();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isRunning, selectedInterface, targetIp, protocolFilter, portFilter]);

  // Aggregate Top Talkers by IP
  const topTalkers = React.useMemo(() => {
    const map = new Map<string, {
      ip: string;
      customerName?: string;
      accountNo?: string;
      planName?: string;
      customerId?: string;
      totalRxBps: number;
      totalTxBps: number;
      flowsCount: number;
      topService: string;
    }>();

    flows.forEach((flow) => {
      const ip = flow.srcAddress;
      const existing = map.get(ip) || {
        ip,
        customerName: flow.customerName,
        accountNo: flow.accountNo,
        planName: flow.planName,
        customerId: flow.customerId,
        totalRxBps: 0,
        totalTxBps: 0,
        flowsCount: 0,
        topService: flow.serviceLabel || 'Web Traffic',
      };

      existing.totalRxBps += flow.rxRateBps;
      existing.totalTxBps += flow.txRateBps;
      existing.flowsCount += 1;
      if (!existing.customerName && flow.customerName) {
        existing.customerName = flow.customerName;
        existing.accountNo = flow.accountNo;
        existing.planName = flow.planName;
        existing.customerId = flow.customerId;
      }
      map.set(ip, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalRxBps - a.totalRxBps);
  }, [flows]);

  // Filtered detailed flows
  const filteredFlows = React.useMemo(() => {
    if (!filterSearch.trim()) return flows;
    const q = filterSearch.toLowerCase().trim();
    return flows.filter(
      (f) =>
        f.srcAddress.toLowerCase().includes(q) ||
        f.dstAddress.toLowerCase().includes(q) ||
        (f.customerName && f.customerName.toLowerCase().includes(q)) ||
        (f.accountNo && f.accountNo.toLowerCase().includes(q)) ||
        (f.serviceLabel && f.serviceLabel.toLowerCase().includes(q)) ||
        String(f.dstPort).includes(q)
    );
  }, [flows, filterSearch]);

  // Total Throughput KPIs
  const totalDownloadMbps = (flows.reduce((acc, f) => acc + f.rxRateBps, 0) / 1000000).toFixed(1);
  const totalUploadMbps = (flows.reduce((acc, f) => acc + f.txRateBps, 0) / 1000000).toFixed(1);

  // Helper formatter for bandwidth
  const formatBps = (bps: number) => {
    if (bps >= 1000000) {
      return `${(bps / 1000000).toFixed(2)} Mbps`;
    }
    if (bps >= 1000) {
      return `${(bps / 1000).toFixed(1)} kbps`;
    }
    return `${bps} bps`;
  };

  // CSV Exporter
  const handleExportCsv = () => {
    if (flows.length === 0) {
      showToast('warning', 'No Data', 'No active flows to export');
      return;
    }

    const headers = ['Source IP', 'Source Port', 'Destination IP', 'Destination Port', 'Protocol', 'Download (bps)', 'Upload (bps)', 'Service', 'Subscriber', 'Account No'];
    const rows = flows.map((f) => [
      f.srcAddress,
      f.srcPort || '',
      f.dstAddress,
      f.dstPort || '',
      f.protocol.toUpperCase(),
      f.rxRateBps,
      f.txRateBps,
      f.serviceLabel || '',
      f.customerName || '',
      f.accountNo || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Mikrotik_Torch_${selectedInterface}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Export Complete', 'Torch snapshot saved to CSV');
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. TOP CONTROL BAR & FILTERS */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30 rounded-2xl shadow-lg shadow-amber-950/40">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  MikroTik Torch Traffic Monitor
                </h2>
                {isRunning ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    LIVE ({remainingSeconds}s left)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-slate-800 text-slate-400 border border-slate-700">
                    IDLE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time packet inspection on <strong>{device.name}</strong> • Deep flow & bandwidth analysis
              </p>
            </div>
          </div>

          {/* Start / Stop & Quick Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {isRunning ? (
              <button
                type="button"
                onClick={handleStopTorch}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Torch</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartTorch}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-orange-500/30 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Torch</span>
              </button>
            )}

            <button
              type="button"
              onClick={fetchTorchSnapshot}
              disabled={isLoadingFlows}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 cursor-pointer disabled:opacity-50"
              title="Manual Snapshot Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFlows ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
              title="Export Current Flows to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-slate-800/80 text-xs">
          {/* Interface Selector */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Interface *</label>
            <select
              value={selectedInterface}
              onChange={(e) => setSelectedInterface(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {interfaceOptions.map((iface) => (
                <option key={iface} value={iface}>
                  {iface}
                </option>
              ))}
            </select>
          </div>

          {/* Target IP Address (Optional Filter) */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Filter IP (Src/Dst)</label>
            <input
              type="text"
              placeholder="e.g. 10.10.0.45 or 0.0.0.0/0"
              value={targetIp}
              onChange={(e) => setTargetIp(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Protocol Filter */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Protocol</label>
            <select
              value={protocolFilter}
              onChange={(e) => setProtocolFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="any">All Protocols</option>
              <option value="tcp">TCP Only</option>
              <option value="udp">UDP (DNS / QUIC)</option>
              <option value="icmp">ICMP (Ping)</option>
            </select>
          </div>

          {/* Port Filter */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Port Filter</label>
            <select
              value={portFilter}
              onChange={(e) => setPortFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="any">Any Port</option>
              <option value="443">443 (HTTPS / Web)</option>
              <option value="80">80 (HTTP / Web)</option>
              <option value="53">53 (DNS)</option>
              <option value="51820">51820 (WireGuard)</option>
              <option value="27015">27015 (Steam Gaming)</option>
            </select>
          </div>

          {/* Auto-Stop Duration */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold text-[11px]">CPU Safety Timer</label>
            <select
              value={autoStopDuration}
              onChange={(e) => setAutoStopDuration(Number(e.target.value))}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value={15}>15 Seconds Auto-Stop</option>
              <option value={30}>30 Seconds (Recommended)</option>
              <option value={60}>60 Seconds Extended</option>
              <option value={120}>120 Seconds Max</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. LIVE THROUGHPUT & SUMMARY STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
            Torched Download
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
              {totalDownloadMbps}
            </span>
            <span className="text-xs text-slate-400 font-bold">Mbps</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
            Torched Upload
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-cyan-400 font-mono">
              {totalUploadMbps}
            </span>
            <span className="text-xs text-slate-400 font-bold">Mbps</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            Active Packet Flows
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-slate-100 font-mono">
              {flows.length}
            </span>
            <span className="text-xs text-slate-400">concurrent</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-indigo-400" />
            Router CPU Status
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-black font-mono ${
              device.cpuLoad > 80 ? 'text-rose-400' : device.cpuLoad > 50 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {device.cpuLoad}%
            </span>
            <span className="text-xs text-slate-400">{device.cpuLoad > 80 ? 'Heavy Load' : 'Nominal'}</span>
          </div>
        </div>
      </div>

      {/* 3. VIEW MODE TOGGLE & IN-TABLE SEARCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('top_talkers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'top_talkers'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Top Talkers ({topTalkers.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('detailed_flows')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'detailed_flows'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Raw Connection Flows ({filteredFlows.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search IP, subscriber, or port..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      </div>

      {/* 4. MAIN FLOWS DISPLAY TABLE */}
      {viewMode === 'top_talkers' ? (
        /* Top Talkers Table */
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider font-mono border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Subscriber / Local IP</th>
                <th className="px-4 py-3">Account No</th>
                <th className="px-4 py-3">Current Plan</th>
                <th className="px-4 py-3">Download (Rx)</th>
                <th className="px-4 py-3">Upload (Tx)</th>
                <th className="px-4 py-3">Dominant Service</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {topTalkers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-500 text-xs font-mono">
                    No active subscriber traffic detected on {selectedInterface}. Click <strong>Start Torch</strong> to begin sampling.
                  </td>
                </tr>
              ) : (
                topTalkers.map((t, idx) => {
                  const downloadPercent = Math.min(100, Math.round((t.totalRxBps / 50000000) * 100));
                  return (
                    <tr key={t.ip} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-400">
                        #{idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        {t.customerName ? (
                          <div>
                            <span className="font-bold text-slate-100 block">{t.customerName}</span>
                            <span className="text-[11px] text-cyan-400">{t.ip}</span>
                          </div>
                        ) : (
                          <span className="text-cyan-300 font-bold">{t.ip}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {t.accountNo || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">
                          {t.planName || 'Active Link'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span className="text-emerald-400 font-bold block">{formatBps(t.totalRxBps)}</span>
                          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${downloadPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-cyan-400 font-bold">
                        {formatBps(t.totalTxBps)}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-[11px]">
                        {t.topService}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {t.customerId && onSelectCustomer && (
                          <button
                            type="button"
                            onClick={() => onSelectCustomer(t.customerId!)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-900/60 text-cyan-300 border border-slate-700 hover:border-cyan-500/50 transition-colors cursor-pointer"
                            title="Inspect in CRM"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Detailed Raw Connection Flows */
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider font-mono border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Proto</th>
                <th className="px-4 py-3">Source (Client)</th>
                <th className="px-4 py-3">Destination (Server / CDN)</th>
                <th className="px-4 py-3">Identified Service</th>
                <th className="px-4 py-3">Download (Rx)</th>
                <th className="px-4 py-3">Upload (Tx)</th>
                <th className="px-4 py-3">Packets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredFlows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500 text-xs font-mono">
                    No active connection flows matched the current filters.
                  </td>
                </tr>
              ) : (
                filteredFlows.map((flow) => (
                  <tr key={flow.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        flow.protocol === 'tcp'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : flow.protocol === 'udp'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {flow.protocol}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="truncate max-w-[200px]">
                        {flow.customerName && (
                          <span className="text-slate-100 font-bold block truncate">{flow.customerName}</span>
                        )}
                        <span className="text-cyan-300">
                          {flow.srcAddress}{flow.srcPort ? `:${flow.srcPort}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="truncate max-w-[220px]">
                        <span className="text-slate-200 block font-mono">{flow.dstAddress}</span>
                        {flow.dstPort && (
                          <span className="text-[10px] text-slate-400">Port {flow.dstPort}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-amber-300 font-semibold">{flow.serviceLabel || 'Generic Data'}</span>
                    </td>
                    <td className="px-4 py-3 text-emerald-400 font-bold">
                      {formatBps(flow.rxRateBps)}
                    </td>
                    <td className="px-4 py-3 text-cyan-400 font-bold">
                      {formatBps(flow.txRateBps)}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {flow.rxPackets ? `${flow.rxPackets.toLocaleString()} pkts` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

