import React from 'react';
import {
  TrendingUp,
  CreditCard,
  AlertCircle,
  Users,
  Wrench,
  Network,
  Send,
  Zap,
  CheckCircle2,
  PhoneCall,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StatCard } from './StatCard';
import { RevenueChart } from './RevenueChart';
import { PlanDistributionChart } from './PlanDistributionChart';
import { formatCurrency, formatDate, getCustomerStatusBadge } from '../../utils/formatters';

interface DashboardProps {
  onOpenPaymentModal: (customerId?: string, invoiceId?: string) => void;
  onOpenCustomerModal: () => void;
  onOpenBatchBillingModal: () => void;
  onOpenRepairModal: () => void;
  onSelectCustomer: (customerId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenPaymentModal,
  onOpenCustomerModal,
  onOpenBatchBillingModal,
  onOpenRepairModal,
  onSelectCustomer,
}) => {
  const {
    customers,
    invoices,
    payments,
    napBoxes,
    repairOrders,
    setActiveTab,
    sendReminder,
    toggleCustomerStatus,
  } = useApp();

  // Metrics Calculations
  const activeSubscribers = customers.filter((c) => c.status === 'active');
  const mrr = activeSubscribers.reduce((sum, c) => sum + c.monthlyFee, 0);

  const totalCollectedThisMonth = payments.reduce((sum, p) => sum + p.amount, 0);

  const unpaidInvoices = invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue' || i.status === 'partially_paid');
  const totalReceivables = unpaidInvoices.reduce((sum, i) => sum + i.balanceDue, 0);

  const overdueCustomers = customers.filter((c) => c.status === 'overdue' || c.status === 'suspended' || c.balance > 0);

  // Fiber Port utilization
  let totalPorts = 0;
  let occupiedPorts = 0;
  napBoxes.forEach((box) => {
    totalPorts += box.totalPorts;
    occupiedPorts += box.ports.filter((p) => p.status === 'occupied').length;
  });
  const portUtilization = totalPorts > 0 ? ((occupiedPorts / totalPorts) * 100).toFixed(0) : '0';

  const pendingRepairs = repairOrders.filter((r) => r.status !== 'completed' && r.status !== 'cancelled');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Quick Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-lg font-bold text-slate-100">Operations Control Center</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            SwiftStream Telecommunication & Repair Shop • Lagonoy, Camarines Sur Node
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onOpenPaymentModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all hover:scale-105"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>

          <button
            onClick={onOpenBatchBillingModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-cyan-600/20 transition-all hover:scale-105"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Generate Invoices</span>
          </button>

          <button
            onClick={onOpenRepairModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all hover:border-slate-600"
          >
            <Wrench className="w-3.5 h-3.5 text-cyan-400" />
            <span>Log Repair</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Monthly Recurring (MRR)"
          value={formatCurrency(mrr)}
          subtitle={`${activeSubscribers.length} Active Paying Lines`}
          icon={TrendingUp}
          trend="+14.2% MoM"
          trendPositive={true}
          colorScheme="cyan"
          onClick={() => setActiveTab('plans')}
        />

        <StatCard
          title="Collected This Month"
          value={formatCurrency(totalCollectedThisMonth)}
          subtitle={`${payments.length} Transactions Recorded`}
          icon={CreditCard}
          trend="88.5% On-Time"
          trendPositive={true}
          colorScheme="emerald"
          onClick={() => setActiveTab('payments')}
        />

        <StatCard
          title="Unpaid Receivables"
          value={formatCurrency(totalReceivables)}
          subtitle={`${unpaidInvoices.length} Invoices Pending Payment`}
          icon={AlertCircle}
          trend={overdueCustomers.length > 0 ? `${overdueCustomers.length} Overdue` : 'Clean'}
          trendPositive={overdueCustomers.length === 0}
          colorScheme="rose"
          onClick={() => setActiveTab('billing')}
        />

        <StatCard
          title="Fiber Port Capacity"
          value={`${portUtilization}% Used`}
          subtitle={`${occupiedPorts} of ${totalPorts} NAP Ports Connected`}
          icon={Network}
          trend={`${totalPorts - occupiedPorts} Ports Free`}
          trendPositive={true}
          colorScheme="purple"
          onClick={() => setActiveTab('network')}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div className="lg:col-span-1">
          <PlanDistributionChart />
        </div>
      </div>

      {/* Two Column Section: Overdue Attention List & Urgent Repairs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overdue Accounts Table (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-sm text-slate-100">Overdue & At-Risk Accounts</h3>
            </div>
            <button
              onClick={() => setActiveTab('customers')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              <span>View CRM</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {overdueCustomers.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              All subscribers are currently up to date on payments!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium">
                    <th className="pb-3">Subscriber</th>
                    <th className="pb-3">Plan</th>
                    <th className="pb-3">Balance</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {overdueCustomers.slice(0, 5).map((cust) => {
                    const statusBadge = getCustomerStatusBadge(cust.status);
                    return (
                      <tr key={cust.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3">
                          <button
                            onClick={() => onSelectCustomer(cust.id)}
                            className="text-left font-semibold text-slate-200 hover:text-cyan-400 transition-colors block truncate max-w-[170px]"
                          >
                            {cust.fullName}
                          </button>
                          <span className="text-[10px] text-slate-500 font-mono">{cust.accountNo}</span>
                        </td>
                        <td className="py-3 text-slate-300 truncate max-w-[130px]">{cust.planName}</td>
                        <td className="py-3 font-mono font-bold text-rose-400">
                          {formatCurrency(cust.balance)}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge.bg} ${statusBadge.textCol} ${statusBadge.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                            {statusBadge.text}
                          </span>
                        </td>
                        <td className="py-3 text-right space-x-1.5">
                          <button
                            onClick={() => onOpenPaymentModal(cust.id)}
                            className="px-2 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg text-[11px] font-semibold transition-colors"
                            title="Collect Payment"
                          >
                            Pay
                          </button>
                          <button
                            onClick={() => sendReminder(cust.id, 'overdue_warning', 'sms')}
                            className="px-2 py-1 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600 hover:text-white rounded-lg text-[11px] font-semibold transition-colors"
                            title="Send SMS Reminder"
                          >
                            SMS
                          </button>
                          <button
                            onClick={() =>
                              toggleCustomerStatus(
                                cust.id,
                                cust.status === 'suspended' ? 'active' : 'suspended'
                              )
                            }
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              cust.status === 'suspended'
                                ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white'
                                : 'bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white'
                            }`}
                            title={cust.status === 'suspended' ? 'Reactivate Line' : 'Cut Line'}
                          >
                            {cust.status === 'suspended' ? 'Unsuspend' : 'Cut'}
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

        {/* Repair & Service Desk Widget (1 col) */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-sm text-slate-100">Shop Repairs & Field Jobs</h3>
              </div>
              <button
                onClick={() => setActiveTab('repairs')}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                All Tickets
              </button>
            </div>

            <div className="space-y-3">
              {pendingRepairs.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No active repair job orders at this time.
                </div>
              ) : (
                pendingRepairs.slice(0, 3).map((job) => (
                  <div
                    key={job.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 truncate max-w-[150px]">
                        {job.customerName}
                      </span>
                      <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                        {job.orderNumber}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{job.issueDescription}</p>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                      <span className="text-slate-500">Tech: {job.technician}</span>
                      <span className="font-mono font-semibold text-emerald-400">
                        {formatCurrency(job.totalCost)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800">
            <button
              onClick={onOpenRepairModal}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Wrench className="w-3.5 h-3.5 text-cyan-400" />
              <span>Create New Service Ticket</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

