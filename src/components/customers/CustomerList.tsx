import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  FileText,
  Eye,
  Edit2,
  Trash2,
  Wifi,
  MapPin,
  FileSpreadsheet,
  CheckCircle2,
  Radio,
  ExternalLink,
  Zap,
  KeyRound,
  PauseCircle,
  PlayCircle,
  Activity,
  CheckSquare,
  Square,
  MinusSquare,
  X,
  MessageSquare,
  AlignJustify,
  List,
  Loader2,
  Send,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, CustomerStatus, ReminderType } from '../../types';
import { formatCurrency, formatPhoneNumber, getCustomerStatusBadge, formatCommercialPlanName, isRouterProfileName } from '../../utils/formatters';
import { ProvisionModal } from './ProvisionModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { ConfirmActionModal } from '../common/ConfirmActionModal';
import { ResetCustomerPasswordModal } from './ResetCustomerPasswordModal';
import {
  fetchPppoeActiveSessions,
  MikrotikCredentials,
  PppoeActiveSessionItem,
} from '../../services/mikrotikApiService';

const getOpticalPowerBadge = (dbm?: number) => {
  if (dbm === undefined || dbm === null || isNaN(dbm)) {
    return {
      text: 'Awaiting OPM',
      statusText: '',
      badgeClass: 'bg-slate-800/80 text-slate-400 border-slate-700/60',
      dotClass: 'bg-slate-500',
    };
  }
  if (dbm >= -24 && dbm <= -15) {
    return {
      text: `${dbm} dBm`,
      statusText: 'Optimal',
      badgeClass: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60',
      dotClass: 'bg-emerald-400',
    };
  }
  if (dbm < -24 && dbm >= -27) {
    return {
      text: `${dbm} dBm`,
      statusText: 'Warning',
      badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
      dotClass: 'bg-amber-400',
    };
  }
  return {
    text: `${dbm} dBm`,
    statusText: 'Critical / LOS',
    badgeClass: 'bg-rose-950/80 text-rose-400 border-rose-800/60',
    dotClass: 'bg-rose-400',
  };
};

