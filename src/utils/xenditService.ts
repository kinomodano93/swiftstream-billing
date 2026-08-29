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
    id: 'QRPH',
    name: 'QR Ph (National QR Standard)',
    category: 'qr_ph',
    icon: '📱',
    description: 'Scan using any banking app (BDO, BPI, Maya, GCash, UnionBank)',
    feePercentage: 1.5,
  },
  {
    id: 'CREDIT_CARD',
    name: 'Credit & Debit Cards (Visa / Mastercard / JCB)',
    category: 'card',
    icon: '💳',
    description: 'Accepts all major local and international banks with 3D-Secure',
    feePercentage: 3.5,
    fixedFee: 15,
  },
  {
    id: '7ELEVEN',
    name: '7-Eleven CLIQQ Barcode',
    category: 'retail_outlet',
    icon: '🏪',
    description: 'Pay cash at any 7-Eleven branch nationwide via CLiQQ barcode',
    fixedFee: 20,
  },
  {
    id: 'CEBUANA',
    name: 'Cebuana Lhuillier / M Lhuillier',
    category: 'retail_outlet',
    icon: '🏬',
    description: 'Over-the-counter payment at 3,000+ pawnshop branches',
    fixedFee: 25,
  },
  {
    id: 'BPI_DIRECT',
    name: 'BPI Direct Online Banking',
    category: 'direct_debit',
    icon: '🏦',
    description: 'Direct account debit login via BPI Online',
    fixedFee: 15,
  },
  {
    id: 'UNIONBANK_DIRECT',
    name: 'UnionBank Online Direct Debit',
    category: 'direct_debit',
    icon: '🏛️',
    description: 'Instant secure bank transfer with UB Online credentials',
    fixedFee: 15,
  },
  {
    id: 'GRABPAY',
    name: 'GrabPay Wallet',
    category: 'ewallet',
    icon: '🚗',
    description: 'Instant payment via Grab mobile application',
    feePercentage: 2.0,
  },
  {
    id: 'SHOPEEPAY',
    name: 'ShopeePay Wallet',
    category: 'ewallet',
    icon: '🛍️',
    description: 'Scan or redirect to Shopee app for instant verification',
    feePercentage: 2.0,
  },
];

export interface XenditInvoiceResponse {
  id: string;
  external_id: string;
  user_id: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED';
  merchant_name: string;
  amount: number;
  payer_email: string;
  description: string;
  invoice_url: string;
  expiry_date: string;
  currency: string;
  payment_channel?: string;
  payment_method?: string;
  barcode_number?: string;
}

/**
 * Creates a simulated or real Xendit Hosted Checkout Invoice
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

  const checkoutUrl = `https://checkout.xendit.co/v2/${invoiceId}`;

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
  };
};

