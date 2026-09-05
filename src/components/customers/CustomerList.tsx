import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  FileText,
  Eye,
  Edit2,
  Trash2,
  Wifi,
  MapPin,
  FileSpreadsheet,
  CheckCircle2,
  Radio,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, CustomerStatus } from '../../types';
import { formatCurrency, formatPhoneNumber, getCustomerStatusBadge } from '../../utils/formatters';
import { ProvisionModal } from './ProvisionModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';

interface CustomerListProps {
  onOpenCustomerModal: (customer?: Customer) => void;
  onSelectCustomer: (customerId: string) => void;
}

export const CustomerList: React.FC<CustomerListProps> = ({
  onOpenCustomerModal,
  onSelectCustomer,
}) => {
  const {
    customers,
    deleteCustomer,
    toggleCustomerStatus,
    syncCustomerMikrotik,
    searchTerm,
    setSearchTerm,
    plans,
    napBoxes,
    setActiveTab,
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [barangayFilter, setBarangayFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [selectedCustomerForProvision, setSelectedCustomerForProvision] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // Extract unique barangays
  const barangays = Array.from(new Set(customers.map((c) => c.address.barangay)));

  // Filter logic
  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.accountNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.mobile.includes(searchTerm) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.address.barangay.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.address.street.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.network.pppoeUsername.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.network.ipAddress.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
    const matchesBarangay = barangayFilter === 'all' || customer.address.barangay === barangayFilter;
    const matchesPlan = planFilter === 'all' || customer.planId === planFilter;

    return matchesSearch && matchesStatus && matchesBarangay && matchesPlan;
  });

  const exportToCSV = () => {
    const headers = [
      'Account No',
      'Full Name',
      'Mobile',
      'Email',
      'Barangay',
      'Street',
      'Landmark',
      'Plan',
      'Monthly Fee',
      'Status',
      'Balance',
      'PPPoE User',
      'IP Address',
      'NAP Box',
      'NAP Port',
    ];

    const rows = filteredCustomers.map((c) => [
      c.accountNo,
      `"${c.fullName}"`,
      c.mobile,
      c.email,
      c.address.barangay,
      `"${c.address.street}"`,
      `"${c.address.landmark || ''}"`,
      `"${c.planName}"`,
      c.monthlyFee,
      c.status,
      c.balance,
      c.network.pppoeUsername,
      c.network.ipAddress,
      c.network.napBoxId,
      c.network.napPortNumber,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `swiftstream_subscribers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>Subscribers Directory (ISP CRM)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage fiber subscriptions, billing profiles, network allocations, and Mikrotik states.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => onOpenCustomerModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            <span>Register Subscriber</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/80 pb-3">
          {[
            { id: 'all', label: 'All Subscribers', count: customers.length },
            { id: 'pending_approval', label: 'Pending Review', count: customers.filter((c) => c.status === 'pending_approval').length },
            { id: 'active', label: 'Active', count: customers.filter((c) => c.status === 'active').length },
            { id: 'overdue', label: 'Overdue', count: customers.filter((c) => c.status === 'overdue').length },
            { id: 'suspended', label: 'Suspended (Cut)', count: customers.filter((c) => c.status === 'suspended').length },
            { id: 'pending_install', label: 'Pending Install', count: customers.filter((c) => c.status === 'pending_install').length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === tab.id
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === tab.id ? 'bg-cyan-700 text-cyan-100' : 'bg-slate-800 text-slate-400'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Dropdown Filters & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, account #, phone, IP..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Barangays / Locations</option>
              {barangays.map((bg) => (
                <option key={bg} value={bg}>
                  Brgy. {bg}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Bandwidth Plans</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (₱{p.monthlyFee.toLocaleString()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Subscribers Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">Account / Subscriber</th>
                <th className="py-3.5 px-4">Location / Landmark</th>
                <th className="py-3.5 px-4">Plan & Rate</th>
                <th className="py-3.5 px-4">Network & NAP Port</th>
                <th className="py-3.5 px-4">Balance</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No subscribers found matching the current filters.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const statusBadge = getCustomerStatusBadge(customer.status);
                  const assignedNap = napBoxes.find((n) => n.id === customer.network.napBoxId);

                  return (
                    <tr key={customer.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Name & Contact */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onSelectCustomer(customer.id)}
                          className="font-bold text-slate-100 hover:text-cyan-400 transition-colors text-left block"
                        >
                          {customer.fullName}
                        </button>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span className="font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                            {customer.accountNo}
                          </span>
                          <span>•</span>
                          <span>{formatPhoneNumber(customer.mobile)}</span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="flex items-start gap-1 text-slate-300 truncate">
                          <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                          <span className="truncate">{customer.address.street}, Brgy. {customer.address.barangay}</span>
                        </div>
                        {customer.address.landmark && (
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate pl-4">
                            Near: {customer.address.landmark}
                          </p>
                        )}
                      </td>

                      {/* Plan */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200 truncate max-w-[150px]">
                          {customer.planName}
                        </div>
                        <div className="text-[11px] font-mono text-cyan-400 mt-0.5">
                          {formatCurrency(customer.monthlyFee)}/mo
                        </div>
                      </td>

                      {/* Network & NAP */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              customer.network.isMikrotikSynced ? 'bg-emerald-400' : 'bg-slate-600'
                            }`}
                            title={customer.network.isMikrotikSynced ? 'Mikrotik Active' : 'Offline / Unsynced'}
                          />
                          <span className="font-mono text-[11px] text-slate-300">
                            {customer.network.pppoeUsername}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          IP: {customer.network.ipAddress} • NAP: {assignedNap?.code || customer.network.napBoxId} (Port #{customer.network.napPortNumber})
                        </div>
                      </td>

                      {/* Balance */}
                      <td className="py-3 px-4 font-mono font-bold">
                        {customer.balance > 0 ? (
                          <span className="text-rose-400">{formatCurrency(customer.balance)}</span>
                        ) : customer.balance < 0 ? (
                          <span className="text-emerald-400">-{formatCurrency(Math.abs(customer.balance))} (Adv)</span>
                        ) : (
                          <span className="text-slate-400">₱0.00</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge.bg} ${statusBadge.textCol} ${statusBadge.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                          {statusBadge.text}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {customer.status === 'pending_approval' && (
                            <button
                              onClick={() => toggleCustomerStatus(customer.id, 'active')}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                              title="Quick Approve & Grant Portal Access"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          )}

                          {(customer.status === 'pending_install' || customer.status === 'pending_approval') && (
                            <button
                              onClick={() => setSelectedCustomerForProvision(customer)}
                              className="p-1.5 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white rounded-lg shadow-md transition-all cursor-pointer"
                              title="Review, Provision Fiber Line & Convert to Active Subscriber"
                            >
                              <Zap className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSearchTerm(customer.accountNo);
                              setActiveTab('billing');
                            }}
                            className="p-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors"
                            title="View Bills & Collect Payment"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onSelectCustomer(customer.id)}
                            className="p-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
                            title="View Statement of Account & Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onOpenCustomerModal(customer)}
                            className="p-1.5 bg-slate-800 text-cyan-400 hover:bg-cyan-600 hover:text-white rounded-lg transition-colors"
                            title="Edit Subscriber Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => syncCustomerMikrotik(customer.id)}
                            className="p-1.5 bg-slate-800 text-purple-400 hover:bg-purple-600 hover:text-white rounded-lg transition-colors"
                            title="Sync Mikrotik Line"
                          >
                            <Wifi className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setCustomerToDelete(customer)}
                            className="p-1.5 bg-slate-800 text-rose-400 hover:bg-rose-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="Delete Subscriber"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provisioning Modal */}
      {selectedCustomerForProvision && (
        <ProvisionModal
          customer={selectedCustomerForProvision}
          onClose={() => setSelectedCustomerForProvision(null)}
        />
      )}

      {/* Confirmation Dialog for Customer Deletion */}
      <ConfirmDeleteModal
        isOpen={!!customerToDelete}
        title="Delete Subscriber Account"
        itemName={customerToDelete ? `${customerToDelete.fullName} (${customerToDelete.accountNo}) - Plan: ${customerToDelete.planName}` : undefined}
        description="Are you sure you want to permanently delete this subscriber? This will remove all associated billing records, network allocations, and customer credentials from your active database and Cloud Firestore."
        confirmLabel="Yes, Delete Subscriber"
        onConfirm={() => {
          if (customerToDelete) {
            deleteCustomer(customerToDelete.id);
            setCustomerToDelete(null);
          }
        }}
        onClose={() => setCustomerToDelete(null)}
      />
    </div>
  );
};

