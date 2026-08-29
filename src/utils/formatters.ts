import { CustomerStatus, InvoiceStatus, PaymentMethod, RepairStatus } from '../types';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr: string | undefined): string => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateStr;
  }
};

export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('09')) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
};

export const getCustomerStatusBadge = (status: CustomerStatus): { text: string; bg: string; textCol: string; border: string; dot: string } => {
  switch (status) {
    case 'active':
      return { text: 'Active', bg: 'bg-emerald-500/10', textCol: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' };
    case 'overdue':
      return { text: 'Overdue (Grace)', bg: 'bg-amber-500/10', textCol: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-400' };
    case 'suspended':
      return { text: 'Suspended (Cut)', bg: 'bg-rose-500/10', textCol: 'text-rose-400', border: 'border-rose-500/30', dot: 'bg-rose-400' };
    case 'disconnected':
      return { text: 'Disconnected', bg: 'bg-slate-500/10', textCol: 'text-slate-400', border: 'border-slate-500/30', dot: 'bg-slate-400' };
    case 'pending_install':
      return { text: 'Pending Install', bg: 'bg-cyan-500/10', textCol: 'text-cyan-400', border: 'border-cyan-500/30', dot: 'bg-cyan-400' };
    default:
      return { text: status, bg: 'bg-slate-500/10', textCol: 'text-slate-400', border: 'border-slate-500/30', dot: 'bg-slate-400' };
  }
};

export const getInvoiceStatusBadge = (status: InvoiceStatus): { text: string; bg: string; textCol: string; border: string } => {
  switch (status) {
    case 'paid':
      return { text: 'Paid', bg: 'bg-emerald-500/10', textCol: 'text-emerald-400', border: 'border-emerald-500/30' };
    case 'unpaid':
      return { text: 'Unpaid', bg: 'bg-amber-500/10', textCol: 'text-amber-400', border: 'border-amber-500/30' };
    case 'partially_paid':
      return { text: 'Partial', bg: 'bg-blue-500/10', textCol: 'text-blue-400', border: 'border-blue-500/30' };
    case 'overdue':
      return { text: 'Overdue', bg: 'bg-rose-500/10', textCol: 'text-rose-400', border: 'border-rose-500/30' };
    case 'cancelled':
      return { text: 'Cancelled', bg: 'bg-slate-500/10', textCol: 'text-slate-400', border: 'border-slate-500/30' };
    default:
      return { text: status, bg: 'bg-slate-500/10', textCol: 'text-slate-400', border: 'border-slate-500/30' };
  }
};

export const getPaymentMethodLabel = (method: PaymentMethod): { label: string; icon: string } => {
  switch (method) {
    case 'cash':
      return { label: 'Cash (Counter)', icon: '💵' };
    case 'gcash':
      return { label: 'GCash', icon: '📱' };
    case 'maya':
      return { label: 'Maya (PayMaya)', icon: '💳' };
    case 'bank_transfer':
      return { label: 'Bank Transfer', icon: '🏦' };
    case 'check':
      return { label: 'Bank Check', icon: '📝' };
    case 'xendit':
      return { label: 'Xendit Gateway', icon: '⚡' };
    default:
      return { label: 'Other', icon: '💰' };
  }
};

export const getRepairStatusBadge = (status: RepairStatus): { text: string; bg: string; textCol: string } => {
  switch (status) {
    case 'received':
      return { text: 'Received', bg: 'bg-blue-500/10', textCol: 'text-blue-400' };
    case 'diagnosing':
      return { text: 'Diagnosing', bg: 'bg-purple-500/10', textCol: 'text-purple-400' };
    case 'in_progress':
      return { text: 'In Progress', bg: 'bg-amber-500/10', textCol: 'text-amber-400' };
    case 'ready':
      return { text: 'Ready / Fixed', bg: 'bg-cyan-500/10', textCol: 'text-cyan-400' };
    case 'completed':
      return { text: 'Completed / Released', bg: 'bg-emerald-500/10', textCol: 'text-emerald-400' };
    case 'cancelled':
      return { text: 'Cancelled', bg: 'bg-slate-500/10', textCol: 'text-slate-400' };
  }
};

export const generateId = (prefix: string = 'ID'): string => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 6);
  return `${prefix}-${timestamp}-${randomStr}`.toUpperCase();
};

