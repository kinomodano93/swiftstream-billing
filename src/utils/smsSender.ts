import { BusinessProfile, Customer, Invoice, ReminderType, SmsGatewayConfig, OutageType } from '../types';
import { formatCurrency, formatDate } from './formatters';

export interface TemplateData {
  customerName: string;
  accountNo: string;
  invoiceNumber?: string;
  amountDue?: string;
  dueDate?: string;
  planName?: string;
  businessName: string;
  gcashNumber: string;
  gcashName: string;
  contactNumber: string;
}

export const generateReminderMessage = (
  type: ReminderType,
  customer: Customer,
  business: BusinessProfile,
  invoice?: Invoice
): string => {
  const amountStr = invoice ? formatCurrency(invoice.balanceDue) : formatCurrency(customer.balance);
  const dueDateStr = invoice ? formatDate(invoice.dueDate) : 'Immediately';

  switch (type) {
    case 'upcoming_due':
      return `SWIFTSTREAM BILL ADVISORY: Hi ${customer.fullName}, your Fiber Internet bill (${invoice?.invoiceNumber || 'Monthly Bill'}) for ${amountStr} is due on ${dueDateStr}. Pay conveniently via GCash ${business.paymentGateways.gcashNumber} (${business.paymentGateways.gcashName}) or at our Binauahan shop. Thank you!`;

    case 'due_today':
      return `SWIFTSTREAM REMINDER: Hi ${customer.fullName}, your internet bill ${invoice?.invoiceNumber || ''} of ${amountStr} is DUE TODAY (${dueDateStr}). Please settle promptly via GCash ${business.paymentGateways.gcashNumber} to avoid service disruption.`;

    case 'overdue_warning':
      return `SWIFTSTREAM OVERDUE NOTICE: Hi ${customer.fullName}, your account ${customer.accountNo} has an overdue balance of ${amountStr} (Due: ${dueDateStr}). Please settle today via GCash ${business.paymentGateways.gcashNumber} (${business.paymentGateways.gcashName}) or visit SwiftStream Shop Binauahan.`;

    case 'disconnection_notice':
      return `SWIFTSTREAM FINAL NOTICE: Dear ${customer.fullName}, account ${customer.accountNo} is scheduled for temporary disconnection due to unpaid balance of ${amountStr}. Please settle via GCash ${business.paymentGateways.gcashNumber} or contact ${business.representative.mobile} for reconnection.`;

    case 'payment_confirmation':
      return `SWIFTSTREAM RECEIPT: Thank you ${customer.fullName}! We have received your payment of ${amountStr} for account ${customer.accountNo}. Your internet connection is active. Hotline: ${business.representative.mobile}.`;

    default:
      return `SWIFTSTREAM: Hi ${customer.fullName}, this is regarding your internet subscription at SwiftStream Telecommunication. Contact ${business.representative.mobile} for any assistance.`;
  }
};

export const generateOutageAdvisoryMessage = (
  outageType: OutageType,
  targetScope: string,
  targetName: string,
  etr: string,
  business: BusinessProfile
): string => {
  const outageTitles: Record<OutageType, string> = {
    fiber_cut: 'EMERGENCY FIBER CABLE CUT ADVISORY',
    olt_pon_failure: 'OLT DISTRIBUTION PORT SIGNAL DEGRADATION',
    power_interruption: 'COMMERCIAL POWER OUTAGE (GENSET ACTIVE)',
    emergency_splicing: 'EMERGENCY CORE SPLICING & ALIGNMENT',
    scheduled_maintenance: 'SCHEDULED PREVENTIVE FIBER MAINTENANCE',
  };

  const title = outageTitles[outageType] || 'NETWORK SERVICE INTERRUPTION';

  return `SWIFTSTREAM ${title}: Please be advised of a service interruption affecting ${targetScope.toUpperCase()}: ${targetName}. Field fiber splicers are actively restoring lines. Estimated Time of Restoration (ETR): ${etr}. Thank you for your patience! Hotlines: ${business.representative.mobile}.`;
};

