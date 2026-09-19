import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { NotificationToast } from './components/layout/NotificationToast';
import { Dashboard } from './components/dashboard/Dashboard';
import { CustomerList } from './components/customers/CustomerList';
import { CustomerDetailModal } from './components/customers/CustomerDetailModal';
import { CustomerFormModal } from './components/customers/CustomerFormModal';
import { InvoiceList } from './components/billing/InvoiceList';
import { InvoiceDetailModal } from './components/billing/InvoiceDetailModal';
import { BatchBillingModal } from './components/billing/BatchBillingModal';
import { CreateManualInvoiceModal } from './components/billing/CreateManualInvoiceModal';
import { PaymentList } from './components/payments/PaymentList';
import { PaymentTerminalModal } from './components/payments/PaymentTerminalModal';
import { PaymentVerificationQueue } from './components/payments/PaymentVerificationQueue';
import { OfficialReceiptModal } from './components/payments/OfficialReceiptModal';
import { PlanManager } from './components/plans/PlanManager';
import { CoverageAreaManager } from './components/network/CoverageAreaManager';
import { NapBoxManager } from './components/network/NapBoxManager';
import { MikrotikDeviceManager } from './components/network/MikrotikDeviceManager';
import { MikrotikTerminalModal } from './components/network/MikrotikTerminalModal';
import { RepairOrderList } from './components/repairs/RepairOrderList';
import { RepairOrderModal } from './components/repairs/RepairOrderModal';
import { ReminderCenter } from './components/reminders/ReminderCenter';
import { FinancialReports } from './components/reports/FinancialReports';
import { OperationalBillCalendar } from './components/calendar/OperationalBillCalendar';
import { SettingsModal } from './components/settings/SettingsModal';
import { ClientPortal } from './components/portal/ClientPortal';
import { HomePage } from './components/home/HomePage';
import { FieldTechHub } from './components/field/FieldTechHub';
import { GeminiAiAssistant } from './components/ai/GeminiAiAssistant';
import { AuthModal } from './components/auth/AuthModal';
import { ClientApplicationManager } from './components/portal/ClientApplicationManager';
import { IpoeDhcpManager } from './components/network/IpoeDhcpManager';
import { StaffUserManager } from './components/users/StaffUserManager';
import { SystemLogsViewer } from './components/logs/SystemLogsViewer';
import { FinancialTransactionLogs } from './components/logs/FinancialTransactionLogs';
import { Customer, RepairOrder, SYSTEM_ROLES_CONFIG, SystemRole, ADMIN_ONLY_TABS, isAdminTab } from './types';
import { isStaffUser, isAdminUser } from './services/authService';
import { updateBrowserBrandIdentity } from './utils/brandLogo';
import { ShieldAlert, ArrowLeft, Lock, KeyRound, Globe, ShieldCheck, AlertTriangle } from 'lucide-react';

