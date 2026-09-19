import {
  AuditLog,
  BusinessProfile,
  Customer,
  Expense,
  FiberCable,
  FiberClosure,
  Invoice,
  MikrotikDevice,
  NapBox,
  OltPopNode,
  Payment,
  Plan,
  ReminderLog,
  RepairOrder,
  DailyRemittanceRecord,
  AddonCatalogItem,
  PaymentSubmission,
  CoverageArea,
  StaffUser,
  OperationalBill,
} from '../types';
import {
  initialAuditLogs,
  initialBusinessProfile,
  initialCustomers,
  initialExpenses,
  initialFiberCables,
  initialFiberClosures,
  initialInvoices,
  initialMikrotikDevices,
  initialNapBoxes,
  initialOltNode,
  initialOltNodes,
  initialPayments,
  initialPlans,
  initialReminders,
  initialRepairOrders,
  initialDailyRemittances,
  initialAddonCatalog,
  initialPaymentSubmissions,
  initialCoverageAreas,
  initialStaffUsers,
} from './initialData';
import { DEFAULT_OSP_NAPS, DEFAULT_OSP_CABLES, DEFAULT_OSP_CLOSURES } from './networkGeo';
import { resolveInvoicePlanDetails, isRouterProfileName } from '../utils/formatters';

const STORAGE_KEYS = {
  BUSINESS_PROFILE: 'swiftstream_business_profile_v4',
  CUSTOMERS: 'swiftstream_customers_v4',
  INVOICES: 'swiftstream_invoices_v4',
  PAYMENTS: 'swiftstream_payments_v4',
  PLANS: 'swiftstream_plans_v4',
  NAP_BOXES: 'swiftstream_nap_boxes_v4',
  REPAIR_ORDERS: 'swiftstream_repair_orders_v4',
  REMINDERS: 'swiftstream_reminders_v4',
  MIKROTIK_DEVICES: 'swiftstream_mikrotik_devices_v4',
  EXPENSES: 'swiftstream_expenses_v4',
  AUDIT_LOGS: 'swiftstream_audit_logs_v4',
  FIBER_CABLES: 'swiftstream_fiber_cables_v4',
  FIBER_CLOSURES: 'swiftstream_fiber_closures_v4',
  OLT_NODE: 'swiftstream_olt_node_v4',
  OLT_NODES: 'swiftstream_olt_nodes_v4',
  DAILY_REMITTANCES: 'swiftstream_daily_remittances_v4',
  ADDON_CATALOG: 'swiftstream_addon_catalog_v4',
  PAYMENT_SUBMISSIONS: 'swiftstream_payment_submissions_v4',
  COVERAGE_AREAS: 'swiftstream_coverage_areas_v4',
  SYSTEM_ROLE: 'swiftstream_system_role_v4',
  STAFF_USERS: 'swiftstream_staff_users_v4',
  OPERATIONAL_BILLS: 'swiftstream_operational_bills_v4',
};

