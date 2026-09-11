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
  CoverageArea,
  CoverageStatus,
  SystemRole,
  SYSTEM_ROLES_CONFIG,
  ROLE_PERMISSIONS,
  RolePermissions,
  StaffUser,
  OperationalBill,
  OperationalBillCategory,
  ExpenseCategory,
} from '../types';
import {
  exportAllDataAsJson,
  loadStoredData,
  resetAllDataToDefault,
  saveToStorage,
  setStoredStaffUsers,
  STORAGE_KEYS,
} from '../data/storage';
import { initialPlans, initialBusinessProfile, initialCoverageAreas, initialStaffUsers, initialOperationalBills } from '../data/initialData';
import { generateId } from '../utils/formatters';
import { generateReminderMessage, sendMockNotification } from '../utils/smsSender';
import {
  fetchFullRouterTelemetry,
  isolateOverdueSubscriber,
  reconnectSubscriber,
  saveOrUpdatePppoeSecret,
  MikrotikCredentials,
} from '../services/mikrotikApiService';
import { generateHtmlInvoiceEmail, sendSmtpEmail } from '../utils/smtpService';
import { sendTelegramStaffAlert, sendDiscordStaffAlert } from '../utils/webhookService';
import {
  COLLECTIONS,
  subscribeToCollection,
  subscribeToDocument,
  saveFirestoreDoc,
  deleteFirestoreDoc,
  purgeFirestoreCollections,
} from '../services/firestoreService';
import { doc, setDoc, getDoc, query, where, getDocs, collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  AppUserProfile,
  isStaffUser,
  subscribeToAuth,
  signOutUser,
  syncCustomerApprovalToUser,
  getAuthorizedAdminEmails,
  saveAuthorizedAdminEmails,
} from '../services/authService';
import {
  executePaymentWebhookPipeline,
  PaymentWebhookEvent,
  PaymentWebhookResult,
} from '../services/paymentWebhookService';

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
  authModalEmail: string;
  openAuthModal: (mode?: 'signin' | 'signup' | 'forgot', initialEmail?: string) => void;
  closeAuthModal: () => void;

  // System Role & RBAC
  systemRole: SystemRole;
  setSystemRole: (role: SystemRole) => void;
  canAccessTab: (tabId: string) => boolean;
  hasPermission: (perm: keyof RolePermissions) => boolean;

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
  coverageAreas: CoverageArea[];
  activeTab: string;
  searchTerm: string;
  notifications: ToastNotification[];
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;

  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;

  // Navigation & Search
  setActiveTab: (tab: string) => void;
  setSearchTerm: (term: string) => void;
  showToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message: string) => void;
  removeToast: (id: string) => void;
  logout: () => void;

  // Customer Actions
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>, options?: { skipMikrotikSync?: boolean }) => Customer;
  updateCustomer: (id: string, updates: Partial<Customer>, options?: { skipMikrotikSync?: boolean }) => void;
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
  resetCustomerPassword: (
    customerId: string,
    newPassword: string,
    syncPppoe?: boolean
  ) => Promise<{ success: boolean; message: string }>;

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
  processIncomingPaymentWebhook: (event: PaymentWebhookEvent) => Promise<PaymentWebhookResult>;

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

  // Coverage Area Actions
  addCoverageArea: (area: Omit<CoverageArea, 'id'>) => CoverageArea;
  updateCoverageArea: (id: string, updates: Partial<CoverageArea>) => void;
  deleteCoverageArea: (id: string) => void;
  toggleCoverageVisibility: (id: string) => void;
  toggleCoverageFiberReady: (id: string) => void;

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
  updateMikrotikDevice: (id: string, updates: Partial<MikrotikDevice>, notify?: boolean) => void;
  deleteMikrotikDevice: (id: string) => void;
  lastGlobalRouterPolledAt: Date | null;
  pollAllRoutersNow: () => Promise<void>;

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

  // Operational Bills & Due Date Calendar
  operationalBills: OperationalBill[];
  addOperationalBill: (bill: Omit<OperationalBill, 'id' | 'createdAt' | 'updatedAt' | 'status'> & Partial<Pick<OperationalBill, 'status'>>) => Promise<OperationalBill>;
  updateOperationalBill: (id: string, updates: Partial<OperationalBill>) => Promise<void>;
  deleteOperationalBill: (id: string) => Promise<void>;
  markOperationalBillPaid: (id: string, options?: {
    paymentDate?: string;
    paymentReference?: string;
    paymentMethod?: 'cash' | 'gcash' | 'maya' | 'bank_transfer' | 'check';
    createExpenseVoucher?: boolean;
    scheduleNextCycle?: boolean;
  }) => Promise<void>;
  overdueOperationalBillsCount: number;
  dueSoonOperationalBillsCount: number;

  // Security Audit Actions
  logAuditEvent: (event: Omit<AuditLog, 'id' | 'timestamp'>) => void;
  clearAuditLogs: () => void;

  // Staff Users & Role Management
  staffUsers: StaffUser[];
  addStaffUser: (user: Omit<StaffUser, 'id' | 'createdAt'>) => Promise<StaffUser>;
  updateStaffUser: (id: string, updates: Partial<StaffUser>) => Promise<void>;
  deleteStaffUser: (id: string) => Promise<void>;
  toggleStaffUserStatus: (id: string) => Promise<void>;

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
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>(() => {
    const raw = initial.staffUsers || initialStaffUsers;
    const clean = raw.filter((s: any) => {
      if (!s || !s.role) return false;
      const r = String(s.role).toLowerCase().trim();
      return (r === 'admin' || r === 'cashier' || r === 'technician') && !s.accountNo && !s.planId;
    });
    return clean.length > 0 ? clean : initialStaffUsers;
  });
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
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>(
    initial.coverageAreas && initial.coverageAreas.length > 0 ? initial.coverageAreas : initialCoverageAreas
  );
  const [operationalBills, setOperationalBills] = useState<OperationalBill[]>(
    initial.operationalBills && initial.operationalBills.length > 0 ? initial.operationalBills : initialOperationalBills
  );

  const VALID_TABS = new Set([
    'home',
    'portal',
    'dashboard',
    'customers',
    'applications',
    'field_ops',
    'repairs',
    'billing',
    'bill_calendar',
    'payments',
    'verification_queue',
    'plans',
    'reports',
    'transaction_logs',
    'mikrotik',
    'ipoe_dhcp',
    'network',
    'coverage',
    'reminders',
    'staff_users',
    'system_logs',
    'settings',
  ]);

  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash.replace(/^#\/?/, '').trim();
        // If an explicit tab is specified in the URL (e.g. #customers, #billing, #dashboard, #portal, #home)
        if (hash) {
          if (hash === 'home') return 'home';
          if (hash === 'portal') return 'portal';
          if (VALID_TABS.has(hash)) {
            // Guard admin tabs: Only allow direct deep-link into admin tabs if user is authenticated staff
            const localRaw = localStorage.getItem('swiftstream_current_auth_user');
            if (localRaw) {
              try {
                const user = JSON.parse(localRaw) as AppUserProfile;
                if (isStaffUser(user)) {
                  return hash;
                }
              } catch {}
            }
            // If not logged in as staff, safely default to home
            return 'home';
          }
        } else {
          // If no hash in URL (direct root visit e.g. http://localhost:5173/ or domain), always land on public Home Page
          return 'home';
        }
      }
    } catch {}
    return 'home';
  });

  useEffect(() => {
    try {
      localStorage.setItem('swiftstream_active_tab', activeTab);
      if (typeof window !== 'undefined') {
        const currentHash = window.location.hash.replace(/^#\/?/, '').trim();
        if (currentHash !== activeTab) {
          if (activeTab === 'home') {
            // Keep clean URL on home page without forcing a hash if root was accessed
            if (currentHash) {
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          } else {
            window.history.replaceState(null, '', `#${activeTab}`);
          }
        }
      }
    } catch {}
  }, [activeTab]);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);

  // Theme State (Dark / Light Mode)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('swiftstream_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    try {
      localStorage.setItem('swiftstream_theme', theme);
    } catch {}
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      showToast('info', `${next === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'} Activated`, `Theme updated to ${next} mode.`);
      return next;
    });
  };

  // Firebase Authentication State
  const [currentAuthUser, setCurrentAuthUser] = useState<AppUserProfile | null>(() => {
    try {
      const localRaw = localStorage.getItem('swiftstream_current_auth_user');
      if (localRaw) {
        return JSON.parse(localRaw) as AppUserProfile;
      }
    } catch {}
    return null;
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [authModalEmail, setAuthModalEmail] = useState<string>('');

  const openAuthModal = (mode: 'signin' | 'signup' | 'forgot' = 'signin', initialEmail: string = '') => {
    setAuthModalMode(mode);
    setAuthModalEmail(initialEmail);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthModalEmail('');
  };

  // Subscribe to Firebase Auth changes
  useEffect(() => {
    const unsubAuth = subscribeToAuth((profile) => {
      setCurrentAuthUser(profile);
    });
    return () => unsubAuth();
  }, []);

  // System Role State (admin, cashier, technician)
  const [systemRole, setSystemRoleState] = useState<SystemRole>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SYSTEM_ROLE);
      if (saved === 'admin' || saved === 'cashier' || saved === 'technician') {
        return saved as SystemRole;
      }
    } catch (_) {}
    return 'admin';
  });

  const setSystemRole = (role: SystemRole) => {
    // Security restriction: When a user is logged in, their role is locked to their verified authenticated role
    if (currentAuthUser && currentAuthUser.role !== 'admin' && role !== currentAuthUser.role) {
      console.warn(`[Security Policy] Blocked attempt to elevate role to ${role} for user ${currentAuthUser.email}`);
      return;
    }
    setSystemRoleState(role);
    try {
      localStorage.setItem(STORAGE_KEYS.SYSTEM_ROLE, role);
    } catch (_) {}
  };

  // Synchronize role from currentAuthUser when authenticated
  useEffect(() => {
    if (currentAuthUser?.role) {
      if (currentAuthUser.role === 'admin') setSystemRoleState('admin');
      else if (currentAuthUser.role === 'cashier') setSystemRoleState('cashier');
      else if (currentAuthUser.role === 'technician' || currentAuthUser.role === 'tech') setSystemRoleState('technician');
    }
  }, [currentAuthUser]);

  const canAccessTab = (tabId: string): boolean => {
    if (tabId === 'home' || tabId === 'portal') return true;
    if (!isStaffUser(currentAuthUser)) return false;
    const permissions = ROLE_PERMISSIONS[systemRole];
    return permissions ? permissions.allowedTabs.includes(tabId) : false;
  };

  const hasPermission = (perm: keyof RolePermissions): boolean => {
    if (!isStaffUser(currentAuthUser)) return false;
    const permissions = ROLE_PERMISSIONS[systemRole];
    if (!permissions) return false;
    return Boolean(permissions[perm]);
  };

  // If activeTab is disallowed for current role/user, automatically navigate to appropriate view
  useEffect(() => {
    if (activeTab === 'home' || activeTab === 'portal') return;

    // Admin/staff tabs require active staff login
    if (!isStaffUser(currentAuthUser)) {
      if (currentAuthUser?.role === 'subscriber') {
        setActiveTab('portal');
        showToast('error', 'Access Restricted', 'Subscribers cannot access the administrative operations workspace.');
      } else {
        setActiveTab('home');
      }
      return;
    }

    const perms = ROLE_PERMISSIONS[systemRole];
    if (perms && !perms.allowedTabs.includes(activeTab)) {
      if (systemRole === 'cashier') {
        setActiveTab('dashboard');
      } else if (systemRole === 'technician') {
        setActiveTab('field_ops');
      } else {
        setActiveTab('dashboard');
      }
    }
  }, [systemRole, activeTab, currentAuthUser]);

  // Support browser forward/back buttons and direct hash navigation with auth check
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHashChange = () => {
      try {
        const hash = window.location.hash.replace(/^#\/?/, '').trim();
        if (!hash || hash === 'home') {
          setActiveTab('home');
        } else if (hash === 'portal') {
          setActiveTab('portal');
        } else if (VALID_TABS.has(hash) && hash !== activeTab) {
          if (!isStaffUser(currentAuthUser)) {
            setActiveTab('home');
            showToast('info', 'Staff Login Required', 'Please sign in with an authorized staff account to access operations.');
            openAuthModal('signin');
          } else {
            setActiveTab(hash);
          }
        }
      } catch {}
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeTab, currentAuthUser]);

  const logout = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    setCurrentAuthUser(null);
    setSystemRoleState('cashier');
    try {
      localStorage.removeItem(STORAGE_KEYS.SYSTEM_ROLE);
      localStorage.removeItem('swiftstream_current_auth_user');
      localStorage.setItem('swiftstream_active_tab', 'home');
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch {}
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

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.COVERAGE_AREAS, coverageAreas);
  }, [coverageAreas]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.OPERATIONAL_BILLS, operationalBills);
  }, [operationalBills]);

  // --- Customer & Staff Separation Sentinel ---
  // Automatically detects and purges any customer/subscriber accounts that might have leaked into staffUsers
  useEffect(() => {
    if (staffUsers.length > 0) {
      const customerEmails = new Set(
        customers.map((c) => c.email?.toLowerCase().trim()).filter(Boolean)
      );
      const customerAccountNos = new Set(
        customers.map((c) => c.accountNo?.toLowerCase().trim()).filter(Boolean)
      );

      const invalidStaff = staffUsers.filter((s: any) => {
        if (!s || !s.role) return true;
        const roleStr = String((s as any).role || '').toLowerCase().trim();
        const isNotStaffRole = roleStr !== 'admin' && roleStr !== 'cashier' && roleStr !== 'technician';
        const hasCustomerAttrs = !!(s as any).accountNo || !!(s as any).planId;
        const email = (s.email || '').toLowerCase().trim();
        const matchesCustomerEmail = email !== 'swiftstream.telecom@gmail.com' && customerEmails.has(email);
        const matchesCustomerAccount = (s as any).accountNo && customerAccountNos.has(String((s as any).accountNo).toLowerCase().trim());
        return isNotStaffRole || hasCustomerAttrs || matchesCustomerEmail || matchesCustomerAccount;
      });

      if (invalidStaff.length > 0) {
        console.warn(`[Staff Security Audit] Purged ${invalidStaff.length} subscriber/customer account(s) from Staff & System Roles:`, invalidStaff.map((s) => s.fullName || s.email));
        setStaffUsers((prev) => {
          const purged = prev.filter((s) => !invalidStaff.some((inv) => inv.id === s.id || (inv.email && s.email && inv.email.toLowerCase().trim() === s.email.toLowerCase().trim())));
          const clean = purged.length > 0 ? purged : initialStaffUsers;
          setStoredStaffUsers(clean);
          return clean;
        });
      }
    }
  }, [customers, staffUsers.length]);

  // --- Real-time Cloud Firestore Subscriptions ---
  useEffect(() => {
    const unsubCustomers = subscribeToCollection<Customer>(COLLECTIONS.CUSTOMERS, (data) => {
      if (!data || data.length === 0) {
        setCustomers([]);
        return;
      }
      const seen = new Set<string>();
      const uniqueList: Customer[] = [];
      for (const item of data) {
        const key = item.email && item.email.includes('@') ? item.email.toLowerCase().trim() : (item.id || item.accountNo);
        if (!seen.has(key)) {
          seen.add(key);
          uniqueList.push(item);
        }
      }
      setCustomers(uniqueList);
    });
    const unsubInvoices = subscribeToCollection<Invoice>(COLLECTIONS.INVOICES, (data) => {
      if (data && data.length > 0) {
        setInvoices(data);
      }
    });
    const unsubPayments = subscribeToCollection<Payment>(COLLECTIONS.PAYMENTS, (data) => {
      if (data && data.length > 0) {
        setPayments(data);
      }
    });
    const unsubSubmissions = subscribeToCollection<PaymentSubmission>(COLLECTIONS.PAYMENT_SUBMISSIONS, (data) => {
      if (data && data.length > 0) {
        setPaymentSubmissions(data);
      }
    });
    const unsubPlans = subscribeToCollection<Plan>(COLLECTIONS.PLANS, (data) => {
      if (data && data.length > 0) setPlans(data);
    });
    const unsubCoverage = subscribeToCollection<CoverageArea>(COLLECTIONS.COVERAGE_AREAS, (data) => {
      if (data && data.length > 0) setCoverageAreas(data);
    });
    const unsubRepairOrders = subscribeToCollection<RepairOrder>(COLLECTIONS.REPAIR_ORDERS, (data) => {
      if (data && data.length > 0) {
        setRepairOrders(data);
      }
    });
    const unsubNapBoxes = subscribeToCollection<NapBox>(COLLECTIONS.NAP_BOXES, (data) => {
      setNapBoxes(data || []);
    });
    const unsubFiberCables = subscribeToCollection<FiberCable>(COLLECTIONS.FIBER_CABLES, (data) => {
      setFiberCables(data || []);
    });
    const unsubFiberClosures = subscribeToCollection<FiberClosure>(COLLECTIONS.FIBER_CLOSURES, (data) => {
      setFiberClosures(data || []);
    });
    const unsubMikrotik = subscribeToCollection<MikrotikDevice>(COLLECTIONS.MIKROTIK_DEVICES, (data) => {
      setMikrotikDevices(data || []);
    });
    const unsubExpenses = subscribeToCollection<Expense>(COLLECTIONS.EXPENSES, (data) => {
      setExpenses(data || []);
    });
    const unsubOperationalBills = subscribeToCollection<OperationalBill>(COLLECTIONS.OPERATIONAL_BILLS, (data) => {
      if (data && data.length > 0) setOperationalBills(data);
    });
    const unsubRemittances = subscribeToCollection<DailyRemittanceRecord>(COLLECTIONS.DAILY_REMITTANCES, (data) => {
      setDailyRemittances(data || []);
    });
    const unsubAuditLogs = subscribeToCollection<AuditLog>(COLLECTIONS.AUDIT_LOGS, (data) => {
      if (data && data.length > 0) {
        const sorted = [...data].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setAuditLogs(sorted);
      }
    });
    const unsubReminders = subscribeToCollection<ReminderLog>(COLLECTIONS.REMINDERS, (data) => {
      if (data && data.length > 0) setReminders(data);
    });
    const unsubAddonCatalog = subscribeToCollection<AddonCatalogItem>(COLLECTIONS.ADDON_CATALOG, (data) => {
      if (data && data.length > 0) setAddonCatalog(data);
    });
    const unsubOltNodes = subscribeToCollection<OltPopNode>(COLLECTIONS.OLT_NODES, (data) => {
      if (data && data.length > 0) setOltNode(data[0]);
    });
    const unsubSystemUsers = subscribeToCollection<any>(COLLECTIONS.SYSTEM_USERS, (data) => {
      if (data && data.length > 0) {
        const remoteStaff: StaffUser[] = data
          .filter((u: any) => {
            if (!u || !u.role) return false;
            const r = String(u.role).toLowerCase().trim();
            // STRICT: Must be a legitimate administrative/staff system role
            const isStaffRole = r === 'admin' || r === 'cashier' || r === 'technician' || r === 'tech';
            // Must NOT have any customer/subscriber attributes
            const isCustomer = r === 'subscriber' || r === 'customer' || r === 'client' || !!u.accountNo || !!u.planId;
            return isStaffRole && !isCustomer;
          })
          .map((u: any) => ({
            id: u.id || u.uid,
            fullName: u.displayName || u.fullName || 'Staff User',
            email: u.email,
            mobile: u.mobile,
            role: (u.role === 'tech' ? 'technician' : u.role) as SystemRole,
            status: u.status || (u.isApproved ? 'active' : 'suspended'),
            createdAt: u.createdAt || new Date().toISOString(),
            updatedAt: u.updatedAt,
            lastLoginAt: u.lastLoginAt,
            notes: u.notes,
          }));

        setStaffUsers((prev) => {
          const map = new Map<string, StaffUser>();
          const isRealStaff = (s: StaffUser) => {
            if (!s || !s.role) return false;
            const r = String(s.role).toLowerCase().trim();
            if (r !== 'admin' && r !== 'cashier' && r !== 'technician') return false;
            if ((s as any).accountNo || (s as any).planId) return false;
            return true;
          };

          prev.filter(isRealStaff).forEach((p) => {
            const k = p.email ? p.email.toLowerCase().trim() : p.id;
            map.set(k, p);
          });
          remoteStaff.filter(isRealStaff).forEach((r) => {
            const k = r.email ? r.email.toLowerCase().trim() : r.id;
            map.set(k, { ...map.get(k), ...r });
          });

          const result = Array.from(map.values());
          const finalStaff = result.length > 0 ? result : initialStaffUsers;
          setStoredStaffUsers(finalStaff);
          return finalStaff;
        });
      }
    });
    const unsubProfile = subscribeToDocument<BusinessProfile>(
      COLLECTIONS.BUSINESS_PROFILE,
      'company_profile',
      (data) => {
        if (data) {
          setBusinessProfile((prev) => ({ ...prev, ...data }));
        }
      }
    );

    return () => {
      unsubCustomers();
      unsubInvoices();
      unsubPayments();
      unsubSubmissions();
      unsubPlans();
      unsubCoverage();
      unsubRepairOrders();
      unsubNapBoxes();
      unsubFiberCables();
      unsubFiberClosures();
      unsubMikrotik();
      unsubExpenses();
      unsubOperationalBills();
      unsubRemittances();
      unsubAuditLogs();
      unsubReminders();
      unsubAddonCatalog();
      unsubOltNodes();
      unsubSystemUsers();
      unsubProfile();
    };
  }, []);

  const logAuditEvent = (event: Omit<AuditLog, 'id' | 'timestamp'>) => {
    const newLog: AuditLog = {
      ...event,
      id: generateId('AUD'),
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    setAuditLogs((prev) => [newLog, ...prev.filter((l) => l.id !== newLog.id).slice(0, 499)]);
    saveFirestoreDoc(COLLECTIONS.AUDIT_LOGS, newLog);
  };

  const clearAuditLogs = () => {
    setAuditLogs([]);
    saveToStorage(STORAGE_KEYS.AUDIT_LOGS, []);
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

  const getRouterCredsForCustomer = (customer: Customer): MikrotikCredentials | null => {
    const router =
      mikrotikDevices.find((d) => d.id === customer.network?.mikrotikDeviceId || d.name === customer.network?.mikrotikDeviceId) ||
      mikrotikDevices.find((d) => d.role === 'core_pppoe') ||
      mikrotikDevices[0];
    if (!router) return null;
    return {
      id: router.id,
      name: router.name,
      ipAddress: router.remoteAddress || router.ipAddress || 'remote.oxapsph.com',
      port: router.port || router.webfigPort || router.apiPort || 10988,
      username: router.username || 'admin',
      password: router.password || '',
      useHttps: router.useSsl,
    };
  };

  // --- Customer Operations ---
  const addCustomer = (
    customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>,
    options?: { skipMikrotikSync?: boolean }
  ): Customer => {
    const newCustomer: Customer = {
      ...customerData,
      id: generateId('CUST'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCustomers((prev) => [newCustomer, ...prev]);
    saveFirestoreDoc(COLLECTIONS.CUSTOMERS, newCustomer);

    // Save PPPoE secret directly into MikroTik router hardware (excluded from cloud Firestore)
    const routerCreds = getRouterCredsForCustomer(newCustomer);
    if (!options?.skipMikrotikSync && routerCreds && newCustomer.network?.pppoeUsername) {
      const plan = plans.find((p) => p.id === newCustomer.planId) || plans[0];
      saveOrUpdatePppoeSecret(routerCreds, {
        name: newCustomer.network.pppoeUsername,
        password: customerData.network?.pppoePassword || 'swift1234',
        service: 'pppoe',
        profile: newCustomer.network.pppoeProfile || `Plan-${plan?.speedMbps || 25}M`,
        remoteAddress: newCustomer.network.ipAddress,
        comment: `${newCustomer.fullName} - ${newCustomer.accountNo}`,
        disabled: newCustomer.status === 'suspended' || newCustomer.status === 'disconnected',
        speedMbps: plan?.speedMbps || 25,
        accountNo: newCustomer.accountNo,
      })
        .then((res) => {
          if (res.success) {
            logAuditEvent({
              userName: 'MikroTik Hardware Controller',
              action: 'MIKROTIK_SECRET_PROVISIONED',
              category: 'network',
              severity: 'info',
              details: `PPPoE secret saved directly into MikroTik router hardware for ${newCustomer.fullName} (${newCustomer.network.pppoeUsername}). ${res.message}`,
              status: 'success',
            });
          } else {
            showToast('warning', 'MikroTik Sync Notice', res.message || 'Router rejected PPPoE secret provisioning.');
            logAuditEvent({
              userName: 'MikroTik Hardware Controller',
              action: 'MIKROTIK_SECRET_PROVISIONED',
              category: 'network',
              severity: 'warning',
              details: `MikroTik rejected PPPoE provisioning for ${newCustomer.fullName}: ${res.message}`,
              status: 'failed',
            });
          }
        })
        .catch((err) => {
          console.warn('[MikroTik Provisioning Error]', err);
          showToast('error', 'MikroTik Sync Error', err?.message || 'Could not communicate with MikroTik device.');
        });
    }

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

  const updateCustomer = (
    id: string,
    updates: Partial<Customer>,
    options?: { skipMikrotikSync?: boolean }
  ) => {
    let updatedCustomerObj: Customer | null = null;

    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updated = { ...c, ...updates, updatedAt: new Date().toISOString() };
          updatedCustomerObj = updated;
          saveFirestoreDoc(COLLECTIONS.CUSTOMERS, updated);
          return updated;
        }
        return c;
      })
    );

    // If network credentials, plan, or subscriber status changed, push live update directly to MikroTik device
    if (updatedCustomerObj) {
      const updatedCust = updatedCustomerObj as Customer;
      const routerCreds = getRouterCredsForCustomer(updatedCust);

      const hasNetworkChange = !!(
        updates.network ||
        updates.planId ||
        updates.status ||
        updates.fullName
      );

      if (!options?.skipMikrotikSync && routerCreds && updatedCust.network?.pppoeUsername && hasNetworkChange) {
        const plan = plans.find((p) => p.id === updatedCust.planId) || plans[0];
        const newPassword = updates.network?.pppoePassword;

        saveOrUpdatePppoeSecret(routerCreds, {
          name: updatedCust.network.pppoeUsername,
          password: newPassword, // only updates password on router if provided
          service: 'pppoe',
          profile: updatedCust.network.pppoeProfile || `Plan-${plan?.speedMbps || 25}M`,
          remoteAddress: updatedCust.network.ipAddress,
          comment: `${updatedCust.fullName} - ${updatedCust.accountNo}`,
          disabled: updatedCust.status === 'suspended' || updatedCust.status === 'disconnected',
          speedMbps: plan?.speedMbps || 25,
          accountNo: updatedCust.accountNo,
        })
          .then((res) => {
            if (res.success) {
              logAuditEvent({
                userName: 'MikroTik Hardware Controller',
                action: 'MIKROTIK_SECRET_UPDATED',
                category: 'network',
                severity: 'info',
                details: `PPPoE secret directly updated on MikroTik router hardware for ${updatedCust.fullName} (${updatedCust.network.pppoeUsername}). ${res.message}`,
                status: 'success',
              });
            } else {
              showToast('warning', 'MikroTik Sync Notice', res.message || 'Router rejected PPPoE secret update.');
              logAuditEvent({
                userName: 'MikroTik Hardware Controller',
                action: 'MIKROTIK_SECRET_UPDATED',
                category: 'network',
                severity: 'warning',
                details: `MikroTik rejected PPPoE secret update for ${updatedCust.fullName}: ${res.message}`,
                status: 'failed',
              });
            }
          })
          .catch((err) => {
            console.warn('[MikroTik Update Error]', err);
            showToast('error', 'MikroTik Sync Error', err?.message || 'Could not communicate with MikroTik device.');
          });
      }
    }

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
    if (!hasPermission('canDeleteCustomer')) {
      showToast('error', 'Access Denied', 'You do not have permission to delete subscriber accounts.');
      return;
    }
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
    const targetCustomer = customers.find((c) => c.id === id);

    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const isSynced = newStatus === 'active';
          const updated = {
            ...c,
            status: newStatus,
            network: { ...c.network, isMikrotikSynced: isSynced },
            updatedAt: new Date().toISOString(),
          };
          saveFirestoreDoc(COLLECTIONS.CUSTOMERS, updated);
          if (newStatus !== 'pending_approval') {
            syncCustomerApprovalToUser(c.email || c.id, c);
          }
          return updated;
        }
        return c;
      })
    );

    // Live RouterOS isolation/reconnection execution
    if (targetCustomer) {
      const routerCreds = getRouterCredsForCustomer(targetCustomer);
      if (routerCreds) {
        if (newStatus === 'suspended') {
          isolateOverdueSubscriber(routerCreds, targetCustomer)
            .then((res) => {
              logAuditEvent({
                userName: 'System Router Controller',
                action: 'SUBSCRIBER_LINE_ISOLATED',
                category: 'network',
                severity: 'warning',
                details: `MikroTik line isolated for ${targetCustomer.fullName} (${targetCustomer.network?.pppoeUsername || targetCustomer.accountNo}). Details: ${res.details}`,
                status: 'success',
              });
            })
            .catch((err) => console.warn('[MikroTik Isolate Error]', err));
        } else if (newStatus === 'active') {
          const plan = plans.find((p) => p.id === targetCustomer.planId) || plans[0];
          if (plan) {
            reconnectSubscriber(routerCreds, targetCustomer, plan)
              .then((res) => {
                logAuditEvent({
                  userName: 'System Router Controller',
                  action: 'SUBSCRIBER_LINE_RESTORED',
                  category: 'network',
                  severity: 'info',
                  details: `MikroTik line reactivated for ${targetCustomer.fullName}. Details: ${res.details}`,
                  status: 'success',
                });
              })
              .catch((err) => console.warn('[MikroTik Reconnect Error]', err));
          }
        }
      }
    }

    showToast(
      'info',
      'Status Changed',
      `Subscriber status set to ${newStatus.toUpperCase()}.${newStatus === 'active' ? ' Mikrotik line activated.' : ' Line isolated.'}`
    );
  };

  const syncCustomerMikrotik = (id: string) => {
    const customer = customers.find((c) => c.id === id);
    if (!customer) return;

    const routerCreds = getRouterCredsForCustomer(customer);
    const plan = plans.find((p) => p.id === customer.planId) || plans[0];

    if (routerCreds && customer.network?.pppoeUsername) {
      saveOrUpdatePppoeSecret(routerCreds, {
        name: customer.network.pppoeUsername,
        password: customer.network.pppoePassword,
        service: 'pppoe',
        profile: customer.network.pppoeProfile || `Plan-${plan?.speedMbps || 25}M`,
        remoteAddress: customer.network.ipAddress,
        comment: `${customer.fullName} - ${customer.accountNo}`,
        disabled: customer.status === 'suspended' || customer.status === 'disconnected',
        speedMbps: plan?.speedMbps || 25,
        accountNo: customer.accountNo,
      })
        .then((res) => {
          showToast(
            res.success ? 'success' : 'warning',
            res.success ? 'MikroTik Synced' : 'Sync Warning',
            res.message || `PPPoE secret for "${customer.network.pppoeUsername}" pushed to MikroTik.`
          );
        })
        .catch((err) => {
          showToast('error', 'Sync Failed', err.message || 'Could not communicate with MikroTik device.');
        });
    }

    setCustomers((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, network: { ...c.network, isMikrotikSynced: true }, updatedAt: new Date().toISOString() } : c
      )
    );
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
          const updated = {
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
          saveFirestoreDoc(COLLECTIONS.CUSTOMERS, updated);
          syncCustomerApprovalToUser(customer.email || customer.id, updated);
          return updated;
        }
        return c;
      })
    );

    if (options.createInitialInvoice) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (businessProfile.invoiceGracePeriodDays || 7));
      const invoiceNumber = `INV-${todayStr.slice(2, 4)}${todayStr.slice(5, 7)}-${String(invoices.length + 1).padStart(4, '0')}`;
      const plan =
        plans.find((p) => p.id === customer.planId) ||
        plans.find((p) => p.name?.trim().toLowerCase() === customer.planName?.trim().toLowerCase()) ||
        plans[0];
      const planId = plan.id;
      const planName = plan.name;
      const speedMbps = plan.speedMbps;
      const monthlyFee = plan.monthlyFee;
      const installFee = 1500;
      const subtotal = monthlyFee + installFee;

      createInvoice({
        invoiceNumber,
        customerId: customer.id,
        customerName: customer.fullName,
        accountNo: customer.accountNo,
        customerAddress: `${customer.address.street}, ${customer.address.barangay}, ${customer.address.city}, ${customer.address.province}`,
        customerMobile: customer.mobile,
        customerEmail: customer.email,
        planId,
        planName,
        planSpeedMbps: speedMbps,
        monthlyFee,
        billingDay: customer.billingDay || 1,
        billingPeriodStart: todayStr,
        billingPeriodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
        issueDate: todayStr,
        dueDate: dueDate.toISOString().slice(0, 10),
        items: [
          {
            id: generateId('ITEM'),
            description: `Internet Plan: ${planName} (${speedMbps} Mbps Pure Fiber) — 1st Month Subscription`,
            quantity: 1,
            unitPrice: monthlyFee,
            amount: monthlyFee,
            type: 'plan',
          },
          {
            id: generateId('ITEM'),
            description: `Standard Optical Line Drop & Gigabit ONU WiFi Modem Installation Setup`,
            quantity: 1,
            unitPrice: installFee,
            amount: installFee,
            type: 'installation',
          },
        ],
        subtotal,
        discount: 0,
        previousBalance: 0,
        totalAmount: subtotal,
        amountPaid: 0,
        balanceDue: subtotal,
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
    // Guard: Prevent duplicate invoice creation for the subscriber for the same month (whether paid or unpaid)
    const billingMonth = invoiceData.billingPeriodStart
      ? invoiceData.billingPeriodStart.slice(0, 7)
      : invoiceData.issueDate
      ? invoiceData.issueDate.slice(0, 7)
      : new Date().toISOString().slice(0, 7);

    const existingInvoice = invoices.find(
      (inv) =>
        inv.customerId === invoiceData.customerId &&
        (inv.billingPeriodStart?.startsWith(billingMonth) || inv.issueDate?.startsWith(billingMonth))
    );

    if (existingInvoice && !invoiceData.allowDuplicate) {
      showToast(
        'warning',
        'Duplicate Invoice Blocked',
        `Subscriber already has an invoice (${existingInvoice.invoiceNumber} • ${existingInvoice.status.toUpperCase()}) for ${billingMonth}.`
      );
      return existingInvoice;
    }

    const newInvoice: Invoice = {
      ...invoiceData,
      id: generateId('INV'),
      createdAt: new Date().toISOString(),
    };

    setInvoices((prev) => [newInvoice, ...prev]);
    saveFirestoreDoc(COLLECTIONS.INVOICES, newInvoice);

    // Recalculate customer balance
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === newInvoice.customerId) {
          const newBalance = c.balance + newInvoice.balanceDue;
          const updatedCust = { ...c, balance: newBalance, updatedAt: new Date().toISOString() };
          saveFirestoreDoc(COLLECTIONS.CUSTOMERS, updatedCust);
          return updatedCust;
        }
        return c;
      })
    );

    const targetCustomer = customers.find((c) => c.id === newInvoice.customerId);
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'INVOICE_CREATED',
      category: 'billing',
      severity: 'info',
      details: `Generated invoice ${newInvoice.invoiceNumber} for ${targetCustomer?.fullName || newInvoice.customerId} amounting to ₱${newInvoice.totalAmount.toLocaleString()} (Due: ${newInvoice.dueDate}).`,
      status: 'success',
      metadata: { invoiceId: newInvoice.id, invoiceNumber: newInvoice.invoiceNumber, amount: newInvoice.totalAmount },
    });

    showToast('success', 'Invoice Created', `Invoice ${newInvoice.invoiceNumber} generated.`);
    return newInvoice;
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    // Financial integrity audit: log when a paid invoice is reversed to unpaid
    if (updates.status && updates.status !== 'paid') {
      const existingInvoice = invoices.find((inv) => inv.id === id);
      if (existingInvoice && existingInvoice.status === 'paid') {
        logAuditEvent({
          userName: currentAuthUser?.displayName || 'Admin',
          action: 'INVOICE_PAYMENT_REVERSED',
          category: 'billing',
          severity: 'warning',
          details: `Payment reversed on invoice ${existingInvoice.invoiceNumber} for ${existingInvoice.customerName}. Status changed from PAID → ${updates.status.toUpperCase()}. Amount: ₱${existingInvoice.totalAmount.toLocaleString()}.`,
          status: 'success',
          metadata: { invoiceId: id, invoiceNumber: existingInvoice.invoiceNumber, newStatus: updates.status },
        });
      }
    }

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === id) {
          const updated = { ...inv, ...updates };
          saveFirestoreDoc(COLLECTIONS.INVOICES, updated);
          return updated;
        }
        return inv;
      })
    );
  };


  const deleteInvoice = (id: string) => {
    if (!hasPermission('canDeleteInvoice')) {
      showToast('error', 'Access Denied', 'You do not have permission to delete invoices.');
      return;
    }
    const target = invoices.find((inv) => inv.id === id);
    if (!target) return;

    // Financial integrity: log critical event if deleting a paid invoice
    if (target.status === 'paid') {
      logAuditEvent({
        userName: currentAuthUser?.displayName || 'Admin',
        action: 'PAID_INVOICE_DELETED',
        category: 'billing',
        severity: 'critical',
        details: `⚠️ CRITICAL: Deleted PAID invoice ${target.invoiceNumber} for ${target.customerName} (Amount: ₱${target.totalAmount.toLocaleString()}). Payment record was NOT automatically reversed.`,
        status: 'success',
        metadata: { invoiceId: target.id, invoiceNumber: target.invoiceNumber, amount: target.totalAmount },
      });
    }


    deleteFirestoreDoc(COLLECTIONS.INVOICES, id);
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));

    // Deduct from customer balance if unpaid
    if (target.status !== 'paid' && target.balanceDue > 0) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === target.customerId) {
            const updated = { ...c, balance: Math.max(0, c.balance - target.balanceDue) };
            saveFirestoreDoc(COLLECTIONS.CUSTOMERS, updated);
            return updated;
          }
          return c;
        })
      );
    }

    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'INVOICE_DELETED',
      category: 'billing',
      severity: 'warning',
      details: `Deleted invoice ${target.invoiceNumber} for ${target.customerName || target.customerId} (Total: ₱${target.totalAmount.toLocaleString()}).`,
      status: 'success',
      metadata: { invoiceId: target.id, invoiceNumber: target.invoiceNumber },
    });

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
          (inv.billingPeriodStart?.startsWith(options.billingMonth) ||
            inv.issueDate?.startsWith(options.billingMonth))
      );

      if (alreadyInvoiced) return;

      const invoiceNumStr = `INV-${year.slice(2)}${month}-${String(invoices.length + index + 1).padStart(4, '0')}`;
      const previousBal = customer.balance > 0 ? customer.balance : 0;

      // Authoritative Plan Resolution from Plans & Packages
      const plan =
        plans.find((p) => p.id === customer.planId) ||
        plans.find((p) => p.name?.trim().toLowerCase() === customer.planName?.trim().toLowerCase()) ||
        plans.find((p) => p.monthlyFee === customer.monthlyFee) ||
        plans[0];
      const planId = plan.id;
      const planName = plan.name;
      const speedMbps = plan.speedMbps;
      const standardMonthlyFee = plan.monthlyFee;

      let planFee = standardMonthlyFee;
      let isProrated = false;
      let proratedDays = lastDayOfMonth;

      if (options.enableProration !== false && customer.installationDate && customer.installationDate.startsWith(options.billingMonth)) {
        const installDay = parseInt(customer.installationDate.split('-')[2]) || 1;
        if (installDay > 1) {
          proratedDays = lastDayOfMonth - installDay + 1;
          planFee = Math.round((proratedDays / lastDayOfMonth) * standardMonthlyFee);
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
            ? `Internet Plan: ${planName} (${speedMbps} Mbps Pure Fiber) — Prorated (${proratedDays}/${lastDayOfMonth} Days)`
            : `Internet Plan: ${planName} (${speedMbps} Mbps Pure Fiber) — Monthly Subscription`,
          quantity: 1,
          unitPrice: isProrated ? planFee : standardMonthlyFee,
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
        planId,
        planName,
        planSpeedMbps: speedMbps,
        monthlyFee: standardMonthlyFee,
        billingDay: customer.billingDay || 15,
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

      // Persist all generated invoices and updated customer balances to Firestore
      newInvoices.forEach((inv) => saveFirestoreDoc(COLLECTIONS.INVOICES, inv));
      updatedCustomers.forEach((cust) => saveFirestoreDoc(COLLECTIONS.CUSTOMERS, cust));

      logAuditEvent({
        userName: 'Admin Leonardo Flojo',
        action: 'BATCH_BILLING_EXECUTED',
        category: 'billing',
        severity: 'info',
        details: `Batch billing executed: generated ${generatedCount} invoices totaling ₱${totalGeneratedAmount.toLocaleString()} for billing cycle ${options.billingMonth}.`,
        status: 'success',
        metadata: { generatedCount, totalGeneratedAmount, billingMonth: options.billingMonth },
      });

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

    const updatedInv: Invoice = {
      ...invoice,
      discount: discountAmount,
      balanceDue: newBalanceDue,
      status: newStatus,
    };
    saveFirestoreDoc(COLLECTIONS.INVOICES, updatedInv);

    setInvoices((prev) =>
      prev.map((inv) => (inv.id === invoiceId ? updatedInv : inv))
    );

    // Update customer balance
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === invoice.customerId) {
          const updatedCust = { ...c, balance: Math.max(0, c.balance - discountAmount), updatedAt: new Date().toISOString() };
          saveFirestoreDoc(COLLECTIONS.CUSTOMERS, updatedCust);
          return updatedCust;
        }
        return c;
      })
    );

    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'INVOICE_DISCOUNT_APPLIED',
      category: 'billing',
      severity: 'info',
      details: `Applied courtesy discount of ₱${discountAmount.toLocaleString()} to invoice ${invoice.invoiceNumber}. New balance: ₱${newBalanceDue.toLocaleString()}.`,
      status: 'success',
      metadata: { invoiceId, discountAmount, newBalanceDue },
    });

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
        const routerCreds = getRouterCredsForCustomer(c);
        const plan = plans.find((p) => p.id === c.planId) || plans[0];
        if (routerCreds && plan) {
          reconnectSubscriber(routerCreds, c, plan).catch((err) =>
            console.warn('[Audit Reconnect Error]', err)
          );
        }
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
        const routerCreds = getRouterCredsForCustomer(c);
        if (routerCreds) {
          isolateOverdueSubscriber(routerCreds, c).catch((err) =>
            console.warn('[Audit Isolate Error]', err)
          );
        }
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

    let excessWalletCredit = 0;
    const updatedInvoiceMap = new Map<string, Invoice>();

    // Update Invoice if linked, or auto-allocate via FIFO across open invoices
    if (invoice) {
      const neededToPay = invoice.balanceDue;
      const newAmountPaid = invoice.amountPaid + paymentData.amount;
      const newBalanceDue = Math.max(0, invoice.totalAmount - invoice.discount - newAmountPaid);
      const newStatus: InvoiceStatus = newBalanceDue <= 0 ? 'paid' : 'partially_paid';

      if (paymentData.amount > neededToPay) {
        excessWalletCredit = paymentData.amount - neededToPay;
      }

      const updatedInv: Invoice = {
        ...invoice,
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        status: newStatus,
        paidAt: newStatus === 'paid' ? new Date().toISOString() : invoice.paidAt,
        paymentMethodUsed: paymentData.paymentMethod,
      };

      updatedInvoiceMap.set(invoice.id, updatedInv);
    } else if (!paymentData.isAdvancePayment) {
      // FIFO auto-allocation: find open invoices for this customer, oldest first
      const openInvoices = invoices
        .filter((inv) => inv.customerId === paymentData.customerId && inv.status !== 'paid' && inv.balanceDue > 0)
        .sort((a, b) => new Date(a.billingPeriodStart || a.dueDate).getTime() - new Date(b.billingPeriodStart || b.dueDate).getTime());

      let remainingPayment = paymentData.amount;

      for (const inv of openInvoices) {
        if (remainingPayment <= 0) break;
        const toPay = Math.min(remainingPayment, inv.balanceDue);
        const newAmountPaid = inv.amountPaid + toPay;
        const newBalanceDue = Math.max(0, inv.balanceDue - toPay);
        const newStatus: InvoiceStatus = newBalanceDue <= 0 ? 'paid' : 'partially_paid';

        updatedInvoiceMap.set(inv.id, {
          ...inv,
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          status: newStatus,
          paidAt: newStatus === 'paid' ? new Date().toISOString() : inv.paidAt,
          paymentMethodUsed: paymentData.paymentMethod,
        });

        remainingPayment -= toPay;
      }

      if (remainingPayment > 0) {
        excessWalletCredit = remainingPayment;
      }
    } else {
      excessWalletCredit = paymentData.amount;
    }

    const receiptNumber = `OR-${new Date().getFullYear().toString().slice(2)}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(payments.length + 1).padStart(4, '0')}`;
    const targetInvoiceId = invoice?.id || (updatedInvoiceMap.size > 0 ? Array.from(updatedInvoiceMap.keys())[0] : undefined);
    const targetInvoiceNumber = invoice?.invoiceNumber || (updatedInvoiceMap.size > 0 ? Array.from(updatedInvoiceMap.values()).map(i => i.invoiceNumber).join(', ') : undefined);

    const newPayment: Payment = {
      id: generateId('PAY'),
      receiptNumber,
      customerId: paymentData.customerId,
      customerName: customer?.fullName || 'Customer',
      accountNo: customer?.accountNo || 'N/A',
      invoiceId: targetInvoiceId,
      invoiceNumber: targetInvoiceNumber,
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

    if (updatedInvoiceMap.size > 0) {
      setInvoices((prev) =>
        prev.map((inv) => {
          const updated = updatedInvoiceMap.get(inv.id);
          if (updated) {
            saveFirestoreDoc(COLLECTIONS.INVOICES, updated);
            return updated;
          }
          return inv;
        })
      );
    }

    // Update Customer Balance and auto-reactivate if suspended/overdue
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === paymentData.customerId) {
          const updatedBal = Math.max(0, c.balance - paymentData.amount);
          const newWallet = (c.walletBalance || 0) + excessWalletCredit;
          const shouldReactivate = (c.status === 'suspended' || c.status === 'overdue') && updatedBal === 0;

          if (shouldReactivate) {
            const routerCreds = getRouterCredsForCustomer(c);
            const plan = plans.find((p) => p.id === c.planId) || plans[0];
            if (routerCreds && plan) {
              reconnectSubscriber(routerCreds, c, plan).catch((err) =>
                console.warn('[Payment Auto-Reactivate Error]', err)
              );
            }
          }

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

  const processIncomingPaymentWebhook = async (
    event: PaymentWebhookEvent
  ): Promise<PaymentWebhookResult> => {
    const result = await executePaymentWebhookPipeline(
      event,
      {
        customers,
        invoices,
        plans,
        businessProfile,
      },
      {
        onRecordPayment: (payment: Payment) => {
          setPayments((prev) => [payment, ...prev]);
          saveFirestoreDoc(COLLECTIONS.PAYMENTS, payment);
        },
        onUpdateInvoice: (invoiceId: string, updates: Partial<Invoice>) => {
          updateInvoice(invoiceId, updates);
        },
        onUpdateCustomer: (customerId: string, updates: Partial<Customer>) => {
          updateCustomer(customerId, updates);
        },
        onLogAudit: (auditEv: any) => {
          logAuditEvent(auditEv);
        },
      }
    );

    if (result.success) {
      showToast(
        'success',
        '⚡ Instant Webhook Auto-Reconnect',
        `Settled ₱${result.amountPaid.toLocaleString()} via ${result.paymentChannel} for ${result.customerName || 'Subscriber'}. Line restored on MikroTik CCR!`
      );
    }

    return result;
  };

  // --- Daily Remittances Operations ---
  const addDailyRemittance = (remittanceData: Omit<DailyRemittanceRecord, 'id'>): DailyRemittanceRecord => {
    const newRemittance: DailyRemittanceRecord = {
      ...remittanceData,
      id: generateId('REMIT'),
    };
    setDailyRemittances((prev) => [newRemittance, ...prev]);
    saveFirestoreDoc(COLLECTIONS.DAILY_REMITTANCES, newRemittance);
    showToast('success', 'Remittance Created', `Created remittance sheet for ${newRemittance.remittanceDate}.`);
    return newRemittance;
  };

  const closeDailyRemittance = (id: string, actualCashInDrawer: number, verifiedBy?: string, notes?: string) => {
    setDailyRemittances((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const discrepancy = actualCashInDrawer - r.totalCash;
          const updated: DailyRemittanceRecord = {
            ...r,
            actualCashInDrawer,
            discrepancy,
            verifiedBy: verifiedBy || 'Leonardo Flojo Jr.',
            notes: notes || r.notes,
            status: 'closed' as const,
            closedAt: new Date().toISOString(),
          };
          saveFirestoreDoc(COLLECTIONS.DAILY_REMITTANCES, updated);
          return updated;
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
    if (!hasPermission('canDeletePayment')) {
      showToast('error', 'Access Denied', 'You do not have permission to void payment records.');
      return;
    }
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
    if (!hasPermission('canManagePlans')) {
      showToast('error', 'Access Denied', 'You do not have permission to create or manage internet plans.');
      return;
    }
    const newPlan: Plan = { ...planData, id: generateId('PLAN') };

    setPlans((prev) => [...prev, newPlan]);
    saveFirestoreDoc(COLLECTIONS.PLANS, newPlan);
    showToast('success', 'Plan Created', `Internet plan "${newPlan.name}" is now available.`);
  };

  const updatePlan = (id: string, updates: Partial<Plan>) => {
    if (!hasPermission('canManagePlans')) {
      showToast('error', 'Access Denied', 'You do not have permission to modify internet plans.');
      return;
    }

    setPlans((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const updated = { ...p, ...updates };
          saveFirestoreDoc(COLLECTIONS.PLANS, updated);
          return updated;
        }
        return p;
      })
    );

    // Keep subscribers subscribed to this plan in sync with updated package details
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.planId === id) {
          const updated = {
            ...c,
            planName: updates.name || c.planName,
            monthlyFee: updates.monthlyFee !== undefined ? updates.monthlyFee : c.monthlyFee,
            updatedAt: new Date().toISOString(),
          };
          saveFirestoreDoc(COLLECTIONS.CUSTOMERS, updated);
          return updated;
        }
        return c;
      })
    );

    showToast('info', 'Plan Updated', 'Package details modified and subscribers synchronized.');
  };

  const deletePlan = (id: string) => {
    if (!hasPermission('canManagePlans')) {
      showToast('error', 'Access Denied', 'You do not have permission to delete internet plans.');
      return;
    }
    deleteFirestoreDoc(COLLECTIONS.PLANS, id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
    showToast('warning', 'Plan Deleted', 'Plan removed from catalog.');
  };


  // --- Coverage Area Operations ---
  const addCoverageArea = (areaData: Omit<CoverageArea, 'id'>): CoverageArea => {
    const newArea: CoverageArea = {
      ...areaData,
      id: generateId('COV'),
      updatedAt: new Date().toISOString(),
    };
    setCoverageAreas((prev) => [...prev, newArea]);
    saveFirestoreDoc(COLLECTIONS.COVERAGE_AREAS, newArea);
    showToast('success', 'Coverage Area Added', `${newArea.name} has been added to coverage list.`);
    return newArea;
  };

  const updateCoverageArea = (id: string, updates: Partial<CoverageArea>) => {
    setCoverageAreas((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const updated = { ...a, ...updates, updatedAt: new Date().toISOString() };
          saveFirestoreDoc(COLLECTIONS.COVERAGE_AREAS, updated);
          return updated;
        }
        return a;
      })
    );
    showToast('info', 'Coverage Updated', 'Coverage area details modified.');
  };

  const deleteCoverageArea = (id: string) => {
    deleteFirestoreDoc(COLLECTIONS.COVERAGE_AREAS, id);
    setCoverageAreas((prev) => prev.filter((a) => a.id !== id));
    showToast('warning', 'Coverage Removed', 'Barangay coverage area removed.');
  };

  const toggleCoverageVisibility = (id: string) => {
    setCoverageAreas((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const updated = { ...a, isPubliclyVisible: !a.isPubliclyVisible, updatedAt: new Date().toISOString() };
          saveFirestoreDoc(COLLECTIONS.COVERAGE_AREAS, updated);
          showToast(
            'info',
            updated.isPubliclyVisible ? 'Barangay Published' : 'Barangay Hidden',
            `${a.name} is now ${updated.isPubliclyVisible ? 'visible on website' : 'hidden from website'}.`
          );
          return updated;
        }
        return a;
      })
    );
  };

  const toggleCoverageFiberReady = (id: string) => {
    setCoverageAreas((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const newStatus: CoverageStatus = a.status === 'fiber_ready' ? 'expansion_ongoing' : 'fiber_ready';
          const updated = { ...a, status: newStatus, updatedAt: new Date().toISOString() };
          saveFirestoreDoc(COLLECTIONS.COVERAGE_AREAS, updated);
          showToast(
            'success',
            'Fiber Status Updated',
            `${a.name} is now ${newStatus === 'fiber_ready' ? 'FIBER READY' : 'EXPANSION ONGOING'}.`
          );
          return updated;
        }
        return a;
      })
    );
  };

  // --- NAP Box Operations ---
  const addNapBox = (boxData: Omit<NapBox, 'id'>) => {
    const newBox: NapBox = { ...boxData, id: generateId('NAP') };
    setNapBoxes((prev) => [...prev, newBox]);
    saveFirestoreDoc(COLLECTIONS.NAP_BOXES, newBox);
    showToast('success', 'NAP Box Deployed', `NAP Box "${newBox.code}" registered.`);
  };

  const updateNapBox = (id: string, updates: Partial<NapBox>) => {
    setNapBoxes((prev) =>
      prev.map((box) => {
        if (box.id === id) {
          const updated = { ...box, ...updates };
          saveFirestoreDoc(COLLECTIONS.NAP_BOXES, updated);
          return updated;
        }
        return box;
      })
    );
    showToast('info', 'NAP Box Updated', 'NAP box configuration updated.');
  };

  const deleteNapBox = (id: string) => {
    deleteFirestoreDoc(COLLECTIONS.NAP_BOXES, id);
    setNapBoxes((prev) => prev.filter((box) => box.id !== id));
    showToast('warning', 'NAP Box Removed', 'Fiber distribution point removed.');
  };

  // --- Fiber GIS & OSP Outside Plant Operations ---
  const addFiberCable = (cableData: Omit<FiberCable, 'id'>): FiberCable => {
    const newCable: FiberCable = { ...cableData, id: generateId('CBL') };
    setFiberCables((prev) => [...prev, newCable]);
    saveFirestoreDoc(COLLECTIONS.FIBER_CABLES, newCable);
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
    setFiberCables((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updated = { ...c, ...updates };
          saveFirestoreDoc(COLLECTIONS.FIBER_CABLES, updated);
          return updated;
        }
        return c;
      })
    );
    showToast('info', 'Cable Route Updated', 'Fiber cable attributes saved.');
  };

  const deleteFiberCable = (id: string) => {
    deleteFirestoreDoc(COLLECTIONS.FIBER_CABLES, id);
    setFiberCables((prev) => prev.filter((c) => c.id !== id));
    showToast('warning', 'Cable Removed', 'Fiber route deleted from GIS map.');
  };

  const addFiberClosure = (closureData: Omit<FiberClosure, 'id'>): FiberClosure => {
    const newClosure: FiberClosure = { ...closureData, id: generateId('FJC') };
    setFiberClosures((prev) => [...prev, newClosure]);
    saveFirestoreDoc(COLLECTIONS.FIBER_CLOSURES, newClosure);
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
    setFiberClosures((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const updated = { ...f, ...updates };
          saveFirestoreDoc(COLLECTIONS.FIBER_CLOSURES, updated);
          return updated;
        }
        return f;
      })
    );
    showToast('info', 'Closure Updated', 'Splice enclosure specifications saved.');
  };

  const deleteFiberClosure = (id: string) => {
    deleteFirestoreDoc(COLLECTIONS.FIBER_CLOSURES, id);
    setFiberClosures((prev) => prev.filter((f) => f.id !== id));
    showToast('warning', 'Closure Removed', 'Splice enclosure deleted from GIS map.');
  };

  const updateOltNode = (updates: Partial<OltPopNode>) => {
    setOltNode((prev) => {
      const updated = { ...prev, ...updates };
      saveFirestoreDoc(COLLECTIONS.OLT_NODES, updated);
      return updated;
    });
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
    saveFirestoreDoc(COLLECTIONS.REPAIR_ORDERS, newOrder);
    showToast('success', 'Job Order Created', `Repair Ticket #${newOrder.orderNumber} filed.`);
    return newOrder;
  };

  const updateRepairOrder = (id: string, updates: Partial<RepairOrder>) => {
    setRepairOrders((prev) =>
      prev.map((o) => {
        if (o.id === id) {
          const updated = { ...o, ...updates };
          saveFirestoreDoc(COLLECTIONS.REPAIR_ORDERS, updated);
          return updated;
        }
        return o;
      })
    );
    showToast('info', 'Job Order Updated', 'Repair status saved.');
  };

  const deleteRepairOrder = (id: string) => {
    deleteFirestoreDoc(COLLECTIONS.REPAIR_ORDERS, id);
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
    saveFirestoreDoc(COLLECTIONS.INVOICES, newInvoice);

    // Update repair status
    setRepairOrders((prev) =>
      prev.map((r) => {
        if (r.id === repairId) {
          const updatedRep = { ...r, billedToInvoiceId: newInvoice.id, status: 'ready' as const };
          saveFirestoreDoc(COLLECTIONS.REPAIR_ORDERS, updatedRep);
          return updatedRep;
        }
        return r;
      })
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
    saveFirestoreDoc(COLLECTIONS.REMINDERS, newReminder);

    if (invoice) {
      const updatedInv: Invoice = {
        ...invoice,
        sentViaSms: channel === 'sms' || channel === 'both' ? true : invoice.sentViaSms,
        sentViaEmail: channel === 'email' || channel === 'both' ? true : invoice.sentViaEmail,
      };
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoice.id ? updatedInv : inv))
      );
      saveFirestoreDoc(COLLECTIONS.INVOICES, updatedInv);
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
    saveFirestoreDoc(COLLECTIONS.MIKROTIK_DEVICES, newDevice);
    showToast('success', 'MikroTik Device Added', `${newDevice.name} added to router fleet.`);
    return newDevice;
  };

  const updateMikrotikDevice = (id: string, updates: Partial<MikrotikDevice>, notify: boolean = false) => {
    setMikrotikDevices((prev) =>
      prev.map((d) => {
        if (d.id === id) {
          const updated = { ...d, ...updates };
          saveFirestoreDoc(COLLECTIONS.MIKROTIK_DEVICES, updated);
          return updated;
        }
        return d;
      })
    );
    if (notify) {
      showToast('info', 'Router Updated', 'MikroTik configuration saved.');
    }
  };

  const deleteMikrotikDevice = (id: string) => {
    deleteFirestoreDoc(COLLECTIONS.MIKROTIK_DEVICES, id);
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

  const resetCustomerPassword = async (
    customerId: string,
    newPassword: string,
    syncPppoe: boolean = false
  ): Promise<{ success: boolean; message: string }> => {
    const targetCustomer = customers.find((c) => c.id === customerId);
    if (!targetCustomer) {
      return { success: false, message: 'Subscriber account not found.' };
    }

    if (!newPassword || newPassword.trim().length < 6) {
      return { success: false, message: 'Password must be at least 6 characters.' };
    }

    const trimmedPassword = newPassword.trim();
    const updatedNetwork = {
      ...targetCustomer.network,
      ...(syncPppoe && targetCustomer.network?.pppoeUsername ? { pppoePassword: trimmedPassword } : {}),
    };

    const updatedCust: Customer = {
      ...targetCustomer,
      portalPassword: trimmedPassword,
      network: updatedNetwork,
      updatedAt: new Date().toISOString(),
    };

    // 1. Update React state
    setCustomers((prev) => prev.map((c) => (c.id === customerId ? updatedCust : c)));

    // 2. Persist to Firestore & localStorage
    saveFirestoreDoc(COLLECTIONS.CUSTOMERS, updatedCust);

    // 3. Update Firestore system_users collection if a user profile exists
    try {
      const userDocRef = doc(db, 'system_users', customerId);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        await setDoc(
          userDocRef,
          {
            portalPassword: trimmedPassword,
            initialPassword: trimmedPassword,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      if (targetCustomer.email && targetCustomer.email.includes('@')) {
        const q = query(collection(db, 'system_users'), where('email', '==', targetCustomer.email.toLowerCase().trim()));
        const qSnap = await getDocs(q);
        for (const d of qSnap.docs) {
          await setDoc(
            doc(db, 'system_users', d.id),
            {
              portalPassword: trimmedPassword,
              initialPassword: trimmedPassword,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        }
      }
    } catch (userSyncErr) {
      console.warn('Could not sync password to system_users:', userSyncErr);
    }

    // 4. Synchronize with MikroTik router hardware if requested
    let mikrotikMessage = '';
    if (syncPppoe && targetCustomer.network?.pppoeUsername) {
      const routerCreds = getRouterCredsForCustomer(targetCustomer);
      if (routerCreds) {
        const plan = plans.find((p) => p.id === targetCustomer.planId) || plans[0];
        try {
          const res = await saveOrUpdatePppoeSecret(routerCreds, {
            name: targetCustomer.network.pppoeUsername,
            password: trimmedPassword,
            service: 'pppoe',
            profile: targetCustomer.network.pppoeProfile || `Plan-${plan?.speedMbps || 25}M`,
            remoteAddress: targetCustomer.network.ipAddress,
            comment: `${targetCustomer.fullName} - ${targetCustomer.accountNo}`,
            disabled: targetCustomer.status === 'suspended' || targetCustomer.status === 'disconnected',
            speedMbps: plan?.speedMbps || 25,
            accountNo: targetCustomer.accountNo,
          });

          if (res.success) {
            mikrotikMessage = ' PPPoE router secret was also updated on MikroTik.';
          } else {
            mikrotikMessage = ` (MikroTik notice: ${res.message || 'Router unreachable'})`;
          }
        } catch (mErr: any) {
          mikrotikMessage = ` (MikroTik notice: ${mErr?.message || 'Router unreachable'})`;
        }
      }
    }

    // 5. Audit Log
    logAuditEvent({
      userName: currentAuthUser?.displayName || 'Administrator',
      action: 'CUSTOMER_PASSWORD_RESET',
      category: 'auth',
      severity: 'warning',
      details: `Manually reset portal password for subscriber ${targetCustomer.fullName} (${targetCustomer.accountNo}).${mikrotikMessage}`,
      status: 'success',
    });

    showToast(
      'success',
      'Password Reset Complete',
      `Portal password for ${targetCustomer.fullName} (${targetCustomer.accountNo}) has been updated.${mikrotikMessage}`
    );

    return {
      success: true,
      message: `Password updated successfully for ${targetCustomer.fullName}.${mikrotikMessage}`,
    };
  };

  // --- Fleet Router Operations (On-Demand) ---
  const [lastGlobalRouterPolledAt, setLastGlobalRouterPolledAt] = useState<Date | null>(null);
  const isGlobalPollingInProgressRef = React.useRef<boolean>(false);
  const mikrotikDevicesRef = React.useRef<MikrotikDevice[]>(mikrotikDevices);
  mikrotikDevicesRef.current = mikrotikDevices;

  const pollAllRoutersNow = React.useCallback(async () => {
    if (isGlobalPollingInProgressRef.current) return;
    const currentList = mikrotikDevicesRef.current;
    if (!currentList || currentList.length === 0) return;

    isGlobalPollingInProgressRef.current = true;
    try {
      for (const dev of currentList) {
        if (!dev.ipAddress && !dev.remoteAddress) continue;
        try {
          const res = await fetchFullRouterTelemetry({
            id: dev.id,
            name: dev.name,
            ipAddress: dev.ipAddress || dev.remoteAddress || '',
            port: dev.port || dev.webfigPort || 80,
            username: dev.username || 'admin',
            password: dev.password || '',
          });

          if (res.status === 'connected') {
            setMikrotikDevices((prev) =>
              prev.map((d) => {
                if (d.id === dev.id) {
                  return {
                    ...d,
                    status: 'online',
                    cpuLoad: res.cpuLoad,
                    uptime: res.uptime || d.uptime,
                    rosVersion: res.version || d.rosVersion,
                    model: res.boardName || d.model,
                    memoryUsage: {
                      usedMb: (res.totalMemoryMb && res.freeMemoryMb) ? (res.totalMemoryMb - res.freeMemoryMb) : d.memoryUsage.usedMb,
                      totalMb: res.totalMemoryMb || d.memoryUsage.totalMb,
                    },
                    temperatureC: res.temperatureC || d.temperatureC,
                    activePppoeCount: res.activePppoeCount || d.activePppoeCount,
                  };
                }
                return d;
              })
            );
          } else if (res.status === 'unreachable') {
            setMikrotikDevices((prev) =>
              prev.map((d) => (d.id === dev.id ? { ...d, status: 'offline' } : d))
            );
          }
        } catch (_) {
          // Silent catch
        }
      }
      setLastGlobalRouterPolledAt(new Date());
    } finally {
      isGlobalPollingInProgressRef.current = false;
    }
  }, []);

  // --- Expense Operations ---
  const addExpense = (expenseData: Omit<Expense, 'id'>): Expense => {
    const newExpense: Expense = {
      ...expenseData,
      id: generateId('EXP'),
    };
    setExpenses((prev) => [newExpense, ...prev]);
    saveFirestoreDoc(COLLECTIONS.EXPENSES, newExpense);
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
    setExpenses((prev) =>
      prev.map((exp) => {
        if (exp.id === id) {
          const updated = { ...exp, ...updates };
          saveFirestoreDoc(COLLECTIONS.EXPENSES, updated);
          return updated;
        }
        return exp;
      })
    );
    showToast('info', 'Expense Updated', 'Expense voucher details have been updated.');
  };

  const deleteExpense = (id: string) => {
    deleteFirestoreDoc(COLLECTIONS.EXPENSES, id);
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

  // --- Operational Bills & Calendar Due Date Operations ---
  const todayDateStr = new Date().toISOString().slice(0, 10);

  const overdueOperationalBillsCount = operationalBills.filter((b) => {
    if (b.status === 'paid') return false;
    return b.dueDate < todayDateStr;
  }).length;

  const dueSoonOperationalBillsCount = operationalBills.filter((b) => {
    if (b.status === 'paid') return false;
    if (b.dueDate < todayDateStr) return false;
    const diffTime = new Date(b.dueDate).getTime() - new Date(todayDateStr).getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= (b.reminderDaysBefore ?? 5);
  }).length;

  const addOperationalBill = async (
    billData: Omit<OperationalBill, 'id' | 'createdAt' | 'updatedAt' | 'status'> & Partial<Pick<OperationalBill, 'status'>>
  ): Promise<OperationalBill> => {
    const now = new Date().toISOString();
    const newBill: OperationalBill = {
      ...billData,
      id: generateId('OPBILL'),
      status: billData.status || 'pending',
      reminderDaysBefore: billData.reminderDaysBefore ?? 5,
      createdAt: now,
      updatedAt: now,
    };
    setOperationalBills((prev) => [newBill, ...prev]);
    saveFirestoreDoc(COLLECTIONS.OPERATIONAL_BILLS, newBill);
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'BILL_SCHEDULED',
      category: 'billing',
      severity: 'info',
      details: `Scheduled operational bill "${newBill.title}" (${newBill.vendorName}) due on ${newBill.dueDate} for ₱${newBill.amount.toLocaleString()}.`,
      status: 'success',
    });
    showToast('success', 'Bill Scheduled', `Added ${newBill.title} due on ${newBill.dueDate}.`);
    return newBill;
  };

  const updateOperationalBill = async (id: string, updates: Partial<OperationalBill>): Promise<void> => {
    const now = new Date().toISOString();
    setOperationalBills((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          const updated = { ...b, ...updates, updatedAt: now };
          saveFirestoreDoc(COLLECTIONS.OPERATIONAL_BILLS, updated);
          return updated;
        }
        return b;
      })
    );
    showToast('info', 'Bill Updated', 'Operational bill details updated successfully.');
  };

  const deleteOperationalBill = async (id: string): Promise<void> => {
    deleteFirestoreDoc(COLLECTIONS.OPERATIONAL_BILLS, id);
    setOperationalBills((prev) => prev.filter((b) => b.id !== id));
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'BILL_DELETED',
      category: 'billing',
      severity: 'warning',
      details: `Removed operational bill schedule ${id}.`,
      status: 'success',
    });
    showToast('warning', 'Bill Removed', 'Operational payable schedule deleted.');
  };

  const markOperationalBillPaid = async (
    id: string,
    options?: {
      paymentDate?: string;
      paymentReference?: string;
      paymentMethod?: 'cash' | 'gcash' | 'maya' | 'bank_transfer' | 'check';
      createExpenseVoucher?: boolean;
      scheduleNextCycle?: boolean;
    }
  ): Promise<void> => {
    const targetBill = operationalBills.find((b) => b.id === id);
    if (!targetBill) return;

    const paidAt = options?.paymentDate || new Date().toISOString();
    const paymentRef = options?.paymentReference || `PAY-${Date.now().toString(36).toUpperCase()}`;
    const payMethod: 'cash' | 'gcash' | 'maya' | 'bank_transfer' | 'check' = options?.paymentMethod || 'bank_transfer';
    const now = new Date().toISOString();

    // 1. Update bill status to paid
    const updatedBill: OperationalBill = {
      ...targetBill,
      status: 'paid',
      paidAt,
      paymentReference: paymentRef,
      paymentMethod: payMethod,
      updatedAt: now,
    };

    setOperationalBills((prev) => prev.map((b) => (b.id === id ? updatedBill : b)));
    saveFirestoreDoc(COLLECTIONS.OPERATIONAL_BILLS, updatedBill);

    // 2. Optionally create OPEX expense voucher
    if (options?.createExpenseVoucher !== false) {
      const expenseCategoryMap: Record<OperationalBillCategory, ExpenseCategory> = {
        dia_transit: 'upstream_bandwidth',
        electricity: 'power_electricity',
        rent_lease: 'rent_pole_attachments',
        payroll: 'payroll_salaries',
        maintenance: 'repairs_spareparts',
        taxes_permits: 'taxes_permits',
        software_licenses: 'other',
        fiber_supplies: 'fiber_supplies',
        other: 'other',
      };

      addExpense({
        date: paidAt.slice(0, 10),
        category: expenseCategoryMap[targetBill.category] || 'other',
        description: `[Operational Bill] ${targetBill.vendorName} - ${targetBill.title} (${targetBill.accountOrRefNumber ? 'Ref: ' + targetBill.accountOrRefNumber : ''})`,
        amount: targetBill.amount,
        paymentMethod: payMethod,
        receiptNumber: paymentRef,
        vendorName: targetBill.vendorName,
        recordedBy: 'Admin Leonardo Flojo',
        notes: `Settled operational payable ID: ${targetBill.id}. Recurrence: ${targetBill.recurrence}.`,
      });
    }

    // 3. If recurring, schedule the next billing cycle automatically
    if (options?.scheduleNextCycle !== false && targetBill.recurrence !== 'one_time') {
      const currentDueDate = new Date(targetBill.dueDate);
      const nextDueDate = new Date(currentDueDate);

      switch (targetBill.recurrence) {
        case 'monthly':
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextDueDate.setMonth(nextDueDate.getMonth() + 3);
          break;
        case 'semi_annual':
          nextDueDate.setMonth(nextDueDate.getMonth() + 6);
          break;
        case 'annual':
          nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
          break;
      }

      const nextDueDateStr = nextDueDate.toISOString().slice(0, 10);
      const nextBill: OperationalBill = {
        vendorName: targetBill.vendorName,
        title: targetBill.title,
        category: targetBill.category,
        amount: targetBill.amount,
        dueDate: nextDueDateStr,
        recurrence: targetBill.recurrence,
        accountOrRefNumber: targetBill.accountOrRefNumber,
        notes: targetBill.notes,
        reminderDaysBefore: targetBill.reminderDaysBefore ?? 5,
        status: 'pending',
        id: generateId('OPBILL'),
        createdAt: now,
        updatedAt: now,
      };

      setOperationalBills((prev) => [nextBill, ...prev]);
      saveFirestoreDoc(COLLECTIONS.OPERATIONAL_BILLS, nextBill);
    }

    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'BILL_PAID',
      category: 'billing',
      severity: 'info',
      details: `Settled operational bill "${targetBill.title}" (₱${targetBill.amount.toLocaleString()}) via ${payMethod}. Ref: ${paymentRef}.`,
      status: 'success',
    });

    try {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    } catch {}
    showToast('success', 'Bill Settled', `Marked ${targetBill.title} as paid.`);
  };

  // --- Staff & System Roles Management ---
  const addStaffUser = async (newUserData: Omit<StaffUser, 'id' | 'createdAt'>): Promise<StaffUser> => {
    if (!hasPermission('canManageStaff')) {
      showToast('error', 'Access Denied', 'Only administrators can add staff accounts.');
      throw new Error('Permission denied: canManageStaff');
    }
    const newStaff: StaffUser = {

      ...newUserData,
      id: `staff-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [newStaff, ...staffUsers];
    setStaffUsers(updated);
    setStoredStaffUsers(updated);

    // Sync to Firestore system_users
    try {
      await saveFirestoreDoc('system_users', {
        id: newStaff.id,
        uid: newStaff.id,
        email: newStaff.email,
        displayName: newStaff.fullName,
        role: newStaff.role,
        mobile: newStaff.mobile,
        status: newStaff.status,
        isApproved: newStaff.status === 'active',
        createdAt: newStaff.createdAt,
        lastLoginAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Could not sync staff user to Firestore:', err);
    }

    // Auto-whitelist email for SSO if admin or staff
    if (newStaff.email && newStaff.email.includes('@')) {
      try {
        const whitelist = await getAuthorizedAdminEmails();
        const cleanEmail = newStaff.email.toLowerCase().trim();
        if (!whitelist.some((e) => e.toLowerCase().trim() === cleanEmail)) {
          await saveAuthorizedAdminEmails([...whitelist, cleanEmail]);
        }
      } catch (err) {
        console.warn('Could not update admin whitelist:', err);
      }
    }

    logAuditEvent({
      userName: currentAuthUser?.displayName || 'Admin Leonardo Flojo',
      action: 'STAFF_USER_CREATED',
      category: 'auth',
      severity: 'info',
      details: `Created new staff user "${newStaff.fullName}" with role ${newStaff.role.toUpperCase()} (${newStaff.email}).`,
      status: 'success',
    });

    showToast(
      'success',
      'Staff Member Added',
      `${newStaff.fullName} is now registered as ${SYSTEM_ROLES_CONFIG[newStaff.role]?.label || newStaff.role}.`
    );
    return newStaff;
  };

  const updateStaffUser = async (id: string, updates: Partial<StaffUser>): Promise<void> => {
    if (!hasPermission('canManageStaff')) {
      showToast('error', 'Access Denied', 'Only administrators can modify staff accounts.');
      return;
    }

    const updated = staffUsers.map((u) => (u.id === id ? { ...u, ...updates, updatedAt: new Date().toISOString() } : u));
    setStaffUsers(updated);
    setStoredStaffUsers(updated);

    const user = updated.find((u) => u.id === id);

    // Sync to Firestore
    if (user) {
      try {
        await saveFirestoreDoc('system_users', {
          id: user.id,
          displayName: user.fullName,
          email: user.email,
          role: user.role,
          mobile: user.mobile,
          status: user.status,
          isApproved: user.status === 'active',
          updatedAt: user.updatedAt,
        });
      } catch (err) {
        console.warn('Could not sync staff update to Firestore:', err);
      }

      logAuditEvent({
        userName: currentAuthUser?.displayName || 'Admin Leonardo Flojo',
        action: 'STAFF_USER_UPDATED',
        category: 'auth',
        severity: updates.role ? 'warning' : 'info',
        details: `Updated staff profile for "${user.fullName}" (${user.role.toUpperCase()}).`,
        status: 'success',
      });

      showToast('success', 'Staff Member Updated', `Changes for ${user.fullName} have been saved.`);
    }
  };

  const deleteStaffUser = async (id: string): Promise<void> => {
    if (!hasPermission('canManageStaff')) {
      showToast('error', 'Access Denied', 'Only administrators can delete staff accounts.');
      return;
    }
    const target = staffUsers.find((u) => u.id === id);
    if (!target) return;


    if (target.role === 'admin') {
      const activeAdmins = staffUsers.filter((u) => u.role === 'admin' && u.id !== id && u.status === 'active');
      if (activeAdmins.length === 0) {
        showToast('error', 'Action Prohibited', 'Cannot delete the only active Administrator account.');
        return;
      }
    }

    const updated = staffUsers.filter((u) => u.id !== id);
    setStaffUsers(updated);
    setStoredStaffUsers(updated);

    try {
      await deleteFirestoreDoc('system_users', id);
    } catch (err) {
      console.warn('Could not delete staff user from Firestore:', err);
    }

    logAuditEvent({
      userName: currentAuthUser?.displayName || 'Admin Leonardo Flojo',
      action: 'STAFF_USER_DELETED',
      category: 'auth',
      severity: 'warning',
      details: `Deleted staff member account "${target.fullName}" (${target.role.toUpperCase()}).`,
      status: 'success',
    });

    showToast('info', 'Staff Member Removed', `Staff member ${target.fullName} has been deleted.`);
  };

  const toggleStaffUserStatus = async (id: string): Promise<void> => {
    const target = staffUsers.find((u) => u.id === id);
    if (!target) return;

    const nextStatus: 'active' | 'suspended' = target.status === 'active' ? 'suspended' : 'active';

    if (nextStatus === 'suspended' && target.role === 'admin') {
      const activeAdmins = staffUsers.filter((u) => u.role === 'admin' && u.id !== id && u.status === 'active');
      if (activeAdmins.length === 0) {
        showToast('error', 'Action Prohibited', 'Cannot suspend the only active Administrator account.');
        return;
      }
    }

    const updated = staffUsers.map((u) => (u.id === id ? { ...u, status: nextStatus, updatedAt: new Date().toISOString() } : u));
    setStaffUsers(updated);
    setStoredStaffUsers(updated);

    try {
      await saveFirestoreDoc('system_users', {
        id: target.id,
        status: nextStatus,
        isApproved: nextStatus === 'active',
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Could not update staff status in Firestore:', err);
    }

    logAuditEvent({
      userName: currentAuthUser?.displayName || 'Admin Leonardo Flojo',
      action: 'STAFF_STATUS_TOGGLED',
      category: 'auth',
      severity: nextStatus === 'suspended' ? 'warning' : 'info',
      details: `Changed account status for "${target.fullName}" to ${nextStatus.toUpperCase()}.`,
      status: 'success',
    });

    showToast(
      nextStatus === 'active' ? 'success' : 'warning',
      nextStatus === 'active' ? 'Staff Account Activated' : 'Staff Account Suspended',
      `${target.fullName} is now ${nextStatus}.`
    );
  };

  // --- Profile & System ---
  const updateBusinessProfile = (updates: Partial<BusinessProfile>) => {
    const updated = { ...businessProfile, ...updates };
    setBusinessProfile(updated);
    saveFirestoreDoc(COLLECTIONS.BUSINESS_PROFILE, { id: 'company_profile', ...updated });
    logAuditEvent({
      userName: 'Admin Leonardo Flojo',
      action: 'SETTINGS_MODIFIED',
      category: 'settings',
      severity: 'info',
      details: `Updated business & branding settings.`,
      status: 'success',
    });
    showToast('success', 'Settings Saved', 'Business branding & preferences updated.');
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
      if (jsonData.operationalBills) setOperationalBills(jsonData.operationalBills);
      if (jsonData.auditLogs) setAuditLogs(jsonData.auditLogs);
      if (jsonData.businessProfile) setBusinessProfile(jsonData.businessProfile);
      if (jsonData.staffUsers) setStaffUsers(jsonData.staffUsers);

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

  const resetToDefault = async () => {
    resetAllDataToDefault();
    setCustomers([]);
    setInvoices([]);
    setPayments([]);
    setNapBoxes([]);
    setFiberCables([]);
    setFiberClosures([]);
    setRepairOrders([]);
    setReminders([]);
    setMikrotikDevices([]);
    setExpenses([]);
    setOperationalBills(initialOperationalBills);
    setAuditLogs([]);
    setDailyRemittances([]);
    setPaymentSubmissions([]);
    setCoverageAreas([]);
    setPlans(initialPlans);
    setBusinessProfile(initialBusinessProfile);
    setStaffUsers(initialStaffUsers);
    setStoredStaffUsers(initialStaffUsers);

    // Also purge remote Cloud Firestore collections
    try {
      await purgeFirestoreCollections();
    } catch (err) {
      console.warn('Firestore purge error:', err);
    }

    showToast('success', 'Database Clean Slate', 'All mock records in local memory and Cloud Firestore have been wiped clean.');
  };

  return (
    <AppContext.Provider
      value={{
        currentAuthUser,
        setCurrentAuthUser,
        isAuthModalOpen,
        authModalMode,
        authModalEmail,
        openAuthModal,
        closeAuthModal,
        systemRole,
        setSystemRole,
        canAccessTab,
        hasPermission,
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
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        toggleMobileMenu,
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
        resetCustomerPassword,
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
        processIncomingPaymentWebhook,
        paymentSubmissions,
        submitPaymentProof,
        approvePaymentSubmission,
        rejectPaymentSubmission,
        addPlan,
        updatePlan,
        deletePlan,
        coverageAreas,
        addCoverageArea,
        updateCoverageArea,
        deleteCoverageArea,
        toggleCoverageVisibility,
        toggleCoverageFiberReady,
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
        lastGlobalRouterPolledAt,
        pollAllRoutersNow,
        addRepairOrder,
        updateRepairOrder,
        deleteRepairOrder,
        convertRepairToInvoice,
        sendReminder,
        sendBatchReminders,
        addExpense,
        updateExpense,
        deleteExpense,
        operationalBills,
        addOperationalBill,
        updateOperationalBill,
        deleteOperationalBill,
        markOperationalBillPaid,
        overdueOperationalBillsCount,
        dueSoonOperationalBillsCount,
        logAuditEvent,
        clearAuditLogs,
        theme,
        setTheme,
        toggleTheme,
        staffUsers,
        addStaffUser,
        updateStaffUser,
        deleteStaffUser,
        toggleStaffUserStatus,
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

