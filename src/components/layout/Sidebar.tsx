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
  Router,
  Cable,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

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
  const openRepairsCount = repairOrders.filter((r) => r.status !== 'completed' && r.status !== 'cancelled').length;
  const pendingInstallsCount = customers.filter((c) => c.status === 'pending_install').length;
  const fiberReadyCount = coverageAreas.filter((a) => a.status === 'fiber_ready').length;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard & KPI',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'applications',
      label: 'Online Applications',
      icon: FileCheck2,
      badge: 'New',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 font-bold font-mono',
    },
    {
      id: 'customers',
      label: 'Subscribers CRM',
      icon: Users,
      badge: overdueCount > 0 ? `${overdueCount} due` : `${activeSubscribers}`,
      badgeColor: overdueCount > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400',
    },
    {
      id: 'field_ops',
      label: 'Field Tech & Installs',
      icon: Smartphone,
      badge: pendingInstallsCount > 0 ? `${pendingInstallsCount} new` : 'PWA',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 font-bold font-mono',
    },
    {
      id: 'mikrotik',
      label: 'MikroTik Routers',
      icon: Server,
      badge: 'Online',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 font-bold font-mono',
    },
    {
      id: 'radius',
      label: 'RADIUS / AAA',
      icon: ShieldCheck,
      badge: 'FreeRADIUS',
      badgeColor: 'bg-amber-500/20 text-amber-300 font-bold font-mono',
    },
    {
      id: 'genieacs',
      label: 'GenieACS (TR-069)',
      icon: Router,
      badge: 'ACS',
      badgeColor: 'bg-teal-500/20 text-teal-300 font-bold font-mono',
    },
    {
      id: 'ipoe_dhcp',
      label: 'IPoE / DHCP Leases',
      icon: Cable,
      badge: null,
    },
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
      id: 'plans',
      label: 'Plans & Packages',
      icon: Layers,
      badge: null,
    },
    {
      id: 'coverage',
      label: 'Coverage Areas',
      icon: MapPin,
      badge: `${fiberReadyCount} Ready`,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 font-bold font-mono',
    },
    {
      id: 'network',
      label: 'NAP Box & Fiber Map',
      icon: Network,
      badge: null,
    },
    {
      id: 'repairs',
      label: 'Repair Shop Orders',
      icon: Wrench,
      badge: openRepairsCount > 0 ? `${openRepairsCount}` : null,
      badgeColor: 'bg-cyan-500/20 text-cyan-300',
    },
    {
      id: 'reminders',
      label: 'SMS & Email Blast',
      icon: Send,
      badge: null,
    },
    {
      id: 'reports',
      label: 'Financial Reports',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'settings',
      label: 'Business Settings',
      icon: Settings,
      badge: null,
    },
  ];

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
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/20 shrink-0 cursor-pointer"
              title="SwiftStream Telecom ERP"
            >
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-in fade-in duration-200">
                <h1 className="font-bold text-sm text-slate-100 tracking-tight leading-tight truncate">
                  SwiftStream
                </h1>
                <p className="text-[10px] text-cyan-400 font-medium tracking-wide truncate">
                  TELECOM & REPAIR SHOP
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

        {/* Location & Status Tag (Only when expanded) */}
        {!isCollapsed && (
          <div className="px-4 pt-3 pb-1 animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="truncate">{businessProfile.address.city}, {businessProfile.address.province}</span>
              </span>
              <span className="text-[10px] font-mono bg-cyan-950/80 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800/50">
                ISP ERP
              </span>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                title={item.label}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center p-3' : 'justify-between px-3 py-2.5'
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
