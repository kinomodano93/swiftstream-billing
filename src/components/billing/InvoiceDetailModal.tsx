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
  Zap,
  AlertTriangle,
  Clock,
  FileCheck2,
  Receipt,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../../context/AppContext';
import {
  formatBusinessAddress,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatOrdinalNumber,
  getBusinessAddressLines,
  getBusinessInvoiceAddress,
  getInvoiceStatusBadge,
  resolveInvoicePlanDetails,
} from '../../utils/formatters';
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
  const { invoices, customers, plans, businessProfile, applyInvoiceDiscount, sendReminder, hasPermission } = useApp();

  const [discountInput, setDiscountInput] = useState<string>('');
  const [showDiscountForm, setShowDiscountForm] = useState<boolean>(false);


  const invoice = invoices.find((inv) => inv.id === invoiceId);
  if (!invoice) return null;

  const customer = customers.find(
    (c) =>
      (invoice.customerId && c.id?.toLowerCase() === invoice.customerId?.toLowerCase()) ||
      (invoice.accountNo && c.accountNo?.toLowerCase() === invoice.accountNo?.toLowerCase())
  );

  const planDetails = resolveInvoicePlanDetails(invoice, customer, plans);

  const badge = getInvoiceStatusBadge(invoice.status);

  // Safe Financial Data Calculations
  const serviceItems = invoice.items.filter(
    (item) => item.type !== 'late_fee' && item.type !== 'discount'
  );
  const itemsSubtotal = serviceItems.length > 0
    ? serviceItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    : (Number(invoice.subtotal) || 0);

  const discountAmount = Math.max(0, Number(invoice.discount) || 0);
  const previousBalanceAmount = Math.max(0, Number(invoice.previousBalance) || 0);
  const netCurrentCharges = Math.max(0, itemsSubtotal - discountAmount);

  const computedTotalAmount = invoice.totalAmount > 0
    ? invoice.totalAmount
    : (netCurrentCharges + previousBalanceAmount);

  const paidAmount = Math.max(0, Number(invoice.amountPaid) || 0);
  const computedBalanceDue = invoice.status === 'paid'
    ? 0
    : Math.max(0, computedTotalAmount - paidAmount);

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
    const pdf = generateInvoicePDF(invoice, businessProfile, customer, plans);
    pdf.save(`${invoice.invoiceNumber}_${invoice.accountNo}.pdf`);
  };

  const qrPayload = JSON.stringify({
    isp: businessProfile.tradeName || businessProfile.name || 'Telecommunications Provider',
    inv: invoice.invoiceNumber,
    acct: invoice.accountNo,
    due: computedBalanceDue,
    currency: 'PHP',
    gcash: businessProfile.paymentGateways.gcashNumber,
    maya: businessProfile.paymentGateways.mayaNumber,
  });

  const isPaid = invoice.status === 'paid' || computedBalanceDue === 0;
  const isOverdue = invoice.status === 'overdue';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto print:backdrop-blur-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 print:border-none print:shadow-none print:rounded-none print:max-w-none print:max-h-none print:overflow-visible print:bg-white print:text-black">
        {/* Top Control Header (Hidden in Print) */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-sm text-cyan-400">{invoice.invoiceNumber}</span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.textCol} ${badge.border}`}
            >
              {badge.text}
            </span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Billing Statement • Philippine Peso (PHP ₱)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {computedBalanceDue > 0 && (
              <button
                onClick={() => onOpenPaymentModal(invoice.customerId, invoice.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all hover:scale-105 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Pay Now</span>
              </button>
            )}

            <button
              onClick={() => sendReminder(invoice.customerId, 'upcoming_due', 'sms', invoice.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              title="Send automated SMS billing statement to subscriber"
            >
              <Send className="w-3.5 h-3.5" />
              <span>SMS Bill</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold transition-all hover:scale-105 shadow-sm shadow-cyan-600/20 cursor-pointer"
              title="Export official printable A4 PDF statement"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Print Statement (Ctrl+P)"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable / Viewable Statement of Account Document */}
        <div
          id="printable-invoice"
          className="p-6 sm:p-8 overflow-y-auto flex-1 bg-slate-900 text-slate-100 space-y-5 print:p-6 print:bg-white print:text-black print:overflow-visible"
        >
          {/* 1. Header Banner & Company Profile */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-800 pb-5 print:border-slate-300">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600/10 border border-cyan-500/30 flex items-center justify-center overflow-hidden shrink-0 print:border-slate-300 print:bg-transparent">
                  {businessProfile.logoUrl || '/favicon.svg' ? (
                    <img
                      src={businessProfile.logoUrl || '/favicon.svg'}
                      alt={businessProfile.name}
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <Zap className="w-5 h-5 text-cyan-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-100 print:text-slate-900 tracking-tight">
                    {businessProfile.name.toUpperCase()}
                  </h2>
                  <p className="text-[11px] font-bold text-cyan-400 print:text-cyan-700">
                    {businessProfile.heroTitle || businessProfile.tradeName || (businessProfile.industry && businessProfile.industry !== 'Information Technology & Telecommunications' ? businessProfile.industry : '') || 'Internet & Telecom Services'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-1">
                {getBusinessInvoiceAddress(businessProfile.address)}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 print:text-slate-600 pt-0.5 font-mono">
                <span>BIR Reg. TIN: <strong className="text-slate-200 print:text-black font-semibold">{businessProfile.tin}</strong></span>
                <span>• Hotline: <strong className="text-slate-200 print:text-black font-semibold">{businessProfile.representative.mobile}</strong></span>
                <span>• Email: <strong className="text-slate-200 print:text-black font-semibold">{businessProfile.representative.email}</strong></span>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-1 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 print:text-cyan-700 block">
                Official Billing Statement
              </span>
              <h3 className="text-xl font-extrabold text-slate-100 print:text-slate-900 tracking-wider">
                STATEMENT OF ACCOUNT
              </h3>
              <p className="text-sm font-mono font-black text-cyan-400 print:text-cyan-800">
                {invoice.invoiceNumber}
              </p>
              <div className="text-xs text-slate-400 print:text-slate-600 space-y-0.5 pt-1">
                <p>Statement Date: <span className="font-semibold text-slate-200 print:text-black">{formatDate(invoice.issueDate)}</span></p>
                <p>Account Number: <span className="font-mono font-bold text-cyan-300 print:text-cyan-800">{invoice.accountNo}</span></p>
                <p>Payment Due Date: <span className="font-bold text-rose-400 print:text-rose-700">{formatDate(invoice.dueDate)}</span></p>
              </div>
            </div>
          </div>

          {/* 2. Due Date & Status Banner */}
          <div
            className={`p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border ${
              isPaid
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 print:bg-emerald-50 print:border-emerald-300 print:text-emerald-900'
                : isOverdue
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-300 print:bg-rose-50 print:border-rose-300 print:text-rose-900'
                : 'bg-sky-950/40 border-sky-500/40 text-sky-200 print:bg-sky-50 print:border-sky-300 print:text-sky-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {isPaid ? (
                <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : isOverdue ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <Clock className="w-4 h-4 text-sky-400 shrink-0" />
              )}
              <span className="font-bold uppercase tracking-wide">
                {isPaid
                  ? 'Payment Status'
                  : isOverdue
                  ? 'Payment Status: OVERDUE — Immediate settlement required to prevent automated service interruption'
                  : `Payment Due Date: ${formatDate(invoice.dueDate)}`}
              </span>
            </div>

            <div className="font-mono font-black text-sm self-end sm:self-auto">
              {isPaid ? (
                <span className="text-emerald-400 print:text-emerald-700 text-base font-extrabold tracking-wider">
                  PAID
                </span>
              ) : (
                <span>Total Amount Due: {formatCurrency(computedBalanceDue)}</span>
              )}
            </div>
          </div>

          {/* 3. Subscriber Billing Details Card */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 print:border-slate-300 print:bg-slate-50 text-xs">
            <span className="text-[10px] font-bold text-slate-500 print:text-slate-600 uppercase tracking-wider block mb-2">
              Billed To Subscriber
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-slate-100 print:text-black">{invoice.customerName}</p>
                <div className="flex items-center gap-2 text-slate-300 print:text-slate-700">
                  <span className="text-slate-500">Account No:</span>
                  <span className="font-mono font-bold text-cyan-400 print:text-cyan-800">{invoice.accountNo}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-slate-400 print:text-slate-600 leading-relaxed">
                  <strong className="text-slate-500 font-normal">Service Address: </strong>
                  {invoice.customerAddress}
                </p>
                <div className="text-[11px] text-slate-400 print:text-slate-600">
                  <span>Mobile: <strong className="text-slate-200 print:text-black font-mono">{invoice.customerMobile}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Itemized Charges Table */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden print:border-slate-300">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-300 print:bg-slate-100 print:text-slate-800 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">#</th>
                  <th className="py-3 px-4">Description of Services & Charges</th>
                  <th className="py-3 px-3 text-center">Type</th>
                  <th className="py-3 px-3 text-center w-14">Qty</th>
                  <th className="py-3 px-4 text-right">Unit Rate (PHP)</th>
                  <th className="py-3 px-4 text-right">Amount (PHP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                {serviceItems.map((item, idx) => {
                  const isPlanItem = item.type === 'plan' || (!item.type && idx === 0);
                  const cleanPlanName = planDetails.planName.replace(/\s*\|\s*\d+\s*mbps/i, '').trim();
                  let itemTitle = item.description;
                  let itemSubtext = '';

                  if (isPlanItem) {
                    if (invoice.isProrated && invoice.proratedDays) {
                      itemTitle = `Monthly Internet Subscription: ${cleanPlanName || planDetails.planName} (${planDetails.speedMbps} Mbps) — Prorated Subscription (${invoice.proratedDays} Days)`;
                    } else {
                      itemTitle = `Monthly Internet Subscription: ${cleanPlanName || planDetails.planName} (${planDetails.speedMbps} Mbps)`;
                    }
                    itemSubtext = planDetails.planDescription || '';
                  } else if (item.type === 'installation') {
                    itemTitle = item.description || 'Installation & Setup Fee';
                    itemSubtext = '';
                  } else if (item.type === 'addon') {
                    itemTitle = item.description || 'Add-on Service';
                    itemSubtext = '';
                  }

                  const displayUnitPrice = isPlanItem && (item.unitPrice <= 0 || !invoice.isProrated) ? planDetails.monthlyFee : item.unitPrice;
                  const displayAmount = isPlanItem && (item.amount <= 0 || !invoice.isProrated) ? planDetails.monthlyFee : item.amount;

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-800/30 print:hover:bg-transparent">
                      <td className="py-3 px-4 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-4 font-medium text-slate-200 print:text-black">
                        <div>
                          <span className="font-bold text-slate-100 print:text-black block">
                            {itemTitle}
                          </span>
                          {itemSubtext && (
                            <span className="text-[10px] text-slate-400 print:text-slate-600 block mt-0.5">
                              {itemSubtext}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 print:bg-slate-200 print:text-slate-800 uppercase">
                          {item.type || 'plan'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400 print:text-slate-700">{item.quantity}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300 print:text-black">
                        {formatCurrency(displayUnitPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-100 print:text-black">
                        {formatCurrency(displayAmount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 5. Summary & Payment Row (Left: Payment Channels / Right: Calculations) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {/* Left Column: Official Payment Channels */}
            <div className="space-y-3">
              {/* Payment Channels Card */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 print:border-slate-300 print:bg-slate-50 text-xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-200 pb-2">
                  <span className="font-bold text-slate-200 print:text-black uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Official Payment Channels</span>
                  </span>
                  <QrCode className="w-4 h-4 text-cyan-400 print:text-slate-700" />
                </div>

                <div className="flex items-start gap-3.5 pt-1">
                  <div className="bg-white p-2 rounded-xl border border-slate-700 flex-shrink-0 print:border-slate-300">
                    <QRCodeSVG value={qrPayload} size={72} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5 text-[11px] text-slate-300 print:text-slate-700 break-words">
                    {businessProfile.paymentGateways.gcashNumber && (
                      <p>
                        <strong className="text-cyan-400 print:text-cyan-800">GCash QR Ph:</strong>{' '}
                        {businessProfile.paymentGateways.gcashNumber}
                        {businessProfile.paymentGateways.gcashName ? ` (${businessProfile.paymentGateways.gcashName})` : ''}
                      </p>
                    )}
                    {businessProfile.paymentGateways.mayaNumber && (
                      <p>
                        <strong className="text-emerald-400 print:text-emerald-800">Maya:</strong>{' '}
                        {businessProfile.paymentGateways.mayaNumber}
                        {businessProfile.paymentGateways.mayaName ? ` (${businessProfile.paymentGateways.mayaName})` : ''}
                      </p>
                    )}
                    {(businessProfile.paymentGateways.bankName || businessProfile.paymentGateways.bankAccountNumber) && (
                      <p className="text-[10px] text-slate-400 print:text-slate-600">
                        <strong>Bank Transfer:</strong> {businessProfile.paymentGateways.bankName || 'Bank'}
                        {businessProfile.paymentGateways.bankAccountNumber ? ` (Acct: ${businessProfile.paymentGateways.bankAccountNumber})` : ''}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500 print:text-slate-600 leading-relaxed">
                      <strong>Over-the-Counter:</strong> {businessProfile.name || 'Office'} Cashier Desk
                      {(() => {
                        const loc = [
                          businessProfile.address?.barangay
                            ? (/^brgy\.?\s*/i.test(businessProfile.address.barangay)
                              ? businessProfile.address.barangay
                              : `Brgy. ${businessProfile.address.barangay}`)
                            : '',
                          businessProfile.address?.city,
                        ].filter(Boolean).join(', ');
                        return loc ? ` (${loc})` : '';
                      })()}.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Financial Calculations Ledger */}
            <div className="space-y-2 text-xs flex flex-col justify-between">
              <div className="space-y-2 p-4 rounded-2xl bg-slate-950/40 border border-slate-800/80 print:border-slate-300 print:bg-slate-50">
                <span className="font-bold text-slate-400 print:text-slate-600 uppercase text-[10px] tracking-wider block pb-1 border-b border-slate-800/80 print:border-slate-200">
                  Billing Account Ledger
                </span>

                {discountAmount > 0 ? (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-800/80 print:border-slate-200">
                      <span className="text-slate-400 print:text-slate-600">Current Charges Subtotal:</span>
                      <span className="font-mono font-semibold text-slate-200 print:text-black">{formatCurrency(itemsSubtotal)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80 print:border-slate-200 text-emerald-400 print:text-emerald-700">
                      <span>Less: Special Promo / Discount Credit:</span>
                      <span className="font-mono font-semibold">-{formatCurrency(discountAmount)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80 print:border-slate-200 text-slate-300 print:text-slate-700 font-medium">
                      <span>Net Current Month Charges:</span>
                      <span className="font-mono">{formatCurrency(netCurrentCharges)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between py-1 border-b border-slate-800/80 print:border-slate-200">
                    <span className="text-slate-400 print:text-slate-600">Current Month Charges:</span>
                    <span className="font-mono font-semibold text-slate-200 print:text-black">{formatCurrency(netCurrentCharges)}</span>
                  </div>
                )}

                {previousBalanceAmount > 0 && (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-800/80 print:border-slate-200 text-rose-400 print:text-rose-700 font-semibold">
                      <span>Previous Unpaid Balance (Arrears):</span>
                      <span className="font-mono">+{formatCurrency(previousBalanceAmount)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-700 print:border-slate-300 font-bold text-sm">
                      <span className="text-slate-100 print:text-black">Total Invoiced Amount:</span>
                      <span className="font-mono text-slate-100 print:text-black">{formatCurrency(computedTotalAmount)}</span>
                    </div>
                  </>
                )}

                {paidAmount > 0 && (
                  <div className="flex justify-between py-1 text-emerald-400 print:text-emerald-700 font-semibold">
                    <span>Less: Payments Received to Date:</span>
                    <span className="font-mono">-{formatCurrency(paidAmount)}</span>
                  </div>
                )}
              </div>

              {/* Total Balance Due Card */}
              <div className="flex items-center justify-between py-3.5 px-4 rounded-2xl bg-cyan-950/80 border-2 border-cyan-500/80 print:bg-slate-100 print:border-slate-900 shadow-xl shadow-cyan-950/40">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 print:text-slate-800 block">
                    Amount Payable
                  </span>
                  <span className="text-sm font-black text-slate-100 print:text-black">
                    TOTAL AMOUNT DUE
                  </span>
                </div>
                <span className="font-mono font-black text-xl text-cyan-300 print:text-slate-950">
                  {formatCurrency(computedTotalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* 6. Discount Tool Section (no-print) */}
          {hasPermission('canApplyInvoiceDiscount') && (
            <div className="no-print pt-2 border-t border-slate-800">
              {!showDiscountForm ? (
                <button
                  onClick={() => setShowDiscountForm(true)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Apply Promo Discount or Credit Adjustment to this Bill</span>
                </button>
              ) : (
                <form onSubmit={handleApplyDiscount} className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400">Discount Amount (PHP ₱):</span>
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
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDiscountForm(false)}
                    className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          )}

          {/* 7. Official Reminders */}
          <div className="pt-4 border-t border-slate-800 print:border-slate-300 text-[11px] text-slate-400 print:text-slate-600">
            <div className="space-y-1.5">
              <p className="font-semibold text-slate-300 print:text-black">Important Reminders:</p>
              <p>• Please include your Account No. ({invoice.accountNo}) in payment notes when paying via online channels.</p>
              {isPaid ? (
                <p className="text-emerald-400 print:text-emerald-700 font-medium">
                  • Payment received in full{invoice.paidAt ? ` on ${formatDate(invoice.paidAt)}` : ''}. Thank you for keeping your account active and in good standing.
                </p>
              ) : isOverdue ? (
                <p className="text-rose-400 print:text-rose-700 font-medium">
                  • Payment was due on {formatDate(invoice.dueDate)}. Please settle immediately to maintain uninterrupted service connectivity.
                </p>
              ) : paidAmount > 0 && computedBalanceDue > 0 ? (
                <p>
                  • Partial payment received. Please settle remaining balance of {formatCurrency(computedBalanceDue)} on or before {formatDate(invoice.dueDate)} to maintain uninterrupted service connectivity.
                </p>
              ) : (
                <p>• Settle on or before {formatDate(invoice.dueDate)} to ensure uninterrupted service connectivity.</p>
              )}
              <p>• For billing assistance or hotline: <strong className="text-slate-200 print:text-black font-mono">{businessProfile.representative.mobile}</strong>{businessProfile.representative.email ? ` | Email: ${businessProfile.representative.email}` : ''}.</p>
              <p className="text-[10px] text-slate-500 print:text-slate-500 italic">
                This Statement of Account serves as an official billing invoice for telecommunications services.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

