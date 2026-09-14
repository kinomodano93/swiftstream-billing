import React, { useState, useEffect } from 'react';
import {
  Activity,
  Wifi,
  AlertTriangle,
  CheckCircle2,
  Play,
  RefreshCw,
  Copy,
  Check,
  X,
  Server,
  Terminal,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { Customer, MikrotikDevice, PingSummary, TracerouteSummary } from '../../types';
import {
  pingSubscriberHost,
  tracerouteSubscriberHost,
  MikrotikCredentials,
} from '../../services/mikrotikApiService';

interface SubscriberDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  device?: MikrotikDevice;
}

export const SubscriberDiagnosticsModal: React.FC<SubscriberDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  customer,
  device,
}) => {
  const [activeTab, setActiveTab] = useState<'ping' | 'traceroute'>('ping');
  const [targetIp, setTargetIp] = useState<string>(
    customer.network?.ipAddress || '192.168.10.100'
  );
  const [pingCount, setPingCount] = useState<number>(4);
  const [isRunningPing, setIsRunningPing] = useState<boolean>(false);
  const [pingResult, setPingResult] = useState<PingSummary | null>(null);

  const [isRunningTrace, setIsRunningTrace] = useState<boolean>(false);
  const [traceResult, setTraceResult] = useState<TracerouteSummary | null>(null);

  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Derive credentials from device or default
  const creds: MikrotikCredentials = {
    id: device?.id,
    name: device?.name || 'MikroTik Core Router',
    ipAddress: device?.remoteAddress || device?.ipAddress || 'remote.oxapsph.com',
    port: device?.port || device?.webfigPort || 10988,
    username: device?.username || 'admin',
    password: device?.password || '',
    useHttps: device?.useSsl || false,
  };

  const runPing = async (target = targetIp, count = pingCount) => {
    setIsRunningPing(true);
    try {
      const summary = await pingSubscriberHost(creds, target, count);
      setPingResult(summary);
    } catch (err) {
      console.warn('Ping error:', err);
    } finally {
      setIsRunningPing(false);
    }
  };

  const runTraceroute = async (target = targetIp) => {
    setIsRunningTrace(true);
    try {
      const summary = await tracerouteSubscriberHost(creds, target);
      setTraceResult(summary);
    } catch (err) {
      console.warn('Traceroute error:', err);
    } finally {
      setIsRunningTrace(false);
    }
  };

  // Run initial ping when opening
  useEffect(() => {
    if (isOpen && targetIp) {
      runPing(targetIp, pingCount);
    }
  }, [isOpen]);

  const handleCopyReport = () => {
    let report = `=== SWIFTSTREAM TELECOM FIBER SUBSCRIBER LINE DIAGNOSTICS ===\n`;
    report += `Timestamp: ${new Date().toLocaleString()}\n`;
    report += `Subscriber: ${customer.fullName} (${customer.accountNo})\n`;
    report += `PPPoE Username: ${customer.network?.pppoeUsername || 'N/A'}\n`;
    report += `Assigned IP: ${targetIp}\n`;
    report += `Router Node: ${creds.name} (${creds.ipAddress}:${creds.port})\n\n`;

    if (pingResult) {
      report += `--- ICMP PING TEST (Target: ${pingResult.host}) ---\n`;
      report += `Packets: Sent = ${pingResult.packetsTransmitted}, Received = ${pingResult.packetsReceived}, Loss = ${pingResult.packetLossPercent}%\n`;
      report += `Round-Trip Latency: Min = ${pingResult.minRttMs}ms, Avg = ${pingResult.avgRttMs}ms, Max = ${pingResult.maxRttMs}ms, Jitter = ${pingResult.jitterMs}ms\n`;
      report += `Packet Details:\n`;
      pingResult.results.forEach((r) => {
        report += `  Seq ${r.seq}: ${r.size} bytes from ${r.host} ttl=${r.ttl} time=${r.timeMs}ms status=${r.status}\n`;
      });
      report += `\n`;
    }

    if (traceResult) {
      report += `--- TRACEROUTE (Destination: ${traceResult.target}) ---\n`;
      traceResult.hops.forEach((h) => {
        report += `  Hop ${h.hop}: ${h.address} [${h.avgMs}ms] ${h.status}\n`;
      });
    }

    navigator.clipboard.writeText(report);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span>1-Click Line Diagnostics</span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-950 border border-emerald-800/40 text-emerald-300 rounded-full font-mono">
                  Live ICMP & Route
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {customer.fullName} • Account #{customer.accountNo} • PPPoE: <span className="font-mono text-cyan-300">{customer.network?.pppoeUsername || 'pppoe_user'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diagnostic Control Bar */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <span className="text-slate-400 font-medium">Target Host:</span>
            <input
              type="text"
              value={targetIp}
              onChange={(e) => setTargetIp(e.target.value)}
              placeholder="e.g. 192.168.10.100"
              className="flex-1 max-w-[200px] px-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
            />
            <div className="flex items-center gap-1">
              {[4, 10, 20].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setPingCount(c);
                    if (activeTab === 'ping') runPing(targetIp, c);
                  }}
                  className={`px-2 py-1 rounded-lg font-mono text-[11px] transition-colors ${
                    pingCount === c
                      ? 'bg-cyan-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {c} pkts
                </button>
              ))}
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => setActiveTab('ping')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                activeTab === 'ping'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ping Test
            </button>
            <button
              onClick={() => {
                setActiveTab('traceroute');
                if (!traceResult) runTraceroute(targetIp);
              }}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                activeTab === 'traceroute'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Traceroute
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {activeTab === 'ping' && (
            <div className="space-y-4">
              {/* Telemetry Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
                  <span className="text-slate-500 text-[10px] block uppercase tracking-wider font-semibold">
                    Avg Latency
                  </span>
                  <span className="text-xl font-bold font-mono text-cyan-400 mt-1 block">
                    {pingResult ? `${pingResult.avgRttMs} ms` : '--'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Min: {pingResult?.minRttMs || 0}ms • Max: {pingResult?.maxRttMs || 0}ms
                  </span>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
                  <span className="text-slate-500 text-[10px] block uppercase tracking-wider font-semibold">
                    Packet Loss
                  </span>
                  <span
                    className={`text-xl font-bold font-mono mt-1 block ${
                      (pingResult?.packetLossPercent || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {pingResult ? `${pingResult.packetLossPercent}%` : '--'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {pingResult ? `${pingResult.packetsReceived}/${pingResult.packetsTransmitted} recvd` : '0/0'}
                  </span>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
                  <span className="text-slate-500 text-[10px] block uppercase tracking-wider font-semibold">
                    Jitter (Variance)
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
                    {pingResult ? `${pingResult.jitterMs} ms` : '--'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Buffer stability</span>
                </div>

                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl">
                  <span className="text-slate-500 text-[10px] block uppercase tracking-wider font-semibold">
                    Line Quality
                  </span>
                  <span
                    className={`text-sm font-bold mt-1.5 flex items-center gap-1.5 ${
                      (pingResult?.packetLossPercent || 0) === 0 && (pingResult?.avgRttMs || 0) < 30
                        ? 'text-emerald-400'
                        : (pingResult?.packetLossPercent || 0) < 10
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {(pingResult?.packetLossPercent || 0) === 0 && (pingResult?.avgRttMs || 0) < 30 ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>EXCELLENT FIBER</span>
                      </>
                    ) : (pingResult?.packetLossPercent || 0) < 10 ? (
                      <>
                        <Activity className="w-4 h-4 shrink-0" />
                        <span>MODERATE JITTER</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>HIGH PACKET LOSS</span>
                      </>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">
                    {creds.name}
                  </span>
                </div>
              </div>

              {/* Real-time packet sequence console */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
                <div className="p-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold flex items-center gap-1.5 text-slate-300">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>ICMP Packet Sequence Output</span>
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    Source: {pingResult?.source || creds.name}
                  </span>
                </div>

                <div className="p-3 font-mono text-xs space-y-1 max-h-[220px] overflow-y-auto">
                  {pingResult?.results.map((item) => (
                    <div
                      key={item.seq}
                      className={`flex items-center justify-between py-1 px-2 rounded-lg ${
                        item.status === 'ok'
                          ? 'bg-emerald-950/20 text-slate-300'
                          : 'bg-rose-950/30 text-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-[11px]">SEQ #{item.seq}</span>
                        <span>
                          {item.size} bytes from <span className="text-cyan-300">{item.host}</span>
                        </span>
                        {item.status === 'ok' && (
                          <span className="text-slate-500 text-[11px]">ttl={item.ttl}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === 'ok' ? (
                          <span className="text-emerald-400 font-bold">{item.timeMs} ms</span>
                        ) : (
                          <span className="text-rose-400 font-bold">Request Timed Out</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {isRunningPing && (
                    <div className="flex items-center gap-2 text-cyan-400 py-1 px-2 animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Transmitting ICMP echo probe to {targetIp}...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'traceroute' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-slate-400 font-semibold block">Destination Route Path</span>
                  <span className="font-mono text-cyan-400 text-xs">
                    {creds.name} → Core Gateway → OLT PON Node → {targetIp}
                  </span>
                </div>
                <button
                  onClick={() => runTraceroute(targetIp)}
                  disabled={isRunningTrace}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRunningTrace ? 'animate-spin' : ''}`} />
                  <span>{isRunningTrace ? 'Tracing...' : 'Run Trace'}</span>
                </button>
              </div>

              {/* Traceroute Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-950/80 p-3 text-[11px] font-semibold text-slate-400 border-b border-slate-800">
                  <span className="col-span-2">HOP</span>
                  <span className="col-span-6">ROUTER / INTERFACE HOST</span>
                  <span className="col-span-2">LATENCY</span>
                  <span className="col-span-2 text-right">STATUS</span>
                </div>

                <div className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {traceResult?.hops.map((h) => (
                    <div key={h.hop} className="grid grid-cols-12 p-3 items-center text-xs">
                      <div className="col-span-2 font-mono text-slate-400 font-bold">
                        #{h.hop}
                      </div>
                      <div className="col-span-6 font-mono text-slate-200">
                        {h.address}
                      </div>
                      <div className="col-span-2 font-mono text-cyan-400 font-bold">
                        {h.avgMs} ms
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-medium">
                          {h.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={handleCopyReport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{isCopied ? 'Report Copied!' : 'Copy Diagnostic Report'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeTab === 'ping') runPing(targetIp, pingCount);
                else runTraceroute(targetIp);
              }}
              disabled={isRunningPing || isRunningTrace}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRunningPing || isRunningTrace ? 'animate-spin' : ''}`} />
              <span>{activeTab === 'ping' ? 'Re-Run Ping' : 'Re-Run Trace'}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

