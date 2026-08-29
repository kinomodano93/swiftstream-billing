import { BusinessProfile, Customer, Invoice, ReminderType } from '../types';
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

export const sendMockNotification = async (
  channel: 'sms' | 'email' | 'both',
  recipient: { mobile: string; email: string; name: string },
  message: string,
  subject: string = 'SwiftStream Telecommunication Advisory'
): Promise<{ success: boolean; channel: string; statusMessage: string; timestamp: string }> => {
  // Simulate network dispatch delay
  await new Promise((resolve) => setTimeout(resolve, 600));

  console.log(`[Notification Dispatch] Channel: ${channel} | Recipient: ${recipient.name} (${recipient.mobile} / ${recipient.email})`);
  console.log(`[Subject]: ${subject}`);
  console.log(`[Content]:\n${message}`);

  return {
    success: true,
    channel,
    statusMessage: `Successfully delivered to ${channel === 'sms' ? recipient.mobile : channel === 'email' ? recipient.email : `${recipient.mobile} & ${recipient.email}`}`,
    timestamp: new Date().toISOString(),
  };
};

