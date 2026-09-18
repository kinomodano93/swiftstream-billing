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
  AddonCatalogItem,
  DailyRemittanceRecord,
  PaymentSubmission,
  CoverageArea,
  StaffUser,
  OperationalBill,
} from '../types';

export const initialBusinessProfile: BusinessProfile = {
  name: 'SWIFTSTREAM TELECOMMUNICATIONS',
  tradeName: 'SwiftStream IT Services & Fiber Internet',
  heroTitle: 'Ultra-Fast Fiber. Zero Lag. Pure Reliability.',
  logoUrl: '/favicon.svg',
  websiteUrl: 'https://swiftstream-portal.web.app',
  portalDomain: 'https://swiftstream-portal.web.app',
  industry: '',
  tin: '468975349000',
  representative: {
    firstName: 'Leonardo',
    middleName: 'Cajarito',
    lastName: 'Flojo',
    gender: 'Male',
    department: 'Management & NOC Operations',
    companyId: 'SWIFT-ADMIN-01',
    mobile: '09638927819',
    email: 'swiftstream.telecom@gmail.com',
  },
  address: {
    roomUnit: '',
    building: '',
    street: '',
    subdivision: '',
    barangay: 'Binauahan',
    city: 'Lagonoy',
    province: 'Camarines Sur',
    zipCode: '4425',
    landmark: '',
  },
  paymentGateways: {
    gcashNumber: '09638927819',
    gcashName: 'LEONARDO F.',
    gcashQrImage: '',
    mayaNumber: '09638927819',
    mayaName: 'SWIFTSTREAM TEL',
    mayaQrImage: '',
    bankName: 'BDO Unibank (Lagonoy Branch)',
    bankAccountNumber: '0012-3456-7890',
    bankAccountName: 'SWIFTSTREAM TELECOMMUNICATION',
    bankQrImage: '',
    xenditConfig: {
      enabled: true,
      provider: 'Xendit',
      country: 'Philippines (Xendit PH)',
      isProduction: false,
      secretKey: '',
      webhookToken: 'whsec_9182374619283746',
      webhookUrl: 'https://swiftstream-portal.web.app/api/webhooks/xendit',
      defaultChannel: 'GCash',
      enabledChannels: [
        'GCash',
        'Maya',
        'GrabPay',
        'ShopeePay',
        'Debit / Credit Card',
        '7-Eleven Cliqq',
        'Cebuana Lhuillier',
        'BPI Direct Debit',
        'UnionBank Direct Debit',
        'BDO Direct Debit',
        'RCBC Direct Debit',
        'China Bank Direct Debit',
      ],
      hasTransactionFee: true,
      transactionFeeAmount: 0,
      autoDebitEnabled: false,
      autoDebitChargeAfterDays: 1,
      autoDebitChannels: [
        'Debit / Credit Card',
        'GCash',
        'BPI Direct Debit',
        'UnionBank Direct Debit',
      ],
    },
  },
  apiKeys: {
    resend: '',
    sendgrid: '',
    smsApiKey: '',
    mikrotikIp: '192.168.88.1',
    mikrotikUser: 'admin',
    mikrotikPassword: '',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
  },
  smsGateway: {
    provider: 'semaphore',
    apiKey: '',
    senderName: 'SWIFTSTREAM',
    philsmsSenderId: 'SWIFTSTREAM',
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioFromNumber: '',
    enabled: false,
    lastTestedAt: '',
  },
  staffWebhooks: {
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    discordEnabled: false,
    discordWebhookUrl: '',
    notifyOnOutage: true,
    notifyOnCashierRemittance: true,
    notifyOnTelemetryWatchdog: true,
    notifyOnUrgentRepair: true,
  },
  smtp: {
    enabled: true,
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    encryption: 'tls',
    user: 'swiftstream.telecom@gmail.com',
    password: '',
    fromName: 'SwiftStream Telecom Billing',
    fromEmail: 'swiftstream.telecom@gmail.com',
    providerPreset: 'gmail',
    lastTestStatus: 'success',
    lastTestedAt: '2026-08-28 09:15:00',
  },
  authorizedAdminEmails: [
    'swiftstream.telecom@gmail.com',
    'admin@swiftstream.ph',
  ],
  enforceSsoRestriction: true,
  currencySymbol: '₱',
  currencyCode: 'PHP',
  invoiceGracePeriodDays: 5,
  gracePeriodCutoffTime: '23:59',
  dailyAuditScheduleTime: '00:00',
  lateFeeAmount: 50,
};