// Automatic one-time cleanup of all legacy mock data keys (v1, v2, v3, and portal queues)
const cleanupLegacyMockData = () => {
  if (typeof window !== 'undefined' && !localStorage.getItem('swiftstream_v4_clean_slate_init')) {
    // Preserve custom business profile & plan pricing if previously configured in v3
    try {
      const existingProfile = localStorage.getItem('swiftstream_business_profile_v3');
      if (existingProfile && !localStorage.getItem(STORAGE_KEYS.BUSINESS_PROFILE)) {
        localStorage.setItem(STORAGE_KEYS.BUSINESS_PROFILE, existingProfile);
      }
      const existingPlans = localStorage.getItem('swiftstream_plans_v3');
      if (existingPlans && !localStorage.getItem(STORAGE_KEYS.PLANS)) {
        localStorage.setItem(STORAGE_KEYS.PLANS, existingPlans);
      }
    } catch (_) {}

    const legacyKeys = [
      'swiftstream_customers_v1',
      'swiftstream_invoices_v1',
      'swiftstream_payments_v1',
      'swiftstream_nap_boxes_v1',
      'swiftstream_repair_orders_v1',
      'swiftstream_reminders_v1',
      'swiftstream_mikrotik_devices_v1',
      'swiftstream_expenses_v1',
      'swiftstream_audit_logs_v1',
      'swiftstream_fiber_cables_v1',
      'swiftstream_fiber_closures_v1',
      'swiftstream_daily_remittances_v1',
      'swiftstream_addon_catalog_v1',
      'swiftstream_payment_submissions_v1',
      'swiftstream_customers_v2',
      'swiftstream_invoices_v2',
      'swiftstream_payments_v2',
      'swiftstream_nap_boxes_v2',
      'swiftstream_repair_orders_v2',
      'swiftstream_reminders_v2',
      'swiftstream_mikrotik_devices_v2',
      'swiftstream_expenses_v2',
      'swiftstream_audit_logs_v2',
      'swiftstream_fiber_cables_v2',
      'swiftstream_fiber_closures_v2',
      'swiftstream_daily_remittances_v2',
      'swiftstream_addon_catalog_v2',
      'swiftstream_payment_submissions_v2',
      'swiftstream_coverage_areas_v2',
      'swiftstream_customers_v3',
      'swiftstream_invoices_v3',
      'swiftstream_payments_v3',
      'swiftstream_nap_boxes_v3',
      'swiftstream_repair_orders_v3',
      'swiftstream_reminders_v3',
      'swiftstream_mikrotik_devices_v3',
      'swiftstream_expenses_v3',
      'swiftstream_audit_logs_v3',
      'swiftstream_fiber_cables_v3',
      'swiftstream_fiber_closures_v3',
      'swiftstream_daily_remittances_v3',
      'swiftstream_addon_catalog_v3',
      'swiftstream_payment_submissions_v3',
      'swiftstream_coverage_areas_v3',
      'swiftstream_online_applications',
      'swiftstream_genieacs_devices',
      'swiftstream_ipoe_leases',
      'swiftstream_radius_users',
      'swiftstream_radius_sessions',
    ];
    legacyKeys.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('swiftstream_v4_clean_slate_init', 'true');
  }
};

