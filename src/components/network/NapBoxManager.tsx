import React, { useState } from 'react';
import {
  Network,
  Plus,
  MapPin,
  Wifi,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Radio,
  ExternalLink,
  X,
  Server,
  Zap,
  Compass,
  Layers,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NapBox, NapPort } from '../../types';
import { FiberGisMap } from './FiberGisMap';

interface NapBoxManagerProps {
  onSelectCustomer: (customerId: string) => void;
}

export const NapBoxManager: React.FC<NapBoxManagerProps> = ({ onSelectCustomer }) => {
  const { napBoxes, customers, addNapBox, updateNapBox, setActiveTab } = useApp();

  const [viewMode, setViewMode] = useState<'gis_map' | 'hardware_matrix'>('gis_map');
  const [selectedBoxId, setSelectedBoxId] = useState<string>(napBoxes[0]?.id || '');
  const [showAddBoxModal, setShowAddBoxModal] = useState<boolean>(false);

  // New NAP Box form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [barangay, setBarangay] = useState('Binauahan');
  const [latitude, setLatitude] = useState<number>(13.6870);
  const [longitude, setLongitude] = useState<number>(123.5210);
  const [totalPorts, setTotalPorts] = useState<number>(16);
  const [fiberCoreColor, setFiberCoreColor] = useState('Blue (Core 1)');
  const [splitterType, setSplitterType] = useState('1:16 PLC Splitter');
  const [notes, setNotes] = useState('');

  const activeBox = napBoxes.find((b) => b.id === selectedBoxId) || napBoxes[0];

  const handleCreateBox = (e: React.FormEvent) => {
    e.preventDefault();
    const ports: NapPort[] = Array.from({ length: totalPorts }, (_, i) => ({
      portNumber: i + 1,
      status: 'available',
    }));

    addNapBox({
      code,
      name,
      location,
      barangay,
      latitude: Number(latitude) || 13.6870,
      longitude: Number(longitude) || 123.5210,
      totalPorts,
      fiberCoreColor,
      splitterType,
      ports,
      notes,
    });

    setShowAddBoxModal(false);
    setCode('');
    setName('');
    setLocation('');
  };

  const getPortStatusStyles = (status: string) => {
    switch (status) {
      case 'occupied':
        return {
          bg: 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300',
          dot: 'bg-emerald-400',
          label: 'Occupied / Online',
        };
      case 'reserved':
        return {
          bg: 'bg-amber-950/60 border-amber-500/60 text-amber-300',
          dot: 'bg-amber-400',
          label: 'Reserved',
        };
      case 'damaged':
        return {
          bg: 'bg-rose-950/60 border-rose-500/60 text-rose-300',
          dot: 'bg-rose-400',
          label: 'Damaged / High Loss',
        };
      default:
        return {
          bg: 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700',
          dot: 'bg-slate-600',
          label: 'Available Port',
        };
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & View Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Network className="w-5 h-5 text-cyan-400" />
            <span>Fiber GIS & NAP Network Infrastructure</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Geographic Outside Plant (OSP) mapping, feeder lines, splice closures & NAP port distribution in Lagonoy, Camarines Sur.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('mikrotik')}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 rounded-xl text-xs font-semibold shadow transition-all hover:scale-105"
          >
            <Server className="w-4 h-4 text-cyan-400" />
            <span>MikroTik Router Fleet</span>
          </button>

          <button
            onClick={() => setShowAddBoxModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span>Deploy New NAP Box</span>
          </button>
        </div>
      </div>

      {/* Top View Mode Switcher Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <button
          onClick={() => setViewMode('gis_map')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            viewMode === 'gis_map'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>🗺️ Fiber GIS & Outside Plant (OSP) Map</span>
        </button>

        <button
          onClick={() => setViewMode('hardware_matrix')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            viewMode === 'hardware_matrix'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>📦 NAP Box Hardware & Port Matrix ({napBoxes.length} Boxes)</span>
        </button>
      </div>

      {/* Primary View: Fiber GIS Map */}
      {viewMode === 'gis_map' && (
        <FiberGisMap onSelectCustomer={onSelectCustomer} />
      )}

      {/* Secondary View: Hardware Matrix & Port Allocator */}
      {viewMode === 'hardware_matrix' && (
        <>
          {/* NAP Box Selector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {napBoxes.map((box) => {
              const isSelected = box.id === activeBox?.id;
              const occupiedCount = box.ports.filter((p) => p.status === 'occupied').length;
              const pct = Math.round((occupiedCount / box.totalPorts) * 100);

              return (
                <div
                  key={box.id}
                  onClick={() => setSelectedBoxId(box.id)}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-500 shadow-glow-cyan'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/40">
                    {box.code}
                  </span>
                  <h3 className="font-bold text-sm text-slate-100 mt-2">{box.name}</h3>
                </div>
                <span className="text-xs font-bold font-mono text-emerald-400">
                  {occupiedCount}/{box.totalPorts} Ports
                </span>
              </div>

              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1 truncate">
                <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                <span>{box.location}, Brgy. {box.barangay}</span>
              </p>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Capacity</span>
                  <span className="font-mono font-semibold text-slate-300">{pct}% Occupied</span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      pct > 80 ? 'bg-amber-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected NAP Box Active Detail View */}
      {activeBox && (
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card space-y-6">
          {/* Box Header Info */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-slate-100">{activeBox.name}</h3>
                <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                  {activeBox.code}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span>{activeBox.location}, Barangay {activeBox.barangay}</span>
                <span>•</span>
                <span>Splitter: {activeBox.splitterType}</span>
                <span>•</span>
                <span>Core: {activeBox.fiberCoreColor}</span>
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-slate-300">Occupied</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                <span className="text-slate-300">Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-slate-300">Reserved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="text-slate-300">Damaged</span>
              </div>
            </div>
          </div>

          {/* Optical Telemetry & Live Traffic Sparkline */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Optical Attenuation (dBm)</span>
              <div className="flex items-center gap-2">
                <span className="text-base font-mono font-black text-emerald-400">-18.4 dBm</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                  Optimal
                </span>
              </div>
              <p className="text-[11px] text-slate-500">1:16 PLC Splitter insertion loss: 13.8 dB</p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Live Hub Throughput</span>
              <div className="flex items-center gap-2">
                <span className="text-base font-mono font-black text-cyan-400">148.5 Mbps</span>
                <span className="text-[10px] text-slate-400">Rx / 64.2 Mbps Tx</span>
              </div>
              <div className="flex items-center gap-1 h-2 pt-0.5">
                {[40, 65, 80, 55, 90, 75, 85, 60, 95, 70, 85].map((h, i) => (
                  <span
                    key={i}
                    className="w-1.5 bg-cyan-500/80 rounded-full animate-pulse"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold">OLT Trunk & Core Feed</span>
              <p className="font-mono font-bold text-slate-200">OLT PON-1/1 (VLAN 100)</p>
              <p className="text-[11px] text-slate-400">Core Color: {activeBox.fiberCoreColor}</p>
            </div>
          </div>

          {/* Visual Interactive Port Grid */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Fiber Port Matrix ({activeBox.totalPorts} Ports)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {activeBox.ports.map((port) => {
                const styles = getPortStatusStyles(port.status);
                const assignedCustomer = port.customerId
                  ? customers.find((c) => c.id === port.customerId)
                  : undefined;

                return (
                  <div
                    key={port.portNumber}
                    className={`p-4 rounded-2xl border ${styles.bg} transition-all space-y-2 relative overflow-hidden`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-sm">Port #{port.portNumber}</span>
                      <span className="flex items-center gap-1 text-[10px] font-semibold">
                        <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
                        <span className="capitalize">{port.status}</span>
                      </span>
                    </div>

                    {port.customerId ? (
                      <div className="text-xs space-y-1 pt-1 border-t border-slate-800/80">
                        <button
                          onClick={() => onSelectCustomer(port.customerId!)}
                          className="font-bold text-slate-100 hover:text-cyan-400 transition-colors text-left block truncate w-full"
                        >
                          {port.customerName || assignedCustomer?.fullName}
                        </button>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-mono text-[10px]">{port.accountNo || assignedCustomer?.accountNo}</span>
                          {port.signalDbm && (
                            <span className="font-mono font-semibold text-emerald-400 text-[10px]">
                              {port.signalDbm} dBm
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 py-2">
                        {port.status === 'damaged' ? 'Fiber core fault / repair needed' : 'Ready for new drop cable connection'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {activeBox.notes && (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
              <strong className="text-slate-300">Technician Dispatch Note:</strong> {activeBox.notes}
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* Add NAP Box Modal */}
      {showAddBoxModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-100">Deploy New NAP Box</h3>
              <button
                onClick={() => setShowAddBoxModal(false)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBox} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">NAP Box Code *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. NAP-04-SANISIDRO"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Box Name / Hub *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. San Isidro Main Post"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Pole / Street Location *</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Pole #18, Near Chapel"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Barangay</label>
                  <input
                    type="text"
                    required
                    value={barangay}
                    onChange={(e) => setBarangay(e.target.value)}
                    placeholder="Binauahan / Poblacion"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">GPS Latitude (North)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={latitude}
                    onChange={(e) => setLatitude(Number(e.target.value))}
                    placeholder="13.6870"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">GPS Longitude (East)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={longitude}
                    onChange={(e) => setLongitude(Number(e.target.value))}
                    placeholder="123.5210"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Total Port Capacity</label>
                  <select
                    value={totalPorts}
                    onChange={(e) => setTotalPorts(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value={8}>8 Ports (1:8 Splitter)</option>
                    <option value={16}>16 Ports (1:16 Splitter)</option>
                    <option value={24}>24 Ports</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Feeder Fiber Core Color</label>
                  <input
                    type="text"
                    value={fiberCoreColor}
                    onChange={(e) => setFiberCoreColor(e.target.value)}
                    placeholder="Blue (Core 1) / Orange (Core 2)"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Technician Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Access instructions or splice tray details..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddBoxModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold shadow-lg shadow-cyan-600/20 transition-colors"
                >
                  Register NAP Box
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

