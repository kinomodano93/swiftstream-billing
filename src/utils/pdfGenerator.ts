import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BusinessProfile, Customer, Invoice, Payment, Plan } from '../types';
import {
  formatBusinessAddress,
  formatCurrencyPdf,
  formatDate,
  formatDateTime,
  formatOrdinalNumber,
  getBusinessAddressLines,
  getBusinessInvoiceAddress,
  resolveInvoicePlanDetails,
} from './formatters';

export const generateInvoicePDF = (
  invoice: Invoice,
  business: BusinessProfile,
  customer?: Customer,
  plans?: Plan[]
): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // 1. Data Verification & Safe Calculations
  const serviceItems = invoice.items.filter(
    (item) => item.type !== 'late_fee' && item.type !== 'discount'
  );
  const itemsSubtotal = serviceItems.length > 0
    ? serviceItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    : (Number(invoice.subtotal) || 0);

  const discountAmount = Math.max(0, Number(invoice.discount) || 0);
  const previousBalanceAmount = Math.max(0, Number(invoice.previousBalance) || 0);
  const netCurrentCharges = Math.max(0, itemsSubtotal - discountAmount);

  // Total invoice amount = Net Current Charges + Prior Arrears
  const computedTotalAmount = invoice.totalAmount > 0
    ? invoice.totalAmount
    : (netCurrentCharges + previousBalanceAmount);

  const paidAmount = Math.max(0, Number(invoice.amountPaid) || 0);
  const computedBalanceDue = invoice.status === 'paid'
    ? 0
    : Math.max(0, computedTotalAmount - paidAmount);

  // Plan Details Resolution
  const planDetails = resolveInvoicePlanDetails(invoice, customer, plans);

  // 2. Top Header Banner
  doc.setFillColor(15, 23, 42); // Slate-900 Dark Navy
  doc.rect(0, 0, 210, 37, 'F');

  // Cyan Accent Line
  doc.setFillColor(6, 182, 212); // Cyan-500
  doc.rect(0, 37, 210, 2.5, 'F');

  // Company Information (Left)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text((business.name || 'TELECOMMUNICATIONS PROVIDER').toUpperCase(), 14, 13);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 182, 212); // Cyan-400
  const rawSubtitle = business.heroTitle || business.tradeName || (business.industry && business.industry !== 'Information Technology & Telecommunications' ? business.industry : '') || 'Internet & Digital Telecom Services';
  const businessSubtitle = rawSubtitle.length > 55 ? rawSubtitle.slice(0, 52) + '...' : rawSubtitle;
  doc.text(businessSubtitle, 14, 18);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // Slate-300
  const invoiceAddr = getBusinessInvoiceAddress(business.address);
  if (invoiceAddr) {
    doc.text(invoiceAddr, 14, 23.5);
  }
  doc.text(
    `BIR Reg. TIN: ${business.tin} | Hotline: ${business.representative.mobile} | Email: ${business.representative.email}`,
    14,
    29.5
  );

  // Statement of Account Title & Metadata (Right)
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 182, 212);
  doc.text('STATEMENT OF ACCOUNT', 196, 13, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`Statement No: ${invoice.invoiceNumber}`, 196, 19, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Billing Date: ${formatDate(invoice.issueDate)}`, 196, 24, { align: 'right' });
  doc.text(`Account No: ${invoice.accountNo}`, 196, 28.5, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`Payment Due: ${formatDate(invoice.dueDate)}`, 196, 33, { align: 'right' });

  // 3. Payment Status & Due Date Ribbon
  const ribbonY = 42;
  const isPaid = invoice.status === 'paid' || computedBalanceDue === 0;
  const isOverdue = invoice.status === 'overdue';

  if (isPaid) {
    doc.setFillColor(240, 253, 244); // Emerald-50
    doc.setDrawColor(187, 247, 208); // Emerald-200
    doc.roundedRect(14, ribbonY, 182, 9, 1.5, 1.5, 'FD');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 128, 61); // Emerald-700
    doc.text('PAYMENT STATUS', 18, ribbonY + 6);

    doc.setFontSize(11);
    doc.setTextColor(22, 163, 74); // Green
    doc.text('PAID', 192, ribbonY + 6.2, { align: 'right' });
  } else if (isOverdue) {
    doc.setFillColor(255, 241, 242); // Rose-50
    doc.setDrawColor(254, 205, 211); // Rose-200
    doc.roundedRect(14, ribbonY, 182, 9, 1.5, 1.5, 'FD');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(190, 18, 60); // Rose-700
    doc.text('STATUS: OVERDUE — PLEASE SETTLE IMMEDIATELY TO AVOID SERVICE INTERRUPTION', 18, ribbonY + 6);
    doc.text(`TOTAL DUE: ${formatCurrencyPdf(computedBalanceDue)}`, 192, ribbonY + 6, { align: 'right' });
  } else {
    doc.setFillColor(240, 249, 255); // Sky-50
    doc.setDrawColor(186, 230, 253); // Sky-200
    doc.roundedRect(14, ribbonY, 182, 9, 1.5, 1.5, 'FD');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(3, 105, 161); // Sky-700
    doc.text(`PAYMENT DUE DATE: ${formatDate(invoice.dueDate)}`, 18, ribbonY + 6);
    doc.text(`TOTAL AMOUNT DUE: ${formatCurrencyPdf(computedBalanceDue)}`, 192, ribbonY + 6, { align: 'right' });
  }

  // 4. Two Info Cards: Subscriber Info (Left) & Subscription Details (Right)
  const infoY = 54;
  const infoH = 27;

  // Left Card: Subscriber
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, infoY, 90, infoH, 1.5, 1.5, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('SUBSCRIBER BILLING DETAILS', 18, infoY + 5);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.customerName, 18, infoY + 10.5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Account No: `, 18, infoY + 15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text(invoice.accountNo, 36, infoY + 15);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const truncatedAddress = invoice.customerAddress.length > 52
    ? invoice.customerAddress.slice(0, 52) + '...'
    : invoice.customerAddress;
  doc.text(`Service Address: ${truncatedAddress}`, 18, infoY + 19.5);
  doc.text(`Mobile: ${invoice.customerMobile}`, 18, infoY + 24);

  // Right Card: Billing Period & Statement Info
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(108, infoY, 88, infoH, 1.5, 1.5, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('BILLING PERIOD & STATEMENT INFO', 112, infoY + 5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Coverage Period:', 112, infoY + 11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${formatDate(invoice.billingPeriodStart)} to ${formatDate(invoice.billingPeriodEnd)}`,
    112,
    infoY + 15.5
  );

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Statement Date: ${formatDate(invoice.issueDate)}`, 112, infoY + 20);
  doc.text(`Payment Due: ${formatDate(invoice.dueDate)}`, 112, infoY + 24);

  // 5. Itemized Table
  const cleanPlanName = planDetails.planName.replace(/\s*\|\s*\d+\s*mbps/i, '').trim();
  const tableData = serviceItems.map((item, index) => {
    const isPlanItem = item.type === 'plan' || (!item.type && index === 0);
    let description = item.description;
    if (isPlanItem) {
      if (invoice.isProrated && invoice.proratedDays) {
        description = `Monthly Internet Subscription: ${cleanPlanName || planDetails.planName} (${planDetails.speedMbps} Mbps) — Prorated (${invoice.proratedDays} Days)`;
      } else {
        description = `Monthly Internet Subscription: ${cleanPlanName || planDetails.planName} (${planDetails.speedMbps} Mbps)`;
      }
    } else if (item.type === 'installation') {
      description = item.description || 'Installation & Setup Fee';
    }

    const unitPrice = isPlanItem && (item.unitPrice <= 0 || !invoice.isProrated) ? planDetails.monthlyFee : item.unitPrice;
    const itemAmount = isPlanItem && (item.amount <= 0 || !invoice.isProrated) ? planDetails.monthlyFee : item.amount;

    return [
      index + 1,
      description,
      item.quantity.toString(),
      formatCurrencyPdf(unitPrice),
      formatCurrencyPdf(itemAmount),
    ];
  });

  autoTable(doc, {
    startY: 84,
    head: [['#', 'Description of Services & Charges', 'Qty', 'Unit Rate (PHP)', 'Amount (PHP)']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.8,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 98 },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 120;
  const postTableY = finalY + 5;

  // 6. Post-Table Sections: Left (Payment Channels & Tax) and Right (Financial Summary)
  const leftW = 90;
  const rightX = 108;
  const rightW = 88;

  // Left: Payment Channels Box
  const activeGateways: string[] = [];
  if (business.paymentGateways.gcashNumber) {
    activeGateways.push(`• GCash QR Ph: ${business.paymentGateways.gcashNumber}${business.paymentGateways.gcashName ? ` (${business.paymentGateways.gcashName})` : ''}`);
  }
  if (business.paymentGateways.mayaNumber) {
    activeGateways.push(`• Maya: ${business.paymentGateways.mayaNumber}${business.paymentGateways.mayaName ? ` (${business.paymentGateways.mayaName})` : ''}`);
  }
  if (business.paymentGateways.bankName || business.paymentGateways.bankAccountNumber) {
    activeGateways.push(`• Bank: ${business.paymentGateways.bankName || 'Bank'}${business.paymentGateways.bankAccountNumber ? ` - Acct: ${business.paymentGateways.bankAccountNumber}` : ''}`);
  }
  const otcLoc = [
    business.address?.barangay
      ? (/^brgy\.?\s*/i.test(business.address.barangay)
        ? business.address.barangay
        : `Brgy. ${business.address.barangay}`)
      : '',
    business.address?.city,
  ].filter(Boolean).join(', ');
  activeGateways.push(`• Over-the-Counter: ${business.name || 'Office'} Cashier Desk${otcLoc ? ` (${otcLoc})` : ''}`);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const maxLineWidth = 78;
  const wrappedGateways: string[][] = activeGateways.map((gw) =>
    doc.splitTextToSize(gw, maxLineWidth)
  );
  const totalLines = wrappedGateways.reduce((sum, lines) => sum + lines.length, 0);
  const payH = Math.max(30, 8.5 + totalLines * 3.7 + (wrappedGateways.length - 1) * 0.8 + 3.5);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, postTableY, leftW, payH, 1.5, 1.5, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('OFFICIAL PAYMENT CHANNELS', 18, postTableY + 5);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  let currentPayY = postTableY + 9.5;
  wrappedGateways.forEach((lines) => {
    lines.forEach((line, lIdx) => {
      doc.text(line, lIdx === 0 ? 18 : 20.5, currentPayY);
      currentPayY += 3.7;
    });
    currentPayY += 0.8;
  });

  // Right: Financial Calculations Ledger
  let calcY = postTableY + 3;

  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  if (discountAmount > 0) {
    doc.text('Current Charges Subtotal:', rightX, calcY);
    doc.text(formatCurrencyPdf(itemsSubtotal), 196, calcY, { align: 'right' });

    calcY += 4.5;
    doc.setTextColor(16, 185, 129); // Green
    doc.text('Less: Promotional Discount / Credit:', rightX, calcY);
    doc.text(`-${formatCurrencyPdf(discountAmount)}`, 196, calcY, { align: 'right' });

    calcY += 4.5;
    doc.setTextColor(71, 85, 105);
    doc.text('Net Current Month Charges:', rightX, calcY);
    doc.text(formatCurrencyPdf(netCurrentCharges), 196, calcY, { align: 'right' });
  } else {
    doc.text('Current Month Charges:', rightX, calcY);
    doc.text(formatCurrencyPdf(netCurrentCharges), 196, calcY, { align: 'right' });
  }

  if (previousBalanceAmount > 0) {
    calcY += 4.5;
    doc.setTextColor(225, 29, 72); // Rose Red
    doc.text('Previous Unpaid Balance (Arrears):', rightX, calcY);
    doc.text(`+${formatCurrencyPdf(previousBalanceAmount)}`, 196, calcY, { align: 'right' });

    calcY += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Total Invoiced Amount:', rightX, calcY);
    doc.text(formatCurrencyPdf(computedTotalAmount), 196, calcY, { align: 'right' });
  }

  if (paidAmount > 0) {
    calcY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(16, 185, 129); // Green
    doc.text('Less: Payments Received to Date:', rightX, calcY);
    doc.text(`-${formatCurrencyPdf(paidAmount)}`, 196, calcY, { align: 'right' });
  }

  // TOTAL BALANCE DUE HIGHLIGHT BOX
  calcY += 6;
  doc.setFillColor(15, 23, 42); // Navy
  doc.rect(rightX, calcY - 4, rightW, 9.5, 'F');

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL AMOUNT DUE:', rightX + 3, calcY + 2.5);

  doc.setTextColor(6, 182, 212); // Cyan
  doc.text(formatCurrencyPdf(computedTotalAmount), 194, calcY + 2.5, { align: 'right' });

  // 7. Footer Notes (Important Subscriber Notices)
  const bottomOfContent = Math.max(postTableY + payH, calcY + 8);
  const footerY = Math.max(246, bottomOfContent + 5);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(14, footerY, 196, footerY);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('IMPORTANT SUBSCRIBER NOTICES:', 14, footerY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);

  const officeNoticeSummary = getBusinessInvoiceAddress(business.address);

  let settlementNotice = '';
  if (isPaid) {
    settlementNotice = `2. Payment received in full${invoice.paidAt ? ` on ${formatDate(invoice.paidAt)}` : ''}. Thank you for keeping your account updated and active.`;
  } else if (isOverdue) {
    settlementNotice = `2. Payment was due on ${formatDate(invoice.dueDate)}. Please settle immediately to restore or maintain uninterrupted service connectivity.`;
  } else if (paidAmount > 0 && computedBalanceDue > 0) {
    settlementNotice = `2. Partial payment received. Please settle remaining balance of ${formatCurrencyPdf(computedBalanceDue)} on or before ${formatDate(invoice.dueDate)} to maintain uninterrupted service connectivity.`;
  } else {
    settlementNotice = `2. Settle on or before ${formatDate(invoice.dueDate)} to maintain uninterrupted service connectivity.`;
  }

  const notices: string[] = [
    `1. Please include your Account No. (${invoice.accountNo}) in payment notes when paying via online channels.`,
    settlementNotice,
    `3. Hotline: ${business.representative.mobile} | Email: ${business.representative.email}${officeNoticeSummary ? ` | Office: ${officeNoticeSummary}` : ''}.`,
    '4. This document serves as an official Statement of Account for telecommunications services.',
  ];

  let currentNoticeY = footerY + 9.5;
  notices.forEach((notice) => {
    const wrappedLines: string[] = doc.splitTextToSize(notice, 182);
    wrappedLines.forEach((line) => {
      doc.text(line, 14, currentNoticeY);
      currentNoticeY += 3.8;
    });
  });

  return doc;
};

export const generateOfficialReceiptPDF = (payment: Payment, business: BusinessProfile): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 160], // Thermal Receipt 80mm
  });

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(business.name.toUpperCase(), 40, 10, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(business.tradeName || (business.industry && business.industry !== 'Information Technology & Telecommunications' ? business.industry : '') || 'Internet & Digital Telecom Services', 40, 14, { align: 'center' });
  doc.text(`TIN: ${business.tin}`, 40, 18, { align: 'center' });
  doc.text(getBusinessAddressLines(business.address).line2 || formatBusinessAddress(business.address), 40, 22, { align: 'center' });
  doc.text(`Hotline: ${business.representative.mobile}`, 40, 26, { align: 'center' });

  doc.setLineWidth(0.3);
  doc.line(5, 29, 75, 29);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('COLLECTION OFFICIAL RECEIPT', 40, 34, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`OR No: ${payment.receiptNumber}`, 6, 40);
  doc.text(`Date: ${formatDateTime(payment.paymentDate)}`, 6, 44);
  doc.text(`Cashier: ${payment.cashierName}`, 6, 48);

  doc.line(5, 51, 75, 51);

  doc.text(`Received From:`, 6, 56);
  doc.setFont('helvetica', 'bold');
  doc.text(payment.customerName, 6, 60);

  doc.setFont('helvetica', 'normal');
  doc.text(`Account No: ${payment.accountNo}`, 6, 65);
  if (payment.invoiceNumber) {
    doc.text(`Applied to Invoice: ${payment.invoiceNumber}`, 6, 69);
  }
  doc.text(`Payment Mode: ${payment.paymentMethod.toUpperCase()}`, 6, 73);
  if (payment.referenceNumber) {
    doc.text(`Ref No: ${payment.referenceNumber}`, 6, 77);
  }

  doc.line(5, 81, 75, 81);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('AMOUNT RECEIVED:', 6, 88);
  doc.setFontSize(10);
  doc.text(formatCurrencyPdf(payment.amount), 74, 88, { align: 'right' });

  doc.line(5, 93, 75, 93);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('STATUS: PAYMENT POSTED & VERIFIED', 40, 99, { align: 'center' });
  doc.text('Thank you for your payment!', 40, 103, { align: 'center' });
  doc.text('THIS SERVES AS AN OFFICIAL BIR ACKNOWLEDGMENT', 40, 107, { align: 'center' });

  return doc;
};

export const generateThermalReceiptPDF = (
  payment: Payment,
  invoice: Invoice | undefined,
  business: BusinessProfile,
  paperWidth: '58mm' | '80mm' = '80mm'
): jsPDF => {
  const widthMm = paperWidth === '58mm' ? 58 : 80;
  const heightMm = paperWidth === '58mm' ? 180 : 190;
  const centerX = widthMm / 2;
  const margin = paperWidth === '58mm' ? 4 : 6;
  const rightX = widthMm - margin;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
  });

  // Business Header
  doc.setFontSize(paperWidth === '58mm' ? 9 : 10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(business.name.toUpperCase(), centerX, 9, { align: 'center' });

  doc.setFontSize(paperWidth === '58mm' ? 6.5 : 7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(business.tradeName || (business.industry && business.industry !== 'Information Technology & Telecommunications' ? business.industry : '') || 'Internet Service Provider', centerX, 13, { align: 'center' });
  doc.text(`TIN: ${business.tin}`, centerX, 17, { align: 'center' });
  doc.text(getBusinessAddressLines(business.address).line2 || formatBusinessAddress(business.address), centerX, 21, { align: 'center' });
  doc.text(`Hotline: ${business.representative.mobile}`, centerX, 25, { align: 'center' });

  doc.setLineWidth(0.3);
  doc.line(margin, 28, rightX, 28);

  // Title
  doc.setFontSize(paperWidth === '58mm' ? 8 : 9);
  doc.setFont('helvetica', 'bold');
  doc.text('COLLECTION OFFICIAL RECEIPT', centerX, 33, { align: 'center' });

  doc.setFontSize(paperWidth === '58mm' ? 6.5 : 7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`OR No: ${payment.receiptNumber}`, margin, 38);
  doc.text(`Date: ${formatDateTime(payment.paymentDate)}`, margin, 42);
  doc.text(`Cashier: ${payment.cashierName}`, margin, 46);

  doc.line(margin, 49, rightX, 49);

  // Subscriber Details
  doc.text(`Subscriber Account:`, margin, 54);
  doc.setFont('helvetica', 'bold');
  doc.text(payment.customerName, margin, 58);

  doc.setFont('helvetica', 'normal');
  doc.text(`Account No: ${payment.accountNo}`, margin, 63);
  doc.text(`Payment Mode: ${payment.paymentMethod.toUpperCase()}`, margin, 67);
  if (payment.referenceNumber) {
    doc.text(`Ref Code: ${payment.referenceNumber}`, margin, 71);
  }

  doc.line(margin, 74, rightX, 74);

  // Items
  doc.setFont('helvetica', 'bold');
  doc.text('Particulars', margin, 78);
  doc.text('Amount (PHP)', rightX, 78, { align: 'right' });
  doc.line(margin, 80, rightX, 80);

  let currentY = 85;
  doc.setFont('helvetica', 'normal');

  if (invoice?.items && invoice.items.length > 0) {
    invoice.items.slice(0, 3).forEach((item) => {
      const desc = item.description.length > 22 ? item.description.slice(0, 22) + '...' : item.description;
      doc.text(desc, margin, currentY);
      doc.text(formatCurrencyPdf(item.amount), rightX, currentY, { align: 'right' });
      currentY += 4.5;
    });
  } else {
    doc.text('Internet Service Subscription', margin, currentY);
    doc.text(formatCurrencyPdf(payment.amount), rightX, currentY, { align: 'right' });
    currentY += 4.5;
  }

  doc.line(margin, currentY + 1, rightX, currentY + 1);
  currentY += 6;

  // Amount Paid
  doc.setFontSize(paperWidth === '58mm' ? 8 : 9);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PAID:', margin, currentY);
  doc.setFontSize(paperWidth === '58mm' ? 9.5 : 11);
  doc.text(formatCurrencyPdf(payment.amount), rightX, currentY, { align: 'right' });

  currentY += 7;
  if (invoice) {
    doc.setFontSize(paperWidth === '58mm' ? 6.5 : 7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Remaining Balance: ${formatCurrencyPdf(invoice.balanceDue)}`, margin, currentY);
    currentY += 5;
  }

  doc.line(margin, currentY, rightX, currentY);
  currentY += 6;

  // Footer
  doc.setFontSize(paperWidth === '58mm' ? 6 : 7);
  doc.setFont('helvetica', 'normal');
  doc.text('STATUS: LINE ACTIVE & UNBLOCKED', centerX, currentY, { align: 'center' });
  doc.text('Thank you for your prompt payment!', centerX, currentY + 4, { align: 'center' });
  doc.text('THIS SERVES AS AN OFFICIAL RECEIPT', centerX, currentY + 9, { align: 'center' });

  return doc;
};