export const loadStoredData = () => {
  cleanupLegacyMockData();

  try {
    const rawBusinessProfile = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.BUSINESS_PROFILE) || JSON.stringify(initialBusinessProfile)
    ) as BusinessProfile;
    const cleanedAddress = {
      ...rawBusinessProfile.address,
      roomUnit: rawBusinessProfile.address?.roomUnit === 'Unit 4' ? '' : (rawBusinessProfile.address?.roomUnit || ''),
      building: rawBusinessProfile.address?.building === 'Commercial Arcade Bldg.' ? '' : (rawBusinessProfile.address?.building || ''),
      subdivision: rawBusinessProfile.address?.subdivision === 'Poblacion' ? '' : (rawBusinessProfile.address?.subdivision || ''),
      landmark: rawBusinessProfile.address?.landmark?.includes('Across Lagonoy Municipal Gymnasium') ? '' : (rawBusinessProfile.address?.landmark || ''),
      street: (rawBusinessProfile.address?.street === 'National Highway, Zone 3' || rawBusinessProfile.address?.street === 'Zone 5') ? '' : (rawBusinessProfile.address?.street || ''),
    };

    const rawGateways = rawBusinessProfile.paymentGateways || initialBusinessProfile.paymentGateways;
    const cleanedPaymentGateways = {
      ...rawGateways,
      gcashQrImage: rawGateways?.gcashQrImage?.includes('images.unsplash.com') ? '' : (rawGateways?.gcashQrImage || ''),
      mayaQrImage: rawGateways?.mayaQrImage?.includes('images.unsplash.com') ? '' : (rawGateways?.mayaQrImage || ''),
      bankQrImage: rawGateways?.bankQrImage || '',
    };

    const businessProfile: BusinessProfile = {
      ...rawBusinessProfile,
      name: rawBusinessProfile.name?.replace(/\s*&\s*REPAIR\s*SHOP/gi, '').trim() || 'SWIFTSTREAM TELECOMMUNICATIONS',
      heroTitle: rawBusinessProfile.heroTitle !== undefined ? rawBusinessProfile.heroTitle : (initialBusinessProfile.heroTitle || 'Ultra-Fast Fiber. Zero Lag. Pure Reliability.'),
      industry: (rawBusinessProfile.industry === 'Information Technology & Telecommunications') ? '' : (rawBusinessProfile.industry || ''),
      logoUrl: rawBusinessProfile.logoUrl || '/favicon.svg',
      address: cleanedAddress,
      paymentGateways: cleanedPaymentGateways,
      apiKeys: {
        ...initialBusinessProfile.apiKeys,
        ...(rawBusinessProfile.apiKeys || {}),
        googleMapsApiKey:
          rawBusinessProfile.apiKeys?.googleMapsApiKey ||
          initialBusinessProfile.apiKeys?.googleMapsApiKey ||
          'AIzaSyALbVJUcMbVm_E_MrAcHstSMrmKHqFCH6Y',
      },
    };

    const rawPlans = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.PLANS) || JSON.stringify(initialPlans)
    ) as Plan[];

    const LEGACY_TEMPLATE_PLAN_IDS = new Set([
      'plan-flexibix-6000',
      'plan-fiber-pro-100',
      'plan-home-turbo-50',
      'plan-starter-25',
      'plan-biz-giga-200',
      'plan-piso-wifi',
      'plan-gamer-pro-250',
    ]);
    const LEGACY_TEMPLATE_PLAN_NAMES = new Set([
      'flexibix peak 6000',
      'swiftstream pro fiber 100m',
      'swiftstream home turbo 50m',
      'swiftstream starter fiber 25m',
      'swiftstream commercial gig 200m',
      'community vendo piso-wifi feed',
    ]);

    const sanitizedPlans = rawPlans
      .filter((p) => !LEGACY_TEMPLATE_PLAN_IDS.has(p.id) && !LEGACY_TEMPLATE_PLAN_NAMES.has((p.name || '').trim().toLowerCase()))
      .map((p) => {
        if (p.name?.toLowerCase().includes('gamer') && (p.speedMbps === 70 || p.speedMbps === 250)) {
          return { ...p, speedMbps: 400, mikrotikProfile: 'plan-400m' };
        }
        return p;
      });

    const activePlans = sanitizedPlans.length > 0 ? sanitizedPlans : initialPlans;
    if (sanitizedPlans.length !== rawPlans.length) {
      try {
        localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(activePlans));
      } catch (e) {
        console.warn('Could not update plans in localStorage', e);
      }
    }

    const plans: Plan[] = activePlans.map((p) => ({
      ...p,
      installationFee: 1500,
      features: (p.features || []).map((f) =>
        f.toLowerCase().includes('free installation') ? 'Standard Installation: ₱1,500' : f
      ),
    }));

    const rawCustomers = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || JSON.stringify(initialCustomers)
    ) as Customer[];
    const customers: Customer[] = rawCustomers.map((cust) => {
      const cleanedPlanName = (cust.planName || '').replace(/\s*\|\s*\d+\s*m(?:bps)?/i, '').trim() || cust.planName;
      const plan =
        plans.find((p) => p.id === cust.planId && !isRouterProfileName(p.name)) ||
        plans.find((p) => p.name?.trim().toLowerCase() === cleanedPlanName?.trim().toLowerCase() && !isRouterProfileName(p.name)) ||
        plans.find((p) => p.monthlyFee === cust.monthlyFee && !isRouterProfileName(p.name)) ||
        plans[0];
      return {
        ...cust,
        planId: plan ? plan.id : cust.planId,
        planName: plan ? plan.name : cleanedPlanName,
        planSpeedMbps: cust.planSpeedMbps ?? (plan ? plan.speedMbps : undefined), // resolve from catalog if not already set
        monthlyFee: plan ? plan.monthlyFee : cust.monthlyFee,
      };
    });

    const rawInvoices = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.INVOICES) || JSON.stringify(initialInvoices)
    ) as Invoice[];
    const invoices: Invoice[] = rawInvoices.map((inv) => {
      const cust = customers.find(
        (c) =>
          (inv.customerId && c.id?.toLowerCase() === inv.customerId?.toLowerCase()) ||
          (inv.accountNo && c.accountNo?.toLowerCase() === inv.accountNo?.toLowerCase())
      );
      const planDetails = resolveInvoicePlanDetails(inv, cust, plans);

      const items = (inv.items || []).map((it, idx) => {
        if (it.type === 'plan' || (!it.type && idx === 0)) {
          const unitPrice = it.unitPrice > 0 ? it.unitPrice : planDetails.monthlyFee;
          const amount = it.amount > 0 ? it.amount : (inv.isProrated ? unitPrice : planDetails.monthlyFee);
          return {
            ...it,
            type: 'plan' as const,
            description: planDetails.serviceDescription,
            unitPrice,
            amount,
          };
        }
        return it;
      });

      return {
        ...inv,
        planId: planDetails.planId,
        planName: planDetails.planName,
        planSpeedMbps: planDetails.speedMbps,
        monthlyFee: planDetails.monthlyFee,
        billingDay: planDetails.billingDay,
        items,
      };
    });

    const payments = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.PAYMENTS) || JSON.stringify(initialPayments)
    ) as Payment[];

    const rawNapBoxes = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.NAP_BOXES) || JSON.stringify(initialNapBoxes)
    ) as NapBox[];
    const napBoxes = rawNapBoxes && rawNapBoxes.length > 0 ? rawNapBoxes : DEFAULT_OSP_NAPS;

    const repairOrders = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.REPAIR_ORDERS) || JSON.stringify(initialRepairOrders)
    ) as RepairOrder[];

    const reminders = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.REMINDERS) || JSON.stringify(initialReminders)
    ) as ReminderLog[];

    const mikrotikDevices = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.MIKROTIK_DEVICES) || JSON.stringify(initialMikrotikDevices)
    ) as MikrotikDevice[];

    const expenses = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.EXPENSES) || JSON.stringify(initialExpenses)
    ) as Expense[];

    const auditLogs = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS) || JSON.stringify(initialAuditLogs)
    ) as AuditLog[];

    const rawFiberCables = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.FIBER_CABLES) || JSON.stringify(initialFiberCables)
    ) as FiberCable[];
    const fiberCables = rawFiberCables && rawFiberCables.length > 0 ? rawFiberCables : DEFAULT_OSP_CABLES;

    const rawFiberClosures = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.FIBER_CLOSURES) || JSON.stringify(initialFiberClosures)
    ) as FiberClosure[];
    const fiberClosures = rawFiberClosures && rawFiberClosures.length > 0 ? rawFiberClosures : DEFAULT_OSP_CLOSURES;

    const rawOltNodes = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.OLT_NODES) || '[]'
    ) as OltPopNode[];
    let oltNodes: OltPopNode[] = [];
    if (rawOltNodes && rawOltNodes.length > 0) {
      oltNodes = rawOltNodes;
    } else {
      const singleOltRaw = localStorage.getItem(STORAGE_KEYS.OLT_NODE);
      if (singleOltRaw) {
        try {
          const parsed = JSON.parse(singleOltRaw);
          if (parsed && parsed.id) {
            oltNodes = [parsed];
          }
        } catch {}
      }
      if (oltNodes.length === 0) {
        oltNodes = initialOltNodes;
      }
    }
    const oltNode = oltNodes[0] || initialOltNode;

    const dailyRemittances = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.DAILY_REMITTANCES) || JSON.stringify(initialDailyRemittances)
    ) as DailyRemittanceRecord[];

    const rawAddonCatalog = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.ADDON_CATALOG) || JSON.stringify(initialAddonCatalog)
    ) as AddonCatalogItem[];
    const addonCatalog = rawAddonCatalog && rawAddonCatalog.length > 0 ? rawAddonCatalog : initialAddonCatalog;

    const paymentSubmissions = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.PAYMENT_SUBMISSIONS) || JSON.stringify(initialPaymentSubmissions)
    ) as PaymentSubmission[];

    const coverageAreas = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.COVERAGE_AREAS) || JSON.stringify(initialCoverageAreas)
    ) as CoverageArea[];

    const rawStaffUsers = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.STAFF_USERS) || JSON.stringify(initialStaffUsers)
    ) as any[];

    const customerEmails = new Set(customers.map((c) => c.email?.toLowerCase().trim()).filter(Boolean));
    const customerAccountNos = new Set(customers.map((c) => c.accountNo?.toLowerCase().trim()).filter(Boolean));

    const cleanedStaffUsers: StaffUser[] = rawStaffUsers.filter((u: any) => {
      if (!u || !u.role) return false;
      const role = String(u.role).toLowerCase().trim();
      const isValidRole = role === 'admin' || role === 'cashier' || role === 'technician';
      if (!isValidRole) return false;
      if (u.accountNo || u.planId || u.planName) return false;
      const email = (u.email || '').toLowerCase().trim();
      if (customerAccountNos.has((u.accountNo || '').toLowerCase().trim())) return false;
      if (email === 'swiftstream.telecom@gmail.com') return true;
      if (customerEmails.has(email)) return false;
      return true;
    });

    const staffUsers = cleanedStaffUsers.length > 0 ? cleanedStaffUsers : initialStaffUsers;
    try {
      localStorage.setItem(STORAGE_KEYS.STAFF_USERS, JSON.stringify(staffUsers));
    } catch {}

    const rawStoredBills = localStorage.getItem(STORAGE_KEYS.OPERATIONAL_BILLS);
    const operationalBills = rawStoredBills
      ? (JSON.parse(rawStoredBills) as OperationalBill[]).filter((b) => !b.id.startsWith('bill-'))
      : [];

    return {
      businessProfile,
      customers,
      invoices,
      payments,
      plans,
      napBoxes,
      repairOrders,
      reminders,
      mikrotikDevices,
      expenses,
      auditLogs,
      fiberCables,
      fiberClosures,
      oltNodes,
      oltNode,
      dailyRemittances,
      addonCatalog,
      paymentSubmissions,
      coverageAreas,
      staffUsers,
      operationalBills,
    };
  } catch (error) {
    console.error('Failed to load data from localStorage, falling back to defaults:', error);
    return {
      businessProfile: initialBusinessProfile,
      customers: initialCustomers,
      invoices: initialInvoices,
      payments: initialPayments,
      plans: initialPlans,
      napBoxes: initialNapBoxes,
      repairOrders: initialRepairOrders,
      reminders: initialReminders,
      mikrotikDevices: initialMikrotikDevices,
      expenses: initialExpenses,
      auditLogs: initialAuditLogs,
      fiberCables: initialFiberCables,
      fiberClosures: initialFiberClosures,
      oltNodes: initialOltNodes,
      oltNode: initialOltNode,
      dailyRemittances: initialDailyRemittances,
      addonCatalog: initialAddonCatalog,
      paymentSubmissions: initialPaymentSubmissions,
      coverageAreas: initialCoverageAreas,
      staffUsers: initialStaffUsers,
      operationalBills: [],
    };
  }
};

