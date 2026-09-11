export type SystemRole = 'admin' | 'cashier' | 'technician';

export interface SystemRoleMeta {
  role: SystemRole;
  label: string;
  badge: string;
  description: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  textColor: string;
  iconName: string;
}

export const SYSTEM_ROLES_CONFIG: Record<SystemRole, SystemRoleMeta> = {
  admin: {
    role: 'admin',
    label: 'Administrator',
    badge: 'Super Admin',
    description: 'Full system oversight, financial P&L, network infrastructure, and system settings.',
    color: 'from-purple-600 to-indigo-600',
    badgeBg: 'bg-purple-500/10',
    badgeBorder: 'border-purple-500/30',
    textColor: 'text-purple-400',
    iconName: 'ShieldCheck',
  },
  cashier: {
    role: 'cashier',
    label: 'Cashier / Billing Desk',
    badge: 'Counter POS',
    description: 'Dedicated billing & invoice desk: Subscriber collections, statements of account, POS receipts, and daily remittance.',
    color: 'from-emerald-600 to-teal-600',
    badgeBg: 'bg-emerald-500/10',
    badgeBorder: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    iconName: 'CreditCard',
  },
  technician: {
    role: 'technician',
    label: 'Field Technician',
    badge: 'NOC / Field Tech',
    description: 'Fiber GIS map, NAP closures, ONT provisioning, installation logger, and repairs.',
    color: 'from-amber-500 to-orange-600',
    badgeBg: 'bg-amber-500/10',
    badgeBorder: 'border-amber-500/30',
    textColor: 'text-amber-400',
    iconName: 'Wrench',
  },
};

export interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  mobile?: string;
  role: SystemRole;
  status: 'active' | 'suspended';
  initialPassword?: string;
  notes?: string;
  avatarUrl?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RolePermissions {
  allowedTabs: string[];
  canDeleteCustomer: boolean;
  canDeleteInvoice: boolean;
  canDeletePayment: boolean;
  canAccessFinancials: boolean;
  canAccessNetworkConfig: boolean;
  canAccessSystemSettings: boolean;
  canManagePlans: boolean;
  canExecuteRouterCli: boolean;
  canAccessVerificationQueue: boolean;
  canManageStaff: boolean;
  canResetCustomerPassword: boolean;
  canBulkGenerateInvoices: boolean;
  canApplyInvoiceDiscount: boolean;
  canRunGraceAudit: boolean;
}

export const ROLE_PERMISSIONS: Record<SystemRole, RolePermissions> = {
  admin: {
    allowedTabs: [
      'dashboard',
      'customers',
      'applications',
      'field_ops',
      'repairs',
      'billing',
      'payments',
      'verification_queue',
      'plans',
      'reports',
      'bill_calendar',
      'mikrotik',
      'ipoe_dhcp',
      'network',
      'coverage',
      'reminders',
      'staff_users',
      'settings',
      'system_logs',
      'transaction_logs',
    ],
    canDeleteCustomer: true,
    canDeleteInvoice: true,
    canDeletePayment: true,
    canAccessFinancials: true,
    canAccessNetworkConfig: true,
    canAccessSystemSettings: true,
    canManagePlans: true,
    canExecuteRouterCli: true,
    canAccessVerificationQueue: true,
    canManageStaff: true,
    canResetCustomerPassword: true,
    canBulkGenerateInvoices: true,
    canApplyInvoiceDiscount: true,
    canRunGraceAudit: true,
  },
  cashier: {
    allowedTabs: [
      'billing',
    ],
    canDeleteCustomer: false,
    canDeleteInvoice: false,
    canDeletePayment: false,
    canAccessFinancials: false,
    canAccessNetworkConfig: false,
    canAccessSystemSettings: false,
    canManagePlans: false,
    canExecuteRouterCli: false,
    canAccessVerificationQueue: false,
    canManageStaff: false,
    canResetCustomerPassword: false,
    canBulkGenerateInvoices: false,
    canApplyInvoiceDiscount: false,
    canRunGraceAudit: false,
  },
  technician: {
    allowedTabs: [
      'dashboard',
      'field_ops',
      'customers',
      'repairs',
      'network',
      'coverage',
      'mikrotik',
      'ipoe_dhcp',
      'reminders',
    ],
    canDeleteCustomer: false,
    canDeleteInvoice: false,
    canDeletePayment: false,
    canAccessFinancials: false,
    canAccessNetworkConfig: true,
    canAccessSystemSettings: false,
    canManagePlans: false,
    canExecuteRouterCli: false,
    canAccessVerificationQueue: false,
    canManageStaff: false,
    canResetCustomerPassword: false,
    canBulkGenerateInvoices: false,
    canApplyInvoiceDiscount: false,
    canRunGraceAudit: false,
  },
};

