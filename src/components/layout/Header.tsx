import React from 'react';
import {
  Search,
  Plus,
  CreditCard,
  Zap,
  Calendar,
  MapPin,
  RefreshCw,
  Download,
  Radio,
  Globe,
  LogOut,
  Server,
  LogIn,
  UserPlus,
  Shield,
  User,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface HeaderProps {
  onOpenPaymentModal: () => void;
  onOpenCustomerModal: () => void;
  onOpenBatchBillingModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenPaymentModal,
  onOpenCustomerModal,
  onOpenBatchBillingModal,
}) => {
  const {
    searchTerm,
    setSearchTerm,
    businessProfile,
    exportData,
    resetToDefault,
    setActiveTab,
    mikrotikDevices,
    logout,
    currentAuthUser,
    openAuthModal,
  } = useApp();

  const currentDateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  const coreRouter = mikrotikDevices.find((d) => d.role === 'core_pppoe') || mikrotikDevices[0];

  return (
    <header className="h-16 bg-slate-900/90 border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
      {/* Search Input */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search subscriber, account #, invoice, phone, IP, or NAP..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Center Details */}
      <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400">
        {coreRouter && (
          <button
            onClick={() => setActiveTab('mikrotik')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 font-mono text-[11px] transition-all"
            title="MikroTik Core Router Online - Click to open fleet manager"
          >
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>CCR2004 ({coreRouter.ipAddress})</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping ml-0.5" />
          </button>
        )}
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/40 border border-slate-800">
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          <span>{currentDateStr}</span>
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/40 border border-slate-800">
          <MapPin className="w-3.5 h-3.5 text-rose-400" />
          <span>{businessProfile.address.barangay}, {businessProfile.address.city}</span>
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          title="Open Public Website Home Page"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Website</span>
        </button>

        <button
          onClick={() => setActiveTab('portal')}
          className="flex items-center gap-1.5 px-3 py-2 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          title="Open Customer Self-Service Client Portal"
        >
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>Portal</span>
        </button>

        <button
          onClick={onOpenPaymentModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Collect (POS)</span>
        </button>

        <button
          onClick={onOpenCustomerModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Client</span>
        </button>

        <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

        {/* Firebase Authentication Buttons / User Profile */}
        {currentAuthUser ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-2xl">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                {currentAuthUser.photoURL ? (
                  <img src={currentAuthUser.photoURL} alt="Avatar" className="w-full h-full rounded-xl object-cover" />
                ) : (
                  currentAuthUser.displayName?.slice(0, 2) || currentAuthUser.email?.slice(0, 2) || 'US'
                )}
              </div>
              <div className="hidden md:block text-left">
                <span className="block text-[11px] font-bold text-slate-200 truncate max-w-[120px]">
                  {currentAuthUser.displayName || currentAuthUser.email}
                </span>
                <span className="block text-[9px] font-mono font-semibold uppercase text-cyan-400">
                  {currentAuthUser.role}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-2 text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 border border-transparent hover:border-rose-800/40 rounded-xl transition-all"
              title="Sign Out of Firebase Session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => openAuthModal('signin')}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Sign in with Firebase"
            >
              <LogIn className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sign In</span>
            </button>

            <button
              onClick={() => openAuthModal('signup')}
              className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Register new account in Firebase"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Sign Up</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

