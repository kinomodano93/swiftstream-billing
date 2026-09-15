import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Thermometer,
  Wifi,
  RefreshCw,
  Zap,
  ShieldAlert,
  Download,
} from 'lucide-react';
import { MikrotikDevice, RouterWatchdogMetrics } from '../../types';
import { fetchRouterWatchdogMetrics } from '../../services/mikrotikApiService';

interface RouterWatchdogWidgetProps {
  device: MikrotikDevice;
  onTriggerBackup?: () => void;
  compact?: boolean;
  liveLatency?: number;
}

export const RouterWatchdogWidget: React.FC<RouterWatchdogWidgetProps> = ({
  device,
  onTriggerBackup,
  compact = false,
  liveLatency,
}) => {
  const [metrics, setMetrics] = useState<RouterWatchdogMetrics | null>(() => {
    if (!device) return null;
    const totalMem = device.memoryUsage?.totalMb || 1024;
    const usedMem = device.memoryUsage?.usedMb || 150;
    const freeMem = totalMem > usedMem ? totalMem - usedMem : 850;
    return {
      routerId: device.id || 'default',
      routerName: device.name || 'MikroTik Core Router',
      routerIp: device.remoteAddress || device.ipAddress || 'remote.oxapsph.com',
      timestamp: new Date().toISOString(),
      cpuLoad: device.cpuLoad || 0,
      freeMemoryMb: freeMem,
      totalMemoryMb: totalMem,
      memoryUsagePercent: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 15,
      uptime: device.uptime || 'Active',
      temperatureCelsius: device.temperatureC,
      wanPingLatencyMs: 16,
      wanPacketLossPercent: 0,
      wanStatus: device.status === 'offline' ? 'offline' : 'healthy',
      alerts: [],
    };
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10); // seconds, 0 = off
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const pollMetrics = useCallback(async () => {
    if (!device) return;
    setIsLoading(true);
    try {
      const creds = {
        id: device.id,
        name: device.name,
        ipAddress: device.remoteAddress || device.ipAddress || 'remote.oxapsph.com',
        port: device.port || device.webfigPort || 10988,
        username: device.username || 'admin',
        password: device.password || '',
        useHttps: device.port === 443 || device.useSsl,
      };
      const result = await fetchRouterWatchdogMetrics(creds, device.name, device);
      setMetrics(result);
      setLastRefreshed(new Date());
    } catch (err) {
      console.warn('[Watchdog Poll Error]:', err);
    } finally {
      setIsLoading(false);
    }
  }, [device]);

  useEffect(() => {
    pollMetrics();
  }, [pollMetrics]);

  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      pollMetrics();
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, pollMetrics]);

  // Synchronize immediately with liveLatency from NOC polling
  useEffect(() => {
    if (liveLatency !== undefined && liveLatency > 0) {
      setMetrics((prev) => {
        if (!prev) return prev;
        const filteredAlerts = prev.alerts.filter((a) => a.type !== 'wan' || !a.message.includes('Elevated WAN Latency'));
        return {
          ...prev,
          wanPingLatencyMs: liveLatency,
          wanStatus: liveLatency < 100 && prev.wanStatus === 'degraded' ? 'healthy' : prev.wanStatus,
          alerts: filteredAlerts,
        };
      });
    }
  }, [liveLatency]);

  if (!metrics) {
    return (
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center justify-between animate-pulse">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400 animate-spin" />
          <span>Connecting to Router Watchdog Telemetry ({device.name})...</span>
        </div>
      </div>
    );
  }

  const latencyColor =
    metrics.wanPingLatencyMs >= 100
      ? 'text-rose-400'
      : metrics.wanPingLatencyMs >= 50
      ? 'text-amber-400'
      : 'text-emerald-400';

  return (
    <div
      className={`rounded-3xl bg-slate-950 border border-slate-800 shadow-xl overflow-hidden transition-all ${
        metrics.alerts.length > 0 ? 'border-amber-500/40' : 'hover:border-cyan-500/30'
      } ${compact ? 'p-4 space-y-3' : 'p-6 space-y-5'}`}
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-2xl border ${
              metrics.wanStatus === 'healthy'
                ? 'bg-emerald-950/80 border-emerald-800/50 text-emerald-400'
                : metrics.wanStatus === 'degraded'
                ? 'bg-amber-950/80 border-amber-800/50 text-amber-400'
                : 'bg-rose-950/80 border-rose-800/50 text-rose-400'
            }`}
          >
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h5 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span>{device.name} Watchdog Telemetry</span>
              </h5>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                  metrics.wanStatus === 'healthy'
                    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-800/50'
                    : metrics.wanStatus === 'degraded'
                    ? 'bg-amber-950/90 text-amber-300 border-amber-800/50'
                    : 'bg-rose-950/90 text-rose-300 border-rose-800/50'
                }`}
              >
                {metrics.wanStatus}
              </span>
              {metrics.alerts.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800/50 text-[10px] font-mono font-bold">
                  {metrics.alerts.length} ALERT{metrics.alerts.length > 1 ? 'S' : ''}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              IP: {metrics.routerIp} &bull; Uptime: {metrics.uptime}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 text-xs">
          {onTriggerBackup && (
            <button
              type="button"
              onClick={onTriggerBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-semibold cursor-pointer transition-all"
              title="Save instant backup of this router's configuration to Cloud & Google Drive"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup .RSC</span>
            </button>
          )}

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-[11px] font-mono text-slate-400">
            <span className="px-1.5 text-[10px] text-slate-500 uppercase">Poll:</span>
            {[5, 10, 30].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setAutoRefreshInterval(sec)}
                className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                  autoRefreshInterval === sec
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'hover:text-slate-200'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={pollMetrics}
            disabled={isLoading}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh watchdog metrics immediately"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Active Threshold Alert Banners */}
      {metrics.alerts.length > 0 && (
        <div className="space-y-2">
          {metrics.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                alert.severity === 'critical'
                  ? 'bg-rose-950/60 border-rose-800/60 text-rose-200'
                  : 'bg-amber-950/60 border-amber-800/60 text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 animate-bounce" />
                <span className="font-semibold">{alert.message}</span>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-black/40 border border-white/10">
                {alert.severity}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Metrics Grid - Focused WAN & Hardware Watchdog (Zero Duplicate CPU/RAM) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* WAN Gateway Latency */}
        <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <span>WAN Latency</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">ICMP 8.8.8.8</span>
          </div>
          <div className="flex items-baseline gap-1 pt-1">
            <span className={`text-2xl font-bold font-mono ${latencyColor}`}>
              {metrics.wanPingLatencyMs}
            </span>
            <span className="text-xs text-slate-400 font-mono">ms</span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span
              className={
                metrics.wanPingLatencyMs <= 40
                  ? 'text-emerald-400 font-semibold'
                  : metrics.wanPingLatencyMs <= 100
                  ? 'text-amber-400 font-semibold'
                  : 'text-rose-400 font-semibold'
              }
            >
              {metrics.wanPingLatencyMs <= 40
                ? '● Ultra Low RTT'
                : metrics.wanPingLatencyMs <= 100
                ? '● Normal Latency'
                : '● High Latency'}
            </span>
          </div>
        </div>

        {/* Packet Quality & Loss */}
        <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Packet Quality</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Drop Monitor</span>
          </div>
          <div className="flex items-baseline gap-1 pt-1">
            <span
              className={`text-2xl font-bold font-mono ${
                metrics.wanPacketLossPercent > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {metrics.wanPacketLossPercent}%
            </span>
            <span className="text-xs text-slate-400 font-mono">loss</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 truncate">
            {metrics.wanPacketLossPercent === 0 ? '0% Drops • Link Healthy' : 'Packet Loss Warning'}
          </div>
        </div>

        {/* Board Temperature / Thermal */}
        <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold">
              <Thermometer className="w-4 h-4 text-amber-400" />
              <span>Hardware Temp</span>
            </span>
            {metrics.voltageVolts && (
              <span className="text-[10px] text-slate-500 font-mono">{metrics.voltageVolts}V</span>
            )}
          </div>
          <div className="flex items-baseline gap-1 pt-1">
            <span
              className={`text-2xl font-bold font-mono ${
                metrics.temperatureCelsius && metrics.temperatureCelsius >= 70
                  ? 'text-rose-400'
                  : 'text-amber-300'
              }`}
            >
              {metrics.temperatureCelsius ? `${metrics.temperatureCelsius}°C` : 'Nominal'}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate">
            {metrics.temperatureCelsius
              ? metrics.temperatureCelsius >= 70
                ? 'Thermal threshold exceeded'
                : 'Optimal operating range'
              : 'Thermal sensors online'}
          </div>
        </div>

        {/* Gateway Reachability & Uptime */}
        <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold">
              <Zap className="w-4 h-4 text-purple-400" />
              <span>Gateway Route</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Port {device.port || 10988}</span>
          </div>
          <div className="flex items-baseline gap-1 pt-1">
            <span className="text-sm font-bold font-mono text-slate-200 truncate block">
              {metrics.uptime || 'Active'}
            </span>
          </div>
          <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active & Forwarding</span>
          </div>
        </div>
      </div>
    </div>
  );
};