export type CustomerStatus = 'active' | 'overdue' | 'suspended' | 'disconnected' | 'pending_install' | 'pending_approval';

export type InvoiceStatus = 'unpaid' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';

export type PaymentMethod = 'cash' | 'gcash' | 'maya' | 'bank_transfer' | 'check' | 'xendit' | 'other';

export type RepairStatus =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'received'
  | 'diagnosing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export type ReminderType = 'upcoming_due' | 'due_today' | 'overdue_warning' | 'disconnection_notice' | 'payment_confirmation';

export interface XenditConfig {
  enabled: boolean;
  provider: 'Xendit' | 'PayMongo' | 'Dragonpay';
  country: 'Philippines (Xendit PH)' | 'Indonesia (Xendit ID)' | 'Malaysia (Xendit MY)' | 'Vietnam (Xendit VN)' | 'Thailand (Xendit TH)';
  isProduction: boolean;
  secretKey: string;
  webhookToken: string;
  webhookUrl: string;
  defaultChannel: string;
  enabledChannels: string[];
  hasTransactionFee: boolean;
  transactionFeeAmount: number;
  autoDebitEnabled: boolean;
  autoDebitChargeAfterDays: number;
  autoDebitChannels: string[];
}

export interface BusinessProfile {
  name: string;
  tradeName: string;
  logoUrl?: string;
  websiteUrl?: string;
  portalDomain?: string;
  industry: string;
  tin: string;
  representative: {
    firstName: string;
    middleName: string;
    lastName: string;
    gender: string;
    department: string;
    companyId: string;
    mobile: string;
    email: string;
  };
  address: {
    roomUnit: string;
    building: string;
    street: string;
    subdivision: string;
    barangay: string;
    city: string;
    province: string;
    zipCode: string;
    landmark: string;
  };
  paymentGateways: {
    gcashNumber: string;
    gcashName: string;
    gcashQrImage?: string;
    mayaNumber: string;
    mayaName: string;
    mayaQrImage?: string;
    bankName: string;
    bankAccountName: string;
    bankAccountNumber: string;
    isXenditEnabled?: boolean;
    xenditMode?: 'test' | 'live';
    xenditSecretKey?: string;
    xenditPublicKey?: string;
    xenditWebhookToken?: string;
    xenditChannels?: string[];
    xenditConfig?: XenditConfig;
  };
  apiKeys: {
    resend: string;
    sendgrid: string;
    smsApiKey: string;
    mikrotikIp: string;
    mikrotikPort?: number;
    mikrotikUser: string;
    mikrotikPassword?: string;
    mikrotikUseSsl?: boolean;
    geminiApiKey?: string;
    geminiModel?: string;
  };
  smsGateway?: SmsGatewayConfig;
  staffWebhooks?: StaffWebhooksConfig;
  smtp?: SmtpConfig;
  authorizedAdminEmails?: string[];
  enforceSsoRestriction?: boolean;
  currencySymbol: string;
  currencyCode: string;
  invoiceGracePeriodDays: number;
  lateFeeAmount: number;
}

export interface Plan {
  id: string;
  name: string;
  speedMbps: number;
  monthlyFee: number;
  installationFee: number;
  category: 'residential' | 'business' | 'enterprise' | 'piso_wifi';
  description: string;
  features: string[];
  isActive: boolean;
}

