export type CustomerStatus = 'active' | 'overdue' | 'suspended' | 'disconnected' | 'pending_install' | 'pending_approval';

export type InvoiceStatus = 'unpaid' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';

export type PaymentMethod = 'cash' | 'gcash' | 'maya' | 'bank_transfer' | 'check' | 'xendit' | 'other';

export type RepairStatus = 'received' | 'diagnosing' | 'in_progress' | 'ready' | 'completed' | 'cancelled';

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
}

export interface MikrotikDevice {
  id: string;
  name: string;
  model: string;
  role: 'core_pppoe' | 'distribution' | 'hotspot' | 'backup';
  ipAddress: string;
  port?: number;
  apiPort?: number;
  webfigPort: number;
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
  | 'billing'
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