export const generateEODReportPDF = (
  payments: Payment[],
  cashierName: string,
  dateStr: string,
  business: BusinessProfile
): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200], // 80mm thermal receipt
  });

  const cashPayments = payments.filter((p) => p.paymentMethod === 'cash');
  const gcashPayments = payments.filter((p) => p.paymentMethod === 'gcash');
  const mayaPayments = payments.filter((p) => p.paymentMethod === 'maya');
  const bankPayments = payments.filter((p) => p.paymentMethod === 'bank_transfer');
  const otherPayments = payments.filter((p) => p.paymentMethod === 'other' || p.paymentMethod === 'check');

  const cashTotal = cashPayments.reduce((sum, p) => sum + p.amount, 0);
  const gcashTotal = gcashPayments.reduce((sum, p) => sum + p.amount, 0);
  const mayaTotal = mayaPayments.reduce((sum, p) => sum + p.amount, 0);
  const bankTotal = bankPayments.reduce((sum, p) => sum + p.amount, 0);
  const otherTotal = otherPayments.reduce((sum, p) => sum + p.amount, 0);
  const grandTotal = payments.reduce((sum, p) => sum + p.amount, 0);

  // Header
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(business.name.toUpperCase(), 40, 10, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(business.tradeName || (business.industry && business.industry !== 'Information Technology & Telecommunications' ? business.industry : '') || 'Internet Service Provider', 40, 14, { align: 'center' });
  doc.text(`TIN: ${business.tin}`, 40, 18, { align: 'center' });
  doc.text(getBusinessAddressLines(business.address).line2 || formatBusinessAddress(business.address), 40, 22, { align: 'center' });

  doc.setLineWidth(0.3);
  doc.line(5, 26, 75, 26);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('CASHIER Z-READING / EOD REPORT', 40, 32, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Report Date: ${dateStr}`, 6, 38);
  doc.text(`Cashier Shift: ${cashierName}`, 6, 42);
  doc.text(`Generated: ${new Date().toLocaleTimeString()}`, 6, 46);

  doc.line(5, 49, 75, 49);

  // Summary by Method
  doc.setFont('helvetica', 'bold');
  doc.text('COLLECTION CHANNEL BREAKDOWN', 6, 54);

  doc.setFont('helvetica', 'normal');
  doc.text(`1. Cash in Drawer (${cashPayments.length} txns):`, 6, 60);
  doc.text(formatCurrencyPdf(cashTotal), 74, 60, { align: 'right' });

  doc.text(`2. GCash E-Wallet (${gcashPayments.length} txns):`, 6, 66);
  doc.text(formatCurrencyPdf(gcashTotal), 74, 66, { align: 'right' });

  doc.text(`3. Maya (PayMaya) (${mayaPayments.length} txns):`, 6, 72);
  doc.text(formatCurrencyPdf(mayaTotal), 74, 72, { align: 'right' });

  doc.text(`4. Bank Transfers (${bankPayments.length} txns):`, 6, 78);
  doc.text(formatCurrencyPdf(bankTotal), 74, 78, { align: 'right' });

  if (otherPayments.length > 0) {
    doc.text(`5. Other / Checks (${otherPayments.length} txns):`, 6, 84);
    doc.text(formatCurrencyPdf(otherTotal), 74, 84, { align: 'right' });
  }

  doc.line(5, 88, 75, 88);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`TOTAL TRANSACTIONS:`, 6, 94);
  doc.text(`${payments.length} Txns`, 74, 94, { align: 'right' });

  doc.setFontSize(9.5);
  doc.text(`GRAND TOTAL COLLECTED:`, 6, 101);
  doc.text(formatCurrencyPdf(grandTotal), 74, 101, { align: 'right' });

  doc.line(5, 106, 75, 106);

  // Signatures
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Cashier Shift Turn-Over:', 6, 114);
  doc.line(6, 126, 38, 126);
  doc.text(cashierName, 6, 130);

  doc.text('Audited & Acknowledged By:', 42, 114);
  doc.line(42, 126, 74, 126);
  doc.text('Operations Lead / Manager', 42, 130);

  doc.text('OFFICIAL ISP END-OF-DAY SETTLEMENT', 40, 142, { align: 'center' });

  return doc;
};

