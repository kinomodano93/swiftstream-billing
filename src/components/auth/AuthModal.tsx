import React, { useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  resetUserPassword,
  UserRole,
} from '../../services/authService';

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
  const { showToast, setCurrentAuthUser } = useApp();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('admin');
  const [accountNo, setAccountNo] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const getCleanErrorMessage = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password. Please try again.';
      case 'auth/email-already-in-use':
        return 'This email address is already registered. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/popup-closed-by-user':
        return 'Google Sign-In popup was closed before completing.';
      case 'auth/unauthorized-domain':
        return 'Domain not authorized for Google Sign-In. Add localhost to Firebase Console > Auth > Settings > Authorized Domains.';
      default:
        return err?.message || 'Authentication failed. Please verify your credentials and try again.';
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
      showToast('success', 'Welcome Back!', `Signed in as ${profile.displayName || profile.email} (${profile.role.toUpperCase()}).`);
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

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const profile = await signUpWithEmail(
        email.trim(),
        password,
        fullName.trim(),
        role,
        role === 'subscriber' ? accountNo.trim() : undefined
      );
      setCurrentAuthUser(profile);
      showToast('success', 'Account Created', `Welcome to SwiftStream, ${profile.displayName}! Authenticated to Firebase.`);
      onClose();
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
      showToast('success', 'Google Sign-In Successful', `Logged in as ${profile.displayName || profile.email}.`);
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
      setSuccessMessage(`A password reset link has been sent to ${email.trim()}. Check your inbox.`);
      showToast('info', 'Reset Email Sent', 'Check your email inbox for password recovery instructions.');
    } catch (err: any) {
      setErrorMessage(getCleanErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Glow Header */}
        <div className="p-6 pb-4 bg-gradient-to-b from-slate-950/80 to-transparent border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  <span>SwiftStream Cloud Auth</span>
                  <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Firebase
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  {mode === 'signin' && 'Sign in to access your billing & ISP dashboard'}
                  {mode === 'signup' && 'Create a new staff or subscriber account'}
                  {mode === 'forgot' && 'Reset your forgotten account password'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Switch Tabs */}
          {mode !== 'forgot' && (
            <div className="flex mt-4 p-1 bg-slate-950/80 border border-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  mode === 'signin'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMessage(null);
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  mode === 'signup'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 text-xs">
          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-800/60 text-rose-200 flex items-start gap-2.5 text-[11px] animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Success Message Alert */}
          {successMessage && (
            <div className="p-3 rounded-2xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-200 flex items-start gap-2.5 text-[11px]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">{successMessage}</div>
            </div>
          )}

          {/* Google 1-Click Sign-In */}
          {mode !== 'forgot' && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-700 hover:border-slate-600 text-slate-200 font-bold rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
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
                <span className="bg-slate-900 px-3 text-[10px] uppercase font-semibold text-slate-400 whitespace-nowrap">
                  or with email
                </span>
                <div className="border-t border-slate-800 w-full" />
              </div>
            </>
          )}

          {/* Form: Sign In */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-3.5">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@swiftstream.ph"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage(null);
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-cyan-600/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-2"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to SwiftStream'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Form: Sign Up */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Engr. Leonardo Flojo Jr."
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="leonardo@swiftstream.ph"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Create Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Role Picker */}
              <div>
                <label className="block text-slate-300 mb-1.5 font-medium">Assign System Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'admin', label: 'Administrator (NOC)', icon: Shield },
                    { id: 'cashier', label: 'Billing Cashier', icon: Building2 },
                    { id: 'tech', label: 'Field Lineman / Tech', icon: Zap },
                    { id: 'subscriber', label: 'Subscriber Portal', icon: Radio },
                  ].map((r) => {
                    const Icon = r.icon;
                    const isSelected = role === r.id;
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => setRole(r.id as UserRole)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px] font-semibold truncate">{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {role === 'subscriber' && (
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Customer Account Number (e.g. SWIFT-2024-001)</label>
                  <input
                    type="text"
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    placeholder="SWIFT-2024-001"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-cyan-600/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-2"
              >
                <span>{loading ? 'Creating Account...' : 'Register to Firebase'}</span>
                <Check className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Form: Forgot Password */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Registered Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@swiftstream.ph"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
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
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Back to Sign In
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-600/20 disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Password Reset Email'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

