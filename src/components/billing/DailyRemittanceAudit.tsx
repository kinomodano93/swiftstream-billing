import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Calendar,
  UserCheck,
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  CreditCard,
  Building,
  Smartphone,
  Plus,
  Search,
  Filter,
  Layers,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DailyRemittanceRecord, Payment } from '../../types';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { generateEODReportPDF } from '../../utils/pdfGenerator';

export const DailyRemittanceAudit: React.FC = () => {
  const { payments, dailyRemittances, addDailyRemittance, closeDailyRemittance, businessProfile, showToast } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [actualCashCounted, setActualCashCounted] = useState<string>('');
  const [verifierName, setVerifierName] = useState<string>('Leonardo Flojo Jr.');
  const [notes, setNotes] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Filter payments for selected date
  const selectedDatePayments = useMemo(() => {
    return payments.filter((p) => p.paymentDate.startsWith(selectedDate));
  }, [payments, selectedDate]);

  const cashTotal = selectedDatePayments.filter((p) => p.paymentMethod === 'cash').reduce((sum, p) => sum + p.amount, 0);
  const gcashTotal = selectedDatePayments.filter((p) => p.paymentMethod === 'gcash').reduce((sum, p) => sum + p.amount, 0);
  const mayaTotal = selectedDatePayments.filter((p) => p.paymentMethod === 'maya').reduce((sum, p) => sum + p.amount, 0);
  const bankTotal = selectedDatePayments.filter((p) => p.paymentMethod === 'bank_transfer').reduce((sum, p) => sum + p.amount, 0);
  const totalCollected = selectedDatePayments.reduce((sum, p) => sum + p.amount, 0);

  // Check if remittance record exists for selected date
  const existingRemittance = dailyRemittances.find((r) => r.remittanceDate === selectedDate);
  const isClosed = existingRemittance?.status === 'closed';

  const enteredCashNum = parseFloat(actualCashCounted) || 0;
  const liveDiscrepancy = enteredCashNum ? enteredCashNum - cashTotal : 0;

  const handleCloseRemittance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredCashNum && enteredCashNum !== 0) {
      showToast('error', 'Invalid Amount', 'Please enter actual cash counted in the drawer.');
      return;
    }

    if (existingRemittance) {
      closeDailyRemittance(existingRemittance.id, enteredCashNum, verifierName, notes);
    } else {
      const newRec = addDailyRemittance({
        remittanceDate: selectedDate,
        cashierName: businessProfile.representative.firstName + ' ' + businessProfile.representative.lastName,
        totalCash: cashTotal,
        totalGcash: gcashTotal,
        totalMaya: mayaTotal,
        totalBank: bankTotal,
        totalCollected,
        paymentCount: selectedDatePayments.length,
        actualCashInDrawer: enteredCashNum,
        discrepancy: enteredCashNum - cashTotal,
        status: 'closed',
        verifiedBy: verifierName,
        notes,
        closedAt: new Date().toISOString(),
      });
      closeDailyRemittance(newRec.id, enteredCashNum, verifierName, notes);
    }
  };

  const handlePrintEOD = () => {
    try {
      const doc = generateEODReportPDF(
        selectedDatePayments,
        businessProfile.representative.firstName + ' ' + businessProfile.representative.lastName,
        selectedDate,
        businessProfile
      );
      doc.save(`swiftstream_eod_${selectedDate}.pdf`);
      showToast('success', 'EOD Report Generated', 'Saved cashier Z-reading settlement PDF.');
    } catch (e) {
      console.error(e);
      showToast('error', 'Error', 'Failed to generate EOD report.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Date Selector */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-cyan-950 text-cyan-400 border border-cyan-800/50 shadow-inner">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Daily Cashier Remittance & Collection Drawer Audit</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                  isClosed
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                    : 'bg-amber-950 text-amber-300 border border-amber-800/50'
                }`}
              >
                {isClosed ? 'Drawer Reconciled & Closed' : 'Open Drawer'}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              End-of-Day (EOD) Z-Reading, physical cash in drawer reconciliation, and collector turnover.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-200 font-mono focus:outline-none"
            />
          </div>

          <button
            onClick={handlePrintEOD}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-semibold transition-all hover:scale-105"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>Print Z-Reading</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">Physical Cash Drawer</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-xl font-black font-mono text-emerald-400">{formatCurrency(cashTotal)}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Physical Bills & Coins</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">GCash E-Wallet</span>
            <Smartphone className="w-4 h-4 text-sky-400" />
          </div>
          <span className="text-xl font-black font-mono text-sky-400">{formatCurrency(gcashTotal)}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Online Wallet Transfers</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">Maya / QR Ph</span>
            <CreditCard className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-xl font-black font-mono text-purple-400">{formatCurrency(mayaTotal)}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">PayMaya & QR Ph</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">Bank Transfers</span>
            <Building className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xl font-black font-mono text-amber-400">{formatCurrency(bankTotal)}</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">BDO / BPI Online</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-cyan-800/40 bg-gradient-to-br from-slate-900 to-cyan-950/40">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold text-cyan-300">Total Shift Revenue</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-xl font-black font-mono text-cyan-300">{formatCurrency(totalCollected)}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{selectedDatePayments.length} Transactions</span>
        </div>
      </div>

      {/* Main Grid: Reconciliation Drawer + Payments Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Box 1: Drawer Reconciliation Box */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/40">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100">Cash Drawer Reconciliation</h4>
                <p className="text-[11px] text-slate-400">Count physical bills and close shift</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleCloseRemittance} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">System Expected Cash in Drawer:</label>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-base font-bold text-emerald-400">
                {formatCurrency(cashTotal)}
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Actual Physical Cash Counted (₱):</label>
              <input
                type="number"
                step="any"
                disabled={isClosed}
                value={isClosed ? existingRemittance?.actualCashInDrawer : actualCashCounted}
                onChange={(e) => setActualCashCounted(e.target.value)}
                placeholder="e.g. 8500"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-60"
                required
              />
            </div>

            {/* Live Discrepancy Indicator */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Cash Discrepancy:</span>
              <span
                className={`font-mono font-bold ${
                  (isClosed ? existingRemittance?.discrepancy || 0 : liveDiscrepancy) === 0
                    ? 'text-emerald-400'
                    : (isClosed ? existingRemittance?.discrepancy || 0 : liveDiscrepancy) > 0
                    ? 'text-cyan-400'
                    : 'text-rose-400'
                }`}
              >
                {formatCurrency(isClosed ? existingRemittance?.discrepancy || 0 : liveDiscrepancy)}
                {(isClosed ? existingRemittance?.discrepancy || 0 : liveDiscrepancy) === 0 && ' (Balanced)'}
              </span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Audited & Verified By:</label>
              <input
                type="text"
                disabled={isClosed}
                value={isClosed ? existingRemittance?.verifiedBy : verifierName}
                onChange={(e) => setVerifierName(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Remittance Audit Notes:</label>
              <textarea
                rows={2}
                disabled={isClosed}
                value={isClosed ? existingRemittance?.notes : notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarks, coin breakdown, or overage notes..."
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500 disabled:opacity-60 resize-none"
              />
            </div>

            {!isClosed ? (
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Close & Lock Daily Drawer (Z-Reading)
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 text-center font-bold text-xs flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Drawer Closed at {formatDateTime(existingRemittance?.closedAt || '')}</span>
              </div>
            )}
          </form>
        </div>

        {/* Box 2: Payments Collected on Selected Date */}
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card space-y-4 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h4 className="font-bold text-sm text-slate-100">
                Payment Transactions on {formatDate(selectedDate)}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedDatePayments.length} collection receipts recorded
              </p>
            </div>

            <span className="text-xs text-slate-400 font-mono">
              Total: <strong className="text-cyan-400">{formatCurrency(totalCollected)}</strong>
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                  <th className="py-3 px-3">Receipt / Time</th>
                  <th className="py-3 px-3">Subscriber</th>
                  <th className="py-3 px-3">Channel</th>
                  <th className="py-3 px-3">Ref Code</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/60 font-mono">
                {selectedDatePayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3">
                      <strong className="text-slate-100 block text-xs">{p.receiptNumber}</strong>
                      <span className="text-[10px] text-slate-500">{new Date(p.paymentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="text-slate-200 font-semibold block">{p.customerName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{p.accountNo}</span>
                    </td>
                    <td className="py-2.5 px-3 uppercase text-cyan-300 text-[11px] font-bold">
                      {p.paymentMethod}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {p.referenceNumber || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          p.remittanceStatus === 'remitted'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                            : 'bg-amber-950 text-amber-300 border border-amber-800/40'
                        }`}
                      >
                        {p.remittanceStatus || 'pending'}
                      </span>
                    </td>
                  </tr>
                ))}
                {selectedDatePayments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-sans text-xs">
                      No payment collections recorded on {formatDate(selectedDate)}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Historical Remittance Drawer Logs */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card space-y-4">
        <h4 className="font-bold text-sm text-slate-100">Past Daily Remittance Records</h4>
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Cashier</th>
                <th className="py-3 px-3 text-right">Physical Cash</th>
                <th className="py-3 px-3 text-right">GCash / Maya</th>
                <th className="py-3 px-3 text-right">Total Revenue</th>
                <th className="py-3 px-3 text-right">Discrepancy</th>
                <th className="py-3 px-3">Auditor</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/60 font-mono">
              {dailyRemittances.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-100">{formatDate(r.remittanceDate)}</td>
                  <td className="py-3 px-3 font-sans text-slate-300">{r.cashierName}</td>
                  <td className="py-3 px-3 text-right text-emerald-400">{formatCurrency(r.actualCashInDrawer)}</td>
                  <td className="py-3 px-3 text-right text-sky-400">{formatCurrency(r.totalGcash + r.totalMaya)}</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-100">{formatCurrency(r.totalCollected)}</td>
                  <td className="py-3 px-3 text-right">
                    <span className={r.discrepancy === 0 ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                      {formatCurrency(r.discrepancy)}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-sans text-slate-400">{r.verifiedBy || '—'}</td>
                  <td className="py-3 px-4 text-center font-sans">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        r.status === 'closed'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                          : 'bg-amber-950 text-amber-300 border border-amber-800/50'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

