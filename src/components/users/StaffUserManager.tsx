import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  CreditCard,
  Wrench,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  KeyRound,
  RefreshCw,
  Mail,
  Phone,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StaffUser, SystemRole, SYSTEM_ROLES_CONFIG } from '../../types';

export const StaffUserManager: React.FC = () => {
  const {
    staffUsers,
    customers,
    addStaffUser,
    updateStaffUser,
    deleteStaffUser,
    toggleStaffUserStatus,
    systemRole,
    currentAuthUser,
    hasPermission,
  } = useApp();

  const canManageStaff = hasPermission('canManageStaff');


  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | SystemRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<StaffUser | null>(null);

  // Form Fields
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formRole, setFormRole] = useState<SystemRole>('cashier');
  const [formStatus, setFormStatus] = useState<'active' | 'suspended'>('active');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formNotes, setFormNotes] = useState('');
  const [autoWhitelist, setAutoWhitelist] = useState(true);
  const [formError, setFormError] = useState('');

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingStaff(null);
    setFormFullName('');
    setFormEmail('');
    setFormMobile('');
    setFormRole('cashier');
    setFormStatus('active');
    setFormPassword(generateRandomPassword());
    setShowPassword(false);
    setFormNotes('');
    setAutoWhitelist(true);
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (staff: StaffUser) => {
    setEditingStaff(staff);
    setFormFullName(staff.fullName);
    setFormEmail(staff.email);
    setFormMobile(staff.mobile || '');
    setFormRole(staff.role);
    setFormStatus(staff.status);
    setFormPassword(staff.initialPassword || '');
    setShowPassword(false);
    setFormNotes(staff.notes || '');
    setAutoWhitelist(true);
    setFormError('');
    setIsFormModalOpen(true);
  };

  // Generate strong random password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Handle Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formFullName.trim()) {
      setFormError('Full Name is required.');
      return;
    }
    if (!formEmail.trim() || !formEmail.includes('@')) {
      setFormError('A valid email address is required.');
      return;
    }

    // Check duplicate email
    const emailExists = staffUsers.some(
      (u) => u.email.toLowerCase().trim() === formEmail.toLowerCase().trim() && u.id !== editingStaff?.id
    );
    if (emailExists) {
      setFormError('A staff user with this email address already exists.');
      return;
    }

    // Guard: Prevent assigning a subscriber/customer email as a staff user
    const customerWithEmail = customers.find(
      (c) => c.email && c.email.toLowerCase().trim() === formEmail.toLowerCase().trim()
    );
    if (customerWithEmail) {
      setFormError(`This email address belongs to subscriber "${customerWithEmail.fullName}" (${customerWithEmail.accountNo}). Staff accounts must use a dedicated company email.`);
      return;
    }

    if (editingStaff) {
      // Update
      await updateStaffUser(editingStaff.id, {
        fullName: formFullName.trim(),
        email: formEmail.trim().toLowerCase(),
        mobile: formMobile.trim(),
        role: formRole,
        status: formStatus,
        initialPassword: formPassword,
        notes: formNotes.trim(),
      });
    } else {
      // Create
      await addStaffUser({
        fullName: formFullName.trim(),
        email: formEmail.trim().toLowerCase(),
        mobile: formMobile.trim(),
        role: formRole,
        status: formStatus,
        initialPassword: formPassword,
        notes: formNotes.trim(),
      });
    }

    setIsFormModalOpen(false);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (staffToDelete) {
      await deleteStaffUser(staffToDelete.id);
      setStaffToDelete(null);
    }
  };

  // Pure genuine staff users (strictly excluding any subscribers or customers)
  const genuineStaffUsers = React.useMemo(() => {
    const customerEmails = new Set(customers.map((c) => c.email?.toLowerCase().trim()).filter(Boolean));
    const customerAccountNos = new Set(customers.map((c) => c.accountNo?.toLowerCase().trim()).filter(Boolean));

    return staffUsers.filter((u: any) => {
      if (!u || !u.role) return false;
      const r = String(u.role).toLowerCase().trim();
      const isStaffRole = r === 'admin' || r === 'cashier' || r === 'technician';
      if (!isStaffRole) return false;
      if (u.accountNo || u.planId || u.planName) return false;
      const email = (u.email || '').toLowerCase().trim();
      if (customerAccountNos.has((u.accountNo || '').toLowerCase().trim())) return false;
      if (email === 'swiftstream.telecom@gmail.com') return true;
      if (customerEmails.has(email)) return false;
      return true;
    });
  }, [staffUsers, customers]);

  // Filtered staff users
  const filteredStaffUsers = genuineStaffUsers.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.mobile && u.mobile.includes(searchTerm)) ||
      (u.notes && u.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Metrics (computed strictly from genuine staff users)
  const totalStaff = genuineStaffUsers.length;
  const adminCount = genuineStaffUsers.filter((u) => u.role === 'admin').length;
  const cashierCount = genuineStaffUsers.filter((u) => u.role === 'cashier').length;
  const techCount = genuineStaffUsers.filter((u) => u.role === 'technician').length;

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Staff & System Role Access
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manually register staff accounts, assign operational permissions (Admin, Cashier, Technician), and manage active sessions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canManageStaff ? (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Staff Member</span>
            </button>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 border border-slate-700 text-slate-400 rounded-xl text-xs font-medium">
              <Lock className="w-3.5 h-3.5" />
              <span>Read-Only (Admin Restricted)</span>
            </span>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3 shadow-card">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Total Staff</p>
            <p className="text-xl font-bold text-white">{totalStaff}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-purple-500/20 flex items-center gap-3 shadow-card">
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-mono tracking-wider text-purple-300">Administrators</p>
            <p className="text-xl font-bold text-white">{adminCount}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/20 flex items-center gap-3 shadow-card">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-mono tracking-wider text-emerald-300">Cashiers / POS</p>
            <p className="text-xl font-bold text-white">{cashierCount}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/20 flex items-center gap-3 shadow-card">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-mono tracking-wider text-amber-300">Field Technicians</p>
            <p className="text-xl font-bold text-white">{techCount}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search staff by name, email, mobile, notes..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Role Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" /> Role:
          </span>
          {(['all', 'admin', 'cashier', 'technician'] as const).map((r) => {
            const isSelected = roleFilter === r;
            const label =
              r === 'all'
                ? 'All Roles'
                : r === 'admin'
                ? 'Admin'
                : r === 'cashier'
                ? 'Cashier'
                : 'Technician';
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Staff Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
              <tr>
                <th className="px-4 py-3.5">Staff Member</th>
                <th className="px-4 py-3.5">Assigned Role</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Contact Details</th>
                <th className="px-4 py-3.5">Added Date</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredStaffUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <Users className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-semibold text-slate-300">No staff accounts found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchTerm || roleFilter !== 'all'
                        ? 'Try clearing your search or role filters.'
                        : 'Click "Add Staff Member" above to create your first cashier or technician.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStaffUsers.map((staff) => {
                  const roleMeta = SYSTEM_ROLES_CONFIG[staff.role] || SYSTEM_ROLES_CONFIG.admin;

                  return (
                    <tr key={staff.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Name & Initials */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${roleMeta.color} text-white font-bold flex items-center justify-center text-xs shadow-sm flex-shrink-0`}
                          >
                            {staff.fullName
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-100 block">{staff.fullName}</span>
                            <span className="text-[11px] text-slate-400 font-mono block">{staff.email}</span>
                            {staff.notes && (
                              <span className="text-[10px] text-slate-500 italic block mt-0.5">
                                {staff.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* System Role Badge */}
                      <td className="px-4 py-3.5">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold font-mono">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${roleMeta.badgeBg} ${roleMeta.badgeBorder} ${roleMeta.textColor}`}
                          >
                            {staff.role === 'admin' && <ShieldCheck className="w-3.5 h-3.5" />}
                            {staff.role === 'cashier' && <CreditCard className="w-3.5 h-3.5" />}
                            {staff.role === 'technician' && <Wrench className="w-3.5 h-3.5" />}
                            <span>{roleMeta.badge}</span>
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          disabled={!canManageStaff}
                          onClick={() => canManageStaff && toggleStaffUserStatus(staff.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                            canManageStaff ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'
                          } ${
                            staff.status === 'active'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                          }`}
                          title={canManageStaff ? 'Click to toggle status' : 'Status change restricted to Admin'}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              staff.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                            }`}
                          />
                          <span className="capitalize">{staff.status}</span>
                        </button>
                      </td>

                      {/* Contact Details */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5 text-[11px]">
                          {staff.mobile ? (
                            <div className="flex items-center gap-1 text-slate-300 font-mono">
                              <Phone className="w-3 h-3 text-cyan-400" />
                              <span>{staff.mobile}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">No mobile</span>
                          )}
                          <div className="flex items-center gap-1 text-slate-400 font-mono">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span>{staff.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="px-4 py-3.5 text-[11px] text-slate-400 font-mono">
                        {new Date(staff.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        {canManageStaff ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(staff)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors cursor-pointer"
                              title="Edit Staff Member"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => setStaffToDelete(staff)}
                              className="p-1.5 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800/50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Staff Member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono italic">View Only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Staff Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingStaff ? 'Edit Staff Member' : 'Register New Staff Member'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Assign role permissions and operational responsibilities
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                />
              </div>

              {/* Email & Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="e.g. cashier@swiftstream.ph"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Mobile / Phone</label>
                  <input
                    type="tel"
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value)}
                    placeholder="e.g. 09171234567"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                  />
                </div>
              </div>

              {/* Role Selection Cards */}
              <div>
                <label className="block font-semibold text-slate-300 mb-2">
                  Assign System Role <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(['cashier', 'technician', 'admin'] as const).map((r) => {
                    const meta = SYSTEM_ROLES_CONFIG[r];
                    const isSelected = formRole === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormRole(r)}
                        className={`w-full flex items-start gap-3 p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                          isSelected
                            ? `${meta.badgeBg} border-cyan-500/60 shadow-md`
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className={`p-2 rounded-xl border mt-0.5 ${meta.badgeBg} ${meta.badgeBorder}`}>
                          {r === 'admin' && <ShieldCheck className="w-4 h-4 text-purple-400" />}
                          {r === 'cashier' && <CreditCard className="w-4 h-4 text-emerald-400" />}
                          {r === 'technician' && <Wrench className="w-4 h-4 text-amber-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`font-bold text-xs ${isSelected ? meta.textColor : 'text-slate-200'}`}>
                              {meta.label}
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
                          </div>
                          <span className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug block">
                            {meta.description}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Initial Password & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-300">Default Password</label>
                    <button
                      type="button"
                      onClick={() => setFormPassword(generateRandomPassword())}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" /> Generate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full pl-3.5 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Account Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as 'active' | 'suspended')}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500/60 cursor-pointer"
                  >
                    <option value="active">Active (Access Allowed)</option>
                    <option value="suspended">Suspended (Access Revoked)</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Internal Notes & Assignment Area
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Counter 1 Billing Officer / District 2 Fiber Lineman"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              {/* Auto Whitelist SSO */}
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={autoWhitelist}
                  onChange={(e) => setAutoWhitelist(e.target.checked)}
                  className="rounded text-cyan-600 focus:ring-cyan-500 h-4 w-4 bg-slate-900 border-slate-700"
                />
                <span className="text-[11px]">
                  Pre-authorize email for Google Single Sign-On (SSO) login
                </span>
              </label>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
                >
                  {editingStaff ? 'Save Changes' : 'Register Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Staff Confirmation Modal */}
      {staffToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/30 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Remove Staff Account?</h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-200">{staffToDelete.fullName}</strong> (
              <span className="text-cyan-400">{staffToDelete.email}</span>)? Their access will be immediately revoked.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-colors cursor-pointer text-xs shadow-lg shadow-rose-600/30"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

