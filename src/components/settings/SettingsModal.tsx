import React, { useState } from 'react';
import {
  Settings,
  Building2,
  User,
  MapPin,
  CreditCard,
  Key,
  Database,
  Download,
  Upload,
  RefreshCw,
  Check,
  Zap,
  Radio,
  Server,
  Copy,
  Sparkles,
  Bot,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  EyeOff,
  Send,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Activity,
  Cloud,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  SmtpConfig,
  SmtpProviderPreset,
  AuditLog,
  AuditLogCategory,
  AuditLogSeverity,
  SmsGatewayConfig,
  StaffWebhooksConfig,
  SmsProviderType,
} from '../../types';
import { testSmtpConnection, SMTP_PRESETS } from '../../utils/smtpService';
import { testSmsGatewayConnection } from '../../utils/smsSender';
import { sendTelegramStaffAlert, sendDiscordStaffAlert, testWebhookIntegration } from '../../utils/webhookService';
import { XenditGatewaySettings } from './XenditGatewaySettings';
import { FirebaseSettingsCard } from './FirebaseSettingsCard';

export const SettingsModal: React.FC = () => {
  const {
    businessProfile,
    updateBusinessProfile,
    auditLogs,
    clearAuditLogs,
    exportData,
    importData,
    resetToDefault,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'profile' | 'payments' | 'api' | 'firebase' | 'audit' | 'backup'>('profile');

  // Business state
  const [businessName, setBusinessName] = useState(businessProfile.name);
  const [tradeName, setTradeName] = useState(businessProfile.tradeName);
  const [tin, setTin] = useState(businessProfile.tin);
  const [firstName, setFirstName] = useState(businessProfile.representative.firstName);
  const [middleName, setMiddleName] = useState(businessProfile.representative.middleName);
  const [lastName, setLastName] = useState(businessProfile.representative.lastName);
  const [mobile, setMobile] = useState(businessProfile.representative.mobile);
  const [email, setEmail] = useState(businessProfile.representative.email);

  // Address
  const [building, setBuilding] = useState(businessProfile.address.building || '');
  const [street, setStreet] = useState(businessProfile.address.street);
  const [barangay, setBarangay] = useState(businessProfile.address.barangay);
  const [city, setCity] = useState(businessProfile.address.city);
  const [province, setProvince] = useState(businessProfile.address.province);
  const [zipCode, setZipCode] = useState(businessProfile.address.zipCode);
  const [landmark, setLandmark] = useState(businessProfile.address.landmark || '');

  // Payment Gateways
  const [gcashNumber, setGcashNumber] = useState(businessProfile.paymentGateways.gcashNumber);
  const [gcashName, setGcashName] = useState(businessProfile.paymentGateways.gcashName);
  const [gcashQrImage, setGcashQrImage] = useState<string>(businessProfile.paymentGateways.gcashQrImage || '');
  const [mayaNumber, setMayaNumber] = useState(businessProfile.paymentGateways.mayaNumber);
  const [mayaName, setMayaName] = useState(businessProfile.paymentGateways.mayaName);
  const [mayaQrImage, setMayaQrImage] = useState<string>(businessProfile.paymentGateways.mayaQrImage || '');
  const [bankName, setBankName] = useState(businessProfile.paymentGateways.bankName);
  const [bankAccountName, setBankAccountName] = useState(businessProfile.paymentGateways.bankAccountName);
  const [bankAccountNumber, setBankAccountNumber] = useState(businessProfile.paymentGateways.bankAccountNumber);
  const [paymentGatewaySubTab, setPaymentGatewaySubTab] = useState<'xendit' | 'manual'>('xendit');
  const [isXenditEnabled, setIsXenditEnabled] = useState<boolean>(businessProfile.paymentGateways.isXenditEnabled ?? true);
  const [xenditMode, setXenditMode] = useState<'test' | 'live'>(businessProfile.paymentGateways.xenditMode || 'test');
  const [xenditSecretKey, setXenditSecretKey] = useState<string>(businessProfile.paymentGateways.xenditSecretKey || '');
  const [xenditPublicKey, setXenditPublicKey] = useState<string>(businessProfile.paymentGateways.xenditPublicKey || '');
  const [xenditWebhookToken, setXenditWebhookToken] = useState<string>(businessProfile.paymentGateways.xenditWebhookToken || '');

  // API keys
  const [resendKey, setResendKey] = useState(businessProfile.apiKeys.resend);
  const [sendgridKey, setSendgridKey] = useState(businessProfile.apiKeys.sendgrid);
  const [mikrotikIp, setMikrotikIp] = useState(businessProfile.apiKeys.mikrotikIp);
  const [mikrotikUser, setMikrotikUser] = useState(businessProfile.apiKeys.mikrotikUser);
  const [mikrotikPassword, setMikrotikPassword] = useState(businessProfile.apiKeys.mikrotikPassword || '');
  const [geminiApiKey, setGeminiApiKey] = useState(businessProfile.apiKeys.geminiApiKey || '');
  const [geminiModel, setGeminiModel] = useState(businessProfile.apiKeys.geminiModel || 'gemini-2.5-flash');

  // SMS Gateway Configuration
  const [smsProvider, setSmsProvider] = useState<SmsProviderType>(businessProfile.smsGateway?.provider || 'semaphore');
  const [smsApiKey, setSmsApiKey] = useState<string>(businessProfile.smsGateway?.apiKey || '');
  const [smsSenderName, setSmsSenderName] = useState<string>(businessProfile.smsGateway?.senderName || 'SWIFTSTREAM');
  const [philsmsSenderId, setPhilsmsSenderId] = useState<string>(businessProfile.smsGateway?.philsmsSenderId || 'SWIFTSTREAM');
  const [twilioSid, setTwilioSid] = useState<string>(businessProfile.smsGateway?.twilioAccountSid || '');
  const [twilioToken, setTwilioToken] = useState<string>(businessProfile.smsGateway?.twilioAuthToken || '');
  const [twilioFrom, setTwilioFrom] = useState<string>(businessProfile.smsGateway?.twilioFromNumber || '+12055550199');
  const [smsEnabled, setSmsEnabled] = useState<boolean>(businessProfile.smsGateway?.enabled ?? true);
  const [testSmsPhone, setTestSmsPhone] = useState<string>(businessProfile.representative.mobile || '09624171684');
  const [isTestingSms, setIsTestingSms] = useState<boolean>(false);
  const [smsTestResult, setSmsTestResult] = useState<{ success: boolean; message: string; latencyMs: number } | null>(null);

  // Staff Webhooks Configuration
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(businessProfile.staffWebhooks?.telegramEnabled ?? true);
  const [telegramBotToken, setTelegramBotToken] = useState<string>(businessProfile.staffWebhooks?.telegramBotToken || '');
  const [telegramChatId, setTelegramChatId] = useState<string>(businessProfile.staffWebhooks?.telegramChatId || '');
  const [discordEnabled, setDiscordEnabled] = useState<boolean>(businessProfile.staffWebhooks?.discordEnabled ?? true);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState<string>(businessProfile.staffWebhooks?.discordWebhookUrl || '');
  const [notifyOnOutage, setNotifyOnOutage] = useState<boolean>(businessProfile.staffWebhooks?.notifyOnOutage ?? true);
  const [notifyOnCashierRemittance, setNotifyOnCashierRemittance] = useState<boolean>(businessProfile.staffWebhooks?.notifyOnCashierRemittance ?? true);
  const [notifyOnTelemetryWatchdog, setNotifyOnTelemetryWatchdog] = useState<boolean>(businessProfile.staffWebhooks?.notifyOnTelemetryWatchdog ?? true);
  const [notifyOnUrgentRepair, setNotifyOnUrgentRepair] = useState<boolean>(businessProfile.staffWebhooks?.notifyOnUrgentRepair ?? true);
  const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{ success: boolean; message: string; latencyMs: number } | null>(null);

  // SMTP Configuration
  const initialSmtp: SmtpConfig = businessProfile.smtp || {
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
    lastTestStatus: 'untested',
  };

  const [smtpEnabled, setSmtpEnabled] = useState<boolean>(initialSmtp.enabled);
  const [smtpProvider, setSmtpProvider] = useState<SmtpProviderPreset>(initialSmtp.providerPreset || 'gmail');
  const [smtpHost, setSmtpHost] = useState<string>(initialSmtp.host);
  const [smtpPort, setSmtpPort] = useState<number>(initialSmtp.port);
  const [smtpEncryption, setSmtpEncryption] = useState<'tls' | 'ssl' | 'none'>(initialSmtp.encryption || 'tls');
  const [smtpUser, setSmtpUser] = useState<string>(initialSmtp.user);
  const [smtpPassword, setSmtpPassword] = useState<string>(initialSmtp.password || '');
  const [showSmtpPassword, setShowSmtpPassword] = useState<boolean>(false);
  const [smtpFromName, setSmtpFromName] = useState<string>(initialSmtp.fromName);
  const [smtpFromEmail, setSmtpFromEmail] = useState<string>(initialSmtp.fromEmail);

  // Test SMTP state
  const [testEmailAddress, setTestEmailAddress] = useState<string>(businessProfile.representative.email || 'admin@swiftstream.ph');
  const [isTestingSmtp, setIsTestingSmtp] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs: number; details?: string } | null>(null);

  // Audit Trail filtering state
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('all');
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<string>('all');

  const handleSelectSmtpPreset = (preset: SmtpProviderPreset) => {
    setSmtpProvider(preset);
    const info = SMTP_PRESETS[preset];
    if (info) {
      setSmtpHost(info.host);
      setSmtpPort(info.port);
      setSmtpEncryption(info.encryption);
    }
  };

  const handleTestSmtpConnection = async () => {
    setIsTestingSmtp(true);
    setTestResult(null);
    try {
      const config: SmtpConfig = {
        enabled: smtpEnabled,
        host: smtpHost,
        port: Number(smtpPort),
        secure: smtpEncryption === 'ssl',
        encryption: smtpEncryption,
        user: smtpUser,
        password: smtpPassword,
        fromName: smtpFromName,
        fromEmail: smtpFromEmail,
        providerPreset: smtpProvider,
      };
      const res = await testSmtpConnection(config, testEmailAddress);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'SMTP Handshake Error',
        latencyMs: 0,
      });
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const handleTestSmsGateway = async () => {
    setIsTestingSms(true);
    setSmsTestResult(null);
    try {
      const config: SmsGatewayConfig = {
        provider: smsProvider,
        apiKey: smsApiKey,
        senderName: smsSenderName,
        philsmsSenderId,
        twilioAccountSid: twilioSid,
        twilioAuthToken: twilioToken,
        twilioFromNumber: twilioFrom,
        enabled: smsEnabled,
      };
      const res = await testSmsGatewayConnection(
        config,
        testSmsPhone,
        `SWIFTSTREAM TEST: SMS Gateway (${smsProvider.toUpperCase()}) connection verified at ${new Date().toLocaleTimeString()}.`
      );
      setSmsTestResult(res);
    } catch (err: any) {
      setSmsTestResult({
        success: false,
        message: err?.message || 'SMS Dispatch Error',
        latencyMs: 0,
      });
    } finally {
      setIsTestingSms(false);
    }
  };

  const handleTestWebhook = async (type: 'telegram' | 'discord') => {
    setIsTestingWebhook(true);
    setWebhookTestResult(null);
    try {
      const config: StaffWebhooksConfig = {
        telegramEnabled,
        telegramBotToken,
        telegramChatId,
        discordEnabled,
        discordWebhookUrl,
        notifyOnOutage,
        notifyOnCashierRemittance,
        notifyOnTelemetryWatchdog,
        notifyOnUrgentRepair,
      };
      const res = await testWebhookIntegration(type, config);
      setWebhookTestResult(res);
    } catch (err: any) {
      setWebhookTestResult({
        success: false,
        message: err?.message || 'Webhook Dispatch Error',
        latencyMs: 0,
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateBusinessProfile({
      name: businessName,
      tradeName,
      tin,
      representative: {
        ...businessProfile.representative,
        firstName,
        middleName,
        lastName,
        mobile,
        email,
      },
      address: {
        ...businessProfile.address,
        building,
        street,
        barangay,
        city,
        province,
        zipCode,
        landmark,
      },
      paymentGateways: {
        gcashNumber,
        gcashName,
        gcashQrImage,
        mayaNumber,
        mayaName,
        mayaQrImage,
        bankName,
        bankAccountName,
        bankAccountNumber,
        isXenditEnabled,
        xenditMode,
        xenditSecretKey,
        xenditPublicKey,
        xenditWebhookToken,
        xenditChannels: businessProfile.paymentGateways.xenditChannels || [
          'QRPH',
          'CREDIT_CARD',
          '7ELEVEN',
          'BPI_DIRECT',
          'UNIONBANK_DIRECT',
          'GRABPAY',
          'SHOPEEPAY',
        ],
      },
      apiKeys: {
        ...businessProfile.apiKeys,
        resend: resendKey,
        sendgrid: sendgridKey,
        mikrotikIp,
        mikrotikUser,
        mikrotikPassword,
        geminiApiKey,
        geminiModel,
      },
      smsGateway: {
        provider: smsProvider,
        apiKey: smsApiKey,
        senderName: smsSenderName,
        philsmsSenderId,
        twilioAccountSid: twilioSid,
        twilioAuthToken: twilioToken,
        twilioFromNumber: twilioFrom,
        enabled: smsEnabled,
        lastTestedAt: new Date().toISOString(),
      },
      staffWebhooks: {
        telegramEnabled,
        telegramBotToken,
        telegramChatId,
        discordEnabled,
        discordWebhookUrl,
        notifyOnOutage,
        notifyOnCashierRemittance,
        notifyOnTelemetryWatchdog,
        notifyOnUrgentRepair,
      },
      smtp: {
        enabled: smtpEnabled,
        host: smtpHost,
        port: Number(smtpPort),
        secure: smtpEncryption === 'ssl',
        encryption: smtpEncryption,
        user: smtpUser,
        password: smtpPassword,
        fromName: smtpFromName,
        fromEmail: smtpFromEmail,
        providerPreset: smtpProvider,
        lastTestStatus: testResult?.success ? 'success' : testResult ? 'failed' : initialSmtp.lastTestStatus,
        lastTestedAt: testResult ? new Date().toISOString().replace('T', ' ').slice(0, 19) : initialSmtp.lastTestedAt,
      },
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          importData(parsed);
        } catch (err) {
          alert('Error parsing JSON backup file.');
        }
      };
    }
  };

  // Export Audit Logs to CSV
  const handleExportAuditCsv = () => {
    const headers = ['Log ID', 'Timestamp', 'User / Operator', 'Category', 'Severity', 'Action', 'IP Address', 'Status', 'Details'];
    const rows = auditLogs.map((log) => [
      `"${log.id}"`,
      `"${log.timestamp}"`,
      `"${log.userName}"`,
      `"${log.category.toUpperCase()}"`,
      `"${log.severity.toUpperCase()}"`,
      `"${log.action}"`,
      `"${log.ipAddress || '127.0.0.1'}"`,
      `"${log.status.toUpperCase()}"`,
      `"${log.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swiftstream-security-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered Audit Logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchesSearch =
      auditSearch === '' ||
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.userName.toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.ipAddress && log.ipAddress.includes(auditSearch));

    const matchesCategory = auditCategoryFilter === 'all' || log.category === auditCategoryFilter;
    const matchesSeverity = auditSeverityFilter === 'all' || log.severity === auditSeverityFilter;

    return matchesSearch && matchesCategory && matchesSeverity;
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyan-400" />
          <span>Business Profile & ISP System Settings</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure official company information, BIR TIN details, GCash/Maya gateways, SMTP email servers, security audit trails, and backups.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 text-xs overflow-x-auto pb-1">
        {[
          { id: 'profile', label: 'Company & Representative', icon: Building2 },
          { id: 'payments', label: 'Payment Gateways & QR', icon: CreditCard },
          { id: 'firebase', label: 'Cloud Firestore Sync', icon: Cloud },
          { id: 'api', label: 'API, AI & SMTP Server', icon: Key },
          { id: 'audit', label: `Security Audit Trail (${auditLogs.length})`, icon: Shield },
          { id: 'backup', label: 'Database Backup & Restore', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'border-cyan-500 text-cyan-300 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Profile & Location */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6 text-xs shadow-card">
          <div className="space-y-4">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] text-cyan-400">
              Official Business Identity
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Business Legal Name *</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Trade Name / Brand</label>
                <input
                  type="text"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">BIR TIN Number *</label>
                <input
                  type="text"
                  value={tin}
                  onChange={(e) => setTin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] text-cyan-400">
              Authorized Representative
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">First Name *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Middle Name</label>
                <input
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Last Name *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Contact Number *</label>
                <input
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Official Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] text-cyan-400">
              Operations & Repair Shop Address
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Street / Highway *</label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Barangay *</label>
                <input
                  type="text"
                  value={barangay}
                  onChange={(e) => setBarangay(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">City / Municipality *</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Province *</label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">ZIP Code *</label>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                  required
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold shadow-lg shadow-cyan-600/20 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Save Company Profile</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Payment Gateways */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Sub Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setPaymentGatewaySubTab('xendit')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                paymentGatewaySubTab === 'xendit'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Zap className="w-4 h-4 text-blue-400" />
              <span>Xendit Payment Gateway (PH API)</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentGatewaySubTab('manual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                paymentGatewaySubTab === 'manual'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <CreditCard className="w-4 h-4 text-cyan-400" />
              <span>Direct E-Wallets & Bank Accounts (Manual QR)</span>
            </button>
          </div>

          {paymentGatewaySubTab === 'xendit' ? (
            <XenditGatewaySettings />
          ) : (
            <form onSubmit={handleSaveProfile} className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6 text-xs shadow-card">
              <div className="space-y-4">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] text-cyan-400">
                  GCash Payment Gateway
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">GCash Registered Number *</label>
                    <input
                      type="text"
                      value={gcashNumber}
                      onChange={(e) => setGcashNumber(e.target.value)}
                      placeholder="09XXXXXXXXX"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">GCash Account Name *</label>
                    <input
                      type="text"
                      value={gcashName}
                      onChange={(e) => setGcashName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] text-cyan-400">
                  Maya Gateway
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Maya Number *</label>
                    <input
                      type="text"
                      value={mayaNumber}
                      onChange={(e) => setMayaNumber(e.target.value)}
                      placeholder="09XXXXXXXXX"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Maya Account Name *</label>
                    <input
                      type="text"
                      value={mayaName}
                      onChange={(e) => setMayaName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-800">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] text-cyan-400">
                  Bank Deposit / Wire Transfer
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Bank Name *</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="BDO / Landbank"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Account Name *</label>
                    <input
                      type="text"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Account Number *</label>
                    <input
                      type="text"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold shadow-lg shadow-cyan-600/20"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Payment Channels</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Tab 3: API, AI & SMTP Server */}
      {activeTab === 'api' && (
        <form onSubmit={handleSaveProfile} className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6 text-xs shadow-card">
          {/* SMTP Outgoing Mail Server Settings */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] text-cyan-400 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  <span>SMTP Outgoing Mail Server Configuration</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Deliver transactional HTML invoices, payment receipts, and automated billing advisories to subscribers.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                  <input
                    type="checkbox"
                    checked={smtpEnabled}
                    onChange={(e) => setSmtpEnabled(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded"
                  />
                  <span className="text-slate-300 font-medium">Enable SMTP</span>
                </label>

                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[10px] font-bold border ${
                  testResult?.success || initialSmtp.lastTestStatus === 'success'
                    ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                    : 'bg-amber-950/40 border-amber-800/50 text-amber-300'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    testResult?.success || initialSmtp.lastTestStatus === 'success' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`} />
                  <span>
                    {testResult?.success
                      ? `HANDSHAKE OK (${testResult.latencyMs}ms)`
                      : initialSmtp.lastTestStatus === 'success'
                      ? 'READY TO DISPATCH'
                      : 'UNTESTED'}
                  </span>
                </div>
              </div>
            </div>

            {/* Provider Quick Presets */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div>
                <label className="block text-slate-400 mb-2 font-medium">Quick 1-Click SMTP Presets:</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'gmail', label: 'Google Gmail' },
                    { id: 'brevo', label: 'Brevo (Sendinblue)' },
                    { id: 'sendgrid', label: 'SendGrid SMTP' },
                    { id: 'mailgun', label: 'Mailgun' },
                    { id: 'zoho', label: 'Zoho Mail' },
                    { id: 'outlook', label: 'Microsoft 365' },
                    { id: 'custom', label: 'Custom SMTP Relay' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectSmtpPreset(preset.id as SmtpProviderPreset)}
                      className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                        smtpProvider === preset.id
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/10'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  💡 {SMTP_PRESETS[smtpProvider]?.notes || 'Configure your custom SMTP host and credentials.'}
                </p>
              </div>

              {/* Host, Port & Encryption */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-900">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">SMTP Server Host *</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">SMTP Port *</label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                    placeholder="587"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Encryption Mode *</label>
                  <select
                    value={smtpEncryption}
                    onChange={(e) => setSmtpEncryption(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono"
                  >
                    <option value="tls">STARTTLS (Port 587)</option>
                    <option value="ssl">SSL / TLS (Port 465)</option>
                    <option value="none">None / Plain (Port 25)</option>
                  </select>
                </div>
              </div>

              {/* Auth Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">SMTP Username / Login *</label>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="swiftstream.billing@gmail.com"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium flex items-center justify-between">
                    <span>SMTP Password / App Token</span>
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="text-slate-400 hover:text-slate-200 flex items-center gap-1 text-[10px]"
                    >
                      {showSmtpPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showSmtpPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </label>
                  <input
                    type={showSmtpPassword ? 'text' : 'password'}
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono"
                  />
                </div>
              </div>

              {/* Sender Name & Sender Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Sender Display Name *</label>
                  <input
                    type="text"
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                    placeholder="SwiftStream Telecom Billing"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">From Email Address *</label>
                  <input
                    type="email"
                    value={smtpFromEmail}
                    onChange={(e) => setSmtpFromEmail(e.target.value)}
                    placeholder="billing@swiftstream.ph"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Test SMTP Handshake Box */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-200 text-[11px] block">
                      🧪 Test SMTP Connection & Handshake
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Send a test packet to verify port access, TLS security, and credentials.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={testEmailAddress}
                      onChange={(e) => setTestEmailAddress(e.target.value)}
                      placeholder="admin@swiftstream.ph"
                      className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono text-[11px] w-52"
                    />
                    <button
                      type="button"
                      onClick={handleTestSmtpConnection}
                      disabled={isTestingSmtp}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl font-semibold transition-all shadow-sm"
                    >
                      {isTestingSmtp ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Test Handshake</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                      testResult.success
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                        : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                    )}
                    <div className="space-y-0.5">
                      <p className="font-semibold text-xs">{testResult.message}</p>
                      {testResult.details && <p className="text-[11px] opacity-90">{testResult.details}</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Core MikroTik Router Gateway Settings */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] text-cyan-400 flex items-center gap-2">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span>Core MikroTik Router Configuration</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Default connection parameters for your core PPPoE BNG router.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/50 px-3 py-1 rounded-xl text-emerald-300 font-mono text-[10px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>ROUTER ONLINE ({mikrotikIp})</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Router IP Address *</label>
                  <input
                    type="text"
                    value={mikrotikIp}
                    onChange={(e) => setMikrotikIp(e.target.value)}
                    placeholder="192.168.88.1"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Admin Username *</label>
                  <input
                    type="text"
                    value={mikrotikUser}
                    onChange={(e) => setMikrotikUser(e.target.value)}
                    placeholder="admin"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Admin Password</label>
                  <input
                    type="password"
                    value={mikrotikPassword}
                    onChange={(e) => setMikrotikPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Google Gemini AI Agent Settings */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] text-cyan-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Google Gemini AI Agent Integration</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Powers the 24/7 AI Assistant across Homepage (Sales), Client Portal (Billing Support), and Admin Console (ISP Copilot).
                </p>
              </div>

              <div className="flex items-center gap-2 bg-purple-950/40 border border-purple-800/50 px-3 py-1 rounded-xl text-purple-300 font-mono text-[10px] font-bold">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                <span>{geminiApiKey ? 'LIVE GEMINI CLOUD' : 'SMART LOCAL ENGINE ACTIVE'}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Google Gemini API Key</label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Get a free API key from Google AI Studio. If left blank, the built-in intelligent domain engine is used automatically.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">AI Model Version</label>
                  <select
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono"
                  >
                    <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Recommended)</option>
                    <option value="gemini-3.7-flash">gemini-3.7-flash (Latest Model)</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro (Advanced Reasoning)</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Select the Gemini model for real-time customer and admin queries.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Philippine SMS Gateway Integrator */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] text-cyan-400 flex items-center gap-2">
                  <Send className="w-4 h-4 text-cyan-400" />
                  <span>Philippine SMS Gateway Integrations</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Ready configurations for Semaphore API (Philippines), PhilSMS, Twilio, and sandbox testing.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                  <input
                    type="checkbox"
                    checked={smsEnabled}
                    onChange={(e) => setSmsEnabled(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 rounded"
                  />
                  <span className="text-slate-300 font-medium">Enable SMS Gateway</span>
                </label>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              {/* Provider Selector */}
              <div>
                <label className="block text-slate-400 mb-2 font-medium">Select Active SMS Gateway:</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'semaphore', label: 'Semaphore API (Philippines Native)' },
                    { id: 'philsms', label: 'PhilSMS Gateway (Local PH)' },
                    { id: 'twilio', label: 'Twilio Global SMS' },
                    { id: 'sandbox', label: 'SwiftStream Telecom Sandbox' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSmsProvider(p.id as SmsProviderType)}
                      className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
                        smsProvider === p.id
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/10'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Provider Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-900">
                {(smsProvider === 'semaphore' || smsProvider === 'philsms') && (
                  <>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">
                        {smsProvider === 'semaphore' ? 'Semaphore API Key *' : 'PhilSMS API Token *'}
                      </label>
                      <input
                        type="password"
                        value={smsApiKey}
                        onChange={(e) => setSmsApiKey(e.target.value)}
                        placeholder="semi_live_..."
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Sender ID / Brand Mask *</label>
                      <input
                        type="text"
                        value={smsSenderName}
                        onChange={(e) => setSmsSenderName(e.target.value)}
                        placeholder="SWIFTSTREAM"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono font-bold"
                      />
                    </div>
                  </>
                )}

                {smsProvider === 'twilio' && (
                  <>
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Twilio Account SID *</label>
                      <input
                        type="text"
                        value={twilioSid}
                        onChange={(e) => setTwilioSid(e.target.value)}
                        placeholder="AC..."
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Twilio Auth Token *</label>
                      <input
                        type="password"
                        value={twilioToken}
                        onChange={(e) => setTwilioToken(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-medium">Twilio From Number / Sender ID</label>
                      <input
                        type="text"
                        value={twilioFrom}
                        onChange={(e) => setTwilioFrom(e.target.value)}
                        placeholder="+12055550199"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono"
                      />
                    </div>
                  </>
                )}

                {smsProvider === 'sandbox' && (
                  <div className="sm:col-span-2 p-3 bg-cyan-950/20 border border-cyan-800/30 rounded-xl text-cyan-300">
                    <p>💡 <strong>Sandbox Testing Mode:</strong> High-fidelity local simulation with realistic telco latency. SMS logs will be captured and previewed in real-time without consuming telco credits.</p>
                  </div>
                )}
              </div>

              {/* Test SMS Dispatcher */}
              <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-200 text-[11px] block">
                      🧪 Test SMS Gateway Handshake
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Send a live verification SMS to verify gateway authorization and delivery.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={testSmsPhone}
                      onChange={(e) => setTestSmsPhone(e.target.value)}
                      placeholder="09123456789"
                      className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono text-[11px] w-36"
                    />
                    <button
                      type="button"
                      onClick={handleTestSmsGateway}
                      disabled={isTestingSms}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl font-semibold transition-all shadow-sm"
                    >
                      {isTestingSms ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>{isTestingSms ? 'Sending...' : 'Test SMS'}</span>
                    </button>
                  </div>
                </div>

                {smsTestResult && (
                  <div
                    className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${
                      smsTestResult.success
                        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                        : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                    }`}
                  >
                    {smsTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                    <span>{smsTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Telegram & Discord Staff Webhook Bot */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] text-sky-400 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-sky-400" />
                  <span>Telegram & Discord Staff Alert Bots</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Instant webhook notifications for fiber cuts, telemetry watchdog triggers, and cashier drawer closures.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Telegram Card */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-sky-400" />
                    <span>Telegram Operations Bot</span>
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px]">
                    <input
                      type="checkbox"
                      checked={telegramEnabled}
                      onChange={(e) => setTelegramEnabled(e.target.checked)}
                      className="accent-sky-500 rounded"
                    />
                    <span className="text-slate-300">Enabled</span>
                  </label>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Telegram Bot Token *</label>
                  <input
                    type="password"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    placeholder="bot123456:ABC-DEF..."
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Telegram Chat ID / Group Channel ID *</label>
                  <input
                    type="text"
                    value={telegramChatId}
                    onChange={(e) => setTelegramChatId(e.target.value)}
                    placeholder="-1001928471920"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono text-[11px]"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleTestWebhook('telegram')}
                    disabled={isTestingWebhook}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-[11px] font-semibold flex items-center gap-1.5"
                  >
                    <Send className="w-3 h-3" />
                    <span>Test Telegram Alert</span>
                  </button>
                </div>
              </div>

              {/* Discord Card */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-purple-400" />
                    <span>Discord NOC Channel Webhook</span>
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px]">
                    <input
                      type="checkbox"
                      checked={discordEnabled}
                      onChange={(e) => setDiscordEnabled(e.target.checked)}
                      className="accent-purple-500 rounded"
                    />
                    <span className="text-slate-300">Enabled</span>
                  </label>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Discord Webhook URL *</label>
                  <input
                    type="password"
                    value={discordWebhookUrl}
                    onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono text-[11px]"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5 text-[10px]">
                  <span className="font-semibold text-slate-400 block">Trigger Events:</span>
                  <div className="grid grid-cols-2 gap-1 text-slate-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={notifyOnOutage} onChange={(e) => setNotifyOnOutage(e.target.checked)} className="rounded accent-purple-500" />
                      <span>Fiber Cut Outages</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={notifyOnCashierRemittance} onChange={(e) => setNotifyOnCashierRemittance(e.target.checked)} className="rounded accent-purple-500" />
                      <span>Cashier Z-Reading EOD</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={notifyOnTelemetryWatchdog} onChange={(e) => setNotifyOnTelemetryWatchdog(e.target.checked)} className="rounded accent-purple-500" />
                      <span>Telemetry Watchdog</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={notifyOnUrgentRepair} onChange={(e) => setNotifyOnUrgentRepair(e.target.checked)} className="rounded accent-purple-500" />
                      <span>Urgent Repair Tickets</span>
                    </label>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleTestWebhook('discord')}
                    disabled={isTestingWebhook}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-[11px] font-semibold flex items-center gap-1.5"
                  >
                    <Send className="w-3 h-3" />
                    <span>Test Discord Webhook</span>
                  </button>
                </div>
              </div>
            </div>

            {webhookTestResult && (
              <div
                className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${
                  webhookTestResult.success
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                }`}
              >
                {webhookTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                <span>{webhookTestResult.message}</span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold shadow-lg shadow-cyan-600/20 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Save System, SMS & Webhook Settings</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab: Google Firebase & Cloud Firestore Sync */}
      {activeTab === 'firebase' && <FirebaseSettingsCard />}

      {/* Tab 4: Security Audit Trail & Compliance */}
      {activeTab === 'audit' && (
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6 text-xs shadow-card">
          {/* Audit Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Events Logged</span>
              <span className="text-xl font-bold font-mono text-cyan-400">{auditLogs.length}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Security Alerts</span>
              <span className="text-xl font-bold font-mono text-amber-400">
                {auditLogs.filter((l) => l.severity === 'warning' || l.severity === 'critical').length}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Billing & Receipts</span>
              <span className="text-xl font-bold font-mono text-emerald-400">
                {auditLogs.filter((l) => l.category === 'billing').length}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Network & MikroTik</span>
              <span className="text-xl font-bold font-mono text-purple-400">
                {auditLogs.filter((l) => l.category === 'network').length}
              </span>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-slate-950/90 border border-slate-800 rounded-2xl">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search logs by operator, action, IP, or details..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 font-mono text-xs"
                />
              </div>

              <select
                value={auditCategoryFilter}
                onChange={(e) => setAuditCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-xs"
              >
                <option value="all">All Categories</option>
                <option value="auth">Authentication</option>
                <option value="billing">Billing & Invoices</option>
                <option value="customer">Subscribers</option>
                <option value="network">MikroTik & Network</option>
                <option value="expenses">Operating Expenses</option>
                <option value="smtp">SMTP & Mail</option>
                <option value="settings">Settings</option>
                <option value="system">System & Database</option>
              </select>

              <select
                value={auditSeverityFilter}
                onChange={(e) => setAuditSeverityFilter(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 text-xs"
              >
                <option value="all">All Severities</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportAuditCsv}
                className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-xl font-semibold transition-all whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Clear all historical security audit logs?')) {
                    clearAuditLogs();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/30 rounded-xl font-semibold transition-all whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Ledger</span>
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="overflow-hidden border border-slate-800 rounded-2xl bg-slate-950">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-bold sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Operator</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">IP Address</th>
                    <th className="px-4 py-3">Activity Description</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-sans">
                        No audit records match your current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                        <td className="px-4 py-2.5 text-slate-200 font-sans font-medium whitespace-nowrap">
                          {log.userName}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap font-sans">
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 border border-slate-800 text-[10px] uppercase font-semibold">
                            {log.category}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-cyan-300 font-semibold whitespace-nowrap">{log.action}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap font-sans">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              log.severity === 'critical'
                                ? 'bg-rose-950/60 text-rose-300 border border-rose-800/80'
                                : log.severity === 'warning'
                                ? 'bg-amber-950/60 text-amber-300 border border-amber-800/80'
                                : 'bg-sky-950/60 text-sky-300 border border-sky-800/80'
                            }`}
                          >
                            {log.severity}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{log.ipAddress || '192.168.88.10'}</td>
                        <td className="px-4 py-2.5 text-slate-300 font-sans max-w-xs truncate" title={log.details}>
                          {log.details}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
                              log.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                log.status === 'success' ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                            />
                            <span>{log.status.toUpperCase()}</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Backup & Restore */}
      {activeTab === 'backup' && (
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6 text-xs shadow-card">
          <div className="space-y-4">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] text-cyan-400">
              Database Backup & Portability
            </h4>
            <p className="text-slate-400">
              Export your entire ISP database (subscribers, plans, invoices, payments, repairs, expenses, audit logs, NAP boxes) to a portable JSON backup file.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold">
                  <Download className="w-4 h-4" />
                  <span>Export Database Backup</span>
                </div>
                <p className="text-slate-400">
                  Save all current records into a local `.json` file for off-site backup or migration.
                </p>
                <button
                  onClick={exportData}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold transition-colors"
                >
                  Download JSON Backup
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-purple-400 font-semibold">
                  <Upload className="w-4 h-4" />
                  <span>Restore from Backup</span>
                </div>
                <p className="text-slate-400">
                  Select a previous `.json` backup file to restore all subscribers and transaction ledgers.
                </p>
                <label className="inline-block px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold cursor-pointer transition-colors">
                  <span>Choose Backup File...</span>
                  <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-900/40 space-y-2 pt-4">
              <h5 className="font-bold text-rose-400">Reset Demo Database</h5>
              <p className="text-slate-400">
                Clear custom entries and reload sample SwiftStream Telecommunication & Repair Shop data.
              </p>
              <button
                onClick={() => {
                  if (window.confirm('Reset all records to initial SwiftStream defaults?')) {
                    resetToDefault();
                  }
                }}
                className="px-4 py-2 bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white rounded-xl font-semibold transition-colors"
              >
                Reset Database to Sample Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
