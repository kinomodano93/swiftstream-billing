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
  initialPayments,
  initialPlans,
  initialReminders,
  initialRepairOrders,
  initialDailyRemittances,
  initialAddonCatalog,
  initialPaymentSubmissions,
  initialCoverageAreas,
} from './initialData';

const STORAGE_KEYS = {
  BUSINESS_PROFILE: 'swiftstream_business_profile_v3',
  CUSTOMERS: 'swiftstream_customers_v3',
  INVOICES: 'swiftstream_invoices_v3',
  PAYMENTS: 'swiftstream_payments_v3',
  PLANS: 'swiftstream_plans_v3',
  NAP_BOXES: 'swiftstream_nap_boxes_v3',
  REPAIR_ORDERS: 'swiftstream_repair_orders_v3',
  REMINDERS: 'swiftstream_reminders_v3',
  MIKROTIK_DEVICES: 'swiftstream_mikrotik_devices_v3',
  EXPENSES: 'swiftstream_expenses_v3',
  AUDIT_LOGS: 'swiftstream_audit_logs_v3',
  FIBER_CABLES: 'swiftstream_fiber_cables_v3',
  FIBER_CLOSURES: 'swiftstream_fiber_closures_v3',
  OLT_NODE: 'swiftstream_olt_node_v3',
  DAILY_REMITTANCES: 'swiftstream_daily_remittances_v3',
  ADDON_CATALOG: 'swiftstream_addon_catalog_v3',
  PAYMENT_SUBMISSIONS: 'swiftstream_payment_submissions_v3',
  COVERAGE_AREAS: 'swiftstream_coverage_areas_v3',
};

// Automatic one-time cleanup of all legacy mock data keys (v1 and v2)
const cleanupLegacyMockData = () => {
  if (typeof window !== 'undefined' && !localStorage.getItem('swiftstream_v3_clean_slate_init')) {
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
    ];
    legacyKeys.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('swiftstream_v3_clean_slate_init', 'true');
  }
};

export const loadStoredData = () => {
  cleanupLegacyMockData();

  try {
    const businessProfile = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.BUSINESS_PROFILE) || JSON.stringify(initialBusinessProfile)
    ) as BusinessProfile;

    const customers = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.CUSTOMERS) || JSON.stringify(initialCustomers)
    ) as Customer[];

    const invoices = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.INVOICES) || JSON.stringify(initialInvoices)
    ) as Invoice[];

    const payments = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.PAYMENTS) || JSON.stringify(initialPayments)
    ) as Payment[];

    const plans = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.PLANS) || JSON.stringify(initialPlans)
    ) as Plan[];

    const napBoxes = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.NAP_BOXES) || JSON.stringify(initialNapBoxes)
    ) as NapBox[];

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

    const fiberCables = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.FIBER_CABLES) || JSON.stringify(initialFiberCables)
    ) as FiberCable[];

    const fiberClosures = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.FIBER_CLOSURES) || JSON.stringify(initialFiberClosures)
    ) as FiberClosure[];

    const oltNode = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.OLT_NODE) || JSON.stringify(initialOltNode)
    ) as OltPopNode;

    const dailyRemittances = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.DAILY_REMITTANCES) || JSON.stringify(initialDailyRemittances)
    ) as DailyRemittanceRecord[];

    const addonCatalog = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.ADDON_CATALOG) || JSON.stringify(initialAddonCatalog)
    ) as AddonCatalogItem[];

    const paymentSubmissions = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.PAYMENT_SUBMISSIONS) || JSON.stringify(initialPaymentSubmissions)
    ) as PaymentSubmission[];

    const coverageAreas = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.COVERAGE_AREAS) || JSON.stringify(initialCoverageAreas)
    ) as CoverageArea[];

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
      oltNode,
      dailyRemittances,
      addonCatalog,
      paymentSubmissions,
      coverageAreas,
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
      oltNode: initialOltNode,
      dailyRemittances: initialDailyRemittances,
      addonCatalog: initialAddonCatalog,
      paymentSubmissions: initialPaymentSubmissions,
      coverageAreas: initialCoverageAreas,
    };
  }
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
};
