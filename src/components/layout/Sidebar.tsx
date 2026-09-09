import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  Layers,
  Network,
  Wrench,
  Send,
  BarChart3,
  Settings,
  Radio,
  Wifi,
  ChevronRight,
  Globe,
  LogOut,
  Server,
  Smartphone,
  X,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  FileCheck2,
  ShieldCheck,
  Cable,
  CheckCircle2,
  Receipt,
  ScrollText,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SYSTEM_ROLES_CONFIG } from '../../types';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    customers,
    invoices,
    repairOrders,
    businessProfile,
    logout,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    coverageAreas,
    paymentSubmissions,
    systemRole,
    canAccessTab,
    staffUsers,
  } = useApp();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('swiftstream_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setIsCollapsed((prev: boolean) => {
      const next = !prev;
      try {
        localStorage.setItem('swiftstream_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const activeSubscribers = customers.filter((c) => c.status === 'active').length;
  const overdueCount = customers.filter((c) => c.status === 'overdue' || c.status === 'suspended').length;
  const unpaidInvoicesCount = invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue').length;
  const openRepairsCount = repairOrders.filter((r) => r.status !== 'completed' && r.status !== 'closed' && r.status !== 'cancelled').length;
  const pendingInstallsCount = customers.filter((c) => c.status === 'pending_install').length;
  const fiberReadyCount = coverageAreas.filter((a) => a.status === 'fiber_ready').length;
  const pendingProofsCount = paymentSubmissions.filter((s) => s.status === 'pending_review').length;

  interface NavItem {
    id: string;
    label: string;
    icon: any;
    badge?: string | null;
    badgeColor?: string;
  }

  interface NavGroup {
    id: string;
    category: string;
    items: NavItem[];
  }

  const navGroups: NavGroup[] = [
    {
      id: 'operations',
      category: 'Operations & CRM',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard & KPI',
          icon: LayoutDashboard,
          badge: null,
        },
        {
          id: 'customers',
          label: 'Subscribers CRM',
          icon: Users,
          badge: overdueCount > 0 ? `${overdueCount} due` : `${activeSubscribers}`,
          badgeColor: overdueCount > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400',
        },
        {
          id: 'applications',
          label: 'Online Applications',
          icon: FileCheck2,
          badge: 'New',
          badgeColor: 'bg-cyan-500/20 text-cyan-300 font-bold font-mono',
        },
        {
          id: 'field_ops',
          label: 'Field Tech & Installs',
          icon: Smartphone,
          badge: pendingInstallsCount > 0 ? `${pendingInstallsCount} new` : 'PWA',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 font-bold font-mono',
        },
        {
          id: 'repairs',
          label: 'Repair Shop Orders',
          icon: Wrench,
          badge: openRepairsCount > 0 ? `${openRepairsCount}` : null,
          badgeColor: 'bg-cyan-500/20 text-cyan-300',
        },
      ],
    },
    {
      id: 'billing',
      category: 'Billing & Finance',
      items: [
        {
          id: 'billing',
          label: 'Billing & Invoices',
          icon: FileText,
          badge: unpaidInvoicesCount > 0 ? `${unpaidInvoicesCount}` : null,
          badgeColor: 'bg-rose-500/20 text-rose-300',
        },
        {
          id: 'payments',
          label: 'Cashier & POS',
          icon: CreditCard,
          badge: null,
        },
        {
          id: 'verification_queue',
          label: 'Payment Verifications',
          icon: CheckCircle2,
          badge: pendingProofsCount > 0 ? `${pendingProofsCount} pending` : null,
          badgeColor: 'bg-amber-500/20 text-amber-300 font-bold font-mono animate-pulse',
        },
        {
          id: 'plans',
          label: 'Plans & Packages',
          icon: Layers,
          badge: null,
        },
        {
          id: 'reports',
          label: 'Financial Reports',
          icon: BarChart3,
          badge: null,
        },
        {
          id: 'transaction_logs',
          label: 'Transaction Ledger',
          icon: Receipt,
          badge: 'Ledger',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 font-bold font-mono',
        },
      ],
    },
    {
      id: 'network',
      category: 'Network Infrastructure',
      items: [
        {
          id: 'mikrotik',
          label: 'MikroTik Routers',
          icon: Server,
          badge: 'Online',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 font-bold font-mono',
        },
        {
          id: 'ipoe_dhcp',
          label: 'IPoE / DHCP Leases',
          icon: Cable,
          badge: null,
        },
        {
          id: 'network',
          label: 'NAP Box & Fiber Map',
          icon: Network,
          badge: null,
        },
        {
          id: 'coverage',
          label: 'Coverage Areas',
          icon: MapPin,
          badge: `${fiberReadyCount} Ready`,
          badgeColor: 'bg-emerald-500/20 text-emerald-300 font-bold font-mono',
        },
      ],
    },
    {
      id: 'system',
      category: 'System & Automation',
      items: [
        {
          id: 'reminders',
          label: 'SMS & Email Blast',
          icon: Send,
          badge: null,
        },
        {
          id: 'staff_users',
          label: 'Staff & Roles',
          icon: Users,
          badge: `${staffUsers.length}`,
          badgeColor: 'bg-purple-500/20 text-purple-300 font-bold font-mono',
        },
        {
          id: 'system_logs',
          label: 'Admin & System Logs',
          icon: ScrollText,
          badge: 'Audit',
          badgeColor: 'bg-cyan-500/20 text-cyan-300 font-bold font-mono',
        },
        {
          id: 'settings',
          label: 'Business Settings',
          icon: Settings,
          badge: null,
        },
      ],
    },
  ];

  const roleMeta = SYSTEM_ROLES_CONFIG[systemRole] || SYSTEM_ROLES_CONFIG.admin;

  const filteredNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessTab(item.id)),
    }))
    .filter((group) => group.items.length > 0);

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Responsive Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-slate-900 border-r border-slate-800 flex flex-col h-screen select-none transform transition-all duration-300 ease-in-out lg:static lg:translate-x-0 lg:z-auto flex-shrink-0 ${
          isMobileMenuOpen ? 'translate-x-0 w-72 shadow-2xl shadow-cyan-950/40' : '-translate-x-full'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* Brand Header */}
        <div className={`p-4 border-b border-slate-800/80 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              onClick={() => setActiveTab('dashboard')}
              className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/60 flex items-center justify-center shadow-lg shadow-cyan-500/10 shrink-0 cursor-pointer overflow-hidden p-1"
              title={businessProfile.name || 'ISP ERP'}
            >
              {businessProfile.logoUrl ? (
                <img
                  src={businessProfile.logoUrl}
                  alt={businessProfile.tradeName || 'Logo'}
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <div className="w-full h-full rounded-lg bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 flex items-center justify-center">
                  <Radio className="w-5 h-5 text-white animate-pulse" />
                </div>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-in fade-in duration-200">
                <h1 className="font-bold text-sm text-slate-100 tracking-tight leading-tight truncate">
                  {businessProfile.tradeName || businessProfile.name || 'SwiftStream'}
                </h1>
                <p className="text-[10px] text-cyan-400 font-medium tracking-wide truncate uppercase">
                  {businessProfile.industry || 'TELECOM & ISP'}
                </p>
              </div>
            )}
          </div>

          {/* Desktop Collapse / Expand Toggle Button */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition-all cursor-pointer"
            title={isCollapsed ? 'Expand Sidebar (260px)' : 'Collapse Sidebar to Icon Rail (72px)'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-cyan-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          {/* Close button for Mobile drawer */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Location & Active Role Tag (Only when expanded) */}
        {!isCollapsed && (
          <div className="px-4 pt-3 pb-1 animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="truncate">{businessProfile.address.city || 'Lagonoy'}, {businessProfile.address.province || 'Cam Sur'}</span>
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${roleMeta.badgeBg} ${roleMeta.badgeBorder} ${roleMeta.textColor}`}>
                {roleMeta.badge}
              </span>
            </div>
          </div>
        )}

        {/* Navigation Links Grouped by Functional Categories */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-800">
          {filteredNavGroups.map((group, groupIdx) => (
            <div key={group.id} className="space-y-1">
              {!isCollapsed ? (
                <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400/80 flex items-center justify-between select-none">
                  <span>{group.category}</span>
                  <span className="text-[9px] font-mono text-slate-500 font-normal">{group.items.length}</span>
                </div>
              ) : (
                groupIdx > 0 && <div className="my-2 border-t border-slate-800/80 mx-2" />
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    title={item.label}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center p-3' : 'justify-between px-3 py-2'
                    } rounded-xl text-xs font-medium transition-all group cursor-pointer ${
                      isActive
                        ? 'bg-cyan-600/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} min-w-0`}>
                      <div className="relative">
                        <Icon
                          className={`w-4 h-4 transition-transform group-hover:scale-110 shrink-0 ${
                            isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        {isCollapsed && item.badge && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-slate-900" />
                        )}
                      </div>
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!isCollapsed && (
                      <div className="flex items-center gap-1.5">
                        {item.badge && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        )}
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Network Status Banner & Sign Out */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
          {!isCollapsed ? (
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  Mikrotik Core
                </span>
                <span className="text-emerald-400 font-mono text-[10px] font-semibold">ONLINE</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>TIN No:</span>
                <span className="font-mono text-[10px] text-slate-300">{businessProfile.tin}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Rep:</span>
                <span className="text-[10px] text-slate-300 truncate max-w-[120px] text-right">
                  {businessProfile.representative.firstName} {businessProfile.representative.lastName}
                </span>
              </div>
            </div>
          ) : (
            <div
              className="flex justify-center p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-[10px]"
              title="MikroTik Core Router Online"
            >
              <Wifi className="w-4 h-4 text-emerald-400" />
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              setActiveTab('home');
            }}
            className={`w-full flex items-center justify-center gap-2 ${
              isCollapsed ? 'p-2.5' : 'py-2 px-3'
            } bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/30 rounded-xl text-xs font-semibold transition-all group cursor-pointer`}
            title="View Public Website & Plans"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            {!isCollapsed && <span>Public Website</span>}
          </button>

          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              logout();
            }}
            className={`w-full flex items-center justify-center gap-2 ${
              isCollapsed ? 'p-2.5' : 'py-2 px-3'
            } bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/50 rounded-xl text-xs font-semibold transition-all group cursor-pointer`}
            title="Sign out of Admin Session"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-400 shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
