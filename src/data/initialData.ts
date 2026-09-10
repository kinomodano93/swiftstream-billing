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
  websiteUrl: 'https://swiftstream-portal.web.app',
  portalDomain: 'https://swiftstream-portal.web.app',
  industry: 'Information Technology & Telecommunications',
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
    roomUnit: 'Unit 4',
    building: 'Commercial Arcade Bldg.',
    street: 'National Highway, Zone 3',
    subdivision: 'Poblacion',
    barangay: 'Binauahan',
    city: 'Lagonoy',
    province: 'Camarines Sur',
    zipCode: '4425',
    landmark: 'Across Lagonoy Municipal Gymnasium',
  },
  paymentGateways: {
    gcashNumber: '09638927819',
    gcashName: 'LEONARDO F.',
    gcashQrImage: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=400',
    mayaNumber: '09638927819',
    mayaName: 'SWIFTSTREAM TEL',
    mayaQrImage: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&q=80&w=400',
    bankName: 'BDO Unibank (Lagonoy Branch)',
    bankAccountNumber: '0012-3456-7890',
    bankAccountName: 'SWIFTSTREAM TELECOMMUNICATION',
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
    smsApiKey: 'SMS-SWIFT-KEY-DEMO-99182',
    mikrotikIp: '192.168.88.1',
    mikrotikUser: 'admin',
    mikrotikPassword: '',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
  },
  smsGateway: {
    provider: 'semaphore',
    apiKey: 'semi_live_9a812b489c10293847',
    senderName: 'SWIFTSTREAM',
    philsmsSenderId: 'SWIFTSTREAM',
    twilioAccountSid: 'AC_mock_twilio_991827461',
    twilioAuthToken: '',
    twilioFromNumber: '+12055550199',
    enabled: true,
    lastTestedAt: '2026-08-28 14:20:00',
  },
  staffWebhooks: {
    telegramEnabled: true,
    telegramBotToken: 'bot6829104812:AAHk91jKq881_demo_token',
    telegramChatId: '-1001928471920',
    discordEnabled: true,
    discordWebhookUrl: 'https://discord.com/api/webhooks/120938471928471/demo_webhook_swiftstream_noc',
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
  lateFeeAmount: 50,
};

