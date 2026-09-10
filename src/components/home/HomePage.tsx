import React, { useState, useMemo } from 'react';
import {
  Radio,
  Wifi,
  Zap,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Gauge,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Layers,
  Sparkles,
  Users,
  Search,
  X,
  Check,
  Copy,
  Globe,
  Lock,
  Menu,
  ChevronDown,
  ChevronUp,
  Sliders,
  Award,
  HelpCircle,
  Clock,
  Send,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { Plan, OnlineApplication } from '../../types';
import { saveFirestoreDoc, COLLECTIONS } from '../../services/firestoreService';
import { formatCurrency, formatPhoneNumber } from '../../utils/formatters';
import { GeminiAiAssistant } from '../ai/GeminiAiAssistant';
import { LAGONOY_BARANGAYS, PRESENTACION_BARANGAYS } from '../network/CoverageAreaManager';

interface HomePageProps {
  onOpenClientPortal: (customerId?: string) => void;
  onOpenAdminDashboard: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onOpenClientPortal,
  onOpenAdminDashboard,
}) => {
  const {
    plans,
    napBoxes,
    businessProfile,
    addCustomer,
    currentAuthUser,
    openAuthModal,
    logout,
    coverageAreas,
    showToast,
  } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [coverageFilter, setCoverageFilter] = useState<'all' | 'fiber_ready' | 'expansion'>('all');
  const [selectedCheckBarangay, setSelectedCheckBarangay] = useState<string>('');

  // Bandwidth Recommendation Calculator State
  const [deviceCount, setDeviceCount] = useState<number>(6);
  const [primaryActivity, setPrimaryActivity] = useState<'casual' | 'streaming' | 'gaming' | 'business'>('streaming');

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Sign Up Modal State
  interface SignUpSuccessData {
    accountNo: string;
    name: string;
    planName: string;
    speedMbps: number;
    monthlyFee: number;
    mobile: string;
    address: string;
    installDate: string;
  }
  const [showSignUpModal, setShowSignUpModal] = useState<boolean>(false);
  const [signUpPlanId, setSignUpPlanId] = useState<string>(plans[1]?.id || plans[0]?.id || '');
  const [applicantName, setApplicantName] = useState<string>('');
  const [applicantMobile, setApplicantMobile] = useState<string>('09');
  const [applicantEmail, setApplicantEmail] = useState<string>('');
  const [applicantInstallDate, setApplicantInstallDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [applicantStreet, setApplicantStreet] = useState<string>('');
  const [applicantBarangay, setApplicantBarangay] = useState<string>('Binauahan');
  const [applicantLandmark, setApplicantLandmark] = useState<string>('');
  const [signUpSuccessInfo, setSignUpSuccessInfo] = useState<SignUpSuccessData | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // List of coverage barangays for selection (grouped by Municipality)
  const lagonoyList = useMemo(() => {
    const fromCoverage = coverageAreas
      .filter((a) => !PRESENTACION_BARANGAYS.includes(a.barangay))
      .map((a) => a.barangay);
    return Array.from(new Set([...fromCoverage, ...LAGONOY_BARANGAYS])).filter(Boolean).sort();
  }, [coverageAreas]);

  const presentacionList = useMemo(() => {
    const fromCoverage = coverageAreas
      .filter((a) => PRESENTACION_BARANGAYS.includes(a.barangay))
      .map((a) => a.barangay);
    return Array.from(new Set([...fromCoverage, ...PRESENTACION_BARANGAYS])).filter(Boolean).sort();
  }, [coverageAreas]);

  const barangayList = useMemo(() => {
    return [...lagonoyList, ...presentacionList];
  }, [lagonoyList, presentacionList]);

  // Filter & sort plans: prioritize residential plans first, and sort by monthly fee ascending
  const filteredPlans = useMemo(() => {
    return plans
      .filter((p) => {
        if (!p.isActive && p.isActive !== undefined) return false;
        if (selectedCategory === 'all') return true;
        if (selectedCategory === 'residential') return p.category === 'residential';
        if (selectedCategory === 'business') return p.category === 'business' || p.category === 'enterprise';
        if (selectedCategory === 'piso_wifi') return p.category === 'piso_wifi';
        return true;
      })
      .sort((a, b) => {
        if (selectedCategory === 'all') {
          const aPriority = a.category === 'residential' ? 0 : 1;
          const bPriority = b.category === 'residential' ? 0 : 1;
          if (aPriority !== bPriority) return aPriority - bPriority;
        }
        return a.monthlyFee - b.monthlyFee;
      });
  }, [plans, selectedCategory]);

  const currentSelectedPlan = useMemo(() => {
    return plans.find((p) => p.id === signUpPlanId) || plans[0];
  }, [plans, signUpPlanId]);

  // Calculate Recommended Plan based on interactive calculator
  const getRecommendedPlan = () => {
    if (primaryActivity === 'business' || deviceCount > 15) {
      return plans.find((p) => p.speedMbps >= 100) || plans[plans.length - 1];
    }
    if (primaryActivity === 'gaming' || deviceCount > 8) {
      return plans.find((p) => p.speedMbps >= 50 && p.speedMbps < 100) || plans[1] || plans[0];
    }
    if (primaryActivity === 'streaming' || deviceCount >= 4) {
      return plans.find((p) => p.speedMbps >= 35) || plans[0];
    }
    return plans[0];
  };
  const recommendedPlan = getRecommendedPlan();

  const handleOpenSignUp = (planId?: string) => {
    if (planId) {
      setSignUpPlanId(planId);
    } else if (!signUpPlanId && plans.length > 0) {
      const popular = plans.find((p) => p.speedMbps === 50) || plans[0];
      setSignUpPlanId(popular.id);
    }
    setSignUpSuccessInfo(null);
    setIsCopied(false);
    setShowSignUpModal(true);
  };

  const handleCopyAccountNo = (accNo: string) => {
    navigator.clipboard.writeText(accNo);
    setIsCopied(true);
    showToast('info', 'Copied to Clipboard', `Reference #${accNo} copied.`);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName.trim() || !applicantMobile.trim() || !applicantStreet.trim()) {
      showToast('error', 'Missing Information', 'Please fill in your complete name, mobile number, and installation address.');
      return;
    }

    const selectedPlan = currentSelectedPlan || plans[0];
    const year = new Date().getFullYear();
    const generatedAccountNo = `SWIFT-${year}-${String(Math.floor(Math.random() * 900) + 100)}`;
    const randomIp = `192.168.10.${Math.floor(Math.random() * 200 + 20)}`;
    const assignedNap = napBoxes[0];

    const isPresentacion = PRESENTACION_BARANGAYS.some(
      (b) => b.toLowerCase() === applicantBarangay.toLowerCase()
    );
    const targetCity = isPresentacion ? 'Presentacion' : (businessProfile.address.city || 'Lagonoy');
    const targetProvince = businessProfile.address.province || 'Camarines Sur';

    // 1. Add customer to database
    addCustomer({
      accountNo: generatedAccountNo,
      fullName: applicantName.trim(),
      mobile: applicantMobile.trim(),
      email: applicantEmail.trim(),
      address: {
        street: applicantStreet.trim(),
        barangay: applicantBarangay.trim(),
        city: targetCity,
        province: targetProvince,
        landmark: applicantLandmark.trim(),
      },
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      monthlyFee: selectedPlan.monthlyFee,
      billingDay: 1,
      status: 'pending_install',
      installationDate: applicantInstallDate || new Date().toISOString().slice(0, 10),
      balance: 0,
      advanceDeposit: 0,
      network: {
        pppoeUsername: `swift_${generatedAccountNo.toLowerCase()}`,
        ipAddress: randomIp,
        napBoxId: assignedNap?.id || 'nap-01-binauahan',
        napPortNumber: 5,
        onuSerial: 'HWTC-NEWAPPLICANT',
        routerModel: 'Gigabit Dual-Band WiFi 6 ONU',
        vlanId: '100',
        oltPonPort: 'PON-1/1',
        isMikrotikSynced: false,
      },
      notes: `New online application submitted via SwiftStream Website (${targetCity}). Landmark: ${applicantLandmark || 'N/A'}. Preferred Install: ${applicantInstallDate}`,
    });

    // 2. Also log as an OnlineApplication in storage & Firestore
    const newApp: OnlineApplication = {
      id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      applicationNumber: generatedAccountNo,
      applicantName: applicantName.trim(),
      phone: applicantMobile.trim(),
      email: applicantEmail.trim(),
      address: applicantStreet.trim(),
      barangay: applicantBarangay.trim(),
      city: targetCity,
      province: targetProvince,
      landmark: applicantLandmark.trim(),
      preferredPlanId: selectedPlan.id,
      preferredPlanName: selectedPlan.name,
      preferredSpeedMbps: selectedPlan.speedMbps,
      monthlyFee: selectedPlan.monthlyFee,
      status: 'pending',
      notes: `Applied online via website (${targetCity}). Preferred date: ${applicantInstallDate || 'Earliest available'}`,
      surveyDate: applicantInstallDate,
      createdAt: new Date().toISOString(),
    };

    try {
      const existingAppsStr = localStorage.getItem('swiftstream_online_applications_v4');
      const existingApps: OnlineApplication[] = existingAppsStr ? JSON.parse(existingAppsStr) : [];
      localStorage.setItem('swiftstream_online_applications_v4', JSON.stringify([newApp, ...existingApps]));
      saveFirestoreDoc(COLLECTIONS.APPLICATIONS, newApp);
    } catch (_) {}

    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }

    setSignUpSuccessInfo({
      accountNo: generatedAccountNo,
      name: applicantName.trim(),
      planName: selectedPlan.name,
      speedMbps: selectedPlan.speedMbps,
      monthlyFee: selectedPlan.monthlyFee,
      mobile: applicantMobile.trim(),
      address: `${applicantStreet.trim()}, Brgy. ${applicantBarangay.trim()}, ${targetCity}`,
      installDate: applicantInstallDate || new Date().toISOString().slice(0, 10),
    });

    showToast(
      'success',
      'Application Submitted',
      `Your application for ${selectedPlan.name} has been received! Account #${generatedAccountNo}`
    );

    setApplicantName('');
    setApplicantMobile('09');
    setApplicantEmail('');
    setApplicantStreet('');
    setApplicantLandmark('');
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ISP FAQs
  const faqs = [
    {
      q: 'What are the basic requirements to apply for a fiber connection?',
      a: 'Applying is simple and 100% digital! You only need 1 valid government-issued ID (e.g., Driver’s License, UMID, Postal, or Barangay ID) and your complete installation address in Lagonoy. No complicated paperwork required.',
    },
    {
      q: 'How fast can my fiber line be installed?',
      a: 'Our field linemen are stationed locally in Lagonoy. Once your application is received, our team conducts a site line survey within 24 hours and completes modem provisioning and physical fiber line hookup within 24 to 48 hours.',
    },
    {
      q: 'Are the internet plans truly unlimited with no data capping?',
      a: 'Yes! All SwiftStream fiber plans feature 100% pure unlimited broadband with ZERO Fair Usage Policy (FUP) data caps. You can stream 4K movies, download large files, game, and attend online meetings all month without speed throttling.',
    },
    {
      q: 'Do I get a WiFi router with my installation?',
      a: 'Yes! Standard installations include a high-grade Gigabit Dual-Band (2.4GHz & 5GHz) Optical Network Unit (ONU) WiFi modem for strong wireless coverage throughout your home.',
    },
    {
      q: 'How can I pay my monthly subscription bill?',
      a: 'We support fast 24/7 online payments via GCash, Maya, BSP QR Ph national standard, direct bank transfers, and 7-Eleven CLiQQ. Payments generate instant Official Receipts (OR) in your subscriber portal.',
    },
    {
      q: 'What if I experience connection issues or optical line trouble?',
      a: 'Our operations center and field technicians are based in Lagonoy, Camarines Sur. You can file a trouble ticket in your Client Portal or call our local hotline for same-day on-site lineman dispatch.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white font-sans">
      {/* ================= 1. PUBLIC NAVBAR ================= */}
      <header className="h-20 bg-slate-950/90 border-b border-slate-800/80 px-4 sm:px-12 flex items-center justify-between sticky top-0 z-40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {businessProfile.logoUrl ? (
            <img
              src={businessProfile.logoUrl}
              alt={businessProfile.tradeName || businessProfile.name || 'Company Logo'}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-contain bg-slate-900 border border-slate-700/60 p-1 shadow-lg shadow-cyan-500/20 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 ring-1 ring-white/20 shrink-0">
              <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-pulse" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base sm:text-lg text-slate-100 tracking-tight">
                {businessProfile.tradeName || businessProfile.name || 'SwiftStream'}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-800/50">
                Fiber Internet
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
              {businessProfile.address.city}, {businessProfile.address.province} Node
            </p>
          </div>
        </div>

        {/* Center Nav Links (Desktop) */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-300">
          <button
            type="button"
            onClick={() => scrollToSection('plans')}
            className="hover:text-cyan-400 transition-colors cursor-pointer"
          >
            Fiber Plans & Rates
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('calculator')}
            className="hover:text-cyan-400 transition-colors cursor-pointer"
          >
            Speed Matcher
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('why-us')}
            className="hover:text-cyan-400 transition-colors cursor-pointer"
          >
            Why SwiftStream
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('coverage')}
            className="hover:text-cyan-400 transition-colors cursor-pointer"
          >
            Coverage Area
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('faq')}
            className="hover:text-cyan-400 transition-colors cursor-pointer"
          >
            FAQ
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('contact')}
            className="hover:text-cyan-400 transition-colors cursor-pointer"
          >
            Contact
          </button>
        </nav>

        {/* Right CTA Actions & Mobile Hamburger */}
        <div className="flex items-center gap-2 sm:gap-3">
          {currentAuthUser && currentAuthUser.role === 'subscriber' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenClientPortal()}
                className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-600/20 cursor-pointer"
              >
                <span>My Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={logout}
                className="p-2 text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer"
                title="Sign Out"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => openAuthModal('signin')}
                className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sign In</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenSignUp()}
                className="hidden xs:flex sm:flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Apply Online</span>
              </button>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="lg:hidden p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {isMobileNavOpen ? <X className="w-5 h-5 text-cyan-400" /> : <Menu className="w-5 h-5 text-cyan-400" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Dropdown Drawer */}
      {isMobileNavOpen && (
        <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-6 py-4 space-y-2 animate-in slide-in-from-top duration-200 sticky top-20 z-30 shadow-2xl">
          {[
            { id: 'plans', label: 'Fiber Plans & Rates' },
            { id: 'calculator', label: 'Speed Matcher Calculator' },
            { id: 'why-us', label: `Why ${businessProfile.tradeName || businessProfile.name || 'SwiftStream'} Fiber` },
            { id: 'coverage', label: 'Barangay Coverage Area' },
            { id: 'faq', label: 'Frequently Asked Questions' },
            { id: 'contact', label: 'Contact Helpline' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                scrollToSection(item.id);
                setIsMobileNavOpen(false);
              }}
              className="w-full text-left py-2.5 px-3 rounded-xl text-xs font-semibold text-slate-300 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors flex items-center justify-between"
            >
              <span>{item.label}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          ))}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setIsMobileNavOpen(false);
                handleOpenSignUp();
              }}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-xs font-bold text-center shadow-lg shadow-cyan-600/20 cursor-pointer"
            >
              ⚡ Apply for Fiber Connection
            </button>
          </div>
        </div>
      )}

      {/* ================= 2. HERO SECTION ================= */}
      <section className="relative overflow-hidden pt-12 pb-20 px-6 sm:px-12 max-w-7xl mx-auto">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-600/20 via-blue-600/15 to-purple-600/10 blur-3xl pointer-events-none -z-10 rounded-full" />

        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-950/80 to-blue-950/80 text-cyan-300 border border-cyan-800/60 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Pure End-to-End Gigabit Fiber Internet in Lagonoy, Camarines Sur</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-100 tracking-tight leading-[1.1]">
            Ultra-Fast Fiber.<br />
            <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
              Zero Lag. Pure Reliability.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Experience unthrottled, unlimited optical broadband engineered for smooth 4K streaming, low-latency online gaming, work-from-home video conferences, and seamless family connectivity.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <button
              type="button"
              onClick={() => handleOpenSignUp()}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-cyan-600 via-sky-500 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl text-sm font-bold shadow-xl shadow-cyan-600/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Apply for Connection Online</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('plans')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 hover:border-cyan-500/50 rounded-2xl text-sm font-bold transition-all hover:scale-105 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Explore Fiber Plans & Rates</span>
            </button>
          </div>

          {/* Key Value Badges Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 max-w-4xl mx-auto">
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
              <span className="font-mono font-black text-cyan-400 text-base sm:text-lg block">99.9%</span>
              <span className="text-[11px] text-slate-400">Fiber Uptime SLA</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
              <span className="font-mono font-black text-emerald-400 text-base sm:text-lg block">&lt; 10 ms</span>
              <span className="text-[11px] text-slate-400">Ultra-Low Gaming Ping</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
              <span className="font-mono font-black text-purple-400 text-base sm:text-lg block">Unlimited</span>
              <span className="text-[11px] text-slate-400">No FUP Data Capping</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
              <span className="font-mono font-black text-amber-400 text-base sm:text-lg block">24 - 48h</span>
              <span className="text-[11px] text-slate-400">Fast Local Installation</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 3. PLANS & PACKAGES SECTION ================= */}
      <section id="plans" className="py-16 px-6 sm:px-12 bg-slate-900/40 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
              Transparent Pricing • No Hidden Charges
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">
              High-Speed Fiber Plans for Every Budget
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              All plans include free optical line installation, a high-performance Dual-Band Gigabit ONU WiFi modem, and zero data caps.
            </p>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {[
                { id: 'all', label: 'All Plans' },
                { id: 'residential', label: 'Residential Homes' },
                { id: 'business', label: 'Commercial & WFH' },
                { id: 'piso_wifi', label: 'Piso-WiFi Feeders' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    selectedCategory === tab.id
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                      : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredPlans.map((plan, idx) => {
              const isPopular = idx === 1 || plan.speedMbps === 50;
              return (
                <div
                  key={plan.id}
                  className={`relative p-6 sm:p-8 rounded-3xl flex flex-col justify-between transition-all hover:scale-[1.02] duration-300 ${
                    isPopular
                      ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-cyan-950/40 border-2 border-cyan-500/80 shadow-2xl shadow-cyan-950/40'
                      : 'bg-slate-900/80 border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                      Most Popular Family Choice
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                        {plan.category.toUpperCase()} PACKAGE
                      </span>
                      <h3 className="text-xl font-bold text-slate-100 mt-0.5">{plan.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">{plan.description}</p>
                    </div>

                    {/* Speed Badge */}
                    <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-cyan-400" />
                        <span className="font-mono text-2xl font-black text-cyan-400">
                          {plan.speedMbps}
                        </span>
                        <span className="text-xs text-slate-400 font-bold">Mbps</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/50">
                        Synchronous
                      </span>
                    </div>

                    {/* Price */}
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black font-mono text-slate-100">
                          {formatCurrency(plan.monthlyFee)}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">/ month</span>
                      </div>
                      <span className="text-[10px] text-slate-500">VAT inclusive • 24-mo contract</span>
                    </div>

                    {/* Feature List */}
                    <div className="space-y-2.5 pt-2 text-xs">
                      {plan.features.map((feat, fidx) => (
                        <div key={fidx} className="flex items-center gap-2.5 text-slate-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-800/80 mt-6">
                    <button
                      type="button"
                      onClick={() => handleOpenSignUp(plan.id)}
                      className={`w-full py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                        isPopular
                          ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/25'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      <span>Apply for {plan.name}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= 4. SPEED MATCHER CALCULATOR ================= */}
      <section id="calculator" className="py-16 px-6 sm:px-12 max-w-5xl mx-auto">
        <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 shadow-2xl space-y-8">
          <div className="text-center space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Interactive Fiber Speed Matcher</span>
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
              Not sure which plan is right for your home?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              Select the number of active smartphones, laptops, and smart TVs in your household to find the perfect speed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left Controls */}
            <div className="space-y-6">
              {/* Slider: Device Count */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-slate-200 text-xs">
                    Connected Devices at Peak Hours:
                  </label>
                  <span className="font-mono font-bold text-cyan-400 text-sm bg-cyan-950 px-2.5 py-0.5 rounded-lg border border-cyan-800/50">
                    {deviceCount} {deviceCount === 1 ? 'Device' : 'Devices'}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={deviceCount}
                  onChange={(e) => setDeviceCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>1 Device</span>
                  <span>10 Devices</span>
                  <span>20+ Devices</span>
                </div>
              </div>

              {/* Activity Selector */}
              <div className="space-y-2">
                <label className="font-bold text-slate-200 text-xs block">
                  Primary Online Activity:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'casual', label: '📱 Social & Web', desc: 'Browsing, Facebook & Chat' },
                    { id: 'streaming', label: '🎬 4K Movies & Work', desc: 'Netflix, YouTube & Zoom' },
                    { id: 'gaming', label: '🎮 Low-Ping Gaming', desc: 'ML, Valorant, Roblox' },
                    { id: 'business', label: '💼 Enterprise & Shop', desc: 'Piso-WiFi & Commercial' },
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setPrimaryActivity(act.id as any)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        primaryActivity === act.id
                          ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="font-bold text-xs block text-slate-200">{act.label}</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{act.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Recommended Box */}
            <div className="p-6 rounded-3xl bg-slate-950 border-2 border-cyan-500/60 shadow-xl space-y-4 text-center sm:text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-800/40">
                  Recommended For You
                </span>
                <Sparkles className="w-4 h-4 text-cyan-400 animate-bounce" />
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-100">{recommendedPlan?.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{recommendedPlan?.description}</p>
              </div>

              <div className="flex items-baseline justify-center sm:justify-start gap-2 pt-1">
                <span className="font-mono text-3xl font-black text-cyan-400">
                  {recommendedPlan?.speedMbps} Mbps
                </span>
                <span className="text-slate-400 text-sm font-semibold">
                  @ {formatCurrency(recommendedPlan?.monthlyFee || 1299)}/mo
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleOpenSignUp(recommendedPlan?.id)}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-600/25 transition-all hover:scale-[1.02] cursor-pointer"
              >
                Apply for {recommendedPlan?.name} &rarr;
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 5. WHY CHOOSE SWIFTSTREAM (VALUE PROPS) ================= */}
      <section id="why-us" className="py-16 px-6 sm:px-12 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
            The {businessProfile.tradeName || businessProfile.name || 'SwiftStream'} Advantage
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">
            Why Lagonoy Families & Businesses Choose Us
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            We operate our own dedicated optical distribution plant in Camarines Sur, engineered for maximum reliability and storm resilience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-cyan-500/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center font-bold">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-100">100% Pure Optical Fiber</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Direct fiber cable directly into your home. Unlike legacy wireless antennas or copper wires, fiber optics deliver zero attenuation and storm immunity.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-emerald-500/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold">
              <Gauge className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-100">Optimized Gaming Latency</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Low-hop routing to major game clusters (Singapore, Tokyo, Hong Kong) for flawless ping in Mobile Legends, Valorant, Dota 2, and Call of Duty.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-purple-500/40 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-100">Direct Local Support</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No robotic Manila call centers. Our certified network engineers and linemen live in Lagonoy and respond on-site in hours.
            </p>
          </div>
        </div>
      </section>

      {/* ================= 6. HOW IT WORKS (3 SIMPLE STEPS) ================= */}
      <section className="py-16 px-6 sm:px-12 bg-slate-900/30 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
              Simple 3-Step Process
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">
              How to Get Connected to Fiber
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Get your home connected to high-speed fiber internet in 3 easy steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-2xl bg-cyan-600 text-white font-black text-sm flex items-center justify-center shadow-lg shadow-cyan-600/30">
                1
              </div>
              <h3 className="font-bold text-base text-slate-100">1. Apply Online in 1 Minute</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose your desired speed tier, enter your installation address in Lagonoy, and submit your application.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shadow-lg shadow-emerald-600/30">
                2
              </div>
              <h3 className="font-bold text-base text-slate-100">2. Free Line Survey</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Our local engineering team verifies your nearest optical NAP box power levels (-18 dBm optimal) for crystal clear signal.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white font-black text-sm flex items-center justify-center shadow-lg shadow-purple-600/30">
                3
              </div>
              <h3 className="font-bold text-base text-slate-100">3. Hookup & Instant Online</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Linemen pull the optical drop wire, configure your Dual-Band Gigabit ONU WiFi router, and activate your high-speed line.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 7. COVERAGE AREA SECTION ================= */}
      <section id="coverage" className="py-16 px-6 sm:px-12 max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
            Barangay Coverage Checker
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">
            Check Fiber Internet in Your Barangay
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Select your barangay in Lagonoy or Presentacion from the dropdown below to check live fiber readiness and NAP box hookup availability:
          </p>
        </div>

        {/* ================= BARANGAY DROPDOWN CHECKER CARD ================= */}
        <div className="max-w-3xl mx-auto p-6 sm:p-8 rounded-3xl bg-slate-900/90 border-2 border-cyan-500/40 shadow-2xl shadow-cyan-950/30 space-y-6">
          <div className="space-y-2">
            <label className="block text-slate-200 font-bold text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-400" />
                <span>Select Your Barangay (Lagonoy & Presentacion, Camarines Sur):</span>
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">
                {lagonoyList.length + presentacionList.length} Barangays Monitored
              </span>
            </label>

            <div className="relative">
              <select
                value={selectedCheckBarangay}
                onChange={(e) => setSelectedCheckBarangay(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-950 border border-slate-700 hover:border-cyan-500 rounded-2xl text-slate-100 text-sm font-semibold focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-slate-400">
                  -- Select / Choose Your Barangay to Check Coverage --
                </option>
                <optgroup label="Municipality of Lagonoy">
                  {lagonoyList.map((bg) => {
                    const area = coverageAreas.find(
                      (a) => a.barangay.toLowerCase() === bg.toLowerCase()
                    );
                    const statusText = area?.status === 'fiber_ready'
                      ? '🟢 Fiber Ready (Instant Hookup)'
                      : (area?.status === 'expansion_ongoing' ? '🟡 Expansion in Progress' : '🟡 Expansion Ongoing');
                    return (
                      <option key={`lagonoy-${bg}`} value={bg} className="bg-slate-900 py-2">
                        Brgy. {bg} (Lagonoy) — {statusText}
                      </option>
                    );
                  })}
                </optgroup>
                <optgroup label="Municipality of Presentacion">
                  {presentacionList.map((bg) => {
                    const area = coverageAreas.find(
                      (a) => a.barangay.toLowerCase() === bg.toLowerCase()
                    );
                    const statusText = area?.status === 'fiber_ready'
                      ? '🟢 Fiber Ready (Instant Hookup)'
                      : (area?.status === 'expansion_ongoing' ? '🟡 Expansion in Progress' : '🟡 Expansion Ongoing');
                    return (
                      <option key={`presentacion-${bg}`} value={bg} className="bg-slate-900 py-2">
                        Brgy. {bg} (Presentacion) — {statusText}
                      </option>
                    );
                  })}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Prompt when no barangay is selected */}
          {!selectedCheckBarangay && (
            <div className="p-8 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2.5 animate-in fade-in">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <MapPin className="w-6 h-6 text-cyan-400/70" />
              </div>
              <h4 className="text-sm font-bold text-slate-200">
                Select your barangay from the dropdown above
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                We will instantly check if Gigabit fiber optic NAP distribution boxes are active in your area and ready for drop cable hookup.
              </p>
            </div>
          )}

          {/* Dynamic Result Card ONLY for the Selected Barangay */}
          {selectedCheckBarangay && (() => {
            const selectedArea = coverageAreas.find(
              (a) => a.barangay.toLowerCase() === selectedCheckBarangay.toLowerCase()
            );
            const isPresentacion = PRESENTACION_BARANGAYS.some(
              (b) => b.toLowerCase() === selectedCheckBarangay.toLowerCase()
            );
            const targetCity = isPresentacion ? 'Presentacion' : 'Lagonoy';
            const isFiberReady = selectedArea?.status === 'fiber_ready';
            const displayName = selectedArea?.name || `Brgy. ${selectedCheckBarangay} (${targetCity})`;

            return (
              <div
                className={`p-5 sm:p-6 rounded-2xl border transition-all animate-in fade-in space-y-4 ${
                  isFiberReady
                    ? 'bg-emerald-950/40 border-emerald-500/50 shadow-inner'
                    : 'bg-amber-950/40 border-amber-500/50 shadow-inner'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-100">{displayName}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isFiberReady
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-amber-500 text-slate-950'
                        }`}
                      >
                        {isFiberReady ? '🟢 Fiber Ready' : '🟡 Expansion Ongoing'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      {selectedArea?.description ||
                        `Optical feeder line and distribution network deployed in ${selectedCheckBarangay}, ${targetCity}, Camarines Sur.`}
                    </p>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block font-mono">INSTALLATION TIME</span>
                    <span className="text-xs font-bold text-slate-200">
                      {isFiberReady ? '⚡ 24 - 48 Hours' : '⏳ Pre-Registration Open'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Gigabit Dual-Band Modem</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-cyan-400" />
                      <span>Unlimited Data</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setApplicantBarangay(selectedCheckBarangay);
                      handleOpenSignUp();
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    ⚡ Apply for Fiber in {selectedCheckBarangay} ({targetCity})
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ================= 8. FAQ ACCORDION SECTION ================= */}
      <section id="faq" className="py-16 px-6 sm:px-12 bg-slate-900/30 border-t border-slate-800/80">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
              Have Questions?
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Everything you need to know about our fiber plans, installation process, and monthly billing.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, fidx) => {
              const isOpen = openFaqIndex === fidx;
              return (
                <div
                  key={fidx}
                  className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : fidx)}
                    className="w-full p-4 sm:p-5 flex items-center justify-between text-left font-bold text-xs sm:text-sm text-slate-200 hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <HelpCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>{faq.q}</span>
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-cyan-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="p-5 pt-0 text-xs text-slate-400 leading-relaxed border-t border-slate-800/50 mt-1">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= 9. CONTACT & FOOTER ================= */}
      <footer id="contact" className="pt-16 pb-12 px-6 sm:px-12 bg-slate-950 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-slate-800/80 text-xs">
          {/* Col 1: Business Identity */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-3">
              {businessProfile.logoUrl ? (
                <img
                  src={businessProfile.logoUrl}
                  alt={businessProfile.tradeName || businessProfile.name || 'Company Logo'}
                  className="w-10 h-10 rounded-xl object-contain bg-slate-900 border border-slate-700/60 p-1 shrink-0 shadow-md"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shrink-0">
                  <Radio className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <h4 className="font-extrabold text-sm text-slate-100">{businessProfile.name}</h4>
                <p className="text-[10px] text-cyan-400">{businessProfile.tradeName}</p>
              </div>
            </div>

            <p className="text-slate-400 max-w-md leading-relaxed">
              Legitimate and registered telecommunications fiber internet provider in Lagonoy, Camarines Sur. Serving homes, schools, and commercial enterprises with uncompromised optical broadband.
            </p>

            <div className="pt-2 text-slate-400 space-y-1">
              <p>
                <strong className="text-slate-300">BIR Registered TIN:</strong> {businessProfile.tin}
              </p>
              <p>
                <strong className="text-slate-300">Authorized Representative:</strong> {businessProfile.representative.firstName} {businessProfile.representative.lastName}
              </p>
            </div>
          </div>

          {/* Col 2: Location */}
          <div className="space-y-3">
            <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
              Operations Node & Office
            </h5>
            <div className="space-y-1.5 text-slate-400">
              <p className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>
                  {businessProfile.address.building}, {businessProfile.address.street}, Brgy. {businessProfile.address.barangay}, {businessProfile.address.city}, {businessProfile.address.province}
                </span>
              </p>
              <p className="text-amber-400 font-medium pl-5">
                Landmark: {businessProfile.address.landmark}
              </p>
            </div>
          </div>

          {/* Col 3: Direct Contact */}
          <div className="space-y-3">
            <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
              Customer Helpline & Payments
            </h5>
            <div className="space-y-2 text-slate-400">
              <p className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono text-slate-200">{formatPhoneNumber(businessProfile.representative.mobile)}</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                <span>{businessProfile.representative.email}</span>
              </p>
              <div className="pt-2">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Supported Payment Channels:</span>
                <span className="text-slate-300 font-semibold">GCash • Maya • QR Ph • 7-Eleven</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {businessProfile.tradeName || businessProfile.name || 'SwiftStream Telecom'}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>High-Speed Fiber ISP</span>
            <span>•</span>
            <span>{businessProfile.address.city}, {businessProfile.address.province}</span>
          </div>
        </div>
      </footer>

      {/* ================= 10. ONLINE FIBER APPLICATION MODAL ================= */}
      {showSignUpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-cyan-950/40 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Zap className="w-5 h-5 fill-cyan-400/20" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                    <span>Apply for SwiftStream Fiber</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                      Digital Signup
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Fast 1-minute application • Free optical line installation promo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSignUpModal(false);
                  setSignUpSuccessInfo(null);
                }}
                className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {signUpSuccessInfo ? (
              /* Success State */
              <div className="p-6 sm:p-8 space-y-6">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <h4 className="text-xl font-black text-slate-100">
                    Application Received Successfully!
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                    Mabuhay, <strong className="text-cyan-300">{signUpSuccessInfo.name}</strong>! Your fiber connection request has been recorded into our dispatch queue.
                  </p>
                </div>

                {/* Account & Details Box */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3.5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Assigned Account / Application #
                      </span>
                      <div className="text-base sm:text-lg font-black font-mono text-cyan-300">
                        {signUpSuccessInfo.accountNo}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyAccountNo(signUpSuccessInfo.accountNo)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Selected Package:</span>
                      <strong className="text-slate-100 font-bold">
                        {signUpSuccessInfo.planName} ({signUpSuccessInfo.speedMbps} Mbps)
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Monthly Subscription:</span>
                      <strong className="text-emerald-400 font-mono font-bold">
                        {formatCurrency(signUpSuccessInfo.monthlyFee)} / mo
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Installation Address:</span>
                      <span className="text-slate-200">{signUpSuccessInfo.address}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Target Installation:</span>
                      <span className="text-cyan-300 font-semibold">{signUpSuccessInfo.installDate}</span>
                    </div>
                  </div>
                </div>

                {/* What Happens Next */}
                <div className="space-y-2.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    What happens next:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
                      <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> 1. Line Check
                      </div>
                      <p className="text-[11px] text-slate-400">
                        We map the closest NAP distribution box to check optical drop wire distance.
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
                      <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" /> 2. Call Dispatch
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Our lineman calls <span className="font-mono text-slate-200">{signUpSuccessInfo.mobile}</span> to confirm arrival time.
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-1">
                      <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> 3. Hookup & WiFi
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Modem setup, fiber splice test, and connection handover at your home.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Success Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignUpModal(false);
                      setSignUpSuccessInfo(null);
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Done & Return to Website
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSignUpModal(false);
                      setSignUpSuccessInfo(null);
                      onOpenClientPortal(signUpSuccessInfo.accountNo);
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-600/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>View Client Portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* Application Form */
              <form onSubmit={handleSignUpSubmit} className="p-6 sm:p-8 space-y-5">
                {/* Selected Plan Display & Selector */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-cyan-950/30 border border-cyan-500/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">
                        Selected Fiber Package
                      </span>
                      <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                        {currentSelectedPlan?.name || 'Selected Plan'}
                        <span className="text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800">
                          {currentSelectedPlan?.speedMbps || 50} Mbps
                        </span>
                      </h4>
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="text-lg font-black font-mono text-slate-100">
                        {formatCurrency(currentSelectedPlan?.monthlyFee || 1299)}
                        <span className="text-xs text-slate-400 font-normal"> / month</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold block">
                        FREE Installation Promo Included
                      </span>
                    </div>
                  </div>

                  {/* Switch Plan Dropdown */}
                  <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                      Change Plan:
                    </label>
                    <select
                      value={signUpPlanId}
                      onChange={(e) => setSignUpPlanId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 hover:border-cyan-500 rounded-xl text-slate-200 text-xs font-semibold focus:outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      {plans
                        .filter((p) => p.isActive !== false)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.speedMbps} Mbps) — {formatCurrency(p.monthlyFee)}/mo
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Form Fields: Personal Info */}
                <div className="space-y-3.5">
                  <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Applicant Information</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Full Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Juan Dela Cruz"
                        value={applicantName}
                        onChange={(e) => setApplicantName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-medium focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Mobile Number <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="0917 123 4567"
                        value={applicantMobile}
                        onChange={(e) => setApplicantMobile(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-mono font-medium focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Email Address <span className="text-slate-500 font-normal">(For e-Receipts & Billing Notices)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. juan@gmail.com (Optional)"
                      value={applicantEmail}
                      onChange={(e) => setApplicantEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-medium focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
                    />
                  </div>
                </div>

                {/* Form Fields: Installation Address & Schedule */}
                <div className="space-y-3.5 pt-2 border-t border-slate-800/80">
                  <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    <span>Installation Address & Schedule (Lagonoy & Presentacion)</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Street / Purok / House # <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Purok 2, Main St."
                        value={applicantStreet}
                        onChange={(e) => setApplicantStreet(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-medium focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Barangay <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={applicantBarangay}
                        onChange={(e) => setApplicantBarangay(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-medium focus:outline-none focus:border-cyan-400 cursor-pointer"
                      >
                        <optgroup label="Municipality of Lagonoy">
                          {lagonoyList.map((bg) => (
                            <option key={`modal-lagonoy-${bg}`} value={bg}>
                              {bg}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Municipality of Presentacion">
                          {presentacionList.map((bg) => (
                            <option key={`modal-presentacion-${bg}`} value={bg}>
                              {bg}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Nearby Landmark
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. In front of Elementary School / Yellow gate"
                        value={applicantLandmark}
                        onChange={(e) => setApplicantLandmark(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-medium focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Preferred Installation Date
                      </label>
                      <input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        value={applicantInstallDate}
                        onChange={(e) => setApplicantInstallDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-medium focus:outline-none focus:border-cyan-400 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Trust Guarantee note */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    No upfront payment required today. You only pay after your fiber line is spliced, tested, and active.
                  </span>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowSignUpModal(false)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-600 via-sky-500 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-600/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>Submit Fiber Application</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 24/7 Gemini AI Assistant for Sales Inquiries */}
      <GeminiAiAssistant mode="client" />
    </div>
  );
};
