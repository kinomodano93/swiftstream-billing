import React, { useState, useEffect } from 'react';
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
  Activity,
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
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { Customer, Invoice, Payment, PaymentMethod, RepairOrder } from '../../types';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPhoneNumber,
  getCustomerStatusBadge,
  getInvoiceStatusBadge,
  getPaymentMethodLabel,
  getRepairStatusBadge,
} from '../../utils/formatters';
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
    processIncomingPaymentWebhook,
    submitPaymentProof,
    addRepairOrder,
    logout,
    currentAuthUser,
  } = useApp();

  // Selected Subscriber State (Session)
  const [currentCustomerId, setCurrentCustomerId] = useState<string | null>(
    initialCustomerId || null
  );
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
    'overview' | 'bills' | 'pay' | 'receipts' | 'support' | 'speedtest' | 'upgrade'
  >('overview');

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
  const customerPlan = customer
    ? plans.find((p) => p.id === customer.planId)
    : null;

  // Unpaid invoices for this subscriber
  const unpaidInvoices = customerInvoices.filter((i) => i.status !== 'paid');
  const latestUnpaidInvoice = unpaidInvoices[0];
  const selectedPayInvoice = customerInvoices.find((i) => i.id === payInvoiceId);

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

    const matched = customers.find(
      (c) =>
        c.accountNo.toLowerCase() === cleanInput ||
        c.mobile.replace(/[^0-9]/g, '') === cleanInput.replace(/[^0-9]/g, '') ||
        c.fullName.toLowerCase().includes(cleanInput)
    );

    if (matched) {
      setCurrentCustomerId(matched.id);
      setLoginInput('');
    } else {
      setLoginError(
        'Subscriber not found. Please enter your Account Number (e.g. SWIFT-2026-001) or Registered Mobile Number.'
      );
    }
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
      status: 'received',
      dateReceived: new Date().toISOString().slice(0, 10),
      isPaid: false,
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
      status: 'received',
      dateReceived: new Date().toISOString().slice(0, 10),
      isPaid: false,
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
      issueDescription: `PLAN UPGRADE REQUEST: Upgrade from ${customer.planName} (${customerPlan?.speedMbps || 50} Mbps @ ${formatCurrency(customer.monthlyFee)}) to ${targetPlan.name} (${targetPlan.speedMbps} Mbps @ ${formatCurrency(targetPlan.monthlyFee)}). Monthly fee difference: +${formatCurrency(diff)}/mo.`,
      diagnosisNotes: `Requested via Customer Portal. Target speed: ${targetPlan.speedMbps} Mbps. Pending Mikrotik profile rate-limit adjustment.`,
      technician: 'NOC Network Admin (Lagonoy)',
      partsUsed: [],
      laborCost: 0,
      totalCost: 0,
      status: 'received',
      dateReceived: new Date().toISOString().slice(0, 10),
      isPaid: false,
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
      status: 'received',
      dateReceived: new Date().toISOString().slice(0, 10),
      isPaid: false,
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

    const targetMax = customerPlan ? customerPlan.speedMbps : 50;

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
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Radio className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <h1 className="font-black text-sm text-slate-100 tracking-tight flex items-center gap-1.5">
                  <span>SwiftStream</span>
                  <span className="text-[10px] bg-cyan-950 text-cyan-400 font-mono px-2 py-0.5 rounded-full border border-cyan-800/60 font-normal">
                    PORTAL
                  </span>
                </h1>
                <p className="text-[10px] text-slate-400">
                  Fiber Subscriber Self-Service Hub
                </p>
              </div>
            </div>

            <button
              onClick={onExitToHome}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Return to Home Page</span>
            </button>
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
                <span className="text-[10px] text-slate-400">{customer.planName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
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
      {customer.balance > 0 ? (
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
              onClick={() => setPortalTab('pay')}
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

      {/* Centered Segmented Navigation Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/70 px-4 sm:px-6 sticky top-16 z-20 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex justify-center items-center overflow-x-auto py-2 scrollbar-none">
          <div className="flex space-x-1 sm:space-x-2 text-xs">
            {[
              { id: 'overview', label: 'Subscription Overview', icon: Wifi },
              {
                id: 'bills',
                label: 'Statements (Bills)',
                icon: FileText,
                badge: unpaidInvoices.length > 0 ? `${unpaidInvoices.length} Due` : null,
                badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
              },
              { id: 'pay', label: 'Pay Online', icon: CreditCard },
              {
                id: 'receipts',
                label: 'Official Receipts',
                icon: CheckCircle2,
                badge: customerPayments.length > 0 ? `${customerPayments.length}` : null,
                badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
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

      {/* Centered Main Content Container */}
      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* ================= TAB 1: OVERVIEW ================= */}
        {portalTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Internet Package */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-4 hover:border-slate-700 transition-all text-center sm:text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    My Internet Plan
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 font-mono font-bold text-xs border border-cyan-800/40 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-cyan-400" />
                    <span>{customerPlan?.speedMbps || 50} Mbps</span>
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-100">{customer.planName}</h3>
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

              {/* Card 2: Billing & Outstanding */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-4 flex flex-col justify-between hover:border-slate-700 transition-all text-center sm:text-left">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Current Ledger Balance
                    </span>
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                  </div>

                  <h3
                    className={`text-2xl font-black font-mono mt-2 ${
                      customer.balance > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {formatCurrency(customer.balance)}
                  </h3>

                  <p className="text-xs text-slate-400 mt-1">
                    {customer.balance > 0
                      ? 'Payment due to maintain continuous internet service.'
                      : 'Your account is in good standing! No balance due.'}
                  </p>
                </div>

                <button
                  onClick={() => setPortalTab('pay')}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>{customer.balance > 0 ? 'Pay Online Now (GCash/Maya)' : 'Make Advance Payment'}</span>
                </button>
              </div>

              {/* Card 3: Line & Network Status */}
              <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-4 hover:border-slate-700 transition-all text-center sm:text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Network Line Health
                  </span>
                  <Activity className="w-4 h-4 text-cyan-400" />
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-500">Fiber Line Status:</span>
                    <span
                      className={`font-semibold ${
                        customer.network.isMikrotikSynced ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {customer.network.isMikrotikSynced ? '● Active & Online' : '● Disconnected'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-500">Optical Signal:</span>
                    <span className="font-mono text-emerald-400 font-semibold">-18.5 dBm (Optimal)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-500">PPPoE User:</span>
                    <span className="font-mono text-cyan-400">{customer.network.pppoeUsername}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Assigned IP:</span>
                    <span className="font-mono text-slate-300">{customer.network.ipAddress}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  id: 'pay',
                  title: 'Pay Bill Online',
                  desc: 'GCash / Maya QR',
                  icon: CreditCard,
                  color: 'text-emerald-400 bg-emerald-600/20 border-emerald-500/30',
                },
                {
                  id: 'speedtest',
                  title: 'Speed Test',
                  desc: 'Check live bandwidth',
                  icon: Gauge,
                  color: 'text-cyan-400 bg-cyan-600/20 border-cyan-500/30',
                },
                {
                  id: 'upgrade',
                  title: 'WiFi & Upgrade',
                  desc: 'Change SSID & password',
                  icon: Wifi,
                  color: 'text-purple-400 bg-purple-600/20 border-purple-500/30',
                },
                {
                  id: 'support',
                  title: 'Report Trouble',
                  desc: 'Fast repair dispatch',
                  icon: Wrench,
                  color: 'text-amber-400 bg-amber-600/20 border-amber-500/30',
                },
              ].map((act) => {
                const Icon = act.icon;
                return (
                  <button
                    key={act.id}
                    onClick={() => setPortalTab(act.id as any)}
                    className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-950/20 text-center transition-all group flex flex-col items-center justify-between space-y-2 cursor-pointer shadow-sm"
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
                      const badge = getInvoiceStatusBadge(inv.status);
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
                                const pdf = generateInvoicePDF(inv, businessProfile);
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
                      {businessProfile.address.building}, Brgy. {businessProfile.address.barangay}, {businessProfile.address.city}, {businessProfile.address.province}
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
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-slate-100 flex items-center justify-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <span>Statements of Account (SOA)</span>
              </h2>
              <p className="text-xs text-slate-400">
                View itemized breakdown of monthly recurring subscription and download official PDF bills.
              </p>
            </div>

            {customerInvoices.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900/80 rounded-3xl border border-slate-800 text-xs">
                No billing statements found.
              </div>
            ) : (
              <div className="space-y-4">
                {customerInvoices.map((inv) => {
                  const badge = getInvoiceStatusBadge(inv.status);
                  return (
                    <div
                      key={inv.id}
                      className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-4"
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
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            Billing Period: <strong className="text-slate-200">{formatDate(inv.billingPeriodStart)} to {formatDate(inv.billingPeriodEnd)}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const pdf = generateInvoicePDF(inv, businessProfile);
                              pdf.save(`${inv.invoiceNumber}_${customer.accountNo}.pdf`);
                            }}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download PDF Bill</span>
                          </button>

                          {inv.balanceDue > 0 && (
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
                          )}
                        </div>
                      </div>

                      {/* Itemized Table */}
                      <div className="border border-slate-800 rounded-2xl overflow-hidden text-xs">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                              <th className="py-2.5 px-4">Item Description</th>
                              <th className="py-2.5 px-4 text-center">Qty</th>
                              <th className="py-2.5 px-4 text-right">Unit Rate</th>
                              <th className="py-2.5 px-4 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {inv.items.map((item, idx) => (
                              <tr key={item.id || idx}>
                                <td className="py-2.5 px-4 text-slate-200">{item.description}</td>
                                <td className="py-2.5 px-4 text-center text-slate-400">{item.quantity}</td>
                                <td className="py-2.5 px-4 text-right font-mono text-slate-300">{formatCurrency(item.unitPrice)}</td>
                                <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-100">{formatCurrency(item.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Calculations Summary */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 text-xs">
                        <div className="text-slate-400 space-y-0.5">
                          <p>Due Date: <strong className="text-rose-400">{formatDate(inv.dueDate)}</strong></p>
                          {inv.paidAt && (
                            <p className="text-emerald-400">
                              Paid on: {formatDateTime(inv.paidAt)} ({inv.paymentMethodUsed?.toUpperCase()})
                            </p>
                          )}
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
                Scan the official merchant QR code using your e-wallet app, enter your reference number, and receive your Official Receipt (OR) instantly.
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

                          <button
                            type="button"
                            onClick={() => handleSettlePaidXenditSession(activeXenditSession)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition-all hover:scale-105 flex items-center gap-1.5 cursor-pointer"
                            title="Simulate instant webhook settlement for testing without paying real money"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Simulate Instant Payment (Test)</span>
                          </button>
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
                        {businessProfile.address.building}, Brgy. {businessProfile.address.barangay}, {businessProfile.address.city}, {businessProfile.address.province}
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
                    <div className="bg-white p-4 rounded-3xl border-2 border-slate-700 flex-shrink-0 shadow-2xl flex flex-col items-center gap-2">
                      <div className="flex items-center gap-1.5 text-slate-900 font-bold text-[11px] tracking-wider uppercase border-b border-slate-200 pb-1 w-full justify-center">
                        <QrCode className="w-4 h-4 text-rose-600" />
                        <span>BSP QR Ph Dynamic</span>
                      </div>

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

                      <div className="text-center text-[10px] text-slate-600 font-mono font-bold">
                        ₱{(Number(payAmount) || (customer.balance > 0 ? customer.balance : customer.monthlyFee)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>

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

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmittingPayment}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Submit Payment Proof for Cashier Verification</span>
                      </button>
                    </div>

                    {submittedProofSuccess && (
                      <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 flex items-start gap-3 animate-in fade-in">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-xs">Payment Proof Submitted Successfully!</h4>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            Our cashier team has received your transaction reference. Once verified, your invoice will be marked as paid and you will receive an SMS confirmation.
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
                Download verified 80mm thermal PDF official receipts for your business or personal records.
              </p>
            </div>

            {customerPayments.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-slate-900/80 rounded-3xl border border-slate-800 text-xs">
                No payment transactions recorded yet.
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
                      <option value="Other">Other ISP or Shop Request</option>
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

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                            <span>Filed on: {formatDate(t.dateReceived)}</span>
                            <span className="text-slate-300">Tech: {t.technician}</span>
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
                Target Plan: <strong className="text-cyan-400">{customer.planName} ({customerPlan?.speedMbps || 50} Mbps Dedicated)</strong>
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
                  <p className="font-bold text-slate-200 text-sm">{customer.planName}</p>
                  <p className="text-cyan-400 font-mono font-semibold">
                    {customerPlan?.speedMbps || 50} Mbps Dedicated • {formatCurrency(customer.monthlyFee)}/mo
                  </p>
                </div>

                <form onSubmit={handleRequestPlanUpgrade} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Select Desired Target Plan</label>
                    <select
                      value={targetUpgradePlanId || (plans.find((p) => p.id !== customer.planId)?.id || '')}
                      onChange={(e) => setTargetUpgradePlanId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                    >
                      {plans
                        .filter((p) => p.id !== customer.planId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.speedMbps} Mbps) — {formatCurrency(p.monthlyFee)}/mo
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

      {/* 24/7 Gemini AI Client Support Agent */}
      <GeminiAiAssistant mode="client" activeCustomer={customer} />
    </div>
  );
};
