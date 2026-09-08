import React, { useState, useEffect, useRef } from 'react';
import {
  Flame,
  Play,
  Square,
  RefreshCw,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  Activity,
  ExternalLink,
  Download,
  AlertTriangle,
  Server,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MikrotikDevice, TorchFlow, TorchFilterOptions } from '../../types';
import {
  runMikrotikTorch,
  getMikrotikInterfaces,
  fetchInterfaces,
  fetchPppoeActiveSessions,
  MikrotikCredentials,
} from '../../services/mikrotikApiService';

interface MikrotikTorchMonitorProps {
  device: MikrotikDevice;
  availableInterfaces?: any[];
  availablePppoeSessions?: any[];
  initialInterface?: string;
  initialSubscriberIp?: string;
  onSelectCustomer?: (customerId: string) => void;
}

export const MikrotikTorchMonitor: React.FC<MikrotikTorchMonitorProps> = ({
  device,
  availableInterfaces,
  availablePppoeSessions,
  initialInterface,
  initialSubscriberIp,
  onSelectCustomer,
}) => {
  const { customers, showToast } = useApp();

  // Interface State strictly fetched from the connected router
  const [routerInterfaces, setRouterInterfaces] = useState<any[]>(() => {
    const list: any[] = [];
    if (Array.isArray(availableInterfaces) && availableInterfaces.length > 0) {
      list.push(...availableInterfaces);
    }
    if (Array.isArray(availablePppoeSessions) && availablePppoeSessions.length > 0) {
      list.push(...availablePppoeSessions);
    }
    return list;
  });
  const [isLoadingInterfaces, setIsLoadingInterfaces] = useState<boolean>(false);

  // Filter & Control States
  const [selectedInterface, setSelectedInterface] = useState<string>(initialInterface || '');
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
  const [torchError, setTorchError] = useState<string | null>(null);

  // Real Hardware Interface Telemetry from Router
  const [hardwareTraffic, setHardwareTraffic] = useState<{
    rxBps: number;
    txBps: number;
    rxPps: number;
    txPps: number;
    rxDrops?: number;
    txDrops?: number;
  } | null>(null);

  // Polling interval refs
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

  // Actively query the router for all hardware, virtual, and subscriber session interfaces
  const syncRouterInterfaces = async () => {
    setIsLoadingInterfaces(true);
    try {
      const creds = getDeviceCreds(device);
      const ifaceRes = await getMikrotikInterfaces(creds);
      const ifaces = ifaceRes.success && Array.isArray(ifaceRes.interfaces) && ifaceRes.interfaces.length > 0
        ? ifaceRes.interfaces
        : await fetchInterfaces(creds);

      let pppoeList: any[] = [];
      try {
        const pppActive = await fetchPppoeActiveSessions(creds);
        if (pppActive.success && Array.isArray(pppActive.data)) {
          pppoeList = pppActive.data.map((p: any) => ({
            name: p.name ? (p.name.startsWith('<pppoe') ? p.name : `<pppoe-${p.name}>`) : (p.sessionId || 'pppoe-in'),
            type: 'pppoe-in',
            running: true,
            comment: `Subscriber: ${p.name || ''} (${p.address || ''})`,
            macAddress: p.callerId || '',
            ipAddress: p.address || '',
          }));
        }
      } catch (_) {}

      const allFetched = [...(Array.isArray(ifaces) ? ifaces : []), ...pppoeList];
      if (allFetched.length > 0) {
        setRouterInterfaces(allFetched);
        showToast('success', 'Interfaces Synced', `Loaded ${allFetched.length} live interfaces from ${device.name}`);
        if (!selectedInterface || !allFetched.some((i: any) => (i.name || i.interface) === selectedInterface)) {
          const firstUp = allFetched.find((i: any) => i.running === true || i.running === 'true' || i.status === 'running') || allFetched[0];
          if (firstUp) {
            setSelectedInterface(firstUp.name || firstUp.interface);
          }
        }
      } else {
        showToast('warning', 'No Interfaces', `No interfaces detected on ${device.name}`);
      }
    } catch (err: any) {
      console.warn('[Torch] Sync router interfaces error:', err);
      showToast('error', 'Interface Sync Failed', err.message || 'Could not reach router');
    } finally {
      setIsLoadingInterfaces(false);
    }
  };

  // Sync interfaces from props or router on initial load
  useEffect(() => {
    if (Array.isArray(availableInterfaces) && availableInterfaces.length > 0) {
      const combined = [...availableInterfaces, ...(availablePppoeSessions || [])];
      setRouterInterfaces(combined);
      if (!selectedInterface && combined.length > 0) {
        const firstUp = combined.find((i: any) => i.running === true || i.running === 'true' || i.status === 'running') || combined[0];
        setSelectedInterface(firstUp.name || firstUp.interface);
      }
    } else {
      syncRouterInterfaces();
    }
  }, [device.id, availableInterfaces, availablePppoeSessions]);

  // Group interfaces by category for the dropdown
  const categorizedInterfaces = React.useMemo(() => {
    const physical: any[] = [];
    const bridges: any[] = [];
    const pppoe: any[] = [];

    const seen = new Set<string>();

    routerInterfaces.forEach((i: any) => {
      const name = i.name || i.interface;
      if (!name || seen.has(name)) return;
      seen.add(name);

      const typeStr = String(i.type || '').toLowerCase();
      const nameStr = String(name).toLowerCase();
      const isRunning = i.running === true || i.running === 'true' || i.status === 'running';

      if (nameStr.startsWith('<pppoe') || typeStr.includes('pppoe') || nameStr.includes('@')) {
        const cleanUser = name.replace(/^<pppoe-/, '').replace(/>$/, '').toLowerCase();
        const sub = customers.find(
          (c) =>
            c.network?.pppoeUsername?.toLowerCase() === cleanUser ||
            c.network?.ipAddress === i.ipAddress
        );
        pppoe.push({
          name,
          comment: sub ? `${sub.fullName} (${sub.accountNo})` : (i.comment || i.ipAddress || ''),
          running: isRunning,
        });
      } else if (nameStr.includes('bridge') || typeStr.includes('bridge') || nameStr.includes('vlan') || typeStr.includes('vlan')) {
        bridges.push({
          name,
          comment: i.comment || (nameStr.includes('bridge') ? 'Bridge Switch' : 'VLAN Interface'),
          running: isRunning,
        });
      } else {
        physical.push({
          name,
          comment: i.comment || '',
          running: isRunning,
        });
      }
    });

    return { physical, bridges, pppoe };
  }, [routerInterfaces, customers]);

  // Fetch real traffic snapshot from router
  const fetchTorchSnapshot = async () => {
    if (!selectedInterface) return;
    const creds = getDeviceCreds(device);
    const options: TorchFilterOptions = {
      interfaceName: selectedInterface,
      srcAddress: targetIp.trim() || undefined,
      protocol: protocolFilter !== 'any' ? protocolFilter : undefined,
      port: portFilter !== 'any' ? portFilter : undefined,
    };

    setIsLoadingFlows(true);
    setTorchError(null);
    try {
      const res = await runMikrotikTorch(creds, options, customers);
      if (res.interfaceTraffic) {
        setHardwareTraffic(res.interfaceTraffic);
      }
      if (res.success) {
        setFlows(res.flows || []);
      } else {
        setTorchError(res.error || res.errorMessage || 'No response from router');
        setFlows([]);
      }
    } catch (err: any) {
      console.warn('[Torch Monitor Error]:', err.message);
      setTorchError(err.message || 'Error communicating with router');
    } finally {
      setIsLoadingFlows(false);
    }
  };

  // Start / Stop Handlers
  const handleStartTorch = () => {
    if (!selectedInterface) {
      showToast('warning', 'Select Interface', 'Please select a router interface to monitor');
      return;
    }
    setRemainingSeconds(autoStopDuration);
    setIsRunning(true);
    fetchTorchSnapshot();
    showToast('info', 'Torch Started', `Monitoring live router traffic on ${selectedInterface}`);
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

    fetchTorchSnapshot();

    timerRef.current = setInterval(() => {
      fetchTorchSnapshot();
    }, 2500);

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

  // Total Throughput KPIs (Prioritizes real router hardware counters)
  const displayDownloadMbps = hardwareTraffic
    ? (hardwareTraffic.rxBps / 1000000).toFixed(2)
    : (flows.reduce((acc, f) => acc + f.rxRateBps, 0) / 1000000).toFixed(1);

  const displayUploadMbps = hardwareTraffic
    ? (hardwareTraffic.txBps / 1000000).toFixed(2)
    : (flows.reduce((acc, f) => acc + f.txRateBps, 0) / 1000000).toFixed(1);

  const displayPps = hardwareTraffic
    ? (hardwareTraffic.rxPps + hardwareTraffic.txPps).toLocaleString()
    : flows.reduce((acc, f) => acc + ((f.rxPackets || 0) + (f.txPackets || 0)), 0).toLocaleString();

  // Helper formatter for bandwidth
  const formatBps = (bps: number) => {
    if (bps >= 1000000000) {
      return `${(bps / 1000000000).toFixed(2)} Gbps`;
    }
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
                Authentic router packet inspection on <strong>{device.name}</strong> • Real-time connection & interface counters
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
                disabled={!selectedInterface}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-orange-500/30 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Torch</span>
              </button>
            )}

            <button
              type="button"
              onClick={fetchTorchSnapshot}
              disabled={isLoadingFlows || !selectedInterface}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-700 cursor-pointer disabled:opacity-50"
              title="Manual Snapshot Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFlows ? 'animate-spin' : ''}`} />
              <span>Sample Flow</span>
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
          {/* Interface Selector with Real Router Sync */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-400 font-semibold text-[11px]">Interface (Live Router) *</label>
              <button
                type="button"
                onClick={syncRouterInterfaces}
                disabled={isLoadingInterfaces}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="Query /rest/interface directly from router"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isLoadingInterfaces ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={selectedInterface}
                onChange={(e) => setSelectedInterface(e.target.value)}
                disabled={isLoadingInterfaces}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-cyan-300 font-mono text-xs focus:outline-none focus:border-cyan-500 cursor-pointer disabled:opacity-50"
              >
                {isLoadingInterfaces && <option value="">Fetching router interfaces...</option>}
                {!isLoadingInterfaces && routerInterfaces.length === 0 && (
                  <option value="">No interfaces found on router</option>
                )}
                {categorizedInterfaces.physical.length > 0 && (
                  <optgroup label="Physical & WAN Interfaces">
                    {categorizedInterfaces.physical.map((i) => (
                      <option key={i.name} value={i.name}>
                        {i.name} {i.comment ? `(${i.comment})` : ''} — {i.running ? '🟢 UP' : '⚪ DOWN'}
                      </option>
                    ))}
                  </optgroup>
                )}
                {categorizedInterfaces.bridges.length > 0 && (
                  <optgroup label="Bridges & VLANs">
                    {categorizedInterfaces.bridges.map((i) => (
                      <option key={i.name} value={i.name}>
                        {i.name} {i.comment ? `(${i.comment})` : ''} — {i.running ? '🟢 UP' : '⚪ DOWN'}
                      </option>
                    ))}
                  </optgroup>
                )}
                {categorizedInterfaces.pppoe.length > 0 && (
                  <optgroup label={`Active PPPoE Sessions (${categorizedInterfaces.pppoe.length})`}>
                    {categorizedInterfaces.pppoe.map((i) => (
                      <option key={i.name} value={i.name}>
                        {i.name} {i.comment ? `(${i.comment})` : ''} — 🟢 ACTIVE
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
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
              <option value="8291">8291 (WinBox)</option>
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

      {/* ERROR BANNER IF ROUTER UNREACHABLE */}
      {torchError && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className="font-mono">{torchError}</span>
          </div>
          <button
            type="button"
            onClick={fetchTorchSnapshot}
            className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 rounded-xl text-xs font-bold cursor-pointer transition-all self-start sm:self-auto"
          >
            Retry Query
          </button>
        </div>
      )}

      {/* 2. LIVE THROUGHPUT & SUMMARY STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
            Live Download (Rx)
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
              {displayDownloadMbps}
            </span>
            <span className="text-xs text-slate-400 font-bold">Mbps</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            {hardwareTraffic ? 'Router Hardware Interface Counter' : 'Aggregated Flows'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
            Live Upload (Tx)
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-cyan-400 font-mono">
              {displayUploadMbps}
            </span>
            <span className="text-xs text-slate-400 font-bold">Mbps</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            {hardwareTraffic ? 'Router Hardware Interface Counter' : 'Aggregated Flows'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            Packets Throughput
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
              {displayPps}
            </span>
            <span className="text-xs text-slate-400 font-bold">pkts/s</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            {hardwareTraffic?.rxDrops ? `Drops: ${hardwareTraffic.rxDrops}/s` : 'Zero Packet Drops'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-purple-400" />
            Active Connections
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-purple-400 font-mono">
              {flows.length}
            </span>
            <span className="text-xs text-slate-400 font-bold">flows</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            {device.cpuLoad !== undefined ? `Router CPU: ${device.cpuLoad}%` : 'RouterOS Connected'}
          </span>
        </div>
      </div>

      {/* 3. VIEW MODE TOGGLE & SEARCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setViewMode('top_talkers')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'top_talkers'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Top Talkers ({topTalkers.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('detailed_flows')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'detailed_flows'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
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
                    {isRunning
                      ? `Live monitoring active on ${selectedInterface}. Router reported 0 active connections (interface is idle).`
                      : `No active subscriber traffic recorded on ${selectedInterface || 'selected interface'}. Click Start Torch to sample router.`}
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
        /* Detailed Raw Flows Table */
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-2xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Protocol</th>
                <th className="px-4 py-3">Source Address</th>
                <th className="px-4 py-3">Destination Address</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Download (Rx)</th>
                <th className="px-4 py-3">Upload (Tx)</th>
                <th className="px-4 py-3">Packets</th>
                <th className="px-4 py-3">Identified Subscriber</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredFlows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-500 text-xs">
                    {isRunning
                      ? `No matching connection flows found on ${selectedInterface}. Interface is idle.`
                      : `No active connections captured on ${selectedInterface || 'selected interface'}. Click Start Torch to sample router.`}
                  </td>
                </tr>
              ) : (
                filteredFlows.map((flow) => {
                  const maxRx = Math.max(...filteredFlows.map((f) => f.rxRateBps || 1));
                  const flowPercent = Math.min(100, Math.round((flow.rxRateBps / maxRx) * 100));

                  return (
                    <tr key={flow.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            flow.protocol === 'tcp'
                              ? 'bg-blue-950 text-blue-400 border border-blue-800/50'
                              : flow.protocol === 'udp'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                          }`}
                        >
                          {flow.protocol}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-200">
                        <span className="text-cyan-300 font-bold">{flow.srcAddress}</span>
                        {flow.srcPort && (
                          <span className="text-slate-500 text-[10px]">:{flow.srcPort}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-300">
                        <span>{flow.dstAddress}</span>
                        {flow.dstPort && (
                          <span className="text-slate-500 text-[10px]">:{flow.dstPort}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] border border-slate-700">
                          {flow.serviceLabel || 'Generic'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="space-y-1">
                          <span className="text-emerald-400 font-bold block">
                            {formatBps(flow.rxRateBps)}
                          </span>
                          <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${flowPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-cyan-400 font-bold">
                        {formatBps(flow.txRateBps)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-[11px]">
                        {((flow.rxPackets || 0) + (flow.txPackets || 0)).toLocaleString()} pkts
                      </td>
                      <td className="px-4 py-2.5">
                        {flow.customerName ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-200 font-bold font-sans">
                              {flow.customerName}
                            </span>
                            {flow.customerId && onSelectCustomer && (
                              <button
                                type="button"
                                onClick={() => onSelectCustomer(flow.customerId!)}
                                className="text-cyan-400 hover:text-cyan-300 p-0.5 cursor-pointer"
                                title="Open subscriber profile"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
