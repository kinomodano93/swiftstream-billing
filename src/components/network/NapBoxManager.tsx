import React, { useState, useMemo } from 'react';
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
  GitFork,
  Split,
  ArrowLeftRight,
  Search,
  Filter,
  Gauge,
  Edit,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NapBox, NapPort, FbtSplitterRatio, PlcSplitterType, BranchDirection, FeedLegType, PointToPointLink } from '../../types';
import { FiberGisMap } from './FiberGisMap';
import { CoverageAreaManager, LAGONOY_BARANGAYS, PRESENTACION_BARANGAYS } from './CoverageAreaManager';
import { getBarangayCoordinates } from '../../data/networkGeo';
import { OltRegistrationModal } from './OltRegistrationModal';
import { PtpLinkModal } from './PtpLinkModal';
import { calculatePtpOpticalStatus, formatPtpSpeed } from '../../utils/ptpOptical';
import { fetchSfpOpticalDiagnostics } from '../../services/mikrotikApiService';
import {
  getOltToNapDistance,
  getNapToNapDistance,
  findNearestNaps,
  calculateSpanMetrics,
} from '../../utils/geoDistance';
import {
  FBT_LOSS_SPECS,
  PLC_LOSS_SPECS,
  SUB_SPLIT_50_50_LOSS_DB,
  buildPonCascadeChain,
  calculateCascadeTelemetry,
  calculateSingleHopBudgetPreview,
  evaluateOpticalPowerHealth,
} from '../../utils/opticalBudget';
import { generateId } from '../../utils/formatters';

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
    ptpLinks = [],
    updatePtpLink,
    deletePtpLink,
    mikrotikDevices = [],
  } = useApp();

  const [viewMode, setViewMode] = useState<'gis_map' | 'hardware_matrix' | 'coverage_areas' | 'ptp_trunks'>('gis_map');
  const [selectedBoxId, setSelectedBoxId] = useState<string>(napBoxes[0]?.id || '');
  const [showAddBoxModal, setShowAddBoxModal] = useState<boolean>(false);
  const [showOltModal, setShowOltModal] = useState<boolean>(false);
  const [editingOltId, setEditingOltId] = useState<string | null>(null);

  // Hardware Matrix Search & Filters
  const [matrixSearchQuery, setMatrixSearchQuery] = useState<string>('');
  const [matrixBarangayFilter, setMatrixBarangayFilter] = useState<string>('all');
  const [matrixPonFilter, setMatrixPonFilter] = useState<string>('all');
  const [portStatusFilter, setPortStatusFilter] = useState<'all' | 'available' | 'occupied' | 'other'>('all');

  const handleDeleteBox = (box: NapBox) => {
    const connectedSubs = customers.filter(
      (c) => c.network?.napBoxId === box.id || box.ports.some((p) => p.customerId === c.id)
    );

    const pairedTwin = box.pairedBranchNapId
      ? napBoxes.find((b) => b.id === box.pairedBranchNapId)
      : napBoxes.find((b) => b.id !== box.id && b.pairedBranchNapId === box.id);

    let confirmMsg = connectedSubs.length > 0
      ? `WARNING: NAP Box "${box.code} - ${box.name}" currently has ${connectedSubs.length} subscriber(s) assigned to its ports.\n\nDeleting this NAP box will remove its port assignments and unbind it from outside plant maps.\n\nAre you sure you want to permanently delete this NAP box?`
      : `Are you sure you want to permanently delete NAP Box "${box.code} - ${box.name}" (${box.location}, Brgy. ${box.barangay})?`;

    if (pairedTwin) {
      confirmMsg += `\n\n⚠️ NOTE: This box is part of a 50/50 Sub-Split Twin pair with "${pairedTwin.code} - ${pairedTwin.name}". Deleting it will unlink "${pairedTwin.code}" and return it to a single branch tap.`;
    }

    if (window.confirm(confirmMsg)) {
      if (pairedTwin) {
        updateNapBox(pairedTwin.id, {
          pairedBranchNapId: undefined,
          tapSubSplitEnabled: false,
        });
      }
      deleteNapBox(box.id);
      if (selectedBoxId === box.id) {
        const remaining = napBoxes.filter((b) => b.id !== box.id);
        setSelectedBoxId(remaining[0]?.id || '');
      }
    }
  };

  const handleUpdatePortStatus = (boxId: string, portNumber: number, newStatus: 'available' | 'reserved' | 'damaged') => {
    const targetBox = napBoxes.find((b) => b.id === boxId);
    if (!targetBox) return;

    const updatedPorts = targetBox.ports.map((p) => {
      if (p.portNumber === portNumber) {
        return {
          ...p,
          status: newStatus,
          customerId: newStatus === 'available' ? undefined : p.customerId,
          customerName: newStatus === 'available' ? undefined : p.customerName,
          accountNo: newStatus === 'available' ? undefined : p.accountNo,
        };
      }
      return p;
    });

    updateNapBox(boxId, { ports: updatedPorts });
  };
  const [oltModalCoords, setOltModalCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [interNapTargetId, setInterNapTargetId] = useState<string>('');

  // Point-to-Point 10G Trunk state
  const [showPtpModal, setShowPtpModal] = useState<boolean>(false);
  const [editingPtpLink, setEditingPtpLink] = useState<PointToPointLink | null>(null);
  const [isPollingPtp, setIsPollingPtp] = useState<string | null>(null);
  const [ptpActionToast, setPtpActionToast] = useState<{ id: string; text: string; type: 'success' | 'error' } | null>(null);
  const [ptpSearchTerm, setPtpSearchTerm] = useState<string>('');

  const handlePollPtpLink = async (link: PointToPointLink) => {
    const dev = mikrotikDevices.find((d) => d.id === link.routerId) || mikrotikDevices[0];
    if (!dev) {
      setPtpActionToast({
        id: link.id,
        text: 'No linked MikroTik router found for live telemetry.',
        type: 'error',
      });
      setTimeout(() => setPtpActionToast(null), 4000);
      return;
    }

    setIsPollingPtp(link.id);
    try {
      const port = link.routerPort || 'sfp-sfpplus1';
      const ddm = await fetchSfpOpticalDiagnostics(
        {
          id: dev.id,
          name: dev.name,
          ipAddress: dev.ipAddress || dev.remoteAddress || '',
          port: dev.port || dev.webfigPort || 10988,
          username: dev.username || 'admin',
          password: dev.password || '',
        },
        port
      );

      if (ddm) {
        const parseNum = (val: any, fallback: number): number => {
          if (typeof val === 'number') return val;
          if (!val) return fallback;
          const m = String(val).match(/-?[\d.]+/);
          return m ? parseFloat(m[0]) : fallback;
        };

        const rx = parseNum(ddm['sfp-rx-power'] || ddm.rxPower || ddm['rx-power'], link.measuredRxPowerDbm);
        const tx = parseNum(ddm['sfp-tx-power'] || ddm.txPower || ddm['tx-power'], link.nominalTxPowerDbm);
        const temp = parseNum(ddm['sfp-temperature'] || ddm.temperature, 38.0);
        const volt = parseNum(ddm['sfp-supply-voltage'] || ddm.voltage, 3.3);

        const analysis = calculatePtpOpticalStatus(rx, tx, link.maxLossBudgetDb, link.cableLengthMeters);
        const updated: PointToPointLink = {
          ...link,
          measuredRxPowerDbm: rx,
          nominalTxPowerDbm: tx,
          opticalReadingStatus: analysis.status,
        };

        updatePtpLink(link.id, updated);
        setPtpActionToast({
          id: link.id,
          text: `Polled ${dev.name} [${port}]: Rx ${rx.toFixed(1)} dBm • Tx ${tx.toFixed(1)} dBm • ${temp}°C`,
          type: 'success',
        });
      } else {
        setPtpActionToast({
          id: link.id,
          text: `No DDM response from ${dev.name} on ${port}.`,
          type: 'error',
        });
      }
    } catch (err: any) {
      setPtpActionToast({
        id: link.id,
        text: `Poll failed: ${err.message || 'Connection error'}`,
        type: 'error',
      });
    } finally {
      setIsPollingPtp(null);
      setTimeout(() => setPtpActionToast(null), 5000);
    }
  };

  // New NAP Box form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [barangay, setBarangay] = useState('Binauahan');
  const [isCustomBarangay, setIsCustomBarangay] = useState(false);
  const [customBarangay, setCustomBarangay] = useState('');
  const [latitude, setLatitude] = useState<number>(13.6838);
  const [longitude, setLongitude] = useState<number>(123.5175);
  const [isUserCoordSet, setIsUserCoordSet] = useState<boolean>(false);
  const [selectedOltId, setSelectedOltId] = useState<string>(oltNodes[0]?.id || 'olt-01-headend');
  const [ponPortNumber, setPonPortNumber] = useState<number>(1);
  const [feedSourceType, setFeedSourceType] = useState<'olt' | 'nap'>('olt');
  const [upstreamNapId, setUpstreamNapId] = useState<string>('');
  const [fbtRatio, setFbtRatio] = useState<FbtSplitterRatio>('60/40');
  const [tapSubSplitEnabled, setTapSubSplitEnabled] = useState<boolean>(true);
  const [branchDirection, setBranchDirection] = useState<BranchDirection>('left');
  const [autoCreateTwin, setAutoCreateTwin] = useState<boolean>(true);
  const [feedLegType, setFeedLegType] = useState<FeedLegType>('trunk_through');
  const [plcSplitterType, setPlcSplitterType] = useState<PlcSplitterType>('1:16');
  const [totalPorts, setTotalPorts] = useState<number>(16);
  const [fiberCoreColor, setFiberCoreColor] = useState('Blue (Core 1)');
  const [notes, setNotes] = useState('');

  const activeBox = napBoxes.find((b) => b.id === selectedBoxId) || napBoxes[0];

  const matrixBarangays = useMemo(() => {
    return Array.from(new Set(napBoxes.map((b) => b.barangay).filter(Boolean))).sort();
  }, [napBoxes]);

  const matrixPonPorts = useMemo(() => {
    return Array.from(new Set(napBoxes.map((b) => b.ponPortNumber || 1))).sort((a, b) => a - b);
  }, [napBoxes]);

  const filteredMatrixBoxes = useMemo(() => {
    return napBoxes.filter((box) => {
      if (matrixSearchQuery.trim()) {
        const q = matrixSearchQuery.trim().toLowerCase();
        const matchCode = (box.code || '').toLowerCase().includes(q);
        const matchName = (box.name || '').toLowerCase().includes(q);
        const matchLoc = (box.location || '').toLowerCase().includes(q);
        const matchBrgy = (box.barangay || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchLoc && !matchBrgy) return false;
      }
      if (matrixBarangayFilter !== 'all' && box.barangay !== matrixBarangayFilter) {
        return false;
      }
      if (matrixPonFilter !== 'all' && String(box.ponPortNumber || 1) !== matrixPonFilter) {
        return false;
      }
      return true;
    });
  }, [napBoxes, matrixSearchQuery, matrixBarangayFilter, matrixPonFilter]);

  const filteredPorts = useMemo(() => {
    if (!activeBox?.ports) return [];
    if (portStatusFilter === 'all') return activeBox.ports;
    if (portStatusFilter === 'available') return activeBox.ports.filter((p) => p.status === 'available');
    if (portStatusFilter === 'occupied') return activeBox.ports.filter((p) => p.customerId || p.status === 'occupied');
    return activeBox.ports.filter((p) => p.status === 'reserved' || p.status === 'damaged');
  }, [activeBox?.ports, portStatusFilter]);

  const handleBarangayChange = (selected: string) => {
    if (selected === '__custom__') {
      setIsCustomBarangay(true);
    } else {
      setIsCustomBarangay(false);
      setBarangay(selected);
      // Only align coordinates to barangay center if the engineer hasn't explicitly set GPS coordinates
      if (!isUserCoordSet) {
        const coords = getBarangayCoordinates(selected);
        setLatitude(Number(coords.lat.toFixed(4)));
        setLongitude(Number(coords.lng.toFixed(4)));
      }
    }
  };

  const openAddBoxModal = (initialCoords?: { lat: number; lng: number }) => {
    // Determine existing boxes on selected PON port
    const candidates = napBoxes.filter(
      (b) =>
        (b.oltId === selectedOltId || (!b.oltId && selectedOltId === oltNodes[0]?.id)) &&
        (b.ponPortNumber || 1) === Number(ponPortNumber)
    );

    if (candidates.length > 0) {
      // Prior boxes already deployed on this PON! Default to cascading from the last box
      const targetParent = candidates[candidates.length - 1];
      setFeedSourceType('nap');
      setUpstreamNapId(targetParent.id);
      setFeedLegType('trunk_through');
      const defaultFbt: FbtSplitterRatio = candidates.length === 1 ? '60/40' : candidates.length === 2 ? '70/30' : 'terminal';
      setFbtRatio(defaultFbt);
      if (defaultFbt === '60/40') {
        setTapSubSplitEnabled(true);
        setAutoCreateTwin(true);
        setBranchDirection('left');
      } else {
        setTapSubSplitEnabled(false);
        setAutoCreateTwin(false);
        setBranchDirection('direct');
      }
      if (!isCustomBarangay) {
        setBarangay(targetParent.barangay);
      }
      if (initialCoords) {
        setIsUserCoordSet(true);
        setLatitude(Number(initialCoords.lat.toFixed(4)));
        setLongitude(Number(initialCoords.lng.toFixed(4)));
      } else {
        setIsUserCoordSet(false);
        // Auto-align ~250m downstream from upstream parent
        setLatitude(Number((targetParent.latitude + 0.0018).toFixed(4)));
        setLongitude(Number((targetParent.longitude + 0.0015).toFixed(4)));
      }
    } else {
      // First box on this PON! Default to OLT POP Feeder with 60/40 FBT & 50/50 sub-split
      setFeedSourceType('olt');
      setUpstreamNapId('');
      setFeedLegType('feeder_olt');
      setFbtRatio('60/40');
      setTapSubSplitEnabled(true);
      setAutoCreateTwin(true);
      setBranchDirection('left');
      const targetOlt = oltNodes.find((o) => o.id === selectedOltId) || oltNodes[0] || oltNode;
      if (targetOlt && !isCustomBarangay) {
        setBarangay(targetOlt.barangay);
      }
      if (initialCoords) {
        setIsUserCoordSet(true);
        setLatitude(Number(initialCoords.lat.toFixed(4)));
        setLongitude(Number(initialCoords.lng.toFixed(4)));
      } else if (targetOlt) {
        setIsUserCoordSet(false);
        setLatitude(Number((targetOlt.latitude - 0.0032).toFixed(4)));
        setLongitude(Number((targetOlt.longitude - 0.0035).toFixed(4)));
      }
    }
    setShowAddBoxModal(true);
  };

  const handleCreateBox = (e: React.FormEvent) => {
    e.preventDefault();
    const ports: NapPort[] = Array.from({ length: totalPorts }, (_, i) => ({
      portNumber: i + 1,
      status: 'available',
    }));

    const finalBarangay = isCustomBarangay ? (customBarangay.trim() || 'Lagonoy') : barangay;

    // Resolve upstream parent for cascaded hops (defaults to latest box in cascade if not explicitly chosen)
    const candidatesOnPon = napBoxes.filter(
      (b) =>
        (b.oltId === selectedOltId || (!b.oltId && selectedOltId === oltNodes[0]?.id)) &&
        (b.ponPortNumber || 1) === Number(ponPortNumber)
    );

    // If there are no existing boxes on this PON, it cannot be fed from another NAP; it must be fed from OLT
    const effectiveFeedSourceType: 'olt' | 'nap' =
      feedSourceType === 'nap' && candidatesOnPon.length === 0 ? 'olt' : feedSourceType;

    const resolvedUpstreamNapId =
      effectiveFeedSourceType === 'nap'
        ? upstreamNapId || candidatesOnPon[candidatesOnPon.length - 1]?.id || candidatesOnPon[0]?.id || undefined
        : undefined;

    const resolvedFeedLeg: FeedLegType =
      effectiveFeedSourceType === 'olt'
        ? 'feeder_olt'
        : feedLegType;

    // If 50/50 Sub-Split with Auto-create Twin is chosen: create both Left & Right boxes!
    if (tapSubSplitEnabled && autoCreateTwin && fbtRatio !== 'terminal') {
      const leftId = generateId('NAP');
      const rightId = generateId('NAP');
      const baseCode = code.trim() || 'NAP-NEW';
      const leftCode = `${baseCode}-L`;
      const rightCode = `${baseCode}-R`;
      const baseName = name.trim() || 'Distribution Hub';

      // 1. Left Branch
      addNapBox({
        id: leftId,
        code: leftCode,
        name: `${baseName} (Left Branch)`,
        location: `${location} (Left Branch)`,
        barangay: finalBarangay,
        latitude: Number(latitude) || 13.6870,
        longitude: Number(longitude) || 123.5210,
        oltId: selectedOltId || oltNodes[0]?.id || 'olt-01-headend',
        ponPortNumber: Number(ponPortNumber) || 1,
        feedSourceType: effectiveFeedSourceType,
        feedLegType: resolvedFeedLeg,
        fbtRatio,
        tapSubSplitEnabled: true,
        branchDirection: 'left',
        pairedBranchNapId: rightId,
        plcSplitterType,
        totalPorts,
        fiberCoreColor,
        splitterType: `${plcSplitterType} PLC (${fbtRatio} FBT ➔ 50/50 Left)`,
        ports: [...ports],
        ...(resolvedUpstreamNapId ? { upstreamNapId: resolvedUpstreamNapId } : {}),
        notes: `${notes.trim() ? `${notes.trim()} | ` : ''}Left Branch of ${fbtRatio} FBT (50/50 Sub-Split). Paired with ${rightCode}.`,
      });

      // 2. Right Branch (co-located at the exact same physical pole GPS coordinates)
      const rightPorts: NapPort[] = Array.from({ length: totalPorts }, (_, i) => ({
        portNumber: i + 1,
        status: 'available',
      }));

      addNapBox({
        id: rightId,
        code: rightCode,
        name: `${baseName} (Right Branch)`,
        location: `${location} (Right Branch)`,
        barangay: finalBarangay,
        latitude: Number(latitude) || 13.6870,
        longitude: Number(longitude) || 123.5210,
        oltId: selectedOltId || oltNodes[0]?.id || 'olt-01-headend',
        ponPortNumber: Number(ponPortNumber) || 1,
        feedSourceType: 'nap',
        upstreamNapId: leftId, // logically branch off from the same FBT location
        feedLegType: 'tap_subsplit',
        fbtRatio,
        tapSubSplitEnabled: true,
        branchDirection: 'right',
        pairedBranchNapId: leftId,
        plcSplitterType,
        totalPorts,
        fiberCoreColor: 'Orange (Core 2)',
        splitterType: `${plcSplitterType} PLC (${fbtRatio} FBT ➔ 50/50 Right)`,
        ports: rightPorts,
        notes: `${notes.trim() ? `${notes.trim()} | ` : ''}Right Branch of ${fbtRatio} FBT (50/50 Sub-Split). Paired with ${leftCode}.`,
      });
    } else {
      const isSub = tapSubSplitEnabled && fbtRatio !== 'terminal';
      const finalSplitterType = isSub
        ? `${plcSplitterType} PLC (${fbtRatio} FBT ➔ 50/50 ${branchDirection === 'left' ? 'Left' : branchDirection === 'right' ? 'Right' : 'Branch'})`
        : `${plcSplitterType} PLC (${fbtRatio === 'terminal' ? '100% Terminal' : `${fbtRatio} FBT`})`;

      addNapBox({
        code: code.trim(),
        name: name.trim() || 'Distribution Hub',
        location: location.trim(),
        barangay: finalBarangay,
        latitude: Number(latitude) || 13.6870,
        longitude: Number(longitude) || 123.5210,
        oltId: selectedOltId || oltNodes[0]?.id || 'olt-01-headend',
        ponPortNumber: Number(ponPortNumber) || 1,
        feedSourceType: effectiveFeedSourceType,
        feedLegType: resolvedFeedLeg,
        fbtRatio,
        tapSubSplitEnabled: isSub,
        branchDirection: isSub ? branchDirection : 'direct',
        plcSplitterType,
        totalPorts,
        fiberCoreColor,
        splitterType: finalSplitterType,
        ports,
        ...(resolvedUpstreamNapId ? { upstreamNapId: resolvedUpstreamNapId } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
    }

    setShowAddBoxModal(false);
    setCode('');
    setName('');
    setLocation('');
    setIsCustomBarangay(false);
    setCustomBarangay('');
    setTapSubSplitEnabled(false);
    setBranchDirection('direct');
    setAutoCreateTwin(false);
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
            onClick={() => openAddBoxModal()}
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

        <button
          onClick={() => setViewMode('ptp_trunks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            viewMode === 'ptp_trunks'
              ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/60 shadow-[0_0_15px_rgba(99,102,241,0.35)]'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <span>⚡ 10G Point-to-Point Trunks ({ptpLinks.length} Circuits)</span>
        </button>
      </div>

      {/* View: Coverage Area & Fiber Readiness Manager */}
      {viewMode === 'coverage_areas' && (
        <CoverageAreaManager />
      )}

      {/* View: 10G Point-to-Point Trunk Inventory & Telemetry Matrix */}
      {viewMode === 'ptp_trunks' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Circuits</span>
              <span className="text-xl font-bold font-mono text-indigo-400 mt-1 block">{ptpLinks.length} Trunks</span>
              <span className="text-[10px] text-slate-500 font-mono">Dedicated DIA Lines</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-emerald-900/40 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">Healthy Signal</span>
              <span className="text-xl font-bold font-mono text-emerald-300 mt-1 block">
                {ptpLinks.filter((l) => l.opticalReadingStatus === 'optimal' || l.opticalReadingStatus === 'good').length} Links
              </span>
              <span className="text-[10px] text-slate-500 font-mono">-3.0 to -12.0 dBm</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-amber-900/40 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">Marginal Warning</span>
              <span className="text-xl font-bold font-mono text-amber-300 mt-1 block">
                {ptpLinks.filter((l) => l.opticalReadingStatus === 'marginal').length} Links
              </span>
              <span className="text-[10px] text-slate-500 font-mono">-12.1 to -14.0 dBm</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-rose-900/40 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-rose-400 block tracking-wider">Critical / High Loss</span>
              <span className="text-xl font-bold font-mono text-rose-400 mt-1 block">
                {ptpLinks.filter((l) => l.opticalReadingStatus === 'critical').length} Links
              </span>
              <span className="text-[10px] text-slate-500 font-mono">&gt; 14.0 dB Loss</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total OSP Span</span>
              <span className="text-xl font-bold font-mono text-cyan-300 mt-1 block">
                {(ptpLinks.reduce((acc, l) => acc + (l.cableLengthMeters || 0), 0) / 1000).toFixed(2)} km
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Dedicated Route Fiber</span>
            </div>
          </div>

          {/* Action & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search circuits by code, router name, remote POP, or CASURECO pole #..."
                value={ptpSearchTerm}
                onChange={(e) => setPtpSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('gis_map')}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>Locate on GIS Map</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingPtpLink(null);
                  setShowPtpModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
              >
                <Plus className="w-3.5 h-3.5 text-amber-300" />
                <span>+ Deploy 10G Point-to-Point Trunk</span>
              </button>
            </div>
          </div>

          {/* Global Action Toast if any */}
          {ptpActionToast && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center justify-between border animate-in fade-in ${
                ptpActionToast.type === 'success'
                  ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300'
                  : 'bg-rose-950/70 border-rose-800/80 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-mono">{ptpActionToast.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setPtpActionToast(null)}
                className="text-slate-400 hover:text-white px-1 text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* Point-to-Point Circuits Table / List */}
          {(() => {
            const filteredLinks = ptpLinks.filter((l) => {
              if (!ptpSearchTerm.trim()) return true;
              const term = ptpSearchTerm.toLowerCase();
              return (
                l.code.toLowerCase().includes(term) ||
                l.name.toLowerCase().includes(term) ||
                l.routerName.toLowerCase().includes(term) ||
                l.remoteNodeName.toLowerCase().includes(term) ||
                l.remoteLocation.toLowerCase().includes(term) ||
                (l.routerPoleNumber && l.routerPoleNumber.toLowerCase().includes(term)) ||
                (l.remotePoleNumber && l.remotePoleNumber.toLowerCase().includes(term))
              );
            });

            if (filteredLinks.length === 0) {
              return (
                <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-950/60 border border-indigo-800/50 text-indigo-400 flex items-center justify-center mx-auto">
                    <Zap className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-200">No 10G Point-to-Point Trunks Found</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {ptpSearchTerm
                      ? `No circuits match "${ptpSearchTerm}". Try another search term.`
                      : 'Deploy dedicated high-bandwidth Point-to-Point links attached to your Main DIA Router going to remote towers or aggregation POPs.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPtpLink(null);
                      setShowPtpModal(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Deploy First 10G P2P Trunk</span>
                  </button>
                </div>
              );
            }

            return (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-mono text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5">Circuit / Link Code</th>
                      <th className="p-3.5">Endpoint A (Main DIA)</th>
                      <th className="p-3.5">Endpoint B (Remote)</th>
                      <th className="p-3.5">Span & Utility Poles</th>
                      <th className="p-3.5">Live SFP+ Telemetry</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredLinks.map((link) => {
                      const optical = calculatePtpOpticalStatus(
                        link.measuredRxPowerDbm,
                        link.nominalTxPowerDbm,
                        link.maxLossBudgetDb,
                        link.cableLengthMeters
                      );
                      const totalLoss = (link.nominalTxPowerDbm - link.measuredRxPowerDbm).toFixed(2);
                      const headroom = (link.maxLossBudgetDb - (link.nominalTxPowerDbm - link.measuredRxPowerDbm)).toFixed(2);

                      return (
                        <tr key={link.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 align-top">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono font-bold text-[11px] border border-indigo-800/60">
                                {link.code}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                                  link.opticalReadingStatus === 'optimal'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : link.opticalReadingStatus === 'good'
                                    ? 'bg-sky-950 text-sky-300 border border-sky-800'
                                    : link.opticalReadingStatus === 'marginal'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                                }`}
                              >
                                {optical.statusLabel}
                              </span>
                            </div>
                            <div className="font-bold text-slate-200 mt-1.5">{link.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {formatPtpSpeed(link.type)} • {link.fiberType || 'Single Mode 10G-LR'}
                            </div>
                          </td>

                          <td className="p-3.5 align-top space-y-1">
                            <div className="font-bold text-slate-200 flex items-center gap-1.5">
                              <span>🏢</span>
                              <span>{link.routerName}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              Port: <strong className="text-cyan-300">{link.routerPort}</strong>
                            </div>
                            <div className="text-[11px] text-amber-300/90 font-mono">
                              Pole: <strong>{link.routerPoleNumber || 'NOC Pole'}</strong>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {link.routerLatitude.toFixed(4)}°, {link.routerLongitude.toFixed(4)}°
                            </div>
                          </td>

                          <td className="p-3.5 align-top space-y-1">
                            <div className="font-bold text-slate-200 flex items-center gap-1.5">
                              <span>📡</span>
                              <span>{link.remoteNodeName}</span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {link.remoteLocation}
                            </div>
                            <div className="text-[11px] text-cyan-300 font-mono">
                              Device: {link.remoteDeviceType || 'Remote SFP+ Gateway'}
                            </div>
                            <div className="text-[11px] text-amber-300/90 font-mono">
                              Pole / Tower: <strong>{link.remotePoleNumber || 'Remote Pole'}</strong>
                            </div>
                          </td>

                          <td className="p-3.5 align-top space-y-1 font-mono">
                            <div className="text-slate-200">
                              Route: <strong className="text-amber-300">{link.cableLengthMeters ? `${link.cableLengthMeters}m` : '1000m'}</strong>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1">
                              <span>🪵 Poles:</span>
                              <span className="px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 font-bold border border-amber-800/40">
                                {link.intermediatePoles?.length || 0} Utility Poles
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Delay: ~{(((link.cableLengthMeters || 1000) / 200000) * 1000).toFixed(2)} µs
                            </div>
                          </td>

                          <td className="p-3.5 align-top space-y-1 font-mono">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">Rx:</span>
                              <span
                                className={`font-bold text-xs ${
                                  link.opticalReadingStatus === 'critical'
                                    ? 'text-rose-400'
                                    : link.opticalReadingStatus === 'marginal'
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {link.measuredRxPowerDbm.toFixed(1)} dBm
                              </span>
                              <span className="text-slate-500 text-[10px]">
                                (Tx {link.nominalTxPowerDbm.toFixed(1)})
                              </span>
                            </div>

                            <div className="text-[10px] text-slate-400">
                              Loss: <strong className="text-indigo-300">{totalLoss} dB</strong> • Headroom: <strong className="text-emerald-400">+{headroom} dB</strong>
                            </div>

                            <button
                              type="button"
                              onClick={() => handlePollPtpLink(link)}
                              disabled={isPollingPtp === link.id}
                              className="mt-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-mono font-bold flex items-center gap-1 cursor-pointer bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/60 px-2 py-0.5 rounded-lg transition-all disabled:opacity-50"
                              title="Poll live DDM from MikroTik Router"
                            >
                              <Zap className={`w-3 h-3 ${isPollingPtp === link.id ? 'animate-spin' : 'text-amber-400'}`} />
                              <span>{isPollingPtp === link.id ? 'Polling...' : 'Live Poll'}</span>
                            </button>
                          </td>

                          <td className="p-3.5 align-top text-right space-x-1 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPtpLink(link);
                                setShowPtpModal(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Edit 10G Point-to-Point Link"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete 10G Point-to-Point trunk "${link.name}" (${link.code})?`)) {
                                  deletePtpLink(link.id);
                                }
                              }}
                              className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-950/80 text-rose-400 hover:text-rose-300 border border-rose-900/40 transition-colors"
                              title="Delete 10G P2P Link"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* Primary View: Fiber GIS Map */}
      {viewMode === 'gis_map' && (
        <FiberGisMap
          onSelectCustomer={onSelectCustomer}
          onDeployNapAtLocation={(coords) => {
            openAddBoxModal(coords);
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
          {/* Hardware Matrix Filter Bar */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-card">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={matrixSearchQuery}
                  onChange={(e) => setMatrixSearchQuery(e.target.value)}
                  placeholder="Search NAP by code, name, pole location..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={matrixBarangayFilter}
                  onChange={(e) => setMatrixBarangayFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Barangays</option>
                  {matrixBarangays.map((b) => (
                    <option key={`brgy-${b}`} value={b}>
                      Brgy. {b}
                    </option>
                  ))}
                </select>

                <select
                  value={matrixPonFilter}
                  onChange={(e) => setMatrixPonFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-300 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="all">All PON Ports</option>
                  {matrixPonPorts.map((p) => (
                    <option key={`pon-${p}`} value={String(p)}>
                      PON #{p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-400 font-medium text-[11px]">
              <span>Showing <strong className="text-cyan-400 font-mono">{filteredMatrixBoxes.length}</strong> of {napBoxes.length} NAPs</span>
              {(matrixSearchQuery || matrixBarangayFilter !== 'all' || matrixPonFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setMatrixSearchQuery('');
                    setMatrixBarangayFilter('all');
                    setMatrixPonFilter('all');
                  }}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {filteredMatrixBoxes.length === 0 && (
            <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800/80 text-slate-400 text-xs">
              No NAP boxes matched the search or filter criteria.
            </div>
          )}

          {/* NAP Box Selector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredMatrixBoxes.map((box) => {
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
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/40">
                      {box.code}
                    </span>
                    {box.fbtRatio && (
                      <span className="font-mono text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                        {box.fbtRatio === 'terminal' ? 'Terminal' : `${box.fbtRatio} FBT`}
                      </span>
                    )}
                    {box.tapSubSplitEnabled && (
                      <span className="font-mono text-[9px] font-bold text-cyan-300 bg-cyan-950/70 px-1.5 py-0.5 rounded border border-cyan-700/50 flex items-center gap-1">
                        <Split className="w-2.5 h-2.5" />
                        <span>50/50 {box.branchDirection ? box.branchDirection.toUpperCase() : 'SUB'}</span>
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

                    {/* Quick Re-link Feed Parent */}
                    {napsOnPon.length > 1 && (
                      <div className="pt-1.5 pb-1 border-t border-slate-900 flex items-center justify-between gap-2 text-[10px]">
                        <span className="text-slate-400 font-medium">Re-link Parent:</span>
                        <select
                          value={activeBox.feedSourceType === 'olt' || !activeBox.upstreamNapId ? '__olt__' : activeBox.upstreamNapId}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '__olt__') {
                              updateNapBox(activeBox.id, { feedSourceType: 'olt', upstreamNapId: undefined });
                            } else {
                              updateNapBox(activeBox.id, { feedSourceType: 'nap', upstreamNapId: val });
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-[10px] focus:outline-none focus:border-cyan-400 font-semibold"
                        >
                          <option value="__olt__">🏢 Central OLT (Feeder Root)</option>
                          {napsOnPon
                            .filter((b) => b.id !== activeBox.id)
                            .map((b) => (
                              <option key={`relink-${b.id}`} value={b.id}>
                                ⚡ Cascaded from {b.code} ({b.name})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

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
                      <div className="space-y-2 font-mono text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Arriving Input Power:</span>
                          <span className="text-cyan-300 font-bold">{currentHop.arrivingInputPowerDbm} dBm</span>
                        </div>

                        {/* FBT Ratio Selector */}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">FBT Coupler:</span>
                          <select
                            value={activeBox.fbtRatio || '85/15'}
                            onChange={(e) => {
                              const newRatio = e.target.value as FbtSplitterRatio;
                              const isSub = activeBox.tapSubSplitEnabled && newRatio !== 'terminal';
                              const newSplitterType = isSub
                                ? `${activeBox.plcSplitterType || '1:16'} PLC (${newRatio} FBT ➔ 50/50 ${activeBox.branchDirection === 'left' ? 'Left' : activeBox.branchDirection === 'right' ? 'Right' : 'Branch'})`
                                : `${activeBox.plcSplitterType || '1:16'} PLC (${newRatio === 'terminal' ? '100% Terminal' : `${newRatio} FBT`})`;
                              updateNapBox(activeBox.id, {
                                fbtRatio: newRatio,
                                splitterType: newSplitterType,
                              });
                            }}
                            className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-300 font-mono text-[10px] font-bold focus:outline-none focus:border-amber-400"
                          >
                            <option value="98/2">98/2 FBT (~0.2dB / ~17.2dB)</option>
                            <option value="95/5">95/5 FBT (~0.4dB / ~13.4dB)</option>
                            <option value="90/10">90/10 FBT (~0.6dB / ~10.6dB)</option>
                            <option value="85/15">85/15 FBT (~0.9dB / ~8.8dB)</option>
                            <option value="80/20">80/20 FBT (~1.2dB / ~7.4dB)</option>
                            <option value="75/25">75/25 FBT (~1.5dB / ~6.5dB)</option>
                            <option value="70/30">70/30 FBT (~1.8dB / ~5.6dB)</option>
                            <option value="60/40">60/40 FBT (~2.5dB / ~4.3dB)</option>
                            <option value="50/50">50/50 Symmetrical (~3.4dB)</option>
                            <option value="terminal">Terminal (100% Direct)</option>
                          </select>
                        </div>

                        {/* Through & Tap breakdown */}
                        {!currentHop.isTerminal && (
                          <div className="grid grid-cols-2 gap-1.5 p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                            <div>
                              <span className="text-purple-300 font-bold block text-[10px]">
                                ➡️ Trunk Through ({FBT_LOSS_SPECS[currentHop.fbtRatio].percentThrough}%)
                              </span>
                              <span className="text-slate-400 text-[10px]">Loss: -{currentHop.fbtThroughLossDb} dB</span>
                              <span className="text-purple-200 font-bold block text-[11px]">
                                {currentHop.throughOutputPowerDbm} dBm
                              </span>
                            </div>
                            <div>
                              <span className="text-amber-300 font-bold block text-[10px]">
                                🔀 Trunk Tap ({FBT_LOSS_SPECS[currentHop.fbtRatio].percentTap}%)
                              </span>
                              <span className="text-slate-400 text-[10px]">Loss: -{currentHop.fbtTapLossDb} dB</span>
                              <span className="text-amber-200 font-bold block text-[11px]">
                                {currentHop.tapOutputPowerDbm} dBm
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 50/50 Sub-Split Controls */}
                        {!currentHop.isTerminal && (
                          <div className="p-2 rounded-lg bg-amber-950/20 border border-amber-800/40 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer text-[10px]">
                                <input
                                  type="checkbox"
                                  checked={Boolean(activeBox.tapSubSplitEnabled)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    const dir = checked ? (activeBox.branchDirection === 'direct' ? 'left' : (activeBox.branchDirection || 'left')) : 'direct';
                                    const newSplitterType = checked
                                      ? `${activeBox.plcSplitterType || '1:16'} PLC (${activeBox.fbtRatio || '60/40'} FBT ➔ 50/50 ${dir === 'left' ? 'Left' : 'Right'})`
                                      : `${activeBox.plcSplitterType || '1:16'} PLC (${activeBox.fbtRatio || '85/15'} FBT)`;
                                    updateNapBox(activeBox.id, {
                                      tapSubSplitEnabled: checked,
                                      branchDirection: dir,
                                      splitterType: newSplitterType,
                                    });
                                  }}
                                  className="rounded border-amber-600/50 text-amber-500 focus:ring-amber-400"
                                />
                                <span className="font-semibold text-amber-200">50/50 Tap Sub-Split (Dual NAPs)</span>
                              </label>
                              {currentHop.tapSubSplitEnabled && (
                                <span className="text-amber-300 font-bold text-[10px]">-3.4 dB</span>
                              )}
                            </div>

                            {activeBox.tapSubSplitEnabled && (
                              <div className="flex items-center justify-between pt-1 border-t border-amber-900/30">
                                <span className="text-slate-400 text-[10px]">Branch:</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newSplitterType = `${activeBox.plcSplitterType || '1:16'} PLC (${activeBox.fbtRatio || '60/40'} FBT ➔ 50/50 Left)`;
                                      updateNapBox(activeBox.id, { branchDirection: 'left', splitterType: newSplitterType });
                                    }}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      activeBox.branchDirection === 'left'
                                        ? 'bg-amber-500 text-slate-950'
                                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    Left
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newSplitterType = `${activeBox.plcSplitterType || '1:16'} PLC (${activeBox.fbtRatio || '60/40'} FBT ➔ 50/50 Right)`;
                                      updateNapBox(activeBox.id, { branchDirection: 'right', splitterType: newSplitterType });
                                    }}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      activeBox.branchDirection === 'right'
                                        ? 'bg-amber-500 text-slate-950'
                                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    Right
                                  </button>
                                </div>
                              </div>
                            )}

                            {activeBox.pairedBranchNapId && (
                              <div className="flex items-center justify-between pt-1 border-t border-amber-900/30 text-[10px]">
                                <span className="text-slate-400">Twin Branch:</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedBoxId(activeBox.pairedBranchNapId!)}
                                  className="text-cyan-400 hover:text-cyan-200 underline font-bold flex items-center gap-1"
                                >
                                  <span>{napBoxes.find((b) => b.id === activeBox.pairedBranchNapId)?.code || 'View Twin'}</span>
                                  <ArrowRight className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">PLC Drop Splitter:</span>
                          <span className="text-slate-200 font-bold">{currentHop.plcType} (-{currentHop.plcLossDb}dB)</span>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Fiber Port Matrix ({activeBox.totalPorts} Ports)
              </h4>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setPortStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    portStatusFilter === 'all' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({activeBox.ports.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPortStatusFilter('available')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    portStatusFilter === 'available' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Available ({activeBox.ports.filter((p) => p.status === 'available').length})
                </button>
                <button
                  type="button"
                  onClick={() => setPortStatusFilter('occupied')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    portStatusFilter === 'occupied' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Occupied ({activeBox.ports.filter((p) => p.status === 'occupied').length})
                </button>
                <button
                  type="button"
                  onClick={() => setPortStatusFilter('other')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    portStatusFilter === 'other' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Reserved / Faulty ({activeBox.ports.filter((p) => p.status === 'reserved' || p.status === 'damaged').length})
                </button>
              </div>
            </div>

            {filteredPorts.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800/80 text-slate-500 text-xs">
                No ports matched the selected filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {filteredPorts.map((port) => {
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
                        <div className="space-y-2">
                          <div className="text-xs text-slate-500 py-1">
                            {port.status === 'damaged'
                              ? 'Fiber core fault / repair needed'
                              : port.status === 'reserved'
                              ? 'Reserved for upcoming install'
                              : 'Ready for new drop cable connection'}
                          </div>

                          {/* Quick Port Status Actions */}
                          <div className="pt-2 border-t border-slate-800/60 flex items-center gap-1 text-[10px]">
                            <span className="text-slate-500 mr-1">Mark:</span>
                            <button
                              type="button"
                              onClick={() => handleUpdatePortStatus(activeBox.id, port.portNumber, 'available')}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                port.status === 'available'
                                  ? 'bg-slate-700 text-slate-200 font-bold border border-slate-600'
                                  : 'bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-slate-300'
                              }`}
                              title="Mark Port as Available"
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdatePortStatus(activeBox.id, port.portNumber, 'reserved')}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                port.status === 'reserved'
                                  ? 'bg-amber-950 text-amber-300 font-bold border border-amber-700'
                                  : 'bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-amber-300'
                              }`}
                              title="Mark Port as Reserved"
                            >
                              Reserved
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdatePortStatus(activeBox.id, port.portNumber, 'damaged')}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                port.status === 'damaged'
                                  ? 'bg-rose-950 text-rose-300 font-bold border border-rose-700'
                                  : 'bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-rose-300'
                              }`}
                              title="Mark Port as Damaged / Broken Core"
                            >
                              Damaged
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
                            let effectivePort = ponPortNumber;
                            if (ponPortNumber > (target.totalPonPorts || 16)) {
                              effectivePort = 1;
                              setPonPortNumber(1);
                            }
                            const cands = napBoxes.filter(
                              (b) => (b.oltId === id) && (b.ponPortNumber || 1) === effectivePort
                            );
                            if (cands.length > 0) {
                              const p = cands[cands.length - 1];
                              setFeedSourceType('nap');
                              setUpstreamNapId(p.id);
                              if (!isCustomBarangay) {
                                setBarangay(p.barangay);
                                setLatitude(Number((p.latitude + 0.0018).toFixed(4)));
                                setLongitude(Number((p.longitude + 0.0015).toFixed(4)));
                              }
                            } else {
                              setFeedSourceType('olt');
                              setUpstreamNapId('');
                              if (!isCustomBarangay) {
                                setBarangay(target.barangay);
                                setLatitude(Number(target.latitude.toFixed(4)));
                                setLongitude(Number(target.longitude.toFixed(4)));
                              }
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
                        onChange={(e) => {
                          const newPort = Number(e.target.value);
                          setPonPortNumber(newPort);
                          const cands = napBoxes.filter(
                            (b) =>
                              (b.oltId === selectedOltId || (!b.oltId && selectedOltId === oltNodes[0]?.id)) &&
                              (b.ponPortNumber || 1) === newPort
                          );
                          if (cands.length > 0) {
                            const p = cands[cands.length - 1];
                            setFeedSourceType('nap');
                            setUpstreamNapId(p.id);
                            if (!isCustomBarangay) {
                              setBarangay(p.barangay);
                            }
                            if (!isUserCoordSet) {
                              setLatitude(Number((p.latitude + 0.0018).toFixed(4)));
                              setLongitude(Number((p.longitude + 0.0015).toFixed(4)));
                            }
                          } else {
                            setFeedSourceType('olt');
                            setUpstreamNapId('');
                          }
                        }}
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

                      {(() => {
                        const candidates = napBoxes.filter(
                          (b) =>
                            (b.oltId === selectedOltId || (!b.oltId && selectedOltId === oltNodes[0]?.id)) &&
                            (b.ponPortNumber || 1) === Number(ponPortNumber)
                        );
                        const hasCandidates = candidates.length > 0;

                        return (
                          <button
                            type="button"
                            disabled={!hasCandidates}
                            onClick={() => {
                              if (!hasCandidates) return;
                              setFeedSourceType('nap');
                              const targetParent = candidates.find((b) => b.id === upstreamNapId) || candidates[candidates.length - 1] || candidates[0];
                              if (targetParent) {
                                setUpstreamNapId(targetParent.id);
                                if (!isCustomBarangay) {
                                  setBarangay(targetParent.barangay);
                                }
                                if (!isUserCoordSet) {
                                  setLatitude(Number((targetParent.latitude + 0.0018).toFixed(4)));
                                  setLongitude(Number((targetParent.longitude + 0.0015).toFixed(4)));
                                }
                              }
                            }}
                            className={`p-2 rounded-xl border text-left text-xs font-semibold transition-all ${
                              feedSourceType === 'nap'
                                ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-sm'
                                : hasCandidates
                                ? 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700'
                                : 'bg-slate-950/40 border-slate-800/40 text-slate-600 cursor-not-allowed opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <Radio className={`w-3 h-3 ${hasCandidates ? 'text-cyan-400' : 'text-slate-600'}`} />
                              <span className="text-[11px]">Upstream NAP (Hop)</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                              {hasCandidates ? 'Daisy-chain from box' : `No prior boxes on PON #${ponPortNumber}`}
                            </span>
                          </button>
                        );
                      })()}
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
                                  }
                                  // Do not wipe out coordinates when choosing parent — pole coordinates remain preserved!
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
                                      setIsUserCoordSet(true);
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
                        onChange={(e) => {
                          const val = e.target.value as FbtSplitterRatio;
                          setFbtRatio(val);
                          if (val === '60/40') {
                            setTapSubSplitEnabled(true);
                            setAutoCreateTwin(true);
                            setBranchDirection('left');
                          } else if (val === 'terminal') {
                            setTapSubSplitEnabled(false);
                            setAutoCreateTwin(false);
                            setBranchDirection('direct');
                          }
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-amber-600/50 rounded-xl text-slate-100 font-mono text-xs font-bold focus:outline-none focus:border-amber-400"
                      >
                        <option value="98/2">98/2 FBT (~0.2dB thru / ~17.2dB tap - Ultra-low through loss)</option>
                        <option value="95/5">95/5 FBT (~0.4dB thru / ~13.4dB tap - High trunk continuation)</option>
                        <option value="90/10">90/10 FBT (~0.6dB thru / ~10.6dB tap)</option>
                        <option value="85/15">85/15 FBT (~0.9dB thru / ~8.8dB tap)</option>
                        <option value="80/20">80/20 FBT (~1.2dB thru / ~7.4dB tap)</option>
                        <option value="75/25">75/25 FBT (~1.5dB thru / ~6.5dB tap)</option>
                        <option value="70/30">70/30 FBT (~1.8dB thru / ~5.6dB tap)</option>
                        <option value="60/40">60/40 FBT (60% Trunk ➔ +0.95dBm / 40% Tap ➔ 50/50 Dual 16-Port NAPs)</option>
                        <option value="50/50">50/50 Symmetrical (1x2 ~3.4dB split)</option>
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

                  {/* FBT Sub-Split Configuration */}
                  {fbtRatio !== 'terminal' && (
                    <div className="p-2.5 rounded-2xl bg-gradient-to-r from-amber-950/40 to-purple-950/30 border border-amber-800/50 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={tapSubSplitEnabled}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setTapSubSplitEnabled(checked);
                              if (checked) {
                                setAutoCreateTwin(true);
                                setBranchDirection('left');
                              } else {
                                setBranchDirection('direct');
                                setAutoCreateTwin(false);
                              }
                            }}
                            className="rounded border-amber-600/60 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5 bg-slate-900"
                          />
                          <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                            <Split className="w-3.5 h-3.5 text-amber-400" />
                            50/50 Sub-Split on Tap Leg (-3.4 dB)
                          </span>
                        </label>
                        <span className="text-[10px] text-emerald-300 font-mono bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-700/60 font-bold">
                          {tapSubSplitEnabled && autoCreateTwin ? '32 Ports Total (2x 16-Port NAPs)' : '16 Ports'}
                        </span>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-950/80 border border-amber-900/40 text-[10px] text-slate-300 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-amber-300 font-semibold">⚡ 40% Tap Leg Split:</span>
                          <span className="font-mono text-cyan-300">50/50 Sub-Split (-3.4 dB) ➔ 2x 16-Port NAPs</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>🔄 60% Through Leg:</span>
                          <span className="font-mono text-purple-300">Cascades downstream to Hop #2 (NAP-02)</span>
                        </div>
                      </div>

                      {tapSubSplitEnabled && (
                        <div className="pt-1.5 border-t border-amber-900/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-amber-200 font-semibold">Deployment Architecture:</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setAutoCreateTwin(true);
                                  setBranchDirection('left');
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition-all flex items-center gap-1 ${
                                  autoCreateTwin
                                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-md font-black'
                                    : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                <ArrowLeftRight className="w-3 h-3" />
                                <span>Dual 16-Port Twin Hub (32 Ports)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setAutoCreateTwin(false);
                                  setBranchDirection('left');
                                }}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold font-mono transition-all ${
                                  !autoCreateTwin && branchDirection === 'left'
                                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                                    : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                ◀ Left Only
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setAutoCreateTwin(false);
                                  setBranchDirection('right');
                                }}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold font-mono transition-all ${
                                  !autoCreateTwin && branchDirection === 'right'
                                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                                    : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                Right Only ▶
                              </button>
                            </div>
                          </div>

                          {autoCreateTwin && (
                            <div className="px-2.5 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-[10px] text-emerald-300 flex items-center gap-2">
                              <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>
                                Will deploy <strong>{code || 'NAP'}-L</strong> (Left) & <strong>{code || 'NAP'}-R</strong> (Right) at the <strong>exact same pole GPS coordinates</strong> with 32 total subscriber ports.
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

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

                    const baseTx = typeof targetOlt?.txPowerDbm === 'number' ? targetOlt.txPowerDbm : 4.0;

                    const preview = calculateSingleHopBudgetPreview({
                      baseTxPowerDbm: baseTx,
                      upstreamThroughPowerDbm: upstreamTelemetry?.throughOutputPowerDbm,
                      upstreamTapSubSplitPowerDbm: upstreamTelemetry?.branchInputPowerDbm,
                      isFeedFromSubSplit: feedLegType === 'tap_subsplit',
                      routeCableMeters: hopSpan.routeCableMeters,
                      fbtRatio,
                      plcSplitterType,
                      tapSubSplitEnabled,
                      branchDirection,
                    });

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
                              preview.health.status === 'optimal'
                                ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                                : preview.health.status === 'acceptable'
                                ? 'bg-cyan-950 text-cyan-300 border-cyan-800/60'
                                : 'bg-amber-950 text-amber-400 border-amber-800/60'
                            }`}
                          >
                            {preview.health.label}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Hop Span ({parentCoords?.name}):</span>
                            <span className="text-cyan-300 font-bold">{hopSpan.formattedDirect}</span>
                            <span className="text-slate-500 text-[10px] block">Cable: {hopSpan.formattedRoute}</span>
                          </div>

                          <div>
                            <span className="text-slate-500 block text-[10px]">
                              Drop Rx Signal {tapSubSplitEnabled ? `(${branchDirection.toUpperCase()})` : ''}:
                            </span>
                            <span
                              className={`font-black text-sm ${
                                preview.health.status === 'optimal'
                                  ? 'text-emerald-400'
                                  : preview.health.status === 'acceptable'
                                  ? 'text-cyan-300'
                                  : 'text-amber-400'
                              }`}
                            >
                              {preview.dropPortRxPowerDbm} dBm
                            </span>
                            <span className="text-slate-500 text-[10px] block">Input: {preview.arrivingInputPowerDbm} dBm</span>
                          </div>
                        </div>

                        {/* FBT Output breakdown */}
                        {preview.throughOutputPowerDbm !== null && (
                          <div className="pt-1.5 border-t border-slate-900 grid grid-cols-2 gap-2 text-[10px]">
                            <div className="p-1.5 rounded-lg bg-amber-950/30 border border-amber-900/40">
                              <span className="text-amber-400/80 block font-medium">
                                {fbtRatio.split('/')[0]}% Through (Next Hop):
                              </span>
                              <span className="text-amber-200 font-bold">{preview.throughOutputPowerDbm} dBm</span>
                            </div>
                            <div className="p-1.5 rounded-lg bg-cyan-950/30 border border-cyan-900/40">
                              <span className="text-cyan-400/80 block font-medium">
                                {fbtRatio.split('/')[1] || 'Tap'}% Local Tap:
                              </span>
                              <span className="text-cyan-200 font-bold">{preview.tapOutputPowerDbm} dBm</span>
                            </div>
                          </div>
                        )}

                        {/* Sub-split breakdown if enabled */}
                        {tapSubSplitEnabled && (
                          <div className="p-1.5 rounded-lg bg-purple-950/30 border border-purple-900/40 flex items-center justify-between text-[10px]">
                            <div>
                              <span className="text-purple-300 font-semibold block flex items-center gap-1">
                                <Split className="w-3 h-3 text-purple-400" />
                                50/50 Sub-Split Branch In:
                              </span>
                              <span className="text-slate-200 font-bold">{preview.branchInputPowerDbm} dBm</span>
                              <span className="text-slate-500 ml-1">(-3.4 dB split + 0.1 dB splice)</span>
                            </div>
                            <div className="text-right">
                              <span className="text-emerald-400 font-bold block">
                                {autoCreateTwin ? '2 x 16 = 32 Ports' : '16 Ports (Branch)'}
                              </span>
                              <span className="text-slate-400 text-[9px]">Dual Branch Capacity</span>
                            </div>
                          </div>
                        )}

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
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        <span>Roadside Utility Pole GPS</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddBoxModal(false);
                          setViewMode('gis_map');
                        }}
                        className="text-cyan-400 hover:text-cyan-300 font-medium text-[10px] flex items-center gap-1 cursor-pointer bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/60 px-2 py-0.5 rounded-lg transition-colors"
                        title="Close modal and pick/drag pole location directly on satellite map"
                      >
                        <span>🗺️ Pick & Drag on Satellite Map</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-slate-400 mb-1 font-medium text-[11px]">GPS Latitude (North)</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={latitude}
                          onChange={(e) => {
                            setLatitude(Number(e.target.value));
                            setIsUserCoordSet(true);
                          }}
                          placeholder="13.6870"
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-medium text-[11px]">GPS Longitude (East)</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={longitude}
                          onChange={(e) => {
                            setLongitude(Number(e.target.value));
                            setIsUserCoordSet(true);
                          }}
                          placeholder="123.5210"
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500 font-bold"
                        />
                      </div>
                    </div>

                    {/* GPS Auto-align notice */}
                    <div className="px-2.5 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-900/50 flex items-center justify-between text-[10px] text-cyan-300">
                      <span className="flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-cyan-400" />
                        {isUserCoordSet ? (
                          <span>
                            📍 <strong className="text-emerald-400 font-bold">User Pole Coordinates Locked:</strong> ({latitude?.toFixed(4)}°, {longitude?.toFixed(4)}°)
                          </span>
                        ) : (
                          <span>GPS aligned to <strong>Brgy. {isCustomBarangay ? customBarangay || 'Custom' : barangay}</strong></span>
                        )}
                      </span>
                      {isUserCoordSet && (
                        <button
                          type="button"
                          onClick={() => {
                            const coords = getBarangayCoordinates(barangay);
                            setLatitude(Number(coords.lat.toFixed(4)));
                            setLongitude(Number(coords.lng.toFixed(4)));
                            setIsUserCoordSet(false);
                          }}
                          className="text-slate-400 hover:text-cyan-300 text-[9px] underline"
                        >
                          Reset to Center
                        </button>
                      )}
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

      {/* 10G Point-to-Point Link Configuration Modal */}
      <PtpLinkModal
        isOpen={showPtpModal}
        onClose={() => {
          setShowPtpModal(false);
          setEditingPtpLink(null);
        }}
        editingLinkId={editingPtpLink?.id}
        editingLink={editingPtpLink}
      />
    </div>
  );
};

