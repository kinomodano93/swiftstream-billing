import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Zap,
  Search,
  Download,
  CreditCard,
  Send,
  Eye,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Receipt,
  Printer,
  ShieldCheck,
  DollarSign,
  Layers,
  Clock,
  Lock,
  RefreshCw,
  CheckSquare,
  Square,
  MinusSquare,
  X,
  AlignJustify,
  List,
  Loader2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Invoice, InvoiceStatus, Payment } from '../../types';
import { formatCurrency, formatDate, getInvoiceStatusBadge } from '../../utils/formatters';
import { generateInvoicePDF } from '../../utils/pdfGenerator';

import { DailyRemittanceAudit } from './DailyRemittanceAudit';
import { ThermalReceiptModal } from './ThermalReceiptModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';

interface InvoiceListProps {
  onOpenBatchBillingModal: () => void;
  onOpenManualInvoiceModal: () => void;
  onOpenPaymentModal: (customerId: string, invoiceId: string) => void;
  onSelectInvoice: (invoiceId: string) => void;
  onSelectCustomer: (customerId: string) => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({
  onOpenBatchBillingModal,
  onOpenManualInvoiceModal,
  onOpenPaymentModal,
  onSelectInvoice,
  onSelectCustomer,
}) => {
  const {
    invoices,
    payments,
    paymentSubmissions,
    customers,
    plans,
    businessProfile,
    deleteInvoice,
    sendReminder,
    runDailyGraceAudit,
    triggerServerGraceAudit,
    searchTerm,
    setSearchTerm,
    setActiveTab,
    hasPermission,
  } = useApp();

  const pendingProofsCount = paymentSubmissions.filter((s) => s.status === 'pending_review').length;

  // Table density mode persisted in localStorage
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    return (localStorage.getItem('swiftstream_table_density') as 'comfortable' | 'compact') || 'comfortable';
  });

  const handleDensityChange = (newDensity: 'comfortable' | 'compact') => {
    setDensity(newDensity);
    localStorage.setItem('swiftstream_table_density', newDensity);
  };

  // Multi-select state
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchActionNotice, setBatchActionNotice] = useState<string | null>(null);

  const [activeBillingTab, setActiveBillingTab] = useState<'invoices' | 'remittances' | 'grace_audit'>('invoices');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAuditing, setIsAuditing] = useState(false);

  // Thermal Receipt Modal State
  const [selectedPaymentForThermal, setSelectedPaymentForThermal] = useState<{
    payment: Payment;
    invoice?: Invoice;
  } | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.accountNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerMobile.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalBilled = filteredInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
  const totalPaid = filteredInvoices.reduce((sum, i) => sum + i.amountPaid, 0);
  const totalOutstanding = filteredInvoices.reduce((sum, i) => sum + i.balanceDue, 0);

  // Multi-select helpers
  const isAllSelected =
    filteredInvoices.length > 0 &&
    filteredInvoices.every((inv) => selectedInvoiceIds.has(inv.id));
  const isSomeSelected =
    filteredInvoices.some((inv) => selectedInvoiceIds.has(inv.id)) && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedInvoiceIds(new Set());
    } else {
      const next = new Set(selectedInvoiceIds);
      filteredInvoices.forEach((inv) => next.add(inv.id));
      setSelectedInvoiceIds(next);
    }
  };

  const toggleSelectInvoice = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedInvoiceIds(new Set());
  };

  const exportInvoicesToCSV = (targetInvoices = filteredInvoices, filenameSuffix = '') => {
    const headers = [
      'Invoice No',
      'Account No',
      'Customer Name',
      'Mobile',
      'Issue Date',
      'Due Date',
      'Billing Period Start',
      'Billing Period End',
      'Total Amount',
      'Amount Paid',
      'Balance Due',
      'Status',
    ];

    const rows = targetInvoices.map((inv) => [
      inv.invoiceNumber,
      inv.accountNo,
      `"${inv.customerName}"`,
      inv.customerMobile,
      inv.issueDate,
      inv.dueDate,
      inv.billingPeriodStart,
      inv.billingPeriodEnd,
      inv.totalAmount,
      inv.amountPaid,
      inv.balanceDue,
      inv.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `swiftstream_invoices${filenameSuffix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const exportSelectedInvoicesToCSV = () => {
    const selected = filteredInvoices.filter((inv) => selectedInvoiceIds.has(inv.id));
    if (selected.length === 0) return;
    exportInvoicesToCSV(selected, `_selected_${selected.length}`);
  };

  const handleBatchSendSms = async () => {
    const selected = invoices.filter((inv) => selectedInvoiceIds.has(inv.id) && inv.balanceDue > 0);
    if (selected.length === 0) {
      setBatchActionNotice('None of the selected invoices have an outstanding balance due.');
      setTimeout(() => setBatchActionNotice(null), 3000);
      return;
    }
    setIsBatchProcessing(true);
    setBatchActionNotice(`Sending SMS reminders for ${selected.length} invoices...`);
    try {
      let count = 0;
      for (const inv of selected) {
        await sendReminder(inv.customerId, 'overdue_warning', 'sms', inv.id);
        count++;
      }
      setBatchActionNotice(`Successfully sent SMS reminders for ${count} invoices.`);
      setTimeout(() => setBatchActionNotice(null), 4000);
    } catch (err) {
      console.error('Batch reminder error:', err);
      setBatchActionNotice('Finished with some reminder errors.');
      setTimeout(() => setBatchActionNotice(null), 4000);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchPdfDownload = () => {
    const selected = invoices.filter((inv) => selectedInvoiceIds.has(inv.id));
    if (selected.length === 0) return;
    setIsBatchProcessing(true);
    setBatchActionNotice(`Generating PDF downloads for ${selected.length} invoices...`);
    try {
      selected.forEach((inv, index) => {
        setTimeout(() => {
          const cust = customers.find((c) => c.id === inv.customerId || c.accountNo === inv.accountNo);
          const pdf = generateInvoicePDF(inv, businessProfile, cust, plans);
          pdf.save(`${inv.invoiceNumber}.pdf`);
        }, index * 250);
      });
      setBatchActionNotice(`Queued ${selected.length} PDF invoices for download.`);
      setTimeout(() => setBatchActionNotice(null), 4000);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in">
      {/* Notice Toast */}
      {batchActionNotice && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 border border-cyan-500/60 text-cyan-200 rounded-xl shadow-2xl animate-in slide-in-from-top-3 backdrop-blur-md text-xs font-semibold">
          <Clock className="w-4 h-4 text-cyan-400 animate-spin" />
          <span>{batchActionNotice}</span>
          <button onClick={() => setBatchActionNotice(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span>Billing, Invoices & Admin POS Hub</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Statement of accounts, advance credit wallet proration, POS thermal receipts, and daily collection remittance audits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Table Density Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-0.5 text-xs">
            <button
              type="button"
              onClick={() => handleDensityChange('comfortable')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                density === 'comfortable'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Comfortable Density (Spacious rows)"
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Comfortable</span>
            </button>
            <button
              type="button"
              onClick={() => handleDensityChange('compact')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                density === 'compact'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Compact Density (More rows visible for operators/cashiers)"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Compact</span>
            </button>
          </div>

          {hasPermission('canRunGraceAudit') && (
            <button
              onClick={async () => {
                setIsAuditing(true);
                try {
                  await triggerServerGraceAudit();
                } finally {
                  setIsAuditing(false);
                }
              }}
              disabled={isAuditing}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-950/60 to-slate-800 hover:from-purple-900/70 hover:to-slate-700 text-purple-200 border border-purple-500/40 rounded-xl text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
              title={`Cloud Scheduler runs daily at ${businessProfile.dailyAuditScheduleTime || '00:00'} PHT (${businessProfile.invoiceGracePeriodDays || 5}-day grace @ ${businessProfile.gracePeriodCutoffTime || '23:59'}). Click to execute live audit across Firestore & MikroTik Core immediately.`}
            >
              {isAuditing ? (
                <RefreshCw className="w-4 h-4 text-purple-300 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              )}
              <span>{isAuditing ? 'Auditing Server...' : 'Run Server Grace Audit'}</span>
            </button>
          )}

          <button
            onClick={() => exportInvoicesToCSV()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenManualInvoiceModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/20 transition-all hover:scale-105 cursor-pointer"
            title="Create an individual invoice by selecting a subscriber"
          >
            <Plus className="w-4 h-4" />
            <span>Create Manual Invoice</span>
          </button>

          {hasPermission('canBulkGenerateInvoices') ? (
            <button
              onClick={onOpenBatchBillingModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-semibold shadow-md shadow-amber-600/20 transition-all hover:scale-105 cursor-pointer"
              title="Generate invoices in bulk across subscriber categories"
            >
              <Zap className="w-4 h-4 text-amber-100" />
              <span>Bulk Generate Invoices</span>
            </button>
          ) : (
            <span
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800/70 border border-slate-700/80 text-slate-400 rounded-xl text-xs font-medium cursor-not-allowed"
              title="Bulk invoice generation is restricted to Administrator"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Bulk Billing (Admin Only)</span>
            </span>
          )}
        </div>
      </div>

      {/* Pending Proofs Action Banner */}
      {pendingProofsCount > 0 && hasPermission('canAccessVerificationQueue') && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900 border border-amber-500/30 text-amber-200 animate-in fade-in shadow-lg shadow-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-100 flex items-center gap-2 flex-wrap">
                <span>{pendingProofsCount} Online Payment {pendingProofsCount === 1 ? 'Proof' : 'Proofs'} Awaiting Review</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">Action Needed</span>
              </h4>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Subscribers uploaded GCash / Maya proof screenshots & reference numbers from the Client Portal.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('verification_queue')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-500/20 hover:scale-105 shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Open Verification Queue ({pendingProofsCount})</span>
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3 text-xs">
        <button
          onClick={() => setActiveBillingTab('invoices')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all ${
            activeBillingTab === 'invoices'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>📄 Statements of Account ({invoices.length})</span>
        </button>

        <button
          onClick={() => setActiveBillingTab('remittances')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all ${
            activeBillingTab === 'remittances'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>💰 Daily Admin Remittance & Drawer</span>
        </button>

        {hasPermission('canAccessVerificationQueue') && (
          <button
            onClick={() => setActiveTab('verification_queue')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all bg-slate-900/60 text-amber-300 border border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50 ml-auto"
            title="Direct link to Cashier Proof Verification Queue"
          >
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
            <span>Online Proofs Queue</span>
            {pendingProofsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 animate-pulse">
                {pendingProofsCount}
              </span>
            )}
          </button>
        )}
      </div>

      {activeBillingTab === 'remittances' ? (
        <DailyRemittanceAudit />
      ) : (
        <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Total Filtered Invoices</p>
            <h4 className="text-xl font-bold text-slate-100 mt-1">{formatCurrency(totalBilled)}</h4>
            <span className="text-[11px] text-slate-500">{filteredInvoices.length} invoices generated</span>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Total Collected</p>
            <h4 className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(totalPaid)}</h4>
            <span className="text-[11px] text-emerald-400/80 font-medium">
              {totalBilled > 0 ? `${((totalPaid / totalBilled) * 100).toFixed(0)}% Collection Rate` : '0%'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Outstanding Balance Due</p>
            <h4 className="text-xl font-bold text-rose-400 mt-1">{formatCurrency(totalOutstanding)}</h4>
            <span className="text-[11px] text-rose-400/80 font-medium">Pending settlement</span>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Invoices' },
              { id: 'unpaid', label: 'Unpaid' },
              { id: 'partially_paid', label: 'Partially Paid' },
              { id: 'paid', label: 'Paid in Full' },
              { id: 'overdue', label: 'Overdue' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === tab.id
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search invoice #, account, name..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <th className={`${density === 'compact' ? 'py-2 px-2.5' : 'py-3.5 px-4'} w-10 text-center`}>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center justify-center p-0.5 rounded cursor-pointer"
                    title={isAllSelected ? 'Deselect all' : 'Select all filtered'}
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-cyan-400" />
                    ) : isSomeSelected ? (
                      <MinusSquare className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500 hover:text-slate-300" />
                    )}
                  </button>
                </th>
                <th className={`${density === 'compact' ? 'py-2 px-3 text-[11px]' : 'py-3.5 px-4'}`}>Invoice No</th>
                <th className={`${density === 'compact' ? 'py-2 px-3 text-[11px]' : 'py-3.5 px-4'}`}>Subscriber</th>
                <th className={`${density === 'compact' ? 'py-2 px-3 text-[11px]' : 'py-3.5 px-4'}`}>Billing Period</th>
                <th className={`${density === 'compact' ? 'py-2 px-3 text-[11px]' : 'py-3.5 px-4'}`}>Due Date</th>
                <th className={`${density === 'compact' ? 'py-2 px-3 text-[11px]' : 'py-3.5 px-4'}`}>Total Amount</th>
                <th className={`${density === 'compact' ? 'py-2 px-3 text-[11px]' : 'py-3.5 px-4'}`}>Balance Due</th>
                <th className={`${density === 'compact' ? 'py-2 px-3 text-[11px]' : 'py-3.5 px-4'}`}>Status</th>
                <th className={`${density === 'compact' ? 'py-2 px-3 text-[11px]' : 'py-3.5 px-4'} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No invoices found. Use "Bulk Generate Invoices" or "Create Manual Invoice" above to generate billing records.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isSelected = selectedInvoiceIds.has(inv.id);
                  const badge = getInvoiceStatusBadge(inv.status);
                  return (
                    <tr
                      key={inv.id}
                      className={`${isSelected ? 'bg-cyan-950/30 border-l-2 border-l-cyan-400' : 'hover:bg-slate-800/40'} transition-colors`}
                    >
                      {/* Checkbox */}
                      <td
                        className={`${density === 'compact' ? 'py-1.5 px-2.5' : 'py-3.5 px-4'} text-center`}
                        onClick={(e) => toggleSelectInvoice(inv.id, e)}
                      >
                        <button
                          type="button"
                          className="text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center justify-center p-0.5 rounded cursor-pointer"
                          title={isSelected ? 'Deselect invoice' : 'Select invoice'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                          )}
                        </button>
                      </td>

                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3.5 px-4'}`}>
                        <button
                          onClick={() => onSelectInvoice(inv.id)}
                          className={`font-mono font-bold text-cyan-400 hover:text-cyan-300 transition-colors ${density === 'compact' ? 'text-xs' : 'text-xs'}`}
                        >
                          {inv.invoiceNumber}
                        </button>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[10px]">
                          {inv.isProrated && (
                            <span className="text-[9px] font-bold text-amber-300 bg-amber-950/60 px-1 py-0.2 rounded border border-amber-800/40">
                              Prorated ({inv.proratedDays}d)
                            </span>
                          )}
                          {inv.appliedCredit && inv.appliedCredit > 0 ? (
                            <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-800/40">
                              Credit: -{formatCurrency(inv.appliedCredit)}
                            </span>
                          ) : null}
                          {inv.sentViaSms && (
                            <span className="text-emerald-400 bg-emerald-950/40 px-1 rounded text-[9px]">SMS Sent</span>
                          )}
                          {inv.sentViaEmail && (
                            <span className="text-cyan-400 bg-cyan-950/40 px-1 rounded text-[9px]">Email Sent</span>
                          )}
                        </div>
                      </td>

                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3.5 px-4'}`}>
                        <button
                          onClick={() => onSelectCustomer(inv.customerId)}
                          className="font-bold text-slate-200 hover:text-cyan-400 transition-colors text-left block truncate max-w-[170px]"
                        >
                          {inv.customerName}
                        </button>
                        <span className={`font-mono ${density === 'compact' ? 'text-[9px]' : 'text-[10px]'} text-slate-400`}>
                          {inv.accountNo}
                        </span>
                      </td>

                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3.5 px-4'} text-slate-300`}>
                        {formatDate(inv.billingPeriodStart)} - {formatDate(inv.billingPeriodEnd)}
                      </td>

                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3.5 px-4'} font-medium text-slate-300`}>
                        {formatDate(inv.dueDate)}
                      </td>

                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3.5 px-4'} font-mono text-slate-200`}>
                        {formatCurrency(inv.totalAmount)}
                      </td>

                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3.5 px-4'} font-mono font-bold`}>
                        {inv.balanceDue > 0 ? (
                          <span className="text-rose-400">{formatCurrency(inv.balanceDue)}</span>
                        ) : (
                          <span className="text-emerald-400">₱0.00</span>
                        )}
                      </td>

                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3.5 px-4'}`}>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.bg} ${badge.textCol} ${badge.border}`}
                        >
                          {badge.text}
                        </span>
                      </td>

                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3.5 px-4'} text-right`}>
                        <div className="flex items-center justify-end gap-1">
                          {inv.balanceDue > 0 && (
                            <button
                              onClick={() => onOpenPaymentModal(inv.customerId, inv.id)}
                              className="px-2 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                              title="Collect Payment"
                            >
                              Collect
                            </button>
                          )}

                          <button
                            onClick={() => {
                              const matchingPayment = payments.find((p) => p.invoiceId === inv.id) || {
                                id: `pay-temp-${inv.id}`,
                                receiptNumber: `OR-${inv.invoiceNumber.replace('INV-', '')}`,
                                customerId: inv.customerId,
                                customerName: inv.customerName,
                                accountNo: inv.accountNo,
                                invoiceId: inv.id,
                                invoiceNumber: inv.invoiceNumber,
                                amount: inv.amountPaid || inv.totalAmount,
                                paymentDate: inv.paidAt || inv.issueDate,
                                paymentMethod: inv.paymentMethodUsed || 'cash',
                                cashierName: businessProfile.representative.firstName + ' ' + businessProfile.representative.lastName,
                                isAdvancePayment: false,
                                createdAt: inv.createdAt,
                              };
                              setSelectedPaymentForThermal({ payment: matchingPayment, invoice: inv });
                            }}
                            className={`${density === 'compact' ? 'p-1' : 'p-1.5'} bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors cursor-pointer`}
                            title="Print Thermal Mini-POS Receipt (58mm/80mm)"
                          >
                            <Receipt className="w-3.5 h-3.5 text-cyan-400" />
                          </button>

                          <button
                            onClick={() => onSelectInvoice(inv.id)}
                            className={`${density === 'compact' ? 'p-1' : 'p-1.5'} bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors cursor-pointer`}
                            title="View Invoice"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              const cust = customers.find((c) => c.id === inv.customerId || c.accountNo === inv.accountNo);
                              const pdf = generateInvoicePDF(inv, businessProfile, cust, plans);
                              pdf.save(`${inv.invoiceNumber}.pdf`);
                            }}
                            className={`${density === 'compact' ? 'p-1' : 'p-1.5'} bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600 hover:text-white rounded-lg transition-colors cursor-pointer`}
                            title="Download Official PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {inv.balanceDue > 0 && (
                            <button
                              onClick={() => sendReminder(inv.customerId, 'overdue_warning', 'sms', inv.id)}
                              className={`${density === 'compact' ? 'p-1' : 'p-1.5'} bg-slate-800 text-amber-400 hover:bg-amber-600 hover:text-white rounded-lg transition-colors cursor-pointer`}
                              title="Send SMS Invoice Reminder"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {hasPermission('canDeleteInvoice') && (
                            <button
                              onClick={() => setInvoiceToDelete(inv)}
                              className={`${density === 'compact' ? 'p-1' : 'p-1.5'} bg-slate-800 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg transition-colors cursor-pointer`}
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Floating Batch Action Toolbar for Invoices */}
      {selectedInvoiceIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-cyan-500/60 rounded-2xl shadow-2xl backdrop-blur-md px-4 sm:px-6 py-2.5 flex items-center gap-3 sm:gap-4 text-xs animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 pr-2 sm:pr-3 border-r border-slate-700/80">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="font-bold text-slate-100 whitespace-nowrap">
              {selectedInvoiceIds.size} <span className="hidden sm:inline">invoices</span> selected
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={exportSelectedInvoicesToCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-semibold transition-all hover:scale-105 cursor-pointer"
              title="Export selected invoices to CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleBatchSendSms}
              disabled={isBatchProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 rounded-xl font-semibold transition-all hover:scale-105 disabled:opacity-50 cursor-pointer"
              title="Send SMS Due / Overdue notices to selected invoices"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send SMS Notices</span>
            </button>

            <button
              type="button"
              onClick={handleBatchPdfDownload}
              disabled={isBatchProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 rounded-xl font-semibold transition-all hover:scale-105 disabled:opacity-50 cursor-pointer"
              title="Download official PDF invoices in batch"
            >
              {isBatchProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">Download PDFs</span>
              <span className="md:hidden">PDFs</span>
            </button>

            <button
              type="button"
              onClick={clearSelection}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors ml-1 cursor-pointer"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      </>
      )}

      {/* ================= MODAL: THERMAL POS MINI-RECEIPT (58mm / 80mm) ================= */}
      {selectedPaymentForThermal && (
        <ThermalReceiptModal
          payment={selectedPaymentForThermal.payment}
          invoice={selectedPaymentForThermal.invoice}
          onClose={() => setSelectedPaymentForThermal(null)}
        />
      )}

      {/* Confirmation Dialog for Invoice Deletion */}
      <ConfirmDeleteModal
        isOpen={!!invoiceToDelete}
        title="Delete Billing Invoice"
        itemName={invoiceToDelete ? `Invoice #${invoiceToDelete.invoiceNumber} — ₱${invoiceToDelete.totalAmount.toLocaleString()} (${invoiceToDelete.customerName}) • ${invoiceToDelete.status.toUpperCase()}` : undefined}
        description={
          invoiceToDelete?.status === 'paid'
            ? '⚠️ CRITICAL FINANCIAL WARNING: This invoice is already marked as PAID. Deleting it will permanently remove the billing record from your ledger, but will NOT automatically refund or reverse the official payment receipt. Proceed with extreme caution.'
            : 'Are you sure you want to permanently delete this invoice? The billing record and outstanding balance will be removed from your accounts ledger and Cloud Firestore.'
        }
        confirmLabel={invoiceToDelete?.status === 'paid' ? 'Confirm Deletion of Paid Invoice' : 'Yes, Delete Invoice'}
        onConfirm={() => {
          if (invoiceToDelete) {
            deleteInvoice(invoiceToDelete.id);
            setInvoiceToDelete(null);
          }
        }}
        onClose={() => setInvoiceToDelete(null)}
      />
    </div>
  );
};

