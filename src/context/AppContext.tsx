import React, { createContext, useContext, useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  AuditLog,
  AuditLogCategory,
  AuditLogSeverity,
  BusinessProfile,
  Customer,
  CustomerStatus,
  DailyRemittanceRecord,
  AddonCatalogItem,
  Expense,
  FiberCable,
  FiberClosure,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  MikrotikDevice,
  NapBox,
  OltPopNode,
  Payment,
  PaymentMethod,
  PaymentSubmission,
  Plan,
  ReminderLog,
  ReminderType,
  RepairOrder,
} from '../types';
import {
  exportAllDataAsJson,
  loadStoredData,
  resetAllDataToDefault,
  saveToStorage,
  STORAGE_KEYS,
} from '../data/storage';
import { generateId } from '../utils/formatters';
import { generateReminderMessage, sendMockNotification } from '../utils/smsSender';
import { generateHtmlInvoiceEmail, sendSmtpEmail } from '../utils/smtpService';
import { sendTelegramStaffAlert, sendDiscordStaffAlert } from '../utils/webhookService';
import {
  COLLECTIONS,
  subscribeToCollection,
  saveFirestoreDoc,
  deleteFirestoreDoc,
} from '../services/firestoreService';
import { AppUserProfile, subscribeToAuth, signOutUser } from '../services/authService';

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

interface AppContextType {
  // Auth state & actions
  currentAuthUser: AppUserProfile | null;
  setCurrentAuthUser: (user: AppUserProfile | null) => void;
  isAuthModalOpen: boolean;
  authModalMode: 'signin' | 'signup' | 'forgot';
  openAuthModal: (mode?: 'signin' | 'signup' | 'forgot') => void;
  closeAuthModal: () => void;

  // State
  businessProfile: BusinessProfile;
  customers: Customer[];
  invoices: Invoice[];
  payments: Payment[];
  plans: Plan[];
  napBoxes: NapBox[];
  fiberCables: FiberCable[];
  fiberClosures: FiberClosure[];
  oltNode: OltPopNode;
  repairOrders: RepairOrder[];
  reminders: ReminderLog[];
  mikrotikDevices: MikrotikDevice[];
  expenses: Expense[];
  auditLogs: AuditLog[];
  dailyRemittances: DailyRemittanceRecord[];
  addonCatalog: AddonCatalogItem[];
  activeTab: string;
  searchTerm: string;
  notifications: ToastNotification[];

