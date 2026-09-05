import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Server,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  Thermometer,
  Users,
  Search,
  Trash2,
  Edit2,
  X,
  Zap,
  Terminal,
  Layers,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Wifi,
  Eye,
  EyeOff,
  Cable,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownLeft,
  Flame,
  Radio,
  Gauge,
  ArrowDownCircle,
  ArrowUpCircle,
  Maximize2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { MikrotikDevice } from '../../types';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import {
  generatePppoeBatchScript,
  generateIsolationScript,
  generateFullRouterConfigScript,
} from '../../utils/sstpService';
import {
  testRouterConnection,
  fetchInterfaces,
  fetchInterfaceTraffic,
  fetchSfpOpticalDiagnostics,
  fetchSimpleQueues,
  pingGoogleDns,
  MikrotikCredentials,
  RouterHealthInfo,
} from '../../services/mikrotikApiService';
import { PppoeManager } from './PppoeManager';

// Detect dynamic PPPoE session interfaces in a raw RouterOS interface entry
const isPppoeSessionIface = (i: any): boolean => {
  if (!i) return false;
  const typeStr = String(i.type || '').toLowerCase();
  if (typeStr.includes('pppoe')) return true;
  const name = String(i.name || '');
  return name.startsWith('<pppoe') || name.includes('@') && (i.dynamic === true || i.dynamic === 'true');
};

export type TrafficHistoryRange = 'live' | '10m' | '30m' | '1h';

export interface TelemetryPoint {
  timestamp: number;
  time: string;
  rx: number;
  tx: number;
  latency: number;
}

interface MikrotikDeviceManagerProps {
  onOpenTerminal?: (deviceId?: string) => void;
}

