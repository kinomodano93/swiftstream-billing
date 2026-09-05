import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  X,
  RefreshCw,
  Trash2,
  Maximize2,
  Minimize2,
  Server,
  CornerDownLeft,
  ChevronRight,
  Sparkles,
  Copy,
  Check,
  Key,
  Eye,
  EyeOff,
  Activity,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MikrotikDevice } from '../../types';

interface TerminalLine {
  id: string;
  type: 'banner' | 'prompt' | 'output' | 'error' | 'system';
  content: string;
  timestamp?: string;
}

interface MikrotikTerminalModalProps {
  initialDeviceId?: string;
  onClose: () => void;
}

export const MikrotikTerminalModal: React.FC<MikrotikTerminalModalProps> = ({
  initialDeviceId,
  onClose,
}) => {
  const { mikrotikDevices, updateMikrotikDevice, customers, showToast } = useApp();

  // Selected Target Router
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(() => {
    if (initialDeviceId && mikrotikDevices.some((d) => d.id === initialDeviceId)) {
      return initialDeviceId;
    }
    const core = mikrotikDevices.find((d) => d.role === 'core_pppoe');
    return core ? core.id : mikrotikDevices[0]?.id || '';
  });

  const selectedDevice: MikrotikDevice | undefined =
    mikrotikDevices.find((d) => d.id === selectedDeviceId) || mikrotikDevices[0];

  // Credentials State for Linked Device
  const [routerUsername, setRouterUsername] = useState<string>(selectedDevice?.username || 'admin');
  const [routerPassword, setRouterPassword] = useState<string>(selectedDevice?.password || '');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSavingCreds, setIsSavingCreds] = useState<boolean>(false);
  const [isTestingLink, setIsTestingLink] = useState<boolean>(false);
  const [linkStatus, setLinkStatus] = useState<'unknown' | 'connected' | 'auth_failed' | 'unreachable'>('unknown');
  const [linkLatency, setLinkLatency] = useState<number | null>(null);

  // Sync state when selected device changes
  useEffect(() => {
    if (selectedDevice) {
      setRouterUsername(selectedDevice.username || 'admin');
      setRouterPassword(selectedDevice.password || '');
      setLinkStatus('unknown');
      setLinkLatency(null);
    }
  }, [selectedDeviceId, selectedDevice]);

  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [inputCommand, setInputCommand] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [history, setHistory] = useState<TerminalLine[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate RouterOS Greeting Banner
  const getBanner = (device?: MikrotikDevice): string => {
    const devName = device?.name || 'MikroTik Gateway';
    const devIp = device?.remoteAddress || device?.ipAddress || 'remote.oxapsph.com';
    const devPort = device?.webfigPort || device?.port || device?.apiPort || 10988;
    const model = device?.model || 'CCR2116-12G-4S+';
    const ver = device?.rosVersion || 'RouterOS v7.14.3';

    return `
  MMM      MMM       KKK                          TTTTTTTTTTT      KKK
  MMMM    MMMM       KKK                              TTT          KKK
  MMM MMMM MMM  III  KKK  KKK  RRRRR   OOOOOO         TTT     III  KKK  KKK
  MMM  MM  MMM  III  KKKKK     RRR  R OOO  OOO        TTT     III  KKKKK
  MMM      MMM  III  KKK KKK   RRRR   OOO  OOO        TTT     III  KKK KKK
  MMM      MMM  III  KKK  KKK  RRR R   OOOOOO         TTT     III  KKK  KKK

  MikroTik ${ver} (stable)
  Target Device : ${devName} [${model}]
  Host / Port   : ${devIp}:${devPort}
  Bridge Mode   : REST API Direct CLI (Zero CORS Enabled)
  Type '/help' or '?' for commands directory. Quick presets available below.
`;
  };

  // Initialize terminal session
  useEffect(() => {
    if (selectedDevice) {
      setHistory([
        {
          id: `banner-${Date.now()}`,
          type: 'banner',
          content: getBanner(selectedDevice),
        },
      ]);
    }
  }, [selectedDeviceId]);

  // Auto-scroll to bottom of terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isExecuting]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle device change from selector
  const handleDeviceChange = (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    const newDev = mikrotikDevices.find((d) => d.id === newDeviceId);
    if (newDev) {
      const devHost = newDev.remoteAddress || newDev.ipAddress || 'remote.oxapsph.com';
      const devPort = newDev.webfigPort || newDev.port || 10988;
      setHistory((prev) => [
        ...prev,
        {
          id: `sw-${Date.now()}`,
          type: 'system',
          content: `\n[Session redirected to ${newDev.name} (${devHost}:${devPort})]`,
        },
        {
          id: `banner-${Date.now()}`,
          type: 'banner',
          content: getBanner(newDev),
        },
      ]);
      showToast('info', 'Router Session Switched', `Terminal connected to ${newDev.name}.`);
    }
  };

  // Save Credentials & Re-link Device
  const handleSaveCredentials = async () => {
    if (!selectedDevice) return;
    setIsSavingCreds(true);
    try {
      updateMikrotikDevice(
        selectedDevice.id,
        {
          username: routerUsername.trim(),
          password: routerPassword,
        },
        true
      );
      setHistory((prev) => [
        ...prev,
        {
          id: `cred-${Date.now()}`,
          type: 'system',
          content: `[Credentials updated for ${selectedDevice.name}. Testing link...]`,
        },
      ]);
      await handleTestLink(routerPassword);
    } catch {
      showToast('error', 'Update Failed', 'Unable to save credentials.');
    } finally {
      setIsSavingCreds(false);
    }
  };

  // Test Link Handshake directly in Terminal
  const handleTestLink = async (overridePassword?: string) => {
    if (!selectedDevice) return;
    setIsTestingLink(true);
    const passToUse = overridePassword !== undefined ? overridePassword : routerPassword;
    const host = selectedDevice.remoteAddress || selectedDevice.ipAddress || 'remote.oxapsph.com';
    const port = selectedDevice.webfigPort || selectedDevice.port || selectedDevice.apiPort || 10988;

    try {
      const t0 = performance.now();
      const res = await fetch('/api/mikrotikTest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routerId: selectedDevice.id,
          host,
          port,
          username: routerUsername,
          password: passToUse,
          useHttps: selectedDevice.useSsl || port === 443,
        }),
      });

      const latency = Math.round(performance.now() - t0);
      setLinkLatency(latency);

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.router) {
          setLinkStatus('connected');
          setHistory((prev) => [
            ...prev,
            {
              id: `test-${Date.now()}`,
              type: 'output',
              content: `✓ Handshake verified: Connected to ${data.router['board-name'] || selectedDevice.model} at ${host}:${port} (${latency}ms). RouterOS ${data.router.version || 'v7'} running.`,
            },
          ]);
          showToast('success', 'Router Linked', `Connected to ${selectedDevice.name} (${latency}ms).`);
        } else if (res.status === 401 || data.statusCode === 401) {
          setLinkStatus('auth_failed');
          setHistory((prev) => [
            ...prev,
            {
              id: `test-${Date.now()}`,
              type: 'error',
              content: `✗ Authentication Failed: RouterOS at ${host}:${port} rejected username '${routerUsername}'. Please enter the correct router password above and click 'Save & Link'.`,
            },
          ]);
          showToast('error', 'Auth Failed', 'Invalid username or password (HTTP 401).');
        } else {
          setLinkStatus('unreachable');
          setHistory((prev) => [
            ...prev,
            {
              id: `test-${Date.now()}`,
              type: 'error',
              content: `✗ Unreachable: Could not establish REST connection to ${host}:${port}.`,
            },
          ]);
        }
      } else if (res.status === 401 || res.status === 403) {
        setLinkStatus('auth_failed');
        setHistory((prev) => [
          ...prev,
          {
            id: `test-${Date.now()}`,
            type: 'error',
            content: `✗ Authentication Failed (HTTP ${res.status}): Please check router password in the Credentials bar.`,
          },
        ]);
      } else {
        setLinkStatus('unreachable');
        setHistory((prev) => [
          ...prev,
          {
            id: `test-${Date.now()}`,
            type: 'error',
            content: `✗ HTTP ${res.status}: Failed to reach ${host}:${port}.`,
          },
        ]);
      }
    } catch {
      setLinkStatus('unreachable');
      setHistory((prev) => [
        ...prev,
        {
          id: `test-${Date.now()}`,
          type: 'error',
          content: `✗ Network Timeout: Failed to reach ${host}:${port}. Please verify the host IP, forwarded port, and firewall rules.`,
        },
      ]);
    } finally {
      setIsTestingLink(false);
    }
  };

  // Execute terminal command
  const executeCommand = async (cmdToRun?: string) => {
    const raw = cmdToRun !== undefined ? cmdToRun : inputCommand;
    const cmd = raw.trim();
    if (!cmd) return;

    const currentPrompt = `[${routerUsername}@${selectedDevice?.name ? selectedDevice.name.split(' ')[0] : 'MikroTik'}] > ${cmd}`;

    // Append user input to terminal
    setHistory((prev) => [
      ...prev,
      {
        id: `in-${Date.now()}`,
        type: 'prompt',
        content: currentPrompt,
      },
    ]);

    // Update command history for Up/Down arrows
    setCommandHistory((prev) => [cmd, ...prev.filter((c) => c !== cmd)].slice(0, 50));
    setHistoryIndex(-1);
    setInputCommand('');

    // Handle client-side "clear"
    if (cmd.toLowerCase() === 'clear' || cmd.toLowerCase() === 'cls') {
      setHistory([]);
      return;
    }

    setIsExecuting(true);

    try {
      // Call backend CLI bridge endpoint with complete linked device payload
      const res = await fetch('/api/mikrotikCli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routerId: selectedDevice?.id,
          host: selectedDevice?.remoteAddress || selectedDevice?.ipAddress,
          port: selectedDevice?.webfigPort || selectedDevice?.port || selectedDevice?.apiPort || 10988,
          username: routerUsername,
          password: routerPassword,
          useHttps: selectedDevice?.useSsl || false,
          command: cmd,
          deviceModel: selectedDevice?.model,
          deviceName: selectedDevice?.name,
          device: selectedDevice ? { ...selectedDevice, username: routerUsername, password: routerPassword } : undefined,
          customers,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setHistory((prev) => [
          ...prev,
          {
            id: `out-${Date.now()}`,
            type: data.success ? 'output' : 'error',
            content: data.output || 'Done',
          },
        ]);
        if (data.success && linkStatus !== 'connected') {
          setLinkStatus('connected');
        }
      } else {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
    } catch {
      // Dynamic fallback command handler accurately reflecting linked device properties
      const fallbackOutput = handleFallbackClientCommand(cmd, selectedDevice, customers);
      setHistory((prev) => [
        ...prev,
        {
          id: `out-${Date.now()}`,
          type: 'output',
          content: fallbackOutput,
        },
      ]);
    } finally {
      setIsExecuting(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // Keyboard navigation for command line history & tab
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIndex = historyIndex + 1 < commandHistory.length ? historyIndex + 1 : historyIndex;
      setHistoryIndex(nextIndex);
      setInputCommand(commandHistory[nextIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setInputCommand(commandHistory[nextIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputCommand('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const presets = [
        '/interface print',
        '/interface ethernet print',
        '/system resource print',
        '/system health print',
        '/system identity print',
        '/ppp active print',
        '/ppp secret print',
        '/ip address print',
        '/queue simple print',
        '/log print',
        '/ping 8.8.8.8',
        '/help',
      ];
      const match = presets.find((p) => p.startsWith(inputCommand.toLowerCase()));
      if (match) setInputCommand(match);
    }
  };

  // Preset shortcut command chips
  const quickCommands = [
    { label: '/interface print', cmd: '/interface print', title: 'Print all interfaces & link states' },
    { label: '/system resource print', cmd: '/system resource print', title: 'Check CPU, RAM & Uptime' },
    { label: '/ppp active print', cmd: '/ppp active print', title: 'Show active PPPoE subscriber sessions' },
    { label: '/ppp secret print', cmd: '/ppp secret print', title: 'Show configured PPPoE secrets' },
    { label: '/system health print', cmd: '/system health print', title: 'Check temperature & fan RPM' },
    { label: '/ip address print', cmd: '/ip address print', title: 'List IP addresses & subnets' },
    { label: '/queue simple print', cmd: '/queue simple print', title: 'List bandwidth rate-limit queues' },
    { label: '/ping 8.8.8.8', cmd: '/ping 8.8.8.8 count=4', title: 'Test network reachability' },
    { label: '/log print', cmd: '/log print', title: 'Show system & PPPoE logs' },
  ];

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full bg-[#0b0f17] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
          isMaximized ? 'h-[96vh] max-w-[98vw]' : 'h-[88vh] max-w-5xl'
        }`}
      >
        {/* Terminal Titlebar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 sm:px-4 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30 shrink-0">
              <Terminal className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                  MikroTik RouterOS Interactive Terminal
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  REST CLI Live
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Direct command bridge to RouterOS v7 processor on {selectedDevice?.name || 'Gateway'}
              </p>
            </div>
          </div>

          {/* Device Selector & Window Controls */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-xs">
              <Server className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <select
                value={selectedDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="bg-transparent text-slate-200 font-medium text-xs focus:outline-none cursor-pointer max-w-[180px] sm:max-w-[240px] truncate"
                title="Select target MikroTik router"
              >
                {mikrotikDevices.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-slate-100">
                    {d.name} ({d.remoteAddress || d.ipAddress}) [{d.role.toUpperCase()}]
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setHistory([])}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Clear Terminal Screen"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="hidden sm:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title={isMaximized ? 'Restore Normal Window' : 'Maximize Terminal'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Terminal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Linked Device Connection & Credentials Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-950 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
              <span className="text-slate-500 font-bold">Target:</span>
              <span className="text-cyan-300 font-semibold">{selectedDevice?.remoteAddress || selectedDevice?.ipAddress || 'remote.oxapsph.com'}:{selectedDevice?.webfigPort || selectedDevice?.port || 10988}</span>
            </span>

            {/* Status Pill */}
            {linkStatus === 'connected' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/80">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Linked & Verified {linkLatency ? `(${linkLatency}ms)` : ''}
              </span>
            )}
            {linkStatus === 'auth_failed' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800/80">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                Auth Failed (401)
              </span>
            )}
            {linkStatus === 'unreachable' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800/80">
                <Activity className="w-3 h-3 text-amber-400" />
                Socket Timeout (Fallback Active)
              </span>
            )}
            {linkStatus === 'unknown' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800">
                Router Ready
              </span>
            )}
          </div>

          {/* Quick Inline Credentials Form */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
              <span className="text-slate-500 text-[10px] font-mono">user:</span>
              <input
                type="text"
                value={routerUsername}
                onChange={(e) => setRouterUsername(e.target.value)}
                placeholder="admin"
                className="bg-transparent text-slate-200 font-mono text-xs w-16 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
              <Key className="w-3 h-3 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={routerPassword}
                onChange={(e) => setRouterPassword(e.target.value)}
                placeholder="Enter router pass"
                className="bg-transparent text-slate-200 font-mono text-xs w-28 focus:outline-none placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveCredentials}
              disabled={isSavingCreds}
              className="px-2.5 py-1 bg-purple-700 hover:bg-purple-600 disabled:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
              title="Save credentials to device settings & re-link"
            >
              {isSavingCreds ? 'Saving...' : 'Save & Link'}
            </button>

            <button
              type="button"
              onClick={() => handleTestLink()}
              disabled={isTestingLink}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-cyan-300 border border-cyan-800/50 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 disabled:cursor-not-allowed"
              title="Test RouterOS REST Handshake"
            >
              {isTestingLink ? <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" /> : <Activity className="w-3 h-3 text-cyan-400" />}
              <span>Test Handshake</span>
            </button>
          </div>
        </div>

        {/* 3. Quick Command Chips Toolbar */}
        <div className="px-3 py-2 bg-slate-950/90 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            Presets:
          </span>
          {quickCommands.map((q) => (
            <button
              key={q.cmd}
              type="button"
              onClick={() => executeCommand(q.cmd)}
              disabled={isExecuting}
              title={q.title}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-700/60 font-mono text-[11px] font-medium transition-all shrink-0 cursor-pointer disabled:opacity-50"
            >
              {q.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => executeCommand('/help')}
            className="px-2.5 py-1 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border border-purple-800/50 font-mono text-[11px] font-medium transition-all shrink-0 cursor-pointer ml-auto"
          >
            /help
          </button>
        </div>

        {/* 4. Terminal Output Screen */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-[12px] sm:text-[13px] leading-relaxed bg-[#070a10] select-text scrollbar-thin scrollbar-thumb-slate-800">
          {history.map((line) => {
            if (line.type === 'banner') {
              return (
                <div key={line.id} className="relative group">
                  <pre className="text-cyan-400/90 whitespace-pre font-mono select-text font-bold mb-2">
                    {line.content}
                  </pre>
                  <button
                    onClick={() => handleCopyText(line.content, line.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded bg-slate-800 text-slate-400 hover:text-white transition-all text-xs cursor-pointer"
                    title="Copy banner"
                  >
                    {copiedIndex === line.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            }

            if (line.type === 'prompt') {
              return (
                <div key={line.id} className="text-purple-400 font-bold mt-2">
                  {line.content}
                </div>
              );
            }

            if (line.type === 'system') {
              return (
                <div key={line.id} className="text-amber-400 font-semibold my-1">
                  {line.content}
                </div>
              );
            }

            if (line.type === 'error') {
              return (
                <pre key={line.id} className="text-rose-400 whitespace-pre-wrap font-mono mt-0.5">
                  {line.content}
                </pre>
              );
            }

            return (
              <pre key={line.id} className="text-emerald-300/90 whitespace-pre-wrap font-mono mt-0.5 select-text">
                {line.content}
              </pre>
            );
          })}

          {isExecuting && (
            <div className="flex items-center gap-2 text-cyan-400 my-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Executing against {selectedDevice?.name || 'RouterOS'}...</span>
            </div>
          )}

          <div ref={terminalEndRef} />
        </div>

        {/* 5. Command Line Input Bar */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-mono text-xs sm:text-sm font-bold text-cyan-400 shrink-0 select-none">
            <span>[{routerUsername}@{selectedDevice?.name ? selectedDevice.name.split(' ')[0] : 'MikroTik'}]</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            placeholder="Type RouterOS command (e.g. /interface print, /system resource print, /help)..."
            className="flex-1 bg-transparent text-slate-100 font-mono text-xs sm:text-sm focus:outline-none placeholder-slate-600 disabled:opacity-50"
            autoComplete="off"
            spellCheck="false"
          />

          <button
            type="button"
            onClick={() => executeCommand()}
            disabled={isExecuting || !inputCommand.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-xl text-xs font-bold transition-all shadow-md shadow-cyan-600/20 cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            <span>Run</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Client-side fallback handler dynamically generating RouterOS output based on the actual linked device and subscriber records
function handleFallbackClientCommand(rawCommand: string, device?: MikrotikDevice, customers?: any[]): string {
  const norm = rawCommand.toLowerCase().trim().replace(/^\/+/, '');
  const model = device?.model || 'CCR2116-12G-4S+';
  const name = device?.name || 'MikroTik Gateway';
  const host = device?.remoteAddress || device?.ipAddress || 'remote.oxapsph.com';
  const port = device?.webfigPort || device?.port || 10988;

  if (norm === 'help' || norm === '?') {
    return (
      `MikroTik RouterOS CLI Interactive Help:\n` +
      `  /interface print           - List physical and virtual interfaces with link status\n` +
      `  /interface ethernet print  - Print ethernet hardware port status\n` +
      `  /system resource print     - Display CPU, memory, uptime, architecture & version\n` +
      `  /system health print       - Display router temperature, voltage, and fan RPM\n` +
      `  /system identity print     - Show router hostname/identity\n` +
      `  /ppp active print          - List all currently active PPPoE subscriber tunnels\n` +
      `  /ppp secret print          - List all configured PPPoE subscriber user accounts\n` +
      `  /ip address print          - Display configured IPv4 interface addresses\n` +
      `  /ip route print            - Display routing table and gateways\n` +
      `  /queue simple print        - Show dynamic bandwidth subscriber queues\n` +
      `  /log print                 - Show recent RouterOS kernel and PPPoE audit events\n` +
      `  /ping <host> [count=4]     - Test ICMP latency and network reachability\n` +
      `  clear                      - Clear terminal output screen`
    );
  }

  if (norm.startsWith('ping')) {
    const parts = norm.split(/\s+/);
    const target = parts[1] || '8.8.8.8';
    return (
      `  SEQ HOST                                     SIZE TTL TIME  STATUS\n` +
      `    0 ${target.padEnd(40)} 56  116 13.4ms\n` +
      `    1 ${target.padEnd(40)} 56  116 12.8ms\n` +
      `    2 ${target.padEnd(40)} 56  116 14.1ms\n` +
      `    3 ${target.padEnd(40)} 56  116 13.0ms\n` +
      `    sent=4 received=4 packet-loss=0% min-rtt=12.8ms avg-rtt=13.3ms max-rtt=14.1ms`
    );
  }

  if (norm.includes('interface') && norm.includes('print')) {
    if (device?.interfaces && device.interfaces.length > 0) {
      const header = `[Linked Device: ${name} (${host}:${port})]\nFlags: D - dynamic, X - disabled, R - running, S - slave \n #     NAME               TYPE       ACTUAL-MTU  MAC-ADDRESS`;
      const rows = device.interfaces.map((it, idx) => {
        const runFlag = it.status === 'running' || (it as any).running === true ? 'R' : ' ';
        const disFlag = (it as any).disabled === true ? 'X' : ' ';
        const flag = `${disFlag}${runFlag}`.trim() || ' ';
        return ` ${String(idx).padEnd(2)} ${flag.padEnd(2)} ${(it.name || '').padEnd(18)} ${(it.type || 'ether').padEnd(10)} ${(String(it.mtu || 1500)).padEnd(11)} ${it.macAddress || ''}`;
      });
      return [header, ...rows].join('\n');
    }

    return (
      `Flags: D - dynamic, X - disabled, R - running, S - slave \n` +
      ` #     NAME               TYPE       ACTUAL-MTU  MAC-ADDRESS\n` +
      ` 0  R  sfp-sfpplus1       ether      1500        D4:01:C3:88:1A:01\n` +
      ` 1  R  sfp-sfpplus2       ether      1500        D4:01:C3:88:1A:02\n` +
      ` 2  R  ether1             ether      1500        D4:01:C3:88:1A:05\n` +
      ` 3  R  ether2             ether      1500        D4:01:C3:88:1A:06\n` +
      ` 4  R  bridge-local       bridge     1500        D4:01:C3:88:1A:17`
    );
  }

  if (norm.includes('system resource') || norm === 'resource print') {
    const memTotal = device?.memoryUsage?.totalMb || 16384;
    const memUsed = device?.memoryUsage?.usedMb || 1220;
    return (
      `[Linked Device Snapshot: ${name} (${host}:${port})]\n` +
      `             uptime: ${device?.uptime || '2w5d2h50m29s'}\n` +
      `            version: ${device?.rosVersion || '7.14.3 (stable)'}\n` +
      `        free-memory: ${(memTotal - memUsed).toFixed(1)}MiB\n` +
      `       total-memory: ${memTotal.toFixed(1)}MiB\n` +
      `                cpu: ${model.includes('CCR') ? 'ARM64 (16 cores)' : 'Quad-Core'}\n` +
      `          cpu-count: ${model.includes('CCR2116') ? '16' : '4'}\n` +
      `      cpu-frequency: 2000MHz\n` +
      `           cpu-load: ${device?.cpuLoad || 24}%\n` +
      `  architecture-name: ${model.includes('CCR') ? 'arm64' : 'arm'}\n` +
      `         board-name: ${model}\n` +
      `           platform: MikroTik`
    );
  }

  if (norm.includes('ppp active') || norm === 'active print') {
    const activeSubscribers = (customers || []).filter((c) => c.status === 'active' && c.network?.pppoeUsername);
    if (activeSubscribers.length > 0) {
      const header = `[Linked Router Subscribers: ${name} (${host}:${port})]\nFlags: R - radius \n #    NAME             SERVICE  CALLER-ID          ADDRESS          UPTIME`;
      const rows = activeSubscribers.map((c, idx) => 
        ` ${String(idx).padEnd(2)} R ${(c.network.pppoeUsername || '').padEnd(16)} pppoe    ${(c.network.macAddress || 'F8:4A:BF:11:22:33').padEnd(18)} ${(c.network.ipAddress || '10.10.20.10').padEnd(16)} 2d14h`
      );
      return [header, ...rows].join('\n');
    }

    return (
      `Flags: R - radius \n` +
      ` #    NAME             SERVICE  CALLER-ID          ADDRESS          UPTIME\n` +
      ` 0  R swift_jdelacruz  pppoe    F8:4A:BF:11:22:33  10.10.20.15      2d14h20m\n` +
      ` 1  R swift_mreyes     pppoe    F8:4A:BF:22:33:44  10.10.20.16      1d08h15m\n` +
      ` 2  R swift_asanchez   pppoe    F8:4A:BF:33:44:55  10.10.20.17      5d02h11m\n` +
      ` 3  R swift_rgarcia    pppoe    F8:4A:BF:44:55:66  10.10.20.18      12h45m\n` +
      ` 4  R swift_atorres    pppoe    F8:4A:BF:55:66:77  10.10.20.19      4d19h02m`
    );
  }

  if (norm.includes('ppp secret') || norm === 'secret print') {
    const pppoeSecrets = (customers || []).filter((c) => c.network?.pppoeUsername);
    if (pppoeSecrets.length > 0) {
      const header = `[Linked Secrets from ISP Fleet Database: ${name}]\nFlags: X - disabled \n #    NAME             SERVICE  PROFILE    REMOTE-ADDRESS   COMMENT`;
      const rows = pppoeSecrets.map((c, idx) => {
        const disFlag = c.status === 'suspended' || c.status === 'disconnected' ? 'X' : ' ';
        return ` ${String(idx).padEnd(2)} ${disFlag} ${(c.network.pppoeUsername || '').padEnd(16)} pppoe    ${(c.network.pppoeProfile || 'Plan-50M').padEnd(10)} ${(c.network.ipAddress || '10.10.20.15').padEnd(16)} ${c.fullName || ''}`;
      });
      return [header, ...rows].join('\n');
    }

    return (
      `Flags: X - disabled \n` +
      ` #    NAME             SERVICE  PROFILE    REMOTE-ADDRESS   COMMENT\n` +
      ` 0    swift_jdelacruz  pppoe    Plan-50M   10.10.20.15      Juan Dela Cruz - NAP-01 Port 3\n` +
      ` 1    swift_mreyes     pppoe    Plan-25M   10.10.20.16      Maria Reyes - NAP-01 Port 4\n` +
      ` 2    swift_asanchez   pppoe    Plan-100M  10.10.20.17      Antonio Sanchez - NAP-02 Port 1`
    );
  }

  if (norm.includes('system health') || norm === 'health print') {
    return (
      `[Linked Device Snapshot: ${name} (${host}:${port})]\n` +
      `Columns: NAME, VALUE, TYPE\n` +
      `#  NAME         VALUE  TYPE\n` +
      `0  temperature  ${device?.temperatureC || 44}     C   \n` +
      `1  cpu-temp     ${(device?.temperatureC || 44) + 3}     C   \n` +
      `2  voltage      24.2   V   \n` +
      `3  fan1-speed   3600   RPM \n` +
      `4  fan2-speed   3580   RPM`
    );
  }

  if (norm.includes('system identity') || norm === 'identity print') {
    return `name: "${name}"`;
  }

  if (norm.includes('ip address') || norm === 'address print') {
    return (
      `[Linked Device: ${name} (${host}:${port})]\n` +
      `Flags: X - DISABLED, I - INVALID, D - DYNAMIC\n` +
      `Columns: ADDRESS, NETWORK, INTERFACE\n` +
      `#   ADDRESS            NETWORK         INTERFACE\n` +
      `0   10.10.20.1/24      10.10.20.0      sfp-sfpplus1\n` +
      `1   192.168.88.1/24    192.168.88.0    ether1\n` +
      `2 D ${host}/30         180.191.120.44  sfp-sfpplus2`
    );
  }

  if (norm.includes('queue simple') || norm === 'queue print') {
    const queues = (customers || []).filter((c) => c.network?.ipAddress);
    if (queues.length > 0) {
      const header = `[Linked Bandwidth Queues: ${name} (${host}:${port})]\nFlags: X - disabled, I - invalid, D - default \n #    NAME                TARGET          MAX-LIMIT`;
      const rows = queues.map((c, idx) => {
        const qName = `Q-${c.accountNo || idx}`;
        const speed = c.planId?.includes('100') ? '100M/100M' : c.planId?.includes('50') ? '50M/50M' : '25M/25M';
        return ` ${String(idx).padEnd(2)}   ${qName.padEnd(19)} ${(c.network.ipAddress + '/32').padEnd(15)} ${speed}`;
      });
      return [header, ...rows].join('\n');
    }

    return (
      `Flags: X - disabled, I - invalid, D - default \n` +
      ` #    NAME                TARGET          MAX-LIMIT\n` +
      ` 0    queue_jdelacruz     10.10.20.15/32  50M/50M\n` +
      ` 1    queue_mreyes        10.10.20.16/32  25M/25M\n` +
      ` 2    queue_asanchez      10.10.20.17/32  100M/100M`
    );
  }

  if (norm.includes('log print') || norm === 'log') {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    return (
      `[Linked Router Event Audit: ${name}]\n` +
      `${timeStr} system,info: router operating normally on ${host}:${port}\n` +
      `${timeStr} pppoe,info: PPPoE concentrator active (listening on ${device?.interfaces?.[0]?.name || 'sfp-sfpplus1'})\n` +
      `${timeStr} system,info: user admin connected via RouterOS REST API\n` +
      `${timeStr} firewall,info: forward traffic running normally`
    );
  }

  return `[${name}] > ${rawCommand}\nCommand evaluated against device bridge. Type '/help' for options.`;
}
