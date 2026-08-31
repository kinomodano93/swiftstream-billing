import React, { useState, useMemo } from 'react';
import {
  Cpu,
  Router,
  Wifi,
  RotateCw,
  Power,
  Sliders,
  Search,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Signal,
  RefreshCw,
  Key,
  Globe,
  HardDrive,
  Activity,
  Layers,
  ChevronRight,
  Gauge,
  Thermometer,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GenieAcsDevice } from '../../types';

export const GenieAcsManager: React.FC = () => {
  const { customers } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<GenieAcsDevice | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal actions
  const [isWifiModalOpen, setIsWifiModalOpen] = useState(false);
  const [newSsid, setNewSsid] = useState('');
  const [newWifiPassword, setNewWifiPassword] = useState('');

  const [isWanModalOpen, setIsWanModalOpen] = useState(false);
  const [newPppoeUser, setNewPppoeUser] = useState('');
  const [newPppoePass, setNewPppoePass] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Mock TR-069 CPE Fleet Devices
  const [devices, setDevices] = useState<GenieAcsDevice[]>([
    {
      id: 'cpe-001',
      serialNumber: 'ZTEGC14A2991',
      manufacturer: 'ZTE Corporation',
      productClass: 'F670L (Dual-Band GPON ONT)',
      hardwareVersion: 'V2.0',
      softwareVersion: 'V2.0.10P1T4',
      ipAddress: '10.200.14.88',
      macAddress: '2C:39:96:4A:29:91',
      connectionRequestUrl: 'http://10.200.14.88:7547/tr069',
      lastInform: new Date(Date.now() - 120000).toISOString(),
      isOnline: true,
      subscriberName: 'Eduardo Dela Cruz',
      pppoeUsername: 'pppoe_edcruz',
      opticalRxPowerDbm: -19.4,
      opticalTxPowerDbm: 2.3,
      opticalTemperature: 44.2,
      opticalVoltage: 3.28,
      wifiSsid: 'SwiftStream_Fiber_DelaCruz_5G',
      wifiChannel: 36,
      wanMode: 'PPPoE',
      uptimeSeconds: 345600,
    },
    {
      id: 'cpe-002',
      serialNumber: 'HWTC8829A002',
      manufacturer: 'Huawei Technologies',
      productClass: 'EG8145V5 (Wi-Fi 5 GPON Terminal)',
      hardwareVersion: '118E.A',
      softwareVersion: 'V5R019C00S105',
      ipAddress: '10.200.14.89',
      macAddress: '48:8F:5A:88:29:A0',
      connectionRequestUrl: 'http://10.200.14.89:7547/tr069',
      lastInform: new Date(Date.now() - 30000).toISOString(),
      isOnline: true,
      subscriberName: 'Maria Theresa Santos',
      pppoeUsername: 'pppoe_msantos',
      opticalRxPowerDbm: -18.2,
      opticalTxPowerDbm: 2.6,
      opticalTemperature: 41.0,
      opticalVoltage: 3.31,
      wifiSsid: 'Santos_Home_Fiber',
      wifiChannel: 44,
      wanMode: 'PPPoE',
      uptimeSeconds: 864000,
    },
    {
      id: 'cpe-003',
      serialNumber: 'VSOL4188F003',
      manufacturer: 'V-SOL Electronics',
      productClass: 'V2804AX (Wi-Fi 6 GPON/EPON HGU)',
      hardwareVersion: 'V1.3',
      softwareVersion: 'V1.3.4-20251101',
      ipAddress: '10.200.14.90',
      macAddress: '70:A7:41:88:F0:03',
      connectionRequestUrl: 'http://10.200.14.90:7547/tr069',
      lastInform: new Date(Date.now() - 600000).toISOString(),
      isOnline: true,
      subscriberName: 'Bernardo Del Rosario',
      pppoeUsername: 'pppoe_bdelrosario',
      opticalRxPowerDbm: -24.8,
      opticalTxPowerDbm: 1.9,
      opticalTemperature: 49.8,
      opticalVoltage: 3.25,
      wifiSsid: 'DelRosario_WiFi6',
      wifiChannel: 149,
      wanMode: 'PPPoE',
      uptimeSeconds: 120000,
    },
    {
      id: 'cpe-004',
      serialNumber: 'ZTEGC9921B004',
      manufacturer: 'ZTE Corporation',
      productClass: 'F660 (Single-Band ONT)',
      hardwareVersion: 'V5.0',
      softwareVersion: 'V5.0.1P1T1',
      ipAddress: '10.200.14.155',
      macAddress: 'D4:6E:0E:99:21:B0',
      connectionRequestUrl: 'http://10.200.14.155:7547/tr069',
      lastInform: new Date(Date.now() - 86400000 * 2).toISOString(),
      isOnline: false,
      subscriberName: 'Offline Test ONT',
      pppoeUsername: 'pppoe_offline',
      opticalRxPowerDbm: -32.0,
      opticalTxPowerDbm: 0.0,
      opticalTemperature: 0,
      opticalVoltage: 0,
      wifiSsid: 'Swift_Offline',
      wifiChannel: 6,
      wanMode: 'PPPoE',
      uptimeSeconds: 0,
    },
  ]);

  const filteredDevices = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return devices;
    return devices.filter(
      (d) =>
        d.serialNumber.toLowerCase().includes(q) ||
        d.manufacturer.toLowerCase().includes(q) ||
        d.productClass.toLowerCase().includes(q) ||
        d.ipAddress.includes(q) ||
        d.macAddress.toLowerCase().includes(q) ||
        (d.subscriberName && d.subscriberName.toLowerCase().includes(q))
    );
  }, [devices, searchQuery]);

  const onlineCount = devices.filter((d) => d.isOnline).length;

  const handleRefreshFleet = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('GenieACS NBI API polled. 4 CPE devices synchronized.');
    }, 800);
  };

  const handleRebootDevice = (dev: GenieAcsDevice) => {
    showToast(`TR-069 Reboot task queued for ${dev.serialNumber} (${dev.subscriberName}).`);
  };

  const handlePushWifi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice || !newSsid.trim()) return;

    setDevices((prev) =>
      prev.map((d) =>
        d.id === selectedDevice.id ? { ...d, wifiSsid: newSsid.trim() } : d
      )
    );
    if (selectedDevice) {
      setSelectedDevice({ ...selectedDevice, wifiSsid: newSsid.trim() });
    }
    setIsWifiModalOpen(false);
    showToast(`WiFi SSID & Key parameters pushed to TR-069 parameter tree for ${selectedDevice.serialNumber}!`);
  };

  const handlePushWan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice || !newPppoeUser.trim()) return;

    setDevices((prev) =>
      prev.map((d) =>
        d.id === selectedDevice.id ? { ...d, pppoeUsername: newPppoeUser.trim() } : d
      )
    );
    if (selectedDevice) {
      setSelectedDevice({ ...selectedDevice, pppoeUsername: newPppoeUser.trim() });
    }
    setIsWanModalOpen(false);
    showToast(`WAN PPPoE credentials pushed OTA to ${selectedDevice.serialNumber}!`);
  };

  const getOpticalRating = (rxDbm?: number) => {
    if (!rxDbm || rxDbm <= -30) return { label: 'LOS / Critical', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
    if (rxDbm < -25) return { label: 'Marginal Signal', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    if (rxDbm >= -24 && rxDbm <= -14) return { label: 'Optimal Optical Power', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    return { label: 'High Power', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' };
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm font-medium">{toastMessage}</p>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-teal-600/10 via-emerald-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-tr from-teal-600 to-emerald-500 rounded-xl text-white shadow-lg shadow-teal-500/20">
                <Router className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                  GenieACS (TR-069 CPE Management)
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-mono font-medium border border-teal-500/30">
                    Auto Configuration Server (ACS)
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  Inspect subscriber ONUs/ONTs, push WiFi & WAN settings over-the-air, monitor optical signal health, and reboot remotely.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshFleet}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              Poll TR-069 Informs
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Online CPE Fleet</p>
              <p className="text-xl font-bold text-slate-100 font-mono">
                {onlineCount} / {devices.length}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 text-teal-400 rounded-lg">
              <Signal className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Avg Optical Rx Power</p>
              <p className="text-xl font-bold text-slate-100 font-mono">-19.8 dBm</p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Dual-Band ONTs</p>
              <p className="text-xl font-bold text-slate-100 font-mono">3 Units</p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">GenieACS NBI API</p>
              <p className="text-xl font-bold text-emerald-400 font-mono">Connected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: CPE List Table */}
        <div className={`space-y-4 ${selectedDevice ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Serial Number, Subscriber, Model, IP, MAC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredDevices.map((dev) => {
              const isSelected = selectedDevice?.id === dev.id;
              const opticalRating = getOpticalRating(dev.opticalRxPowerDbm);

              return (
                <div
                  key={dev.id}
                  onClick={() => setSelectedDevice(dev)}
                  className={`bg-slate-900/80 border rounded-2xl p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-teal-500/60 shadow-lg shadow-teal-950/40 bg-slate-850'
                      : 'border-slate-800 hover:border-slate-700 hover:bg-slate-850/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-100 text-sm">
                          {dev.subscriberName || 'Unassigned ONT'}
                        </span>
                        <span className="font-mono text-[11px] text-teal-300 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/60">
                          {dev.serialNumber}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                            dev.isOnline
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {dev.isOnline ? 'INFORM OK' : 'OFFLINE'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400">{dev.manufacturer} — {dev.productClass}</p>

                      <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 flex-wrap font-mono">
                        <span>IP: {dev.ipAddress}</span>
                        <span>MAC: {dev.macAddress}</span>
                        <span className="text-slate-300 font-sans">
                          Optical: <strong className="text-teal-400 font-mono">{dev.opticalRxPowerDbm} dBm</strong> ({opticalRating.label})
                        </span>
                      </div>
                    </div>

                    <ChevronRight
                      className={`w-5 h-5 text-slate-500 shrink-0 transition-transform ${
                        isSelected ? 'rotate-90 text-teal-400' : ''
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: CPE Detail & Remote Actions */}
        {selectedDevice && (
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 sticky top-6 shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Router className="w-5 h-5 text-teal-400" />
                    {selectedDevice.serialNumber}
                  </h2>
                  <p className="text-xs text-slate-400">{selectedDevice.subscriberName}</p>
                </div>
                <button
                  onClick={() => setSelectedDevice(null)}
                  className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg text-xs"
                >
                  Close
                </button>
              </div>

              {/* Optical Power Gauge Card */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">
                    <Signal className="w-4 h-4" />
                    ONU Optical DDM Diagnostics
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      getOpticalRating(selectedDevice.opticalRxPowerDbm).color
                    }`}
                  >
                    {getOpticalRating(selectedDevice.opticalRxPowerDbm).label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800/80">
                    <p className="text-[10px] text-slate-400">Rx Optical Power</p>
                    <p className="text-base font-bold text-teal-400">{selectedDevice.opticalRxPowerDbm} dBm</p>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800/80">
                    <p className="text-[10px] text-slate-400">Tx Optical Power</p>
                    <p className="text-base font-bold text-sky-400">{selectedDevice.opticalTxPowerDbm} dBm</p>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800/80">
                    <p className="text-[10px] text-slate-400">ONU Temp</p>
                    <p className="text-base font-bold text-amber-400">{selectedDevice.opticalTemperature}°C</p>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800/80">
                    <p className="text-[10px] text-slate-400">Internal Voltage</p>
                    <p className="text-base font-bold text-purple-400">{selectedDevice.opticalVoltage} V</p>
                  </div>
                </div>
              </div>

              {/* Hardware & Parameter Info */}
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Model / Class:</span>
                    <span className="text-slate-200 font-sans">{selectedDevice.productClass}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Firmware Version:</span>
                    <span className="text-slate-300">{selectedDevice.softwareVersion}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>WiFi SSID:</span>
                    <span className="text-cyan-400 font-sans">{selectedDevice.wifiSsid}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>PPPoE Account:</span>
                    <span className="text-amber-400">{selectedDevice.pppoeUsername}</span>
                  </div>
                </div>
              </div>

              {/* TR-069 Remote Actions */}
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">TR-069 Over-The-Air Actions</p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setNewSsid(selectedDevice.wifiSsid || '');
                      setIsWifiModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-all"
                  >
                    <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                    Push WiFi Settings
                  </button>

                  <button
                    onClick={() => {
                      setNewPppoeUser(selectedDevice.pppoeUsername || '');
                      setIsWanModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-all"
                  >
                    <Globe className="w-3.5 h-3.5 text-amber-400" />
                    Push WAN PPPoE
                  </button>
                </div>

                <button
                  onClick={() => handleRebootDevice(selectedDevice)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-teal-950/40 transition-all"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Remote Reboot ONT (TR-069 Connection Request)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* WiFi Push Modal */}
      {isWifiModalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm border-b border-slate-800 pb-3 mb-4">
              <Wifi className="w-4 h-4 text-cyan-400" />
              Push WiFi Configuration OTA (TR-069)
            </h3>
            <form onSubmit={handlePushWifi} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">SSID Name (2.4G & 5G)</label>
                <input
                  type="text"
                  required
                  value={newSsid}
                  onChange={(e) => setNewSsid(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">New WPA2/WPA3 Pre-Shared Key</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep unchanged"
                  value={newWifiPassword}
                  onChange={(e) => setNewWifiPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsWifiModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl"
                >
                  Push to Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WAN PPPoE Push Modal */}
      {isWanModalOpen && selectedDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm border-b border-slate-800 pb-3 mb-4">
              <Globe className="w-4 h-4 text-amber-400" />
              Reconfigure WAN PPPoE Credentials
            </h3>
            <form onSubmit={handlePushWan} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">PPPoE Username</label>
                <input
                  type="text"
                  required
                  value={newPppoeUser}
                  onChange={(e) => setNewPppoeUser(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">PPPoE Password</label>
                <input
                  type="password"
                  placeholder="New PPPoE password"
                  value={newPppoePass}
                  onChange={(e) => setNewPppoePass(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsWanModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl"
                >
                  Push WAN Parameters
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

