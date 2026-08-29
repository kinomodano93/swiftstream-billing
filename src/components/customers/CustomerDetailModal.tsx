import React, { useState } from 'react';
import {
  X,
  User,
  MapPin,
  Wifi,
  FileText,
  CreditCard,
  Wrench,
  Send,
  Printer,
  Edit2,
  Calendar,
  Radio,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPhoneNumber,
  getCustomerStatusBadge,
  getInvoiceStatusBadge,
  getPaymentMethodLabel,
  getRepairStatusBadge,
} from '../../utils/formatters';
import { generateInvoicePDF, generateOfficialReceiptPDF } from '../../utils/pdfGenerator';

interface CustomerDetailModalProps {
  customerId: string;
  onClose: () => void;
  onOpenPaymentModal: (customerId: string, invoiceId?: string) => void;
  onOpenEditModal: () => void;
  onSelectInvoice: (invoiceId: string) => void;
}

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customerId,
  onClose,
  onOpenPaymentModal,
  onOpenEditModal,
  onSelectInvoice,
}) => {
  const {
    customers,
    invoices,
    payments,
    repairOrders,
    napBoxes,
    businessProfile,
    toggleCustomerStatus,
    syncCustomerMikrotik,
    sendReminder,
    addCustomerWalletCredit,
    setActiveTab: setGlobalActiveTab,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'profile' | 'invoices' | 'payments' | 'repairs'>('profile');
  const [showCreditInput, setShowCreditInput] = useState<boolean>(false);
  const [creditAmountInput, setCreditAmountInput] = useState<string>('');

  const customer = customers.find((c) => c.id === customerId);
  if (!customer) return null;

  const handleAddCredit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(creditAmountInput);
    if (amount > 0) {
      addCustomerWalletCredit(customer.id, amount, 'Advance credit top-up');
      setShowCreditInput(false);
      setCreditAmountInput('');
    }
  };

  const customerInvoices = invoices.filter((inv) => inv.customerId === customer.id);
  const customerPayments = payments.filter((p) => p.customerId === customer.id);
  const customerRepairs = repairOrders.filter((r) => r.customerId === customer.id);
  const assignedNap = napBoxes.find((n) => n.id === customer.network.napBoxId);

  const statusBadge = getCustomerStatusBadge(customer.status);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Top Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-cyan-500/20">
              {customer.fullName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-slate-100">{customer.fullName}</h3>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadge.bg} ${statusBadge.textCol} ${statusBadge.border}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                  {statusBadge.text}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span className="font-mono text-cyan-400 font-semibold bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/40">
                  {customer.accountNo}
                </span>
                <span>•</span>
                <span>{customer.planName} (₱{customer.monthlyFee.toLocaleString()}/mo)</span>
                <span>•</span>
                <span>Day {customer.billingDay} Cycle</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenEditModal}
              className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-xl transition-colors"
              title="Edit Profile"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Bar */}
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenPaymentModal(customer.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold shadow-sm transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Collect Payment</span>
            </button>

            <button
              onClick={() => sendReminder(customer.id, 'overdue_warning', 'sms')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600 hover:text-white rounded-lg font-semibold transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send SMS Advisory</span>
            </button>

            <button
              onClick={() => syncCustomerMikrotik(customer.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white rounded-lg font-semibold transition-colors"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Sync Mikrotik</span>
            </button>

            <button
              onClick={() => setShowCreditInput((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600 hover:text-white rounded-lg font-semibold transition-colors"
              title="Add Advance Credit Wallet Balance"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>+ Add Credit</span>
            </button>

            <button
              onClick={() => {
                onClose();
                setGlobalActiveTab('portal');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950 text-cyan-300 hover:bg-cyan-900 border border-cyan-800/60 rounded-lg font-semibold transition-colors"
              title="Open Subscriber Self-Service Portal"
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Client Portal</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">Credit Wallet:</span>
              <span className="font-mono font-bold text-emerald-400">
                {formatCurrency(customer.walletBalance || 0)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs border-l border-slate-800 pl-3">
              <span className="text-slate-400">Balance Due:</span>
              <span
                className={`font-mono text-base font-bold ${
                  customer.balance > 0 ? 'text-rose-400' : customer.balance < 0 ? 'text-emerald-400' : 'text-slate-300'
                }`}
              >
                {formatCurrency(customer.balance)}
              </span>
            </div>
          </div>
        </div>

        {/* Inline Credit Top-Up Input Banner */}
        {showCreditInput && (
          <form onSubmit={handleAddCredit} className="px-6 py-2.5 bg-cyan-950/40 border-b border-cyan-800/40 flex items-center justify-between gap-3 text-xs animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-cyan-300">Deposit Advance Credit:</span>
              <input
                type="number"
                step="any"
                autoFocus
                value={creditAmountInput}
                onChange={(e) => setCreditAmountInput(e.target.value)}
                placeholder="Amount (e.g. 1500)"
                className="w-36 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-colors"
              >
                Deposit Credit
              </button>
              <button
                type="button"
                onClick={() => setShowCreditInput(false)}
                className="px-2 py-1 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/40 text-xs">
          {[
            { id: 'profile', label: 'Technical & Network Specs', icon: Wifi, count: null },
            { id: 'invoices', label: 'Invoices & SOA', icon: FileText, count: customerInvoices.length },
            { id: 'payments', label: 'Payment Receipts', icon: CreditCard, count: customerPayments.length },
            { id: 'repairs', label: 'Service & Repair Tickets', icon: Wrench, count: customerRepairs.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium transition-all ${
                  isActive
                    ? 'border-cyan-500 text-cyan-300 bg-cyan-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: PROFILE & NETWORK */}
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact & Address */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
                  <MapPin className="w-4 h-4 text-rose-400" />
                  <h4 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                    Installation & Contact Information
                  </h4>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">Mobile Number:</span>
                    <span className="text-slate-200 font-mono font-medium">{formatPhoneNumber(customer.mobile)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">Email Address:</span>
                    <span className="text-slate-200">{customer.email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">Barangay & Street:</span>
                    <span className="text-slate-200 text-right">{customer.address.street}, {customer.address.barangay}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">Municipality / Province:</span>
                    <span className="text-slate-200 text-right">{customer.address.city}, {customer.address.province}</span>
                  </div>
                  {customer.address.landmark && (
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-500">Landmark:</span>
                      <span className="text-amber-300 text-right font-medium">{customer.address.landmark}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Installed Date:</span>
                    <span className="text-slate-300 font-mono">{formatDate(customer.installationDate)}</span>
                  </div>
                </div>
              </div>

              {/* Network Configuration */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                      Network Provisioning & Hardware
                    </h4>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${customer.network.isMikrotikSynced ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                    {customer.network.isMikrotikSynced ? 'Mikrotik Active' : 'Unsynced'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">PPPoE Username:</span>
                    <span className="text-cyan-400 font-mono font-semibold">{customer.network.pppoeUsername}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">Assigned IP Address:</span>
                    <span className="text-slate-200 font-mono">{customer.network.ipAddress}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">Fiber NAP Box:</span>
                    <span className="text-slate-200 font-semibold">{assignedNap?.name || customer.network.napBoxId}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">NAP Port Assigned:</span>
                    <span className="text-cyan-400 font-mono font-bold">Port #{customer.network.napPortNumber}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">Optical Power Rx:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {customer.network.opticalPowerDbm || customer.installationDetails?.opticalPowerDbm || -18.5} dBm (Optimal)
                    </span>
                  </div>
                  {customer.installationDetails?.dropCableMeters && (
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-500">Drop Cable Length:</span>
                      <span className="font-mono text-slate-300">{customer.installationDetails.dropCableMeters} meters (Installed)</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">OLT PON Port / VLAN:</span>
                    <span className="text-slate-300 font-mono">{customer.network.oltPonPort || 'PON-1/1'} (VLAN {customer.network.vlanId || '100'})</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">ONU / Router Device:</span>
                    <span className="text-slate-300 text-right">{customer.network.routerModel || 'Gigabit Fiber ONU'} ({customer.network.onuSerial || 'N/A'})</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INVOICES & SOA */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Statement of Account history for {customer.fullName}</span>
              </div>

              {customerInvoices.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No invoices generated yet for this subscriber.
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                        <th className="py-3 px-4">Invoice #</th>
                        <th className="py-3 px-4">Billing Period</th>
                        <th className="py-3 px-4">Due Date</th>
                        <th className="py-3 px-4">Total Amount</th>
                        <th className="py-3 px-4">Balance Due</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {customerInvoices.map((inv) => {
                        const invBadge = getInvoiceStatusBadge(inv.status);
                        return (
                          <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-3 px-4 text-slate-300">
                              {formatDate(inv.billingPeriodStart)} - {formatDate(inv.billingPeriodEnd)}
                            </td>
                            <td className="py-3 px-4 text-slate-400">{formatDate(inv.dueDate)}</td>
                            <td className="py-3 px-4 font-mono text-slate-200">{formatCurrency(inv.totalAmount)}</td>
                            <td className="py-3 px-4 font-mono font-bold text-rose-400">
                              {formatCurrency(inv.balanceDue)}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${invBadge.bg} ${invBadge.textCol} ${invBadge.border}`}>
                                {invBadge.text}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5">
                              <button
                                onClick={() => onSelectInvoice(inv.id)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] transition-colors"
                              >
                                View
                              </button>
                              <button
                                onClick={() => {
                                  const pdf = generateInvoicePDF(inv, businessProfile);
                                  pdf.save(`${inv.invoiceNumber}_${customer.accountNo}.pdf`);
                                }}
                                className="px-2 py-1 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600 hover:text-white rounded-lg text-[11px] transition-colors"
                                title="Download PDF"
                              >
                                PDF
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PAYMENTS */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              {customerPayments.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No payment transactions logged for this subscriber yet.
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                        <th className="py-3 px-4">OR #</th>
                        <th className="py-3 px-4">Date & Time</th>
                        <th className="py-3 px-4">Channel / Method</th>
                        <th className="py-3 px-4">Reference No</th>
                        <th className="py-3 px-4">Amount Paid</th>
                        <th className="py-3 px-4">Admin / Collector</th>
                        <th className="py-3 px-4 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {customerPayments.map((pay) => {
                        const payMethod = getPaymentMethodLabel(pay.paymentMethod);
                        return (
                          <tr key={pay.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                              {pay.receiptNumber}
                            </td>
                            <td className="py-3 px-4 text-slate-300">{formatDateTime(pay.paymentDate)}</td>
                            <td className="py-3 px-4 text-slate-300">
                              <span className="flex items-center gap-1">
                                <span>{payMethod.icon}</span>
                                <span>{payMethod.label}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                              {pay.referenceNumber || 'N/A'}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                              {formatCurrency(pay.amount)}
                            </td>
                            <td className="py-3 px-4 text-slate-400">{pay.cashierName}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => {
                                  const pdf = generateOfficialReceiptPDF(pay, businessProfile);
                                  pdf.save(`${pay.receiptNumber}.pdf`);
                                }}
                                className="px-2.5 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg text-[11px] font-semibold transition-colors"
                              >
                                Thermal PDF
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: REPAIRS */}
          {activeTab === 'repairs' && (
            <div className="space-y-4">
              {customerRepairs.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No repair or field maintenance tickets recorded for this subscriber.
                </div>
              ) : (
                <div className="space-y-3">
                  {customerRepairs.map((rep) => {
                    const badge = getRepairStatusBadge(rep.status);
                    return (
                      <div
                        key={rep.id}
                        className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-cyan-400">{rep.orderNumber}</span>
                            <span className="text-slate-300 font-semibold">• {rep.deviceType}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${badge.bg} ${badge.textCol}`}>
                            {badge.text}
                          </span>
                        </div>
                        <p className="text-slate-400">{rep.issueDescription}</p>
                        {rep.diagnosisNotes && (
                          <p className="text-slate-500 text-[11px]">Tech Notes: {rep.diagnosisNotes}</p>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-slate-400">
                          <span>Technician: {rep.technician}</span>
                          <span className="font-mono font-bold text-emerald-400">
                            Total: {formatCurrency(rep.totalCost)} ({rep.isPaid ? 'PAID' : 'UNPAID'})
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

