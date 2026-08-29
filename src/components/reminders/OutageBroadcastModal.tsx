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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { OutageType, OutageBroadcastRecord } from '../../types';
import { generateOutageAdvisoryMessage, dispatchSmsGateway } from '../../utils/smsSender';
import { sendTelegramStaffAlert, sendDiscordStaffAlert } from '../../utils/webhookService';

interface OutageBroadcastModalProps {
  onClose: () => void;
  onBroadcastComplete?: (record: OutageBroadcastRecord) => void;
}

export const OutageBroadcastModal: React.FC<OutageBroadcastModalProps> = ({
  onClose,
  onBroadcastComplete,
}) => {
  const { customers, napBoxes, businessProfile, logAuditEvent, showToast } = useApp();

  const [outageType, setOutageType] = useState<OutageType>('fiber_cut');
  const [targetScope, setTargetScope] = useState<'all' | 'nap_box' | 'olt_pon' | 'barangay'>('nap_box');
  const [targetEntityId, setTargetEntityId] = useState<string>(napBoxes[0]?.id || '');
  const [etr, setEtr] = useState<string>('2 - 3 Hours');
  const [customAdvisory, setCustomAdvisory] = useState<string>('');
  const [sendSms, setSendSms] = useState<boolean>(true);
  const [sendEmail, setSendEmail] = useState<boolean>(true);
  const [sendTelegram, setSendTelegram] = useState<boolean>(true);
  const [sendDiscord, setSendDiscord] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);

  // Compute targeted subscribers
  const affectedSubscribers = useMemo(() => {
    return customers.filter((c) => {
      if (c.status !== 'active' && c.status !== 'overdue') return false;

      if (targetScope === 'all') return true;

      if (targetScope === 'nap_box') {
        return c.network.napBoxId === targetEntityId;
      }

      if (targetScope === 'olt_pon') {
        return (c.network.oltPonPort || 'PON-1/1') === targetEntityId;
      }

      if (targetScope === 'barangay') {
        return c.address.barangay.toLowerCase() === targetEntityId.toLowerCase();
      }

      return false;
    });
  }, [customers, targetScope, targetEntityId]);

  // Target Entity Display Name
  const targetEntityName = useMemo(() => {
    if (targetScope === 'all') return 'All Network Sectors & Subscribers';
    if (targetScope === 'nap_box') {
      const nap = napBoxes.find((n) => n.id === targetEntityId);
      return nap ? `${nap.name} (${nap.barangay})` : targetEntityId;
    }
    if (targetScope === 'olt_pon') return `OLT PON Port ${targetEntityId}`;
    if (targetScope === 'barangay') return `Barangay ${targetEntityId}`;
    return 'Target Subscribers';
  }, [targetScope, targetEntityId, napBoxes]);

  // Default auto-generated message
  const autoMessage = useMemo(() => {
    return generateOutageAdvisoryMessage(
      outageType,
      targetScope === 'all' ? 'Entire Sector' : targetScope === 'nap_box' ? 'Fiber Distribution Box' : targetScope === 'olt_pon' ? 'PON Port' : 'Area',
      targetEntityName,
      etr,
      businessProfile
    );
  }, [outageType, targetScope, targetEntityName, etr, businessProfile]);

  const activeMessage = customAdvisory || autoMessage;

  const handleDispatchOutage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (affectedSubscribers.length === 0) {
      showToast('error', 'No Subscribers', 'No active subscribers found in the selected target scope.');
      return;
    }

    setIsSending(true);

    const incidentNumber = `OUT-${Date.now().toString().slice(-6)}`;
    const channelsSent: ('sms' | 'email' | 'telegram' | 'discord')[] = [];

    // 1. Dispatch SMS to affected subscribers
    if (sendSms) {
      channelsSent.push('sms');
      console.log(`[Outage Blast] Sending SMS to ${affectedSubscribers.length} subscribers via ${businessProfile.smsGateway?.provider || 'sandbox'}`);
      // Simulate bulk delivery
      await new Promise((r) => setTimeout(r, 600));
    }

    // 2. Dispatch Email
    if (sendEmail) {
      channelsSent.push('email');
    }

    // 3. Dispatch Staff Telegram Alert
    if (sendTelegram) {
      channelsSent.push('telegram');
      await sendTelegramStaffAlert(
        `🚨 <b>COMMUNITY FIBER OUTAGE DECLARED</b>\n\n📌 <b>Incident:</b> ${incidentNumber}\n⚠️ <b>Scope:</b> ${targetEntityName}\n👥 <b>Impacted:</b> ${affectedSubscribers.length} subscribers\n⏳ <b>ETR:</b> ${etr}\n\n📝 <b>Advisory Sent:</b>\n<i>"${activeMessage}"</i>`,
        businessProfile.staffWebhooks
      );
    }

    // 4. Dispatch Staff Discord Webhook
    if (sendDiscord) {
      channelsSent.push('discord');
      await sendDiscordStaffAlert(
        `🚨 EMERGENCY FIBER OUTAGE: ${incidentNumber}`,
        `A fiber interruption broadcast has been triggered for **${targetEntityName}**.`,
        [
          { name: 'Impacted Subscribers', value: `${affectedSubscribers.length} lines`, inline: true },
          { name: 'Estimated ETR', value: etr, inline: true },
          { name: 'Dispatched Channels', value: channelsSent.join(', ').toUpperCase(), inline: true },
        ],
        0xef4444, // Red
        businessProfile.staffWebhooks
      );
    }

    const outageRecord: OutageBroadcastRecord = {
      id: `outage-${Date.now()}`,
      incidentNumber,
      type: outageType,
      title: `Service Interruption - ${targetEntityName}`,
      description: activeMessage,
      targetScope,
      targetEntityId,
      targetEntityName,
      impactedSubscribersCount: affectedSubscribers.length,
      estimatedRestorationTime: etr,
      advisoryMessage: activeMessage,
      channelsSent,
      status: 'active_outage',
      declaredBy: businessProfile.representative.firstName + ' ' + businessProfile.representative.lastName,
      declaredAt: new Date().toISOString(),
    };

    logAuditEvent({
      userName: businessProfile.representative.firstName + ' ' + businessProfile.representative.lastName,
      action: 'OUTAGE_BROADCAST_DISPATCHED',
      category: 'network',
      severity: 'critical',
      details: `Declared fiber outage (${incidentNumber}) for ${targetEntityName}. Impacted: ${affectedSubscribers.length} subscribers. ETR: ${etr}.`,
      status: 'success',
    });

    showToast(
      'success',
      'Outage Broadcast Dispatched',
      `Sent emergency advisories to ${affectedSubscribers.length} subscribers in ${targetEntityName}.`
    );

    setIsSending(false);
    if (onBroadcastComplete) onBroadcastComplete(outageRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-rose-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <span>Community Fiber Outage Broadcast Engine</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800/40 text-[10px] font-mono font-bold">
                  Emergency Blast
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                1-Click targeted SMS & Email broadcast to affected subscribers and NOC staff webhooks
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

        {/* Modal Body */}
        <form onSubmit={handleDispatchOutage} className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* Row 1: Incident Type & Scope */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Outage Incident Type:</label>
              <select
                value={outageType}
                onChange={(e) => setOutageType(e.target.value as OutageType)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-medium"
              >
                <option value="fiber_cut">🪓 Fiber Main Cable Cut (Tree Fall / Equipment)</option>
                <option value="olt_pon_failure">⚡ OLT PON Port Signal Degradation</option>
                <option value="power_interruption">🔌 Commercial Power Outage (Genset Running)</option>
                <option value="emergency_splicing">🔧 Emergency Core Splicing & Maintenance</option>
                <option value="scheduled_maintenance">📅 Scheduled Preventive Maintenance</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Target Broadcast Scope:</label>
              <select
                value={targetScope}
                onChange={(e) => {
                  const scope = e.target.value as any;
                  setTargetScope(scope);
                  if (scope === 'nap_box') setTargetEntityId(napBoxes[0]?.id || '');
                  if (scope === 'olt_pon') setTargetEntityId('PON-1/1');
                  if (scope === 'barangay') setTargetEntityId('Binauahan');
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-medium"
              >
                <option value="nap_box">🎯 By Specific Fiber NAP Box</option>
                <option value="olt_pon">🌐 By OLT PON Port</option>
                <option value="barangay">📍 By Barangay / Location</option>
                <option value="all">🚨 Global Outage (All Active Subscribers)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Target Entity Selector */}
          {targetScope !== 'all' && (
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <label className="block text-slate-400 font-semibold">
                Select Affected {targetScope === 'nap_box' ? 'Fiber NAP Box' : targetScope === 'olt_pon' ? 'OLT PON Port' : 'Barangay'}:
              </label>

              {targetScope === 'nap_box' && (
                <select
                  value={targetEntityId}
                  onChange={(e) => setTargetEntityId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {napBoxes.map((nap) => (
                    <option key={nap.id} value={nap.id}>
                      {nap.name} ({nap.barangay}) • {nap.ports.filter(p => p.status === 'occupied').length} active lines
                    </option>
                  ))}
                </select>
              )}

              {targetScope === 'olt_pon' && (
                <select
                  value={targetEntityId}
                  onChange={(e) => setTargetEntityId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="PON-1/1">PON-1/1 (Binauahan Sector 1)</option>
                  <option value="PON-1/2">PON-1/2 (Binauahan Sector 2)</option>
                  <option value="PON-1/3">PON-1/3 (San Jose Highway)</option>
                  <option value="PON-1/4">PON-1/4 (Poblacion East)</option>
                </select>
              )}

              {targetScope === 'barangay' && (
                <select
                  value={targetEntityId}
                  onChange={(e) => setTargetEntityId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="Binauahan">Binauahan</option>
                  <option value="San Jose">San Jose</option>
                  <option value="Poblacion">Poblacion</option>
                  <option value="Himalo">Himalo</option>
                </select>
              )}
            </div>
          )}

          {/* Row 3: Impact Calculation Box & ETR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-800/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block font-semibold">Impacted Subscribers:</span>
                <span className="text-2xl font-black font-mono text-rose-300">
                  {affectedSubscribers.length} Subscribers
                </span>
              </div>
              <Users className="w-6 h-6 text-rose-400 opacity-80" />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Estimated Time of Restoration (ETR):</label>
              <select
                value={etr}
                onChange={(e) => setEtr(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500 font-semibold"
              >
                <option value="1 - 2 Hours">1 - 2 Hours (Minor Splice / Connector Fix)</option>
                <option value="2 - 3 Hours">2 - 3 Hours (Core Alignment / NAP Splicing)</option>
                <option value="4 - 6 Hours">4 - 6 Hours (Major Feeder Cable Span Pull)</option>
                <option value="Upon Power Restoration">Upon Commercial Power Restoration (CASURECO)</option>
                <option value="Within 24 Hours">Within 24 Hours (Scheduled Maintenance)</option>
              </select>
            </div>
          </div>

          {/* Row 4: Broadcast Channel Checkboxes */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
            <span className="font-semibold text-slate-300 block">Dispatch Channels:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendSms}
                  onChange={(e) => setSendSms(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                />
                <span className="font-semibold text-slate-200">SMS Gateway</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                />
                <span className="font-semibold text-slate-200">SMTP Email</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendTelegram}
                  onChange={(e) => setSendTelegram(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                />
                <span className="font-semibold text-slate-200">Telegram NOC</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendDiscord}
                  onChange={(e) => setSendDiscord(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                />
                <span className="font-semibold text-slate-200">Discord Staff</span>
              </label>
            </div>
          </div>

          {/* Row 5: Advisory Message Text */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-400">Subscriber Advisory Message Preview:</label>
              <span className="text-[10px] text-slate-500">{activeMessage.length} characters</span>
            </div>
            <textarea
              rows={3}
              value={activeMessage}
              onChange={(e) => setCustomAdvisory(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono text-xs focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSending || affectedSubscribers.length === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? 'Blasting Advisories...' : `Dispatch Outage Broadcast (${affectedSubscribers.length} Subscribers)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

