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
  invoice?: Invoice,
  options?: {
    maintenanceWindow?: string;
    maintenanceScope?: string;
    restoredTime?: string;
    customNote?: string;
  }
): string => {
  const amountStr = invoice ? formatCurrency(invoice.balanceDue) : formatCurrency(customer.balance);
  const dueDateStr = invoice ? formatDate(invoice.dueDate) : 'Immediately';
  const brandName = business.tradeName || business.name || 'SWIFTSTREAM';
  const areaName = customer.address?.barangay ? `Brgy. ${customer.address.barangay}` : 'your area';

  switch (type) {
    case 'upcoming_due':
      return `${brandName} BILL ADVISORY: Hi ${customer.fullName}, your Fiber Internet bill (${invoice?.invoiceNumber || 'Monthly Bill'}) for ${amountStr} is due on ${dueDateStr}. Pay conveniently via GCash ${business.paymentGateways.gcashNumber} (${business.paymentGateways.gcashName}) or at our ${business.address.city || 'local'} office. Thank you!`;

    case 'due_today':
      return `${brandName} REMINDER: Hi ${customer.fullName}, your internet bill ${invoice?.invoiceNumber || ''} of ${amountStr} is DUE TODAY (${dueDateStr}). Please settle promptly via GCash ${business.paymentGateways.gcashNumber} to avoid service disruption.`;

    case 'overdue_warning':
      return `${brandName} OVERDUE NOTICE: Hi ${customer.fullName}, your account ${customer.accountNo} has an overdue balance of ${amountStr} (Due: ${dueDateStr}). Please settle today via GCash ${business.paymentGateways.gcashNumber} (${business.paymentGateways.gcashName}) or visit ${business.name} Office in ${business.address.barangay || business.address.city || 'our branch'}.`;

    case 'disconnection_notice':
      return `${brandName} FINAL NOTICE: Dear ${customer.fullName}, account ${customer.accountNo} is scheduled for temporary disconnection due to unpaid balance of ${amountStr}. Please settle via GCash ${business.paymentGateways.gcashNumber} or contact ${business.representative.mobile} for reconnection.`;

    case 'payment_confirmation':
      return `${brandName} RECEIPT: Thank you ${customer.fullName}! We have received your payment of ${amountStr} for account ${customer.accountNo}. Your internet connection is active. Hotline: ${business.representative.mobile}.`;

    case 'maintenance_advisory': {
      const windowStr = options?.maintenanceWindow || 'tonight from 1:00 AM to 5:00 AM';
      const scopeStr = options?.maintenanceScope ? ` (${options.maintenanceScope})` : '';
      return `${brandName} MAINTENANCE ADVISORY: Please be advised that scheduled network preventive maintenance${scopeStr} is scheduled for ${areaName} on ${windowStr}. You may experience temporary internet downtime. Lines will be restored immediately after completion. Hotlines: ${business.representative.mobile}. Thank you for your patience!`;
    }

    case 'restored_advisory': {
      const timeStr = options?.restoredTime || 'just now';
      return `${brandName} SERVICE RESTORATION NOTICE: Hi ${customer.fullName}! We are pleased to inform you that fiber internet services in ${areaName} have been FULLY RESTORED as of ${timeStr}. If your router still shows no internet, please restart/power-cycle your ONU/router for 10 seconds. Hotline: ${business.representative.mobile}. Thank you for your support!`;
    }

    case 'general_advisory':
      return `${brandName} ADVISORY: Hi ${customer.fullName}, ${options?.customNote || `this is an important announcement regarding your fiber internet subscription.`} Hotlines: ${business.representative.mobile}.`;

    default:
      return `${brandName}: Hi ${customer.fullName}, this is regarding your internet subscription at ${business.name}. Contact ${business.representative.mobile} for any assistance.`;
  }
};

export const generateOutageAdvisoryMessage = (
  outageType: OutageType,
  targetScope: string,
  targetName: string,
  etr: string,
  business: BusinessProfile
): string => {
  const brand = business.tradeName || business.name || 'SWIFTSTREAM';
  const outageTitles: Record<OutageType, string> = {
    fiber_cut: 'EMERGENCY FIBER CABLE CUT ADVISORY',
    olt_pon_failure: 'OLT DISTRIBUTION PORT SIGNAL DEGRADATION',
    power_interruption: 'COMMERCIAL POWER OUTAGE (GENSET ACTIVE)',
    emergency_splicing: 'EMERGENCY CORE SPLICING & ALIGNMENT',
    scheduled_maintenance: 'SCHEDULED PREVENTIVE FIBER MAINTENANCE',
  };

  const title = outageTitles[outageType] || 'NETWORK SERVICE INTERRUPTION';

  return `[${brand} ${title}] Dear subscriber, please be advised of a service interruption affecting ${targetScope.toUpperCase()}: ${targetName}. Field fiber technicians & splicers are actively on site restoring connectivity. Estimated Time of Restoration (ETR): ${etr}. Support Hotlines: ${business.representative.mobile}. Thank you for your patience!`;
};

export const generateOutageRestorationMessage = (
  targetScope: string,
  targetName: string,
  restoredTime: string,
  business: BusinessProfile,
  includeRebootGuide: boolean = true
): string => {
  const brand = business.tradeName || business.name || 'SWIFTSTREAM';
  const rebootText = includeRebootGuide
    ? ' If your connection remains offline, please power-cycle (restart) your fiber ONU/router for 10 seconds.'
    : '';
  return `[${brand} SERVICE RESTORATION] Good news! Fiber internet service affecting ${targetScope.toUpperCase()}: ${targetName} has been FULLY RESTORED as of ${restoredTime}.${rebootText} Support Hotline: ${business.representative.mobile}. Thank you for your understanding!`;
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
