import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  Shield,
  Zap,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Radio,
  Building2,
  Check,
  Phone,
  MapPin,
  Clock,
  Wifi,
  Calendar,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  HelpCircle,
  Server,
  UserCheck,
  Globe,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  resetUserPassword,
  UserRole,
} from '../../services/authService';
import { formatCurrency } from '../../utils/formatters';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
}) => {
  const {
    showToast,
    setCurrentAuthUser,
    setActiveTab,
    plans,
    customers,
    addCustomer,
    coverageAreas,
  } = useApp();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('09');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(plans[0]?.id || 'plan-50m');
  const [installationDate, setInstallationDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [street, setStreet] = useState('');
  const [barangay, setBarangay] = useState('Binauahan');
  const [landmark, setLandmark] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingApplicationNotice, setPendingApplicationNotice] = useState<{
    name: string;
    email: string;
    accountNo: string;
    planName: string;
    monthlyFee: number;
    barangay: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMessage(null);
      setSuccessMessage(null);
      setPendingApplicationNotice(null);
      if (plans.length > 0 && !selectedPlanId) {
        setSelectedPlanId(plans[0].id);
      }
    }
  }, [isOpen, initialMode, plans]);

  if (!isOpen) return null;

  const getCleanErrorMessage = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password. Please double-check your login credentials.';
      case 'auth/email-already-in-use':
        return 'This email address is already registered. Please click Sign In instead.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please provide a valid email format (e.g. name@example.com).';
      case 'auth/popup-closed-by-user':
        return 'Google Sign-In popup was closed before finishing authentication.';
      default:
        return err?.message || 'Authentication error. Please check your connection and try again.';
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const profile = await signInWithEmail(email.trim(), password);
      setCurrentAuthUser(profile);

      try {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      } catch {}

      if (profile.role === 'subscriber') {
        setActiveTab('portal');
        showToast('success', 'Subscriber Portal', `Welcome back, ${profile.displayName || profile.email}!`);
      } else {
        setActiveTab('dashboard');
        showToast('success', 'Admin Console', `Signed in as ${profile.displayName || profile.email} (${profile.role.toUpperCase()}).`);
      }

      onClose();
    } catch (err: any) {
      setErrorMessage(getCleanErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingApplicationNotice(null);

    if (!fullName.trim()) {
      setErrorMessage('Please enter your complete applicant full name.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Please choose a password with at least 6 characters.');
      return;
    }
    if (!mobile.trim() || mobile.length < 11) {
      setErrorMessage('Please provide a valid 11-digit Philippine mobile number (e.g. 09171234567).');
      return;
    }
    if (!street.trim()) {
      setErrorMessage('Please enter your street address, zone, or purok.');
      return;
    }

    setLoading(true);
    try {
      const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];
      const generatedAccountNo = `SWIFT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

      // 1. Immediately register customer in CRM, local state and Firestore
      addCustomer({
        accountNo: generatedAccountNo,
        fullName: fullName.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        address: {
          street: street.trim(),
          barangay: barangay.trim(),
          city: 'Lagonoy',
          province: 'Camarines Sur',
          landmark: landmark.trim(),
        },
        planId: selectedPlan?.id || 'plan-50m',
        planName: selectedPlan?.name || 'Fiber Power 50 Mbps',
        monthlyFee: selectedPlan?.monthlyFee || 1299,
        billingDay: 15,
        status: 'pending_approval',
        installationDate: installationDate || new Date().toISOString().slice(0, 10),
        balance: 0,
        walletBalance: 0,
        advanceDeposit: 0,
        network: {
          pppoeUsername: email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_'),
          ipAddress: `192.168.10.${Math.floor(20 + Math.random() * 200)}`,
          napBoxId: 'nap-01-binauahan',
          napPortNumber: 1,
          isMikrotikSynced: false,
        },
        notes: `Online Registration via Portal Sign Up. Landmark: ${landmark || 'N/A'}. Preferred Install Date: ${installationDate || 'ASAP'}`,
      });

      // 2. Register user in Firebase Auth directory
      try {
        await signUpWithEmail(
          email.trim(),
          password,
          fullName.trim(),
          'subscriber',
          {
            accountNo: generatedAccountNo,
            planId: selectedPlan?.id,
            planName: selectedPlan?.name,
            monthlyFee: selectedPlan?.monthlyFee,
            mobile: mobile.trim(),
            installationDate,
            address: {
              street: street.trim(),
              barangay: barangay.trim(),
              landmark: landmark.trim(),
            },
          }
        );
      } catch (authErr: any) {
        console.warn('Firebase Auth user registration note:', authErr);
      }

      try {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.5 } });
      } catch {}

      setPendingApplicationNotice({
        name: fullName.trim(),
        email: email.trim(),
        accountNo: generatedAccountNo,
        planName: selectedPlan?.name || 'Fiber Internet',
        monthlyFee: selectedPlan?.monthlyFee || 1299,
        barangay: barangay.trim(),
      });
      showToast('success', 'Application Submitted', 'Your Fiber application is queued for Admin review.');
    } catch (err: any) {
      setErrorMessage(getCleanErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setGoogleLoading(true);

    try {
      const profile = await signInWithGoogle();
      setCurrentAuthUser(profile);

      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      } catch {}

      if (profile.role === 'subscriber') {
        setActiveTab('portal');
        showToast('success', 'Subscriber Portal', `Welcome, ${profile.displayName}!`);
      } else {
        setActiveTab('dashboard');
        showToast('success', 'Admin Console', `Signed in as ${profile.displayName} (${profile.role.toUpperCase()}).`);
      }

      onClose();
    } catch (err: any) {
      setErrorMessage(getCleanErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      await resetUserPassword(email.trim());
      setSuccessMessage(`A password reset link has been dispatched to ${email.trim()}. Please check your email inbox.`);
      showToast('info', 'Reset Link Dispatched', 'Check your email to set a new password.');
    } catch (err: any) {
      setErrorMessage(getCleanErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`relative w-full ${
          mode === 'signup' ? 'max-w-2xl' : 'max-w-md'
        } bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col transition-all duration-300`}
      >
        {/* Top Header & Brand Bar */}
        <div className="p-5 sm:p-6 pb-4 bg-gradient-to-b from-slate-950 via-slate-900/90 to-transparent border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg ring-1 ring-white/10 ${
                  mode === 'signin'
                    ? 'bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 shadow-cyan-500/20'
                    : mode === 'signup'
                    ? 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-600 shadow-emerald-500/20'
                    : 'bg-gradient-to-tr from-amber-600 to-orange-500 shadow-amber-500/20'
                }`}
              >
                {mode === 'signin' && <Lock className="w-5 h-5 text-white" />}
                {mode === 'signup' && <Zap className="w-5 h-5 text-white" />}
                {mode === 'forgot' && <KeyRound className="w-5 h-5 text-white" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                  <span>
                    {mode === 'signin' && 'Sign In to SwiftStream'}
                    {mode === 'signup' && 'Apply for Fiber Connection'}
                    {mode === 'forgot' && 'Account Recovery'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  {mode === 'signin' && 'Access your subscriber account or admin console'}
                  {mode === 'signup' && 'Residential & business fiber application in Lagonoy'}
                  {mode === 'forgot' && 'Enter your email to receive a password reset link'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Interactive Navigation Segmented Switcher */}
          {!pendingApplicationNotice && (
            <div className="grid grid-cols-2 gap-1.5 mt-4 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMessage(null);
                }}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'signin' || mode === 'forgot'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMessage(null);
                }}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Apply (Sign Up)</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Body Container */}
        <div className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
          {/* ================= VIEW: PENDING APPLICATION SUCCESS ROADMAP ================= */}
          {pendingApplicationNotice ? (
            <div className="p-6 rounded-3xl bg-slate-950 border border-cyan-800/60 text-center space-y-5 animate-in fade-in">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mx-auto flex items-center justify-center shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950 px-2.5 py-0.5 rounded-full border border-cyan-800/60">
                  Account No: {pendingApplicationNotice.accountNo}
                </span>
                <h4 className="text-lg font-bold text-slate-100 mt-1">Application Queued for Review!</h4>
                <p className="text-xs text-slate-300 max-w-md mx-auto">
                  Thank you, <strong className="text-cyan-300">{pendingApplicationNotice.name}</strong>. Your subscription request for{' '}
                  <strong className="text-emerald-400">{pendingApplicationNotice.planName}</strong> ({formatCurrency(pendingApplicationNotice.monthlyFee)}/mo) has been registered.
                </p>
              </div>

              {/* 4-Step Next Steps Roadmap */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-left space-y-3">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Activation Roadmap:
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-cyan-600/30 text-cyan-300 border border-cyan-500 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <p className="font-semibold text-slate-200">Admin Line Survey & Approval</p>
                      <p className="text-[11px] text-slate-400">Our Lagonoy NOC team verifies nearest NAP box port capacity in Brgy. {pendingApplicationNotice.barangay}.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <p className="font-semibold text-slate-200">Lineman Field Dispatch</p>
                      <p className="text-[11px] text-slate-400">Linemen run the fiber drop wire and configure your Gigabit Dual-Band ONU modem.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <p className="font-semibold text-slate-200">SMS & Portal Activation</p>
                      <p className="text-[11px] text-slate-400">Once approved, you can log in immediately to view your official bill and test speeds.</p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPendingApplicationNotice(null);
                  setMode('signin');
                  onClose();
                }}
                className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-cyan-600/25 transition-all hover:scale-[1.02] cursor-pointer"
              >
                Return to Home Page
              </button>
            </div>
          ) : (
            <>
              {/* Error Message Alert */}
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 flex items-start gap-2.5 text-xs animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{errorMessage}</div>
                </div>
              )}

              {/* Success Message Alert */}
              {successMessage && (
                <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 flex items-start gap-2.5 text-xs animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">{successMessage}</div>
                </div>
              )}

              {/* ================= VIEW: SIGN IN ================= */}
              {mode === 'signin' && (
                <div className="space-y-4">
                  {/* Google 1-Click Fast Sign-In */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading || loading}
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-slate-200 font-bold rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.34 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.97 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>{googleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
                  </button>

                  <div className="relative flex items-center justify-center my-2">
                    <div className="border-t border-slate-800 w-full" />
                    <span className="bg-slate-900 px-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider whitespace-nowrap">
                      or sign in with email
                    </span>
                    <div className="border-t border-slate-800 w-full" />
                  </div>

                  <form onSubmit={handleSignIn} className="space-y-3.5">
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">Email Address</label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-slate-300 font-semibold">Password</label>
                        <button
                          type="button"
                          onClick={() => {
                            setMode('forgot');
                            setErrorMessage(null);
                          }}
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-mono transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                          title={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-cyan-600/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer mt-2"
                    >
                      <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}

              {/* ================= VIEW: SIGN UP (FIBER APPLICATION) ================= */}
              {mode === 'signup' && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  {/* Step 1: Visual Plan Selector */}
                  <div className="space-y-2.5 p-4 rounded-3xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                        <Wifi className="w-4 h-4 text-cyan-400" />
                        <span>1. Choose Your Fiber Plan:</span>
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/40">
                        Unlimited • No Data Cap
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {plans.map((p) => {
                        const isSelected = selectedPlanId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedPlanId(p.id)}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-950/70 border-cyan-500 text-cyan-200 shadow-md shadow-cyan-950/40'
                                : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-100">{p.name}</span>
                              {isSelected ? (
                                <span className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center shadow">
                                  <Check className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span className="w-4 h-4 rounded-full border border-slate-700" />
                              )}
                            </div>
                            <div className="flex items-baseline justify-between mt-1.5 text-xs">
                              <span className="font-mono text-cyan-400 font-extrabold text-sm">{p.speedMbps} Mbps</span>
                              <span className="font-mono text-emerald-400 font-bold">{formatCurrency(p.monthlyFee)}/mo</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Personal & Contact Information */}
                  <div className="space-y-3 p-4 rounded-3xl bg-slate-950 border border-slate-800">
                    <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <User className="w-4 h-4 text-cyan-400" />
                      <span>2. Applicant Contact & Login Credentials:</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 mb-1 font-medium">Full Name (Applicant) *</label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="e.g. Juan Dela Cruz"
                            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 mb-1 font-medium">Mobile Number (SMS Updates) *</label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            required
                            value={mobile}
                            onChange={(e) => setMobile(e.target.value)}
                            placeholder="09171234567"
                            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 mb-1 font-medium">Email Address (Portal Username) *</label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="juan@gmail.com"
                            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 mb-1 font-medium">Create Password (Min 6 chars) *</label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-9 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Installation Address & Date */}
                  <div className="space-y-3 p-4 rounded-3xl bg-slate-950 border border-slate-800">
                    <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-rose-400" />
                      <span>3. Installation Location & Target Date (Lagonoy):</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">Barangay (Coverage Area) *</label>
                        <select
                          value={barangay}
                          onChange={(e) => setBarangay(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                        >
                          {coverageAreas
                            .filter((a) => a.isPubliclyVisible)
                            .map((area) => (
                              <option key={area.id} value={area.barangay}>
                                {area.name} {area.status === 'fiber_ready' ? '(🟢 Fiber Ready)' : '(🟡 Expanding)'}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">Preferred Installation Date *</label>
                        <div className="relative">
                          <Calendar className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="date"
                            required
                            value={installationDate}
                            onChange={(e) => setInstallationDate(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 [color-scheme:dark] cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">Street / Zone / Purok *</label>
                        <input
                          type="text"
                          required
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                          placeholder="e.g. Purok 3, Maharlika St."
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-medium">Nearest Landmark</label>
                        <input
                          type="text"
                          value={landmark}
                          onChange={(e) => setLandmark(e.target.value)}
                          placeholder="e.g. Near Brgy Chapel / Elementary School"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Summary Bar & Submit Button */}
                  <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Selected Package:</span>
                      <span className="font-bold text-slate-200">{selectedPlan?.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Monthly Rate:</span>
                      <span className="font-mono font-bold text-emerald-400">{formatCurrency(selectedPlan?.monthlyFee || 1299)}/mo</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>{loading ? 'Submitting Application...' : 'Submit Fiber Application'}</span>
                  </button>
                </form>
              )}

              {/* ================= VIEW: FORGOT PASSWORD ================= */}
              {mode === 'forgot' && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">Registered Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('signin');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      &larr; Back to Sign In
                    </button>

                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-600/20 disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
