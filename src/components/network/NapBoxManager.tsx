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
  Trash2,
  Ruler,
  ArrowRight,
  Waypoints,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NapBox, NapPort, FbtSplitterRatio, PlcSplitterType } from '../../types';
import { FiberGisMap } from './FiberGisMap';
import { CoverageAreaManager, LAGONOY_BARANGAYS, PRESENTACION_BARANGAYS } from './CoverageAreaManager';
import { getBarangayCoordinates } from '../../data/networkGeo';
import { OltRegistrationModal } from './OltRegistrationModal';
import {
  getOltToNapDistance,
  getNapToNapDistance,
  findNearestNaps,
  calculateSpanMetrics,
} from '../../utils/geoDistance';
import {
  FBT_LOSS_SPECS,
  PLC_LOSS_SPECS,
  buildPonCascadeChain,
  calculateCascadeTelemetry,
  evaluateOpticalPowerHealth,
} from '../../utils/opticalBudget';

interface NapBoxManagerProps {
  onSelectCustomer: (customerId: string) => void;
}

export const NapBoxManager: React.FC<NapBoxManagerProps> = ({ onSelectCustomer }) => {
  const {
    napBoxes,
    customers,
    addNapBox,
    updateNapBox,
    deleteNapBox,
    setActiveTab,
    coverageAreas,
    oltNodes = [],
    oltNode,
  } = useApp();

  const [viewMode, setViewMode] = useState<'gis_map' | 'hardware_matrix' | 'coverage_areas'>('gis_map');
  const [selectedBoxId, setSelectedBoxId] = useState<string>(napBoxes[0]?.id || '');
  const [showAddBoxModal, setShowAddBoxModal] = useState<boolean>(false);
  const [showOltModal, setShowOltModal] = useState<boolean>(false);
  const [editingOltId, setEditingOltId] = useState<string | null>(null);

  const handleDeleteBox = (box: NapBox) => {
    const connectedSubs = customers.filter(
      (c) => c.network?.napBoxId === box.id || box.ports.some((p) => p.customerId === c.id)
    );

    const confirmMsg = connectedSubs.length > 0
      ? `WARNING: NAP Box "${box.code} - ${box.name}" currently has ${connectedSubs.length} subscriber(s) assigned to its ports.\n\nDeleting this NAP box will remove its port assignments and unbind it from outside plant maps.\n\nAre you sure you want to permanently delete this NAP box?`
      : `Are you sure you want to permanently delete NAP Box "${box.code} - ${box.name}" (${box.location}, Brgy. ${box.barangay})?`;

    if (window.confirm(confirmMsg)) {
      deleteNapBox(box.id);
      if (selectedBoxId === box.id) {
        const remaining = napBoxes.filter((b) => b.id !== box.id);
        setSelectedBoxId(remaining[0]?.id || '');
      }
    }
  };
  const [oltModalCoords, setOltModalCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [interNapTargetId, setInterNapTargetId] = useState<string>('');

  // New NAP Box form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [barangay, setBarangay] = useState('Binauahan');
  const [isCustomBarangay, setIsCustomBarangay] = useState(false);
  const [customBarangay, setCustomBarangay] = useState('');
  const [latitude, setLatitude] = useState<number>(13.6838);
  const [longitude, setLongitude] = useState<number>(123.5175);
  const [selectedOltId, setSelectedOltId] = useState<string>(oltNodes[0]?.id || 'olt-01-headend');
  const [ponPortNumber, setPonPortNumber] = useState<number>(1);
  const [feedSourceType, setFeedSourceType] = useState<'olt' | 'nap'>('olt');
  const [upstreamNapId, setUpstreamNapId] = useState<string>('');
  const [fbtRatio, setFbtRatio] = useState<FbtSplitterRatio>('85/15');
  const [plcSplitterType, setPlcSplitterType] = useState<PlcSplitterType>('1:16');
  const [totalPorts, setTotalPorts] = useState<number>(16);
  const [fiberCoreColor, setFiberCoreColor] = useState('Blue (Core 1)');
  const [notes, setNotes] = useState('');

  const activeBox = napBoxes.find((b) => b.id === selectedBoxId) || napBoxes[0];

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

  const handleCreateBox = (e: React.FormEvent) => {
    e.preventDefault();
    const ports: NapPort[] = Array.from({ length: totalPorts }, (_, i) => ({
      portNumber: i + 1,
      status: 'available',
    }));

    const finalBarangay = isCustomBarangay ? (customBarangay.trim() || 'Lagonoy') : barangay;
    const finalSplitterType = `${plcSplitterType} PLC (${fbtRatio === 'terminal' ? '100% Terminal' : `${fbtRatio} FBT`})`;

    // Resolve upstream parent for cascaded hops (defaults to first NAP box if not explicitly changed)
    const candidatesOnPon = napBoxes.filter(
      (b) =>
        (b.oltId === selectedOltId || (!b.oltId && selectedOltId === oltNodes[0]?.id)) &&
        (b.ponPortNumber || 1) === Number(ponPortNumber)
    );
    const resolvedUpstreamNapId =
      feedSourceType === 'nap'
        ? upstreamNapId || candidatesOnPon[0]?.id || undefined
        : undefined;

    addNapBox({
      code,
      name,
      location,
      barangay: finalBarangay,
      latitude: Number(latitude) || 13.6870,
      longitude: Number(longitude) || 123.5210,
      oltId: selectedOltId || oltNodes[0]?.id || 'olt-01-headend',
      ponPortNumber: Number(ponPortNumber) || 1,
      feedSourceType,
      upstreamNapId: resolvedUpstreamNapId,
      fbtRatio,
      plcSplitterType,
      totalPorts,
      fiberCoreColor,
      splitterType: finalSplitterType,
      ports,
      notes,
    });

    setShowAddBoxModal(false);
    setCode('');
    setName('');
    setLocation('');
    setIsCustomBarangay(false);
    setCustomBarangay('');
    setFeedSourceType('olt');
    setUpstreamNapId('');
    setFbtRatio('85/15');
    setPlcSplitterType('1:16');
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
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in">
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
            onClick={() => {
              setOltModalCoords(null);
              setEditingOltId(null);
              setShowOltModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/50 text-purple-200 rounded-xl text-xs font-semibold shadow transition-all hover:scale-105"
            title="Register & Configure Central OLT Coordinates"
          >
            <Server className="w-4 h-4 text-purple-400" />
            <span>OLT POP Fleet ({oltNodes.length})</span>
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

      {/* OLT Fleet Quick Overview Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {oltNodes.map((olt) => {
          const linkedNaps = napBoxes.filter(
            (b) => b.oltId === olt.id || (!b.oltId && olt.id === oltNodes[0]?.id)
          );
          const totalOccupiedPorts = linkedNaps.reduce(
            (acc, b) => acc + (b.ports?.filter((p) => p.status === 'occupied').length || 0),
            0
          );
          const totalPorts = linkedNaps.reduce((acc, b) => acc + (b.totalPorts || 16), 0);

          return (
            <div
              key={olt.id}
              className="p-3.5 rounded-2xl bg-slate-900/80 border border-purple-900/40 flex items-center justify-between hover:border-purple-500/50 transition-all shadow-sm group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 group-hover:scale-105 transition-transform">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-100 text-xs">{olt.code || 'OLT'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-950 text-purple-300 font-mono">
                      {olt.totalPonPorts} PON
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate max-w-[160px]">{olt.name}</p>
                  <p className="text-[10px] text-cyan-400">
                    📍 Brgy. {olt.barangay} • <strong>{linkedNaps.length}</strong> NAPs ({totalOccupiedPorts}/{totalPorts} ports)
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingOltId(olt.id);
                  setShowOltModal(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/50 text-purple-200 text-[10px] font-semibold transition-all hover:scale-105"
              >
                Configure
              </button>
            </div>
          );
        })}
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

        <button
          onClick={() => setViewMode('coverage_areas')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            viewMode === 'coverage_areas'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <MapPin className="w-4 h-4 text-rose-400" />
          <span>📍 Barangay Coverage & Fiber Readiness ({coverageAreas.length} Areas)</span>
        </button>
      </div>

      {/* View: Coverage Area & Fiber Readiness Manager */}
      {viewMode === 'coverage_areas' && (
        <CoverageAreaManager />
      )}

      {/* Primary View: Fiber GIS Map */}
      {viewMode === 'gis_map' && (
        <FiberGisMap
          onSelectCustomer={onSelectCustomer}
          onDeployNapAtLocation={(coords) => {
            setLatitude(Number(coords.lat.toFixed(4)));
            setLongitude(Number(coords.lng.toFixed(4)));
            setShowAddBoxModal(true);
          }}
          onRegisterOltAtLocation={(coords) => {
            setOltModalCoords(coords);
            setEditingOltId(null);
            setShowOltModal(true);
          }}
        />
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
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/40">
                      {box.code}
                    </span>
                    {box.fbtRatio && (
                      <span className="font-mono text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                        {box.fbtRatio === 'terminal' ? 'Terminal' : `${box.fbtRatio} FBT`}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-sm text-slate-100 mt-2">{box.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-emerald-400">
                    {occupiedCount}/{box.totalPorts} Ports
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteBox(box);
                    }}
                    className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 transition-colors"
                    title={`Delete ${box.code}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
                {(() => {
                  const servingOlt = oltNodes.find(
                    (o) => o.id === activeBox.oltId || (!activeBox.oltId && o.id === oltNodes[0]?.id)
                  );
                  return (
                    <span className="flex items-center gap-1 font-medium text-[11px] px-2.5 py-0.5 rounded-full bg-purple-950/70 text-purple-300 border border-purple-800/60">
                      <Server className="w-3 h-3 text-purple-400" />
                      <span>{servingOlt?.code || 'OLT-01'} (PON Port #{activeBox.ponPortNumber || 1})</span>
                    </span>
                  );
                })()}
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

              <button
                type="button"
                onClick={() => handleDeleteBox(activeBox)}
                className="ml-2 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                title={`Delete NAP Box ${activeBox.code}`}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete NAP Box</span>
              </button>
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

          {/* OSP Distance & Cascaded Fiber Span Metrics */}
          {(() => {
            const servingOlt = oltNodes.find(
              (o) => o.id === activeBox.oltId || (!activeBox.oltId && o.id === oltNodes[0]?.id)
            ) || oltNodes[0] || oltNode;

            const ponPort = activeBox.ponPortNumber || 1;
            const napsOnPon = servingOlt
              ? napBoxes.filter(
                  (b) =>
                    (b.oltId === servingOlt.id || (!b.oltId && servingOlt.id === oltNodes[0]?.id)) &&
                    (b.ponPortNumber || 1) === ponPort
                )
              : [];

            const chain = servingOlt ? buildPonCascadeChain(napsOnPon, servingOlt) : [];
            const telemetryList = servingOlt ? calculateCascadeTelemetry(chain, servingOlt) : [];
            const currentHop = telemetryList.find((h) => h.nap.id === activeBox.id);

            const nearestNaps = findNearestNaps(activeBox, napBoxes, 3);
            const interNapTarget = napBoxes.find((b) => b.id === interNapTargetId);
            const customInterNapSpan = interNapTarget
              ? getNapToNapDistance(activeBox, interNapTarget)
              : null;

            return (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/30 via-slate-950 to-cyan-950/30 border border-slate-800 space-y-3 text-xs shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                      Cascaded OSP Fiber Run & Optical Telemetry
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/60 font-bold">
                      {currentHop ? (currentHop.isFeeder ? 'Hop #1 (Feeder)' : `Hop #${currentHop.hopIndex} of ${currentHop.totalHops}`) : 'Standalone'}
                    </span>
                    <span className="text-slate-400">
                      Coords: {activeBox.latitude.toFixed(4)}° N, {activeBox.longitude.toFixed(4)}° E
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Immediate Feed Parent Span & Cumulative Run */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-purple-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Server className="w-3.5 h-3.5 text-purple-400" />
                        <span>Feed Parent: {currentHop ? currentHop.upstreamName : servingOlt?.code || 'OLT-01'}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/60 font-mono text-[10px] font-bold">
                        PON Port #{activeBox.ponPortNumber || 1}
                      </span>
                    </div>

                    {currentHop ? (
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-slate-400 text-[11px]">Hop Span from Parent:</span>
                          <span className="font-mono font-bold text-cyan-300 text-sm">{currentHop.hopSpan.formattedDirect}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-slate-400 text-[11px]">Est. Fiber Cable (+20%):</span>
                          <span className="font-mono font-bold text-slate-100 text-sm">{currentHop.hopSpan.formattedRoute}</span>
                        </div>
                        <div className="flex items-baseline justify-between pt-1 border-t border-slate-900">
                          <span className="text-slate-400 text-[11px]">Cumulative Fiber Run from OLT:</span>
                          <span className="font-mono font-bold text-purple-300 text-sm">
                            {currentHop.cumulativeDirectMeters.toLocaleString()}m ({currentHop.cumulativeCableMeters.toLocaleString()}m cable)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-900">
                          <span className="text-slate-500">Cumulative Fiber Attenuation:</span>
                          <span className="font-mono font-semibold text-emerald-400">~{currentHop.cumulativeFiberLossDb} dB</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-[11px]">Coordinates not available for cascade calculation.</p>
                    )}
                  </div>

                  {/* Right: Optical Power Waterfall & FBT Splitter Specs */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-cyan-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>FBT & PLC Optical Budget</span>
                      </span>
                      {currentHop && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            currentHop.healthStatus === 'optimal'
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                              : currentHop.healthStatus === 'acceptable'
                              ? 'bg-cyan-950 text-cyan-300 border-cyan-800/60'
                              : 'bg-amber-950 text-amber-400 border-amber-800/60'
                          }`}
                        >
                          {currentHop.healthLabel}
                        </span>
                      )}
                    </div>

                    {currentHop ? (
                      <div className="space-y-1.5 font-mono text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Arriving Input Power:</span>
                          <span className="text-cyan-300 font-bold">{currentHop.arrivingInputPowerDbm} dBm</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">FBT Coupler Ratio:</span>
                          <span className="text-amber-300 font-bold">
                            {currentHop.isTerminal ? 'Terminal (100% PLC)' : `${currentHop.fbtRatio} (Tap -${currentHop.fbtTapLossDb}dB, Thru -${currentHop.fbtThroughLossDb}dB)`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">PLC Drop Splitter:</span>
                          <span className="text-slate-200 font-bold">{currentHop.plcType} (-${currentHop.plcLossDb}dB)</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                          <span className="text-slate-400 font-semibold">Subscriber Drop Port Rx:</span>
                          <span
                            className={`font-black text-sm ${
                              currentHop.healthStatus === 'optimal'
                                ? 'text-emerald-400'
                                : currentHop.healthStatus === 'acceptable'
                                ? 'text-cyan-300'
                                : 'text-amber-400'
                            }`}
                          >
                            {currentHop.dropPortRxPowerDbm} dBm
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-[11px]">Optical data unavailable.</p>
                    )}
                  </div>
                </div>

                    {/* Quick nearest neighbors list */}
                    <div className="grid grid-cols-3 gap-2">
                      {nearestNaps.map(({ nap, metrics }) => (
                        <button
                          key={nap.id}
                          type="button"
                          onClick={() => setSelectedBoxId(nap.id)}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-left transition-all group"
                          title={`Click to inspect ${nap.code}`}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-mono font-bold text-cyan-300 text-[10px] group-hover:text-cyan-200">
                              {nap.code}
                            </span>
                          </div>
                          <p className="font-mono text-[11px] font-bold text-slate-200">
                            {metrics.directMeters >= 1000 ? `${metrics.directKm} km` : `${metrics.directMeters} m`}
                          </p>
                          <span className="text-[9px] text-slate-500 block truncate">Brgy. {nap.barangay}</span>
                        </button>
                      ))}
                    </div>

                    {/* Interactive Measure to Any NAP Box dropdown */}
                    <div className="pt-2 border-t border-slate-900 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                          Measure span to any NAP:
                        </label>
                        <select
                          value={interNapTargetId}
                          onChange={(e) => setInterNapTargetId(e.target.value)}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-[11px] font-mono focus:outline-none focus:border-cyan-500"
                        >
                          <option value="">-- Select target NAP box --</option>
                          {napBoxes
                            .filter((b) => b.id !== activeBox.id)
                            .map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.code} - {b.name} (Brgy. {b.barangay})
                              </option>
                            ))}
                        </select>
                      </div>

                      {customInterNapSpan && interNapTarget && (
                        <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-800/50 flex items-center justify-between font-mono text-[11px]">
                          <span className="text-cyan-300">
                            {activeBox.code} ➔ {interNapTarget.code}:
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-100 font-bold">{customInterNapSpan.formattedDirect}</span>
                            <span className="text-slate-400 text-[10px]">(Cable: {customInterNapSpan.formattedRoute})</span>
                            <span className="text-emerald-400 text-[10px]">~{customInterNapSpan.opticalLossDb} dB</span>
                          </div>
                        </div>
                      )}
                    </div>
              </div>
            );
          })()}

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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
            {/* Pinned Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/70 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
                    <span>Deploy New NAP Box</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono font-medium hidden sm:inline-block">
                      OSP Field Provisioning
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Configure PON cascade link, splitters, and GPS pole coordinates</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddBoxModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="deploy-nap-form" onSubmit={handleCreateBox} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                {/* Left Column: Network Uplink, Cascade Bus & Optical Budget */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800/80 pb-1">
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Network Uplink & Optical Cascade</span>
                  </div>

                  {/* Parent OLT & PON Port Linking */}
                  <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-purple-950/20 border border-purple-800/40">
                    <div>
                      <label className="block text-purple-300 mb-1 font-medium flex items-center gap-1 text-[11px]">
                        <Server className="w-3 h-3 text-purple-400" />
                        <span>Serving OLT POP *</span>
                      </label>
                      <select
                        value={selectedOltId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelectedOltId(id);
                          const target = oltNodes.find((o) => o.id === id);
                          if (target) {
                            if (ponPortNumber > (target.totalPonPorts || 16)) {
                              setPonPortNumber(1);
                            }
                            if (!isCustomBarangay) {
                              setBarangay(target.barangay);
                              setLatitude(Number(target.latitude.toFixed(4)));
                              setLongitude(Number(target.longitude.toFixed(4)));
                            }
                          }
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-purple-800/60 rounded-xl text-slate-100 font-semibold text-xs focus:outline-none focus:border-purple-400"
                      >
                        {oltNodes.map((olt) => (
                          <option key={olt.id} value={olt.id}>
                            {olt.code || 'OLT'} - {olt.name} (Brgy. {olt.barangay})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-purple-300 mb-1 font-medium flex items-center gap-1 text-[11px]">
                        <Radio className="w-3 h-3 text-purple-400" />
                        <span>PON Port Number *</span>
                      </label>
                      <select
                        value={ponPortNumber}
                        onChange={(e) => setPonPortNumber(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-purple-800/60 rounded-xl text-slate-100 font-mono font-bold text-xs focus:outline-none focus:border-purple-400"
                      >
                        {Array.from(
                          { length: oltNodes.find((o) => o.id === selectedOltId)?.totalPonPorts || 16 },
                          (_, i) => (
                            <option key={`pon-port-${i + 1}`} value={i + 1}>
                              PON Port #{i + 1}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Feed Parent & Daisy-Chain Cascade Selector */}
                  <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-800/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-purple-300 font-semibold text-[11px] flex items-center gap-1.5">
                        <Waypoints className="w-3.5 h-3.5 text-purple-400" />
                        <span>Cascade Feed Parent (Span Origin) *</span>
                      </label>
                      <span className="text-[10px] text-slate-400 font-mono">Daisy Chain Bus</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFeedSourceType('olt');
                          setUpstreamNapId('');
                        }}
                        className={`p-2 rounded-xl border text-left text-xs font-semibold transition-all ${
                          feedSourceType === 'olt'
                            ? 'bg-purple-900/50 border-purple-500 text-purple-200 shadow-sm'
                            : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Server className="w-3 h-3 text-purple-400" />
                          <span className="text-[11px]">OLT POP (Span 1)</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                          First feeder from headend
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFeedSourceType('nap');
                          const candidates = napBoxes.filter(
                            (b) =>
                              (b.oltId === selectedOltId || (!b.oltId && selectedOltId === oltNodes[0]?.id)) &&
                              (b.ponPortNumber || 1) === Number(ponPortNumber)
                          );
                          const targetParent = candidates[0] || napBoxes[0];
                          if (targetParent) {
                            setUpstreamNapId(targetParent.id);
                            if (!isCustomBarangay) {
                              setBarangay(targetParent.barangay);
                              // Auto-offset proposed pole coordinates ~250m downstream from upstream parent
                              setLatitude(Number((targetParent.latitude + 0.0018).toFixed(4)));
                              setLongitude(Number((targetParent.longitude + 0.0015).toFixed(4)));
                            }
                          }
                        }}
                        className={`p-2 rounded-xl border text-left text-xs font-semibold transition-all ${
                          feedSourceType === 'nap'
                            ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-sm'
                            : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Radio className="w-3 h-3 text-cyan-400" />
                          <span className="text-[11px]">Upstream NAP (Hop)</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                          Daisy-chain from box
                        </span>
                      </button>
                    </div>

                    {feedSourceType === 'nap' && (
                      <div className="pt-1 space-y-1.5">
                        <label className="block text-cyan-300 text-[10px] font-medium">
                          Select Upstream Feed NAP Box on PON #{ponPortNumber} *
                        </label>
                        {(() => {
                          const candidates = napBoxes.filter(
                            (b) =>
                              (b.oltId === selectedOltId || (!b.oltId && selectedOltId === oltNodes[0]?.id)) &&
                              (b.ponPortNumber || 1) === Number(ponPortNumber)
                          );

                          if (candidates.length === 0) {
                            return (
                              <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-800/50 text-[10px] text-amber-300 flex items-center gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                                <span>No existing NAP boxes on PON #{ponPortNumber}. This will be the first feeder box from OLT.</span>
                              </div>
                            );
                          }

                          const activeParent = candidates.find((b) => b.id === (upstreamNapId || candidates[0]?.id)) || candidates[0];

                          return (
                            <>
                              <select
                                value={upstreamNapId || candidates[0]?.id || ''}
                                onChange={(e) => {
                                  const newParentId = e.target.value;
                                  setUpstreamNapId(newParentId);
                                  const p = napBoxes.find((b) => b.id === newParentId);
                                  if (p && !isCustomBarangay) {
                                    setBarangay(p.barangay);
                                    setLatitude(Number((p.latitude + 0.0018).toFixed(4)));
                                    setLongitude(Number((p.longitude + 0.0015).toFixed(4)));
                                  }
                                }}
                                className="w-full px-2.5 py-1.5 bg-slate-950 border border-cyan-800/60 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400 font-bold"
                              >
                                {candidates.map((b, idx) => (
                                  <option key={b.id} value={b.id}>
                                    {b.feedSourceType === 'olt' || !b.upstreamNapId ? '⭐ Hop #1 (Feeder): ' : `⚡ Hop #${b.cascadeHopIndex || idx + 1}: `}
                                    {b.code} - {b.name} (Brgy. {b.barangay})
                                  </option>
                                ))}
                              </select>

                              {activeParent && (
                                <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-900/60 text-[10px] text-cyan-300">
                                  <span>Origin Span: <strong>{activeParent.code}</strong></span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLatitude(Number((activeParent.latitude + 0.0018).toFixed(4)));
                                      setLongitude(Number((activeParent.longitude + 0.0015).toFixed(4)));
                                    }}
                                    className="text-cyan-400 hover:text-cyan-200 underline font-mono text-[10px]"
                                  >
                                    Re-align +250m downstream
                                  </button>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* FBT Coupler & PLC Splitter Selectors */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-amber-300 mb-1 font-medium flex items-center justify-between text-[11px]">
                        <span>FBT Coupler Ratio *</span>
                        <span className="text-[10px] text-slate-400 font-normal">Trunk Split</span>
                      </label>
                      <select
                        value={fbtRatio}
                        onChange={(e) => setFbtRatio(e.target.value as FbtSplitterRatio)}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-amber-600/50 rounded-xl text-slate-100 font-mono text-xs font-bold focus:outline-none focus:border-amber-400"
                      >
                        <option value="85/15">85/15 FBT (~0.9dB thru / ~8.8dB tap)</option>
                        <option value="80/20">80/20 FBT (~1.2dB thru / ~7.4dB tap)</option>
                        <option value="70/30">70/30 FBT (~1.8dB thru / ~5.6dB tap)</option>
                        <option value="75/25">75/25 FBT (~1.5dB thru / ~6.5dB tap)</option>
                        <option value="60/40">60/40 FBT (~2.5dB thru / ~4.3dB tap)</option>
                        <option value="50/50">50/50 Symmetrical (1x2 ~3.4dB split)</option>
                        <option value="90/10">90/10 FBT (~0.6dB thru / ~10.6dB tap)</option>
                        <option value="terminal">Terminal (100% Direct to PLC - End Box)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-cyan-300 mb-1 font-medium flex items-center justify-between text-[11px]">
                        <span>PLC Drop Splitter *</span>
                        <span className="text-[10px] text-slate-400 font-normal">Subscribers</span>
                      </label>
                      <select
                        value={plcSplitterType}
                        onChange={(e) => {
                          const val = e.target.value as PlcSplitterType;
                          setPlcSplitterType(val);
                          setTotalPorts(val === '1:8' ? 8 : val === '1:4' ? 4 : 16);
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-cyan-800/60 rounded-xl text-slate-100 font-mono text-xs font-bold focus:outline-none focus:border-cyan-400"
                      >
                        <option value="1:16">1:16 PLC Splitter (16 Drop Ports, ~13.8 dB)</option>
                        <option value="1:8">1:8 PLC Splitter (8 Drop Ports, ~10.5 dB)</option>
                        <option value="1:4">1:4 PLC Splitter (4 Drop Ports, ~7.2 dB)</option>
                      </select>
                    </div>
                  </div>

                  {/* Live Cascade Distance & Optical Power Telemetry Preview */}
                  {(() => {
                    const targetOlt = oltNodes.find((o) => o.id === selectedOltId) || oltNodes[0] || oltNode;
                    const candidates = napBoxes.filter(
                      (b) =>
                        (b.oltId === selectedOltId || (!b.oltId && selectedOltId === oltNodes[0]?.id)) &&
                        (b.ponPortNumber || 1) === Number(ponPortNumber)
                    );
                    const upstreamNap = feedSourceType === 'nap'
                      ? napBoxes.find((b) => b.id === (upstreamNapId || candidates[0]?.id))
                      : null;

                    const parentCoords = upstreamNap
                      ? { lat: upstreamNap.latitude, lng: upstreamNap.longitude, name: upstreamNap.code }
                      : targetOlt
                      ? { lat: targetOlt.latitude, lng: targetOlt.longitude, name: targetOlt.code || 'OLT' }
                      : null;

                    const hopSpan =
                      parentCoords && typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude)
                        ? calculateSpanMetrics(parentCoords.lat, parentCoords.lng, latitude, longitude)
                        : null;

                    if (!hopSpan) return null;

                    // Existing chain telemetry for cumulative cascade calculation
                    const chain = targetOlt && candidates.length > 0 ? buildPonCascadeChain(candidates, targetOlt) : [];
                    const chainTelemetry = targetOlt && chain.length > 0 ? calculateCascadeTelemetry(chain, targetOlt) : [];
                    const upstreamTelemetry = upstreamNap ? chainTelemetry.find((t) => t.nap.id === upstreamNap.id) : null;

                    const cumulativeDirectMeters = upstreamTelemetry
                      ? upstreamTelemetry.cumulativeDirectMeters + hopSpan.directMeters
                      : hopSpan.directMeters;
                    const cumulativeCableMeters = upstreamTelemetry
                      ? upstreamTelemetry.cumulativeCableMeters + hopSpan.routeCableMeters
                      : hopSpan.routeCableMeters;

                    // Estimate optical attenuation
                    const fbtSpec = FBT_LOSS_SPECS[fbtRatio] || FBT_LOSS_SPECS['85/15'];
                    const plcSpec = PLC_LOSS_SPECS[plcSplitterType] || PLC_LOSS_SPECS['1:16'];
                    const baseTx = typeof targetOlt?.txPowerDbm === 'number' ? targetOlt.txPowerDbm : 4.0;

                    // Arriving input power estimation
                    const hopFiberLoss = Number(((hopSpan.routeCableMeters / 1000) * 0.35).toFixed(2));
                    const arrivingInputDbm = upstreamTelemetry && typeof upstreamTelemetry.throughOutputPowerDbm === 'number'
                      ? Number((upstreamTelemetry.throughOutputPowerDbm - hopFiberLoss - 0.1).toFixed(2))
                      : upstreamNap
                      ? Number((baseTx - 3.2 - hopFiberLoss).toFixed(2))
                      : Number((baseTx - hopFiberLoss - 0.1).toFixed(2));

                    const dropRxDbm = fbtRatio === 'terminal'
                      ? Number((arrivingInputDbm - plcSpec.loss).toFixed(2))
                      : Number((arrivingInputDbm - fbtSpec.tapLoss - plcSpec.loss).toFixed(2));

                    const health = evaluateOpticalPowerHealth(dropRxDbm);

                    return (
                      <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-950 to-cyan-950/40 border border-purple-800/60 space-y-2 font-mono text-xs">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300 font-bold text-[10px]">
                              {feedSourceType === 'olt' ? 'Feeder Span (Span 1)' : 'Cascade Hop'}
                            </span>
                            <span className="text-slate-200 font-bold text-[11px]">
                              {parentCoords?.name} ➔ {code || 'NEW-NAP'}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              health.status === 'optimal'
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                                : health.status === 'acceptable'
                                ? 'bg-cyan-950 text-cyan-300 border-cyan-800/60'
                                : 'bg-amber-950 text-amber-400 border-amber-800/60'
                            }`}
                          >
                            {health.label}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Hop Span ({parentCoords?.name}):</span>
                            <span className="text-cyan-300 font-bold">{hopSpan.formattedDirect}</span>
                            <span className="text-slate-500 text-[10px] block">Cable: {hopSpan.formattedRoute}</span>
                          </div>

                          <div>
                            <span className="text-slate-500 block text-[10px]">Simulated Drop Rx Signal:</span>
                            <span
                              className={`font-black text-sm ${
                                health.status === 'optimal'
                                  ? 'text-emerald-400'
                                  : health.status === 'acceptable'
                                  ? 'text-cyan-300'
                                  : 'text-amber-400'
                              }`}
                            >
                              {dropRxDbm} dBm
                            </span>
                            <span className="text-slate-500 text-[10px] block">Input: {arrivingInputDbm} dBm</span>
                          </div>
                        </div>

                        {feedSourceType === 'nap' && upstreamNap && (
                          <div className="pt-1 border-t border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-slate-400">
                            <span>
                              Cumulative Run from OLT (via <strong className="text-cyan-400">{upstreamNap.code}</strong>):
                            </span>
                            <span className="text-purple-300 font-bold">
                              {cumulativeDirectMeters < 1000 ? `${Math.round(cumulativeDirectMeters)}m` : `${(cumulativeDirectMeters / 1000).toFixed(2)} km`} direct
                              <span className="text-slate-500 font-normal ml-1">
                                (~{cumulativeCableMeters < 1000 ? `${Math.round(cumulativeCableMeters)}m` : `${(cumulativeCableMeters / 1000).toFixed(2)} km`} cable)
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Right Column: Physical Identification, Geolocation & Field Specs */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold uppercase tracking-wider text-[11px] border-b border-slate-800/80 pb-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Hardware ID & Pole Geolocation</span>
                  </div>

                  {/* Identification */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium text-[11px]">NAP Box Code *</label>
                      <input
                        type="text"
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="e.g. NAP-04-SANISIDRO"
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-medium text-[11px]">Box Name / Hub *</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. San Isidro Main Post"
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  {/* Pole Location & Barangay */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium text-[11px]">Pole / Street Location *</label>
                      <input
                        type="text"
                        required
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Pole #18, Near Chapel"
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-medium text-[11px]">Barangay Coverage *</label>
                      <select
                        value={isCustomBarangay ? '__custom__' : barangay}
                        onChange={(e) => handleBarangayChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-medium"
                      >
                        <optgroup label="Lagonoy (Primary Coverage - 38 Barangays)">
                          {LAGONOY_BARANGAYS.map((b) => (
                            <option key={`lag-${b}`} value={b}>
                              Brgy. {b}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Presentacion (Expansion - 17 Barangays)">
                          {PRESENTACION_BARANGAYS.map((b) => (
                            <option key={`pres-${b}`} value={b}>
                              Brgy. {b} (Presentacion)
                            </option>
                          ))}
                        </optgroup>
                        {coverageAreas
                          .filter((a) => !LAGONOY_BARANGAYS.includes(a.barangay) && !PRESENTACION_BARANGAYS.includes(a.barangay))
                          .map((a) => (
                            <option key={`cov-${a.id}`} value={a.barangay}>
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
                          className="w-full mt-1.5 px-2.5 py-1 bg-slate-950 border border-cyan-500/50 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-400"
                        />
                      )}
                    </div>
                  </div>

                  {/* GPS Coordinates */}
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-slate-400 mb-1 font-medium text-[11px]">GPS Latitude (North)</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={latitude}
                          onChange={(e) => setLatitude(Number(e.target.value))}
                          placeholder="13.6870"
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-medium text-[11px]">GPS Longitude (East)</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={longitude}
                          onChange={(e) => setLongitude(Number(e.target.value))}
                          placeholder="123.5210"
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    {/* GPS Auto-align notice */}
                    <div className="px-2.5 py-1 rounded-xl bg-cyan-950/40 border border-cyan-900/50 flex items-center justify-between text-[10px] text-cyan-300">
                      <span className="flex items-center gap-1.5">
                        <Compass className="w-3 h-3 text-cyan-400" />
                        <span>GPS aligned to <strong>Brgy. {isCustomBarangay ? customBarangay || 'Custom' : barangay}</strong></span>
                      </span>
                      <span className="text-slate-400 text-[9px]">Fine-tune for exact pole</span>
                    </div>
                  </div>

                  {/* Port Capacity & Core Color */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-400 mb-1 font-medium text-[11px]">Total Port Capacity</label>
                      <input
                        type="number"
                        disabled
                        value={totalPorts}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 font-mono text-xs font-bold cursor-not-allowed"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Synced with {plcSplitterType} PLC</span>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-medium text-[11px]">Feeder Fiber Core Color</label>
                      <input
                        type="text"
                        value={fiberCoreColor}
                        onChange={(e) => setFiberCoreColor(e.target.value)}
                        placeholder="Blue (Core 1) / Orange (Core 2)"
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  {/* Technician Notes */}
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium text-[11px]">Technician Notes</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Access instructions or splice tray details..."
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>
            </form>

            {/* Pinned Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400 font-mono hidden sm:flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-purple-300">
                  PON Port #{ponPortNumber}
                </span>
                <span>•</span>
                <span className="text-cyan-300">
                  {plcSplitterType} PLC ({totalPorts} Drop Ports)
                </span>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddBoxModal(false)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="deploy-nap-form"
                  className="flex-1 sm:flex-none px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold shadow-lg shadow-cyan-600/20 transition-all hover:scale-[1.02] text-xs flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register NAP Box</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OLT Registration Modal */}
      <OltRegistrationModal
        isOpen={showOltModal}
        onClose={() => {
          setShowOltModal(false);
          setEditingOltId(null);
        }}
        initialCoords={oltModalCoords}
        editingOltId={editingOltId}
      />
    </div>
  );
};

