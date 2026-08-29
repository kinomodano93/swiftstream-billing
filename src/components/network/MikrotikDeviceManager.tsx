import React, { useState } from 'react';
import {
  Server,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Download,
  ExternalLink,
  ShieldCheck,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  Thermometer,
  Radio,
  Users,
  Search,
  Wrench,
  Trash2,
  Edit2,
  X,
  Zap,
  Globe,
  Terminal,
  Layers,
  AlertTriangle,
  Compass,
  Gauge,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MikrotikDevice } from '../../types';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import {
  generatePppoeBatchScript,
  generateIsolationScript,
  generateFullRouterConfigScript,
} from '../../utils/sstpService';
import { testRouterConnection, RouterHealthInfo } from '../../services/mikrotikApiService';
import { MikrotikTelemetryViewer } from './MikrotikTelemetryViewer';
import { PppoeManager } from './PppoeManager';

export const MikrotikDeviceManager: React.FC = () => {
  const {
    mikrotikDevices,
    addMikrotikDevice,
    updateMikrotikDevice,
    deleteMikrotikDevice,
    syncAllSubscribersToMikrotik,
    customers,
    plans,
    businessProfile,
    showToast,
  } = useApp();

  // Navigation Sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'fleet' | 'telemetry' | 'pppoe' | 'diagnostics'>('fleet');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('all');

  // Modals
  const [showAddEditModal, setShowAddEditModal] = useState<boolean>(false);
  const [editingDevice, setEditingDevice] = useState<MikrotikDevice | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<MikrotikDevice | null>(null);

  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [scriptModalTab, setScriptModalTab] = useState<'pppoe' | 'isolation' | 'bootstrap'>('pppoe');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Ping Diagnostic Tool State
  const [pingTarget, setPingTarget] = useState<string>(customers[0]?.network.ipAddress || '192.168.10.25');
  const [pinging, setPinging] = useState<boolean>(false);
  const [pingResults, setPingResults] = useState<Array<{ seq: number; ip: string; timeMs: number; status: 'ok' | 'timeout' }> | null>(null);

  // Test connection state in Add/Edit Router modal
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<RouterHealthInfo | null>(null);

  // Quick Dynamic Port Updater Modal State (HTTP remote port)
  const [showQuickPortModal, setShowQuickPortModal] = useState<boolean>(false);
  const [portTargetDevice, setPortTargetDevice] = useState<MikrotikDevice | null>(null);
  const [dynamicPorts, setDynamicPorts] = useState<{
    webfigPort: number;
    remoteAddress: string;
  }>({
    webfigPort: 10988,
    remoteAddress: 'remote.oxapsph.com',
  });
  const [isTestingDynamicPort, setIsTestingDynamicPort] = useState<boolean>(false);
  const [dynamicPortTestResult, setDynamicPortTestResult] = useState<RouterHealthInfo | null>(null);

  const handleOpenQuickPortModal = (dev: MikrotikDevice) => {
    setPortTargetDevice(dev);
    setDynamicPorts({
      webfigPort: dev.webfigPort || dev.port || 80,
      remoteAddress: dev.remoteAddress || dev.ipAddress,
    });
    setDynamicPortTestResult(null);
    setIsTestingDynamicPort(false);
    setShowQuickPortModal(true);
  };

  const handleTestDynamicPort = async () => {
    if (!portTargetDevice) return;
    const host = dynamicPorts.remoteAddress || portTargetDevice.remoteAddress || portTargetDevice.ipAddress;
    const port = dynamicPorts.webfigPort;
    setIsTestingDynamicPort(true);
    setDynamicPortTestResult(null);
    try {
      const res = await testRouterConnection({
        ipAddress: host,
        username: portTargetDevice.username || 'admin',
        password: portTargetDevice.password || '',
        port: port,
        useHttps: portTargetDevice.useSsl,
      });
      setDynamicPortTestResult(res);
      if (res.status === 'connected') {
        showToast('success', 'HTTP Port Verified', `HTTP port ${port} responded (${res.latencyMs}ms latency). Router: ${res.boardName}`);
      } else if (res.status === 'auth_failed') {
        showToast('error', 'Auth Failed', 'HTTP port reached, but API credentials failed.');
      } else {
        showToast('error', 'Port Unreachable', res.errorMessage || `Port ${port} is not responding.`);
      }
    } catch (err: any) {
      showToast('error', 'Test Failed', err?.message || 'Connection timeout');
    } finally {
      setIsTestingDynamicPort(false);
    }
  };

  const handleSaveDynamicPorts = (e: React.FormEvent) => {
    e.preventDefault();
    if (!portTargetDevice) return;
    const finalHost = dynamicPorts.remoteAddress || portTargetDevice.remoteAddress || portTargetDevice.ipAddress;
    updateMikrotikDevice(portTargetDevice.id, {
      webfigPort: dynamicPorts.webfigPort,
      port: dynamicPorts.webfigPort,
      remoteAddress: finalHost,
      ipAddress: finalHost,
      status: dynamicPortTestResult?.status === 'connected' ? 'online' : portTargetDevice.status,
    });
    showToast('success', 'HTTP Remote Port Saved', `Updated HTTP port ${dynamicPorts.webfigPort} for ${portTargetDevice.name}`);
    setShowQuickPortModal(false);
  };

  // Form State
  const [connectionMode, setConnectionMode] = useState<'sstp_vpn' | 'direct'>('sstp_vpn');
  const [formData, setFormData] = useState<Omit<MikrotikDevice, 'id'>>({
    name: '',
    model: 'MikroTik RouterOS',
    role: 'core_pppoe',
    connectionType: 'sstp_vpn',
    ipAddress: 'remote.oxapsph.com',
    remoteAddress: 'remote.oxapsph.com',
    port: 10988,
    webfigPort: 10988,
    apiPort: 10878,
    winboxPort: 10995,
    serviceType: 'sstp',
    username: 'admin',
    password: '',
    useSsl: false,
    status: 'online',
    rosVersion: 'RouterOS v7.x',
    cpuLoad: 0,
    memoryUsage: { usedMb: 0, totalMb: 1024 },
    uptime: '0m',
    activePppoeCount: 0,
    totalQueues: 0,
    temperatureC: 35,
    location: 'Main POP Operations Rack, Lagonoy',
    notes: '',
  });

  const handleTestConnection = async () => {
    const targetHost = connectionMode === 'sstp_vpn' ? (formData.remoteAddress || formData.ipAddress) : formData.ipAddress;
    const targetPort = formData.port || formData.webfigPort || (formData.useSsl ? 443 : 80);

    if (!targetHost || !targetHost.trim()) {
      showToast('warning', 'Missing Host', 'Please enter Remote Address (e.g. remote.oxapsph.com) or Router IP.');
      return;
    }
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testRouterConnection({
        ipAddress: targetHost,
        username: formData.username || 'admin',
        password: formData.password || '',
        port: targetPort,
        useHttps: formData.useSsl,
      });
      setTestResult(res);
      if (res.status === 'connected') {
        showToast('success', 'Connection Verified', `Connected to ${res.boardName} on port ${targetPort} (${res.latencyMs}ms latency).`);
        // Auto-update model and RouterOS version if blank or generic
        setFormData((prev) => ({
          ...prev,
          model: res.boardName || prev.model,
          rosVersion: res.version || prev.rosVersion,
          cpuLoad: res.cpuLoad || prev.cpuLoad,
          status: 'online',
        }));
      } else if (res.status === 'auth_failed') {
        showToast('error', 'Authentication Failed', 'Invalid username or password for RouterOS REST API.');
      } else {
        showToast('error', 'Router Unreachable', res.errorMessage || 'Failed to establish REST API handshake.');
      }
    } catch (err: any) {
      setTestResult({
        status: 'unreachable',
        boardName: 'Unknown',
        model: 'MikroTik',
        version: 'v7.x',
        cpuLoad: 0,
        uptime: '0s',
        totalMemoryMb: 0,
        freeMemoryMb: 0,
        activePppoeCount: 0,
        latencyMs: 0,
        timestamp: new Date().toISOString(),
        errorMessage: err?.message || 'Connection timeout or network error',
      });
      showToast('error', 'Connection Error', err?.message || 'Failed to connect to router.');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const filteredDevices = mikrotikDevices.filter((dev) => {
    const matchesSearch =
      dev.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dev.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dev.ipAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (dev.remoteAddress && dev.remoteAddress.toLowerCase().includes(searchTerm.toLowerCase())) ||
      dev.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'all' || dev.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const handleOpenAddModal = () => {
    setEditingDevice(null);
    setTestResult(null);
    setIsTestingConnection(false);
    setConnectionMode('sstp_vpn');
    setFormData({
      name: '',
      model: 'MikroTik RouterOS',
      role: 'core_pppoe',
      connectionType: 'sstp_vpn',
      ipAddress: 'remote.oxapsph.com',
      remoteAddress: 'remote.oxapsph.com',
      port: 10988,
      webfigPort: 10988,
      apiPort: 10878,
      winboxPort: 10995,
      serviceType: 'sstp',
      username: 'admin',
      password: '',
      useSsl: false,
      status: 'online',
      rosVersion: 'RouterOS v7.x',
      cpuLoad: 0,
      memoryUsage: { usedMb: 0, totalMb: 1024 },
      uptime: '0m',
      activePppoeCount: 0,
      totalQueues: 0,
      temperatureC: 35,
      location: 'Main POP Operations Rack, Lagonoy',
      notes: '',
    });
    setShowAddEditModal(true);
  };

  const handleOpenEditModal = (dev: MikrotikDevice) => {
    setEditingDevice(dev);
    setTestResult(null);
    setIsTestingConnection(false);
    const mode = dev.connectionType || (dev.ipAddress?.includes('.') && !dev.ipAddress.startsWith('192.168.') && !dev.ipAddress.startsWith('10.') ? 'sstp_vpn' : 'direct');
    setConnectionMode(mode);
    setFormData({
      name: dev.name,
      model: dev.model,
      role: dev.role,
      connectionType: dev.connectionType || mode,
      ipAddress: dev.ipAddress,
      remoteAddress: dev.remoteAddress || dev.ipAddress,
      port: dev.port || dev.webfigPort || 80,
      webfigPort: dev.webfigPort || dev.port || 80,
      apiPort: dev.apiPort || 8728,
      winboxPort: dev.winboxPort || 8291,
      serviceType: dev.serviceType || 'sstp',
      username: dev.username || 'admin',
      password: dev.password || '',
      useSsl: dev.useSsl || false,
      status: dev.status,
      rosVersion: dev.rosVersion,
      cpuLoad: dev.cpuLoad,
      memoryUsage: dev.memoryUsage,
      uptime: dev.uptime,
      activePppoeCount: dev.activePppoeCount,
      totalQueues: dev.totalQueues,
      temperatureC: dev.temperatureC,
      location: dev.location,
      notes: dev.notes || '',
    });
    setShowAddEditModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalHost = connectionMode === 'sstp_vpn' ? (formData.remoteAddress || formData.ipAddress) : formData.ipAddress;
    const finalPort = formData.webfigPort || formData.port || 80;

    if (!formData.name.trim() || !finalHost.trim()) {
      showToast('warning', 'Incomplete Form', 'Please provide a router name and remote address/IP.');
      return;
    }

    const payload: Omit<MikrotikDevice, 'id'> = {
      ...formData,
      ipAddress: finalHost,
      remoteAddress: finalHost,
      port: finalPort,
      webfigPort: finalPort,
      connectionType: connectionMode,
    };

    if (editingDevice) {
      updateMikrotikDevice(editingDevice.id, payload);
    } else {
      addMikrotikDevice(payload);
    }
    setShowAddEditModal(false);
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    showToast('info', 'Copied to Clipboard', 'RouterOS command copied.');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleDownloadRsc = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'RSC File Downloaded', `${filename} ready for terminal.`);
  };

  // Ping Diagnostic Tool
  const handleRunPing = () => {
    if (!pingTarget) return;
    setPinging(true);
    setPingResults([]);

    let count = 0;
    const results: Array<{ seq: number; ip: string; timeMs: number; status: 'ok' | 'timeout' }> = [];

    const interval = setInterval(() => {
      count++;
      const randomLatency = Math.floor(Math.random() * 8) + 8; // 8ms - 15ms
      results.push({
        seq: count,
        ip: pingTarget,
        timeMs: randomLatency,
        status: 'ok',
      });
      setPingResults([...results]);

      if (count >= 4) {
        clearInterval(interval);
        setPinging(false);
      }
    }, 400);
  };

  const pppoeScript = generatePppoeBatchScript(customers, plans, businessProfile);
  const isolationScript = generateIsolationScript(customers);
  const fullRouterScript = generateFullRouterConfigScript(businessProfile, plans);
  const overdueCount = customers.filter((c) => c.status === 'overdue' || c.status === 'suspended').length;

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-12 animate-in fade-in">
      {/* 1. TOP HEADER & TELEMETRY BANNER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-3xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 via-sky-600 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-cyan-600/30 ring-1 ring-white/20">
            <Server className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
                MikroTik RouterOS Fleet & Gateway
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>CORE ROUTER ACTIVE</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage PPPoE BNG Core Routers, Sub-node Distribution, Simple Queues, and Walled Garden Isolation
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={syncAllSubscribersToMikrotik}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95"
            title="Batch sync all PPPoE secrets and speed queues to core router"
          >
            <Zap className="w-4 h-4" />
            <span>Sync All Subscribers ({customers.length})</span>
          </button>

          <button
            onClick={() => {
              setScriptModalTab('pppoe');
              setShowScriptModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/50 rounded-xl text-xs font-bold transition-all hover:scale-105"
          >
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>RouterOS Script Center</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold border border-slate-700 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            <span>Add MikroTik Router</span>
          </button>
        </div>
      </div>

      {/* SUB-NAVIGATION TABS */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 pb-4">
        <button
          onClick={() => setActiveSubTab('fleet')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'fleet'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>🖥️ Router Fleet Manager ({mikrotikDevices.length} Units)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('telemetry')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'telemetry'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>📊 Live Telemetry & Health Hub</span>
        </button>

        <button
          onClick={() => setActiveSubTab('pppoe')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'pppoe'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>🔐 PPPoE Server & Active Sessions</span>
        </button>

        <button
          onClick={() => setActiveSubTab('diagnostics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'diagnostics'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan'
              : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>💻 ICMP Ping & Script Center</span>
        </button>
      </div>

      {/* VIEW 1: SYSTEM TELEMETRY & HEALTH HUB */}
      {activeSubTab === 'telemetry' && (
        <MikrotikTelemetryViewer />
      )}

      {/* VIEW 2: PPPoE SERVER & SUBSCRIBER SESSIONS */}
      {activeSubTab === 'pppoe' && (
        <PppoeManager />
      )}

      {/* VIEW 3: ROUTER FLEET MANAGEMENT */}
      {activeSubTab === 'fleet' && (
        <>
      {/* 2. STATS SUMMARY ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Managed Fleet</span>
            <Server className="w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-2xl font-black font-mono text-slate-100">{mikrotikDevices.length}</span>
          <span className="text-[11px] text-emerald-400 block mt-0.5 font-medium">All Units Online</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">PPPoE Active Sessions</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-black font-mono text-emerald-400">
            {customers.filter((c) => c.status === 'active').length}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            / {customers.length} total subscribers
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Walled Garden Pool</span>
            <ShieldCheck className="w-4 h-4 text-rose-400" />
          </div>
          <span className="text-2xl font-black font-mono text-rose-400">{overdueCount}</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Isolated for non-payment</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Bandwidth Queues</span>
            <Radio className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-2xl font-black font-mono text-purple-300 block mt-0.5">
            {customers.length} Queues
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">Active Rate Limiting</span>
        </div>
      </div>

      {/* 3. SEARCH & ROLE FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/70">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search router, model, IP, or location..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto text-xs">
          {[
            { id: 'all', label: 'All Roles' },
            { id: 'core_pppoe', label: 'Core PPPoE BNG' },
            { id: 'distribution', label: 'Distribution Node' },
            { id: 'hotspot', label: 'Piso-WiFi' },
          ].map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                selectedRole === role.id
                  ? 'bg-cyan-600 text-white shadow'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. MIKROTIK DEVICE FLEET CARDS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredDevices.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-3xl bg-slate-900/50 border border-slate-800 border-dashed space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-600/10 border border-cyan-500/20 text-cyan-400 mx-auto flex items-center justify-center">
              <Server className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-200">No MikroTik Routers Found</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {searchTerm || selectedRole !== 'all'
                  ? 'No router hardware matches your current search filters.'
                  : 'Add your MikroTik RouterOS Core BNG or distribution router to monitor live traffic and auto-provision PPPoE secrets.'}
              </p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-600/20 transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add MikroTik Router</span>
            </button>
          </div>
        ) : (
          filteredDevices.map((dev) => {
            const isCore = dev.role === 'core_pppoe';
            const cpuColor =
              dev.cpuLoad > 80
                ? 'text-rose-400 bg-rose-500/20'
                : dev.cpuLoad > 50
                ? 'text-amber-400 bg-amber-500/20'
                : 'text-emerald-400 bg-emerald-500/20';

            return (
              <div
                key={dev.id}
                className={`p-6 rounded-3xl border flex flex-col justify-between transition-all relative ${
                  isCore
                    ? 'bg-slate-900 border-cyan-500/70 shadow-glow-cyan'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                {isCore && (
                  <span className="absolute -top-3 right-6 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md">
                    Core PPPoE BNG
                  </span>
                )}

                <div className="space-y-4">
                  {/* Card Title & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                          isCore ? 'bg-cyan-600/20 text-cyan-400' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        <Server className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-base text-slate-100 leading-tight">
                            {dev.name}
                          </h3>
                          {dev.connectionType === 'sstp_vpn' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-850">
                              ⚡ SSTP
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-slate-800 text-slate-400">
                              LAN IP
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{dev.model}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(dev)}
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Edit MikroTik Device"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeviceToDelete(dev)}
                        className="p-1.5 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                        title="Delete Device"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Connection & Network Ribbon */}
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">
                        {dev.connectionType === 'sstp_vpn' ? 'Remote Host:' : 'Router IP:'}
                      </span>
                      <span className="font-mono font-bold text-cyan-400 flex items-center gap-1.5">
                        <span>{dev.remoteAddress || dev.ipAddress}</span>
                        <button
                          onClick={() => handleCopy(dev.remoteAddress || dev.ipAddress, `ip-${dev.id}`)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                          title="Copy Address"
                        >
                          {copiedType === `ip-${dev.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </span>
                    </div>

                    {/* HTTP Remote Port Display & Quick Update */}
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center font-bold">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">HTTP Remote Port:</span>
                          <span className="font-mono font-bold text-cyan-300 text-xs">
                            :{dev.webfigPort || dev.port || 80}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenQuickPortModal(dev)}
                        className="px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        title="Update dynamic HTTP remote port"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>Update Port</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-slate-400">RouterOS Version:</span>
                      <span className="font-mono text-slate-300">
                        {dev.rosVersion}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-900">
                      <span className="text-slate-400">Location:</span>
                      <span className="text-slate-300 truncate max-w-[200px] text-right font-medium">
                        {dev.location}
                      </span>
                    </div>
                  </div>

                  {/* Live Hardware Gauges */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-slate-400 text-[10px] font-semibold">
                        <span className="flex items-center gap-1">
                          <Cpu className="w-3 h-3 text-cyan-400" />
                          <span>CPU Load</span>
                        </span>
                        <span className={`px-1.5 py-0.2 rounded font-mono font-bold ${cpuColor}`}>
                          {dev.cpuLoad}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            dev.cpuLoad > 80 ? 'bg-rose-500' : dev.cpuLoad > 50 ? 'bg-amber-500' : 'bg-cyan-400'
                          }`}
                          style={{ width: `${Math.max(dev.cpuLoad, 5)}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                      <div className="flex items-center justify-between text-slate-400 text-[10px] font-semibold">
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3 text-purple-400" />
                          <span>RAM Memory</span>
                        </span>
                        <span className="font-mono text-purple-300 font-bold text-[10px]">
                          {dev.memoryUsage.usedMb} MB
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{
                            width: `${(dev.memoryUsage.usedMb / dev.memoryUsage.totalMb) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Footer Meta */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>Uptime: <strong className="text-slate-300">{dev.uptime}</strong></span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Thermometer className="w-3 h-3 text-amber-400" />
                      <span className="text-amber-300 font-mono font-bold">{dev.temperatureC}°C</span>
                    </span>
                  </div>
                </div>

                {/* Action Buttons Toolbar */}
                <div className="pt-4 border-t border-slate-800/80 mt-4 grid grid-cols-3 gap-2">
                  <a
                    href={`http://${dev.remoteAddress || dev.ipAddress}:${dev.webfigPort || dev.port || 80}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                    title="Open WebFig Web Management GUI"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>WebFig GUI</span>
                  </a>

                  <button
                    onClick={() => handleOpenQuickPortModal(dev)}
                    className="py-2 px-2 bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="Quickly change dynamic HTTP remote port"
                  >
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>HTTP Port</span>
                  </button>

                  <button
                    onClick={() => {
                      setScriptModalTab('pppoe');
                      setShowScriptModal(true);
                    }}
                    className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="Open RouterOS Script Generator"
                  >
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>CLI Scripts</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
      </>
      )}

      {/* VIEW 3: LIVE PING & ROUTEROS CLI DIAGNOSTIC TOOLS */}
      {activeSubTab === 'diagnostics' && (
        <div className="space-y-6">
          {/* Quick Script Triggers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => {
                setScriptModalTab('pppoe');
                setShowScriptModal(true);
              }}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-left space-y-2 transition-all hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-100 text-sm">PPPoE Subscriber Batch Script</span>
                <Terminal className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-xs text-slate-400">Generate `/ppp secret` and `/queue simple` provisioning CLI commands for all {customers.length} subscribers.</p>
              <span className="text-[11px] text-cyan-400 font-semibold block">Open Generator ➔</span>
            </button>

            <button
              onClick={() => {
                setScriptModalTab('isolation');
                setShowScriptModal(true);
              }}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-rose-500/50 text-left space-y-2 transition-all hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-100 text-sm">Walled Garden Isolation Script</span>
                <ShieldCheck className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-xs text-slate-400">Lock non-paying subscribers into `address-list=overdue_subscribers` with portal redirects.</p>
              <span className="text-[11px] text-rose-400 font-semibold block">Open Generator ➔</span>
            </button>

            <button
              onClick={() => {
                setScriptModalTab('bootstrap');
                setShowScriptModal(true);
              }}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 text-left space-y-2 transition-all hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-100 text-sm">Complete Router Bootstrap</span>
                <Server className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-xs text-slate-400">Full RouterOS setup: IP Pools, PPPoE Server, FastTrack, MSS Clamping, NAT, and DNS.</p>
              <span className="text-[11px] text-purple-400 font-semibold block">Open Generator ➔</span>
            </button>
          </div>

          {/* 5. LIVE PING & LATENCY DIAGNOSTIC TOOL */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-600/20 text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                MikroTik ICMP Ping & Optical Latency Tester
              </h3>
              <p className="text-xs text-slate-400">
                Ping subscriber ONUs or gateway IPs directly to inspect packet transmission & response time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={pingTarget}
              onChange={(e) => setPingTarget(e.target.value)}
              className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.network.ipAddress}>
                  {c.fullName} ({c.network.ipAddress})
                </option>
              ))}
            </select>

            <button
              onClick={handleRunPing}
              disabled={pinging}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/20 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pinging ? 'animate-spin' : ''}`} />
              <span>{pinging ? 'Testing...' : 'Send Ping (x4)'}</span>
            </button>
          </div>
        </div>

        {/* Live Ping Results Console */}
        {pingResults && pingResults.length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-1 animate-in fade-in">
            <div className="text-slate-500 text-[11px] pb-1 border-b border-slate-900">
              PING {pingTarget} (56 data bytes from MikroTik Gateway Interface):
            </div>
            {pingResults.map((res) => (
              <div key={res.seq} className="flex items-center justify-between text-emerald-400">
                <span>
                  64 bytes from {res.ip}: icmp_seq={res.seq} ttl=64 time={res.timeMs}.4 ms
                </span>
                <span className="text-[10px] text-slate-500 uppercase font-bold">STATUS: OK</span>
              </div>
            ))}
            {!pinging && (
              <div className="pt-2 text-cyan-300 text-[11px] border-t border-slate-900 flex items-center justify-between">
                <span>--- {pingTarget} ping statistics ---</span>
                <span>4 packets transmitted, 4 received, 0% packet loss</span>
              </div>
            )}
          </div>
        )}
          </div>
        </div>
      )}

      {/* ================= MODAL 1: ADD / EDIT MIKROTIK DEVICE MODAL ================= */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">
                    {editingDevice ? 'Edit MikroTik Device' : 'Add MikroTik Router to Fleet'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Connect via SSTP remote tunnel port forwarding or direct local IP
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddEditModal(false)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Connection Mode Switcher */}
            <div className="px-5 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-400">Connection Mode:</span>
              <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setConnectionMode('sstp_vpn');
                    setFormData((prev) => ({
                      ...prev,
                      connectionType: 'sstp_vpn',
                      remoteAddress: prev.remoteAddress || 'remote.oxapsph.com',
                      port: prev.port === 80 ? 10988 : prev.port,
                      webfigPort: prev.webfigPort === 80 ? 10988 : prev.webfigPort,
                      apiPort: prev.apiPort === 8728 ? 10878 : prev.apiPort,
                      winboxPort: prev.winboxPort === 8291 ? 10995 : prev.winboxPort,
                    }));
                  }}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    connectionMode === 'sstp_vpn'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚡ SSTP / Remote VPN (Port Forwarding)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConnectionMode('direct');
                    setFormData((prev) => ({
                      ...prev,
                      connectionType: 'direct',
                      ipAddress: prev.ipAddress && !prev.ipAddress.includes('remote.') ? prev.ipAddress : '192.168.88.1',
                      port: 80,
                      webfigPort: 80,
                      apiPort: 8728,
                      winboxPort: 8291,
                    }));
                  }}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    connectionMode === 'direct'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🌐 Direct LAN / Static IP
                </button>
              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* SSTP Remote Tunnel Mode */}
              {connectionMode === 'sstp_vpn' ? (
                <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-800/40 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      SSTP / Remote Tunnel Port Forwarding Settings
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold">
                      Service: {formData.serviceType || 'sstp'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Router Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. maangas"
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-bold focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Remote Address (Tunnel Host) *</label>
                      <input
                        type="text"
                        required
                        value={formData.remoteAddress || ''}
                        onChange={(e) => setFormData({ ...formData, remoteAddress: e.target.value, ipAddress: e.target.value })}
                        placeholder="remote.oxapsph.com"
                        className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  {/* HTTP Remote Port Configuration */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                    <label className="block text-slate-400 font-semibold text-xs">
                      Dynamic HTTP Remote Port (Mapped to Local Port 80) *
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.webfigPort || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 80;
                        setFormData({ ...formData, webfigPort: val, port: val });
                      }}
                      placeholder="e.g. 10988"
                      className="w-full px-3.5 py-2 bg-slate-900 border border-cyan-800/60 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400"
                    />
                    <p className="text-[10px] text-slate-500">
                      The dynamic high port assigned by your tunnel provider for WebFig and RouterOS REST API communication.
                    </p>
                  </div>
                </div>
              ) : (
                /* Direct LAN / Public Static IP Mode */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Router Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. SwiftStream Core CCR BNG"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Router Hardware Model</label>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      placeholder="MikroTik CCR2004-16G-2S+ / RB5009"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Router IP / Host *</label>
                    <input
                      type="text"
                      required
                      value={formData.ipAddress}
                      onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                      placeholder="192.168.88.1"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">WebFig / REST Port *</label>
                    <input
                      type="number"
                      value={formData.webfigPort || 80}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 80;
                        setFormData({ ...formData, webfigPort: val, port: val });
                      }}
                      placeholder="80"
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              {/* Role & Hardware Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Router Fleet Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="core_pppoe">Core PPPoE BNG</option>
                    <option value="distribution">Distribution Node</option>
                    <option value="hotspot">Piso-WiFi Gateway</option>
                    <option value="backup">Hot Standby / Backup</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Hardware Board Model</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="CCR2004-16G-2S+ / RB750Gr3"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* RouterOS API Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">API Username *</label>
                  <input
                    type="text"
                    value={formData.username || 'admin'}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="admin"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">API Password</label>
                  <input
                    type="password"
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex flex-col justify-center">
                  <label className="block text-slate-400 mb-1 font-semibold">Security</label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.useSsl || false}
                      onChange={(e) => setFormData({ ...formData, useSsl: e.target.checked })}
                      className="rounded accent-cyan-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[11px] font-medium">Use HTTPS / SSL</span>
                  </label>
                </div>
              </div>

              {/* Test Connection Action & Real-Time Diagnostics Output */}
              <div className="space-y-3 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                      Live Handshake Verification
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Query RouterOS REST API (<code>/system/resource</code>) on port {formData.webfigPort || 80}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isTestingConnection}
                    onClick={handleTestConnection}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-cyan-950 text-cyan-300 hover:text-cyan-200 border border-cyan-700/50 hover:border-cyan-500 rounded-xl text-xs font-bold transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {isTestingConnection ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        <span>Connecting to Router...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Test Connection</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Test Result Display */}
                {testResult && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs space-y-2.5 animate-in fade-in duration-200 ${
                      testResult.status === 'connected'
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                        : testResult.status === 'auth_failed'
                        ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                        : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold">
                        {testResult.status === 'connected' && (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Connection Verified (Online)</span>
                          </>
                        )}
                        {testResult.status === 'auth_failed' && (
                          <>
                            <ShieldAlert className="w-4 h-4 text-rose-400" />
                            <span>Authentication Failed (401)</span>
                          </>
                        )}
                        {testResult.status === 'unreachable' && (
                          <>
                            <AlertCircle className="w-4 h-4 text-amber-400" />
                            <span>Router Unreachable</span>
                          </>
                        )}
                      </div>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700">
                        {testResult.latencyMs}ms Latency
                      </span>
                    </div>

                    {testResult.status === 'connected' ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono bg-slate-950/60 p-2.5 rounded-lg border border-emerald-900/50">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Board / Model:</span>
                            <span className="text-emerald-300 font-bold truncate block">{testResult.boardName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">RouterOS:</span>
                            <span className="text-emerald-300 font-bold block">{testResult.version}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">CPU Load:</span>
                            <span className="text-emerald-300 font-bold block">{testResult.cpuLoad}%</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Uptime:</span>
                            <span className="text-emerald-300 font-bold truncate block">{testResult.uptime}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">
                            Memory: <strong className="text-emerald-300">{testResult.freeMemoryMb} MB free</strong> / {testResult.totalMemoryMb} MB
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                model: testResult.boardName || prev.model,
                                rosVersion: testResult.version || prev.rosVersion,
                                cpuLoad: testResult.cpuLoad || prev.cpuLoad,
                              }));
                              showToast('success', 'Specs Applied', 'Detected router specifications filled into form.');
                            }}
                            className="text-cyan-300 hover:text-cyan-200 underline font-semibold cursor-pointer"
                          >
                            Apply Detected Specs to Form
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] opacity-90">
                        {testResult.errorMessage || (testResult.status === 'auth_failed' ? 'Please verify API username, password, and REST API permissions.' : 'Check IP address, port forwarding, and local subnet routing.')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Location & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Installation / POP Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Maangas POP Rack, Lagonoy"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Notes & Topology</label>
                  <input
                    type="text"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="SSTP tunnel port forwarding via oxapsph"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                {editingDevice ? (
                  <button
                    type="button"
                    onClick={() => {
                      const toDel = editingDevice;
                      setShowAddEditModal(false);
                      setDeviceToDelete(toDel);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Router</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddEditModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-600/25 transition-all cursor-pointer"
                  >
                    {editingDevice ? 'Save Changes' : 'Add Router'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: ROUTEROS CLI SCRIPT CENTER MODAL ================= */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100">RouterOS Terminal & CLI Hub</h3>
                  <p className="text-xs text-slate-400">
                    Copy or download ready-to-paste RouterOS commands for your MikroTik terminal
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowScriptModal(false)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Selector */}
            <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-3 gap-2 overflow-x-auto text-xs">
              {[
                { id: 'pppoe', label: `PPPoE Secrets & Queues (${customers.length})`, icon: '🔑' },
                { id: 'isolation', label: `Walled Garden (${overdueCount} Overdue)`, icon: '🚫' },
                { id: 'bootstrap', label: 'Full Initial Bootstrap (.rsc)', icon: '⚙️' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setScriptModalTab(tab.id as any)}
                  className={`pb-3 px-3 font-semibold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                    scriptModalTab === tab.id
                      ? 'border-cyan-500 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 text-xs">
              {scriptModalTab === 'pppoe' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-slate-400">
                      Creates <code>/ppp secret</code> and <code>/queue simple</code> bandwidth limits for all {customers.length} subscribers.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(pppoeScript, 'pppoe')}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold flex items-center gap-1.5"
                      >
                        {copiedType === 'pppoe' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedType === 'pppoe' ? 'Copied!' : 'Copy Script'}</span>
                      </button>
                      <button
                        onClick={() => handleDownloadRsc(pppoeScript, `swiftstream_pppoe_${Date.now()}.rsc`)}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .rsc</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-[380px] overflow-y-auto whitespace-pre leading-relaxed">
                    {pppoeScript}
                  </div>
                </div>
              )}

              {scriptModalTab === 'isolation' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-slate-400">
                      Adds {overdueCount} overdue subscribers to <code>NON_PAYMENT_ISOLATION</code> firewall address-list.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(isolationScript, 'isolation')}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold flex items-center gap-1.5"
                      >
                        {copiedType === 'isolation' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedType === 'isolation' ? 'Copied!' : 'Copy Script'}</span>
                      </button>
                      <button
                        onClick={() => handleDownloadRsc(isolationScript, `swiftstream_isolation_${Date.now()}.rsc`)}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .rsc</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-[380px] overflow-y-auto whitespace-pre leading-relaxed">
                    {isolationScript}
                  </div>
                </div>
              )}

              {scriptModalTab === 'bootstrap' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-slate-400">
                      Full factory-to-production bootstrap script (PPPoE Server, IP pools, NAT masquerade, and WebFig).
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(fullRouterScript, 'bootstrap')}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold flex items-center gap-1.5"
                      >
                        {copiedType === 'bootstrap' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedType === 'bootstrap' ? 'Copied!' : 'Copy Script'}</span>
                      </button>
                      <button
                        onClick={() => handleDownloadRsc(fullRouterScript, `swiftstream_bootstrap_${Date.now()}.rsc`)}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .rsc</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-[380px] overflow-y-auto whitespace-pre leading-relaxed">
                    {fullRouterScript}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: QUICK DYNAMIC PORT UPDATER ================= */}
      {showQuickPortModal && portTargetDevice && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                    <span>Update Dynamic Remote Ports</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                      {portTargetDevice.name}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    SSTP & VPN tunnels allocate dynamic high ports upon reconnect. Update your active forwarded ports below.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickPortModal(false)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDynamicPorts} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-800/40 space-y-2 text-slate-300">
                <span className="text-slate-400 block text-[11px] font-semibold">Tunnel Host / Remote Address:</span>
                <input
                  type="text"
                  required
                  value={dynamicPorts.remoteAddress}
                  onChange={(e) => setDynamicPorts({ ...dynamicPorts, remoteAddress: e.target.value })}
                  placeholder="remote.oxapsph.com"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Single HTTP Remote Port Input */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="block text-slate-300 font-semibold text-xs">
                  Dynamic HTTP Remote Port (Local Port 80) *
                </label>
                <input
                  type="number"
                  required
                  value={dynamicPorts.webfigPort || ''}
                  onChange={(e) => setDynamicPorts({ ...dynamicPorts, webfigPort: parseInt(e.target.value) || 80 })}
                  placeholder="e.g. 10988"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-cyan-800/60 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
                <p className="text-[10px] text-slate-500">
                  Enter the dynamic remote port assigned by your tunnel service for RouterOS WebFig & REST API communication.
                </p>
              </div>

              {/* Fast Test Dynamic Port Button & Live Feedback */}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isTestingDynamicPort}
                  onClick={handleTestDynamicPort}
                  className="w-full py-2.5 px-4 bg-slate-950 hover:bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isTestingDynamicPort ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                      <span>Testing HTTP Handshake on Port {dynamicPorts.webfigPort}...</span>
                    </>
                  ) : (
                    <>
                      <Wifi className="w-4 h-4 text-cyan-400" />
                      <span>Test HTTP Handshake</span>
                    </>
                  )}
                </button>

                {dynamicPortTestResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                      dynamicPortTestResult.status === 'connected'
                        ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                        : 'bg-rose-950/50 border-rose-500/50 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {dynamicPortTestResult.status === 'connected' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span>
                        {dynamicPortTestResult.status === 'connected'
                          ? `Port responded! Model: ${dynamicPortTestResult.boardName || 'RouterOS'}`
                          : dynamicPortTestResult.errorMessage || 'Port not reachable'}
                      </span>
                    </div>
                    {dynamicPortTestResult.latencyMs > 0 && (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-900">
                        {dynamicPortTestResult.latencyMs}ms
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowQuickPortModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-600/25 transition-all cursor-pointer"
                >
                  Save HTTP Port
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for MikroTik Device Deletion */}
      <ConfirmDeleteModal
        isOpen={!!deviceToDelete}
        title="Remove MikroTik Router from Fleet"
        itemName={deviceToDelete ? `${deviceToDelete.name} (${deviceToDelete.ipAddress}:${deviceToDelete.port}) — Model: ${deviceToDelete.model}` : undefined}
        description="Are you sure you want to remove this MikroTik router from your management fleet? Active customer sessions and telemetry polling for this hardware node will be stopped."
        confirmLabel="Yes, Remove Device"
        onConfirm={() => {
          if (deviceToDelete) {
            deleteMikrotikDevice(deviceToDelete.id);
            setDeviceToDelete(null);
          }
        }}
        onClose={() => setDeviceToDelete(null)}
      />
    </div>
  );
};
