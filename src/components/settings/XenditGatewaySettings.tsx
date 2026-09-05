import React, { useState } from 'react';
import {
  CreditCard,
  Key,
  ExternalLink,
  Save,
  Check,
  Copy,
  Eye,
  EyeOff,
  ShieldCheck,
  Tag,
  Clock,
  Zap,
  Globe,
  DollarSign,
  Layers,
  Activity,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { XenditConfig } from '../../types';
import { testXenditConnection } from '../../utils/xenditService';

interface XenditGatewaySettingsProps {
  onSaved?: () => void;
}

const ALL_XENDIT_CHANNELS = [
  'GCash',
  'Maya',
  'GrabPay',
  'ShopeePay',
  'QRPh',
  'BPI',
  'UnionBank',
  'BDO',
  'RCBC',
  'China Bank',
  'BPI Direct Debit',
  'UnionBank Direct Debit',
  'BDO Direct Debit',
  'RCBC Direct Debit',
  'China Bank Direct Debit',
];

const AUTO_DEBIT_CHANNELS = [
  'Debit / Credit Card',
  'GCash',
  'Maya',
  'BPI Direct Debit',
  'UnionBank Direct Debit',
  'BDO Direct Debit',
  'RCBC Direct Debit',
  'China Bank Direct Debit',
];

export const XenditGatewaySettings: React.FC<XenditGatewaySettingsProps> = ({ onSaved }) => {
  const { businessProfile, updateBusinessProfile, showToast, logAuditEvent } = useApp();

  const currentConfig: XenditConfig = businessProfile.paymentGateways.xenditConfig || {
    enabled: businessProfile.paymentGateways.isXenditEnabled ?? true,
    provider: 'Xendit',
    country: 'Philippines (Xendit PH)',
    isProduction: businessProfile.paymentGateways.xenditMode === 'live',
    secretKey: businessProfile.paymentGateways.xenditSecretKey || 'xnd_production_79182kLa90184ka0184019283ka81029',
    webhookToken: businessProfile.paymentGateways.xenditWebhookToken || 'wh_token_live_swiftstream_xnd_89127491',
    webhookUrl: 'https://swiftstreamnetwork.com/api/xendit/webhook',
    defaultChannel: 'GCASH',
    enabledChannels: [
      'GCash',
      'GrabPay',
      'ShopeePay',
      'QRPh',
      'BPI',
      'UnionBank',
      'BDO',
      'RCBC',
      'China Bank',
      'BPI Direct Debit',
      'UnionBank Direct Debit',
      'BDO Direct Debit',
      'RCBC Direct Debit',
      'China Bank Direct Debit',
    ],
    hasTransactionFee: true,
    transactionFeeAmount: 0,
    autoDebitEnabled: false,
    autoDebitChargeAfterDays: 1,
    autoDebitChannels: [
      'Debit / Credit Card',
      'GCash',
      'BPI Direct Debit',
      'UnionBank Direct Debit',
    ],
  };

  const [enabled, setEnabled] = useState<boolean>(currentConfig.enabled);
  const [provider, setProvider] = useState<XenditConfig['provider']>(currentConfig.provider);
  const [country, setCountry] = useState<XenditConfig['country']>(currentConfig.country);
  const [isProduction, setIsProduction] = useState<boolean>(currentConfig.isProduction);
  const [secretKey, setSecretKey] = useState<string>(currentConfig.secretKey);
  const [webhookToken, setWebhookToken] = useState<string>(currentConfig.webhookToken);
  const [webhookUrl, setWebhookUrl] = useState<string>(currentConfig.webhookUrl);
  const [defaultChannel, setDefaultChannel] = useState<string>(currentConfig.defaultChannel);
  const [enabledChannels, setEnabledChannels] = useState<string[]>(currentConfig.enabledChannels || []);
  const [hasTransactionFee, setHasTransactionFee] = useState<boolean>(currentConfig.hasTransactionFee);
  const [transactionFeeAmount, setTransactionFeeAmount] = useState<number>(currentConfig.transactionFeeAmount);
  const [autoDebitEnabled, setAutoDebitEnabled] = useState<boolean>(currentConfig.autoDebitEnabled);
  const [autoDebitChargeAfterDays, setAutoDebitChargeAfterDays] = useState<number>(currentConfig.autoDebitChargeAfterDays);
  const [autoDebitChannels, setAutoDebitChannels] = useState<string[]>(currentConfig.autoDebitChannels || []);

  const [showSecretKey, setShowSecretKey] = useState<boolean>(false);
  const [showWebhookToken, setShowWebhookToken] = useState<boolean>(false);
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTestingApi, setIsTestingApi] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    if (!secretKey) {
      showToast('warning', 'Missing Key', 'Please enter a Xendit Secret Key first.');
      return;
    }
    setIsTestingApi(true);
    setTestResult(null);
    const res = await testXenditConnection(secretKey);
    setIsTestingApi(false);
    setTestResult(res);
    if (res.success) {
      showToast('success', 'Xendit Connected', res.message);
    } else {
      showToast('error', 'Connection Failed', res.message);
    }
  };

  const toggleChannel = (channel: string) => {
    setEnabledChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const toggleAutoDebitChannel = (channel: string) => {
    setAutoDebitChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
    showToast('info', 'Webhook URL Copied', 'Paste this URL into your Xendit Dashboard Webhook settings.');
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);

    const updatedXenditConfig: XenditConfig = {
      enabled,
      provider,
      country,
      isProduction,
      secretKey,
      webhookToken,
      webhookUrl,
      defaultChannel,
      enabledChannels,
      hasTransactionFee,
      transactionFeeAmount: Number(transactionFeeAmount) || 0,
      autoDebitEnabled,
      autoDebitChargeAfterDays: Number(autoDebitChargeAfterDays) || 1,
      autoDebitChannels,
    };

    updateBusinessProfile({
      paymentGateways: {
        ...businessProfile.paymentGateways,
        isXenditEnabled: enabled,
        xenditMode: isProduction ? 'live' : 'test',
        xenditSecretKey: secretKey,
        xenditWebhookToken: webhookToken,
        xenditConfig: updatedXenditConfig,
      },
    });

    logAuditEvent({
      userName: `${businessProfile.representative.firstName} ${businessProfile.representative.lastName}`,
      action: 'XENDIT_SETTINGS_UPDATED',
      category: 'system',
      severity: 'info',
      details: `Updated Xendit Payment Gateway configuration. Mode: ${isProduction ? 'Live' : 'Sandbox'}, Enabled Channels: ${enabledChannels.length}.`,
      status: 'success',
    });

    showToast('success', 'Xendit Gateway Saved', 'Payment gateway credentials and channel rules successfully updated.');
    setIsSaving(false);
    if (onSaved) onSaved();
  };

  return (
    <div className="space-y-6 text-slate-100 font-sans text-xs">
      {/* 2-Column Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Gateway Credentials (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-card">
          {/* Header with Enable Toggle */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
                <CreditCard className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-100">Gateway Credentials</h3>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <span className="text-xs font-semibold text-slate-300">Enable Payment Gateway</span>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </div>
            </label>
          </div>

          {/* Provider & Country Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-slate-400">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="Xendit">Xendit</option>
                <option value="PayMongo">PayMongo</option>
                <option value="Dragonpay">Dragonpay</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-slate-400">Country</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="Philippines (Xendit PH)">Philippines (Xendit PH)</option>
                <option value="Indonesia (Xendit ID)">Indonesia (Xendit ID)</option>
                <option value="Malaysia (Xendit MY)">Malaysia (Xendit MY)</option>
                <option value="Vietnam (Xendit VN)">Vietnam (Xendit VN)</option>
                <option value="Thailand (Xendit TH)">Thailand (Xendit TH)</option>
              </select>
            </div>
          </div>

          {/* Production Mode (Live) Toggle */}
          <div className="flex items-center gap-3 pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={isProduction}
                  onChange={(e) => setIsProduction(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </div>
              <span className={`text-xs font-bold ${isProduction ? 'text-emerald-400' : 'text-slate-400'}`}>
                Production Mode (Live)
              </span>
            </label>
          </div>

          {/* Secret API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-medium text-slate-400">Xendit Secret API Key</label>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingApi}
                className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline disabled:opacity-50 cursor-pointer"
              >
                <Activity className={`w-3 h-3 ${isTestingApi ? 'animate-spin text-cyan-400' : ''}`} />
                <span>{isTestingApi ? 'Testing Handshake...' : 'Test API Connection'}</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showSecretKey ? 'text' : 'password'}
                value={secretKey}
                onChange={(e) => {
                  setSecretKey(e.target.value);
                  setTestResult(null);
                }}
                placeholder="xnd_production_..."
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
              >
                {showSecretKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {testResult && (
              <div
                className={`p-2.5 rounded-xl border text-[10px] flex items-center justify-between ${
                  testResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                <span>{testResult.message}</span>
                <span className="font-bold">{testResult.success ? '✓ VERIFIED' : 'FAILED'}</span>
              </div>
            )}
          </div>

          {/* Webhook Verification Token */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-400">
              Xendit Webhook Verification Token
            </label>
            <div className="relative">
              <input
                type={showWebhookToken ? 'text' : 'password'}
                value={webhookToken}
                onChange={(e) => setWebhookToken(e.target.value)}
                placeholder="wh_token_..."
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowWebhookToken(!showWebhookToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
              >
                {showWebhookToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Webhook URL with Copy button & presets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-medium text-slate-400">
                Webhook URL (Copy to Xendit Dashboard)
              </label>
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setWebhookUrl(`${window.location.origin}/api/xendit/webhook`)}
                  className="text-cyan-400 hover:underline cursor-pointer"
                >
                  Use Current Domain
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={() => setWebhookUrl('https://asia-southeast1-swiftstream-billing.cloudfunctions.net/xenditWebhook')}
                  className="text-cyan-400 hover:underline cursor-pointer"
                >
                  Use Cloud Function
                </button>
              </div>
            </div>
            <div className="relative flex items-center">
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-domain.com/api/xendit/webhook"
                className="w-full pl-3.5 pr-11 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleCopyWebhook}
                className="absolute right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                title="Copy Webhook URL to clipboard"
              >
                {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              Paste this URL into your Xendit Dashboard under <strong>Settings &rarr; Webhooks</strong> to receive automatic payment callbacks.
            </p>
          </div>

          {/* Online vs Cash Policy Note */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
            <span className="font-bold text-slate-300 block text-[11px]">💡 Online vs Cash Payments</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Subscribers paying online via <strong>GCash</strong>, <strong>Maya</strong>, <strong>QR Ph</strong>, or <strong>Cards</strong> are processed directly through Xendit with instant automated line un-isolation. <strong>Cash</strong> payments are recorded manually by authorized staff in the POS Terminal.
            </p>
          </div>
        </div>

        {/* Right Column: Channels & Auto-Debit (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-card">
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-100">Channels & Auto-Debit</h3>
          </div>

          {/* Default Channel Select */}
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-400">Default Channel</label>
            <select
              value={defaultChannel}
              onChange={(e) => setDefaultChannel(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 text-xs font-semibold focus:outline-none focus:border-cyan-500 uppercase tracking-wider"
            >
              <option value="GCASH">GCASH</option>
              <option value="QRPH">QRPH</option>
              <option value="MAYA">MAYA</option>
              <option value="GRABPAY">GRABPAY</option>
              <option value="SHOPEEPAY">SHOPEEPAY</option>
              <option value="BPI">BPI</option>
              <option value="UNIONBANK">UNIONBANK</option>
              <option value="BDO">BDO</option>
              <option value="RCBC">RCBC</option>
              <option value="CHINA BANK">CHINA BANK</option>
              <option value="BPI DIRECT DEBIT">BPI DIRECT DEBIT</option>
              <option value="UNIONBANK DIRECT DEBIT">UNIONBANK DIRECT DEBIT</option>
              <option value="BDO DIRECT DEBIT">BDO DIRECT DEBIT</option>
              <option value="RCBC DIRECT DEBIT">RCBC DIRECT DEBIT</option>
              <option value="CHINA BANK DIRECT DEBIT">CHINA BANK DIRECT DEBIT</option>
            </select>
          </div>

          {/* Enabled Payment Channels (Xendit PH) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-medium text-slate-400">
                Enabled Payment Channels (Xendit PH)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEnabledChannels([...ALL_XENDIT_CHANNELS])}
                  className="text-[10px] text-cyan-400 hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={() => setEnabledChannels([])}
                  className="text-[10px] text-slate-400 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Checkbox Grid (4 columns) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-2">
              {ALL_XENDIT_CHANNELS.map((ch) => {
                const isChecked = enabledChannels.includes(ch);
                return (
                  <label
                    key={ch}
                    className="flex items-center gap-2 cursor-pointer select-none group"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleChannel(ch)}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-500 accent-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span
                      className={`text-xs transition-colors ${
                        isChecked ? 'text-slate-200 font-medium' : 'text-slate-400 group-hover:text-slate-300'
                      }`}
                    >
                      {ch}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Xendit Transaction Fee */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-200 block">Xendit Transaction Fee</span>
                <p className="text-[11px] text-slate-400">
                  Add a fixed gateway fee to each online payment request.
                </p>
              </div>

              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={hasTransactionFee}
                  onChange={(e) => setHasTransactionFee(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </div>
            </div>

            {hasTransactionFee && (
              <div className="space-y-1 pt-1">
                <label className="block text-[11px] font-medium text-slate-400">Fee Amount (PHP)</label>
                <div className="relative max-w-full">
                  <Tag className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={transactionFeeAmount}
                    onChange={(e) => setTransactionFeeAmount(Number(e.target.value))}
                    placeholder="0"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Auto-Debit Configuration */}
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-200 block">Auto-Debit Configuration</span>
                <p className="text-[11px] text-slate-400">
                  Automatically charge recurring subscriber balances after invoice generation.
                </p>
              </div>

              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={autoDebitEnabled}
                  onChange={(e) => setAutoDebitEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </div>
            </div>

            {autoDebitEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-1">
                <div className="md:col-span-4 space-y-1">
                  <label className="block text-[11px] font-medium text-slate-400">Charge after (days)</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={autoDebitChargeAfterDays}
                    onChange={(e) => setAutoDebitChargeAfterDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AUTO_DEBIT_CHANNELS.map((ch) => {
                    const isChecked = autoDebitChannels.includes(ch);
                    return (
                      <label
                        key={ch}
                        className="flex items-center gap-2 cursor-pointer select-none group"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleAutoDebitChannel(ch)}
                          className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-500 accent-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                        <span
                          className={`text-xs transition-colors ${
                            isChecked ? 'text-slate-200 font-medium' : 'text-slate-400 group-hover:text-slate-300'
                          }`}
                        >
                          {ch}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Actions Bar */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <a
          href="https://dashboard.xendit.co/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded-2xl text-xs font-semibold transition-all hover:scale-[1.02]"
        >
          <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
          <span>Open Monitor</span>
        </a>

        <button
          type="button"
          onClick={() => handleSave()}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Changes</span>
        </button>
      </div>
    </div>
  );
};

