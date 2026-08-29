import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BusinessProfile, Invoice, Payment } from '../types';
import { formatCurrency, formatDate, formatDateTime } from './formatters';

export const generateInvoicePDF = (invoice: Invoice, business: BusinessProfile): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, 210, 38, 'F');

  // Accent Line
  doc.setFillColor(6, 182, 212); // Cyan-500
  doc.rect(0, 38, 210, 2, 'F');

  // Company Info
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(business.name, 14, 14);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`${business.address.building}, ${business.address.street}, Brgy. ${business.address.barangay}`, 14, 20);
  doc.text(`${business.address.city}, ${business.address.province} ${business.address.zipCode} (Landmark: ${business.address.landmark})`, 14, 25);
  doc.text(`TIN: ${business.tin} | Mobile: ${business.representative.mobile} | Email: ${business.representative.email}`, 14, 30);

  // Invoice Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 182, 212);
  doc.text('STATEMENT OF ACCOUNT', 196, 16, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, 196, 23, { align: 'right' });
  doc.text(`Date: ${formatDate(invoice.issueDate)}`, 196, 28, { align: 'right' });
  doc.text(`Due Date: ${formatDate(invoice.dueDate)}`, 196, 33, { align: 'right' });

  // Bill To Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 46, 182, 28, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('SUBSCRIBER BILLING DETAILS', 18, 52);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.customerName, 18, 59);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Account No: ${invoice.accountNo}`, 18, 65);
  doc.text(`Billing Address: ${invoice.customerAddress}`, 18, 70);

  doc.text(`Contact: ${invoice.customerMobile}`, 130, 59);
  doc.text(`Email: ${invoice.customerEmail || 'N/A'}`, 130, 65);
  doc.text(`Billing Period: ${formatDate(invoice.billingPeriodStart)} - ${formatDate(invoice.billingPeriodEnd)}`, 130, 70);

  // Table items
  const tableData = invoice.items.map((item, index) => [
    index + 1,
    item.description,
    item.quantity.toString(),
    formatCurrency(item.unitPrice),
    formatCurrency(item.amount),
  ]);

  autoTable(doc, {
    startY: 80,
    head: [['#', 'Description of Services & Charges', 'Qty', 'Unit Rate', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 100 },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 28, halign: 'right' },
    },
  });

  // Calculate position after table
  const finalY = (doc as any).lastAutoTable?.finalY || 130;

  // Summary box on right
  const summaryX = 120;
  let currentY = finalY + 6;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Current Charges Subtotal:', summaryX, currentY);
  doc.text(formatCurrency(invoice.subtotal), 196, currentY, { align: 'right' });

  if (invoice.discount > 0) {
    currentY += 5;
    doc.setTextColor(16, 185, 129); // Green
    doc.text('Discount / Promo Adjustment:', summaryX, currentY);
    doc.text(`-${formatCurrency(invoice.discount)}`, 196, currentY, { align: 'right' });
  }

  if (invoice.previousBalance > 0) {
    currentY += 5;
    doc.setTextColor(225, 29, 72); // Red
    doc.text('Previous Unpaid Balance:', summaryX, currentY);
    doc.text(`+${formatCurrency(invoice.previousBalance)}`, 196, currentY, { align: 'right' });
  }

  currentY += 6;
  doc.setFillColor(241, 245, 249);
  doc.rect(summaryX - 4, currentY - 4, 80, 10, 'F');
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL AMOUNT DUE:', summaryX, currentY + 2.5);
  doc.setTextColor(2, 132, 199);
  doc.text(formatCurrency(invoice.balanceDue), 196, currentY + 2.5, { align: 'right' });

  // Payment Instructions Box on left
  const payBoxY = finalY + 6;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, payBoxY, 96, 42, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PAYMENT CHANNELS & INSTRUCTIONS', 18, payBoxY + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`• GCash: ${business.paymentGateways.gcashNumber} (${business.paymentGateways.gcashName})`, 18, payBoxY + 12);
  doc.text(`• Maya: ${business.paymentGateways.mayaNumber} (${business.paymentGateways.mayaName})`, 18, payBoxY + 18);
  doc.text(`• Bank: ${business.paymentGateways.bankName}`, 18, payBoxY + 24);
  doc.text(`  Acct: ${business.paymentGateways.bankAccountNumber} (${business.paymentGateways.bankAccountName})`, 18, payBoxY + 29);
  doc.text('• Cash / Check: SwiftStream Shop, Binauahan, Lagonoy', 18, payBoxY + 35);

  // Footer notes & signature
  const footerY = 250;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, footerY, 196, footerY);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('IMPORTANT REMINDERS:', 14, footerY + 5);
  doc.text('1. Please include your Account No. or Invoice No. in the payment message when paying via GCash/Bank.', 14, footerY + 9);
  doc.text('2. Please settle bills on or before the due date to avoid automated service suspension.', 14, footerY + 13);
  doc.text('3. For technical support, fiber line issues, or billing inquiries, please call 09624171684.', 14, footerY + 17);

  // Authorized signature line
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(business.representative.firstName + ' ' + business.representative.lastName, 155, footerY + 16, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Representative / IT Lead', 155, footerY + 20, { align: 'center' });
  doc.line(130, footerY + 12, 180, footerY + 12);

  return doc;
};

