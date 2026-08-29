import React, { useState, useRef } from 'react';
import {
  Printer,
  Download,
  X,
  CheckCircle2,
  Receipt,
  FileText,
  Copy,
  Check,
  Zap,
  ArrowDownCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Payment, Invoice } from '../../types';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { generateThermalReceiptPDF } from '../../utils/pdfGenerator';

interface ThermalReceiptModalProps {
  payment: Payment;
  invoice?: Invoice;
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  payment,
  invoice,
  onClose,
}) => {
  const { businessProfile, showToast } = useApp();
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm');
  const [copied, setCopied] = useState<boolean>(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    try {
      const doc = generateThermalReceiptPDF(payment, invoice, businessProfile, paperWidth);
      doc.save(`swiftstream_receipt_${payment.receiptNumber}_${paperWidth}.pdf`);
      showToast('success', 'PDF Downloaded', `Saved ${paperWidth} thermal receipt PDF.`);
    } catch (e) {
      console.error(e);
      showToast('error', 'Download Failed', 'Could not generate thermal PDF.');
    }
  };

  const handleCopyText = () => {
    const textReceipt = `
========================================
       SWIFTSTREAM TELECOMMUNICATION    
   High-Speed Fiber Internet & Repair   
========================================
Official Receipt: ${payment.receiptNumber}
Date: ${formatDateTime(payment.paymentDate)}
Cashier: ${payment.cashierName}
----------------------------------------
Account No: ${payment.accountNo}
Subscriber: ${payment.customerName}
Payment Method: ${payment.paymentMethod.toUpperCase()}
${payment.referenceNumber ? `Ref No: ${payment.referenceNumber}\n` : ''}----------------------------------------
AMOUNT COLLECTED: ${formatCurrency(payment.amount)}
${invoice ? `Invoice No: ${invoice.invoiceNumber}\nRemaining Balance: ${formatCurrency(invoice.balanceDue)}\n` : ''}
STATUS: SERVICE ACTIVE / UNBLOCKED
========================================
Thank you for your prompt payment!
Keep this receipt for verification.
`;
    navigator.clipboard.writeText(textReceipt.trim());
    setCopied(true);
    showToast('success', 'Text Copied', 'Receipt text copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">
                Thermal POS Mini-Receipt ({paperWidth})
              </h3>
              <p className="text-[11px] text-slate-400">
                Receipt #{payment.receiptNumber} • {formatDate(payment.paymentDate)}
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

        {/* Paper Size Selector & Action Buttons Bar */}
        <div className="px-6 py-3 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              onClick={() => setPaperWidth('58mm')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                paperWidth === '58mm'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              58mm Roll
            </button>
            <button
              onClick={() => setPaperWidth('80mm')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                paperWidth === '80mm'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              80mm Roll
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
              title="Copy receipt as plaintext for SMS/Viber"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition-colors"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105"
            >
              <Printer className="w-4 h-4" />
              <span>Print ESC/POS</span>
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-950 flex justify-center">
          {/* Thermal Receipt Paper simulation */}
          <div
            ref={receiptRef}
            className={`bg-white text-slate-900 font-mono text-[11px] p-5 rounded-md shadow-2xl border border-slate-300 transition-all duration-300 print:m-0 print:p-0 print:border-none print:shadow-none ${
              paperWidth === '58mm' ? 'w-[260px]' : 'w-[340px]'
            }`}
          >
            {/* Store Header */}
            <div className="text-center space-y-0.5 pb-3 border-b border-dashed border-slate-400">
              <h2 className="font-black text-sm uppercase tracking-wide">{businessProfile.name}</h2>
              <p className="text-[9px] text-slate-700 font-sans">High-Speed Fiber Internet & Repair Services</p>
              <p className="text-[9px] text-slate-600">
                {businessProfile.address.barangay}, {businessProfile.address.city}, {businessProfile.address.province}
              </p>
              <p className="text-[9px] text-slate-600">TIN: {businessProfile.tin} • Cell: {businessProfile.representative.mobile}</p>
            </div>

            {/* Title */}
            <div className="text-center py-2 border-b border-dashed border-slate-400">
              <span className="font-bold text-xs uppercase block">OFFICIAL COLLECTION RECEIPT</span>
              <span className="text-[10px] text-slate-600 block">OR #{payment.receiptNumber}</span>
            </div>

            {/* Metadata Fields */}
            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-slate-600">Date/Time:</span>
                <span>{formatDateTime(payment.paymentDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Cashier:</span>
                <span className="truncate max-w-[160px]">{payment.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Account No:</span>
                <span className="font-bold">{payment.accountNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Subscriber:</span>
                <span className="font-bold truncate max-w-[160px]">{payment.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Payment Channel:</span>
                <span className="font-bold uppercase">{payment.paymentMethod}</span>
              </div>
              {payment.referenceNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Ref Code:</span>
                  <span className="font-bold">{payment.referenceNumber}</span>
                </div>
              )}
            </div>

            {/* Item Breakdown */}
            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1.5 text-[10px]">
              <div className="flex justify-between font-bold pb-1 border-b border-slate-200">
                <span>Description</span>
                <span>Amount</span>
              </div>

              {invoice?.items ? (
                invoice.items.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="truncate max-w-[180px]">{item.description}</span>
                    <span>{formatCurrency(item.amount)}</span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between">
                  <span>Fiber Internet Subscription</span>
                  <span>{formatCurrency(payment.amount)}</span>
                </div>
              )}

              {invoice && invoice.appliedCredit && invoice.appliedCredit > 0 ? (
                <div className="flex justify-between text-emerald-700">
                  <span>Advance Wallet Credit</span>
                  <span>-{formatCurrency(invoice.appliedCredit)}</span>
                </div>
              ) : null}
            </div>

            {/* Total Paid Box */}
            <div className="py-3 border-b border-dashed border-slate-400 space-y-1">
              <div className="flex justify-between items-baseline text-sm font-bold">
                <span>AMOUNT PAID:</span>
                <span className="text-base font-black">{formatCurrency(payment.amount)}</span>
              </div>

              {invoice && (
                <div className="flex justify-between text-[10px] text-slate-600 pt-1">
                  <span>Remaining Balance Due:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(invoice.balanceDue)}</span>
                </div>
              )}
            </div>

            {/* Bottom Footer & Compliance */}
            <div className="text-center pt-3 space-y-1 text-[9px] text-slate-600">
              <p className="font-bold text-slate-800 uppercase">STATUS: LINE ACTIVE & UNBLOCKED</p>
              <p>Thank you for choosing {businessProfile.name}!</p>
              <p>For support, dial {businessProfile.representative.mobile}</p>
              <p className="pt-1 text-[8px] text-slate-400">--- SYSTEM GENERATED POS RECEIPT ---</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

