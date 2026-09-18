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

const isMockStreetValue = (v?: string): boolean => {
  if (!v) return true;
  const s = v.trim().toLowerCase();
  return (
    s === 'unit 4' ||
    s === 'commercial arcade bldg.' ||
    s === 'commercial arcade bldg' ||
    s === 'national highway, zone 3' ||
    s === 'zone 5' ||
    s === 'poblacion' ||
    s.includes('across lagonoy municipal gymnasium')
  );
};

/**
 * Resolves the clean, official business address line for Invoices and Billing Statements.
 * Excludes arbitrary internal room/building or mock landmark strings, focusing on official jurisdiction.
 */
export const getBusinessInvoiceAddress = (
  address: BusinessProfile['address'] | undefined
): string => {
  if (!address) return '';

  const brgyRaw = address.barangay?.trim() || '';
  const brgy = brgyRaw
    ? /^brgy\.?\s*/i.test(brgyRaw) || /^barangay\s*/i.test(brgyRaw)
      ? brgyRaw
      : `Brgy. ${brgyRaw}`
    : '';

  const parts = [
    brgy,
    address.city?.trim(),
    address.province?.trim(),
  ].filter(Boolean);

  const base = parts.join(', ');
  return address.zipCode?.trim() ? `${base} ${address.zipCode.trim()}` : base;
};

/**
 * Assembles a clean, well-formatted string for a business address,
 * gracefully omitting empty or undefined parts and preventing duplicate "Brgy." prefixes.
 */
export const formatBusinessAddress = (
  address: BusinessProfile['address'] | undefined,
  options?: { includeLandmark?: boolean; multiline?: boolean }
): string => {
  if (!address) return '';

  const streetPart = [address.roomUnit, address.building, address.street, address.subdivision]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s) && !isMockStreetValue(s))
    .join(', ');

  const brgyRaw = address.barangay?.trim() || '';
  const brgy = brgyRaw
    ? /^brgy\.?\s*/i.test(brgyRaw) || /^barangay\s*/i.test(brgyRaw)
      ? brgyRaw
      : `Brgy. ${brgyRaw}`
    : '';

  const localityParts = [brgy, address.city?.trim(), address.province?.trim()]
    .filter(Boolean)
    .join(', ');

  const localityWithZip = address.zipCode?.trim()
    ? `${localityParts} ${address.zipCode.trim()}`
    : localityParts;

  const components = [streetPart, localityWithZip].filter(Boolean);

  if (options?.includeLandmark && address.landmark?.trim() && !isMockStreetValue(address.landmark)) {
    components.push(`(Landmark: ${address.landmark.trim()})`);
  }

  return options?.multiline ? components.join('\n') : components.join(', ');
};

/**
 * Returns address separated into line1 (street/building level) and line2 (barangay, city, province, zip)
 */
export const getBusinessAddressLines = (
  address: BusinessProfile['address'] | undefined
): { line1: string; line2: string } => {
  if (!address) return { line1: '', line2: '' };

  const line1 = [address.roomUnit, address.building, address.street, address.subdivision]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s) && !isMockStreetValue(s))
    .join(', ');

  const brgyRaw = address.barangay?.trim() || '';
  const brgy = brgyRaw
    ? /^brgy\.?\s*/i.test(brgyRaw) || /^barangay\s*/i.test(brgyRaw)
      ? brgyRaw
      : `Brgy. ${brgyRaw}`
    : '';

  const localityParts = [brgy, address.city?.trim(), address.province?.trim()]
    .filter(Boolean)
    .join(', ');

  const line2 = address.zipCode?.trim()
    ? `${localityParts} ${address.zipCode.trim()}`
    : localityParts;

  return { line1, line2 };
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

export const isRouterProfileName = (name?: string): boolean => {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return (
    /^plan[-_]\d+m(?:bps)?$/i.test(n) ||
    /^\d+\s*m(?:bps)?$/i.test(n) ||
    /^profile[-_]/i.test(n) ||
    n.startsWith('pppoe') ||
    n.includes('pppoe') ||
    n.includes('router profile') ||
    n.includes('default-encryption') ||
    n.includes('imported from mikrotik') ||
    n.includes('routeros profile') ||
    n === 'default'
  );
};

