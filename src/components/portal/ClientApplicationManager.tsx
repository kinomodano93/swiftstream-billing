import React, { useState, useMemo } from 'react';
import {
  FileCheck2,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  Calendar,
  Phone,
  MapPin,
  Wifi,
  UserPlus,
  ChevronRight,
  Copy,
  Check,
  Layers,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { OnlineApplication, OnlineApplicationStatus } from '../../types';

export const ClientApplicationManager: React.FC = () => {
  const {
    plans,
    coverageAreas,
    napBoxes,
    addCustomer,
  } = useApp();

  // Mock initial applications state with persistent local storage
  const [applications, setApplications] = useState<OnlineApplication[]>(() => {
    try {
      const saved = localStorage.getItem('swiftstream_online_applications');
      if (saved) return JSON.parse(saved);
    } catch (_) {}

    return [
      {
        id: 'app-001',
        applicationNumber: 'APP-2026-0891',
        applicantName: 'Eduardo Dela Cruz',
        email: 'eduardo.delacruz@gmail.com',
        phone: '09171234567',
        address: 'Blk 14 Lot 8 Phase 2, Mabuhay Homes',
        barangay: 'San Vicente',
        city: 'Santa Rosa',
        province: 'Laguna',
        landmark: 'Near Barangay Hall & Chapel',
        preferredPlanId: 'p2',
        preferredPlanName: 'Swift Fiber 50 Mbps',
        preferredSpeedMbps: 50,
        monthlyFee: 1299,
        status: 'pending',
        notes: 'Requested installation ASAP. House is right beside pole with NAP Box 04.',
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        id: 'app-002',
        applicationNumber: 'APP-2026-0892',
        applicantName: 'Maria Theresa Santos',
        email: 'maria.santos@outlook.com',
        phone: '09289876543',
        address: '142 Rizal Avenue Ext.',
        barangay: 'Poblacion 1',
        city: 'Cabuyao',
        province: 'Laguna',
        landmark: 'In front of 7-Eleven',
        preferredPlanId: 'p3',
        preferredPlanName: 'Swift Turbo 100 Mbps',
        preferredSpeedMbps: 100,
        monthlyFee: 1699,
        status: 'survey_scheduled',
        surveyDate: '2026-09-02',
        assignedTechnician: 'Tech Juan / Crew Alpha',
        notes: 'Wants optical drop cable route checked across main highway.',
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
      {
        id: 'app-003',
        applicationNumber: 'APP-2026-0888',
        applicantName: 'Roberto Gomez',
        email: 'robert.gomez@gmail.com',
        phone: '09085551234',
        address: 'Sitio Kawayan, Brgy. Pittland',
        barangay: 'Pittland',
        city: 'Cabuyao',
        province: 'Laguna',
        landmark: 'Near Water District Tank',
        preferredPlanId: 'p1',
        preferredPlanName: 'Swift Starter 30 Mbps',
        preferredSpeedMbps: 30,
        monthlyFee: 999,
        status: 'rejected',
        rejectionReason: 'Beyond maximum 350m optical drop cable distance from nearest NAP box.',
        createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
      },
    ];
  });

  const saveApplications = (newApps: OnlineApplication[]) => {
    setApplications(newApps);
    try {
      localStorage.setItem('swiftstream_online_applications', JSON.stringify(newApps));
    } catch (_) {}
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedApp, setSelectedApp] = useState<OnlineApplication | null>(null);

  // New Application Modal State
  const [isNewAppModalOpen, setIsNewAppModalOpen] = useState(false);
  const [newApplicantName, setNewApplicantName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newBarangay, setNewBarangay] = useState(coverageAreas[0]?.barangay || 'San Vicente');
  const [newCity, setNewCity] = useState('Santa Rosa');
  const [newProvince, setNewProvince] = useState('Laguna');
  const [newPlanId, setNewPlanId] = useState(plans[0]?.id || 'p2');
  const [newNotes, setNewNotes] = useState('');

  // Action states
  const [surveyDateInput, setSurveyDateInput] = useState('');
  const [assignedTechInput, setAssignedTechInput] = useState('');
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [copiedAppNo, setCopiedAppNo] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchesStatus =
        selectedStatus === 'all' || app.status === selectedStatus;
      const q = searchQuery.toLowerCase();
      const matchesQuery =
        !q ||
        app.applicantName.toLowerCase().includes(q) ||
        app.applicationNumber.toLowerCase().includes(q) ||
        app.phone.includes(q) ||
        app.email.toLowerCase().includes(q) ||
        app.barangay.toLowerCase().includes(q);

      return matchesStatus && matchesQuery;
    });
  }, [applications, selectedStatus, searchQuery]);

  const pendingCount = applications.filter((a) => a.status === 'pending').length;
  const surveyCount = applications.filter((a) => a.status === 'survey_scheduled').length;
  const approvedCount = applications.filter((a) => a.status === 'approved').length;

  const handleCreateNewApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApplicantName.trim() || !newPhone.trim()) return;

    const plan = plans.find((p) => p.id === newPlanId) || plans[0];
    const newRecord: OnlineApplication = {
      id: `app-${Date.now()}`,
      applicationNumber: `APP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      applicantName: newApplicantName.trim(),
      email: newEmail.trim(),
      phone: newPhone.trim(),
      address: newAddress.trim(),
      barangay: newBarangay,
      city: newCity,
      province: newProvince,
      preferredPlanId: plan?.id || 'p2',
      preferredPlanName: plan?.name || 'Swift Fiber 50 Mbps',
      preferredSpeedMbps: plan?.speedMbps || 50,
      monthlyFee: plan?.monthlyFee || 1299,
      status: 'pending',
      notes: newNotes.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated = [newRecord, ...applications];
    saveApplications(updated);
    setIsNewAppModalOpen(false);
    showToast(`Application ${newRecord.applicationNumber} created successfully!`);

    // Reset fields
    setNewApplicantName('');
    setNewEmail('');
    setNewPhone('');
    setNewAddress('');
    setNewNotes('');
  };

  const handleApproveAndConvert = (app: OnlineApplication) => {
    const plan = plans.find((p) => p.id === app.preferredPlanId) || plans[0];
    const generatedAccountNo = `SWIFT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const assignedNap = napBoxes[0];

    // Create new customer
    addCustomer({
      accountNo: generatedAccountNo,
      fullName: app.applicantName,
      email: app.email,
      mobile: app.phone,
      address: {
        street: app.address,
        barangay: app.barangay,
        city: app.city,
        province: app.province,
        landmark: app.landmark,
      },
      planId: app.preferredPlanId || plan?.id || 'p2',
      planName: plan?.name || 'Swift Fiber 50 Mbps',
      monthlyFee: plan?.monthlyFee || 1299,
      billingDay: 1,
      status: 'pending_install',
      installationDate: app.surveyDate || new Date().toISOString().slice(0, 10),
      balance: 0,
      advanceDeposit: 0,
      network: {
        pppoeUsername: `swift_${app.applicantName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        ipAddress: `10.200.14.${Math.floor(10 + Math.random() * 200)}`,
        napBoxId: assignedNap?.id || 'nap-01',
        napPortNumber: 1,
        isMikrotikSynced: false,
      },
      notes: `Converted from Online Application ${app.applicationNumber}. Notes: ${app.notes || 'None'}`,
    });

    const updated = applications.map((a) =>
      a.id === app.id
        ? {
            ...a,
            status: 'approved' as OnlineApplicationStatus,
            approvedAt: new Date().toISOString(),
          }
        : a
    );
    saveApplications(updated);
    if (selectedApp?.id === app.id) {
      setSelectedApp({ ...selectedApp, status: 'approved', approvedAt: new Date().toISOString() });
    }
    showToast(`Approved! Subscriber account created for ${app.applicantName}. Ready for installation.`);
  };

  const handleScheduleSurvey = (app: OnlineApplication) => {
    if (!surveyDateInput) return;
    const updated = applications.map((a) =>
      a.id === app.id
        ? {
            ...a,
            status: 'survey_scheduled' as OnlineApplicationStatus,
            surveyDate: surveyDateInput,
            assignedTechnician: assignedTechInput || 'Field Operations Crew',
          }
        : a
    );
    saveApplications(updated);
    if (selectedApp?.id === app.id) {
      setSelectedApp({
        ...selectedApp,
        status: 'survey_scheduled',
        surveyDate: surveyDateInput,
        assignedTechnician: assignedTechInput || 'Field Operations Crew',
      });
    }
    setSurveyDateInput('');
    setAssignedTechInput('');
    showToast(`Survey scheduled on ${surveyDateInput} for ${app.applicantName}!`);
  };

  const handleRejectApplication = (app: OnlineApplication) => {
    const updated = applications.map((a) =>
      a.id === app.id
        ? {
            ...a,
            status: 'rejected' as OnlineApplicationStatus,
            rejectionReason: rejectionReasonInput || 'Unable to service address at this time.',
          }
        : a
    );
    saveApplications(updated);
    if (selectedApp?.id === app.id) {
      setSelectedApp({
        ...selectedApp,
        status: 'rejected',
        rejectionReason: rejectionReasonInput || 'Unable to service address at this time.',
      });
    }
    setRejectionReasonInput('');
    showToast(`Application ${app.applicationNumber} updated to Rejected.`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAppNo(true);
    setTimeout(() => setCopiedAppNo(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm font-medium">{successToast}</p>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-cyan-600/10 via-sky-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-sky-500 rounded-xl text-white shadow-lg shadow-cyan-500/20">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                  Client Online Applications
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-medium border border-cyan-500/30">
                    Self-Service Intake
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  Review prospect sign-ups, schedule site feasibility surveys, and 1-click auto-provision subscriber accounts.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsNewAppModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-cyan-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              New Application
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Pending Review</p>
              <p className="text-xl font-bold text-slate-100 font-mono">{pendingCount}</p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Survey Scheduled</p>
              <p className="text-xl font-bold text-slate-100 font-mono">{surveyCount}</p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Approved & Queued</p>
              <p className="text-xl font-bold text-slate-100 font-mono">{approvedCount}</p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Received</p>
              <p className="text-xl font-bold text-slate-100 font-mono">{applications.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Application List + Detail Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Applications Table & Filters */}
        <div className={`space-y-4 ${selectedApp ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search applicant name, phone, email, app #, barangay..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {['all', 'pending', 'survey_scheduled', 'approved', 'rejected'].map((status) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedStatus === status
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                  }`}
                >
                  {status === 'all'
                    ? 'All'
                    : status === 'survey_scheduled'
                    ? 'Survey'
                    : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Applications List Cards */}
          <div className="space-y-3">
            {filteredApplications.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center">
                <FileCheck2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-300 font-semibold">No applications found</p>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust your search or click "New Application" to simulate a prospect sign-up.
                </p>
              </div>
            ) : (
              filteredApplications.map((app) => {
                const isSelected = selectedApp?.id === app.id;
                const statusBadge =
                  app.status === 'pending'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : app.status === 'survey_scheduled'
                    ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                    : app.status === 'approved'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/30';

                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedApp(app)}
                    className={`bg-slate-900/80 border rounded-2xl p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-cyan-500/60 shadow-lg shadow-cyan-950/40 bg-slate-850'
                        : 'border-slate-800 hover:border-slate-700 hover:bg-slate-850/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-100 text-sm">{app.applicantName}</span>
                          <span className="font-mono text-[11px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {app.applicationNumber}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${statusBadge}`}
                          >
                            {app.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-cyan-400" />
                            {app.phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-rose-400" />
                            Brgy. {app.barangay}, {app.city}
                          </span>
                          <span className="flex items-center gap-1 font-medium text-slate-300">
                            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                            {app.preferredPlanName} ({app.preferredSpeedMbps} Mbps) - ₱{app.monthlyFee}/mo
                          </span>
                        </div>
                      </div>

                      <ChevronRight
                        className={`w-5 h-5 text-slate-500 shrink-0 transition-transform ${
                          isSelected ? 'rotate-90 text-cyan-400' : ''
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Application Detail Inspector */}
        {selectedApp && (
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 sticky top-6 shadow-2xl">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-100">{selectedApp.applicantName}</h2>
                    <button
                      onClick={() => copyToClipboard(selectedApp.applicationNumber)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                      title="Copy tracking code"
                    >
                      {copiedAppNo ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-xs font-mono text-cyan-400">{selectedApp.applicationNumber}</p>
                </div>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg text-xs"
                >
                  Close
                </button>
              </div>

              {/* Contact & Location Details */}
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Contact Phone:</span>
                    <span className="text-slate-200 font-mono font-medium">{selectedApp.phone}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Email Address:</span>
                    <span className="text-slate-200 font-medium">{selectedApp.email || 'N/A'}</span>
                  </div>
                  <div className="flex items-start justify-between text-slate-400 pt-1 border-t border-slate-800/80">
                    <span>Installation Address:</span>
                    <span className="text-slate-200 font-medium text-right max-w-[220px]">
                      {selectedApp.address}, Brgy. {selectedApp.barangay}, {selectedApp.city}, {selectedApp.province}
                    </span>
                  </div>
                  {selectedApp.landmark && (
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Landmark:</span>
                      <span className="text-slate-300 italic">{selectedApp.landmark}</span>
                    </div>
                  )}
                </div>

                {/* Plan Selection Box */}
                <div className="p-3 bg-cyan-950/30 border border-cyan-500/30 rounded-xl space-y-1">
                  <p className="text-[11px] font-semibold text-cyan-300">Selected Fiber Package</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-100">{selectedApp.preferredPlanName}</span>
                    <span className="text-sm font-bold font-mono text-cyan-400">₱{selectedApp.monthlyFee}/mo</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Bandwidth: {selectedApp.preferredSpeedMbps} Mbps Uncapped</p>
                </div>

                {selectedApp.notes && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <p className="text-[11px] font-semibold text-slate-400">Applicant Notes / Special Request:</p>
                    <p className="text-xs text-slate-300 mt-1">{selectedApp.notes}</p>
                  </div>
                )}
              </div>

              {/* Action Operations */}
              <div className="border-t border-slate-800 pt-4 space-y-4">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Workflow Actions</p>

                {/* 1-Click Approve & Convert */}
                {selectedApp.status !== 'approved' && selectedApp.status !== 'installed' && (
                  <button
                    onClick={() => handleApproveAndConvert(selectedApp)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-emerald-950/40 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    1-Click Approve & Create Subscriber Account
                  </button>
                )}

                {/* Schedule Feasibility Survey */}
                {selectedApp.status === 'pending' && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <p className="text-[11px] font-semibold text-sky-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      Schedule Site Feasibility Survey
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={surveyDateInput}
                        onChange={(e) => setSurveyDateInput(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200"
                      />
                      <input
                        type="text"
                        placeholder="Assigned Crew"
                        value={assignedTechInput}
                        onChange={(e) => setAssignedTechInput(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600"
                      />
                    </div>
                    <button
                      onClick={() => handleScheduleSurvey(selectedApp)}
                      disabled={!surveyDateInput}
                      className="w-full py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-all"
                    >
                      Confirm Survey Dispatch
                    </button>
                  </div>
                )}

                {/* Reject Application */}
                {selectedApp.status !== 'rejected' && (
                  <div className="pt-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Reason for rejection (optional)..."
                        value={rejectionReasonInput}
                        onChange={(e) => setRejectionReasonInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 placeholder-slate-600"
                      />
                      <button
                        onClick={() => handleRejectApplication(selectedApp)}
                        className="px-3 py-1.5 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Application Intake Modal */}
      {isNewAppModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-cyan-400" />
                Submit New Online Application
              </h2>
              <button
                onClick={() => setIsNewAppModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewApplication} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Applicant Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Juanita Santos"
                  value={newApplicantName}
                  onChange={(e) => setNewApplicantName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Mobile Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="0917XXXXXXX"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="applicant@gmail.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Street Address / House No. *</label>
                <input
                  type="text"
                  required
                  placeholder="Blk 5 Lot 12 Phase 1"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Barangay</label>
                  <select
                    value={newBarangay}
                    onChange={(e) => setNewBarangay(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    {coverageAreas.map((a) => (
                      <option key={a.id} value={a.barangay}>
                        {a.barangay}
                      </option>
                    ))}
                    <option value="San Vicente">San Vicente</option>
                    <option value="Poblacion 1">Poblacion 1</option>
                    <option value="Pittland">Pittland</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Province</label>
                  <input
                    type="text"
                    value={newProvince}
                    onChange={(e) => setNewProvince(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Preferred Fiber Plan</label>
                <select
                  value={newPlanId}
                  onChange={(e) => setNewPlanId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-medium"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.speedMbps} Mbps) — ₱{p.monthlyFee}/month
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Applicant Notes</label>
                <textarea
                  rows={2}
                  placeholder="Installation notes, landmarks, preferred schedule..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewAppModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/20"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
