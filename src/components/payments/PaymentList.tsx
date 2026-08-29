import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Printer,
  FileSpreadsheet,
  Receipt,
  CheckCircle2,
  Calendar,
  DollarSign,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Payment, PaymentMethod } from '../../types';
import { formatCurrency, formatDateTime, getPaymentMethodLabel } from '../../utils/formatters';
import { generateOfficialReceiptPDF } from '../../utils/pdfGenerator';
import { EODModal } from './EODModal';
import { PaymentVerificationQueue } from './PaymentVerificationQueue';
import { PaymentWebhookManager } from './PaymentWebhookManager';

interface PaymentListProps {
  onOpenPaymentModal: () => void;
  onSelectReceipt: (paymentId: string) => void;
  onSelectCustomer: (customerId: string) => void;
}

export const PaymentList: React.FC<PaymentListProps> = ({
  onOpenPaymentModal,
  onSelectReceipt,
  onSelectCustomer,
}) => {
  const { payments, paymentSubmissions, businessProfile, deletePayment, searchTerm, setSearchTerm } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'payments' | 'verification_queue' | 'webhooks'>('payments');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [showEODModal, setShowEODModal] = useState<boolean>(false);

  const pendingSubmissionsCount = paymentSubmissions.filter((s) => s.status === 'pending_review').length;

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      p.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.accountNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.referenceNumber && p.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesMethod = methodFilter === 'all' || p.paymentMethod === methodFilter;
    return matchesSearch && matchesMethod;
  });

  const totalCollected = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  // Breakdown by channel
  const gcashTotal = payments.filter((p) => p.paymentMethod === 'gcash').reduce((s, p) => s + p.amount, 0);
  const cashTotal = payments.filter((p) => p.paymentMethod === 'cash').reduce((s, p) => s + p.amount, 0);
  const mayaTotal = payments.filter((p) => p.paymentMethod === 'maya').reduce((s, p) => s + p.amount, 0);
  const bankTotal = payments.filter((p) => p.paymentMethod === 'bank_transfer' || p.paymentMethod === 'check').reduce((s, p) => s + p.amount, 0);

  const exportPaymentsToCSV = () => {
    const headers = [
      'OR Number',
      'Account No',
      'Customer Name',
      'Date & Time',
      'Payment Method',
      'Reference No',
      'Applied Invoice',
      'Amount (PHP)',
      'Cashier',
      'Notes',
    ];

    const rows = filteredPayments.map((p) => [
      p.receiptNumber,
      p.accountNo,
      `"${p.customerName}"`,
      p.paymentDate,
      p.paymentMethod,
      p.referenceNumber || '',
      p.invoiceNumber || 'Advance Deposit',
      p.amount,
      `"${p.cashierName}"`,
      `"${p.notes || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `swiftstream_payments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <span>Admin Collections & Payment Register</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track GCash, Maya, Cash, and Bank deposits with instant Official Receipts (OR).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowEODModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-semibold transition-all hover:scale-105"
            title="Generate Admin End-of-Day (EOD) Z-Reading"
          >
            <Receipt className="w-3.5 h-3.5 text-emerald-400" />
            <span>EOD Z-Reading</span>
          </button>

          <button
            onClick={exportPaymentsToCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenPaymentModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span>New Payment Entry</span>
          </button>
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('payments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'payments'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Official Receipts & Collections ({payments.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('verification_queue')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'verification_queue'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Proof-of-Payment Queue</span>
          {pendingSubmissionsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/30 text-amber-300 border border-amber-500/50 font-mono animate-pulse">
              {pendingSubmissionsCount} Pending
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('webhooks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'webhooks'
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-300" />
          <span>⚡ Live Gateways & Auto-Reconnect</span>
        </button>
      </div>

      {activeSubTab === 'webhooks' ? (
        <PaymentWebhookManager />
      ) : activeSubTab === 'verification_queue' ? (
        <PaymentVerificationQueue onSelectCustomer={onSelectCustomer} />
      ) : (
        <>
          {/* Payment Channel Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">📱 GCash Collections</span>
              <h4 className="text-lg font-bold text-cyan-400 mt-1">{formatCurrency(gcashTotal)}</h4>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">💵 Cash Over Counter</span>
              <h4 className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(cashTotal)}</h4>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">💳 Maya (PayMaya)</span>
              <h4 className="text-lg font-bold text-purple-400 mt-1">{formatCurrency(mayaTotal)}</h4>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">🏦 Bank / Check</span>
              <h4 className="text-lg font-bold text-amber-400 mt-1">{formatCurrency(bankTotal)}</h4>
            </div>
          </div>

          {/* Filter Tabs & Search */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Payments' },
                  { id: 'gcash', label: 'GCash' },
                  { id: 'cash', label: 'Cash Counter' },
                  { id: 'maya', label: 'Maya' },
                  { id: 'bank_transfer', label: 'Bank Transfer' },
                  { id: 'check', label: 'Check' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMethodFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      methodFilter === tab.id
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 sm:w-64 max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search receipt, name, ref..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-400">
              <span>
                Showing <strong className="text-slate-200">{filteredPayments.length}</strong> payments
              </span>
              <span>
                Total Filtered:{' '}
                <strong className="text-emerald-400 font-mono text-sm">{formatCurrency(totalCollected)}</strong>
              </span>
            </div>
          </div>

          {/* Payments Table */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Receipt (OR) #</th>
                    <th className="py-3.5 px-4">Account / Subscriber</th>
                    <th className="py-3.5 px-4">Payment Method</th>
                    <th className="py-3.5 px-4">Reference No.</th>
                    <th className="py-3.5 px-4">Invoice Applied</th>
                    <th className="py-3.5 px-4">Amount Paid</th>
                    <th className="py-3.5 px-4">Admin / Collector</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No payments found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p) => {
                      const methodInfo = getPaymentMethodLabel(p.paymentMethod);
                      return (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                            {p.receiptNumber}
                            <span className="block text-[10px] text-slate-500 font-sans font-normal">
                              {formatDateTime(p.paymentDate)}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => onSelectCustomer(p.customerId)}
                              className="font-semibold text-slate-100 hover:text-emerald-400 hover:underline block text-left"
                            >
                              {p.customerName}
                            </button>
                            <span className="font-mono text-[10px] text-slate-400">{p.accountNo}</span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 font-medium">
                              <span>{methodInfo.icon}</span>
                              <span>{methodInfo.label}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            {p.referenceNumber || <span className="text-slate-600">—</span>}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-slate-400">
                            {p.invoiceNumber ? (
                              <span className="text-slate-300">{p.invoiceNumber}</span>
                            ) : (
                              <span className="text-emerald-400/80 bg-emerald-950/60 px-1.5 py-0.5 rounded text-[10px]">
                                Advance Deposit
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 text-sm">
                            {formatCurrency(p.amount)}
                          </td>

                          <td className="py-3.5 px-4 text-slate-400 truncate max-w-[120px]">
                            {p.cashierName}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onSelectReceipt(p.id)}
                                className="p-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
                                title="View Receipt"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  const pdf = generateOfficialReceiptPDF(p, businessProfile);
                                  pdf.save(`${p.receiptNumber}.pdf`);
                                }}
                                className="p-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors"
                                title="Download Thermal 80mm PDF"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* EOD Z-Reading Modal */}
      {showEODModal && <EODModal onClose={() => setShowEODModal(false)} />}
    </div>
  );
};
