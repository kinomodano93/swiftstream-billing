import React, { useState, useMemo } from 'react';
import { Zap, X, CheckCircle2, Users, AlertTriangle, Calendar } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';

interface BatchBillingModalProps {
  onClose: () => void;
}

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const YEARS = ['2024', '2025', '2026', '2027', '2028', '2029', '2030'];

export const BatchBillingModal: React.FC<BatchBillingModalProps> = ({ onClose }) => {
  const { customers, invoices, generateBatchInvoices, showToast } = useApp();

  const now = new Date();
  const currentMonthNum = String(now.getMonth() + 1).padStart(2, '0');
  const currentYearStr = String(now.getFullYear());

  const [billingType, setBillingType] = useState<string>('all');
  const [billingMonth, setBillingMonth] = useState<string>(currentMonthNum);
  const [billingYear, setBillingYear] = useState<string>(currentYearStr);
  const [dueDateMode, setDueDateMode] = useState<string>('auto');
  const [customDueDate, setCustomDueDate] = useState<string>('');

  const [applyWalletCredits, setApplyWalletCredits] = useState<boolean>(true);
  const [enableProration, setEnableProration] = useState<boolean>(true);
  const [isDone, setIsDone] = useState<boolean>(false);
  const [resultCount, setResultCount] = useState<number>(0);
  const [resultAmount, setResultAmount] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const billingPeriodMonthStr = `${billingYear}-${billingMonth}`;

  // Days in month calculation
  const daysInSelectedMonth = useMemo(() => {
    const y = parseInt(billingYear, 10) || now.getFullYear();
    const m = parseInt(billingMonth, 10) || (now.getMonth() + 1);
    return new Date(y, m, 0).getDate();
  }, [billingYear, billingMonth, now]);

  // Compute calculated due date based on selected mode
  const effectiveDueDate = useMemo(() => {
    if (dueDateMode === 'custom' && customDueDate) {
      return customDueDate;
    }
    if (dueDateMode === 'end_of_month') {
      return `${billingYear}-${billingMonth}-${String(daysInSelectedMonth).padStart(2, '0')}`;
    }
    if (dueDateMode === 'grace') {
      const d = new Date();
      d.setDate(d.getDate() + 5);
      return d.toISOString().slice(0, 10);
    }
    // Default 'auto': 10th of the billing month
    return `${billingYear}-${billingMonth}-10`;
  }, [dueDateMode, customDueDate, billingYear, billingMonth, daysInSelectedMonth]);

  // Filter eligible subscribers based on Billing Type
  const eligibleSubscribers = useMemo(() => {
    return customers.filter((c) => {
      // Category / Status filter
      if (billingType === 'active' && c.status !== 'active') return false;
      if (billingType === 'overdue' && c.status !== 'overdue') return false;
      if (billingType === 'pending_install' && c.status !== 'pending_install') return false;
      if (billingType === 'residential' && c.planName.toLowerCase().includes('biz') && !c.planName.toLowerCase().includes('home')) return false;
      if (billingType === 'business' && !c.planName.toLowerCase().includes('biz') && !c.planName.toLowerCase().includes('commercial') && !c.planName.toLowerCase().includes('peak')) return false;
      if (billingType === 'piso_wifi' && !c.planName.toLowerCase().includes('wifi') && !c.planName.toLowerCase().includes('vendo')) return false;

      // Check if already invoiced for this month
      const hasInvoice = invoices.some(
        (inv) =>
          inv.customerId === c.id &&
          (inv.billingPeriodStart?.startsWith(billingPeriodMonthStr) || inv.issueDate?.startsWith(billingPeriodMonthStr))
      );
      return !hasInvoice;
    });
  }, [customers, invoices, billingType, billingPeriodMonthStr]);

  const previewTotalAmount = useMemo(() => {
    return eligibleSubscribers.reduce(
      (sum, c) => sum + (c.monthlyFee || 0) + (c.balance > 0 ? c.balance : 0),
      0
    );
  }, [eligibleSubscribers]);

  const handleRunBatch = () => {
    if (eligibleSubscribers.length === 0) {
      showToast('warning', 'No Subscribers to Bill', 'All selected subscribers already have invoices for this period.');
      return;
    }

    setIsGenerating(true);
    try {
      const res = generateBatchInvoices({
        billingMonth: billingPeriodMonthStr,
        dueDate: effectiveDueDate,
        applyWalletCredits,
        enableProration,
      });

      setResultCount(res.count);
      setResultAmount(res.totalAmount);
      setIsDone(true);
      showToast('success', 'Batch Invoicing Complete', `Generated ${res.count} invoices totaling ${formatCurrency(res.totalAmount)}.`);
    } catch (err: any) {
      showToast('error', 'Batch Billing Failed', err?.message || 'Error occurred during generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
        {/* Modal Top Close */}
        <div className="flex justify-end p-3 pb-0">
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 pt-0 overflow-y-auto space-y-5 text-xs">
          {!isDone ? (
            <>
              {/* Header Icon & Title (Exact matching Image 1) */}
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
                  <Zap className="w-7 h-7 fill-amber-400/20" />
                </div>
                <h3 className="font-bold text-lg text-white">
                  Bulk Generate Invoice
                </h3>
                <p className="text-xs text-slate-400 font-normal">
                  Select customer category to generate invoices.
                </p>
              </div>

              {/* 1. Select Billing Type Fieldset */}
              <fieldset className="border border-slate-700/90 rounded-xl px-3 pb-2 pt-0.5 bg-slate-950/60 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30 transition-all">
                <legend className="px-1.5 text-[11px] font-medium text-slate-400">
                  Select Billing Type
                </legend>
                <select
                  value={billingType}
                  onChange={(e) => setBillingType(e.target.value)}
                  className="w-full bg-transparent text-slate-100 text-xs py-1 focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-slate-100">Generate All Customers</option>
                  <option value="active" className="bg-slate-900 text-slate-100">Active Subscribers Only</option>
                  <option value="overdue" className="bg-slate-900 text-slate-100">Overdue (Grace Period) Accounts Only</option>
                  <option value="pending_install" className="bg-slate-900 text-slate-100">Pending Install Customers Only</option>
                  <option value="residential" className="bg-slate-900 text-slate-100">Residential Packages Only</option>
                  <option value="business" className="bg-slate-900 text-slate-100">Commercial / Business Only</option>
                  <option value="piso_wifi" className="bg-slate-900 text-slate-100">Piso-WiFi Feeder Accounts Only</option>
                </select>
              </fieldset>

              {/* 2. Billing Month & Billing Year Side-by-Side */}
              <div className="grid grid-cols-2 gap-3">
                <fieldset className="border border-slate-700/90 rounded-xl px-3 pb-2 pt-0.5 bg-slate-950/60 focus-within:border-blue-500 transition-all">
                  <legend className="px-1.5 text-[11px] font-medium text-slate-400">
                    Billing Month
                  </legend>
                  <select
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(e.target.value)}
                    className="w-full bg-transparent text-slate-100 text-xs py-1 focus:outline-none cursor-pointer"
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value} className="bg-slate-900 text-slate-100">
                        {m.label}
                      </option>
                    ))}
                  </select>
                </fieldset>

                <fieldset className="border border-slate-700/90 rounded-xl px-3 pb-2 pt-0.5 bg-slate-950/60 focus-within:border-blue-500 transition-all">
                  <legend className="px-1.5 text-[11px] font-medium text-slate-400">
                    Billing Year
                  </legend>
                  <select
                    value={billingYear}
                    onChange={(e) => setBillingYear(e.target.value)}
                    className="w-full bg-transparent text-slate-100 text-xs py-1 focus:outline-none cursor-pointer"
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y} className="bg-slate-900 text-slate-100">
                        {y}
                      </option>
                    ))}
                  </select>
                </fieldset>
              </div>

              {/* 3. Due Date Mode Fieldset */}
              <fieldset className="border border-slate-700/90 rounded-xl px-3 pb-2 pt-0.5 bg-slate-950/60 focus-within:border-blue-500 transition-all">
                <legend className="px-1.5 text-[11px] font-medium text-slate-400">
                  Due Date Mode
                </legend>
                <select
                  value={dueDateMode}
                  onChange={(e) => setDueDateMode(e.target.value)}
                  className="w-full bg-transparent text-slate-100 text-xs py-1 focus:outline-none cursor-pointer"
                >
                  <option value="auto" className="bg-slate-900 text-slate-100">
                    Automatic (Due date this month)
                  </option>
                  <option value="grace" className="bg-slate-900 text-slate-100">
                    Standard Grace Period (5 Days after issue)
                  </option>
                  <option value="end_of_month" className="bg-slate-900 text-slate-100">
                    End of Billing Month
                  </option>
                  <option value="custom" className="bg-slate-900 text-slate-100">
                    Custom Date...
                  </option>
                </select>
              </fieldset>

              {/* Custom Date Input (shown if custom mode selected) */}
              {dueDateMode === 'custom' && (
                <div className="animate-in fade-in">
                  <fieldset className="border border-slate-700/90 rounded-xl px-3 pb-2 pt-0.5 bg-slate-950/60 focus-within:border-blue-500">
                    <legend className="px-1.5 text-[11px] font-medium text-slate-400">
                      Pick Custom Due Date
                    </legend>
                    <input
                      type="date"
                      value={customDueDate}
                      onChange={(e) => setCustomDueDate(e.target.value)}
                      className="w-full bg-transparent text-slate-100 text-xs py-1 focus:outline-none font-mono"
                    />
                  </fieldset>
                </div>
              )}

              {/* Live Count & Estimated Amount Preview */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>Subscribers to Bill:</span>
                  <span className="font-bold text-white px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono">
                    {eligibleSubscribers.length}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Est. Total:</span>
                  <span className="font-mono font-bold text-emerald-400 text-xs">
                    {formatCurrency(previewTotalAmount)}
                  </span>
                </div>
              </div>

              {/* Stacked Action Buttons (Matching Image 1) */}
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  disabled={isGenerating || eligibleSubscribers.length === 0}
                  onClick={handleRunBatch}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all hover:scale-[1.01] cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>{isGenerating ? 'Generating Invoices...' : 'Generate Invoices'}</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            /* Success Completion State */
            <div className="text-center py-6 space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Bulk Invoicing Successfully Generated!
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Generated <strong className="text-emerald-400 font-mono">{resultCount} invoices</strong> for cycle {MONTHS.find(m => m.value === billingMonth)?.label} {billingYear} totaling <strong className="text-emerald-400 font-mono">{formatCurrency(resultAmount)}</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm shadow-md transition-all cursor-pointer"
              >
                Return to Invoices
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
