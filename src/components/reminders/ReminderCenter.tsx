import React, { useState, useEffect, useMemo } from 'react';
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
  Wrench,
  Globe,
  MapPin,
  Users,
  RefreshCw,
  X,
  Check,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ReminderType, OutageBroadcastRecord, Customer } from '../../types';
import { formatCurrency, formatDateTime, formatPhoneNumber } from '../../utils/formatters';
import { OutageBroadcastModal } from './OutageBroadcastModal';
import { saveFirestoreDoc, subscribeToCollection, COLLECTIONS } from '../../services/firestoreService';
import { generateReminderMessage } from '../../utils/smsSender';

export const ReminderCenter: React.FC = () => {
  const {
    customers,
    reminders,
    businessProfile,
    coverageAreas,
    sendReminder,
    sendBatchReminders,
    sendAdvisoryBroadcast,
    showToast,
  } = useApp();

  // Target Scope: 'all' | 'coverage' | 'user'
  const [targetScope, setTargetScope] = useState<'all' | 'coverage' | 'user'>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [selectedBarangay, setSelectedBarangay] = useState<string>('Binauahan');

  // Advisory Type
  const [reminderType, setReminderType] = useState<ReminderType>('maintenance_advisory');

  // Maintenance & Restoration Fields
  const [maintenanceWindow, setMaintenanceWindow] = useState<string>('Tonight: 1:00 AM - 5:00 AM');
  const [maintenanceScope, setMaintenanceScope] = useState<string>('Core Fiber Splicing & Node Upgrade');
  const [restoredTime, setRestoredTime] = useState<string>('as of 6:00 AM today');
  const [generalNote, setGeneralNote] = useState<string>('');

  // Message Mode: template vs custom
  const [isCustomMessage, setIsCustomMessage] = useState<boolean>(false);
  const [customMessage, setCustomMessage] = useState<string>('');

  // Channel & Sending states
  const [channel, setChannel] = useState<'sms' | 'email' | 'both'>('sms');
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [isSendingBatch, setIsSendingBatch] = useState<boolean>(false);
  const [activePreviewText, setActivePreviewText] = useState<string | null>(null);
  const [showOutageModal, setShowOutageModal] = useState<boolean>(false);
  const [selectedOutageRecord, setSelectedOutageRecord] = useState<OutageBroadcastRecord | null>(null);
  const [outageModalMode, setOutageModalMode] = useState<'declare' | 'restore'>('declare');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const [outageHistory, setOutageHistory] = useState<OutageBroadcastRecord[]>(() => {
    try {
      const saved = localStorage.getItem('swiftstream_outage_history_v4');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('swiftstream_outage_history_v4', JSON.stringify(outageHistory));
    } catch (_) {}
  }, [outageHistory]);

  // Real-time Cloud Firestore synchronization for outage advisories
  useEffect(() => {
    const unsub = subscribeToCollection<OutageBroadcastRecord>(COLLECTIONS.OUTAGE_BROADCASTS, (data) => {
      if (data && data.length > 0) {
        setOutageHistory(data);
      }
    });
    return () => unsub();
  }, []);

  // Compute distinct list of available barangays from coverageAreas and customers
  const availableBarangays = useMemo(() => {
    const list = new Set<string>();
    coverageAreas.forEach((c) => {
      if (c.barangay) list.add(c.barangay);
    });
    customers.forEach((c) => {
      if (c.address?.barangay) list.add(c.address.barangay);
    });
    return Array.from(list).filter(Boolean).sort();
  }, [coverageAreas, customers]);

  useEffect(() => {
    if (availableBarangays.length > 0 && !availableBarangays.includes(selectedBarangay)) {
      setSelectedBarangay(availableBarangays[0]);
    }
  }, [availableBarangays]);

  // Compute targeted subscribers based on current scope
  const targetedSubscribers = useMemo<Customer[]>(() => {
    if (targetScope === 'all') {
      return customers.filter((c) => c.status !== 'disconnected');
    }
    if (targetScope === 'coverage') {
      return customers.filter(
        (c) =>
          c.status !== 'disconnected' &&
          c.address?.barangay?.toLowerCase() === selectedBarangay.toLowerCase()
      );
    }
    const single = customers.find((c) => c.id === selectedCustomerId);
    return single ? [single] : [];
  }, [customers, targetScope, selectedBarangay, selectedCustomerId]);

  // Representative subscriber for realistic live preview
  const previewCustomer = useMemo<Customer | undefined>(() => {
    if (targetScope === 'user') {
      return customers.find((c) => c.id === selectedCustomerId) || customers[0];
    }
    return targetedSubscribers[0] || customers[0];
  }, [targetScope, selectedCustomerId, customers, targetedSubscribers]);

  // Generate dynamic preview text
  const generatedPreviewMessage = useMemo(() => {
    if (!previewCustomer) return 'Select a subscriber or coverage area to preview advisory.';
    if (isCustomMessage && customMessage.trim()) {
      return customMessage
        .replace(/{name}/g, previewCustomer.fullName)
        .replace(/{accountNo}/g, previewCustomer.accountNo)
        .replace(/{barangay}/g, previewCustomer.address?.barangay || selectedBarangay || 'your area')
        .replace(/{hotline}/g, businessProfile.representative?.mobile || 'our office')
        .replace(/{balance}/g, formatCurrency(previewCustomer.balance));
    }

    return generateReminderMessage(reminderType, previewCustomer, businessProfile, undefined, {
      maintenanceWindow,
      maintenanceScope,
      restoredTime,
      customNote: generalNote,
    });
  }, [
    previewCustomer,
    isCustomMessage,
    customMessage,
    reminderType,
    businessProfile,
    maintenanceWindow,
    maintenanceScope,
    restoredTime,
    generalNote,
    selectedBarangay,
  ]);

  const currentSmsText = activePreviewText || generatedPreviewMessage;

  // Execute broadcast
  const executeDispatch = async () => {
    if (targetedSubscribers.length === 0) {
      showToast('error', 'No Recipients', 'There are no active subscribers in the selected scope.');
      return;
    }

    setIsDispatching(true);
    setShowConfirmModal(false);

    try {
      const targetVal =
        targetScope === 'all'
          ? 'all'
          : targetScope === 'coverage'
          ? selectedBarangay
          : selectedCustomerId;

      await sendAdvisoryBroadcast({
        scope: targetScope,
        targetValue: targetVal,
        type: reminderType,
        channel,
        customMessage: isCustomMessage ? customMessage : undefined,
        options: {
          maintenanceWindow,
          maintenanceScope,
          restoredTime,
          customNote: generalNote,
        },
      });

      setActivePreviewText(null);
    } catch (err: any) {
      showToast('error', 'Dispatch Error', err?.message || 'Failed to dispatch advisory.');
    } finally {
      setIsDispatching(false);
    }
  };

  const handleBatchBroadcast = async (target: 'overdue' | 'upcoming') => {
    setIsSendingBatch(true);
    await sendBatchReminders(target, channel);
    setIsSendingBatch(false);
  };

  const getAdvisoryBadge = (type: ReminderType) => {
    switch (type) {
      case 'maintenance_advisory':
        return { label: '🛠️ Maintenance', color: 'bg-amber-950 text-amber-400 border-amber-800/40' };
      case 'restored_advisory':
        return { label: '🟢 Restored', color: 'bg-emerald-950 text-emerald-400 border-emerald-800/40' };
      case 'general_advisory':
        return { label: '📢 Announcement', color: 'bg-blue-950 text-blue-400 border-blue-800/40' };
      case 'overdue_warning':
        return { label: '🚨 Overdue', color: 'bg-rose-950 text-rose-400 border-rose-800/40' };
      case 'disconnection_notice':
        return { label: '🛑 Disconnection', color: 'bg-red-950 text-red-400 border-red-800/40' };
      case 'payment_confirmation':
        return { label: '💳 Receipt', color: 'bg-cyan-950 text-cyan-400 border-cyan-800/40' };
      default:
        return { label: 'ℹ️ Notice', color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
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
            Dispatch maintenance advisories, restoration notices, billing reminders, and emergency fiber outage alerts.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSelectedOutageRecord(null);
              setOutageModalMode('declare');
              setShowOutageModal(true);
            }}
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
            <span>Blast Due Notices</span>
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
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-sm text-slate-100">Compose & Dispatch Advisory</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-semibold">
              {targetedSubscribers.length} Recipient{targetedSubscribers.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="space-y-4 text-xs">
            {/* 1. Recipient Scope Selection */}
            <div>
              <label className="block text-slate-400 mb-1.5 font-medium">Recipient Scope *</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTargetScope('all');
                    setActivePreviewText(null);
                  }}
                  className={`py-2 px-2.5 rounded-xl border font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    targetScope === 'all'
                      ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs">All Users</span>
                  <span className="text-[10px] text-slate-500 font-mono font-normal">
                    ({customers.filter((c) => c.status !== 'disconnected').length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetScope('coverage');
                    setActivePreviewText(null);
                  }}
                  className={`py-2 px-2.5 rounded-xl border font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    targetScope === 'coverage'
                      ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs">Per Coverage</span>
                  <span className="text-[10px] text-slate-500 font-mono font-normal">
                    ({availableBarangays.length} Areas)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetScope('user');
                    setActivePreviewText(null);
                  }}
                  className={`py-2 px-2.5 rounded-xl border font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    targetScope === 'user'
                      ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <User className="w-4 h-4 text-purple-400" />
                  <span className="text-xs">Per User</span>
                  <span className="text-[10px] text-slate-500 font-mono font-normal">Single Account</span>
                </button>
              </div>
            </div>

            {/* Scope Details / Selection */}
            {targetScope === 'all' && (
              <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-800/50 flex items-center justify-between text-xs text-cyan-200 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    Broadcasting to all <strong>{targetedSubscribers.length} active/billed subscribers</strong> across the entire fiber network.
                  </span>
                </div>
              </div>
            )}

            {targetScope === 'coverage' && (
              <div className="space-y-2 animate-in fade-in">
                <label className="block text-slate-400 font-medium">Select Coverage Area / Barangay *</label>
                <select
                  value={selectedBarangay}
                  onChange={(e) => {
                    setSelectedBarangay(e.target.value);
                    setActivePreviewText(null);
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
                >
                  {availableBarangays.map((b) => {
                    const count = customers.filter(
                      (c) => c.status !== 'disconnected' && c.address?.barangay?.toLowerCase() === b.toLowerCase()
                    ).length;
                    return (
                      <option key={b} value={b}>
                        Brgy. {b} — {count} subscriber{count === 1 ? '' : 's'}
                      </option>
                    );
                  })}
                </select>
                <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-center gap-2 text-[11px] text-emerald-300">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    Targeting <strong>{targetedSubscribers.length} subscribers</strong> in <strong>Brgy. {selectedBarangay}</strong>.
                  </span>
                </div>
              </div>
            )}

            {targetScope === 'user' && (
              <div className="space-y-2 animate-in fade-in">
                <label className="block text-slate-400 font-medium">Select Subscriber *</label>
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
                      {c.fullName} ({c.accountNo}) — Brgy. {c.address.barangay} • Bal: ₱{c.balance}
                    </option>
                  ))}
                </select>

                {previewCustomer && (
                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Recipient Summary</span>
                    <p className="text-slate-200 font-semibold">{previewCustomer.fullName}</p>
                    <p className="text-slate-400 font-mono text-[11px]">
                      Phone: {formatPhoneNumber(previewCustomer.mobile)} • Brgy. {previewCustomer.address.barangay}
                    </p>
                    <p className="text-cyan-400 font-mono text-[11px]">
                      Current Unpaid Balance: {formatCurrency(previewCustomer.balance)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 2. Advisory Type Selection */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Advisory Type *</label>
              <select
                value={reminderType}
                onChange={(e) => {
                  setReminderType(e.target.value as ReminderType);
                  setActivePreviewText(null);
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
              >
                <optgroup label="🛠️ Network & Service Advisories" className="bg-slate-900 text-cyan-300 font-bold">
                  <option value="maintenance_advisory" className="bg-slate-950 text-slate-100">
                    🛠️ Scheduled Maintenance Advisory
                  </option>
                  <option value="restored_advisory" className="bg-slate-950 text-slate-100">
                    🟢 Service Restored / Normalcy Notice
                  </option>
                  <option value="general_advisory" className="bg-slate-950 text-slate-100">
                    📢 General Network Announcement
                  </option>
                </optgroup>
                <optgroup label="💳 Billing & Collection Notices" className="bg-slate-900 text-amber-300 font-bold">
                  <option value="upcoming_due" className="bg-slate-950 text-slate-100">
                    ⏳ Upcoming Due Notice (3 Days Before)
                  </option>
                  <option value="due_today" className="bg-slate-950 text-slate-100">
                    ⚠️ Bill Due Today Reminder
                  </option>
                  <option value="overdue_warning" className="bg-slate-950 text-slate-100">
                    🚨 Overdue Balance Warning
                  </option>
                  <option value="disconnection_notice" className="bg-slate-950 text-slate-100">
                    🛑 Temporary Disconnection Alert
                  </option>
                  <option value="payment_confirmation" className="bg-slate-950 text-slate-100">
                    💳 Payment Received Official Acknowledgment
                  </option>
                </optgroup>
              </select>
            </div>

            {/* Dynamic Inputs for Maintenance Advisory */}
            {reminderType === 'maintenance_advisory' && (
              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-800/40 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Maintenance Schedule Parameters</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                      Maintenance Window *
                    </label>
                    <input
                      type="text"
                      value={maintenanceWindow}
                      onChange={(e) => {
                        setMaintenanceWindow(e.target.value);
                        setActivePreviewText(null);
                      }}
                      placeholder="e.g. Tonight: 1:00 AM - 5:00 AM"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">Activity Scope</label>
                    <input
                      type="text"
                      value={maintenanceScope}
                      onChange={(e) => {
                        setMaintenanceScope(e.target.value);
                        setActivePreviewText(null);
                      }}
                      placeholder="e.g. Core Fiber Splicing & Node Upgrade"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Inputs for Restored Advisory */}
            {reminderType === 'restored_advisory' && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-800/40 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Service Restoration Details</span>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                    Restoration Time *
                  </label>
                  <input
                    type="text"
                    value={restoredTime}
                    onChange={(e) => {
                      setRestoredTime(e.target.value);
                      setActivePreviewText(null);
                    }}
                    placeholder="e.g. as of 6:00 AM today"
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Message advises restarting ONU/router if connection requires handshake renewal.
                  </span>
                </div>
              </div>
            )}

            {/* Dynamic Inputs for General Announcement */}
            {reminderType === 'general_advisory' && (
              <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-800/40 space-y-2 animate-in fade-in">
                <label className="block text-[11px] text-slate-400 font-medium">Announcement Content *</label>
                <input
                  type="text"
                  value={generalNote}
                  onChange={(e) => {
                    setGeneralNote(e.target.value);
                    setActivePreviewText(null);
                  }}
                  placeholder="e.g. Please be advised our customer helpdesk will observe special holiday hours..."
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            {/* 3. Notification Channel */}
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
                    className={`py-2 px-2 rounded-xl border font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      channel === ch.id
                        ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span>{ch.icon}</span>
                    <span className="text-[10px]">{ch.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Custom Message Editor Toggle */}
            <div className="space-y-2 pt-1 border-t border-slate-800/60">
              <div className="flex items-center justify-between">
                <label className="text-slate-400 font-medium flex items-center gap-1.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={isCustomMessage}
                    onChange={(e) => {
                      setIsCustomMessage(e.target.checked);
                      if (e.target.checked && !customMessage) {
                        setCustomMessage(generatedPreviewMessage);
                      }
                      setActivePreviewText(null);
                    }}
                    className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Customize SMS / Text Template</span>
                </label>
                {isCustomMessage && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomMessage(generatedPreviewMessage);
                      setActivePreviewText(null);
                    }}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset to Template</span>
                  </button>
                )}
              </div>

              {isCustomMessage && (
                <div className="space-y-1.5 animate-in fade-in">
                  <textarea
                    rows={4}
                    value={customMessage}
                    onChange={(e) => {
                      setCustomMessage(e.target.value);
                      setActivePreviewText(null);
                    }}
                    placeholder="Enter custom announcement text..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500 leading-relaxed"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <span>Chips:</span>
                      {['{name}', '{accountNo}', '{barangay}', '{hotline}'].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setCustomMessage((prev) => prev + ` ${chip}`)}
                          className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded font-mono cursor-pointer transition-colors"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                    <span>{customMessage.length} chars</span>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Dispatch Action Button */}
            <button
              type="button"
              onClick={() => {
                if (targetScope === 'user') {
                  executeDispatch();
                } else {
                  setShowConfirmModal(true);
                }
              }}
              disabled={isDispatching || targetedSubscribers.length === 0}
              className={`w-full flex items-center justify-center gap-2 py-3 text-white rounded-xl font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 ${
                reminderType === 'maintenance_advisory'
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                  : reminderType === 'restored_advisory'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/20'
              }`}
            >
              {isDispatching ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : reminderType === 'maintenance_advisory' ? (
                <Wrench className="w-4 h-4" />
              ) : reminderType === 'restored_advisory' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>
                {isDispatching
                  ? 'Dispatching Advisories...'
                  : targetScope === 'all'
                  ? `Broadcast to All Users (${targetedSubscribers.length} Subscribers)`
                  : targetScope === 'coverage'
                  ? `Dispatch to Brgy. ${selectedBarangay} (${targetedSubscribers.length} Subscribers)`
                  : `Send Advisory to ${previewCustomer?.fullName?.split(' ')[0] || 'Subscriber'}`}
              </span>
            </button>
          </div>
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
              <p className="font-bold text-xs text-slate-100 mt-1">
                {businessProfile.smsGateway?.senderName || 'SWIFTSTREAM'}
              </p>
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
              <div className="bg-slate-900 border border-slate-800 text-slate-200 text-xs p-3 rounded-2xl rounded-tl-sm shadow-md space-y-2 animate-in fade-in">
                {/* Advisory Badge inside bubble */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${getAdvisoryBadge(reminderType).color}`}>
                    {getAdvisoryBadge(reminderType).label}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {targetScope === 'all'
                      ? 'All Users'
                      : targetScope === 'coverage'
                      ? `Brgy. ${selectedBarangay}`
                      : previewCustomer?.fullName?.split(' ')[0]}
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed font-sans">{currentSmsText}</p>

                <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono pt-1">
                  <span>{channel.toUpperCase()} Gateway</span>
                  <span className="text-cyan-400">Delivered</span>
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
                reminders.map((log) => {
                  const badge = getAdvisoryBadge(log.type);
                  return (
                    <button
                      key={log.id}
                      onClick={() => setActivePreviewText(log.messageText)}
                      className="w-full text-left p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-xs space-y-1.5 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 truncate">{log.customerName}</span>
                        <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-cyan-400">
                          {log.channel}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${badge.color}`}>
                          {badge.label}
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
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Broadcast */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${reminderType === 'maintenance_advisory' ? 'bg-amber-500/20 text-amber-400' : reminderType === 'restored_advisory' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                  {reminderType === 'maintenance_advisory' ? <Wrench className="w-5 h-5" /> : reminderType === 'restored_advisory' ? <CheckCircle2 className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-100">Confirm Advisory Broadcast</h4>
                  <p className="text-slate-400 text-[11px]">Review broadcast recipients and message before sending</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Scope:</span>
                <span className="font-bold text-slate-200">
                  {targetScope === 'all'
                    ? 'All Users (Entire Network)'
                    : targetScope === 'coverage'
                    ? `Coverage: Brgy. ${selectedBarangay}`
                    : previewCustomer?.fullName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Recipients:</span>
                <span className="font-bold font-mono text-cyan-400">{targetedSubscribers.length} Subscribers</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Advisory Type:</span>
                <span className="font-bold text-slate-200">{getAdvisoryBadge(reminderType).label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Channel:</span>
                <span className="font-bold text-purple-300 uppercase font-mono">{channel}</span>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Sample Message Preview:</span>
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed italic line-clamp-3">
                  "{currentSmsText}"
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDispatch}
                disabled={isDispatching}
                className={`flex items-center gap-2 px-5 py-2 text-white rounded-xl font-bold shadow-lg cursor-pointer ${
                  reminderType === 'maintenance_advisory'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                    : reminderType === 'restored_advisory'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                    : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/30'
                }`}
              >
                {isDispatching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Confirm & Blast Broadcast</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

        {outageHistory.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-800/60">
            <Radio className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-slate-300 font-semibold">No Outage Incidents Logged</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Broadcasted community advisories and maintenance records will be listed here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {outageHistory.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 text-xs shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">
                        {item.incidentNumber}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        {item.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <h5 className="font-bold text-slate-200 mt-1">{item.title}</h5>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border flex items-center gap-1.5 ${
                      item.status === 'active_outage'
                        ? 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                        : item.status === 'restoring'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                        : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                    }`}
                  >
                    {item.status === 'active_outage' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                    )}
                    <span>
                      {item.status === 'active_outage'
                        ? 'Active Outage'
                        : item.status === 'restoring'
                        ? 'Restoring'
                        : 'Resolved'}
                    </span>
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{item.description}</p>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 pt-2 border-t border-slate-800/60">
                  <div>
                    <span>Scope:</span> <strong className="text-slate-300">{item.targetEntityName || item.targetScope}</strong>
                  </div>
                  <div>
                    <span>Impacted:</span> <strong className="text-slate-300">{item.impactedSubscribersCount} Subscribers</strong>
                  </div>
                  <div className="col-span-2 flex items-center justify-between text-slate-500">
                    <span>
                      ETR / Status: <strong className="text-cyan-300">{item.estimatedRestorationTime}</strong>
                    </span>
                    <span>{formatDateTime(item.declaredAt)}</span>
                  </div>
                  {item.resolvedAt && (
                    <div className="col-span-2 text-emerald-300 bg-emerald-950/30 p-2 rounded-xl border border-emerald-800/40 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Restored at: {formatDateTime(item.resolvedAt)}</span>
                      </span>
                      <span>By: {item.resolvedBy || item.declaredBy}</span>
                    </div>
                  )}
                </div>

                {/* Quick Action Buttons */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-end gap-2">
                  {item.status === 'active_outage' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOutageRecord(item);
                          setOutageModalMode('declare');
                          setShowOutageModal(true);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-semibold transition-colors"
                      >
                        Update Blast
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOutageRecord(item);
                          setOutageModalMode('restore');
                          setShowOutageModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Blast Restoration & Resolve</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOutageRecord(item);
                        setOutageModalMode('restore');
                        setShowOutageModal(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[11px] font-medium transition-colors"
                    >
                      View Notice Details
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outage Modal */}
      {showOutageModal && (
        <OutageBroadcastModal
          onClose={() => {
            setShowOutageModal(false);
            setSelectedOutageRecord(null);
          }}
          initialRecord={selectedOutageRecord}
          initialMode={outageModalMode}
          onBroadcastComplete={(record) => {
            setOutageHistory((prev) => {
              const existing = prev.find((p) => p.id === record.id);
              if (existing) {
                return prev.map((p) => (p.id === record.id ? record : p));
              }
              return [record, ...prev];
            });
            saveFirestoreDoc(COLLECTIONS.OUTAGE_BROADCASTS, record);
          }}
        />
      )}
    </div>
  );
};
