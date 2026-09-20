import React, { useState, useRef, useMemo } from 'react';
import {
  MapPin,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Activity,
  Zap,
  Radio,
  Server,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Download,
  Plus,
  Compass,
  Eye,
  EyeOff,
  Search,
  Filter,
  Sliders,
  ChevronRight,
  X,
  Gauge,
  Cpu,
  Scissors,
  Wrench,
  FileSpreadsheet,
  Trash2,
  Ruler,
  Waypoints,
  Split,
  ArrowLeftRight,
  Move,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FiberCable, FiberClosure, GeoPoint, NapBox, NapPort, OltPopNode, Customer } from '../../types';
import { formatCurrency, formatPhoneNumber } from '../../utils/formatters';
import { RealLeafletMap, RealMapTileStyle } from './RealLeafletMap';
import { OltRegistrationModal } from './OltRegistrationModal';
import { isGoogleMapsConfigured } from '../../services/googleMapsService';
import {
  getOltToNapDistance,
  getNapToNapDistance,
  calculateSpanMetrics,
} from '../../utils/geoDistance';
import {
  buildPonCascadeChain,
  calculateCascadeTelemetry,
  CascadeHopTelemetry,
} from '../../utils/opticalBudget';

interface FiberGisMapProps {
  onSelectCustomer?: (customerId: string) => void;
  onDeployNapAtLocation?: (coords: { lat: number; lng: number }) => void;
  onRegisterOltAtLocation?: (coords: { lat: number; lng: number }) => void;
}

// Bounding box for Lagonoy, Camarines Sur
const GEO_BOUNDS = {
  minLat: 13.6780,
  maxLat: 13.6960,
  minLng: 123.5140,
  maxLng: 123.5290,
};

const SVG_WIDTH = 1200;
const SVG_HEIGHT = 800;

// Coordinate transformation
const projectGeoToSvg = (lat: number, lng: number): { x: number; y: number } => {
  const x = ((lng - GEO_BOUNDS.minLng) / (GEO_BOUNDS.maxLng - GEO_BOUNDS.minLng)) * SVG_WIDTH;
  // Invert Y because latitude goes South -> North but SVG goes Top -> Bottom
  const y = SVG_HEIGHT - ((lat - GEO_BOUNDS.minLat) / (GEO_BOUNDS.maxLat - GEO_BOUNDS.minLat)) * SVG_HEIGHT;
  return { x, y };
};

// Standard TIA-598-A 12-Core Fiber Color Code
const FIBER_COLOR_CODES = [
  { num: 1, name: 'Blue', hex: '#0284c7', text: '#ffffff' },
  { num: 2, name: 'Orange', hex: '#ea580c', text: '#ffffff' },
  { num: 3, name: 'Green', hex: '#16a34a', text: '#ffffff' },
  { num: 4, name: 'Brown', hex: '#854d0e', text: '#ffffff' },
  { num: 5, name: 'Slate / Gray', hex: '#64748b', text: '#ffffff' },
  { num: 6, name: 'White', hex: '#f8fafc', text: '#0f172a' },
  { num: 7, name: 'Red', hex: '#dc2626', text: '#ffffff' },
  { num: 8, name: 'Black', hex: '#1e293b', text: '#ffffff' },
  { num: 9, name: 'Yellow', hex: '#eab308', text: '#0f172a' },
  { num: 10, name: 'Violet / Purple', hex: '#9333ea', text: '#ffffff' },
  { num: 11, name: 'Rose / Pink', hex: '#ec4899', text: '#ffffff' },
  { num: 12, name: 'Aqua / Cyan', hex: '#06b6d4', text: '#0f172a' },
];

