import React, { useState, useMemo } from 'react';
import {
  FilePlus,
  Search,
  Calendar,
  X,
  Save,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  Wifi,
  Clock,
  Layers,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, Invoice, InvoiceItem } from '../../types';
import { formatCurrency, generateId } from '../../utils/formatters';
import { findCustomerInvoiceForMonth } from '../../utils/billingRules';

interface CreateManualInvoiceModalProps {
  onClose: () => void;
  preselectedCustomerId?: string;
  onInvoiceCreated?: (invoice: Invoice) => void;
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

export const CreateManualInvoiceModal: React.FC<CreateManualInvoiceModalProps> = ({
  onClose,
  preselectedCustomerId,
  onInvoiceCreated,
}) => {
  const { customers, invoices, plans, businessProfile, createInvoice, showToast, hasPermission, systemRole } = useApp();
  const canDirectPay = hasPermission('canAccessFinancials');



  const now = new Date();
  const currentMonthNum = String(now.getMonth() + 1).padStart(2, '0');
  const currentYearStr = String(now.getFullYear());

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(preselectedCustomerId || '');
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);

  const [billingMonth, setBillingMonth] = useState<string>(currentMonthNum);
  const [billingYear, setBillingYear] = useState<string>(currentYearStr);
  const [invoiceType, setInvoiceType] = useState<'regular' | 'installation' | 'prorated' | 'addon'>('regular');
  const [initialStatus, setInitialStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [customDueDate, setCustomDueDate] = useState<string>('');
  const [isProrated, setIsProrated] = useState<boolean>(false);
  const [proratedDays, setProratedDays] = useState<number>(15);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers.slice(0, 30);
    const q = customerSearchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.accountNo.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        c.planName.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [customers, customerSearchQuery]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Authoritative plan lookup from Plans & Packages
  const authoritativePlan = useMemo(() => {
    if (!selectedCustomer) return plans[0] || null;
    return (
      plans.find((p) => p.id === selectedCustomer.planId) ||
      plans.find((p) => p.name?.trim().toLowerCase() === selectedCustomer.planName?.trim().toLowerCase()) ||
      plans.find((p) => p.monthlyFee === selectedCustomer.monthlyFee) ||
      plans[0]
    );
  }, [plans, selectedCustomer]);

  // Calculation of charges
  const daysInSelectedMonth = useMemo(() => {
    const y = parseInt(billingYear, 10) || now.getFullYear();
    const m = parseInt(billingMonth, 10) || (now.getMonth() + 1);
    return new Date(y, m, 0).getDate();
  }, [billingYear, billingMonth, now]);

  const effectiveMonthlyFee = authoritativePlan?.monthlyFee || selectedCustomer?.monthlyFee || 1299;

  const planCharge = useMemo(() => {
    if (isProrated || invoiceType === 'prorated') {
      const days = Math.min(daysInSelectedMonth, Math.max(1, proratedDays));
      return Math.round((days / daysInSelectedMonth) * effectiveMonthlyFee);
    }
    return effectiveMonthlyFee;
  }, [isProrated, invoiceType, proratedDays, daysInSelectedMonth, effectiveMonthlyFee]);

  const installationFee = invoiceType === 'installation' ? 1500 : 0;
  const subtotal = planCharge + installationFee;

  // Verify whether customer actually has open unpaid invoices in the system
  const customerUnpaidInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    return invoices.filter(
      (inv) =>
        (inv.customerId === selectedCustomer.id ||
          inv.accountNo === selectedCustomer.accountNo ||
          inv.customerId === selectedCustomer.accountNo ||
          inv.accountNo === selectedCustomer.id) &&
        inv.status !== 'paid' &&
        (inv.balanceDue || 0) > 0
    );
  }, [selectedCustomer, invoices]);

  // Arrears/previous balance is strictly 0 if no active unpaid invoices exist
  const previousBal = useMemo(() => {
    if (!selectedCustomer || customerUnpaidInvoices.length === 0) return 0;
    return selectedCustomer.balance > 0 ? selectedCustomer.balance : 0;
  }, [selectedCustomer, customerUnpaidInvoices]);

  const totalAmount = subtotal + previousBal;
  const balanceDue = initialStatus === 'paid' ? 0 : totalAmount;
  const amountPaid = initialStatus === 'paid' ? totalAmount : 0;

  // Detect whether this customer already has an invoice for the selected billing month
  const existingInvoiceForMonth = useMemo(() => {
    if (!selectedCustomer) return undefined;
    return findCustomerInvoiceForMonth(
      selectedCustomer,
      `${billingYear}-${billingMonth}`,
      invoices
    );
  }, [selectedCustomer, billingYear, billingMonth, invoices]);

  // Default Due Date calculation
  const computedDueDate = useMemo(() => {
    if (customDueDate) return customDueDate;
    const cycleDay = selectedCustomer?.billingDay || 10;
    const paddedDay = String(Math.min(cycleDay, daysInSelectedMonth)).padStart(2, '0');
    return `${billingYear}-${billingMonth}-${paddedDay}`;
  }, [customDueDate, selectedCustomer, daysInSelectedMonth, billingYear, billingMonth]);

  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomerId(cust.id);
    setIsCustomerDropdownOpen(false);
    setCustomerSearchQuery('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !authoritativePlan) {
      showToast('error', 'Customer Required', 'Please search and select a customer first.');
      return;
    }

    // CRITICAL: If customer already has an invoice this month, skip & block duplicate!
    if (existingInvoiceForMonth) {
      showToast(
        'warning',
        'Duplicate Invoice Skipped',
        `${selectedCustomer.fullName} already has an invoice (${existingInvoiceForMonth.invoiceNumber} • ${existingInvoiceForMonth.status.toUpperCase()}) for ${billingYear}-${billingMonth}. Generation was skipped.`
      );
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    // Business rule: Due date cannot be earlier than issue date
    if (customDueDate && customDueDate < todayStr) {
      showToast('error', 'Invalid Due Date', 'The invoice due date cannot be set before today (issue date).');
      return;
    }

    // Business rule: Prorated days validation
    const proratedActive = isProrated || invoiceType === 'prorated';
    if (proratedActive && (proratedDays < 1 || proratedDays > daysInSelectedMonth)) {
      showToast('error', 'Invalid Prorated Days', `Prorated days must be between 1 and ${daysInSelectedMonth} for ${billingYear}-${billingMonth}.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const startDate = `${billingYear}-${billingMonth}-01`;
      const endDate = `${billingYear}-${billingMonth}-${String(daysInSelectedMonth).padStart(2, '0')}`;
      const invoiceNumber = `INV-${billingYear.slice(2)}${billingMonth}-${String(Date.now()).slice(-4)}`;

      const items: InvoiceItem[] = [];


      // Primary Plan Item
      const proratedActive = isProrated || invoiceType === 'prorated';
      items.push({
        id: generateId('ITEM'),
        description: proratedActive
          ? `Internet Plan: ${authoritativePlan.name} (${authoritativePlan.speedMbps} Mbps Pure Fiber) — Prorated Subscription (${proratedDays}/${daysInSelectedMonth} Days)`
          : `Internet Plan: ${authoritativePlan.name} (${authoritativePlan.speedMbps} Mbps Pure Fiber) — Monthly Subscription`,
        quantity: 1,
        unitPrice: proratedActive ? planCharge : authoritativePlan.monthlyFee,
        amount: planCharge,
        type: 'plan',
      });

      // Installation Fee Item (if selected)
      if (invoiceType === 'installation') {
        items.push({
          id: generateId('ITEM'),
          description: 'Standard Optical Line Drop & Gigabit ONU WiFi Modem Installation Setup',
          quantity: 1,
          unitPrice: 1500,
          amount: 1500,
          type: 'installation',
        });
      }

      // Previous Balance (if any)
      if (previousBal > 0) {
        items.push({
          id: generateId('ITEM'),
          description: 'Previous Unpaid Balance (Arrears)',
          quantity: 1,
          unitPrice: previousBal,
          amount: previousBal,
          type: 'late_fee',
        });
      }

      const newInv = createInvoice({
        invoiceNumber,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.fullName,
        accountNo: selectedCustomer.accountNo,
        customerAddress: `${selectedCustomer.address.street}, ${selectedCustomer.address.barangay}, ${selectedCustomer.address.city}, ${selectedCustomer.address.province}`,
        customerMobile: selectedCustomer.mobile,
        customerEmail: selectedCustomer.email,
        planId: authoritativePlan.id,
        planName: authoritativePlan.name,
        planSpeedMbps: authoritativePlan.speedMbps,
        monthlyFee: authoritativePlan.monthlyFee,
        billingDay: selectedCustomer.billingDay || 15,
        billingPeriodStart: startDate,
        billingPeriodEnd: endDate,
        issueDate: todayStr,
        dueDate: computedDueDate,
        items,
        subtotal,
        discount: 0,
        isProrated: proratedActive,
        proratedDays: proratedActive ? proratedDays : undefined,
        previousBalance: previousBal,
        totalAmount,
        amountPaid: canDirectPay && initialStatus === 'paid' ? totalAmount : 0,
        balanceDue: canDirectPay && initialStatus === 'paid' ? 0 : totalAmount,
        status: canDirectPay && initialStatus === 'paid' ? 'paid' : 'unpaid',
        sentViaSms: false,
        sentViaEmail: false,
        paidAt: canDirectPay && initialStatus === 'paid' ? new Date().toISOString() : undefined,
        paymentMethodUsed: canDirectPay && initialStatus === 'paid' ? 'cash' : undefined,
        allowDuplicate: true,
      });


      showToast(
        'success',
        'Manual Invoice Generated',
        `Invoice ${newInv.invoiceNumber} created for ${selectedCustomer.fullName} (${formatCurrency(totalAmount)}).`
      );

      if (onInvoiceCreated) {
        onInvoiceCreated(newInv);
      }

      onClose();
    } catch (err: any) {
      showToast('error', 'Invoice Failed', err?.message || 'Could not generate manual invoice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
        {/* Top Header Banner (Matching Image 2 blue banner) */}
        <div className="bg-blue-600 px-5 py-4 flex items-center justify-between text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-700/80 border border-blue-400/40 text-white shadow-sm">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white tracking-wide">
                Create Manual Invoice
              </h3>
              <p className="text-xs text-blue-100 font-normal">
                Select customer to generate invoice.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-700/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* 1. Search & Select Customer Fieldset */}
          <div className="relative">
            <fieldset className="border border-slate-700/90 rounded-xl px-3 pb-2.5 pt-0.5 bg-slate-950/60 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30 transition-all">
              <legend className="px-1.5 text-[11px] font-medium text-slate-400">
                Search & Select Customer
              </legend>
              <div
                onClick={() => setIsCustomerDropdownOpen(true)}
                className="w-full flex items-center justify-between cursor-pointer py-1"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  {selectedCustomer ? (
                    <div className="truncate text-slate-100 font-medium">
                      <span className="font-bold">{selectedCustomer.fullName}</span>
                      <span className="font-mono text-cyan-400 text-[11px] ml-2">
                        ({selectedCustomer.accountNo})
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400">Choose a subscriber...</span>
                  )}
                </div>
                <span className="text-slate-400 text-xs shrink-0 ml-2">▾</span>
              </div>
            </fieldset>

            {/* Dropdown Menu */}
            {isCustomerDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 flex flex-col animate-in fade-in">
                <div className="p-2 border-b border-slate-800 bg-slate-950/70">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Type name, account no, or mobile..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="overflow-y-auto divide-y divide-slate-800/60">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-3 text-center text-slate-500">No matching customers</div>
                  ) : (
                    filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className={`w-full text-left px-3 py-2 hover:bg-slate-800/80 transition-colors flex items-center justify-between cursor-pointer ${
                          c.id === selectedCustomerId ? 'bg-blue-600/10 text-blue-300' : 'text-slate-200'
                        }`}
                      >
                        <div className="truncate">
                          <p className="font-semibold text-xs text-slate-100">{c.fullName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {c.accountNo} • {c.planName}
                          </p>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-emerald-400 shrink-0 ml-2">
                          {formatCurrency(c.monthlyFee)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Selected Customer Plan Card Preview (Authoritative from Plans & Packages) */}
          {selectedCustomer && authoritativePlan && (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5 truncate">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Wifi className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <p className="font-bold text-slate-200 text-xs flex items-center gap-1.5 truncate">
                    <span>{authoritativePlan.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shrink-0">
                      {authoritativePlan.speedMbps} Mbps
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    Cycle: Day {selectedCustomer.billingDay || 15} • {selectedCustomer.address.barangay}, {selectedCustomer.address.city}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-500 block">Package Rate:</span>
                <span className="font-mono font-bold text-emerald-400 text-xs">
                  {formatCurrency(authoritativePlan.monthlyFee)}/mo
                </span>
              </div>
            </div>
          )}

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

          {/* 3. Invoice Type & Initial Invoice Status Side-by-Side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <fieldset className="border border-slate-700/90 rounded-xl px-3 pb-2 pt-0.5 bg-slate-950/60 focus-within:border-blue-500 transition-all">
                <legend className="px-1.5 text-[11px] font-medium text-slate-400">
                  Invoice Type
                </legend>
                <select
                  value={invoiceType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setInvoiceType(val);
                    if (val === 'prorated') setIsProrated(true);
                  }}
                  className="w-full bg-transparent text-slate-100 text-xs py-1 focus:outline-none cursor-pointer"
                >
                  <option value="regular" className="bg-slate-900 text-slate-100">Invoice</option>
                  <option value="installation" className="bg-slate-900 text-slate-100">Installation + 1st Month</option>
                  <option value="prorated" className="bg-slate-900 text-slate-100">Prorated Bill</option>
                  <option value="addon" className="bg-slate-900 text-slate-100">Add-on / Service</option>
                </select>
              </fieldset>
            </div>

            <div>
              <fieldset className={`border ${canDirectPay ? 'border-slate-700/90 focus-within:border-blue-500' : 'border-slate-800 bg-slate-900/40'} rounded-xl px-3 pb-2 pt-0.5 bg-slate-950/60 transition-all`}>
                <legend className="px-1.5 text-[11px] font-medium text-slate-400">
                  Initial Invoice Status
                </legend>
                <select
                  value={canDirectPay ? initialStatus : 'unpaid'}
                  disabled={!canDirectPay}
                  onChange={(e) => setInitialStatus(e.target.value as any)}
                  className={`w-full bg-transparent text-slate-100 text-xs py-1 focus:outline-none ${canDirectPay ? 'cursor-pointer' : 'cursor-not-allowed text-slate-400'}`}
                >
                  <option value="unpaid" className="bg-slate-900 text-slate-100">Unpaid (Default)</option>
                  {canDirectPay && (
                    <option value="paid" className="bg-slate-900 text-slate-100">Paid (Admin Direct Settle)</option>
                  )}
                </select>
              </fieldset>
              <p className="text-[10px] text-slate-400 mt-1 pl-1">
                {canDirectPay
                  ? 'Admins may directly mark paid if restoring historical records.'
                  : 'Cashier Guard: Payments must be collected via the Register to issue an Official Receipt and record drawer cash.'}
              </p>
            </div>
          </div>

          {/* 4. Due Date & Prorate Checkbox */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <div>
              <fieldset className="border border-slate-700/90 rounded-xl px-3 pb-1.5 pt-0.5 bg-slate-950/60 focus-within:border-blue-500 transition-all">
                <legend className="px-1.5 text-[11px] font-medium text-slate-400">
                  Due Date
                </legend>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customDueDate}
                    onChange={(e) => setCustomDueDate(e.target.value)}
                    placeholder="mm/dd/yyyy"
                    className="w-full bg-transparent text-slate-100 text-xs py-1 focus:outline-none font-mono"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0 pointer-events-none" />
                </div>
              </fieldset>
              <p className="text-[10px] text-slate-400 mt-1 pl-1">
                Leave empty for default.
              </p>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2.5 text-xs text-slate-200 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isProrated}
                  onChange={(e) => setIsProrated(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                />
                <span>Prorate</span>
              </label>

              {isProrated && (
                <div className="mt-2 pl-6 animate-in fade-in space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Days:</span>
                    <input
                      type="number"
                      min={1}
                      max={daysInSelectedMonth}
                      value={proratedDays}
                      onChange={(e) => setProratedDays(parseInt(e.target.value, 10) || 1)}
                      className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-center text-slate-100 font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-400 font-mono">
                      / {daysInSelectedMonth} days
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-400 font-mono">
                    Prorated Fee: {formatCurrency(planCharge)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notice Banner: Already Invoiced for Selected Month */}
          {existingInvoiceForMonth && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1 animate-in fade-in">
              <div className="flex items-center gap-2 font-semibold text-amber-400">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Subscriber Already Invoiced for This Month</span>
              </div>
              <p className="text-[11px] text-slate-300">
                {selectedCustomer?.fullName} already has invoice{' '}
                <strong className="text-white font-mono">{existingInvoiceForMonth.invoiceNumber}</strong> (
                {existingInvoiceForMonth.status.toUpperCase()} • {formatCurrency(existingInvoiceForMonth.totalAmount)}) for {billingYear}-{billingMonth}.
              </p>
              <p className="text-[11px] text-amber-400 font-medium">
                Generation is skipped to prevent duplicate billing and double charging.
              </p>
            </div>
          )}

          {/* Charges Summary Box */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Internet Service ({authoritativePlan?.name || 'Plan'}):</span>
              <span className="font-mono text-slate-200">{formatCurrency(planCharge)}</span>
            </div>
            {installationFee > 0 && (
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Standard Installation Fee:</span>
                <span className="font-mono text-slate-200">{formatCurrency(installationFee)}</span>
              </div>
            )}
            {previousBal > 0 && (
              <div className="flex items-center justify-between text-xs text-amber-400">
                <span>Previous Unpaid Balance:</span>
                <span className="font-mono">{formatCurrency(previousBal)}</span>
              </div>
            )}
            <div className="border-t border-slate-800 pt-1.5 flex items-center justify-between text-xs font-bold">
              <span className="text-slate-200">Total Invoice Amount:</span>
              <span className="font-mono text-cyan-400 text-sm">{formatCurrency(totalAmount)}</span>
            </div>
            {initialStatus === 'paid' && (
              <p className="text-[10px] text-emerald-400 font-semibold text-right">
                ✓ Recorded as PAID IN FULL (Balance Due: ₱0.00)
              </p>
            )}
          </div>

          {/* Footer Buttons (Cancel & Save Changes matching Image 2) */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !selectedCustomerId || Boolean(existingInvoiceForMonth)}
              title={existingInvoiceForMonth ? 'Subscriber is already invoiced for this period' : undefined}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all hover:scale-105 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : existingInvoiceForMonth
                  ? 'Already Invoiced (Skipped)'
                  : 'Save Changes'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