export interface CustomerNetwork {
  pppoeUsername: string;
  pppoePassword?: string;
  pppoeProfile?: string;
  mikrotikDeviceId?: string;
  ipAddress: string;
  macAddress?: string;
  vlanId?: string;
  oltPonPort?: string;
  napBoxId: string;
  napPortNumber: number;
  onuSerial?: string;
  routerModel?: string;
  isMikrotikSynced: boolean;
  opticalPowerDbm?: number;
}

export interface Customer {
  id: string;
  accountNo: string;
  fullName: string;
  mobile: string;
  email: string;
  address: {
    street: string;
    barangay: string;
    city: string;
    province: string;
    landmark?: string;
    coordinates?: { lat: number; lng: number };
  };
  planId: string;
  planName: string;
  monthlyFee: number;
  billingDay: number;
  status: CustomerStatus;
  installationDate: string;
  balance: number; // positive = unpaid balance, negative = advance credit
  walletBalance?: number; // Pre-paid advance credits pool
  advanceDeposit: number;
  contractMonths?: number;
  network: CustomerNetwork;
  installationDetails?: {
    technician?: string;
    opticalPowerDbm?: number;
    dropCableMeters?: number;
    completedAt?: string;
    surveyNotes?: string;
  };
  notes?: string;
  portalPassword?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  type: 'plan' | 'installation' | 'addon' | 'repair' | 'late_fee' | 'discount' | 'other';
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  accountNo: string;
  customerAddress: string;
  customerMobile: string;
  customerEmail: string;
  planId?: string;
  planName?: string;
  planSpeedMbps?: number;
  monthlyFee?: number;
  billingDay?: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  appliedCredit?: number; // Wallet balance credit deducted
  isProrated?: boolean;
  proratedDays?: number;
  previousBalance: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: InvoiceStatus;
  notes?: string;
  sentViaSms: boolean;
  sentViaEmail: boolean;
  paidAt?: string;
  paymentMethodUsed?: PaymentMethod;
  xenditInvoiceUrl?: string;
  xenditInvoiceId?: string;
  allowDuplicate?: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  receiptNumber: string;
  customerId: string;
  customerName: string;
  accountNo: string;
  invoiceId?: string;
  invoiceNumber?: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  cashierName: string;
  remittanceStatus?: 'pending' | 'remitted';
  remittedAt?: string;
  notes?: string;
  isAdvancePayment: boolean;
  xenditDetails?: {
    invoiceId?: string;
    invoiceUrl?: string;
    channel?: string;
    fee?: number;
  };
  createdAt: string;
}

export interface DailyRemittanceRecord {
  id: string;
  remittanceDate: string;
  cashierName: string;
  totalCash: number;
  totalGcash: number;
  totalMaya: number;
  totalBank: number;
  totalCollected: number;
  paymentCount: number;
  actualCashInDrawer: number;
  discrepancy: number; // actual - totalCash
  status: 'open' | 'closed' | 'audited';
  verifiedBy?: string;
  notes?: string;
  closedAt?: string;
}

