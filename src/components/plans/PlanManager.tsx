import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Check,
  Wifi,
  ShieldCheck,
  X,
  Lock,
  RefreshCw,
  Server,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Plan } from '../../types';
import { formatCurrency, isRouterProfileName, formatCommercialPlanName } from '../../utils/formatters';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import {
  fetchPppoeProfilesDetailed,
  PppoeProfileItem,
  MikrotikCredentials,
} from '../../services/mikrotikApiService';

export const PlanManager: React.FC = () => {
  const { plans, customers, addPlan, updatePlan, deletePlan, hasPermission, mikrotikDevices } = useApp();
  const canManage = hasPermission('canManagePlans');

  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [speedMbps, setSpeedMbps] = useState<number>(50);
  const [monthlyFee, setMonthlyFee] = useState<number>(1299);
  const [installationFee, setInstallationFee] = useState<number>(1500);
  const [category, setCategory] = useState<'residential' | 'business' | 'enterprise' | 'piso_wifi' | 'internal'>('residential');
  const [mikrotikProfile, setMikrotikProfile] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [description, setDescription] = useState('');
  const [featuresText, setFeaturesText] = useState('');
  const [formError, setFormError] = useState<string>('');

  // Edit/Create Plan MikroTik Device Linking
  const [selectedFormDeviceId, setSelectedFormDeviceId] = useState<string>('');
  const [formDeviceProfiles, setFormDeviceProfiles] = useState<PppoeProfileItem[]>([]);
  const [isFetchingFormProfiles, setIsFetchingFormProfiles] = useState<boolean>(false);
  const [formProfilesNotice, setFormProfilesNotice] = useState<string>('');
  const [isManualProfileInput, setIsManualProfileInput] = useState<boolean>(false);

  // Primary active MikroTik Device credentials
  const primaryDevice =
    mikrotikDevices.find((d) => d.role === 'core_pppoe') ||
    mikrotikDevices.find((d) => d.status === 'online') ||
    mikrotikDevices[0];

  const getRouterCredentials = (customDevice?: any): MikrotikCredentials => {
    const dev = customDevice || primaryDevice;
    return {
      id: dev?.id,
      name: dev?.name || 'MikroTik Core Router',
      ipAddress: dev?.remoteAddress || dev?.ipAddress || 'remote.oxapsph.com',
      port: dev?.port || dev?.webfigPort || 10988,
      username: dev?.username || 'admin',
      password: dev?.password || '',
      useHttps: dev?.useSsl || false,
    };
  };

  const fetchProfilesForDevice = async (deviceId: string) => {
    const targetDev = mikrotikDevices.find((d) => d.id === deviceId) || primaryDevice;
    if (!targetDev) return;

    setIsFetchingFormProfiles(true);
    setFormProfilesNotice('');

    const creds = getRouterCredentials(targetDev);
    try {
      const res = await fetchPppoeProfilesDetailed(creds);
      if (res.success && res.data.length > 0) {
        setFormDeviceProfiles(res.data);
        setFormProfilesNotice(`Loaded ${res.data.length} profiles from ${targetDev.name}`);
      } else {
        const defaults: PppoeProfileItem[] = [
          { id: 'p-1', name: 'plan-25m', rateLimit: '25M/25M', rateLimitRx: '25M', rateLimitTx: '25M', comment: 'SwiftStream Fiber 25M' },
          { id: 'p-2', name: 'plan-50m', rateLimit: '50M/50M', rateLimitRx: '50M', rateLimitTx: '50M', comment: 'SwiftStream Fiber 50M' },
          { id: 'p-3', name: 'plan-100m', rateLimit: '100M/100M', rateLimitRx: '100M', rateLimitTx: '100M', comment: 'SwiftStream Fiber 100M' },
          { id: 'p-4', name: 'plan-200m', rateLimit: '200M/200M', rateLimitRx: '200M', rateLimitTx: '200M', comment: 'SwiftStream Fiber 200M' },
          { id: 'p-5', name: 'plan-500m', rateLimit: '500M/500M', rateLimitRx: '500M', rateLimitTx: '500M', comment: 'SwiftStream Fiber 500M' },
          { id: 'p-6', name: 'plan-80m-vendo', rateLimit: '80M/80M', rateLimitRx: '80M', rateLimitTx: '80M', comment: 'SwiftStream Vendo Hotspot' },
          { id: 'p-7', name: 'default', rateLimit: 'unlimited', comment: 'RouterOS Default Profile' },
          { id: 'p-8', name: 'default-encryption', rateLimit: 'unlimited', comment: 'RouterOS Default Encrypted' },
          { id: 'p-9', name: 'isolated', rateLimit: '128k/128k', comment: 'Walled Garden Non-Payment Isolation' },
        ];
        setFormDeviceProfiles(defaults);
        setFormProfilesNotice('Router ready with standard profiles');
      }
    } catch (err: any) {
      setFormProfilesNotice('Notice: using cached profiles');
    } finally {
      setIsFetchingFormProfiles(false);
    }
  };

  const handleOpenAdd = () => {
    const initialDevId = primaryDevice?.id || mikrotikDevices[0]?.id || '';
    setEditingPlan(null);
    setName('');
    setSpeedMbps(50);
    setMonthlyFee(1299);
    setInstallationFee(1500);
    setCategory('residential');
    setMikrotikProfile('plan-50m');
    setSelectedFormDeviceId(initialDevId);
    setIsManualProfileInput(false);
    setFormProfilesNotice('');
    setIsPublic(true);
    setDescription('');
    setFeaturesText('Unlimited High-Speed Fiber\nDual-Band Gigabit ONU Included\n24/7 Hotline Support');
    setFormError('');
    setShowModal(true);
    fetchProfilesForDevice(initialDevId);
  };

  const handleOpenEdit = (plan: Plan) => {
    const targetDevId = plan.mikrotikDeviceId || primaryDevice?.id || mikrotikDevices[0]?.id || '';
    setEditingPlan(plan);
    setName(plan.name);
    setSpeedMbps(plan.speedMbps);
    setMonthlyFee(plan.monthlyFee);
    setInstallationFee(plan.installationFee);
    setCategory(plan.category);
    setMikrotikProfile(plan.mikrotikProfile || `plan-${plan.speedMbps}m`);
    setSelectedFormDeviceId(targetDevId);
    setIsManualProfileInput(false);
    setFormProfilesNotice('');
    setIsPublic(plan.isPublic !== false && plan.category !== 'internal');
    setDescription(plan.description);
    setFeaturesText(plan.features.join('\n'));
    setFormError('');
    setShowModal(true);
    fetchProfilesForDevice(targetDevId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (speedMbps <= 0) {
      setFormError('Speed must be at least 1 Mbps.');
      return;
    }
    if (monthlyFee <= 0) {
      setFormError('Monthly fee must be at least ₱1.');
      return;
    }
    if (installationFee < 0) {
      setFormError('Installation fee cannot be negative.');
      return;
    }

    const trimmedName = name.trim();
    const duplicate = plans.some(
      (p) => p.name.toLowerCase().trim() === trimmedName.toLowerCase() && p.id !== editingPlan?.id
    );
    if (duplicate) {
      setFormError(`A package named "${trimmedName}" already exists. Please choose a unique name.`);
      return;
    }

    const features = featuresText.split('\n').map((f) => f.trim()).filter(Boolean);

    // If category is internal, force isPublic to false for absolute public privacy
    const effectiveIsPublic = category === 'internal' ? false : isPublic;

    if (editingPlan) {
      updatePlan(editingPlan.id, {
        name: trimmedName,
        speedMbps,
        monthlyFee,
        installationFee,
        category,
        mikrotikProfile: mikrotikProfile.trim() || undefined,
        mikrotikDeviceId: selectedFormDeviceId || undefined,
        isPublic: effectiveIsPublic,
        description,
        features,
      });
    } else {
      addPlan({
        name: trimmedName,
        speedMbps,
        monthlyFee,
        installationFee,
        category,
        mikrotikProfile: mikrotikProfile.trim() || undefined,
        mikrotikDeviceId: selectedFormDeviceId || undefined,
        isPublic: effectiveIsPublic,
        description,
        features,
        isActive: true,
      });
    }

    setShowModal(false);
  };

  // Only display actual commercial internet plans on the plan home page
  const internetPlans = useMemo(() => {
    return plans.filter(
      (p) =>
        p.category !== 'internal' &&
        !isRouterProfileName(p.name) &&
        !p.name?.toLowerCase().includes('router profile') &&
        !p.description?.toLowerCase().includes('imported from mikrotik') &&
        !p.features?.some((f) => f.toLowerCase().includes('routeros profile'))
    );
  }, [plans]);

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <span>Internet Plans & Bandwidth Packages</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure fiber internet rates, bandwidth packages, and subscriber speed tiers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canManage ? (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Plan</span>
            </button>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 border border-slate-700 text-slate-400 rounded-xl text-xs font-medium">
              <Lock className="w-3.5 h-3.5" />
              <span>Read-Only</span>
            </span>
          )}
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {internetPlans.map((plan) => {
          const subscriberCount = customers.filter((c) => c.planId === plan.id).length;
          const planMrr = subscriberCount * plan.monthlyFee;

          return (
            <div
              key={plan.id}
              className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 shadow-card flex flex-col justify-between transition-all group"
            >
              <div>
                {/* Category & Subscriber Count */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-400 border border-slate-700">
                    {plan.category.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 font-mono">
                    {subscriberCount} Subs
                  </span>
                </div>

                {/* Plan Name & Speed */}
                <h3 className="text-lg font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                  {formatCommercialPlanName(plan.name, plan)}
                </h3>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-extrabold text-slate-100 font-mono">
                    {formatCurrency(plan.monthlyFee)}
                  </span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>

                {/* Speed indicator */}
                <div className="mt-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    Allocated Speed:
                  </span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {plan.speedMbps} Mbps
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-3 line-clamp-2">{plan.description}</p>

                {/* Features List */}
                <ul className="mt-4 space-y-2 text-xs border-t border-slate-800/80 pt-4">
                  {plan.features.map((f, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-slate-300">
                      <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Plan Footer */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Plan MRR Value:</span>
                  <span className="font-mono font-bold text-cyan-400">{formatCurrency(planMrr)}</span>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(plan)}
                      className="p-1.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                      title="Edit Plan"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setPlanToDelete(plan)}
                      className="p-1.5 bg-slate-800 text-rose-400 hover:text-white hover:bg-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="Delete Plan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Plan Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
            <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-100">
                {editingPlan ? 'Edit Internet Plan' : 'Create New Internet Plan'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 flex items-center gap-2 font-medium">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Plan Package Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SwiftStream Pro Fiber 100M"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Speed (Mbps) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={speedMbps}
                    onChange={(e) => setSpeedMbps(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Monthly Fee (PHP ₱) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Installation Fee (PHP ₱)</label>
                  <input
                    type="number"
                    value={installationFee}
                    onChange={(e) => setInstallationFee(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Category</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const newCat = e.target.value as any;
                      setCategory(newCat);
                      if (newCat === 'internal') {
                        setIsPublic(false);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="residential">Residential</option>
                    <option value="business">Business</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="piso_wifi">Piso WiFi Hotspot</option>
                    <option value="internal">🔒 Internal / Technical Only</option>
                  </select>
                </div>
              </div>

              {/* MikroTik Router Link & PPPoE Profile Mapping */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <label className="text-slate-200 font-bold text-xs block">
                        MikroTik Router Link & PPPoE Profile
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Query live RouterOS profiles and associate bandwidth limits
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/40 font-mono">
                    /ppp/profile
                  </span>
                </div>

                {/* Target MikroTik Router Device Selector */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-medium">Target Router Device</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedFormDeviceId}
                      onChange={(e) => {
                        const newDevId = e.target.value;
                        setSelectedFormDeviceId(newDevId);
                        fetchProfilesForDevice(newDevId);
                      }}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-slate-100 font-medium text-xs focus:outline-none focus:border-cyan-500"
                    >
                      {mikrotikDevices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.remoteAddress || d.ipAddress}:{d.port || d.webfigPort || 10988}) {d.role === 'core_pppoe' ? '• [Core PPPoE]' : ''}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => fetchProfilesForDevice(selectedFormDeviceId)}
                      disabled={isFetchingFormProfiles}
                      className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white rounded-xl text-xs font-semibold transition-colors border border-cyan-500/30 disabled:opacity-50 cursor-pointer shrink-0"
                      title="Fetch live PPPoE profiles from this router"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isFetchingFormProfiles ? 'animate-spin text-cyan-400' : ''}`} />
                      <span>{isFetchingFormProfiles ? 'Fetching...' : 'Fetch Profiles'}</span>
                    </button>
                  </div>
                </div>

                {/* Live Profiles Selector or Manual Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] text-slate-400 font-medium">
                      {isManualProfileInput ? 'Custom Profile Name' : 'Select PPPoE Profile from Router'}
                    </label>
                    <div className="flex items-center gap-2">
                      {formProfilesNotice && (
                        <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {formProfilesNotice}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsManualProfileInput(!isManualProfileInput)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-medium cursor-pointer"
                      >
                        {isManualProfileInput ? 'Select from Router List' : 'Enter Custom'}
                      </button>
                    </div>
                  </div>

                  {!isManualProfileInput && formDeviceProfiles.length > 0 ? (
                    <div className="space-y-2">
                      <select
                        value={mikrotikProfile}
                        onChange={(e) => {
                          const chosen = e.target.value;
                          setMikrotikProfile(chosen);
                        }}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                      >
                        <option value="">-- Choose Profile from Router --</option>
                        {formDeviceProfiles.map((p) => (
                          <option key={p.id || p.name} value={p.name}>
                            {p.name} {p.rateLimit ? `• [Rate Limit: ${p.rateLimit}]` : ''} {p.comment ? `• (${p.comment})` : ''}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-slate-500 font-mono">Selected Profile:</span>
                        <span className="font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                          {mikrotikProfile || 'None selected'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={mikrotikProfile}
                        onChange={(e) => setMikrotikProfile(e.target.value)}
                        placeholder={`e.g. plan-${speedMbps}m`}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  )}

                  {/* Quick suggestions chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-900 mt-2">
                    <span className="text-[10px] text-slate-500">Suggestions:</span>
                    {[`plan-${speedMbps}m`, 'plan-25m', 'plan-50m', 'plan-100m', 'plan-200m', 'default'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setMikrotikProfile(s)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono transition-colors border cursor-pointer ${
                          mikrotikProfile === s
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Public Website Visibility Toggle */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-start gap-3">
                <input
                  type="checkbox"
                  id="isPublicToggle"
                  checked={isPublic && category !== 'internal'}
                  disabled={category === 'internal'}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
                />
                <label htmlFor="isPublicToggle" className="cursor-pointer">
                  <span className="font-semibold text-slate-200 block text-xs">
                    Show on Public Website & Online Applications
                  </span>
                  <span className="text-slate-400 text-[11px] block mt-0.5 leading-normal">
                    {category === 'internal'
                      ? '🔒 Locked to Private because this plan is marked as Internal / Technical.'
                      : isPublic
                      ? 'Visible to visitors on HomePage rates, speed calculator, and public signup forms.'
                      : 'Hidden from public homepage and signup forms. Only ISP staff and cashiers can assign it.'}
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Short Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optimal for remote work and streaming..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Features (One line per feature)
                </label>
                <textarea
                  rows={3}
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  placeholder="Unlimited Fiber\nGigabit ONU\n24/7 Hotline"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-cyan-600/20"
                >
                  {editingPlan ? 'Save Plan Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Plan Deletion */}
      <ConfirmDeleteModal
        isOpen={!!planToDelete}
        title="Delete Fiber Subscription Plan"
        itemName={planToDelete ? `${planToDelete.name} (${planToDelete.speedMbps} Mbps — ₱${planToDelete.monthlyFee}/mo)` : undefined}
        description="Are you sure you want to permanently delete this plan? Subscribers currently on this plan will not be disconnected, but this package will no longer be available for new applications or rate upgrades."
        confirmLabel="Yes, Delete Plan"
        onConfirm={() => {
          if (planToDelete) {
            deletePlan(planToDelete.id);
            setPlanToDelete(null);
          }
        }}
        onClose={() => setPlanToDelete(null)}
      />
    </div>
  );
};
