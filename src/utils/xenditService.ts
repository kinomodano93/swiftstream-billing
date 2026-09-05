import { BusinessProfile, Customer, Invoice, Payment } from '../types';
import { generateId } from './formatters';

export interface XenditChannel {
  id: string;
  name: string;
  category: 'card' | 'ewallet' | 'direct_debit' | 'retail_outlet' | 'qr_ph';
  icon: string;
  description: string;
  feePercentage?: number;
  fixedFee?: number;
}

export const XENDIT_CHANNELS: XenditChannel[] = [
  {
    id: 'GCASH',
    name: 'GCash',
    category: 'ewallet',
    icon: '📱',
    description: 'Instant e-wallet payment via GCash app',
    feePercentage: 2.0,
  },
  {
    id: 'MAYA',
    name: 'Maya',
    category: 'ewallet',
    icon: '💳',
    description: 'Pay via Maya mobile wallet balance',
    feePercentage: 2.0,
  },
  {
    id: 'GRABPAY',
    name: 'GrabPay',
    category: 'ewallet',
    icon: '🚗',
    description: 'Instant payment via Grab mobile application',
    feePercentage: 2.0,
  },
  {
    id: 'SHOPEEPAY',
    name: 'ShopeePay',
    category: 'ewallet',
    icon: '🛍️',
    description: 'Scan or redirect to Shopee app for instant verification',
    feePercentage: 2.0,
  },
  {
    id: 'QRPH',
    name: 'QRPh',
    category: 'qr_ph',
    icon: '📲',
    description: 'Universal QR Ph scanned by any bank or wallet app',
    feePercentage: 1.5,
  },
  {
    id: 'BPI',
    name: 'BPI',
    category: 'direct_debit',
    icon: '🏦',
    description: 'Direct online payment via BPI Online Banking',
    fixedFee: 15,
  },
  {
    id: 'UNIONBANK',
    name: 'UnionBank',
    category: 'direct_debit',
    icon: '🏛️',
    description: 'Instant bank transfer with UB Online credentials',
    fixedFee: 15,
  },
  {
    id: 'BDO',
    name: 'BDO',
    category: 'direct_debit',
    icon: '🏦',
    description: 'Online payment via BDO Digital Banking',
    fixedFee: 15,
  },
  {
    id: 'RCBC',
    name: 'RCBC',
    category: 'direct_debit',
    icon: '🏦',
    description: 'Online payment via RCBC Pulz / Online',
    fixedFee: 15,
  },
  {
    id: 'CHINABANK',
    name: 'China Bank',
    category: 'direct_debit',
    icon: '🏦',
    description: 'Online payment via China Bank Online',
    fixedFee: 15,
  },
  {
    id: 'BPI_DIRECT',
    name: 'BPI Direct Debit',
    category: 'direct_debit',
    icon: '🔄',
    description: 'Recurring auto-debit link with BPI account',
    fixedFee: 15,
  },
  {
    id: 'UNIONBANK_DIRECT',
    name: 'UnionBank Direct Debit',
    category: 'direct_debit',
    icon: '🔄',
    description: 'Recurring auto-debit link with UnionBank account',
    fixedFee: 15,
  },
  {
    id: 'BDO_DIRECT',
    name: 'BDO Direct Debit',
    category: 'direct_debit',
    icon: '🔄',
    description: 'Recurring auto-debit link with BDO account',
    fixedFee: 15,
  },
  {
    id: 'RCBC_DIRECT',
    name: 'RCBC Direct Debit',
    category: 'direct_debit',
    icon: '🔄',
    description: 'Recurring auto-debit link with RCBC account',
    fixedFee: 15,
  },
  {
    id: 'CHINABANK_DIRECT',
    name: 'China Bank Direct Debit',
    category: 'direct_debit',
    icon: '🔄',
    description: 'Recurring auto-debit link with China Bank account',
    fixedFee: 15,
  },
  {
    id: 'CREDIT_CARD',
    name: 'Debit / Credit Card',
    category: 'card',
    icon: '💳',
    description: 'Accepts Visa, Mastercard, and JCB with 3D-Secure',
    feePercentage: 3.5,
    fixedFee: 15,
  },
  {
    id: '7ELEVEN',
    name: '7-Eleven CLIQQ',
    category: 'retail_outlet',
    icon: '🏪',
    description: 'Pay cash at any 7-Eleven branch nationwide via CLiQQ barcode',
    fixedFee: 20,
  },
];

export interface XenditInvoiceResponse {
  id: string;
  external_id: string;
  user_id?: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'SETTLED';
  merchant_name?: string;
  amount: number;
  payer_email?: string;
  description: string;
  invoice_url: string;
  expiry_date?: string;
  currency: string;
  payment_channel?: string;
  payment_method?: string;
  barcode_number?: string;
  is_simulation?: boolean;
}

/**
 * Creates a simulated fallback Xendit Hosted Checkout Invoice
 */