export const generateOfficialReceiptPDF = (payment: Payment, business: BusinessProfile): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 160], // Thermal Receipt 80mm
  });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('SWIFTSTREAM', 40, 10, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Telecommunication & Repair Shop', 40, 14, { align: 'center' });
  doc.text(`TIN: ${business.tin}`, 40, 18, { align: 'center' });
  doc.text('Binauahan, Lagonoy, Cam. Sur', 40, 22, { align: 'center' });
  doc.text(`Hotline: ${business.representative.mobile}`, 40, 26, { align: 'center' });

  doc.setLineWidth(0.3);
  doc.line(5, 29, 75, 29);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL RECEIPT', 40, 34, { align: 'center' });

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
  doc.text(formatCurrency(payment.amount), 74, 88, { align: 'right' });

  doc.line(5, 93, 75, 93);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
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
  doc.text('High-Speed Fiber & Technical Services', centerX, 13, { align: 'center' });
  doc.text(`TIN: ${business.tin}`, centerX, 17, { align: 'center' });
  doc.text(`${business.address.barangay}, ${business.address.city}, ${business.address.province}`, centerX, 21, { align: 'center' });
  doc.text(`Cell: ${business.representative.mobile}`, centerX, 25, { align: 'center' });

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
  doc.text('Amount', rightX, 78, { align: 'right' });
  doc.line(margin, 80, rightX, 80);

  let currentY = 85;
  doc.setFont('helvetica', 'normal');

  if (invoice?.items && invoice.items.length > 0) {
    invoice.items.slice(0, 3).forEach((item) => {
      const desc = item.description.length > 22 ? item.description.slice(0, 22) + '...' : item.description;
      doc.text(desc, margin, currentY);
      doc.text(formatCurrency(item.amount), rightX, currentY, { align: 'right' });
      currentY += 4.5;
    });
  } else {
    doc.text('Fiber Internet Service', margin, currentY);
    doc.text(formatCurrency(payment.amount), rightX, currentY, { align: 'right' });
    currentY += 4.5;
  }

  doc.line(margin, currentY + 1, rightX, currentY + 1);
  currentY += 6;

  // Amount Paid
  doc.setFontSize(paperWidth === '58mm' ? 8 : 9);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL PAID:', margin, currentY);
  doc.setFontSize(paperWidth === '58mm' ? 9.5 : 11);
  doc.text(formatCurrency(payment.amount), rightX, currentY, { align: 'right' });

  currentY += 7;
  if (invoice) {
    doc.setFontSize(paperWidth === '58mm' ? 6.5 : 7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Remaining Balance: ${formatCurrency(invoice.balanceDue)}`, margin, currentY);
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
  doc.text('SWIFTSTREAM', 40, 10, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Telecommunication & Repair Shop', 40, 14, { align: 'center' });
  doc.text(`TIN: ${business.tin}`, 40, 18, { align: 'center' });
  doc.text('Binauahan, Lagonoy, Cam. Sur', 40, 22, { align: 'center' });

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
  doc.text(formatCurrency(cashTotal), 74, 60, { align: 'right' });

  doc.text(`2. GCash E-Wallet (${gcashPayments.length} txns):`, 6, 66);
  doc.text(formatCurrency(gcashTotal), 74, 66, { align: 'right' });

  doc.text(`3. Maya (PayMaya) (${mayaPayments.length} txns):`, 6, 72);
  doc.text(formatCurrency(mayaTotal), 74, 72, { align: 'right' });

  doc.text(`4. Bank Transfers (${bankPayments.length} txns):`, 6, 78);
  doc.text(formatCurrency(bankTotal), 74, 78, { align: 'right' });

  if (otherPayments.length > 0) {
    doc.text(`5. Other / Checks (${otherPayments.length} txns):`, 6, 84);
    doc.text(formatCurrency(otherTotal), 74, 84, { align: 'right' });
  }

  doc.line(5, 88, 75, 88);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`TOTAL TRANSACTIONS:`, 6, 94);
  doc.text(`${payments.length} Txns`, 74, 94, { align: 'right' });

  doc.setFontSize(9.5);
  doc.text(`GRAND TOTAL COLLECTED:`, 6, 101);
  doc.text(formatCurrency(grandTotal), 74, 101, { align: 'right' });

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

