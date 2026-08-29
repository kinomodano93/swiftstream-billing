import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Mail,
  Plus,
  Trash2,
  Lock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Globe,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  getAuthorizedAdminEmails,
  saveAuthorizedAdminEmails,
} from '../../services/authService';

export const SsoWhitelistSettingsCard: React.FC = () => {
  const { businessProfile, updateBusinessProfile, showToast, logAuditEvent } = useApp();

  const [authorizedEmails, setAuthorizedEmails] = useState<string[]>(
    businessProfile.authorizedAdminEmails || ['swiftstream.telecom@gmail.com', 'admin@swiftstream.ph']
  );
  const [newEmailInput, setNewEmailInput] = useState<string>('');
  const [enforceRestriction, setEnforceRestriction] = useState<boolean>(
    businessProfile.enforceSsoRestriction !== false
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    const loadRemote = async () => {
      const remote = await getAuthorizedAdminEmails();
      if (remote && remote.length > 0) {
        setAuthorizedEmails(remote);
      }
    };
    loadRemote();
  }, []);

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newEmailInput.trim().toLowerCase();
    if (!clean) return;

    if (!clean.includes('@') || !clean.includes('.')) {
      showToast('error', 'Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (authorizedEmails.includes(clean)) {
      showToast('info', 'Already Whitelisted', `${clean} is already pre-authorized.`);
      return;
    }

    const updated = [...authorizedEmails, clean];
    setAuthorizedEmails(updated);
    setNewEmailInput('');
    showToast('success', 'Email Added to Whitelist', `${clean} added. Click Save to persist.`);
  };

  const handleRemoveEmail = (targetEmail: string) => {
    if (authorizedEmails.length <= 1) {
      showToast('warning', 'Minimum 1 Required', 'You must maintain at least one authorized administrator email.');
      return;
    }

    const updated = authorizedEmails.filter((e) => e !== targetEmail);
    setAuthorizedEmails(updated);
    showToast('info', 'Email Removed', `${targetEmail} removed from whitelist.`);
  };

  const handleSaveWhitelist = async () => {
    setLoading(true);
    setSaveSuccess(false);

    try {
      await saveAuthorizedAdminEmails(authorizedEmails);
      updateBusinessProfile({
        authorizedAdminEmails: authorizedEmails,
        enforceSsoRestriction: enforceRestriction,
      });

      logAuditEvent({
        userName: 'Administrator',
        action: 'SSO_WHITELIST_UPDATED',
        category: 'auth',
        severity: 'info',
        details: `Updated Google SSO pre-authorized admin whitelist: ${authorizedEmails.join(', ')}.`,
        status: 'success',
      });

      setSaveSuccess(true);
      showToast('success', 'SSO Whitelist Saved', 'Authorized Administrator Gmail accounts updated in Cloud Firestore.');
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      showToast('error', 'Save Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-xl text-xs">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100">
                Google SSO & Pre-Authorized Admin Whitelist
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Strict Access Control
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Only Google accounts listed below are granted Administrator NOC privileges upon Google Sign-In. Unauthorized Google accounts will be strictly blocked.
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveWhitelist}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-600/25 transition-all disabled:opacity-50"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          <span>{loading ? 'Saving...' : 'Save Whitelist to Firestore'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-2xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-200 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>SSO Access Whitelist synchronized successfully with Google Cloud Firestore!</span>
        </div>
      )}

      {/* Add New Authorized Admin Gmail Form */}
      <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
        <label className="block text-slate-300 font-semibold text-[11px] flex items-center gap-1.5">
          <UserCheck className="w-4 h-4 text-cyan-400" />
          <span>Add Pre-Authorized Administrator Gmail Account:</span>
        </label>

        <form onSubmit={handleAddEmail} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={newEmailInput}
              onChange={(e) => setNewEmailInput(e.target.value)}
              placeholder="e.g. yourname@gmail.com or admin@swiftstream.ph"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs shadow-md shadow-cyan-600/20 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Pre-Authorize Email</span>
          </button>
        </form>
        <p className="text-[10px] text-slate-500">
          Enter the exact Gmail address you use to sign in with Google.
        </p>
      </div>

      {/* Whitelisted Accounts Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
            Authorized Administrator Accounts ({authorizedEmails.length})
          </span>
          <span className="text-[10px] text-emerald-400 font-mono">
            ● Pre-Authorized for Google 1-Click Login
          </span>
        </div>

        <div className="space-y-2">
          {authorizedEmails.map((email, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 font-mono font-bold text-xs">
                  {idx + 1}
                </div>
                <div>
                  <span className="font-mono font-bold text-slate-200 text-xs">{email}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="px-2 py-0.2 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-[9px] font-semibold">
                      Full Admin Access (NOC)
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Google OAuth Whitelisted
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveEmail(email)}
                className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors"
                title="Revoke Administrator Authorization"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Security Policy Information */}
      <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400 space-y-2">
        <div className="flex items-center gap-2 text-amber-300 font-semibold">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>SSO Protection Policy Active</span>
        </div>
        <p>
          If any unauthorized Google account attempts to sign in via Google SSO, the session will be terminated immediately and denied access with an <em>Access Restricted</em> notification. Only the Gmail addresses listed above are permitted to manage billing, network hardware, and subscriber records.
        </p>
      </div>
    </div>
  );
};

