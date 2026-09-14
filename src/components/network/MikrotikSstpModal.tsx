import React, { useState } from 'react';
import {
  X,
  Server,
  Download,
  Copy,
  Check,
  Terminal,
  Clock,
  Zap,
  ShieldAlert,
  RefreshCw,
  Sliders,
  CheckCircle2,
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
  const { businessProfile, customers, plans, triggerServerGraceAudit, updateBusinessProfile, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'pppoe' | 'isolation' | 'bootstrap'>('pppoe');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isServerAuditing, setIsServerAuditing] = useState<boolean>(false);
  const [isEditingGrace, setIsEditingGrace] = useState<boolean>(false);
  const [quickGraceDays, setQuickGraceDays] = useState<number>(businessProfile.invoiceGracePeriodDays ?? 5);
  const [quickCutoffTime, setQuickCutoffTime] = useState<string>(businessProfile.gracePeriodCutoffTime || '23:59');
  const [quickDailySchedule, setQuickDailySchedule] = useState<string>(businessProfile.dailyAuditScheduleTime || '00:00');
  const [isSavingGrace, setIsSavingGrace] = useState<boolean>(false);

  if (!isOpen) return null;

  const overdueCustomers = customers.filter(
    (c) => c.status === 'overdue' || c.status === 'suspended' || c.status === 'disconnected'
  );
  const activeCustomers = customers.filter((c) => c.status === 'active');

  const pppoeScript = generatePppoeBatchScript(customers, plans, businessProfile);
  const isolationScript = generateIsolationScript(
    customers,
    businessProfile?.portalDomain || businessProfile?.websiteUrl
  );
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
              {/* Automated Cloud Scheduler Status Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-purple-300">Automated Server Cloud Scheduler</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Active • {businessProfile.dailyAuditScheduleTime || '00:00'} Asia/Manila (PHT)
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20">
                          {businessProfile.invoiceGracePeriodDays || 5} Days Grace @ {businessProfile.gracePeriodCutoffTime || '23:59'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Server automatically evaluates overdue invoices ({businessProfile.invoiceGracePeriodDays || 5}-day grace expiring at {businessProfile.gracePeriodCutoffTime || '23:59'}), isolates non-paying ONT lines, and sends SMS notices even when no admin is logged in.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsEditingGrace(!isEditingGrace)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                        isEditingGrace
                          ? 'bg-purple-900/60 border-purple-400 text-purple-200'
                          : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
                      }`}
                      title="Quick edit grace days, cut-off hour, and cron schedule"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>{isEditingGrace ? 'Close Policy' : 'Edit Policy'}</span>
                    </button>

                    <button
                      onClick={async () => {
                        setIsServerAuditing(true);
                        try {
                          await triggerServerGraceAudit();
                        } finally {
                          setIsServerAuditing(false);
                        }
                      }}
                      disabled={isServerAuditing}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all hover:scale-105 shrink-0 disabled:opacity-50"
                      title="Trigger immediate server-side grace audit across Firestore and RouterOS"
                    >
                      {isServerAuditing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-200" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                      )}
                      <span>{isServerAuditing ? 'Executing...' : 'Run Server Audit Now'}</span>
                    </button>
                  </div>
                </div>

                {/* Inline Quick Policy Editor */}
                {isEditingGrace && (
                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-purple-500/40 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-purple-400" />
                        Quick Policy Settings: Grace Period & Cut-Off Schedule
                      </span>
                      <span className="text-[10px] text-slate-400">Syncs directly to Firestore & Cloud Functions</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Grace Period (Days)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={quickGraceDays}
                          onChange={(e) => setQuickGraceDays(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-mono text-xs focus:border-purple-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500 mt-0.5 block">
                          Days added after invoice due date
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Grace Cut-off Time
                        </label>
                        <input
                          type="time"
                          value={quickCutoffTime}
                          onChange={(e) => setQuickCutoffTime(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-mono text-xs focus:border-purple-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500 mt-0.5 block">
                          Daily hour on expiration day (e.g. 23:59 or 17:00)
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Daily Audit Schedule (PHT)
                        </label>
                        <input
                          type="time"
                          value={quickDailySchedule}
                          onChange={(e) => setQuickDailySchedule(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 font-mono text-xs focus:border-purple-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500 mt-0.5 block">
                          Cloud Scheduler midnight cron time
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                      <p className="text-[10px] text-slate-400">
                        Active calculation rule: Invoices expire at <strong>{quickCutoffTime}</strong> on Day <strong>+{quickGraceDays}</strong>.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingGrace(false)}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isSavingGrace}
                          onClick={async () => {
                            setIsSavingGrace(true);
                            try {
                              updateBusinessProfile({
                                invoiceGracePeriodDays: Number(quickGraceDays) || 5,
                                gracePeriodCutoffTime: quickCutoffTime || '23:59',
                                dailyAuditScheduleTime: quickDailySchedule || '00:00',
                              });
                              showToast(
                                'success',
                                'Grace Policy Saved',
                                `Set to ${quickGraceDays} days (cutoff: ${quickCutoffTime}, daily audit: ${quickDailySchedule} PHT).`
                              );
                              setIsEditingGrace(false);
                            } finally {
                              setIsSavingGrace(false);
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold shadow-md shadow-purple-600/20"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Save & Apply Policy</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

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
