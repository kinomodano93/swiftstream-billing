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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, RepairOrder, WorkOrder } from '../../types';
import { formatCurrency, formatDate, formatDateTime, formatPhoneNumber } from '../../utils/formatters';
import { InstallationLoggerModal } from './InstallationLoggerModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';

export const FieldTechHub: React.FC = () => {
  const {
    customers,
    repairOrders,
    napBoxes,
    businessProfile,
    showToast,
    addCustomer,
    setActiveTab,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'installs' | 'repairs' | 'opm_tool' | 'history'>('installs');
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);

  // Modals
  const [selectedCustomerForInstall, setSelectedCustomerForInstall] = useState<Customer | null>(null);
  const [showStandaloneScanner, setShowStandaloneScanner] = useState<boolean>(false);
  const [scannedResult, setScannedResult] = useState<{ serial: string; mac?: string; model?: string } | null>(null);

  // Standalone Optical Power Meter (OPM) Tester Tool State
  const [testDbm, setTestDbm] = useState<number>(-19.2);

  // Pending Installations (Customers pending install or recently provisioned)
  const pendingInstallations = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.accountNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.address.barangay.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [customers, searchTerm]);

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
    <div className={`p-4 md:p-6 space-y-6 max-w-7xl mx-auto transition-all ${isMobileMode ? 'max-w-md border-x-4 border-slate-700 my-4 rounded-3xl bg-slate-950 p-4 shadow-2xl' : ''}`}>
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
            <span className="text-[11px] font-semibold">Active Line Repairs</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xl font-black font-mono text-amber-400">
            {repairOrders.filter((r) => r.status !== 'completed' && r.status !== 'cancelled').length} Tickets
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">Fiber Cut / Splice</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">Avg. Optical Power</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-xl font-black font-mono text-emerald-400">-19.2 dBm</span>
          <span className="text-[10px] text-emerald-400/80 block mt-0.5">Optimal Range</span>
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
            <span>Fiber Installation Dispatches ({customers.length})</span>
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingInstallations.map((cust) => {
              const isPending = cust.status === 'pending_install';
              const opticalGrade = evaluateSignalQuality(cust.network.opticalPowerDbm || -18.5);

              return (
                <div
                  key={cust.id}
                  className={`p-5 rounded-3xl bg-slate-900 border transition-all hover:border-cyan-500/50 flex flex-col justify-between space-y-4 shadow-card ${
                    isPending ? 'border-amber-500/40 bg-gradient-to-b from-slate-900 to-amber-950/20' : 'border-slate-800'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${
                            isPending
                              ? 'bg-amber-950 text-amber-300 border-amber-800/60'
                              : 'bg-emerald-950 text-emerald-300 border-emerald-800/60'
                          }`}
                        >
                          {isPending ? 'Pending Line Installation' : 'Active & Provisioned'}
                        </span>
                        <h4 className="font-bold text-sm text-slate-100 mt-1">{cust.fullName}</h4>
                        <span className="font-mono text-[11px] text-cyan-400">{cust.accountNo}</span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Plan Speed:</span>
                        <span className="font-bold text-slate-200 text-xs">{cust.planName}</span>
                      </div>
                    </div>

                    {/* Address and Contact Details */}
                    <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="truncate">{cust.address.street}, {cust.address.barangay}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Contact:</span>
                        <a href={`tel:${cust.mobile}`} className="text-cyan-400 font-mono hover:underline flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span>{formatPhoneNumber(cust.mobile)}</span>
                        </a>
                      </div>
                    </div>

                    {/* Network & Optical Specs */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">NAP Box & Port:</span>
                        <span className="font-semibold text-slate-200 truncate block">
                          {cust.network.napBoxId || 'NAP-01'} (P#{cust.network.napPortNumber})
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Optical Rx Signal:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {cust.network.opticalPowerDbm || -18.5} dBm
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500 truncate">
                      Tech: {cust.installationDetails?.technician || 'Leonardo Flojo'}
                    </span>

                    <button
                      onClick={() => setSelectedCustomerForInstall(cust)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-sm transition-all hover:scale-105 text-xs"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>{isPending ? 'Open Field Logger' : 'Update Specs'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: FIELD REPAIR & SPLICE ORDERS */}
      {activeSubTab === 'repairs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeRepairTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-card flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                        {ticket.deviceType}
                      </span>
                      <h4 className="font-bold text-sm text-slate-100 mt-1">{ticket.customerName}</h4>
                      <span className="font-mono text-[11px] text-slate-400">{ticket.orderNumber}</span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        ticket.status === 'ready' || ticket.status === 'completed'
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-amber-950 text-amber-300'
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    {ticket.issueDescription}
                  </p>

                  <div className="space-y-1 text-xs text-slate-400">
                    <div className="flex justify-between">
                      <span>Address:</span>
                      <span className="text-slate-200 truncate max-w-[180px]">{ticket.address}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Assigned Tech:</span>
                      <span className="text-cyan-300 font-medium">{ticket.technician}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="font-mono text-emerald-400 font-bold">
                    Cost: {formatCurrency(ticket.totalCost)}
                  </span>

                  <button
                    onClick={() => {
                      const matchedCust = customers.find((c) => c.fullName === ticket.customerName);
                      if (matchedCust) setSelectedCustomerForInstall(matchedCust);
                      else showToast('info', 'Repair Ticket', `Inspecting ticket ${ticket.orderNumber}`);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <span>Inspect Line</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
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
          onClose={() => setSelectedCustomerForInstall(null)}
          onSuccess={() => {
            setSelectedCustomerForInstall(null);
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
    </div>
  );
};
