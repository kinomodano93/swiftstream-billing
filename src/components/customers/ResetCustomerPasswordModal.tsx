import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  Eye,
  EyeOff,
  Shuffle,
  Mail,
  Copy,
  Check,
  ShieldCheck,
  Send,
  AlertCircle,
  Lock,
  Wifi,
  Globe,
  Edit3,
} from 'lucide-react';
import { Customer } from '../../types';
import { useApp } from '../../context/AppContext';
import { resetUserPassword } from '../../services/authService';
import { formatCurrency, formatPhoneNumber, getDynamicPortalUrl } from '../../utils/formatters';

interface ResetCustomerPasswordModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ResetCustomerPasswordModal: React.FC<ResetCustomerPasswordModalProps> = ({
  customer,
  isOpen,
  onClose,
}) => {
  const { resetCustomerPassword, showToast, businessProfile } = useApp();

  const [activeMode, setActiveMode] = useState<'manual' | 'email'>('manual');
  const [newPassword, setNewPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(true);
  const [syncPppoe, setSyncPppoe] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Dynamic DNS / Portal URL state
  const [portalUrl, setPortalUrl] = useState<string>(getDynamicPortalUrl(businessProfile));
  const [isCustomUrl, setIsCustomUrl] = useState<boolean>(false);

  // Email reset state
  const [emailToReset, setEmailToReset] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (customer) {
      // Auto-generate a friendly, secure default password
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      setNewPassword(`Swift@${randomDigits}`);
      setEmailToReset(customer.email || '');
      setSyncPppoe(!!customer.network?.pppoeUsername);
      setPortalUrl(getDynamicPortalUrl(businessProfile));
      setIsCustomUrl(false);
      setSubmitError(null);
      setSubmitSuccess(false);
      setEmailSentSuccess(false);
      setCopied(false);
    }
  }, [customer, isOpen, businessProfile]);

  if (!isOpen || !customer) return null;

  const handleGeneratePassword = () => {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    setNewPassword(`Swift@${randomDigits}`);
    setSubmitSuccess(false);
  };

  const handleManualResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!newPassword || newPassword.trim().length < 6) {
      setSubmitError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetCustomerPassword(customer.id, newPassword.trim(), syncPppoe);
      if (res.success) {
        setSubmitSuccess(true);
      } else {
        setSubmitError(res.message);
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to reset subscriber password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendEmailReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const targetEmail = emailToReset.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setSubmitError('Please enter a valid email address to send the password reset link.');
      return;
    }

    setIsSendingEmail(true);
    try {
      await resetUserPassword(targetEmail);
      setEmailSentSuccess(true);
      showToast(
        'success',
        'Password Reset Email Sent',
        `A secure password reset link has been dispatched to ${targetEmail} via Firebase.`
      );
    } catch (err: any) {
      const msg = err?.message || 'Could not send password reset email. Please verify the email address.';
      setSubmitError(msg);
      showToast('error', 'Reset Failed', msg);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const copyCredentialsToClipboard = () => {
    const credsText = `🌐 SwiftStream Fiber Internet - Customer Portal Login\nPortal Link: ${portalUrl}\nAccount No: ${customer.accountNo}\nUsername / Email: ${customer.email}\nNew Password: ${newPassword.trim()}\n\nPlease change your password upon signing in.`;

    navigator.clipboard.writeText(credsText).then(() => {
      setCopied(true);
      showToast('info', 'Copied to Clipboard', 'Portal login credentials copied successfully!');
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Reset Customer Password</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono">
                  {customer.accountNo}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage subscriber portal credentials & router dial-up secret.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Customer Profile Card */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold text-sm flex-shrink-0">
                {customer.fullName.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-200 text-sm truncate">
                  {customer.fullName}
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="text-cyan-400">{customer.email || 'No email registered'}</span>
                  <span>•</span>
                  <span>{formatPhoneNumber(customer.mobile)}</span>
                </div>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <div className="text-[11px] font-medium text-slate-300 truncate max-w-[120px]">
                {customer.planName}
              </div>
              <div className="text-xs font-mono font-bold text-emerald-400">
                {formatCurrency(customer.monthlyFee)}/mo
              </div>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveMode('manual');
                setSubmitError(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeMode === 'manual'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Set Password Manually</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMode('email');
                setSubmitError(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeMode === 'email'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Send Email Reset Link</span>
            </button>
          </div>

          {/* Error Banner */}
          {submitError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{submitError}</span>
            </div>
          )}

          {/* Tab 1: Manual Password Reset */}
          {activeMode === 'manual' && (
            <form onSubmit={handleManualResetSubmit} className="space-y-4">
              {/* Dynamic DNS / Public Portal Link Card */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Portal Public URL (Dynamic DNS)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCustomUrl((prev) => !prev)}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isCustomUrl ? 'Reset to Default DDNS' : 'Customize Domain'}</span>
                  </button>
                </div>

                {isCustomUrl ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={portalUrl}
                      onChange={(e) => setPortalUrl(e.target.value)}
                      placeholder="https://swiftstream-portal.web.app/#portal"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-cyan-800/60 rounded-lg text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                    />
                    <p className="text-[10px] text-slate-500">
                      Override with your live MikroTik Cloud DDNS, public domain, or static IP address.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800/80 font-mono text-xs text-cyan-300 truncate">
                    <span className="truncate">{portalUrl}</span>
                    <span className="text-[9px] font-sans px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40 flex-shrink-0">
                      {businessProfile.portalDomain ? 'Configured DDNS' : 'Dynamic Cloud DNS'}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span>New Portal Password</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Generate Secure</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setSubmitSuccess(false);
                    }}
                    placeholder="Enter min. 6 characters..."
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-slate-100 font-mono text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  The subscriber can use this password to immediately log in at{' '}
                  <span className="font-mono text-cyan-400 break-all">{portalUrl}</span>.
                </p>
              </div>

              {/* MikroTik PPPoE Sync Checkbox */}
              {customer.network?.pppoeUsername && (
                <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="sync-pppoe"
                    checked={syncPppoe}
                    onChange={(e) => setSyncPppoe(e.target.checked)}
                    className="mt-0.5 rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 bg-slate-900 cursor-pointer"
                  />
                  <label htmlFor="sync-pppoe" className="text-xs text-slate-300 cursor-pointer select-none">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-purple-400" />
                      Synchronize PPPoE Router Secret
                    </span>
                    <span className="block text-[11px] text-slate-400 mt-0.5">
                      Also updates the router dial-up password for username{' '}
                      <strong className="text-purple-300 font-mono">{customer.network.pppoeUsername}</strong> directly on MikroTik hardware.
                    </span>
                  </label>
                </div>
              )}

              {/* Success Card with Copy Action */}
              {submitSuccess && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Password updated successfully in database and portal store!</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/20 font-mono text-xs text-slate-300 space-y-1.5">
                    <div>
                      <span className="text-slate-500">Portal URL: </span>
                      <span className="text-cyan-400 font-semibold break-all">{portalUrl}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Username: </span>
                      <span className="text-slate-200 font-semibold">{customer.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Account #: </span>
                      <span className="text-slate-200">{customer.accountNo}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Password: </span>
                      <span className="text-emerald-400 font-bold">{newPassword.trim()}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={copyCredentialsToClipboard}
                    className="w-full py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied Credentials to Clipboard!' : 'Copy Credentials for Subscriber'}</span>
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  {submitSuccess ? 'Close' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>Saving to System...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Apply New Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Tab 2: Firebase Email Reset Link */}
          {activeMode === 'email' && (
            <form onSubmit={handleSendEmailReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Recipient Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={emailToReset}
                    onChange={(e) => {
                      setEmailToReset(e.target.value);
                      setEmailSentSuccess(false);
                    }}
                    placeholder="subscriber@example.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Sends an official password recovery link powered by Google Firebase Authentication. The subscriber clicks the link in their email inbox to securely choose their own new password.
                </p>
              </div>

              {emailSentSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Password Reset Link Dispatched!</span>
                    <span className="text-[11px] text-emerald-300/80">
                      An official recovery email has been sent to <strong>{emailToReset}</strong>. Please instruct the subscriber to check their Inbox and Spam folders.
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  {emailSentSuccess ? 'Close' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  disabled={isSendingEmail}
                  className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  {isSendingEmail ? (
                    <span>Dispatching Email...</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Reset Email</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

