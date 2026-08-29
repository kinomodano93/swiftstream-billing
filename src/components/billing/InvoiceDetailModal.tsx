import React, { useState } from 'react';
import {
  X,
  Printer,
  Download,
  CreditCard,
  Send,
  Check,
  Tag,
  ShieldCheck,
  Building2,
  Calendar,
  PhoneCall,
  QrCode,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate, getInvoiceStatusBadge } from '../../utils/formatters';
import { generateInvoicePDF } from '../../utils/pdfGenerator';

interface InvoiceDetailModalProps {
  invoiceId: string;
  onClose: () => void;
  onOpenPaymentModal: (customerId: string, invoiceId: string) => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoiceId,
  onClose,
  onOpenPaymentModal,
}) => {
  const { invoices, businessProfile, applyInvoiceDiscount, sendReminder } = useApp();

  const [discountInput, setDiscountInput] = useState<string>('');
  const [showDiscountForm, setShowDiscountForm] = useState<boolean>(false);

  const invoice = invoices.find((inv) => inv.id === invoiceId);
  if (!invoice) return null;

  const badge = getInvoiceStatusBadge(invoice.status);

  const handleApplyDiscount = (e: React.FormEvent) => {
    e.preventDefault();
    const discountVal = parseFloat(discountInput);
    if (isNaN(discountVal) || discountVal <= 0) return;

    applyInvoiceDiscount(invoice.id, discountVal);
    setDiscountInput('');
    setShowDiscountForm(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const pdf = generateInvoicePDF(invoice, businessProfile);
    pdf.save(`${invoice.invoiceNumber}_${invoice.accountNo}.pdf`);
  };

  const qrPayload = JSON.stringify({
    isp: 'SwiftStream IT Services',
    inv: invoice.invoiceNumber,
    acct: invoice.accountNo,
    due: invoice.balanceDue,
    gcash: businessProfile.paymentGateways.gcashNumber,
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Top Control Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-sm text-cyan-400">{invoice.invoiceNumber}</span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.textCol} ${badge.border}`}
            >
              {badge.text}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {invoice.balanceDue > 0 && (
              <button
                onClick={() => onOpenPaymentModal(invoice.customerId, invoice.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Pay Now</span>
              </button>
            )}

            <button
              onClick={() => sendReminder(invoice.customerId, 'upcoming_due', 'sms', invoice.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>SMS Bill</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
              title="Print Statement"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable / Viewable Statement of Account Document */}
        <div className="p-8 overflow-y-auto flex-1 bg-slate-900 text-slate-100 space-y-6 print:p-0 print:bg-white print:text-black">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-800 pb-6 print:border-slate-300">
            <div>
              <h2 className="text-xl font-black text-cyan-400 tracking-tight print:text-slate-900">
                {businessProfile.name}
              </h2>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
                {businessProfile.address.building}, {businessProfile.address.street}, Brgy. {businessProfile.address.barangay}
              </p>
              <p className="text-xs text-slate-400 print:text-slate-600">
                {businessProfile.address.city}, {businessProfile.address.province} {businessProfile.address.zipCode} (Near Lagonoy Cockpit)
              </p>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-1 font-mono">
                TIN: {businessProfile.tin} • Hotline: {businessProfile.representative.mobile}
              </p>
            </div>

            <div className="text-right">
              <h3 className="text-lg font-bold text-slate-100 print:text-slate-900 tracking-wider">
                STATEMENT OF ACCOUNT
              </h3>
              <p className="text-sm font-mono font-bold text-cyan-400 print:text-cyan-700 mt-1">
                {invoice.invoiceNumber}
              </p>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
                Issue Date: <span className="font-semibold text-slate-200 print:text-slate-800">{formatDate(invoice.issueDate)}</span>
              </p>
              <p className="text-xs text-slate-400 print:text-slate-600">
                Due Date: <span className="font-bold text-rose-400 print:text-rose-700">{formatDate(invoice.dueDate)}</span>
              </p>
            </div>
          </div>

          {/* Subscriber & Billing Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 print:border-slate-300 print:bg-slate-50 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Billed To Subscriber:
              </span>
              <p className="text-sm font-bold text-slate-100 print:text-black">{invoice.customerName}</p>
              <p className="font-mono text-cyan-400 print:text-cyan-700 mt-0.5">Account No: {invoice.accountNo}</p>
              <p className="text-slate-400 print:text-slate-600 mt-1">{invoice.customerAddress}</p>
              <p className="text-slate-400 print:text-slate-600 font-mono mt-0.5">Mobile: {invoice.customerMobile}</p>
            </div>

            <div className="sm:text-right space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Subscription Period:
              </span>
              <p className="font-semibold text-slate-200 print:text-black">
                {formatDate(invoice.billingPeriodStart)} to {formatDate(invoice.billingPeriodEnd)}
              </p>
              <p className="text-slate-400 print:text-slate-600">
                Payment Status: <span className="font-bold uppercase">{invoice.status}</span>
              </p>
              {invoice.paidAt && (
                <p className="text-emerald-400 print:text-emerald-700 font-mono text-[11px]">
                  Paid on: {formatDate(invoice.paidAt)} ({invoice.paymentMethodUsed?.toUpperCase()})
                </p>
              )}
            </div>
          </div>

          {/* Itemized Charges Table */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden print:border-slate-300">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 print:bg-slate-100 print:text-slate-700 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Description of Service / Charges</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Unit Rate</th>
                  <th className="py-3 px-4 text-right">Amount (PHP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                {invoice.items.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="py-3 px-4 text-slate-500">{idx + 1}</td>
                    <td className="py-3 px-4 font-medium text-slate-200 print:text-black">{item.description}</td>
                    <td className="py-3 px-4 text-center text-slate-400">{item.quantity}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300 print:text-black">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-100 print:text-black">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary & QR Breakdown Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {/* Left: Payment Channels & QR Verification */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 print:border-slate-300 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 print:text-black uppercase text-[11px]">
                  Payment Channels (Instant GCash / Maya)
                </span>
                <QrCode className="w-4 h-4 text-cyan-400" />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <div className="bg-white p-2 rounded-xl border border-slate-700 flex-shrink-0">
                  <QRCodeSVG value={qrPayload} size={70} />
                </div>
                <div className="space-y-1 text-[11px] text-slate-300 print:text-slate-700">
                  <p>
                    <strong className="text-cyan-400">GCash:</strong> {businessProfile.paymentGateways.gcashNumber} ({businessProfile.paymentGateways.gcashName})
                  </p>
                  <p>
                    <strong className="text-emerald-400">Maya:</strong> {businessProfile.paymentGateways.mayaNumber}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Bank: {businessProfile.paymentGateways.bankName} (Acct: {businessProfile.paymentGateways.bankAccountNumber})
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Calculations */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/80 print:border-slate-200">
                <span className="text-slate-400 print:text-slate-600">Current Charges Subtotal:</span>
                <span className="font-mono text-slate-200 print:text-black">{formatCurrency(invoice.subtotal)}</span>
              </div>

              {invoice.discount > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-800/80 print:border-slate-200 text-emerald-400">
                  <span>Special Discount / Promo Credit:</span>
                  <span className="font-mono">-{formatCurrency(invoice.discount)}</span>
                </div>
              )}

              {invoice.previousBalance > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-800/80 print:border-slate-200 text-rose-400">
                  <span>Previous Unpaid Balance (Arrears):</span>
                  <span className="font-mono">+{formatCurrency(invoice.previousBalance)}</span>
                </div>
              )}

              <div className="flex justify-between py-2 border-b border-slate-700 print:border-slate-400 font-bold text-sm">
                <span className="text-slate-100 print:text-black">Total Invoice Amount:</span>
                <span className="font-mono text-slate-100 print:text-black">{formatCurrency(invoice.totalAmount)}</span>
              </div>

              {invoice.amountPaid > 0 && (
                <div className="flex justify-between py-1 text-emerald-400">
                  <span>Amount Paid to Date:</span>
                  <span className="font-mono">-{formatCurrency(invoice.amountPaid)}</span>
                </div>
              )}

              <div className="flex justify-between py-2.5 px-3 rounded-xl bg-cyan-950/60 border border-cyan-800/60 print:bg-slate-100 font-black text-base text-cyan-300 print:text-cyan-800">
                <span>TOTAL BALANCE DUE:</span>
                <span className="font-mono">{formatCurrency(invoice.balanceDue)}</span>
              </div>
            </div>
          </div>

          {/* Discount Tool Section (no-print) */}
          <div className="no-print pt-4 border-t border-slate-800">
            {!showDiscountForm ? (
              <button
                onClick={() => setShowDiscountForm(true)}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Apply Promo Discount or Credit Adjustment to this Bill</span>
              </button>
            ) : (
              <form onSubmit={handleApplyDiscount} className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Discount Amount (PHP):</span>
                <input
                  type="number"
                  step="any"
                  required
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder="e.g. 100"
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500 w-32"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiscountForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>

          {/* Signature & Reminders */}
          <div className="pt-6 border-t border-slate-800 print:border-slate-300 flex flex-col sm:flex-row justify-between items-end gap-6 text-[11px] text-slate-400 print:text-slate-600">
            <div className="space-y-1">
              <p className="font-semibold text-slate-300 print:text-black">Payment Reminders:</p>
              <p>• Please pay on or before the due date to ensure uninterrupted fiber connection.</p>
              <p>• Include Account #{invoice.accountNo} in the GCash / Bank reference note.</p>
            </div>

            <div className="text-center sm:text-right min-w-[200px]">
              <div className="w-36 border-b border-slate-600 print:border-slate-800 mx-auto sm:ml-auto mb-1" />
              <p className="font-bold text-slate-200 print:text-black">
                {businessProfile.representative.firstName} {businessProfile.representative.lastName}
              </p>
              <p className="text-[10px] text-slate-500">Authorized Representative / IT Lead</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

