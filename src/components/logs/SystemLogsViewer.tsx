import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Trash2,
  Terminal,
  Eye,
  X,
  Activity,
  User,
  Calendar,
  AlertTriangle,
  Info,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Radio,
  SlidersHorizontal,
  Globe,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AuditLog, AuditLogCategory, AuditLogSeverity } from '../../types';
import { fetchPublicIp, getPublicIp, isLocalOrMockIp } from '../../services/ipService';

export const SystemLogsViewer: React.FC = () => {
  const { auditLogs, clearAuditLogs, staffUsers, showToast } = useApp();
  const [publicIp, setPublicIp] = useState<string | null>(getPublicIp());

  useEffect(() => {
    fetchPublicIp().then((ip) => {
      if (ip) setPublicIp(ip);
    });
  }, []);

  // Filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [operatorFilter, setOperatorFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');

  // Detail Modal State
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Derive unique operators for filtering
  const uniqueOperators = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((l) => {
      if (l.userName) set.add(l.userName);
    });
    staffUsers.forEach((s) => {
      if (s.fullName) set.add(s.fullName);
    });
    return Array.from(set).sort();
  }, [auditLogs, staffUsers]);

  // Filtering Logic
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return auditLogs.filter((log) => {
      // Category filter
      if (categoryFilter !== 'all' && log.category !== categoryFilter) {
        return false;
      }

      // Severity filter
      if (severityFilter !== 'all' && log.severity !== severityFilter) {
        return false;
      }

      // Operator filter
      if (operatorFilter !== 'all' && log.userName !== operatorFilter) {
        return false;
      }

      // Date Range filter
      if (dateRangeFilter !== 'all') {
        const logTime = new Date(log.timestamp.replace(' ', 'T')).getTime();
        if (dateRangeFilter === 'today' && logTime < todayStart) return false;
        if (dateRangeFilter === '7days' && logTime < sevenDaysAgo) return false;
        if (dateRangeFilter === '30days' && logTime < thirtyDaysAgo) return false;
      }

      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesOperator = log.userName?.toLowerCase().includes(query);
        const matchesAction = log.action?.toLowerCase().includes(query);
        const matchesDetails = log.details?.toLowerCase().includes(query);
        const matchesIp = log.ipAddress?.toLowerCase().includes(query);
        const matchesCategory = log.category?.toLowerCase().includes(query);
        if (!matchesOperator && !matchesAction && !matchesDetails && !matchesIp && !matchesCategory) {
          return false;
        }
      }

      return true;
    });
  }, [auditLogs, categoryFilter, severityFilter, operatorFilter, dateRangeFilter, searchTerm]);

  // Metrics
  const totalEvents = auditLogs.length;
  const securityAlerts = useMemo(
    () => auditLogs.filter((l) => l.severity === 'warning' || l.severity === 'critical').length,
    [auditLogs]
  );
  const financialEvents = useMemo(
    () =>
      auditLogs.filter(
        (l) => l.category === 'billing' || l.category === 'expenses' || (l.category as string) === 'financial'
      ).length,
    [auditLogs]
  );
  const systemNetworkEvents = useMemo(
    () =>
      auditLogs.filter(
        (l) => l.category === 'network' || l.category === 'system' || l.category === 'settings'
      ).length,
    [auditLogs]
  );

  // CSV Export Handler
  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      showToast('info', 'No Logs to Export', 'There are no audit records matching your active filters.');
      return;
    }

    const headers = [
      'Log ID',
      'Timestamp',
      'Operator',
      'Category',
      'Action',
      'Severity',
      'IP Address',
      'Status',
      'Activity Description',
    ];

    const rows = filteredLogs.map((log) => [
      log.id,
      log.timestamp,
      `"${log.userName.replace(/"/g, '""')}"`,
      log.category,
      log.action,
      log.severity.toUpperCase(),
      !isLocalOrMockIp(log.ipAddress) ? log.ipAddress : (publicIp || 'Public WAN'),
      log.status.toUpperCase(),
      `"${(log.details || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `system_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('success', 'CSV Exported', `Successfully exported ${filteredLogs.length} audit records.`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 animate-in fade-in">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Terminal className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight">
              Admin & System Activity Logs
            </h1>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Sync
            </span>
            {publicIp && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                <Globe className="w-3 h-3 text-cyan-400" />
                <span>WAN: {publicIp}</span>
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time forensic audit ledger tracking operator actions, authentication, network changes, and security events.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all historical audit records? This cannot be undone.')) {
                clearAuditLogs();
              }
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-950/40 border border-rose-800/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Ledger</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Total Logged Events</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300">{totalEvents}</div>
          <p className="text-[10px] text-slate-500 mt-1">Synced with Cloud Firestore</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Security Alerts</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-400">{securityAlerts}</div>
          <p className="text-[10px] text-slate-500 mt-1">Critical & warning severities</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Financial & Billing</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400">{financialEvents}</div>
          <p className="text-[10px] text-slate-500 mt-1">Invoices, payments & OPEX</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Network & Infra</span>
            <Radio className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black font-mono text-purple-400">{systemNetworkEvents}</div>
          <p className="text-[10px] text-slate-500 mt-1">MikroTik, ACS & system configs</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-card">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by operator, action name, IP address, or keyword..."
              className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <span className="text-[10px] text-slate-400 font-medium">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Categories</option>
                <option value="auth" className="bg-slate-900">Authentication</option>
                <option value="admin" className="bg-slate-900">Admin Actions</option>
                <option value="billing" className="bg-slate-900">Billing & Invoices</option>
                <option value="financial" className="bg-slate-900">Financial Ledger</option>
                <option value="expenses" className="bg-slate-900">Operating Expenses</option>
                <option value="customer" className="bg-slate-900">Subscribers CRM</option>
                <option value="network" className="bg-slate-900">MikroTik & Network</option>
                <option value="settings" className="bg-slate-900">System Settings</option>
                <option value="system" className="bg-slate-900">System & Database</option>
                <option value="smtp" className="bg-slate-900">SMTP & Mail</option>
              </select>
            </div>

            {/* Severity */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <span className="text-[10px] text-slate-400 font-medium">Severity:</span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Severities</option>
                <option value="info" className="bg-slate-900">Info (Normal)</option>
                <option value="warning" className="bg-slate-900">Warning (Moderate)</option>
                <option value="critical" className="bg-slate-900">Critical (Alert)</option>
              </select>
            </div>

            {/* Operator */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <span className="text-[10px] text-slate-400 font-medium">Operator:</span>
              <select
                value={operatorFilter}
                onChange={(e) => setOperatorFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer max-w-[130px] truncate"
              >
                <option value="all" className="bg-slate-900">All Operators</option>
                {uniqueOperators.map((op) => (
                  <option key={op} value={op} className="bg-slate-900">
                    {op}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5">
              <span className="text-[10px] text-slate-400 font-medium">Period:</span>
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value as any)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Time</option>
                <option value="today" className="bg-slate-900">Today Only</option>
                <option value="7days" className="bg-slate-900">Past 7 Days</option>
                <option value="30days" className="bg-slate-900">Past 30 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Counter & Active Filter Tags */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60">
          <span>
            Showing <strong className="text-cyan-400 font-mono">{filteredLogs.length}</strong> of{' '}
            <span className="font-mono text-slate-300">{totalEvents}</span> recorded events
          </span>
          {(categoryFilter !== 'all' || severityFilter !== 'all' || operatorFilter !== 'all' || dateRangeFilter !== 'all' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('all');
                setSeverityFilter('all');
                setOperatorFilter('all');
                setDateRangeFilter('all');
                setSearchTerm('');
              }}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-medium cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Audit Log Table */}
      <div className="overflow-hidden border border-slate-800 rounded-2xl bg-slate-950 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3.5">Timestamp</th>
                <th className="px-4 py-3.5">Operator</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Action Event</th>
                <th className="px-4 py-3.5">Severity</th>
                <th className="px-4 py-3.5">IP Address</th>
                <th className="px-4 py-3.5">Activity Description</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500 font-sans">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="w-8 h-8 text-slate-600 mb-1" />
                      <p className="text-sm font-semibold text-slate-400">No matching audit logs found</p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        Try adjusting your search keywords, clearing severity/category filters, or expanding the date range.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const severityBadge =
                    log.severity === 'critical'
                      ? 'bg-rose-950/60 text-rose-300 border-rose-800/80'
                      : log.severity === 'warning'
                      ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
                      : 'bg-sky-950/60 text-sky-300 border-sky-800/80';

                  const categoryBadge =
                    log.category === 'billing' || (log.category as string) === 'financial'
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                      : log.category === 'expenses'
                      ? 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                      : log.category === 'network'
                      ? 'bg-purple-950/40 text-purple-300 border-purple-800/40'
                      : log.category === 'auth'
                      ? 'bg-blue-950/40 text-blue-300 border-blue-800/40'
                      : 'bg-slate-900 text-slate-300 border-slate-800';

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                    >
                      {/* Timestamp */}
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{log.timestamp}</span>
                        </div>
                      </td>

                      {/* Operator */}
                      <td className="px-4 py-3 text-slate-200 font-sans font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                            {log.userName ? log.userName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <span className="text-xs">{log.userName || 'System Auto'}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 whitespace-nowrap font-sans">
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] uppercase font-bold ${categoryBadge}`}>
                          {log.category}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-cyan-300 font-semibold whitespace-nowrap text-xs">
                        {log.action}
                      </td>

                      {/* Severity */}
                      <td className="px-4 py-3 whitespace-nowrap font-sans">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${severityBadge}`}>
                          {log.severity}
                        </span>
                      </td>

                      {/* IP Address */}
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-[11px]">
                        {!isLocalOrMockIp(log.ipAddress) ? log.ipAddress : (publicIp || 'Public WAN')}
                      </td>

                      {/* Details */}
                      <td className="px-4 py-3 text-slate-300 font-sans max-w-xs sm:max-w-md truncate" title={log.details}>
                        {log.details}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {log.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-sans font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 font-sans font-bold">
                            <XCircle className="w-3.5 h-3.5" />
                            FAIL
                          </span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-cyan-300 group-hover:border-cyan-500/40 transition-colors"
                          title="Inspect Event Payload"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forensic Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Audit Record Inspection</span>
                    <span className="text-xs font-mono text-cyan-400 font-normal">#{selectedLog.id}</span>
                  </h3>
                  <p className="text-xs text-slate-400">Logged on {selectedLog.timestamp}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Field Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Operator</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">{selectedLog.userName}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Category</span>
                <span className="font-semibold text-cyan-400 mt-0.5 uppercase block">{selectedLog.category}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Severity</span>
                <span
                  className={`font-semibold mt-0.5 uppercase block ${
                    selectedLog.severity === 'critical'
                      ? 'text-rose-400'
                      : selectedLog.severity === 'warning'
                      ? 'text-amber-400'
                      : 'text-sky-400'
                  }`}
                >
                  {selectedLog.severity}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Action Event</span>
                <span className="font-mono font-bold text-slate-200 mt-0.5 block">{selectedLog.action}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Status</span>
                <span
                  className={`font-semibold mt-0.5 uppercase block ${
                    selectedLog.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {selectedLog.status}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Source IP</span>
                <span className="font-mono text-slate-300 mt-0.5 block">
                  {!isLocalOrMockIp(selectedLog.ipAddress) ? selectedLog.ipAddress : (publicIp || 'Public WAN')}
                </span>
              </div>
            </div>

            {/* Details Box */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Activity Narrative</span>
              <p className="text-xs text-slate-200 leading-relaxed font-sans">{selectedLog.details}</p>
            </div>

            {/* Raw JSON Inspector */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Raw Audit Payload</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(JSON.stringify(selectedLog, null, 2))}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono transition-colors cursor-pointer"
                >
                  {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-cyan-300/90 bg-slate-900/90 p-3 rounded-xl overflow-x-auto max-h-48 border border-slate-800">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

