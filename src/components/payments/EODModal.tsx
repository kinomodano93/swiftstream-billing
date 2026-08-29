import React, { useState } from 'react';
import {
  FileText,
  X,
  Download,
  CreditCard,
  CheckCircle2,
  Calendar,
  User,
  Building2,
  Printer,
  DollarSign,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { generateEODReportPDF } from '../../utils/pdfGenerator';

interface EODModalProps {
  onClose: () => void;
}

export const EODModal: React.FC<EODModalProps> = ({ onClose }) => {
  const { payments, businessProfile } = useApp();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [cashierName, setCashierName] = useState<string>(
    `${businessProfile.representative.firstName} ${businessProfile.representative.lastName}`
  );

  // Filter payments by selected date
  const shiftPayments = payments.filter((p) => p.paymentDate.startsWith(selectedDate));

  const cashPayments = shiftPayments.filter((p) => p.paymentMethod === 'cash');
  const gcashPayments = shiftPayments.filter((p) => p.paymentMethod === 'gcash');
  const mayaPayments = shiftPayments.filter((p) => p.paymentMethod === 'maya');
  const bankPayments = shiftPayments.filter((p) => p.paymentMethod === 'bank_transfer');
  const otherPayments = shiftPayments.filter((p) => p.paymentMethod === 'other' || p.paymentMethod === 'check');

  const cashTotal = cashPayments.reduce((s, p) => s + p.amount, 0);
  const gcashTotal = gcashPayments.reduce((s, p) => s + p.amount, 0);
  const mayaTotal = mayaPayments.reduce((s, p) => s + p.amount, 0);
  const bankTotal = bankPayments.reduce((s, p) => s + p.amount, 0);
  const grandTotal = shiftPayments.reduce((s, p) => s + p.amount, 0);

  const handleDownloadPDF = () => {
    const pdf = generateEODReportPDF(shiftPayments, cashierName, selectedDate, businessProfile);
    pdf.save(`SwiftStream_ZReading_EOD_${selectedDate}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                Cashier End-of-Day (EOD) Z-Reading
              </h3>
              <p className="text-xs text-slate-400">
                Daily cash drawer reconciliation & settlement report
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date & Cashier Selection */}
        <div className="p-4 bg-slate-950/50 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Settlement Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Shift Cashier / Lead</label>
            <input
              type="text"
              value={cashierName}
              onChange={(e) => setCashierName(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* Top KPI Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Total Collected</span>
              <h4 className="text-2xl font-black font-mono text-emerald-400">
                {formatCurrency(grandTotal)}
              </h4>
              <p className="text-[11px] text-slate-400">{shiftPayments.length} Total Transactions</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Physical Cash in Drawer</span>
              <h4 className="text-2xl font-black font-mono text-cyan-400">
                {formatCurrency(cashTotal)}
              </h4>
              <p className="text-[11px] text-slate-400">{cashPayments.length} Cash Payments</p>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-3 bg-slate-950 font-bold text-slate-300 border-b border-slate-800">
              Payment Gateway & Channel Breakdown
            </div>

            <div className="divide-y divide-slate-800/60 bg-slate-900/60">
              <div className="p-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-300">
                  <span>💵</span>
                  <span>Physical Cash Over-the-Counter</span>
                </span>
                <div className="text-right font-mono">
                  <span className="text-slate-400 mr-3 text-[11px]">{cashPayments.length} txns</span>
                  <span className="font-bold text-slate-100">{formatCurrency(cashTotal)}</span>
                </div>
              </div>

              <div className="p-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-300">
                  <span>📱</span>
                  <span>GCash Merchant E-Wallet</span>
                </span>
                <div className="text-right font-mono">
                  <span className="text-slate-400 mr-3 text-[11px]">{gcashPayments.length} txns</span>
                  <span className="font-bold text-emerald-400">{formatCurrency(gcashTotal)}</span>
                </div>
              </div>

              <div className="p-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-300">
                  <span>💳</span>
                  <span>Maya (PayMaya) QR</span>
                </span>
                <div className="text-right font-mono">
                  <span className="text-slate-400 mr-3 text-[11px]">{mayaPayments.length} txns</span>
                  <span className="font-bold text-cyan-400">{formatCurrency(mayaTotal)}</span>
                </div>
              </div>

              <div className="p-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-300">
                  <span>🏦</span>
                  <span>Bank Transfers (BDO / Landbank)</span>
                </span>
                <div className="text-right font-mono">
                  <span className="text-slate-400 mr-3 text-[11px]">{bankPayments.length} txns</span>
                  <span className="font-bold text-slate-200">{formatCurrency(bankTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Verification Note */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">Operations Settlement Compliance:</p>
            <p>
              TIN: <span className="font-mono text-slate-200">{businessProfile.tin}</span> • Lagonoy Branch Node
            </p>
            <p>Printed Z-Reading receipts must be filed with daily cashier envelope.</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-105"
          >
            <Download className="w-4 h-4" />
            <span>Download 80mm Thermal Z-Reading PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};

