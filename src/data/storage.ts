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
} from './initialData';

const STORAGE_KEYS = {
  BUSINESS_PROFILE: 'swiftstream_business_profile_v1',
  CUSTOMERS: 'swiftstream_customers_v1',
  INVOICES: 'swiftstream_invoices_v1',
  PAYMENTS: 'swiftstream_payments_v1',
  PLANS: 'swiftstream_plans_v1',
  NAP_BOXES: 'swiftstream_nap_boxes_v1',
  REPAIR_ORDERS: 'swiftstream_repair_orders_v1',
  REMINDERS: 'swiftstream_reminders_v1',
  MIKROTIK_DEVICES: 'swiftstream_mikrotik_devices_v1',
  EXPENSES: 'swiftstream_expenses_v1',
  AUDIT_LOGS: 'swiftstream_audit_logs_v1',
  FIBER_CABLES: 'swiftstream_fiber_cables_v1',
  FIBER_CLOSURES: 'swiftstream_fiber_closures_v1',
  OLT_NODE: 'swiftstream_olt_node_v1',
};

export const loadStoredData = () => {
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
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    ...currentData,
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `swiftstream_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

export const resetAllDataToDefault = () => {
  localStorage.removeItem(STORAGE_KEYS.BUSINESS_PROFILE);
  localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
  localStorage.removeItem(STORAGE_KEYS.INVOICES);
  localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
  localStorage.removeItem(STORAGE_KEYS.PLANS);
  localStorage.removeItem(STORAGE_KEYS.NAP_BOXES);
  localStorage.removeItem(STORAGE_KEYS.REPAIR_ORDERS);
  localStorage.removeItem(STORAGE_KEYS.REMINDERS);
};