const MainLayout: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    customers,
    isAuthModalOpen,
    authModalMode,
    authModalEmail,
    authModalPlanId,
    authModalBarangay,
    authModalMunicipality,
    openAuthModal,
    closeAuthModal,
    currentAuthUser,
    systemRole,
    canAccessTab,
    isAuthReady,
    logout,
    showToast,
  } = useApp();
  // Modal States
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentCustomerId, setPaymentCustomerId] = useState<string | undefined>();
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | undefined>();
  const [portalCustomerId, setPortalCustomerId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('swiftstream_portal_customer_id');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (portalCustomerId) {
        sessionStorage.setItem('swiftstream_portal_customer_id', portalCustomerId);
      } else {
        sessionStorage.removeItem('swiftstream_portal_customer_id');
      }
    } catch {}
  }, [portalCustomerId]);

  const [showCustomerModal, setShowCustomerModal] = useState<boolean>(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const [showBatchBillingModal, setShowBatchBillingModal] = useState<boolean>(false);
  const [showManualInvoiceModal, setShowManualInvoiceModal] = useState<boolean>(false);
  const [manualInvoiceCustomerId, setManualInvoiceCustomerId] = useState<string | undefined>(undefined);

  const [showRepairModal, setShowRepairModal] = useState<boolean>(false);
  const [repairToEdit, setRepairToEdit] = useState<RepairOrder | null>(null);
  const [showTerminalModal, setShowTerminalModal] = useState<boolean>(false);
  const [terminalDeviceId, setTerminalDeviceId] = useState<string | undefined>(undefined);

  // Quick Action Handlers
  const handleOpenTerminal = (deviceId?: string) => {
    setTerminalDeviceId(deviceId);
    setShowTerminalModal(true);
  };
  const handleOpenPayment = (customerId?: string, invoiceId?: string) => {
    setPaymentCustomerId(customerId);
    setPaymentInvoiceId(invoiceId);
    setShowPaymentModal(true);
  };

  const handleOpenCustomerModal = (cust?: Customer) => {
    setCustomerToEdit(cust || null);
    setShowCustomerModal(true);
  };

  const handleOpenRepairModal = (repair?: RepairOrder) => {
    setRepairToEdit(repair || null);
    setShowRepairModal(true);
  };

  const isAuthorizedStaff = isStaffUser(currentAuthUser);

  // 1. PUBLIC WEBSITE HOME PAGE (Full Screen)
  if (activeTab === 'home') {
    return (
      <div id="home-root" className="h-screen w-screen overflow-y-auto scroll-smooth bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
        <HomePage
          onOpenClientPortal={(cid) => {
            if (cid) setPortalCustomerId(cid);
            setActiveTab('portal');
          }}
          onOpenAdminDashboard={() => {
            if (!currentAuthUser) {
              openAuthModal('signin');
            } else if (currentAuthUser.role === 'admin') {
              setActiveTab('dashboard');
            } else if (currentAuthUser.role === 'cashier') {
              setActiveTab('billing');
            } else if (currentAuthUser.role === 'technician' || currentAuthUser.role === 'tech') {
              setActiveTab('field_ops');
            } else {
              showToast('error', 'Administrator Access Restricted', 'Subscriber accounts cannot access the administrative operations console.');
              setActiveTab('portal');
            }
          }}
          onOpenSignIn={(email) => openAuthModal('signin', email)}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={closeAuthModal}
          initialMode={authModalMode}
          initialEmail={authModalEmail}
          initialPlanId={authModalPlanId}
          initialBarangay={authModalBarangay}
          initialMunicipality={authModalMunicipality}
        />
        <NotificationToast />
      </div>
    );
  }

  // 2. SUBSCRIBER CLIENT PORTAL (Full Screen)
  if (activeTab === 'portal') {
    return (
      <div className="h-screen w-screen overflow-y-auto bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
        <ClientPortal
          initialCustomerId={portalCustomerId}
          onExitToAdmin={() => {
            if (currentAuthUser && currentAuthUser.role === 'admin') {
              setActiveTab('dashboard');
              setPortalCustomerId(null);
            } else if (currentAuthUser && currentAuthUser.role === 'cashier') {
              setActiveTab('billing');
              setPortalCustomerId(null);
            } else if (currentAuthUser && (currentAuthUser.role === 'technician' || currentAuthUser.role === 'tech')) {
              setActiveTab('field_ops');
              setPortalCustomerId(null);
            } else {
              openAuthModal('signin');
            }
          }}
          onExitToHome={() => {
            setActiveTab('home');
            setPortalCustomerId(null);
          }}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={closeAuthModal}
          initialMode={authModalMode}
          initialEmail={authModalEmail}
          initialPlanId={authModalPlanId}
          initialBarangay={authModalBarangay}
          initialMunicipality={authModalMunicipality}
        />
        <NotificationToast />
      </div>
    );
  }

  // While Firebase auth handshake is resolving on refresh / initial load, show clean loading state instead of false unauthorized lock
  if (!isAuthReady && activeTab !== 'home' && activeTab !== 'portal') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6 selection:bg-cyan-500 selection:text-white relative overflow-hidden">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-400 font-mono tracking-wide">Validating session...</p>
        </div>
      </div>
    );
  }

  // 3. SECURE AUTH GUARD FOR ADMIN & STAFF OPERATIONS WORKSPACE
  if (!isAuthorizedStaff) {
    if (!currentAuthUser) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6 selection:bg-cyan-500 selection:text-white relative overflow-hidden">
          {/* Ambient background glow */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-md w-full p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6 text-center backdrop-blur-xl">
            <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-950 to-slate-900 border border-cyan-700/50 flex items-center justify-center text-cyan-400 shadow-2xl shadow-cyan-950/80">
              <Lock className="w-9 h-9 text-cyan-400" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-slate-900 animate-ping" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-slate-900" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-950/60 border border-rose-800/50 text-rose-300">
                <ShieldAlert className="w-3 h-3 text-rose-400" />
                <span>Admin Guardrail • Authentication Mandatory</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-100">
                Administrator Authentication Required
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                The SwiftStream Administrative Console and network management workspaces are protected by strict access controls. Unauthenticated requests to administrative routes are blocked.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => openAuthModal('signin')}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-600/25 transition-all hover:scale-[1.02] cursor-pointer flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                <span>Sign In as Administrator</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold rounded-xl text-xs border border-slate-700/60 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Return to Public Website</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500 font-mono flex items-center justify-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
              <span>TLS 256-bit Encrypted • Zero Data Exposure</span>
            </div>
          </div>

          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={closeAuthModal}
            initialMode={authModalMode}
            initialEmail={authModalEmail}
            initialPlanId={authModalPlanId}
            initialBarangay={authModalBarangay}
            initialMunicipality={authModalMunicipality}
          />
          <NotificationToast />
        </div>
      );
    }

    // Subscriber account trying to view admin page
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6 selection:bg-cyan-500 selection:text-white relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-md w-full p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6 text-center backdrop-blur-xl">
          <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-950 to-slate-900 border border-amber-700/50 flex items-center justify-center text-amber-400 shadow-2xl shadow-amber-950/80">
            <ShieldAlert className="w-9 h-9 text-amber-400" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-950/60 border border-amber-800/50 text-amber-300">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Subscriber Account • Admin Console Restricted</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100">
              Administrator Clearance Required
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              You are currently authenticated as a subscriber (<strong className="text-cyan-300">{currentAuthUser.email}</strong>). The administrative dashboard, CRM, financial ledgers, and network telemetry modules are strictly restricted to verified ISP administrators.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('portal')}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-600/25 transition-all hover:scale-[1.02] cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Go to My Subscriber Portal &rarr;</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await logout();
                openAuthModal('signin');
              }}
              className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold rounded-xl text-xs border border-slate-700/60 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5 text-purple-400" />
              <span>Switch to Administrator Account</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="w-full py-2 bg-transparent hover:bg-slate-800/40 text-slate-400 hover:text-slate-300 font-medium rounded-xl text-xs transition-all cursor-pointer"
            >
              <span>Return to Public Website</span>
            </button>
          </div>
        </div>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={closeAuthModal}
          initialMode={authModalMode}
          initialEmail={authModalEmail}
          initialPlanId={authModalPlanId}
          initialBarangay={authModalBarangay}
          initialMunicipality={authModalMunicipality}
        />
        <NotificationToast />
      </div>
    );
  }

  // 4. ADMIN ERP OPERATIONS WORKSPACE (Sidebar + Header + Management Views)
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onOpenPaymentModal={() => handleOpenPayment()}
          onOpenCustomerModal={() => handleOpenCustomerModal()}
          onOpenBatchBillingModal={() => setShowBatchBillingModal(true)}
          onOpenTerminalModal={(devId) => handleOpenTerminal(devId)}
        />

        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-900 to-slate-950">
          {!canAccessTab(activeTab) ? (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center animate-in fade-in">
              <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-5 shadow-2xl shadow-rose-950/50 relative">
                <ShieldAlert className="w-12 h-12" />
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-slate-900 animate-ping" />
              </div>
              <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-rose-950/60 border border-rose-800/50 text-rose-300 mb-3">
                {isAdminTab(activeTab) ? 'Administrator Privilege Required' : 'Access Restricted'}
              </span>
              <h2 className="text-2xl font-bold text-white mb-2">
                {isAdminTab(activeTab) ? 'Administrative Module Restricted' : 'Module Not Authorized'}
              </h2>
              <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
                {isAdminTab(activeTab)
                  ? `The "${activeTab}" module contains restricted executive ISP controls and is accessible exclusively to verified Administrators. Your account role (${currentAuthUser?.role ? SYSTEM_ROLES_CONFIG[currentAuthUser.role as SystemRole]?.label || currentAuthUser.role : 'Staff'}) does not have sufficient clearance.`
                  : `Your current role does not have permission to view the "${activeTab}" module.`}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {currentAuthUser?.role === 'cashier' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('billing')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Return to Cashier Billing Desk</span>
                  </button>
                )}

                {(currentAuthUser?.role === 'technician' || currentAuthUser?.role === 'tech') && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('field_ops')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Return to Field Tech Hub</span>
                  </button>
                )}

                {currentAuthUser?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Return to Admin Dashboard</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    openAuthModal('signin');
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-purple-400" />
                  <span>Switch to Administrator</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard
                  onOpenPaymentModal={handleOpenPayment}
                  onOpenCustomerModal={() => handleOpenCustomerModal()}
                  onOpenBatchBillingModal={() => setShowBatchBillingModal(true)}
                  onOpenRepairModal={() => handleOpenRepairModal()}
                  onSelectCustomer={(id) => setSelectedCustomerId(id)}
                />
              )}

              {activeTab === 'applications' && <ClientApplicationManager />}

              {activeTab === 'field_ops' && <FieldTechHub />}

              {activeTab === 'customers' && (
                <CustomerList
                  onOpenCustomerModal={handleOpenCustomerModal}
                  onSelectCustomer={(id) => setSelectedCustomerId(id)}
                />
              )}

              {activeTab === 'mikrotik' && (
                <MikrotikDeviceManager
                  onOpenTerminal={handleOpenTerminal}
                  onSelectCustomer={(id) => setSelectedCustomerId(id)}
                />
              )}

              {activeTab === 'ipoe_dhcp' && <IpoeDhcpManager />}

              {activeTab === 'billing' && (
                <InvoiceList
                  onOpenBatchBillingModal={() => setShowBatchBillingModal(true)}
                  onOpenManualInvoiceModal={(cid?: string) => {
                    setManualInvoiceCustomerId(cid);
                    setShowManualInvoiceModal(true);
                  }}
                  onOpenPaymentModal={(cid, iid) => handleOpenPayment(cid, iid)}
                  onSelectInvoice={(id) => setSelectedInvoiceId(id)}
                  onSelectCustomer={(id) => setSelectedCustomerId(id)}
                />
              )}

              {activeTab === 'bill_calendar' && (
                <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 animate-in fade-in">
                  <OperationalBillCalendar />
                </div>
              )}

              {activeTab === 'payments' && (
                <PaymentList
                  onOpenPaymentModal={() => handleOpenPayment()}
                  onSelectReceipt={(id) => setSelectedReceiptId(id)}
                  onSelectCustomer={(id) => setSelectedCustomerId(id)}
                />
              )}

              {activeTab === 'verification_queue' && (
                <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 animate-in fade-in">
                  <PaymentVerificationQueue onSelectCustomer={(id) => setSelectedCustomerId(id)} />
                </div>
              )}

              {activeTab === 'plans' && <PlanManager />}

              {activeTab === 'coverage' && <CoverageAreaManager />}

              {activeTab === 'network' && (
                <NapBoxManager onSelectCustomer={(id) => setSelectedCustomerId(id)} />
              )}

              {activeTab === 'repairs' && (
                <RepairOrderList
                  onOpenRepairModal={handleOpenRepairModal}
                  onSelectCustomer={(id) => setSelectedCustomerId(id)}
                  onSelectInvoice={(id) => setSelectedInvoiceId(id)}
                />
              )}

              {activeTab === 'reminders' && <ReminderCenter />}

              {activeTab === 'reports' && <FinancialReports />}

              {activeTab === 'transaction_logs' && <FinancialTransactionLogs />}

              {activeTab === 'staff_users' && <StaffUserManager />}

              {activeTab === 'system_logs' && <SystemLogsViewer />}

              {activeTab === 'settings' && <SettingsModal />}
            </>
          )}
        </main>
      </div>

      {/* Global Modals */}
      {showPaymentModal && (
        <PaymentTerminalModal
          initialCustomerId={paymentCustomerId}
          initialInvoiceId={paymentInvoiceId}
          onClose={() => setShowPaymentModal(false)}
          onPaymentSuccess={(payId) => setSelectedReceiptId(payId)}
        />
      )}

      {showCustomerModal && (
        <CustomerFormModal
          customerToEdit={customerToEdit}
          onClose={() => {
            setShowCustomerModal(false);
            setCustomerToEdit(null);
          }}
        />
      )}

      {selectedCustomerId && (
        <CustomerDetailModal
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onOpenPaymentModal={(cid, iid) => handleOpenPayment(cid, iid)}
          onOpenEditModal={() => {
            const cust = customers.find((c) => c.id === selectedCustomerId);
            setSelectedCustomerId(null);
            handleOpenCustomerModal(cust);
          }}
          onSelectInvoice={(iid) => {
            setSelectedInvoiceId(iid);
          }}
        />
      )}

      {selectedInvoiceId && (
        <InvoiceDetailModal
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          onOpenPaymentModal={(cid, iid) => handleOpenPayment(cid, iid)}
        />
      )}

      {selectedReceiptId && (
        <OfficialReceiptModal
          paymentId={selectedReceiptId}
          onClose={() => setSelectedReceiptId(null)}
        />
      )}

      {showBatchBillingModal && (
        <BatchBillingModal onClose={() => setShowBatchBillingModal(false)} />
      )}

      {showManualInvoiceModal && (
        <CreateManualInvoiceModal
          preselectedCustomerId={manualInvoiceCustomerId}
          onClose={() => {
            setShowManualInvoiceModal(false);
            setManualInvoiceCustomerId(undefined);
          }}
        />
      )}

      {showRepairModal && (
        <RepairOrderModal
          orderToEdit={repairToEdit}
          onClose={() => {
            setShowRepairModal(false);
            setRepairToEdit(null);
          }}
        />
      )}

      {showTerminalModal && (
        <MikrotikTerminalModal
          initialDeviceId={terminalDeviceId}
          onClose={() => {
            setShowTerminalModal(false);
            setTerminalDeviceId(undefined);
          }}
        />
      )}

      {/* Admin Operations Gemini AI Copilot */}
      {activeTab !== 'home' && activeTab !== 'portal' && (
        <GeminiAiAssistant mode="admin" />
      )}

      {/* Firebase Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        initialMode={authModalMode}
        initialEmail={authModalEmail}
        initialPlanId={authModalPlanId}
        initialBarangay={authModalBarangay}
        initialMunicipality={authModalMunicipality}
      />

      {/* Toast Notification Container */}
      <NotificationToast />
    </div>
  );
};

const AppContent: React.FC = () => {
  const { businessProfile } = useApp();

  useEffect(() => {
    updateBrowserBrandIdentity(
      businessProfile?.logoUrl,
      businessProfile?.tradeName,
      businessProfile?.name
    );
  }, [businessProfile?.logoUrl, businessProfile?.tradeName, businessProfile?.name]);

  return <MainLayout />;
};

export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;

