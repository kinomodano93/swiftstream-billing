import React, { useState } from 'react';
import { X, Zap, Calendar, Users, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';

interface BatchBillingModalProps {
  onClose: () => void;
}

export const BatchBillingModal: React.FC<BatchBillingModalProps> = ({ onClose }) => {
  const { customers, invoices, generateBatchInvoices } = useApp();

  const currentYear = new Date().getFullYear();
  const nextMonthNum = new Date().getMonth() + 2; // e.g. 9 for Sept
  const defaultMonth = `${currentYear}-${String(nextMonthNum > 12 ? 1 : nextMonthNum).padStart(2, '0')}`;
  const defaultDueDate = `${currentYear}-${String(nextMonthNum > 12 ? 1 : nextMonthNum).padStart(2, '0')}-10`;

  const [billingMonth, setBillingMonth] = useState<string>(defaultMonth);
  const [dueDate, setDueDate] = useState<string>(defaultDueDate);
  const [cycleDayFilter, setCycleDayFilter] = useState<string>('all');
  const [isDone, setIsDone] = useState<boolean>(false);
  const [resultCount, setResultCount] = useState<number>(0);
  const [resultAmount, setResultAmount] = useState<number>(0);

  // Filter subscribers who are eligible
  const eligibleSubscribers = customers.filter((c) => {
    if (c.status !== 'active' && c.status !== 'overdue') return false;
    if (cycleDayFilter !== 'all' && c.billingDay !== Number(cycleDayFilter)) return false;

    // Check if already invoiced for this month
    const hasInvoice = invoices.some(
      (inv) => inv.customerId === c.id && inv.billingPeriodStart.startsWith(billingMonth)
    );
    return !hasInvoice;
  });

  const previewTotalAmount = eligibleSubscribers.reduce(
    (sum, c) => sum + c.monthlyFee + (c.balance > 0 ? c.balance : 0),
    0
  );

  const handleRunBatch = () => {
    const res = generateBatchInvoices({
      billingMonth,
      dueDate,
      billingCycleDay: cycleDayFilter === 'all' ? undefined : Number(cycleDayFilter),
    });

    setResultCount(res.count);
    setResultAmount(res.totalAmount);
    setIsDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                1-Click Automated Monthly Billing Run
              </h3>
              <p className="text-xs text-slate-400">
                Batch generate Statement of Accounts for all active subscribers.
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

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {!isDone ? (
            <>
              {/* Parameter Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Billing Period Month</label>
                  <input
                    type="month"
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Payment Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Billing Cycle Cut-off</label>
                  <select
                    value={cycleDayFilter}
                    onChange={(e) => setCycleDayFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="all">All Active Subscribers</option>
                    <option value="1">Day 1 Cut-off Only</option>
                    <option value="5">Day 5 Cut-off Only</option>
                    <option value="10">Day 10 Cut-off Only</option>
                    <option value="15">Day 15 Cut-off Only</option>
                    <option value="20">Day 20 Cut-off Only</option>
                  </select>
                </div>
              </div>

              {/* Generation Summary Box */}
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h4 className="font-bold text-slate-200">
                      {eligibleSubscribers.length} Subscribers to be Billed
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Auto-calculates monthly rate + previous unpaid balance arrears.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">Total Expected Billed Amount:</span>
                  <span className="font-mono text-base font-bold text-cyan-300">
                    {formatCurrency(previewTotalAmount)}
                  </span>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 font-semibold text-slate-400 text-[11px] uppercase">
                  Batch Invoicing Preview
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <tbody className="divide-y divide-slate-800/60">
                      {eligibleSubscribers.length === 0 ? (
                        <tr>
                          <td className="py-6 text-center text-slate-500" colSpan={4}>
                            No pending subscribers need invoicing for this billing period.
                          </td>
                        </tr>
                      ) : (
                        eligibleSubscribers.map((cust) => (
                          <tr key={cust.id} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-4 font-medium text-slate-200">{cust.fullName}</td>
                            <td className="py-2.5 px-4 font-mono text-slate-400">{cust.accountNo}</td>
                            <td className="py-2.5 px-4 text-slate-400 truncate max-w-[140px]">{cust.planName}</td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-200">
                              {formatCurrency(cust.monthlyFee + (cust.balance > 0 ? cust.balance : 0))}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 space-y-3 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-100">Batch Invoices Successfully Generated!</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Created <strong className="text-emerald-400">{resultCount} invoices</strong> for the billing cycle totaling <strong className="text-emerald-400">{formatCurrency(resultAmount)}</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
          {!isDone ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={eligibleSubscribers.length === 0}
                onClick={handleRunBatch}
                className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105"
              >
                <Zap className="w-4 h-4" />
                <span>Execute Batch Invoicing</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold transition-colors"
            >
              Done / Return to Invoices
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

