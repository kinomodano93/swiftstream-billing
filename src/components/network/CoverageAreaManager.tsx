import React, { useState } from 'react';
import {
  MapPin,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Globe,
  Radio,
  Layers,
  Clock,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  Server,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CoverageArea, CoverageStatus } from '../../types';

export const LAGONOY_BARANGAYS = [
  'Agosais',
  'Agugayan',
  'Amoguis',
  'Bocogan',
  'Balaton',
  'Binauahan',
  'Burabod',
  'Cabotonan',
  'Dahat',
  'Del Carmen',
  'Ginaburan',
  'Gimagpang',
  'Gogon',
  'Himagondong',
  'Loho',
  'Malidong',
  'Manamoc',
  'Mangogon',
  'Mapid',
  'Olas',
  'Omalo',
  'Panicuan',
  'Pinamihagan',
  'San Francisco (Poblacion)',
  'San Isidro Norte',
  'San Isidro Sur',
  'San Rafael',
  'San Ramon',
  'San Roque',
  'San Sebastian',
  'San Vicente',
  'Santa Cruz',
  'Santa Maria',
  'Saravia',
  'Sipaco',
  'Siba-o',
  'Sugod',
  'Tierra Nevada',
];

export const CoverageAreaManager: React.FC = () => {
  const {
    coverageAreas,
    addCoverageArea,
    updateCoverageArea,
    deleteCoverageArea,
    toggleCoverageVisibility,
    toggleCoverageFiberReady,
    napBoxes,
    customers,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'fiber_ready' | 'expansion_ongoing' | 'planned' | 'visible' | 'hidden'>('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingArea, setEditingArea] = useState<CoverageArea | null>(null);

  // Form State
  const [formName, setFormName] = useState('Brgy. Binauahan');
  const [formBarangay, setFormBarangay] = useState('Binauahan');
  const [isCustomBarangay, setIsCustomBarangay] = useState(false);
  const [formCity, setFormCity] = useState('Lagonoy');
  const [formProvince, setFormProvince] = useState('Camarines Sur');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<CoverageStatus>('fiber_ready');
  const [formIsVisible, setFormIsVisible] = useState(true);
  const [formNapBoxCount, setFormNapBoxCount] = useState(1);
  const [formNotes, setFormNotes] = useState('');

  // Delete Confirmation State
  const [areaToDelete, setAreaToDelete] = useState<CoverageArea | null>(null);

  const handleOpenAddModal = () => {
    setEditingArea(null);
    setFormBarangay('Binauahan');
    setFormName('Brgy. Binauahan');
    setIsCustomBarangay(false);
    setFormCity('Lagonoy');
    setFormProvince('Camarines Sur');
    setFormDescription('Fiber distribution node active for residential & commercial drop cables.');
    setFormStatus('fiber_ready');
    setFormIsVisible(true);
    setFormNapBoxCount(1);
    setFormNotes('');
    setShowModal(true);
  };

  const handleOpenEditModal = (area: CoverageArea) => {
    setEditingArea(area);
    setFormName(area.name);
    setFormBarangay(area.barangay);
    setIsCustomBarangay(!LAGONOY_BARANGAYS.includes(area.barangay));
    setFormCity(area.city);
    setFormProvince(area.province);
    setFormDescription(area.description || '');
    setFormStatus(area.status);
    setFormIsVisible(area.isPubliclyVisible);
    setFormNapBoxCount(area.napBoxCount || 0);
    setFormNotes(area.notes || '');
    setShowModal(true);
  };

  const handleSaveArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formBarangay.trim()) {
      alert('Please provide the area name and barangay.');
      return;
    }

    if (editingArea) {
      updateCoverageArea(editingArea.id, {
        name: formName.trim(),
        barangay: formBarangay.trim(),
        city: formCity.trim(),
        province: formProvince.trim(),
        description: formDescription.trim(),
        status: formStatus,
        isPubliclyVisible: formIsVisible,
        napBoxCount: Number(formNapBoxCount) || 0,
        notes: formNotes.trim(),
      });
    } else {
      addCoverageArea({
        name: formName.trim(),
        barangay: formBarangay.trim(),
        city: formCity.trim(),
        province: formProvince.trim(),
        description: formDescription.trim(),
        status: formStatus,
        isPubliclyVisible: formIsVisible,
        napBoxCount: Number(formNapBoxCount) || 0,
        notes: formNotes.trim(),
      });
    }

    setShowModal(false);
  };

  const handleDeleteConfirm = () => {
    if (areaToDelete) {
      deleteCoverageArea(areaToDelete.id);
      setAreaToDelete(null);
    }
  };

  // Filtered List
  const filteredAreas = coverageAreas.filter((area) => {
    const matchesSearch =
      area.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      area.barangay.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (area.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (area.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'visible') return area.isPubliclyVisible;
    if (statusFilter === 'hidden') return !area.isPubliclyVisible;
    return area.status === statusFilter;
  });

  const fiberReadyCount = coverageAreas.filter((a) => a.status === 'fiber_ready').length;
  const expansionCount = coverageAreas.filter((a) => a.status === 'expansion_ongoing').length;
  const visibleCount = coverageAreas.filter((a) => a.isPubliclyVisible).length;

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" />
            <span>Barangay Coverage & Fiber Readiness Manager</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure optical service areas in Lagonoy, manage Fiber Ready status, and control public visibility on the website.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/25 transition-all hover:scale-105 active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Coverage Barangay</span>
        </button>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Barangays</span>
            <Globe className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-slate-100 mt-1">{coverageAreas.length}</p>
          <span className="text-[11px] text-slate-500">Monitored sectors</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Fiber Ready</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-1">{fiberReadyCount}</p>
          <span className="text-[11px] text-slate-500">Instant hookup available</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Under Expansion</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400 mt-1">{expansionCount}</p>
          <span className="text-[11px] text-slate-500">Trunk line deployment</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Publicly Visible</span>
            <Eye className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-purple-400 mt-1">{visibleCount}</p>
          <span className="text-[11px] text-slate-500">Showing on Website / Sign Up</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by barangay name, coverage notes, or description..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            {[
              { id: 'all', label: 'All Areas' },
              { id: 'fiber_ready', label: '🟢 Fiber Ready' },
              { id: 'expansion_ongoing', label: '🟡 Expansion' },
              { id: 'planned', label: '🔵 Planned' },
              { id: 'visible', label: '👁️ Public Only' },
              { id: 'hidden', label: '🚫 Hidden' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Coverage Areas List / Table */}
      <div className="space-y-3">
        {filteredAreas.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
            <MapPin className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-300">No coverage areas match your filter</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search keywords or click &quot;Add Coverage Barangay&quot; to register a new coverage area.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAreas.map((area) => {
              const isFiberReady = area.status === 'fiber_ready';
              const isExpansion = area.status === 'expansion_ongoing';

              // Match NAP count and active subscribers in this barangay
              const matchedNaps = napBoxes.filter(
                (n) => n.barangay.toLowerCase() === area.barangay.toLowerCase()
              );
              const matchedCustomers = customers.filter(
                (c) => c.address.barangay.toLowerCase() === area.barangay.toLowerCase()
              );

              return (
                <div
                  key={area.id}
                  className={`p-5 rounded-3xl bg-slate-900/90 border transition-all hover:border-cyan-500/50 flex flex-col justify-between space-y-4 ${
                    !area.isPubliclyVisible ? 'border-slate-800/60 opacity-75' : 'border-slate-800'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Status & Visibility Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCoverageFiberReady(area.id)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isFiberReady
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60 hover:scale-105'
                            : isExpansion
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/60 hover:scale-105'
                            : 'bg-blue-950 text-blue-300 border border-blue-800/60 hover:scale-105'
                        }`}
                        title="Click to toggle between Fiber Ready and Under Expansion"
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isFiberReady
                              ? 'bg-emerald-400 animate-pulse'
                              : isExpansion
                              ? 'bg-amber-400'
                              : 'bg-blue-400'
                          }`}
                        />
                        <span>
                          {isFiberReady
                            ? 'Fiber Ready'
                            : isExpansion
                            ? 'Expansion Ongoing'
                            : 'Planned Survey'}
                        </span>
                      </button>

                      {/* Public Visibility Checkbox Toggle */}
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 cursor-pointer select-none bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 hover:border-slate-700">
                        <input
                          type="checkbox"
                          checked={area.isPubliclyVisible}
                          onChange={() => toggleCoverageVisibility(area.id)}
                          className="w-3.5 h-3.5 accent-cyan-500 rounded cursor-pointer"
                        />
                        <span className={area.isPubliclyVisible ? 'text-cyan-300' : 'text-slate-500'}>
                          {area.isPubliclyVisible ? 'Public' : 'Hidden'}
                        </span>
                      </label>
                    </div>

                    {/* Area Name & Municipality */}
                    <div>
                      <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                        <span>{area.name}</span>
                      </h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>
                          Brgy. {area.barangay}, {area.city}, {area.province}
                        </span>
                      </p>
                    </div>

                    {/* Description */}
                    {area.description && (
                      <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
                        {area.description}
                      </p>
                    )}

                    {/* Meta Indicators */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-medium">
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Deployed NAPs:</span>
                        <span className="font-bold text-slate-200">
                          {area.napBoxCount || matchedNaps.length} NAP Boxes
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Connected Clients:</span>
                        <span className="font-bold text-cyan-300 font-mono">
                          {matchedCustomers.length} Active Lines
                        </span>
                      </div>
                    </div>

                    {area.notes && (
                      <p className="text-[11px] text-slate-500 italic">
                        NOC Note: {area.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(area)}
                      className="flex items-center gap-1 text-slate-400 hover:text-cyan-300 font-semibold cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAreaToDelete(area)}
                      className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Coverage Area"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= MODAL: ADD / EDIT COVERAGE AREA ================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    {editingArea ? 'Edit Coverage Barangay' : 'Add New Coverage Area'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Set optical service readiness and public website visibility
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveArea} className="p-6 space-y-4 text-xs overflow-y-auto">
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Select Barangay (Lagonoy, Camarines Sur) *
                  </label>
                  <select
                    value={isCustomBarangay ? 'custom' : formBarangay}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setIsCustomBarangay(true);
                      } else {
                        setIsCustomBarangay(false);
                        setFormBarangay(val);
                        if (!editingArea) {
                          setFormName(`Brgy. ${val}`);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-medium"
                  >
                    {LAGONOY_BARANGAYS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value="custom">-- Custom / Other Barangay --</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Brgy. Binauahan"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Barangay Name / Key *
                    </label>
                    <input
                      type="text"
                      required
                      value={formBarangay}
                      onChange={(e) => {
                        setFormBarangay(e.target.value);
                        if (!editingArea && !formName) {
                          setFormName(`Brgy. ${e.target.value}`);
                        }
                      }}
                      placeholder="e.g. Binauahan"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Municipality / City</label>
                  <input
                    type="text"
                    required
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Province</label>
                  <input
                    type="text"
                    required
                    value={formProvince}
                    onChange={(e) => setFormProvince(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Status & Deployed NAPs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Fiber Readiness Status *
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as CoverageStatus)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="fiber_ready">🟢 Fiber Ready (Instant Hookup)</option>
                    <option value="expansion_ongoing">🟡 Expansion Ongoing (Trunk Deployed)</option>
                    <option value="planned">🔵 Planned / Feasibility Survey</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Active NAP Boxes Installed
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formNapBoxCount}
                    onChange={(e) => setFormNapBoxCount(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Public Description & Highlights
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Main Core OLT Hub • 100% Fiber Covered"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* NOC Notes */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Internal NOC Engineering Notes
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Pole attachment permits cleared; optimal optical power (-17 dBm)."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              {/* Public Website Checkbox */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-200 block text-xs">
                    Show on Public Website & Sign-Up Form
                  </span>
                  <span className="text-[11px] text-slate-400">
                    If enabled, this barangay will appear on the Home Page coverage list and applicant drop-downs.
                  </span>
                </div>

                <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                  <input
                    type="checkbox"
                    checked={formIsVisible}
                    onChange={(e) => setFormIsVisible(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600" />
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/20 cursor-pointer"
                >
                  {editingArea ? 'Save Changes' : 'Create Coverage Area'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELETE CONFIRMATION ================= */}
      {areaToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/80 text-rose-400 border border-rose-800 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-100">Delete Coverage Area?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to remove <strong className="text-rose-300">{areaToDelete.name}</strong> from the database?
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAreaToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                Yes, Delete Area
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

