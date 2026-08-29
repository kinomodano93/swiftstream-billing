import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  CreditCard,
  AlertTriangle,
  FileSpreadsheet,
  Calendar,
  DollarSign,
  PieChart as PieChartIcon,
  ShieldCheck,
  Plus,
  Search,
  Filter,
  Receipt,
  Building2,
  Zap,
  Radio,
  Wrench,
  Users,
  Layers,
  Trash2,
  Edit2,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  X,
  Tag,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Expense, ExpenseCategory, Payment } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';

export const EXPENSE_CATEGORY_CONFIG: Record<
  ExpenseCategory,
  { label: string; color: string; badgeBg: string; badgeBorder: string; textClass: string }
> = {
  upstream_bandwidth: {
    label: 'Upstream Bandwidth & Transit',
    color: 'bg-cyan-500',
    badgeBg: 'bg-cyan-500/10',
    badgeBorder: 'border-cyan-500/30',
    textClass: 'text-cyan-400',
  },
  power_electricity: {
    label: 'Power & Electricity (CASURECO)',
    color: 'bg-amber-500',
    badgeBg: 'bg-amber-500/10',
    badgeBorder: 'border-amber-500/30',
    textClass: 'text-amber-400',
  },
  fiber_supplies: {
    label: 'Fiber Drop Cables & Materials',
    color: 'bg-blue-500',
    badgeBg: 'bg-blue-500/10',
    badgeBorder: 'border-blue-500/30',
    textClass: 'text-blue-400',
  },
  payroll_salaries: {
    label: 'Linemen & Staff Payroll',
    color: 'bg-emerald-500',
    badgeBg: 'bg-emerald-500/10',
    badgeBorder: 'border-emerald-500/30',
    textClass: 'text-emerald-400',
  },
  rent_pole_attachments: {
    label: 'Pole Attachments & Facility Rent',
    color: 'bg-purple-500',
    badgeBg: 'bg-purple-500/10',
    badgeBorder: 'border-purple-500/30',
    textClass: 'text-purple-400',
  },
  repairs_spareparts: {
    label: 'Repair Spare Parts & ICs',
    color: 'bg-orange-500',
    badgeBg: 'bg-orange-500/10',
    badgeBorder: 'border-orange-500/30',
    textClass: 'text-orange-400',
  },
  taxes_permits: {
    label: 'Taxes, BIR & Permits',
    color: 'bg-rose-500',
    badgeBg: 'bg-rose-500/10',
    badgeBorder: 'border-rose-500/30',
    textClass: 'text-rose-400',
  },
  marketing_promo: {
    label: 'Marketing & Promo',
    color: 'bg-pink-500',
    badgeBg: 'bg-pink-500/10',
    badgeBorder: 'border-pink-500/30',
    textClass: 'text-pink-400',
  },
  other: {
    label: 'Other Miscellaneous OPEX',
    color: 'bg-slate-500',
    badgeBg: 'bg-slate-500/10',
    badgeBorder: 'border-slate-500/30',
    textClass: 'text-slate-400',
  },
};

