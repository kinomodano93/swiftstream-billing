import React, { useState, useEffect } from 'react';
import {
  Server,
  MapPin,
  Compass,
  X,
  Radio,
  Zap,
  CheckCircle2,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LAGONOY_BARANGAYS, PRESENTACION_BARANGAYS } from './CoverageAreaManager';
import { getBarangayCoordinates } from '../../data/networkGeo';
import { OltPopNode } from '../../types';

interface OltRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCoords?: { lat: number; lng: number } | null;
  editingOltId?: string | null;
}

export const OltRegistrationModal: React.FC<OltRegistrationModalProps> = ({
  isOpen,
  onClose,
  initialCoords,
  editingOltId,
}) => {
  const { oltNodes, oltNode, addOltNode, updateOltNode, deleteOltNode, coverageAreas } = useApp();

  const [activeTab, setActiveTab] = useState<string>('new');
  const [code, setCode] = useState('OLT-01');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [barangay, setBarangay] = useState('Binauahan');
  const [isCustomBarangay, setIsCustomBarangay] = useState(false);
  const [customBarangay, setCustomBarangay] = useState('');
  const [latitude, setLatitude] = useState<number>(13.6838);
  const [longitude, setLongitude] = useState<number>(123.5175);
  const [totalPonPorts, setTotalPonPorts] = useState<number>(16);
  const [activePonPorts, setActivePonPorts] = useState<number>(1);
  const [txPowerDbm, setTxPowerDbm] = useState<number>(4.5);
  const [ipAddress, setIpAddress] = useState('192.168.88.1');
  const [notes, setNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync state when modal opens or editingOltId changes
  useEffect(() => {
    if (!isOpen) return;

    const targetId = editingOltId || (oltNodes.length > 0 ? oltNodes[0].id : 'new');
    setActiveTab(targetId);

    const targetOlt = oltNodes.find((n) => n.id === targetId);
    if (targetOlt) {
      loadOltIntoForm(targetOlt);
    } else {
      initNewOltForm();
    }
  }, [isOpen, editingOltId, oltNodes]);

  const loadOltIntoForm = (olt: OltPopNode) => {
    setCode(olt.code || `OLT-0${oltNodes.findIndex((n) => n.id === olt.id) + 1}`);
    setName(olt.name);
    setLocation(olt.location);

    const isKnown =
      LAGONOY_BARANGAYS.includes(olt.barangay) ||
      PRESENTACION_BARANGAYS.includes(olt.barangay) ||
      coverageAreas.some((a) => a.barangay === olt.barangay);

    if (isKnown) {
      setBarangay(olt.barangay);
      setIsCustomBarangay(false);
      setCustomBarangay('');
    } else {
      setBarangay('__custom__');
      setIsCustomBarangay(true);
      setCustomBarangay(olt.barangay);
    }

    setLatitude(initialCoords ? Number(initialCoords.lat.toFixed(4)) : olt.latitude);
    setLongitude(initialCoords ? Number(initialCoords.lng.toFixed(4)) : olt.longitude);
    setTotalPonPorts(olt.totalPonPorts || 16);
    setActivePonPorts(olt.activePonPorts || 0);
    setTxPowerDbm(olt.txPowerDbm || 4.5);
    setIpAddress(olt.ipAddress || '192.168.88.1');
    setNotes(olt.notes || '');
    setConfirmDelete(false);
  };

  const initNewOltForm = () => {
    const nextNum = oltNodes.length + 1;
    const defaultCode = `OLT-${String(nextNum).padStart(2, '0')}`;
    setCode(defaultCode);
    setName(`SwiftStream POP ${defaultCode}`);
    setLocation('Municipal Telecommunications Rack');
    setBarangay('Sta. Maria (Poblacion)');
    setIsCustomBarangay(false);
    setCustomBarangay('');

    if (initialCoords) {
      setLatitude(Number(initialCoords.lat.toFixed(4)));
      setLongitude(Number(initialCoords.lng.toFixed(4)));
    } else {
      const coords = getBarangayCoordinates('Sta. Maria (Poblacion)');
      setLatitude(Number(coords.lat.toFixed(4)));
      setLongitude(Number(coords.lng.toFixed(4)));
    }

    setTotalPonPorts(16);
    setActivePonPorts(1);
    setTxPowerDbm(4.5);
    setIpAddress(`192.168.${88 + oltNodes.length}.1`);
    setNotes('High-density GPON Optical Line Terminal POP with UPS battery backup and surge arrestor.');
    setConfirmDelete(false);
  };

  if (!isOpen) return null;

  const isEditing = activeTab !== 'new' && oltNodes.some((n) => n.id === activeTab);

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'new') {
      initNewOltForm();
    } else {
      const targetOlt = oltNodes.find((n) => n.id === tabId);
      if (targetOlt) loadOltIntoForm(targetOlt);
    }
  };

  const handleBarangayChange = (selected: string) => {
    if (selected === '__custom__') {
      setIsCustomBarangay(true);
    } else {
      setIsCustomBarangay(false);
      setBarangay(selected);
      const coords = getBarangayCoordinates(selected);
      setLatitude(Number(coords.lat.toFixed(4)));
      setLongitude(Number(coords.lng.toFixed(4)));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalBarangay = isCustomBarangay ? (customBarangay.trim() || 'Lagonoy') : barangay;

    const payload = {
      code,
      name,
      location,
      barangay: finalBarangay,
      latitude: Number(latitude) || 13.6838,
      longitude: Number(longitude) || 123.5175,
      totalPonPorts: Number(totalPonPorts) || 16,
      activePonPorts: Number(activePonPorts) || 0,
      txPowerDbm: Number(txPowerDbm) || 4.5,
      ipAddress,
      notes,
    };

    if (isEditing) {
      updateOltNode(activeTab, payload);
    } else {
      addOltNode(payload);
    }

    onClose();
  };

  const handleDelete = () => {
    if (!isEditing) return;
    deleteOltNode(activeTab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full space-y-5 text-xs shadow-2xl animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-300">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {isEditing ? `Configure OLT: ${code}` : 'Register New OLT POP Headend'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Manage Central Optical Line Terminals (OLT) coordinates, GPON PON capacity, and downstream NAP links.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* OLT Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800/80">
          {oltNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => handleSelectTab(node.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all text-[11px] whitespace-nowrap ${
                activeTab === node.id
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'bg-slate-950/60 border border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>{node.code || 'OLT'} - {node.barangay}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleSelectTab('new')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-medium transition-all text-[11px] whitespace-nowrap ${
              activeTab === 'new'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-slate-950/60 border border-dashed border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/30'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New OLT</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">OLT Code *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. OLT-01"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono font-bold focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-slate-400 mb-1 font-medium">Facility / POP Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SwiftStream Central OLT & NOC Headend"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-semibold focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Street Address / Facility Location *</label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Shop #4, Arcade Bldg., National Highway"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Barangay Dropdown */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Barangay Location *</label>
            <select
              value={isCustomBarangay ? '__custom__' : barangay}
              onChange={(e) => handleBarangayChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-purple-500 font-medium"
            >
              <optgroup label="Lagonoy (Primary Coverage - 38 Barangays)">
                {LAGONOY_BARANGAYS.map((b) => (
                  <option key={`olt-lag-${b}`} value={b}>
                    Brgy. {b}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Presentacion (Expansion - 17 Barangays)">
                {PRESENTACION_BARANGAYS.map((b) => (
                  <option key={`olt-pres-${b}`} value={b}>
                    Brgy. {b} (Presentacion)
                  </option>
                ))}
              </optgroup>
              {coverageAreas
                .filter((a) => !LAGONOY_BARANGAYS.includes(a.barangay) && !PRESENTACION_BARANGAYS.includes(a.barangay))
                .map((a) => (
                  <option key={`olt-cov-${a.id}`} value={a.barangay}>
                    Brgy. {a.barangay} ({a.city})
                  </option>
                ))}
              <option value="__custom__">➕ Other / Custom Barangay...</option>
            </select>
            {isCustomBarangay && (
              <input
                type="text"
                required
                value={customBarangay}
                onChange={(e) => setCustomBarangay(e.target.value)}
                placeholder="Enter custom barangay name"
                className="w-full mt-2 px-3 py-1.5 bg-slate-950 border border-purple-500/50 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-purple-400"
              />
            )}
          </div>

          {/* Geographic Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">GPS Latitude (North) *</label>
              <input
                type="number"
                step="0.0001"
                required
                value={latitude}
                onChange={(e) => setLatitude(Number(e.target.value))}
                placeholder="13.6838"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">GPS Longitude (East) *</label>
              <input
                type="number"
                step="0.0001"
                required
                value={longitude}
                onChange={(e) => setLongitude(Number(e.target.value))}
                placeholder="123.5175"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* GPS Auto-align notice */}
          <div className="px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-900/50 flex items-center justify-between text-[11px] text-purple-300">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-purple-400" />
              <span>
                Coordinates mapped to <strong>Brgy. {isCustomBarangay ? customBarangay || 'Custom' : barangay}</strong>
              </span>
            </span>
            <span className="text-slate-400 text-[10px]">Real GIS Marker</span>
          </div>

          {/* PON Ports & Optical Power */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Total PON SFP Ports</label>
              <select
                value={totalPonPorts}
                onChange={(e) => setTotalPonPorts(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-purple-500"
              >
                <option value={2}>2 PON Ports (Micro OLT)</option>
                <option value={4}>4 PON Ports</option>
                <option value={8}>8 PON Ports</option>
                <option value={16}>16 PON Ports</option>
                <option value={32}>32 PON Ports</option>
                <option value={64}>64 PON Ports</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Active PON Ports</label>
              <input
                type="number"
                min="0"
                max={totalPonPorts}
                value={activePonPorts}
                onChange={(e) => setActivePonPorts(Number(e.target.value))}
                placeholder="4"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Tx Power (dBm)</label>
              <input
                type="number"
                step="0.1"
                value={txPowerDbm}
                onChange={(e) => setTxPowerDbm(Number(e.target.value))}
                placeholder="4.5"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Management IP */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Management IP Address</label>
            <input
              type="text"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="192.168.88.1"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Power Redundancy & Facility Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. CASURECO II Primary Line + 3kVA Online UPS + Auto-transfer generator..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            {isEditing && oltNodes.length > 1 ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" /> Confirm deletion?
                  </span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold text-[11px]"
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 text-slate-400 hover:text-slate-200 text-[11px]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border border-rose-900/40 rounded-xl transition-colors text-[11px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete OLT</span>
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold shadow-lg shadow-purple-600/25 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isEditing ? 'Save OLT Changes' : 'Register OLT POP'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

