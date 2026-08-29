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
  onOpenPaymentModal: (customerId: string, invoiceId: string) => void;
  onSelectInvoice: (invoiceId: string) => void;
  onSelectCustomer: (customerId: string) => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({
  onOpenBatchBillingModal,
  onOpenPaymentModal,
  onSelectInvoice,
  onSelectCustomer,
}) => {
  const {
    invoices,
    payments,
    customers,
    businessProfile,
    deleteInvoice,
    sendReminder,
    runDailyGraceAudit,
    searchTerm,
    setSearchTerm,
  } = useApp();

  const [activeBillingTab, setActiveBillingTab] = useState<'invoices' | 'remittances' | 'grace_audit'>('invoices');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  const exportInvoicesToCSV = () => {
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

    const rows = filteredInvoices.map((inv) => [
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
    link.setAttribute('download', `swiftstream_invoices_${new Date().toISOString().slice(0, 10)}.csv`);
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
            <FileText className="w-5 h-5 text-cyan-400" />
            <span>Billing, Invoices & Admin POS Hub</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Statement of accounts, advance credit wallet proration, POS thermal receipts, and daily collection remittance audits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => runDailyGraceAudit()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all hover:scale-105"
            title="Evaluate 5-day grace period, auto-isolate overdue accounts, and unsuspend paid accounts"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Run Daily Grace Audit</span>
          </button>

          <button
            onClick={exportInvoicesToCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenBatchBillingModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105"
          >
            <Zap className="w-4 h-4" />
            <span>1-Click Monthly Billing Run</span>
          </button>
        </div>
      </div>

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
                <th className="py-3.5 px-4">Invoice No</th>
                <th className="py-3.5 px-4">Subscriber</th>
                <th className="py-3.5 px-4">Billing Period</th>
                <th className="py-3.5 px-4">Due Date</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">Balance Due</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No invoices found. Click "1-Click Monthly Billing Run" to generate invoices.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const badge = getInvoiceStatusBadge(inv.status);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => onSelectInvoice(inv.id)}
                          className="font-mono font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          {inv.invoiceNumber}
                        </button>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[10px]">
                          {inv.isProrated && (
                            <span className="text-[9px] font-bold text-amber-300 bg-amber-950/60 px-1 py-0.5 rounded border border-amber-800/40">
                              Prorated ({inv.proratedDays}d)
                            </span>
                          )}
                          {inv.appliedCredit && inv.appliedCredit > 0 ? (
                            <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950/60 px-1 py-0.5 rounded border border-emerald-800/40">
                              Credit: -{formatCurrency(inv.appliedCredit)}
                            </span>
                          ) : null}
                          {inv.sentViaSms && (
                            <span className="text-emerald-400 bg-emerald-950/40 px-1 rounded">SMS Sent</span>
                          )}
                          {inv.sentViaEmail && (
                            <span className="text-cyan-400 bg-cyan-950/40 px-1 rounded">Email Sent</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => onSelectCustomer(inv.customerId)}
                          className="font-bold text-slate-200 hover:text-cyan-400 transition-colors text-left block truncate max-w-[170px]"
                        >
                          {inv.customerName}
                        </button>
                        <span className="font-mono text-[10px] text-slate-400">{inv.accountNo}</span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        {formatDate(inv.billingPeriodStart)} - {formatDate(inv.billingPeriodEnd)}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-300">{formatDate(inv.dueDate)}</td>

                      <td className="py-3.5 px-4 font-mono text-slate-200">{formatCurrency(inv.totalAmount)}</td>

                      <td className="py-3.5 px-4 font-mono font-bold">
                        {inv.balanceDue > 0 ? (
                          <span className="text-rose-400">{formatCurrency(inv.balanceDue)}</span>
                        ) : (
                          <span className="text-emerald-400">₱0.00</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-semibold border ${badge.bg} ${badge.textCol} ${badge.border}`}
                        >
                          {badge.text}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.balanceDue > 0 && (
                            <button
                              onClick={() => onOpenPaymentModal(inv.customerId, inv.id)}
                              className="px-2 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg text-[11px] font-semibold transition-colors"
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
                            className="p-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
                            title="Print Thermal Mini-POS Receipt (58mm/80mm)"
                          >
                            <Receipt className="w-3.5 h-3.5 text-cyan-400" />
                          </button>

                          <button
                            onClick={() => onSelectInvoice(inv.id)}
                            className="p-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
                            title="View Invoice"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              const pdf = generateInvoicePDF(inv, businessProfile);
                              pdf.save(`${inv.invoiceNumber}.pdf`);
                            }}
                            className="p-1.5 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600 hover:text-white rounded-lg transition-colors"
                            title="Download Official PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {inv.balanceDue > 0 && (
                            <button
                              onClick={() => sendReminder(inv.customerId, 'overdue_warning', 'sms', inv.id)}
                              className="p-1.5 bg-slate-800 text-amber-400 hover:bg-amber-600 hover:text-white rounded-lg transition-colors"
                              title="Send SMS Invoice Reminder"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => setInvoiceToDelete(inv)}
                            className="p-1.5 bg-slate-800 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
        itemName={invoiceToDelete ? `Invoice #${invoiceToDelete.invoiceNumber} — ₱${invoiceToDelete.totalAmount.toLocaleString()} (${invoiceToDelete.customerName})` : undefined}
        description="Are you sure you want to permanently delete this invoice? The billing record and outstanding balance will be removed from your accounts ledger and Cloud Firestore."
        confirmLabel="Yes, Delete Invoice"
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

