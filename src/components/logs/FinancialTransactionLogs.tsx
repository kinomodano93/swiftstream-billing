import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  CreditCard,
  Receipt,
  Search,
  Filter,
  Download,
  Calendar,
  Layers,
  Wallet,
  Building2,
  User,
  CheckCircle2,
  Clock,
  X,
  Eye,
  FileSpreadsheet,
  Tag,
  Percent,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  UnifiedFinancialTransaction,
  FinancialTransactionType,
  FinancialFlow,
  PaymentMethod,
} from '../../types';
import { formatCurrency } from '../../utils/formatters';

export const FinancialTransactionLogs: React.FC = () => {
  const { invoices, payments, expenses, dailyRemittances, showToast } = useApp();

  // Filter state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [flowFilter, setFlowFilter] = useState<'all' | 'inflow' | 'outflow' | 'receivable'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | FinancialTransactionType>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | 'week' | 'month' | '30days'>('month');

  // Detail Modal State
  const [selectedTx, setSelectedTx] = useState<UnifiedFinancialTransaction | null>(null);

  // Unify and Chronologically Sort Financial Transactions
  const allTransactions: UnifiedFinancialTransaction[] = useMemo(() => {
    const list: UnifiedFinancialTransaction[] = [];

    // 1. Invoices Generated (Receivables)
    invoices.forEach((inv) => {
      const periodDesc =
        inv.billingPeriodStart && inv.billingPeriodEnd
          ? `${inv.billingPeriodStart} to ${inv.billingPeriodEnd}`
          : 'Monthly';
      const mainItem = inv.items?.[0];
      const categoryDesc = mainItem?.description || 'Monthly Internet Plan';

      list.push({
        id: `tx-inv-${inv.id}`,
        timestamp: inv.issueDate || inv.createdAt || '',
        referenceNumber: inv.invoiceNumber,
        type: 'invoice',
        flow: 'receivable',
        partyName: inv.customerName || 'Subscriber',
        partySubtext: `Period: ${periodDesc} • Due: ${inv.dueDate}`,
        category: categoryDesc,
        amount: inv.totalAmount,
        paymentMethod: inv.status === 'paid' ? 'Paid' : 'Unpaid',
        recordedBy: 'Billing Engine',
        status: inv.status.toUpperCase(),
        notes: `Balance Due: ₱${inv.balanceDue.toLocaleString()} (Paid: ₱${inv.amountPaid.toLocaleString()})`,
        sourceDocId: inv.id,
      });
    });

    // 2. Payments Collected (Cash Inflows)
    payments.forEach((pay) => {
      list.push({
        id: `tx-pay-${pay.id}`,
        timestamp: pay.paymentDate || pay.createdAt || '',
        referenceNumber: pay.receiptNumber || pay.referenceNumber || pay.id,
        type: 'payment',
        flow: 'inflow',
        partyName: pay.customerName || 'Subscriber',
        partySubtext: `Account #${pay.accountNo || 'N/A'}${pay.invoiceNumber ? ` • Inv: ${pay.invoiceNumber}` : ''}`,
        category: pay.isAdvancePayment ? 'Advance Deposit' : 'Monthly Bill Collection',
        amount: pay.amount,
        paymentMethod: pay.paymentMethod,
        recordedBy: pay.cashierName || 'Cashier Desk',
        status: pay.remittanceStatus === 'remitted' ? 'REMITTED' : 'COLLECTED',
        notes: pay.notes || (pay.referenceNumber ? `Ref: ${pay.referenceNumber}` : ''),
        sourceDocId: pay.id,
      });
    });

    // 3. Operating Expenses Disbursed (Cash Outflows)
    expenses.forEach((exp) => {
      list.push({
        id: `tx-exp-${exp.id}`,
        timestamp: exp.date || '',
        referenceNumber: exp.receiptNumber || exp.id,
        type: 'expense',
        flow: 'outflow',
        partyName: exp.vendorName || 'Vendor / Supplier',
        partySubtext: `Receipt: ${exp.receiptNumber || 'N/A'}`,
        category: exp.category.replace(/_/g, ' ').toUpperCase(),
        amount: exp.amount,
        paymentMethod: exp.paymentMethod,
        recordedBy: exp.recordedBy || 'Admin Leonardo Flojo',
        status: 'DISBURSED',
        notes: exp.description + (exp.notes ? ` (${exp.notes})` : ''),
        sourceDocId: exp.id,
      });
    });

    // 4. Daily Remittance Records
    dailyRemittances.forEach((rem) => {
      list.push({
        id: `tx-rem-${rem.id}`,
        timestamp: rem.remittanceDate || '',
        referenceNumber: rem.id,
        type: 'remittance',
        flow: 'inflow',
        partyName: rem.cashierName || 'Cashier Desk',
        partySubtext: `Payments: ${rem.paymentCount} collections reconciled`,
        category: 'Cashier Daily Remittance',
        amount: rem.actualCashInDrawer,
        paymentMethod: 'cash',
        recordedBy: rem.verifiedBy || 'Auditor',
        status: rem.status === 'audited' ? 'AUDITED' : rem.status.toUpperCase(),
        notes: `Total Collected: ₱${rem.totalCollected.toLocaleString()} • Discrepancy: ₱${rem.discrepancy.toLocaleString()}`,
        sourceDocId: rem.id,
      });
    });

    // Sort descending by timestamp
    return list.sort((a, b) => {
      const timeA = new Date(a.timestamp.replace(' ', 'T')).getTime() || 0;
      const timeB = new Date(b.timestamp.replace(' ', 'T')).getTime() || 0;
      return timeB - timeA;
    });
  }, [invoices, payments, expenses, dailyRemittances]);

  // Filtering Logic
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return allTransactions.filter((tx) => {
      // Flow filter
      if (flowFilter !== 'all' && tx.flow !== flowFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'all' && tx.type !== typeFilter) {
        return false;
      }

      // Method filter
      if (methodFilter !== 'all' && tx.paymentMethod.toLowerCase() !== methodFilter.toLowerCase()) {
        return false;
      }

      // Date Range filter
      if (dateRangeFilter !== 'all') {
        const txTime = new Date(tx.timestamp.replace(' ', 'T')).getTime();
        if (dateRangeFilter === 'today' && txTime < todayStart) return false;
        if (dateRangeFilter === 'week' && txTime < weekStart) return false;
        if (dateRangeFilter === 'month' && txTime < monthStart) return false;
        if (dateRangeFilter === '30days' && txTime < thirtyDaysAgo) return false;
      }

      // Keyword search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesRef = tx.referenceNumber?.toLowerCase().includes(query);
        const matchesParty = tx.partyName?.toLowerCase().includes(query);
        const matchesSubtext = tx.partySubtext?.toLowerCase().includes(query);
        const matchesCategory = tx.category?.toLowerCase().includes(query);
        const matchesOperator = tx.recordedBy?.toLowerCase().includes(query);
        const matchesNotes = tx.notes?.toLowerCase().includes(query);

        if (!matchesRef && !matchesParty && !matchesSubtext && !matchesCategory && !matchesOperator && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [allTransactions, flowFilter, typeFilter, methodFilter, dateRangeFilter, searchTerm]);

  // Aggregated Financial KPIs (based on filtered view or all view)
  const totalCollections = useMemo(
    () =>
      filteredTransactions
        .filter((t) => t.type === 'payment')
        .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  );

  const totalOpex = useMemo(
    () =>
      filteredTransactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  );

  const netCashFlow = totalCollections - totalOpex;

  const totalInvoiced = useMemo(
    () =>
      filteredTransactions
        .filter((t) => t.type === 'invoice')
        .reduce((sum, t) => sum + t.amount, 0),
    [filteredTransactions]
  );

  const collectionRealizationRate = totalInvoiced > 0 ? Math.min(100, (totalCollections / totalInvoiced) * 100) : 0;

  // CSV Export
  const handleExportCsv = () => {
    if (filteredTransactions.length === 0) {
      showToast('info', 'No Transactions', 'There are no financial ledger entries matching your filters.');
      return;
    }

    const headers = [
      'Transaction ID',
      'Date & Time',
      'Reference #',
      'Type',
      'Cash Flow',
      'Party / Customer / Vendor',
      'Category',
      'Payment Method',
      'Amount (PHP)',
      'Recorded By',
      'Status',
      'Notes',
    ];

    const rows = filteredTransactions.map((tx) => [
      tx.id,
      tx.timestamp,
      `"${tx.referenceNumber.replace(/"/g, '""')}"`,
      tx.type.toUpperCase(),
      tx.flow.toUpperCase(),
      `"${tx.partyName.replace(/"/g, '""')}"`,
      `"${tx.category.replace(/"/g, '""')}"`,
      tx.paymentMethod.toUpperCase(),
      tx.flow === 'outflow' ? -tx.amount : tx.amount,
      `"${tx.recordedBy.replace(/"/g, '""')}"`,
      tx.status,
      `"${(tx.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financial_transaction_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('success', 'Ledger Exported', `Exported ${filteredTransactions.length} financial transactions.`);
  };

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 animate-in fade-in">
      {/* Header Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Receipt className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
              Financial Transaction Logs & Ledger
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              Real-time Ledger
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Audit-grade double-entry ledger tracking billings, subscriber collections, operating disbursements, and remittances.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export Financial Ledger (CSV)</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Collections */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Total Collections (Inflow)</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
            {formatCurrency(totalCollections)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Verified cash, e-wallets & banks</p>
        </div>

        {/* Total Expenses */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Operating Expenses (OPEX)</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-400">
            {formatCurrency(totalOpex)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Transit, power, payroll & fiber</p>
        </div>

        {/* Net Operating Margin */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Net Operating Cash Flow</span>
            <div
              className={`p-1.5 rounded-lg ${
                netCashFlow >= 0 ? 'bg-cyan-500/10 text-cyan-400' : 'bg-amber-500/10 text-amber-400'
              }`}
            >
              {netCashFlow >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div
            className={`text-xl sm:text-2xl font-black font-mono ${
              netCashFlow >= 0 ? 'text-cyan-300' : 'text-amber-400'
            }`}
          >
            {formatCurrency(netCashFlow)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Net = Collections − OPEX</p>
        </div>

        {/* Total Invoiced */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Total Invoiced (Receivables)</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-blue-400">
            {formatCurrency(totalInvoiced)}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
            <Percent className="w-3 h-3 text-cyan-400" />
            <span>{collectionRealizationRate.toFixed(1)}% Realization Rate</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-card">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reference # (OR, INV, EXP), customer, vendor, operator..."
              className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Flow Type */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <span className="text-[10px] text-slate-400 font-medium">Flow:</span>
              <select
                value={flowFilter}
                onChange={(e) => setFlowFilter(e.target.value as any)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Cash Flows</option>
                <option value="inflow" className="bg-slate-900">🟢 Inflows (Collections & Cash)</option>
                <option value="outflow" className="bg-slate-900">🔴 Outflows (OPEX Disbursements)</option>
                <option value="receivable" className="bg-slate-900">🔵 Receivables (Invoices Billed)</option>
              </select>
            </div>

            {/* Transaction Type */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <span className="text-[10px] text-slate-400 font-medium">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Types</option>
                <option value="payment" className="bg-slate-900">Payments & Collections</option>
                <option value="expense" className="bg-slate-900">Operating Expenses</option>
                <option value="invoice" className="bg-slate-900">Generated Invoices</option>
                <option value="remittance" className="bg-slate-900">Daily Remittances</option>
              </select>
            </div>

            {/* Payment Method */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <span className="text-[10px] text-slate-400 font-medium">Method:</span>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Channels</option>
                <option value="cash" className="bg-slate-900">Cash</option>
                <option value="gcash" className="bg-slate-900">GCash</option>
                <option value="maya" className="bg-slate-900">Maya</option>
                <option value="bank_transfer" className="bg-slate-900">Bank Transfer</option>
                <option value="online_gateway" className="bg-slate-900">Online Gateway (Xendit)</option>
                <option value="check" className="bg-slate-900">Check</option>
              </select>
            </div>

            {/* Period */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <span className="text-[10px] text-slate-400 font-medium">Period:</span>
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value as any)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="month" className="bg-slate-900">This Month</option>
                <option value="today" className="bg-slate-900">Today</option>
                <option value="week" className="bg-slate-900">This Week</option>
                <option value="30days" className="bg-slate-900">Past 30 Days</option>
                <option value="all" className="bg-slate-900">All Time</option>
              </select>
            </div>
          </div>
        </div>

        {/* Status Counter */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
          <span>
            Displaying <strong className="text-emerald-400 font-mono">{filteredTransactions.length}</strong> of{' '}
            <span className="font-mono text-slate-300">{allTransactions.length}</span> ledger entries
          </span>
          {(flowFilter !== 'all' || typeFilter !== 'all' || methodFilter !== 'all' || dateRangeFilter !== 'month' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setFlowFilter('all');
                setTypeFilter('all');
                setMethodFilter('all');
                setDateRangeFilter('month');
                setSearchTerm('');
              }}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-medium cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Financial Ledger Table */}
      <div className="overflow-hidden border border-slate-800 rounded-2xl bg-slate-950 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3.5">Date & Time</th>
                <th className="px-4 py-3.5">Reference #</th>
                <th className="px-4 py-3.5">Flow</th>
                <th className="px-4 py-3.5">Party / Entity</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Channel / Method</th>
                <th className="px-4 py-3.5 text-right">Amount (PHP)</th>
                <th className="px-4 py-3.5">Operator</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-500 font-sans">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Receipt className="w-8 h-8 text-slate-600 mb-1" />
                      <p className="text-sm font-semibold text-slate-400">No financial records found</p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        Try modifying your cash flow filter or selecting a broader time period.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isPositive = tx.flow === 'inflow';
                  const isNegative = tx.flow === 'outflow';
                  const isReceivable = tx.flow === 'receivable';

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                    >
                      {/* Date & Time */}
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{tx.timestamp.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                      </td>

                      {/* Reference # */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-slate-200">
                          {tx.type === 'payment' && <Receipt className="w-3.5 h-3.5 text-emerald-400" />}
                          {tx.type === 'expense' && <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />}
                          {tx.type === 'invoice' && <FileText className="w-3.5 h-3.5 text-blue-400" />}
                          {tx.type === 'remittance' && <Building2 className="w-3.5 h-3.5 text-amber-400" />}
                          <span>{tx.referenceNumber}</span>
                        </div>
                      </td>

                      {/* Flow */}
                      <td className="px-4 py-3 whitespace-nowrap font-sans">
                        {isPositive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                            <ArrowDownRight className="w-3 h-3" />
                            Inflow
                          </span>
                        )}
                        {isNegative && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-rose-950/60 text-rose-300 border border-rose-800/60">
                            <ArrowUpRight className="w-3 h-3" />
                            Outflow
                          </span>
                        )}
                        {isReceivable && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-950/60 text-blue-300 border border-blue-800/60">
                            <FileText className="w-3 h-3" />
                            Invoiced
                          </span>
                        )}
                      </td>

                      {/* Party / Entity */}
                      <td className="px-4 py-3 text-slate-200 font-sans whitespace-nowrap">
                        <div className="font-medium text-xs text-slate-100">{tx.partyName}</div>
                        {tx.partySubtext && (
                          <div className="text-[10px] text-slate-500 font-mono truncate max-w-xs">
                            {tx.partySubtext}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 text-slate-300 font-sans whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] uppercase font-semibold text-slate-400">
                          {tx.category}
                        </span>
                      </td>

                      {/* Channel / Method */}
                      <td className="px-4 py-3 whitespace-nowrap font-sans">
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] uppercase font-semibold text-cyan-300">
                          {tx.paymentMethod}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span
                          className={`text-xs font-bold ${
                            isPositive
                              ? 'text-emerald-400'
                              : isNegative
                              ? 'text-rose-400'
                              : 'text-blue-400'
                          }`}
                        >
                          {isPositive ? '+' : isNegative ? '−' : ''}
                          {formatCurrency(tx.amount)}
                        </span>
                      </td>

                      {/* Operator */}
                      <td className="px-4 py-3 text-slate-400 font-sans whitespace-nowrap text-[11px]">
                        {tx.recordedBy}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center whitespace-nowrap font-sans">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            tx.status === 'COLLECTED' || tx.status === 'REMITTED' || tx.status === 'PAID' || tx.status === 'VERIFIED'
                              ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/60'
                              : tx.status === 'DISBURSED'
                              ? 'bg-slate-900 text-slate-300 border border-slate-800'
                              : 'bg-amber-950/50 text-amber-400 border border-amber-800/60'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>

                      {/* View Button */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTx(tx);
                          }}
                          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-cyan-300 group-hover:border-cyan-500/40 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Drawer / Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-2xl border ${
                    selectedTx.flow === 'inflow'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : selectedTx.flow === 'outflow'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  }`}
                >
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Transaction Voucher</span>
                    <span className="text-xs font-mono text-cyan-400">{selectedTx.referenceNumber}</span>
                  </h3>
                  <p className="text-xs text-slate-400">Recorded on {selectedTx.timestamp}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Amount Banner */}
            <div
              className={`p-4 rounded-2xl border text-center space-y-1 ${
                selectedTx.flow === 'inflow'
                  ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400'
                  : selectedTx.flow === 'outflow'
                  ? 'bg-rose-950/30 border-rose-800/40 text-rose-400'
                  : 'bg-blue-950/30 border-blue-800/40 text-blue-400'
              }`}
            >
              <span className="text-[11px] uppercase tracking-wider font-semibold opacity-80 block">
                Transaction Value ({selectedTx.flow.toUpperCase()})
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono">
                {selectedTx.flow === 'inflow' ? '+' : selectedTx.flow === 'outflow' ? '−' : ''}
                {formatCurrency(selectedTx.amount)}
              </div>
              <span className="text-[10px] uppercase font-bold font-sans px-2 py-0.5 rounded bg-slate-900/60 inline-block mt-1">
                Status: {selectedTx.status}
              </span>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Counterparty</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">{selectedTx.partyName}</span>
                {selectedTx.partySubtext && (
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{selectedTx.partySubtext}</span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Classification</span>
                <span className="font-semibold text-cyan-400 mt-0.5 block">{selectedTx.category}</span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">Type: {selectedTx.type}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Payment Channel</span>
                <span className="font-semibold text-slate-200 uppercase mt-0.5 block">{selectedTx.paymentMethod}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Recorded By</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">{selectedTx.recordedBy}</span>
              </div>
            </div>

            {/* Notes / Narrative */}
            {selectedTx.notes && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Voucher Notes</span>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">{selectedTx.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Close Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

