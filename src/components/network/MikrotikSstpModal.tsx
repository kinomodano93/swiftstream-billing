import React, { useState } from 'react';
import {
  X,
  Server,
  Download,
  Copy,
  Check,
  Terminal,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  generatePppoeBatchScript,
  generateIsolationScript,
  generateFullRouterConfigScript,
} from '../../utils/sstpService';

interface MikrotikSstpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MikrotikSstpModal: React.FC<MikrotikSstpModalProps> = ({ isOpen, onClose }) => {
  const { businessProfile, customers, plans } = useApp();
  const [activeTab, setActiveTab] = useState<'pppoe' | 'isolation' | 'bootstrap'>('pppoe');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  if (!isOpen) return null;

  const overdueCustomers = customers.filter(
    (c) => c.status === 'overdue' || c.status === 'suspended' || c.status === 'disconnected'
  );
  const activeCustomers = customers.filter((c) => c.status === 'active');

  const pppoeScript = generatePppoeBatchScript(customers, plans, businessProfile);
  const isolationScript = generateIsolationScript(customers);
  const fullRouterScript = generateFullRouterConfigScript(businessProfile, plans);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleDownloadRsc = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-2xl text-cyan-400">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-slate-100">
                  MikroTik RouterOS Script Hub
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  CORE ROUTER READY
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Generate PPPoE Secrets, Bandwidth Queues & Walled Garden Isolation Scripts
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-3 gap-2 overflow-x-auto text-xs">
          {[
            { id: 'pppoe', label: `PPPoE Secrets (${customers.length})`, icon: '🔑' },
            { id: 'isolation', label: `Walled Garden (${overdueCustomers.length} Overdue)`, icon: '🚫' },
            { id: 'bootstrap', label: 'Full Initial Config (.rsc)', icon: '⚙️' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-3 font-semibold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 text-xs">
          {/* Tab 1: PPPoE Secrets */}
          {activeTab === 'pppoe' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-slate-200 block">
                    Bulk PPPoE Secrets & Bandwidth Rate Limits
                  </span>
                  <p className="text-slate-400">
                    Provisions all {customers.length} subscribers ({activeCustomers.length} active, {overdueCustomers.length} disabled).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(pppoeScript, 'pppoe')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold"
                  >
                    {copiedType === 'pppoe' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedType === 'pppoe' ? 'Copied!' : 'Copy Script'}</span>
                  </button>

                  <button
                    onClick={() => handleDownloadRsc(pppoeScript, `swiftstream_pppoe_${Date.now()}.rsc`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .rsc</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-[380px] overflow-y-auto whitespace-pre leading-relaxed">
                {pppoeScript}
              </div>
            </div>
          )}

          {/* Tab 2: Isolation */}
          {activeTab === 'isolation' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-slate-200 block">
                    Walled Garden & Non-Payment Firewall Isolation
                  </span>
                  <p className="text-slate-400">
                    Isolates {overdueCustomers.length} overdue accounts in <code>NON_PAYMENT_ISOLATION</code> list.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(isolationScript, 'isolation')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold"
                  >
                    {copiedType === 'isolation' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedType === 'isolation' ? 'Copied!' : 'Copy Script'}</span>
                  </button>

                  <button
                    onClick={() => handleDownloadRsc(isolationScript, `swiftstream_isolation_${Date.now()}.rsc`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .rsc</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-[380px] overflow-y-auto whitespace-pre leading-relaxed">
                {isolationScript}
              </div>
            </div>
          )}

          {/* Tab 3: Bootstrap */}
          {activeTab === 'bootstrap' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-slate-200 block">
                    Full Initial Router Bootstrap Script (.rsc)
                  </span>
                  <p className="text-slate-400">
                    Full router configuration including IP Pools, PPPoE Server, WAN Masquerade NAT, and WebFig.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(fullRouterScript, 'bootstrap')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold"
                  >
                    {copiedType === 'bootstrap' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedType === 'bootstrap' ? 'Copied!' : 'Copy Script'}</span>
                  </button>

                  <button
                    onClick={() => handleDownloadRsc(fullRouterScript, `swiftstream_bootstrap_${Date.now()}.rsc`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .rsc</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-[380px] overflow-y-auto whitespace-pre leading-relaxed">
                {fullRouterScript}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
