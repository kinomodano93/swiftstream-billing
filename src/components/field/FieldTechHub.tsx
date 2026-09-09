import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Wifi,
  Barcode,
  Activity,
  Plus,
  Search,
  Filter,
  Phone,
  Send,
  Navigation,
  Check,
  ShieldCheck,
  Sparkles,
  Layers,
  ArrowRight,
  UserCheck,
  Calendar,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, RepairOrder, RepairStatus, WorkOrder } from '../../types';
import { formatCurrency, formatDate, formatDateTime, formatPhoneNumber, getRepairStatusBadge } from '../../utils/formatters';
import { InstallationLoggerModal } from './InstallationLoggerModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { TicketChatModal } from '../support/TicketChatModal';

export const FieldTechHub: React.FC = () => {
  const {
    customers,
    repairOrders,
    napBoxes,
    businessProfile,
    showToast,
    addCustomer,
    updateRepairOrder,
    setActiveTab,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'installs' | 'repairs' | 'opm_tool' | 'history'>('installs');
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('all');
  const [installFilter, setInstallFilter] = useState<'pending' | 'all'>('pending');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);

  // Modals
  const [selectedCustomerForInstall, setSelectedCustomerForInstall] = useState<Customer | null>(null);
  const [selectedRepairOrderForLogger, setSelectedRepairOrderForLogger] = useState<RepairOrder | null>(null);
  const [selectedChatTicket, setSelectedChatTicket] = useState<RepairOrder | null>(null);
  const [showStandaloneScanner, setShowStandaloneScanner] = useState<boolean>(false);
  const [scannedResult, setScannedResult] = useState<{ serial: string; mac?: string; model?: string } | null>(null);

  // Standalone Optical Power Meter (OPM) Tester Tool State
  const [testDbm, setTestDbm] = useState<number>(-19.2);

  // Real Average Optical Power calculation from actual monitored subscribers
  const customersWithDbm = useMemo(() => {
    return customers.filter(
      (c) => c.network?.opticalPowerDbm != null && !isNaN(c.network.opticalPowerDbm)
    );
  }, [customers]);

  const avgDbm = useMemo(() => {
    if (customersWithDbm.length === 0) return '-19.2';
    const sum = customersWithDbm.reduce((acc, c) => acc + (c.network.opticalPowerDbm || 0), 0);
    return (sum / customersWithDbm.length).toFixed(1);
  }, [customersWithDbm]);

  // Pending Installations (Filterable between only pending or all customer drops)
  const pendingInstallations = useMemo(() => {
    return customers.filter((c) => {
      const matchesFilter = installFilter === 'all' || c.status === 'pending_install';
      const matchesSearch =
        c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.accountNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.address.barangay.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [customers, searchTerm, installFilter]);

  // Open Repair Work Orders
  const activeRepairTickets = useMemo(() => {
    return repairOrders.filter((r) => {
      const matchesSearch =
        r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.issueDescription.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTech =
        selectedTechFilter === 'all' || r.technician.toLowerCase().includes(selectedTechFilter.toLowerCase());
      return matchesSearch && matchesTech;
    });
  }, [repairOrders, searchTerm, selectedTechFilter]);

  // Helper for Signal Quality Rating
  const evaluateSignalQuality = (dbm: number) => {
    if (dbm > -8.0) return { label: 'OVERPOWERED', badge: 'bg-rose-950 text-rose-300 border-rose-800' };
    if (dbm >= -24.0 && dbm <= -8.0) return { label: 'PASS (OPTIMAL)', badge: 'bg-emerald-950 text-emerald-300 border-emerald-800' };
    if (dbm >= -27.0 && dbm < -24.0) return { label: 'MARGINAL', badge: 'bg-amber-950 text-amber-300 border-amber-800' };
    return { label: 'FAIL (HIGH ATTENUATION)', badge: 'bg-rose-950 text-rose-300 border-rose-800' };
  };

  // 1-Click Generator of a New Pending Subscriber Installation Work Order for testing
  const handleCreateTestInstallJob = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const newCust = addCustomer({
      fullName: `Juan Dela Cruz #${randomNum}`,
      accountNo: `ACC-26-${randomNum}`,
      email: `subscriber${randomNum}@gmail.com`,
      mobile: `09${Math.floor(100000000 + Math.random() * 900000000)}`,
      address: {
        street: 'Purok Maharlika, Greenfield Subd.',
        barangay: 'Binauahan',
        city: 'Lagonoy',
        province: 'Camarines Sur',
        landmark: 'Near Barangay Health Center',
      },
      planId: 'plan-50m',
      planName: 'Fiber Blast 50 Mbps',
      monthlyFee: 1299,
      billingDay: 10,
      status: 'pending_install',
      installationDate: new Date().toISOString().slice(0, 10),
      balance: 0,
      walletBalance: 0,
      advanceDeposit: 1299,
      contractMonths: 24,
      network: {
        pppoeUsername: `swift_user_${randomNum}`,
        ipAddress: `192.168.10.${Math.floor(50 + Math.random() * 150)}`,
        napBoxId: napBoxes[0]?.id || 'NAP-01',
        napPortNumber: Math.floor(1 + Math.random() * 8),
        isMikrotikSynced: false,
        opticalPowerDbm: -19.5,
      },
      installationDetails: {
        technician: 'Leonardo Flojo (Lead Field Tech)',
        dropCableMeters: 75,
        surveyNotes: 'Pending field drop cable routing & optical dBm verification.',
      },
    });

    showToast('success', 'Work Order Created', `Dispatched installation order for ${newCust.fullName}.`);
    setSelectedCustomerForInstall(newCust);
  };

  return (
    <div className={`w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 transition-all animate-in fade-in ${isMobileMode ? 'max-w-md mx-auto border-x-4 border-slate-700 my-4 rounded-3xl bg-slate-950 p-4 shadow-2xl' : ''}`}>
      {/* Top Banner & PWA Mode Switcher */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-cyan-950 text-cyan-400 border border-cyan-800/50 shadow-inner">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Mobile Field Technician Dispatch & Installation Logger</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/50 text-[10px] font-mono font-bold">
                PWA Active
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Work order dispatches, live camera barcode/QR scanner for ONUs, drop wire tracking, and optical dBm meter logging.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <button
            onClick={() => setShowStandaloneScanner(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600 hover:text-white border border-cyan-500/40 rounded-xl font-bold transition-all hover:scale-105"
          >
            <Barcode className="w-4 h-4" />
            <span>Open Barcode Scanner</span>
          </button>

          <button
            onClick={handleCreateTestInstallJob}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span>+ Dispatch New Install</span>
          </button>

          <button
            onClick={() => setIsMobileMode(!isMobileMode)}
            className={`p-2 rounded-xl border transition-colors ${
              isMobileMode
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle Mobile Simulator Mode"
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">Pending Installations</span>
            <Wifi className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-xl font-black font-mono text-cyan-400">
            {customers.filter((c) => c.status === 'pending_install').length} Jobs
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Drop Wire Routing</span>
        </div>


        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">Active Service Tickets</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xl font-black font-mono text-amber-400">
            {repairOrders.filter((r) => r.status !== 'completed' && r.status !== 'closed' && r.status !== 'cancelled').length} Tickets
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Field Dispatch Queue</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">Avg. Optical Power</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-xl font-black font-mono text-emerald-400">{avgDbm} dBm</span>
          <span className="text-[10px] text-emerald-400/80 block mt-0.5">
            {customersWithDbm.length} Monitored Lines
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">Field Techs Online</span>
            <UserCheck className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-xl font-black font-mono text-purple-400">3 Splicers</span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Binauahan, Lagonoy</span>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveSubTab('installs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all ${
              activeSubTab === 'installs'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
                : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            <Wifi className="w-4 h-4" />
            <span>Fiber Installations ({pendingInstallations.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('repairs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all ${
              activeSubTab === 'repairs'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
                : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Repair & Splice Orders ({activeRepairTickets.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('opm_tool')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all ${
              activeSubTab === 'opm_tool'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
                : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Optical dBm Diagnostic Gauge</span>
          </button>
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search work orders, accounts..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
          />
        </div>
      </div>

      {/* TAB 1: INSTALLATION WORK ORDERS */}
      {activeSubTab === 'installs' && (
        <div className="space-y-3">
          {/* Sub-filter pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setInstallFilter('pending')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  installFilter === 'pending'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pending Installs ({customers.filter((c) => c.status === 'pending_install').length})
              </button>
              <button
                type="button"
                onClick={() => setInstallFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  installFilter === 'all'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Drops ({customers.length})
              </button>
            </div>
            <span className="text-xs text-slate-500">
              Showing {pendingInstallations.length} installation work orders
            </span>
          </div>

          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-card overflow-hidden">
            {pendingInstallations.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Wifi className="w-8 h-8 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-300">No installation orders found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  All scheduled fiber drops have been installed and provisioned.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Subscriber / Account</th>
                      <th className="py-3 px-4">Service Address & Contact</th>
                      <th className="py-3 px-4">Plan & Rate</th>
                      <th className="py-3 px-4">NAP Box & Port</th>
                      <th className="py-3 px-4">Optical Rx Signal</th>
                      <th className="py-3 px-4">Assigned Lineman</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {pendingInstallations.map((cust) => {
                      const isPending = cust.status === 'pending_install';
                      const dbm = cust.network?.opticalPowerDbm ?? -18.5;
                      const opticalGrade = evaluateSignalQuality(dbm);

                      return (
                        <tr
                          key={cust.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isPending ? 'bg-amber-950/10' : ''
                          }`}
                        >
                          {/* Subscriber / Account */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-100 text-sm">{cust.fullName}</div>
                            <div className="font-mono text-[11px] text-cyan-400 mt-0.5">{cust.accountNo}</div>
                            {cust.installationDate && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Sched: {formatDate(cust.installationDate)}
                              </div>
                            )}
                          </td>

                          {/* Address & Contact */}
                          <td className="py-3 px-4 max-w-[220px]">
                            <div className="flex items-center gap-1.5 text-slate-300 truncate">
                              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span className="truncate">{cust.address.street}, {cust.address.barangay}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-500" />
                              <a
                                href={`tel:${cust.mobile}`}
                                className="font-mono text-cyan-400 hover:underline text-[11px]"
                              >
                                {formatPhoneNumber(cust.mobile)}
                              </a>
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-200 block">{cust.planName}</span>
                            <span className="font-mono text-slate-400 text-[11px] block mt-0.5">
                              {formatCurrency(cust.monthlyFee)}/mo
                            </span>
                          </td>

                          {/* NAP Box & Port */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-200">
                              {cust.network?.napBoxId || 'NAP-01'}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                              Port #{cust.network?.napPortNumber || 1}
                            </div>
                          </td>

                          {/* Optical Rx Signal */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-100">
                                {dbm.toFixed(1)} dBm
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${opticalGrade.badge}`}>
                                {opticalGrade.label.split(' ')[0]}
                              </span>
                            </div>
                            {cust.installationDetails?.dropCableMeters && (
                              <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                                Drop: {cust.installationDetails.dropCableMeters}m
                              </div>
                            )}
                          </td>

                          {/* Technician */}
                          <td className="py-3 px-4">
                            <span className="text-slate-300 font-medium">
                              {cust.installationDetails?.technician || 'Leonardo Flojo'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                                isPending
                                  ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                              }`}
                            >
                              {isPending ? 'Pending Install' : 'Active'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedCustomerForInstall(cust)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-sm transition-all hover:scale-105 text-xs cursor-pointer"
                              title={isPending ? 'Open Field Logger' : 'Update Specs'}
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              <span>{isPending ? 'Field Logger' : 'Specs'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FIELD REPAIR & SPLICE ORDERS */}
      {activeSubTab === 'repairs' && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-card overflow-hidden">
            {activeRepairTickets.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Wrench className="w-8 h-8 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-300">No active repair tickets matching filter</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  All subscriber lines and fiber drops are operational.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Ticket / Device</th>
                      <th className="py-3 px-4">Subscriber & Location</th>
                      <th className="py-3 px-4">Reported Issue / Fault</th>
                      <th className="py-3 px-4">NAP & Port</th>
                      <th className="py-3 px-4">Assigned Tech</th>
                      <th className="py-3 px-4">Status & Switcher</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {activeRepairTickets.map((ticket) => {
                      const matchedCust = customers.find(
                        (c) =>
                          (ticket.customerId && c.id === ticket.customerId) ||
                          c.fullName.toLowerCase() === ticket.customerName.toLowerCase()
                      );
                      const badge = getRepairStatusBadge(ticket.status);

                      return (
                        <tr key={ticket.id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Ticket / Device */}
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/50 text-[11px]">
                              {ticket.orderNumber}
                            </span>
                            <div className="mt-1">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-800 text-slate-300">
                                {ticket.deviceType}
                              </span>
                            </div>
                          </td>

                          {/* Subscriber & Location */}
                          <td className="py-3 px-4 max-w-[200px]">
                            <div className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                              <span>{ticket.customerName}</span>
                              {matchedCust && (
                                <span className="text-[10px] font-mono text-slate-400 font-normal">
                                  ({matchedCust.accountNo})
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 text-[11px] truncate mt-0.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                              <span className="truncate">{ticket.address}</span>
                            </div>
                            {ticket.contactNumber && (
                              <div className="text-[11px] mt-1 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-500" />
                                <a
                                  href={`tel:${ticket.contactNumber}`}
                                  className="text-cyan-400 hover:underline font-mono"
                                >
                                  {formatPhoneNumber(ticket.contactNumber)}
                                </a>
                              </div>
                            )}
                          </td>

                          {/* Reported Issue / Fault */}
                          <td className="py-3 px-4 max-w-[240px]">
                            <p className="text-slate-200 line-clamp-2 leading-snug">
                              {ticket.issueDescription}
                            </p>
                            {ticket.diagnosisNotes && (
                              <p className="text-[10px] text-slate-400 italic mt-0.5 truncate">
                                Diag: {ticket.diagnosisNotes}
                              </p>
                            )}
                          </td>

                          {/* NAP & Port */}
                          <td className="py-3 px-4">
                            {matchedCust?.network ? (
                              <div>
                                <span className="font-semibold text-slate-200 block">
                                  {matchedCust.network.napBoxId || 'NAP'}
                                </span>
                                <span className="font-mono text-slate-400 text-[11px] block mt-0.5">
                                  Port #{matchedCust.network.napPortNumber || 1}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Direct / In-Shop</span>
                            )}
                          </td>

                          {/* Assigned Tech */}
                          <td className="py-3 px-4">
                            <span className="text-cyan-300 font-medium">{ticket.technician}</span>
                          </td>

                          {/* Status & Switcher */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${badge.bg} ${badge.textCol}`}>
                                {badge.text}
                              </span>
                              <select
                                value={ticket.status}
                                onChange={(e) => {
                                  const newStatus = e.target.value as RepairStatus;
                                  updateRepairOrder(ticket.id, {
                                    status: newStatus,
                                    dateCompleted:
                                      newStatus === 'resolved' || newStatus === 'closed'
                                        ? new Date().toISOString().slice(0, 10)
                                        : ticket.dateCompleted,
                                    updatedAt: new Date().toISOString(),
                                  });
                                  showToast(
                                    'info',
                                    'Status Updated',
                                    `Ticket #${ticket.orderNumber} marked as ${newStatus}.`
                                  );
                                }}
                                className="text-[10px] bg-slate-950 border border-slate-700 hover:border-cyan-500 rounded px-1.5 py-0.5 text-slate-300 cursor-pointer focus:outline-none"
                              >
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                              </select>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedChatTicket(ticket)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-cyan-600/20 hover:bg-cyan-600 hover:text-white text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                title="Open Live Chat Thread"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Chat{ticket.messages && ticket.messages.length > 0 ? ` (${ticket.messages.length})` : ''}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const targetCust: Customer = matchedCust || {
                                    id: ticket.customerId || ticket.id,
                                    accountNo: 'ACC-SR',
                                    fullName: ticket.customerName,
                                    email: '',
                                    mobile: ticket.contactNumber,
                                    address: {
                                      street: ticket.address,
                                      barangay: 'Lagonoy',
                                      city: 'Lagonoy',
                                      province: 'Camarines Sur',
                                    },
                                    planId: 'plan-custom',
                                    planName: 'Fiber Subscriber',
                                    monthlyFee: 0,
                                    billingDay: 1,
                                    status: 'active',
                                    installationDate:
                                      ticket.dateReceived || new Date().toISOString().slice(0, 10),
                                    balance: 0,
                                    walletBalance: 0,
                                    advanceDeposit: 0,
                                    network: {
                                      pppoeUsername: ticket.customerId || 'subscriber',
                                      ipAddress: '192.168.10.100',
                                      napBoxId: napBoxes[0]?.id || 'NAP-01',
                                      napPortNumber: 1,
                                      opticalPowerDbm: -19.0,
                                      isMikrotikSynced: false,
                                    },
                                    createdAt: ticket.createdAt,
                                    updatedAt: ticket.createdAt,
                                  };
                                  setSelectedCustomerForInstall(targetCust);
                                  setSelectedRepairOrderForLogger(ticket);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                title="Open Field Logger Modal"
                              >
                                <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Logger</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: OPTICAL DBM DIAGNOSTIC GAUGE */}
      {activeSubTab === 'opm_tool' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 shadow-card">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h4 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                <span>On-Site Optical Power Meter (OPM) Signal Analyzer</span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Standard GPON 1490nm Downstream Rx Signal Benchmark (-8.0 dBm to -24.0 dBm)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1.5 text-xs font-semibold">
                  Enter Measured Optical Power (dBm):
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="-35"
                    max="-5"
                    step="0.1"
                    value={testDbm}
                    onChange={(e) => setTestDbm(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={testDbm}
                    onChange={(e) => setTestDbm(parseFloat(e.target.value) || 0)}
                    className="w-28 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono text-base font-bold text-center focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Preset buttons */}
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setTestDbm(-16.4)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl font-bold font-mono"
                >
                  -16.4 dBm (Clean Link)
                </button>
                <button
                  type="button"
                  onClick={() => setTestDbm(-21.8)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl font-bold font-mono"
                >
                  -21.8 dBm (Optimal)
                </button>
                <button
                  type="button"
                  onClick={() => setTestDbm(-25.5)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl font-bold font-mono"
                >
                  -25.5 dBm (Marginal)
                </button>
                <button
                  type="button"
                  onClick={() => setTestDbm(-29.8)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-xl font-bold font-mono"
                >
                  -29.8 dBm (Dirty/Cut)
                </button>
              </div>
            </div>

            {/* Diagnostic Report Card */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold">SIGNAL ASSESSMENT:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${evaluateSignalQuality(testDbm).badge}`}>
                  {evaluateSignalQuality(testDbm).label}
                </span>
              </div>

              <div className="text-2xl font-black font-mono text-cyan-300">
                {testDbm.toFixed(1)} dBm
              </div>

              <div className="text-xs text-slate-400 space-y-1">
                <p>• <strong>Optimal Range:</strong> -8.0 dBm to -24.0 dBm (0.004 mW to 0.15 mW)</p>
                <p>• <strong>ONU Receiver Sensitivity:</strong> -27.0 dBm Max Limit</p>
                <p>• <strong>Recommended Action:</strong> {testDbm < -27.0 ? 'Inspect fiber drop cable for excessive bends or re-terminate SC/APC connector.' : 'Signal is healthy and ready for active traffic.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 1: INSTALLATION & SIGNAL QUALITY LOGGER ================= */}
      {selectedCustomerForInstall && (
        <InstallationLoggerModal
          customer={selectedCustomerForInstall}
          repairOrder={selectedRepairOrderForLogger || undefined}
          onClose={() => {
            setSelectedCustomerForInstall(null);
            setSelectedRepairOrderForLogger(null);
          }}
          onSuccess={() => {
            setSelectedCustomerForInstall(null);
            setSelectedRepairOrderForLogger(null);
          }}
        />
      )}

      {/* ================= MODAL 2: STANDALONE CAMERA BARCODE SCANNER ================= */}
      {showStandaloneScanner && (
        <BarcodeScannerModal
          onScanComplete={(data) => {
            setScannedResult(data);
            showToast('success', 'Scanned Result', `Serial: ${data.serial} • Model: ${data.model || 'ONU'}`);
          }}
          onClose={() => setShowStandaloneScanner(false)}
        />
      )}

      {/* ================= MODAL 3: SUBSCRIBER & FIELD TECH LIVE CHAT ================= */}
      {selectedChatTicket && (
        <TicketChatModal
          ticket={selectedChatTicket}
          currentRole="technician"
          currentUserName="Leonardo Flojo (Lead Field Tech)"
          onClose={() => setSelectedChatTicket(null)}
          onUpdateTicket={(ticketId, updates) => {
            updateRepairOrder(ticketId, updates);
            setSelectedChatTicket((prev) => (prev && prev.id === ticketId ? { ...prev, ...updates } : prev));
          }}
        />
      )}
    </div>
  );
};
