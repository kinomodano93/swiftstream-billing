import React, { useState } from 'react';
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  ArrowRight,
  Shield,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  Smartphone,
  CreditCard,
  Building2,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Send,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  PaymentGatewayType,
  PaymentWebhookResult,
  createMockPaymentWebhookEvent,
} from '../../services/paymentWebhookService';
import { formatCurrency } from '../../utils/formatters';

interface PaymentWebhookManagerProps {
  onClose?: () => void;
}

export const PaymentWebhookManager: React.FC<PaymentWebhookManagerProps> = () => {
  const {
    customers,
    invoices,
    businessProfile,
    processIncomingPaymentWebhook,
    showToast,
  } = useApp();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    customers.find((c) => c.status === 'suspended' || (c.balance || 0) > 0)?.id ||
      customers[0]?.id ||
      ''
  );
  const [selectedGateway, setSelectedGateway] = useState<PaymentGatewayType>('xendit');
  const [selectedChannel, setSelectedChannel] = useState<string>('GCash QR');
  const [customAmount, setCustomAmount] = useState<string>('');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<PaymentWebhookResult | null>(null);
  const [webhookHistory, setWebhookHistory] = useState<PaymentWebhookResult[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const targetCustomer = customers.find((c) => c.id === selectedCustomerId);
  const customerInvoices = invoices.filter(
    (inv) => inv.customerId === selectedCustomerId && (inv.status === 'unpaid' || inv.status === 'overdue')
  );
  const targetInvoice = customerInvoices[0];

  const defaultAmount = targetInvoice?.balanceDue || targetInvoice?.totalAmount || targetCustomer?.balance || targetCustomer?.monthlyFee || 1299;
  const currentAmount = customAmount ? parseFloat(customAmount) : defaultAmount;

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    showToast('info', 'Copied to Clipboard', text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSimulateWebhook = async () => {
    if (!targetCustomer) {
      showToast('error', 'Error', 'Please select a customer first.');
      return;
    }

    setIsProcessing(true);
    setLastResult(null);

    try {
      const mockEvent = createMockPaymentWebhookEvent(
        targetCustomer,
        targetInvoice,
        selectedGateway,
        selectedChannel
      );
      mockEvent.amount = currentAmount;

      const result = await processIncomingPaymentWebhook(mockEvent);
      setLastResult(result);
      setWebhookHistory((prev) => [result, ...prev.slice(0, 19)]);
    } catch (err: any) {
      showToast('error', 'Webhook Processing Failed', err.message || 'Unknown error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-500/30 relative overflow-hidden shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Zap className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Automated Online Payment Webhooks
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live 2s Auto-Reconnect
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              When subscribers pay online via <strong className="text-cyan-400">GCash, Maya, QRPh, or Bank Direct Debit</strong>,
              webhooks automatically issue Official Receipts (OR), clear the ledger, and instantly send REST API commands
              to your <strong className="text-cyan-400">MikroTik CCR</strong> to restore the subscriber's PPPoE line in <strong>&lt; 2 seconds</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-right">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">MikroTik Core</div>
              <div className="text-xs font-mono font-bold text-emerald-400 flex items-center justify-end gap-1.5 mt-0.5">
                <Radio className="w-3 h-3 animate-pulse" />
                {businessProfile.apiKeys?.mikrotikIp || '192.168.88.1'}:{businessProfile.apiKeys?.mikrotikPort || 80}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gateway Webhook Endpoints & Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Xendit */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                  X
                </div>
                <span className="font-bold text-white text-sm">Xendit Gateway</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Webhook Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              GCash, Maya, ShopeePay, GrabPay, 7-Eleven, Card & QRPh callbacks.
            </p>
            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-400 font-semibold">Callback URL:</div>
              <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800">
                <code className="text-[10px] font-mono text-cyan-300 truncate flex-1">
                  https://swiftstream-portal.web.app/api/webhooks/xendit
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy('https://swiftstream-portal.web.app/api/webhooks/xendit', 'xendit')}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  {copiedKey === 'xendit' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Signature: <strong className="text-slate-300">Token Verified</strong></span>
            <span className="text-emerald-400 font-medium">Avg ~1.1s</span>
          </div>
        </div>

        {/* PayMongo */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  P
                </div>
                <span className="font-bold text-white text-sm">PayMongo Gateway</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Webhook Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              payment.paid & source.chargeable events for credit card & e-wallets.
            </p>
            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-400 font-semibold">Callback URL:</div>
              <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800">
                <code className="text-[10px] font-mono text-cyan-300 truncate flex-1">
                  https://swiftstream-portal.web.app/api/webhooks/paymongo
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy('https://swiftstream-portal.web.app/api/webhooks/paymongo', 'paymongo')}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  {copiedKey === 'paymongo' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Header: <strong className="text-slate-300">paymongo-signature</strong></span>
            <span className="text-emerald-400 font-medium">Avg ~1.3s</span>
          </div>
        </div>

        {/* Maya QR / Direct */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center font-bold text-xs">
                  M
                </div>
                <span className="font-bold text-white text-sm">Maya Business QR</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Webhook Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Direct Maya merchant checkout & QRPh dynamic settlement webhooks.
            </p>
            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-400 font-semibold">Callback URL:</div>
              <div className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800">
                <code className="text-[10px] font-mono text-cyan-300 truncate flex-1">
                  https://swiftstream-portal.web.app/api/webhooks/maya
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy('https://swiftstream-portal.web.app/api/webhooks/maya', 'maya')}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  {copiedKey === 'maya' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Auth: <strong className="text-slate-300">Basic Auth / PKI</strong></span>
            <span className="text-emerald-400 font-medium">Avg ~0.9s</span>
          </div>
        </div>
      </div>

      {/* Interactive 1-Click Webhook Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">
                  1-Click Webhook Reconnection Simulator
                </h3>
              </div>
              <span className="text-[11px] text-cyan-400 font-mono">Test NOC Reconnect</span>
            </div>

            <div className="space-y-3.5">
              {/* Target Customer */}
              <div>
                <label className="block text-slate-300 mb-1 text-xs font-semibold">
                  Select Subscriber to Simulate Payment:
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-medium"
                >
                  {customers.map((c) => {
                    const isOverdue = c.status === 'suspended' || (c.balance || 0) > 0;
                    return (
                      <option key={c.id} value={c.id}>
                        {isOverdue ? '🔴 [OVERDUE / SUSPENDED]' : '🟢 [ACTIVE]'} {c.fullName} ({c.accountNo}) - Bal: ₱{(c.balance || 0).toLocaleString()}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Customer summary pill */}
              {targetCustomer && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-200">{targetCustomer.fullName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      PPPoE: <span className="text-cyan-400">{targetCustomer.network.pppoeUsername}</span> | IP: {targetCustomer.network.ipAddress}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[11px] font-bold uppercase ${targetCustomer.status === 'suspended' ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {targetCustomer.status === 'suspended' ? 'ISOLATED' : 'ACTIVE'}
                    </div>
                    <div className="text-xs font-bold text-slate-300">
                      Bal: ₱{(targetCustomer.balance || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Gateway & Channel Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 text-[11px] font-semibold">
                    Payment Gateway
                  </label>
                  <select
                    value={selectedGateway}
                    onChange={(e) => setSelectedGateway(e.target.value as PaymentGatewayType)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="xendit">Xendit (Philippines)</option>
                    <option value="paymongo">PayMongo</option>
                    <option value="maya">Maya Merchant QR</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 text-[11px] font-semibold">
                    Payment Channel
                  </label>
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="GCash QR">📱 GCash QR (Instant)</option>
                    <option value="Maya Wallet">💳 Maya Wallet</option>
                    <option value="ShopeePay">🛍️ ShopeePay</option>
                    <option value="GrabPay">🚗 GrabPay</option>
                    <option value="Universal QRPh">📲 Universal QRPh</option>
                    <option value="BDO Direct Debit">🏦 BDO Direct Debit</option>
                    <option value="BPI Direct Debit">🏦 BPI Direct Debit</option>
                    <option value="7-Eleven CLIQQ">🏪 7-Eleven CLIQQ Barcode</option>
                    <option value="Visa / Mastercard">💳 Visa / Mastercard</option>
                  </select>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-slate-400 mb-1 text-[11px] font-semibold">
                  Amount to Settle (₱)
                </label>
                <input
                  type="number"
                  value={currentAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-mono font-bold focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Trigger Button */}
              <button
                type="button"
                disabled={isProcessing || !targetCustomer}
                onClick={handleSimulateWebhook}
                className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Executing 2-Second MikroTik Reconnection Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>Fire Instant Payment Webhook (2s Auto-Reconnect)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Live Execution Output & Steps */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col h-full">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">Live Pipeline Execution Monitor</h3>
              </div>
              {lastResult && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ⚡ Latency: {lastResult.latencyMs}ms
                </span>
              )}
            </div>

            {lastResult ? (
              <div className="space-y-3 flex-1 flex flex-col justify-between">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Payment Settled & Subscriber Line Restored!</span>
                  </div>
                  <div className="text-[11px] text-emerald-200/90 leading-relaxed">
                    Official Receipt <strong>{lastResult.receiptNumber}</strong> generated for <strong>{lastResult.customerName}</strong>. PPPoE secret profile restored and session dropped for instant un-isolation.
                  </div>
                </div>

                {/* Steps Log */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto">
                  {lastResult.stepsCompleted.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-slate-300">
                      <span className="text-cyan-400 font-bold">{idx + 1}.</span>
                      <span>{step.replace(/^\d+\.\s*/, '')}</span>
                    </div>
                  ))}
                </div>

                {/* Executed RouterOS Commands */}
                {lastResult.mikrotikResult?.executedCommands && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[10px] space-y-1">
                    <div className="text-slate-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                      <Terminal className="w-3 h-3 text-cyan-400" />
                      Executed MikroTik RouterOS Commands:
                    </div>
                    {lastResult.mikrotikResult.executedCommands.map((cmd, idx) => (
                      <div key={idx} className="text-emerald-400/90 truncate">
                        $ {cmd}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-slate-800 rounded-xl text-slate-500">
                <Radio className="w-10 h-10 text-slate-700 mb-3 animate-pulse" />
                <div className="text-xs font-semibold text-slate-400">Webhook listener is standing by</div>
                <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                  Trigger the simulator on the left to watch the 5-step instant auto-reconnect sequence run in real-time.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Webhook Settlement Activity History */}
      {webhookHistory.length > 0 && (
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Recent Webhook Settlements ({webhookHistory.length})
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Live Ingest Buffer</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] text-slate-400 uppercase bg-slate-950/60 font-semibold">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Time</th>
                  <th className="py-2.5 px-3">Subscriber</th>
                  <th className="py-2.5 px-3">Gateway</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Receipt OR</th>
                  <th className="py-2.5 px-3">Latency</th>
                  <th className="py-2.5 px-3 rounded-r-lg">MikroTik Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {webhookHistory.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-bold text-slate-200">{item.customerName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.accountNo}</div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                        {item.gateway}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300">{item.paymentChannel}</td>
                    <td className="py-2 px-3 font-mono font-bold text-emerald-400">
                      ₱{item.amountPaid.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-mono text-cyan-400">{item.receiptNumber}</td>
                    <td className="py-2 px-3 font-mono text-slate-400">{item.latencyMs}ms</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                        <CheckCircle2 className="w-3 h-3" />
                        Line Restored
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