export interface AddonCatalogItem {
  id: string;
  name: string;
  category: 'hardware' | 'service' | 'fee' | 'static_ip';
  price: number;
  isRecurring: boolean;
  description: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface NapPort {
  portNumber: number;
  customerId?: string;
  customerName?: string;
  accountNo?: string;
  status: 'occupied' | 'available' | 'reserved' | 'damaged';
  signalDbm?: number;
}

export interface NapBox {
  id: string;
  code: string;
  name: string;
  location: string;
  barangay: string;
  totalPorts: number;
  fiberCoreColor: string;
  splitterType: string;
  ports: NapPort[];
  latitude: number;
  longitude: number;
  parentCableId?: string;
  opticalInputPowerDbm?: number;
  notes?: string;
}

export interface FiberCable {
  id: string;
  code: string;
  name: string;
  type: 'feeder' | 'distribution' | 'drop';
  coreCount: number;
  status: 'active' | 'degraded' | 'cut' | 'planned';
  fromNode: string;
  toNode: string;
  lengthMeters: number;
  fiberStandard: string;
  attenuationDbPerKm: number;
  pathCoordinates: GeoPoint[];
  color: string;
  installedDate?: string;
  notes?: string;
}

export interface FiberClosure {
  id: string;
  code: string;
  name: string;
  type: 'dome' | 'horizontal' | 'pole_mount';
  trayCount: number;
  totalSplices: number;
  latitude: number;
  longitude: number;
  status: 'active' | 'damaged';
  poleNumber?: string;
  cablesConnected: string[];
  notes?: string;
}

export interface OltPopNode {
  id: string;
  name: string;
  location: string;
  barangay: string;
  latitude: number;
  longitude: number;
  totalPonPorts: number;
  activePonPorts: number;
  txPowerDbm: number;
  ipAddress?: string;
  notes?: string;
}

export interface RepairPart {
  name: string;
  cost: number;
  quantity: number;
}

export interface TicketMessage {
  id: string;
  senderId?: string;
  senderName: string;
  senderRole: 'customer' | 'technician' | 'admin' | 'system';
  message: string;
  timestamp: string;
  attachments?: string[];
}

export interface RepairOrder {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  contactNumber: string;
  address: string;
  deviceType: 'ONU/Router' | 'Fiber Line Cut' | 'Desktop/Laptop' | 'Power Adapter' | 'Switch/AP' | 'Other';
  issueDescription: string;
  diagnosisNotes?: string;
  technician: string;
  partsUsed: RepairPart[];
  laborCost: number;
  totalCost: number;
  status: RepairStatus;
  dateReceived: string;
  dateCompleted?: string;
  billedToInvoiceId?: string;
  isPaid: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  messages?: TicketMessage[];
}

export interface ReminderLog {
  id: string;
  customerId: string;
  customerName: string;
  mobile: string;
  email: string;
  type: ReminderType;
  channel: 'sms' | 'email' | 'both';
  messageText: string;
  status: 'sent' | 'pending' | 'failed';
  sentAt: string;
  invoiceNumber?: string;
  amountDue?: number;
}

export interface NetworkInterfaceTraffic {
  id: string;
  name: string;
  type: 'sfp+' | 'ethernet' | 'vlan' | 'bridge';
  status: 'running' | 'disabled' | 'link_down';
  linkSpeed: string;
  macAddress: string;
  mtu: number;
  rxBps: number;
  txBps: number;
  rxPps: number;
  txPps: number;
  rxTotalBytes: number;
  txTotalBytes: number;
  rxErrors: number;
  txErrors: number;
  rxDrops: number;
  txDrops: number;
}

export interface SfpOpticalDiagnostics {
  portName: string;
  modulePresent: boolean;
  vendorName: string;
  partNumber: string;
  wavelengthNm: number;
  temperatureC: number;
  voltageV: number;
  biasCurrentMa: number;
  txPowerDbm: number;
  rxPowerDbm: number;
  txPowerMw: number;
  rxPowerMw: number;
  status: 'optimal' | 'warning' | 'critical' | 'no_link';
  ddmAlarms?: {
    highTemp: boolean;
    lowTxPower: boolean;
    highRxPowerLoss: boolean;
    lowVoltage: boolean;
  };
}

export interface WanCongestionTelemetry {
  status: 'normal' | 'moderate' | 'congested';
  queueUsagePercent: number;
  packetDropRate: number;
  bufferbloatGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  ispGatewayLatencyMs: number;
  jitterMs: number;
  activeQueuesCount: number;
  bandwidthCapacityMbps: number;
  currentThroughputMbps: { rx: number; tx: number };
}

export interface WatchdogTelemetry {
  hardwareWatchdogEnabled: boolean;
  hardwareWatchdogTimerSec: number;
  heartbeatPingWatchdog: {
    enabled: boolean;
    targetIp: string;
    intervalSec: number;
    failCount: number;
    maxFailsBeforeReboot: number;
    lastPingStatus: 'success' | 'failed' | 'recovering';
    lastPingLatencyMs: number;
  };
  cpuCores: Array<{ core: number; load: number; frequencyMhz: number }>;
  boardVoltageV: number;
  boardTemperatureC: number;
  fanSpeedRpm?: number;
}

export interface TrafficHistoryPoint {
  timestamp: string;
  rxMbps: number;
  txMbps: number;
  wan2RxMbps?: number;
  wan2TxMbps?: number;
  bridgeRxMbps?: number;
  bridgeTxMbps?: number;
}

export interface SimpleQueueTelemetryItem {
  id: string;
  name: string;
  target: string;
  maxLimit: string;
  maxLimitRxMbps: number;
  maxLimitTxMbps: number;
  rate: string;
  rateRxMbps: number;
  rateTxMbps: number;
  packetRate: string;
  bytes: string;
  packets: string;
  dropped: string;
  droppedCount: number;
  usagePercent: number;
  dynamic: boolean;
  disabled: boolean;
  comment?: string;
}

export interface MikrotikDevice {
  id: string;
  name: string;
  model: string;
  role: 'core_pppoe' | 'distribution' | 'hotspot' | 'backup';
  connectionType?: 'direct' | 'sstp_vpn';
  ipAddress: string;
  remoteAddress?: string;
  port?: number;
  apiPort?: number;
  webfigPort: number;
  winboxPort?: number;
  serviceType?: string;
  tunnelExpiry?: string;
  username?: string;
  password?: string;
  useSsl?: boolean;
  status: 'online' | 'offline' | 'connecting';
  rosVersion: string;
  cpuLoad: number;
  memoryUsage: { usedMb: number; totalMb: number };
  uptime: string;
  activePppoeCount: number;
  totalQueues: number;
  temperatureC: number;
  location: string;
  notes?: string;
  interfaces?: NetworkInterfaceTraffic[];
  sfpDiagnostics?: SfpOpticalDiagnostics[];
  wanCongestion?: WanCongestionTelemetry;
  watchdog?: WatchdogTelemetry;
  trafficHistory?: TrafficHistoryPoint[];
}

export interface PppoeActiveSession {
  id: string;
  username: string;
  customerId?: string;
  customerName?: string;
  accountNo?: string;
  service: string;
  callerIdMac: string;
  assignedIp: string;
  uptime: string;
  rxBps: number;
  txBps: number;
  rxBytes: number;
  txBytes: number;
  encoding: string;
  sessionTimeout?: string;
  status: 'active' | 'terminating' | 'isolated';
}

export interface PppoeProfile {
  id: string;
  name: string;
  rateLimitRx: string;
  rateLimitTx: string;
  localAddress: string;
  remoteAddressPool: string;
  dnsServers: string;
  onlyOne: 'yes' | 'no' | 'default';
  useEncryption: 'yes' | 'no' | 'required';
  comment?: string;
  subscribersCount?: number;
}

export interface PppoeServerBinding {
  id: string;
  serviceName: string;
  interfaceName: string;
  maxMtu: number;
  maxMru: number;
  defaultProfile: string;
  authentication: string[];
  keepaliveTimeoutSec: number;
  oneSessionPerHost: boolean;
  disabled: boolean;
}

export interface PppoeIpPool {
  id: string;
  name: string;
  subnet: string;
  rangeStart: string;
  rangeEnd: string;
  totalIps: number;
  usedIps: number;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  suggestedActions?: Array<{ label: string; action: string; payload?: any }>;
}

export type ExpenseCategory =
  | 'upstream_bandwidth'
  | 'power_electricity'
  | 'fiber_supplies'
  | 'payroll_salaries'
  | 'rent_pole_attachments'
  | 'repairs_spareparts'
  | 'taxes_permits'
  | 'marketing_promo'
  | 'other';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
  paymentMethod: 'cash' | 'gcash' | 'maya' | 'bank_transfer' | 'check';
  receiptNumber?: string;
  vendorName?: string;
  recordedBy?: string;
  notes?: string;
}

