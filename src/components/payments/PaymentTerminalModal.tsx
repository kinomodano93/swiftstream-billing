import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Search,
  CheckCircle2,
  DollarSign,
  Printer,
  Receipt,
  User,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PaymentMethod } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface PaymentTerminalModalProps {
  initialCustomerId?: string;
  initialInvoiceId?: string;
  onClose: () => void;
  onPaymentSuccess?: (paymentId: string) => void;
}

export const PaymentTerminalModal: React.FC<PaymentTerminalModalProps> = ({
  initialCustomerId,
  initialInvoiceId,
  onClose,
  onPaymentSuccess,
}) => {
  const { customers, invoices, recordPayment, businessProfile } = useApp();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(initialInvoiceId || '');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('gcash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [tenderedAmount, setTenderedAmount] = useState<string>('');
  const [cashierName, setCashierName] = useState<string>(
    businessProfile.representative.firstName + ' ' + businessProfile.representative.lastName
  );
  const [notes, setNotes] = useState<string>('');
  const [isAdvance, setIsAdvance] = useState<boolean>(false);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const unpaidInvoices = invoices.filter(
    (inv) => inv.customerId === selectedCustomerId && inv.status !== 'paid'
  );
  const selectedInvoice = invoices.find((inv) => inv.id === selectedInvoiceId);

  // Auto-fill payment amount when invoice or customer is picked
  useEffect(() => {
    if (selectedInvoice) {
      setPaymentAmount(selectedInvoice.balanceDue.toString());
    } else if (selectedCustomer && selectedCustomer.balance > 0) {
      setPaymentAmount(selectedCustomer.balance.toString());
    } else if (selectedCustomer) {
      setPaymentAmount(selectedCustomer.monthlyFee.toString());
    }
  }, [selectedCustomerId, selectedInvoiceId]);

  // Calculate change for cash payments
  const tenderVal = parseFloat(tenderedAmount) || 0;
  const payVal = parseFloat(paymentAmount) || 0;
  const changeDue = tenderVal > payVal ? tenderVal - payVal : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomerId) {
      alert('Please select a subscriber.');
      return;
    }

    if (payVal <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    const newPayment = recordPayment({
      customerId: selectedCustomerId,
      invoiceId: selectedInvoiceId || undefined,
      amount: payVal,
      paymentMethod,
      referenceNumber: referenceNumber || undefined,
      cashierName,
      notes: notes || undefined,
      isAdvancePayment: isAdvance,
    });

    if (onPaymentSuccess) {
      onPaymentSuccess(newPayment.id);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                Payment Collection Terminal (POS)
              </h3>
              <p className="text-xs text-slate-400">
                Record payment, issue official receipt, and rebalance account.
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* Subscriber Selector */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Select Subscriber / Account *</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value);
                setSelectedInvoiceId('');
              }}
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
            >
              <option value="">-- Choose Subscriber --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} ({c.accountNo}) — Bal: ₱{c.balance.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          {/* If Customer Selected: Show Unpaid Invoices or Advance toggle */}
          {selectedCustomer && (
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Unpaid Invoices for this Account:</span>
                <span className="font-mono font-bold text-rose-400">
                  Total Outstanding: {formatCurrency(selectedCustomer.balance)}
                </span>
              </div>

              {unpaidInvoices.length > 0 ? (
                <div className="space-y-1.5">
                  {unpaidInvoices.map((inv) => (
                    <label
                      key={inv.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                        selectedInvoiceId === inv.id
                          ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-300'
                          : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="invoiceRadio"
                          checked={selectedInvoiceId === inv.id}
                          onChange={() => setSelectedInvoiceId(inv.id)}
                          className="text-cyan-600 focus:ring-0"
                        />
                        <span className="font-mono font-bold">{inv.invoiceNumber}</span>
                        <span className="text-slate-400">({formatDate(inv.billingPeriodStart)})</span>
                      </div>
                      <span className="font-mono font-bold text-rose-400">
                        {formatCurrency(inv.balanceDue)}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-slate-400 text-xs py-1">
                  No open invoices. Payment will be credited as advance deposit.
                </div>
              )}
            </div>
          )}

          {/* Payment Method Selector */}
          <div>
            <label className="block text-slate-400 mb-2 font-medium">Payment Channel / Method *</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'cash', label: 'Cash (Manual)', icon: '💵', badge: 'Admin POS' },
                { id: 'xendit', label: 'Xendit', icon: '⚡', badge: 'Gateway' },
                { id: 'gcash', label: 'GCash', icon: '📱' },
                { id: 'maya', label: 'Maya', icon: '💳' },
                { id: 'bank_transfer', label: 'Bank', icon: '🏦' },
              ].map((method) => (
                <button
                  type="button"
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                  className={`relative p-3 rounded-xl border flex flex-col items-center gap-1 font-semibold transition-all cursor-pointer ${
                    paymentMethod === method.id
                      ? method.id === 'cash'
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-sm'
                        : method.id === 'xendit'
                        ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-sm'
                        : 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {method.badge && (
                    <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                      method.id === 'cash' ? 'bg-amber-950 text-amber-300 border border-amber-800/60' : 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                    }`}>
                      {method.badge}
                    </span>
                  )}
                  <span className="text-base">{method.icon}</span>
                  <span className="text-[11px]">{method.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cash Manual Collection Banner */}
          {paymentMethod === 'cash' && (
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-800/50 flex items-start gap-3 text-xs">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-base flex-shrink-0">
                💵
              </div>
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                    Manual Cash Collection (Admin / Cashier)
                  </span>
                  <span className="text-[9px] bg-amber-950 border border-amber-700/60 px-1.5 py-0.2 rounded text-amber-300 font-semibold">
                    In-Person / Field Collection
                  </span>
                </div>
                <p className="text-slate-200 text-xs">
                  Customer is paying physical cash. Enter the cash tendered below to automatically compute change.
                </p>
                <p className="text-[10px] text-slate-400">
                  Submitting will log the payment into the daily cash drawer, mark the invoice as paid, and sync un-isolation on the MikroTik router.
                </p>
              </div>
            </div>
          )}

          {/* Xendit Quick Reference Banner */}
          {paymentMethod === 'xendit' && (
            <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-800/50 flex items-center gap-3 text-xs">
              <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center font-bold text-lg flex-shrink-0">
                ⚡
              </div>
              <div className="space-y-0.5 flex-1">
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">
                  Xendit Hosted Multi-Channel Gateway
                </span>
                <p className="font-bold text-slate-100">
                  Accepts 7-Eleven CLiQQ, Visa/Mastercard, BPI/UnionBank Direct, QR Ph
                </p>
                <p className="text-[11px] text-slate-400">
                  Automated payment link will be recorded on subscriber receipt.
                </p>
              </div>
            </div>
          )}

          {/* GCash Quick Reference Banner */}
          {paymentMethod === 'gcash' && (
            <div className="p-3 rounded-2xl bg-cyan-950/20 border border-cyan-800/40 flex items-center gap-3 text-xs">
              {businessProfile.paymentGateways.gcashQrImage ? (
                <img
                  src={businessProfile.paymentGateways.gcashQrImage}
                  alt="GCash QR"
                  className="w-12 h-12 object-contain bg-white rounded-xl p-0.5 shadow flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 bg-cyan-900/40 text-cyan-300 font-mono text-[9px] font-bold rounded-xl border border-cyan-700/50 flex items-center justify-center flex-shrink-0">
                  GCash QR
                </div>
              )}
              <div className="space-y-0.5 flex-1">
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">
                  Scan to Pay (No Gateway API Needed)
                </span>
                <p className="font-bold text-slate-100">{businessProfile.paymentGateways.gcashName}</p>
                <p className="font-mono text-cyan-300 font-semibold">{businessProfile.paymentGateways.gcashNumber}</p>
              </div>
            </div>
          )}

          {/* Maya Quick Reference Banner */}
          {paymentMethod === 'maya' && (
            <div className="p-3 rounded-2xl bg-purple-950/20 border border-purple-800/40 flex items-center gap-3 text-xs">
              {businessProfile.paymentGateways.mayaQrImage ? (
                <img
                  src={businessProfile.paymentGateways.mayaQrImage}
                  alt="Maya QR"
                  className="w-12 h-12 object-contain bg-white rounded-xl p-0.5 shadow flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 bg-purple-900/40 text-purple-300 font-mono text-[9px] font-bold rounded-xl border border-purple-700/50 flex items-center justify-center flex-shrink-0">
                  Maya QR
                </div>
              )}
              <div className="space-y-0.5 flex-1">
                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider block">
                  Maya QR Ph Transfer
                </span>
                <p className="font-bold text-slate-100">{businessProfile.paymentGateways.mayaName}</p>
                <p className="font-mono text-purple-300 font-semibold">{businessProfile.paymentGateways.mayaNumber}</p>
              </div>
            </div>
          )}

          {/* Amount and Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Amount to Pay (PHP ₱) *</label>
              <input
                type="number"
                step="any"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="1299.00"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono font-bold text-base focus:outline-none focus:border-cyan-500"
              />
            </div>

            {paymentMethod !== 'cash' ? (
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  {paymentMethod === 'gcash'
                    ? 'GCash Ref No. (e.g. 9018247192)'
                    : paymentMethod === 'maya'
                    ? 'Maya Ref No.'
                    : 'Bank / Check Reference #'}
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Reference number..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Cash Tendered (for Change)</label>
                <input
                  type="number"
                  step="any"
                  value={tenderedAmount}
                  onChange={(e) => setTenderedAmount(e.target.value)}
                  placeholder="Cash given..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}
          </div>

          {/* Cash Change Display */}
          {paymentMethod === 'cash' && tenderVal > 0 && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Change Due to Customer:</span>
              <span className="font-mono font-bold text-base text-emerald-400">
                {formatCurrency(changeDue)}
              </span>
            </div>
          )}

          {/* Administrator / Collector Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Administrator / Collector Name</label>
              <input
                type="text"
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Notes (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarks..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-105"
            >
              <Receipt className="w-4 h-4" />
              <span>Confirm & Print Receipt (OR)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