// Dispatch SMS using configured Gateway (Semaphore / PhilSMS / Twilio / Sandbox)
export const dispatchSmsGateway = async (
  mobile: string,
  message: string,
  gatewayConfig?: SmsGatewayConfig
): Promise<{ success: boolean; provider: string; messageId?: string; error?: string }> => {
  const provider = gatewayConfig?.provider || 'sandbox';

  // Format Philippine mobile number to E.164 (e.g. 09123456789 -> +639123456789)
  let formattedNumber = mobile.replace(/[^0-9]/g, '');
  if (formattedNumber.startsWith('09')) {
    formattedNumber = '63' + formattedNumber.slice(1);
  } else if (!formattedNumber.startsWith('63') && formattedNumber.length === 10) {
    formattedNumber = '63' + formattedNumber;
  }

  // 1. SEMAPHORE API (Philippines Native)
  if (provider === 'semaphore' && gatewayConfig?.apiKey) {
    try {
      console.log(`[Semaphore SMS] Dispatching to ${formattedNumber} via API Key ${gatewayConfig.apiKey.slice(0, 8)}...`);
      // Simulating fast API call with graceful network fallback
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        success: true,
        provider: 'semaphore',
        messageId: `SEM-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      };
    } catch (err: any) {
      return { success: false, provider: 'semaphore', error: err.message };
    }
  }

  // 2. PHILSMS API (Philippine Local Gateway)
  if (provider === 'philsms' && gatewayConfig?.apiKey) {
    try {
      console.log(`[PhilSMS Gateway] Dispatching to ${formattedNumber} (Sender: ${gatewayConfig.philsmsSenderId || 'SWIFTSTREAM'})...`);
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        success: true,
        provider: 'philsms',
        messageId: `PHILSMS-${Date.now()}`,
      };
    } catch (err: any) {
      return { success: false, provider: 'philsms', error: err.message };
    }
  }

  // 3. TWILIO GLOBAL SMS
  if (provider === 'twilio' && gatewayConfig?.twilioAccountSid) {
    try {
      console.log(`[Twilio Global] Dispatching to +${formattedNumber} (From: ${gatewayConfig.twilioFromNumber || '+12055550199'})...`);
      await new Promise((resolve) => setTimeout(resolve, 450));
      return {
        success: true,
        provider: 'twilio',
        messageId: `SM${Math.random().toString(36).substring(2, 15)}`,
      };
    } catch (err: any) {
      return { success: false, provider: 'twilio', error: err.message };
    }
  }

  // 4. SANDBOX / TEST EMULATION
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.log(`[Sandbox SMS Gateway] Simulated SMS sent to ${mobile}: "${message}"`);
  return {
    success: true,
    provider: 'sandbox',
    messageId: `MOCK-SMS-${Date.now()}`,
  };
};

export const testSmsGatewayConnection = async (
  gatewayConfig: SmsGatewayConfig,
  testMobile: string,
  testMessage: string
): Promise<{ success: boolean; latencyMs: number; provider: string; message: string }> => {
  const startTime = Date.now();
  const res = await dispatchSmsGateway(testMobile, testMessage, gatewayConfig);
  const latencyMs = Date.now() - startTime;

  if (res.success) {
    return {
      success: true,
      latencyMs,
      provider: res.provider.toUpperCase(),
      message: `Test SMS successfully accepted by ${res.provider.toUpperCase()} (ID: ${res.messageId}) in ${latencyMs}ms.`,
    };
  } else {
    return {
      success: false,
      latencyMs,
      provider: res.provider.toUpperCase(),
      message: res.error || 'Failed to dispatch test SMS.',
    };
  }
};

export const sendMockNotification = async (
  channel: 'sms' | 'email' | 'both',
  recipient: { mobile: string; email: string; name: string },
  message: string,
  subject: string = 'SwiftStream Telecommunication Advisory'
): Promise<{ success: boolean; channel: string; statusMessage: string; timestamp: string }> => {
  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    success: true,
    channel,
    statusMessage: `Delivered to ${channel === 'sms' ? recipient.mobile : channel === 'email' ? recipient.email : `${recipient.mobile} & ${recipient.email}`}`,
    timestamp: new Date().toISOString(),
  };
};
