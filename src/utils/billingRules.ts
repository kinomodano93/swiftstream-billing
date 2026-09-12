import { Invoice } from '../types';

/**
 * Checks if an invoice matches a customer using resilient multi-field lookup:
 * UUID id, accountNo, or cross-referenced fields.
 */
export const doesCustomerMatchInvoice = (
  customer: { id: string; accountNo?: string },
  inv: Invoice
): boolean => {
  if (!customer || !inv) return false;
  if (inv.customerId && inv.customerId === customer.id) return true;
  if (customer.accountNo && inv.accountNo === customer.accountNo) return true;
  if (customer.accountNo && inv.customerId === customer.accountNo) return true;
  if (customer.id && inv.accountNo === customer.id) return true;
  return false;
};

/**
 * Determines whether an invoice belongs to / covers the specified billing month (e.g. "2026-09").
 * Checks billingPeriodStart, billingPeriodEnd, issueDate, createdAt, dueDate, and invoice number prefix.
 * Explicitly ignores cancelled invoices.
 */
export const isInvoiceForBillingMonth = (inv: Invoice, billingMonth: string): boolean => {
  if (!inv || !billingMonth) return false;
  // Ignore cancelled/voided invoices
  if (inv.status === 'cancelled') return false;

  const [year, month] = billingMonth.split('-');
  const shortYear = year && year.length === 4 ? year.slice(2) : year;
  const invPrefix = shortYear && month ? `INV-${shortYear}${month}-` : '';

  // 1. Direct date field prefix matching (e.g. "2026-09-01" starts with "2026-09")
  if (inv.billingPeriodStart && inv.billingPeriodStart.startsWith(billingMonth)) return true;
  if (inv.billingPeriodEnd && inv.billingPeriodEnd.startsWith(billingMonth)) return true;
  if (inv.issueDate && inv.issueDate.startsWith(billingMonth)) return true;
  if (inv.createdAt && inv.createdAt.startsWith(billingMonth)) return true;
  if (inv.dueDate && inv.dueDate.startsWith(billingMonth)) return true;

  // 2. Invoice number pattern matching (e.g. INV-2609-0001)
  if (invPrefix && inv.invoiceNumber && inv.invoiceNumber.startsWith(invPrefix)) return true;

  // 3. Billing period date range coverage (e.g. 2026-08-25 to 2026-09-24)
  if (inv.billingPeriodStart && inv.billingPeriodEnd) {
    const startMonth = inv.billingPeriodStart.slice(0, 7);
    const endMonth = inv.billingPeriodEnd.slice(0, 7);
    if (startMonth <= billingMonth && endMonth >= billingMonth) return true;
  }

  return false;
};

/**
 * Finds an existing invoice for a subscriber in a specified billing month.
 */
export const findCustomerInvoiceForMonth = (
  customer: { id: string; accountNo?: string },
  billingMonth: string,
  invoiceList: Invoice[]
): Invoice | undefined => {
  if (!customer || !billingMonth || !invoiceList || invoiceList.length === 0) return undefined;
  return invoiceList.find(
    (inv) => doesCustomerMatchInvoice(customer, inv) && isInvoiceForBillingMonth(inv, billingMonth)
  );
};

/**
 * Returns true if the customer already has an active invoice for the specified billing month.
 */
export const hasCustomerInvoiceForMonth = (
  customer: { id: string; accountNo?: string },
  billingMonth: string,
  invoiceList: Invoice[]
): boolean => {
  return Boolean(findCustomerInvoiceForMonth(customer, billingMonth, invoiceList));
};

