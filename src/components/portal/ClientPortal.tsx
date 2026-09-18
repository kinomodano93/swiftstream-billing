import React, { useState, useEffect, useMemo } from 'react';
import {
  Wifi,
  Radio,
  FileText,
  CreditCard,
  Download,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  QrCode,
  Copy,
  Check,
  Search,
  User,
  Phone,
  MapPin,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  Activity,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  LogOut,
  HelpCircle,
  Wrench,
  Gauge,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Layers,
  Zap,
  Globe,
  X,
  Smartphone,
  CheckCircle,
  DollarSign,
  Upload,
  Image as ImageIcon,
  Receipt,
  Eye,
  MessageSquare,
  Bell,
  Wallet,
  History,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  Printer,
  Info,
  Home,
  MoreHorizontal,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { Customer, Invoice, Payment, PaymentMethod, RepairOrder } from '../../types';
import {
  formatBusinessAddress,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPhoneNumber,
  generateId,
  getCustomerStatusBadge,
  getInvoiceStatusBadge,
  getPaymentMethodLabel,
  getRepairStatusBadge,
  resolveInvoicePlanDetails,
  formatCommercialPlanName,
  isRouterProfileName,
  resolveCustomerPlan,
} from '../../utils/formatters';
import { TicketChatModal } from '../support/TicketChatModal';
import { generateInvoicePDF, generateOfficialReceiptPDF } from '../../utils/pdfGenerator';
import {
  XENDIT_CHANNELS,
  createXenditCheckoutSession,
  createRealXenditInvoice,
  checkXenditInvoiceStatus,
  XenditInvoiceResponse,
} from '../../utils/xenditService';
import { generateDynamicQrPhPayload } from '../../utils/qrPhGenerator';
import { createMockPaymentWebhookEvent } from '../../services/paymentWebhookService';
import { GeminiAiAssistant } from '../ai/GeminiAiAssistant';
import { compressImageFile } from '../../utils/imageCompressor';
import { isStaffUser } from '../../services/authService';
import { verifyPaymentReceiptWithGemini } from '../../utils/geminiService';

interface ClientPortalProps {
  initialCustomerId?: string | null;
  onExitToAdmin: () => void;
  onExitToHome: () => void;
}

export const ClientPortal: React.FC<ClientPortalProps> = ({
  initialCustomerId,
  onExitToHome,
}) => {
  const {
    customers,
    invoices,
    payments,
    paymentSubmissions,
    repairOrders,
    plans,
    businessProfile,
    reminders,
    processIncomingPaymentWebhook,
    submitPaymentProof,
    addRepairOrder,
    updateRepairOrder,
    recordPayment,
    toggleCustomerStatus,
    logout,
    currentAuthUser,
  } = useApp();

  // Selected Subscriber State (Session)
  const [currentCustomerId, setCurrentCustomerId] = useState<string | null>(
    initialCustomerId || null
  );
  const [selectedChatTicket, setSelectedChatTicket] = useState<RepairOrder | null>(null);
  const [loginInput, setLoginInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  useEffect(() => {
    if (initialCustomerId) {
      setCurrentCustomerId(initialCustomerId);
    } else if (currentAuthUser) {
      const match = customers.find(
        (c) =>
          c.id === currentAuthUser.uid ||
          (currentAuthUser.email && c.email.toLowerCase() === currentAuthUser.email.toLowerCase()) ||
          (currentAuthUser.accountNo && c.accountNo === currentAuthUser.accountNo)
      );
      if (match) {
        setCurrentCustomerId(match.id);
      }
    }
  }, [initialCustomerId, currentAuthUser, customers]);

  // Portal Navigation Tabs
  const [portalTab, setPortalTab] = useState<
    'overview' | 'bills' | 'pay' | 'receipts' | 'notifications' | 'support' | 'speedtest' | 'upgrade'
  >('overview');

  // Billing History sub-view & search filter
  const [billingHistoryTab, setBillingHistoryTab] = useState<'statements' | 'timeline'>('statements');
  const [billingSearchQuery, setBillingSearchQuery] = useState<string>('');
  const [billingStatusFilter, setBillingStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

  // Notifications Filter
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'billing' | 'advisories' | 'payments'>('all');

  // Online Payment Form State
  const [payInvoiceId, setPayInvoiceId] = useState<string>('');
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('gcash');
  const [payReference, setPayReference] = useState<string>('');
  const [receiptImageBase64, setReceiptImageBase64] = useState<string | null>(null);
  const [submittedProofSuccess, setSubmittedProofSuccess] = useState<boolean>(false);
  const [xenditSubChannel, setXenditSubChannel] = useState<string>('MULTI_CHANNEL');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [justPaidPaymentId, setJustPaidPaymentId] = useState<string | null>(null);
  const [qrDisplayMode, setQrDisplayMode] = useState<'merchant' | 'dynamic'>('merchant');
  const [previewQrModal, setPreviewQrModal] = useState<string | null>(null);

  // Mobile-First Navigation & Express Pay Drawer States
  const [isExpressPayOpen, setIsExpressPayOpen] = useState<boolean>(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);
  const [guestWifiQrModal, setGuestWifiQrModal] = useState<boolean>(false);

  // Instant AI Receipt Settlement & Auto-Reconnection (10s) State
  const [isAiVerifying, setIsAiVerifying] = useState<boolean>(false);
  const [aiOcrError, setAiOcrError] = useState<string | null>(null);
  const [reconnectCountdown, setReconnectCountdown] = useState<number | null>(null);
  const [reconnectStep, setReconnectStep] = useState<string>('');
  const [reconnectSuccessData, setReconnectSuccessData] = useState<{
    refNumber: string;
    amount: number;
    channel: string;
    receiptNo: string;
  } | null>(null);

  useEffect(() => {
    if (reconnectCountdown === null) return;
    if (reconnectCountdown > 0) {
      const timer = setTimeout(() => {
        const next = reconnectCountdown - 1;
        setReconnectCountdown(next);
        if (next >= 7) {
          setReconnectStep('Removing subscriber line from MikroTik NON_PAYMENT_ISOLATION address list...');
        } else if (next >= 4) {
          setReconnectStep('Flushing isolated session & restoring PPPoE speed profile...');
        } else if (next >= 1) {
          setReconnectStep('Line reconnection confirmed by router! Restoring WAN traffic...');
        } else {
          setReconnectStep('Reconnection Complete! Your high-speed internet is now ACTIVE.');
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [reconnectCountdown]);

  // Active Xendit Gateway Session
  const [activeXenditSession, setActiveXenditSession] = useState<XenditInvoiceResponse | null>(null);
  const [isCreatingXenditInvoice, setIsCreatingXenditInvoice] = useState<boolean>(false);
  const [isPollingXendit, setIsPollingXendit] = useState<boolean>(false);
  const [xenditStatusMessage, setXenditStatusMessage] = useState<string>('');
  const [cashCollectionRequested, setCashCollectionRequested] = useState<boolean>(false);

  // Trouble Ticket Form State
  const [ticketDeviceType, setTicketDeviceType] = useState<RepairOrder['deviceType']>('ONU/Router');
  const [ticketIssue, setTicketIssue] = useState<string>('');
  const [ticketSubmitted, setTicketSubmitted] = useState<boolean>(false);

  // Plan Upgrade & WiFi Settings State
  const [targetUpgradePlanId, setTargetUpgradePlanId] = useState<string>('');
  const [upgradeSubmitted, setUpgradeSubmitted] = useState<boolean>(false);
  const [wifiSsid, setWifiSsid] = useState<string>('');
  const [wifiPassword, setWifiPassword] = useState<string>('');
  const [wifiSubmitted, setWifiSubmitted] = useState<boolean>(false);

  // Speed Test Simulator State
  const [speedTestRunning, setSpeedTestRunning] = useState<boolean>(false);
  const [speedProgress, setSpeedProgress] = useState<number>(0);
  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<number>(0);
  const [pingLatency, setPingLatency] = useState<number>(0);
  const [speedTestDone, setSpeedTestDone] = useState<boolean>(false);

  // Quick Issue Presets for Support Ticket
  const issuePresets = [
    { label: '🔴 Red LOS Light Blinking', desc: 'No internet connection, red light on modem.' },
    { label: '🐢 Slow Internet Speed', desc: 'Speed test is below subscribed bandwidth.' },
    { label: '⚡ Modem Power / No Lights', desc: 'ONU modem not turning on or power adapter dead.' },
    { label: '📦 House Cable Relocation', desc: 'Request to move fiber line to another room.' },
    { label: '📶 Change WiFi Password', desc: 'Need help updating WiFi name or password.' },
  ];

  // Lookup currently logged in customer
  const customer = customers.find((c) => c.id === currentCustomerId);
  const customerInvoices = customer
    ? invoices.filter((i) => i.customerId === customer.id)
    : [];
  const customerPayments = customer
    ? payments.filter((p) => p.customerId === customer.id)
    : [];
  const customerTickets = customer
    ? repairOrders.filter((r) => r.customerId === customer.id)
    : [];
  const { plan: customerPlan, cleanName: displayPlanName, speedMbps: resolvedSpeed } = resolveCustomerPlan(customer, plans);

  // Payment submissions / proofs for this subscriber
  const customerSubmissions = customer
    ? paymentSubmissions.filter((s) => s.customerId === customer.id)
    : [];
  const pendingSubmissions = customerSubmissions.filter((s) => s.status === 'pending_review');
  const hasPendingProof = pendingSubmissions.length > 0;
  const getPendingSubmissionForInvoice = (invoiceId: string) =>
    pendingSubmissions.find((s) => s.invoiceId === invoiceId);

  // Unpaid invoices for this subscriber
  const unpaidInvoices = customerInvoices.filter((i) => i.status !== 'paid');
  const latestUnpaidInvoice = unpaidInvoices[0];
  const selectedPayInvoice = customerInvoices.find((i) => i.id === payInvoiceId);

  // Credit, wallet, and balance calculations
  const outstandingBalance = customer ? Math.max(0, customer.balance) : 0;
  const advanceCredit = customer && customer.balance < 0 ? Math.abs(customer.balance) : 0;
  const walletCredit = (customer && customer.walletBalance) || 0;
  const totalAvailableCredit = advanceCredit + walletCredit;
  const advanceDeposit = (customer && customer.advanceDeposit) || 0;

  // Reminders / notifications for this subscriber
  const customerReminders = useMemo(() => {
    if (!customer) return [];
    const list = reminders || [];
    const cleanCustMobile = customer.mobile ? customer.mobile.replace(/\D/g, '').slice(-10) : '';
    return list
      .filter((r) => {
        if (r.customerId === customer.id) return true;
        if (cleanCustMobile && r.mobile && r.mobile.replace(/\D/g, '').endsWith(cleanCustMobile)) return true;
        if (!r.customerId && r.type.includes('advisory')) return true;
        return false;
      })
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }, [customer, reminders]);

  // Count notifications in the last 7 days
  const recentRemindersCount = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return customerReminders.filter((r) => new Date(r.sentAt).getTime() > sevenDaysAgo).length;
  }, [customerReminders]);

  // Recent maintenance/outage advisory within last 48 hours for banner on overview
  const recentAdvisory = useMemo(() => {
    const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
    return customerReminders.find(
      (r) =>
        (r.type.includes('advisory') || r.type.includes('maintenance') || r.type.includes('restored') || r.type.includes('outage')) &&
        new Date(r.sentAt).getTime() > fortyEightHoursAgo
    );
  }, [customerReminders]);

  // Filtered notifications
  const filteredReminders = useMemo(() => {
    return customerReminders.filter((r) => {
      if (notificationFilter === 'billing') {
        return r.type.includes('due') || r.type.includes('warning') || r.type.includes('disconnection');
      }
      if (notificationFilter === 'advisories') {
        return r.type.includes('advisory') || r.type.includes('maintenance') || r.type.includes('restored');
      }
      if (notificationFilter === 'payments') {
        return r.type.includes('payment') || r.type.includes('confirmation');
      }
      return true;
    });
  }, [customerReminders, notificationFilter]);

  // Lifetime billing stats
  const totalBilledAmount = useMemo(() => {
    return customerInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  }, [customerInvoices]);

  const totalPaidAmount = useMemo(() => {
    return customerPayments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
  }, [customerPayments]);

  // Filtered statements for Bills tab
  const filteredInvoices = useMemo(() => {
    return customerInvoices.filter((inv) => {
      if (billingStatusFilter === 'unpaid' && inv.status === 'paid') return false;
      if (billingStatusFilter === 'paid' && inv.status !== 'paid') return false;
      if (billingSearchQuery.trim()) {
        const q = billingSearchQuery.toLowerCase().trim();
        const numMatch = inv.invoiceNumber?.toLowerCase().includes(q);
        const periodMatch = inv.billingPeriodStart?.includes(q) || inv.billingPeriodEnd?.includes(q);
        const planMatch = inv.planName?.toLowerCase().includes(q);
        if (!numMatch && !periodMatch && !planMatch) return false;
      }
      return true;
    });
  }, [customerInvoices, billingStatusFilter, billingSearchQuery]);

  // Unified chronological ledger / timeline
  const unifiedTimeline = useMemo(() => {
    if (!customer) return [];
    const events: Array<{
      id: string;
      date: string;
      type: 'invoice' | 'payment';
      title: string;
      subtitle: string;
      amount: number;
      isDebit: boolean;
      statusBadge: { text: string; bg: string; textCol: string; border: string };
      invoice?: Invoice;
      payment?: Payment;
    }> = [];

    customerInvoices.forEach((inv) => {
      const badge = getInvoiceStatusBadge(inv.status);
      events.push({
        id: `inv-${inv.id}`,
        date: inv.issueDate || inv.createdAt,
        type: 'invoice',
        title: `Statement #${inv.invoiceNumber}`,
        subtitle: `Billing: ${formatDate(inv.billingPeriodStart)} to ${formatDate(inv.billingPeriodEnd)} • Due: ${formatDate(inv.dueDate)}`,
        amount: inv.totalAmount,
        isDebit: true,
        statusBadge: badge,
        invoice: inv,
      });
    });

    customerPayments.forEach((pay) => {
      events.push({
        id: `pay-${pay.id}`,
        date: pay.paymentDate,
        type: 'payment',
        title: `Official Receipt #${pay.receiptNumber}`,
        subtitle: `Method: ${getPaymentMethodLabel(pay.paymentMethod).label.toUpperCase()}${pay.referenceNumber ? ` • Ref: ${pay.referenceNumber}` : ''} • Processed by ${pay.cashierName}`,
        amount: pay.amount,
        isDebit: false,
        statusBadge: { text: 'SETTLED', bg: 'bg-emerald-500/20', textCol: 'text-emerald-300', border: 'border-emerald-500/30' },
        payment: pay,
      });
    });

    if (billingSearchQuery.trim()) {
      const q = billingSearchQuery.toLowerCase().trim();
      return events
        .filter((ev) => ev.title.toLowerCase().includes(q) || ev.subtitle.toLowerCase().includes(q))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [customer, customerInvoices, customerPayments, billingSearchQuery]);


  // Pre-fill payment amount when switching to Pay tab or selecting invoice
  useEffect(() => {
    if (customer) {
      if (payInvoiceId) {
        const inv = customerInvoices.find((i) => i.id === payInvoiceId);
        if (inv) setPayAmount(inv.balanceDue.toString());
      } else if (customer.balance > 0) {
        setPayAmount(customer.balance.toString());
      } else {
        setPayAmount(customer.monthlyFee.toString());
      }
    }
  }, [currentCustomerId, payInvoiceId, portalTab]);

  // Handle Login / Account Lookup
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const cleanInput = loginInput.trim().toLowerCase();

    // Check registered subscribers
    const matched = customers.find(
      (c) =>
        c.accountNo.toLowerCase() === cleanInput ||
        c.mobile.replace(/[^0-9]/g, '') === cleanInput.replace(/[^0-9]/g, '') ||
        c.fullName.toLowerCase().includes(cleanInput)
    );

    if (matched) {
      setCurrentCustomerId(matched.id);
      setLoginInput('');
      return;
    }

    setLoginError(
      'Subscriber not found. Please enter your Account Number (e.g. SWIFT-2026-001) or Registered Mobile Number.'
    );
  };

  // Quick Demo Account Select
  const handleSelectDemo = (customerId: string) => {
    setCurrentCustomerId(customerId);
    setLoginError('');
    setPortalTab('overview');
  };

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Settle verified/paid Xendit invoice session
  const handleSettlePaidXenditSession = async (session: XenditInvoiceResponse) => {
    if (!customer) return;
    const targetInv = payInvoiceId ? invoices.find((i) => i.id === payInvoiceId) : latestUnpaidInvoice;
    const webhookEv = createMockPaymentWebhookEvent(
      customer,
      targetInv,
      'xendit',
      session.payment_channel || 'Xendit Gateway'
    );
    webhookEv.amount = session.amount;
    webhookEv.transactionRef = session.id;
    const res = await processIncomingPaymentWebhook(webhookEv);
    if (res.receiptNumber) {
      setJustPaidPaymentId(res.receiptNumber);
    }
    setActiveXenditSession(null);
    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch {}
  };

  // Auto-poll active Xendit session for live payment confirmation
  useEffect(() => {
    if (!activeXenditSession || activeXenditSession.status === 'PAID') return;

    let isMounted = true;
    const interval = setInterval(async () => {
      setIsPollingXendit(true);
      const check = await checkXenditInvoiceStatus(
        activeXenditSession.id,
        businessProfile.paymentGateways.xenditSecretKey
      );
      if (isMounted) {
        setIsPollingXendit(false);
        if (check.status === 'PAID') {
          clearInterval(interval);
          handleSettlePaidXenditSession(activeXenditSession);
        }
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeXenditSession, customer, payInvoiceId]);

  // Create real Xendit Hosted Invoice Session
  const handleInitiateXenditCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customer) return;

    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    setIsCreatingXenditInvoice(true);
    setXenditStatusMessage('Creating secure Xendit checkout session...');

    try {
      const matchedInv = payInvoiceId ? invoices.find((i) => i.id === payInvoiceId) : latestUnpaidInvoice;
      const targetInv = matchedInv || {
        id: 'inv-def',
        invoiceNumber: `INV-${customer.accountNo}-AUTO`,
        totalAmount: amountNum,
        balanceDue: amountNum,
      };

      const session = await createRealXenditInvoice(
        customer,
        targetInv,
        amountNum,
        businessProfile,
        xenditSubChannel
      );

      setActiveXenditSession(session);
      setXenditStatusMessage('Invoice session ready. Complete payment on Xendit.');

      if (session.invoice_url) {
        window.open(session.invoice_url, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      alert(`Failed to create Xendit checkout session: ${err.message}`);
    } finally {
      setIsCreatingXenditInvoice(false);
    }
  };

  // Request in-home Cash Collection Dispatch
  const handleRequestCashCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    const amountNum = parseFloat(payAmount) || customer.balance || customer.monthlyFee;
    const targetInv = payInvoiceId ? invoices.find((i) => i.id === payInvoiceId) : latestUnpaidInvoice;
    const orderNum = `COL-${new Date().getFullYear().toString().slice(2)}${String(
      new Date().getMonth() + 1
    ).padStart(2, '0')}-${String(repairOrders.length + 1).padStart(3, '0')}`;

    addRepairOrder({
      orderNumber: orderNum,
      customerId: customer.id,
      customerName: customer.fullName,
      contactNumber: customer.mobile,
      address: `${customer.address.street}, Brgy. ${customer.address.barangay}, ${customer.address.city}`,
      deviceType: 'Other',
      issueDescription: `MANUAL CASH COLLECTION REQUEST: Subscriber requested in-person cash payment pickup for ${targetInv?.invoiceNumber || 'Monthly Bill'}. Amount to collect: ${formatCurrency(amountNum)}. Authorized cashier must issue Official Cash Receipt upon receipt.`,
      diagnosisNotes: 'Submitted via Client Portal Cash Payment section. Pending field collection dispatch.',
      technician: 'Field Cashier / Tech Dispatch',
      partsUsed: [],
      laborCost: 0,
      totalCost: 0,
      status: 'open',
      dateReceived: new Date().toISOString().slice(0, 10),
      isPaid: false,
      messages: [
        {
          id: generateId('MSG'),
          senderId: customer.id,
          senderName: customer.fullName,
          senderRole: 'customer',
          message: `MANUAL CASH COLLECTION REQUEST: Subscriber requested in-person cash payment pickup for ${targetInv?.invoiceNumber || 'Monthly Bill'}. Amount to collect: ${formatCurrency(amountNum)}.`,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    setCashCollectionRequested(true);
    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch {}
    setTimeout(() => setCashCollectionRequested(false), 8000);
  };

  // Handle Online Payment Submission
  const handleConfirmOnlinePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    if (payMethod === 'xendit') {
      await handleInitiateXenditCheckout(e);
      return;
    }

    const ref = payReference.trim();
    if (!ref) {
      alert('Please provide the transaction reference number from your GCash/Maya app.');
      return;
    }

    setIsSubmittingPayment(true);

    // Submit for Admin Verification Queue
    submitPaymentProof({
      customerId: customer.id,
      invoiceId: payInvoiceId || latestUnpaidInvoice?.id || undefined,
      amount: amountNum,
      paymentMethod: payMethod,
      referenceNumber: ref,
      receiptImageUrl: receiptImageBase64 || undefined,
      notes: `Submitted via Client Portal (${payMethod.toUpperCase()}). Pending cashier audit.`,
    });
    setSubmittedProofSuccess(true);
    setTimeout(() => setSubmittedProofSuccess(false), 8000);

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }

    setIsSubmittingPayment(false);
    setPayReference('');
    setReceiptImageBase64(null);
  };

  // Instant AI Receipt Settlement & Auto-Reconnection (10s) Handler
  const handleInstantAiSettlement = async () => {
    if (!receiptImageBase64) {
      alert('Please upload a screenshot of your GCash or Maya payment receipt first.');
      return;
    }
    if (!customer) return;

    setIsAiVerifying(true);
    setAiOcrError(null);

    try {
      const apiKey = businessProfile?.apiKeys?.geminiApiKey;
      const model = businessProfile?.apiKeys?.geminiModel || 'gemini-2.5-flash';

      const ocr = await verifyPaymentReceiptWithGemini(receiptImageBase64, apiKey, model);

      if (!ocr.success && (!ocr.referenceNumber || !ocr.amount)) {
        setAiOcrError(
          ocr.notes ||
            'Unable to reliably read reference number or amount from this image. Please ensure the screenshot clearly shows the Reference No. and Amount, or submit for manual review.'
        );
        setIsAiVerifying(false);
        return;
      }

      // Populate reference and amount
      const extractedRef = ocr.referenceNumber || payReference || `REF-${Date.now()}`;
      const extractedAmount = ocr.amount || Number(payAmount) || customer.balance || customer.monthlyFee;
      const channelRaw = ocr.paymentChannel || ocr.channel || (payMethod === 'maya' ? 'MAYA' : 'GCASH');
      const extractedChannel = String(channelRaw).toUpperCase();

      setPayReference(extractedRef);
      setPayAmount(String(extractedAmount));

      // Record payment automatically
      const unpaidInv = customerInvoices.find(
        (i) => i.status === 'unpaid' || i.status === 'overdue' || i.status === 'partially_paid'
      );

      const newPay = recordPayment({
        customerId: customer.id,
        invoiceId: unpaidInv?.id,
        amount: extractedAmount,
        paymentMethod: extractedChannel.toLowerCase() === 'maya' ? 'maya' : 'gcash',
        referenceNumber: extractedRef,
        notes: `[Instant AI Walled Garden Settlement] Gemini Vision AI verified ${extractedChannel} transfer receipt (Ref #${extractedRef}, Amount ₱${extractedAmount}). Auto-reconnected in 10s.`,
        cashierName: 'Gemini AI Vision Bot (Automated)',
      });

      // Restore subscriber status and trigger MikroTik unblock
      toggleCustomerStatus(customer.id, 'active');

      // Confetti celebration
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }

      // Start 10-second auto-reconnection countdown
      setReconnectCountdown(10);
      setReconnectStep('Analyzing receipt and authenticating with MikroTik core router...');
      setReconnectSuccessData({
        refNumber: extractedRef,
        amount: extractedAmount,
        channel: extractedChannel,
        receiptNo: newPay?.receiptNumber || `OR-${Date.now()}`,
      });
      setJustPaidPaymentId(newPay?.receiptNumber || null);
    } catch (err: any) {
      setAiOcrError(err?.message || 'Error running AI receipt verification.');
    } finally {
      setIsAiVerifying(false);
    }
  };


  // Handle Trouble Ticket Submission
  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !ticketIssue.trim()) return;

    const orderNum = `SR-${new Date().getFullYear().toString().slice(2)}${String(
      new Date().getMonth() + 1
    ).padStart(2, '0')}-${String(repairOrders.length + 1).padStart(3, '0')}`;

    addRepairOrder({
      orderNumber: orderNum,
      customerId: customer.id,
      customerName: customer.fullName,
      contactNumber: customer.mobile,
      address: `${customer.address.street}, Brgy. ${customer.address.barangay}, ${customer.address.city}`,
      deviceType: ticketDeviceType,
      issueDescription: ticketIssue,
      diagnosisNotes: 'Submitted online via Customer Self-Service Portal. Pending technician dispatch.',
      technician: 'Field Dispatch Team (Lagonoy)',
      partsUsed: [],
      laborCost: 0,
      totalCost: 0,
      status: 'open',
      dateReceived: new Date().toISOString().slice(0, 10),
      isPaid: false,
      messages: [
        {
          id: generateId('MSG'),
          senderId: customer.id,
          senderName: customer.fullName,
          senderRole: 'customer',
          message: ticketIssue.trim(),
          timestamp: new Date().toISOString(),
        },
      ],
    });

    setTicketIssue('');
    setTicketSubmitted(true);
    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } catch {}
    setTimeout(() => setTicketSubmitted(false), 5000);
  };

  // Handle Plan Upgrade Request
  const handleRequestPlanUpgrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    const targetPlan = plans.find((p) => p.id === targetUpgradePlanId);
    if (!targetPlan) return;

    const diff = targetPlan.monthlyFee - customer.monthlyFee;
    const orderNum = `UPG-${new Date().getFullYear().toString().slice(2)}${String(
      new Date().getMonth() + 1
    ).padStart(2, '0')}-${String(repairOrders.length + 1).padStart(3, '0')}`;

    addRepairOrder({
      orderNumber: orderNum,
      customerId: customer.id,
      customerName: customer.fullName,
      contactNumber: customer.mobile,
      address: `${customer.address.street}, Brgy. ${customer.address.barangay}, ${customer.address.city}`,
      deviceType: 'ONU/Router',
      issueDescription: `PLAN UPGRADE REQUEST: Upgrade from ${displayPlanName}${resolvedSpeed > 0 ? ` (${resolvedSpeed} Mbps` : ' ('}@ ${formatCurrency(customer.monthlyFee)}) to ${targetPlan.name} (${targetPlan.speedMbps} Mbps @ ${formatCurrency(targetPlan.monthlyFee)}). Monthly fee difference: +${formatCurrency(diff)}/mo.`,
      diagnosisNotes: `Requested via Customer Portal. Target speed: ${targetPlan.speedMbps} Mbps. Pending Mikrotik profile rate-limit adjustment.`,
      technician: 'NOC Network Admin (Lagonoy)',
      partsUsed: [],
      laborCost: 0,
      totalCost: 0,
      status: 'open',
      dateReceived: new Date().toISOString().slice(0, 10),
      isPaid: false,
      messages: [
        {
          id: generateId('MSG'),
          senderId: customer.id,
          senderName: customer.fullName,
          senderRole: 'customer',
          message: `PLAN UPGRADE REQUEST: Upgrade to ${targetPlan.name} (${targetPlan.speedMbps} Mbps @ ${formatCurrency(targetPlan.monthlyFee)}).`,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    try {
      confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
    } catch {
      // ignore
    }

    setUpgradeSubmitted(true);
    setTimeout(() => setUpgradeSubmitted(false), 6000);
  };

  // Handle WiFi SSID & Password Request
  const handleRequestWifiUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !wifiSsid.trim() || !wifiPassword.trim()) return;

    const orderNum = `WIFI-${new Date().getFullYear().toString().slice(2)}${String(
      new Date().getMonth() + 1
    ).padStart(2, '0')}-${String(repairOrders.length + 1).padStart(3, '0')}`;

    addRepairOrder({
      orderNumber: orderNum,
      customerId: customer.id,
      customerName: customer.fullName,
      contactNumber: customer.mobile,
      address: `${customer.address.street}, Brgy. ${customer.address.barangay}, ${customer.address.city}`,
      deviceType: 'Switch/AP',
      issueDescription: `ROUTER WIFI SETTINGS CHANGE: New requested SSID: "${wifiSsid}", New Password: "${wifiPassword}". Assigned ONU: ${customer.network.routerModel || 'Fiber ONU'}.`,
      diagnosisNotes: 'Subscriber requested remote router WiFi SSID/Password reconfiguration.',
      technician: 'NOC Remote Tech Team',
      partsUsed: [],
      laborCost: 0,
      totalCost: 0,
      status: 'open',
      dateReceived: new Date().toISOString().slice(0, 10),
      isPaid: false,
      messages: [
        {
          id: generateId('MSG'),
          senderId: customer.id,
          senderName: customer.fullName,
          senderRole: 'customer',
          message: `ROUTER WIFI CONFIGURATION REQUEST: SSID set to "${wifiSsid}", Password set to "${wifiPassword}".`,
          timestamp: new Date().toISOString(),
        },
      ],
    });

    setWifiSubmitted(true);
    setWifiSsid('');
    setWifiPassword('');
    try {
      confetti({ particleCount: 60, spread: 65, origin: { y: 0.6 } });
    } catch {}
    setTimeout(() => setWifiSubmitted(false), 6000);
  };

  // Speed test simulation
  const startSpeedTest = () => {
    if (!customer) return;
    setSpeedTestRunning(true);
    setSpeedTestDone(false);
    setSpeedProgress(0);
    setDownloadSpeed(0);
    setUploadSpeed(0);
    setPingLatency(0);

    const targetMax = resolvedSpeed || 50;

    let prog = 0;
    const interval = setInterval(() => {
      prog += 5;
      setSpeedProgress(prog);

      if (prog <= 50) {
        // Download phase
        const curDown = Math.min(
          targetMax,
          Math.floor((prog / 50) * (targetMax * 0.98 + (Math.random() * 4 - 2)))
        );
        setDownloadSpeed(Math.max(1, curDown));
        setPingLatency(Math.floor(Math.random() * 4 + 8)); // 8-12ms ping
      } else if (prog <= 95) {
        // Upload phase
        const curUp = Math.min(
          targetMax,
          Math.floor(((prog - 50) / 45) * (targetMax * 0.95 + (Math.random() * 3 - 1)))
        );
        setUploadSpeed(Math.max(1, curUp));
      } else {
        clearInterval(interval);
        setDownloadSpeed(Math.round(targetMax * 0.99));
        setUploadSpeed(Math.round(targetMax * 0.96));
        setPingLatency(9);
        setSpeedTestRunning(false);
        setSpeedTestDone(true);
        try {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        } catch {}
      }
    }, 120);
  };

  // --- VIEW 1: LOGIN / ACCOUNT LOOKUP VIEW ---
  if (!customer) {
    return (
      <div className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
        {/* Top Navbar */}
        <header className="h-16 bg-slate-900/90 border-b border-slate-800 px-6 sticky top-0 z-30 backdrop-blur-md">
          <div className="max-w-5xl mx-auto h-full flex items-center justify-between">
            <button
              type="button"
              onClick={onExitToHome}
              className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none transition-transform active:scale-95"
              title="Return to Home Page"
            >
              {businessProfile.logoUrl ? (
                <img
                  src={businessProfile.logoUrl}
                  alt={businessProfile.tradeName || 'Logo'}
                  className="w-10 h-10 rounded-2xl object-contain bg-slate-900 border border-slate-700/60 p-1 shadow-lg shadow-cyan-500/20 shrink-0 group-hover:border-cyan-500/60 transition-colors"
                />
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0 group-hover:scale-105 transition-transform">
                  <Radio className="w-5 h-5 text-white animate-pulse" />
                </div>
              )}
              <div>
                <h1 className="font-black text-sm text-slate-100 tracking-tight flex items-center gap-1.5 group-hover:text-cyan-300 transition-colors">
                  <span>{businessProfile.tradeName || businessProfile.name || 'SwiftStream'}</span>
                  <span className="text-[10px] bg-cyan-950 text-cyan-400 font-mono px-2 py-0.5 rounded-full border border-cyan-800/60 font-normal">
                    PORTAL
                  </span>
                </h1>
                <p className="text-[10px] text-slate-400">
                  Fiber Subscriber Self-Service Hub
                </p>
              </div>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onExitToHome}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Return to Home Page</span>
              </button>
            </div>
          </div>
        </header>

        {/* Login Hero Section */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-xl mx-auto w-full space-y-8 text-center">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-950 to-blue-950 text-cyan-300 border border-cyan-800/60 shadow-sm mx-auto">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Instant Bill Check & Fast Online GCash / Maya Pay</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
              Welcome to your Fiber Portal
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
              Access your monthly billing statements, view connection details, pay online with instant Official Receipts, and file technical requests in seconds.
            </p>
          </div>

          {/* Login Form Box */}
          <div className="w-full p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl shadow-cyan-950/20 space-y-6 text-left">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                  Enter Account Number, Mobile Number, or Name
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="e.g. SWIFT-2026-001 or 09624171684"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono text-center"
                  />
                </div>
              </div>

              {loginError && (
                <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <span>Access My Subscriber Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Help & Support Info */}
          <div className="text-center text-xs text-slate-500 space-y-1">
            <p>Need help finding your Account Number? Check your monthly SMS billing statement.</p>
            <p className="text-slate-400">
              Helpline: <span className="text-cyan-400 font-mono font-bold">{businessProfile.representative.mobile}</span> • Lagonoy Operations Center
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW 2: SUBSCRIBER PORTAL DASHBOARD (LOGGED IN) ---
  const statusBadge = getCustomerStatusBadge(customer.status);
  const initials = customer.fullName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
      {/* Client Portal Header */}
      <header className="h-16 bg-slate-900/90 border-b border-slate-800 px-4 sm:px-6 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-5xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar Pill */}
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 text-white font-bold flex items-center justify-center shadow-lg shadow-cyan-500/20 text-xs">
              {initials || <User className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm text-slate-100">{customer.fullName}</h1>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-semibold border ${statusBadge.bg} ${statusBadge.textCol} ${statusBadge.border}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                  {statusBadge.text}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  onClick={() => handleCopy(customer.accountNo, 'header_acc')}
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-400 bg-cyan-950/60 hover:bg-cyan-900/60 px-1.5 py-0.2 rounded border border-cyan-800/40 transition-colors cursor-pointer"
                  title="Click to copy Account Number"
                >
                  <span>{customer.accountNo}</span>
                  {copiedField === 'header_acc' ? (
                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-2.5 h-2.5 text-slate-400" />
                  )}
                </button>
                <span className="text-[10px] text-slate-500">•</span>
                <span className="text-[10px] text-slate-400">{displayPlanName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onExitToHome}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              title="Return to Public Home Page"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Home Page</span>
            </button>

            <button
              onClick={() => {
                setCurrentCustomerId(null);
                logout();
                onExitToHome();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              title="Sign out of subscriber portal and return to Home Page"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Centered Bill Due Notice Ribbon */}
      {hasPendingProof ? (
        <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-b border-amber-800/50 px-4 sm:px-6 py-2.5">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-200">
              <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
              <span>
                <strong>Payment Proof Under Review:</strong> We received your submission of{' '}
                <span className="font-mono font-bold text-amber-300">
                  {formatCurrency(pendingSubmissions[0].amount)}
                </span>{' '}
                (Ref: {pendingSubmissions[0].referenceNumber}). Cashier approval is in progress. Official Receipt will be issued once approved.
              </span>
            </div>
            <button
              onClick={() => setPortalTab('pay')}
              className="px-3 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Track Review Status &rarr;
            </button>
          </div>
        </div>
      ) : customer.status === 'suspended' ? (
        <div className="bg-gradient-to-r from-rose-950 via-red-950 to-rose-950 border-b-2 border-rose-600 px-4 sm:px-6 py-3.5 shadow-xl">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start sm:items-center gap-3 text-white">
              <div className="p-2 rounded-xl bg-rose-600 text-white flex-shrink-0 animate-pulse shadow-lg shadow-rose-600/40">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="font-black text-sm text-rose-100 flex items-center gap-2">
                  <span>LINE RESTRICTED • WALLED GARDEN ISOLATION</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 text-[10px] font-mono border border-rose-400/40 uppercase font-bold tracking-wide">
                    Action Required
                  </span>
                </div>
                <p className="text-rose-200/90 text-xs mt-0.5">
                  Your fiber line is temporarily isolated due to an overdue balance of{' '}
                  <strong className="font-mono font-bold text-white text-sm underline decoration-rose-400">
                    {formatCurrency(customer.balance)}
                  </strong>
                  . Settle via GCash or Maya below. Once paid, our MikroTik Core Router will automatically reconnect your high-speed internet.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsExpressPayOpen(true)}
              className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-white to-rose-100 hover:from-white hover:to-white text-rose-900 rounded-xl text-xs font-black shadow-lg transition-all hover:scale-105 cursor-pointer flex items-center gap-1.5"
            >
              <span>Pay Overdue Balance &rarr;</span>
            </button>
          </div>
        </div>
      ) : customer.balance > 0 ? (
        <div className="bg-gradient-to-r from-rose-950/90 via-amber-950/80 to-rose-950/90 border-b border-rose-800/50 px-4 sm:px-6 py-2.5">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-rose-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 animate-bounce" />
              <span>
                You have an outstanding balance of{' '}
                <strong className="font-mono font-bold text-rose-300 text-sm">
                  {formatCurrency(customer.balance)}
                </strong>
                . Pay online to keep your fiber internet active and high-speed.
              </span>
            </div>
            <button
              onClick={() => setIsExpressPayOpen(true)}
              className="px-3.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md transition-all hover:scale-105 cursor-pointer"
            >
              Pay Bill Now &rarr;
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 border-b border-emerald-800/30 px-4 sm:px-6 py-2">
          <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>All caught up! Your account is in good standing with zero balance. 🎉</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 hidden sm:inline">
              Next Cut-off: Day {customer.billingDay}
            </span>
          </div>
        </div>
      )}

      {/* Desktop Navigation Tabs (Hidden on mobile; mobile uses native bottom nav bar) */}
      <div className="hidden md:block border-b border-slate-800 bg-slate-900/70 px-4 sm:px-6 sticky top-16 z-20 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex justify-center items-center overflow-x-auto py-2 scrollbar-none">
          <div className="flex space-x-1 sm:space-x-2 text-xs">
            {[
              { id: 'overview', label: 'Subscription Overview', icon: Wifi },
              {
                id: 'bills',
                label: 'Statements (Bills)',
                icon: FileText,
                badge: hasPendingProof
                  ? `${pendingSubmissions.length} Reviewing`
                  : unpaidInvoices.length > 0
                  ? `${unpaidInvoices.length} Due`
                  : null,
                badgeColor: hasPendingProof
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
              },
              { id: 'pay', label: 'Pay Online', icon: CreditCard },
              {
                id: 'receipts',
                label: 'Official Receipts',
                icon: CheckCircle2,
                badge: customerPayments.length > 0 ? `${customerPayments.length}` : null,
                badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
              },
              {
                id: 'notifications',
                label: 'Notifications',
                icon: Bell,
                badge: recentRemindersCount > 0 ? `${recentRemindersCount}` : null,
                badgeColor: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
              },
              { id: 'support', label: 'Report Trouble', icon: Wrench },
              { id: 'upgrade', label: 'WiFi & Upgrade', icon: Sparkles },
              { id: 'speedtest', label: 'Speed Test', icon: Gauge },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = portalTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setPortalTab(tab.id as any)}
                  className={`flex items-center gap-2 py-2 px-3.5 rounded-xl font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${tab.badgeColor}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Centered Main Content Container (pb-28 on mobile for safe clearance above bottom nav) */}
      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6 pb-28 md:pb-8">
        {/* ================= TAB 1: OVERVIEW ================= */}
        {portalTab === 'overview' && (
          <div className="space-y-6">
            {/* Recent Network / Maintenance Advisory Banner */}
            {recentAdvisory && (
              <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-slate-900 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-300 uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800/40">
                        Network Advisory
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatDateTime(recentAdvisory.sentAt)}
                      </span>
                    </div>
                    <p className="text-slate-200 mt-1 font-medium leading-relaxed">
                      {recentAdvisory.messageText}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPortalTab('notifications')}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-xs whitespace-nowrap transition-colors cursor-pointer border border-amber-500/40 shrink-0 self-start sm:self-center"
                >
                  All Notifications ({customerReminders.length}) ↗
                </button>
              </div>
            )}

            {/* Top Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Internet Package */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-4 hover:border-slate-700 transition-all text-center sm:text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    My Internet Plan
                  </span>
                  {resolvedSpeed > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 font-mono font-bold text-xs border border-cyan-800/40 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-cyan-400" />
                      <span>{resolvedSpeed} Mbps</span>
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-100">{displayPlanName}</h3>
                  <p className="text-2xl font-black text-cyan-400 font-mono mt-1">
                    {formatCurrency(customer.monthlyFee)}
                    <span className="text-xs text-slate-400 font-normal"> / month</span>
                  </p>
                </div>

                <div className="text-xs text-slate-400 space-y-1.5 pt-3 border-t border-slate-800/80">
                  <p className="flex items-center justify-between">
                    <span>Monthly Cut-off Day:</span>
                    <span className="font-semibold text-slate-200">Day {customer.billingDay} of month</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Installation Date:</span>
                    <span className="font-mono text-slate-200">{formatDate(customer.installationDate)}</span>
                  </p>
                </div>
              </div>

              {/* Card 2: Billing & Outstanding with Credit Balance Breakdown */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-4 flex flex-col justify-between hover:border-slate-700 transition-all text-center sm:text-left">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Current Ledger Balance
                    </span>
                    <div className="flex items-center gap-1.5">
                      {customer.balance < 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/50 text-[10px] font-bold">
                          Advance Credit
                        </span>
                      ) : customer.balance > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800/50 text-[10px] font-bold">
                          Payment Due
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/50 text-[10px] font-bold">
                          Settled
                        </span>
                      )}
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                    </div>
                  </div>

                  <h3
                    className={`text-2xl font-black font-mono mt-2 ${
                      customer.balance > 0
                        ? 'text-rose-400'
                        : customer.balance < 0
                        ? 'text-emerald-400'
                        : 'text-slate-100'
                    }`}
                  >
                    {customer.balance < 0
                      ? `+${formatCurrency(advanceCredit)}`
                      : formatCurrency(customer.balance)}
                  </h3>

                  <p className="text-xs text-slate-400 mt-1">
                    {hasPendingProof
                      ? `⏳ Payment proof of ${formatCurrency(pendingSubmissions[0].amount)} (Ref: ${pendingSubmissions[0].referenceNumber}) is awaiting cashier approval.`
                      : customer.balance < 0
                      ? '✓ Advance credit active. Upcoming invoices will automatically deduct from this balance.'
                      : customer.balance > 0
                      ? 'Payment due to maintain continuous fiber internet service.'
                      : 'Your account is in good standing! No balance due.'}
                  </p>

                  {/* Credit Balance & Deposit Breakdown */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="flex items-center gap-1">
                        <Wallet className="w-3 h-3 text-cyan-400" />
                        Prepaid Wallet:
                      </span>
                      <span className="font-mono font-semibold text-slate-200">
                        {formatCurrency(walletCredit)}
                      </span>
                    </div>
                    {advanceDeposit > 0 && (
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-purple-400" />
                          Security Deposit:
                        </span>
                        <span className="font-mono font-semibold text-slate-200">
                          {formatCurrency(advanceDeposit)}
                        </span>
                      </div>
                    )}
                    {totalAvailableCredit > 0 && (
                      <div className="pt-1.5 flex items-center justify-between text-emerald-400 font-semibold">
                        <span className="text-[11px] flex items-center gap-1">
                          ⚡ Usable Credit Total:
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-300">
                          +{formatCurrency(totalAvailableCredit)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (hasPendingProof) {
                      setPortalTab('pay');
                    } else {
                      setIsExpressPayOpen(true);
                    }
                  }}
                  className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold transition-all hover:scale-[1.02] cursor-pointer mt-2 ${
                    hasPendingProof
                      ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/20'
                  }`}
                >
                  {hasPendingProof ? (
                    <Clock className="w-4 h-4 text-amber-400" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  <span>
                    {hasPendingProof
                      ? 'View Pending Review Status'
                      : customer.balance > 0
                      ? 'Pay Online Now (GCash / Maya)'
                      : 'Top-up / Prepay Account'}
                  </span>
                </button>
              </div>

              {/* Card 3: Line & Network Status with Glowing Beacon */}
              <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800/90 shadow-card space-y-4 hover:border-slate-700 transition-all text-center sm:text-left relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Line Health Beacon</span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      customer.network.isMikrotikSynced
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/50'
                        : 'bg-rose-950/80 text-rose-300 border-rose-800/50'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        customer.network.isMikrotikSynced
                          ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50'
                          : 'bg-rose-400'
                      }`}
                    />
                    {customer.network.isMikrotikSynced ? 'Active & Online' : 'Disconnected'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-500">Optical Signal:</span>
                    <span className="font-mono text-emerald-400 font-bold">-18.5 dBm (Optimal)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-500">Assigned IP:</span>
                    <span className="font-mono text-slate-300">{customer.network.ipAddress || '10.10.20.15'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Service Gateway:</span>
                    <span className="font-mono text-slate-300">Lagonoy Core Node</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  id: 'pay',
                  title: 'Express Pay',
                  desc: 'GCash / Maya QR Ph',
                  icon: CreditCard,
                  color: 'text-emerald-400 bg-emerald-600/20 border-emerald-500/30',
                  action: () => setIsExpressPayOpen(true),
                },
                {
                  id: 'speedtest',
                  title: 'Speed Test',
                  desc: 'Check live bandwidth',
                  icon: Gauge,
                  color: 'text-cyan-400 bg-cyan-600/20 border-cyan-500/30',
                  action: () => setPortalTab('speedtest'),
                },
                {
                  id: 'guest_wifi',
                  title: 'Guest WiFi QR',
                  desc: 'Scan to join network',
                  icon: QrCode,
                  color: 'text-sky-400 bg-sky-600/20 border-sky-500/30',
                  action: () => setGuestWifiQrModal(true),
                },
                {
                  id: 'support',
                  title: 'Report Trouble',
                  desc: 'Fast repair dispatch',
                  icon: Wrench,
                  color: 'text-amber-400 bg-amber-600/20 border-amber-500/30',
                  action: () => setPortalTab('support'),
                },
              ].map((act) => {
                const Icon = act.icon;
                return (
                  <button
                    key={act.id}
                    onClick={act.action}
                    className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-950/20 text-center transition-all group flex flex-col items-center justify-between space-y-2 cursor-pointer shadow-sm active:scale-98"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${act.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-xs text-slate-100 group-hover:text-cyan-300 transition-colors">
                        {act.title}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{act.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Statements & Support Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Recent Statements */}
              <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span>Recent Billing Statements (SOA)</span>
                  </h3>
                  <button
                    onClick={() => setPortalTab('bills')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <span>View All</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {customerInvoices.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No billing statements available yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {customerInvoices.slice(0, 3).map((inv) => {
                      const pendingSub = getPendingSubmissionForInvoice(inv.id);
                      const badge = pendingSub
                        ? { text: 'Pending Verification', bg: 'bg-amber-500/10', textCol: 'text-amber-400', border: 'border-amber-500/30' }
                        : getInvoiceStatusBadge(inv.status);
                      return (
                        <div
                          key={inv.id}
                          className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-slate-700 transition-all"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-cyan-400">
                                {inv.invoiceNumber}
                              </span>
                              <span
                                className={`px-2 py-0.2 rounded text-[10px] font-semibold border ${badge.bg} ${badge.textCol} ${badge.border}`}
                              >
                                {badge.text}
                              </span>
                            </div>
                            <p className="text-slate-400 mt-1">
                              Period: {formatDate(inv.billingPeriodStart)} to {formatDate(inv.billingPeriodEnd)} • Due: {formatDate(inv.dueDate)}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 block">Total Due:</span>
                              <span className="font-mono font-bold text-sm text-slate-200">
                                {formatCurrency(inv.balanceDue > 0 ? inv.balanceDue : inv.totalAmount)}
                              </span>
                            </div>

                            <button
                              onClick={() => {
                                const pdf = generateInvoicePDF(inv, businessProfile, customer, plans);
                                pdf.save(`${inv.invoiceNumber}.pdf`);
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              title="Download Official PDF Statement"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>PDF</span>
                            </button>

                            {inv.balanceDue > 0 && (
                              <button
                                onClick={() => {
                                  setPayInvoiceId(inv.id);
                                  setPortalTab('pay');
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                              >
                                Pay
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Col: Support Center Info */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-4 text-center sm:text-left">
                <h3 className="font-bold text-sm text-slate-100 flex items-center justify-center sm:justify-start gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  <span>Support Center</span>
                </h3>

                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3 text-xs text-center sm:text-left">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Helpline Number</span>
                    <span className="font-mono font-bold text-cyan-400 text-sm">
                      {businessProfile.representative.mobile}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Office Address</span>
                    <p className="text-slate-300 mt-0.5">
                      {formatBusinessAddress(businessProfile.address)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Support Hours</span>
                    <p className="text-slate-300 mt-0.5">Monday to Saturday: 8:00 AM - 6:00 PM</p>
                  </div>
                </div>

                <button
                  onClick={() => setPortalTab('support')}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Submit Service Ticket</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: BILLS & SOA ================= */}
        {portalTab === 'bills' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-400" />
                  <span>Statements & Billing History</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Itemized monthly subscription statements, official receipts, and running account ledger.
                </p>
              </div>

              {/* View Switcher: Statements vs Timeline */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-2xl p-1 shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setBillingHistoryTab('statements')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    billingHistoryTab === 'statements'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Statements ({customerInvoices.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBillingHistoryTab('timeline')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    billingHistoryTab === 'timeline'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Ledger Timeline ({unifiedTimeline.length})</span>
                </button>
              </div>
            </div>

            {/* Lifetime Financial Snapshot Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Invoiced
                </span>
                <p className="text-lg font-mono font-bold text-slate-100">
                  {formatCurrency(totalBilledAmount)}
                </p>
                <span className="text-[10px] text-slate-400 block">
                  {customerInvoices.length} statement{customerInvoices.length === 1 ? '' : 's'} issued
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Total Paid & Settled
                </span>
                <p className="text-lg font-mono font-bold text-emerald-400">
                  {formatCurrency(totalPaidAmount)}
                </p>
                <span className="text-[10px] text-slate-400 block">
                  {customerPayments.length} official receipt{customerPayments.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Current Balance Due
                </span>
                <p
                  className={`text-lg font-mono font-bold ${
                    outstandingBalance > 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {formatCurrency(outstandingBalance)}
                </p>
                <span className="text-[10px] text-slate-400 block">
                  {unpaidInvoices.length} unpaid statement{unpaidInvoices.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Usable Credit
                  </span>
                  <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <p className="text-lg font-mono font-bold text-cyan-400">
                  {formatCurrency(totalAvailableCredit)}
                </p>
                <span className="text-[10px] text-slate-400 block">
                  {walletCredit > 0 ? `Wallet: ${formatCurrency(walletCredit)}` : 'Auto-deducts next bill'}
                </span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search statements or receipts..."
                  value={billingSearchQuery}
                  onChange={(e) => setBillingSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {billingHistoryTab === 'statements' && (
                <div className="flex items-center gap-1.5 self-start sm:self-auto text-xs">
                  <span className="text-[10px] text-slate-500 uppercase font-bold mr-1">Status:</span>
                  {(['all', 'unpaid', 'paid'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setBillingStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                        billingStatusFilter === st
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* View 1: Statements of Account (Invoices) */}
            {billingHistoryTab === 'statements' && (
              <>
                {filteredInvoices.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 bg-slate-900/80 rounded-3xl border border-slate-800 text-xs">
                    {billingSearchQuery.trim() || billingStatusFilter !== 'all'
                      ? 'No statements match your search/filter criteria.'
                      : 'No billing statements found.'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredInvoices.map((inv) => {
                      const pendingSub = getPendingSubmissionForInvoice(inv.id);
                      const badge = pendingSub
                        ? { text: 'Pending Verification', bg: 'bg-amber-500/10', textCol: 'text-amber-400', border: 'border-amber-500/30' }
                        : getInvoiceStatusBadge(inv.status);
                      return (
                        <div
                          key={inv.id}
                          className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-4 hover:border-slate-700/80 transition-all"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                            <div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-base text-cyan-400">
                                  {inv.invoiceNumber}
                                </span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.textCol} ${badge.border}`}
                                >
                                  {badge.text}
                                </span>
                                {inv.appliedCredit && inv.appliedCredit > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                                    Wallet Credit: -{formatCurrency(inv.appliedCredit)}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-1">
                                Billing Period: <strong className="text-slate-200">{formatDate(inv.billingPeriodStart)} to {formatDate(inv.billingPeriodEnd)}</strong>
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const pdf = generateInvoicePDF(inv, businessProfile, customer, plans);
                                  pdf.save(`${inv.invoiceNumber}_${customer.accountNo}.pdf`);
                                }}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download PDF Bill</span>
                              </button>

                              {pendingSub ? (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/40 text-amber-300 border border-amber-800/40 rounded-xl text-xs font-semibold">
                                  <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                                  <span>Proof Submitted (#{pendingSub.submissionNumber})</span>
                                </div>
                              ) : inv.balanceDue > 0 ? (
                                <button
                                  onClick={() => {
                                    setPayInvoiceId(inv.id);
                                    setPortalTab('pay');
                                  }}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 cursor-pointer"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Pay {formatCurrency(inv.balanceDue)}</span>
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {/* Itemized Table */}
                          <div className="border border-slate-800 rounded-2xl overflow-hidden text-xs">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                                  <th className="py-2.5 px-4">Description of Services & Charges</th>
                                  <th className="py-2.5 px-4 text-center">Qty</th>
                                  <th className="py-2.5 px-4 text-right">Unit Rate</th>
                                  <th className="py-2.5 px-4 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60">
                                {inv.items.map((item, idx) => {
                                  const isPlanItem = item.type === 'plan' || (!item.type && idx === 0);
                                  const planDetails = resolveInvoicePlanDetails(inv, customer, plans);
                                  const displayDesc = item.description || (isPlanItem
                                    ? (inv.isProrated && inv.proratedDays
                                        ? `Internet Plan: ${planDetails.planName} — Prorated (${inv.proratedDays} Days)`
                                        : `Internet Plan: ${planDetails.planName} — Monthly Subscription`)
                                    : 'Service Item');

                                  const unitPrice = isPlanItem && (item.unitPrice <= 0 || !inv.isProrated) ? planDetails.monthlyFee : item.unitPrice;
                                  const itemAmount = isPlanItem && (item.amount <= 0 || !inv.isProrated) ? planDetails.monthlyFee : item.amount;

                                  return (
                                    <tr key={item.id || idx}>
                                      <td className="py-2.5 px-4 text-slate-200 font-medium">{displayDesc}</td>
                                      <td className="py-2.5 px-4 text-center text-slate-400">{item.quantity}</td>
                                      <td className="py-2.5 px-4 text-right font-mono text-slate-300">{formatCurrency(unitPrice)}</td>
                                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-100">{formatCurrency(itemAmount)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Calculations Summary */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 text-xs">
                            <div className="text-slate-400 space-y-0.5">
                              <p>Due Date: <strong className="text-rose-400">{formatDate(inv.dueDate)}</strong></p>
                              {pendingSub ? (
                                <p className="text-amber-300 font-semibold flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Payment Proof Queued: {formatCurrency(pendingSub.amount)} (Ref: {pendingSub.referenceNumber}) awaiting cashier approval.</span>
                                </p>
                              ) : inv.paidAt ? (
                                <p className="text-emerald-400">
                                  Paid on: {formatDateTime(inv.paidAt)} ({inv.paymentMethodUsed?.toUpperCase()})
                                </p>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-4 text-right">
                              <div>
                                <span className="text-[10px] text-slate-500 block">Total Invoiced:</span>
                                <span className="font-mono text-slate-200 font-bold">{formatCurrency(inv.totalAmount)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 block">Balance Due:</span>
                                <span
                                  className={`font-mono text-base font-black ${
                                    inv.balanceDue > 0 ? 'text-rose-400' : 'text-emerald-400'
                                  }`}
                                >
                                  {formatCurrency(inv.balanceDue)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* View 2: Chronological Ledger Timeline */}
            {billingHistoryTab === 'timeline' && (
              <div className="space-y-4">
                {unifiedTimeline.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 bg-slate-900/80 rounded-3xl border border-slate-800 text-xs">
                    No transactions or billing activities recorded yet.
                  </div>
                ) : (
                  <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
                    {unifiedTimeline.map((item) => {
                      const isInvoice = item.type === 'invoice';
                      return (
                        <div key={item.id} className="relative group">
                          {/* Timeline node icon */}
                          <div
                            className={`absolute -left-6 sm:-left-8 top-3 w-6 h-6 rounded-full flex items-center justify-center border text-[11px] shadow-sm ${
                              isInvoice
                                ? 'bg-rose-950/80 border-rose-500/50 text-rose-400'
                                : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400'
                            }`}
                          >
                            {isInvoice ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                          </div>

                          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-sm hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-100">{item.title}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.statusBadge.bg} ${item.statusBadge.textCol} ${item.statusBadge.border}`}
                                >
                                  {item.statusBadge.text}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {formatDate(item.date)}
                                </span>
                              </div>
                              <p className="text-slate-400 text-[11px]">{item.subtitle}</p>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                              <div className="text-right">
                                <span className="text-[10px] text-slate-500 uppercase block font-medium">
                                  {isInvoice ? 'Statement Charge' : 'Payment Settled'}
                                </span>
                                <span
                                  className={`font-mono text-base font-black ${
                                    isInvoice ? 'text-rose-400' : 'text-emerald-400'
                                  }`}
                                >
                                  {isInvoice ? `-${formatCurrency(item.amount)}` : `+${formatCurrency(item.amount)}`}
                                </span>
                              </div>

                              {isInvoice && item.invoice && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const pdf = generateInvoicePDF(item.invoice!, businessProfile, customer, plans);
                                    pdf.save(`${item.invoice!.invoiceNumber}_${customer.accountNo}.pdf`);
                                  }}
                                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
                                  title="Download Statement PDF"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}

                              {!isInvoice && item.payment && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const pdf = generateOfficialReceiptPDF(item.payment!, businessProfile);
                                    pdf.save(`${item.payment!.receiptNumber}.pdf`);
                                  }}
                                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition-colors cursor-pointer"
                                  title="Download Official Receipt PDF"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: PAY ONLINE (GCASH / MAYA) ================= */}
        {portalTab === 'pay' && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-slate-100 flex items-center justify-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <span>Pay Online via GCash, Maya, or Bank Transfer</span>
              </h2>
              <p className="text-xs text-slate-400">
                Scan our merchant QR code using GCash or Maya, enter your reference number, and attach your receipt screenshot. Once verified and approved by our cashier, your Official Receipt (OR) will be issued.
              </p>
            </div>

            {/* Payment Success Banner */}
            {justPaidPaymentId && (
              <div className="p-5 rounded-3xl bg-emerald-950/60 border border-emerald-500/60 shadow-lg space-y-3 animate-in fade-in zoom-in-95 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-emerald-300 text-sm">
                      Payment Successfully Acknowledged!
                    </h3>
                    <p className="text-xs text-emerald-200/80">
                      Your Official Receipt has been issued and your account balance updated.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      const pay = payments.find((p) => p.id === justPaidPaymentId);
                      if (pay) {
                        const pdf = generateOfficialReceiptPDF(pay, businessProfile);
                        pdf.save(`${pay.receiptNumber}.pdf`);
                      }
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Official Receipt PDF</span>
                  </button>

                  <button
                    onClick={() => {
                      setJustPaidPaymentId(null);
                      setPortalTab('receipts');
                    }}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    View in Receipts Tab &rarr;
                  </button>
                </div>
              </div>
            )}
            {/* Usable Credit Balance Banner */}
            {totalAvailableCredit > 0 && (
              <div className="p-4 rounded-3xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3 text-xs shadow-sm">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-emerald-300 text-sm">
                      Usable Credit Balance: +{formatCurrency(totalAvailableCredit)}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 text-[10px] font-bold border border-emerald-700/40">
                      Auto-Deducts
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    {walletCredit > 0 ? `Prepaid Wallet: ${formatCurrency(walletCredit)}` : ''}
                    {advanceCredit > 0 ? ` • Advance Overpayment: ${formatCurrency(advanceCredit)}` : ''}
                    . Any newly generated monthly statement will automatically deduct from this credit pool first.
                  </p>
                </div>
              </div>
            )}

            <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6">
              {/* Step 1: Choose Channel */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block text-center">
                  1. Select Payment Channel
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { id: 'xendit', label: 'Xendit Gateway', icon: '⚡', desc: 'Direct Online Pay', badge: 'Fast Auto' },
                    { id: 'gcash', label: 'GCash QR Ph', icon: '📱', desc: 'Scan to pay' },
                    { id: 'maya', label: 'Maya QR Ph', icon: '💳', desc: 'Maya QR' },
                    { id: 'cash', label: 'Cash Payment', icon: '💵', desc: 'Admin / Office manual' },
                    { id: 'bank_transfer', label: 'Bank Transfer', icon: '🏦', desc: 'BDO / Landbank' },
                  ].map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => {
                        setPayMethod(m.id as PaymentMethod);
                        if (m.id !== 'xendit') setActiveXenditSession(null);
                      }}
                      className={`relative p-3.5 rounded-2xl border flex flex-col items-center text-center gap-1 transition-all cursor-pointer ${
                        payMethod === m.id
                          ? m.id === 'xendit'
                            ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-glow-cyan'
                            : m.id === 'cash'
                            ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-glow-amber'
                            : 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-glow-emerald'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {m.badge && (
                        <span className="absolute -top-2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500 text-slate-950 shadow-sm animate-pulse">
                          {m.badge}
                        </span>
                      )}
                      <span className="text-xl">{m.icon}</span>
                      <span className="font-bold text-xs">{m.label}</span>
                      <span className="text-[10px] text-slate-500">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ================= CHANNEL 1: XENDIT DIRECT GATEWAY ================= */}
              {payMethod === 'xendit' && (
                <div className="space-y-4">
                  {!activeXenditSession ? (
                    <div className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
                            <Zap className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-100 text-xs block">
                              Xendit Philippines Direct Gateway
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Instant automated settlement &amp; real-time line restoration
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                          BSP &amp; PCI-DSS Level 1
                        </span>
                      </div>

                      {/* Payment Amount Input */}
                      <div className="space-y-1">
                        <label className="block text-slate-400 font-medium">Payment Amount (PHP ₱) *</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-base">₱</span>
                          <input
                            type="number"
                            step="any"
                            required
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            placeholder="1299.00"
                            className="w-full pl-9 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-100 font-mono font-black text-lg focus:outline-none focus:border-cyan-500 text-center"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-0.5">
                          <span>Bill Due: {formatCurrency(selectedPayInvoice?.balanceDue || customer.balance || customer.monthlyFee)}</span>
                          <button
                            type="button"
                            onClick={() => setPayAmount(String(selectedPayInvoice?.balanceDue || customer.balance || customer.monthlyFee))}
                            className="text-cyan-400 hover:underline cursor-pointer"
                          >
                            Pay Full Balance
                          </button>
                        </div>
                      </div>

                      {/* Preferred Xendit Subchannel Selection */}
                      <div className="space-y-2">
                        <label className="block text-slate-400 font-medium text-xs">
                          Preferred Payment Method (or select All-In-One):
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <button
                            type="button"
                            onClick={() => setXenditSubChannel('MULTI_CHANNEL')}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              xenditSubChannel === 'MULTI_CHANNEL'
                                ? 'bg-cyan-950/50 border-cyan-500 text-cyan-200 shadow-sm'
                                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <span className="text-base block mb-0.5">🌐</span>
                            <span className="font-bold text-[11px] block text-slate-200">All-in-One</span>
                            <span className="text-[9px] text-slate-500 block truncate">Customer chooses on checkout</span>
                          </button>

                          {XENDIT_CHANNELS.slice(0, 7).map((ch) => (
                            <button
                              type="button"
                              key={ch.id}
                              onClick={() => setXenditSubChannel(ch.id)}
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                xenditSubChannel === ch.id
                                  ? 'bg-cyan-950/50 border-cyan-500 text-cyan-200 shadow-sm'
                                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                              }`}
                            >
                              <span className="text-base block mb-0.5">{ch.icon}</span>
                              <span className="font-bold text-[11px] block text-slate-200">{ch.name}</span>
                              <span className="text-[9px] text-slate-500 block truncate">{ch.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Checkout Initiation Button */}
                      <button
                        type="button"
                        onClick={handleInitiateXenditCheckout}
                        disabled={isCreatingXenditInvoice}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl text-sm font-bold shadow-xl shadow-cyan-600/30 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      >
                        <Zap className={`w-4 h-4 ${isCreatingXenditInvoice ? 'animate-spin' : ''}`} />
                        <span>
                          {isCreatingXenditInvoice
                            ? 'Generating Xendit Checkout Session...'
                            : `Proceed to Pay ₱${Number(payAmount || 0).toLocaleString()} via Xendit`}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    /* Active Xendit Checkout Session Screen */
                    <div className="p-6 rounded-3xl bg-slate-950 border border-cyan-500/60 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
                            <Zap className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                              <span>Xendit Hosted Checkout Active</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                                {activeXenditSession.id}
                              </span>
                            </h3>
                            <p className="text-xs text-slate-400">
                              Amount Due:{' '}
                              <strong className="font-mono text-cyan-300 text-sm">
                                ₱{activeXenditSession.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </strong>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/40 text-xs font-semibold">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                          <span>{isPollingXendit ? 'Verifying status...' : 'Awaiting payment confirmation...'}</span>
                        </div>
                      </div>

                      {/* Interactive Actions Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                        {/* Direct Checkout Link Button */}
                        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-center sm:text-left">
                          <span className="text-xs font-bold text-slate-200 block">
                            Hosted Checkout Window:
                          </span>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Click the button below to open the secure Xendit checkout page where you can pay via GCash, Maya, Card, or Bank.
                          </p>
                          <a
                            href={activeXenditSession.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all hover:scale-[1.02] cursor-pointer"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Open Xendit Checkout Page ↗</span>
                          </a>
                        </div>

                        {/* Direct QR / Barcode Display */}
                        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center text-center gap-2">
                          {activeXenditSession.payment_channel === '7ELEVEN' ? (
                            <div className="p-3 bg-white text-slate-900 rounded-xl font-mono text-center space-y-1 w-full">
                              <div className="text-xl tracking-[0.25em] font-black">|||||||||||||||||||||</div>
                              <p className="text-xs font-bold">{activeXenditSession.barcode_number}</p>
                              <p className="text-[9px] text-slate-600">Present at 7-Eleven CLiQQ cashier</p>
                            </div>
                          ) : (
                            <div className="bg-white p-2.5 rounded-2xl shadow-md">
                              <QRCodeSVG value={activeXenditSession.invoice_url} size={110} />
                            </div>
                          )}
                          <span className="text-[10px] text-slate-400">
                            Scan with phone or e-wallet to open payment screen
                          </span>
                        </div>
                      </div>

                      {/* Live Verification & Test Simulator Controls */}
                      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveXenditSession(null)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          Cancel / New Session
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              setIsPollingXendit(true);
                              const check = await checkXenditInvoiceStatus(
                                activeXenditSession.id,
                                businessProfile.paymentGateways.xenditSecretKey
                              );
                              setIsPollingXendit(false);
                              if (check.status === 'PAID') {
                                handleSettlePaidXenditSession(activeXenditSession);
                              } else {
                                alert(`Xendit status is currently: ${check.status}. If you have finished paying, please allow a few seconds for settlement.`);
                              }
                            }}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl text-xs font-semibold border border-cyan-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Activity className="w-3.5 h-3.5" />
                            <span>Check Status Now</span>
                          </button>

                          {isStaffUser(currentAuthUser) && (
                            <button
                              type="button"
                              onClick={() => handleSettlePaidXenditSession(activeXenditSession)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition-all hover:scale-105 flex items-center gap-1.5 cursor-pointer"
                              title="Staff testing: Settle instant payment simulation"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Staff Test Settlement</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================= CHANNEL 2: CASH PAYMENT (MANUAL ADMIN SETTING) ================= */}
              {payMethod === 'cash' && (
                <div className="p-6 rounded-3xl bg-slate-950 border border-amber-500/40 space-y-5">
                  <div className="flex items-start gap-3 border-b border-slate-800 pb-4">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold shrink-0">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-100 text-sm">Cash Payment (Office / Field Collector)</h3>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 font-mono">
                          Set by Admin Manually
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Cash payments are not processed directly through the self-service web portal. An authorized SwiftStream administrator or field technician will manually inspect your balance, receive cash, and immediately issue an Official Receipt (OR).
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Option A: Office Cashier */}
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                        <MapPin className="w-4 h-4" />
                        <span>Option 1: Visit Our Office</span>
                      </div>
                      <p className="text-slate-300 text-xs">
                        {formatBusinessAddress(businessProfile.address)}
                      </p>
                      <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-800">
                        <p>🕒 Cashier Hours: Mon – Sat: 8:00 AM – 5:00 PM</p>
                        <p>📞 Helpline: <strong className="text-cyan-400">{businessProfile.representative.mobile}</strong></p>
                      </div>
                    </div>

                    {/* Option B: In-Home Field Collection */}
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                          <User className="w-4 h-4" />
                          <span>Option 2: Request Home Pickup</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Have an authorized field technician or collection agent visit your installation address to collect cash.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleRequestCashCollection}
                        className="w-full py-2.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Request Field Cash Pickup</span>
                      </button>
                    </div>
                  </div>

                  {cashCollectionRequested && (
                    <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 flex items-start gap-3 animate-in fade-in">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-xs">Cash Collection Request Dispatched!</h4>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          A field collector has been assigned to visit your registered premises ({customer.address.street}, Brgy. {customer.address.barangay}). An Official Receipt will be issued upon cash turnover.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Prefer instant online activation without waiting?</span>
                    <button
                      type="button"
                      onClick={() => setPayMethod('xendit')}
                      className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
                    >
                      Pay Online via Xendit &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* ================= CHANNEL 3, 4: GCASH / MAYA / BANK MANUAL PROOF ================= */}
              {payMethod !== 'xendit' && payMethod !== 'cash' && (
                <div className="p-5 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                    {/* QR Code Container */}
                    {(() => {
                      const customQr =
                        payMethod === 'gcash'
                          ? businessProfile.paymentGateways.gcashQrImage
                          : payMethod === 'maya'
                          ? businessProfile.paymentGateways.mayaQrImage
                          : undefined;

                      const hasCustomQr = Boolean(customQr && customQr.trim());
                      const isShowingCustom = hasCustomQr && qrDisplayMode === 'merchant';

                      return (
                        <div className="bg-white p-4 rounded-3xl border-2 border-slate-700 flex-shrink-0 shadow-2xl flex flex-col items-center gap-2 min-w-[210px] max-w-[240px]">
                          <div className="flex items-center justify-between gap-1 text-slate-900 font-bold text-[10px] tracking-wider uppercase border-b border-slate-200 pb-1.5 w-full">
                            <div className="flex items-center gap-1.5 truncate">
                              <QrCode className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="truncate">
                                {isShowingCustom
                                  ? payMethod === 'gcash'
                                    ? 'Official GCash QR'
                                    : 'Official Maya QR'
                                  : 'Dynamic QR Ph'}
                              </span>
                            </div>

                            {hasCustomQr && (
                              <button
                                type="button"
                                onClick={() => setQrDisplayMode((prev) => (prev === 'merchant' ? 'dynamic' : 'merchant'))}
                                className="text-[9px] font-mono text-blue-700 hover:text-blue-900 underline font-semibold shrink-0 cursor-pointer"
                                title="Switch QR Code view"
                              >
                                {qrDisplayMode === 'merchant' ? 'show dynamic' : 'show merchant'}
                              </button>
                            )}
                          </div>

                          {isShowingCustom ? (
                            <div className="relative group flex flex-col items-center">
                              <img
                                src={customQr}
                                alt={`${payMethod.toUpperCase()} Merchant QR Code`}
                                className="w-[155px] h-[155px] object-contain rounded-xl p-1 bg-white border border-slate-200 cursor-pointer hover:opacity-95 transition-opacity shadow-sm"
                                onClick={() => setPreviewQrModal(customQr || null)}
                              />
                              <button
                                type="button"
                                onClick={() => setPreviewQrModal(customQr || null)}
                                className="mt-1 text-[10px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Tap to Enlarge</span>
                              </button>
                            </div>
                          ) : (
                            <QRCodeSVG
                              value={generateDynamicQrPhPayload({
                                merchantName: businessProfile.tradeName || 'SWIFTSTREAM TELECOM',
                                merchantCity: businessProfile.address.city || 'LAGONOY',
                                accountNumber: customer.accountNo,
                                amount: Number(payAmount) || (customer.balance > 0 ? customer.balance : customer.monthlyFee),
                                invoiceNumber: selectedPayInvoice?.invoiceNumber || 'BILL-2026',
                                mobileNumber: businessProfile.paymentGateways.gcashNumber || '09624171684',
                                serviceProvider: payMethod === 'gcash' ? 'gcash' : payMethod === 'maya' ? 'maya' : 'qrph_national',
                              })}
                              size={150}
                              level="M"
                            />
                          )}

                          <div className="text-center text-[10px] text-slate-600 font-mono font-bold">
                            ₱{(Number(payAmount) || (customer.balance > 0 ? customer.balance : customer.monthlyFee)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="space-y-3 text-xs flex-1 text-center md:text-left">
                      <div className="flex items-center justify-center md:justify-between">
                        <span className="font-bold text-slate-100 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>QR Ph National Interoperable</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setPayMethod('xendit')}
                          className="text-[10px] text-cyan-300 bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded-full font-bold hover:bg-cyan-900 transition-colors cursor-pointer hidden md:inline"
                        >
                          ⚡ Pay via Xendit instead &rarr;
                        </button>
                      </div>

                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Scan this QR with <strong>GCash</strong>, <strong>Maya</strong>, or banking app. Enter reference number below for manual cashier validation.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <div className="text-left">
                            <span className="text-[10px] text-slate-500 block">Number:</span>
                            <span className="font-mono font-bold text-slate-200">
                              {payMethod === 'gcash'
                                ? businessProfile.paymentGateways.gcashNumber
                                : payMethod === 'maya'
                                ? businessProfile.paymentGateways.mayaNumber
                                : businessProfile.paymentGateways.bankAccountNumber}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                payMethod === 'gcash'
                                  ? businessProfile.paymentGateways.gcashNumber
                                  : payMethod === 'maya'
                                  ? businessProfile.paymentGateways.mayaNumber
                                  : businessProfile.paymentGateways.bankAccountNumber,
                                'acct'
                              )
                            }
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                          >
                            {copiedField === 'acct' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                          <div className="text-left">
                            <span className="text-[10px] text-slate-500 block">Merchant:</span>
                            <span className="font-bold text-slate-200 truncate block max-w-[130px]">
                              {payMethod === 'gcash'
                                ? businessProfile.paymentGateways.gcashName
                                : payMethod === 'maya'
                                ? businessProfile.paymentGateways.mayaName
                                : businessProfile.paymentGateways.bankAccountName}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400">Verified</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Manual Proof Submission Form */}
                  <form onSubmit={handleConfirmOnlinePayment} className="space-y-4 pt-4 border-t border-slate-800 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">Amount Transferred (PHP ₱) *</label>
                        <input
                          type="number"
                          step="any"
                          required
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          placeholder="1299.00"
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-mono font-bold text-base focus:outline-none focus:border-cyan-500 text-center"
                        />
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {customer.balance > 0 && (
                            <button
                              type="button"
                              onClick={() => setPayAmount(customer.balance.toString())}
                              className="px-2 py-0.5 rounded-lg bg-rose-950 text-rose-300 border border-rose-800/40 text-[10px] font-semibold hover:bg-rose-900/50 cursor-pointer"
                            >
                              Full Due: {formatCurrency(customer.balance)}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPayAmount(customer.monthlyFee.toString())}
                            className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold hover:bg-slate-700 cursor-pointer"
                          >
                            1 Mo: {formatCurrency(customer.monthlyFee)}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPayAmount((customer.monthlyFee * 2).toString())}
                            className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-semibold hover:bg-slate-700 cursor-pointer"
                          >
                            2 Mo Advance: {formatCurrency(customer.monthlyFee * 2)}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">
                          {payMethod === 'gcash' ? 'GCash Ref No. (e.g. 9018247192) *' : payMethod === 'maya' ? 'Maya Ref No. *' : 'Bank Reference # *'}
                        </label>
                        <input
                          type="text"
                          required
                          value={payReference}
                          onChange={(e) => setPayReference(e.target.value)}
                          placeholder="Enter transaction ref number..."
                          className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500 text-center"
                        />
                      </div>
                    </div>

                    {/* Receipt Screenshot Upload Field */}
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium flex items-center justify-between">
                        <span>Upload Transfer Receipt Screenshot (Optional)</span>
                        <span className="text-[10px] text-slate-500 font-normal">PNG, JPG, WEBP (Max 5MB)</span>
                      </label>

                      {receiptImageBase64 ? (
                        <div className="p-3 bg-slate-900 border border-emerald-500/50 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <img
                              src={receiptImageBase64}
                              alt="Receipt Screenshot Preview"
                              className="w-12 h-12 object-cover rounded-xl border border-slate-700 shrink-0"
                            />
                            <div className="truncate">
                              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Receipt Screenshot Attached</span>
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                                Ready for cashier verification
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setReceiptImageBase64(null)}
                            className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer shrink-0"
                            title="Remove screenshot"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-2xl bg-slate-900/40 hover:bg-slate-900 transition-all cursor-pointer text-center group">
                          <Upload className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 mb-1 transition-colors" />
                          <span className="text-xs text-slate-300 font-semibold group-hover:text-cyan-300 transition-colors">
                            Click to upload payment screenshot
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5">
                            Attach your transaction receipt from GCash, Maya, or bank app
                          </span>
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/webp"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 10 * 1024 * 1024) {
                                  alert('Image file size must be less than 10MB.');
                                  return;
                                }
                                try {
                                  const compressed = await compressImageFile(file, 1200, 0.82);
                                  setReceiptImageBase64(compressed);
                                } catch (err) {
                                  console.warn('Failed to compress receipt image, falling back to raw:', err);
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    setReceiptImageBase64(reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>

                    {/* Instant AI Auto-Reconnection (10s) Action Banner */}
                    {receiptImageBase64 && (
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/90 via-indigo-950/90 to-purple-950/90 border border-cyan-500/50 space-y-3 animate-in fade-in shadow-xl shadow-cyan-950/40">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
                            </div>
                            <div>
                              <h5 className="font-bold text-xs text-cyan-100 flex items-center gap-2">
                                <span>⚡ Instant AI Settlement & Auto-Reconnection</span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  10 Seconds
                                </span>
                              </h5>
                              <p className="text-[11px] text-slate-300">
                                Gemini AI scans your receipt, clears your line from MikroTik isolation, and reconnects your internet in 10s.
                              </p>
                            </div>
                          </div>
                        </div>

                        {aiOcrError && (
                          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                            <span>{aiOcrError}</span>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={isAiVerifying}
                          onClick={handleInstantAiSettlement}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white rounded-xl text-xs font-black shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                        >
                          {isAiVerifying ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-white" />
                              <span>Gemini AI Analyzing Receipt & Contacting Router...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                              <span>Verify Receipt & Auto-Reconnect Line (10s Instant)</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmittingPayment}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-2xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Or Submit for Manual Cashier Review</span>
                      </button>
                    </div>

                    {submittedProofSuccess && (
                      <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-800/60 text-amber-200 flex items-start gap-3 animate-in fade-in">
                        <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-xs text-amber-300">Payment Proof Submitted for Verification!</h4>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            Your transaction has been submitted and is currently in <strong>Pending Review</strong> in our Cashier Verification Queue. Once approved by our cashier, your invoice will be marked as paid and your Official Receipt (OR) will be issued.
                          </p>
                        </div>
                      </div>
                    )}
                  </form>
                </div>
              )}


              {/* Payment Verification History Tracker */}
              {customer && paymentSubmissions.filter((s) => s.customerId === customer.id).length > 0 && (
                <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-slate-200 text-xs flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      <span>Your Payment Verification History</span>
                    </span>
                  </div>

                  <div className="space-y-2">
                    {paymentSubmissions
                      .filter((s) => s.customerId === customer.id)
                      .map((sub) => (
                        <div
                          key={sub.id}
                          className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-200">#{sub.submissionNumber}</span>
                              <span className="font-mono text-emerald-400 font-bold">{formatCurrency(sub.amount)}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Ref: {sub.referenceNumber} • {formatDateTime(sub.submittedAt)}
                            </span>
                          </div>

                          <div>
                            {sub.status === 'pending_review' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-950 text-amber-300 border border-amber-800/40">
                                Pending Review
                              </span>
                            )}
                            {sub.status === 'approved' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                                Verified & OR Issued
                              </span>
                            )}
                            {sub.status === 'rejected' && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-950 text-rose-300 border border-rose-800/40">
                                Rejected: {sub.rejectionReason}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: PAYMENT RECEIPTS ================= */}
        {portalTab === 'receipts' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-slate-100 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Official Billing Receipts (OR)</span>
              </h2>
              <p className="text-xs text-slate-400">
                Official Receipts (OR) are issued once payments are verified and approved by the cashier.
              </p>
            </div>

            {/* Submissions Pending Cashier Approval */}
            {pendingSubmissions.length > 0 && (
              <div className="p-5 rounded-3xl bg-amber-950/30 border border-amber-800/50 space-y-4">
                <div className="flex items-center justify-between border-b border-amber-800/40 pb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span className="font-bold text-xs text-amber-200 uppercase tracking-wider">
                      Submissions Awaiting Cashier Approval ({pendingSubmissions.length})
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-400/80 font-mono">
                    Under Audit
                  </span>
                </div>

                <div className="space-y-2.5">
                  {pendingSubmissions.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        {sub.receiptImageUrl ? (
                          <img
                            src={sub.receiptImageUrl}
                            alt="Receipt"
                            className="w-10 h-10 object-cover rounded-xl border border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-slate-500 font-mono text-[10px]">
                            No Pic
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-100">#{sub.submissionNumber}</span>
                            <span className="font-mono font-bold text-amber-300">{formatCurrency(sub.amount)}</span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-950 text-amber-400 border border-amber-800/50">
                              Pending Review
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            Channel: <strong className="text-slate-200">{sub.paymentMethod.toUpperCase()}</strong> • Ref: <span className="text-cyan-400">{sub.referenceNumber}</span> • {formatDateTime(sub.submittedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right sm:self-center">
                        <span className="text-[11px] text-amber-400/90 font-medium block">
                          Awaiting Cashier Approval
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          OR issued upon cashier verification
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Finalized / Issued Official Receipts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <span>Approved & Issued Official Receipts ({customerPayments.length})</span>
                </span>
              </div>

              {customerPayments.length === 0 ? (
                <div className="p-10 text-center text-slate-500 bg-slate-900/80 rounded-3xl border border-slate-800 text-xs space-y-1">
                  <p className="font-medium text-slate-400">No finalized official receipts issued yet.</p>
                  <p className="text-[11px] text-slate-500">
                    Once your payment submission is verified and approved by our cashier, your official receipt will appear here for download.
                  </p>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customerPayments.map((p) => {
                  const method = getPaymentMethodLabel(p.paymentMethod);
                  return (
                    <div
                      key={p.id}
                      className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all text-center sm:text-left"
                    >
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sm text-emerald-400">
                            {p.receiptNumber}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatDateTime(p.paymentDate)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-slate-400">Channel / Method:</span>
                          <span className="inline-flex items-center gap-1 text-slate-200 font-semibold">
                            <span>{method.icon}</span>
                            <span>{method.label}</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Reference No:</span>
                          <span className="font-mono text-slate-300">{p.referenceNumber || 'Counter / N/A'}</span>
                        </div>

                        {p.invoiceNumber && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Applied Statement:</span>
                            <span className="font-mono text-cyan-400">{p.invoiceNumber}</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Total Amount Paid:</span>
                          <span className="font-mono font-extrabold text-base text-emerald-400">
                            {formatCurrency(p.amount)}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            const pdf = generateOfficialReceiptPDF(p, businessProfile);
                            pdf.save(`${p.receiptNumber}.pdf`);
                          }}
                          className="px-3.5 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Thermal PDF</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

        {/* ================= TAB: NOTIFICATIONS & ADVISORIES ================= */}
        {portalTab === 'notifications' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-cyan-400" />
                  <span>Notifications & Network Advisories</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Official SMS alerts, maintenance schedules, payment confirmations, and billing reminders dispatched to your account.
                </p>
              </div>

              {/* Destination info pill */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 self-start sm:self-auto">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>SMS Target: <strong className="text-slate-200 font-mono">{customer.mobile}</strong></span>
              </div>
            </div>

            {/* Notification Filter Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all', label: 'All Notices', count: customerReminders.length },
                {
                  id: 'advisories',
                  label: 'Outages & Maintenance',
                  count: customerReminders.filter(
                    (r) => r.type.includes('advisory') || r.type.includes('maintenance') || r.type.includes('restored') || r.type.includes('outage')
                  ).length,
                },
                {
                  id: 'billing',
                  label: 'Billing & Due Dates',
                  count: customerReminders.filter(
                    (r) => r.type.includes('due') || r.type.includes('warning') || r.type.includes('disconnection')
                  ).length,
                },
                {
                  id: 'payments',
                  label: 'Payment Confirmations',
                  count: customerReminders.filter(
                    (r) => r.type.includes('payment') || r.type.includes('confirmation')
                  ).length,
                },
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setNotificationFilter(filter.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    notificationFilter === filter.id
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <span>{filter.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      notificationFilter === filter.id
                        ? 'bg-cyan-700 text-white'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Notifications List */}
            {filteredReminders.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900/80 rounded-3xl border border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-300 text-sm">No Notifications Found</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {notificationFilter === 'all'
                      ? 'You have no recorded SMS notices or network advisories at this time. When our NOC sends maintenance alerts or billing reminders, they will appear here.'
                      : `No notifications found under the "${notificationFilter}" filter.`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReminders.map((r) => {
                  const isMaintenance =
                    r.type.includes('maintenance') || r.type.includes('advisory') || r.type.includes('outage');
                  const isRestored = r.type.includes('restored');
                  const isOverdue =
                    r.type.includes('overdue') || r.type.includes('disconnection');
                  const isDue = r.type.includes('due');
                  const isPayment = r.type.includes('payment');

                  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
                  let icon = <Info className="w-4 h-4 text-slate-400" />;
                  let typeLabel = 'System Notice';

                  if (isMaintenance) {
                    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
                    icon = <AlertTriangle className="w-4 h-4 text-amber-400" />;
                    typeLabel = 'Maintenance & Outage Advisory';
                  } else if (isRestored) {
                    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                    icon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
                    typeLabel = 'Service Restored Announcement';
                  } else if (isOverdue) {
                    badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
                    icon = <AlertCircle className="w-4 h-4 text-rose-400" />;
                    typeLabel = 'Disconnection Warning';
                  } else if (isDue) {
                    badgeColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
                    icon = <Clock className="w-4 h-4 text-cyan-400" />;
                    typeLabel = 'Bill Due Date Reminder';
                  } else if (isPayment) {
                    badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                    icon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
                    typeLabel = 'Official Payment Confirmation';
                  }

                  return (
                    <div
                      key={r.id}
                      className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 shadow-sm transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 shrink-0">
                            {icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-slate-100">{typeLabel}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                                {r.type.replace(/_/g, ' ').toUpperCase()}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                              Dispatched: {formatDateTime(r.sentAt)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 self-start sm:self-auto font-mono">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800">
                            Channel: {r.channel.toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                            ● Sent
                          </span>
                        </div>
                      </div>

                      {/* Message Body */}
                      <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-line">
                        {r.messageText}
                      </div>

                      {/* Footer Actions / References */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
                        <div className="text-slate-400 text-[11px]">
                          {r.invoiceNumber && (
                            <span>Ref Statement: <strong className="text-cyan-400 font-mono">{r.invoiceNumber}</strong></span>
                          )}
                          {r.amountDue !== undefined && r.amountDue > 0 && (
                            <span className="ml-2">• Amount Due: <strong className="text-rose-400 font-mono">{formatCurrency(r.amountDue)}</strong></span>
                          )}
                        </div>

                        {r.invoiceNumber && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const matchedInv = customerInvoices.find((i) => i.invoiceNumber === r.invoiceNumber);
                                if (matchedInv && matchedInv.balanceDue > 0) {
                                  setPayInvoiceId(matchedInv.id);
                                  setPortalTab('pay');
                                } else {
                                  setPortalTab('bills');
                                }
                              }}
                              className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600 hover:text-white text-cyan-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-cyan-500/30"
                            >
                              View Statement &rarr;
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: SUPPORT & TICKETS ================= */}
        {portalTab === 'support' && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-slate-100 flex items-center justify-center gap-2">
                <Wrench className="w-5 h-5 text-cyan-400" />
                <span>Customer Support & Trouble Desk</span>
              </h2>
              <p className="text-xs text-slate-400">
                Report technical connection issues, request fiber line checks, or track active maintenance tickets.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Col: Request Ticket Form */}
              <div className="lg:col-span-1 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Wrench className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-bold text-sm text-slate-100">Submit Service Request</h3>
                </div>

                {ticketSubmitted && (
                  <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/60 text-xs text-emerald-300 space-y-1 animate-in fade-in text-center">
                    <p className="font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ticket Dispatched!</span>
                    </p>
                    <p className="text-[11px] text-emerald-200/80">
                      Our field technician team in Lagonoy has received your report.
                    </p>
                  </div>
                )}

                {/* Quick Preset Buttons */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Quick Issue Selection:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {issuePresets.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTicketIssue(preset.desc)}
                        className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500 hover:text-cyan-300 text-[11px] text-slate-300 transition-colors text-left cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleCreateTicket} className="space-y-4 text-xs pt-1">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Issue Category *</label>
                    <select
                      value={ticketDeviceType}
                      onChange={(e) => setTicketDeviceType(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="ONU/Router">ONU / Modem (No Internet / Red LOS)</option>
                      <option value="Fiber Line Cut">Fiber Drop Cable / Physical Wire Issue</option>
                      <option value="Desktop/Laptop">Device / PC Repair Service</option>
                      <option value="Switch/AP">WiFi Router / Access Point Setting</option>
                      <option value="Power Adapter">Power Supply / Adapter Replacement</option>
                      <option value="Other">Other Telecom / Lineman Service Request</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Describe your issue / problem *</label>
                    <textarea
                      rows={4}
                      required
                      value={ticketIssue}
                      onChange={(e) => setTicketIssue(e.target.value)}
                      placeholder="e.g. Red LOS blinking on Huawei modem after storm; no internet access since 8am..."
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send Ticket to Tech Desk</span>
                  </button>
                </form>
              </div>

              {/* Right 2 Cols: My Active Tickets */}
              <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-4">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>My Support & Repair Tickets</span>
                </h3>

                {customerTickets.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-800/60">
                    You have no pending support tickets. All fiber lines are operational.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerTickets.map((t) => {
                      const badge = getRepairStatusBadge(t.status);
                      return (
                        <div
                          key={t.id}
                          className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-cyan-400">{t.orderNumber}</span>
                              <span className="text-slate-300 font-semibold">• {t.deviceType}</span>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${badge.bg} ${badge.textCol}`}>
                              {badge.text}
                            </span>
                          </div>

                          <p className="text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                            {t.issueDescription}
                          </p>

                          {t.diagnosisNotes && (
                            <p className="text-[11px] text-slate-400 italic">
                              Tech Remarks: {t.diagnosisNotes}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex-wrap gap-2">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span>Filed on: {formatDate(t.dateReceived)}</span>
                              <span className="text-slate-300">Tech: {t.technician}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedChatTicket(t)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all shadow-md shadow-cyan-600/20 cursor-pointer hover:scale-105"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>Chat with Field Tech {t.messages && t.messages.length > 0 ? `(${t.messages.length})` : ''}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 6: SPEED TEST ================= */}
        {portalTab === 'speedtest' && (
          <div className="max-w-xl mx-auto p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl text-center space-y-8">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60 mx-auto">
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                <span>SwiftStream Fast Fiber Speed Diagnostics</span>
              </span>
              <h2 className="text-2xl font-bold text-slate-100 mt-2">
                Live Speed & Latency Test
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Target Plan: <strong className="text-cyan-400">{displayPlanName}{resolvedSpeed > 0 ? ` (${resolvedSpeed} Mbps Dedicated)` : ''}</strong>
              </p>
            </div>

            {/* Gauge Display */}
            <div className="grid grid-cols-3 gap-4 p-6 rounded-3xl bg-slate-950 border border-slate-800">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Download Speed
                </span>
                <h3 className="text-3xl font-black font-mono text-cyan-400">
                  {downloadSpeed}
                </h3>
                <span className="text-[10px] text-slate-400 font-semibold">Mbps</span>
              </div>

              <div className="space-y-1 border-x border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Upload Speed
                </span>
                <h3 className="text-3xl font-black font-mono text-emerald-400">
                  {uploadSpeed}
                </h3>
                <span className="text-[10px] text-slate-400 font-semibold">Mbps</span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Ping Latency
                </span>
                <h3 className="text-3xl font-black font-mono text-purple-400">
                  {pingLatency}
                </h3>
                <span className="text-[10px] text-slate-400 font-semibold">ms (Lag)</span>
              </div>
            </div>

            {/* Progress indicator */}
            {speedTestRunning && (
              <div className="space-y-2">
                <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-150"
                    style={{ width: `${speedProgress}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-cyan-400 animate-pulse block">
                  Testing optical connection to Lagonoy Core Node... ({speedProgress}%)
                </span>
              </div>
            )}

            {speedTestDone && (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Your fiber line is performing at peak efficiency with zero packet loss!</span>
              </div>
            )}

            <button
              onClick={startSpeedTest}
              disabled={speedTestRunning}
              className="px-8 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-cyan-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {speedTestRunning ? 'Testing Connection...' : 'Start Speed Test'}
            </button>
          </div>
        )}

        {/* ================= TAB 7: PLAN UPGRADE & WIFI SETTINGS ================= */}
        {portalTab === 'upgrade' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-slate-100 flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <span>Subscription Plan Upgrades & WiFi Controls</span>
              </h2>
              <p className="text-xs text-slate-400">
                Boost your fiber connection speed or submit a remote router WiFi credential update.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Box 1: Plan Upgrade */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-bold text-sm text-slate-100">Speed Boost & Plan Upgrade</h3>
                </div>

                {upgradeSubmitted && (
                  <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/60 text-xs text-emerald-300 space-y-1 animate-in fade-in text-center">
                    <p className="font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Upgrade Request Logged!</span>
                    </p>
                    <p className="text-[11px] text-emerald-200/80">
                      Our Lagonoy NOC team will adjust your PPPoE bandwidth queue within 24 hours.
                    </p>
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Current Subscription</span>
                  <p className="font-bold text-slate-200 text-sm">{displayPlanName}</p>
                  <p className="text-cyan-400 font-mono font-semibold">
                    {resolvedSpeed > 0 ? `${resolvedSpeed} Mbps Dedicated • ` : ''}{formatCurrency(customer.monthlyFee)}/mo
                  </p>
                </div>

                <form onSubmit={handleRequestPlanUpgrade} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Select Desired Target Plan</label>
                    <select
                      value={targetUpgradePlanId || (plans.find((p) => p.id !== customer.planId && !isRouterProfileName(p.name))?.id || '')}
                      onChange={(e) => setTargetUpgradePlanId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                    >
                      {plans
                        .filter((p) => p.id !== customer.planId && !isRouterProfileName(p.name))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {formatCommercialPlanName(p.name, p)} ({p.speedMbps} Mbps) — {formatCurrency(p.monthlyFee)}/mo
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 text-slate-300 space-y-1">
                    <p className="text-[11px]">
                      Upgrading takes effect on your next cut-off (Day {customer.billingDay}). No physical modem replacement needed for existing fiber lines!
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105 cursor-pointer"
                  >
                    Submit Plan Upgrade Request
                  </button>
                </form>
              </div>

              {/* Box 2: WiFi Router Settings */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-sm text-slate-100">Update WiFi Name & Password</h3>
                </div>

                {wifiSubmitted && (
                  <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/60 text-xs text-emerald-300 space-y-1 animate-in fade-in text-center">
                    <p className="font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>WiFi Change Request Sent!</span>
                    </p>
                    <p className="text-[11px] text-emerald-200/80">
                      Our remote technician will re-provision your ONU modem with the new credentials.
                    </p>
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Assigned ONU Hardware</span>
                  <p className="font-bold text-slate-200">
                    {customer.network.routerModel || 'Gigabit Dual-Band ONU'}
                  </p>
                  <p className="text-slate-400 font-mono text-[11px]">
                    SN: {customer.network.onuSerial || 'HWTC-ONU'} • IP: {customer.network.ipAddress}
                  </p>
                </div>

                <form onSubmit={handleRequestWifiUpdate} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">New WiFi Name (SSID) *</label>
                    <input
                      type="text"
                      required
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                      placeholder="e.g. SwiftStream_Flojo_5G"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">New WiFi Password (WPA2/WPA3) *</label>
                    <input
                      type="text"
                      required
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      placeholder="Minimum 8 characters..."
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 cursor-pointer"
                  >
                    Submit WiFi Update Request
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* QR Code Enlarged Preview Modal */}
      {previewQrModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewQrModal(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewQrModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm tracking-wide uppercase">
              <QrCode className="w-5 h-5" />
              <span>Official Merchant QR</span>
            </div>

            <div className="bg-white p-3 rounded-2xl shadow-inner border border-slate-300">
              <img
                src={previewQrModal}
                alt="Enlarged QR Code"
                className="w-64 h-64 object-contain rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-200">
                Scan or screenshot with your payment app
              </p>
              <p className="text-[11px] text-slate-400">
                {businessProfile.tradeName || 'SwiftStream Telecom'} • Instant Verification
              </p>
            </div>

            <button
              type="button"
              onClick={() => setPreviewQrModal(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Done / Close
            </button>
          </div>
        </div>
      )}

      {/* 10-Second Auto-Reconnection Countdown Modal */}
      {reconnectCountdown !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-cyan-500/50 rounded-3xl p-6 shadow-2xl space-y-5 text-center relative overflow-hidden">
            {/* Top progress bar */}
            <div
              className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 transition-all duration-1000"
              style={{ width: `${((10 - reconnectCountdown) / 10) * 100}%` }}
            />

            <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 relative">
              {reconnectCountdown > 0 ? (
                <>
                  <div className="absolute inset-0 rounded-2xl border-2 border-cyan-500/40 animate-ping" />
                  <span className="text-2xl font-black font-mono text-cyan-300">{reconnectCountdown}s</span>
                </>
              ) : (
                <CheckCircle2 className="w-9 h-9 text-emerald-400 animate-bounce" />
              )}
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-100 flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>
                  {reconnectCountdown > 0
                    ? 'Instant Line Reconnection in Progress'
                    : 'Your Internet Connection is Now ONLINE!'}
                </span>
              </h3>
              <p className="text-xs text-slate-300 font-medium px-4">
                {reconnectStep}
              </p>
            </div>

            {reconnectSuccessData && (
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-1.5 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Channel:</span>
                  <span className="font-bold text-cyan-300">{reconnectSuccessData.channel}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Verified Ref:</span>
                  <span className="font-bold text-slate-200">#{reconnectSuccessData.refNumber}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Amount Settled:</span>
                  <span className="font-bold text-emerald-400">{formatCurrency(reconnectSuccessData.amount)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800/80">
                  <span>Official Receipt:</span>
                  <span className="font-bold text-indigo-300">{reconnectSuccessData.receiptNo}</span>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2">
              {reconnectCountdown === 0 && customer && (
                <button
                  onClick={() => {
                    const pay = customerPayments.find((p) => p.receiptNumber === reconnectSuccessData?.receiptNo);
                    if (pay) {
                      const pdf = generateOfficialReceiptPDF(pay, businessProfile);
                      pdf.save(`${pay.receiptNumber}.pdf`);
                    } else if (reconnectSuccessData) {
                      const mockPay: any = {
                        id: generateId(),
                        receiptNumber: reconnectSuccessData.receiptNo,
                        customerId: customer.id,
                        amount: reconnectSuccessData.amount,
                        paymentDate: new Date().toISOString(),
                        paymentMethod: reconnectSuccessData.channel.toLowerCase() as PaymentMethod,
                        referenceNumber: reconnectSuccessData.refNumber,
                        cashierName: 'Gemini AI Vision Bot (Automated)',
                        createdAt: new Date().toISOString(),
                      };
                      const pdf = generateOfficialReceiptPDF(mockPay, businessProfile);
                      pdf.save(`${reconnectSuccessData.receiptNo}.pdf`);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Official Receipt (PDF)</span>
                </button>
              )}

              <button
                disabled={reconnectCountdown > 0}
                onClick={() => {
                  setReconnectCountdown(null);
                  setReconnectSuccessData(null);
                  setReceiptImageBase64(null);
                  setPortalTab('overview');
                }}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  reconnectCountdown === 0
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                }`}
              >
                {reconnectCountdown === 0 ? 'Continue to Portal Dashboard' : 'Please wait while router unblocks line...'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 24/7 Gemini AI Client Support Agent */}
      <GeminiAiAssistant mode="client" activeCustomer={customer} />

      {/* Real-time Field Technician Support Chat Modal */}
      {selectedChatTicket && customer && (
        <TicketChatModal
          ticket={selectedChatTicket}
          currentRole="customer"
          currentUserName={customer.fullName}
          currentUserId={customer.id}
          onClose={() => setSelectedChatTicket(null)}
          onUpdateTicket={(ticketId, updates) => {
            updateRepairOrder(ticketId, updates);
            setSelectedChatTicket((prev) => (prev && prev.id === ticketId ? { ...prev, ...updates } : prev));
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MOBILE-FIRST BOTTOM NAVIGATION BAR (Visible on mobile screens < md)        */}
      {/* ========================================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/90 px-3 py-2 shadow-2xl safe-area-bottom">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {/* Home / Overview */}
          <button
            type="button"
            onClick={() => setPortalTab('overview')}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
              portalTab === 'overview' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px]">Home</span>
          </button>

          {/* Bills */}
          <button
            type="button"
            onClick={() => setPortalTab('bills')}
            className={`flex flex-col items-center gap-1 relative transition-all cursor-pointer ${
              portalTab === 'bills' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px]">Bills</span>
            {(hasPendingProof || unpaidInvoices.length > 0) && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-slate-900 animate-pulse" />
            )}
          </button>

          {/* Center Floating Express Pay Action Button */}
          <button
            type="button"
            onClick={() => setIsExpressPayOpen(true)}
            className="flex flex-col items-center -mt-5 transition-all cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/30 group-active:scale-95 transition-transform">
              <div className="w-full h-full bg-slate-950/20 rounded-[14px] flex items-center justify-center text-white">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-400 mt-0.5">Pay Now</span>
          </button>

          {/* Support */}
          <button
            type="button"
            onClick={() => setPortalTab('support')}
            className={`flex flex-col items-center gap-1 relative transition-all cursor-pointer ${
              portalTab === 'support' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-5 h-5" />
            <span className="text-[10px]">Support</span>
            {customerTickets.some((t) => t.status === 'open' || t.status === 'in_progress') && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-slate-900" />
            )}
          </button>

          {/* More Drawer */}
          <button
            type="button"
            onClick={() => setIsMobileMoreOpen(true)}
            className={`flex flex-col items-center gap-1 relative transition-all cursor-pointer ${
              isMobileMoreOpen || ['receipts', 'notifications', 'speedtest', 'upgrade'].includes(portalTab)
                ? 'text-cyan-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px]">More</span>
            {recentRemindersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-slate-900" />
            )}
          </button>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* EXPRESS PAY BOTTOM SHEET / DRAWER                                         */}
      {/* ========================================================================= */}
      {isExpressPayOpen && customer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in p-0 sm:p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsExpressPayOpen(false)}
          />
          <div className="relative w-full sm:max-w-lg bg-slate-900 border-t sm:border border-slate-700/80 rounded-t-[28px] sm:rounded-3xl shadow-2xl z-10 max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-8">
            {/* Grab Handle & Header */}
            <div className="pt-3 pb-2.5 px-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                    <span>Express Pay</span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/40">
                      QR Ph Instant
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400">Instant Settlement for {customer.accountNo}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExpressPayOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto p-5 space-y-4 text-xs">
              {/* Channel Selector */}
              <div className="flex rounded-2xl bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayMethod('gcash')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    payMethod === 'gcash'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>GCash QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod('maya')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    payMethod === 'maya'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Maya QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsExpressPayOpen(false);
                    setPortalTab('pay');
                    setPayMethod('xendit');
                  }}
                  className="flex-1 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 text-slate-400 hover:text-cyan-300 hover:bg-slate-900 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Xendit</span>
                </button>
              </div>

              {/* Amount Quick Selector */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400 font-medium">Payment Amount:</span>
                  <span className="font-mono font-bold text-cyan-300 text-sm">
                    ₱{Number(payAmount || (customer.balance > 0 ? customer.balance : customer.monthlyFee)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {customer.balance > 0 && (
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(customer.balance))}
                      className={`py-1.5 px-2 rounded-xl font-bold border transition-all text-[11px] cursor-pointer ${
                        payAmount === String(customer.balance)
                          ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      Due: {formatCurrency(customer.balance)}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPayAmount(String(customer.monthlyFee))}
                    className={`py-1.5 px-2 rounded-xl font-bold border transition-all text-[11px] cursor-pointer ${
                      payAmount === String(customer.monthlyFee)
                        ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500/50'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    1 Mo: {formatCurrency(customer.monthlyFee)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayAmount(String(customer.monthlyFee * 2))}
                    className={`py-1.5 px-2 rounded-xl font-bold border transition-all text-[11px] cursor-pointer ${
                      payAmount === String(customer.monthlyFee * 2)
                        ? 'bg-purple-600/20 text-purple-300 border-purple-500/50'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    2 Mos: {formatCurrency(customer.monthlyFee * 2)}
                  </button>
                </div>
              </div>

              {/* Dynamic QR Ph Code Render */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center space-y-3">
                <div className="p-2.5 bg-white rounded-2xl shadow-md">
                  <QRCodeSVG
                    id="express-pay-qr-svg"
                    value={generateDynamicQrPhPayload({
                      merchantName: businessProfile.tradeName || 'SWIFTSTREAM TELECOM',
                      merchantCity: businessProfile.address.city || 'LAGONOY',
                      accountNumber: customer.accountNo,
                      amount: Number(payAmount) || (customer.balance > 0 ? customer.balance : customer.monthlyFee),
                      invoiceNumber: latestUnpaidInvoice?.invoiceNumber || 'BILL-2026',
                      mobileNumber: (payMethod === 'maya' ? businessProfile.paymentGateways.mayaNumber : businessProfile.paymentGateways.gcashNumber) || '09624171684',
                      serviceProvider: payMethod === 'gcash' ? 'gcash' : payMethod === 'maya' ? 'maya' : 'qrph_national',
                    })}
                    size={160}
                    level="M"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const svg = document.getElementById('express-pay-qr-svg');
                      if (svg) {
                        const svgData = new XMLSerializer().serializeToString(svg);
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const img = new Image();
                        img.onload = () => {
                          canvas.width = img.width || 200;
                          canvas.height = img.height || 200;
                          ctx?.drawImage(img, 0, 0);
                          const pngFile = canvas.toDataURL('image/png');
                          const downloadLink = document.createElement('a');
                          downloadLink.download = `SwiftStream_QR_${customer.accountNo}.png`;
                          downloadLink.href = pngFile;
                          downloadLink.click();
                        };
                        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Download QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        (payMethod === 'maya'
                          ? businessProfile.paymentGateways.mayaNumber
                          : businessProfile.paymentGateways.gcashNumber) || '09624171684',
                        'express_num'
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                  >
                    {copiedField === 'express_num' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>{copiedField === 'express_num' ? 'Copied Number' : 'Copy Number'}</span>
                  </button>
                </div>
              </div>

              {/* Reference Number & Receipt Upload */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Enter GCash / Maya Reference Number:
                  </label>
                  <input
                    type="text"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    placeholder="e.g. 100982347891"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Attach Payment Receipt Screenshot:
                  </label>
                  {receiptImageBase64 ? (
                    <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={receiptImageBase64}
                          alt="Receipt"
                          className="w-12 h-12 object-cover rounded-xl border border-slate-700 shrink-0"
                        />
                        <div className="text-xs">
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Screenshot Attached
                          </span>
                          <span className="text-[10px] text-slate-400 block">Ready for verification</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReceiptImageBase64(null)}
                        className="text-xs text-rose-400 hover:text-rose-300 font-semibold p-1 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 border-dashed border-slate-800 hover:border-cyan-500/50 bg-slate-950/60 cursor-pointer transition-colors group">
                      <Upload className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 mb-1" />
                      <span className="text-xs text-slate-300 font-semibold">Tap to select or snap photo of receipt</span>
                      <span className="text-[10px] text-slate-500">PNG, JPG up to 10MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const compressed = await compressImageFile(file, 1200, 0.82);
                              setReceiptImageBase64(compressed);
                            } catch {
                              const reader = new FileReader();
                              reader.onload = () => setReceiptImageBase64(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Instant AI Auto-Reconnection button if screenshot attached */}
                {receiptImageBase64 && (
                  <button
                    type="button"
                    disabled={isAiVerifying}
                    onClick={async () => {
                      await handleInstantAiSettlement();
                      setIsExpressPayOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-cyan-600 via-sky-500 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                  >
                    {isAiVerifying ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-cyan-200" />
                    )}
                    <span>{isAiVerifying ? 'Gemini AI Verifying...' : '⚡ Instant AI Auto-Verify & Reconnect (10s)'}</span>
                  </button>
                )}

                {/* Manual Submit Button */}
                <button
                  type="button"
                  disabled={isSubmittingPayment || !payReference.trim()}
                  onClick={async (e) => {
                    await handleConfirmOnlinePayment(e);
                    setIsExpressPayOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Proof for Cashier Audit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MOBILE MORE SHEET / DRAWER (Services & Tools)                             */}
      {/* ========================================================================= */}
      {isMobileMoreOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in p-0 sm:p-4">
          <div
            className="fixed inset-0"
            onClick={() => setIsMobileMoreOpen(false)}
          />
          <div className="relative w-full sm:max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-[28px] sm:rounded-3xl shadow-2xl z-10 p-5 space-y-4 animate-in slide-in-from-bottom-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Subscriber Services & Tools</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setPortalTab('speedtest');
                  setIsMobileMoreOpen(false);
                }}
                className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-cyan-500/50 flex flex-col items-center gap-2 text-center transition-all cursor-pointer active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-100">Speed Test</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Live fiber bandwidth test</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPortalTab('upgrade');
                  setIsMobileMoreOpen(false);
                }}
                className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-purple-500/50 flex flex-col items-center gap-2 text-center transition-all cursor-pointer active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
                  <Wifi className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-100">WiFi & Upgrade</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">SSID & plan upgrades</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPortalTab('receipts');
                  setIsMobileMoreOpen(false);
                }}
                className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/50 flex flex-col items-center gap-2 text-center transition-all cursor-pointer active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-100">Official Receipts</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{customerPayments.length} Issued Receipts</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPortalTab('notifications');
                  setIsMobileMoreOpen(false);
                }}
                className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-amber-500/50 flex flex-col items-center gap-2 text-center transition-all cursor-pointer active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center relative">
                  <Bell className="w-4 h-4" />
                  {recentRemindersCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-slate-100">Notifications</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">SMS & advisories</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setGuestWifiQrModal(true);
                  setIsMobileMoreOpen(false);
                }}
                className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-sky-500/50 flex flex-col items-center gap-2 text-center transition-all cursor-pointer active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-100">Guest WiFi QR</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Scan to connect guests</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPortalTab('pay');
                  setIsMobileMoreOpen(false);
                }}
                className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-teal-500/50 flex flex-col items-center gap-2 text-center transition-all cursor-pointer active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-100">Full Payment Hub</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Xendit, Cash, History</div>
                </div>
              </button>
            </div>

            {customer && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Account: <strong className="font-mono text-cyan-300">{customer.accountNo}</strong></span>
                <span>{customer.address.barangay}, Lagonoy</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GUEST WIFI QR MODAL                                                       */}
      {/* ========================================================================= */}
      {guestWifiQrModal && customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setGuestWifiQrModal(false)}
          />
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl z-10 p-6 space-y-4 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-left">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                  <Wifi className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Guest WiFi Connect</h3>
                  <p className="text-[10px] text-slate-400">Scan to join without typing password</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuestWifiQrModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl inline-block shadow-md mx-auto">
              <QRCodeSVG
                value={`WIFI:T:WPA;S:${customer.network.pppoeUsername || 'SwiftStream_Fiber'};P:swift1234;;`}
                size={180}
                level="M"
              />
            </div>

            <div className="space-y-1.5 text-xs text-left bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">WiFi SSID:</span>
                <span className="font-mono font-bold text-slate-200">
                  {customer.network.pppoeUsername || 'SwiftStream_Fiber'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Security:</span>
                <span className="font-semibold text-slate-300">WPA2 Personal</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setGuestWifiQrModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
