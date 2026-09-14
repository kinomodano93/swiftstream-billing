import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  X,
  Send,
  Users,
  Radio,
  Clock,
  CheckCircle2,
  Layers,
  MessageSquare,
  Mail,
  Zap,
  Sparkles,
  Bot,
  Smartphone,
  RefreshCw,
  Search,
  Check,
  MapPin,
  User,
  Server,
  Wifi,
  ShieldAlert,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { OutageType, OutageBroadcastRecord, Customer } from '../../types';
import {
  generateOutageAdvisoryMessage,
  generateOutageRestorationMessage,
  dispatchSmsGateway,
} from '../../utils/smsSender';
import { sendTelegramStaffAlert, sendDiscordStaffAlert } from '../../utils/webhookService';

interface OutageBroadcastModalProps {
  onClose: () => void;
  onBroadcastComplete?: (record: OutageBroadcastRecord) => void;
  initialRecord?: OutageBroadcastRecord | null;
  initialMode?: 'declare' | 'restore';
}

export const OutageBroadcastModal: React.FC<OutageBroadcastModalProps> = ({
  onClose,
  onBroadcastComplete,
  initialRecord,
  initialMode = 'declare',
}) => {
  const {
    customers,
    napBoxes,
    coverageAreas,
    businessProfile,
    logAuditEvent,
    showToast,
    sendReminder,
  } = useApp();

  // Mode: Declare Outage vs Service Restored
  const [mode, setMode] = useState<'declare' | 'restore'>(
    initialMode || (initialRecord?.status === 'active_outage' ? 'restore' : 'declare')
  );

  const [outageType, setOutageType] = useState<OutageType>(initialRecord?.type || 'fiber_cut');
  const [targetScope, setTargetScope] = useState<'all' | 'nap_box' | 'olt_pon' | 'barangay' | 'user'>(
    initialRecord?.targetScope || 'nap_box'
  );

  // Dynamic entity lists
  const availableBarangays = useMemo(() => {
    const fromAreas = coverageAreas.map((a) => a.barangay);
    const fromCustomers = customers.map((c) => c.address?.barangay).filter(Boolean) as string[];
    const fromNaps = napBoxes.map((n) => n.barangay).filter(Boolean) as string[];
    const merged = Array.from(new Set([...fromAreas, ...fromCustomers, ...fromNaps])).filter(Boolean);
    return merged.length > 0 ? merged.sort() : ['Binauahan', 'San Jose', 'Poblacion', 'Himalo'];
  }, [coverageAreas, customers, napBoxes]);

  const availablePonPorts = useMemo(() => {
    const fromCustomers = customers.map((c) => c.network?.oltPonPort).filter(Boolean) as string[];
    const standardPorts = [
      'PON-1/1',
      'PON-1/2',
      'PON-1/3',
      'PON-1/4',
      'PON-1/5',
      'PON-1/6',
      'PON-1/7',
      'PON-1/8',
    ];
    return Array.from(new Set([...fromCustomers, ...standardPorts])).sort();
  }, [customers]);

  // Target Entity Selection
  const [targetEntityId, setTargetEntityId] = useState<string>(() => {
    if (initialRecord?.targetEntityId) return initialRecord.targetEntityId;
    return napBoxes[0]?.id || '';
  });

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => {
    return customers.find((c) => c.status !== 'disconnected')?.id || customers[0]?.id || '';
  });

  const [subscriberSearch, setSubscriberSearch] = useState<string>('');

  // ETR & Restoration options
  const [etrPreset, setEtrPreset] = useState<string>(
    initialRecord?.estimatedRestorationTime && !initialRecord.estimatedRestorationTime.startsWith('Restored')
      ? initialRecord.estimatedRestorationTime
      : '2 - 3 Hours'
  );
  const [isCustomEtr, setIsCustomEtr] = useState<boolean>(false);
  const [customEtr, setCustomEtr] = useState<string>('');

  const [restoredTime, setRestoredTime] = useState<string>(() => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' PHT';
  });
  const [includeRebootGuide, setIncludeRebootGuide] = useState<boolean>(true);

  // Message & Customization
  const [customAdvisory, setCustomAdvisory] = useState<string>('');
  const [isCustomTextMode, setIsCustomTextMode] = useState<boolean>(false);

  // Channels
  const [sendSms, setSendSms] = useState<boolean>(true);
  const [sendEmail, setSendEmail] = useState<boolean>(true);
  const [sendTelegram, setSendTelegram] = useState<boolean>(true);
  const [sendDiscord, setSendDiscord] = useState<boolean>(true);

  // Process & Confirmation
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showConfirmBlast, setShowConfirmBlast] = useState<boolean>(false);
  const [rightPanelTab, setRightPanelTab] = useState<'preview' | 'subscribers'>('preview');

  // Incident Number
  const incidentNumber = useMemo(() => {
    if (initialRecord?.incidentNumber) return initialRecord.incidentNumber;
    return `OUT-${Date.now().toString().slice(-6)}`;
  }, [initialRecord]);

  // Compute targeted subscribers
  const affectedSubscribers = useMemo<Customer[]>(() => {
    return customers.filter((c) => {
      if (c.status === 'disconnected') return false;

      if (targetScope === 'all') return true;

      if (targetScope === 'nap_box') {
        return c.network?.napBoxId === targetEntityId;
      }

      if (targetScope === 'olt_pon') {
        return (c.network?.oltPonPort || 'PON-1/1') === targetEntityId;
      }

      if (targetScope === 'barangay') {
        return (c.address?.barangay || '').toLowerCase() === targetEntityId.toLowerCase();
      }

      if (targetScope === 'user') {
        return c.id === selectedCustomerId;
      }

      return false;
    });
  }, [customers, targetScope, targetEntityId, selectedCustomerId]);

  // Target Entity Display Name
  const targetEntityName = useMemo(() => {
    if (targetScope === 'all') return 'All Network Sectors & Subscribers';
    if (targetScope === 'nap_box') {
      const nap = napBoxes.find((n) => n.id === targetEntityId);
      return nap ? `${nap.name} (${nap.barangay})` : targetEntityId || 'Selected NAP Box';
    }
    if (targetScope === 'olt_pon') return `OLT PON Port ${targetEntityId}`;
    if (targetScope === 'barangay') return `Brgy. ${targetEntityId}`;
    if (targetScope === 'user') {
      const cust = customers.find((c) => c.id === selectedCustomerId);
      return cust ? `${cust.fullName} (${cust.accountNo})` : 'Individual Subscriber';
    }
    return 'Target Subscribers';
  }, [targetScope, targetEntityId, selectedCustomerId, napBoxes, customers]);

  const activeEtr = isCustomEtr && customEtr ? customEtr : etrPreset;

  // Auto-generated advisory text
  const autoMessage = useMemo(() => {
    const scopeLabel =
      targetScope === 'all'
        ? 'Network Footprint'
        : targetScope === 'nap_box'
        ? 'Fiber Distribution Box'
        : targetScope === 'olt_pon'
        ? 'OLT PON Port'
        : targetScope === 'barangay'
        ? 'Barangay'
        : 'Subscriber Line';

    if (mode === 'restore') {
      return generateOutageRestorationMessage(
        scopeLabel,
        targetEntityName,
        restoredTime,
        businessProfile,
        includeRebootGuide
      );
    }

    return generateOutageAdvisoryMessage(
      outageType,
      scopeLabel,
      targetEntityName,
      activeEtr,
      businessProfile
    );
  }, [
    mode,
    outageType,
    targetScope,
    targetEntityName,
    activeEtr,
    restoredTime,
    includeRebootGuide,
    businessProfile,
  ]);

  const activeMessage = isCustomTextMode && customAdvisory ? customAdvisory : autoMessage;

  // Representative subscriber for live simulation
  const previewCustomer = useMemo<Customer | undefined>(() => {
    if (targetScope === 'user') {
      return customers.find((c) => c.id === selectedCustomerId) || customers[0];
    }
    return affectedSubscribers[0] || customers[0];
  }, [targetScope, selectedCustomerId, customers, affectedSubscribers]);

  // Live interpolated message for preview
  const livePreviewText = useMemo(() => {
    const brand = businessProfile.tradeName || businessProfile.name || 'SWIFTSTREAM';
    const cName = previewCustomer ? previewCustomer.fullName : 'Valued Subscriber';
    const cAcc = previewCustomer ? previewCustomer.accountNo : 'ACC-00000';
    const cBrgy = previewCustomer?.address?.barangay || 'your area';
    const hotline = businessProfile.representative?.mobile || '09638927819';

    return activeMessage
      .replace(/{name}/g, cName)
      .replace(/{accountNo}/g, cAcc)
      .replace(/{barangay}/g, cBrgy)
      .replace(/{scope}/g, targetScope.toUpperCase())
      .replace(/{entity}/g, targetEntityName)
      .replace(/{incident}/g, incidentNumber)
      .replace(/{etr}/g, mode === 'restore' ? restoredTime : activeEtr)
      .replace(/{time}/g, restoredTime)
      .replace(/{hotline}/g, hotline);
  }, [
    activeMessage,
    previewCustomer,
    businessProfile,
    targetScope,
    targetEntityName,
    incidentNumber,
    mode,
    restoredTime,
    activeEtr,
  ]);

  // Handle inserting merge tags into custom text
  const insertMergeTag = (tag: string) => {
    setIsCustomTextMode(true);
    setCustomAdvisory((prev) => (prev ? `${prev} ${tag}` : `${autoMessage} ${tag}`));
  };

  // Filtered subscribers for per-user search
  const searchedCustomers = useMemo(() => {
    if (!subscriberSearch.trim()) return customers.slice(0, 15);
    const q = subscriberSearch.toLowerCase();
    return customers
      .filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.accountNo.toLowerCase().includes(q) ||
          (c.address?.barangay && c.address.barangay.toLowerCase().includes(q))
      )
      .slice(0, 15);
  }, [customers, subscriberSearch]);

  const outageTypeLabels: Record<OutageType, string> = {
    fiber_cut: '🪓 Fiber Cable Cut (Tree / Excavation)',
    olt_pon_failure: '⚡ OLT PON Port Degradation',
    power_interruption: '🔌 Commercial Power Interruption (Genset)',
    emergency_splicing: '🔧 Emergency Core Splicing & Alignment',
    scheduled_maintenance: '📅 Scheduled Network Maintenance',
  };

  // Dispatch Outage or Restoration Broadcast
  const handleExecuteBroadcast = async () => {
    if (affectedSubscribers.length === 0) {
      showToast('error', 'No Recipients Found', 'No active subscribers found in the selected target scope.');
      return;
    }

    setIsSending(true);
    setShowConfirmBlast(false);

    const channelsSent: ('sms' | 'email' | 'telegram' | 'discord')[] = [];
    if (sendSms) channelsSent.push('sms');
    if (sendEmail) channelsSent.push('email');
    if (sendTelegram) channelsSent.push('telegram');
    if (sendDiscord) channelsSent.push('discord');

    const brand = businessProfile.tradeName || businessProfile.name || 'SWIFTSTREAM';
    const declaredBy =
      businessProfile.representative?.firstName + ' ' + businessProfile.representative?.lastName ||
      'Operations Dispatcher';

    try {
      // 1. Dispatch SMS and Email to affected subscribers & save ReminderLogs
      let sentCount = 0;
      const reminderChannel: 'sms' | 'email' | 'both' =
        sendSms && sendEmail ? 'both' : sendEmail ? 'email' : 'sms';

      for (const cust of affectedSubscribers) {
        const personalizedMsg = activeMessage
          .replace(/{name}/g, cust.fullName)
          .replace(/{accountNo}/g, cust.accountNo)
          .replace(/{barangay}/g, cust.address?.barangay || 'your area')
          .replace(/{scope}/g, targetScope.toUpperCase())
          .replace(/{entity}/g, targetEntityName)
          .replace(/{incident}/g, incidentNumber)
          .replace(/{etr}/g, mode === 'restore' ? restoredTime : activeEtr)
          .replace(/{time}/g, restoredTime)
          .replace(/{hotline}/g, businessProfile.representative?.mobile || 'our office');

        if (sendSms || sendEmail) {
          await sendReminder(
            cust.id,
            mode === 'restore' ? 'restored_advisory' : 'general_advisory',
            reminderChannel,
            undefined,
            personalizedMsg,
            { silent: true }
          );
        }
        sentCount++;
      }

      // 2. Dispatch Staff Telegram Alert
      if (sendTelegram && businessProfile.staffWebhooks?.telegramEnabled) {
        if (mode === 'declare') {
          await sendTelegramStaffAlert(
            `🚨 <b>COMMUNITY FIBER OUTAGE DECLARED</b>\n\n` +
              `📌 <b>Incident:</b> ${incidentNumber}\n` +
              `⚠️ <b>Scope:</b> ${targetEntityName} (${targetScope.toUpperCase()})\n` +
              `👥 <b>Impacted:</b> ${affectedSubscribers.length} subscribers\n` +
              `⏳ <b>ETR:</b> ${activeEtr}\n` +
              `🔧 <b>Type:</b> ${outageTypeLabels[outageType]}\n` +
              `👤 <b>Declared By:</b> ${declaredBy}\n\n` +
              `📝 <b>Subscriber Advisory:</b>\n<i>"${activeMessage}"</i>`,
            businessProfile.staffWebhooks
          );
        } else {
          await sendTelegramStaffAlert(
            `🟢 <b>FIBER SERVICE RESTORED & RESOLVED</b>\n\n` +
              `📌 <b>Incident:</b> ${incidentNumber}\n` +
              `✅ <b>Scope:</b> ${targetEntityName}\n` +
              `👥 <b>Notified:</b> ${affectedSubscribers.length} subscribers\n` +
              `⏰ <b>Restoration Time:</b> ${restoredTime}\n` +
              `👤 <b>Resolved By:</b> ${declaredBy}\n\n` +
              `📝 <b>Restoration Notice:</b>\n<i>"${activeMessage}"</i>`,
            businessProfile.staffWebhooks
          );
        }
      }

      // 3. Dispatch Staff Discord Embed
      if (sendDiscord && businessProfile.staffWebhooks?.discordEnabled) {
        if (mode === 'declare') {
          await sendDiscordStaffAlert(
            `🚨 EMERGENCY FIBER OUTAGE: ${incidentNumber}`,
            `An emergency service interruption has been declared for **${targetEntityName}**.`,
            [
              { name: 'Incident Type', value: outageTypeLabels[outageType], inline: true },
              { name: 'Impacted Lines', value: `${affectedSubscribers.length} subscribers`, inline: true },
              { name: 'Estimated ETR', value: activeEtr, inline: true },
              { name: 'Target Scope', value: targetScope.toUpperCase(), inline: true },
              { name: 'Dispatched Channels', value: channelsSent.join(', ').toUpperCase(), inline: true },
              { name: 'Declared By', value: declaredBy, inline: true },
            ],
            0xef4444, // Red
            businessProfile.staffWebhooks
          );
        } else {
          await sendDiscordStaffAlert(
            `🟢 SERVICE RESTORED: ${incidentNumber}`,
            `Service interruption for **${targetEntityName}** has been marked **RESOLVED**.`,
            [
              { name: 'Incident', value: incidentNumber, inline: true },
              { name: 'Target Scope', value: targetEntityName, inline: true },
              { name: 'Restored At', value: restoredTime, inline: true },
              { name: 'Subscribers Notified', value: `${affectedSubscribers.length} lines`, inline: true },
              { name: 'Status', value: '🟢 Operational & Clear', inline: true },
              { name: 'Resolved By', value: declaredBy, inline: true },
            ],
            0x10b981, // Emerald Green
            businessProfile.staffWebhooks
          );
        }
      }

      // 4. Record & Audit Log
      const outageRecord: OutageBroadcastRecord = {
        id: initialRecord?.id || `outage-${Date.now()}`,
        incidentNumber,
        type: outageType,
        title:
          mode === 'restore'
            ? `Service Restored - ${targetEntityName}`
            : `Service Interruption - ${targetEntityName}`,
        description: activeMessage,
        targetScope,
        targetEntityId: targetScope === 'user' ? selectedCustomerId : targetEntityId,
        targetEntityName,
        impactedSubscribersCount: affectedSubscribers.length,
        estimatedRestorationTime: mode === 'restore' ? `Restored at ${restoredTime}` : activeEtr,
        advisoryMessage: activeMessage,
        channelsSent,
        status: mode === 'restore' ? 'resolved' : 'active_outage',
        declaredBy,
        declaredAt: initialRecord?.declaredAt || new Date().toISOString(),
        resolvedAt: mode === 'restore' ? new Date().toISOString() : initialRecord?.resolvedAt,
        resolvedBy: mode === 'restore' ? declaredBy : initialRecord?.resolvedBy,
        restorationMessage: mode === 'restore' ? activeMessage : initialRecord?.restorationMessage,
      };

      logAuditEvent({
        userName: declaredBy,
        action: mode === 'restore' ? 'OUTAGE_RESTORATION_DISPATCHED' : 'OUTAGE_BROADCAST_DISPATCHED',
        category: 'network',
        severity: mode === 'restore' ? 'info' : 'critical',
        details:
          mode === 'restore'
            ? `Dispatched restoration notice (${incidentNumber}) for ${targetEntityName} to ${sentCount} subscribers.`
            : `Declared fiber outage (${incidentNumber}) for ${targetEntityName}. Impacted: ${sentCount} subscribers. ETR: ${activeEtr}.`,
        status: 'success',
      });

      showToast(
        'success',
        mode === 'restore' ? 'Service Restored Blast Complete' : 'Emergency Outage Dispatched',
        `Broadcasted ${mode === 'restore' ? 'restoration notice' : 'outage alert'} to ${sentCount} subscribers in ${targetEntityName}.`
      );

      if (onBroadcastComplete) onBroadcastComplete(outageRecord);
      onClose();
    } catch (err: any) {
      console.error('Outage blast error:', err);
      showToast('error', 'Broadcast Failed', err.message || 'Failed to dispatch broadcast.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className={`p-4 sm:p-5 border-b flex flex-wrap items-center justify-between gap-3 transition-colors ${
            mode === 'declare'
              ? 'bg-rose-950/40 border-rose-900/50'
              : 'bg-emerald-950/40 border-emerald-900/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border font-bold ${
                mode === 'declare'
                  ? 'bg-rose-600/20 text-rose-400 border-rose-500/30'
                  : 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {mode === 'declare' ? (
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-100">
                  {mode === 'declare'
                    ? 'Emergency Fiber Outage Broadcast Engine'
                    : 'Service Restoration & All-Clear Dispatcher'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    mode === 'declare'
                      ? 'bg-rose-950 text-rose-300 border-rose-800/60'
                      : 'bg-emerald-950 text-emerald-300 border-emerald-800/60'
                  }`}
                >
                  {incidentNumber}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {mode === 'declare'
                  ? 'Broadcast targeted outage advisories across affected NAP boxes, PON sectors, or coverage areas.'
                  : 'Notify subscribers that service has been restored and guide them through self-service recovery.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            <div className="bg-slate-950/80 p-1 rounded-2xl border border-slate-800 flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode('declare');
                  setIsCustomTextMode(false);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                  mode === 'declare'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Declare Outage</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('restore');
                  setIsCustomTextMode(false);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                  mode === 'restore'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Service Restored</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content (Dual Column) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* Left Column: Form Controls (7 cols) */}
          <div className="lg:col-span-7 p-5 sm:p-6 space-y-5 text-xs">
            {/* Incident Type & Target Scope */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mode === 'declare' ? (
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Incident Type *</label>
                    <select
                      value={outageType}
                      onChange={(e) => {
                        setOutageType(e.target.value as OutageType);
                        setIsCustomTextMode(false);
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-medium"
                    >
                      <option value="fiber_cut">🪓 Fiber Cable Cut (Tree / Excavation)</option>
                      <option value="olt_pon_failure">⚡ OLT PON Port Degradation</option>
                      <option value="power_interruption">🔌 Commercial Power Interruption (Genset)</option>
                      <option value="emergency_splicing">🔧 Emergency Core Splicing & Alignment</option>
                      <option value="scheduled_maintenance">📅 Scheduled Network Maintenance</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Restoration Timestamp *</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={restoredTime}
                        onChange={(e) => {
                          setRestoredTime(e.target.value);
                          setIsCustomTextMode(false);
                        }}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                        placeholder="e.g. 10:30 AM PHT"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setRestoredTime(
                            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' PHT'
                          )
                        }
                        className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium shrink-0"
                        title="Reset to current time"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Broadcast Scope *</label>
                  <select
                    value={targetScope}
                    onChange={(e) => {
                      const scope = e.target.value as any;
                      setTargetScope(scope);
                      setIsCustomTextMode(false);
                      if (scope === 'nap_box') setTargetEntityId(napBoxes[0]?.id || '');
                      if (scope === 'olt_pon') setTargetEntityId(availablePonPorts[0] || 'PON-1/1');
                      if (scope === 'barangay') setTargetEntityId(availableBarangays[0] || 'Binauahan');
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
                  >
                    <option value="nap_box">🎯 By Specific Fiber NAP Box</option>
                    <option value="olt_pon">🌐 By OLT PON Port</option>
                    <option value="barangay">📍 By Coverage Area / Barangay</option>
                    <option value="user">👤 Per User (Single Subscriber)</option>
                    <option value="all">🚨 Global Network (All Active Subscribers)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Target Entity Selector */}
              {targetScope === 'nap_box' && (
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5 animate-in fade-in">
                  <label className="block text-slate-400 font-semibold">Select Affected Fiber NAP Box *</label>
                  <select
                    value={targetEntityId}
                    onChange={(e) => {
                      setTargetEntityId(e.target.value);
                      setIsCustomTextMode(false);
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
                  >
                    {napBoxes.map((nap) => {
                      const occupiedCount = customers.filter(
                        (c) => c.network?.napBoxId === nap.id && c.status !== 'disconnected'
                      ).length;
                      return (
                        <option key={nap.id} value={nap.id}>
                          {nap.name} (Brgy. {nap.barangay}) • {occupiedCount} connected subscriber{occupiedCount === 1 ? '' : 's'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {targetScope === 'olt_pon' && (
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5 animate-in fade-in">
                  <label className="block text-slate-400 font-semibold">Select OLT Optical PON Port *</label>
                  <select
                    value={targetEntityId}
                    onChange={(e) => {
                      setTargetEntityId(e.target.value);
                      setIsCustomTextMode(false);
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  >
                    {availablePonPorts.map((pon) => {
                      const count = customers.filter(
                        (c) => (c.network?.oltPonPort || 'PON-1/1') === pon && c.status !== 'disconnected'
                      ).length;
                      return (
                        <option key={pon} value={pon}>
                          {pon} — {count} active subscriber{count === 1 ? '' : 's'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {targetScope === 'barangay' && (
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5 animate-in fade-in">
                  <label className="block text-slate-400 font-semibold">Select Target Coverage Area / Barangay *</label>
                  <select
                    value={targetEntityId}
                    onChange={(e) => {
                      setTargetEntityId(e.target.value);
                      setIsCustomTextMode(false);
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
                  >
                    {availableBarangays.map((b) => {
                      const count = customers.filter(
                        (c) =>
                          (c.address?.barangay || '').toLowerCase() === b.toLowerCase() &&
                          c.status !== 'disconnected'
                      ).length;
                      return (
                        <option key={b} value={b}>
                          Brgy. {b} — {count} active subscriber{count === 1 ? '' : 's'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {targetScope === 'user' && (
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <label className="block text-slate-400 font-semibold">Select Specific Subscriber Account *</label>
                    <span className="text-[10px] text-slate-500">Search by Name or Account #</span>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={subscriberSearch}
                      onChange={(e) => setSubscriberSearch(e.target.value)}
                      placeholder="Type to filter subscribers..."
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value);
                      setIsCustomTextMode(false);
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500 font-medium"
                  >
                    {searchedCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.accountNo}) • Brgy. {c.address?.barangay || 'N/A'} • {c.planName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetScope === 'all' && (
                <div className="p-3 rounded-2xl bg-rose-950/30 border border-rose-800/40 flex items-center justify-between animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span className="text-slate-200">
                      Broadcasting to all <strong>{affectedSubscribers.length} subscribers</strong> across the entire network footprint.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Impact Calculation & ETR / Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between transition-colors ${
                  mode === 'declare'
                    ? 'bg-rose-950/30 border-rose-800/50'
                    : 'bg-emerald-950/30 border-emerald-800/50'
                }`}
              >
                <div>
                  <span className="text-[11px] text-slate-400 block font-semibold">
                    {mode === 'declare' ? 'Impacted Subscribers:' : 'Subscribers to Notify:'}
                  </span>
                  <span
                    className={`text-2xl font-black font-mono ${
                      mode === 'declare' ? 'text-rose-300' : 'text-emerald-300'
                    }`}
                  >
                    {affectedSubscribers.length} Accounts
                  </span>
                </div>
                <Users
                  className={`w-6 h-6 opacity-80 ${
                    mode === 'declare' ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                />
              </div>

              {mode === 'declare' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">Estimated Restoration (ETR):</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomEtr(!isCustomEtr);
                        setIsCustomTextMode(false);
                      }}
                      className="text-[10px] text-cyan-400 hover:underline"
                    >
                      {isCustomEtr ? 'Use Preset Dropdown' : 'Enter Custom ETR'}
                    </button>
                  </div>
                  {isCustomEtr ? (
                    <input
                      type="text"
                      value={customEtr}
                      onChange={(e) => {
                        setCustomEtr(e.target.value);
                        setIsCustomTextMode(false);
                      }}
                      placeholder="e.g. Today by 4:30 PM PHT"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-medium focus:outline-none focus:border-rose-500"
                    />
                  ) : (
                    <select
                      value={etrPreset}
                      onChange={(e) => {
                        setEtrPreset(e.target.value);
                        setIsCustomTextMode(false);
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-medium focus:outline-none focus:border-rose-500"
                    >
                      <option value="1 - 2 Hours">1 - 2 Hours (Minor Splice / Fast Connector)</option>
                      <option value="2 - 3 Hours">2 - 3 Hours (Core Alignment / NAP Splicing)</option>
                      <option value="4 - 6 Hours">4 - 6 Hours (Major Feeder Cable Span Pull)</option>
                      <option value="Upon CASURECO Power Return">Upon CASURECO Commercial Power Return</option>
                      <option value="Within 24 Hours">Within 24 Hours (Scheduled Backbone Maintenance)</option>
                    </select>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-0.5">Router Reboot Guidance</label>
                    <p className="text-[10px] text-slate-400">
                      Instruct subscribers to reboot ONU/router for 10s
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeRebootGuide}
                    onChange={(e) => {
                      setIncludeRebootGuide(e.target.checked);
                      setIsCustomTextMode(false);
                    }}
                    className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Broadcast Channels */}
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
              <span className="font-semibold text-slate-300 block">Dispatch Channels:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={sendSms}
                    onChange={(e) => setSendSms(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-200">SMS Gateway</span>
                    <span className="text-[9px] text-slate-500 uppercase">
                      {businessProfile.smsGateway?.provider || 'SANDBOX'}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-200">SMTP Email</span>
                    <span className="text-[9px] text-slate-500">
                      {businessProfile.smtp?.enabled ? 'Active' : 'Offline'}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={sendTelegram}
                    onChange={(e) => setSendTelegram(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-200">Telegram NOC</span>
                    <span className="text-[9px] text-slate-500">
                      {businessProfile.staffWebhooks?.telegramEnabled ? 'Connected' : 'Disabled'}
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={sendDiscord}
                    onChange={(e) => setSendDiscord(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-200">Discord Staff</span>
                    <span className="text-[9px] text-slate-500">
                      {businessProfile.staffWebhooks?.discordEnabled ? 'Connected' : 'Disabled'}
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Advisory Message Text & Chips */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-300 flex items-center gap-2">
                  <span>Advisory Text Template</span>
                  {isCustomTextMode && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/40 text-[10px]">
                      Customized
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  {isCustomTextMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomTextMode(false);
                        setCustomAdvisory('');
                      }}
                      className="text-[10px] text-rose-400 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Revert to Auto Template</span>
                    </button>
                  )}
                  <span className="text-[10px] text-slate-500">{activeMessage.length} chars</span>
                </div>
              </div>

              {/* Merge Variable Chips */}
              <div className="flex flex-wrap items-center gap-1.5 py-1">
                <span className="text-[10px] text-slate-500">Insert tag:</span>
                {[
                  { tag: '{name}', label: 'Name' },
                  { tag: '{accountNo}', label: 'Account #' },
                  { tag: '{barangay}', label: 'Barangay' },
                  { tag: '{scope}', label: 'Scope' },
                  { tag: '{entity}', label: 'Target' },
                  { tag: '{incident}', label: 'Incident #' },
                  { tag: '{etr}', label: 'ETR' },
                  { tag: '{hotline}', label: 'Hotline' },
                ].map((chip) => (
                  <button
                    key={chip.tag}
                    type="button"
                    onClick={() => insertMergeTag(chip.tag)}
                    className="px-2 py-0.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500 text-cyan-300 font-mono text-[10px] transition-colors"
                  >
                    +{chip.label}
                  </button>
                ))}
              </div>

              <textarea
                rows={4}
                value={activeMessage}
                onChange={(e) => {
                  setIsCustomTextMode(true);
                  setCustomAdvisory(e.target.value);
                }}
                className={`w-full p-3 bg-slate-950 border rounded-2xl text-slate-200 font-mono text-xs focus:outline-none transition-all ${
                  mode === 'declare' ? 'border-rose-900/50 focus:border-rose-500' : 'border-emerald-900/50 focus:border-emerald-500'
                }`}
              />
            </div>
          </div>

          {/* Right Column: Interactive Live Preview & Impacted Recipients (5 cols) */}
          <div className="lg:col-span-5 p-5 sm:p-6 bg-slate-950/40 flex flex-col space-y-4">
            {/* Top Preview Selector Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRightPanelTab('preview')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                    rightPanelTab === 'preview'
                      ? 'bg-slate-800 text-cyan-300 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Phone Preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRightPanelTab('subscribers')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all ${
                    rightPanelTab === 'subscribers'
                      ? 'bg-slate-800 text-cyan-300 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Recipients ({affectedSubscribers.length})</span>
                </button>
              </div>

              <span className="text-[10px] text-slate-500 font-mono">
                {Math.ceil(livePreviewText.length / 160)} SMS Segment
              </span>
            </div>

            {rightPanelTab === 'preview' ? (
              /* Live Smartphone Simulator */
              <div className="flex-1 flex flex-col items-center justify-center p-2">
                <div className="w-full max-w-[320px] bg-slate-900 border-2 border-slate-700/80 rounded-[36px] shadow-2xl p-3 space-y-3 relative overflow-hidden">
                  {/* Phone Notch & Status Bar */}
                  <div className="flex items-center justify-between px-2 pt-1 text-[10px] text-slate-400">
                    <span className="font-semibold">9:41</span>
                    <div className="w-16 h-3.5 bg-slate-950 rounded-full mx-auto" />
                    <div className="flex items-center gap-1">
                      <Wifi className="w-3 h-3 text-slate-400" />
                      <span className="font-mono text-[9px]">5G</span>
                    </div>
                  </div>

                  {/* Messaging App Header */}
                  <div className="bg-slate-950/80 p-2.5 rounded-2xl border border-slate-800/80 flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border ${
                        mode === 'declare'
                          ? 'bg-rose-600/20 text-rose-400 border-rose-500/30'
                          : 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {(businessProfile.tradeName || businessProfile.name || 'SS').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h6 className="font-bold text-xs text-slate-100 truncate">
                        {businessProfile.tradeName || 'SWIFTSTREAM'}
                      </h6>
                      <p className="text-[10px] text-slate-400 truncate">
                        Official Network Broadcast
                      </p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>

                  {/* SMS Message Bubble */}
                  <div className="space-y-2 py-2">
                    <div className="text-center">
                      <span className="text-[9px] text-slate-500 bg-slate-950/60 px-2 py-0.5 rounded-full">
                        Today, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl border text-xs leading-relaxed font-sans shadow-md space-y-2 ${
                        mode === 'declare'
                          ? 'bg-rose-950/30 border-rose-800/60 text-rose-100'
                          : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                        {mode === 'declare' ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            <span className="text-rose-400">Emergency Outage Notice</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Service Restored Notice</span>
                          </>
                        )}
                      </div>

                      <p className="whitespace-pre-line text-slate-200 text-[11px]">
                        {livePreviewText}
                      </p>

                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Recipient: {previewCustomer?.fullName || 'Subscriber'}</span>
                        <span className="font-mono text-cyan-400">
                          {previewCustomer?.mobile || '09XXXXXXXXX'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SMS Input Mockup */}
                  <div className="bg-slate-950 p-2 rounded-2xl border border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Replies routed to NOC desk</span>
                    <span className="text-cyan-400 font-bold">SMS</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Impacted Subscribers List */
              <div className="flex-1 flex flex-col space-y-2 overflow-y-auto max-h-[360px] pr-1">
                {affectedSubscribers.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>No subscribers match this target scope.</p>
                  </div>
                ) : (
                  affectedSubscribers.map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-slate-200 truncate">{c.fullName}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {c.accountNo} • Brgy. {c.address?.barangay || 'N/A'} • {c.planName}
                        </p>
                      </div>
                      <span className="font-mono text-[11px] text-cyan-400 shrink-0">
                        {c.mobile || 'No Mobile'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer / Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>
              Target: <strong>{targetEntityName}</strong> ({affectedSubscribers.length} lines)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-xs transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSending || affectedSubscribers.length === 0}
              onClick={() => setShowConfirmBlast(true)}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 text-white ${
                mode === 'declare'
                  ? 'bg-gradient-to-r from-rose-600 to-red-600 shadow-rose-600/30'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-600/30'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>
                {isSending
                  ? 'Blasting Advisories...'
                  : mode === 'declare'
                  ? `Dispatch Outage Blast (${affectedSubscribers.length} Subscribers)`
                  : `Dispatch Restoration Blast (${affectedSubscribers.length} Subscribers)`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Step Dialog */}
      {showConfirmBlast && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 text-xs animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border font-bold ${
                  mode === 'declare'
                    ? 'bg-rose-600/20 text-rose-400 border-rose-500/30'
                    : 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {mode === 'declare' ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100">
                  {mode === 'declare' ? 'Confirm Emergency Outage Blast' : 'Confirm Service Restoration Blast'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  Are you sure you want to broadcast this advisory?
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Incident Reference:</span>
                <strong className="font-mono text-slate-200">{incidentNumber}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Target Entity:</span>
                <strong className="text-slate-200">{targetEntityName}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Subscribers:</span>
                <strong className="text-cyan-400 font-bold">{affectedSubscribers.length} Accounts</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Channels:</span>
                <strong className="text-slate-200">
                  {[
                    sendSms ? 'SMS' : null,
                    sendEmail ? 'Email' : null,
                    sendTelegram ? 'Telegram' : null,
                    sendDiscord ? 'Discord' : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>{mode === 'declare' ? 'Estimated ETR:' : 'Restoration Time:'}</span>
                <strong className="text-amber-300">
                  {mode === 'declare' ? activeEtr : restoredTime}
                </strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmBlast(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
              >
                Back to Review
              </button>
              <button
                type="button"
                onClick={handleExecuteBroadcast}
                className={`px-5 py-2 rounded-xl font-bold text-white shadow-lg transition-all ${
                  mode === 'declare'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                }`}
              >
                Yes, Dispatch Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
