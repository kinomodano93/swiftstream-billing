import { BusinessProfile, Customer, CustomerStatus, Invoice, InvoiceStatus, PaymentMethod, Plan, RepairStatus } from '../types';
import { initialPlans } from '../data/initialData';

export const formatCurrency = (amount: number): string => {
  const num = isNaN(amount) ? 0 : amount;
  const formatted = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  return `₱${formatted}`;
};

export const formatCurrencyPdf = (amount: number): string => {
  const num = isNaN(amount) ? 0 : amount;
  const formatted = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  return `PHP ${formatted}`;
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
    case 'pending_approval':
      return { text: 'Pending Review', bg: 'bg-amber-500/10', textCol: 'text-amber-300', border: 'border-amber-500/40', dot: 'bg-amber-400 animate-pulse' };
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
    case 'open':
      return { text: 'Open Ticket', bg: 'bg-cyan-500/10 border border-cyan-500/30', textCol: 'text-cyan-400' };
    case 'received':
      return { text: 'Received', bg: 'bg-blue-500/10 border border-blue-500/30', textCol: 'text-blue-400' };
    case 'diagnosing':
      return { text: 'Diagnosing', bg: 'bg-purple-500/10 border border-purple-500/30', textCol: 'text-purple-400' };
    case 'in_progress':
      return { text: 'In Progress / Dispatched', bg: 'bg-amber-500/10 border border-amber-500/30', textCol: 'text-amber-400' };
    case 'ready':
      return { text: 'Ready / Fixed', bg: 'bg-teal-500/10 border border-teal-500/30', textCol: 'text-teal-400' };
    case 'resolved':
      return { text: 'Resolved', bg: 'bg-emerald-500/10 border border-emerald-500/30', textCol: 'text-emerald-400' };
    case 'completed':
      return { text: 'Completed / Released', bg: 'bg-emerald-500/10 border border-emerald-500/30', textCol: 'text-emerald-400' };
    case 'closed':
      return { text: 'Closed', bg: 'bg-slate-500/10 border border-slate-700/50', textCol: 'text-slate-400' };
    case 'cancelled':
      return { text: 'Cancelled', bg: 'bg-rose-500/10 border border-rose-700/30', textCol: 'text-rose-400' };
    default:
      return { text: status, bg: 'bg-slate-500/10', textCol: 'text-slate-400' };
  }
};

export const generateId = (prefix: string = 'ID'): string => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 6);
  return `${prefix}-${timestamp}-${randomStr}`.toUpperCase();
};

export interface InvoicePlanDetails {
  planId: string;
  planName: string;
  speedMbps: number;
  monthlyFee: number;
  billingDay: number;
  serviceDescription: string;
  category: string;
  planDescription: string;
}