export type OperationalBillCategory =
  | 'dia_transit'        // Internet DIA / Upstream Transit / Backhaul (e.g., PLDT, Globe, Converge)
  | 'electricity'        // Electric Bill (e.g., CASURECO II, Tower Node Power)
  | 'rent_lease'         // Pole attachment / Tower rent / Office & Hub Rent
  | 'fiber_supplies'     // Fiber cables, splitters, drop wires, ONUs
  | 'software_licenses'  // MikroTik license, billing software, domain/cloud
  | 'maintenance'        // Generator fuel, vehicle maintenance, tools
  | 'payroll'            // Linemen & staff salary
  | 'taxes_permits'      // LGU, NTC, BIR, barangay clearance
  | 'other';             // Miscellaneous payables

export type BillFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'one_time';

export type OperationalBillStatus = 'pending' | 'due_soon' | 'overdue' | 'paid';

export interface OperationalBill {
  id: string;
  title: string;                 // e.g. "PLDT 1 Gbps Direct Internet Access (DIA)", "CASURECO II Main Hub Power"
  category: OperationalBillCategory;
  vendorName: string;            // e.g. "PLDT Enterprise", "CASURECO II", "Lagonoy Tower Lessor"
  accountOrRefNumber?: string;   // e.g. "PLDT-00294821", "CASURECO-44920"
  amount: number;                // e.g. 55000
  dueDate: string;               // YYYY-MM-DD (e.g. "2026-09-15")
  recurrence: BillFrequency;     // 'monthly' | 'one_time' | etc.
  reminderDaysBefore: number;    // e.g. 3, 5, 7 days before due date
  status: OperationalBillStatus; // 'pending' | 'due_soon' | 'overdue' | 'paid'
  paidAt?: string;               // ISO date when marked as paid
  paymentReference?: string;     // Receipt / Reference # e.g. "OR-99482"
  paymentMethod?: 'cash' | 'gcash' | 'maya' | 'bank_transfer' | 'check';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type SmtpProviderPreset =
  | 'custom'
  | 'gmail'
  | 'brevo'
  | 'sendgrid'
  | 'mailgun'
  | 'zoho'
  | 'outlook';

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  encryption: 'tls' | 'ssl' | 'none';
  user: string;
  password?: string;
  fromName: string;
  fromEmail: string;
  providerPreset: SmtpProviderPreset;
  lastTestStatus?: 'success' | 'failed' | 'untested';
  lastTestedAt?: string;
}