export const getStoredStaffUsers = (): StaffUser[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STAFF_USERS);
    const users = raw ? (JSON.parse(raw) as any[]) : initialStaffUsers;
    const clean = users.filter((s: any) => {
      if (!s || !s.role) return false;
      const r = String(s.role).toLowerCase().trim();
      return (r === 'admin' || r === 'cashier' || r === 'technician') && !s.accountNo && !s.planId;
    });
    return clean.length > 0 ? clean : initialStaffUsers;
  } catch {
    return initialStaffUsers;
  }
};

export const setStoredStaffUsers = (users: StaffUser[]) => {
  const clean = users.filter((s: any) => {
    if (!s || !s.role) return false;
    const r = String(s.role).toLowerCase().trim();
    return (r === 'admin' || r === 'cashier' || r === 'technician') && !s.accountNo && !s.planId;
  });
  saveToStorage(STORAGE_KEYS.STAFF_USERS, clean.length > 0 ? clean : initialStaffUsers);
};

export const saveToStorage = (key: string, data: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to save key ${key} to storage:`, error);
  }
};

export { STORAGE_KEYS };

export const exportAllDataAsJson = () => {
  const currentData = loadStoredData();
  const exportPayload = {
    app: 'SwiftStream ISP & Repair Billing System',
    version: '2.0.0',
    exportDate: new Date().toISOString(),
    ...currentData,
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `swiftstream_clean_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

export const resetAllDataToDefault = () => {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem('swiftstream_v3_clean_slate_init');
  localStorage.removeItem('swiftstream_v4_clean_slate_init');
  localStorage.removeItem('swiftstream_online_applications');
  localStorage.removeItem('swiftstream_online_applications_v4');
  localStorage.removeItem('swiftstream_genieacs_devices');
  localStorage.removeItem('swiftstream_genieacs_devices_v4');
  localStorage.removeItem('swiftstream_ipoe_leases');
  localStorage.removeItem('swiftstream_radius_users');
  localStorage.removeItem('swiftstream_radius_sessions');
};