interface CustomerListProps {
  onOpenCustomerModal: (customer?: Customer) => void;
  onSelectCustomer: (customerId: string) => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({
  onOpenCustomerModal,
  onSelectCustomer,
}) => {
  const {
    customers,
    deleteCustomer,
    toggleCustomerStatus,
    syncCustomerMikrotik,
    searchTerm,
    setSearchTerm,
    plans,
    napBoxes,
    setActiveTab,
    hasPermission,
    mikrotikDevices,
    sendReminder,
  } = useApp();

  // Table density mode persisted in localStorage
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    return (localStorage.getItem('swiftstream_table_density') as 'comfortable' | 'compact') || 'comfortable';
  });

  const handleDensityChange = (newDensity: 'comfortable' | 'compact') => {
    setDensity(newDensity);
    localStorage.setItem('swiftstream_table_density', newDensity);
  };

  // Multi-select state
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchActionNotice, setBatchActionNotice] = useState<string | null>(null);
  const [isBatchSmsModalOpen, setIsBatchSmsModalOpen] = useState(false);
  const [batchSmsType, setBatchSmsType] = useState<ReminderType | 'custom'>('due_today');
  const [batchCustomMessage, setBatchCustomMessage] = useState('');

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [barangayFilter, setBarangayFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [selectedCustomerForProvision, setSelectedCustomerForProvision] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [customerForPasswordReset, setCustomerForPasswordReset] = useState<Customer | null>(null);
  const [statusActionCustomer, setStatusActionCustomer] = useState<{ customer: Customer; targetStatus: CustomerStatus } | null>(null);

  // Live PPPoE active sessions tracking
  const [activeSessionUsernames, setActiveSessionUsernames] = useState<Set<string>>(new Set());
  const [activeSessionMap, setActiveSessionMap] = useState<Map<string, PppoeActiveSessionItem>>(new Map());

  useEffect(() => {
    const primaryRouter = mikrotikDevices?.find((d) => d.role === 'core_pppoe') || mikrotikDevices?.[0];
    if (!primaryRouter) return;
    const creds: MikrotikCredentials = {
      id: primaryRouter.id,
      name: primaryRouter.name,
      ipAddress: primaryRouter.remoteAddress || primaryRouter.ipAddress || 'remote.oxapsph.com',
      port: primaryRouter.port || primaryRouter.webfigPort || 10988,
      username: primaryRouter.username || 'admin',
      password: primaryRouter.password || '',
      useHttps: primaryRouter.useSsl || false,
    };
    fetchPppoeActiveSessions(creds)
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const set = new Set<string>();
          const map = new Map<string, PppoeActiveSessionItem>();
          res.data.forEach((s) => {
            const u = (s.username || (s as any).name)?.toLowerCase();
            if (u) {
              set.add(u);
              map.set(u, s);
            }
          });
          setActiveSessionUsernames(set);
          setActiveSessionMap(map);
        }
      })
      .catch(() => {});
  }, [mikrotikDevices]);


  // Extract unique barangays
  const barangays = Array.from(new Set(customers.map((c) => c.address.barangay)));

  // Filter logic
  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.accountNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.mobile.includes(searchTerm) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.address.barangay.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.address.street.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.network.pppoeUsername.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.network.ipAddress.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
    const matchesBarangay = barangayFilter === 'all' || customer.address.barangay === barangayFilter;
    const matchesPlan = planFilter === 'all' || customer.planId === planFilter;

    return matchesSearch && matchesStatus && matchesBarangay && matchesPlan;
  });

  // Multi-select helpers
  const isAllSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((c) => selectedCustomerIds.has(c.id));
  const isSomeSelected =
    filteredCustomers.some((c) => selectedCustomerIds.has(c.id)) && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCustomerIds(new Set());
    } else {
      const next = new Set(selectedCustomerIds);
      filteredCustomers.forEach((c) => next.add(c.id));
      setSelectedCustomerIds(next);
    }
  };

  const toggleSelectCustomer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedCustomerIds(new Set());
  };

  const exportToCSV = (targetList = filteredCustomers, filenameSuffix = '') => {
    const headers = [
      'Account No',
      'Full Name',
      'Mobile',
      'Email',
      'Barangay',
      'Street',
      'Landmark',
      'Plan',
      'Monthly Fee',
      'Status',
      'Balance',
      'PPPoE User',
      'IP Address',
      'NAP Box',
      'NAP Port',
    ];

    const rows = targetList.map((c) => [
      c.accountNo,
      `"${c.fullName}"`,
      c.mobile,
      c.email,
      c.address.barangay,
      `"${c.address.street}"`,
      `"${c.address.landmark || ''}"`,
      `"${c.planName}"`,
      c.monthlyFee,
      c.status,
      c.balance,
      c.network.pppoeUsername,
      c.network.ipAddress,
      c.network.napBoxId,
      c.network.napPortNumber,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `swiftstream_subscribers${filenameSuffix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const exportSelectedToCSV = () => {
    const selectedList = filteredCustomers.filter((c) => selectedCustomerIds.has(c.id));
    if (selectedList.length === 0) return;
    exportToCSV(selectedList, `_selected_${selectedList.length}`);
  };

  const handleBatchMikrotikSync = async () => {
    const targetCustomers = customers.filter((c) => selectedCustomerIds.has(c.id));
    if (targetCustomers.length === 0) return;
    setIsBatchProcessing(true);
    setBatchActionNotice(`Synchronizing ${targetCustomers.length} lines to MikroTik...`);
    try {
      let count = 0;
      for (const cust of targetCustomers) {
        await syncCustomerMikrotik(cust.id);
        count++;
      }
      setBatchActionNotice(`Successfully synchronized ${count} subscriber accounts to MikroTik router.`);
      setTimeout(() => setBatchActionNotice(null), 4000);
    } catch (err) {
      console.error('Batch sync error:', err);
      setBatchActionNotice('Completed with some sync warnings.');
      setTimeout(() => setBatchActionNotice(null), 4000);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchSmsDispatch = async () => {
    const targetCustomers = customers.filter((c) => selectedCustomerIds.has(c.id));
    if (targetCustomers.length === 0) return;
    setIsBatchProcessing(true);
    setBatchActionNotice(`Dispatching SMS notifications to ${targetCustomers.length} subscribers...`);
    setIsBatchSmsModalOpen(false);
    try {
      let count = 0;
      for (const cust of targetCustomers) {
        if (cust.mobile) {
          const type: ReminderType = batchSmsType === 'custom' ? 'general_advisory' : batchSmsType;
          const customText = batchSmsType === 'custom' ? batchCustomMessage : undefined;
          await sendReminder(cust.id, type, 'sms', undefined, customText);
          count++;
        }
      }
      setBatchActionNotice(`Successfully sent SMS notifications to ${count} subscribers.`);
      setTimeout(() => setBatchActionNotice(null), 4000);
    } catch (err) {
      console.error('Batch SMS error:', err);
      setBatchActionNotice('Encountered an issue dispatching some messages.');
      setTimeout(() => setBatchActionNotice(null), 4000);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in">
      {/* Notice Banner */}
      {batchActionNotice && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 border border-cyan-500/60 text-cyan-200 rounded-xl shadow-2xl animate-in slide-in-from-top-3 backdrop-blur-md text-xs font-semibold">
          <Activity className="w-4 h-4 text-cyan-400 animate-spin" />
          <span>{batchActionNotice}</span>
          <button onClick={() => setBatchActionNotice(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>Subscribers Directory (ISP CRM)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage fiber subscriptions, billing profiles, network allocations, and Mikrotik states.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Table Density Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-0.5 text-xs">
            <button
              type="button"
              onClick={() => handleDensityChange('comfortable')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                density === 'comfortable'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Comfortable Density (Spacious rows)"
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Comfortable</span>
            </button>
            <button
              type="button"
              onClick={() => handleDensityChange('compact')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                density === 'compact'
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Compact Density (More rows visible for operators/cashiers)"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Compact</span>
            </button>
          </div>

          <button
            onClick={() => exportToCSV()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => onOpenCustomerModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span>Register Subscriber</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/80 pb-3">
          {[
            { id: 'all', label: 'All Subscribers', count: customers.length },
            { id: 'pending_approval', label: 'Pending Review', count: customers.filter((c) => c.status === 'pending_approval').length },
            { id: 'active', label: 'Active', count: customers.filter((c) => c.status === 'active').length },
            { id: 'overdue', label: 'Overdue', count: customers.filter((c) => c.status === 'overdue').length },
            { id: 'suspended', label: 'Suspended (Cut)', count: customers.filter((c) => c.status === 'suspended').length },
            { id: 'pending_install', label: 'Pending Install', count: customers.filter((c) => c.status === 'pending_install').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === tab.id
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === tab.id ? 'bg-cyan-700 text-cyan-100' : 'bg-slate-800 text-slate-400'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Dropdown Filters & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, account #, phone, IP..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Barangays / Locations</option>
              {barangays.map((bg) => (
                <option key={bg} value={bg}>
                  Brgy. {bg}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Bandwidth Plans</option>
              {plans
                .filter(
                  (p) =>
                    p.category !== 'internal' &&
                    !isRouterProfileName(p.name) &&
                    !p.name?.toLowerCase().includes('router profile') &&
                    !p.description?.toLowerCase().includes('imported from mikrotik') &&
                    !p.features?.some((f) => f.toLowerCase().includes('routeros profile'))
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatCommercialPlanName(p.name, p)} (₱{p.monthlyFee.toLocaleString()})
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Subscribers Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <th className={`${density === 'compact' ? 'py-2 px-2.5' : 'py-3.5 px-4'} w-10 text-center`}>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center justify-center p-0.5 rounded cursor-pointer"
                    title={isAllSelected ? 'Deselect all' : 'Select all filtered'}
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-cyan-400" />
                    ) : isSomeSelected ? (
                      <MinusSquare className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500 hover:text-slate-300" />
                    )}
                  </button>
                </th>
                <th className={`${density === 'compact' ? 'py-2 px-3 text-[11px]' : 'py-3.5 px-4'}`}>Account / Subscriber</th>
                <th className={`${density === 'compact' ? 'py-2 px-3 text-[11px]' : 'py-3.5 px-4'}`}>Location / Landmark</th>
                <th className={`${density === 'compact' ? 'py-2 px-3 text-[11px]' : 'py-3.5 px-4'}`}>Plan & Rate</th>
                <th className={`${density === 'compact' ? 'py-2 px-3 text-[11px]' : 'py-3.5 px-4'}`}>Network & NAP Port</th>
                <th className={`${density === 'compact' ? 'py-2 px-3 text-[11px]' : 'py-3.5 px-4'}`}>Balance</th>
                <th className={`${density === 'compact' ? 'py-2 px-3 text-[11px]' : 'py-3.5 px-4'}`}>Status</th>
                <th className={`${density === 'compact' ? 'py-2 px-3 text-[11px]' : 'py-3.5 px-4'} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No subscribers found matching the current filters.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const isSelected = selectedCustomerIds.has(customer.id);
                  const statusBadge = getCustomerStatusBadge(customer.status);
                  const assignedNap = napBoxes.find((n) => n.id === customer.network.napBoxId);

                  return (
                    <tr
                      key={customer.id}
                      className={`${isSelected ? 'bg-cyan-950/30 border-l-2 border-l-cyan-400' : 'hover:bg-slate-800/40'} transition-colors`}
                    >
                      {/* Checkbox */}
                      <td
                        className={`${density === 'compact' ? 'py-1.5 px-2.5' : 'py-3 px-4'} text-center`}
                        onClick={(e) => toggleSelectCustomer(customer.id, e)}
                      >
                        <button
                          type="button"
                          className="text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center justify-center p-0.5 rounded cursor-pointer"
                          title={isSelected ? 'Deselect subscriber' : 'Select subscriber'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* Name & Contact */}
                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3 px-4'}`}>
                        <button
                          onClick={() => onSelectCustomer(customer.id)}
                          className="font-bold text-slate-100 hover:text-cyan-400 transition-colors text-left block"
                        >
                          {customer.fullName}
                        </button>
                        <div className={`flex items-center gap-2 mt-0.5 ${density === 'compact' ? 'text-[10px]' : 'text-[11px]'} text-slate-400`}>
                          <span className="font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                            {customer.accountNo}
                          </span>
                          <span>•</span>
                          <span>{formatPhoneNumber(customer.mobile)}</span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3 px-4'} max-w-[200px]`}>
                        <div className="flex items-start gap-1 text-slate-300 truncate">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                          <span className="truncate">{customer.address.street}, Brgy. {customer.address.barangay}</span>
                        </div>
                        {customer.address.landmark && (
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate pl-4">
                            Near: {customer.address.landmark}
                          </p>
                        )}
                      </td>

                      {/* Plan */}
                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3 px-4'}`}>
                        <div className="font-semibold text-slate-200 truncate max-w-[150px]">
                          {formatCommercialPlanName(customer.planName)}
                        </div>
                        <div className={`${density === 'compact' ? 'text-[10px]' : 'text-[11px]'} font-mono text-cyan-400 mt-0.5`}>
                          {formatCurrency(customer.monthlyFee)}/mo
                        </div>
                      </td>

                      {/* Network & NAP */}
                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3 px-4'}`}>
                        <div className="flex items-center gap-2">
                          {activeSessionUsernames.has(customer.network.pppoeUsername.toLowerCase()) ? (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 shadow-sm"
                              title={`PPPoE Tunnel Online • Uptime: ${activeSessionMap.get(customer.network.pppoeUsername.toLowerCase())?.uptime || 'Active'}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              ONLINE
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60"
                              title={customer.network.isMikrotikSynced ? 'Provisioned in Router (Offline / Idle)' : 'Not Synced to Router'}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                              OFFLINE
                            </span>
                          )}
                          <span className={`font-mono ${density === 'compact' ? 'text-[10px]' : 'text-[11px]'} font-semibold text-slate-200`}>
                            {customer.network.pppoeUsername}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          IP: {activeSessionMap.get(customer.network.pppoeUsername.toLowerCase())?.assignedIp || customer.network.ipAddress} • NAP: {assignedNap?.code || customer.network.napBoxId} (Port #{customer.network.napPortNumber})
                        </div>
                        {/* Optical Rx Telemetry & Drop Wire Metric */}
                        {(() => {
                          const opticalPower = customer.network.opticalPowerDbm ?? customer.installationDetails?.opticalPowerDbm;
                          const optBadge = getOpticalPowerBadge(opticalPower);
                          const dropMeters = customer.network.dropCableMeters ?? customer.installationDetails?.dropCableMeters;

                          return (
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${optBadge.badgeClass}`}
                                title={optBadge.statusText ? `Optical Power Rx: ${optBadge.text} (${optBadge.statusText})` : 'Awaiting lineman optical meter reading'}
                              >
                                <span className={`w-1 h-1 rounded-full ${optBadge.dotClass}`} />
                                {optBadge.text}
                              </span>
                              {dropMeters ? (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  • {dropMeters}m drop
                                </span>
                              ) : null}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Balance */}
                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3 px-4'} font-mono font-bold`}>
                        {customer.balance > 0 ? (
                          <span className="text-rose-400">{formatCurrency(customer.balance)}</span>
                        ) : customer.balance < 0 ? (
                          <span className="text-emerald-400">-{formatCurrency(Math.abs(customer.balance))} (Adv)</span>
                        ) : (
                          <span className="text-slate-400">₱0.00</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3 px-4'}`}>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge.bg} ${statusBadge.textCol} ${statusBadge.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                          {statusBadge.text}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className={`${density === 'compact' ? 'py-1.5 px-3' : 'py-3 px-4'} text-right`}>
                        <div className="flex items-center justify-end gap-1">
                          {customer.status === 'pending_approval' && (
                            <button
                              onClick={() => toggleCustomerStatus(customer.id, 'active')}
                              className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                              title="Quick Approve & Grant Portal Access"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Approve</span>
                            </button>
                          )}

                          {(customer.status === 'pending_install' || customer.status === 'pending_approval') && (
                            <button
                              onClick={() => setSelectedCustomerForProvision(customer)}
                              className={`${density === 'compact' ? 'p-1' : 'p-1.5'} bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white rounded-lg shadow-md transition-all cursor-pointer`}
                              title="Review, Provision Fiber Line & Convert to Active Subscriber"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSearchTerm(customer.accountNo);
                              setActiveTab('billing');
                            }}
                            className={`${density === 'compact' ? 'p-1' : 'p-1.5'} bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors`}
                            title="View Bills & Collect Payment"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onSelectCustomer(customer.id)}
                            className={`${density === 'compact' ? 'p-1' : 'p-1.5'} bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors`}
                            title="View Statement of Account & Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onOpenCustomerModal(customer)}
                            className={`${density === 'compact' ? 'p-1' : 'p-1.5'} bg-slate-800 text-cyan-400 hover:bg-cyan-600 hover:text-white rounded-lg transition-colors`}
                            title="Edit Subscriber Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => syncCustomerMikrotik(customer.id)}
                            className={`${density === 'compact' ? 'p-1' : 'p-1.5'} bg-slate-800 text-purple-400 hover:bg-purple-600 hover:text-white rounded-lg transition-colors`}
                            title="Sync Mikrotik Line"
                          >
                            <Wifi className="w-3.5 h-3.5" />
                          </button>

                          {hasPermission('canResetCustomerPassword') && (
                            <button
                              onClick={() => setCustomerForPasswordReset(customer)}
                              className={`${density === 'compact' ? 'p-1' : 'p-1.5'} bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 rounded-lg transition-all cursor-pointer`}
                              title="Reset Subscriber Portal Password"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {customer.status === 'active' && (
                            <button
                              onClick={() => setStatusActionCustomer({ customer, targetStatus: 'suspended' })}
                              className={`${density === 'compact' ? 'p-1' : 'p-1.5'} bg-slate-800 text-amber-400 hover:bg-amber-600 hover:text-white rounded-lg transition-colors cursor-pointer`}
                              title="Suspend Subscriber Service"
                            >
                              <PauseCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {(customer.status === 'suspended' || customer.status === 'disconnected') && (
                            <button
                              onClick={() => setStatusActionCustomer({ customer, targetStatus: 'active' })}
                              className={`${density === 'compact' ? 'p-1' : 'p-1.5'} bg-slate-800 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors cursor-pointer`}
                              title="Reactivate Subscriber Service"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {hasPermission('canDeleteCustomer') && (
                            <button
                              onClick={() => setCustomerToDelete(customer)}
                              className={`${density === 'compact' ? 'p-1' : 'p-1.5'} bg-slate-800 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg transition-colors cursor-pointer`}
                              title="Delete Subscriber"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Batch Action Toolbar */}
      {selectedCustomerIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-cyan-500/60 rounded-2xl shadow-2xl backdrop-blur-md px-4 sm:px-6 py-2.5 flex items-center gap-3 sm:gap-4 text-xs animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2 pr-2 sm:pr-3 border-r border-slate-700/80">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="font-bold text-slate-100 whitespace-nowrap">
              {selectedCustomerIds.size} <span className="hidden sm:inline">subscribers</span> selected
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={exportSelectedToCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-semibold transition-all hover:scale-105 cursor-pointer"
              title="Export selected subscribers to CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBatchSmsModalOpen(true)}
              disabled={isBatchProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/40 rounded-xl font-semibold transition-all hover:scale-105 disabled:opacity-50 cursor-pointer"
              title="Send SMS notification to selected subscribers"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>SMS Blast</span>
            </button>

            <button
              type="button"
              onClick={handleBatchMikrotikSync}
              disabled={isBatchProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 rounded-xl font-semibold transition-all hover:scale-105 disabled:opacity-50 cursor-pointer"
              title="Sync MikroTik lines for all selected subscribers"
            >
              {isBatchProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">Batch MikroTik Sync</span>
              <span className="md:hidden">Sync</span>
            </button>

            <button
              type="button"
              onClick={clearSelection}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors ml-1 cursor-pointer"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Batch SMS Blast Modal */}
      {isBatchSmsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-slate-100 text-sm">
                  Batch SMS Blast ({selectedCustomerIds.size} Subscribers)
                </h3>
              </div>
              <button
                onClick={() => setIsBatchSmsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Notification Type</label>
                <select
                  value={batchSmsType}
                  onChange={(e) => setBatchSmsType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="due_today">Bill Due Notice (Due Today)</option>
                  <option value="upcoming_due">Upcoming Due Reminder</option>
                  <option value="overdue_warning">Disconnection Warning (Overdue)</option>
                  <option value="custom">Custom Broadcast Announcement</option>
                </select>
              </div>

              {batchSmsType === 'custom' && (
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Custom SMS Message</label>
                  <textarea
                    value={batchCustomMessage}
                    onChange={(e) => setBatchCustomMessage(e.target.value)}
                    rows={3}
                    placeholder="Type custom SMS notification here..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px] text-slate-400">
                Messages will be dispatched sequentially to each selected subscriber's registered mobile number via configured SMS Gateway.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBatchSmsModalOpen(false)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBatchSmsDispatch}
                disabled={isBatchProcessing || (batchSmsType === 'custom' && !batchCustomMessage.trim())}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 disabled:opacity-50"
              >
                {isBatchProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Dispatch to {selectedCustomerIds.size} Recipients</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provisioning Modal */}
      {selectedCustomerForProvision && (
        <ProvisionModal
          customer={selectedCustomerForProvision}
          onClose={() => setSelectedCustomerForProvision(null)}
        />
      )}

      {/* Reset Customer Password Modal */}
      <ResetCustomerPasswordModal
        customer={customerForPasswordReset}
        isOpen={!!customerForPasswordReset}
        onClose={() => setCustomerForPasswordReset(null)}
      />

      {/* Confirmation Dialog for Customer Deletion */}
      <ConfirmDeleteModal
        isOpen={!!customerToDelete}
        title="Delete Subscriber Account"
        itemName={customerToDelete ? `${customerToDelete.fullName} (${customerToDelete.accountNo}) - Plan: ${customerToDelete.planName}` : undefined}
        description="Are you sure you want to permanently delete this subscriber? This will remove all associated billing records, network allocations, portal credentials from Cloud Firestore, and permanently delete their login identity from Firebase Authentication."
        confirmLabel="Yes, Delete Subscriber"
        onConfirm={() => {
          if (customerToDelete) {
            deleteCustomer(customerToDelete.id);
            setCustomerToDelete(null);
          }
        }}
        onClose={() => setCustomerToDelete(null)}
      />

      {/* Confirmation Dialog for Customer Status Change (Suspend / Disconnect / Reactivate) */}
      {statusActionCustomer && (
        <ConfirmActionModal
          isOpen={!!statusActionCustomer}
          title={statusActionCustomer.targetStatus === 'suspended' ? 'Suspend Subscriber Service' : 'Reactivate Subscriber Service'}
          itemName={`${statusActionCustomer.customer.fullName} (${statusActionCustomer.customer.accountNo})`}
          description={
            statusActionCustomer.targetStatus === 'suspended'
              ? 'Are you sure you want to suspend this subscriber? Their PPPoE secret on the MikroTik router will be isolated/blocked, cutting their internet connectivity immediately until reactivated.'
              : 'Reactivating this subscriber will re-enable their PPPoE credentials and restore internet connectivity on the MikroTik router.'
          }
          severity={statusActionCustomer.targetStatus === 'suspended' ? 'critical' : 'warning'}
          confirmLabel={statusActionCustomer.targetStatus === 'suspended' ? 'Yes, Suspend Line' : 'Yes, Reactivate Line'}
          onConfirm={() => {
            toggleCustomerStatus(statusActionCustomer.customer.id, statusActionCustomer.targetStatus);
            setStatusActionCustomer(null);
          }}
          onClose={() => setStatusActionCustomer(null)}
        />
      )}
    </div>
  );
};


