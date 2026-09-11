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
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, CustomerStatus } from '../../types';
import { LAGONOY_BARANGAYS, PRESENTACION_BARANGAYS } from '../network/CoverageAreaManager';
import {
  fetchPppoeSecrets,
  fetchPppoeProfilesDetailed,
  provisionPppoeSecret,
  saveOrUpdatePppoeSecret,
  MikrotikCredentials,
  PppoeSecretItem,
  PppoeProfileItem,
} from '../../services/mikrotikApiService';
import { signUpWithEmail } from '../../services/authService';

interface CustomerFormModalProps {
  customerToEdit?: Customer | null;
  onClose: () => void;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  customerToEdit,
  onClose,
}) => {
  const {
    customers,
    addCustomer,
    updateCustomer,
    updateMikrotikDevice,
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

  // Portal Authentication Credentials (only for new subscribers — creates Firebase Auth account)
  const [portalEmail, setPortalEmail] = useState(customerToEdit?.email || '');
  const [portalPassword, setPortalPassword] = useState('Swift@2025');
  const [showPortalPassword, setShowPortalPassword] = useState(false);
  const [createPortalAccount, setCreatePortalAccount] = useState(!isEditing);
  const [portalAccountCreated, setPortalAccountCreated] = useState(false);

  // Plan & Billing
  const defaultPlan = plans[0];
  const [selectedPlanId, setSelectedPlanId] = useState(customerToEdit?.planId || defaultPlan?.id || '');
  const [billingDay, setBillingDay] = useState<number>(customerToEdit?.billingDay || 1);
  const [status, setStatus] = useState<CustomerStatus>(customerToEdit?.status || 'active');

  // MikroTik Linking & PPPoE Assignment
  const defaultRouter = mikrotikDevices.find((d) => d.role === 'core_pppoe') || mikrotikDevices[0];
  const [selectedMikrotikId, setSelectedMikrotikId] = useState<string>(
    customerToEdit?.network?.mikrotikDeviceId || defaultRouter?.id || ''
  );
  const [pppoeMode, setPppoeMode] = useState<'create' | 'fetch'>('create');
  const [pppoeUsername, setPppoeUsername] = useState(
    customerToEdit?.network?.pppoeUsername || ''
  );
  const [pppoePassword, setPppoePassword] = useState(
    customerToEdit?.network?.pppoePassword || (isEditing ? '' : 'swift1234')
  );
  const [showPppoePassword, setShowPppoePassword] = useState(false);
  const [pppoeProfile, setPppoeProfile] = useState<string>(
    customerToEdit?.network?.pppoeProfile || `Plan-${defaultPlan?.speedMbps || 25}M`
  );
  const [ipAddress, setIpAddress] = useState(
    customerToEdit?.network?.ipAddress || ''
  );
  const [dynamicIp, setDynamicIp] = useState<boolean>(
    // Default to dynamic unless the existing customer has a static IP stored
    !customerToEdit?.network?.ipAddress
  );

  // Router Secrets Discovery State
  const [fetchedSecrets, setFetchedSecrets] = useState<PppoeSecretItem[]>([]);
  const [isFetchingSecrets, setIsFetchingSecrets] = useState<boolean>(false);
  const [selectedSecretName, setSelectedSecretName] = useState<string>('');
  const [autoSyncMikrotik, setAutoSyncMikrotik] = useState<boolean>(true);
  const [routerPasswordOverride, setRouterPasswordOverride] = useState<string>('');
  const [secretSearchQuery, setSecretSearchQuery] = useState<string>('');
  const [fetchAuth401, setFetchAuth401] = useState<boolean>(false);
  const [showRouterPassword, setShowRouterPassword] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // PPPoE Profile Discovery State
  const [fetchedProfiles, setFetchedProfiles] = useState<PppoeProfileItem[]>([]);
  const [isFetchingProfiles, setIsFetchingProfiles] = useState<boolean>(false);

  // Hardware details
  const [selectedNapBoxId, setSelectedNapBoxId] = useState(
    customerToEdit?.network?.napBoxId || napBoxes[0]?.id || ''
  );
  const [napPortNumber, setNapPortNumber] = useState<number>(
    customerToEdit?.network?.napPortNumber || 1
  );
  const [onuSerial, setOnuSerial] = useState(
    customerToEdit?.network?.onuSerial || 'HWTC-' + Math.random().toString(36).substring(2, 10).toUpperCase()
  );
  const [routerModel, setRouterModel] = useState(
    customerToEdit?.network?.routerModel || 'Huawei EG8145V5 Dual Band'
  );

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || defaultPlan;
  const selectedRouter =
    mikrotikDevices.find((d) => d.id === selectedMikrotikId || d.name === selectedMikrotikId) ||
    defaultRouter;
  const currentNapBox = napBoxes.find((b) => b.id === selectedNapBoxId);

  // Keep all fields in sync when customerToEdit prop updates
  useEffect(() => {
    if (customerToEdit) {
      setFullName(customerToEdit.fullName || '');
      setMobile(customerToEdit.mobile || '09');
      setEmail(customerToEdit.email || '');
      setStreet(customerToEdit.address?.street || '');
      setBarangay(customerToEdit.address?.barangay || 'San Sebastian');
      setCity(customerToEdit.address?.city || businessProfile.address?.city || 'Lagonoy');
      setProvince(customerToEdit.address?.province || businessProfile.address?.province || 'Camarines Sur');
      setLandmark(customerToEdit.address?.landmark || '');
      setSelectedPlanId(customerToEdit.planId || defaultPlan?.id || '');
      setBillingDay(customerToEdit.billingDay || 1);
      setStatus(customerToEdit.status || 'active');
      setSelectedMikrotikId(customerToEdit.network?.mikrotikDeviceId || defaultRouter?.id || '');
      setPppoeUsername(customerToEdit.network?.pppoeUsername || '');
      setPppoeProfile(customerToEdit.network?.pppoeProfile || `Plan-${defaultPlan?.speedMbps || 25}M`);
      setIpAddress(customerToEdit.network?.ipAddress || '');
      setDynamicIp(!customerToEdit.network?.ipAddress);
      setSelectedNapBoxId(customerToEdit.network?.napBoxId || napBoxes[0]?.id || '');
      setNapPortNumber(customerToEdit.network?.napPortNumber || 1);
      setOnuSerial(customerToEdit.network?.onuSerial || '');
      setRouterModel(customerToEdit.network?.routerModel || 'Huawei EG8145V5 Dual Band');
      setSubmitError(null);
    }
  }, [customerToEdit]);

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
    setFetchAuth401(false);
    setSubmitError(null);
    const passToUse = overridePass !== undefined ? overridePass : (routerPasswordOverride || selectedRouter.password || '');
    try {
      const secrets = await fetchPppoeSecrets({
        id: selectedRouter.id,
        name: selectedRouter.name,
        ipAddress: selectedRouter.remoteAddress || selectedRouter.ipAddress || 'remote.oxapsph.com',
        username: selectedRouter.username || 'admin',
        password: passToUse,
        port: selectedRouter.port || selectedRouter.webfigPort || selectedRouter.apiPort || 10988,
        useHttps: selectedRouter.useSsl,
      });
      setFetchedSecrets(secrets);
      if (secrets.length > 0) {
        showToast('success', 'Secrets Discovered', `Discovered ${secrets.length} PPPoE secrets on ${selectedRouter.name}.`);
      } else {
        showToast('info', 'No Secrets Found', `No PPPoE secrets found on ${selectedRouter.name}.`);
      }
      if (passToUse && passToUse !== selectedRouter.password) {
        updateMikrotikDevice(selectedRouter.id, { password: passToUse });
      }
    } catch (err: any) {
      const msg: string = err?.message || '';
      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('authentication failed')) {
        setFetchAuth401(true);
      } else {
        showToast('error', 'Fetch Failed', msg || 'Failed to query MikroTik secrets.');
      }
    } finally {
      setIsFetchingSecrets(false);
    }
  };

  // Fetch PPPoE profiles from the linked MikroTik router
  const handleFetchProfiles = async (overridePass?: string) => {
    if (!selectedRouter) {
      showToast('warning', 'No Router Selected', 'Please select a target MikroTik router first.');
      return;
    }
    setIsFetchingProfiles(true);
    setFetchAuth401(false);
    const passToUse = overridePass !== undefined ? overridePass : (routerPasswordOverride || selectedRouter.password || '');
    try {
      const result = await fetchPppoeProfilesDetailed({
        id: selectedRouter.id,
        name: selectedRouter.name,
        ipAddress: selectedRouter.remoteAddress || selectedRouter.ipAddress || 'remote.oxapsph.com',
        username: selectedRouter.username || 'admin',
        password: passToUse,
        port: selectedRouter.port || selectedRouter.webfigPort || selectedRouter.apiPort || 10988,
        useHttps: selectedRouter.useSsl,
      });
      if (result.success && result.data.length > 0) {
        setFetchedProfiles(result.data);
        if (passToUse && passToUse !== selectedRouter.password) {
          updateMikrotikDevice(selectedRouter.id, { password: passToUse });
        }
        // Auto-select a profile that matches the current plan speed
        const speedMbps = selectedPlan?.speedMbps;
        const matched = result.data.find(
          (p) =>
            p.name.toLowerCase().includes(`${speedMbps}m`) ||
            p.name.toLowerCase() === `plan-${speedMbps}m` ||
            p.rateLimit?.toLowerCase().includes(`${speedMbps}m`) ||
            p.rateLimitRx?.toLowerCase().includes(`${speedMbps}m`)
        );
        if (matched) {
          setPppoeProfile(matched.name);
          showToast('success', 'Profile Matched', `Auto-selected profile "${matched.name}" for Plan-${speedMbps}M.`);
        } else {
          showToast('success', 'Profiles Loaded', `${result.data.length} profiles fetched from ${selectedRouter.name}. Please select one.`);
        }
      } else if (result.statusCode === 401 || result.error === 'Unauthorized') {
        setFetchAuth401(true);
        showToast('error', 'Authentication Required', result.message || 'RouterOS authentication failed (HTTP 401). Please enter the router password.');
      } else {
        showToast('warning', 'No Profiles Found', result.message || result.error || 'No PPPoE profiles returned from router.');
      }
    } catch (err: any) {
      const msg: string = err?.message || '';
      if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
        setFetchAuth401(true);
        showToast('error', 'Authentication Required', 'RouterOS authentication failed (HTTP 401). Please enter the router password.');
      } else {
        showToast('error', 'Profile Fetch Failed', msg || 'Failed to query PPPoE profiles from router.');
      }
    } finally {
      setIsFetchingProfiles(false);
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

  const handleSubmit = async (e: React.FormEvent, bypassSync = false) => {
    e.preventDefault();

    if (!fullName.trim() || !mobile.trim()) {
      setSubmitError('Please provide customer full name and mobile number.');
      return;
    }

    // Business rule: Mobile phone must be at least 10 digits
    const cleanMobile = mobile.replace(/[^0-9]/g, '');
    if (cleanMobile.length < 10) {
      setSubmitError('Please provide a valid 10-11 digit Philippine mobile number (e.g. 09171234567).');
      return;
    }

    const finalPppoeUser =
      pppoeUsername.trim() ||
      `swift_${fullName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 16)}`;

    // Business rule: Check PPPoE username uniqueness across subscribers
    const pppoeDuplicate = customers.find(
      (c) =>
        c.network?.pppoeUsername &&
        c.network.pppoeUsername.toLowerCase().trim() === finalPppoeUser.toLowerCase().trim() &&
        c.id !== customerToEdit?.id
    );
    if (pppoeDuplicate) {
      setSubmitError(
        `PPPoE Dial-Up Username "${finalPppoeUser}" is already in use by subscriber "${pppoeDuplicate.fullName}" (${pppoeDuplicate.accountNo}). PPPoE usernames must be unique.`
      );
      return;
    }

    // Business rule: Check email uniqueness if email was provided
    if (email.trim()) {
      const emailDuplicate = customers.find(
        (c) =>
          c.email &&
          c.email.toLowerCase().trim() === email.trim().toLowerCase() &&
          c.id !== customerToEdit?.id
      );
      if (emailDuplicate) {
        setSubmitError(
          `Email address "${email.trim()}" is already assigned to subscriber "${emailDuplicate.fullName}" (${emailDuplicate.accountNo}).`
        );
        return;
      }
    }

    setSubmitError(null);
    setIsSaving(true);


    const networkData: any = {
      pppoeUsername: finalPppoeUser,
      pppoeProfile: pppoeProfile || `Plan-${selectedPlan.speedMbps}M`,
      mikrotikDeviceId: selectedRouter?.id || selectedMikrotikId,
      ipAddress: dynamicIp ? '' : ipAddress,
      napBoxId: selectedNapBoxId,
      napPortNumber,
      onuSerial,
      routerModel,
      vlanId: '100',
      oltPonPort: 'PON-1/1',
      isMikrotikSynced: autoSyncMikrotik && !bypassSync,
    };

    if (pppoePassword && pppoePassword.trim() && pppoePassword !== '••••••••') {
      networkData.pppoePassword = pppoePassword.trim();
    } else if (!isEditing) {
      networkData.pppoePassword = 'swift1234';
    }

    const targetHost = selectedRouter?.remoteAddress || selectedRouter?.ipAddress || 'remote.oxapsph.com';
    const targetPort = selectedRouter?.port || selectedRouter?.webfigPort || selectedRouter?.apiPort || 10988;
    const routerPass = routerPasswordOverride || selectedRouter?.password || '';

    // If an updated router admin password was entered, persist it to device config
    if (selectedRouter && routerPasswordOverride && routerPasswordOverride !== selectedRouter.password) {
      updateMikrotikDevice(selectedRouter.id, { password: routerPasswordOverride });
    }

    // Step 1: Save/Update PPPoE Secret directly on the linked MikroTik device
    if (autoSyncMikrotik && selectedRouter && !bypassSync) {
      try {
        const routerCreds: MikrotikCredentials = {
          id: selectedRouter.id,
          name: selectedRouter.name,
          ipAddress: targetHost,
          port: targetPort,
          username: selectedRouter.username || 'admin',
          password: routerPass,
          useHttps: selectedRouter.useSsl,
        };

        const syncRes = await saveOrUpdatePppoeSecret(routerCreds, {
          name: finalPppoeUser,
          password: networkData.pppoePassword, // only updates password on router if non-empty
          service: 'pppoe',
          profile: networkData.pppoeProfile,
          remoteAddress: dynamicIp ? undefined : ipAddress, // omit → router assigns from pool
          comment: `${fullName.trim()} - ${isEditing && customerToEdit ? customerToEdit.accountNo : 'NEW'}`,
          disabled: status === 'suspended' || status === 'disconnected',
          speedMbps: selectedPlan.speedMbps,
          accountNo: isEditing && customerToEdit ? customerToEdit.accountNo : undefined,
        });

        if (!syncRes.success) {
          setIsSaving(false);
          setSubmitError(syncRes.message);
          if (syncRes.message.includes('401') || syncRes.message.toLowerCase().includes('unauthorized')) {
            setFetchAuth401(true);
          }
          showToast('error', 'MikroTik Save Failed', syncRes.message);
          return; // STOP! Keep modal open so administrator can correct credentials
        }

        networkData.isMikrotikSynced = true;
      } catch (syncErr: any) {
        setIsSaving(false);
        const errMsg = syncErr?.message || 'Failed to communicate with MikroTik router.';
        setSubmitError(errMsg);
        showToast('error', 'MikroTik Error', errMsg);
        return;
      }
    }

    // Step 2: Persist Customer profile (Firestore excludes pppoePassword automatically)
    if (isEditing && customerToEdit) {
      updateCustomer(
        customerToEdit.id,
        {
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
        },
        { skipMikrotikSync: true }
      );

      showToast(
        'success',
        'Subscriber Updated',
        selectedRouter && !bypassSync
          ? `PPPoE secret "${finalPppoeUser}" saved directly into ${selectedRouter.name} hardware.`
          : `Subscriber ${fullName} updated successfully.`
      );
    } else {
      const year = new Date().getFullYear();
      const accountNo = `SWIFT-${year}-${String(Math.floor(Math.random() * 900) + 100)}`;

      // Step: Create Firebase Auth portal account for the subscriber (if requested)
      const finalPortalEmail = portalEmail.trim() || email.trim();
      if (createPortalAccount && finalPortalEmail && portalPassword.trim()) {
        try {
          await signUpWithEmail(finalPortalEmail, portalPassword.trim(), fullName, 'subscriber', {
            accountNo,
            planId: selectedPlan.id,
            planName: selectedPlan.name,
            monthlyFee: selectedPlan.monthlyFee,
            mobile,
          });
          setPortalAccountCreated(true);
        } catch (portalErr: any) {
          const msg: string = portalErr?.message || 'Failed to create portal account.';
          // email-already-in-use is OK — subscriber may have self-registered previously
          if (!msg.toLowerCase().includes('already') && !msg.toLowerCase().includes('in-use')) {
            setIsSaving(false);
            setSubmitError(`Portal account error: ${msg}`);
            showToast('error', 'Portal Account Failed', msg);
            return;
          }
          // If already exists, continue — they'll still be linked by email
        }
      }

      addCustomer(
        {
          accountNo,
          fullName,
          mobile,
          email: finalPortalEmail || email,
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
        },
        { skipMikrotikSync: true }
      );

      showToast(
        'success',
        'Subscriber Registered',
        selectedRouter && !bypassSync
          ? `New PPPoE secret "${finalPppoeUser}" provisioned into ${selectedRouter.name}. ${createPortalAccount && finalPortalEmail ? 'Portal account created ✓' : ''}`
          : `Subscriber ${fullName} registered. ${createPortalAccount && finalPortalEmail ? 'Portal login: ' + finalPortalEmail : ''}`
      );
    }

    setIsSaving(false);
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

          {/* Portal Login Credentials — only shown for new subscriber creation */}
          {!isEditing && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2 text-cyan-400">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Client Portal Login Account</span>
                </h4>
                <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setCreatePortalAccount((v) => !v)}>
                  <span className="text-[11px] text-slate-400">Create portal account</span>
                  <div className={`w-9 h-5 rounded-full transition-colors relative ${createPortalAccount ? 'bg-cyan-600' : 'bg-slate-700'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${createPortalAccount ? 'left-4.5' : 'left-0.5'}`} />
                  </div>
                </div>
              </div>

              {createPortalAccount ? (
                <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 space-y-3">
                  <p className="text-[11px] text-cyan-300/80 leading-relaxed">
                    Creates a <strong className="text-cyan-200">Firebase Auth account</strong> so this subscriber can log into the <strong className="text-cyan-200">Client Portal</strong> with email + password.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium text-xs">Portal Login Email *</label>
                      <input
                        type="email"
                        value={portalEmail}
                        onChange={(e) => setPortalEmail(e.target.value)}
                        placeholder="subscriber@gmail.com"
                        className="w-full px-3 py-2 bg-slate-950 border border-cyan-800/50 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500 text-sm"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-400 font-medium text-xs">Portal Password *</label>
                        <button
                          type="button"
                          onClick={() => setPortalPassword(`Swift@${Math.floor(1000 + Math.random() * 9000)}`)}
                          className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                        >
                          <Shuffle className="w-3 h-3" />
                          Generate
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPortalPassword ? 'text' : 'password'}
                          value={portalPassword}
                          onChange={(e) => setPortalPassword(e.target.value)}
                          placeholder="Min. 6 characters"
                          className="w-full px-3 py-2 pr-9 bg-slate-950 border border-cyan-800/50 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPortalPassword(!showPortalPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        >
                          {showPortalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Share these credentials with the subscriber so they can track their bills and payments on the portal.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-500 text-[11px]">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>No portal account — subscriber can self-register later from the Home page.</span>
                </div>
              )}
            </div>
          )}

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
                <label className="block text-slate-400 mb-1 font-medium">City / Municipality *</label>
                <select
                  value={city}
                  onChange={(e) => {
                    const selectedCity = e.target.value;
                    setCity(selectedCity);
                    if (selectedCity === 'Presentacion') {
                      setBarangay(PRESENTACION_BARANGAYS[0] || 'Ayugao');
                    } else if (selectedCity === 'Lagonoy') {
                      setBarangay(LAGONOY_BARANGAYS[0] || 'Binauahan');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="Lagonoy">Municipality of Lagonoy</option>
                  <option value="Presentacion">Municipality of Presentacion</option>
                  {!['Lagonoy', 'Presentacion'].includes(city) && city && (
                    <option value={city}>{city}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Barangay *</label>
                <input
                  type="text"
                  required
                  list="customer-barangay-list"
                  value={barangay}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBarangay(val);
                    if (PRESENTACION_BARANGAYS.some((pb) => pb.toLowerCase() === val.toLowerCase())) {
                      setCity('Presentacion');
                    } else if (LAGONOY_BARANGAYS.some((lb) => lb.toLowerCase() === val.toLowerCase())) {
                      setCity('Lagonoy');
                    }
                  }}
                  placeholder={`Select or type barangay in ${city || 'Lagonoy'}...`}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                <datalist id="customer-barangay-list">
                  {(city === 'Presentacion' ? PRESENTACION_BARANGAYS : LAGONOY_BARANGAYS).map((b) => (
                    <option key={b} value={b} label={`${b}, ${city || 'Lagonoy'}`} />
                  ))}
                </datalist>
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

            {/* Target MikroTik Device Selection & Hardware Auth */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="block text-slate-300 font-semibold text-xs flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-purple-400" />
                  <span>Linked MikroTik BNG Router *</span>
                </label>
                {selectedRouter && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/70 text-emerald-300 border border-emerald-800/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Target: {selectedRouter.remoteAddress || selectedRouter.ipAddress || 'remote.oxapsph.com'}:{selectedRouter.port || selectedRouter.webfigPort || selectedRouter.apiPort || 10988}
                  </span>
                )}
              </div>

              <select
                value={selectedMikrotikId}
                onChange={(e) => {
                  setSelectedMikrotikId(e.target.value);
                  setFetchedSecrets([]);
                  setSelectedSecretName('');
                  setSubmitError(null);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-medium focus:outline-none focus:border-cyan-500"
              >
                {mikrotikDevices.length === 0 ? (
                  <option value="">No MikroTik Routers Configured (Optional)</option>
                ) : (
                  mikrotikDevices.map((dev) => (
                    <option key={dev.id} value={dev.id}>
                      {dev.name} — {dev.model} ({dev.remoteAddress || dev.ipAddress}:{dev.port || dev.webfigPort || 10988}) [{dev.role.replace('_', ' ').toUpperCase()}]
                    </option>
                  ))
                )}
              </select>

              {/* Router Authentication Status / Input */}
              {selectedRouter && (
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  {(selectedRouter.password || routerPasswordOverride) && !showRouterPassword && !fetchAuth401 ? (
                    <div className="flex items-center justify-between text-[11px] px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-slate-300 font-medium">RouterOS Admin Auth:</span>
                        <span className="text-emerald-400 font-mono">Password Stored</span>
                        <span className="text-slate-500 font-mono text-[10px]">({selectedRouter.username || 'admin'})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRouterPassword(true)}
                        className="text-cyan-400 hover:text-cyan-300 text-[11px] underline underline-offset-2 cursor-pointer"
                      >
                        Change Password
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/50 space-y-2">
                      <div className="flex items-center justify-between text-xs text-amber-300 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-amber-400" />
                          RouterOS Admin Password
                        </span>
                        <span className="text-[10px] text-amber-400/80 font-mono">user: {selectedRouter.username || 'admin'}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showRouterPassword ? 'text' : 'password'}
                            value={routerPasswordOverride || selectedRouter.password || ''}
                            onChange={(e) => {
                              setRouterPasswordOverride(e.target.value);
                              setFetchAuth401(false);
                            }}
                            placeholder="Enter router admin password..."
                            className="w-full pl-3 pr-8 py-1.5 bg-slate-950 border border-amber-700/60 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRouterPassword(!showRouterPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                          >
                            {showRouterPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        {(selectedRouter.password || routerPasswordOverride) && (
                          <button
                            type="button"
                            onClick={() => setShowRouterPassword(false)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg font-medium"
                          >
                            Done
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Required to authorize RouterOS REST API to save PPPoE secrets into this router hardware.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Submit / Sync Error Banner */}
              {submitError && (
                <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-600/80 space-y-2.5 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-rose-300 font-bold text-xs">MikroTik Router Provisioning Failed</p>
                      <p className="text-rose-400/90 text-[11px] mt-0.5 leading-relaxed font-mono">{submitError}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-rose-900/50">
                    <button
                      type="button"
                      onClick={(e) => handleSubmit(e, true)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[11px] font-semibold transition-colors shadow-sm cursor-pointer"
                    >
                      Bypass MikroTik Sync (Save to Database Only)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubmitError(null)}
                      className="px-3 py-1 text-slate-400 hover:text-slate-200 text-[11px] cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mode 1: Create New PPPoE Secret */}
            {pppoeMode === 'create' ? (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-cyan-900/30 space-y-4">
                {/* Hardware Vault Security Notice */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-cyan-300 text-[11px] leading-relaxed">
                  <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-cyan-200">MikroTik Hardware Vault: </span>
                    <span>PPPoE secrets are saved directly into your router device via RouterOS REST API. Passwords are <strong className="text-white">strictly excluded</strong> from Firebase Cloud storage for security.</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    {isEditing ? 'Update PPPoE Secret & Bandwidth Profile' : 'Configure New PPPoE Secret & Bandwidth Profile'}
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
                    <label className="block text-slate-400 mb-1 font-medium">
                      PPPoE Password {isEditing ? '(Optional)' : '*'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPppoePassword ? 'text' : 'password'}
                        required={!isEditing}
                        value={pppoePassword}
                        onChange={(e) => setPppoePassword(e.target.value)}
                        placeholder={isEditing ? '•••••••• (Preserve router secret)' : 'Enter password'}
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
                    {isEditing && (
                      <p className="text-[10px] text-slate-500 mt-1">
                        Stored on router device. Type a new password to update MikroTik, or leave blank to keep unchanged.
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-400 font-medium">PPPoE Profile Rate-Limit</label>
                      <button
                        type="button"
                        onClick={() => handleFetchProfiles()}
                        disabled={isFetchingProfiles || !selectedRouter}
                        className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isFetchingProfiles ? 'animate-spin' : ''}`} />
                        <span>{isFetchingProfiles ? 'Fetching…' : 'Fetch from Router'}</span>
                      </button>
                    </div>
                    {fetchedProfiles.length > 0 ? (
                      <select
                        value={pppoeProfile}
                        onChange={(e) => setPppoeProfile(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-cyan-800/60 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      >
                        {fetchedProfiles.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}{p.rateLimit ? ` — ${p.rateLimit}` : p.rateLimitRx ? ` — ↓${p.rateLimitRx}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={pppoeProfile}
                        onChange={(e) => setPppoeProfile(e.target.value)}
                        placeholder="Click 'Fetch from Router' or type manually"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    )}
                    {fetchedProfiles.length > 0 && (
                      <p className="text-[10px] text-cyan-600 mt-1">{fetchedProfiles.length} profiles loaded from {selectedRouter?.name}.</p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-slate-400 font-medium">Remote / Framed IP Address</label>
                      <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-0.5 border border-slate-700">
                        <button
                          type="button"
                          onClick={() => { setDynamicIp(true); setIpAddress(''); }}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${dynamicIp ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          Dynamic
                        </button>
                        <button
                          type="button"
                          onClick={() => setDynamicIp(false)}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${!dynamicIp ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          Static
                        </button>
                      </div>
                    </div>
                    {dynamicIp ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-400 text-[11px] font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                        <span>Assigned dynamically by router IP pool (no static address)</span>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={ipAddress}
                        onChange={(e) => setIpAddress(e.target.value)}
                        placeholder="192.168.10.25"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    )}
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


                {/* 401 Auth Banner — shown automatically when router rejects credentials */}
                {fetchAuth401 ? (
                  <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-600/60 space-y-2">
                    <div className="flex items-start gap-2">
                      <Key className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-amber-300 font-semibold text-xs">Router Authentication Required</p>
                        <p className="text-amber-400/80 text-[11px] mt-0.5">
                          {selectedRouter?.name} ({selectedRouter?.ipAddress}:{selectedRouter?.port || selectedRouter?.webfigPort || 10988}) returned HTTP 401 — password incorrect or not set.
                          Enter the RouterOS <span className="font-mono font-bold">admin</span> password and click Retry.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showRouterPassword ? 'text' : 'password'}
                          value={routerPasswordOverride}
                          onChange={(e) => setRouterPasswordOverride(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && routerPasswordOverride) handleFetchSecrets(routerPasswordOverride); }}
                          placeholder="Enter router password..."
                          autoFocus
                          className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-amber-700/60 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRouterPassword(!showRouterPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        >
                          {showRouterPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={!routerPasswordOverride || isFetchingSecrets}
                        onClick={() => handleFetchSecrets(routerPasswordOverride)}
                        className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
                      >
                        {isFetchingSecrets ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Retry
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Compact optional override — only visible when no 401 */
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <Key className="w-3 h-3 text-slate-600 shrink-0" />
                    <span>Target: <span className="font-mono text-slate-400">{selectedRouter?.ipAddress}:{selectedRouter?.port || selectedRouter?.webfigPort || 10988}</span></span>
                    {(selectedRouter?.password) ? (
                      <span className="text-emerald-600 font-mono">• password stored</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setFetchAuth401(true)}
                        className="text-amber-500 hover:text-amber-400 underline underline-offset-2"
                      >
                        enter password
                      </button>
                    )}
                  </div>
                )}

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
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving to MikroTik...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isEditing ? 'Save Changes' : 'Register Subscriber'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