export type AuditLogCategory =
  | 'auth'
  | 'admin'
  | 'billing'
  | 'financial'
  | 'customer'
  | 'network'
  | 'settings'
  | 'expenses'
  | 'smtp'
  | 'system';

export type AuditLogSeverity = 'info' | 'warning' | 'critical';

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  action: string;
  category: AuditLogCategory;
  severity: AuditLogSeverity;
  ipAddress?: string;
  details: string;
  status: 'success' | 'failed';
  metadata?: Record<string, any>;
}

export type FinancialTransactionType =
  | 'invoice'
  | 'payment'
  | 'expense'
  | 'remittance'
  | 'credit_adjustment';

export type FinancialFlow = 'inflow' | 'outflow' | 'receivable';

export interface UnifiedFinancialTransaction {
  id: string;
  timestamp: string;
  referenceNumber: string;
  type: FinancialTransactionType;
  flow: FinancialFlow;
  partyName: string;
  partySubtext?: string;
  category: string;
  amount: number;
  paymentMethod: string;
  recordedBy: string;
  status: string;
  notes?: string;
  sourceDocId: string;
}

export type WorkOrderType =
  | 'new_installation'
  | 'line_repair'
  | 'onu_replacement'
  | 'signal_restoration'
  | 'relocation'
  | 'preventive_maintenance';

export type WorkOrderStatus =
  | 'dispatched'
  | 'en_route'
  | 'on_site'
  | 'testing'
  | 'completed'
  | 'cancelled';

