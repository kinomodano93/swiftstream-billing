import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Zap,
  Radio,
  Server,
  Cpu,
  HardDrive,
  Clock,
  Thermometer,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Maximize2,
  Minimize2,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Gauge,
  Layers,
  ArrowDownCircle,
  ArrowUpCircle,
  Wifi,
  Globe,
  Bell,
  HeartPulse,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { MikrotikDevice, NetworkInterfaceTraffic, SfpOpticalDiagnostics } from '../../types';

interface MikrotikTelemetryViewerProps {
  selectedDeviceId?: string;
  onSelectDevice?: (deviceId: string) => void;
}

export const MikrotikTelemetryViewer: React.FC<MikrotikTelemetryViewerProps> = ({
  selectedDeviceId,
  onSelectDevice,
}) => {
  const { mikrotikDevices, updateMikrotikDevice } = useApp();

  const [activeDeviceId, setActiveDeviceId] = useState<string>(
    selectedDeviceId || mikrotikDevices[0]?.id || 'mtk-core-01'
  );
  const [isLivePolling, setIsLivePolling] = useState<boolean>(true);
  const [pollingTick, setPollingTick] = useState<number>(0);

  const device = mikrotikDevices.find((d) => d.id === activeDeviceId) || mikrotikDevices[0];

  // Sync prop changes
  useEffect(() => {
    if (selectedDeviceId && selectedDeviceId !== activeDeviceId) {
      setActiveDeviceId(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  // Live polling jitter simulation
  useEffect(() => {
    if (!isLivePolling || !device) return;

    const interval = setInterval(() => {
      setPollingTick((prev) => prev + 1);
    }, 2500);

    return () => clearInterval(interval);
  }, [isLivePolling, device]);

  // Dynamically computed live telemetry based on polling tick
  const liveTelemetry = useMemo(() => {
    if (!device) return null;

    // Small jitter calculation
    const jitterFactor = Math.sin(pollingTick * 0.8) * 0.05;
    const baseCpu = device.cpuLoad;
    const currentCpu = Math.min(Math.max(Math.round(baseCpu * (1 + jitterFactor * 2)), 1), 99);

    const wan = device.wanCongestion || {
      status: 'normal',
      queueUsagePercent: 64,
      packetDropRate: 0.01,
      bufferbloatGrade: 'A+',
      ispGatewayLatencyMs: 7.8,
      jitterMs: 1.1,
      activeQueuesCount: 18,
      bandwidthCapacityMbps: 1000,
      currentThroughputMbps: { rx: 642.5, tx: 184.2 },
    };

    const liveRxMbps = Number((wan.currentThroughputMbps.rx * (1 + jitterFactor)).toFixed(1));
    const liveTxMbps = Number((wan.currentThroughputMbps.tx * (1 + jitterFactor * 1.5)).toFixed(1));
    const livePingMs = Number((wan.ispGatewayLatencyMs + Math.sin(pollingTick) * 0.6).toFixed(1));

    // Dynamic Traffic history stream
    const history = device.trafficHistory || [
      { timestamp: '16:20', rxMbps: 540.2, txMbps: 142.1 },
      { timestamp: '16:22', rxMbps: 582.4, txMbps: 156.8 },
      { timestamp: '16:24', rxMbps: 610.1, txMbps: 168.4 },
      { timestamp: '16:26', rxMbps: 595.7, txMbps: 162.3 },
      { timestamp: '16:28', rxMbps: 638.9, txMbps: 179.5 },
      { timestamp: '16:30', rxMbps: liveRxMbps, txMbps: liveTxMbps },
    ];

    return {
      currentCpu,
      wan: {
        ...wan,
        currentThroughputMbps: { rx: liveRxMbps, tx: liveTxMbps },
        ispGatewayLatencyMs: livePingMs,
      },
      history,
    };
  }, [device, pollingTick]);

  if (!device || !liveTelemetry) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-900 rounded-3xl border border-slate-800">
        No MikroTik device found for telemetry telemetry inspection.
      </div>
    );
  }

  const sfpModules = device.sfpDiagnostics || [];
  const interfaces = device.interfaces || [];
  const watchdog = device.watchdog || {
    hardwareWatchdogEnabled: true,
    hardwareWatchdogTimerSec: 60,
    heartbeatPingWatchdog: {
      enabled: true,
      targetIp: '8.8.8.8',
      intervalSec: 10,
      failCount: 0,
      maxFailsBeforeReboot: 6,
      lastPingStatus: 'success',
      lastPingLatencyMs: 11.2,
    },
    cpuCores: [
      { core: 1, load: 8, frequencyMhz: 1700 },
      { core: 2, load: 6, frequencyMhz: 1700 },
      { core: 3, load: 9, frequencyMhz: 1700 },
      { core: 4, load: 5, frequencyMhz: 1700 },
    ],
    boardVoltageV: 24.2,
    boardTemperatureC: 38.5,
    fanSpeedRpm: 4200,
  };

  if (!device || !liveTelemetry) {
    return (
      <div className="p-12 text-center rounded-3xl bg-slate-900/50 border border-slate-800 border-dashed space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-cyan-600/10 border border-cyan-500/20 text-cyan-400 mx-auto flex items-center justify-center">
          <Server className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h4 className="text-base font-bold text-slate-200">No Router Configured for Telemetry</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Please add your MikroTik RouterOS device in the Router Fleet tab to view live CPU, memory, and bandwidth telemetry.
          </p>
        </div>
      </div>
    );
  }

  const queuePct = liveTelemetry.wan.queueUsagePercent;
  const queueColor = queuePct > 85 ? 'text-rose-400' : queuePct > 70 ? 'text-amber-400' : 'text-emerald-400';
  const queueBarColor = queuePct > 85 ? 'bg-rose-500' : queuePct > 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="space-y-6">
      {/* Device Selector & Live Polling Switch Bar */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-950 border border-cyan-800/60 text-cyan-400">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <select
                value={activeDeviceId}
                onChange={(e) => {
                  setActiveDeviceId(e.target.value);
                  if (onSelectDevice) onSelectDevice(e.target.value);
                }}
                className="bg-slate-950 border border-slate-700 text-slate-100 font-bold text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                {mikrotikDevices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.model}) — {d.ipAddress}
                  </option>
                ))}
              </select>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800/50 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {device.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {device.location} • {device.rosVersion}
            </p>
          </div>
        </div>

        {/* Right Action: Live Polling Switch & Refresh Button */}
        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={() => setIsLivePolling(!isLivePolling)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold border transition-all ${
              isLivePolling
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-glow-emerald'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLivePolling ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
            <span>{isLivePolling ? 'Live Telemetry Active (2.5s)' : 'Polling Paused'}</span>
          </button>

          <button
            onClick={() => setPollingTick((prev) => prev + 1)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
            title="Force Query RouterOS Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isLivePolling ? 'animate-spin-slow' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Health Telemetry Gauges Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        {/* CPU Load */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-slate-400 text-[11px] flex items-center justify-between">
            <span>CPU Utilization</span>
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          </span>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-slate-100">{liveTelemetry.currentCpu}%</span>
            <div className="h-1.5 w-full bg-slate-950 rounded-full mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  liveTelemetry.currentCpu > 75 ? 'bg-rose-500' : liveTelemetry.currentCpu > 50 ? 'bg-amber-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${liveTelemetry.currentCpu}%` }}
              />
            </div>
          </div>
        </div>

        {/* RAM Usage */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-slate-400 text-[11px] flex items-center justify-between">
            <span>Memory Pool</span>
            <HardDrive className="w-3.5 h-3.5 text-purple-400" />
          </span>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-slate-100">
              {device.memoryUsage.usedMb} <span className="text-xs text-slate-500 font-normal">/ {device.memoryUsage.totalMb} MB</span>
            </span>
            <div className="h-1.5 w-full bg-slate-950 rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${Math.round((device.memoryUsage.usedMb / device.memoryUsage.totalMb) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Board Temperature & Voltage */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-slate-400 text-[11px] flex items-center justify-between">
            <span>Board Sensors</span>
            <Thermometer className="w-3.5 h-3.5 text-amber-400" />
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg font-bold font-mono text-slate-100">{device.temperatureC}°C</span>
            <span className="font-mono text-slate-400 text-[11px]">{watchdog.boardVoltageV || 24.2} V</span>
          </div>
        </div>

        {/* Active PPPoE Sessions */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-slate-400 text-[11px] flex items-center justify-between">
            <span>Active PPPoE</span>
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
          </span>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-emerald-400">{device.activePppoeCount}</span>
            <span className="text-[10px] text-slate-500 block leading-none mt-1">Bound BNG Tunnels</span>
          </div>
        </div>

        {/* Simple Queues */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-slate-400 text-[11px] flex items-center justify-between">
            <span>Simple Queues</span>
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
          </span>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-slate-100">{device.totalQueues}</span>
            <span className="text-[10px] text-slate-500 block leading-none mt-1">Rate Shaper Trees</span>
          </div>
        </div>

        {/* System Uptime */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-slate-400 text-[11px] flex items-center justify-between">
            <span>System Uptime</span>
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
          </span>
          <div className="mt-2">
            <span className="text-xs font-bold font-mono text-slate-200 block truncate">{device.uptime}</span>
            <span className="text-[10px] text-slate-500 block leading-none mt-1">Zero Crash Resets</span>
          </div>
        </div>
      </div>

      {/* Module Row: WAN Congestion Analyzer + SFP+ Optical DDM Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module 1: ⚡ WAN Congestion & Queue Bottleneck Analyzer */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">WAN Congestion & Bufferbloat Analyzer</h3>
                <p className="text-[11px] text-slate-400">Rate limiter queue saturation and upstream ISP jitter</p>
              </div>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
              liveTelemetry.wan.status === 'normal'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                : 'bg-amber-950 text-amber-300 border border-amber-800/50'
            }`}>
              {liveTelemetry.wan.status} Load
            </span>
          </div>

          {/* Queue Capacity Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Total Queue Capacity Occupancy:</span>
              <span className={`font-mono font-bold ${queueColor}`}>{queuePct}% Saturated</span>
            </div>
            <div className="h-3 w-full bg-slate-950 rounded-full p-0.5 border border-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${queueBarColor}`}
                style={{ width: `${queuePct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 Mbps</span>
              <span>Throughput: {liveTelemetry.wan.currentThroughputMbps.rx} Mbps RX / {liveTelemetry.wan.currentThroughputMbps.tx} Mbps TX</span>
              <span>{liveTelemetry.wan.bandwidthCapacityMbps} Mbps Max</span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-3 text-xs pt-1">
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Bufferbloat Grade</span>
              <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                {liveTelemetry.wan.bufferbloatGrade}
              </span>
              <span className="text-[9px] text-slate-500">Low Latency Under Load</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Packet Drop Rate</span>
              <span className="text-xl font-bold font-mono text-slate-100 mt-1 block">
                {liveTelemetry.wan.packetDropRate}%
              </span>
              <span className="text-[9px] text-emerald-400">0.00% TCP Tail Drops</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">ISP Ping Jitter</span>
              <span className="text-xl font-bold font-mono text-cyan-400 mt-1 block">
                {liveTelemetry.wan.ispGatewayLatencyMs} <span className="text-xs text-slate-500 font-normal">ms</span>
              </span>
              <span className="text-[9px] text-slate-500">Jitter: ±{liveTelemetry.wan.jitterMs}ms</span>
            </div>
          </div>
        </div>

        {/* Module 2: 🔬 SFP+ 10G Optical DDM / DOM Transceiver Diagnostics */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-950 text-purple-400 border border-purple-800/40">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">SFP+ Optical DDM / DOM Diagnostics</h3>
                <p className="text-[11px] text-slate-400">10G Fiber transceiver laser power & optical receiver levels</p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-purple-950 text-purple-300 border border-purple-800/50">
              10GBASE-LR Optical
            </span>
          </div>

          {sfpModules.length > 0 ? (
            <div className="space-y-4">
              {sfpModules.map((sfp, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-cyan-300 block">{sfp.portName}</span>
                      <span className="text-[11px] text-slate-400">{sfp.vendorName} • {sfp.wavelengthNm}nm Single Mode</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/50 uppercase">
                      {sfp.status}
                    </span>
                  </div>

                  {/* Dual Optical Power Readings */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-bold">
                        <span>Optical RX Power</span>
                        <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-base font-bold font-mono text-emerald-400">{sfp.rxPowerDbm} dBm</span>
                        <span className="text-[10px] font-mono text-slate-500">{sfp.rxPowerMw} mW</span>
                      </div>
                      <div className="text-[9px] text-slate-500 mt-1">Optimal Range: -8 to -19 dBm</div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-bold">
                        <span>Optical TX Power</span>
                        <ArrowUpCircle className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-base font-bold font-mono text-cyan-300">{sfp.txPowerDbm} dBm</span>
                        <span className="text-[10px] font-mono text-slate-500">{sfp.txPowerMw} mW</span>
                      </div>
                      <div className="text-[9px] text-slate-500 mt-1">Laser Bias: {sfp.biasCurrentMa} mA</div>
                    </div>
                  </div>

                  {/* Transceiver Voltage & Temp */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900 font-mono">
                    <span>Module Temp: <strong className="text-slate-200">{sfp.temperatureC}°C</strong></span>
                    <span>Supply Voltage: <strong className="text-slate-200">{sfp.voltageV} V</strong></span>
                    <span className="text-emerald-400">DDM Alarms: Clear</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center text-slate-500 text-xs">
              No SFP+ optical transceiver installed in current model.
            </div>
          )}
        </div>
      </div>

      {/* Module 3: 🛡️ CPU Multi-Core & Heartbeat Ping Watchdog */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800/40">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">RouterOS Hardware Watchdog & Heartbeat Monitor</h3>
              <p className="text-[11px] text-slate-400">Kernel hang protection, gateway ICMP keepalive ping, and per-core processor loads</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800/50 flex items-center gap-1.5">
              <HeartPulse className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              Watchdog Active
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
          {/* Watchdog Timers */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="text-slate-400 font-bold block text-[11px]">Hardware Auto-Reboot Watchdog</span>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">HW Watchdog Timer:</span>
                <span className="font-mono text-emerald-400 font-bold">Enabled ({watchdog.hardwareWatchdogTimerSec}s Timeout)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Heartbeat Target:</span>
                <span className="font-mono text-cyan-300 font-bold">{watchdog.heartbeatPingWatchdog.targetIp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ping Keepalive Latency:</span>
                <span className="font-mono text-slate-200">{watchdog.heartbeatPingWatchdog.lastPingLatencyMs} ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Failed Ping Threshold:</span>
                <span className="font-mono text-emerald-400">0 / {watchdog.heartbeatPingWatchdog.maxFailsBeforeReboot} Fails</span>
              </div>
            </div>
          </div>

          {/* Per-Core CPU Load Breakdown */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 lg:col-span-2">
            <span className="text-slate-400 font-bold block text-[11px]">Per-Core ARM Processor Utilization</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {watchdog.cpuCores.map((core) => (
                <div key={core.core} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-bold">Core {core.core}</span>
                    <span className="font-mono text-cyan-400 font-bold">{core.load}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${core.load * 4}%` }} />
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono block">{core.frequencyMhz} MHz</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Module 4: 📈 Network Interface Bandwidth & Live Traffic Monitor */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/40">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Network Interface Live Bandwidth & Traffic Monitor</h3>
              <p className="text-[11px] text-slate-400">Per-interface RX/TX megabits, packets per second (PPS), byte counts & drop metrics</p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span className="text-slate-400">Total RX:</span>
              <strong className="text-cyan-300">{liveTelemetry.wan.currentThroughputMbps.rx} Mbps</strong>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
              <span className="text-slate-400">Total TX:</span>
              <strong className="text-purple-300">{liveTelemetry.wan.currentThroughputMbps.tx} Mbps</strong>
            </div>
          </div>
        </div>

        {/* Live Recharts AreaChart */}
        <div className="h-64 w-full bg-slate-950 p-3 rounded-2xl border border-slate-800">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={liveTelemetry.history} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="rxGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="txGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timestamp" stroke="#64748b" fontSize={11} fontFamily="monospace" />
              <YAxis stroke="#64748b" fontSize={11} fontFamily="monospace" unit=" Mbps" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Area type="monotone" dataKey="rxMbps" name="Download Traffic (RX Mbps)" stroke="#06b6d4" strokeWidth={2.5} fillOpacity={1} fill="url(#rxGradient)" />
              <Area type="monotone" dataKey="txMbps" name="Upload Traffic (TX Mbps)" stroke="#a855f7" strokeWidth={2.5} fillOpacity={1} fill="url(#txGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Live Interface Data Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <th className="py-3 px-4 font-semibold">Interface</th>
                <th className="py-3 px-3 font-semibold">Link Status</th>
                <th className="py-3 px-3 font-semibold">Speed</th>
                <th className="py-3 px-3 font-semibold text-right">Live RX Traffic</th>
                <th className="py-3 px-3 font-semibold text-right">Live TX Traffic</th>
                <th className="py-3 px-3 font-semibold text-right">Packets / Sec</th>
                <th className="py-3 px-3 font-semibold text-right">Total Transferred</th>
                <th className="py-3 px-4 font-semibold text-right">Drop / Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/60 font-mono">
              {interfaces.map((iface) => {
                const rxMbps = (iface.rxBps / 1000000).toFixed(1);
                const txMbps = (iface.txBps / 1000000).toFixed(1);
                const totalGb = ((iface.rxTotalBytes + iface.txTotalBytes) / (1024 * 1024 * 1024)).toFixed(1);

                return (
                  <tr key={iface.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${iface.status === 'running' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                        <div>
                          <strong className="text-slate-100 block font-sans text-xs">{iface.name}</strong>
                          <span className="text-[10px] text-slate-500">{iface.macAddress} • MTU {iface.mtu}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                        {iface.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 text-[11px]">{iface.linkSpeed}</td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-cyan-400 font-bold">{rxMbps} Mbps</span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-purple-400 font-bold">{txMbps} Mbps</span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300 text-[11px]">
                      {iface.rxPps.toLocaleString()} / {iface.txPps.toLocaleString()} pps
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300 text-[11px]">
                      {totalGb} GB
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`text-[11px] ${iface.rxDrops > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                        {iface.rxDrops + iface.txDrops} drops
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

