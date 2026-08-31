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
} from '../types';

export const initialBusinessProfile: BusinessProfile = {
  name: 'SWIFTSTREAM TELECOMMUNICATION & REPAIR SHOP',
  tradeName: 'SwiftStream IT Services & Fiber Internet',
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
    installationFee: 0,
    category: 'enterprise',
    description: 'Ultra High-Speed Dedicated Fiber with Symmetric 1:1 CIR for Heavy Business Operations & Cyber Cafes.',
    features: ['500 Mbps Symmetric Dedicated', 'Static Public IPv4', '24/7 Priority VIP Support', '99.9% SLA Guarantee', 'Dual WAN Failover Ready'],
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
    features: ['100 Mbps Unlimited Fiber', 'Dual-Band WiFi 6 ONU', 'Free Installation Promo', 'Low-Latency Gaming Route'],
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
    features: ['50 Mbps Unlimited Fiber', 'Dual-Band Gigabit ONU', 'Unlimited Data No Cap', '24/7 Customer Hotline'],
    isActive: true,
  },
  {
    id: 'plan-starter-25',
    name: 'SwiftStream Starter Fiber 25M',
    speedMbps: 25,
    monthlyFee: 899,
    installationFee: 1200,
    category: 'residential',
    description: 'Budget-friendly fiber package for students, small households, and light surfing.',
    features: ['25 Mbps Unlimited Fiber', 'Standard Fiber Router', 'Zero Data Cap'],
    isActive: true,
  },
  {
    id: 'plan-biz-giga-200',
    name: 'SwiftStream Commercial Gig 200M',
    speedMbps: 200,
    monthlyFee: 2999,
    installationFee: 2000,
    category: 'business',
    description: 'Enterprise grade connection designed for offices, resorts, hotels, and retail stores.',
    features: ['200 Mbps Fiber', '2 Static IP addresses', 'Priority Field Support', 'Dual-Band Mesh System'],
    isActive: true,
  },
  {
    id: 'plan-piso-wifi',
    name: 'Community Vendo Piso-WiFi Feed',
    speedMbps: 80,
    monthlyFee: 1500,
    installationFee: 2500,
    category: 'piso_wifi',
    description: 'Dedicated high-burst bandwidth feeder line for coin-operated outdoor WiFi vending machines.',
    features: ['80 Mbps High-Burst Queue', 'Outdoor AP Compatible', 'Isolated VLAN', 'Bandwidth Limiter Support'],
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

export const initialMikrotikDevices: MikrotikDevice[] = [
  {
    id: 'mtk-ccr2116-core',
    name: 'CCR2116-12G-4S+ Core Gateway',
    model: 'CCR2116-12G-4S+',
    role: 'core_pppoe',
    connectionType: 'sstp_vpn',
    ipAddress: 'remote.oxapsph.com',
    remoteAddress: 'remote.oxapsph.com',
    port: 10988,
    webfigPort: 10988,
    apiPort: 10878,
    winboxPort: 10995,
    serviceType: 'sstp',
    username: 'admin',
    password: '',
    useSsl: false,
    status: 'online',
    rosVersion: 'RouterOS v7.14.3',
    cpuLoad: 24,
    memoryUsage: { usedMb: 1220, totalMb: 16384 },
    uptime: '2w5d2h50m29s',
    activePppoeCount: 18,
    totalQueues: 18,
    temperatureC: 44,
    location: 'Main POP Operations Rack, Lagonoy',
    notes: 'Primary High-Capacity CCR PPPoE Concentrator and 10G Core Gateway',
    interfaces: [
      { id: '1', name: 'sfp-sfpplus1', type: 'sfp+', status: 'running', linkSpeed: '10 Gbps', macAddress: 'D4:01:C3:88:1A:01', mtu: 1500, rxBps: 672530000, txBps: 56870000, rxPps: 58000, txPps: 12000, rxTotalBytes: 1048576000, txTotalBytes: 524288000, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '2', name: 'sfp-sfpplus2', type: 'sfp+', status: 'running', linkSpeed: '10 Gbps', macAddress: 'D4:01:C3:88:1A:02', mtu: 1500, rxBps: 120400000, txBps: 35200000, rxPps: 14000, txPps: 4500, rxTotalBytes: 524288000, txTotalBytes: 104857600, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '3', name: 'sfp-sfpplus3', type: 'sfp+', status: 'link_down', linkSpeed: '10 Gbps', macAddress: 'D4:01:C3:88:1A:03', mtu: 1500, rxBps: 0, txBps: 0, rxPps: 0, txPps: 0, rxTotalBytes: 0, txTotalBytes: 0, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '4', name: 'sfp-sfpplus4', type: 'sfp+', status: 'link_down', linkSpeed: '10 Gbps', macAddress: 'D4:01:C3:88:1A:04', mtu: 1500, rxBps: 0, txBps: 0, rxPps: 0, txPps: 0, rxTotalBytes: 0, txTotalBytes: 0, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '5', name: 'ether1', type: 'ethernet', status: 'running', linkSpeed: '1 Gbps', macAddress: 'D4:01:C3:88:1A:05', mtu: 1500, rxBps: 45800000, txBps: 12100000, rxPps: 5200, txPps: 1800, rxTotalBytes: 256000000, txTotalBytes: 50000000, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '6', name: 'ether2', type: 'ethernet', status: 'running', linkSpeed: '1 Gbps', macAddress: 'D4:01:C3:88:1A:06', mtu: 1500, rxBps: 12800000, txBps: 3400000, rxPps: 1200, txPps: 400, rxTotalBytes: 64000000, txTotalBytes: 16000000, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '7', name: 'ether3', type: 'ethernet', status: 'link_down', linkSpeed: '1 Gbps', macAddress: 'D4:01:C3:88:1A:07', mtu: 1500, rxBps: 0, txBps: 0, rxPps: 0, txPps: 0, rxTotalBytes: 0, txTotalBytes: 0, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '8', name: 'ether4', type: 'ethernet', status: 'link_down', linkSpeed: '1 Gbps', macAddress: 'D4:01:C3:88:1A:08', mtu: 1500, rxBps: 0, txBps: 0, rxPps: 0, txPps: 0, rxTotalBytes: 0, txTotalBytes: 0, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '9', name: 'ether5', type: 'ethernet', status: 'link_down', linkSpeed: '1 Gbps', macAddress: 'D4:01:C3:88:1A:09', mtu: 1500, rxBps: 0, txBps: 0, rxPps: 0, txPps: 0, rxTotalBytes: 0, txTotalBytes: 0, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '10', name: 'ether6', type: 'ethernet', status: 'link_down', linkSpeed: '1 Gbps', macAddress: 'D4:01:C3:88:1A:10', mtu: 1500, rxBps: 0, txBps: 0, rxPps: 0, txPps: 0, rxTotalBytes: 0, txTotalBytes: 0, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '11', name: 'ether7', type: 'ethernet', status: 'link_down', linkSpeed: '1 Gbps', macAddress: 'D4:01:C3:88:1A:11', mtu: 1500, rxBps: 0, txBps: 0, rxPps: 0, txPps: 0, rxTotalBytes: 0, txTotalBytes: 0, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '12', name: 'ether8', type: 'ethernet', status: 'link_down', linkSpeed: '1 Gbps', macAddress: 'D4:01:C3:88:1A:12', mtu: 1500, rxBps: 0, txBps: 0, rxPps: 0, txPps: 0, rxTotalBytes: 0, txTotalBytes: 0, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '13', name: 'ether9', type: 'ethernet', status: 'link_down', linkSpeed: '1 Gbps', macAddress: 'D4:01:C3:88:1A:13', mtu: 1500, rxBps: 0, txBps: 0, rxPps: 0, txPps: 0, rxTotalBytes: 0, txTotalBytes: 0, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '14', name: 'ether10', type: 'ethernet', status: 'link_down', linkSpeed: '1 Gbps', macAddress: 'D4:01:C3:88:1A:14', mtu: 1500, rxBps: 0, txBps: 0, rxPps: 0, txPps: 0, rxTotalBytes: 0, txTotalBytes: 0, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '15', name: 'ether11', type: 'ethernet', status: 'link_down', linkSpeed: '1 Gbps', macAddress: 'D4:01:C3:88:1A:15', mtu: 1500, rxBps: 0, txBps: 0, rxPps: 0, txPps: 0, rxTotalBytes: 0, txTotalBytes: 0, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '16', name: 'ether12', type: 'ethernet', status: 'link_down', linkSpeed: '1 Gbps', macAddress: 'D4:01:C3:88:1A:16', mtu: 1500, rxBps: 0, txBps: 0, rxPps: 0, txPps: 0, rxTotalBytes: 0, txTotalBytes: 0, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
      { id: '17', name: 'bridge-local', type: 'bridge', status: 'running', linkSpeed: '10 Gbps', macAddress: 'D4:01:C3:88:1A:17', mtu: 1500, rxBps: 672530000, txBps: 56870000, rxPps: 58000, txPps: 12000, rxTotalBytes: 1048576000, txTotalBytes: 524288000, rxErrors: 0, txErrors: 0, rxDrops: 0, txDrops: 0 },
    ],
  },
];

export const initialExpenses: Expense[] = [];

export const initialAuditLogs: AuditLog[] = [];

export const initialAddonCatalog: AddonCatalogItem[] = [];

export const initialDailyRemittances: DailyRemittanceRecord[] = [];

export const initialPaymentSubmissions: PaymentSubmission[] = [];

export const initialCoverageAreas: CoverageArea[] = [];