export interface OpticalReading {
  opticalPowerDbm: number;
  grade: 'PASS' | 'MARGINAL' | 'FAIL' | 'OVERPOWERED';
  wavelength: '1310nm' | '1490nm' | '1550nm';
  recordedAt: string;
  napLossDbm?: number;
}

export interface WorkOrder {
  id: string;
  orderNumber: string;
  type: WorkOrderType;
  customerId: string;
  customerName: string;
  mobile: string;
  address: string;
  planName: string;
  technician: string;
  status: WorkOrderStatus;
  scheduledDate: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedNapId?: string;
  assignedNapPort?: number;
  dropCableMeters?: number;
  onuSerial?: string;
  macAddress?: string;
  opticalReading?: OpticalReading;
  gpsCoordinates?: {
    lat: number;
    lng: number;
    accuracyMeters?: number;
  };
  notes?: string;
  completedAt?: string;
  createdAt: string;
}

export type SmsProviderType = 'semaphore' | 'philsms' | 'twilio' | 'sandbox';

export interface SmsGatewayConfig {
  provider: SmsProviderType;
  apiKey: string;
  senderName: string; // e.g. "SWIFTSTREAM"
  // Twilio Specific
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  // PhilSMS Specific
  philsmsSenderId?: string;
  enabled: boolean;
  lastTestedAt?: string;
}

export interface StaffWebhooksConfig {
  telegramEnabled: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  discordEnabled: boolean;
  discordWebhookUrl?: string;
  // Notification Toggles
  notifyOnOutage: boolean;
  notifyOnCashierRemittance: boolean;
  notifyOnTelemetryWatchdog: boolean;
  notifyOnUrgentRepair: boolean;
}

export type OutageType =
  | 'fiber_cut'
  | 'olt_pon_failure'
  | 'power_interruption'
  | 'emergency_splicing'
  | 'scheduled_maintenance';

export interface OutageBroadcastRecord {
  id: string;
  incidentNumber: string;
  type: OutageType;
  title: string;
  description: string;
  targetScope: 'all' | 'nap_box' | 'olt_pon' | 'barangay';
  targetEntityId?: string;
  targetEntityName?: string;
  impactedSubscribersCount: number;
  estimatedRestorationTime: string;
  advisoryMessage: string;
  channelsSent: ('sms' | 'email' | 'telegram' | 'discord')[];
  status: 'active_outage' | 'restoring' | 'resolved';
  declaredBy: string;
  declaredAt: string;
  resolvedAt?: string;
}

export interface PaymentSubmission {
  id: string;
  submissionNumber: string;
  customerId: string;
  customerName: string;
  accountNo: string;
  invoiceId?: string;
  invoiceNumber?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string;
  receiptImageUrl?: string;
  status: 'pending_review' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  notes?: string;
}

export type CoverageStatus = 'fiber_ready' | 'expansion_ongoing' | 'planned';

export interface CoverageArea {
  id: string;
  name: string;
  barangay: string;
  city: string;
  province: string;
  description?: string;
  status: CoverageStatus;
  isPubliclyVisible: boolean;
  napBoxCount?: number;
  activeSubscribersCount?: number;
  notes?: string;
  updatedAt?: string;
}

// -------------------------------------------------------------
// 9. Client Online Applications
// -------------------------------------------------------------
export type OnlineApplicationStatus =
  | 'pending'
  | 'survey_scheduled'
  | 'approved'
  | 'rejected'
  | 'installed';

export interface OnlineApplication {
  id: string;
  applicationNumber: string;
  applicantName: string;
  email: string;
  phone: string;
  address: string;
  barangay: string;
  city: string;
  province: string;
  landmark?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  preferredPlanId: string;
  preferredPlanName: string;
  preferredSpeedMbps: number;
  monthlyFee: number;
  validIdUrl?: string;
  proofOfBillingUrl?: string;
  status: OnlineApplicationStatus;
  notes?: string;
  surveyDate?: string;
  technicianNotes?: string;
  assignedTechnician?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string;
}

