import React, { useState } from 'react';
import {
  Radio,
  Wifi,
  Zap,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Wrench,
  Gauge,
  MapPin,
  Phone,
  Mail,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Users,
  Search,
  X,
  Check,
  ExternalLink,
  Laptop,
  Cpu,
  Tv,
  Globe,
  Lock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { Plan } from '../../types';
import { formatCurrency, formatPhoneNumber } from '../../utils/formatters';
import { GeminiAiAssistant } from '../ai/GeminiAiAssistant';

interface HomePageProps {
  onOpenClientPortal: (customerId?: string) => void;
  onOpenAdminDashboard: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onOpenClientPortal,
  onOpenAdminDashboard,
}) => {
  const { plans, napBoxes, businessProfile, addCustomer, customers, currentAuthUser, openAuthModal, logout } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Sign Up Modal State
  const [showSignUpModal, setShowSignUpModal] = useState<boolean>(false);
  const [signUpPlanId, setSignUpPlanId] = useState<string>(plans[1]?.id || plans[0]?.id || '');
  const [applicantName, setApplicantName] = useState<string>('');
  const [applicantMobile, setApplicantMobile] = useState<string>('09');
  const [applicantEmail, setApplicantEmail] = useState<string>('');
  const [applicantStreet, setApplicantStreet] = useState<string>('');
  const [applicantBarangay, setApplicantBarangay] = useState<string>('Binauahan');
  const [applicantLandmark, setApplicantLandmark] = useState<string>('');
  const [signUpSuccessInfo, setSignUpSuccessInfo] = useState<{ accountNo: string; name: string } | null>(null);

  // Sign In Modal State
  const [showSignInModal, setShowSignInModal] = useState<boolean>(false);
  const [signInTab, setSignInTab] = useState<'subscriber' | 'admin'>('subscriber');
  const [signInInput, setSignInInput] = useState<string>('');
  const [signInError, setSignInError] = useState<string>('');

  // Filter plans
  const filteredPlans = plans.filter((p) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'residential') return p.category === 'residential';
    if (selectedCategory === 'business') return p.category === 'business' || p.category === 'enterprise';
    if (selectedCategory === 'piso_wifi') return p.category === 'piso_wifi';
    return true;
  });

  const handleOpenSignUp = (planId?: string) => {
    if (planId) setSignUpPlanId(planId);
    setSignUpSuccessInfo(null);
    setShowSignUpModal(true);
  };

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName.trim() || !applicantMobile.trim() || !applicantStreet.trim()) {
      alert('Please fill in your complete name, mobile number, and installation address.');
      return;
    }

    const selectedPlan = plans.find((p) => p.id === signUpPlanId) || plans[0];
    const year = new Date().getFullYear();
    const generatedAccountNo = `SWIFT-${year}-${String(Math.floor(Math.random() * 900) + 100)}`;
    const randomIp = `192.168.10.${Math.floor(Math.random() * 200 + 20)}`;
    const assignedNap = napBoxes[0];

    addCustomer({
      accountNo: generatedAccountNo,
      fullName: applicantName.trim(),
      mobile: applicantMobile.trim(),
      email: applicantEmail.trim(),
      address: {
        street: applicantStreet.trim(),
        barangay: applicantBarangay.trim(),
        city: businessProfile.address.city,
        province: businessProfile.address.province,
        landmark: applicantLandmark.trim(),
      },
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      monthlyFee: selectedPlan.monthlyFee,
      billingDay: 1,
      status: 'pending_install',
      installationDate: new Date().toISOString().slice(0, 10),
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
      notes: `New online application submitted via SwiftStream Website. Landmark: ${applicantLandmark || 'N/A'}`,
    });

    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }

    setSignUpSuccessInfo({
      accountNo: generatedAccountNo,
      name: applicantName,
    });

    setApplicantName('');
    setApplicantMobile('09');
    setApplicantEmail('');
    setApplicantStreet('');
    setApplicantLandmark('');
  };

  const handleSubscriberSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError('');
    const clean = signInInput.trim().toLowerCase();

    const matched = customers.find(
      (c) =>
        c.accountNo.toLowerCase() === clean ||
        c.mobile.replace(/[^0-9]/g, '') === clean.replace(/[^0-9]/g, '') ||
        c.fullName.toLowerCase().includes(clean)
    );

    if (matched) {
      setShowSignInModal(false);
      onOpenClientPortal(matched.id);
    } else {
      setSignInError('Subscriber not found. Check your Account No. (e.g. SWIFT-2026-001) or Mobile.');
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white font-sans">
      {/* 1. PUBLIC NAVBAR */}
      <header className="h-20 bg-slate-950/90 border-b border-slate-800/80 px-4 sm:px-12 flex items-center justify-between sticky top-0 z-40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 ring-1 ring-white/20">
            <Radio className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-lg text-slate-100 tracking-tight">SwiftStream</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-800/50">
                Fiber & IT Shop
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Lagonoy, Camarines Sur Node
            </p>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-300">
          <button
            type="button"
            onClick={() => scrollToSection('plans')}
            className="hover:text-cyan-400 transition-colors"
          >
            Fiber Plans & Rates
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('repairs')}
            className="hover:text-cyan-400 transition-colors"
          >
            Repair Shop Services
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('coverage')}
            className="hover:text-cyan-400 transition-colors"
          >
            Coverage Map
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('about')}
            className="hover:text-cyan-400 transition-colors"
          >
            About SwiftStream
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('contact')}
            className="hover:text-cyan-400 transition-colors"
          >
            Contact Hotline
          </button>
        </nav>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {currentAuthUser ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center font-bold text-[10px] uppercase">
                  {currentAuthUser.displayName?.slice(0, 2) || 'US'}
                </div>
                <span className="text-xs font-bold text-slate-200 hidden sm:inline">
                  {currentAuthUser.displayName?.split(' ')[0] || currentAuthUser.email}
                </span>
                <span className="text-[9px] font-mono text-cyan-400 font-bold uppercase">
                  {currentAuthUser.role}
                </span>
              </div>

              <button
                type="button"
                onClick={onOpenAdminDashboard}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-600/20"
              >
                <span>Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={logout}
                className="p-2 text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 rounded-xl transition-all"
                title="Sign Out"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openAuthModal('signin')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 border border-slate-700 rounded-xl text-xs font-bold transition-all"
              >
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sign In</span>
              </button>

              <button
                type="button"
                onClick={() => openAuthModal('signup')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/25 transition-all hover:scale-105 active:scale-95"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Sign Up</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 px-6 sm:px-12 max-w-7xl mx-auto">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-600/20 via-blue-600/15 to-purple-600/10 blur-3xl pointer-events-none -z-10 rounded-full" />

        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-950/80 to-blue-950/80 text-cyan-300 border border-cyan-800/60 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Pure End-to-End Fiber Internet & Licensed Computer Repair in Lagonoy</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-100 tracking-tight leading-[1.1]">
            Ultra-Fast Internet.<br />
            <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">
              Zero Buffering. Local Support.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
            SwiftStream delivers high-bandwidth fiber optic connections, dedicated Piso-WiFi feeder lines, and professional computer & optical repairs in Binauahan, Poblacion, and across Lagonoy, Camarines Sur.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => handleOpenSignUp()}
              className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl text-sm font-bold shadow-xl shadow-cyan-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <Zap className="w-4 h-4" />
              <span>Apply for Connection (Sign Up)</span>
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('plans')}
              className="flex items-center gap-2 px-6 py-3.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-cyan-300 border border-slate-700 rounded-2xl text-sm font-bold transition-all"
            >
              <span>View Plans & Pricing</span>
              <ArrowRight className="w-4 h-4 text-cyan-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSignInTab('subscriber');
                setShowSignInModal(true);
              }}
              className="flex items-center gap-2 px-5 py-3.5 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-600/40 rounded-2xl text-sm font-bold transition-all"
            >
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Subscriber Bill Pay</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
              <span className="text-xl sm:text-2xl font-black font-mono text-cyan-400">500 Mbps</span>
              <p className="text-xs text-slate-400 mt-0.5">Peak Dedicated Speed</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
              <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">₱899 /mo</span>
              <p className="text-xs text-slate-400 mt-0.5">Affordable Starter Fiber</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
              <span className="text-xl sm:text-2xl font-black font-mono text-purple-400">99.9%</span>
              <p className="text-xs text-slate-400 mt-0.5">Uptime SLA Reliability</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
              <span className="text-xl sm:text-2xl font-black font-mono text-amber-400">Same-Day</span>
              <p className="text-xs text-slate-400 mt-0.5">Local Tech Dispatch</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PLANS & PRICING SECTION */}
      <section id="plans" className="py-16 px-6 sm:px-12 bg-slate-900/50 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
              High-Speed Fiber Packages
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">
              Pick the Perfect Speed for Your Needs
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Unlimited data, no bandwidth throttling, symmetric low latency for mobile legends / gaming, and dual-band WiFi 6 ONU routers.
            </p>

            {/* Plan Category Filter */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
              {[
                { id: 'all', label: 'All Packages' },
                { id: 'residential', label: 'Residential Home' },
                { id: 'business', label: 'Commercial & Business' },
                { id: 'piso_wifi', label: 'Piso-WiFi Feeder' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlans.map((plan) => {
              const isPopular = plan.speedMbps === 100 || plan.speedMbps === 50;
              return (
                <div
                  key={plan.id}
                  className={`p-6 sm:p-8 rounded-3xl border flex flex-col justify-between transition-all relative ${
                    isPopular
                      ? 'bg-slate-900 border-cyan-500/80 shadow-glow-cyan'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 right-6 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md">
                      Most Popular
                    </span>
                  )}

                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/40">
                        {plan.category.replace('_', ' ')}
                      </span>
                      <h3 className="text-lg font-extrabold text-slate-100 mt-2">{plan.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 min-h-[36px] line-clamp-2">
                        {plan.description}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl sm:text-4xl font-black font-mono text-slate-100">
                          {plan.speedMbps}
                          <span className="text-sm font-normal text-cyan-400 ml-1">Mbps</span>
                        </span>
                        <span className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
                          {formatCurrency(plan.monthlyFee)}
                          <span className="text-[10px] text-slate-500 font-normal">/mo</span>
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 block">
                        {plan.installationFee > 0
                          ? `Installation Fee: ₱${plan.installationFee.toLocaleString()} (Promo: Free on 12-mo contract)`
                          : 'Free Standard Installation Promo'}
                      </span>
                    </div>

                    {/* Features List */}
                    <div className="space-y-2.5 pt-2 text-xs">
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2.5 text-slate-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-800/80 mt-6">
                    <button
                      onClick={() => handleOpenSignUp(plan.id)}
                      className={`w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${
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

      {/* 4. REPAIR SHOP & IT SERVICES SECTION */}
      <section id="repairs" className="py-16 px-6 sm:px-12 max-w-7xl mx-auto">
        <div className="space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
              Full-Service Technical Center
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">
              Computer Repair & Fiber Engineering Shop
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Beyond internet, our Binauahan shop is equipped with specialized fiber fusion splicers, BGA rework stations, and board-level hardware diagnostics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-cyan-500/50 transition-all space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center">
                <Laptop className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-100">Laptop & PC Repair</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Chip-level diagnostics, motherboard power issue repair, LCD screen replacement, RAM/NVMe SSD upgrades, and OS reformats.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/50 transition-all space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                <Radio className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-100">Fiber Optical Splicing</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Emergency fiber line cut repair, OTDR optical power testing, drop cable re-routing, and ONU modem re-provisioning.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-purple-500/50 transition-all space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-100">Piso-WiFi Machines</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Custom assembly of outdoor coin-operated WiFi vending machines, LPB software configuration, and high-gain outdoor AP setup.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-amber-500/50 transition-all space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-600/20 text-amber-400 flex items-center justify-center">
                <Tv className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-100">CCTV & Mikrotik Routing</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Commercial CCTV multi-camera installation, Mikrotik load balancing, VLAN segmenting, and enterprise mesh WiFi rollouts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. COVERAGE MATRIX SECTION */}
      <section id="coverage" className="py-16 px-6 sm:px-12 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
              Lagonoy Network Map
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">
              Active Fiber Distribution Hubs (NAP Boxes)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Our optical distribution points are deployed in key sectors of Lagonoy for low attenuation and instant hookup.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {napBoxes.map((box) => (
              <div
                key={box.id}
                className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950 px-2.5 py-0.5 rounded border border-cyan-800/40">
                    {box.code}
                  </span>
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Active Hub</span>
                  </span>
                </div>

                <h3 className="font-bold text-base text-slate-100">{box.name}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  <span>{box.location}, Brgy. {box.barangay}</span>
                </p>

                <div className="pt-3 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Capacity: {box.totalPorts} Ports</span>
                  <span>Splitter: {box.splitterType}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. ABOUT SWIFTSTREAM SECTION */}
      <section id="about" className="py-20 px-6 sm:px-12 max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
            About Our Company
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">
            Built by Local Engineers for Lagonoy
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            SwiftStream was founded to bring fiber-grade digital connectivity and board-level repair expertise to the community of Camarines Sur.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center font-bold">
              <Radio className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-100">End-to-End Fiber Core</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              We own and maintain our direct fiber trunk lines and MikroTik core routing infrastructure with dedicated optical power monitoring on every port.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-100">Registered & Compliant</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Fully registered under <strong>{businessProfile.name}</strong> (TIN: {businessProfile.tin}) with official receipt generation on all payments.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold">
              <Wrench className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-100">Same-Day Local Dispatch</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Our technicians live in Binauahan and Poblacion, ensuring prompt site surveys, fast installations, and rapid troubleshooting.
            </p>
          </div>
        </div>
      </section>

      {/* 7. CONTACT & FOOTER */}
      <footer id="contact" className="pt-16 pb-12 px-6 sm:px-12 bg-slate-950 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-slate-800/80 text-xs">
          {/* Col 1: Business Identity */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-100">{businessProfile.name}</h4>
                <p className="text-[10px] text-cyan-400">{businessProfile.tradeName}</p>
              </div>
            </div>

            <p className="text-slate-400 max-w-md leading-relaxed">
              Legitimate and registered telecommunications provider and technical repair shop in Lagonoy, Camarines Sur. Serving homes, micro-businesses, and schools with uncompromised fiber broadband.
            </p>

            <div className="pt-2 text-slate-400 space-y-1">
              <p>
                <strong className="text-slate-300">BIR TIN:</strong> {businessProfile.tin}
              </p>
              <p>
                <strong className="text-slate-300">Authorized Representative:</strong> {businessProfile.representative.firstName} {businessProfile.representative.lastName} (I.T Lead)
              </p>
            </div>
          </div>

          {/* Col 2: Location */}
          <div className="space-y-3">
            <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
              Shop & Node Location
            </h5>
            <div className="space-y-1.5 text-slate-400">
              <p className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>
                  {businessProfile.address.building}, {businessProfile.address.street}, Brgy. {businessProfile.address.barangay}, {businessProfile.address.city}, {businessProfile.address.province} {businessProfile.address.zipCode}
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
              Customer Helpline
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
                <span className="text-[10px] text-slate-500 block uppercase">Supported E-Wallets:</span>
                <span className="text-slate-300 font-semibold">GCash • Maya • BDO Bank</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {businessProfile.name}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <button onClick={() => handleOpenSignUp()} className="hover:text-cyan-400">
              Apply Online
            </button>
            <button onClick={() => setShowSignInModal(true)} className="hover:text-cyan-400">
              Subscriber Portal
            </button>
            <button onClick={onOpenAdminDashboard} className="hover:text-cyan-400">
              Admin Login
            </button>
          </div>
        </div>
      </footer>

      {/* ================= MODAL 1: SIGN UP / APPLICATION MODAL ================= */}
      {showSignUpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">
                    Apply for SwiftStream Fiber Internet
                  </h3>
                  <p className="text-xs text-slate-400">
                    Fast installation in Binauahan, Poblacion & Lagonoy areas.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowSignUpModal(false)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {signUpSuccessInfo ? (
              <div className="p-8 text-center space-y-5">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-xl font-bold text-slate-100">Application Submitted!</h4>
                  <p className="text-xs text-slate-400">
                    Thank you, <strong className="text-slate-200">{signUpSuccessInfo.name}</strong>. Our Lagonoy field installation team will contact you shortly for dispatch scheduling.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 inline-block text-left text-xs space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">
                    Your Assigned Subscriber Account No:
                  </span>
                  <p className="font-mono text-base font-extrabold text-cyan-400">
                    {signUpSuccessInfo.accountNo}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Status: <span className="text-amber-400 font-semibold">Pending Site Survey / Installation</span>
                  </p>
                </div>

                <div className="pt-3">
                  <button
                    onClick={() => {
                      setShowSignUpModal(false);
                      onOpenClientPortal();
                    }}
                    className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/20"
                  >
                    Open Subscriber Portal &rarr;
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSignUpSubmit} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                {/* Plan Selector */}
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Select Desired Fiber Plan *
                  </label>
                  <select
                    value={signUpPlanId}
                    onChange={(e) => setSignUpPlanId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.speedMbps} Mbps (₱{p.monthlyFee.toLocaleString()}/mo)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Personal Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="e.g. Juan Dela Cruz"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Mobile Number *</label>
                    <input
                      type="text"
                      required
                      value={applicantMobile}
                      onChange={(e) => setApplicantMobile(e.target.value)}
                      placeholder="0917xxxxxxx"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={applicantEmail}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    placeholder="client@gmail.com"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Address Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Street / Purok / Zone *</label>
                    <input
                      type="text"
                      required
                      value={applicantStreet}
                      onChange={(e) => setApplicantStreet(e.target.value)}
                      placeholder="Purok 2, Riverside"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Barangay *</label>
                    <input
                      type="text"
                      required
                      value={applicantBarangay}
                      onChange={(e) => setApplicantBarangay(e.target.value)}
                      placeholder="Binauahan / Poblacion"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Nearest Landmark (Crucial for Installers)</label>
                  <input
                    type="text"
                    value={applicantLandmark}
                    onChange={(e) => setApplicantLandmark(e.target.value)}
                    placeholder="e.g. Near Cockpit Arena, green gate beside chapel"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSignUpModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-600/25 transition-all"
                  >
                    Submit Application
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL 2: UNIFIED SIGN IN MODAL ================= */}
      {showSignInModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">Sign In to SwiftStream</h3>
                  <p className="text-xs text-slate-400">Choose your access mode</p>
                </div>
              </div>

              <button
                onClick={() => setShowSignInModal(false)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 p-3 bg-slate-950 border-b border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSignInTab('subscriber');
                  setSignInError('');
                }}
                className={`py-2 rounded-xl font-bold transition-all ${
                  signInTab === 'subscriber'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Subscriber Portal
              </button>

              <button
                type="button"
                onClick={() => {
                  setSignInTab('admin');
                  setSignInError('');
                }}
                className={`py-2 rounded-xl font-bold transition-all ${
                  signInTab === 'admin'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Staff / Admin Console
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {signInTab === 'subscriber' ? (
                <form onSubmit={handleSubscriberSignIn} className="space-y-4">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">
                      Account No. or Mobile Number
                    </label>
                    <input
                      type="text"
                      required
                      value={signInInput}
                      onChange={(e) => setSignInInput(e.target.value)}
                      placeholder="e.g. SWIFT-2026-001 or 09624171684"
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {signInError && (
                    <p className="text-rose-400 text-xs">{signInError}</p>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-600/20"
                  >
                    Open My Portal &rarr;
                  </button>

                  <div className="pt-3 border-t border-slate-800 space-y-1 text-slate-400">
                    <p className="text-[11px] font-semibold text-slate-300">Quick Test Demo Accounts:</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {customers.slice(0, 3).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setShowSignInModal(false);
                            onOpenClientPortal(c.id);
                          }}
                          className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] text-cyan-300"
                        >
                          {c.fullName.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Authorized Staff Access</span>
                    <p className="text-slate-200">
                      Access operations dashboard, billing generation, subscriber CRM, and Mikrotik network tools.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setShowSignInModal(false);
                      onOpenAdminDashboard();
                    }}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Launch Admin ERP Operations Console</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gemini AI Sales & Support Assistant */}
      <GeminiAiAssistant mode="homepage" />
    </div>
  );
};