export const FinancialReports: React.FC = () => {
  const { customers, invoices, payments, repairOrders, expenses, addExpense, updateExpense, deleteExpense } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'ar_aging' | 'channels'>('overview');

  // Expense Filter State
  const [expenseSearch, setExpenseSearch] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState<string>('all');

  // Modal State
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Expense Form State
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('fiber_supplies');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [formPaymentMethod, setFormPaymentMethod] = useState<Expense['paymentMethod']>('gcash');
  const [formReceiptNumber, setFormReceiptNumber] = useState<string>('');
  const [formVendorName, setFormVendorName] = useState<string>('');
  const [formRecordedBy, setFormRecordedBy] = useState<string>('Admin');
  const [formNotes, setFormNotes] = useState<string>('');

  // --- Financial Calculations ---
  // Inflows & Revenue
  const totalCollections = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalBilled = invoices.reduce((sum, i) => sum + i.totalAmount, 0);

  // Subscription vs Repair Shop breakdown
  const subscriptionCollections = payments
    .filter((p) => {
      const inv = invoices.find((i) => i.id === p.invoiceId);
      return !inv?.items.some((it) => it.type === 'repair');
    })
    .reduce((sum, p) => sum + p.amount, 0);

  const repairCollections = payments
    .filter((p) => {
      const inv = invoices.find((i) => i.id === p.invoiceId);
      return Boolean(inv?.items.some((it) => it.type === 'repair'));
    })
    .reduce((sum, p) => sum + p.amount, 0);

  // Operating Expenses (OPEX)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Net Operating Profit (P&L)
  const netProfit = totalCollections - totalExpenses;
  const profitMarginPct = totalCollections > 0 ? ((netProfit / totalCollections) * 100).toFixed(1) : '0.0';

  // Breakdown by Category
  const expenseByCategory = expenses.reduce(
    (acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    },
    {} as Record<ExpenseCategory, number>
  );

  // AR Aging Calculation
  const now = new Date().getTime();
  let currentDue = 0;
  let aging1to30 = 0;
  let aging31to60 = 0;
  let aging60Plus = 0;

  invoices
    .filter((inv) => inv.status !== 'paid' && inv.balanceDue > 0)
    .forEach((inv) => {
      const dueTime = new Date(inv.dueDate).getTime();
      const diffDays = Math.floor((now - dueTime) / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        currentDue += inv.balanceDue;
      } else if (diffDays <= 30) {
        aging1to30 += inv.balanceDue;
      } else if (diffDays <= 60) {
        aging31to60 += inv.balanceDue;
      } else {
        aging60Plus += inv.balanceDue;
      }
    });

  const totalOutstandingAR = currentDue + aging1to30 + aging31to60 + aging60Plus;

  // Collections by Payment Channel
  const collectionsByChannel = payments.reduce(
    (acc, p) => {
      acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + p.amount;
      return acc;
    },
    {} as Record<Payment['paymentMethod'], number>
  );

  // Filtered Expenses
  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch =
      e.description.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      (e.vendorName && e.vendorName.toLowerCase().includes(expenseSearch.toLowerCase())) ||
      (e.receiptNumber && e.receiptNumber.toLowerCase().includes(expenseSearch.toLowerCase()));
    const matchesCategory = selectedCategoryFilter === 'all' || e.category === selectedCategoryFilter;
    const matchesMethod = selectedMethodFilter === 'all' || e.paymentMethod === selectedMethodFilter;
    return matchesSearch && matchesCategory && matchesMethod;
  });

  // Modal Handlers
  const handleOpenAddModal = () => {
    setEditingExpense(null);
    setFormCategory('fiber_supplies');
    setFormDescription('');
    setFormAmount('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormPaymentMethod('gcash');
    setFormReceiptNumber('');
    setFormVendorName('');
    setFormRecordedBy('Admin');
    setFormNotes('');
    setShowExpenseModal(true);
  };

  const handleOpenEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setFormCategory(exp.category);
    setFormDescription(exp.description);
    setFormAmount(String(exp.amount));
    setFormDate(exp.date);
    setFormPaymentMethod(exp.paymentMethod);
    setFormReceiptNumber(exp.receiptNumber || '');
    setFormVendorName(exp.vendorName || '');
    setFormRecordedBy(exp.recordedBy || 'Admin');
    setFormNotes(exp.notes || '');
    setShowExpenseModal(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount);
    if (!formDescription.trim() || isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid expense description and positive amount.');
      return;
    }

    if (editingExpense) {
      updateExpense(editingExpense.id, {
        category: formCategory,
        description: formDescription.trim(),
        amount: amountNum,
        date: formDate,
        paymentMethod: formPaymentMethod,
        receiptNumber: formReceiptNumber.trim() || undefined,
        vendorName: formVendorName.trim() || undefined,
        recordedBy: formRecordedBy.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
    } else {
      addExpense({
        category: formCategory,
        description: formDescription.trim(),
        amount: amountNum,
        date: formDate,
        paymentMethod: formPaymentMethod,
        receiptNumber: formReceiptNumber.trim() || undefined,
        vendorName: formVendorName.trim() || undefined,
        recordedBy: formRecordedBy.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });
    }

    setShowExpenseModal(false);
  };

  const handleDeleteExpense = (exp: Expense) => {
    setExpenseToDelete(exp);
  };

  // Comprehensive Financial & Expense CSV Export
  const exportFinancialReport = () => {
    const report = [
      ['SWIFTSTREAM TELECOMMUNICATION & REPAIR SHOP - EXECUTIVE FINANCIAL STATEMENT'],
      ['Generated On', new Date().toISOString()],
      [''],
      ['========================================================================'],
      ['1. PROFIT & LOSS (P&L) INCOME STATEMENT SUMMARY'],
      ['========================================================================'],
      ['Gross Subscription Inflow (Collections)', subscriptionCollections],
      ['Electronics & Repair Shop Inflow', repairCollections],
      ['TOTAL GROSS OPERATING INFLOW (REVENUE)', totalCollections],
      [''],
      ['Total Billed Invoices', totalBilled],
      ['Collection Efficiency Rate', `${totalBilled > 0 ? ((totalCollections / totalBilled) * 100).toFixed(1) : '100'}%`],
      [''],
      ['OPERATING EXPENSES (OPEX) BREAKDOWN'],
      ...Object.entries(EXPENSE_CATEGORY_CONFIG).map(([catKey, cfg]) => {
        const catTotal = expenses.filter((e) => e.category === catKey).reduce((s, e) => s + e.amount, 0);
        return [`  - ${cfg.label}`, catTotal];
      }),
      ['TOTAL OPERATING EXPENSES (OPEX)', totalExpenses],
      [''],
      ['NET OPERATING PROFIT / (LOSS)', netProfit],
      ['NET PROFIT MARGIN', `${profitMarginPct}%`],
      [''],
      ['========================================================================'],
      ['2. ACCOUNTS RECEIVABLE (AR) AGING ANALYSIS'],
      ['========================================================================'],
      ['Current (Within Due Date)', currentDue],
      ['1 - 30 Days Overdue', aging1to30],
      ['31 - 60 Days Overdue', aging31to60],
      ['60+ Days Overdue (At Risk)', aging60Plus],
      ['TOTAL OUTSTANDING RECEIVABLES (AR)', totalOutstandingAR],
      [''],
      ['========================================================================'],
      ['3. ITEMIZED OPERATIONAL EXPENSE LEDGER'],
      ['========================================================================'],
      ['Date', 'Voucher ID', 'Category', 'Description', 'Vendor / Payee', 'Receipt / OR #', 'Payment Method', 'Amount (PHP)', 'Recorded By'],
      ...expenses.map((e) => [
        e.date,
        e.id,
        EXPENSE_CATEGORY_CONFIG[e.category]?.label || e.category,
        `"${e.description.replace(/"/g, '""')}"`,
        `"${(e.vendorName || 'N/A').replace(/"/g, '""')}"`,
        e.receiptNumber || 'N/A',
        e.paymentMethod.toUpperCase(),
        e.amount,
        e.recordedBy || 'Admin',
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + report.map((r) => r.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `swiftstream_financial_pnl_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <span>Financial Analytics & Profit & Loss (P&L) Reports</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track gross inflows, itemized OPEX expenses, net operating profit margins, and accounts receivable aging.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Expense</span>
          </button>

          <button
            onClick={exportFinancialReport}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export Financial & OPEX Statement</span>
          </button>
        </div>
      </div>

      {/* Top Financial KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Gross Collections */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gross Inflow (Revenue)</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-100 font-mono">{formatCurrency(totalCollections)}</h3>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
            <span>Fiber Subscriptions</span>
            <span className="font-mono text-slate-300 font-semibold">{formatCurrency(subscriptionCollections)}</span>
          </div>
        </div>

        {/* 2. Total Operating Expenses */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Total OPEX Expenses</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-400 font-mono">{formatCurrency(totalExpenses)}</h3>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
            <span>{expenses.length} Vouchers Logged</span>
            <span className="font-mono text-amber-300 font-semibold">
              {totalCollections > 0 ? `${((totalExpenses / totalCollections) * 100).toFixed(0)}% of Revenue` : '0%'}
            </span>
          </div>
        </div>

        {/* 3. Net Operating Profit */}
        <div
          className={`p-5 rounded-3xl bg-slate-900/80 border shadow-card space-y-2 relative overflow-hidden ${
            netProfit >= 0 ? 'border-emerald-500/30' : 'border-rose-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Net Operating Profit
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                netProfit >= 0
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3
            className={`text-2xl font-black font-mono ${
              netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatCurrency(netProfit)}
          </h3>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
            <span>Net Profit Margin</span>
            <span
              className={`font-mono font-bold ${
                netProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {profitMarginPct}% Margin
            </span>
          </div>
        </div>

        {/* 4. Accounts Receivable */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Uncollected AR</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-rose-400 font-mono">{formatCurrency(totalOutstandingAR)}</h3>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
            <span>Collection Efficiency</span>
            <span className="font-mono text-cyan-400 font-semibold">
              {totalBilled > 0 ? `${((totalCollections / totalBilled) * 100).toFixed(1)}%` : '100%'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-colors ${
            activeTab === 'overview'
              ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <PieChartIcon className="w-4 h-4" />
          <span>Profit & Loss (P&L) Statement</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-colors ${
            activeTab === 'expenses'
              ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Expense Ledger & Vouchers ({expenses.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ar_aging')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-colors ${
            activeTab === 'ar_aging'
              ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Accounts Receivable (AR) Aging</span>
        </button>

        <button
          onClick={() => setActiveTab('channels')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-colors ${
            activeTab === 'channels'
              ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Payment Gateway Allocation</span>
        </button>
      </div>

      {/* TAB 1: PROFIT & LOSS (P&L) STATEMENT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Income Statement Table */}
            <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-cyan-400" />
                    <span>Operating Income Statement (P&L)</span>
                  </h3>
                  <p className="text-xs text-slate-400">Statement of gross inflows versus operational expenditures</p>
                </div>
                <span className="font-mono text-xs text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  Fiscal Period: August 2026
                </span>
              </div>

              <div className="space-y-4 text-xs">
                {/* 1. Operating Revenue Section */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-slate-300 font-bold uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800">
                    <span>1. Operating Revenue & Inflow</span>
                    <span className="text-cyan-400">{formatCurrency(totalCollections)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400 pl-4 py-1">
                    <span>Fiber Internet Monthly Subscriptions</span>
                    <span className="font-mono text-slate-200 font-semibold">{formatCurrency(subscriptionCollections)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400 pl-4 py-1">
                    <span>Electronics & Optical Splicing Repair Services</span>
                    <span className="font-mono text-slate-200 font-semibold">{formatCurrency(repairCollections)}</span>
                  </div>
                </div>

                {/* 2. Operating Expenses Section */}
                <div className="space-y-2 pt-3">
                  <div className="flex justify-between items-center text-slate-300 font-bold uppercase tracking-wider text-[11px] pb-1 border-b border-slate-800">
                    <span>2. Operating Expenses (OPEX)</span>
                    <span className="text-amber-400">({formatCurrency(totalExpenses)})</span>
                  </div>

                  {Object.entries(EXPENSE_CATEGORY_CONFIG).map(([catKey, cfg]) => {
                    const catTotal = expenses
                      .filter((e) => e.category === catKey)
                      .reduce((s, e) => s + e.amount, 0);
                    if (catTotal === 0) return null;
                    const catPct = totalExpenses > 0 ? ((catTotal / totalExpenses) * 100).toFixed(1) : '0';

                    return (
                      <div key={catKey} className="flex justify-between items-center text-slate-400 pl-4 py-1">
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${cfg.color}`} />
                          <span>{cfg.label}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-mono">({catPct}%)</span>
                          <span className="font-mono text-slate-200 font-semibold">{formatCurrency(catTotal)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 3. Net Operating Income / Profit */}
                <div className="pt-3 border-t-2 border-slate-700/80">
                  <div className="flex justify-between items-center p-3 rounded-2xl bg-slate-950 border border-slate-800">
                    <div>
                      <span className="font-bold text-sm text-slate-100 block">NET OPERATING PROFIT (EBITDA)</span>
                      <span className="text-[11px] text-slate-400">Gross Collections minus Operating Expenses</span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xl font-black font-mono block ${
                          netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatCurrency(netProfit)}
                      </span>
                      <span
                        className={`text-[11px] font-mono font-bold ${
                          netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {profitMarginPct}% Net Margin
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* OPEX Category Distribution Visual Card */}
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-400" />
                  <span>OPEX Category Allocation</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">Breakdown of operational expenditures</p>

                <div className="space-y-3 mt-4 text-xs">
                  {Object.entries(EXPENSE_CATEGORY_CONFIG).map(([catKey, cfg]) => {
                    const catTotal = expenses
                      .filter((e) => e.category === catKey)
                      .reduce((s, e) => s + e.amount, 0);
                    const pct = totalExpenses > 0 ? Math.round((catTotal / totalExpenses) * 100) : 0;
                    if (catTotal === 0) return null;

                    return (
                      <div key={catKey} className="space-y-1">
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">{cfg.label}</span>
                          <span className="font-mono font-bold text-slate-200">
                            {formatCurrency(catTotal)} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                          <div className={`h-full ${cfg.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Total Monthly Vouchers:</span>
                  <span className="font-mono font-bold text-slate-100">{expenses.length} Records</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Largest Expense:</span>
                  <span className="font-mono font-bold text-cyan-400">
                    {expenses.length > 0
                      ? formatCurrency(Math.max(...expenses.map((e) => e.amount)))
                      : '₱0.00'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Performance Ratios */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[11px] font-medium text-slate-400">Collection Efficiency</span>
              <div className="flex items-baseline justify-between">
                <h4 className="text-lg font-bold font-mono text-emerald-400">
                  {totalBilled > 0 ? `${((totalCollections / totalBilled) * 100).toFixed(1)}%` : '100%'}
                </h4>
                <span className="text-[10px] text-slate-500">Target: &gt;90%</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[11px] font-medium text-slate-400">OPEX-to-Revenue Ratio</span>
              <div className="flex items-baseline justify-between">
                <h4 className="text-lg font-bold font-mono text-amber-400">
                  {totalCollections > 0 ? `${((totalExpenses / totalCollections) * 100).toFixed(1)}%` : '0%'}
                </h4>
                <span className="text-[10px] text-slate-500">Operating overhead</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[11px] font-medium text-slate-400">Average Revenue Per User (ARPU)</span>
              <div className="flex items-baseline justify-between">
                <h4 className="text-lg font-bold font-mono text-cyan-400">
                  {customers.length > 0 ? formatCurrency(totalBilled / (customers.length || 1)) : '₱0.00'}
                </h4>
                <span className="text-[10px] text-slate-500">Monthly / subscriber</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXPENSE LEDGER & VOUCHERS */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by description, vendor, or receipt #..."
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Categories ({expenses.length})</option>
                {Object.entries(EXPENSE_CATEGORY_CONFIG).map(([k, cfg]) => (
                  <option key={k} value={k}>
                    {cfg.label}
                  </option>
                ))}
              </select>

              <select
                value={selectedMethodFilter}
                onChange={(e) => setSelectedMethodFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Payment Methods</option>
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="maya">Maya</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="check">Check</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">
                Filtered Total: <strong className="text-amber-400">{formatCurrency(filteredExpenses.reduce((s, e) => s + e.amount, 0))}</strong>
              </span>
            </div>
          </div>

          {/* Expense Table */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Date & ID</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Description & Notes</th>
                    <th className="p-3.5">Vendor / Receipt #</th>
                    <th className="p-3.5">Payment Method</th>
                    <th className="p-3.5 text-right">Amount (₱)</th>
                    <th className="p-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>No expense vouchers found matching your filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => {
                      const cfg = EXPENSE_CATEGORY_CONFIG[exp.category] || EXPENSE_CATEGORY_CONFIG.other;
                      return (
                        <tr key={exp.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-3.5 font-mono text-slate-300">
                            <span className="font-bold block text-slate-100">{exp.date}</span>
                            <span className="text-[10px] text-slate-500">{exp.id}</span>
                          </td>

                          <td className="p-3.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.badgeBg} ${cfg.badgeBorder} ${cfg.textClass}`}
                            >
                              {cfg.label}
                            </span>
                          </td>

                          <td className="p-3.5 max-w-xs">
                            <span className="font-semibold text-slate-200 block">{exp.description}</span>
                            {exp.notes && <span className="text-[10px] text-slate-400 block truncate">{exp.notes}</span>}
                          </td>

                          <td className="p-3.5">
                            <span className="text-slate-300 font-medium block">{exp.vendorName || 'Direct Expense'}</span>
                            {exp.receiptNumber && (
                              <span className="text-[10px] text-slate-400 font-mono block">Ref: {exp.receiptNumber}</span>
                            )}
                          </td>

                          <td className="p-3.5 font-mono uppercase text-[11px] text-slate-300">
                            <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800">
                              {exp.paymentMethod.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="p-3.5 text-right font-mono font-bold text-slate-100 text-sm">
                            {formatCurrency(exp.amount)}
                          </td>

                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditModal(exp)}
                                className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                                title="Edit Expense Voucher"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(exp)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                title="Delete Expense Voucher"
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
        </div>
      )}

      {/* TAB 3: ACCOUNTS RECEIVABLE (AR) AGING */}
      {activeTab === 'ar_aging' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-100">Accounts Receivable (AR) Aging Summary</h3>
                <p className="text-xs text-slate-400">Aging profile of unpaid subscriber invoices</p>
              </div>
              <span className="font-mono text-sm font-bold text-rose-400">
                Total AR: {formatCurrency(totalOutstandingAR)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/30">
                <span className="text-[11px] font-bold text-emerald-400 uppercase">Current (Not Yet Due)</span>
                <h4 className="text-xl font-bold text-slate-100 font-mono mt-1">{formatCurrency(currentDue)}</h4>
                <span className="text-[10px] text-slate-500">Normal billing period cycle</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-amber-500/30">
                <span className="text-[11px] font-bold text-amber-400 uppercase">1 - 30 Days Overdue</span>
                <h4 className="text-xl font-bold text-slate-100 font-mono mt-1">{formatCurrency(aging1to30)}</h4>
                <span className="text-[10px] text-slate-500">Grace period active</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-orange-500/30">
                <span className="text-[11px] font-bold text-orange-400 uppercase">31 - 60 Days Overdue</span>
                <h4 className="text-xl font-bold text-slate-100 font-mono mt-1">{formatCurrency(aging31to60)}</h4>
                <span className="text-[10px] text-slate-500">Notice sent / for suspension</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-rose-500/30">
                <span className="text-[11px] font-bold text-rose-400 uppercase">60+ Days Overdue (At Risk)</span>
                <h4 className="text-xl font-bold text-rose-400 font-mono mt-1">{formatCurrency(aging60Plus)}</h4>
                <span className="text-[10px] text-slate-500">Line suspended / pull-out</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PAYMENT CHANNELS */}
      {activeTab === 'channels' && (
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-4">
          <h3 className="font-bold text-sm text-slate-100">Payment Gateway Allocation</h3>
          <p className="text-xs text-slate-400">Share of collected revenue across customer payment gateways</p>

          <div className="space-y-3 text-xs pt-2">
            {[
              { label: 'GCash App Transfers & QR Code', method: 'gcash', color: 'bg-cyan-500' },
              { label: 'Cash Counter (Shop Desk)', method: 'cash', color: 'bg-emerald-500' },
              { label: 'Maya (PayMaya)', method: 'maya', color: 'bg-purple-500' },
              { label: 'Bank Transfer & Checks', method: 'bank_transfer', color: 'bg-amber-500' },
            ].map((channel) => {
              const subtotal = payments
                .filter((p) => p.paymentMethod === channel.method || (channel.method === 'bank_transfer' && p.paymentMethod === 'check'))
                .reduce((s, p) => s + p.amount, 0);

              const pct = totalCollections > 0 ? Math.round((subtotal / totalCollections) * 100) : 0;

              return (
                <div key={channel.method} className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>{channel.label}</span>
                    <span className="font-mono font-bold text-slate-100">
                      {formatCurrency(subtotal)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div className={`h-full ${channel.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ADD / EDIT EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/30">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">
                    {editingExpense ? 'Edit Expense Voucher' : 'Record New Operating Expense'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Log ISP or electronics shop operational expenditure</p>
                </div>
              </div>

              <button
                onClick={() => setShowExpenseModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveExpense} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category */}
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1 font-medium">Expense Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    {Object.entries(EXPENSE_CATEGORY_CONFIG).map(([k, cfg]) => (
                      <option key={k} value={k}>
                        {cfg.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1 font-medium">Description / Item Purpose *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2x 1000m Fiber Drop Cables & SC/APC Fast Connectors"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Amount (₱ PHP) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono font-bold text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Payment Method *</label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as Expense['paymentMethod'])}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="gcash">GCash</option>
                    <option value="cash">Cash on Hand</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="maya">Maya</option>
                    <option value="check">Check Voucher</option>
                  </select>
                </div>

                {/* Vendor Name */}
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Vendor / Payee</label>
                  <input
                    type="text"
                    placeholder="e.g. PLDT Enterprise, CASURECO II"
                    value={formVendorName}
                    onChange={(e) => setFormVendorName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Receipt / Invoice # */}
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Official Receipt / OR / Ref #</label>
                  <input
                    type="text"
                    placeholder="e.g. OR-889102"
                    value={formReceiptNumber}
                    onChange={(e) => setFormReceiptNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Recorded By */}
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Recorded By</label>
                  <input
                    type="text"
                    placeholder="Admin Leonardo"
                    value={formRecordedBy}
                    onChange={(e) => setFormRecordedBy(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1 font-medium">Notes & Operational Purpose</label>
                  <textarea
                    rows={2}
                    placeholder="Additional context or purpose for this expense voucher..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold shadow-lg shadow-cyan-600/20 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingExpense ? 'Save Changes' : 'Record Expense'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Expense Deletion */}
      <ConfirmDeleteModal
        isOpen={!!expenseToDelete}
        title="Delete Expense Record"
        itemName={expenseToDelete ? `${expenseToDelete.description} — ₱${expenseToDelete.amount.toLocaleString()} (${expenseToDelete.category.replace('_', ' ').toUpperCase()})` : undefined}
        description="Are you sure you want to permanently delete this expense entry? It will be removed from your OPEX ledger, P&L statements, and Cloud Firestore."
        confirmLabel="Yes, Delete Expense"
        onConfirm={() => {
          if (expenseToDelete) {
            deleteExpense(expenseToDelete.id);
            setExpenseToDelete(null);
          }
        }}
        onClose={() => setExpenseToDelete(null)}
      />
    </div>
  );
};