// -------------------------------------------------------------
// 10. RADIUS / AAA Server
// -------------------------------------------------------------
export interface RadiusServerConfig {
  id: string;
  name: string;
  serverIp: string;
  authPort: number;
  acctPort: number;
  secret: string;
  coaPort?: number;
  nasIdentifier?: string;
  isActive: boolean;
  isDefault?: boolean;
  description?: string;
  createdAt: string;
}

export interface RadiusUser {
  id: string;
  username: string;
  value: string; // cleartext password or hash
  attribute: string; // 'Cleartext-Password'
  op: string; // ':='
  planName?: string;
  rateLimit?: string; // '50M/50M'
  framedIp?: string;
  framedPool?: string;
  simultaneousUse: number;
  groupName?: string;
  status: 'active' | 'disabled' | 'expired';
  expiryDate?: string;
  customerId?: string;
}

export interface RadiusSession {
  id: string;
  username: string;
  nasIpAddress: string;
  framedIpAddress: string;
  callingStationId: string; // MAC address
  acctSessionId: string;
  acctSessionTime: number; // in seconds
  acctInputOctets: number; // Bytes Downloaded
  acctOutputOctets: number; // Bytes Uploaded
  acctStartTime: string;
  acctStopTime?: string;
  nasPortType?: string;
  status: 'active' | 'stopped';
}

// -------------------------------------------------------------
// 11. IPoE / DHCP Management
// -------------------------------------------------------------
export interface DhcpLease {
  id: string;
  address: string;
  macAddress: string;
  server: string;
  clientHostname?: string;
  activeAddress?: string;
  activeMacAddress?: string;
  activeClientHostname?: string;
  status: 'bound' | 'waiting' | 'static' | 'quarantined';
  dynamic: boolean;
  disabled: boolean;
  expiresAfter?: string;
  lastSeen?: string;
  comment?: string;
  rateLimit?: string;
  circuitId?: string; // Option 82
  remoteId?: string;
  customerId?: string;
  customerName?: string;
}

// -------------------------------------------------------------
// 13. MikroTik Torch Traffic Flow & Application Statistics Monitor
// -------------------------------------------------------------
export type ApplicationCategory =
  | 'web_streaming'
  | 'gaming'
  | 'voip_conferencing'
  | 'vpn_remote'
  | 'dns_infra'
  | 'p2p_transfer'
  | 'other';

export interface ApplicationStatItem {
  category: ApplicationCategory;
  name: string;
  description: string;
  color: string;
  badgeBg: string;
  rxBps: number;
  txBps: number;
  totalBps: number;
  rxPackets: number;
  txPackets: number;
  flowsCount: number;
  percentageShare: number;
  dominantPorts: (string | number)[];
  topSubscribers?: {
    customerName?: string;
    accountNo?: string;
    ip: string;
    bps: number;
  }[];
}

export interface TorchFlow {
  id: string;
  srcAddress: string;
  srcPort?: number | string;
  dstAddress: string;
  dstPort?: number | string;
  protocol: string;
  txRateBps: number;
  rxRateBps: number;
  txPackets?: number;
  rxPackets?: number;
  serviceLabel?: string;
  category?: ApplicationCategory;
  customerId?: string;
  customerName?: string;
  accountNo?: string;
  planName?: string;
}

export interface TorchFilterOptions {
  interfaceName: string;
  srcAddress?: string;
  dstAddress?: string;
  port?: string;
  protocol?: string;
  mode?: 'top_talkers' | 'detailed_flows' | 'app_stats';
  autoStopSeconds?: number;
}

export interface TorchResult {
  success: boolean;
  flows: TorchFlow[];
  error?: string;
  errorMessage?: string;
  interfaceTraffic?: {
    rxBps: number;
    txBps: number;
    rxPps: number;
    txPps: number;
    rxDrops?: number;
    txDrops?: number;
  };
  applicationStats?: ApplicationStatItem[];
}