export const initialPlans: Plan[] = [
  {
    id: 'plan-basic-connect-50',
    name: 'Basic Connect',
    speedMbps: 50,
    monthlyFee: 799,
    installationFee: 1500,
    category: 'residential',
    description: 'Reliable high-speed fiber internet for everyday web browsing, social media, online classes, and HD video streaming.',
    features: [
      '50 Mbps Unlimited Fiber Internet',
      'Dual-Band Gigabit ONU Included',
      'No Data Capping (Unlimited)',
      '24/7 Local Support Desk',
      'Standard Installation: ₱1,500',
    ],
    isActive: true,
    mikrotikProfile: 'plan-50m',
    isPublic: true,
  },
  {
    id: 'plan-family-streamer-100',
    name: 'Family Streamer',
    speedMbps: 100,
    monthlyFee: 1000,
    installationFee: 1500,
    category: 'residential',
    description: 'High-speed household favorite designed for simultaneous multi-device 4K streaming, Zoom meetings, and remote work.',
    features: [
      '100 Mbps Unlimited Fiber Internet',
      'Dual-Band WiFi 6 Gigabit ONU',
      'Low Latency Family Routing',
      'No Data Capping (Unlimited)',
      'Standard Installation: ₱1,500',
    ],
    isActive: true,
    mikrotikProfile: 'plan-100m',
    isPublic: true,
    isPopular: true,
    badgeText: 'Most Popular Family Choice',
  },
  {
    id: 'plan-gamer-pro-400',
    name: 'Gamer Pro',
    speedMbps: 400,
    monthlyFee: 1500,
    installationFee: 1500,
    category: 'residential',
    description: 'Ultra-fast dedicated optical line engineered for competitive gaming, live esports streaming, heavy cloud backups, and large downloads.',
    features: [
      '400 Mbps Pure Fiber Internet',
      'Optimized Low-Ping Direct Gaming Route',
      'Dual-Band WiFi 6 Gigabit ONU',
      'Unlimited Bandwidth (Zero Throttling)',
      'Standard Installation: ₱1,500',
    ],
    isActive: true,
    mikrotikProfile: 'plan-400m',
    isPublic: true,
  },
];


export const initialOltNode: OltPopNode = {
  id: 'olt-01-headend',
  name: 'SwiftStream Central OLT & NOC Headend',
  location: 'Shop #4, Arcade Bldg., National Highway',
  barangay: 'Binauahan',
  latitude: 13.6838,
  longitude: 123.5175,
  totalPonPorts: 16,
  activePonPorts: 0,
  txPowerDbm: 4.5,
  ipAddress: '192.168.88.1',
  notes: 'Main GPON Optical Line Terminal with redundant CASURECO power + 3kVA Online UPS.',
};

export const initialFiberClosures: FiberClosure[] = [];

export const initialFiberCables: FiberCable[] = [];

export const initialNapBoxes: NapBox[] = [];

export const initialCustomers: Customer[] = [];

export const initialInvoices: Invoice[] = [];

export const initialPayments: Payment[] = [];

export const initialRepairOrders: RepairOrder[] = [];

export const initialReminders: ReminderLog[] = [];

export const initialMikrotikDevices: MikrotikDevice[] = [];

export const initialExpenses: Expense[] = [];

export const initialAuditLogs: AuditLog[] = [];

export const initialAddonCatalog: AddonCatalogItem[] = [
  {
    id: 'addon-mesh-onetime',
    name: 'Dual-Band Mesh WiFi Extender (Outright)',
    category: 'hardware',
    price: 1500,
    isRecurring: false,
    description: 'High-coverage Gigabit AC1200 dual-band mesh extender for whole-home dead-spot elimination.',
  },
  {
    id: 'addon-mesh-monthly',
    name: 'Mesh WiFi Extender (Monthly Lease)',
    category: 'hardware',
    price: 150,
    isRecurring: true,
    description: 'Managed whole-home mesh coverage node added to monthly subscription with lifetime hardware warranty.',
  },
  {
    id: 'addon-cat6-cable',
    name: 'Cat6 Pure Copper LAN Cable Drop (Per Meter)',
    category: 'service',
    price: 20,
    isRecurring: false,
    description: 'High-speed Cat6 Gigabit ethernet cabling per meter, crimped with protective RJ45 boots.',
  },
  {
    id: 'addon-static-ip',
    name: 'Static Public IPv4 Address',
    category: 'static_ip',
    price: 500,
    isRecurring: true,
    description: 'Dedicated public IP for CCTV remote NVR access, port forwarding, secure VPN server, and enterprise hosting.',
  },
  {
    id: 'addon-onu-replacement',
    name: 'Dual-Band Gigabit ONU Modem Replacement',
    category: 'hardware',
    price: 1200,
    isRecurring: false,
    description: 'Out-of-warranty replacement or secondary GPON/EPON Dual-Band WiFi 6 Optical Network Unit.',
  },
  {
    id: 'addon-drop-relocation',
    name: 'Fiber Drop Cable Relocation & Transfer',
    category: 'service',
    price: 500,
    isRecurring: false,
    description: 'On-site lineman service for line transfer, home rewiring, or pole-to-house drop wire re-routing.',
  },
];

export const initialDailyRemittances: DailyRemittanceRecord[] = [];

export const initialPaymentSubmissions: PaymentSubmission[] = [];

export const initialCoverageAreas: CoverageArea[] = [];

export const initialStaffUsers: StaffUser[] = [
  {
    id: 'staff-admin-01',
    fullName: 'Leonardo Flojo',
    email: 'swiftstream.telecom@gmail.com',
    mobile: '09638927819',
    role: 'admin',
    status: 'active',
    notes: 'Primary System Administrator & NOC Operations Head',
    createdAt: new Date().toISOString(),
  },
];

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
const nextMonthNum = (now.getMonth() + 2) > 12 ? 1 : now.getMonth() + 2;
const nextMonthYear = (now.getMonth() + 2) > 12 ? currentYear + 1 : currentYear;
const nextMonthStr = String(nextMonthNum).padStart(2, '0');

export const initialOperationalBills: OperationalBill[] = [];

