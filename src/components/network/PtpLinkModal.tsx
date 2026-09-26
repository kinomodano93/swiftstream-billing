import React, { useState, useEffect } from 'react';
import {
  Radio,
  Server,
  Zap,
  MapPin,
  Compass,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Sliders,
  Ruler,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PointToPointLink, PtpReadingStatus } from '../../types';
import { calculateSpanMetrics } from '../../utils/geoDistance';
import { calculatePtpOpticalStatus, formatPtpSpeed } from '../../utils/ptpOptical';
import { BARANGAY_COORDINATES } from '../../data/networkGeo';
import { fetchSfpOpticalDiagnostics } from '../../services/mikrotikApiService';

interface PtpLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingLinkId?: string | null;
  editingLink?: PointToPointLink | null;
  initialCoords?: { lat: number; lng: number } | null;
}

export const PtpLinkModal: React.FC<PtpLinkModalProps> = ({
  isOpen,
  onClose,
  editingLinkId,
  editingLink,
  initialCoords,
}) => {
  const {
    ptpLinks,
    addPtpLink,
    updatePtpLink,
    deletePtpLink,
    mikrotikDevices,
    oltNode,
    oltNodes,
  } = useApp();

  const primaryOlt = oltNodes[0] || oltNode;

  const [activeTab, setActiveTab] = useState<string>('new');
  const [code, setCode] = useState('PTP-10G-01');
  const [name, setName] = useState('');
  const [linkType, setLinkType] = useState<'10g_sfp_plus' | '1g_sfp' | '25g_sfp28'>('10g_sfp_plus');
  const [status, setStatus] = useState<'active' | 'warning' | 'critical' | 'link_down'>('active');

  // Endpoint A: Main DIA Router
  const [routerId, setRouterId] = useState<string>('');
  const [routerName, setRouterName] = useState('MikroTik CCR2116-12G-4S+ (Main DIA)');
  const [routerPort, setRouterPort] = useState('sfp-sfpplus1');
  const [routerLocation, setRouterLocation] = useState('Central NOC / Headend');
  const [routerPoleNumber, setRouterPoleNumber] = useState('CASURECO P-NOC-01');
  const [routerLatitude, setRouterLatitude] = useState<number>(primaryOlt?.latitude || 13.6838);
  const [routerLongitude, setRouterLongitude] = useState<number>(primaryOlt?.longitude || 123.5175);

  // Endpoint B: Remote Location
  const [remoteNodeName, setRemoteNodeName] = useState('Poblacion Plaza Telecom Tower');
  const [remoteLocation, setRemoteLocation] = useState('San Francisco (Poblacion)');
  const [remoteDeviceType, setRemoteDeviceType] = useState('MikroTik CCR2004-16G-2S+ Gateway');
  const [remotePort, setRemotePort] = useState('sfp-sfpplus1');
  const [remotePoleNumber, setRemotePoleNumber] = useState('CASURECO P-TWR-01');
  const [remoteLatitude, setRemoteLatitude] = useState<number>(13.6878);
  const [remoteLongitude, setRemoteLongitude] = useState<number>(123.5215);

  // SFP+ Optical DDM Readings & Budget
  const [transceiverModel, setTransceiverModel] = useState('10GBASE-LR 1310nm Single-Mode SFP+ (10km)');
  const [wavelengthNm, setWavelengthNm] = useState<number>(1310);
  const [nominalTxPowerDbm, setNominalTxPowerDbm] = useState<number>(-3.0);
  const [measuredRxPowerDbm, setMeasuredRxPowerDbm] = useState<number>(-3.4);
  const [maxLossBudgetDb, setMaxLossBudgetDb] = useState<number>(14.0);
  const [notes, setNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isQueryingSfp, setIsQueryingSfp] = useState<boolean>(false);
  const [sfpQueryToast, setSfpQueryToast] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  // Load existing or initialize
  useEffect(() => {
    if (!isOpen) return;

    const targetId = editingLinkId || editingLink?.id;
    if (targetId) {
      const existing = ptpLinks.find((l) => l.id === targetId) || editingLink;
      if (existing) {
        loadLinkIntoForm(existing);
        setActiveTab(existing.id);
        return;
      }
    }

    if (ptpLinks.length > 0 && activeTab !== 'new') {
      const first = ptpLinks.find((l) => l.id === activeTab) || ptpLinks[0];
      loadLinkIntoForm(first);
      setActiveTab(first.id);
    } else {
      resetForm();
      setActiveTab('new');
    }
  }, [isOpen, editingLinkId, editingLink]);

  const loadLinkIntoForm = (link: PointToPointLink) => {
    setCode(link.code);
    setName(link.name);
    setLinkType(link.type || '10g_sfp_plus');
    setStatus(link.status);
    setRouterId(link.routerId || '');
    setRouterName(link.routerName);
    setRouterPort(link.routerPort);
    setRouterLocation(link.routerLocation);
    setRouterPoleNumber(link.routerPoleNumber || '');
    setRouterLatitude(link.routerLatitude);
    setRouterLongitude(link.routerLongitude);
    setRemoteNodeName(link.remoteNodeName);
    setRemoteLocation(link.remoteLocation);
    setRemoteDeviceType(link.remoteDeviceType || '');
    setRemotePort(link.remotePort || 'sfp-sfpplus1');
    setRemotePoleNumber(link.remotePoleNumber || '');
    setRemoteLatitude(link.remoteLatitude);
    setRemoteLongitude(link.remoteLongitude);
    setTransceiverModel(link.transceiverModel || '10GBASE-LR 1310nm Single-Mode SFP+ (10km)');
    setWavelengthNm(link.wavelengthNm || 1310);
    setNominalTxPowerDbm(link.nominalTxPowerDbm ?? -3.0);
    setMeasuredRxPowerDbm(link.measuredRxPowerDbm ?? -3.4);
    setMaxLossBudgetDb(link.maxLossBudgetDb ?? 14.0);
    setNotes(link.notes || '');
    setConfirmDelete(false);
  };

  const resetForm = () => {
    const nextNum = ptpLinks.length + 1;
    const codeNum = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
    setCode(`PTP-10G-${codeNum}`);
    setName(`DIA 10G Trunk: Main Core ➔ Remote Site ${codeNum}`);
    setLinkType('10g_sfp_plus');
    setStatus('active');
    setRouterId(mikrotikDevices[0]?.id || '');
    setRouterName(mikrotikDevices[0]?.name || 'MikroTik CCR2116-12G-4S+ (Main DIA)');
    setRouterPort('sfp-sfpplus1');
    setRouterLocation('Central NOC / Headend Server Room');
    setRouterPoleNumber('CASURECO P-NOC-01');
    setRouterLatitude(primaryOlt?.latitude || 13.6838);
    setRouterLongitude(primaryOlt?.longitude || 123.5175);

    if (initialCoords) {
      setRemoteLatitude(initialCoords.lat);
      setRemoteLongitude(initialCoords.lng);
    } else {
      setRemoteLatitude(13.6878);
      setRemoteLongitude(123.5215);
    }

    setRemoteNodeName('Poblacion Plaza Telecom Tower');
    setRemoteLocation('San Francisco (Poblacion)');
    setRemoteDeviceType('MikroTik CCR2004-16G-2S+ Remote Gateway');
    setRemotePort('sfp-sfpplus1');
    setRemotePoleNumber('CASURECO P-TWR-01');
    setTransceiverModel('10GBASE-LR 1310nm Single-Mode SFP+ (10km)');
    setWavelengthNm(1310);
    setNominalTxPowerDbm(-3.0);
    setMeasuredRxPowerDbm(-3.4);
    setMaxLossBudgetDb(14.0);
    setNotes('High-capacity dedicated 10G DIA point-to-point trunk.');
    setConfirmDelete(false);
  };

  // Sync selected MikroTik device
  const handleRouterSelect = (devId: string) => {
    setRouterId(devId);
    const dev = mikrotikDevices.find((d) => d.id === devId);
    if (dev) {
      setRouterName(`${dev.name} (${dev.model || 'Core Router'})`);
    }
  };

  // Live SFP+ DDM Telemetry Fetcher from linked MikroTik Router
  const handleFetchLiveSfpDdm = async () => {
    const dev = mikrotikDevices.find((d) => d.id === routerId);
    if (!dev) {
      setSfpQueryToast({
        type: 'warning',
        message: 'Please link a configured MikroTik router above to query live SFP+ telemetry.',
      });
      return;
    }

    setIsQueryingSfp(true);
    setSfpQueryToast(null);

    try {
      const targetPort = routerPort || 'sfp-sfpplus1';
      const ddm = await fetchSfpOpticalDiagnostics(
        {
          id: dev.id,
          name: dev.name,
          ipAddress: dev.ipAddress || dev.remoteAddress || '',
          port: dev.port || dev.webfigPort || 10988,
          username: dev.username || 'admin',
          password: dev.password || '',
        },
        targetPort
      );

      if (ddm) {
        const parseNum = (val: any, fallback: number): number => {
          if (typeof val === 'number') return val;
          if (!val) return fallback;
          const match = String(val).match(/-?[\d.]+/);
          return match ? parseFloat(match[0]) : fallback;
        };

        const rx = parseNum(ddm['sfp-rx-power'] || ddm.rxPower || ddm['rx-power'], measuredRxPowerDbm);
        const tx = parseNum(ddm['sfp-tx-power'] || ddm.txPower || ddm['tx-power'], nominalTxPowerDbm);
        const temp = parseNum(ddm['sfp-temperature'] || ddm.temperature, 38.0);
        const volt = parseNum(ddm['sfp-supply-voltage'] || ddm.voltage, 3.3);

        setMeasuredRxPowerDbm(rx);
        setNominalTxPowerDbm(tx);

        setSfpQueryToast({
          type: 'success',
          message: `Queried ${dev.name} [${targetPort}]: Rx ${rx.toFixed(1)} dBm • Tx ${tx.toFixed(1)} dBm • Temp ${temp}°C • Supply ${volt}V`,
        });
      } else {
        setSfpQueryToast({
          type: 'warning',
          message: `No DDM telemetry received from ${dev.name} on ${targetPort}. Ensure SFP+ optics support DDM.`,
        });
      }
    } catch (err: any) {
      setSfpQueryToast({
        type: 'error',
        message: `Failed to query SFP+ DDM: ${err.message || 'Connection error'}`,
      });
    } finally {
      setIsQueryingSfp(false);
    }
  };

  // Preset location coordinate helper
  const handleBarangayPreset = (bName: string) => {
    setRemoteLocation(bName);
    const coords = BARANGAY_COORDINATES[bName];
    if (coords) {
      setRemoteLatitude(coords.lat);
      setRemoteLongitude(coords.lng);
    }
  };

  // Calculated distance & optical metrics
  const spanMetrics = calculateSpanMetrics(
    routerLatitude,
    routerLongitude,
    remoteLatitude,
    remoteLongitude
  );

  const opticalAnalysis = calculatePtpOpticalStatus(
    measuredRxPowerDbm,
    nominalTxPowerDbm,
    maxLossBudgetDb,
    spanMetrics.routeCableMeters
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const linkPayload: Omit<PointToPointLink, 'id'> = {
      code: code.trim() || 'PTP-10G-NEW',
      name: name.trim() || 'Dedicated 10G Point-to-Point Link',
      type: linkType,
      status: opticalAnalysis.status === 'critical' ? 'critical' : opticalAnalysis.status === 'marginal' ? 'warning' : 'active',
      routerId: routerId || undefined,
      routerName: routerName.trim() || 'Main DIA Core Router',
      routerPort: routerPort.trim() || 'sfp-sfpplus1',
      routerLocation: routerLocation.trim() || 'NOC',
      routerPoleNumber: routerPoleNumber.trim() || undefined,
      routerLatitude: Number(routerLatitude) || 13.6838,
      routerLongitude: Number(routerLongitude) || 123.5175,
      remoteNodeName: remoteNodeName.trim() || 'Remote Tower POP',
      remoteLocation: remoteLocation.trim() || 'Lagonoy',
      remoteDeviceType: remoteDeviceType.trim() || undefined,
      remotePort: remotePort.trim() || 'sfp-sfpplus1',
      remotePoleNumber: remotePoleNumber.trim() || undefined,
      remoteLatitude: Number(remoteLatitude) || 13.6878,
      remoteLongitude: Number(remoteLongitude) || 123.5215,
      cableLengthMeters: spanMetrics.routeCableMeters,
      transceiverModel,
      wavelengthNm: Number(wavelengthNm) || 1310,
      nominalTxPowerDbm: Number(nominalTxPowerDbm),
      measuredRxPowerDbm: Number(measuredRxPowerDbm),
      maxLossBudgetDb: Number(maxLossBudgetDb),
      opticalReadingStatus: opticalAnalysis.status,
      linkSpeedGbps: linkType === '25g_sfp28' ? 25 : linkType === '1g_sfp' ? 1 : 10,
      temperatureC: 38.5,
      voltageV: 3.31,
      txBiasCurrentMa: 22.4,
      notes: notes.trim() || undefined,
      installedDate: new Date().toISOString().slice(0, 10),
    };

    if (activeTab === 'new') {
      addPtpLink(linkPayload);
    } else {
      updatePtpLink(activeTab, linkPayload);
    }

    onClose();
  };

  const handleDelete = () => {
    if (activeTab !== 'new') {
      deletePtpLink(activeTab);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
              <Radio className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Point-to-Point (P2P) 10G SFP+ Link Configuration</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  DIA Dedicated Fiber
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure 10Gbps optical backbone trunk from Main DIA Router to remote POP or tower.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Link Switcher Tabs */}
        <div className="px-6 pt-4 flex items-center gap-2 border-b border-slate-800 bg-slate-950/60 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('new');
              resetForm();
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all shrink-0 ${
              activeTab === 'new'
                ? 'border-indigo-400 text-indigo-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            <span>New 10G Link</span>
          </button>

          {ptpLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => {
                setActiveTab(link.id);
                loadLinkIntoForm(link);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all shrink-0 ${
                activeTab === link.id
                  ? 'border-indigo-400 text-indigo-300 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-indigo-400" />
              <span>{link.code}</span>
              <span className={`w-2 h-2 rounded-full ml-1 ${
                link.opticalReadingStatus === 'critical'
                  ? 'bg-rose-500 animate-pulse'
                  : link.opticalReadingStatus === 'marginal'
                  ? 'bg-amber-500'
                  : 'bg-emerald-400'
              }`} />
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {/* Section 1: Link Identification & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Link Code *</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="PTP-10G-01"
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1 font-medium">Circuit Description *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Main DIA 10G Trunk: Central NOC ➔ Town Plaza Tower"
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 2: Endpoint A (Main DIA Router) */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-indigo-900/40 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-indigo-300 font-bold">
                <Server className="w-4 h-4 text-indigo-400" />
                <span>Endpoint A: Main DIA Router (NOC Headend)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Origin Optical Transmitter</span>
            </div>

            {/* Live SFP+ Query Status Banner */}
            {sfpQueryToast && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                  sfpQueryToast.type === 'success'
                    ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300'
                    : sfpQueryToast.type === 'warning'
                    ? 'bg-amber-950/70 border-amber-800/80 text-amber-300'
                    : 'bg-rose-950/70 border-rose-800/80 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span className="font-mono text-[11px]">{sfpQueryToast.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSfpQueryToast(null)}
                  className="text-slate-400 hover:text-white px-1 font-bold text-xs"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {mikrotikDevices.length > 0 ? (
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Link to MikroTik Router</label>
                  <select
                    value={routerId}
                    onChange={(e) => handleRouterSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">Custom / Manual Router</option>
                    {mikrotikDevices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.ipAddress})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className={mikrotikDevices.length > 0 ? 'sm:col-span-2' : 'sm:col-span-3'}>
                <label className="block text-slate-400 mb-1 font-medium">Main Router Name *</label>
                <input
                  type="text"
                  value={routerName}
                  onChange={(e) => setRouterName(e.target.value)}
                  placeholder="MikroTik CCR2116-12G-4S+ (Main DIA)"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-400 font-medium">Router Port *</label>
                  {routerId && (
                    <button
                      type="button"
                      onClick={handleFetchLiveSfpDdm}
                      disabled={isQueryingSfp}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono font-bold flex items-center gap-1 cursor-pointer bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/60 px-2 py-0.5 rounded-lg transition-all disabled:opacity-50"
                      title="Fetch live Rx/Tx dBm, temperature & voltage via MikroTik DDM monitor"
                    >
                      <Zap className={`w-3 h-3 ${isQueryingSfp ? 'animate-spin' : 'text-amber-400'}`} />
                      <span>{isQueryingSfp ? 'Querying...' : 'Query Live SFP+'}</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={routerPort}
                  onChange={(e) => setRouterPort(e.target.value)}
                  placeholder="sfp-sfpplus1"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-cyan-300 font-mono text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">NOC CASURECO Pole #</label>
                <input
                  type="text"
                  value={routerPoleNumber}
                  onChange={(e) => setRouterPoleNumber(e.target.value)}
                  placeholder="CASURECO P-NOC-01"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-amber-300 font-mono text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">NOC Location</label>
                <input
                  type="text"
                  value={routerLocation}
                  onChange={(e) => setRouterLocation(e.target.value)}
                  placeholder="Central NOC / Headend Server Room"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Router Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={routerLatitude}
                  onChange={(e) => setRouterLatitude(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 font-mono text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1 font-medium">Router Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={routerLongitude}
                  onChange={(e) => setRouterLongitude(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 font-mono text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Endpoint B (Remote Location & Tower) */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-cyan-900/40 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-cyan-300 font-bold">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span>Endpoint B: Remote Location / Far-End Tower</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Receiver Optical Node</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1 font-medium">Remote Node Name *</label>
                <input
                  type="text"
                  value={remoteNodeName}
                  onChange={(e) => setRemoteNodeName(e.target.value)}
                  placeholder="Poblacion Plaza Telecom Tower POP"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Quick Location Preset</label>
                <select
                  value={remoteLocation}
                  onChange={(e) => handleBarangayPreset(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
                >
                  {Object.keys(BARANGAY_COORDINATES).map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Remote Device Type</label>
                <input
                  type="text"
                  value={remoteDeviceType}
                  onChange={(e) => setRemoteDeviceType(e.target.value)}
                  placeholder="MikroTik CCR2004-16G-2S+ Gateway"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Remote Port</label>
                <input
                  type="text"
                  value={remotePort}
                  onChange={(e) => setRemotePort(e.target.value)}
                  placeholder="sfp-sfpplus1"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-cyan-300 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Remote CASURECO Pole #</label>
                <input
                  type="text"
                  value={remotePoleNumber}
                  onChange={(e) => setRemotePoleNumber(e.target.value)}
                  placeholder="CASURECO P-TWR-01"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-amber-300 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Remote Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={remoteLatitude}
                  onChange={(e) => setRemoteLatitude(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1 font-medium">Remote Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={remoteLongitude}
                  onChange={(e) => setRemoteLongitude(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 font-mono text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: 10G SFP+ Optical Telemetry & Reading Status */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-purple-900/40 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-purple-300 font-bold">
                <Zap className="w-4 h-4 text-purple-400" />
                <span>10G SFP+ Optical DDM & Reading Status Engine</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">10Gbps Single-Mode ITU-T G.652.D</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Nominal Output Tx (dBm) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={nominalTxPowerDbm}
                  onChange={(e) => setNominalTxPowerDbm(Number(e.target.value))}
                  placeholder="-3.0"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono text-xs focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Standard: -3.0 dBm</span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Measured Rx Reading (dBm) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={measuredRxPowerDbm}
                  onChange={(e) => setMeasuredRxPowerDbm(Number(e.target.value))}
                  placeholder="-3.4"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-indigo-300 font-bold font-mono text-xs focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Actual reading at far end</span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Max Loss Budget (dB) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={maxLossBudgetDb}
                  onChange={(e) => setMaxLossBudgetDb(Number(e.target.value))}
                  placeholder="14.0"
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono text-xs focus:border-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Max budget limit: 14.0 dB</span>
              </div>
            </div>

            {/* Live Status Analysis Card */}
            <div className={`p-3 rounded-xl border ${opticalAnalysis.borderClass} ${opticalAnalysis.bgClass} space-y-2`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full font-bold font-mono text-[10px] border ${opticalAnalysis.badgeClass}`}>
                    {opticalAnalysis.statusLabel}
                  </span>
                  <span className="text-slate-300 font-mono">
                    Rx: <strong>{measuredRxPowerDbm.toFixed(1)} dBm</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-slate-400">Total Loss: <strong>{opticalAnalysis.observedLossDb} dB</strong></span>
                  <span className="text-slate-500">|</span>
                  <span className="text-emerald-400">Margin: <strong>+{opticalAnalysis.remainingMarginDb} dB</strong></span>
                </div>
              </div>

              {/* Progress Visualizer: Optical Window */}
              <div className="space-y-1">
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                  <div style={{ width: '45%' }} className="bg-emerald-500/80" title="Optimal Zone (-3 to -9 dBm)" />
                  <div style={{ width: '25%' }} className="bg-cyan-500/80" title="Good Zone (-9 to -12 dBm)" />
                  <div style={{ width: '15%' }} className="bg-amber-500/80" title="Marginal Zone (-12 to -14 dBm)" />
                  <div style={{ width: '15%' }} className="bg-rose-500/80" title="Critical Zone (< -14 dBm)" />
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                  <span>-3 dBm (Nominal)</span>
                  <span>-9 dBm</span>
                  <span>-12 dBm</span>
                  <span className="text-amber-400 font-bold">-14 dBm (Max Budget)</span>
                </div>
              </div>

              <p className={`text-[11px] ${opticalAnalysis.textClass}`}>
                {opticalAnalysis.healthDescription}
              </p>
            </div>

            {/* Calculated Distance Strip */}
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center font-mono">
              <div>
                <span className="text-[10px] text-slate-500 block">Direct Geodesic</span>
                <span className="text-slate-200 font-bold">{spanMetrics.formattedDirect}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Route Cable (Poles)</span>
                <span className="text-indigo-400 font-bold">{spanMetrics.formattedRoute}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Fiber Delay</span>
                <span className="text-cyan-400 font-bold">{spanMetrics.propagationDelayMicroseconds} µs</span>
              </div>
            </div>
          </div>

          {/* Section 5: Transceiver & SFP+ Model Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">SFP+ Transceiver Model</label>
              <input
                type="text"
                value={transceiverModel}
                onChange={(e) => setTransceiverModel(e.target.value)}
                placeholder="10GBASE-LR 1310nm Single-Mode SFP+ (10km)"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Maintenance Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Aerial ADSS fiber span along CASURECO highway utility poles."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 text-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            {activeTab !== 'new' ? (
              confirmDelete ? (
                <div className="flex items-center gap-2 animate-in fade-in">
                  <span className="text-rose-400 font-medium">Delete this 10G link?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold transition-all"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Link</span>
                </button>
              )
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/30 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{activeTab === 'new' ? 'Deploy 10G SFP+ Link' : 'Save Link Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
