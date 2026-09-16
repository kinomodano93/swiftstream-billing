import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Zap,
  Globe,
  Building2,
  Users,
  FileText,
  Trash2,
  Edit3,
  CreditCard,
  Check,
  X,
  Bell,
  RefreshCw,
  Sparkles,
  Tag,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Layers,
  ShieldCheck,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  OperationalBill,
  OperationalBillCategory,
  OperationalBillStatus,
  BillFrequency,
  Invoice,
} from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

// Category metadata with styling, labels and icons
const CATEGORY_CONFIG: Record<
  OperationalBillCategory,
  { label: string; icon: React.ElementType; color: string; badgeBg: string; textCol: string; borderCol: string }
> = {
  dia_transit: {
    label: 'Internet DIA & Transit',
    icon: Globe,
    color: 'emerald',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    textCol: 'text-emerald-400',
    borderCol: 'border-emerald-500/30',
  },
  electricity: {
    label: 'Electricity & Power',
    icon: Zap,
    color: 'amber',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    textCol: 'text-amber-400',
    borderCol: 'border-amber-500/30',
  },
  rent_lease: {
    label: 'Pole & Tower Leases',
    icon: Building2,
    color: 'blue',
    badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    textCol: 'text-blue-400',
    borderCol: 'border-blue-500/30',
  },
  payroll: {
    label: 'Staff & Linemen Payroll',
    icon: Users,
    color: 'purple',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    textCol: 'text-purple-400',
    borderCol: 'border-purple-500/30',
  },
  taxes_permits: {
    label: 'NTC & Government Permits',
    icon: FileText,
    color: 'rose',
    badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    textCol: 'text-rose-400',
    borderCol: 'border-rose-500/30',
  },
  fiber_supplies: {
    label: 'Fiber & Hardware Supplies',
    icon: Package,
    color: 'orange',
    badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    textCol: 'text-orange-400',
    borderCol: 'border-orange-500/30',
  },
  maintenance: {
    label: 'Hardware & Maintenance',
    icon: RefreshCw,
    color: 'cyan',
    badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    textCol: 'text-cyan-400',
    borderCol: 'border-cyan-500/30',
  },
  software_licenses: {
    label: 'Software & Cloud Licenses',
    icon: Sparkles,
    color: 'indigo',
    badgeBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    textCol: 'text-indigo-400',
    borderCol: 'border-indigo-500/30',
  },
  other: {
    label: 'Other Payables',
    icon: Tag,
    color: 'slate',
    badgeBg: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    textCol: 'text-slate-400',
    borderCol: 'border-slate-500/30',
  },
};

const FREQUENCY_LABELS: Record<BillFrequency, string> = {
  one_time: 'One-Time',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Semi-Annually (Every 6 mos)',
  annual: 'Annually',
};

// Preset quick picks for easy operational payable addition
const QUICK_PRESETS = [
  {
    title: 'PLDT 1 Gbps DIA Backhaul',
    vendorName: 'PLDT Enterprise',
    category: 'dia_transit' as OperationalBillCategory,
    amount: 55000,
    recurrence: 'monthly' as BillFrequency,
    accountOrRefNumber: 'DIA-NAGA-0918',
    notes: 'Direct Internet Access 1 Gbps CIR link for primary OLT hub in Lagonoy',
  },
  {
    title: 'CASURECO II Server Hub Power',
    vendorName: 'CASURECO II',
    category: 'electricity' as OperationalBillCategory,
    amount: 14800,
    recurrence: 'monthly' as BillFrequency,
    accountOrRefNumber: 'CAS-8829104-B',
    notes: '24/7 Server Room AC, OLT chassis, and core routing gear',
  },
  {
    title: 'Relay Tower Ground Lease',
    vendorName: 'Mt. Isarog Relay Sites Inc.',
    category: 'rent_lease' as OperationalBillCategory,
    amount: 18000,
    recurrence: 'monthly' as BillFrequency,
    accountOrRefNumber: 'LSE-TOW-004',
    notes: 'Site rent for mountain repeater and solar battery bank',
  },
  {
    title: 'Meralco / LGU Pole Attachments',
    vendorName: 'Camarines Sur Electric Coop',
    category: 'rent_lease' as OperationalBillCategory,
    amount: 8500,
    recurrence: 'monthly' as BillFrequency,
    accountOrRefNumber: 'POLE-ATTACH-390',
    notes: 'Aerial fiber drop attachments across utility poles',
  },
  {
    title: 'Linemen Field Tech Payroll',
    vendorName: 'SwiftStream Operations Team',
    category: 'payroll' as OperationalBillCategory,
    amount: 65000,
    recurrence: 'monthly' as BillFrequency,
    accountOrRefNumber: 'PAYROLL-OPS',
    notes: 'Monthly salaries and field allowances for certified linemen and technicians',
  },
  {
    title: 'NTC VAS License Renewal',
    vendorName: 'National Telecommunications Commission (NTC R5)',
    category: 'taxes_permits' as OperationalBillCategory,
    amount: 12500,
    recurrence: 'quarterly' as BillFrequency,
    accountOrRefNumber: 'NTC-VAS-R5-2026',
    notes: 'Value-added service operating permit renewal and spectrum compliance',
  },
];

type EventSourceFilter = 'all' | 'operational' | 'subscribers';

