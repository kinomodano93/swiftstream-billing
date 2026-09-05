import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  MapPin,
  Wifi,
  Layers,
  Calendar,
  Check,
  Network,
  Server,
  RefreshCw,
  Zap,
  Key,
  Eye,
  EyeOff,
  Sparkles,
  Radio,
  CheckCircle2,
  AlertCircle,
  Shuffle,
  Search,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, CustomerStatus } from '../../types';
import { LAGONOY_BARANGAYS } from '../network/CoverageAreaManager';
import {
  fetchPppoeSecrets,
  provisionPppoeSecret,
  PppoeSecretItem,
} from '../../services/mikrotikApiService';

interface CustomerFormModalProps {
  customerToEdit?: Customer | null;
  onClose: () => void;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  customerToEdit,
  onClose,
}) => {
  const {
    addCustomer,
    updateCustomer,
    plans,
    napBoxes,
    businessProfile,
    mikrotikDevices,
    showToast,
  } = useApp();

  const isEditing = !!customerToEdit;

  // Personal Info
  const [fullName, setFullName] = useState(customerToEdit?.fullName || '');
  const [mobile, setMobile] = useState(customerToEdit?.mobile || '09');
  const [email, setEmail] = useState(customerToEdit?.email || '');
  const [street, setStreet] = useState(customerToEdit?.address.street || '');
  const [barangay, setBarangay] = useState(customerToEdit?.address.barangay || 'San Sebastian');
  const [city, setCity] = useState(customerToEdit?.address.city || businessProfile.address.city || 'Lagonoy');
  const [province, setProvince] = useState(customerToEdit?.address.province || businessProfile.address.province || 'Camarines Sur');
  const [landmark, setLandmark] = useState(customerToEdit?.address.landmark || '');

  // Plan & Billing
  const defaultPlan = plans[0];
  const [selectedPlanId, setSelectedPlanId] = useState(customerToEdit?.planId || defaultPlan?.id || '');
  const [billingDay, setBillingDay] = useState<number>(customerToEdit?.billingDay || 1);
  const [status, setStatus] = useState<CustomerStatus>(customerToEdit?.status || 'active');

  // MikroTik Linking & PPPoE Assignment
  const defaultRouter = mikrotikDevices.find((d) => d.role === 'core_pppoe') || mikrotikDevices[0];
  const [selectedMikrotikId, setSelectedMikrotikId] = useState<string>(
    customerToEdit?.network.mikrotikDeviceId || defaultRouter?.id || ''
  );
  const [pppoeMode, setPppoeMode] = useState<'create' | 'fetch'>('create');
  const [pppoeUsername, setPppoeUsername] = useState(
    customerToEdit?.network.pppoeUsername || ''
  );
  const [pppoePassword, setPppoePassword] = useState(
    customerToEdit?.network.pppoePassword || 'swift1234'
  );
  const [showPppoePassword, setShowPppoePassword] = useState(false);
  const [pppoeProfile, setPppoeProfile] = useState<string>(
    customerToEdit?.network.pppoeProfile || `Plan-${defaultPlan?.speedMbps || 25}M`
  );
  const [ipAddress, setIpAddress] = useState(
    customerToEdit?.network.ipAddress || '192.168.10.' + Math.floor(Math.random() * 200 + 10)
  );

  // Router Secrets Discovery State
  const [fetchedSecrets, setFetchedSecrets] = useState<PppoeSecretItem[]>([]);
  const [isFetchingSecrets, setIsFetchingSecrets] = useState<boolean>(false);
  const [selectedSecretName, setSelectedSecretName] = useState<string>('');
  const [autoSyncMikrotik, setAutoSyncMikrotik] = useState<boolean>(true);
  const [routerPasswordOverride, setRouterPasswordOverride] = useState<string>('');
  const [secretSearchQuery, setSecretSearchQuery] = useState<string>('');

  // Hardware details
  const [selectedNapBoxId, setSelectedNapBoxId] = useState(
    customerToEdit?.network.napBoxId || napBoxes[0]?.id || ''
  );
  const [napPortNumber, setNapPortNumber] = useState<number>(
    customerToEdit?.network.napPortNumber || 1
  );
  const [onuSerial, setOnuSerial] = useState(
    customerToEdit?.network.onuSerial || 'HWTC-' + Math.random().toString(36).substring(2, 10).toUpperCase()
  );
  const [routerModel, setRouterModel] = useState(
    customerToEdit?.network.routerModel || 'Huawei EG8145V5 Dual Band'
  );

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || defaultPlan;
  const selectedRouter = mikrotikDevices.find((d) => d.id === selectedMikrotikId) || defaultRouter;
  const currentNapBox = napBoxes.find((b) => b.id === selectedNapBoxId);

  // Filtered secrets based on user search query
  const filteredSecrets = fetchedSecrets.filter((s) => {
    if (!secretSearchQuery.trim()) return true;
    const q = secretSearchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.profile && s.profile.toLowerCase().includes(q)) ||
      (s.remoteAddress && s.remoteAddress.toLowerCase().includes(q)) ||
      (s.comment && s.comment.toLowerCase().includes(q))
    );
  });

  // Keep PPPoE profile in sync with selected plan when in create mode
  useEffect(() => {
    if (pppoeMode === 'create' && selectedPlan) {
      setPppoeProfile(`Plan-${selectedPlan.speedMbps}M`);
    }
  }, [selectedPlanId, pppoeMode]);

  // When full name changes, auto-suggest PPPoE username if empty
  const handleNameChange = (val: string) => {
    setFullName(val);
    if (!isEditing && !pppoeUsername) {
      const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 16);
      if (slug) setPppoeUsername(`swift_${slug}`);
    }
  };

  // Generate secure random password
  const handleGeneratePassword = () => {
    const num = Math.floor(1000 + Math.random() * 9000);
    const pass = `Swift#${num}`;
    setPppoePassword(pass);
    showToast('info', 'Password Generated', `New PPPoE secret password: ${pass}`);
  };

  // Fetch secrets directly from the selected MikroTik Router
  const handleFetchSecrets = async (overridePass?: string) => {
    if (!selectedRouter) {
      showToast('warning', 'No Router Selected', 'Please select a target MikroTik router first.');
      return;
    }
    setIsFetchingSecrets(true);
    const passToUse = overridePass !== undefined ? overridePass : (routerPasswordOverride || selectedRouter.password || '');
    try {
      const secrets = await fetchPppoeSecrets({
        ipAddress: selectedRouter.ipAddress,
        username: selectedRouter.username || 'admin',
        password: passToUse,
        port: selectedRouter.port || 10988,
        useHttps: selectedRouter.useSsl,
      });
      setFetchedSecrets(secrets);
      if (secrets.length > 0) {
        showToast('success', 'Secrets Discovered', `Discovered ${secrets.length} PPPoE secrets on ${selectedRouter.name} (${selectedRouter.ipAddress}).`);
      } else {
        showToast('info', 'No Secrets Found', `No PPPoE secrets found on ${selectedRouter.name}.`);
      }
    } catch (err: any) {
      showToast('error', 'Fetch Failed', err?.message || 'Failed to query MikroTik secrets.');
    } finally {
      setIsFetchingSecrets(false);
    }
  };

  // When user selects an existing secret from the fetched list
  const handleSelectExistingSecret = (secretName: string) => {
    setSelectedSecretName(secretName);
    const secret = fetchedSecrets.find((s) => s.name === secretName);
    if (!secret) return;

    setPppoeUsername(secret.name);
    if (secret.password && secret.password !== '••••••••') {
      setPppoePassword(secret.password);
    } else if (!pppoePassword || pppoePassword === '••••••••') {
      const randNum = Math.floor(1000 + Math.random() * 9000);
      setPppoePassword(`Swift#${randNum}`);
    }
    if (secret.remoteAddress) {
      setIpAddress(secret.remoteAddress);
    }
    if (secret.profile) {
      setPppoeProfile(secret.profile);
      // Attempt to auto-match plan speed or name
      const prof = secret.profile.toLowerCase();
      const matchedPlan = plans.find(
        (p) =>
          prof.includes(`${p.speedMbps}m`) ||
          prof.includes(p.name.toLowerCase()) ||
          p.name.toLowerCase().includes(prof)
      );
      if (matchedPlan) {
        setSelectedPlanId(matchedPlan.id);
      }
    }

    // Auto-populate full name from comment if currently empty
    if (!fullName.trim() && secret.comment) {
      const cleanName = secret.comment.split(/[-–|—(]/)[0].trim();
      if (cleanName && cleanName.length >= 3) {
        setFullName(cleanName);
      }
    }

    showToast('info', 'Secret Linked', `Loaded secret "${secret.name}" (${secret.profile || 'default'}) - ${secret.remoteAddress || 'Auto IP'}.`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !mobile.trim()) {
      alert('Please provide customer full name and mobile number.');
      return;
    }

    const finalPppoeUser =
      pppoeUsername.trim() ||
      `swift_${fullName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 16)}`;

    const networkData = {
      pppoeUsername: finalPppoeUser,
      pppoePassword: pppoePassword || 'swift1234',
      pppoeProfile: pppoeProfile || `Plan-${selectedPlan.speedMbps}M`,
      mikrotikDeviceId: selectedMikrotikId,
      ipAddress,
      napBoxId: selectedNapBoxId,
      napPortNumber,
      onuSerial,
      routerModel,
      vlanId: '100',
      oltPonPort: 'PON-1/1',
      isMikrotikSynced: autoSyncMikrotik,
    };

    if (isEditing && customerToEdit) {
      updateCustomer(customerToEdit.id, {
        fullName,
        mobile,
        email,
        address: {
          street,
          barangay,
          city,
          province,
          landmark,
        },
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        monthlyFee: selectedPlan.monthlyFee,
        billingDay,
        status,
        network: {
          ...customerToEdit.network,
          ...networkData,
        },
      });

      if (autoSyncMikrotik && selectedRouter) {
        provisionPppoeSecret(
          {
            ipAddress: selectedRouter.ipAddress,
            username: selectedRouter.username || 'admin',
            password: selectedRouter.password || '',
            port: selectedRouter.port || 80,
            useHttps: selectedRouter.useSsl,
          },
          {
            ...customerToEdit,
            fullName,
            accountNo: customerToEdit.accountNo,
            network: { ...customerToEdit.network, ...networkData },
          } as Customer,
          selectedPlan
        );
        showToast('success', 'Router Synced', `Subscriber "${finalPppoeUser}" provisioned to ${selectedRouter.name}.`);
      }
    } else {
      const year = new Date().getFullYear();
      const accountNo = `SWIFT-${year}-${String(Math.floor(Math.random() * 900) + 100)}`;

      const newCust = addCustomer({
        accountNo,
        fullName,
        mobile,
        email,
        address: {
          street,
          barangay,
          city,
          province,
          landmark,
        },
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        monthlyFee: selectedPlan.monthlyFee,
        billingDay,
        status: 'active',
        installationDate: new Date().toISOString().slice(0, 10),
        balance: 0,
        advanceDeposit: 0,
        network: networkData,
      });

      if (autoSyncMikrotik && selectedRouter) {
        provisionPppoeSecret(
          {
            ipAddress: selectedRouter.ipAddress,
            username: selectedRouter.username || 'admin',
            password: selectedRouter.password || '',
            port: selectedRouter.port || 80,
            useHttps: selectedRouter.useSsl,
          },
          newCust,
          selectedPlan
        );
        showToast('success', 'Router Synced', `New PPPoE secret "${finalPppoeUser}" provisioned to ${selectedRouter.name}.`);
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                {isEditing ? 'Edit Subscriber Details' : 'Register New Subscriber'}
              </h3>
              <p className="text-xs text-slate-400">
                Configure account, bandwidth plan, MikroTik router linking, and fiber drop box.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {/* Section 1: Customer Profile */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2 text-cyan-400">
              <User className="w-3.5 h-3.5" />
              <span>1. Customer Personal Information</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Mobile Number (PH) *</label>
                <input
                  type="text"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="0917xxxxxxx"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1 font-medium">Email Address (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@gmail.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Address & Location */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2 text-rose-400">
              <MapPin className="w-3.5 h-3.5" />
              <span>2. Installation Address & Landmark</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Street / Zone / Purok *</label>
                <input
                  type="text"
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Purok 2, Main Street"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Barangay (Lagonoy) *</label>
                <input
                  type="text"
                  required
                  list="customer-barangay-list"
                  value={barangay}
                  onChange={(e) => setBarangay(e.target.value)}
                  placeholder="Select or type barangay..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                <datalist id="customer-barangay-list">
                  {LAGONOY_BARANGAYS.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">City / Municipality</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Landmark (Crucial for Field Techs)</label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near Lagonoy cockpit arena, yellow gate"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Plan & Subscription */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2 text-cyan-400">
              <Layers className="w-3.5 h-3.5" />
              <span>3. Internet Service Plan & Billing Schedule</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Select Internet Plan *</label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₱{p.monthlyFee.toLocaleString()}/mo ({p.speedMbps} Mbps)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Monthly Billing Cut-Off Day</label>
                <select
                  value={billingDay}
                  onChange={(e) => setBillingDay(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value={1}>1st of Month (Due 10th)</option>
                  <option value={5}>5th of Month (Due 15th)</option>
                  <option value={10}>10th of Month (Due 20th)</option>
                  <option value={15}>15th of Month (Due 25th)</option>
                  <option value={20}>20th of Month (Due 30th)</option>
                  <option value={25}>25th of Month (Due 5th next mo)</option>
                </select>
              </div>

              {isEditing && (
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Account Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="active">Active (Normal)</option>
                    <option value="overdue">Overdue (Grace Period)</option>
                    <option value="suspended">Suspended (Cut Off)</option>
                    <option value="disconnected">Disconnected</option>
                    <option value="pending_install">Pending Installation</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: MikroTik Router Linking & PPPoE Assignment */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2 text-cyan-400">
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                <span>4. MikroTik Device Linking & PPPoE Assignment</span>
              </h4>

              {/* Assignment Mode Switcher */}
              <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl text-[11px]">
                <button
                  type="button"
                  onClick={() => setPppoeMode('create')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    pppoeMode === 'create'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Create New Secret
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPppoeMode('fetch');
                    if (fetchedSecrets.length === 0) {
                      handleFetchSecrets();
                    }
                  }}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    pppoeMode === 'fetch'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Fetch from Router
                </button>
              </div>
            </div>

            {/* Target MikroTik Device Selection */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="block text-slate-300 font-semibold text-xs flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-purple-400" />
                  <span>Target MikroTik BNG Router *</span>
                </label>
                {selectedRouter && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/70 text-emerald-300 border border-emerald-800/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online ({selectedRouter.ipAddress})
                  </span>
                )}
              </div>

              <select
                value={selectedMikrotikId}
                onChange={(e) => {
                  setSelectedMikrotikId(e.target.value);
                  setFetchedSecrets([]);
                  setSelectedSecretName('');
                }}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-medium focus:outline-none focus:border-cyan-500"
              >
                {mikrotikDevices.length === 0 ? (
                  <option value="">No MikroTik Routers Configured (Optional)</option>
                ) : (
                  mikrotikDevices.map((dev) => (
                    <option key={dev.id} value={dev.id}>
                      {dev.name} — {dev.model} ({dev.ipAddress}) [{dev.role.replace('_', ' ').toUpperCase()}]
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Mode 1: Create New PPPoE Secret */}
            {pppoeMode === 'create' ? (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-cyan-900/30 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    Configure New PPPoE Secret & Bandwidth Profile
                  </span>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline font-semibold cursor-pointer"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Generate Password</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">PPPoE Username *</label>
                    <input
                      type="text"
                      required
                      value={pppoeUsername}
                      onChange={(e) => setPppoeUsername(e.target.value)}
                      placeholder="swift_username"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">PPPoE Password *</label>
                    <div className="relative">
                      <input
                        type={showPppoePassword ? 'text' : 'password'}
                        required
                        value={pppoePassword}
                        onChange={(e) => setPppoePassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 pr-10 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPppoePassword(!showPppoePassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showPppoePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">PPPoE Profile Rate-Limit</label>
                    <input
                      type="text"
                      value={pppoeProfile}
                      onChange={(e) => setPppoeProfile(e.target.value)}
                      placeholder="Plan-25M / default"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Remote / Framed IP Address *</label>
                    <input
                      type="text"
                      required
                      value={ipAddress}
                      onChange={(e) => setIpAddress(e.target.value)}
                      placeholder="192.168.10.25"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Mode 2: Fetch / Link Existing Secret from MikroTik */
              <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-purple-400" />
                      Live Router PPPoE Secret Discovery
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Query RouterOS <code>/ppp/secret</code> on {selectedRouter?.name || 'Router'} ({selectedRouter?.ipAddress})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isFetchingSecrets}
                      onClick={() => handleFetchSecrets()}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20 cursor-pointer disabled:opacity-50"
                    >
                      {isFetchingSecrets ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Querying RouterOS...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Fetch Secrets</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Optional Router REST Password Override */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/80 border border-purple-800/30 text-xs">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1.5">
                      <Key className="w-3 h-3 text-purple-400" />
                      <span>Router REST Password (Optional Override)</span>
                    </label>
                    <input
                      type="password"
                      value={routerPasswordOverride}
                      onChange={(e) => setRouterPasswordOverride(e.target.value)}
                      placeholder={selectedRouter?.password ? '•••••••• (Using Stored Password)' : 'Enter router password if required'}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <p className="text-[11px] text-slate-400">
                      Target Gateway: <span className="font-mono text-purple-300 font-semibold">{selectedRouter?.ipAddress}:{selectedRouter?.port || 10988}</span>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Zero CORS / Mixed Content enabled via backend REST bridge.
                    </p>
                  </div>
                </div>

                {fetchedSecrets.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <label className="block text-slate-300 font-semibold text-xs flex items-center gap-1.5">
                        <span>Discovered Secrets ({filteredSecrets.length} of {fetchedSecrets.length}):</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={secretSearchQuery}
                          onChange={(e) => setSecretSearchQuery(e.target.value)}
                          placeholder="Search secrets by user, IP, profile..."
                          className="w-full sm:w-64 pl-8 pr-3 py-1 bg-slate-900 border border-purple-700/50 rounded-lg text-slate-200 placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-purple-400"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Quick Interactive Secret Cards List */}
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-purple-900">
                      {filteredSecrets.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 text-xs">
                          No secrets matching "{secretSearchQuery}".
                        </div>
                      ) : (
                        filteredSecrets.map((sec) => {
                          const isSelected = selectedSecretName === sec.name;
                          return (
                            <div
                              key={sec.name}
                              onClick={() => handleSelectExistingSecret(sec.name)}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? 'bg-purple-900/40 border-purple-500 text-white shadow-sm ring-1 ring-purple-500/30'
                                  : 'bg-slate-900/70 border-slate-800/80 text-slate-300 hover:border-purple-700/60 hover:bg-slate-900'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-xs text-purple-300 truncate">
                                    {sec.name}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/50 font-mono">
                                    {sec.profile || 'default'}
                                  </span>
                                  {sec.remoteAddress && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                                      {sec.remoteAddress}
                                    </span>
                                  )}
                                  {sec.disabled && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/50 font-mono">
                                      Disabled
                                    </span>
                                  )}
                                </div>
                                {sec.comment && (
                                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                    {sec.comment}
                                  </p>
                                )}
                              </div>
                              <div className="shrink-0 ml-2">
                                {isSelected ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800/60">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    Linked
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectExistingSecret(sec.name);
                                    }}
                                    className="px-2.5 py-1 text-[10px] font-semibold bg-purple-900/40 hover:bg-purple-800 text-purple-200 rounded-lg border border-purple-700/50 transition-colors"
                                  >
                                    Select & Fill
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Summary of Selected Secret */}
                    {selectedSecretName && (
                      <div className="p-3.5 rounded-xl bg-purple-950/60 border border-purple-700/60 text-xs font-mono text-slate-300 space-y-1.5 animate-in fade-in">
                        <div className="flex justify-between items-center text-emerald-400 font-bold mb-1 pb-1 border-b border-purple-800/40">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            Secret Successfully Linked & Form Auto-Populated
                          </span>
                          <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800 font-sans">
                            Ready
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">PPPoE User:</span>
                          <span className="text-purple-300 font-bold">{pppoeUsername}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Framed IP:</span>
                          <span className="text-cyan-300 font-bold">{ipAddress}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">RouterOS Profile:</span>
                          <span className="text-emerald-300">{pppoeProfile}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Matched Plan:</span>
                          <span className="text-amber-300 font-sans font-semibold">{selectedPlan?.name} ({selectedPlan?.speedMbps} Mbps)</span>
                        </div>
                        {fullName && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Customer Name:</span>
                            <span className="text-slate-200 font-sans font-semibold">{fullName}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs space-y-3 bg-slate-900/40 rounded-xl border border-slate-800/80">
                    <p>No secrets loaded yet. Click below to query the router or load discovered secrets.</p>
                    <button
                      type="button"
                      disabled={isFetchingSecrets}
                      onClick={() => handleFetchSecrets()}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20 cursor-pointer inline-flex items-center gap-1.5"
                    >
                      {isFetchingSecrets ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>Fetch Secrets from {selectedRouter?.name || 'Router'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Auto-Sync Toggle */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auto-sync-toggle"
                  checked={autoSyncMikrotik}
                  onChange={(e) => setAutoSyncMikrotik(e.target.checked)}
                  className="rounded accent-cyan-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="auto-sync-toggle" className="text-slate-300 text-xs font-medium cursor-pointer">
                  Auto-provision & sync PPPoE secret to MikroTik BNG router on submit
                </label>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono">REST API Ready</span>
            </div>

            {/* Fiber Distribution Point (NAP & Hardware) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Fiber NAP Box Distribution Point</label>
                <select
                  value={selectedNapBoxId}
                  onChange={(e) => setSelectedNapBoxId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {napBoxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      {box.code} ({box.name}) - Brgy. {box.barangay}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  NAP Port Number (1 to {currentNapBox?.totalPorts || 16})
                </label>
                <select
                  value={napPortNumber}
                  onChange={(e) => setNapPortNumber(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {Array.from({ length: currentNapBox?.totalPorts || 16 }, (_, i) => i + 1).map((portNum) => {
                    const port = currentNapBox?.ports.find((p) => p.portNumber === portNum);
                    const isTaken = port?.status === 'occupied' && port.customerId !== customerToEdit?.id;
                    return (
                      <option key={portNum} value={portNum} disabled={isTaken}>
                        Port #{portNum} {isTaken ? `(Occupied: ${port?.customerName})` : '(Available)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">ONU Serial Number (ONT)</label>
                <input
                  type="text"
                  value={onuSerial}
                  onChange={(e) => setOnuSerial(e.target.value)}
                  placeholder="HWTC-XXXXXXXX"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Router / Modem Model</label>
                <input
                  type="text"
                  value={routerModel}
                  onChange={(e) => setRouterModel(e.target.value)}
                  placeholder="Huawei EG8145V5 Dual Band"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes' : 'Register Subscriber'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