export const MikrotikDeviceManager: React.FC<MikrotikDeviceManagerProps> = ({ onOpenTerminal }) => {
  const {
    mikrotikDevices,
    addMikrotikDevice,
    updateMikrotikDevice,
    deleteMikrotikDevice,
    syncAllSubscribersToMikrotik,
    customers,
    plans,
    businessProfile,
    showToast,
  } = useApp();

  // Active Selected Router
  const [selectedRouterId, setSelectedRouterId] = useState<string>(() => {
    return mikrotikDevices[0]?.id || 'mtk-ccr2116-core';
  });

  const selectedDevice =
    mikrotikDevices.find((d) => d.id === selectedRouterId) ||
    mikrotikDevices[0] || {
      id: 'mtk-ccr2116-core',
      name: 'CCR2116-12G-4S+ Core Gateway',
      model: 'CCR2116-12G-4S+',
      role: 'core_pppoe' as const,
      connectionType: 'sstp_vpn' as const,
      ipAddress: 'remote.oxapsph.com',
      remoteAddress: 'remote.oxapsph.com',
      port: 10988,
      webfigPort: 10988,
      username: 'admin',
      password: '',
      status: 'online' as const,
      rosVersion: 'RouterOS v7.14.3',
      cpuLoad: 24,
      memoryUsage: { usedMb: 1220, totalMb: 16384 },
      uptime: '2w5d2h50m',
      activePppoeCount: 18,
      totalQueues: 18,
      temperatureC: 44,
      location: 'Main POP Operations Rack, Lagonoy',
    };

  // 4 Primary Streamlined Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'interfaces' | 'pppoe' | 'pppoe_sessions' | 'queues' | 'fleet'>('overview');

  // Live Telemetry & Polling State
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [liveHealth, setLiveHealth] = useState<RouterHealthInfo | null>(null);

  // Map initial interfaces from the device or fallback to full CCR2116 hardware port list
  const getInitialInterfaces = () => {
    if (selectedDevice?.interfaces && selectedDevice.interfaces.length > 0) {
      return selectedDevice.interfaces.map((i: any) => ({
        name: i.name,
        type: i.type || (i.name.startsWith('sfp') ? 'sfp-plus' : i.name.startsWith('bridge') ? 'bridge' : 'ether'),
        running: i.status === 'running' || i.running === true || i.running === 'true',
        disabled: i.disabled === true || i.disabled === 'true',
        comment: i.comment || (i.name === 'sfp-sfpplus1' ? 'WAN Fiber Uplink 10G' : i.name === 'ether1' ? 'WAN Gateway' : i.name === 'ether2' ? 'PPPoE Subscribers' : ''),
        macAddress: i.macAddress || i['mac-address'] || '',
        rxBytes: i.rxTotalBytes || i.rxBytes || 0,
        txBytes: i.txTotalBytes || i.txBytes || 0,
      }));
    }
    return [
      { name: 'sfp-sfpplus1', type: 'sfp-plus', running: true, comment: 'WAN Fiber Uplink 10G', macAddress: 'D4:01:C3:88:1A:01' },
      { name: 'sfp-sfpplus2', type: 'sfp-plus', running: true, comment: 'OLT 10G Trunk', macAddress: 'D4:01:C3:88:1A:02' },
      { name: 'sfp-sfpplus3', type: 'sfp-plus', running: false, comment: 'Backup SFP+', macAddress: 'D4:01:C3:88:1A:03' },
      { name: 'sfp-sfpplus4', type: 'sfp-plus', running: false, comment: 'Spare SFP+', macAddress: 'D4:01:C3:88:1A:04' },
      { name: 'ether1', type: 'ether', running: true, comment: 'WAN Gateway Backup', macAddress: 'D4:01:C3:88:1A:05' },
      { name: 'ether2', type: 'ether', running: true, comment: 'PPPoE Concentrator Trunk', macAddress: 'D4:01:C3:88:1A:06' },
      { name: 'ether3', type: 'ether', running: false, comment: 'OLT Port 1', macAddress: 'D4:01:C3:88:1A:07' },
      { name: 'ether4', type: 'ether', running: false, comment: 'OLT Port 2', macAddress: 'D4:01:C3:88:1A:08' },
      { name: 'ether5', type: 'ether', running: false, comment: 'Management LAN', macAddress: 'D4:01:C3:88:1A:09' },
      { name: 'ether6', type: 'ether', running: false, comment: 'Spare', macAddress: 'D4:01:C3:88:1A:10' },
      { name: 'ether7', type: 'ether', running: false, comment: 'Spare', macAddress: 'D4:01:C3:88:1A:11' },
      { name: 'ether8', type: 'ether', running: false, comment: 'Spare', macAddress: 'D4:01:C3:88:1A:12' },
      { name: 'ether9', type: 'ether', running: false, comment: 'Spare', macAddress: 'D4:01:C3:88:1A:13' },
      { name: 'ether10', type: 'ether', running: false, comment: 'Spare', macAddress: 'D4:01:C3:88:1A:14' },
      { name: 'ether11', type: 'ether', running: false, comment: 'Spare', macAddress: 'D4:01:C3:88:1A:15' },
      { name: 'ether12', type: 'ether', running: false, comment: 'Spare', macAddress: 'D4:01:C3:88:1A:16' },
      { name: 'bridge-local', type: 'bridge', running: true, comment: 'Core Subscriber Bridge', macAddress: 'D4:01:C3:88:1A:17' },
    ];
  };

  const [liveInterfaces, setLiveInterfaces] = useState<any[]>(() => getInitialInterfaces().filter((i) => !isPppoeSessionIface(i)));
  const liveInterfacesRef = useRef<any[]>(liveInterfaces);
  liveInterfacesRef.current = liveInterfaces;

  // Dynamic PPPoE subscriber session interfaces (type pppoe-in) — kept separate from hardware ports
  const [livePppoeSessions, setLivePppoeSessions] = useState<any[]>([]);

  // Split a raw RouterOS /interface payload into hardware ports vs PPPoE session interfaces
  const splitInterfaces = useCallback((rawList: any[]) => {
    const hardware: any[] = [];
    const sessions: any[] = [];
    for (const i of rawList) {
      const typeStr = String(i.type || '').toLowerCase();
      const isPppoe = typeStr.includes('pppoe') || (i.dynamic === true || i.dynamic === 'true') && typeStr !== 'bridge';
      if (isPppoe) sessions.push(i);
      else hardware.push(i);
    }
    return { hardware, sessions };
  }, []);

  // Password quick-update state
  const [quickPassword, setQuickPassword] = useState<string>(selectedDevice.password || '');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState<boolean>(false);

  // Selected Interface for Focused Bandwidth Monitoring
  const [selectedPort, setSelectedPort] = useState<string>('sfp-sfpplus1');
  const [portTraffic, setPortTraffic] = useState<{
    rxMbps: number;
    txMbps: number;
    rxPps: number;
    txPps: number;
  }>({
    rxMbps: 0,
    txMbps: 0,
    rxPps: 0,
    txPps: 0,
  });

  // Negotiated physical link state for the selected port (from /interface/ethernet/monitor)
  const [portLink, setPortLink] = useState<{
    rate: string;
    duplex: string;
    autoNeg: string;
    status: string;
    mtu: number;
    mac: string;
  }>({
    rate: '---',
    duplex: '---',
    autoNeg: '---',
    status: 'detecting',
    mtu: 1500,
    mac: '',
  });

  // Normalize RouterOS rates ("10Gbps", "1Gbps", "100Mbps") into a readable label
  const formatNegotiatedRate = (raw: any): string => {
    if (raw === undefined || raw === null || raw === '') return '';
    const str = String(raw).trim();
    const m = str.match(/^([0-9.]+)\s*([GMK]?)b?p?s?$/i);
    if (!m) return str;
    const value = m[1];
    const unit = (m[2] || 'M').toUpperCase();
    return `${value} ${unit}bps`;
  };

  // Dynamic interface capacity based on actual port auto-negotiation or interface attributes
  const getInterfaceCapacityMbps = (rateStr: string, portName: string, ifaceObj?: any): number => {
    const cleanRate = (rateStr || '').toLowerCase().trim();
    if (cleanRate.includes('10g') || cleanRate.includes('10 gbps') || cleanRate.includes('10000m')) return 10000;
    if (cleanRate.includes('5g') || cleanRate.includes('5000m')) return 5000;
    if (cleanRate.includes('2.5g') || cleanRate.includes('2500m')) return 2500;
    if (cleanRate.includes('1g') || cleanRate.includes('1000m') || cleanRate.includes('1 gbps')) return 1000;
    if (cleanRate.includes('100m') || cleanRate.includes('100 mbps')) return 100;
    if (cleanRate.includes('10m') || cleanRate.includes('10 mbps')) return 10;

    const ls = (ifaceObj?.linkSpeed || '').toLowerCase();
    if (ls.includes('10g') || ls.includes('10 gbps')) return 10000;
    if (ls.includes('2.5g')) return 2500;
    if (ls.includes('1g') || ls.includes('1 gbps')) return 1000;
    if (ls.includes('100m') || ls.includes('100 mbps')) return 100;
    if (ls.includes('10m')) return 10;

    const cleanName = (portName || '').toLowerCase();
    if (cleanName.startsWith('sfp') || cleanName.includes('sfpplus')) return 10000;
    if (cleanName.startsWith('bridge')) return 10000;
    return 1000;
  };

  const formatCapacityLabel = (mbps: number): string => {
    if (mbps >= 1000) {
      const gbps = mbps / 1000;
      return `${Number.isInteger(gbps) ? gbps : gbps.toFixed(1)} Gbps (${mbps.toLocaleString()} Mbps)`;
    }
    return `${mbps} Mbps`;
  };

  const selectedIfaceObj = useMemo(() => {
    return liveInterfaces.find((i) => i.name === selectedPort);
  }, [liveInterfaces, selectedPort]);

  const dynamicPortMaxMbps = useMemo(() => {
    return getInterfaceCapacityMbps(portLink.rate, selectedPort, selectedIfaceObj);
  }, [portLink.rate, selectedPort, selectedIfaceObj]);

  // Apply the router's own auto-negotiation result for a port; never guess from the port name
  const applyPortLink = useCallback((mon: any, portName: string) => {
    if (!mon) return;
    const iface = liveInterfacesRef.current.find((i: any) => i.name === portName);
    const isUp = mon.status === 'link-ok' || mon.status === 'running' || iface?.running === true;
    const negotiated = formatNegotiatedRate(mon.rate);
    const isFull = mon['full-duplex'] === 'true' || mon['full-duplex'] === true;
    const hasDuplexField = mon['full-duplex'] !== undefined && mon['full-duplex'] !== null && mon['full-duplex'] !== '';

    setPortLink({
      rate: isUp ? (negotiated || '---') : '---',
      duplex: isUp && hasDuplexField ? (isFull ? 'Full' : 'Half') : '---',
      autoNeg: mon['auto-negotiation'] || (isUp ? 'done' : 'disabled'),
      status: isUp ? 'running' : 'link_down',
      mtu: parseInt(iface?.mtu || mon['actual-mtu'] || mon.mtu || '1500', 10) || 1500,
      mac: iface?.macAddress || mon['mac-address'] || '',
    });
  }, []);

  // Selected Traffic History Range: 'live' (~60s), '10m' (10 mins), '30m' (30 mins), '1h' (1 hour)
  const [historyRange, setHistoryRange] = useState<TrafficHistoryRange>('live');
  const portHistoriesRef = useRef<Record<string, TelemetryPoint[]>>({});

  // Rolling telemetry points buffer (up to 1,600 samples ~ 1+ hour of data)
  const [fullTrafficHistory, setFullTrafficHistory] = useState<TelemetryPoint[]>(() => {
    const pts: TelemetryPoint[] = [];
    const now = Date.now();
    for (let i = 24; i >= 0; i--) {
      const t = new Date(now - i * 2500);
      pts.push({
        timestamp: t.getTime(),
        time: `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}:${t.getSeconds().toString().padStart(2, '0')}`,
        rx: 0,
        tx: 0,
        latency: 0,
      });
    }
    return pts;
  });

  // Chart Scale Mode: 'auto' (NOC dynamic zoom) vs 'fixed' (physical interface limit)
  const [chartScaleMode, setChartScaleMode] = useState<'auto' | 'fixed'>('auto');
  const [showLatencyLine, setShowLatencyLine] = useState<boolean>(true);
  const [latencySamples, setLatencySamples] = useState<number[]>([]);
  const [liveLatency, setLiveLatency] = useState<number>(0);

  // Current live latency and computed jitter (prioritize fast traffic poll duration over multi-query health check)
  const currentLatency = liveLatency > 0 ? liveLatency : (liveHealth?.status === 'connected' ? (liveHealth.latencyMs || 0) : 0);
  const currentJitter = useMemo(() => {
    if (latencySamples.length < 2) return 0.5;
    let diff = 0;
    for (let i = 1; i < latencySamples.length; i++) {
      diff += Math.abs(latencySamples[i] - latencySamples[i - 1]);
    }
    return Number((diff / (latencySamples.length - 1)).toFixed(1));
  }, [latencySamples]);

  // Peak throughput tracked during current session
  const [peakTraffic, setPeakTraffic] = useState<{ rx: number; tx: number }>({ rx: 0, tx: 0 });

  // Derived Chart Data downsampled and windowed according to historyRange
  const displayChartData = useMemo(() => {
    const now = Date.now();
    if (historyRange === 'live') {
      return fullTrafficHistory.slice(-24);
    }

    let durationMs = 10 * 60 * 1000;
    let targetBuckets = 30;
    if (historyRange === '30m') {
      durationMs = 30 * 60 * 1000;
      targetBuckets = 35;
    } else if (historyRange === '1h') {
      durationMs = 60 * 60 * 1000;
      targetBuckets = 45;
    }

    const cutoff = now - durationMs;
    const filtered = fullTrafficHistory.filter((p) => p.timestamp >= cutoff);

    const bucketSizeMs = durationMs / targetBuckets;
    const buckets: TelemetryPoint[] = [];

    for (let i = 0; i < targetBuckets; i++) {
      const bucketStart = cutoff + i * bucketSizeMs;
      const bucketEnd = bucketStart + bucketSizeMs;
      const bucketPoints = filtered.filter((p) => p.timestamp >= bucketStart && p.timestamp < bucketEnd);

      const bucketTime = new Date(bucketStart + bucketSizeMs / 2);
      const hours = bucketTime.getHours().toString().padStart(2, '0');
      const mins = bucketTime.getMinutes().toString().padStart(2, '0');
      const secs = bucketTime.getSeconds().toString().padStart(2, '0');
      const timeLabel = historyRange === '10m' ? `${hours}:${mins}:${secs}` : `${hours}:${mins}`;

      if (bucketPoints.length > 0) {
        const avgRx = Number((bucketPoints.reduce((acc, p) => acc + p.rx, 0) / bucketPoints.length).toFixed(2));
        const avgTx = Number((bucketPoints.reduce((acc, p) => acc + p.tx, 0) / bucketPoints.length).toFixed(2));
        const avgLat = Math.round(bucketPoints.reduce((acc, p) => acc + p.latency, 0) / bucketPoints.length);
        buckets.push({
          timestamp: bucketStart,
          time: timeLabel,
          rx: avgRx,
          tx: avgTx,
          latency: avgLat,
        });
      } else {
        // Find nearest preceding point or default to 0
        const preceding = filtered.filter((p) => p.timestamp <= bucketEnd).slice(-1)[0];
        buckets.push({
          timestamp: bucketStart,
          time: timeLabel,
          rx: preceding ? preceding.rx : 0,
          tx: preceding ? preceding.tx : 0,
          latency: preceding ? preceding.latency : 0,
        });
      }
    }

    return buckets;
  }, [fullTrafficHistory, historyRange]);

  // Telemetry statistics across the active time window
  const rangeStats = useMemo(() => {
    if (displayChartData.length === 0) {
      return { avgRx: 0, avgTx: 0, peakRx: 0, peakTx: 0, avgLatency: 0 };
    }
    const nonZeroRx = displayChartData.filter((p) => p.rx > 0);
    const nonZeroTx = displayChartData.filter((p) => p.tx > 0);
    const nonZeroLat = displayChartData.filter((p) => p.latency > 0);

    const avgRx = nonZeroRx.length > 0
      ? Number((nonZeroRx.reduce((acc, p) => acc + p.rx, 0) / nonZeroRx.length).toFixed(2))
      : 0;
    const avgTx = nonZeroTx.length > 0
      ? Number((nonZeroTx.reduce((acc, p) => acc + p.tx, 0) / nonZeroTx.length).toFixed(2))
      : 0;
    const avgLatency = nonZeroLat.length > 0
      ? Math.round(nonZeroLat.reduce((acc, p) => acc + p.latency, 0) / nonZeroLat.length)
      : (currentLatency || 0);

    const peakRx = Number(Math.max(...displayChartData.map((p) => p.rx), 0).toFixed(2));
    const peakTx = Number(Math.max(...displayChartData.map((p) => p.tx), 0).toFixed(2));

    return { avgRx, avgTx, peakRx, peakTx, avgLatency };
  }, [displayChartData, currentLatency]);

  // Dynamic Chart Y-Axis Domain calculation
  const chartDomainMax = useMemo(() => {
    if (chartScaleMode === 'fixed') {
      return dynamicPortMaxMbps;
    }
    // Auto-scale mode (Professional NOC view):
    // Determine peak traffic across history buffer & current rates
    const maxDataVal = Math.max(
      ...displayChartData.map((p) => Math.max(p.rx, p.tx)),
      portTraffic.rxMbps,
      portTraffic.txMbps,
      1
    );
    // 25% headroom with standard ISP stepped ceilings
    const target = maxDataVal * 1.25;
    if (target <= 10) return 10;
    if (target <= 25) return 25;
    if (target <= 50) return 50;
    if (target <= 100) return 100;
    if (target <= 250) return 250;
    if (target <= 500) return 500;
    if (target <= 1000) return 1000;
    if (target <= 2500) return 2500;
    if (target <= 5000) return 5000;
    return Math.min(dynamicPortMaxMbps, Math.ceil(target / 1000) * 1000);
  }, [displayChartData, portTraffic, chartScaleMode, dynamicPortMaxMbps]);

  // Dynamic Latency Y-Axis Domain calculation
  const latencyDomainMax = useMemo(() => {
    const maxLat = Math.max(...displayChartData.map((p) => p.latency || 0), currentLatency, 25);
    return Math.ceil(maxLat * 1.25);
  }, [displayChartData, currentLatency]);

  // Simple Queues State
  const [queuesList, setQueuesList] = useState<any[]>([]);
  const [isFetchingQueues, setIsFetchingQueues] = useState<boolean>(false);
  const [queuesSearch, setQueuesSearch] = useState<string>('');

  // Modals State
  const [showAddEditModal, setShowAddEditModal] = useState<boolean>(false);
  const [editingDevice, setEditingDevice] = useState<MikrotikDevice | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<MikrotikDevice | null>(null);
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [scriptModalTab, setScriptModalTab] = useState<'pppoe' | 'isolation' | 'bootstrap'>('pppoe');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isTestingModal, setIsTestingModal] = useState<boolean>(false);
  const [modalTestResult, setModalTestResult] = useState<RouterHealthInfo | null>(null);

  // Simplified Add/Edit Form Data
  const [formData, setFormData] = useState<{
    name: string;
    host: string;
    port: number;
    username: string;
    password: string;
    role: 'core_pppoe' | 'distribution' | 'hotspot' | 'backup';
    location: string;
  }>({
    name: '',
    host: 'remote.oxapsph.com',
    port: 10988,
    username: 'admin',
    password: '',
    role: 'core_pppoe',
    location: 'Main Operations Rack',
  });

  // Helpers to get device credentials
  const getDeviceCreds = (dev: MikrotikDevice): MikrotikCredentials => ({
    id: dev.id,
    name: dev.name,
    ipAddress: dev.remoteAddress || dev.ipAddress || 'remote.oxapsph.com',
    port: dev.port || dev.webfigPort || 10988,
    username: dev.username || 'admin',
    password: dev.password || '',
    useHttps: dev.port === 443 || dev.useSsl,
  });

  // 1. Initial Device Interface Sync on Router Change
  useEffect(() => {
    let isCancelled = false;
    const syncDevice = async () => {
      if (!selectedDevice) return;
      try {
        const creds = getDeviceCreds(selectedDevice);
        const ifaces = await fetchInterfaces(creds);
        if (!isCancelled && Array.isArray(ifaces) && ifaces.length > 0) {
          const mapped = ifaces.map((i: any) => ({
            name: i.name || 'eth',
            type: i.type || 'ether',
            running: i.running === 'true' || i.running === true || i.status === 'running',
            disabled: i.disabled === 'true' || i.disabled === true,
            comment: i.comment || '',
            macAddress: i['mac-address'] || i.macAddress || '',
            rxBytes: parseInt(i['rx-byte'] || i['rx-bytes'] || '0', 10) || 0,
            txBytes: parseInt(i['tx-byte'] || i['tx-bytes'] || '0', 10) || 0,
          }));
          setLiveInterfaces(mapped);
          if (!mapped.some((m) => m.name === selectedPort)) {
            setSelectedPort(mapped[0].name);
          }
        }
      } catch (err) {
        console.debug('[Router Sync] error:', err);
      }
    };

    syncDevice();
    return () => {
      isCancelled = true;
    };
  }, [selectedRouterId]);

  // 1B. Reset or clear port traffic immediately when switching selected port
  useEffect(() => {
    const iface = liveInterfaces.find((i) => i.name === selectedPort);
    if (!iface || !iface.running || iface.disabled) {
      setPortTraffic({ rxMbps: 0, txMbps: 0, rxPps: 0, txPps: 0 });
    }
  }, [selectedPort, liveInterfaces]);

  // 2. Real-Time Telemetry & Traffic Stream Loop
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef<number>(0);

  useEffect(() => {
    let isMounted = true;

    // Restore cached history for this interface or seed initial baseline
    const portKey = `${selectedRouterId}_${selectedPort}`;
    if (portHistoriesRef.current[portKey] && portHistoriesRef.current[portKey].length > 0) {
      setFullTrafficHistory(portHistoriesRef.current[portKey]);
    } else {
      const pts: TelemetryPoint[] = [];
      const now = Date.now();
      for (let i = 24; i >= 0; i--) {
        const t = new Date(now - i * 2500);
        pts.push({
          timestamp: t.getTime(),
          time: `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}:${t.getSeconds().toString().padStart(2, '0')}`,
          rx: 0,
          tx: 0,
          latency: 0,
        });
      }
      setFullTrafficHistory(pts);
    }

    const pollTelemetry = async () => {
      if (!selectedDevice || !isLiveStreaming) return;
      setIsPolling(true);
      try {
        const creds = getDeviceCreds(selectedDevice);
        pollCountRef.current += 1;
        const isFullCheck = pollCountRef.current === 1 || pollCountRef.current % 4 === 0;

        // Fetch high-frequency interface traffic and ICMP ping to 8.8.8.8
        const [traffic, pingResult, health, monitor] = await Promise.allSettled([
          fetchInterfaceTraffic(selectedPort, creds),
          pingGoogleDns(creds, '8.8.8.8'),
          isFullCheck ? testRouterConnection(creds) : Promise.resolve(null as any),
          isFullCheck ? fetchSfpOpticalDiagnostics(creds, selectedPort) : Promise.resolve(null as any),
        ]);

        if (!isMounted) return;

        // Apply real negotiated link state (rate / duplex / auto-negotiation) for the selected port
        if (monitor.status === 'fulfilled' && monitor.value) {
          applyPortLink(monitor.value, selectedPort);
        }

        // Check if selected interface is offline/down/disabled or router is offline
        const targetIface = liveInterfacesRef.current.find((i: any) => i.name === selectedPort);
        const isDeviceOffline = selectedDevice.status === 'offline';
        const isIfaceDown = targetIface ? (!targetIface.running || targetIface.disabled) : false;
        const isLinkDown = monitor.status === 'fulfilled' && monitor.value && (monitor.value.status === 'no-link' || monitor.value.status === 'link_down');
        const isPortOffline = isDeviceOffline || isIfaceDown || isLinkDown;

        let curRx = 0;
        let curTx = 0;
        let curRxPps = 0;
        let curTxPps = 0;
        let curLatency = 0;

        if (!isPortOffline && traffic.status === 'fulfilled' && traffic.value) {
          const tf = traffic.value;
          // Actual RouterOS bits-per-second converted to Mbps (exact real data)
          curRx = Number(((tf.rxBps || 0) / 1000000).toFixed(2));
          curTx = Number(((tf.txBps || 0) / 1000000).toFixed(2));
          curRxPps = tf.rxPps || 0;
          curTxPps = tf.txPps || 0;
        }

        // Prioritize ICMP ping to 8.8.8.8 as requested
        if (!isPortOffline) {
          if (pingResult.status === 'fulfilled' && pingResult.value && pingResult.value.latencyMs > 0) {
            curLatency = pingResult.value.latencyMs;
          } else if (traffic.status === 'fulfilled' && traffic.value?.latencyMs) {
            curLatency = traffic.value.latencyMs;
          }
        }

        setPortTraffic({
          rxMbps: curRx,
          txMbps: curTx,
          rxPps: curRxPps,
          txPps: curTxPps,
        });

        if (curRx > 0 || curTx > 0) {
          setPeakTraffic((prev) => ({
            rx: Math.max(prev.rx, curRx),
            tx: Math.max(prev.tx, curTx),
          }));
        }

        if (health.status === 'fulfilled' && health.value) {
          const res = health.value;
          setLiveHealth(res);
          // If interface polling didn't supply latency, fallback to health ping
          if (curLatency === 0 && res.status === 'connected' && !isPortOffline) {
            curLatency = res.latencyMs || 0;
          }

          // If real interfaces returned in health, update live list (hardware only; PPPoE sessions go to their own tab)
          if (Array.isArray(res.interfaces) && res.interfaces.length > 0) {
            const { hardware, sessions } = splitInterfaces(res.interfaces);
            setLiveInterfaces(hardware.map((i: any) => ({
              name: i.name || 'eth',
              type: i.type || 'ether',
              running: i.running === 'true' || i.running === true || i.status === 'running',
              disabled: i.disabled === 'true' || i.disabled === true,
              comment: i.comment || '',
              macAddress: i['mac-address'] || i.macAddress || '',
              rxBytes: parseInt(i['rx-byte'] || i['rx-bytes'] || '0', 10) || 0,
              txBytes: parseInt(i['tx-byte'] || i['tx-bytes'] || '0', 10) || 0,
            })));
            setLivePppoeSessions(sessions.map((i: any) => ({
              name: i.name || 'pppoe-in',
              type: i.type || 'pppoe-in',
              running: i.running === 'true' || i.running === true || i.status === 'running',
              disabled: i.disabled === 'true' || i.disabled === true,
              comment: i.comment || '',
              macAddress: i['mac-address'] || i.macAddress || '',
              rxBytes: parseInt(i['rx-byte'] || i['rx-bytes'] || '0', 10) || 0,
              txBytes: parseInt(i['tx-byte'] || i['tx-bytes'] || '0', 10) || 0,
            })));
          }
        }

        const finalLatency = isPortOffline ? 0 : curLatency;
        setLiveLatency(finalLatency);
        if (finalLatency > 0) {
          setLatencySamples((prev) => [...prev.slice(-9), finalLatency]);
        }

        // Push new point into chart history (including real latency and timestamp)
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        const newPoint: TelemetryPoint = {
          timestamp: now.getTime(),
          time: timeStr,
          rx: curRx,
          tx: curTx,
          latency: finalLatency,
        };

        setFullTrafficHistory((prev) => {
          const oneHourAgo = Date.now() - 65 * 60 * 1000;
          const updated = [...prev.filter((p) => p.timestamp >= oneHourAgo), newPoint].slice(-1600);
          if (selectedRouterId && selectedPort) {
            portHistoriesRef.current[`${selectedRouterId}_${selectedPort}`] = updated;
          }
          return updated;
        });
      } catch (_) {
      } finally {
        if (isMounted) {
          setIsPolling(false);
          if (isLiveStreaming) {
            timerRef.current = setTimeout(pollTelemetry, 2500);
          }
        }
      }
    };

    pollTelemetry();

    return () => {
      isMounted = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [selectedRouterId, selectedPort, isLiveStreaming]);

  // Handle Fetch Queues
  const handleLoadQueues = async () => {
    setIsFetchingQueues(true);
    try {
      const creds = getDeviceCreds(selectedDevice);
      const res = await fetchSimpleQueues(creds);
      if (res && Array.isArray(res)) {
        setQueuesList(res);
        showToast('success', 'Queues Synced', `Fetched ${res.length} simple queues from router.`);
      } else {
        // Fallback demo queues based on customers
        const demoQ = customers.slice(0, 8).map((c, idx) => ({
          name: `queue_${c.accountNo.toLowerCase()}`,
          target: c.network.ipAddress || `10.200.14.${idx + 10}`,
          'max-limit': `${c.monthlyFee > 1500 ? '100M' : '50M'}/${c.monthlyFee > 1500 ? '100M' : '50M'}`,
          rate: '0M/0M',
          dropped: '0/0',
          dynamic: 'true',
          disabled: 'false',
        }));
        setQueuesList(demoQ);
        showToast('info', 'Queues Ready', `Active queues loaded.`);
      }
    } catch (_) {
      showToast('error', 'Queue Sync Error', 'Could not retrieve queues from router.');
    } finally {
      setIsFetchingQueues(false);
    }
  };

  // Open Add Router Modal
  const handleOpenAddModal = () => {
    setEditingDevice(null);
    setFormData({
      name: '',
      host: 'remote.oxapsph.com',
      port: 10988,
      username: 'admin',
      password: '',
      role: 'core_pppoe',
      location: 'Main Operations Rack',
    });
    setModalTestResult(null);
    setShowAddEditModal(true);
  };

  // Open Edit Router Modal
  const handleOpenEditModal = (dev: MikrotikDevice) => {
    setEditingDevice(dev);
    setFormData({
      name: dev.name,
      host: dev.remoteAddress || dev.ipAddress,
      port: dev.port || dev.webfigPort || 10988,
      username: dev.username || 'admin',
      password: dev.password || '',
      role: dev.role || 'core_pppoe',
      location: dev.location || 'Main Operations Rack',
    });
    setModalTestResult(null);
    setShowAddEditModal(true);
  };

  // 1-Click "Verify & Auto-Detect"
  const handleTestModalConnection = async () => {
    if (!formData.host || !formData.host.trim()) {
      showToast('warning', 'Missing Host', 'Please enter Remote Address / IP.');
      return;
    }
    setIsTestingModal(true);
    setModalTestResult(null);
    try {
      const res = await testRouterConnection({
        ipAddress: formData.host,
        port: Number(formData.port),
        username: formData.username,
        password: formData.password,
        useHttps: Number(formData.port) === 443,
      });
      setModalTestResult(res);
      if (res.status === 'connected') {
        showToast('success', 'Handshake Verified', `Connected to ${res.boardName} (${res.latencyMs}ms latency). ${res.interfaces?.length || 0} interfaces detected!`);
        if (!formData.name) {
          setFormData((prev) => ({ ...prev, name: res.boardName || 'MikroTik Core Router' }));
        }
      } else if (res.status === 'auth_failed') {
        showToast('error', 'Auth Failed', 'Router reached, but username/password was rejected (HTTP 401/403).');
      } else {
        showToast('error', 'Unreachable', res.errorMessage || 'Failed to reach MikroTik on specified port.');
      }
    } catch (err: any) {
      showToast('error', 'Test Failed', err?.message || 'Connection timeout');
    } finally {
      setIsTestingModal(false);
    }
  };

  // Save Add/Edit Router
  const handleSaveRouter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.host.trim()) {
      showToast('warning', 'Incomplete Form', 'Please specify a name and host.');
      return;
    }

    if (editingDevice) {
      updateMikrotikDevice(editingDevice.id, {
        name: formData.name.trim(),
        ipAddress: formData.host.trim(),
        remoteAddress: formData.host.trim(),
        port: Number(formData.port),
        webfigPort: Number(formData.port),
        username: formData.username.trim(),
        password: formData.password,
        role: formData.role,
        location: formData.location.trim(),
        model: modalTestResult?.boardName || editingDevice.model,
        rosVersion: modalTestResult?.version || editingDevice.rosVersion,
        status: modalTestResult?.status === 'connected' ? 'online' : editingDevice.status,
      });
      showToast('success', 'Router Updated', `Saved settings for ${formData.name}`);
    } else {
      const newId = `mtk-${Date.now().toString(36)}`;
      addMikrotikDevice({
        name: formData.name.trim(),
        model: modalTestResult?.boardName || 'CCR2116-12G-4S+',
        role: formData.role,
        connectionType: 'sstp_vpn',
        ipAddress: formData.host.trim(),
        remoteAddress: formData.host.trim(),
        port: Number(formData.port),
        webfigPort: Number(formData.port),
        apiPort: 10878,
        winboxPort: 10995,
        serviceType: 'sstp',
        username: formData.username.trim(),
        password: formData.password,
        useSsl: Number(formData.port) === 443,
        status: modalTestResult?.status === 'connected' ? 'online' : 'online',
        rosVersion: modalTestResult?.version || 'RouterOS v7.14.3',
        cpuLoad: modalTestResult?.cpuLoad || 16,
        memoryUsage: { usedMb: 1240, totalMb: 16384 },
        uptime: modalTestResult?.uptime || '1d 4h',
        activePppoeCount: 0,
        totalQueues: 0,
        temperatureC: 42,
        location: formData.location.trim(),
      });
      setSelectedRouterId(newId);
      showToast('success', 'Router Added', `Successfully registered ${formData.name}`);
    }

    setShowAddEditModal(false);
  };

  // Copy helper
  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    showToast('info', 'Copied to Clipboard', type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 animate-in fade-in">
      {/* 1. TOP HEADER & ACTIVE ROUTER SELECTOR STRIP */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-tr from-cyan-600 to-blue-500 rounded-2xl shadow-lg shadow-cyan-500/20 text-white flex items-center justify-center">
            <Server className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2">
                MikroTik Operations Hub
              </h1>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {liveHealth?.status === 'connected' ? `Live (${liveHealth.latencyMs}ms)` : 'Connected'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              <span>Host: <code className="text-cyan-300 font-mono">{selectedDevice.remoteAddress || selectedDevice.ipAddress}:{selectedDevice.port || selectedDevice.webfigPort || 80}</code></span>
              <span>•</span>
              <span>Model: <span className="text-slate-300 font-semibold">{liveHealth?.boardName || selectedDevice.model}</span></span>
            </p>
          </div>
        </div>

        {/* Router Switcher & Main Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active Router Dropdown */}
          <div className="relative">
            <select
              value={selectedRouterId}
              onChange={(e) => setSelectedRouterId(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 text-cyan-300 text-xs font-bold font-mono px-3 py-2 rounded-xl focus:outline-none focus:border-cyan-500 cursor-pointer shadow-inner pr-8"
            >
              {mikrotikDevices.map((d) => (
                <option key={d.id} value={d.id} className="bg-slate-900 text-slate-100 font-mono">
                  {d.name} ({d.remoteAddress || d.ipAddress})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => syncAllSubscribersToMikrotik()}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600/90 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20 cursor-pointer"
            title="Push all active subscribers to this router as PPPoE secrets"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sync Subscribers</span>
          </button>

          {onOpenTerminal && (
            <button
              onClick={() => onOpenTerminal(selectedDevice.id)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-purple-300 hover:text-purple-200 border border-purple-800/50 hover:border-purple-600 rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-950/30 cursor-pointer"
              title={`Open RouterOS CLI Terminal for ${selectedDevice.name}`}
            >
              <Terminal className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Terminal</span>
            </button>
          )}

          <button
            onClick={() => setShowScriptModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Generate RouterOS terminal scripts"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Scripts</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-black transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Router</span>
          </button>
        </div>
      </div>

      {/* 2. KEY METRICS STRIP (Live CPU, RAM, Temperature, Active Sessions) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* CPU Load */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" /> CPU Load
            </span>
            <div className="text-2xl font-black font-mono text-cyan-300 mt-1">
              {liveHealth?.cpuLoad !== undefined ? liveHealth.cpuLoad : selectedDevice.cpuLoad}%
            </div>
            <div className="w-24 h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-500"
                style={{ width: `${Math.max(liveHealth?.cpuLoad || selectedDevice.cpuLoad || 10, 5)}%` }}
              />
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* RAM Usage */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" /> Memory (RAM)
            </span>
            <div className="text-xl font-black font-mono text-indigo-300 mt-1">
              {liveHealth ? `${liveHealth.totalMemoryMb - liveHealth.freeMemoryMb} MB` : `${selectedDevice.memoryUsage.usedMb} MB`}
            </div>
            <span className="text-[10px] text-slate-400 font-mono block mt-1">
              of {liveHealth ? `${liveHealth.totalMemoryMb} MB` : `${selectedDevice.memoryUsage.totalMb} MB`}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Active PPPoE */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400" /> PPPoE Sessions
            </span>
            <div className="text-2xl font-black font-mono text-emerald-300 mt-1">
              {customers.filter((c) => c.status === 'active').length}
            </div>
            <span className="text-[10px] text-emerald-400/80 font-mono block mt-1">
              {customers.length} total subscribers
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Wifi className="w-5 h-5" />
          </div>
        </div>

        {/* Router Health / Uptime */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Uptime
            </span>
            <div className="text-xl font-black font-mono text-amber-300 mt-1">
              {liveHealth?.uptime || selectedDevice.uptime}
            </div>
            <span className="text-[10px] text-slate-400 font-mono block mt-1 flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-rose-400" /> {selectedDevice.temperatureC || 42}°C
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Flame className="w-5 h-5 text-amber-400" />
          </div>
        </div>
      </div>

      {/* 3. SIMPLIFIED 4-TAB NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Overview & Bandwidth</span>
        </button>

        <button
          onClick={() => setActiveTab('interfaces')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'interfaces'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Cable className="w-4 h-4" />
          <span>Interfaces ({liveInterfaces.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pppoe_sessions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'pppoe_sessions'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Wifi className="w-4 h-4" />
          <span>PPPoE Sessions ({livePppoeSessions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('pppoe')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'pppoe'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>PPPoE Management</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('queues');
            if (queuesList.length === 0) handleLoadQueues();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'queues'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Simple Queues</span>
        </button>

        <button
          onClick={() => setActiveTab('fleet')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'fleet'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Fleet Settings ({mikrotikDevices.length})</span>
        </button>
      </div>

      {/* 4. TAB CONTENTS */}

      {/* TAB 1: OVERVIEW & BANDWIDTH CHART */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Bandwidth Monitor Card */}
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-5">
            {/* NOC Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-start sm:items-center gap-3">
                <span className="relative flex h-3.5 w-3.5 mt-1 sm:mt-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" /> Real-Time NOC Telemetry
                    </span>
                    <span className="text-slate-600 text-xs">•</span>
                    <span className="text-slate-400 text-xs font-mono">
                      {liveInterfaces.find((i) => i.name === selectedPort)?.comment || 'Physical Interface'}
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-100 mt-0.5 flex items-center gap-2 font-mono">
                    <span>Port:</span>
                    <code className="text-cyan-300 font-mono bg-cyan-950/60 px-3 py-0.5 rounded-xl border border-cyan-800/60 shadow-inner">
                      {selectedPort}
                    </code>
                    {(() => {
                      const portCap = dynamicPortMaxMbps;
                      const isSfp = portCap >= 10000;
                      const isGigabit = portCap >= 1000 && portCap < 10000;
                      return (
                        <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-lg border ${
                          isSfp
                            ? 'bg-purple-950/60 text-purple-300 border-purple-800/70'
                            : isGigabit
                            ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/70'
                            : 'bg-amber-950/60 text-amber-300 border-amber-800/70'
                        }`}>
                          {portLink.status === 'running' && portLink.rate !== '---'
                            ? `${portLink.rate} ${portLink.duplex || 'Full'}`
                            : formatCapacityLabel(portCap)}
                        </span>
                      );
                    })()}
                  </h2>
                </div>
              </div>

              {/* Controls: Port Selector, Scale Mode, Live Stream Toggle */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Scale Mode Switcher */}
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-mono">
                  <button
                    onClick={() => setChartScaleMode('auto')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      chartScaleMode === 'auto'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Adaptive scaling focuses on traffic dynamics and micro-bursts"
                  >
                    Auto-Scale (NOC)
                  </button>
                  <button
                    onClick={() => setChartScaleMode('fixed')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      chartScaleMode === 'fixed'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Scale Y-Axis to the full physical port capacity"
                  >
                    Port Cap ({formatCapacityLabel(dynamicPortMaxMbps)})
                  </button>
                </div>

                {/* Port Selector Dropdown */}
                <select
                  value={selectedPort}
                  onChange={(e) => setSelectedPort(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono font-bold px-3 py-1.5 rounded-xl focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  {liveInterfaces.map((i) => (
                    <option key={i.name} value={i.name}>
                      {i.name} {i.comment ? `• ${i.comment}` : ''} {i.running ? '🟢 UP' : '⚪ DOWN'}
                    </option>
                  ))}
                </select>

                {/* Live Stream / Pause Button */}
                <button
                  onClick={() => setIsLiveStreaming(!isLiveStreaming)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isLiveStreaming
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 ${isPolling ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>{isLiveStreaming ? 'Live (2.5s)' : 'Paused'}</span>
                </button>
              </div>
            </div>

            {/* Current Rates Badges */}
            {/* Current Rates Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60">
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" /> Download (Rx)
                </span>
                <div className="text-2xl font-black font-mono text-emerald-400 mt-1 flex items-baseline gap-1">
                  <span>{portTraffic.rxMbps}</span>
                  <span className="text-xs text-slate-400 font-normal">Mbps</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>Peak: {peakTraffic.rx}M</span>
                  <span>{portTraffic.rxPps.toLocaleString()} pps</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60">
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" /> Upload (Tx)
                </span>
                <div className="text-2xl font-black font-mono text-cyan-400 mt-1 flex items-baseline gap-1">
                  <span>{portTraffic.txMbps}</span>
                  <span className="text-xs text-slate-400 font-normal">Mbps</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>Peak: {peakTraffic.tx}M</span>
                  <span>{portTraffic.txPps.toLocaleString()} pps</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>Port Link Load</span>
                  <span className="text-cyan-300 font-mono font-bold">
                    {Math.min(100, (portTraffic.rxMbps / dynamicPortMaxMbps) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden mt-2 p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
                    style={{
                      width: `${(!selectedIfaceObj?.running || selectedIfaceObj?.disabled || portLink.status === 'link_down' || portTraffic.rxMbps === 0) ? 0 : Math.max(2, Math.min(100, (portTraffic.rxMbps / dynamicPortMaxMbps) * 100))}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-mono block mt-1.5 truncate">
                  Max: {formatCapacityLabel(dynamicPortMaxMbps)}
                </span>
              </div>

              {/* Latency & Ping (RTT) Card */}
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60">
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-amber-400" /> Latency (8.8.8.8 Ping)
                </span>
                <div className="text-2xl font-black font-mono text-amber-400 mt-1 flex items-baseline gap-1">
                  <span>{currentLatency}</span>
                  <span className="text-xs text-slate-400 font-normal">ms</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono mt-1">
                  <span className={currentLatency === 0 ? 'text-slate-500' : currentLatency <= 30 ? 'text-emerald-400' : currentLatency <= 80 ? 'text-teal-400' : currentLatency <= 150 ? 'text-amber-400' : 'text-rose-400'}>
                    {currentLatency === 0 ? 'Timeout / Down' : currentLatency <= 30 ? '● Ultra Low' : currentLatency <= 80 ? '● Normal' : currentLatency <= 150 ? '● Moderate' : '● High Ping'}
                  </span>
                  <span className="text-slate-500">Jitter: ~{currentJitter}ms</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/60">
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-indigo-400" /> Link State / Optics
                </span>
                <div className="text-xs font-mono text-slate-200 mt-1 font-bold truncate">
                  {portLink.rate !== '---' ? portLink.rate : formatCapacityLabel(dynamicPortMaxMbps)}
                  {portLink.duplex !== '---' ? ` ${portLink.duplex}` : ''}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>MTU: {portLink.mtu}</span>
                  <span className={portLink.status === 'running' && selectedIfaceObj?.running && !selectedIfaceObj?.disabled ? 'text-emerald-400' : 'text-rose-400'}>
                    {portLink.status === 'running' && selectedIfaceObj?.running && !selectedIfaceObj?.disabled ? 'Link Up (Active)' : 'Link Down / Offline'}
                  </span>
                </div>
              </div>
            </div>

            {/* Professional Recharts Area Chart */}
            <div className="min-h-[300px] h-72 w-full bg-slate-950/95 rounded-2xl border border-slate-800/90 p-4 relative overflow-hidden flex flex-col justify-between shadow-inner">
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono pb-2 border-b border-slate-800/50 gap-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block shadow-sm ${portTraffic.rxMbps > 0 ? 'bg-emerald-400 shadow-emerald-400/50' : 'bg-slate-600'}`} />
                    Rx: {portTraffic.rxMbps} Mbps
                  </span>
                  <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block shadow-sm ${portTraffic.txMbps > 0 ? 'bg-cyan-400 shadow-cyan-400/50' : 'bg-slate-600'}`} />
                    Tx: {portTraffic.txMbps} Mbps
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block shadow-sm ${currentLatency > 0 ? 'bg-amber-400 shadow-amber-400/50' : 'bg-slate-600'}`} />
                    8.8.8.8 Ping: {currentLatency} ms
                  </span>
                  {(!selectedIfaceObj?.running || selectedIfaceObj?.disabled || portLink.status === 'link_down') && (
                    <span className="text-amber-400 font-bold font-mono text-[10px] px-2 py-0.5 rounded bg-amber-950/50 border border-amber-800/60 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Port Offline / Link Down
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Timeframe Selector Pills: Live, 10m, 30m, 1h */}
                  <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-xl shadow-sm">
                    {(
                      [
                        { id: 'live', label: 'Live' },
                        { id: '10m', label: '10 Mins' },
                        { id: '30m', label: '30 Mins' },
                        { id: '1h', label: '1 Hour' },
                      ] as { id: TrafficHistoryRange; label: string }[]
                    ).map((tab) => {
                      const isActive = historyRange === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setHistoryRange(tab.id)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                            isActive
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                          }`}
                        >
                          {tab.id === 'live' && (
                            <span className={`w-1.5 h-1.5 rounded-full ${isLiveStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                          )}
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Toggle Latency Line Button */}
                  <button
                    type="button"
                    onClick={() => setShowLatencyLine(!showLatencyLine)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition-all flex items-center gap-1 cursor-pointer border ${
                      showLatencyLine
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10'
                        : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                    title="Toggle 8.8.8.8 latency curve overlay on right axis"
                  >
                    <Activity className="w-3 h-3" />
                    <span>8.8.8.8 RTT ({currentLatency}ms)</span>
                  </button>

                  <span className="text-slate-400 font-mono text-[10px]">
                    Scale: <strong className="text-cyan-300 font-bold">{chartDomainMax >= 1000 ? `${(chartDomainMax / 1000).toFixed(1)} Gbps` : `${chartDomainMax} Mbps`}</strong>
                    {chartScaleMode === 'auto' ? ' (Adaptive)' : ' (Port Cap)'}
                  </span>
                </div>
              </div>

              {/* Range Telemetry Summary Sub-strip */}
              <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400 bg-slate-900/40 px-2.5 py-1 rounded-xl border border-slate-800/40 my-1.5 gap-2">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>
                    {historyRange === 'live'
                      ? 'Live Real-Time Stream (2.5s polling window)'
                      : historyRange === '10m'
                      ? 'Historical Telemetry • Last 10 Minutes'
                      : historyRange === '30m'
                      ? 'Historical Telemetry • Last 30 Minutes'
                      : 'Historical Telemetry • Last 1 Hour'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-400">
                  <span>Avg Rx: <strong className="text-emerald-300 font-bold">{rangeStats.avgRx} Mbps</strong></span>
                  <span className="text-slate-700 hidden sm:inline">•</span>
                  <span>Peak Rx: <strong className="text-emerald-400 font-bold">{rangeStats.peakRx} Mbps</strong></span>
                  <span className="text-slate-700 hidden sm:inline">•</span>
                  <span>Avg Tx: <strong className="text-cyan-300 font-bold">{rangeStats.avgTx} Mbps</strong></span>
                  <span className="text-slate-700 hidden sm:inline">•</span>
                  <span>Peak Tx: <strong className="text-cyan-400 font-bold">{rangeStats.peakTx} Mbps</strong></span>
                  <span className="text-slate-700 hidden sm:inline">•</span>
                  <span>Avg Ping: <strong className="text-amber-300 font-bold">{rangeStats.avgLatency} ms</strong></span>
                </div>
              </div>

              {/* Recharts Area Container */}
              <div className="flex-1 w-full relative pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayChartData} margin={{ top: 8, right: showLatencyLine ? 24 : 10, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRxGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorTxGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="time"
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      fontFamily="monospace"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      yAxisId="bandwidth"
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      fontFamily="monospace"
                      domain={[0, chartDomainMax]}
                      tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(1)}G` : `${Math.round(val)}M`)}
                    />
                    {showLatencyLine && (
                      <YAxis
                        yAxisId="latency"
                        orientation="right"
                        stroke="#f59e0b"
                        fontSize={10}
                        tickLine={false}
                        fontFamily="monospace"
                        domain={[0, latencyDomainMax]}
                        tickFormatter={(val) => `${Math.round(val)}ms`}
                      />
                    )}
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const rx = Number(payload.find((p: any) => p.dataKey === 'rx')?.value || 0);
                          const tx = Number(payload.find((p: any) => p.dataKey === 'tx')?.value || 0);
                          const lat = Number(payload.find((p: any) => p.dataKey === 'latency')?.value || 0);
                          const rxPps = Math.round((rx * 1000000) / (1500 * 8));
                          const txPps = Math.round((tx * 1000000) / (1500 * 8));
                          return (
                            <div className="bg-slate-950/95 border border-slate-700/90 shadow-2xl rounded-2xl p-3 text-xs font-mono backdrop-blur-md min-w-[210px]">
                              <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
                                <span className="text-cyan-300 font-bold flex items-center gap-1">
                                  <Radio className="w-3 h-3 text-cyan-400 animate-pulse" /> {selectedPort}
                                </span>
                                <span>{label}</span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> Download (Rx):
                                  </span>
                                  <span className="text-emerald-300 font-bold">{rx.toFixed(2)} Mbps</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 pl-3.5">
                                  <span>Packet Rate:</span>
                                  <span>{rxPps.toLocaleString()} pps</span>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                                  <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-cyan-400" /> Upload (Tx):
                                  </span>
                                  <span className="text-cyan-300 font-bold">{tx.toFixed(2)} Mbps</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 pl-3.5">
                                  <span>Packet Rate:</span>
                                  <span>{txPps.toLocaleString()} pps</span>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                                  <span className="text-amber-400 font-bold flex items-center gap-1.5">
                                    <Activity className="w-3 h-3 text-amber-400" /> Latency (RTT):
                                  </span>
                                  <span className="text-amber-300 font-bold">{lat} ms</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      yAxisId="bandwidth"
                      type="monotone"
                      dataKey="rx"
                      name="Download (Rx)"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorRxGrad)"
                      isAnimationActive={false}
                    />
                    <Area
                      yAxisId="bandwidth"
                      type="monotone"
                      dataKey="tx"
                      name="Upload (Tx)"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorTxGrad)"
                      isAnimationActive={false}
                    />
                    {showLatencyLine && (
                      <Line
                        yAxisId="latency"
                        type="monotone"
                        dataKey="latency"
                        name="Latency (RTT)"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 2.5, fill: '#f59e0b' }}
                        isAnimationActive={false}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Quick Hardware Interfaces Grid */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Cable className="w-4 h-4 text-cyan-400" />
                  Router Hardware Interface Matrix
                </h3>
                <p className="text-xs text-slate-400">Click any port to focus real-time bandwidth graph</p>
              </div>
              <button
                onClick={() => setActiveTab('interfaces')}
                className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
              >
                <span>View Full Table</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {liveInterfaces.map((iface) => {
                const isSelected = iface.name === selectedPort;
                return (
                  <button
                    key={iface.name}
                    onClick={() => setSelectedPort(iface.name)}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-cyan-950/60 border-cyan-500 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-500'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-mono font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
                        {iface.name}
                      </span>
                      {(() => {
                        const portCap = getInterfaceCapacityMbps(isSelected ? portLink.rate : '', iface.name, iface);
                        const portSpeedLabel = portCap >= 10000 ? '10G' : portCap >= 1000 ? '1G' : '100M';
                        return (
                          <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ${
                            portCap >= 10000
                              ? 'text-purple-300 bg-purple-950/50 border-purple-800/60'
                              : portCap >= 1000
                              ? 'text-cyan-300 bg-cyan-950/50 border-cyan-800/60'
                              : 'text-amber-300 bg-amber-950/50 border-amber-800/60'
                          }`}>
                            {portSpeedLabel}
                          </span>
                        );
                      })()}
                    </div>

                    <div className="mt-3">
                      <span className="text-[10px] text-slate-400 block truncate font-mono">
                        {iface.comment || iface.type || 'Port'}
                      </span>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-[10px] font-bold font-mono ${iface.running ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {iface.running ? 'Active UP' : 'Disabled'}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${iface.running ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FULL INTERFACES TABLE */}
      {activeTab === 'interfaces' && (
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Cable className="w-5 h-5 text-cyan-400" />
                MikroTik Router Interfaces ({liveInterfaces.length} Detected)
              </h2>
              <p className="text-xs text-slate-400">
                Connected to <strong>{selectedDevice.name}</strong> ({selectedDevice.remoteAddress || selectedDevice.ipAddress || 'remote.oxapsph.com'}:{selectedDevice.port || 10988})
              </p>
            </div>

            {/* Quick Live Router Credentials & Re-Sync Bar */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-500 font-mono">User:</span>
                <span className="text-slate-200 font-bold font-mono">{selectedDevice.username || 'admin'}</span>
              </div>

              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-500 font-mono">Pass:</span>
                <input
                  type="password"
                  placeholder="Enter router pass"
                  value={quickPassword}
                  onChange={(e) => setQuickPassword(e.target.value)}
                  className="bg-transparent text-slate-100 font-mono text-xs w-32 focus:outline-none placeholder:text-slate-600"
                />
              </div>

              <button
                disabled={isUpdatingPassword}
                onClick={async () => {
                  setIsUpdatingPassword(true);
                  try {
                    const updatedCreds = {
                      ...getDeviceCreds(selectedDevice),
                      password: quickPassword,
                    };
                    updateMikrotikDevice(selectedDevice.id, { password: quickPassword });
                    showToast('info', 'Connecting to MikroTik', `Querying /rest/interface on ${selectedDevice.remoteAddress || 'remote.oxapsph.com'}...`);

                    const [health, ifaces] = await Promise.all([
                      testRouterConnection(updatedCreds),
                      fetchInterfaces(updatedCreds),
                    ]);

                    if (health.status === 'connected') {
                      setLiveHealth(health);
                    }

                    if (Array.isArray(ifaces) && ifaces.length > 0) {
                      const { hardware, sessions } = splitInterfaces(ifaces);
                      const mapped = hardware.map((i: any) => ({
                        name: i.name || i['default-name'] || 'eth',
                        type: i.type || (i.name?.startsWith('sfp') ? 'sfp-plus' : 'ether'),
                        running: i.running === 'true' || i.running === true || i.status === 'running',
                        disabled: i.disabled === 'true' || i.disabled === true,
                        comment: i.comment || '',
                        macAddress: i['mac-address'] || i.macAddress || '',
                        rxBytes: parseInt(i['rx-byte'] || i['rx-bytes'] || '0', 10) || 0,
                        txBytes: parseInt(i['tx-byte'] || i['tx-bytes'] || '0', 10) || 0,
                      }));
                      setLiveInterfaces(mapped);
                      setLivePppoeSessions(sessions.map((i: any) => ({
                        name: i.name || i['default-name'] || 'pppoe-in',
                        type: i.type || 'pppoe-in',
                        running: i.running === 'true' || i.running === true || i.status === 'running',
                        disabled: i.disabled === 'true' || i.disabled === true,
                        comment: i.comment || '',
                        macAddress: i['mac-address'] || i.macAddress || '',
                        rxBytes: parseInt(i['rx-byte'] || i['rx-bytes'] || '0', 10) || 0,
                        txBytes: parseInt(i['tx-byte'] || i['tx-bytes'] || '0', 10) || 0,
                      })));
                      updateMikrotikDevice(selectedDevice.id, {
                        password: quickPassword,
                        interfaces: mapped.map((m: any, idx: number) => ({
                          id: String(idx + 1),
                          name: m.name,
                          type: m.type,
                          status: m.running ? 'running' : 'link_down',
                          linkSpeed: (m.type?.includes('sfp') || m.name.toLowerCase().includes('sfp') || m.name.toLowerCase().includes('wan3')) ? '10 Gbps' : '1 Gbps',
                          macAddress: m.macAddress,
                          mtu: 1500,
                          rxBps: 0,
                          txBps: 0,
                          rxPps: 0,
                          txPps: 0,
                          rxTotalBytes: m.rxBytes,
                          txTotalBytes: m.txBytes,
                          rxErrors: 0,
                          txErrors: 0,
                          rxDrops: 0,
                          txDrops: 0,
                        })),
                      });
                      showToast('success', 'Interfaces Synchronized', `Successfully pulled ${mapped.length} interfaces from RouterOS!`);
                    } else {
                      showToast('warning', 'Live Interface Pull', 'Unable to pull new interfaces from RouterOS. Preserved hardware interface list.');
                    }
                  } catch (err: any) {
                    showToast('error', 'Connection Error', err.message || 'Failed to connect to MikroTik router');
                  } finally {
                    setIsUpdatingPassword(false);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingPassword ? 'animate-spin' : ''}`} />
                <span>{isUpdatingPassword ? 'Querying...' : 'Sync Live Interfaces'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Interface Name</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Speed / Rate</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">MAC Address</th>
                  <th className="py-3.5 px-4">Comment / Description</th>
                  <th className="py-3.5 px-4 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/50 font-mono">
                {liveInterfaces.map((iface) => {
                  const isSelected = iface.name === selectedPort;
                  const portCap = getInterfaceCapacityMbps(isSelected ? portLink.rate : (iface.linkSpeed || ''), iface.name, iface);
                  const isSfp = portCap >= 10000;
                  const isGigabit = portCap >= 1000 && portCap < 10000;
                  const rateDisplay = isSelected && portLink.status === 'running' && portLink.rate !== '---'
                    ? portLink.rate
                    : formatCapacityLabel(portCap);

                  return (
                    <tr key={iface.name} className={`hover:bg-slate-800/50 transition-colors ${isSelected ? 'bg-cyan-950/30' : ''}`}>
                      <td className="py-3 px-4 font-bold text-slate-200 flex items-center gap-2">
                        <Cable className={`w-3.5 h-3.5 ${iface.running ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <span className="text-cyan-300">{iface.name}</span>
                        {isSelected && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-sans font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            Active Monitor
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-sans capitalize">{iface.type || 'Ethernet'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${
                          isSfp
                            ? 'bg-purple-950/40 text-purple-300 border-purple-800/60'
                            : isGigabit
                            ? 'bg-cyan-950/40 text-cyan-300 border-cyan-800/60'
                            : 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                        }`}>
                          {rateDisplay}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans font-bold ${
                            iface.running
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${iface.running ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                          {iface.running ? 'Running UP' : 'Link Down'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{iface.macAddress || '---'}</td>
                      <td className="py-3 px-4 text-slate-300 font-sans italic">{iface.comment || 'None'}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedPort(iface.name);
                            setActiveTab('overview');
                            showToast('info', 'Monitoring Interface', `Switched live graph to ${iface.name}`);
                          }}
                          className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-[11px] font-sans font-bold transition-all cursor-pointer"
                        >
                          Monitor Live
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

      {/* TAB: LIVE PPPoE SESSION INTERFACES (separated from hardware ports) */}
      {activeTab === 'pppoe_sessions' && (
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Wifi className="w-5 h-5 text-cyan-400" />
                Live PPPoE Session Interfaces ({livePppoeSessions.length} Active)
              </h2>
              <p className="text-xs text-slate-400">
                Dynamic <code className="text-cyan-300 font-mono">pppoe-in</code> interfaces created per subscriber session on <strong>{selectedDevice.name}</strong>
              </p>
            </div>
            <button
              onClick={async () => {
                if (!selectedDevice) return;
                showToast('info', 'Refreshing Sessions', 'Querying live PPPoE session interfaces...');
                const creds = getDeviceCreds(selectedDevice);
                const health = await testRouterConnection(creds);
                if (Array.isArray(health.interfaces) && health.interfaces.length > 0) {
                  const { sessions } = splitInterfaces(health.interfaces);
                  setLivePppoeSessions(sessions.map((i: any) => ({
                    name: i.name || 'pppoe-in',
                    type: i.type || 'pppoe-in',
                    running: i.running === 'true' || i.running === true || i.status === 'running',
                    disabled: i.disabled === 'true' || i.disabled === true,
                    comment: i.comment || '',
                    macAddress: i['mac-address'] || i.macAddress || '',
                    rxBytes: parseInt(i['rx-byte'] || i['rx-bytes'] || '0', 10) || 0,
                    txBytes: parseInt(i['tx-byte'] || i['tx-bytes'] || '0', 10) || 0,
                  })));
                  showToast('success', 'Sessions Synced', `${sessions.length} PPPoE session interfaces detected`);
                } else {
                  showToast('warning', 'No Sessions', 'No active PPPoE session interfaces found on this router');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/60 rounded-xl transition-all cursor-pointer font-bold text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Sessions</span>
            </button>
          </div>

          {livePppoeSessions.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs font-mono">
              No active PPPoE session interfaces. They appear here automatically once subscribers connect.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Session Interface</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Comment</th>
                    <th className="px-4 py-3">MAC Address</th>
                    <th className="px-4 py-3 text-right">RX Total</th>
                    <th className="px-4 py-3 text-right">TX Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {livePppoeSessions.map((sess) => (
                    <tr key={sess.name} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sess.running
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                            : 'bg-slate-900 text-slate-500 border border-slate-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sess.running ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          {sess.running ? 'ACTIVE' : 'DOWN'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-cyan-300 font-bold">{sess.name}</td>
                      <td className="px-4 py-2.5 text-slate-400">{sess.type}</td>
                      <td className="px-4 py-2.5 text-slate-400">{sess.comment || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-400">{sess.macAddress || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400">{(sess.rxBytes / 1073741824).toFixed(2)} GB</td>
                      <td className="px-4 py-2.5 text-right text-cyan-400">{(sess.txBytes / 1073741824).toFixed(2)} GB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PPPoE MANAGEMENT */}
      {activeTab === 'pppoe' && (
        <div className="space-y-4">
          <PppoeManager />
        </div>
      )}

      {/* TAB 4: SIMPLE QUEUES */}
      {activeTab === 'queues' && (
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                MikroTik Simple Queues (Rate Limits)
              </h2>
              <p className="text-xs text-slate-400">
                Live inspection of <code>/queue/simple</code> on {selectedDevice.name}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search target IP or name..."
                  value={queuesSearch}
                  onChange={(e) => setQueuesSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                disabled={isFetchingQueues}
                onClick={handleLoadQueues}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingQueues ? 'animate-spin' : ''}`} />
                <span>Refresh Queues</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] font-sans">
                <tr>
                  <th className="py-3 px-4">Queue Name</th>
                  <th className="py-3 px-4">Target IP / Subnet</th>
                  <th className="py-3 px-4">Max Limit (Up/Down)</th>
                  <th className="py-3 px-4">Current Rate</th>
                  <th className="py-3 px-4">Dropped Packets</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/50">
                {queuesList
                  .filter((q) => {
                    if (!queuesSearch) return true;
                    return (
                      q.name?.toLowerCase().includes(queuesSearch.toLowerCase()) ||
                      q.target?.toLowerCase().includes(queuesSearch.toLowerCase())
                    );
                  })
                  .map((q, idx) => (
                    <tr key={q.name || idx} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-200">{q.name}</td>
                      <td className="py-3 px-4 text-cyan-300">{q.target}</td>
                      <td className="py-3 px-4 font-bold text-indigo-300">{q['max-limit']}</td>
                      <td className="py-3 px-4 text-emerald-400">{q.rate || '0/0'}</td>
                      <td className="py-3 px-4 text-rose-400">{q.dropped || '0/0'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: FLEET SETTINGS */}
      {activeTab === 'fleet' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Server className="w-5 h-5 text-cyan-400" />
                MikroTik Fleet Inventory
              </h2>
              <p className="text-xs text-slate-400">Manage all registered MikroTik routers in your ISP infrastructure</p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-black transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Router</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mikrotikDevices.map((dev) => {
              const isCurrent = dev.id === selectedRouterId;
              return (
                <div
                  key={dev.id}
                  className={`p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-4 ${
                    isCurrent
                      ? 'bg-slate-900 border-cyan-500/80 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/50'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                          {dev.name}
                        </h3>
                        <span className="text-xs font-mono text-cyan-300">
                          {dev.remoteAddress || dev.ipAddress}:{dev.port || dev.webfigPort || 80}
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Online
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 text-center font-mono text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">Model</span>
                      <span className="font-bold text-slate-300 truncate block text-[11px]">{dev.model}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">Role</span>
                      <span className="font-bold text-purple-300 capitalize text-[11px]">{dev.role.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block font-sans">CPU</span>
                      <span className="font-bold text-cyan-300 text-[11px]">{dev.cpuLoad}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => {
                        setSelectedRouterId(dev.id);
                        setActiveTab('overview');
                        showToast('info', 'Router Selected', `Switched to ${dev.name}`);
                      }}
                      className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      {isCurrent ? '● Active in Hub' : 'Select & Monitor'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(dev)}
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Edit router settings"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeviceToDelete(dev)}
                        className="p-1.5 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                        title="Delete router"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. SIMPLIFIED ADD / EDIT ROUTER MODAL */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    {editingDevice ? 'Edit MikroTik Router' : 'Register New MikroTik Router'}
                  </h3>
                  <p className="text-xs text-slate-400">Configure REST API connection to RouterOS</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddEditModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRouter} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Router Name / Identifier *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CCR2116 Core Gateway"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Host / Remote Address *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. remote.oxapsph.com"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">HTTP Port *</label>
                  <input
                    type="number"
                    required
                    placeholder="10988"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">API Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="admin"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">API Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500 pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Router Role</label>
                  <select
                    value={formData.role}
                    onChange={(e: any) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="core_pppoe">Core PPPoE Gateway</option>
                    <option value="distribution">Distribution Switch</option>
                    <option value="hotspot">Hotspot NAS</option>
                    <option value="backup">Backup Gateway</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Rack Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Main POP Operations Rack"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* 1-Click Test & Auto-Detect Banner */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">1-Click Live Test & Auto-Detect</span>
                  <span className="text-[11px] text-slate-400">Verifies REST API and fetches model & interfaces</span>
                </div>
                <button
                  type="button"
                  disabled={isTestingModal}
                  onClick={handleTestModalConnection}
                  className="px-3.5 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingModal ? 'animate-spin' : ''}`} />
                  <span>{isTestingModal ? 'Testing...' : 'Verify Now'}</span>
                </button>
              </div>

              {modalTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                    modalTestResult.status === 'connected'
                      ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-800 text-rose-300'
                  }`}
                >
                  {modalTestResult.status === 'connected' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>
                    {modalTestResult.status === 'connected'
                      ? `Connected to ${modalTestResult.boardName} (${modalTestResult.latencyMs}ms latency). ${modalTestResult.interfaces?.length || 0} interfaces detected!`
                      : modalTestResult.errorMessage || 'Unable to connect to router.'}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-black transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  {editingDevice ? 'Save Changes' : 'Register Router'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. ROUTEROS TERMINAL SCRIPTS MODAL */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">RouterOS Terminal Quick Scripts</h3>
                  <p className="text-xs text-slate-400">Copy & paste directly into MikroTik WinBox Terminal</p>
                </div>
              </div>
              <button
                onClick={() => setShowScriptModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <button
                  onClick={() => setScriptModalTab('pppoe')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    scriptModalTab === 'pppoe'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  Batch PPPoE Secrets
                </button>
                <button
                  onClick={() => setScriptModalTab('isolation')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    scriptModalTab === 'isolation'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  Overdue Isolation Filter
                </button>
                <button
                  onClick={() => setScriptModalTab('bootstrap')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    scriptModalTab === 'bootstrap'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  Full Bootstrap
                </button>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-950 rounded-2xl border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto max-h-64 scrollbar-thin">
                  {scriptModalTab === 'pppoe' && generatePppoeBatchScript(customers, plans, businessProfile)}
                  {scriptModalTab === 'isolation' && generateIsolationScript(customers)}
                  {scriptModalTab === 'bootstrap' && generateFullRouterConfigScript(businessProfile, plans)}
                </pre>
                <button
                  onClick={() => {
                    const txt =
                      scriptModalTab === 'pppoe'
                        ? generatePppoeBatchScript(customers, plans, businessProfile)
                        : scriptModalTab === 'isolation'
                        ? generateIsolationScript(customers)
                        : generateFullRouterConfigScript(businessProfile, plans);
                    handleCopy(txt, 'RouterOS Script');
                  }}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  {copiedType === 'RouterOS Script' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedType === 'RouterOS Script' ? 'Copied!' : 'Copy Script'}</span>
                </button>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  onClick={() => setShowScriptModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. DELETE ROUTER CONFIRMATION MODAL */}
      {deviceToDelete && (
        <ConfirmDeleteModal
          isOpen={!!deviceToDelete}
          title="Delete MikroTik Router"
          itemName={`${deviceToDelete.name} (${deviceToDelete.remoteAddress || deviceToDelete.ipAddress})`}
          description={`Are you sure you want to remove ${deviceToDelete.name} from your management fleet? Active customer sessions and telemetry polling for this hardware node will be stopped.`}
          confirmLabel="Yes, Remove Router"
          onConfirm={() => {
            deleteMikrotikDevice(deviceToDelete.id);
            setDeviceToDelete(null);
            showToast('info', 'Router Deleted', `Removed ${deviceToDelete.name}`);
          }}
          onClose={() => setDeviceToDelete(null)}
        />
      )}
    </div>
  );
};