export const OperationalBillCalendar: React.FC = () => {
  const {
    operationalBills,
    invoices,
    customers,
    addOperationalBill,
    updateOperationalBill,
    deleteOperationalBill,
    markOperationalBillPaid,
    setActiveTab,
  } = useApp();

  // Navigation & View State
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');
  const [eventSource, setEventSource] = useState<EventSourceFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<OperationalBill | null>(null);
  const [settlingBill, setSettlingBill] = useState<OperationalBill | null>(null);
  const [selectedDayDetails, setSelectedDayDetails] = useState<{
    date: string;
    bills: OperationalBill[];
    invoices: Invoice[];
  } | null>(null);

  // Bill Form State
  const [formVendor, setFormVendor] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<OperationalBillCategory>('dia_transit');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDueDate, setFormDueDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [formRecurrence, setFormRecurrence] = useState<BillFrequency>('monthly');
  const [formAccountOrRef, setFormAccountOrRef] = useState('');
  const [formReminderDays, setFormReminderDays] = useState<number>(5);
  const [formNotes, setFormNotes] = useState('');

  // Settlement Form State
  const [settleDate, setSettleDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [settleReference, setSettleReference] = useState<string>('');
  const [settleMethod, setSettleMethod] = useState<'cash' | 'gcash' | 'maya' | 'bank_transfer' | 'check'>('bank_transfer');
  const [settleCreateExpense, setSettleCreateExpense] = useState(true);
  const [settleScheduleNext, setSettleScheduleNext] = useState(true);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Check if any legacy mock bills exist in state
  const mockBills = useMemo(() => {
    return operationalBills.filter((b) => b.id.startsWith('bill-'));
  }, [operationalBills]);

  const handlePurgeMockBills = async () => {
    if (window.confirm(`Purge ${mockBills.length} legacy mock bill(s) from real-time operational state and Cloud Firestore?`)) {
      for (const bill of mockBills) {
        await deleteOperationalBill(bill.id);
      }
    }
  };

  // Real-time status calculation for an operational bill
  const getBillComputedStatus = (bill: OperationalBill): OperationalBillStatus => {
    if (bill.status === 'paid') return 'paid';
    if (bill.dueDate < todayStr) return 'overdue';
    const dueTime = new Date(bill.dueDate).getTime();
    const todayTime = new Date(todayStr).getTime();
    const daysDiff = Math.ceil((dueTime - todayTime) / (1000 * 60 * 60 * 24));
    if (daysDiff <= (bill.reminderDaysBefore ?? 5)) return 'due_soon';
    return 'pending';
  };

  // Real-time status calculation for a subscriber invoice
  const getInvoiceComputedStatus = (invoice: Invoice): 'paid' | 'overdue' | 'due_soon' | 'pending' => {
    if (invoice.status === 'paid') return 'paid';
    if (invoice.dueDate < todayStr || invoice.status === 'overdue') return 'overdue';
    const dueTime = new Date(invoice.dueDate).getTime();
    const todayTime = new Date(todayStr).getTime();
    const daysDiff = Math.ceil((dueTime - todayTime) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 3) return 'due_soon';
    return 'pending';
  };

  // Filter operational bills based on search, category, status
  const filteredBills = useMemo(() => {
    if (eventSource === 'subscribers') return [];
    return operationalBills.filter((bill) => {
      const computedStatus = getBillComputedStatus(bill);
      if (statusFilter !== 'all') {
        if (statusFilter === 'overdue' && computedStatus !== 'overdue') return false;
        if (statusFilter === 'due_soon' && computedStatus !== 'due_soon') return false;
        if (statusFilter === 'pending' && computedStatus !== 'pending') return false;
        if (statusFilter === 'paid' && computedStatus !== 'paid') return false;
      }
      if (categoryFilter !== 'all' && bill.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = bill.title.toLowerCase().includes(q);
        const matchVendor = bill.vendorName.toLowerCase().includes(q);
        const matchAcc = bill.accountOrRefNumber?.toLowerCase().includes(q);
        const matchNotes = bill.notes?.toLowerCase().includes(q);
        if (!matchTitle && !matchVendor && !matchAcc && !matchNotes) return false;
      }
      return true;
    });
  }, [operationalBills, eventSource, statusFilter, categoryFilter, searchQuery, todayStr]);

  // Filter real-time subscriber invoices
  const filteredInvoices = useMemo(() => {
    if (eventSource === 'operational') return [];
    return invoices.filter((inv) => {
      if (inv.status === 'cancelled') return false;
      const compStatus = getInvoiceComputedStatus(inv);
      if (statusFilter !== 'all') {
        if (statusFilter === 'overdue' && compStatus !== 'overdue') return false;
        if (statusFilter === 'due_soon' && compStatus !== 'due_soon') return false;
        if (statusFilter === 'pending' && compStatus !== 'pending') return false;
        if (statusFilter === 'paid' && compStatus !== 'paid') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCust = inv.customerName?.toLowerCase().includes(q);
        const matchAcc = inv.accountNo?.toLowerCase().includes(q);
        const matchInvNo = inv.invoiceNumber?.toLowerCase().includes(q);
        const matchPlan = inv.planName?.toLowerCase().includes(q);
        if (!matchCust && !matchAcc && !matchInvNo && !matchPlan) return false;
      }
      return true;
    });
  }, [invoices, eventSource, statusFilter, searchQuery, todayStr]);

  // Calendar Calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: {
      date: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      bills: OperationalBill[];
      invoices: Invoice[];
      totalInflow: number;
      totalOutflow: number;
    }[] = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const d = new Date(year, month - 1, dayNum);
      const dateStr = d.toISOString().slice(0, 10);
      const dayBills = filteredBills.filter((b) => b.dueDate === dateStr);
      const dayInvs = filteredInvoices.filter((inv) => inv.dueDate === dateStr);
      days.push({
        date: dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        bills: dayBills,
        invoices: dayInvs,
        totalInflow: dayInvs.reduce((acc, inv) => acc + (inv.balanceDue > 0 ? inv.balanceDue : inv.totalAmount), 0),
        totalOutflow: dayBills.reduce((acc, b) => acc + b.amount, 0),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayBills = filteredBills.filter((b) => b.dueDate === dateStr);
      const dayInvs = filteredInvoices.filter((inv) => inv.dueDate === dateStr);
      days.push({
        date: dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        bills: dayBills,
        invoices: dayInvs,
        totalInflow: dayInvs.reduce((acc, inv) => acc + (inv.balanceDue > 0 ? inv.balanceDue : inv.totalAmount), 0),
        totalOutflow: dayBills.reduce((acc, b) => acc + b.amount, 0),
      });
    }

    // Next month padding to fill complete grid of 35 or 42
    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = nextDate.toISOString().slice(0, 10);
      const dayBills = filteredBills.filter((b) => b.dueDate === dateStr);
      const dayInvs = filteredInvoices.filter((inv) => inv.dueDate === dateStr);
      days.push({
        date: dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        bills: dayBills,
        invoices: dayInvs,
        totalInflow: dayInvs.reduce((acc, inv) => acc + (inv.balanceDue > 0 ? inv.balanceDue : inv.totalAmount), 0),
        totalOutflow: dayBills.reduce((acc, b) => acc + b.amount, 0),
      });
    }

    return days;
  }, [year, month, filteredBills, filteredInvoices, todayStr]);

  // Financial & KPI Metrics for Current Month
  const metrics = useMemo(() => {
    const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

    // 1. Operational Payables Metrics (Outflow)
    let totalScheduledMonth = 0;
    let scheduledCount = 0;
    let totalOverduePayables = 0;
    let overduePayablesCount = 0;
    let totalDueIn7Days = 0;
    let dueIn7DaysCount = 0;
    let totalPaidMonth = 0;
    let paidMonthCount = 0;

    operationalBills.forEach((b) => {
      const computed = getBillComputedStatus(b);
      const isThisMonth = b.dueDate.startsWith(currentMonthPrefix);

      if (isThisMonth) {
        totalScheduledMonth += b.amount;
        scheduledCount++;
      }

      if (computed === 'overdue') {
        totalOverduePayables += b.amount;
        overduePayablesCount++;
      } else if (computed === 'due_soon') {
        totalDueIn7Days += b.amount;
        dueIn7DaysCount++;
      }

      if (b.status === 'paid' && (b.paidAt?.startsWith(currentMonthPrefix) || isThisMonth)) {
        totalPaidMonth += b.amount;
        paidMonthCount++;
      }
    });

    // 2. Subscriber Invoices Metrics (Inflow)
    let totalSubscriberReceivables = 0;
    let subscriberReceivablesCount = 0;
    let totalSubscriberOverdue = 0;
    let subscriberOverdueCount = 0;

    invoices.forEach((inv) => {
      if (inv.status === 'cancelled') return;
      const isThisMonth = inv.dueDate.startsWith(currentMonthPrefix);
      const balance = inv.balanceDue > 0 ? inv.balanceDue : inv.totalAmount;

      if (isThisMonth && inv.status !== 'paid') {
        totalSubscriberReceivables += balance;
        subscriberReceivablesCount++;
      }

      if (inv.status === 'overdue' || (inv.status === 'unpaid' && inv.dueDate < todayStr)) {
        totalSubscriberOverdue += balance;
        subscriberOverdueCount++;
      }
    });

    // 3. Forecasted Net Cashflow
    const netCashflow = totalSubscriberReceivables - totalScheduledMonth;

    return {
      totalScheduledMonth,
      scheduledCount,
      totalOverduePayables,
      overduePayablesCount,
      totalDueIn7Days,
      dueIn7DaysCount,
      totalPaidMonth,
      paidMonthCount,
      totalSubscriberReceivables,
      subscriberReceivablesCount,
      totalSubscriberOverdue,
      subscriberOverdueCount,
      netCashflow,
    };
  }, [operationalBills, invoices, year, month, todayStr]);

  // Urgent overdue list for banner
  const urgentBills = useMemo(() => {
    return operationalBills
      .filter((b) => {
        const computed = getBillComputedStatus(b);
        return computed === 'overdue' || computed === 'due_soon';
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [operationalBills, todayStr]);

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Open Add modal with defaults
  const handleOpenAddModal = (defaultDate?: string) => {
    setEditingBill(null);
    setFormVendor('');
    setFormTitle('');
    setFormCategory('dia_transit');
    setFormAmount('');
    setFormDueDate(defaultDate || todayStr);
    setFormRecurrence('monthly');
    setFormAccountOrRef('');
    setFormReminderDays(5);
    setFormNotes('');
    setIsAddModalOpen(true);
  };

  const handleApplyPreset = (preset: (typeof QUICK_PRESETS)[0]) => {
    setFormVendor(preset.vendorName);
    setFormTitle(preset.title);
    setFormCategory(preset.category);
    setFormAmount(preset.amount.toString());
    setFormRecurrence(preset.recurrence);
    setFormAccountOrRef(preset.accountOrRefNumber);
    setFormNotes(preset.notes);
  };

  const handleEditBill = (bill: OperationalBill) => {
    setEditingBill(bill);
    setFormVendor(bill.vendorName);
    setFormTitle(bill.title);
    setFormCategory(bill.category);
    setFormAmount(bill.amount.toString());
    setFormDueDate(bill.dueDate);
    setFormRecurrence(bill.recurrence);
    setFormAccountOrRef(bill.accountOrRefNumber || '');
    setFormReminderDays(bill.reminderDaysBefore ?? 5);
    setFormNotes(bill.notes || '');
    setIsAddModalOpen(true);
  };

  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount);
    if (!formVendor.trim() || !formTitle.trim() || isNaN(amountNum) || amountNum <= 0) {
      alert('Please provide valid vendor, title, and payable amount.');
      return;
    }

    if (editingBill) {
      await updateOperationalBill(editingBill.id, {
        vendorName: formVendor.trim(),
        title: formTitle.trim(),
        category: formCategory,
        amount: amountNum,
        dueDate: formDueDate,
        recurrence: formRecurrence,
        accountOrRefNumber: formAccountOrRef.trim() || undefined,
        reminderDaysBefore: formReminderDays,
        notes: formNotes.trim() || undefined,
      });
    } else {
      await addOperationalBill({
        vendorName: formVendor.trim(),
        title: formTitle.trim(),
        category: formCategory,
        amount: amountNum,
        dueDate: formDueDate,
        recurrence: formRecurrence,
        accountOrRefNumber: formAccountOrRef.trim() || undefined,
        reminderDaysBefore: formReminderDays,
        notes: formNotes.trim() || undefined,
      });
    }

    setIsAddModalOpen(false);
    setEditingBill(null);
  };

  const handleDeleteBill = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to remove the bill schedule for "${title}"?`)) {
      await deleteOperationalBill(id);
      if (selectedDayDetails) {
        setSelectedDayDetails({
          ...selectedDayDetails,
          bills: selectedDayDetails.bills.filter((b) => b.id !== id),
        });
      }
    }
  };

  const handleOpenSettleModal = (bill: OperationalBill) => {
    setSettlingBill(bill);
    setSettleDate(todayStr);
    setSettleReference(`PAY-${Date.now().toString(36).toUpperCase()}`);
    setSettleMethod('bank_transfer');
    setSettleCreateExpense(true);
    setSettleScheduleNext(bill.recurrence !== 'one_time');
  };

  const handleConfirmSettlement = async () => {
    if (!settlingBill) return;
    await markOperationalBillPaid(settlingBill.id, {
      paymentDate: settleDate,
      paymentReference: settleReference.trim() || undefined,
      paymentMethod: settleMethod,
      createExpenseVoucher: settleCreateExpense,
      scheduleNextCycle: settleScheduleNext,
    });
    setSettlingBill(null);
    if (selectedDayDetails) {
      setSelectedDayDetails(null);
    }
  };

  // Agenda view groups
  const agendaGroups = useMemo(() => {
    const overdueBills: OperationalBill[] = [];
    const dueTodayBills: OperationalBill[] = [];
    const dueThisWeekBills: OperationalBill[] = [];
    const upcomingMonthBills: OperationalBill[] = [];
    const paidBills: OperationalBill[] = [];

    const overdueInvoices: Invoice[] = [];
    const dueTodayInvoices: Invoice[] = [];
    const dueThisWeekInvoices: Invoice[] = [];
    const upcomingMonthInvoices: Invoice[] = [];
    const paidInvoices: Invoice[] = [];

    const todayTime = new Date(todayStr).getTime();
    const sevenDaysLaterTime = todayTime + 7 * 24 * 60 * 60 * 1000;

    // Operational bills grouping
    filteredBills.forEach((b) => {
      if (b.status === 'paid') {
        paidBills.push(b);
        return;
      }
      const dueTime = new Date(b.dueDate).getTime();
      if (b.dueDate < todayStr) {
        overdueBills.push(b);
      } else if (b.dueDate === todayStr) {
        dueTodayBills.push(b);
      } else if (dueTime <= sevenDaysLaterTime) {
        dueThisWeekBills.push(b);
      } else {
        upcomingMonthBills.push(b);
      }
    });

    // Invoices grouping
    filteredInvoices.forEach((inv) => {
      if (inv.status === 'paid') {
        paidInvoices.push(inv);
        return;
      }
      const dueTime = new Date(inv.dueDate).getTime();
      if (inv.dueDate < todayStr || inv.status === 'overdue') {
        overdueInvoices.push(inv);
      } else if (inv.dueDate === todayStr) {
        dueTodayInvoices.push(inv);
      } else if (dueTime <= sevenDaysLaterTime) {
        dueThisWeekInvoices.push(inv);
      } else {
        upcomingMonthInvoices.push(inv);
      }
    });

    return {
      overdueBills: overdueBills.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      dueTodayBills,
      dueThisWeekBills: dueThisWeekBills.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      upcomingMonthBills: upcomingMonthBills.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      paidBills: paidBills.sort((a, b) => (b.paidAt || b.dueDate).localeCompare(a.paidAt || a.dueDate)),

      overdueInvoices: overdueInvoices.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      dueTodayInvoices,
      dueThisWeekInvoices: dueThisWeekInvoices.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      upcomingMonthInvoices: upcomingMonthInvoices.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      paidInvoices: paidInvoices.sort((a, b) => (b.paidAt || b.dueDate).localeCompare(a.paidAt || a.dueDate)),
    };
  }, [filteredBills, filteredInvoices, todayStr]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-500/25">
            <CalendarDays className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Operational Bill & Due Date Calendar
              </h1>
              {/* Real-Time Firestore Sync Status Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live Firestore Sync (Real-time)</span>
              </div>
              {mockBills.length > 0 && (
                <button
                  onClick={handlePurgeMockBills}
                  className="px-2.5 py-0.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1"
                  title="Purge legacy mock operational bills"
                >
                  <Trash2 className="w-3 h-3" />
                  Purge {mockBills.length} Mock Bill{mockBills.length > 1 ? 's' : ''}
                </button>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Real-time schedule for ISP operational payables (DIA bandwidth, CASURECO power, pole leases, payroll) and subscriber invoice due dates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View Toggle */}
          <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 flex items-center gap-1">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === 'calendar'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Month Grid
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === 'agenda'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Agenda / Due List
            </button>
          </div>

          <button
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Schedule Operational Bill
          </button>
        </div>
      </div>

      {/* Urgent Payables Alert Banner */}
      {urgentBills.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/40 via-red-950/30 to-slate-900/60 border border-amber-500/40 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 animate-pulse mt-0.5">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white uppercase tracking-wider">
                  Operational Payables Alert
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30 rounded-full">
                  {urgentBills.length} Bill{urgentBills.length > 1 ? 's' : ''} Need Attention
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Critical recurring lines due soon or overdue:
                {' '}
                <strong className="text-amber-300">
                  {urgentBills.map((b) => `${b.vendorName} (${b.title} - ${formatCurrency(b.amount)})`).join(' • ')}
                </strong>
                . Settle on time to prevent DIA circuit disconnects or power interruptions.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            <button
              onClick={() => {
                setStatusFilter('overdue');
                setViewMode('agenda');
              }}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              View Overdue ({metrics.overduePayablesCount})
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards: Live Cashflow Forecast & Dues */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Operational Payables Due (Outflow) */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Operational Payables ({monthName.split(' ')[0]})
            </span>
            <div className="text-2xl font-bold text-white mt-1">
              {formatCurrency(metrics.totalScheduledMonth)}
            </div>
            <span className="text-xs text-slate-400 mt-0.5 block">
              {metrics.scheduledCount} scheduled supplier bills
            </span>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <CalendarIcon className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Subscriber Receivables (Inflow) */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 shadow-md flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
              Subscriber Receivables ({monthName.split(' ')[0]})
            </span>
            <div className="text-2xl font-bold text-emerald-300 mt-1">
              {formatCurrency(metrics.totalSubscriberReceivables)}
            </div>
            <span className="text-xs text-emerald-400/80 mt-0.5 block">
              {metrics.subscriberReceivablesCount} subscriber dues this month
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Net Cashflow Forecast */}
        <div className={`p-4 rounded-2xl border shadow-md flex items-center justify-between ${
          metrics.netCashflow >= 0 ? 'bg-slate-900/60 border-slate-800' : 'bg-rose-950/20 border-rose-500/40'
        }`}>
          <div>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
              Forecasted Net Cashflow
              {metrics.netCashflow >= 0 ? (
                <span className="text-emerald-400 font-semibold">(Surplus)</span>
              ) : (
                <span className="text-rose-400 font-semibold">(Deficit)</span>
              )}
            </span>
            <div className={`text-2xl font-bold mt-1 ${metrics.netCashflow >= 0 ? 'text-teal-300' : 'text-rose-300'}`}>
              {metrics.netCashflow >= 0 ? '+' : ''}{formatCurrency(metrics.netCashflow)}
            </div>
            <span className="text-xs text-slate-400 mt-0.5 block">
              Inflow ({formatCurrency(metrics.totalSubscriberReceivables)}) minus Outflow
            </span>
          </div>
          <div className={`p-3 rounded-xl border ${
            metrics.netCashflow >= 0
              ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            {metrics.netCashflow >= 0 ? <ArrowUpRight className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
          </div>
        </div>

        {/* Card 4: Overdue Attention */}
        <div
          className={`p-4 rounded-2xl border shadow-md flex items-center justify-between ${
            metrics.overduePayablesCount > 0 || metrics.subscriberOverdueCount > 0
              ? 'bg-rose-950/20 border-rose-500/40'
              : 'bg-slate-900/60 border-slate-800'
          }`}
        >
          <div>
            <span className="text-xs font-medium text-rose-400 uppercase tracking-wider flex items-center gap-1">
              Past Due Dues
              {(metrics.overduePayablesCount > 0 || metrics.subscriberOverdueCount > 0) && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </span>
            <div className="text-2xl font-bold text-rose-300 mt-1">
              {formatCurrency(metrics.totalOverduePayables + metrics.totalSubscriberOverdue)}
            </div>
            <span className="text-xs text-rose-400/80 mt-0.5 block font-medium">
              {metrics.overduePayablesCount} payables • {metrics.subscriberOverdueCount} subscribers overdue
            </span>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Source Filter Tabs */}
        <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 flex items-center gap-1 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setEventSource('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              eventSource === 'all'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            All Due Dates (Combined)
          </button>
          <button
            onClick={() => setEventSource('operational')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              eventSource === 'operational'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Operational Payables ({operationalBills.length})
          </button>
          <button
            onClick={() => setEventSource('subscribers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              eventSource === 'subscribers'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Subscriber Invoices ({invoices.length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search vendor, customer, ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800/80 border border-slate-700/60 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="all">All Statuses</option>
            <option value="overdue">🔴 Overdue Only</option>
            <option value="due_soon">🟠 Due Soon (&lt;= 5d)</option>
            <option value="pending">🔵 Pending / Unpaid</option>
            <option value="paid">🟢 Paid / Settled</option>
          </select>

          {/* Category Filter (Operational only) */}
          {eventSource !== 'subscribers' && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-800/80 border border-slate-700/60 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="all">All Payables Categories</option>
              <option value="dia_transit">🌐 Internet DIA & Transit</option>
              <option value="electricity">⚡ Electricity (CASURECO)</option>
              <option value="rent_lease">🏢 Pole & Tower Leases</option>
              <option value="payroll">👥 Staff & Linemen Payroll</option>
              <option value="taxes_permits">📄 NTC & Government</option>
              <option value="fiber_supplies">📦 Fiber Supplies</option>
              <option value="maintenance">🔧 Maintenance & Tools</option>
              <option value="software_licenses">✨ Software & Cloud</option>
              <option value="other">🏷️ Other Payables</option>
            </select>
          )}

          {(statusFilter !== 'all' || categoryFilter !== 'all' || searchQuery || eventSource !== 'all') && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setCategoryFilter('all');
                setSearchQuery('');
                setEventSource('all');
              }}
              className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg border border-slate-700/50"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main View: Calendar Grid or Agenda */}
      {viewMode === 'calendar' ? (
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 shadow-xl overflow-hidden backdrop-blur-md">
          {/* Calendar Header Navigation */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/80">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                {monthName}
              </h2>
              <button
                onClick={goToToday}
                className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg border border-slate-700 transition-all"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={prevMonth}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/60 transition-all"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextMonth}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/60 transition-all"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/40 text-center py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Calendar Day Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-800/80 bg-slate-950/20">
            {calendarDays.map((dayItem, idx) => {
              const hasBills = dayItem.bills.length > 0;
              const hasInvoices = dayItem.invoices.length > 0;
              const hasEvents = hasBills || hasInvoices;
              const hasOverdueBill = dayItem.bills.some((b) => getBillComputedStatus(b) === 'overdue');
              const hasOverdueInv = dayItem.invoices.some((inv) => getInvoiceComputedStatus(inv) === 'overdue');
              const hasOverdue = hasOverdueBill || hasOverdueInv;

              return (
                <div
                  key={`${dayItem.date}-${idx}`}
                  onClick={() => {
                    if (hasEvents) {
                      setSelectedDayDetails({
                        date: dayItem.date,
                        bills: dayItem.bills,
                        invoices: dayItem.invoices,
                      });
                    } else if (dayItem.isCurrentMonth) {
                      handleOpenAddModal(dayItem.date);
                    }
                  }}
                  className={`min-h-[125px] p-2 transition-all group relative cursor-pointer flex flex-col justify-between ${
                    dayItem.isCurrentMonth ? 'bg-slate-900/30 hover:bg-slate-850/60' : 'bg-slate-950/60 opacity-40'
                  } ${dayItem.isToday ? 'ring-2 ring-indigo-500/70 bg-indigo-950/20' : ''}`}
                >
                  {/* Day header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                        dayItem.isToday
                          ? 'bg-indigo-600 text-white font-bold'
                          : dayItem.isCurrentMonth
                          ? 'text-slate-300'
                          : 'text-slate-500'
                      }`}
                    >
                      {dayItem.dayNumber}
                    </span>

                    <div className="flex items-center gap-1">
                      {hasOverdue && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" title="Overdue Dues" />
                      )}
                      {/* Plus button on hover to schedule payable */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddModal(dayItem.date);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 text-slate-300 rounded transition-all"
                        title="Add operational bill for this date"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Day events badges */}
                  <div className="mt-1 space-y-1 overflow-hidden">
                    {/* Operational Bills Chips */}
                    {dayItem.bills.slice(0, 2).map((bill) => {
                      const compStatus = getBillComputedStatus(bill);
                      const catConf = CATEGORY_CONFIG[bill.category] || CATEGORY_CONFIG.other;
                      const Icon = catConf.icon;

                      let statusBadge = 'bg-slate-800 text-slate-300 border-slate-700';
                      if (compStatus === 'overdue') {
                        statusBadge = 'bg-rose-950/70 text-rose-300 border-rose-500/50 animate-pulse';
                      } else if (compStatus === 'due_soon') {
                        statusBadge = 'bg-amber-950/70 text-amber-300 border-amber-500/50';
                      } else if (compStatus === 'paid') {
                        statusBadge = 'bg-emerald-950/50 text-emerald-300 border-emerald-600/40 line-through opacity-75';
                      } else {
                        statusBadge = `${catConf.badgeBg} border`;
                      }

                      return (
                        <div
                          key={bill.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayDetails({
                              date: dayItem.date,
                              bills: dayItem.bills,
                              invoices: dayItem.invoices,
                            });
                          }}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded border truncate flex items-center justify-between gap-1 shadow-sm transition-transform hover:scale-[1.02] ${statusBadge}`}
                          title={`${bill.vendorName} - ${bill.title} (${formatCurrency(bill.amount)})`}
                        >
                          <span className="truncate flex items-center gap-1">
                            <Icon className="w-2.5 h-2.5 shrink-0" />
                            {bill.vendorName}
                          </span>
                          <span className="font-bold shrink-0">₱{(bill.amount / 1000).toFixed(0)}k</span>
                        </div>
                      );
                    })}

                    {/* Subscriber Invoices Due Chip */}
                    {dayItem.invoices.length > 0 && eventSource !== 'operational' && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDayDetails({
                            date: dayItem.date,
                            bills: dayItem.bills,
                            invoices: dayItem.invoices,
                          });
                        }}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-300 border-emerald-500/30 truncate flex items-center justify-between gap-1 shadow-sm hover:bg-emerald-500/20"
                        title={`${dayItem.invoices.length} Subscriber Invoices Due (${formatCurrency(dayItem.totalInflow)})`}
                      >
                        <span className="truncate flex items-center gap-1">
                          <Users className="w-2.5 h-2.5 shrink-0 text-emerald-400" />
                          <span>{dayItem.invoices.length} Sub Due</span>
                        </span>
                        <span className="font-bold shrink-0 text-emerald-400 font-mono">
                          ₱{(dayItem.totalInflow / 1000).toFixed(0)}k
                        </span>
                      </div>
                    )}

                    {dayItem.bills.length > 2 && (
                      <div className="text-[10px] text-slate-400 text-center font-medium hover:text-indigo-300">
                        +{dayItem.bills.length - 2} more bills
                      </div>
                    )}
                  </div>

                  {/* Daily net flow summary tag if both exist */}
                  {dayItem.totalOutflow > 0 && dayItem.totalInflow > 0 && (
                    <div className="mt-1 pt-1 border-t border-slate-800/60 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                      <span>Net:</span>
                      <span className={dayItem.totalInflow >= dayItem.totalOutflow ? 'text-teal-400' : 'text-rose-400'}>
                        {dayItem.totalInflow >= dayItem.totalOutflow ? '+' : '-'}₱{Math.abs(Math.round((dayItem.totalInflow - dayItem.totalOutflow) / 1000))}k
                      </span>
                    </div>
                  )}

                  {!hasEvents && <div className="h-4" />}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Agenda / List View */
        <div className="space-y-6">
          {/* Overdue Section */}
          {(agendaGroups.overdueBills.length > 0 || agendaGroups.overdueInvoices.length > 0) && (
            <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-300 font-bold text-base uppercase tracking-wider">
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                  Overdue Items ({agendaGroups.overdueBills.length + agendaGroups.overdueInvoices.length})
                </div>
                <div className="flex items-center gap-2">
                  {agendaGroups.overdueBills.length > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                      Bills: {formatCurrency(agendaGroups.overdueBills.reduce((acc, b) => acc + b.amount, 0))}
                    </span>
                  )}
                  {agendaGroups.overdueInvoices.length > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                      Subscribers: {formatCurrency(agendaGroups.overdueInvoices.reduce((acc, inv) => acc + (inv.balanceDue > 0 ? inv.balanceDue : inv.totalAmount), 0))}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agendaGroups.overdueBills.map((bill) => (
                  <BillAgendaCard
                    key={bill.id}
                    bill={bill}
                    computedStatus="overdue"
                    onEdit={handleEditBill}
                    onDelete={handleDeleteBill}
                    onSettle={handleOpenSettleModal}
                  />
                ))}
                {agendaGroups.overdueInvoices.map((inv) => (
                  <SubscriberInvoiceAgendaCard
                    key={inv.id}
                    invoice={inv}
                    computedStatus="overdue"
                    onViewBilling={() => setActiveTab('billing')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Due Today */}
          {(agendaGroups.dueTodayBills.length > 0 || agendaGroups.dueTodayInvoices.length > 0) && (
            <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-base uppercase tracking-wider">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Due Today ({agendaGroups.dueTodayBills.length + agendaGroups.dueTodayInvoices.length})
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agendaGroups.dueTodayBills.map((bill) => (
                  <BillAgendaCard
                    key={bill.id}
                    bill={bill}
                    computedStatus="due_soon"
                    onEdit={handleEditBill}
                    onDelete={handleDeleteBill}
                    onSettle={handleOpenSettleModal}
                  />
                ))}
                {agendaGroups.dueTodayInvoices.map((inv) => (
                  <SubscriberInvoiceAgendaCard
                    key={inv.id}
                    invoice={inv}
                    computedStatus="due_soon"
                    onViewBilling={() => setActiveTab('billing')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Due This Week */}
          {(agendaGroups.dueThisWeekBills.length > 0 || agendaGroups.dueThisWeekInvoices.length > 0) && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-base uppercase tracking-wider">
                  <CalendarDays className="w-5 h-5 text-indigo-400" />
                  Due This Week ({agendaGroups.dueThisWeekBills.length + agendaGroups.dueThisWeekInvoices.length})
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agendaGroups.dueThisWeekBills.map((bill) => (
                  <BillAgendaCard
                    key={bill.id}
                    bill={bill}
                    computedStatus={getBillComputedStatus(bill)}
                    onEdit={handleEditBill}
                    onDelete={handleDeleteBill}
                    onSettle={handleOpenSettleModal}
                  />
                ))}
                {agendaGroups.dueThisWeekInvoices.map((inv) => (
                  <SubscriberInvoiceAgendaCard
                    key={inv.id}
                    invoice={inv}
                    computedStatus={getInvoiceComputedStatus(inv)}
                    onViewBilling={() => setActiveTab('billing')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Later */}
          {(agendaGroups.upcomingMonthBills.length > 0 || agendaGroups.upcomingMonthInvoices.length > 0) && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300 font-bold text-base uppercase tracking-wider">
                  <CalendarIcon className="w-5 h-5 text-slate-400" />
                  Upcoming Later This Month ({agendaGroups.upcomingMonthBills.length + agendaGroups.upcomingMonthInvoices.length})
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agendaGroups.upcomingMonthBills.map((bill) => (
                  <BillAgendaCard
                    key={bill.id}
                    bill={bill}
                    computedStatus="pending"
                    onEdit={handleEditBill}
                    onDelete={handleDeleteBill}
                    onSettle={handleOpenSettleModal}
                  />
                ))}
                {agendaGroups.upcomingMonthInvoices.map((inv) => (
                  <SubscriberInvoiceAgendaCard
                    key={inv.id}
                    invoice={inv}
                    computedStatus="pending"
                    onViewBilling={() => setActiveTab('billing')}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Paid / Settled Bills */}
          {(agendaGroups.paidBills.length > 0 || agendaGroups.paidInvoices.length > 0) && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 opacity-90">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-base uppercase tracking-wider">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Settled / Paid ({agendaGroups.paidBills.length + agendaGroups.paidInvoices.length})
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agendaGroups.paidBills.map((bill) => (
                  <BillAgendaCard
                    key={bill.id}
                    bill={bill}
                    computedStatus="paid"
                    onEdit={handleEditBill}
                    onDelete={handleDeleteBill}
                    onSettle={handleOpenSettleModal}
                  />
                ))}
                {agendaGroups.paidInvoices.slice(0, 10).map((inv) => (
                  <SubscriberInvoiceAgendaCard
                    key={inv.id}
                    invoice={inv}
                    computedStatus="paid"
                    onViewBilling={() => setActiveTab('billing')}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredBills.length === 0 && filteredInvoices.length === 0 && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center">
              <CalendarDays className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white">No payables or due dates found</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                No upcoming bills or subscriber dues match your current filters. Click "Schedule Operational Bill" to add ISP DIA links, electricity, or pole attachment rent.
              </p>
              <button
                onClick={() => handleOpenAddModal()}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Schedule First Bill
              </button>
            </div>
          )}
        </div>
      )}

      {/* Selected Day Details Drawer / Modal */}
      {selectedDayDetails && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-indigo-400" />
                  Due Dates for {formatDate(selectedDayDetails.date)}
                </h3>
                <span className="text-xs text-slate-400">
                  {selectedDayDetails.bills.length} operational payables • {selectedDayDetails.invoices.length} subscriber invoices
                </span>
              </div>
              <button
                onClick={() => setSelectedDayDetails(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Day Financial Flow Banner */}
            <div className="grid grid-cols-3 gap-2 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 text-center">
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Scheduled Outflow</span>
                <span className="text-sm font-bold text-rose-300 font-mono">
                  ₱{selectedDayDetails.bills.reduce((acc, b) => acc + b.amount, 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Expected Inflow</span>
                <span className="text-sm font-bold text-emerald-300 font-mono">
                  ₱{selectedDayDetails.invoices.reduce((acc, inv) => acc + (inv.balanceDue > 0 ? inv.balanceDue : inv.totalAmount), 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Day Net</span>
                {(() => {
                  const outAmt = selectedDayDetails.bills.reduce((acc, b) => acc + b.amount, 0);
                  const inAmt = selectedDayDetails.invoices.reduce((acc, inv) => acc + (inv.balanceDue > 0 ? inv.balanceDue : inv.totalAmount), 0);
                  const diff = inAmt - outAmt;
                  return (
                    <span className={`text-sm font-bold font-mono ${diff >= 0 ? 'text-teal-300' : 'text-rose-400'}`}>
                      {diff >= 0 ? '+' : ''}₱{diff.toLocaleString()}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Operational Bills Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  Operational Payables ({selectedDayDetails.bills.length})
                </h4>
                <button
                  onClick={() => {
                    const targetDate = selectedDayDetails.date;
                    setSelectedDayDetails(null);
                    handleOpenAddModal(targetDate);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Payable
                </button>
              </div>

              {selectedDayDetails.bills.length > 0 ? (
                selectedDayDetails.bills.map((bill) => {
                  const computed = getBillComputedStatus(bill);
                  return (
                    <BillAgendaCard
                      key={bill.id}
                      bill={bill}
                      computedStatus={computed}
                      onEdit={(b) => {
                        setSelectedDayDetails(null);
                        handleEditBill(b);
                      }}
                      onDelete={handleDeleteBill}
                      onSettle={handleOpenSettleModal}
                    />
                  );
                })
              ) : (
                <p className="text-xs text-slate-500 italic bg-slate-950/30 p-3 rounded-xl border border-slate-800">
                  No operational payables scheduled for this day.
                </p>
              )}
            </div>

            {/* Subscriber Invoices Section */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                Subscriber Invoices Due ({selectedDayDetails.invoices.length})
              </h4>

              {selectedDayDetails.invoices.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedDayDetails.invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white flex items-center gap-2">
                            <span>{inv.customerName}</span>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                              {inv.accountNo}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {inv.planName || 'Broadband Plan'} • Due {formatDate(inv.dueDate)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-white font-mono">
                          {formatCurrency(inv.balanceDue > 0 ? inv.balanceDue : inv.totalAmount)}
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          inv.status === 'paid'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : inv.status === 'overdue'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {inv.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic bg-slate-950/30 p-3 rounded-xl border border-slate-800">
                  No subscriber invoices due on this date.
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
              <button
                onClick={() => {
                  setSelectedDayDetails(null);
                  setActiveTab('billing');
                }}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Go to Billing Invoices
              </button>
              <button
                onClick={() => setSelectedDayDetails(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Bill Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingBill ? 'Edit Scheduled Operational Payable' : 'Schedule Upcoming Operational Bill'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Directly saves to real-time Cloud Firestore. Set due dates, circuit refs, and notification alerts.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingBill(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Presets (only shown when adding) */}
            {!editingBill && (
              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 space-y-2">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Quick ISP Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 border border-slate-700 hover:border-indigo-500/40 rounded-lg transition-all"
                    >
                      {preset.title} (₱{(preset.amount / 1000).toFixed(0)}k)
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveBill} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Vendor / Supplier */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Vendor / Provider Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PLDT Enterprise, CASURECO II, Tower Lessor"
                    value={formVendor}
                    onChange={(e) => setFormVendor(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                {/* Title / Description */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Bill Title / Purpose <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1 Gbps Direct Internet Access, Core Hub Power"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as OperationalBillCategory)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="dia_transit">🌐 Internet DIA & Upstream IP Transit</option>
                    <option value="electricity">⚡ Electricity & Server Power (CASURECO)</option>
                    <option value="rent_lease">🏢 Pole Attachments & Relay Tower Rent</option>
                    <option value="payroll">👥 Linemen & Ops Staff Payroll</option>
                    <option value="taxes_permits">📄 NTC, LGU & Permits</option>
                    <option value="fiber_supplies">📦 Fiber Supplies & Hardware</option>
                    <option value="maintenance">🔧 Outside Plant Maintenance & CPE</option>
                    <option value="software_licenses">✨ Software, Billing & Cloud Subscriptions</option>
                    <option value="other">🏷️ Other Miscellaneous Payables</option>
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Payable Amount (₱ PHP) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">
                      ₱
                    </span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="55000.00"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Due Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                {/* Recurrence Frequency */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Recurrence Frequency</label>
                  <select
                    value={formRecurrence}
                    onChange={(e) => setFormRecurrence(e.target.value as BillFrequency)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value="monthly">Monthly (Most common for DIA, Power, Rent)</option>
                    <option value="one_time">One-Time Only</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="semi_annual">Semi-Annually (Every 6 months)</option>
                    <option value="annual">Annually (NTC licenses, domain)</option>
                  </select>
                </div>

                {/* Account / Circuit ID */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Account / Circuit / Billing Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Account No., Circuit ID, Meter No."
                    value={formAccountOrRef}
                    onChange={(e) => setFormAccountOrRef(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                {/* Reminder Alert Days */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Notify Days Before Due Date
                  </label>
                  <select
                    value={formReminderDays}
                    onChange={(e) => setFormReminderDays(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  >
                    <option value={3}>3 Days Before</option>
                    <option value={5}>5 Days Before (Recommended)</option>
                    <option value={7}>7 Days Before (1 Week)</option>
                    <option value={10}>10 Days Before</option>
                    <option value={14}>14 Days Before (2 Weeks)</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Operational Notes & Payment Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Pay via BDO Bank Transfer to account 00123... or contact PLDT account manager."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingBill(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {editingBill ? 'Update Bill' : 'Save Bill Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle / Mark as Paid Modal */}
      {settlingBill && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Settle Operational Payable</h3>
                  <p className="text-xs text-slate-400">
                    Record payment for {settlingBill.vendorName} ({settlingBill.title})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSettlingBill(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bill Summary Banner */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Amount Due
                </span>
                <div className="text-2xl font-bold text-emerald-400 font-mono mt-0.5">
                  {formatCurrency(settlingBill.amount)}
                </div>
                <span className="text-xs text-slate-300 mt-1 block">
                  Due date: <strong className="text-white">{formatDate(settlingBill.dueDate)}</strong>
                  {settlingBill.accountOrRefNumber ? ` • Ref: ${settlingBill.accountOrRefNumber}` : ''}
                </span>
              </div>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-semibold">
                {CATEGORY_CONFIG[settlingBill.category]?.label || 'Payable'}
              </span>
            </div>

            <div className="space-y-3">
              {/* Payment Date */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Settlement Date</label>
                <input
                  type="date"
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Payment Method</label>
                <select
                  value={settleMethod}
                  onChange={(e) => setSettleMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="bank_transfer">Bank Transfer (BDO / BPI / Metrobank)</option>
                  <option value="cash">Cash Voucher</option>
                  <option value="gcash">GCash E-Wallet</option>
                  <option value="maya">Maya</option>
                  <option value="check">Company Check</option>
                </select>
              </div>

              {/* Payment Reference Number */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Bank / Transaction Reference Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. BDO-REF-99281, GCash Ref #, Check #"
                  value={settleReference}
                  onChange={(e) => setSettleReference(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              {/* Options */}
              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settleCreateExpense}
                    onChange={(e) => setSettleCreateExpense(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-800"
                  />
                  <span>Automatically record as an Expense Voucher in SwiftStream Accounting</span>
                </label>

                {settlingBill.recurrence !== 'one_time' && (
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settleScheduleNext}
                      onChange={(e) => setSettleScheduleNext(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 bg-slate-800"
                    />
                    <span>
                      Schedule next cycle automatically ({FREQUENCY_LABELS[settlingBill.recurrence]})
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSettlingBill(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSettlement}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Confirm Payment & Settle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Agenda / List view single card component for operational payables
interface BillAgendaCardProps {
  bill: OperationalBill;
  computedStatus: OperationalBillStatus;
  onEdit: (bill: OperationalBill) => void;
  onDelete: (id: string, title: string) => void;
  onSettle: (bill: OperationalBill) => void;
}

const BillAgendaCard: React.FC<BillAgendaCardProps> = ({
  bill,
  computedStatus,
  onEdit,
  onDelete,
  onSettle,
}) => {
  const catConf = CATEGORY_CONFIG[bill.category] || CATEGORY_CONFIG.other;
  const Icon = catConf.icon;

  let statusBadgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
  let statusText = 'Pending';
  if (computedStatus === 'overdue') {
    statusBadgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    statusText = 'OVERDUE';
  } else if (computedStatus === 'due_soon') {
    statusBadgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    statusText = 'DUE SOON';
  } else if (computedStatus === 'paid') {
    statusBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    statusText = 'PAID / SETTLED';
  }

  return (
    <div
      className={`p-4 rounded-xl border backdrop-blur-sm transition-all hover:border-slate-600 flex flex-col justify-between gap-3 ${
        computedStatus === 'overdue'
          ? 'bg-rose-950/20 border-rose-500/30'
          : computedStatus === 'due_soon'
          ? 'bg-amber-950/20 border-amber-500/30'
          : computedStatus === 'paid'
          ? 'bg-slate-900/40 border-slate-800'
          : 'bg-slate-900/60 border-slate-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl border mt-0.5 ${catConf.badgeBg}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-base tracking-tight">{bill.title}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadgeColor}`}>
                {statusText}
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-0.5 font-medium flex items-center gap-1.5 flex-wrap">
              <span>{bill.vendorName}</span>
              {bill.accountOrRefNumber && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400 font-mono">{bill.accountOrRefNumber}</span>
                </>
              )}
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">{FREQUENCY_LABELS[bill.recurrence]}</span>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-white font-mono">
            {formatCurrency(bill.amount)}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1 justify-end mt-0.5">
            <CalendarIcon className="w-3 h-3 text-slate-500" />
            <span>Due {formatDate(bill.dueDate)}</span>
          </div>
        </div>
      </div>

      {bill.notes && (
        <p className="text-xs text-slate-400 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60 leading-relaxed">
          {bill.notes}
        </p>
      )}

      {bill.paidAt && (
        <div className="text-xs text-emerald-400/90 flex items-center gap-1.5 bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-600/30">
          <Check className="w-3.5 h-3.5" />
          <span>Settled on {formatDate(bill.paidAt)} {bill.paymentReference ? `(Ref: ${bill.paymentReference})` : ''}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
        <span className="text-[11px] text-slate-400">
          Notify: {bill.reminderDaysBefore ?? 5}d prior
        </span>

        <div className="flex items-center gap-2">
          {bill.status !== 'paid' && (
            <button
              onClick={() => onSettle(bill)}
              className="px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              Mark as Paid
            </button>
          )}

          <button
            onClick={() => onEdit(bill)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
            title="Edit Bill"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onDelete(bill.id, bill.title)}
            className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 rounded-lg transition-all"
            title="Delete Bill"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Agenda / List view single card component for subscriber invoices
interface SubscriberInvoiceAgendaCardProps {
  invoice: Invoice;
  computedStatus: 'paid' | 'overdue' | 'due_soon' | 'pending';
  onViewBilling: () => void;
}

const SubscriberInvoiceAgendaCard: React.FC<SubscriberInvoiceAgendaCardProps> = ({
  invoice,
  computedStatus,
  onViewBilling,
}) => {
  let statusBadgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
  let statusText = 'Pending';
  if (computedStatus === 'overdue') {
    statusBadgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    statusText = 'OVERDUE';
  } else if (computedStatus === 'due_soon') {
    statusBadgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    statusText = 'DUE SOON';
  } else if (computedStatus === 'paid') {
    statusBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    statusText = 'PAID';
  }

  const amount = invoice.balanceDue > 0 ? invoice.balanceDue : invoice.totalAmount;

  return (
    <div
      className={`p-4 rounded-xl border backdrop-blur-sm transition-all hover:border-slate-600 flex flex-col justify-between gap-3 ${
        computedStatus === 'overdue'
          ? 'bg-rose-950/20 border-rose-500/30'
          : computedStatus === 'due_soon'
          ? 'bg-amber-950/20 border-amber-500/30'
          : computedStatus === 'paid'
          ? 'bg-slate-900/40 border-slate-800'
          : 'bg-slate-900/60 border-slate-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl border mt-0.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-base tracking-tight">{invoice.customerName}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadgeColor}`}>
                {statusText}
              </span>
            </div>
            <div className="text-xs text-slate-300 mt-0.5 font-medium flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-slate-400">{invoice.accountNo}</span>
              <span className="text-slate-600">•</span>
              <span>{invoice.planName || 'Broadband Subscription'}</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 font-mono">{invoice.invoiceNumber}</span>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-emerald-400 font-mono">
            {formatCurrency(amount)}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-1 justify-end mt-0.5">
            <CalendarIcon className="w-3 h-3 text-slate-500" />
            <span>Due {formatDate(invoice.dueDate)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
        <span className="text-[11px] text-slate-400">
          Subscriber Due Collection
        </span>

        <button
          onClick={onViewBilling}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
        >
          <span>View in Billing</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
