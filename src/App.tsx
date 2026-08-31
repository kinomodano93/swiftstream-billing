import React, { useState } from 'react';
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
import { PaymentList } from './components/payments/PaymentList';
import { PaymentTerminalModal } from './components/payments/PaymentTerminalModal';
import { OfficialReceiptModal } from './components/payments/OfficialReceiptModal';
import { PlanManager } from './components/plans/PlanManager';
import { CoverageAreaManager } from './components/network/CoverageAreaManager';
import { NapBoxManager } from './components/network/NapBoxManager';
import { MikrotikDeviceManager } from './components/network/MikrotikDeviceManager';
import { RepairOrderList } from './components/repairs/RepairOrderList';
import { RepairOrderModal } from './components/repairs/RepairOrderModal';
import { ReminderCenter } from './components/reminders/ReminderCenter';
import { FinancialReports } from './components/reports/FinancialReports';
import { SettingsModal } from './components/settings/SettingsModal';
import { ClientPortal } from './components/portal/ClientPortal';
import { HomePage } from './components/home/HomePage';
import { FieldTechHub } from './components/field/FieldTechHub';
import { GeminiAiAssistant } from './components/ai/GeminiAiAssistant';
import { AuthModal } from './components/auth/AuthModal';
import { ClientApplicationManager } from './components/portal/ClientApplicationManager';
import { RadiusAaaManager } from './components/network/RadiusAaaManager';
import { GenieAcsManager } from './components/network/GenieAcsManager';
import { IpoeDhcpManager } from './components/network/IpoeDhcpManager';
import { Customer, RepairOrder } from './types';

const MainLayout: React.FC = () => {
  const { activeTab, setActiveTab, customers, isAuthModalOpen, authModalMode, closeAuthModal } = useApp();
  // Modal States
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentCustomerId, setPaymentCustomerId] = useState<string | undefined>();
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | undefined>();
  const [portalCustomerId, setPortalCustomerId] = useState<string | null>(null);

  const [showCustomerModal, setShowCustomerModal] = useState<boolean>(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  const [showBatchBillingModal, setShowBatchBillingModal] = useState<boolean>(false);

  const [showRepairModal, setShowRepairModal] = useState<boolean>(false);
  const [repairToEdit, setRepairToEdit] = useState<RepairOrder | null>(null);

  // Quick Action Handlers
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

  // 1. PUBLIC WEBSITE HOME PAGE (Full Screen)
  if (activeTab === 'home') {
    return (
      <div id="home-root" className="h-screen w-screen overflow-y-auto scroll-smooth bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
        <HomePage
          onOpenClientPortal={(cid) => {
            if (cid) setPortalCustomerId(cid);
            setActiveTab('portal');
          }}
          onOpenAdminDashboard={() => setActiveTab('dashboard')}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={closeAuthModal}
          initialMode={authModalMode}
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
            setActiveTab('dashboard');
            setPortalCustomerId(null);
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
        />
        <NotificationToast />
      </div>
    );
  }

  // 3. ADMIN ERP OPERATIONS WORKSPACE (Sidebar + Header + Management Views)
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
        />

        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-900 to-slate-950">
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
              onOpenPaymentModal={(id) => handleOpenPayment(id)}
              onSelectCustomer={(id) => setSelectedCustomerId(id)}
            />
          )}

          {activeTab === 'mikrotik' && <MikrotikDeviceManager />}

          {activeTab === 'radius' && <RadiusAaaManager />}

          {activeTab === 'genieacs' && <GenieAcsManager />}

          {activeTab === 'ipoe_dhcp' && <IpoeDhcpManager />}

          {activeTab === 'billing' && (
            <InvoiceList
              onOpenBatchBillingModal={() => setShowBatchBillingModal(true)}
              onOpenPaymentModal={(cid, iid) => handleOpenPayment(cid, iid)}
              onSelectInvoice={(id) => setSelectedInvoiceId(id)}
              onSelectCustomer={(id) => setSelectedCustomerId(id)}
            />
          )}

          {activeTab === 'payments' && (
            <PaymentList
              onOpenPaymentModal={() => handleOpenPayment()}
              onSelectReceipt={(id) => setSelectedReceiptId(id)}
              onSelectCustomer={(id) => setSelectedCustomerId(id)}
            />
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

          {activeTab === 'settings' && <SettingsModal />}
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

      {showRepairModal && (
        <RepairOrderModal
          orderToEdit={repairToEdit}
          onClose={() => {
            setShowRepairModal(false);
            setRepairToEdit(null);
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
      />

      {/* Toast Notification Container */}
      <NotificationToast />
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}

export default App;