export const formatCommercialPlanName = (rawPlanName?: string, plan?: Plan | null): string => {
  const cleanRaw = rawPlanName ? rawPlanName.replace(/\s*\|\s*\d+\s*m(?:bps)?/i, '').trim() : '';

  // If raw plan name is valid and NOT a router profile, prefer it
  if (cleanRaw && !isRouterProfileName(cleanRaw)) {
    return cleanRaw;
  }

  // Next, if plan object has a non-router profile name, use it
  if (plan && plan.name && !isRouterProfileName(plan.name)) {
    return plan.name.replace(/\s*\|\s*\d+\s*m(?:bps)?/i, '').trim();
  }

  return cleanRaw && !isRouterProfileName(cleanRaw) ? cleanRaw : 'SwiftStream Pure Fiber';
};

export interface CustomerPlanResolution {
  plan: Plan;
  cleanName: string;
  speedMbps: number;
}

export const resolveCustomerPlan = (
  customer: Customer | null | undefined,
  plans?: Plan[]
): CustomerPlanResolution => {
  if (!customer) {
    const defaultSpeed = 50;
    const defaultName = 'SwiftStream Pure Fiber';
    const fallbackPlan: Plan = {
      id: 'default-plan',
      name: defaultName,
      speedMbps: defaultSpeed,
      monthlyFee: 1299,
      installationFee: 1500,
      category: 'residential',
      description: `${defaultName} (${defaultSpeed} Mbps)`,
      features: [`${defaultSpeed} Mbps Fiber`, 'Unlimited Bandwidth', '24/7 Support'],
      isActive: true,
      isPublic: true,
      mikrotikProfile: `plan-${defaultSpeed}m`,
    };
    return { plan: fallbackPlan, cleanName: defaultName, speedMbps: defaultSpeed };
  }

  // Always merge initialPlans with Firestore plans.
  // initialPlans is the authoritative commercial catalog — it always wins for name/mikrotikProfile matching.
  const firestorePlans = plans && plans.length > 0 ? plans : [];
  const mergedPlanMap = new Map<string, Plan>();
  for (const p of initialPlans) mergedPlanMap.set(p.id, p);
  for (const p of firestorePlans) mergedPlanMap.set(p.id, p);
  const allPlans = Array.from(mergedPlanMap.values());

  // Clean the display name — strip any legacy embedded speed suffix (e.g. "Gamer Pro | 250mbps" → "Gamer Pro")
  const rawName = (customer.planName || '').trim();
  const cleanName = rawName.replace(/\s*\|\s*\d+\s*m(?:bps)?/i, '').trim() || rawName;

  // Technical PPPoE profile speed — used ONLY to detect and reject bad matches from MikroTik-synced plans
  const pppoeProfileName = (customer.network?.pppoeProfile || '').toLowerCase();
  const pppoeSpeedMatch = pppoeProfileName.match(/(\d+)\s*(?:m|mbps)?/i);
  const technicalProfileSpeed = pppoeSpeedMatch ? parseInt(pppoeSpeedMatch[1], 10) : null;

  // Helper: reject a plan match if it looks like a MikroTik-synced plan with a rate-limit speed
  const isBadMatch = (p: Plan) =>
    isRouterProfileName(p.name) ||
    (technicalProfileSpeed !== null && p.speedMbps === technicalProfileSpeed &&
      !initialPlans.some((ip) => ip.id === p.id)); // Only reject if NOT in the authoritative initialPlans

  let matchedPlan: Plan | undefined;

  // Priority 1: planId → search initialPlans first (authoritative), then all plans
  if (customer.planId) {
    matchedPlan = initialPlans.find((p) => p.id === customer.planId && !isRouterProfileName(p.name));
    if (!matchedPlan) {
      const candidate = allPlans.find((p) => p.id === customer.planId && !isRouterProfileName(p.name));
      if (candidate && !isBadMatch(candidate)) matchedPlan = candidate;
    }
  }

  // Priority 2: exact name match — initialPlans first
  if (!matchedPlan && cleanName) {
    const lowerClean = cleanName.toLowerCase();
    matchedPlan =
      initialPlans.find((p) => p.name.trim().toLowerCase() === lowerClean && !isRouterProfileName(p.name)) ||
      allPlans.find((p) => p.name.trim().toLowerCase() === lowerClean && !isRouterProfileName(p.name) && !isBadMatch(p));
  }

  // Priority 3: partial name match — initialPlans first
  if (!matchedPlan && cleanName) {
    const lowerClean = cleanName.toLowerCase();
    matchedPlan =
      initialPlans.find(
        (p) => !isRouterProfileName(p.name) &&
          (p.name.toLowerCase().includes(lowerClean) || lowerClean.includes(p.name.toLowerCase()))
      ) ||
      allPlans.find(
        (p) => !isRouterProfileName(p.name) && !isBadMatch(p) &&
          (p.name.toLowerCase().includes(lowerClean) || lowerClean.includes(p.name.toLowerCase()))
      );
  }

  // Priority 4: mikrotikProfile match — links PPPoE profile back to commercial plan
  //   e.g. customer.network.pppoeProfile = "plan-400m" → Gamer Pro (400 Mbps) in initialPlans
  if (!matchedPlan && pppoeProfileName) {
    matchedPlan =
      initialPlans.find(
        (p) => p.mikrotikProfile && p.mikrotikProfile.trim().toLowerCase() === pppoeProfileName && !isRouterProfileName(p.name)
      ) ||
      allPlans.find(
        (p) => p.mikrotikProfile && p.mikrotikProfile.trim().toLowerCase() === pppoeProfileName && !isRouterProfileName(p.name) && !isBadMatch(p)
      );
  }

  // Priority 5: monthlyFee match
  if (!matchedPlan && customer.monthlyFee && customer.monthlyFee > 0) {
    matchedPlan =
      initialPlans.find((p) => p.monthlyFee === customer.monthlyFee && !isRouterProfileName(p.name)) ||
      allPlans.find((p) => p.monthlyFee === customer.monthlyFee && !isRouterProfileName(p.name) && !isBadMatch(p));
  }

  // Resolve speed — strict priority:
  // 1. customer.planSpeedMbps (set at save time from Internet Plans catalog — most reliable)
  // 2. matchedPlan.speedMbps (from the authoritative catalog match)
  // 3. 0 (hidden — no speed to show)
  let speedMbps: number;
  if (customer.planSpeedMbps && customer.planSpeedMbps > 0 && customer.planSpeedMbps !== technicalProfileSpeed) {
    speedMbps = customer.planSpeedMbps;
    // Prefer the catalog plan's speed if it matches what was saved — ensures consistency
    if (matchedPlan && matchedPlan.speedMbps > 0 && matchedPlan.speedMbps !== technicalProfileSpeed) {
      speedMbps = matchedPlan.speedMbps;
    }
  } else if (matchedPlan && matchedPlan.speedMbps > 0 && matchedPlan.speedMbps !== technicalProfileSpeed) {
    speedMbps = matchedPlan.speedMbps;
  } else if (customer.planSpeedMbps && customer.planSpeedMbps > 0) {
    // planSpeedMbps equals technical speed but was explicitly set by admin — trust it
    speedMbps = customer.planSpeedMbps;
  } else {
    speedMbps = 0; // Suppress — no reliable commercial speed available
  }

  const resolvedName = matchedPlan
    ? matchedPlan.name.replace(/\s*\|\s*\d+\s*m(?:bps)?/i, '').trim()
    : (cleanName || 'SwiftStream Pure Fiber');

  const effectivePlan: Plan = matchedPlan
    ? { ...matchedPlan, name: resolvedName, speedMbps }
    : {
        id: customer.planId || 'commercial-plan',
        name: resolvedName,
        speedMbps,
        monthlyFee: customer.monthlyFee || 0,
        installationFee: 0,
        category: 'residential',
        description: speedMbps > 0 ? `${resolvedName} (${speedMbps} Mbps)` : resolvedName,
        features: speedMbps > 0
          ? [`${speedMbps} Mbps Dedicated Fiber`, 'Unlimited Bandwidth', '24/7 Priority Support']
          : ['Dedicated Fiber Connection', 'Unlimited Bandwidth', '24/7 Priority Support'],
        isActive: true,
        isPublic: true,
        mikrotikProfile: customer.network?.pppoeProfile || undefined,
      };

  return { plan: effectivePlan, cleanName: resolvedName, speedMbps };
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

  const rawCustomerPlanName = customer?.planName || '';
  const cleanCustomerPlanName = rawCustomerPlanName.replace(/\s*\|\s*\d+\s*m(?:bps)?/i, '').trim();
  const rawInvoicePlanName = invoice.planName || '';
  const cleanInvoicePlanName = rawInvoicePlanName.replace(/\s*\|\s*\d+\s*m(?:bps)?/i, '').trim();

  // Extract embedded speed if present (e.g. 250 from "Gamer Pro | 250mbps")
  let embeddedSpeed: number | null = null;
  const speedMatch = (rawCustomerPlanName || rawInvoicePlanName).match(/(\d+)\s*(?:m|mbps)/i);
  if (speedMatch) {
    embeddedSpeed = parseInt(speedMatch[1], 10);
  }

  // 1. Authoritative lookup in Plans & Packages catalog:
  let matchedPlan: Plan | undefined;

  // Priority 1: Customer's assigned planId in Plans & Packages
  if (customer?.planId) {
    matchedPlan = allPlans.find((p) => p.id === customer.planId && !isRouterProfileName(p.name));
  }

  // Priority 2: Invoice's recorded planId
  if (!matchedPlan && invoice.planId) {
    matchedPlan = allPlans.find((p) => p.id === invoice.planId && !isRouterProfileName(p.name));
  }

  // Priority 3: Exact match by cleaned customer plan name
  if (!matchedPlan && cleanCustomerPlanName) {
    const custPlanName = cleanCustomerPlanName.toLowerCase();
    matchedPlan = allPlans.find((p) => p.name.trim().toLowerCase() === custPlanName && !isRouterProfileName(p.name));
  }

  // Priority 4: Exact match by cleaned invoice plan name
  if (!matchedPlan && cleanInvoicePlanName) {
    const invPlanName = cleanInvoicePlanName.toLowerCase();
    matchedPlan = allPlans.find((p) => p.name.trim().toLowerCase() === invPlanName && !isRouterProfileName(p.name));
  }

  // Priority 5: Match by embedded speed
  if (!matchedPlan && embeddedSpeed) {
    matchedPlan = allPlans.find((p) => p.speedMbps === embeddedSpeed && !isRouterProfileName(p.name));
  }

  // Priority 6: Match by plan name appearing in invoice items description
  if (!matchedPlan && invoice.items && invoice.items.length > 0) {
    matchedPlan = allPlans.find((p) =>
      !isRouterProfileName(p.name) &&
      invoice.items.some((it) => it.description && it.description.toLowerCase().includes(p.name.toLowerCase()))
    );
  }

  // Priority 7: Match by speed in invoice item descriptions (e.g. "500 Mbps", "100 Mbps", "25 Mbps")
  if (!matchedPlan && invoice.items && invoice.items.length > 0) {
    for (const item of invoice.items) {
      if (!item.description) continue;
      const spMatch = item.description.match(/(\d+)\s*(?:M|Mbps)/i);
      if (spMatch) {
        const foundSpeed = parseInt(spMatch[1], 10);
        matchedPlan = allPlans.find((p) => p.speedMbps === foundSpeed && !isRouterProfileName(p.name));
        if (matchedPlan) break;
      }
    }
  }

  // Priority 8: Match by monthly rate (customer.monthlyFee or invoice item unitPrice)
  if (!matchedPlan) {
    const planItem = invoice.items?.find((it) => it.type === 'plan');
    const targetFee = customer?.monthlyFee || invoice.monthlyFee || planItem?.unitPrice || invoice.subtotal;
    if (targetFee && targetFee > 0) {
      matchedPlan = allPlans.find((p) => p.monthlyFee === targetFee && !isRouterProfileName(p.name));
    }
  }

  // Priority 9: Partial substring match with plan names
  if (!matchedPlan && (cleanCustomerPlanName || cleanInvoicePlanName)) {
    const searchTarget = (cleanCustomerPlanName || cleanInvoicePlanName).toLowerCase();
    matchedPlan = allPlans.find((p) =>
      !isRouterProfileName(p.name) &&
      (p.name.toLowerCase().includes(searchTarget) || searchTarget.includes(p.name.toLowerCase()))
    );
  }

  const cleanFallbackName = cleanCustomerPlanName || cleanInvoicePlanName || (matchedPlan ? matchedPlan.name : 'SwiftStream Pure Fiber');
  const speedMbps = embeddedSpeed || matchedPlan?.speedMbps || 50;
  const planId = matchedPlan?.id || customer?.planId || invoice.planId || `plan-${speedMbps}m`;
  const planName = formatCommercialPlanName(cleanFallbackName, matchedPlan);
  const monthlyFee = matchedPlan?.monthlyFee || customer?.monthlyFee || invoice.monthlyFee || invoice.subtotal || 0;
  const category = matchedPlan?.category || 'residential';
  const planDescription = matchedPlan?.description || `${planName} (${speedMbps} Mbps)`;
  const billingDay = customer?.billingDay || invoice.billingDay || 15;

  let serviceDescription: string;
  if (invoice.isProrated && invoice.proratedDays) {
    serviceDescription = `Internet Plan: ${planName} — Prorated Subscription (${invoice.proratedDays} Days)`;
  } else {
    serviceDescription = `Internet Plan: ${planName} — Monthly Subscription`;
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

/**
 * Formats a day/number with its English ordinal suffix (e.g. 1 -> 1st, 2 -> 2nd, 3 -> 3rd, 4 -> 4th, 21 -> 21st)
 */
export const formatOrdinalNumber = (num: number | string): string => {
  const n = parseInt(String(num), 10) || 1;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export * from './billingRules';


