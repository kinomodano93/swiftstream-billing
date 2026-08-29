import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  Flashlight,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Barcode,
  Sparkles,
  Upload,
  Cpu,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface BarcodeScannerModalProps {
  onScanComplete: (data: { serial: string; mac?: string; model?: string }) => void;
  onClose: () => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  onScanComplete,
  onClose,
}) => {
  const { showToast } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [manualSerial, setManualSerial] = useState<string>('');
  const [manualMac, setManualMac] = useState<string>('');
  const [detectedModel, setDetectedModel] = useState<string>('Huawei EchoLife HG8145V5');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sample quick presets for testing on laptops/desktops
  const presets = [
    { brand: 'Huawei', model: 'HG8145V5 Dual-Band GPON', serial: 'HWTC-89B214AC', mac: 'BC:A9:93:41:02:19' },
    { brand: 'ZTE', model: 'ZXHN F670L Gigabit ONU', serial: 'ZTEG-10293847', mac: '68:BD:AB:88:51:7C' },
    { brand: 'FiberHome', model: 'AN5506-04-F Giga Router', serial: 'FHTT-99321455', mac: '74:83:C2:59:E1:30' },
    { brand: 'VSOL', model: 'V2802RH Realtek XPON', serial: 'VSOL-44589211', mac: 'A4:12:42:91:BB:04' },
  ];

  // Start Camera Stream
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setHasCamera(false);
          setErrorMsg('Camera API not supported in this browser. Use manual input or quick test presets below.');
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' }, // Prefer back camera
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraActive(true);
        }
      } catch (err: any) {
        console.warn('Camera access error:', err);
        setHasCamera(false);
        setErrorMsg('Camera permission not granted or unavailable. You can use manual entry or test barcode presets.');
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleSelectPreset = (preset: (typeof presets)[0]) => {
    setManualSerial(preset.serial);
    setManualMac(preset.mac);
    setDetectedModel(preset.model);
    showToast('info', 'Barcode Simulated', `Detected ${preset.brand} ${preset.model} barcode.`);
  };

  const handleConfirmScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSerial.trim()) {
      showToast('error', 'Serial Required', 'Please scan or input an ONU serial number.');
      return;
    }

    onScanComplete({
      serial: manualSerial.trim().toUpperCase(),
      mac: manualMac.trim().toUpperCase() || undefined,
      model: detectedModel,
    });
    showToast('success', 'Hardware Scanned', `Bound ONU Serial: ${manualSerial.trim().toUpperCase()}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <span>ONU / ONT Optical Hardware Scanner</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/40 text-[10px] font-mono">
                  Camera Vision
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Scan barcode/QR on ONU casing to extract Serial Number & MAC Address
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

        {/* Viewfinder / Camera Simulation Area */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center group shadow-inner">
            {cameraActive ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
            ) : (
              <div className="text-center p-6 space-y-2">
                <QrCode className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
                <p className="text-slate-400 text-xs font-medium">Camera Standby / Emulation Mode</p>
                {errorMsg && <p className="text-[11px] text-amber-400/80 max-w-xs">{errorMsg}</p>}
              </div>
            )}

            {/* Target Reticle Crosshair */}
            <div className="absolute inset-8 border-2 border-dashed border-cyan-400/70 rounded-xl pointer-events-none flex flex-col justify-between p-2">
              <div className="flex justify-between">
                <div className="w-4 h-4 border-t-2 border-l-2 border-cyan-400 -mt-1 -ml-1" />
                <div className="w-4 h-4 border-t-2 border-r-2 border-cyan-400 -mt-1 -mr-1" />
              </div>

              {/* Scanning Red Laser Line */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse" />

              <div className="flex justify-between">
                <div className="w-4 h-4 border-b-2 border-l-2 border-cyan-400 -mb-1 -ml-1" />
                <div className="w-4 h-4 border-b-2 border-r-2 border-cyan-400 -mb-1 -mr-1" />
              </div>
            </div>

            {/* Badge overlay */}
            <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-slate-950/80 backdrop-blur-sm border border-slate-800 text-[10px] text-cyan-300 font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>ALIGN BARCODE TO BOX</span>
            </div>
          </div>

          {/* Quick Hardware Presets for 1-click Test Autofill */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Test Presets (Tap to Simulate Live Optical Scan):</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 transition-all text-left group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-[11px] group-hover:text-cyan-300">
                      {p.brand}
                    </span>
                    <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/80 px-1 rounded">
                      {p.serial.slice(0, 9)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{p.model}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Scanned/Manual Fields Form */}
          <form onSubmit={handleConfirmScan} className="space-y-3 pt-2 border-t border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Scanned ONU Serial (GPON SN / PON MAC):
                </label>
                <input
                  type="text"
                  value={manualSerial}
                  onChange={(e) => setManualSerial(e.target.value.toUpperCase())}
                  placeholder="e.g. HWTC-48A9B2C1"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500 uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Hardware MAC Address:
                </label>
                <input
                  type="text"
                  value={manualMac}
                  onChange={(e) => setManualMac(e.target.value.toUpperCase())}
                  placeholder="e.g. BC:A9:93:41:02:19"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500 uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">
                Detected Router / ONU Model:
              </label>
              <input
                type="text"
                value={detectedModel}
                onChange={(e) => setDetectedModel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm Hardware & Bind to Subscriber</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