export const createXenditCheckoutSession = (
  customer: Customer,
  invoice: Invoice | { id: string; invoiceNumber: string; totalAmount: number; balanceDue: number },
  amount: number,
  business: BusinessProfile,
  preferredChannel?: string
): XenditInvoiceResponse => {
  const invoiceId = `xnd_inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const externalId = `INV-${customer.accountNo}-${Date.now().toString().slice(-6)}`;
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // 7-Eleven barcode simulation
  const barcodeNumber = `711-${customer.accountNo.replace(/\D/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`;

  const checkoutUrl = `https://checkout.xendit.co/web/${invoiceId}`;

  return {
    id: invoiceId,
    external_id: externalId,
    user_id: 'xnd_user_swiftstream_lagonoy',
    status: 'PENDING',
    merchant_name: business.name,
    amount,
    payer_email: customer.email || 'customer@swiftstream.ph',
    description: `Fiber Internet Service Bill for ${customer.fullName} (${customer.accountNo}) - Lagonoy Node`,
    invoice_url: checkoutUrl,
    expiry_date: expiry,
    currency: 'PHP',
    payment_channel: preferredChannel || 'MULTI_CHANNEL',
    barcode_number: barcodeNumber,
    is_simulation: true,
  };
};

/**
 * Creates a real Xendit Hosted Invoice via Backend Proxy (/api/xendit/create-invoice)
 */
export const createRealXenditInvoice = async (
  customer: Customer,
  invoice: Invoice | { id: string; invoiceNumber: string; totalAmount: number; balanceDue: number },
  amount: number,
  business: BusinessProfile,
  preferredChannel?: string
): Promise<XenditInvoiceResponse> => {
  const externalId = `INV-${customer.accountNo}-${Date.now().toString().slice(-6)}`;
  const secretKey = business.paymentGateways.xenditSecretKey || business.paymentGateways.xenditConfig?.secretKey;

  const requestBody = {
    external_id: externalId,
    amount: Math.max(1, Math.round(amount)),
    description: `SwiftStream Fiber Internet - ${customer.fullName} (${customer.accountNo})`,
    payer_email: customer.email || 'customer@swiftstream.ph',
    customer: {
      given_names: customer.fullName.split(' ')[0] || customer.fullName,
      surname: customer.fullName.split(' ').slice(1).join(' ') || 'Subscriber',
      email: customer.email || 'customer@swiftstream.ph',
      mobile_number: customer.mobile?.startsWith('+') ? customer.mobile : customer.mobile?.startsWith('0') ? `+63${customer.mobile.slice(1)}` : '+639171234567',
    },
    payment_methods: preferredChannel && preferredChannel !== 'MULTI_CHANNEL' ? [preferredChannel] : undefined,
    currency: 'PHP',
    secretKey,
    success_redirect_url: window.location.origin + '/?status=payment_success',
    failure_redirect_url: window.location.origin + '/?status=payment_failed',
  };

  try {
    const response = await fetch('/api/xendit/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && (data.invoice_url || data.id)) {
        return {
          id: data.id,
          external_id: data.external_id || externalId,
          status: data.status || 'PENDING',
          amount: data.amount || amount,
          description: data.description || requestBody.description,
          invoice_url: data.invoice_url || `https://checkout.xendit.co/web/${data.id}`,
          expiry_date: data.expiry_date,
          currency: data.currency || 'PHP',
          payment_channel: preferredChannel || 'MULTI_CHANNEL',
          barcode_number: `711-${customer.accountNo.replace(/\D/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`,
          is_simulation: data.is_simulation || false,
        };
      }
    }
  } catch (err) {
    console.warn('[Xendit Service] Backend proxy unreachable, falling back to local session generation:', err);
  }

  // Fallback to local session if network error
  return createXenditCheckoutSession(customer, invoice, amount, business, preferredChannel);
};

/**
 * Checks the status of an existing Xendit Invoice
 */
export const checkXenditInvoiceStatus = async (
  invoiceId: string,
  secretKey?: string
): Promise<{ status: 'PENDING' | 'PAID' | 'EXPIRED'; invoice?: any }> => {
  try {
    const query = new URLSearchParams({ id: invoiceId });
    if (secretKey) query.set('secretKey', secretKey);

    const response = await fetch(`/api/xendit/invoice-status?${query.toString()}`);
    if (response.ok) {
      const data = await response.json();
      return {
        status: data.status || 'PENDING',
        invoice: data,
      };
    }
  } catch (err) {
    console.warn('[Xendit Service] Failed to poll invoice status:', err);
  }
  return { status: 'PENDING' };
};

/**
 * Diagnostic test connection against Xendit API
 */
export const testXenditConnection = async (
  secretKey: string
): Promise<{ success: boolean; message: string; details?: any }> => {
  try {
    const res = await fetch('/api/xendit/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretKey }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: `Successfully connected to Xendit! Merchant User: ${data.user?.business_name || data.user?.email || 'Authorized'}`,
        details: data.user,
      };
    }

    return {
      success: false,
      message: data.error?.message || data.message || `Xendit API returned HTTP ${res.status}`,
      details: data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to reach Xendit API proxy: ${err.message}`,
    };
  }
};