  // Navigation & Search
  setActiveTab: (tab: string) => void;
  setSearchTerm: (term: string) => void;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message: string) => void;
  removeToast: (id: string) => void;
  logout: () => void;

  // Customer Actions
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => Customer;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  toggleCustomerStatus: (id: string, newStatus: CustomerStatus) => void;
  addCustomerWalletCredit: (customerId: string, amount: number, notes?: string) => void;
  syncCustomerMikrotik: (id: string) => void;
  syncAllSubscribersToMikrotik: () => void;
  provisionSubscriber: (
    customerId: string,
    options: {
      technician: string;
      opticalPowerDbm: number;
      dropCableMeters: number;
      onuSerial: string;
      routerModel: string;
      surveyNotes?: string;
      createInitialInvoice?: boolean;
    }
  ) => void;

  // Billing Actions
  createInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt'>) => Invoice;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  generateBatchInvoices: (options: {
    billingMonth: string;
    dueDate: string;
    billingCycleDay?: number;
    applyWalletCredits?: boolean;
    enableProration?: boolean;
  }) => { count: number; totalAmount: number };
  applyInvoiceDiscount: (invoiceId: string, discountAmount: number) => void;
  runDailyGraceAudit: () => { isolatedCount: number; reactivatedCount: number; graceCount: number };

  // Daily Remittance & Cashier Actions
  addDailyRemittance: (remittance: Omit<DailyRemittanceRecord, 'id'>) => DailyRemittanceRecord;
  closeDailyRemittance: (id: string, actualCashInDrawer: number, verifiedBy?: string, notes?: string) => void;

  // Payment Actions
  recordPayment: (paymentData: {
    customerId: string;
    invoiceId?: string;
    amount: number;
    paymentMethod: PaymentMethod;
    referenceNumber?: string;
    cashierName?: string;
    notes?: string;
    isAdvancePayment?: boolean;
  }) => Payment;
  deletePayment: (id: string) => void;

  // Proof-of-Payment Submissions
  paymentSubmissions: PaymentSubmission[];
  submitPaymentProof: (submission: {
    customerId: string;
    invoiceId?: string;
    amount: number;
    paymentMethod: PaymentMethod;
    referenceNumber: string;
    receiptImageUrl?: string;
    notes?: string;
  }) => PaymentSubmission;
  approvePaymentSubmission: (id: string, reviewedBy?: string) => Payment | null;
  rejectPaymentSubmission: (id: string, reason: string, reviewedBy?: string) => void;

  // Plan Actions
  addPlan: (plan: Omit<Plan, 'id'>) => void;
  updatePlan: (id: string, updates: Partial<Plan>) => void;
  deletePlan: (id: string) => void;

  // NAP Box Actions
  addNapBox: (napBox: Omit<NapBox, 'id'>) => void;
  updateNapBox: (id: string, updates: Partial<NapBox>) => void;
  deleteNapBox: (id: string) => void;

  // Fiber GIS & OSP Outside Plant Actions
  addFiberCable: (cable: Omit<FiberCable, 'id'>) => FiberCable;
  updateFiberCable: (id: string, updates: Partial<FiberCable>) => void;
  deleteFiberCable: (id: string) => void;
  addFiberClosure: (closure: Omit<FiberClosure, 'id'>) => FiberClosure;
  updateFiberClosure: (id: string, updates: Partial<FiberClosure>) => void;
  deleteFiberClosure: (id: string) => void;
  updateOltNode: (updates: Partial<OltPopNode>) => void;

  // MikroTik Device Actions
  addMikrotikDevice: (device: Omit<MikrotikDevice, 'id'>) => MikrotikDevice;
  updateMikrotikDevice: (id: string, updates: Partial<MikrotikDevice>) => void;
  deleteMikrotikDevice: (id: string) => void;

  // Repair Order Actions
  addRepairOrder: (order: Omit<RepairOrder, 'id' | 'createdAt'>) => RepairOrder;
  updateRepairOrder: (id: string, updates: Partial<RepairOrder>) => void;
  deleteRepairOrder: (id: string) => void;
  convertRepairToInvoice: (repairId: string) => Invoice;

  // Reminders Actions
  sendReminder: (customerId: string, type: ReminderType, channel: 'sms' | 'email' | 'both', invoiceId?: string) => Promise<void>;
  sendBatchReminders: (target: 'overdue' | 'upcoming', channel: 'sms' | 'email' | 'both') => Promise<number>;

  // Expense Actions
  addExpense: (expense: Omit<Expense, 'id'>) => Expense;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  // Security Audit Actions
  logAuditEvent: (event: Omit<AuditLog, 'id' | 'timestamp'>) => void;
  clearAuditLogs: () => void;

  // Business Profile & System
  updateBusinessProfile: (updates: Partial<BusinessProfile>) => void;
  exportData: () => void;
  importData: (jsonData: any) => boolean;
  resetToDefault: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = loadStoredData();

  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(initial.businessProfile);
  const [customers, setCustomers] = useState<Customer[]>(initial.customers);
  const [invoices, setInvoices] = useState<Invoice[]>(initial.invoices);
  const [payments, setPayments] = useState<Payment[]>(initial.payments);
  const [plans, setPlans] = useState<Plan[]>(initial.plans);
  const [napBoxes, setNapBoxes] = useState<NapBox[]>(initial.napBoxes);
  const [fiberCables, setFiberCables] = useState<FiberCable[]>(initial.fiberCables);
  const [fiberClosures, setFiberClosures] = useState<FiberClosure[]>(initial.fiberClosures);
  const [oltNode, setOltNode] = useState<OltPopNode>(initial.oltNode);
  const [repairOrders, setRepairOrders] = useState<RepairOrder[]>(initial.repairOrders);
  const [reminders, setReminders] = useState<ReminderLog[]>(initial.reminders);
  const [mikrotikDevices, setMikrotikDevices] = useState<MikrotikDevice[]>(initial.mikrotikDevices);
  const [expenses, setExpenses] = useState<Expense[]>(initial.expenses);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initial.auditLogs);
  const [dailyRemittances, setDailyRemittances] = useState<DailyRemittanceRecord[]>(initial.dailyRemittances);
  const [addonCatalog, setAddonCatalog] = useState<AddonCatalogItem[]>(initial.addonCatalog);
  const [paymentSubmissions, setPaymentSubmissions] = useState<PaymentSubmission[]>(initial.paymentSubmissions || []);

  const [activeTab, setActiveTab] = useState<string>('home');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  // Firebase Authentication State
  const [currentAuthUser, setCurrentAuthUser] = useState<AppUserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | 'forgot'>('signin');

  const openAuthModal = (mode: 'signin' | 'signup' | 'forgot' = 'signin') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  // Subscribe to Firebase Auth changes
  useEffect(() => {
    const unsubAuth = subscribeToAuth((profile) => {
      setCurrentAuthUser(profile);
    });
    return () => unsubAuth();
  }, []);

  const logout = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    setCurrentAuthUser(null);
    setActiveTab('home');
    setSearchTerm('');
    showToast('info', 'Signed Out', 'You have been signed out of SwiftStream.');
  };

  // Sync state changes to storage
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.BUSINESS_PROFILE, businessProfile);
  }, [businessProfile]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CUSTOMERS, customers);
  }, [customers]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.INVOICES, invoices);
  }, [invoices]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PAYMENTS, payments);
  }, [payments]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PLANS, plans);
  }, [plans]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.NAP_BOXES, napBoxes);
  }, [napBoxes]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.REPAIR_ORDERS, repairOrders);
  }, [repairOrders]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.REMINDERS, reminders);
  }, [reminders]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MIKROTIK_DEVICES, mikrotikDevices);
  }, [mikrotikDevices]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.EXPENSES, expenses);
  }, [expenses]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.AUDIT_LOGS, auditLogs);
  }, [auditLogs]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.FIBER_CABLES, fiberCables);
  }, [fiberCables]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.FIBER_CLOSURES, fiberClosures);
  }, [fiberClosures]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.OLT_NODE, oltNode);
  }, [oltNode]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.DAILY_REMITTANCES, dailyRemittances);
  }, [dailyRemittances]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ADDON_CATALOG, addonCatalog);
  }, [addonCatalog]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.PAYMENT_SUBMISSIONS, paymentSubmissions);
  }, [paymentSubmissions]);

  // --- Real-time Cloud Firestore Subscriptions ---
  useEffect(() => {
    const unsubCustomers = subscribeToCollection<Customer>(COLLECTIONS.CUSTOMERS, (data) => {
      if (data && data.length > 0) setCustomers(data);
    });
    const unsubInvoices = subscribeToCollection<Invoice>(COLLECTIONS.INVOICES, (data) => {
      if (data && data.length > 0) setInvoices(data);
    });
    const unsubPayments = subscribeToCollection<Payment>(COLLECTIONS.PAYMENTS, (data) => {
      if (data && data.length > 0) setPayments(data);
    });
    const unsubSubmissions = subscribeToCollection<PaymentSubmission>(COLLECTIONS.PAYMENT_SUBMISSIONS, (data) => {
      if (data && data.length > 0) setPaymentSubmissions(data);
    });
    const unsubPlans = subscribeToCollection<Plan>(COLLECTIONS.PLANS, (data) => {
      if (data && data.length > 0) setPlans(data);
    });
    const unsubRepairOrders = subscribeToCollection<RepairOrder>(COLLECTIONS.REPAIR_ORDERS, (data) => {
      if (data && data.length > 0) setRepairOrders(data);
    });
    const unsubNapBoxes = subscribeToCollection<NapBox>(COLLECTIONS.NAP_BOXES, (data) => {
      if (data && data.length > 0) setNapBoxes(data);
    });
    const unsubFiberCables = subscribeToCollection<FiberCable>(COLLECTIONS.FIBER_CABLES, (data) => {
      if (data && data.length > 0) setFiberCables(data);
    });
    const unsubFiberClosures = subscribeToCollection<FiberClosure>(COLLECTIONS.FIBER_CLOSURES, (data) => {
      if (data && data.length > 0) setFiberClosures(data);
    });
    const unsubMikrotik = subscribeToCollection<MikrotikDevice>(COLLECTIONS.MIKROTIK_DEVICES, (data) => {
      if (data && data.length > 0) setMikrotikDevices(data);
    });
    const unsubExpenses = subscribeToCollection<Expense>(COLLECTIONS.EXPENSES, (data) => {
      if (data && data.length > 0) setExpenses(data);
    });

    return () => {
      unsubCustomers();
      unsubInvoices();
      unsubPayments();
      unsubSubmissions();
      unsubPlans();
      unsubRepairOrders();
      unsubNapBoxes();
      unsubFiberCables();
      unsubFiberClosures();
      unsubMikrotik();
      unsubExpenses();
    };
  }, []);

  const logAuditEvent = (event: Omit<AuditLog, 'id' | 'timestamp'>) => {
    const newLog: AuditLog = {
      ...event,
      id: generateId('AUD'),
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    setAuditLogs((prev) => [newLog, ...prev.slice(0, 200)]); // Keep last 200 entries
  };

  const clearAuditLogs = () => {
    setAuditLogs([]);
    showToast('info', 'Audit Logs Cleared', 'Security audit ledger has been reset.');
  };

  const showToast = (type: 'success' | 'error' | 'info' | 'warning', title: string, message: string) => {
    const id = generateId('NOTIF');
    setNotifications((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // --- Customer Operations ---
  const addCustomer = (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Customer => {
    const newCustomer: Customer = {
      ...customerData,
      id: generateId('CUST'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCustomers((prev) => [newCustomer, ...prev]);
    saveFirestoreDoc(COLLECTIONS.CUSTOMERS, newCustomer);

    // If assigned to a NAP box, update the port status
    if (newCustomer.network.napBoxId && newCustomer.network.napPortNumber) {
      setNapBoxes((prev) =>
        prev.map((box) => {
          if (box.id === newCustomer.network.napBoxId) {
            const updatedPorts = box.ports.map((port) => {
              if (port.portNumber === newCustomer.network.napPortNumber) {
                return {
                  ...port,
                  status: 'occupied' as const,
                  customerId: newCustomer.id,
                  customerName: newCustomer.fullName,
                  accountNo: newCustomer.accountNo,
                };
              }
              return port;
            });
            const updatedBox = { ...box, ports: updatedPorts };
            saveFirestoreDoc(COLLECTIONS.NAP_BOXES, updatedBox);
            return updatedBox;
          }
          return box;
        })
      );
    }

    showToast('success', 'Customer Registered', `${newCustomer.fullName} (${newCustomer.accountNo}) has been added.`);
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'CUSTOMER_CREATED',
      category: 'customer',
      severity: 'info',
      details: `Registered new subscriber ${newCustomer.fullName} (${newCustomer.accountNo}) on Plan ${newCustomer.planName}.`,
      status: 'success',
    });
    return newCustomer;
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updated = { ...c, ...updates, updatedAt: new Date().toISOString() };
          saveFirestoreDoc(COLLECTIONS.CUSTOMERS, updated);
          return updated;
        }
        return c;
      })
    );
    showToast('info', 'Customer Updated', 'Subscriber profile details have been saved.');
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'CUSTOMER_UPDATED',
      category: 'customer',
      severity: 'info',
      details: `Updated subscriber profile ${id}. Fields changed: ${Object.keys(updates).join(', ')}.`,
      status: 'success',
    });
  };

  const deleteCustomer = (id: string) => {
    const target = customers.find((c) => c.id === id);
    if (!target) return;

    deleteFirestoreDoc(COLLECTIONS.CUSTOMERS, id);

    // Release NAP port
    if (target.network.napBoxId) {
      setNapBoxes((prev) =>
        prev.map((box) => {
          if (box.id === target.network.napBoxId) {
            const updatedPorts = box.ports.map((p) =>
              p.customerId === id ? { portNumber: p.portNumber, status: 'available' as const } : p
            );
            const updatedBox = { ...box, ports: updatedPorts };
            saveFirestoreDoc(COLLECTIONS.NAP_BOXES, updatedBox);
            return updatedBox;
          }
          return box;
        })
      );
    }

    setCustomers((prev) => prev.filter((c) => c.id !== id));
    showToast('warning', 'Customer Removed', `Account ${target.accountNo} has been deleted.`);
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'CUSTOMER_DELETED',
      category: 'customer',
      severity: 'warning',
      details: `Decommissioned subscriber account ${target.fullName} (${target.accountNo}).`,
      status: 'success',
    });
  };

  const toggleCustomerStatus = (id: string, newStatus: CustomerStatus) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const isSynced = newStatus === 'active';
          return {
            ...c,
            status: newStatus,
            network: { ...c.network, isMikrotikSynced: isSynced },
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      })
    );
    showToast(
      'info',
      'Status Changed',
      `Subscriber status set to ${newStatus.toUpperCase()}.${newStatus === 'active' ? ' Mikrotik line activated.' : ' Line disabled.'}`
    );
  };

  const syncCustomerMikrotik = (id: string) => {
    const customer = customers.find((c) => c.id === id);
    if (!customer) return;

    setCustomers((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, network: { ...c.network, isMikrotikSynced: true }, updatedAt: new Date().toISOString() } : c
      )
    );
    showToast('success', 'Mikrotik Synced', `PPPoE user ${customer.network.pppoeUsername} synced with RouterOS.`);
  };

  const provisionSubscriber = (
    customerId: string,
    options: {
      technician: string;
      opticalPowerDbm: number;
      dropCableMeters: number;
      onuSerial: string;
      routerModel: string;
      surveyNotes?: string;
      createInitialInvoice?: boolean;
    }
  ) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    const todayStr = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          return {
            ...c,
            status: 'active' as const,
            installationDate: todayStr,
            updatedAt: nowIso,
            network: {
              ...c.network,
              onuSerial: options.onuSerial || c.network.onuSerial,
              routerModel: options.routerModel || c.network.routerModel,
              opticalPowerDbm: options.opticalPowerDbm,
              isMikrotikSynced: true,
            },
            installationDetails: {
              technician: options.technician,
              opticalPowerDbm: options.opticalPowerDbm,
              dropCableMeters: options.dropCableMeters,
              completedAt: nowIso,
              surveyNotes: options.surveyNotes,
            },
          };
        }
        return c;
      })
    );

    if (options.createInitialInvoice) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (businessProfile.invoiceGracePeriodDays || 7));
      const invoiceNumber = `INV-${todayStr.slice(2, 4)}${todayStr.slice(5, 7)}-${String(invoices.length + 1).padStart(4, '0')}`;
      createInvoice({
        invoiceNumber,
        customerId: customer.id,
        customerName: customer.fullName,
        accountNo: customer.accountNo,
        customerAddress: `${customer.address.street}, ${customer.address.barangay}, ${customer.address.city}, ${customer.address.province}`,
        customerMobile: customer.mobile,
        customerEmail: customer.email,
        billingPeriodStart: todayStr,
        billingPeriodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
        issueDate: todayStr,
        dueDate: dueDate.toISOString().slice(0, 10),
        items: [
          {
            id: generateId('ITEM'),
            description: `${customer.planName} (Initial Month Subscription)`,
            quantity: 1,
            unitPrice: customer.monthlyFee,
            amount: customer.monthlyFee,
            type: 'plan',
          },
        ],
        subtotal: customer.monthlyFee,
        discount: 0,
        previousBalance: 0,
        totalAmount: customer.monthlyFee,
        amountPaid: 0,
        balanceDue: customer.monthlyFee,
        status: 'unpaid',
        sentViaSms: false,
        sentViaEmail: false,
      });
    }

    try {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } catch {
      // ignore
    }

    showToast(
      'success',
      'Subscriber Provisioned & Activated',
      `${customer.fullName} (${customer.accountNo}) is now LIVE. Optical Signal: ${options.opticalPowerDbm} dBm, Cable: ${options.dropCableMeters}m.`
    );
  };

  // --- Invoicing Operations ---
  const createInvoice = (invoiceData: Omit<Invoice, 'id' | 'createdAt'>): Invoice => {
    const newInvoice: Invoice = {
      ...invoiceData,
      id: generateId('INV'),
      createdAt: new Date().toISOString(),
    };

    setInvoices((prev) => [newInvoice, ...prev]);

    // Recalculate customer balance
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === newInvoice.customerId) {
          const newBalance = c.balance + newInvoice.balanceDue;
          return { ...c, balance: newBalance, updatedAt: new Date().toISOString() };
        }
        return c;
      })
    );

    showToast('success', 'Invoice Created', `Invoice ${newInvoice.invoiceNumber} generated.`);
    return newInvoice;
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    setInvoices((prev) => prev.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv)));
  };

  const deleteInvoice = (id: string) => {
    const target = invoices.find((inv) => inv.id === id);
    if (!target) return;

    setInvoices((prev) => prev.filter((inv) => inv.id !== id));

    // Deduct from customer balance if unpaid
    if (target.status !== 'paid' && target.balanceDue > 0) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === target.customerId) {
            return { ...c, balance: Math.max(0, c.balance - target.balanceDue) };
          }
          return c;
        })
      );
    }

    showToast('warning', 'Invoice Deleted', `Invoice ${target.invoiceNumber} removed.`);
  };

  const generateBatchInvoices = (options: {
    billingMonth: string; // e.g. "2026-09"
    dueDate: string; // e.g. "2026-09-10"
    billingCycleDay?: number;
    applyWalletCredits?: boolean;
    enableProration?: boolean;
  }): { count: number; totalAmount: number } => {
    const activeSubscribers = customers.filter(
      (c) => c.status === 'active' || c.status === 'overdue'
    );

    let generatedCount = 0;
    let totalGeneratedAmount = 0;
    const newInvoices: Invoice[] = [];
    const updatedCustomers = [...customers];

    const [year, month] = options.billingMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${lastDayOfMonth}`;

    activeSubscribers.forEach((customer, index) => {
      // If billing cycle day filter is specified and does not match, skip
      if (options.billingCycleDay && customer.billingDay !== options.billingCycleDay) {
        return;
      }

      // Check if invoice already exists for this customer & billing period
      const alreadyInvoiced = invoices.some(
        (inv) =>
          inv.customerId === customer.id &&
          inv.billingPeriodStart.startsWith(options.billingMonth)
      );

      if (alreadyInvoiced) return;

      const invoiceNumStr = `INV-${year.slice(2)}${month}-${String(invoices.length + index + 1).padStart(4, '0')}`;
      const previousBal = customer.balance > 0 ? customer.balance : 0;

      // Mid-Month Proration Calculation
      let planFee = customer.monthlyFee;
      let isProrated = false;
      let proratedDays = lastDayOfMonth;

      if (options.enableProration !== false && customer.installationDate.startsWith(options.billingMonth)) {
        const installDay = parseInt(customer.installationDate.split('-')[2]) || 1;
        if (installDay > 1) {
          proratedDays = lastDayOfMonth - installDay + 1;
          planFee = Math.round((proratedDays / lastDayOfMonth) * customer.monthlyFee);
          isProrated = true;
        }
      }

      const subtotal = planFee;
      let totalAmount = subtotal + previousBal;

      // Advance Credit Wallet Application
      let appliedCredit = 0;
      let currentWalletBal = customer.walletBalance || 0;

      if (options.applyWalletCredits !== false && currentWalletBal > 0) {
        appliedCredit = Math.min(currentWalletBal, totalAmount);
        currentWalletBal -= appliedCredit;
      }

      const balanceDue = Math.max(0, totalAmount - appliedCredit);
      const invoiceStatus = balanceDue === 0 ? ('paid' as const) : ('unpaid' as const);

      const items: InvoiceItem[] = [
        {
          id: generateId('ITEM'),
          description: isProrated
            ? `Monthly Fiber (${customer.planName}) - Prorated (${proratedDays}/${lastDayOfMonth} Days)`
            : `Monthly Fiber Service - ${customer.planName}`,
          quantity: 1,
          unitPrice: planFee,
          amount: planFee,
          type: 'plan',
        },
      ];

      if (previousBal > 0) {
        items.push({
          id: generateId('ITEM'),
          description: `Previous Unpaid Balance (Arrears)`,
          quantity: 1,
          unitPrice: previousBal,
          amount: previousBal,
          type: 'late_fee',
        });
      }

      if (appliedCredit > 0) {
        items.push({
          id: generateId('ITEM'),
          description: `Advance Credit Wallet Deduction`,
          quantity: 1,
          unitPrice: -appliedCredit,
          amount: -appliedCredit,
          type: 'discount',
        });
      }

      const invoice: Invoice = {
        id: generateId('INV'),
        invoiceNumber: invoiceNumStr,
        customerId: customer.id,
        customerName: customer.fullName,
        accountNo: customer.accountNo,
        customerAddress: `${customer.address.street}, ${customer.address.barangay}, ${customer.address.city}, ${customer.address.province}`,
        customerMobile: customer.mobile,
        customerEmail: customer.email,
        billingPeriodStart: startDate,
        billingPeriodEnd: endDate,
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: options.dueDate,
        items,
        subtotal,
        discount: 0,
        appliedCredit,
        isProrated,
        proratedDays: isProrated ? proratedDays : undefined,
        previousBalance: previousBal,
        totalAmount,
        amountPaid: appliedCredit,
        balanceDue,
        status: invoiceStatus,
        sentViaSms: false,
        sentViaEmail: false,
        paidAt: invoiceStatus === 'paid' ? new Date().toISOString() : undefined,
        createdAt: new Date().toISOString(),
      };

      newInvoices.push(invoice);
      generatedCount++;
      totalGeneratedAmount += totalAmount;

      // Update customer balance & wallet
      const custIndex = updatedCustomers.findIndex((c) => c.id === customer.id);
      if (custIndex >= 0) {
        updatedCustomers[custIndex] = {
          ...updatedCustomers[custIndex],
          balance: balanceDue,
          walletBalance: currentWalletBal,
        };
      }
    });

    if (newInvoices.length > 0) {
      setInvoices((prev) => [...newInvoices, ...prev]);
      setCustomers(updatedCustomers);
      showToast(
        'success',
        'Batch Invoicing Complete',
        `Generated ${generatedCount} invoices totaling ₱${totalGeneratedAmount.toLocaleString()}.`
      );
    } else {
      showToast('info', 'No Invoices Needed', 'All active accounts for this period already have invoices.');
    }

    return { count: generatedCount, totalAmount: totalGeneratedAmount };
  };

  const applyInvoiceDiscount = (invoiceId: string, discountAmount: number) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;

    const newBalanceDue = Math.max(0, invoice.totalAmount - discountAmount - invoice.amountPaid);
    const newStatus = newBalanceDue === 0 ? 'paid' : invoice.amountPaid > 0 ? 'partially_paid' : 'unpaid';

    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              discount: discountAmount,
              balanceDue: newBalanceDue,
              status: newStatus,
            }
          : inv
      )
    );

    // Update customer balance
    setCustomers((prev) =>
      prev.map((c) => (c.id === invoice.customerId ? { ...c, balance: Math.max(0, c.balance - discountAmount) } : c))
    );

    showToast('success', 'Discount Applied', `₱${discountAmount} discount applied to ${invoice.invoiceNumber}.`);
  };

  const addCustomerWalletCredit = (customerId: string, amount: number, notes?: string) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const newWallet = (c.walletBalance || 0) + amount;
          return { ...c, walletBalance: newWallet, updatedAt: new Date().toISOString() };
        }
        return c;
      })
    );
    showToast('success', 'Credit Added', `Added ₱${amount.toLocaleString()} advance credit wallet funds.`);
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'WALLET_CREDIT_ADDED',
      category: 'billing',
      severity: 'info',
      details: `Added ₱${amount.toFixed(2)} advance credit to customer ${customerId}. Notes: ${notes || 'N/A'}.`,
      status: 'success',
    });
  };

  // --- Automated Grace Period & Isolation Audit ---
  const runDailyGraceAudit = (): { isolatedCount: number; reactivatedCount: number; graceCount: number } => {
    const today = new Date();
    const graceDays = businessProfile.invoiceGracePeriodDays || 5;

    let isolatedCount = 0;
    let reactivatedCount = 0;
    let graceCount = 0;

    const updatedCustomers = customers.map((c) => {
      // Find open invoices for this customer
      const openInvoices = invoices.filter(
        (inv) => inv.customerId === c.id && (inv.status === 'unpaid' || inv.status === 'overdue')
      );

      if (openInvoices.length === 0 && (c.status === 'overdue' || c.status === 'suspended') && c.balance === 0) {
        // Auto-reactivate
        reactivatedCount++;
        return {
          ...c,
          status: 'active' as const,
          network: { ...c.network, isMikrotikSynced: true },
          updatedAt: new Date().toISOString(),
        };
      }

      // Check if any invoice is past the grace period
      let isPastGrace = false;
      let isInGrace = false;

      openInvoices.forEach((inv) => {
        const dueDate = new Date(inv.dueDate);
        const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysPastDue > graceDays) {
          isPastGrace = true;
        } else if (daysPastDue > 0) {
          isInGrace = true;
        }
      });

      if (isPastGrace && c.status !== 'suspended') {
        isolatedCount++;
        return {
          ...c,
          status: 'suspended' as const,
          network: { ...c.network, isMikrotikSynced: false },
          updatedAt: new Date().toISOString(),
        };
      } else if (isInGrace && c.status === 'active') {
        graceCount++;
        return {
          ...c,
          status: 'overdue' as const,
          updatedAt: new Date().toISOString(),
        };
      }

      return c;
    });

    setCustomers(updatedCustomers);

    logAuditEvent({
      userName: 'System Auto-Grace Auditor',
      action: 'DAILY_GRACE_AUDIT_EXECUTED',
      category: 'network',
      severity: isolatedCount > 0 ? 'warning' : 'info',
      details: `Daily audit complete. ${isolatedCount} accounts isolated, ${reactivatedCount} accounts reactivated, ${graceCount} in grace period.`,
      status: 'success',
    });

    showToast(
      'info',
      'Daily Grace Audit Complete',
      `Audit executed: ${isolatedCount} isolated, ${reactivatedCount} reactivated, ${graceCount} in grace period.`
    );

    return { isolatedCount, reactivatedCount, graceCount };
  };

  // --- Payment Operations ---
  const recordPayment = (paymentData: {
    customerId: string;
    invoiceId?: string;
    amount: number;
    paymentMethod: PaymentMethod;
    referenceNumber?: string;
    cashierName?: string;
    notes?: string;
    isAdvancePayment?: boolean;
  }): Payment => {
    const customer = customers.find((c) => c.id === paymentData.customerId);
    const invoice = paymentData.invoiceId ? invoices.find((inv) => inv.id === paymentData.invoiceId) : undefined;

    const receiptNumber = `OR-${new Date().getFullYear().toString().slice(2)}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(payments.length + 1).padStart(4, '0')}`;

    const newPayment: Payment = {
      id: generateId('PAY'),
      receiptNumber,
      customerId: paymentData.customerId,
      customerName: customer?.fullName || 'Customer',
      accountNo: customer?.accountNo || 'N/A',
      invoiceId: invoice?.id,
      invoiceNumber: invoice?.invoiceNumber,
      amount: paymentData.amount,
      paymentDate: new Date().toISOString(),
      paymentMethod: paymentData.paymentMethod,
      referenceNumber: paymentData.referenceNumber,
      cashierName: paymentData.cashierName || businessProfile.representative.firstName + ' ' + businessProfile.representative.lastName,
      remittanceStatus: 'pending',
      notes: paymentData.notes,
      isAdvancePayment: !!paymentData.isAdvancePayment,
      createdAt: new Date().toISOString(),
    };

    setPayments((prev) => [newPayment, ...prev]);
    saveFirestoreDoc(COLLECTIONS.PAYMENTS, newPayment);

    let excessWalletCredit = 0;

    // Update Invoice if linked
    if (invoice) {
      const neededToPay = invoice.balanceDue;
      const newAmountPaid = invoice.amountPaid + paymentData.amount;
      const newBalanceDue = Math.max(0, invoice.totalAmount - invoice.discount - newAmountPaid);
      const newStatus: InvoiceStatus = newBalanceDue <= 0 ? 'paid' : 'partially_paid';

      if (paymentData.amount > neededToPay) {
        excessWalletCredit = paymentData.amount - neededToPay;
      }

      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id === invoice.id) {
            const updatedInv = {
              ...inv,
              amountPaid: newAmountPaid,
              balanceDue: newBalanceDue,
              status: newStatus,
              paidAt: newStatus === 'paid' ? new Date().toISOString() : inv.paidAt,
              paymentMethodUsed: paymentData.paymentMethod,
            };
            saveFirestoreDoc(COLLECTIONS.INVOICES, updatedInv);
            return updatedInv;
          }
          return inv;
        })
      );
    } else if (paymentData.isAdvancePayment) {
      excessWalletCredit = paymentData.amount;
    }

    // Update Customer Balance and auto-reactivate if suspended/overdue
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === paymentData.customerId) {
          const updatedBal = Math.max(0, c.balance - paymentData.amount);
          const newWallet = (c.walletBalance || 0) + excessWalletCredit;
          const shouldReactivate = (c.status === 'suspended' || c.status === 'overdue') && updatedBal === 0;

          const updatedCust = {
            ...c,
            balance: updatedBal,
            walletBalance: newWallet,
            advanceDeposit: paymentData.isAdvancePayment ? c.advanceDeposit + paymentData.amount : c.advanceDeposit,
            status: shouldReactivate ? ('active' as const) : c.status,
            network: shouldReactivate ? { ...c.network, isMikrotikSynced: true } : c.network,
            updatedAt: new Date().toISOString(),
          };
          saveFirestoreDoc(COLLECTIONS.CUSTOMERS, updatedCust);
          return updatedCust;
        }
        return c;
      })
    );

    // Trigger celebration confetti on collection
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch {
      // ignore
    }

    showToast(
      'success',
      'Payment Recorded',
      `Collected ₱${paymentData.amount.toLocaleString()} from ${customer?.fullName || 'Customer'}. Official Receipt: ${receiptNumber}`
    );

    logAuditEvent({
      userName: paymentData.cashierName || 'Admin Leonardo Flojo',
      action: 'PAYMENT_COLLECTED',
      category: 'billing',
      severity: 'info',
      details: `Collected ₱${paymentData.amount.toFixed(2)} via ${paymentData.paymentMethod.toUpperCase()} (OR: ${receiptNumber}) from ${customer?.fullName || 'Customer'}. Excess credited to wallet: ₱${excessWalletCredit.toFixed(2)}.`,
      status: 'success',
    });

    return newPayment;
  };

  // --- Daily Remittances Operations ---
  const addDailyRemittance = (remittanceData: Omit<DailyRemittanceRecord, 'id'>): DailyRemittanceRecord => {
    const newRemittance: DailyRemittanceRecord = {
      ...remittanceData,
      id: generateId('REMIT'),
    };
    setDailyRemittances((prev) => [newRemittance, ...prev]);
    showToast('success', 'Remittance Created', `Created remittance sheet for ${newRemittance.remittanceDate}.`);
    return newRemittance;
  };

  const closeDailyRemittance = (id: string, actualCashInDrawer: number, verifiedBy?: string, notes?: string) => {
    setDailyRemittances((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const discrepancy = actualCashInDrawer - r.totalCash;
          return {
            ...r,
            actualCashInDrawer,
            discrepancy,
            verifiedBy: verifiedBy || 'Leonardo Flojo Jr.',
            notes: notes || r.notes,
            status: 'closed' as const,
            closedAt: new Date().toISOString(),
          };
        }
        return r;
      })
    );

    // Mark today's payments as remitted
    setPayments((prev) =>
      prev.map((p) => ({
        ...p,
        remittanceStatus: 'remitted' as const,
        remittedAt: new Date().toISOString(),
      }))
    );

    showToast('success', 'Remittance Drawer Closed', 'Cash drawer reconciliation complete and locked.');
    logAuditEvent({
      userName: verifiedBy || 'Admin Leonardo Flojo',
      action: 'CASHIER_REMITTANCE_CLOSED',
      category: 'billing',
      severity: 'info',
      details: `Closed daily cash drawer. Counted Cash: ₱${actualCashInDrawer.toLocaleString()}. Verified by ${verifiedBy || 'Leonardo Flojo Jr.'}.`,
      status: 'success',
    });

    if (businessProfile.staffWebhooks?.notifyOnCashierRemittance) {
      sendTelegramStaffAlert(
        `💰 <b>CASHIER REMITTANCE EOD CLOSED</b>\n\n📌 <b>Date:</b> ${new Date().toLocaleDateString()}\n💵 <b>Physical Cash Count:</b> ₱${actualCashInDrawer.toLocaleString()}\n👤 <b>Audited By:</b> ${verifiedBy || 'Leonardo Flojo Jr.'}\n🔒 <b>Status:</b> Z-Reading Settled & Remittance Locked`,
        businessProfile.staffWebhooks
      );
      sendDiscordStaffAlert(
        '💰 Daily Cashier Remittance Locked (Z-Reading)',
        `End-of-day cash drawer has been audited and locked by **${verifiedBy || 'Leonardo Flojo Jr.'}**.`,
        [
          { name: 'Counted Physical Cash', value: `₱${actualCashInDrawer.toLocaleString()}`, inline: true },
          { name: 'Audit Status', value: '🟢 Settled & Locked', inline: true },
        ],
        0x10b981,
        businessProfile.staffWebhooks
      );
    }
  };

  const deletePayment = (id: string) => {
    const target = payments.find((p) => p.id === id);
    if (!target) return;

    deleteFirestoreDoc(COLLECTIONS.PAYMENTS, id);
    setPayments((prev) => prev.filter((p) => p.id !== id));
    showToast('warning', 'Payment Voided', `Receipt ${target.receiptNumber} has been removed.`);
  };

  const submitPaymentProof = (submissionData: {
    customerId: string;
    invoiceId?: string;
    amount: number;
    paymentMethod: PaymentMethod;
    referenceNumber: string;
    receiptImageUrl?: string;
    notes?: string;
  }): PaymentSubmission => {
    const customer = customers.find((c) => c.id === submissionData.customerId);
    const invoice = submissionData.invoiceId ? invoices.find((i) => i.id === submissionData.invoiceId) : undefined;
    const submissionNumber = `SUB-${new Date().getFullYear().toString().slice(2)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newSub: PaymentSubmission = {
      id: generateId('SUB'),
      submissionNumber,
      customerId: submissionData.customerId,
      customerName: customer?.fullName || 'Subscriber',
      accountNo: customer?.accountNo || 'N/A',
      invoiceId: invoice?.id,
      invoiceNumber: invoice?.invoiceNumber,
      amount: submissionData.amount,
      paymentMethod: submissionData.paymentMethod,
      referenceNumber: submissionData.referenceNumber,
      receiptImageUrl: submissionData.receiptImageUrl,
      status: 'pending_review',
      submittedAt: new Date().toISOString(),
      notes: submissionData.notes,
    };

    setPaymentSubmissions((prev) => [newSub, ...prev]);
    saveFirestoreDoc(COLLECTIONS.PAYMENT_SUBMISSIONS, newSub);

    logAuditEvent({
      userName: customer?.fullName || 'Subscriber Portal',
      action: 'PAYMENT_PROOF_SUBMITTED',
      category: 'billing',
      severity: 'info',
      details: `Submitted payment proof (${submissionNumber}) for ₱${submissionData.amount.toLocaleString()} via ${submissionData.paymentMethod.toUpperCase()} (Ref: ${submissionData.referenceNumber}).`,
      status: 'success',
    });

    showToast('success', 'Payment Proof Submitted', `Your payment receipt (${submissionNumber}) is now queued for cashier verification.`);
    return newSub;
  };

  const approvePaymentSubmission = (id: string, reviewedBy?: string): Payment | null => {
    const sub = paymentSubmissions.find((s) => s.id === id);
    if (!sub) return null;

    const cashier = reviewedBy || businessProfile.representative.firstName + ' ' + businessProfile.representative.lastName;

    // 1. Record official payment
    const payment = recordPayment({
      customerId: sub.customerId,
      invoiceId: sub.invoiceId,
      amount: sub.amount,
      paymentMethod: sub.paymentMethod,
      referenceNumber: sub.referenceNumber,
      cashierName: cashier,
      notes: `Verified from Online Submission #${sub.submissionNumber}. ${sub.notes || ''}`,
      isAdvancePayment: !sub.invoiceId,
    });

    // 2. Update submission state
    const updatedSub: PaymentSubmission = {
      ...sub,
      status: 'approved' as const,
      reviewedBy: cashier,
      reviewedAt: new Date().toISOString(),
    };

    setPaymentSubmissions((prev) =>
      prev.map((s) => (s.id === id ? updatedSub : s))
    );
    saveFirestoreDoc(COLLECTIONS.PAYMENT_SUBMISSIONS, updatedSub);

    // 3. Send SMS Acknowledgment
    sendReminder(sub.customerId, 'payment_confirmation', 'sms');

    logAuditEvent({
      userName: cashier,
      action: 'PAYMENT_PROOF_APPROVED',
      category: 'billing',
      severity: 'info',
      details: `Approved online payment proof (${sub.submissionNumber}) for ${sub.customerName}. Issued OR #${payment.receiptNumber}.`,
      status: 'success',
    });

    showToast('success', 'Payment Approved & OR Issued', `Receipt ${payment.receiptNumber} generated and SMS sent to ${sub.customerName}.`);
    return payment;
  };

  const rejectPaymentSubmission = (id: string, reason: string, reviewedBy?: string) => {
    const sub = paymentSubmissions.find((s) => s.id === id);
    if (!sub) return;

    const cashier = reviewedBy || businessProfile.representative.firstName + ' ' + businessProfile.representative.lastName;

    const updatedSub: PaymentSubmission = {
      ...sub,
      status: 'rejected' as const,
      rejectionReason: reason,
      reviewedBy: cashier,
      reviewedAt: new Date().toISOString(),
    };

    setPaymentSubmissions((prev) =>
      prev.map((s) => (s.id === id ? updatedSub : s))
    );
    saveFirestoreDoc(COLLECTIONS.PAYMENT_SUBMISSIONS, updatedSub);

    logAuditEvent({
      userName: cashier,
      action: 'PAYMENT_PROOF_REJECTED',
      category: 'billing',
      severity: 'warning',
      details: `Rejected payment proof (${sub.submissionNumber}) for ${sub.customerName}. Reason: ${reason}`,
      status: 'failed',
    });

    showToast('error', 'Payment Proof Rejected', `Submission ${sub.submissionNumber} marked as rejected.`);
  };

  // --- Plan Operations ---
  const addPlan = (planData: Omit<Plan, 'id'>) => {
    const newPlan: Plan = { ...planData, id: generateId('PLAN') };
    setPlans((prev) => [...prev, newPlan]);
    showToast('success', 'Plan Created', `Internet plan "${newPlan.name}" is now available.`);
  };

  const updatePlan = (id: string, updates: Partial<Plan>) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    showToast('info', 'Plan Updated', 'Package details modified.');
  };

  const deletePlan = (id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    showToast('warning', 'Plan Deleted', 'Plan removed from catalog.');
  };

  // --- NAP Box Operations ---
  const addNapBox = (boxData: Omit<NapBox, 'id'>) => {
    const newBox: NapBox = { ...boxData, id: generateId('NAP') };
    setNapBoxes((prev) => [...prev, newBox]);
    showToast('success', 'NAP Box Deployed', `NAP Box "${newBox.code}" registered.`);
  };

  const updateNapBox = (id: string, updates: Partial<NapBox>) => {
    setNapBoxes((prev) => prev.map((box) => (box.id === id ? { ...box, ...updates } : box)));
    showToast('info', 'NAP Box Updated', 'NAP box configuration updated.');
  };

  const deleteNapBox = (id: string) => {
    setNapBoxes((prev) => prev.filter((box) => box.id !== id));
    showToast('warning', 'NAP Box Removed', 'Fiber distribution point removed.');
  };

  // --- Fiber GIS & OSP Outside Plant Operations ---
  const addFiberCable = (cableData: Omit<FiberCable, 'id'>): FiberCable => {
    const newCable: FiberCable = { ...cableData, id: generateId('CBL') };
    setFiberCables((prev) => [...prev, newCable]);
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'FIBER_CABLE_DEPLOYED',
      category: 'network',
      severity: 'info',
      details: `Installed ${newCable.coreCount}-Core ${newCable.type} fiber cable "${newCable.name}" (${newCable.lengthMeters}m).`,
      status: 'success',
    });
    showToast('success', 'Fiber Cable Added', `Cable "${newCable.name}" added to GIS database.`);
    return newCable;
  };

  const updateFiberCable = (id: string, updates: Partial<FiberCable>) => {
    setFiberCables((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    showToast('info', 'Cable Route Updated', 'Fiber cable attributes saved.');
  };

  const deleteFiberCable = (id: string) => {
    setFiberCables((prev) => prev.filter((c) => c.id !== id));
    showToast('warning', 'Cable Removed', 'Fiber route deleted from GIS map.');
  };

  const addFiberClosure = (closureData: Omit<FiberClosure, 'id'>): FiberClosure => {
    const newClosure: FiberClosure = { ...closureData, id: generateId('FJC') };
    setFiberClosures((prev) => [...prev, newClosure]);
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'SPLICE_CLOSURE_DEPLOYED',
      category: 'network',
      severity: 'info',
      details: `Installed ${newClosure.type} splice enclosure "${newClosure.name}" with ${newClosure.totalSplices} spliced cores.`,
      status: 'success',
    });
    showToast('success', 'Splice Closure Added', `Enclosure "${newClosure.name}" registered.`);
    return newClosure;
  };

  const updateFiberClosure = (id: string, updates: Partial<FiberClosure>) => {
    setFiberClosures((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
    showToast('info', 'Closure Updated', 'Splice enclosure specifications saved.');
  };

  const deleteFiberClosure = (id: string) => {
    setFiberClosures((prev) => prev.filter((f) => f.id !== id));
    showToast('warning', 'Closure Removed', 'Splice enclosure deleted from GIS map.');
  };

  const updateOltNode = (updates: Partial<OltPopNode>) => {
    setOltNode((prev) => ({ ...prev, ...updates }));
    showToast('info', 'OLT POP Updated', 'Central Office node parameters saved.');
  };

  // --- Repair Operations ---
  const addRepairOrder = (orderData: Omit<RepairOrder, 'id' | 'createdAt'>): RepairOrder => {
    const newOrder: RepairOrder = {
      ...orderData,
      id: generateId('REP'),
      createdAt: new Date().toISOString(),
    };
    setRepairOrders((prev) => [newOrder, ...prev]);
    showToast('success', 'Job Order Created', `Repair Ticket #${newOrder.orderNumber} filed.`);
    return newOrder;
  };

  const updateRepairOrder = (id: string, updates: Partial<RepairOrder>) => {
    setRepairOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
    showToast('info', 'Job Order Updated', 'Repair status saved.');
  };

  const deleteRepairOrder = (id: string) => {
    setRepairOrders((prev) => prev.filter((o) => o.id !== id));
    showToast('warning', 'Job Order Deleted', 'Repair record removed.');
  };

  const convertRepairToInvoice = (repairId: string): Invoice => {
    const repair = repairOrders.find((r) => r.id === repairId);
    if (!repair) throw new Error('Repair order not found');

    const customer = repair.customerId ? customers.find((c) => c.id === repair.customerId) : undefined;

    const items: InvoiceItem[] = [
      {
        id: generateId('ITEM'),
        description: `Repair Service: ${repair.deviceType} - ${repair.issueDescription.slice(0, 50)}...`,
        quantity: 1,
        unitPrice: repair.laborCost,
        amount: repair.laborCost,
        type: 'repair',
      },
      ...repair.partsUsed.map((part) => ({
        id: generateId('ITEM'),
        description: `Replacement Part: ${part.name}`,
        quantity: part.quantity,
        unitPrice: part.cost,
        amount: part.cost * part.quantity,
        type: 'repair' as const,
      })),
    ];

    const subtotal = repair.totalCost;
    const invoiceNumStr = `INV-REP-${repair.orderNumber}`;

    const newInvoice: Invoice = {
      id: generateId('INV'),
      invoiceNumber: invoiceNumStr,
      customerId: repair.customerId || 'walk-in',
      customerName: repair.customerName,
      accountNo: customer?.accountNo || 'WALK-IN',
      customerAddress: repair.address,
      customerMobile: repair.contactNumber,
      customerEmail: customer?.email || '',
      billingPeriodStart: new Date().toISOString().slice(0, 10),
      billingPeriodEnd: new Date().toISOString().slice(0, 10),
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      items,
      subtotal,
      discount: 0,
      previousBalance: 0,
      totalAmount: subtotal,
      amountPaid: 0,
      balanceDue: subtotal,
      status: 'unpaid',
      sentViaSms: false,
      sentViaEmail: false,
      createdAt: new Date().toISOString(),
    };

    setInvoices((prev) => [newInvoice, ...prev]);

    // Update repair status
    setRepairOrders((prev) =>
      prev.map((r) => (r.id === repairId ? { ...r, billedToInvoiceId: newInvoice.id, status: 'ready' } : r))
    );

    showToast('success', 'Repair Billed', `Generated Invoice ${invoiceNumStr} for Repair #${repair.orderNumber}.`);
    return newInvoice;
  };

  // --- Reminders Operations ---
  const sendReminder = async (
    customerId: string,
    type: ReminderType,
    channel: 'sms' | 'email' | 'both',
    invoiceId?: string
  ) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    const invoice = invoiceId ? invoices.find((inv) => inv.id === invoiceId) : undefined;
    const message = generateReminderMessage(type, customer, businessProfile, invoice);

    // Handle Email via SMTP
    if (channel === 'email' || channel === 'both') {
      if (invoice) {
        const htmlBody = generateHtmlInvoiceEmail(invoice, customer, businessProfile);
        await sendSmtpEmail({
          smtpConfig: businessProfile.smtp,
          to: customer.email || `${customer.accountNo.toLowerCase()}@swiftstream.ph`,
          subject: `Statement of Account - Invoice #${invoice.invoiceNumber} (${businessProfile.name})`,
          htmlBody,
          textBody: message,
        });
      }
    }

    if (channel === 'sms' || channel === 'both') {
      await sendMockNotification('sms', { mobile: customer.mobile, email: customer.email, name: customer.fullName }, message);
    }

    const newReminder: ReminderLog = {
      id: generateId('REM'),
      customerId,
      customerName: customer.fullName,
      mobile: customer.mobile,
      email: customer.email,
      type,
      channel,
      messageText: message,
      status: 'sent',
      sentAt: new Date().toISOString(),
      invoiceNumber: invoice?.invoiceNumber,
      amountDue: invoice?.balanceDue || customer.balance,
    };

    setReminders((prev) => [newReminder, ...prev]);

    if (invoice) {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoice.id
            ? {
                ...inv,
                sentViaSms: channel === 'sms' || channel === 'both' ? true : inv.sentViaSms,
                sentViaEmail: channel === 'email' || channel === 'both' ? true : inv.sentViaEmail,
              }
            : inv
        )
      );
    }

    logAuditEvent({
      userName: 'SwiftStream Auto-Dispatcher',
      action: channel === 'email' ? 'EMAIL_INVOICE_SENT' : channel === 'both' ? 'SMS_AND_EMAIL_SENT' : 'SMS_REMINDER_SENT',
      category: 'smtp',
      severity: 'info',
      details: `Dispatched ${type} notice to ${customer.fullName} (${channel.toUpperCase()}) via ${businessProfile.smtp?.host || 'SMTP'}.`,
      status: 'success',
    });

    showToast('success', 'Advisory Dispatched', `Reminder sent to ${customer.fullName} via ${channel.toUpperCase()}.`);
  };

  const sendBatchReminders = async (target: 'overdue' | 'upcoming', channel: 'sms' | 'email' | 'both'): Promise<number> => {
    const targetCustomers =
      target === 'overdue'
        ? customers.filter((c) => c.status === 'overdue' || c.status === 'suspended' || c.balance > 0)
        : customers.filter((c) => c.status === 'active');

    let count = 0;
    for (const cust of targetCustomers) {
      const inv = invoices.find((i) => i.customerId === cust.id && i.status !== 'paid');
      const reminderType: ReminderType = target === 'overdue' ? 'overdue_warning' : 'upcoming_due';
      await sendReminder(cust.id, reminderType, channel, inv?.id);
      count++;
    }

    showToast('success', 'Batch Broadcast Done', `Dispatched ${count} reminder notifications.`);
    return count;
  };

  // --- MikroTik Router Fleet Operations ---
  const addMikrotikDevice = (deviceData: Omit<MikrotikDevice, 'id'>): MikrotikDevice => {
    const newDevice: MikrotikDevice = {
      ...deviceData,
      id: generateId('MTK'),
    };
    setMikrotikDevices((prev) => [newDevice, ...prev]);
    showToast('success', 'MikroTik Device Added', `${newDevice.name} added to router fleet.`);
    return newDevice;
  };

  const updateMikrotikDevice = (id: string, updates: Partial<MikrotikDevice>) => {
    setMikrotikDevices((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
    showToast('info', 'Router Updated', 'MikroTik configuration saved.');
  };

  const deleteMikrotikDevice = (id: string) => {
    setMikrotikDevices((prev) => prev.filter((d) => d.id !== id));
    showToast('warning', 'Device Removed', 'MikroTik router removed from management fleet.');
  };

  const syncAllSubscribersToMikrotik = () => {
    setCustomers((prev) =>
      prev.map((c) => ({
        ...c,
        network: {
          ...c.network,
          isMikrotikSynced: true,
        },
      }))
    );
    try {
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'MIKROTIK_FLEET_SYNC',
      category: 'network',
      severity: 'info',
      details: `Synchronized PPPoE secrets and Simple Queues for all ${customers.length} subscribers.`,
      status: 'success',
    });
    showToast(
      'success',
      'MikroTik Fleet Synced',
      `Synchronized PPPoE secrets and Simple Queues for all ${customers.length} subscribers.`
    );
  };

  // --- Expense Operations ---
  const addExpense = (expenseData: Omit<Expense, 'id'>): Expense => {
    const newExpense: Expense = {
      ...expenseData,
      id: generateId('EXP'),
    };
    setExpenses((prev) => [newExpense, ...prev]);
    logAuditEvent({
      userName: expenseData.recordedBy || 'Admin Leonardo Flojo',
      action: 'EXPENSE_RECORDED',
      category: 'expenses',
      severity: 'info',
      details: `Recorded OPEX voucher of ₱${newExpense.amount.toLocaleString()} for ${newExpense.category} (${newExpense.description}).`,
      status: 'success',
    });
    showToast('success', 'Expense Recorded', `₱${newExpense.amount.toLocaleString()} logged under ${newExpense.category}.`);
    return newExpense;
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setExpenses((prev) => prev.map((exp) => (exp.id === id ? { ...exp, ...updates } : exp)));
    showToast('info', 'Expense Updated', 'Expense voucher details have been updated.');
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((exp) => exp.id !== id));
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'EXPENSE_DELETED',
      category: 'expenses',
      severity: 'warning',
      details: `Deleted expense voucher ${id}.`,
      status: 'success',
    });
    showToast('warning', 'Expense Deleted', 'Expense entry was removed.');
  };

  // --- Profile & System ---
  const updateBusinessProfile = (updates: Partial<BusinessProfile>) => {
    setBusinessProfile((prev) => ({ ...prev, ...updates }));
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'SETTINGS_MODIFIED',
      category: 'settings',
      severity: 'info',
      details: `Updated business & SMTP configuration settings.`,
      status: 'success',
    });
    showToast('success', 'Settings Saved', 'Business & billing preferences updated.');
  };

  const exportData = () => {
    exportAllDataAsJson();
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'DATABASE_BACKUP_EXPORTED',
      category: 'system',
      severity: 'info',
      details: 'Exported complete database JSON backup file.',
      status: 'success',
    });
    showToast('info', 'Database Exported', 'JSON backup file has been saved to your downloads.');
  };

  const importData = (jsonData: any): boolean => {
    try {
      if (jsonData.customers) setCustomers(jsonData.customers);
      if (jsonData.invoices) setInvoices(jsonData.invoices);
      if (jsonData.payments) setPayments(jsonData.payments);
      if (jsonData.plans) setPlans(jsonData.plans);
      if (jsonData.napBoxes) setNapBoxes(jsonData.napBoxes);
      if (jsonData.fiberCables) setFiberCables(jsonData.fiberCables);
      if (jsonData.fiberClosures) setFiberClosures(jsonData.fiberClosures);
      if (jsonData.oltNode) setOltNode(jsonData.oltNode);
      if (jsonData.repairOrders) setRepairOrders(jsonData.repairOrders);
      if (jsonData.reminders) setReminders(jsonData.reminders);
      if (jsonData.mikrotikDevices) setMikrotikDevices(jsonData.mikrotikDevices);
      if (jsonData.expenses) setExpenses(jsonData.expenses);
      if (jsonData.auditLogs) setAuditLogs(jsonData.auditLogs);
      if (jsonData.businessProfile) setBusinessProfile(jsonData.businessProfile);

      logAuditEvent({
        userName: 'Admin Leonardo Flojo',
        action: 'DATABASE_BACKUP_RESTORED',
        category: 'system',
        severity: 'warning',
        details: 'Restored database from external JSON backup.',
        status: 'success',
      });
      showToast('success', 'Backup Restored', 'Database successfully restored from backup file.');
      return true;
    } catch (e) {
      showToast('error', 'Import Failed', 'Invalid JSON backup format.');
      return false;
    }
  };

  const resetToDefault = () => {
    resetAllDataToDefault();
    const freshData = loadStoredData();
    setBusinessProfile(freshData.businessProfile);
    setCustomers(freshData.customers);
    setInvoices(freshData.invoices);
    setPayments(freshData.payments);
    setPlans(freshData.plans);
    setNapBoxes(freshData.napBoxes);
    setFiberCables(freshData.fiberCables);
    setFiberClosures(freshData.fiberClosures);
    setOltNode(freshData.oltNode);
    setRepairOrders(freshData.repairOrders);
    setReminders(freshData.reminders);
    setMikrotikDevices(freshData.mikrotikDevices);
    setExpenses(freshData.expenses);
    setAuditLogs(freshData.auditLogs);
    showToast('info', 'Data Reset', 'All records restored to sample SwiftStream dataset.');
  };

  return (
    <AppContext.Provider
      value={{
        currentAuthUser,
        setCurrentAuthUser,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        businessProfile,
        customers,
        invoices,
        payments,
        plans,
        napBoxes,
        fiberCables,
        fiberClosures,
        oltNode,
        repairOrders,
        reminders,
        mikrotikDevices,
        expenses,
        auditLogs,
        activeTab,
        searchTerm,
        notifications,
        dailyRemittances,
        addonCatalog,
        setActiveTab,
        setSearchTerm,
        showToast,
        removeToast,
        logout,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        toggleCustomerStatus,
        addCustomerWalletCredit,
        syncCustomerMikrotik,
        syncAllSubscribersToMikrotik,
        provisionSubscriber,
        createInvoice,
        updateInvoice,
        deleteInvoice,
        generateBatchInvoices,
        applyInvoiceDiscount,
        runDailyGraceAudit,
        addDailyRemittance,
        closeDailyRemittance,
        recordPayment,
        deletePayment,
        paymentSubmissions,
        submitPaymentProof,
        approvePaymentSubmission,
        rejectPaymentSubmission,
        addPlan,
        updatePlan,
        deletePlan,
        addNapBox,
        updateNapBox,
        deleteNapBox,
        addFiberCable,
        updateFiberCable,
        deleteFiberCable,
        addFiberClosure,
        updateFiberClosure,
        deleteFiberClosure,
        updateOltNode,
        addMikrotikDevice,
        updateMikrotikDevice,
        deleteMikrotikDevice,
        addRepairOrder,
        updateRepairOrder,
        deleteRepairOrder,
        convertRepairToInvoice,
        sendReminder,
        sendBatchReminders,
        addExpense,
        updateExpense,
        deleteExpense,
        logAuditEvent,
        clearAuditLogs,
        updateBusinessProfile,
        exportData,
        importData,
        resetToDefault,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

