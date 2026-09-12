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
import { Customer, RepairOrder, SYSTEM_ROLES_CONFIG } from './types';
import { isStaffUser } from './services/authService';
import { updateBrowserBrandIdentity } from './utils/brandLogo';
import { ShieldAlert, ArrowLeft, Lock, KeyRound, Globe, ShieldCheck } from 'lucide-react';

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
            if (isAuthorizedStaff) {
              setActiveTab('dashboard');
            } else {
              openAuthModal('signin');
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
            if (isAuthorizedStaff) {
              setActiveTab('dashboard');
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
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6 selection:bg-cyan-500 selection:text-white relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-md w-full p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6 text-center backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400 mx-auto shadow-lg shadow-cyan-950/50">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-950/60 border border-rose-800/50 text-rose-300">
              {currentAuthUser ? 'Subscriber Account - Staff Only' : 'Staff Authentication Required'}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-100">
              Operations Console Locked
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              {currentAuthUser
                ? `You are currently logged in as a subscriber (${currentAuthUser.email}). The operations dashboard and network telemetry modules are strictly restricted to authorized staff.`
                : 'You must be signed in with an authorized SwiftStream staff account (Admin, Cashier, or Field Technician) to access the operations workspace, subscriber records, and billing.'}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-600/25 transition-all hover:scale-[1.02] cursor-pointer flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>{currentAuthUser ? 'Switch to Staff Account' : 'Sign In to Operations Console'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold rounded-xl text-xs border border-slate-700/60 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Return to Public Website</span>
            </button>

            {currentAuthUser && currentAuthUser.role === 'subscriber' && (
              <button
                type="button"
                onClick={() => setActiveTab('portal')}
                className="w-full py-2.5 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 hover:text-white font-semibold rounded-xl text-xs border border-cyan-800/60 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Go to My Subscriber Portal &rarr;</span>
              </button>
            )}
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
              <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-5 shadow-2xl shadow-rose-950/50">
                <ShieldAlert className="w-12 h-12" />
              </div>
              <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider bg-rose-950/60 border border-rose-800/50 text-rose-300 mb-3">
                Access Restricted
              </span>
              <h2 className="text-2xl font-bold text-white mb-2">Module Not Authorized</h2>
              <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
                Your current role (<strong className="text-cyan-400">{SYSTEM_ROLES_CONFIG[systemRole]?.label || systemRole}</strong>) does not have permission to view the <span className="font-mono text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded">{activeTab}</span> module.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab(canAccessTab('dashboard') ? 'dashboard' : 'billing')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {canAccessTab('dashboard') ? 'Return to Dashboard' : 'Return to Billing & Invoices'}
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