export const FiberGisMap: React.FC<FiberGisMapProps> = ({
  onSelectCustomer,
  onDeployNapAtLocation,
  onRegisterOltAtLocation,
}) => {
  const {
    napBoxes,
    customers,
    fiberCables = [],
    fiberClosures = [],
    oltNodes = [],
    oltNode,
    businessProfile,
    addNapBox,
    addFiberCable,
    updateFiberCable,
    addFiberClosure,
    updateFiberClosure,
    updateOltNode,
    updateNapBox,
    deleteNapBox,
  } = useApp();

  const isGoogleAvailable = isGoogleMapsConfigured(businessProfile);

  const effectiveOltNodes = oltNodes.length > 0 ? oltNodes : (oltNode ? [oltNode] : []);
  const primaryOlt = effectiveOltNodes[0] || oltNode;

  // OLT Filter state
  const [selectedOltFilter, setSelectedOltFilter] = useState<string>('all');
  const [editingOltId, setEditingOltId] = useState<string | null>(null);

  const filteredNapBoxes = useMemo(() => {
    if (selectedOltFilter === 'all') return napBoxes;
    return napBoxes.filter(
      (b) => b.oltId === selectedOltFilter || (!b.oltId && selectedOltFilter === effectiveOltNodes[0]?.id)
    );
  }, [napBoxes, selectedOltFilter, effectiveOltNodes]);

  // Map viewport transform state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [mapStyle, setMapStyle] = useState<RealMapTileStyle | 'schematic'>(
    isGoogleAvailable ? 'google_hybrid' : 'satellite'
  );

  // Layer visibility toggles
  const [showOlt, setShowOlt] = useState<boolean>(true);
  const [showFeeder, setShowFeeder] = useState<boolean>(true);
  const [showDistribution, setShowDistribution] = useState<boolean>(true);
  const [showNaps, setShowNaps] = useState<boolean>(true);
  const [showClosures, setShowClosures] = useState<boolean>(true);
  const [showDropLines, setShowDropLines] = useState<boolean>(true);
  const [showCoverageRings, setShowCoverageRings] = useState<boolean>(true);
  const [showSpanDistances, setShowSpanDistances] = useState<'all' | 'olt' | 'inter_nap' | 'none'>('all');

  // Selected asset for drawer inspection
  const [selectedAsset, setSelectedAsset] = useState<{
    type: 'olt' | 'nap' | 'cable' | 'closure' | 'customer';
    data: any;
  } | null>(null);
  const [drawerInterNapTargetId, setDrawerInterNapTargetId] = useState<string>('');
  const [externalRouteEditNapId, setExternalRouteEditNapId] = useState<string | null>(null);

  // OLT Registration Modal state
  const [showOltModal, setShowOltModal] = useState<boolean>(false);
  const [oltModalCoords, setOltModalCoords] = useState<{ lat: number; lng: number } | null>(null);

  // OTDR Fault Simulation state
  const [showOtdrModal, setShowOtdrModal] = useState<boolean>(false);
  const [otdrDistanceMeters, setOtdrDistanceMeters] = useState<number>(650);
  const [activeOtdrBreak, setActiveOtdrBreak] = useState<{
    point: { x: number; y: number; lat: number; lng: number };
    cable: FiberCable;
    distance: number;
    affectedNaps: NapBox[];
    affectedCustomers: Customer[];
  } | null>(null);

  // Link Budget Calculator modal state
  const [showLinkBudgetModal, setShowLinkBudgetModal] = useState<boolean>(false);
  const [budgetTxPower, setBudgetTxPower] = useState<number>(4.5);
  const [budgetDistanceKm, setBudgetDistanceKm] = useState<number>(1.8);
  const [budgetSplices, setBudgetSplices] = useState<number>(4);
  const [budgetSplitter, setBudgetSplitter] = useState<'1:8' | '1:16' | '1:32'>('1:16');
  const [budgetConnectors, setBudgetConnectors] = useState<number>(2);

  // Add asset modal
  const [showAddAssetModal, setShowAddAssetModal] = useState<boolean>(false);
  const [assetTypeToAdd, setAssetTypeToAdd] = useState<'nap' | 'cable' | 'closure'>('nap');

  // Pan & Zoom mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag on left click
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.15;
    const newZoom = e.deltaY < 0 ? Math.min(zoom * zoomFactor, 5) : Math.max(zoom / zoomFactor, 0.5);
    setZoom(newZoom);
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setActiveOtdrBreak(null);
  };

  // Run OTDR Fault Locator
  const handleCalculateOtdrBreak = () => {
    if (fiberCables.length === 0) return;

    // Pick main feeder trunk
    const targetCable = fiberCables.find((c) => c.type === 'feeder') || fiberCables[0];
    const totalLen = targetCable.lengthMeters;
    const ratio = Math.min(Math.max(otdrDistanceMeters / totalLen, 0.05), 0.98);

    // Approximate point along cable path
    const coords = targetCable.pathCoordinates;
    const segmentIndex = Math.min(Math.floor(ratio * (coords.length - 1)), coords.length - 2);
    const p1 = coords[segmentIndex];
    const p2 = coords[segmentIndex + 1];

    const interpLat = p1.lat + (p2.lat - p1.lat) * (ratio % 1);
    const interpLng = p1.lng + (p2.lng - p1.lng) * (ratio % 1);
    const svgPt = projectGeoToSvg(interpLat, interpLng);

    // Downstream affected NAPs and Customers
    const affectedNaps = napBoxes.filter((n) => n.parentCableId === targetCable.id || n.barangay === 'Binauahan' || n.barangay === 'Poblacion');
    const affectedNapIds = new Set(affectedNaps.map((n) => n.id));
    const affectedCustomers = customers.filter((c) => c.network.napBoxId && affectedNapIds.has(c.network.napBoxId));

    setActiveOtdrBreak({
      point: { ...svgPt, lat: interpLat, lng: interpLng },
      cable: targetCable,
      distance: otdrDistanceMeters,
      affectedNaps,
      affectedCustomers,
    });

    setShowOtdrModal(false);
  };

  // Calculate Link Budget
  const computedLinkBudget = useMemo(() => {
    const fiberLoss = budgetDistanceKm * 0.35; // 0.35 dB/km at 1310nm
    const spliceLoss = budgetSplices * 0.05; // 0.05 dB per fusion splice
    const splitterLoss = budgetSplitter === '1:8' ? 10.5 : budgetSplitter === '1:16' ? 14.0 : 17.5;
    const connectorLoss = budgetConnectors * 0.5; // 0.5 dB per SC/APC connector
    const totalLoss = fiberLoss + spliceLoss + splitterLoss + connectorLoss;
    const estimatedRx = budgetTxPower - totalLoss;

    let status = 'EXCELLENT';
    let statusColor = 'text-emerald-400';
    if (estimatedRx < -26) {
      status = 'CRITICAL / LOW SIGNAL';
      statusColor = 'text-rose-400';
    } else if (estimatedRx < -22) {
      status = 'ACCEPTABLE / FAIR';
      statusColor = 'text-amber-400';
    }

    return {
      fiberLoss: fiberLoss.toFixed(2),
      spliceLoss: spliceLoss.toFixed(2),
      splitterLoss: splitterLoss.toFixed(2),
      connectorLoss: connectorLoss.toFixed(2),
      totalLoss: totalLoss.toFixed(2),
      estimatedRx: estimatedRx.toFixed(2),
      status,
      statusColor,
    };
  }, [budgetTxPower, budgetDistanceKm, budgetSplices, budgetSplitter, budgetConnectors]);

  // Export GeoJSON
  const handleExportGeoJson = () => {
    const features = [
      // All OLT Headend Features
      ...effectiveOltNodes.map((olt) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [olt.longitude, olt.latitude],
        },
        properties: {
          id: olt.id,
          code: olt.code,
          name: olt.name,
          barangay: olt.barangay,
          type: 'OLT_HEADEND',
          ponPorts: olt.totalPonPorts,
          activePonPorts: olt.activePonPorts,
          txPower: olt.txPowerDbm,
          ipAddress: olt.ipAddress,
        },
      })),
      // Cables
      ...fiberCables.map((c) => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: c.pathCoordinates.map((pt) => [pt.lng, pt.lat]),
        },
        properties: {
          name: c.name,
          code: c.code,
          coreCount: c.coreCount,
          type: c.type,
          lengthMeters: c.lengthMeters,
        },
      })),
      // NAP Boxes
      ...napBoxes.map((n) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [n.longitude, n.latitude],
        },
        properties: {
          name: n.name,
          code: n.code,
          ports: n.totalPorts,
          splitter: n.splitterType,
        },
      })),
      // Closures
      ...fiberClosures.map((f) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [f.longitude, f.latitude],
        },
        properties: {
          name: f.name,
          code: f.code,
          type: f.type,
          splices: f.totalSplices,
        },
      })),
    ];

    const geoJson = {
      type: 'FeatureCollection',
      name: 'SwiftStream_OutsidePlant_GIS_Lagonoy',
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
      features,
    };

    const blob = new Blob([JSON.stringify(geoJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swiftstream-fiber-osp-lagonoy-${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Metrics
  const totalRouteKm = (fiberCables.reduce((acc, c) => acc + c.lengthMeters, 0) / 1000).toFixed(2);
  const totalSplicesCount = fiberClosures.reduce((acc, f) => acc + f.totalSplices, 0);
  const activeDropsCount = customers.filter((c) => c.network.napBoxId).length;

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in">
      {/* Top Header & GIS Telemetry */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Compass className="w-5 h-5 text-cyan-400" />
            <span>Fiber GIS & Outside Plant (OSP) Geographic Map</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Geographic Outside Plant (OSP) management for Lagonoy, Camarines Sur — OLT Headend, 48C Feeder Trunks, Splice Domes, NAP Splitters & Drop Wires.
          </p>
        </div>

        {/* Telemetry KPI Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase block leading-none">Total Route</span>
              <span className="font-mono font-bold text-slate-200">{totalRouteKm} km</span>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
            <Server className="w-4 h-4 text-purple-400" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase block leading-none">NAP Hubs</span>
              <span className="font-mono font-bold text-slate-200">{napBoxes.length} Boxes</span>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
            <Scissors className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase block leading-none">Splice Closures</span>
              <span className="font-mono font-bold text-slate-200">{fiberClosures.length} FJC ({totalSplicesCount} Cores)</span>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase block leading-none">Active Drops</span>
              <span className="font-mono font-bold text-slate-200">{activeDropsCount} ONUs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map Control Toolbar */}
      <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-card">
        {/* Left: Tile View Modes & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Map style selector */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            {isGoogleAvailable ? (
              <>
                <button
                  type="button"
                  onClick={() => setMapStyle('google_hybrid')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                    mapStyle === 'google_hybrid' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Google Hybrid: High-resolution aerial satellite photography with street names and municipal landmarks"
                >
                  <span>🛰️ Google Hybrid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapStyle('google_streets')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                    mapStyle === 'google_streets' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Google Streets: Official Google Maps road and highway vector map"
                >
                  <span>🛣️ Google Streets</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setMapStyle('satellite')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  mapStyle === 'satellite' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🛰️ Real Satellite
              </button>
            )}
            <button
              type="button"
              onClick={() => setMapStyle('dark_grid')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                mapStyle === 'dark_grid' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="CartoDB Dark Matter: High-contrast cyber NOC map for optical telemetry"
            >
              🌃 NOC Dark Map
            </button>
            {isGoogleAvailable && (
              <button
                type="button"
                onClick={() => setMapStyle('satellite')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  mapStyle === 'satellite' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Esri World Imagery: Alternative aerial photography"
              >
                🛰️ Esri Aerial
              </button>
            )}
            <button
              type="button"
              onClick={() => setMapStyle('schematic')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                mapStyle === 'schematic' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Topology Grid: Circuit schematic diagrams"
            >
              📐 Topology Grid
            </button>
          </div>

          {/* Zoom Buttons */}
          <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-0.5">
            <button
              onClick={() => setZoom(Math.min(zoom * 1.25, 5))}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-400 font-bold">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(Math.max(zoom / 1.25, 0.5))}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetView}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors border-l border-slate-800"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center: Layer Filters */}
        <div className="flex items-center flex-wrap gap-1.5">
          <button
            onClick={() => setShowOlt(!showOlt)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
              showOlt ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            🏢 OLT POP
          </button>
          <button
            onClick={() => setShowFeeder(!showFeeder)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
              showFeeder ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            🧶 48C Feeder
          </button>
          <button
            onClick={() => setShowDistribution(!showDistribution)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
              showDistribution ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            🧵 24/12C Branch
          </button>
          <button
            onClick={() => setShowNaps(!showNaps)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
              showNaps ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            📦 NAP Hubs
          </button>
          <button
            onClick={() => setShowClosures(!showClosures)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
              showClosures ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            🔩 Splice Domes
          </button>
          <button
            onClick={() => setShowDropLines(!showDropLines)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
              showDropLines ? 'bg-sky-500/20 border-sky-500/50 text-sky-300' : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            🏠 Drop Wires
          </button>
          <button
            onClick={() => setShowCoverageRings(!showCoverageRings)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
              showCoverageRings ? 'bg-teal-500/20 border-teal-500/50 text-teal-300' : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            📡 500m Zones
          </button>

          {/* Span Distances Mode Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-cyan-900/60">
            <Ruler className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={showSpanDistances}
              onChange={(e) => setShowSpanDistances(e.target.value as any)}
              className="bg-transparent text-cyan-300 text-[11px] font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-slate-200">
                📏 All Spans (OLT & Inter-NAP)
              </option>
              <option value="olt" className="bg-slate-900 text-slate-200">
                🏢 OLT-to-NAP Feeder Spans
              </option>
              <option value="inter_nap" className="bg-slate-900 text-slate-200">
                📦 Inter-NAP Hop Spans
              </option>
              <option value="none" className="bg-slate-900 text-slate-400">
                🚫 Hide Span Distances
              </option>
            </select>
          </div>

          {/* Serving OLT Scope Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-purple-900/60">
            <Server className="w-3.5 h-3.5 text-purple-400" />
            <select
              value={selectedOltFilter}
              onChange={(e) => setSelectedOltFilter(e.target.value)}
              className="bg-transparent text-slate-200 text-[11px] font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-slate-200">
                🌐 All OLT POPs ({napBoxes.length} NAPs)
              </option>
              {effectiveOltNodes.map((olt) => {
                const count = napBoxes.filter(
                  (b) => b.oltId === olt.id || (!b.oltId && olt.id === effectiveOltNodes[0]?.id)
                ).length;
                return (
                  <option key={olt.id} value={olt.id} className="bg-slate-900 text-slate-200">
                    🏢 {olt.code || 'OLT'} - {olt.name} ({count} NAPs)
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Right: OSP Diagnostic Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setOltModalCoords(null);
              setEditingOltId(selectedOltFilter !== 'all' ? selectedOltFilter : null);
              setShowOltModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/50 rounded-xl font-semibold transition-all shadow-sm"
            title="Register & Configure OLT Headends"
          >
            <Server className="w-3.5 h-3.5 text-purple-300" />
            <span>Configure OLTs ({effectiveOltNodes.length})</span>
          </button>

          <button
            onClick={() => setShowOtdrModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold shadow-md shadow-rose-600/20 transition-all"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>OTDR Break Locator</span>
          </button>

          <button
            onClick={() => setShowLinkBudgetModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/50 rounded-xl font-semibold transition-all"
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Link Budget (dB)</span>
          </button>

          <button
            onClick={handleExportGeoJson}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition-all"
            title="Export GeoJSON for Google Earth / QGIS"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export GeoJSON</span>
          </button>
        </div>
      </div>

      {/* Interactive Map & Side Inspector Layout */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl h-[620px] flex">
        {mapStyle !== 'schematic' ? (
          <div className="flex-1 h-full relative">
            <RealLeafletMap
              oltNode={primaryOlt}
              oltNodes={effectiveOltNodes}
              napBoxes={filteredNapBoxes}
              fiberCables={fiberCables}
              fiberClosures={fiberClosures}
              customers={customers}
              selectedAsset={selectedAsset}
              onSelectAsset={setSelectedAsset}
              onSelectCustomer={onSelectCustomer}
              onDeployNapAtLocation={onDeployNapAtLocation}
              onRegisterOltAtLocation={(coords) => {
                setOltModalCoords(coords);
                setEditingOltId(null);
                setShowOltModal(true);
              }}
              onUpdateNapBox={updateNapBox}
              onUpdateFiberCable={updateFiberCable}
              onUpdateFiberClosure={updateFiberClosure}
              onUpdateOltNode={updateOltNode}
              externalRouteEditNapId={externalRouteEditNapId}
              onClearExternalRouteEdit={() => setExternalRouteEditNapId(null)}
              activeOtdrBreak={activeOtdrBreak}
              mapTileStyle={mapStyle}
              googleMapsApiKey={businessProfile?.apiKeys?.googleMapsApiKey}
              showOlt={showOlt}
              showFeeder={showFeeder}
              showDistribution={showDistribution}
              showNaps={showNaps}
              showClosures={showClosures}
              showDropLines={showDropLines}
              showCoverageRings={showCoverageRings}
              showSpanDistances={showSpanDistances}
            />
          </div>
        ) : (
          /* SVG GIS Canvas (Topology Schematic Mode) */
          <div
            className="flex-1 h-full cursor-grab active:cursor-grabbing overflow-hidden relative select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full h-full"
          >
            <g
              transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
              style={{ transformOrigin: 'center center' }}
            >
              {/* Background Theme & Grid */}
              <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="#030712" />

              {/* Grid Lines */}
              <defs>
                <pattern id="gis-grid" width="60" height="60" patternUnits="userSpaceOnUse">
                  <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
                </pattern>
                {/* Glow Filter for Active Fiber Cables */}
                <filter id="fiber-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="url(#gis-grid)" />

              {/* Geographical Landmarks & Barangay Roads of Lagonoy */}
              <g id="roads-landmarks" opacity="0.3">
                {/* National Highway (Maharlika / Provincial Rd) */}
                <path
                  d="M 50 450 Q 300 440 500 380 T 900 220 L 1150 150"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="14"
                  strokeLinecap="round"
                />
                <path
                  d="M 50 450 Q 300 440 500 380 T 900 220 L 1150 150"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="8 8"
                />

                {/* Secondary Municipal Branch Roads */}
                <path d="M 500 380 L 520 680" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                <path d="M 720 280 L 1050 480" fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                <path d="M 300 440 L 250 200" fill="none" stroke="#1e293b" strokeWidth="6" />

                {/* Lagonoy River */}
                <path
                  d="M 100 750 Q 400 700 700 720 T 1150 680"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="22"
                  strokeOpacity="0.15"
                />

                {/* Barangay Labels */}
                <text x="220" y="420" fill="#64748b" fontSize="14" fontWeight="bold" letterSpacing="1">
                  BRGY. BINAUAHAN
                </text>
                <text x="540" y="350" fill="#64748b" fontSize="14" fontWeight="bold" letterSpacing="1">
                  BRGY. SAN JOSE
                </text>
                <text x="820" y="200" fill="#64748b" fontSize="14" fontWeight="bold" letterSpacing="1">
                  BRGY. POBLACION (DOWNTOWN)
                </text>
                <text x="960" y="110" fill="#64748b" fontSize="14" fontWeight="bold" letterSpacing="1">
                  BRGY. SAN ISIDRO
                </text>
                <text x="820" y="580" fill="#64748b" fontSize="14" fontWeight="bold" letterSpacing="1">
                  BRGY. SANTA MARIA
                </text>
              </g>

              {/* Coverage Radii (500m Zones around NAP Boxes) */}
              {showCoverageRings &&
                napBoxes.map((nap) => {
                  const pt = projectGeoToSvg(nap.latitude, nap.longitude);
                  return (
                    <g key={`cov-${nap.id}`}>
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="95"
                        fill="#06b6d4"
                        fillOpacity="0.04"
                        stroke="#06b6d4"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                        strokeOpacity="0.3"
                      />
                    </g>
                  );
                })}

              {/* Subscriber Drop Cables */}
              {showDropLines &&
                customers.map((cust) => {
                  if (!cust.address.coordinates || !cust.network.napBoxId) return null;
                  const nap = napBoxes.find((b) => b.id === cust.network.napBoxId);
                  if (!nap) return null;

                  const custPt = projectGeoToSvg(cust.address.coordinates.lat, cust.address.coordinates.lng);
                  const napPt = projectGeoToSvg(nap.latitude, nap.longitude);

                  const napPort = nap.ports.find((p) => p.customerId === cust.id);
                  const signal = napPort?.signalDbm ?? -18.5;
                  const strokeColor = signal < -26 ? '#f43f5e' : signal < -22 ? '#f59e0b' : '#10b981';

                  return (
                    <g
                      key={`drop-${cust.id}`}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAsset({ type: 'customer', data: { ...cust, signalDbm: signal, napCode: nap.code } });
                      }}
                    >
                      <line
                        x1={napPt.x}
                        y1={napPt.y}
                        x2={custPt.x}
                        y2={custPt.y}
                        stroke={strokeColor}
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        strokeOpacity="0.75"
                        className="group-hover:stroke-white transition-all"
                      />
                      {/* Customer Home Endpoint */}
                      <circle
                        cx={custPt.x}
                        cy={custPt.y}
                        r="4"
                        fill={strokeColor}
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        className="group-hover:scale-125 transition-transform"
                      />
                    </g>
                  );
                })}

              {/* Cascaded Daisy-Chain Spans & Distance Pills (SVG Schematic Mode) */}
              {showSpanDistances !== 'none' &&
                effectiveOltNodes.map((olt) => {
                  const linkedNaps = napBoxes.filter(
                    (b) => b.oltId === olt.id || (!b.oltId && olt.id === effectiveOltNodes[0]?.id)
                  );
                  const ponGroups = new Map<number, NapBox[]>();
                  linkedNaps.forEach((nap) => {
                    const port = nap.ponPortNumber || 1;
                    if (!ponGroups.has(port)) ponGroups.set(port, []);
                    ponGroups.get(port)!.push(nap);
                  });

                  const ponColors = ['#06b6d4', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#3b82f6'];

                  return Array.from(ponGroups.entries()).map(([ponPort, napsOnPon]) => {
                    const chain = buildPonCascadeChain(napsOnPon, olt);
                    const telemetryList = calculateCascadeTelemetry(chain, olt);
                    const baseColor = ponColors[(ponPort - 1) % ponColors.length];

                    return telemetryList.map((hop) => {
                      const { nap, hopSpan, isFeeder } = hop;
                      const shouldRender =
                        showSpanDistances === 'all' ||
                        (isFeeder && showSpanDistances === 'olt') ||
                        (!isFeeder && showSpanDistances === 'inter_nap');

                      if (!shouldRender) return null;

                      const fromPt = projectGeoToSvg(hop.upstreamCoords.lat, hop.upstreamCoords.lng);
                      const toPt = projectGeoToSvg(nap.latitude, nap.longitude);
                      const midX = (fromPt.x + toPt.x) / 2;
                      const midY = (fromPt.y + toPt.y) / 2;

                      const isNapSelected = selectedAsset?.type === 'nap' && selectedAsset.data.id === nap.id;
                      const isUpstreamSelected =
                        selectedAsset?.type === 'nap' && selectedAsset.data.id === hop.upstreamId;
                      const isOltSelected = selectedAsset?.type === 'olt' && selectedAsset.data.id === olt.id;
                      const isHighlighted = isNapSelected || isUpstreamSelected || isOltSelected;

                      const strokeColor = isHighlighted ? '#fbbf24' : baseColor;

                      return (
                        <g
                          key={`svg-cascade-${olt.id}-p${ponPort}-${nap.id}`}
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAsset({ type: 'nap', data: nap });
                          }}
                        >
                          <line
                            x1={fromPt.x}
                            y1={fromPt.y}
                            x2={toPt.x}
                            y2={toPt.y}
                            stroke={strokeColor}
                            strokeWidth={isHighlighted ? '3' : isFeeder ? '2' : '1.5'}
                            strokeDasharray={isHighlighted ? undefined : isFeeder ? undefined : '5 4'}
                            strokeOpacity={isHighlighted ? 1 : 0.75}
                          />
                          {/* Midpoint Pill */}
                          <g transform={`translate(${midX}, ${midY})`}>
                            <rect
                              x="-28"
                              y="-9"
                              width="56"
                              height="18"
                              rx="9"
                              fill="#090d16"
                              stroke={strokeColor}
                              strokeWidth="1.2"
                            />
                            <text
                              textAnchor="middle"
                              dy="3.5"
                              fill={isHighlighted ? '#fbbf24' : '#f8fafc'}
                              fontSize="8.5"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {isFeeder ? '📏' : '⚡'}{hopSpan.directMeters >= 1000 ? `${hopSpan.directKm}k` : `${hopSpan.directMeters}m`}
                            </text>
                          </g>
                        </g>
                      );
                    });
                  });
                })}

              {/* Fiber Cables Polyline Paths */}
              {fiberCables.map((cable) => {
                if (!showFeeder && cable.type === 'feeder') return null;
                if (!showDistribution && cable.type === 'distribution') return null;

                const points = cable.pathCoordinates.map((pt) => projectGeoToSvg(pt.lat, pt.lng));
                const d = points.reduce((acc, p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');

                const isSelected = selectedAsset?.type === 'cable' && selectedAsset.data.id === cable.id;

                return (
                  <g
                    key={`cbl-${cable.id}`}
                    className="cursor-pointer group"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAsset({ type: 'cable', data: cable });
                    }}
                  >
                    {/* Glowing Cable Halo */}
                    <path
                      d={d}
                      fill="none"
                      stroke={cable.color}
                      strokeWidth={cable.type === 'feeder' ? '8' : '6'}
                      strokeOpacity={isSelected ? 0.6 : 0.25}
                      strokeLinecap="round"
                      filter="url(#fiber-glow)"
                    />
                    {/* Core Line */}
                    <path
                      d={d}
                      fill="none"
                      stroke={cable.color}
                      strokeWidth={cable.type === 'feeder' ? '3.5' : '2.5'}
                      strokeLinecap="round"
                      className="group-hover:brightness-125 transition-all"
                    />
                    {/* Animated Optical Signal Light Pulses */}
                    <path
                      d={d}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeDasharray="6 30"
                      strokeLinecap="round"
                      strokeOpacity="0.8"
                    />
                  </g>
                );
              })}

              {/* Splice Closures (FJC Dome Markers) */}
              {showClosures &&
                fiberClosures.map((closure) => {
                  const pt = projectGeoToSvg(closure.latitude, closure.longitude);
                  const isSelected = selectedAsset?.type === 'closure' && selectedAsset.data.id === closure.id;

                  return (
                    <g
                      key={`fjc-${closure.id}`}
                      transform={`translate(${pt.x}, ${pt.y})`}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAsset({ type: 'closure', data: closure });
                      }}
                    >
                      <circle
                        r={isSelected ? '14' : '10'}
                        fill="#f59e0b"
                        fillOpacity="0.25"
                        stroke="#f59e0b"
                        strokeWidth="2"
                        className="animate-pulse"
                      />
                      <rect x="-6" y="-6" width="12" height="12" rx="3" fill="#f59e0b" stroke="#0f172a" strokeWidth="1.5" />
                      <text x="0" y="3" textAnchor="middle" fill="#0f172a" fontSize="7" fontWeight="bold">
                        FJC
                      </text>
                      <text x="0" y="20" textAnchor="middle" fill="#cbd5e1" fontSize="9" fontWeight="bold">
                        {closure.code}
                      </text>
                    </g>
                  );
                })}

              {/* NAP Boxes (Distribution Splitters) */}
              {showNaps &&
                napBoxes.map((nap) => {
                  const pt = projectGeoToSvg(nap.latitude, nap.longitude);
                  const isSelected = selectedAsset?.type === 'nap' && selectedAsset.data.id === nap.id;

                  const occupiedPorts = nap.ports.filter((p) => p.status === 'occupied').length;
                  const damagedPorts = nap.ports.filter((p) => p.status === 'damaged').length;
                  const isFull = occupiedPorts >= nap.totalPorts;

                  return (
                    <g
                      key={`nap-${nap.id}`}
                      transform={`translate(${pt.x}, ${pt.y})`}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAsset({ type: 'nap', data: nap });
                      }}
                    >
                      {/* Pulse Halo */}
                      <circle
                        r={isSelected ? '16' : '12'}
                        fill={damagedPorts > 0 ? '#f43f5e' : isFull ? '#8b5cf6' : '#06b6d4'}
                        fillOpacity="0.2"
                        stroke={damagedPorts > 0 ? '#f43f5e' : isFull ? '#8b5cf6' : '#06b6d4'}
                        strokeWidth="2"
                      />
                      {/* Box Icon */}
                      <rect
                        x="-8"
                        y="-8"
                        width="16"
                        height="16"
                        rx="4"
                        fill={damagedPorts > 0 ? '#e11d48' : '#0284c7'}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      {/* Capacity Badge */}
                      <text x="0" y="3.5" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="bold" fontFamily="monospace">
                        {occupiedPorts}
                      </text>
                      {/* Code Label */}
                      <text x="0" y="20" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="bold">
                        {nap.code.replace('-BINAUAHAN', '').replace('-COCKPIT', '').replace('-POBLACION', '')}
                      </text>
                    </g>
                  );
                })}

              {/* Central Office / OLT Headend Nodes */}
              {showOlt &&
                effectiveOltNodes.map((node) => {
                  const svgPt = projectGeoToSvg(node.latitude, node.longitude);
                  const isSel = selectedAsset?.type === 'olt' && selectedAsset?.data?.id === node.id;
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${svgPt.x}, ${svgPt.y})`}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAsset({ type: 'olt', data: node });
                      }}
                    >
                      <circle
                        r="22"
                        fill={isSel ? '#ec4899' : '#06b6d4'}
                        fillOpacity="0.2"
                        stroke={isSel ? '#ec4899' : '#06b6d4'}
                        strokeWidth="2"
                        className="animate-ping"
                      />
                      <circle
                        r="16"
                        fill={isSel ? '#db2777' : '#0284c7'}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                      <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                        {node.code || 'OLT'}
                      </text>
                      <text x="0" y="28" textAnchor="middle" fill="#38bdf8" fontSize="10" fontWeight="bold">
                        {node.name.split(' ')[0]}
                      </text>
                    </g>
                  );
                })}

              {/* Active OTDR Fiber Break Alert Beacon */}
              {activeOtdrBreak && (
                <g transform={`translate(${activeOtdrBreak.point.x}, ${activeOtdrBreak.point.y})`}>
                  <circle r="30" fill="#f43f5e" fillOpacity="0.4" stroke="#f43f5e" strokeWidth="3" className="animate-ping" />
                  <circle r="14" fill="#e11d48" stroke="#ffffff" strokeWidth="2" />
                  <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">
                    ⚠️
                  </text>
                  <g transform="translate(0, -32)">
                    <rect x="-70" y="-12" width="140" height="24" rx="6" fill="#1e1b4b" stroke="#f43f5e" strokeWidth="1.5" />
                    <text x="0" y="4" textAnchor="middle" fill="#fca5a5" fontSize="10" fontWeight="bold" fontFamily="monospace">
                      BREAK @ {activeOtdrBreak.distance}m (OTDR)
                    </text>
                  </g>
                </g>
              )}
            </g>
          </svg>

          {/* Map Compass & Scale overlay */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-800/80 backdrop-blur-md px-3 py-2 rounded-xl text-[10px] text-slate-400 flex items-center gap-3">
            <div className="flex items-center gap-1 font-mono font-bold text-cyan-400">
              <Compass className="w-3.5 h-3.5" />
              <span>N 13°41'03" E 123°31'20"</span>
            </div>
            <div className="border-l border-slate-700 pl-3 flex items-center gap-1.5">
              <div className="w-8 h-1 bg-cyan-400 rounded-full" />
              <span>500 Meters (Topology Grid)</span>
            </div>
          </div>
        </div>
      )}

        {/* Slide-out Side Asset Inspector Drawer */}
        {selectedAsset && (
          <div className="w-96 h-full bg-slate-900 border-l border-slate-800 p-5 overflow-y-auto flex flex-col justify-between text-xs space-y-4 shadow-2xl z-20">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  {selectedAsset.type === 'nap' && <Radio className="w-4 h-4 text-cyan-400" />}
                  {selectedAsset.type === 'cable' && <Activity className="w-4 h-4 text-blue-400" />}
                  {selectedAsset.type === 'closure' && <Scissors className="w-4 h-4 text-amber-400" />}
                  {selectedAsset.type === 'olt' && <Server className="w-4 h-4 text-purple-400" />}
                  {selectedAsset.type === 'customer' && <MapPin className="w-4 h-4 text-emerald-400" />}
                  <span className="font-bold text-slate-100 uppercase tracking-wider text-[11px]">
                    {selectedAsset.type === 'nap'
                      ? 'NAP Splitter Hub'
                      : selectedAsset.type === 'cable'
                      ? 'Fiber Cable Route'
                      : selectedAsset.type === 'closure'
                      ? 'Splice Closure (FJC)'
                      : selectedAsset.type === 'olt'
                      ? 'Central OLT Headend'
                      : 'Subscriber ONU Drop'}
                  </span>
                </div>

                <button
                  onClick={() => setSelectedAsset(null)}
                  className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Inspector Content: NAP Box */}
              {selectedAsset.type === 'nap' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{selectedAsset.data.name}</h3>
                    <p className="text-[11px] text-cyan-400 font-mono">{selectedAsset.data.code}</p>
                    <div className="flex items-center justify-between mt-1 text-[11px] font-mono text-slate-400">
                      <span>{selectedAsset.data.location}, Brgy. {selectedAsset.data.barangay}</span>
                      <span className="text-cyan-300 font-semibold">
                        {selectedAsset.data.latitude?.toFixed(5)}°, {selectedAsset.data.longitude?.toFixed(5)}°
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-[10px] text-emerald-300">
                      <Move className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span><strong>Draggable on Map:</strong> Drag marker directly onto roadside pole to update GPS.</span>
                    </div>

                    {/* Cascade Hierarchy, Upstream Feed & Optical Waterfall Telemetry */}
                    {(() => {
                      const parentOlt =
                        effectiveOltNodes.find(
                          (o) => o.id === selectedAsset.data.oltId || (!selectedAsset.data.oltId && o.id === effectiveOltNodes[0]?.id)
                        ) || effectiveOltNodes[0] || primaryOlt;

                      const ponPort = selectedAsset.data.ponPortNumber || 1;
                      const napsOnPon = parentOlt
                        ? napBoxes.filter(
                            (b) =>
                              (b.oltId === parentOlt.id || (!b.oltId && parentOlt.id === effectiveOltNodes[0]?.id)) &&
                              (b.ponPortNumber || 1) === ponPort
                          )
                        : [];

                      const chain = parentOlt ? buildPonCascadeChain(napsOnPon, parentOlt) : [];
                      const telemetryList = parentOlt ? calculateCascadeTelemetry(chain, parentOlt) : [];
                      const currentHop = telemetryList.find((h) => h.nap.id === selectedAsset.data.id);

                      // Upstream and downstream nodes in cascade
                      const currentIdx = chain.findIndex((b) => b.id === selectedAsset.data.id);
                      const upstreamNap = currentIdx > 0 ? chain[currentIdx - 1] : null;
                      const downstreamNap = currentIdx >= 0 && currentIdx < chain.length - 1 ? chain[currentIdx + 1] : null;
                      const pairedBranchNap = selectedAsset.data.pairedBranchNapId
                        ? napBoxes.find((b) => b.id === selectedAsset.data.pairedBranchNapId)
                        : null;

                      return (
                        <div className="space-y-3">
                          {/* Cascade Hierarchy & Upstream Node Card */}
                          <div className="mt-2.5 p-3 rounded-2xl bg-purple-950/40 border border-purple-800/60 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-purple-900/60 text-purple-300 font-bold font-mono text-[10px] border border-purple-700/50">
                                  {currentHop ? (currentHop.isFeeder ? 'Hop #1 (Feeder)' : `Hop #${currentHop.hopIndex} of ${currentHop.totalHops}`) : 'Standalone'}
                                </span>
                                <div>
                                  <span className="text-[10px] text-purple-300 font-semibold block">Serving PON Trunk</span>
                                  <span className="text-slate-200 font-bold text-xs font-mono">
                                    {parentOlt?.code || 'OLT-01'} • PON Port #{ponPort}
                                  </span>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-full bg-slate-900 text-cyan-300 border border-slate-700 text-[10px] font-mono font-bold">
                                {currentHop?.fbtRatio === 'terminal' ? '100% Terminal' : `${currentHop?.fbtRatio || '85/15'} FBT`}
                              </span>
                            </div>

                            {/* Feed Source Details */}
                            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5 text-[11px] font-mono">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Direct Feed Parent:</span>
                                <span className="text-purple-300 font-bold flex items-center gap-1">
                                  {currentHop?.isFeeder ? (
                                    <>
                                      <Server className="w-3 h-3 text-purple-400" />
                                      <span>{parentOlt?.code || 'OLT'} (POP Central)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Radio className="w-3 h-3 text-cyan-400" />
                                      <span>{currentHop?.upstreamName || 'Upstream NAP'}</span>
                                    </>
                                  )}
                                </span>
                              </div>

                              {napsOnPon.length > 1 && (
                                <div className="pt-1.5 pb-1 border-t border-slate-900 flex items-center justify-between gap-1 text-[10px]">
                                  <span className="text-slate-400 font-medium">Re-link Parent:</span>
                                  <select
                                    value={selectedAsset.data.feedSourceType === 'olt' || !selectedAsset.data.upstreamNapId ? '__olt__' : selectedAsset.data.upstreamNapId}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '__olt__') {
                                        updateNapBox(selectedAsset.data.id, { feedSourceType: 'olt', upstreamNapId: undefined });
                                      } else {
                                        updateNapBox(selectedAsset.data.id, { feedSourceType: 'nap', upstreamNapId: val });
                                      }
                                    }}
                                    className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-[10px] focus:outline-none focus:border-cyan-400 font-semibold"
                                  >
                                    <option value="__olt__">🏢 Central OLT (Feeder Root)</option>
                                    {napsOnPon
                                      .filter((b) => b.id !== selectedAsset.data.id)
                                      .map((b) => (
                                        <option key={`relink-map-${b.id}`} value={b.id}>
                                          ⚡ Cascaded from {b.code} ({b.name})
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              )}

                              {currentHop && (
                                <>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Hop Span Distance:</span>
                                    <span className="text-cyan-300 font-bold">
                                      {currentHop.hopSpan.formattedDirect}
                                      <span className="text-slate-500 text-[10px] font-normal ml-1">
                                        (Cable: {currentHop.hopSpan.formattedRoute})
                                      </span>
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                                    <span className="text-slate-400">Total Run from OLT:</span>
                                    <span className="text-purple-300 font-bold">
                                      {currentHop.cumulativeDirectMeters.toLocaleString()}m
                                      <span className="text-slate-500 text-[10px] font-normal ml-1">
                                        (Cable: {currentHop.cumulativeCableMeters.toLocaleString()}m)
                                      </span>
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Utility Pole Alignment Action Card */}
                            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <Waypoints className="w-3.5 h-3.5 text-amber-400" />
                                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                                    Roadside Utility Poles
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold">
                                  {selectedAsset.data.customPathCoordinates && selectedAsset.data.customPathCoordinates.length > 0
                                    ? `🪵 ${selectedAsset.data.customPathCoordinates.length} Pole(s) Aligned`
                                    : 'Direct Straight Span'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => setExternalRouteEditNapId(selectedAsset.data.id)}
                                  className="flex-1 py-1.5 px-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                                  title="Move cable line to physical utility poles on satellite map to get exact real-world distance"
                                >
                                  <Waypoints className="w-3.5 h-3.5 text-slate-950" />
                                  <span>Align Cable Line to Poles</span>
                                </button>
                                {selectedAsset.data.customPathCoordinates && selectedAsset.data.customPathCoordinates.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => updateNapBox(selectedAsset.data.id, { customPathCoordinates: [] })}
                                    className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-700 rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
                                    title="Reset this cable span back to straight line"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Cascade Traversal Buttons */}
                            <div className="flex items-center gap-2 pt-1">
                              {upstreamNap ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedAsset({ type: 'nap', data: upstreamNap })}
                                  className="flex-1 py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                                >
                                  <span>← Upstream</span>
                                  <span className="text-cyan-400 font-mono">({upstreamNap.code})</span>
                                </button>
                              ) : parentOlt ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedAsset({ type: 'olt', data: parentOlt })}
                                  className="flex-1 py-1 px-2 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/60 text-purple-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                                >
                                  <Server className="w-3 h-3 text-purple-400" />
                                  <span>Inspect Serving OLT</span>
                                </button>
                              ) : null}

                              {downstreamNap && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedAsset({ type: 'nap', data: downstreamNap })}
                                  className="flex-1 py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                                >
                                  <span>Downstream →</span>
                                  <span className="text-emerald-400 font-mono">({downstreamNap.code})</span>
                                </button>
                              )}

                              {pairedBranchNap && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedAsset({ type: 'nap', data: pairedBranchNap })}
                                  className="flex-1 py-1 px-2 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800/60 text-amber-200 text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                                >
                                  <ArrowLeftRight className="w-3 h-3 text-amber-400" />
                                  <span>Twin {selectedAsset.data.branchDirection === 'left' ? 'Right ▶' : '◀ Left'}</span>
                                  <span className="text-amber-400 font-mono">({pairedBranchNap.code})</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Optical Power & Splitter Waterfall Card */}
                          {currentHop && (
                            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1">
                                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Optical Power & Splitter Waterfall</span>
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    currentHop.healthStatus === 'optimal'
                                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50'
                                      : currentHop.healthStatus === 'acceptable'
                                      ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/50'
                                      : 'bg-amber-950/80 text-amber-400 border-amber-800/50'
                                  }`}
                                >
                                  {currentHop.healthLabel}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                                  <span className="text-slate-500 block text-[10px]">Arriving Input</span>
                                  <span className="font-bold text-cyan-300 text-sm">{currentHop.arrivingInputPowerDbm} dBm</span>
                                  <span className="text-[9px] text-slate-500 block mt-0.5">Fiber Loss: -{currentHop.hopFiberLossDb} dB</span>
                                </div>

                                <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                                  <span className="text-slate-500 block text-[10px]">Subscriber Drop Rx</span>
                                  <span
                                    className={`font-bold text-sm ${
                                      currentHop.healthStatus === 'optimal'
                                        ? 'text-emerald-400'
                                        : currentHop.healthStatus === 'acceptable'
                                        ? 'text-cyan-300'
                                        : 'text-amber-400'
                                    }`}
                                  >
                                    {currentHop.dropPortRxPowerDbm} dBm
                                  </span>
                                  <span className="text-[9px] text-slate-500 block mt-0.5">PLC Loss: -{currentHop.plcLossDb} dB</span>
                                </div>
                              </div>

                              {/* Splitter Specs Grid */}
                              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/70 grid grid-cols-2 gap-2 text-[10px]">
                                <div>
                                  <span className="text-slate-400 block font-medium">FBT Coupler Leg</span>
                                  <span className="text-amber-300 font-mono font-bold">
                                    {currentHop.isTerminal ? 'None (100% Direct)' : `${currentHop.fbtRatio} (Tap -${currentHop.fbtTapLossDb} dB)`}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block font-medium">Trunk Through Out</span>
                                  <span className="text-slate-200 font-mono font-bold">
                                    {currentHop.throughOutputPowerDbm !== null
                                      ? `${currentHop.throughOutputPowerDbm} dBm (-${currentHop.fbtThroughLossDb}dB)`
                                      : 'Terminal (End of Run)'}
                                  </span>
                                </div>

                                {currentHop.tapSubSplitEnabled && (
                                  <div className="col-span-2 pt-1.5 mt-1 border-t border-slate-800 flex items-center justify-between text-[10px]">
                                    <span className="text-purple-300 font-semibold flex items-center gap-1">
                                      <Split className="w-3 h-3 text-purple-400" />
                                      50/50 Sub-Split:
                                      <strong className="text-purple-200 ml-1">
                                        {selectedAsset.data.branchDirection ? selectedAsset.data.branchDirection.toUpperCase() : 'BRANCH'}
                                      </strong>
                                    </span>
                                    <span className="text-slate-300 font-mono">
                                      Branch In: <strong className="text-purple-300">{currentHop.branchInputPowerDbm} dBm</strong>
                                      <span className="text-emerald-400 font-bold ml-2">({currentHop.totalBranchCapacityPorts} Ports)</span>
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Ports Grid */}
                  <div>
                    <span className="font-bold text-slate-300 block mb-2">
                      Port Allocation ({selectedAsset.data.ports.filter((p: NapPort) => p.status === 'occupied').length} / {selectedAsset.data.totalPorts})
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {selectedAsset.data.ports.map((port: NapPort) => (
                        <div
                          key={port.portNumber}
                          className={`p-2 rounded-xl border text-center font-mono text-[10px] ${
                            port.status === 'occupied'
                              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                              : port.status === 'damaged'
                              ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                              : 'bg-slate-950 border-slate-800 text-slate-500'
                          }`}
                        >
                          <span className="block font-bold">P{port.portNumber}</span>
                          <span className="text-[8px] uppercase">{port.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Connected Customers List */}
                  <div>
                    <span className="font-bold text-slate-300 block mb-2">Connected Subscribers</span>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {selectedAsset.data.ports
                        .filter((p: NapPort) => p.customerId)
                        .map((port: NapPort) => (
                          <div
                            key={port.portNumber}
                            onClick={() => onSelectCustomer && port.customerId && onSelectCustomer(port.customerId)}
                            className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-cyan-500/50 cursor-pointer flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-slate-200 block text-[11px]">{port.customerName}</span>
                              <span className="text-[10px] text-slate-500 font-mono">Port #{port.portNumber} • {port.accountNo}</span>
                            </div>
                            <span className="text-emerald-400 font-mono font-bold">{port.signalDbm || -18.5} dBm</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Inter-NAP Hop Spans (Box to Box) */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Waypoints className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Inter-NAP Hop Span</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Box to Box</span>
                    </div>

                    <select
                      value={drawerInterNapTargetId}
                      onChange={(e) => setDrawerInterNapTargetId(e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-[11px] font-mono focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">-- Measure span to another NAP box --</option>
                      {napBoxes
                        .filter((b) => b.id !== selectedAsset.data.id)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.code} - {b.name} (Brgy. {b.barangay})
                          </option>
                        ))}
                    </select>

                    {drawerInterNapTargetId && (() => {
                      const targetNap = napBoxes.find((b) => b.id === drawerInterNapTargetId);
                      if (!targetNap) return null;
                      const span = getNapToNapDistance(selectedAsset.data, targetNap);
                      return (
                        <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/50 space-y-1.5 font-mono text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-cyan-300 font-bold">Direct Distance:</span>
                            <span className="text-white font-bold">{span.formattedDirect}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">Est. Cable (+20%):</span>
                            <span className="text-cyan-400 font-semibold">{span.formattedRoute}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-cyan-900/50">
                            <span className="text-slate-500">Optical Loss (@ 1310nm):</span>
                            <span className="text-emerald-400 font-bold">~{span.opticalLossDb} dB</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Action Buttons: Delete NAP Box */}
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        const box = selectedAsset.data as NapBox;
                        const connectedSubs = customers.filter(
                          (c) => c.network?.napBoxId === box.id || box.ports?.some((p: NapPort) => p.customerId === c.id)
                        );
                        const confirmMsg = connectedSubs.length > 0
                          ? `WARNING: NAP Box "${box.code} - ${box.name}" has ${connectedSubs.length} subscriber(s) connected.\n\nDeleting this box will disconnect these subscribers in the network database. Proceed?`
                          : `Are you sure you want to permanently delete NAP Box "${box.code} - ${box.name}"?`;

                        if (window.confirm(confirmMsg)) {
                          deleteNapBox(box.id);
                          setSelectedAsset(null);
                        }
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span>Delete NAP Box ({selectedAsset.data.code})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Inspector Content: Fiber Cable */}
              {selectedAsset.type === 'cable' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{selectedAsset.data.name}</h3>
                    <p className="text-[11px] text-cyan-400 font-mono">{selectedAsset.data.code}</p>
                    <p className="text-slate-400 mt-1">{selectedAsset.data.fromNode} ➔ {selectedAsset.data.toNode}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Core Count</span>
                      <span className="font-bold text-cyan-300">{selectedAsset.data.coreCount} Cores (Single Mode)</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Route Distance</span>
                      <span className="font-bold text-slate-200 font-mono">{selectedAsset.data.lengthMeters} Meters</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Cable Specifications</span>
                    <p className="text-slate-300 font-mono text-[11px]">{selectedAsset.data.fiberStandard}</p>
                    <p className="text-slate-400 text-[10px]">Attenuation: {selectedAsset.data.attenuationDbPerKm} dB/km @ 1310nm</p>
                    <p className="text-slate-400 text-[10px]">Total Fiber Loss: {((selectedAsset.data.lengthMeters / 1000) * selectedAsset.data.attenuationDbPerKm).toFixed(3)} dB</p>
                  </div>

                  {/* Utility Pole Alignment for Cable */}
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                        Roadside Utility Poles
                      </span>
                      <span className="text-[11px] text-slate-300 font-mono">
                        {selectedAsset.data.pathCoordinates?.length > 2
                          ? `🪵 ${selectedAsset.data.pathCoordinates.length - 2} Pole(s) Routed`
                          : 'Straight Segment'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExternalRouteEditNapId(selectedAsset.data.id)}
                      className="py-1.5 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-[11px] rounded-lg flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                    >
                      <Waypoints className="w-3.5 h-3.5 text-slate-950" />
                      <span>Align Cable to Poles</span>
                    </button>
                  </div>

                  {/* 12-Core TIA Color Code Strip */}
                  <div>
                    <span className="font-bold text-slate-300 block mb-2">TIA-598-A Core Tube Breakdown</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {FIBER_COLOR_CODES.slice(0, Math.min(selectedAsset.data.coreCount, 12)).map((c) => (
                        <div
                          key={c.num}
                          style={{ backgroundColor: c.hex, color: c.text }}
                          className="p-1.5 rounded-lg text-center font-mono font-bold text-[9px] shadow-sm"
                        >
                          C{c.num} • {c.name.split(' ')[0]}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Inspector Content: Splice Closure */}
              {selectedAsset.type === 'closure' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{selectedAsset.data.name}</h3>
                    <p className="text-[11px] text-amber-400 font-mono">{selectedAsset.data.code}</p>
                    <div className="flex items-center justify-between mt-1 text-[11px] font-mono text-slate-400">
                      <span>Utility Pole #{selectedAsset.data.poleNumber}</span>
                      <span className="text-amber-300 font-semibold">
                        {selectedAsset.data.latitude?.toFixed(5)}°, {selectedAsset.data.longitude?.toFixed(5)}°
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-950/40 border border-amber-800/40 text-[10px] text-amber-300">
                      <Move className="w-3 h-3 text-amber-400 shrink-0" />
                      <span><strong>Draggable on Map:</strong> Drag dome marker to reposition onto roadside pole.</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Enclosure Type</span>
                      <span className="font-bold text-slate-200 capitalize">{selectedAsset.data.type} Dome</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Splice Trays</span>
                      <span className="font-bold text-amber-400 font-mono">{selectedAsset.data.trayCount} Trays ({selectedAsset.data.totalSplices} Splices)</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Connected Trunks</span>
                    <p className="text-slate-300 font-mono text-[11px]">{selectedAsset.data.cablesConnected?.join(', ')}</p>
                    <p className="text-slate-400 text-[10px] mt-2">{selectedAsset.data.notes}</p>
                  </div>
                </div>
              )}

              {/* Inspector Content: Subscriber */}
              {selectedAsset.type === 'customer' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{selectedAsset.data.fullName}</h3>
                    <p className="text-[11px] text-cyan-400 font-mono">{selectedAsset.data.accountNo}</p>
                    <p className="text-slate-400 mt-1">{selectedAsset.data.address?.street}, Brgy. {selectedAsset.data.address?.barangay}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Measured Rx Signal</span>
                      <span className={`font-bold font-mono ${
                        selectedAsset.data.signalDbm < -26 ? 'text-rose-400' : selectedAsset.data.signalDbm < -22 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {selectedAsset.data.signalDbm} dBm
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Service Plan</span>
                      <span className="font-bold text-slate-200">{selectedAsset.data.planName}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Network Routing</span>
                    <p className="text-slate-300 text-[11px]">Connected to: <strong className="text-cyan-400">{selectedAsset.data.napCode}</strong></p>
                    <p className="text-slate-400 text-[10px]">PPPoE: <code className="font-mono">{selectedAsset.data.network?.pppoeUsername}</code></p>
                  </div>

                  {onSelectCustomer && (
                    <button
                      onClick={() => onSelectCustomer(selectedAsset.data.id)}
                      className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold transition-all shadow-md"
                    >
                      Open Subscriber Profile
                    </button>
                  )}
                </div>
              )}

              {/* Inspector Content: Central OLT Headend */}
              {selectedAsset.type === 'olt' && (() => {
                const oltData = selectedAsset.data;
                const linkedNaps = napBoxes.filter(
                  (b) => b.oltId === oltData.id || (!b.oltId && oltData.id === effectiveOltNodes[0]?.id)
                );
                const linkedSubsCount = linkedNaps.reduce(
                  (acc, b) => acc + (b.ports?.filter((p) => p.status === 'occupied').length || 0),
                  0
                );
                const totalPortsCount = linkedNaps.reduce((acc, b) => acc + (b.totalPorts || 16), 0);

                return (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold uppercase tracking-wider font-mono">
                          {oltData.code || 'POP Headend'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                          Online Active
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-100 mt-2">{oltData.name}</h3>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        {oltData.location}, Brgy. {oltData.barangay}
                      </p>
                      <div className="mt-1 flex items-center gap-1 font-mono text-[10px] text-cyan-400">
                        <MapPin className="w-3 h-3" />
                        <span>
                          {oltData.latitude?.toFixed(5)}° N, {oltData.longitude?.toFixed(5)}° E
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-950/40 border border-purple-800/40 text-[10px] text-purple-300">
                        <Move className="w-3 h-3 text-purple-400 shrink-0" />
                        <span><strong>Draggable on Map:</strong> Drag OLT node to relocate central headend.</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Total PON Ports</span>
                        <span className="font-bold text-slate-200 font-mono">
                          {oltData.totalPonPorts || 16} SFP Ports
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Optical Tx Power</span>
                        <span className="font-bold text-emerald-400 font-mono">
                          +{oltData.txPowerDbm || 4.5} dBm
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Management IP</span>
                        <span className="font-bold text-cyan-300 font-mono">
                          {oltData.ipAddress || '192.168.88.1'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-slate-500 block text-[10px]">Downstream NAPs</span>
                        <span className="font-bold text-purple-300 font-mono">
                          {linkedNaps.length} Boxes ({linkedSubsCount}/{totalPortsCount} subs)
                        </span>
                      </div>
                    </div>

                    {/* Linked NAP Boxes List */}
                    <div>
                      <span className="font-bold text-slate-300 block mb-2">
                        Connected NAP Distribution Hubs ({linkedNaps.length})
                      </span>
                      {linkedNaps.length === 0 ? (
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-slate-500 text-[11px]">
                          No NAP boxes currently assigned to this OLT.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {linkedNaps.map((box) => {
                            const occupied = box.ports.filter((p) => p.status === 'occupied').length;
                            const oltSpan = getOltToNapDistance(oltData, box);
                            return (
                              <div
                                key={box.id}
                                onClick={() => setSelectedAsset({ type: 'nap', data: box })}
                                className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-purple-500/50 cursor-pointer flex items-center justify-between group transition-colors"
                              >
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-200 text-[11px] group-hover:text-purple-300">
                                      {box.code}
                                    </span>
                                    <span className="text-[9px] px-1 rounded bg-purple-950/80 text-purple-300 font-mono">
                                      PON #{box.ponPortNumber || 1}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 block truncate max-w-[170px]">
                                    {box.name} • Brgy. {box.barangay}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="font-mono text-[10px] text-emerald-400 font-bold block">
                                    {occupied}/{box.totalPorts}
                                  </span>
                                  <span
                                    className="font-mono text-[9px] text-cyan-400 flex items-center justify-end gap-0.5"
                                    title={`Direct span: ${oltSpan.formattedDirect} | Est. Cable Route: ${oltSpan.formattedRoute} (~${oltSpan.opticalLossDb} dB)`}
                                  >
                                    <Ruler className="w-2.5 h-2.5" />
                                    <span>{oltSpan.formattedDirect}</span>
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">
                        Facility & Power Backup
                      </span>
                      <p className="text-slate-300 text-[11px]">
                        {oltData.notes ||
                          'Optical POP headend with redundant utility grid & UPS battery bank.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setOltModalCoords(null);
                        setEditingOltId(oltData.id);
                        setShowOltModal(true);
                      }}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <Server className="w-4 h-4" />
                      <span>Configure / Edit OLT Coordinates</span>
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* OTDR Fault Break Simulation Modal */}
      {showOtdrModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-5 text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <span>OTDR Optical Fiber Break Diagnostic</span>
              </h3>
              <button onClick={() => setShowOtdrModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-400">
              Input the distance reported by your Optical Time Domain Reflectometer (OTDR) to calculate the geographical break location and affected subscribers.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">OTDR Fault Distance (Meters from OLT) *</label>
                <div className="relative">
                  <input
                    type="number"
                    value={otdrDistanceMeters}
                    onChange={(e) => setOtdrDistanceMeters(Number(e.target.value))}
                    placeholder="650"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono text-sm"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">meters</span>
                </div>
              </div>

              {/* Quick Distance Presets */}
              <div className="flex gap-2">
                {[350, 650, 920, 1200].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setOtdrDistanceMeters(d)}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-cyan-500 text-[11px]"
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowOtdrModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCalculateOtdrBreak}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold shadow-lg shadow-rose-600/20"
              >
                Locate Optical Break
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Optical Link Budget Calculator Modal */}
      {showLinkBudgetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full space-y-5 text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-purple-400" />
                <span>GPON Optical Link Budget & Attenuation Calculator</span>
              </h3>
              <button onClick={() => setShowLinkBudgetModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">OLT PON SFP Tx Power (dBm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={budgetTxPower}
                  onChange={(e) => setBudgetTxPower(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Total Route Distance (km)</label>
                <input
                  type="number"
                  step="0.1"
                  value={budgetDistanceKm}
                  onChange={(e) => setBudgetDistanceKm(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Optical Splitter Ratio</label>
                <select
                  value={budgetSplitter}
                  onChange={(e) => setBudgetSplitter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono"
                >
                  <option value="1:8">1:8 PLC Splitter (~10.5 dB)</option>
                  <option value="1:16">1:16 PLC Splitter (~14.0 dB)</option>
                  <option value="1:32">1:32 PLC Splitter (~17.5 dB)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Fusion Splices Count (0.05 dB ea)</label>
                <input
                  type="number"
                  value={budgetSplices}
                  onChange={(e) => setBudgetSplices(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono"
                />
              </div>
            </div>

            {/* Live Calculation Results Card */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300">Estimated ONU Customer Rx Signal:</span>
                <span className={`text-xl font-bold font-mono ${computedLinkBudget.statusColor}`}>
                  {computedLinkBudget.estimatedRx} dBm
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-900 text-[10px] text-slate-400 font-mono">
                <div>Fiber Loss: <strong className="text-slate-200">{computedLinkBudget.fiberLoss} dB</strong></div>
                <div>Splitter: <strong className="text-slate-200">{computedLinkBudget.splitterLoss} dB</strong></div>
                <div>Splices: <strong className="text-slate-200">{computedLinkBudget.spliceLoss} dB</strong></div>
                <div>Total: <strong className="text-cyan-400">{computedLinkBudget.totalLoss} dB</strong></div>
              </div>

              <div className="pt-1">
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-slate-900 border border-slate-800 ${computedLinkBudget.statusColor}`}>
                  {computedLinkBudget.status} (ITU-T G.984 GPON Standard)
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowLinkBudgetModal(false)}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold"
              >
                Close Calculator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OLT Registration & Coordinates Modal */}
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