export const initialPlans: Plan[] = [
  {
    id: 'plan-flexibix-6000',
    name: 'Flexibix Peak 6000',
    speedMbps: 500,
    monthlyFee: 6000,
    installationFee: 1500,
    category: 'enterprise',
    description: 'Ultra High-Speed Dedicated Fiber with Symmetric 1:1 CIR for Heavy Business Operations & Cyber Cafes.',
    features: ['500 Mbps Symmetric Dedicated', 'Static Public IPv4', '24/7 Priority VIP Support', '99.9% SLA Guarantee', 'Dual WAN Failover Ready', 'Standard Installation: ₱1,500'],
    isActive: true,
  },
  {
    id: 'plan-fiber-pro-100',
    name: 'SwiftStream Pro Fiber 100M',
    speedMbps: 100,
    monthlyFee: 1699,
    installationFee: 1500,
    category: 'residential',
    description: 'Optimal for remote work, 4K streaming, multi-device homes, and content creators.',
    features: ['100 Mbps Unlimited Fiber', 'Dual-Band WiFi 6 ONU', 'Standard Installation: ₱1,500', 'Low-Latency Gaming Route'],
    isActive: true,
  },
  {
    id: 'plan-home-turbo-50',
    name: 'SwiftStream Home Turbo 50M',
    speedMbps: 50,
    monthlyFee: 1299,
    installationFee: 1500,
    category: 'residential',
    description: 'High-speed household favorite for smooth streaming, Zoom, and social media.',
    features: ['50 Mbps Unlimited Fiber', 'Dual-Band Gigabit ONU', 'Unlimited Data No Cap', '24/7 Customer Hotline', 'Standard Installation: ₱1,500'],
    isActive: true,
  },
  {
    id: 'plan-starter-25',
    name: 'SwiftStream Starter Fiber 25M',
    speedMbps: 25,
    monthlyFee: 899,
    installationFee: 1500,
    category: 'residential',
    description: 'Budget-friendly fiber package for students, small households, and light surfing.',
    features: ['25 Mbps Unlimited Fiber', 'Standard Fiber Router', 'Zero Data Cap', 'Standard Installation: ₱1,500'],
    isActive: true,
  },
  {
    id: 'plan-biz-giga-200',
    name: 'SwiftStream Commercial Gig 200M',
    speedMbps: 200,
    monthlyFee: 2999,
    installationFee: 1500,
    category: 'business',
    description: 'Enterprise grade connection designed for offices, resorts, hotels, and retail stores.',
    features: ['200 Mbps Fiber', '2 Static IP addresses', 'Priority Field Support', 'Dual-Band Mesh System', 'Standard Installation: ₱1,500'],
    isActive: true,
  },
  {
    id: 'plan-piso-wifi',
    name: 'Community Vendo Piso-WiFi Feed',
    speedMbps: 80,
    monthlyFee: 1500,
    installationFee: 1500,
    category: 'piso_wifi',
    description: 'Dedicated high-burst bandwidth feeder line for coin-operated outdoor WiFi vending machines.',
    features: ['80 Mbps High-Burst Queue', 'Outdoor AP Compatible', 'Isolated VLAN', 'Bandwidth Limiter Support', 'Standard Installation: ₱1,500'],
    isActive: true,
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

export const initialAddonCatalog: AddonCatalogItem[] = [];

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

export const initialOperationalBills: OperationalBill[] = [
  {
    id: 'bill-dia-01',
    title: 'PLDT Enterprise 1 Gbps DIA Circuit & Backhaul',
    category: 'dia_transit',
    vendorName: 'PLDT Enterprise',
    accountOrRefNumber: 'PLDT-DIA-092841',
    amount: 55000,
    dueDate: `${currentYear}-${currentMonth}-15`,
    recurrence: 'monthly',
    reminderDaysBefore: 5,
    status: 'pending',
    notes: 'Primary upstream dedicated internet bandwidth circuit for SwiftStream core network in Lagonoy.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'bill-elec-01',
    title: 'CASURECO II Power - Central Server Room & OLT Nodes',
    category: 'electricity',
    vendorName: 'CASURECO II Electric Cooperative',
    accountOrRefNumber: 'CAS-084-29184',
    amount: 14850,
    dueDate: `${currentYear}-${currentMonth}-20`,
    recurrence: 'monthly',
    reminderDaysBefore: 4,
    status: 'pending',
    notes: 'Commercial 24/7 power meter for core servers, Huawei OLT chassis, and battery rectifier bank.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'bill-rent-01',
    title: 'Lagonoy Relay Tower Site Ground Lease & Office Rent',
    category: 'rent_lease',
    vendorName: 'Lagonoy Commercial Property Lease',
    accountOrRefNumber: 'LEASE-TOWER-01',
    amount: 18000,
    dueDate: `${nextMonthYear}-${nextMonthStr}-05`,
    recurrence: 'monthly',
    reminderDaysBefore: 5,
    status: 'pending',
    notes: 'Main NOC operations center, repair shop, and 45-meter antenna lattice tower ground rental.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'bill-poles-01',
    title: 'CASURECO II Joint-Pole Attachment Rentals (Lagonoy Barangays)',
    category: 'rent_lease',
    vendorName: 'CASURECO II Distribution Poles',
    accountOrRefNumber: 'POLE-ATTACH-2026',
    amount: 8500,
    dueDate: `${currentYear}-${currentMonth}-28`,
    recurrence: 'monthly',
    reminderDaysBefore: 7,
    status: 'pending',
    notes: 'Distribution pole attachment fees for aerial fiber optic lines across 20+ barangays.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'bill-ntc-01',
    title: 'NTC Spectrum & Value Added Services (VAS) Permit',
    category: 'taxes_permits',
    vendorName: 'National Telecommunications Commission (NTC R5)',
    accountOrRefNumber: 'NTC-VAS-R5-2026',
    amount: 12500,
    dueDate: `${currentYear}-${currentMonth}-30`,
    recurrence: 'quarterly',
    reminderDaysBefore: 7,
    status: 'pending',
    notes: 'Regulatory compliance certification and spectrum allocation permit.',
    createdAt: new Date().toISOString(),
  },
];