export const resolveInvoicePlanDetails = (
  invoice: Invoice,
  customer?: Customer,
  plans?: Plan[]
): InvoicePlanDetails => {
  const allPlans = plans && plans.length > 0 ? plans : initialPlans;

  // 1. Authoritative lookup in Plans & Packages catalog:
  let matchedPlan: Plan | undefined;

  // Priority 1: Customer's assigned planId in Plans & Packages
  if (customer?.planId) {
    matchedPlan = allPlans.find((p) => p.id === customer.planId);
  }

  // Priority 2: Invoice's recorded planId
  if (!matchedPlan && invoice.planId) {
    matchedPlan = allPlans.find((p) => p.id === invoice.planId);
  }

  // Priority 3: Exact match by Customer's plan name (case-insensitive)
  if (!matchedPlan && customer?.planName) {
    const custPlanName = customer.planName.trim().toLowerCase();
    matchedPlan = allPlans.find((p) => p.name.trim().toLowerCase() === custPlanName);
  }

  // Priority 4: Exact match by Invoice's plan name (case-insensitive)
  if (!matchedPlan && invoice.planName) {
    const invPlanName = invoice.planName.trim().toLowerCase();
    matchedPlan = allPlans.find((p) => p.name.trim().toLowerCase() === invPlanName);
  }

  // Priority 5: Match by plan name appearing in invoice items description
  if (!matchedPlan && invoice.items && invoice.items.length > 0) {
    matchedPlan = allPlans.find((p) =>
      invoice.items.some((it) => it.description && it.description.toLowerCase().includes(p.name.toLowerCase()))
    );
  }

  // Priority 6: Match by speed in invoice item descriptions (e.g. "500 Mbps", "100 Mbps", "25 Mbps")
  if (!matchedPlan && invoice.items && invoice.items.length > 0) {
    for (const item of invoice.items) {
      if (!item.description) continue;
      const speedMatch = item.description.match(/(\d+)\s*(?:M|Mbps)/i);
      if (speedMatch) {
        const foundSpeed = parseInt(speedMatch[1], 10);
        matchedPlan = allPlans.find((p) => p.speedMbps === foundSpeed);
        if (matchedPlan) break;
      }
    }
  }

  // Priority 7: Match by monthly rate (customer.monthlyFee or invoice item unitPrice)
  if (!matchedPlan) {
    const planItem = invoice.items?.find((it) => it.type === 'plan');
    const targetFee = customer?.monthlyFee || invoice.monthlyFee || planItem?.unitPrice || invoice.subtotal;
    if (targetFee && targetFee > 0) {
      matchedPlan = allPlans.find((p) => p.monthlyFee === targetFee);
    }
  }

  // Priority 8: Partial substring match with plan names
  if (!matchedPlan && (customer?.planName || invoice.planName)) {
    const searchTarget = (customer?.planName || invoice.planName || '').toLowerCase();
    matchedPlan = allPlans.find((p) =>
      p.name.toLowerCase().includes(searchTarget) || searchTarget.includes(p.name.toLowerCase())
    );
  }

  // Fallback: Default to the first plan in Plans & Packages catalog (never an arbitrary hardcoded string)
  if (!matchedPlan) {
    matchedPlan = allPlans[0] || initialPlans[0];
  }

  // All plan details are sourced directly from the authoritative Plans & Packages catalog!
  const planId = matchedPlan.id;
  const planName = matchedPlan.name;
  const speedMbps = matchedPlan.speedMbps;
  const monthlyFee = matchedPlan.monthlyFee;
  const category = matchedPlan.category;
  const planDescription = matchedPlan.description || '';
  const billingDay = customer?.billingDay || invoice.billingDay || 15;

  let serviceDescription: string;
  if (invoice.isProrated && invoice.proratedDays) {
    serviceDescription = `Internet Plan: ${planName} (${speedMbps} Mbps Pure Fiber) — Prorated Subscription (${invoice.proratedDays} Days)`;
  } else {
    serviceDescription = `Internet Plan: ${planName} (${speedMbps} Mbps Pure Fiber) — Monthly Subscription`;
  }

  return {
    planId,
    planName,
    speedMbps,
    monthlyFee,
    billingDay,
    serviceDescription,
    category,
    planDescription,
  };
};

/**
 * Dynamically resolves the public subscriber portal URL.
 * Automatically avoids "localhost" / private IP addresses by prioritizing
 * the configured Dynamic DNS / custom domain from Business Profile or the live production cloud domain.
 */
export const getDynamicPortalUrl = (businessProfile?: BusinessProfile | null): string => {
  // 1. If explicit portal domain or website URL is configured in Business Profile, prioritize it
  if (businessProfile?.portalDomain && businessProfile.portalDomain.trim()) {
    let domain = businessProfile.portalDomain.trim().replace(/\/+$/, '');
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = `https://${domain}`;
    }
    return domain.includes('#portal') ? domain : `${domain}/#portal`;
  }

  if (businessProfile?.websiteUrl && businessProfile.websiteUrl.trim()) {
    let domain = businessProfile.websiteUrl.trim().replace(/\/+$/, '');
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = `https://${domain}`;
    }
    return domain.includes('#portal') ? domain : `${domain}/#portal`;
  }

  // 2. If running on a live public domain (not localhost / private dev IP)
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname.toLowerCase();
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.local');

    if (!isLocalhost && window.location.origin) {
      return `${window.location.origin}/#portal`;
    }
  }

  // 3. Dynamic cloud fallback (Firebase Hosting live app domain for this project)
  return 'https://swiftstream-portal.web.app/#portal';
};


