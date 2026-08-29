import React, { useState, useEffect } from 'react';
import {
  X,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Wifi,
  Barcode,
  Activity,
  Layers,
  Sparkles,
  Smartphone,
  Navigation,
  Check,
  ShieldCheck,
  Send,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import { Customer, NapBox } from '../../types';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface InstallationLoggerModalProps {
  customer: Customer;
  workOrderId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const InstallationLoggerModal: React.FC<InstallationLoggerModalProps> = ({
  customer,
  workOrderId,
  onClose,
  onSuccess,
}) => {
  const { napBoxes, updateCustomer, syncCustomerMikrotik, logAuditEvent, showToast, businessProfile } = useApp();

  const [selectedNapId, setSelectedNapId] = useState<string>(customer.network.napBoxId || napBoxes[0]?.id || '');
  const [selectedPort, setSelectedPort] = useState<number>(customer.network.napPortNumber || 1);
  const [dropCableMeters, setDropCableMeters] = useState<number>(customer.installationDetails?.dropCableMeters || 65);
  const [opticalDbm, setOpticalDbm] = useState<number>(customer.network.opticalPowerDbm || -18.5);
  const [technician, setTechnician] = useState<string>(
    customer.installationDetails?.technician || 'Leonardo Flojo (Lead Field Tech)'
  );
  const [onuSerial, setOnuSerial] = useState<string>(customer.network.onuSerial || 'HWTC-48A9B2C1');
  const [macAddress, setMacAddress] = useState<string>(customer.network.macAddress || 'BC:A9:93:41:02:19');
  const [routerModel, setRouterModel] = useState<string>(customer.network.routerModel || 'Huawei EchoLife HG8145V5 Dual-Band');
  const [surveyNotes, setSurveyNotes] = useState<string>(
    customer.installationDetails?.surveyNotes || 'Pole span verified. Drop wire fastened with S-clamps. Optimal optical power.'
  );

  // GPS Coordinates state
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [isGettingGps, setIsGettingGps] = useState<boolean>(false);

  // Camera Barcode Scanner Modal State
  const [showScanner, setShowScanner] = useState<boolean>(false);

  const selectedNap = napBoxes.find((n) => n.id === selectedNapId);

  // Optical Signal Quality Assessment
  const getSignalGrade = (dbm: number) => {
    if (dbm > -8.0) {
      return {
        label: 'OVERPOWERED (Receiver Saturation Risk)',
        color: 'text-rose-400 bg-rose-950/60 border-rose-800/60',
        status: 'warning',
        desc: 'Signal is unusually high. Receiver photodiode may saturate.',
      };
    }
    if (dbm >= -24.0 && dbm <= -8.0) {
      return {
        label: 'PASS: OPTIMAL OPTICAL LINK (Clean Fiber)',
        color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60',
        status: 'pass',
        desc: 'Ideal GPON optical power. Low attenuation and clean connectors.',
      };
    }
    if (dbm >= -27.0 && dbm < -24.0) {
      return {
        label: 'MARGINAL: ACCEPTABLE SIGNAL',
        color: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
        status: 'marginal',
        desc: 'Usable but high attenuation. Check fiber bend radius & splice trays.',
      };
    }
    return {
      label: 'FAIL: HIGH ATTENUATION / LINK LOSS',
      color: 'text-rose-400 bg-rose-950/60 border-rose-800/60',
      status: 'fail',
      desc: 'Optical link degraded. Clean SC/APC connector or re-splice drop cable.',
    };
  };

  const signalGrade = getSignalGrade(opticalDbm);

  // GPS Fetcher
  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      showToast('error', 'GPS Unavailable', 'Geolocation is not supported by your browser.');
      return;
    }

    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({
          lat: parseFloat(pos.coords.latitude.toFixed(6)),
          lng: parseFloat(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
        });
        setIsGettingGps(false);
        showToast('success', 'GPS Tagged', `Pinned site: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (±${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        setIsGettingGps(false);
        // Fallback default coordinates around Binauahan, Lagonoy
        setGpsLocation({ lat: 13.7382, lng: 123.5189, accuracy: 15 });
        showToast('info', 'GPS Simulated', 'Tagged site to Binauahan, Lagonoy POP coordinates.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleCompleteInstallation = (e: React.FormEvent) => {
    e.preventDefault();

    if (!onuSerial.trim()) {
      showToast('error', 'ONU Required', 'Please scan or enter the ONU serial number.');
      return;
    }

    // Update customer network and installation details
    updateCustomer(customer.id, {
      status: 'active',
      network: {
        ...customer.network,
        napBoxId: selectedNapId,
        napPortNumber: Number(selectedPort),
        onuSerial: onuSerial.trim().toUpperCase(),
        macAddress: macAddress.trim().toUpperCase() || undefined,
        routerModel,
        opticalPowerDbm: opticalDbm,
        isMikrotikSynced: true,
      },
      installationDetails: {
        technician,
        opticalPowerDbm: opticalDbm,
        dropCableMeters,
        completedAt: new Date().toISOString(),
        surveyNotes,
      },
      updatedAt: new Date().toISOString(),
    });

    // Auto-sync customer to MikroTik PPPoE profile
    syncCustomerMikrotik(customer.id);

    // Trigger celebration
    try {
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.7 },
      });
    } catch {
      // ignore
    }

    logAuditEvent({
      userName: technician,
      action: 'ON_SITE_INSTALLATION_COMPLETED',
      category: 'network',
      severity: 'info',
      details: `Completed on-site installation for ${customer.fullName} (${customer.accountNo}). NAP: ${selectedNap?.name} (Port ${selectedPort}), Drop Cable: ${dropCableMeters}m, Optical Power: ${opticalDbm} dBm (${signalGrade.status.toUpperCase()}), ONU: ${onuSerial}.`,
      status: 'success',
    });

    showToast(
      'success',
      'Fiber Line Activated!',
      `Subscriber ${customer.fullName} is now provisioned and online on ${customer.planName}.`
    );

    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <span>Field Installation & Signal Quality Logger</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/40 text-[10px] font-mono">
                  PWA Field Mode
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {customer.fullName} • {customer.accountNo} • {customer.planName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleCompleteInstallation} className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* Section 1: Subscriber Info & GPS Site Capture */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-400" />
                <span className="font-bold text-slate-200">Installation Site & Address:</span>
              </div>

              <button
                type="button"
                onClick={handleCaptureGps}
                disabled={isGettingGps}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-xl font-semibold transition-colors self-start sm:self-auto"
              >
                <Navigation className={`w-3.5 h-3.5 ${isGettingGps ? 'animate-spin' : ''}`} />
                <span>{isGettingGps ? 'Querying GPS...' : gpsLocation ? 'GPS Tagged' : 'Auto-Capture Phone GPS'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-slate-500 block">Address:</span>
                <span className="text-slate-200 font-medium">{customer.address.street}, {customer.address.barangay}, {customer.address.city}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Contact & Landmark:</span>
                <span className="text-slate-200">{customer.mobile} {customer.address.landmark ? `(${customer.address.landmark})` : ''}</span>
              </div>
              {gpsLocation && (
                <div className="sm:col-span-2 p-2 rounded-xl bg-cyan-950/40 border border-cyan-800/40 font-mono text-[10px] text-cyan-300 flex items-center justify-between">
                  <span>GPS: {gpsLocation.lat.toFixed(5)}°N, {gpsLocation.lng.toFixed(5)}°E</span>
                  <span>Accuracy: ±{gpsLocation.accuracy}m</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: NAP Box & Drop Wire Meter Counter */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-slate-200">Outside Plant (OSP) NAP & Cable Run:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Assigned NAP Box:</label>
                <select
                  value={selectedNapId}
                  onChange={(e) => setSelectedNapId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {napBoxes.map((nap) => (
                    <option key={nap.id} value={nap.id}>
                      {nap.name} ({nap.ports.filter((p) => p.status === 'occupied').length}/{nap.totalPorts} ports)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">NAP Box Port #:</label>
                <select
                  value={selectedPort}
                  onChange={(e) => setSelectedPort(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                >
                  {Array.from({ length: selectedNap?.totalPorts || 8 }, (_, i) => i + 1).map((portNum) => (
                    <option key={portNum} value={portNum}>
                      Port #{portNum}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Drop Cable Used (Meters):</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={dropCableMeters}
                    onChange={(e) => setDropCableMeters(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setDropCableMeters((prev) => prev + 10)}
                      className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold"
                    >
                      +10m
                    </button>
                    <button
                      type="button"
                      onClick={() => setDropCableMeters((prev) => prev + 25)}
                      className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold"
                    >
                      +25m
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Hardware ONU Serial & Camera Scanner */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <Barcode className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-slate-200">Customer Premise ONU Hardware:</span>
              </div>

              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-sm transition-all hover:scale-105"
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>Camera Barcode Scanner</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">ONU Serial Number (GPON SN):</label>
                <input
                  type="text"
                  value={onuSerial}
                  onChange={(e) => setOnuSerial(e.target.value.toUpperCase())}
                  placeholder="e.g. HWTC-48A9B2C1"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500 uppercase font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Hardware MAC Address:</label>
                <input
                  type="text"
                  value={macAddress}
                  onChange={(e) => setMacAddress(e.target.value.toUpperCase())}
                  placeholder="e.g. BC:A9:93:41:02:19"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Router / ONU Model:</label>
                <input
                  type="text"
                  value={routerModel}
                  onChange={(e) => setRouterModel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Optical Power Meter (OPM) Signal Quality Gauge */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-slate-200">Optical Power Meter (OPM) Signal Test:</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Target: -8.0 dBm to -24.0 dBm</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Measured Optical Rx Power (dBm @ 1490nm):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={opticalDbm}
                    onChange={(e) => setOpticalDbm(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 font-mono text-base font-bold focus:outline-none focus:border-cyan-500"
                    required
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setOpticalDbm(-18.5)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-[9px] font-bold font-mono"
                    >
                      -18.5 (Good)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpticalDbm(-28.0)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded text-[9px] font-bold font-mono"
                    >
                      -28.0 (Bad)
                    </button>
                  </div>
                </div>
              </div>

              {/* Signal Quality Result Card */}
              <div className={`p-3.5 rounded-2xl border ${signalGrade.color} space-y-1`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] uppercase tracking-wide">{signalGrade.label}</span>
                  <span className="font-mono font-black text-sm">{opticalDbm.toFixed(1)} dBm</span>
                </div>
                <p className="text-[10px] opacity-90">{signalGrade.desc}</p>
              </div>
            </div>
          </div>

          {/* Section 5: Technician Attribution & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Field Technician / Splicer:</label>
              <input
                type="text"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Installation Remarks / Pole Info:</label>
              <input
                type="text"
                value={surveyNotes}
                onChange={(e) => setSurveyNotes(e.target.value)}
                placeholder="e.g. Pole #14, S-clamp anchored, verified link speed..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Action Submission */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>Complete Installation & Activate Line</span>
            </button>
          </div>
        </form>
      </div>

      {/* Embedded Barcode / QR Scanner Modal */}
      {showScanner && (
        <BarcodeScannerModal
          onScanComplete={(data) => {
            setOnuSerial(data.serial);
            if (data.mac) setMacAddress(data.mac);
            if (data.model) setRouterModel(data.model);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
};
