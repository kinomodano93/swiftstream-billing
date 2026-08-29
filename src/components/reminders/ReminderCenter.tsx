import React, { useState } from 'react';
import {
  Send,
  MessageSquare,
  Mail,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Phone,
  User,
  Zap,
  Radio,
  Smartphone,
  Wifi,
  Battery,
  Bot,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ReminderType, OutageBroadcastRecord } from '../../types';
import { formatCurrency, formatDateTime, formatPhoneNumber } from '../../utils/formatters';
import { OutageBroadcastModal } from './OutageBroadcastModal';

export const ReminderCenter: React.FC = () => {
  const { customers, reminders, businessProfile, sendReminder, sendBatchReminders } = useApp();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [reminderType, setReminderType] = useState<ReminderType>('overdue_warning');
  const [channel, setChannel] = useState<'sms' | 'email' | 'both'>('sms');
  const [isSendingBatch, setIsSendingBatch] = useState<boolean>(false);
  const [activePreviewText, setActivePreviewText] = useState<string | null>(null);
  const [showOutageModal, setShowOutageModal] = useState<boolean>(false);

  const [outageHistory, setOutageHistory] = useState<OutageBroadcastRecord[]>([
    {
      id: 'outage-init-1',
      incidentNumber: 'OUT-918241',
      type: 'fiber_cut',
      title: 'Service Interruption - NAP-01 Binauahan Center',
      description: 'Fiber cable cut along Purok Maharlika caused by DPWH road widening. Core splicing in progress.',
      targetScope: 'nap_box',
      targetEntityName: 'NAP-01 Binauahan Center (Binauahan)',
      impactedSubscribersCount: 8,
      estimatedRestorationTime: '2 - 3 Hours',
      advisoryMessage: 'SWIFTSTREAM EMERGENCY FIBER CABLE CUT ADVISORY: Please be advised of a service interruption affecting NAP-01 Binauahan Center. Field fiber splicers are actively restoring lines. ETR: 2-3 Hours.',
      channelsSent: ['sms', 'telegram', 'discord'],
      status: 'resolved',
      declaredBy: 'Leonardo Flojo',
      declaredAt: '2026-08-28 11:30:00',
      resolvedAt: '2026-08-28 13:45:00',
    },
  ]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const generatePreviewMessage = () => {
    if (!selectedCustomer) return 'Select subscriber to preview message.';
    const bal = selectedCustomer.balance || selectedCustomer.monthlyFee;
    switch (reminderType) {
      case 'upcoming_due':
        return `SWIFTSTREAM ADVISORY: Hi ${selectedCustomer.fullName}, your Fiber Bill for ₱${bal.toLocaleString()} will be due in 3 days (Day ${selectedCustomer.billingDay}). Pay via GCash ${businessProfile.paymentGateways.gcashNumber} (${businessProfile.paymentGateways.gcashName}) or visit our Lagonoy shop. Thank you!`;
      case 'due_today':
        return `SWIFTSTREAM ADVISORY: Good day ${selectedCustomer.fullName}! Your Fiber Bill for ₱${bal.toLocaleString()} is DUE TODAY. Please settle promptly to prevent auto line-interruption. Pay via GCash/Maya or call ${businessProfile.representative.mobile}.`;
      case 'overdue_warning':
        return `SWIFTSTREAM OVERDUE NOTICE: Account ${selectedCustomer.accountNo} (${selectedCustomer.fullName}) has an unsettled balance of ₱${bal.toLocaleString()}. Settle within 48 hrs to avoid automated line cutoff. GCash: ${businessProfile.paymentGateways.gcashNumber}.`;
      case 'disconnection_notice':
        return `SWIFTSTREAM DISCONNECTION ADVISORY: Your fiber connection has been temporarily disabled due to outstanding balance of ₱${bal.toLocaleString()}. Settle immediately to restore high-speed access. Hotlines: ${businessProfile.representative.mobile}.`;
      case 'payment_confirmation':
        return `SWIFTSTREAM OFFICIAL ACKNOWLEDGMENT: Payment of ₱${selectedCustomer.monthlyFee.toLocaleString()} received for ${selectedCustomer.fullName} (${selectedCustomer.accountNo}). Your fiber service remains active. Salamat po!`;
      default:
        return `SWIFTSTREAM ADVISORY: Hi ${selectedCustomer.fullName}, bill notice for Account ${selectedCustomer.accountNo}.`;
    }
  };

  const currentSmsText = activePreviewText || generatePreviewMessage();

  const handleSendSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    await sendReminder(selectedCustomerId, reminderType, channel);
    setActivePreviewText(null);
  };

  const handleBatchBroadcast = async (target: 'overdue' | 'upcoming') => {
    setIsSendingBatch(true);
    await sendBatchReminders(target, channel);
    setIsSendingBatch(false);
  };

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Send className="w-5 h-5 text-cyan-400" />
            <span>SMS, Outage Blast & Staff Bot Dispatcher</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Multi-Gateway SMS (Semaphore / PhilSMS / Twilio), 1-click community fiber outage broadcasts, and Telegram/Discord staff webhooks.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowOutageModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/20 transition-all hover:scale-105"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Declare Fiber Outage & Blast</span>
          </button>

          <button
            disabled={isSendingBatch}
            onClick={() => handleBatchBroadcast('upcoming')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Blast Upcoming Due Notice</span>
          </button>

          <button
            disabled={isSendingBatch}
            onClick={() => handleBatchBroadcast('overdue')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Blast Overdue Warnings</span>
          </button>
        </div>
      </div>

      {/* Gateway Status Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 block">SMS Gateway Provider:</span>
            <span className="font-bold text-slate-200 uppercase font-mono">
              {businessProfile.smsGateway?.provider || 'Semaphore API'}
            </span>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 block">Sender ID / Mask:</span>
            <span className="font-bold text-cyan-300 font-mono">
              {businessProfile.smsGateway?.senderName || 'SWIFTSTREAM'}
            </span>
          </div>
          <Smartphone className="w-4 h-4 text-cyan-400" />
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 block">Telegram Staff Bot:</span>
            <span className="font-bold text-sky-400">
              {businessProfile.staffWebhooks?.telegramEnabled ? '🟢 NOC Connected' : '⚪ Disabled'}
            </span>
          </div>
          <Bot className="w-4 h-4 text-sky-400" />
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 block">Discord Webhook:</span>
            <span className="font-bold text-purple-400">
              {businessProfile.staffWebhooks?.discordEnabled ? '🟢 Staff Channel' : '⚪ Disabled'}
            </span>
          </div>
          <Zap className="w-4 h-4 text-purple-400" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Column 1: Dispatch Controls (5 Cols) */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm text-slate-100">Compose & Dispatch Advisory</h3>
          </div>

          <form onSubmit={handleSendSingle} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Select Subscriber *</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  setActivePreviewText(null);
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.accountNo}) — Bal: ₱{c.balance}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Advisory Type *</label>
              <select
                value={reminderType}
                onChange={(e) => {
                  setReminderType(e.target.value as ReminderType);
                  setActivePreviewText(null);
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="upcoming_due">Upcoming Due Notice (3 Days Before)</option>
                <option value="due_today">Bill Due Today Reminder</option>
                <option value="overdue_warning">Overdue Balance Warning</option>
                <option value="disconnection_notice">Temporary Disconnection Alert</option>
                <option value="payment_confirmation">Payment Received Official Acknowledgment</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Notification Channel</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'sms', label: 'SMS Only', icon: '📱' },
                  { id: 'email', label: 'Email', icon: '✉️' },
                  { id: 'both', label: 'Both', icon: '⚡' },
                ].map((ch) => (
                  <button
                    type="button"
                    key={ch.id}
                    onClick={() => setChannel(ch.id as any)}
                    className={`py-2 px-2 rounded-xl border font-semibold flex flex-col items-center gap-1 ${
                      channel === ch.id
                        ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{ch.icon}</span>
                    <span className="text-[10px]">{ch.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient Details */}
            {selectedCustomer && (
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Recipient Summary</span>
                <p className="text-slate-200 font-semibold">{selectedCustomer.fullName}</p>
                <p className="text-slate-400 font-mono text-[11px]">
                  Phone: {formatPhoneNumber(selectedCustomer.mobile)}
                </p>
                <p className="text-cyan-400 font-mono text-[11px]">
                  Current Unpaid Balance: {formatCurrency(selectedCustomer.balance)}
                </p>
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-600/20 transition-all hover:scale-102"
            >
              <Send className="w-4 h-4" />
              <span>Send Advisory to {selectedCustomer?.fullName?.split(' ')[0] || 'Subscriber'}</span>
            </button>
          </form>
        </div>

        {/* Column 2: Interactive Smartphone UI Mockup (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-[310px] bg-slate-950 border-4 border-slate-800 rounded-[44px] shadow-2xl p-3 relative overflow-hidden flex flex-col justify-between aspect-[9/18]">
            {/* Dynamic Island / Speaker Notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-slate-900 rounded-full z-10 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-slate-800 mr-2" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-900" />
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-3 px-3">
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-cyan-400">5G</span>
                <Wifi className="w-3 h-3 text-slate-300" />
                <Battery className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>

            {/* SMS Header */}
            <div className="text-center py-2 border-b border-slate-800/80 bg-slate-900/60 rounded-2xl mx-1 mt-2">
              <div className="w-8 h-8 rounded-full bg-cyan-600 text-white font-bold flex items-center justify-center mx-auto text-xs shadow-md">
                SW
              </div>
              <p className="font-bold text-xs text-slate-100 mt-1">SWIFTSTREAM</p>
              <p className="text-[9px] text-emerald-400 font-mono">Verified ISP Sender</p>
            </div>

            {/* Message Chat Bubble Body */}
            <div className="flex-1 p-2 space-y-3 overflow-y-auto flex flex-col justify-end">
              <div className="text-center">
                <span className="text-[9px] text-slate-500 font-mono bg-slate-900 px-2 py-0.5 rounded-full">
                  Today, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Incoming Telco SMS Bubble */}
              <div className="bg-slate-900 border border-slate-800 text-slate-200 text-xs p-3 rounded-2xl rounded-tl-sm shadow-md space-y-1.5 animate-in fade-in">
                <p className="text-[11px] leading-relaxed font-sans">{currentSmsText}</p>
                <div className="text-right">
                  <span className="text-[9px] text-slate-500 font-mono">SMS via Telco Gateway</span>
                </div>
              </div>
            </div>

            {/* Simulated SMS input bar */}
            <div className="p-2 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>Text message...</span>
              <span className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[10px] font-bold">
                ↑
              </span>
            </div>

            {/* Bottom Home Bar */}
            <div className="w-24 h-1 bg-slate-700 rounded-full mx-auto mt-2" />
          </div>
        </div>

        {/* Column 3: Live Transmission Logs (3 Cols) */}
        <div className="lg:col-span-3 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-100">Dispatched Logs</h3>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-800">
                {reminders.length} Sent
              </span>
            </div>

            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {reminders.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">
                  No notices dispatched yet.
                </div>
              ) : (
                reminders.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => setActivePreviewText(log.messageText)}
                    className="w-full text-left p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-xs space-y-1.5 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 truncate">{log.customerName}</span>
                      <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-cyan-400">
                        {log.channel}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
                      {log.messageText}
                    </p>

                    <div className="flex items-center justify-between text-[9px] text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Delivered</span>
                      </span>
                      <span>{formatDateTime(log.sentAt)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Outage Incident Records Log */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-950 text-rose-400 border border-rose-800/40">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-100">Community Outage Broadcast History</h4>
              <p className="text-xs text-slate-400">Past declared fiber cuts, OLT degradations, and restoration logs</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {outageHistory.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">
                    {item.incidentNumber}
                  </span>
                  <h5 className="font-bold text-slate-200 mt-1">{item.title}</h5>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                  {item.status}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 line-clamp-2">{item.description}</p>

              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 pt-2 border-t border-slate-800/60">
                <div>
                  <span>Impacted:</span> <strong className="text-slate-300">{item.impactedSubscribersCount} Subscribers</strong>
                </div>
                <div>
                  <span>ETR:</span> <strong className="text-cyan-300">{item.estimatedRestorationTime}</strong>
                </div>
                <div className="col-span-2 flex items-center justify-between text-slate-500">
                  <span>Declared by {item.declaredBy}</span>
                  <span>{formatDateTime(item.declaredAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Outage Modal */}
      {showOutageModal && (
        <OutageBroadcastModal
          onClose={() => setShowOutageModal(false)}
          onBroadcastComplete={(record) => {
            setOutageHistory((prev) => [record, ...prev]);
          }}
        />
      )}
    </div>
  );
};
