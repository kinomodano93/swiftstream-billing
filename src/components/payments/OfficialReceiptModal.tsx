import React from 'react';
import { X, Printer, Download, Receipt, CheckCircle2, ShieldCheck, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDateTime, getPaymentMethodLabel } from '../../utils/formatters';
import { generateOfficialReceiptPDF } from '../../utils/pdfGenerator';

interface OfficialReceiptModalProps {
  paymentId: string;
  onClose: () => void;
}

export const OfficialReceiptModal: React.FC<OfficialReceiptModalProps> = ({ paymentId, onClose }) => {
  const { payments, businessProfile } = useApp();

  const payment = payments.find((p) => p.id === paymentId);
  if (!payment) return null;

  const method = getPaymentMethodLabel(payment.paymentMethod);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const pdf = generateOfficialReceiptPDF(payment, businessProfile);
    pdf.save(`${payment.receiptNumber}.pdf`);
  };

  const qrReceiptPayload = JSON.stringify({
    or: payment.receiptNumber,
    acct: payment.accountNo,
    amt: payment.amount,
    date: payment.paymentDate,
    ref: payment.referenceNumber || 'CASH',
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Top Control Bar (no-print) */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span className="font-mono font-bold text-xs text-slate-100">{payment.receiptNumber}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            <button
              onClick={handlePrint}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
              title="Print Receipt"
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

        {/* 80mm Thermal Receipt Layout */}
        <div className="p-6 overflow-y-auto flex-1 bg-white text-slate-900 font-mono text-xs space-y-4 print:p-0">
          {/* Header */}
          <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-3">
            <h3 className="font-extrabold text-sm text-slate-950 uppercase tracking-tight">
              {businessProfile.name}
            </h3>
            <p className="text-[10px] text-slate-600">{businessProfile.tradeName}</p>
            <p className="text-[10px] text-slate-600 font-bold">TIN: {businessProfile.tin}</p>
            <p className="text-[10px] text-slate-600">
              {businessProfile.address.street}, {businessProfile.address.barangay}, {businessProfile.address.city}, {businessProfile.address.province}
            </p>
            <p className="text-[10px] text-slate-600">Mobile / Helpline: {businessProfile.representative.mobile}</p>
          </div>

          {/* Receipt Title & Meta */}
          <div className="text-center space-y-1">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
              OFFICIAL BILLING RECEIPT
            </h4>
            <div className="flex justify-between text-[11px] text-slate-600 pt-1">
              <span>OR No: <strong className="text-slate-950">{payment.receiptNumber}</strong></span>
              <span>{formatDateTime(payment.paymentDate)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>Cashier: {payment.cashierName}</span>
              <span>Node: Lagonoy</span>
            </div>
          </div>

          {/* Customer & Payment Details */}
          <div className="border-t border-b border-dashed border-slate-300 py-2.5 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Subscriber Name:</span>
              <span className="font-bold text-slate-950 text-right">{payment.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Account No:</span>
              <span className="font-bold text-slate-950">{payment.accountNo}</span>
            </div>
            {payment.invoiceNumber && (
              <div className="flex justify-between">
                <span className="text-slate-500">Settled Invoice:</span>
                <span className="font-bold text-cyan-800">{payment.invoiceNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Mode:</span>
              <span className="font-bold text-slate-950 uppercase">{payment.paymentMethod}</span>
            </div>
            {payment.referenceNumber && (
              <div className="flex justify-between">
                <span className="text-slate-500">Reference No:</span>
                <span className="font-bold text-slate-950">{payment.referenceNumber}</span>
              </div>
            )}
          </div>

          {/* Amount Paid Big Block */}
          <div className="py-2 flex items-center justify-between text-base font-extrabold border-b border-dashed border-slate-300">
            <span>TOTAL PAID:</span>
            <span className="text-emerald-700">{formatCurrency(payment.amount)}</span>
          </div>

          {/* QR Code Validation */}
          <div className="flex flex-col items-center justify-center pt-2 space-y-1 text-center">
            <div className="p-1 border border-slate-200 rounded">
              <QRCodeSVG value={qrReceiptPayload} size={75} />
            </div>
            <span className="text-[9px] text-slate-400">Scan QR to verify authentic receipt</span>
          </div>

          {/* Footer message */}
          <div className="text-center text-[10px] text-slate-500 space-y-0.5 pt-1">
            <p className="font-bold text-slate-700">Thank you for your business!</p>
            <p>Your high-speed fiber connection is active.</p>
            <p className="text-[9px]">SwiftStream Telecommunication & Repair Shop</p>
          </div>
        </div>
      </div>
    </div>
  );
};

