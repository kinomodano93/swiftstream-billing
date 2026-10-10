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

/**
 * Calculates aligned billing period, due date, and grace expiry from installation date and billing day.
 * E.g., if installed on October 10:
 * - Next due date automatically aligns to November 10.
 * - 1st billing period runs October 10 to November 09.
 * - Grace expiry occurs on November 15 (due date + grace days).
 */
export function calculateAlignedBillingDates(
  installationDateStr: string,
  billingDayInput?: number,
  graceDaysInput?: number,
  referenceDate: Date = new Date()
): {
  billingDay: number;
  graceDays: number;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  graceExpiryDate: string;
} {
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const cleanInstallDate = installationDateStr || new Date().toISOString().slice(0, 10);
  const [iY, iM, iD] = cleanInstallDate.split('-').map((v) => parseInt(v, 10));
  const fallbackDay = iD && !isNaN(iD) && iD >= 1 && iD <= 31 ? iD : 10;
  const billingDay = billingDayInput && billingDayInput >= 1 && billingDayInput <= 31 ? billingDayInput : fallbackDay;
  const graceDays = graceDaysInput !== undefined && !isNaN(graceDaysInput) && graceDaysInput >= 0 ? graceDaysInput : 5;

  // The client's installation date
  const installYear = iY && !isNaN(iY) ? iY : referenceDate.getFullYear();
  const installMonth = iM && !isNaN(iM) ? iM - 1 : referenceDate.getMonth();
  const installDate = new Date(installYear, installMonth, fallbackDay);

  // Compute next due date: exactly 1 month after installation, aligned with billingDay
  let dueYear = installYear;
  let dueMonth = installMonth + 1;

  // If calculating for ongoing cycles where referenceDate is further along:
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  if (refYear > installYear || (refYear === installYear && refMonth > installMonth)) {
    dueYear = refYear;
    dueMonth = refMonth;
    // If billing day has already passed this month, move to next month
    if (referenceDate.getDate() > billingDay) {
      dueMonth += 1;
    }
  }

  // Adjust for year rollover if dueMonth >= 12
  const targetDueDate = new Date(dueYear, dueMonth, 1);
  const maxDaysInDueMonth = new Date(targetDueDate.getFullYear(), targetDueDate.getMonth() + 1, 0).getDate();
  const clampedDueDay = Math.min(billingDay, maxDaysInDueMonth);
  targetDueDate.setDate(clampedDueDay);

  // Period start: exactly 1 month prior to due date, aligned with billingDay
  const targetPeriodStart = new Date(targetDueDate.getFullYear(), targetDueDate.getMonth() - 1, 1);
  const maxDaysInStartMonth = new Date(targetPeriodStart.getFullYear(), targetPeriodStart.getMonth() + 1, 0).getDate();
  const clampedStartDay = Math.min(billingDay, maxDaysInStartMonth);
  targetPeriodStart.setDate(clampedStartDay);

  // If this is the very first billing period right after installation, period start is the actual installation date
  const periodStart = targetPeriodStart < installDate ? installDate : targetPeriodStart;

  // Period end: 1 day before due date
  const targetPeriodEnd = new Date(targetDueDate);
  targetPeriodEnd.setDate(targetPeriodEnd.getDate() - 1);

  // Grace expiry date: due date + grace days
  const targetGraceExpiry = new Date(targetDueDate);
  targetGraceExpiry.setDate(targetGraceExpiry.getDate() + graceDays);

  return {
    billingDay,
    graceDays,
    periodStart: fmt(periodStart),
    periodEnd: fmt(targetPeriodEnd),
    dueDate: fmt(targetDueDate),
    graceExpiryDate: fmt(targetGraceExpiry),
  };
}


