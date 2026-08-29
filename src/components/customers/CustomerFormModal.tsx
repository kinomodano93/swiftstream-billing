import React, { useState } from 'react';
import { X, User, MapPin, Wifi, Layers, Calendar, Check, Network } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, CustomerStatus } from '../../types';

interface CustomerFormModalProps {
  customerToEdit?: Customer | null;
  onClose: () => void;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  customerToEdit,
  onClose,
}) => {
  const { addCustomer, updateCustomer, plans, napBoxes, businessProfile } = useApp();

  const isEditing = !!customerToEdit;

  const [fullName, setFullName] = useState(customerToEdit?.fullName || '');
  const [mobile, setMobile] = useState(customerToEdit?.mobile || '09');
  const [email, setEmail] = useState(customerToEdit?.email || '');
  const [street, setStreet] = useState(customerToEdit?.address.street || '');
  const [barangay, setBarangay] = useState(customerToEdit?.address.barangay || 'Binauahan');
  const [city, setCity] = useState(customerToEdit?.address.city || businessProfile.address.city);
  const [province, setProvince] = useState(customerToEdit?.address.province || businessProfile.address.province);
  const [landmark, setLandmark] = useState(customerToEdit?.address.landmark || '');

  const defaultPlan = plans[0];
  const [selectedPlanId, setSelectedPlanId] = useState(customerToEdit?.planId || defaultPlan?.id || '');
  const [billingDay, setBillingDay] = useState<number>(customerToEdit?.billingDay || 1);
  const [status, setStatus] = useState<CustomerStatus>(customerToEdit?.status || 'active');

  // Network details
  const [pppoeUsername, setPppoeUsername] = useState(
    customerToEdit?.network.pppoeUsername || ''
  );
  const [ipAddress, setIpAddress] = useState(
    customerToEdit?.network.ipAddress || '192.168.10.' + Math.floor(Math.random() * 200 + 10)
  );
  const [selectedNapBoxId, setSelectedNapBoxId] = useState(
    customerToEdit?.network.napBoxId || napBoxes[0]?.id || ''
  );
  const [napPortNumber, setNapPortNumber] = useState<number>(
    customerToEdit?.network.napPortNumber || 1
  );
  const [onuSerial, setOnuSerial] = useState(customerToEdit?.network.onuSerial || 'HWTC-' + Math.random().toString(36).substring(2, 10).toUpperCase());
  const [routerModel, setRouterModel] = useState(customerToEdit?.network.routerModel || 'Huawei EG8145V5 Dual Band');

  // When full name changes, auto-suggest PPPoE username if empty
  const handleNameChange = (val: string) => {
    setFullName(val);
    if (!isEditing && !pppoeUsername) {
      const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 16);
      if (slug) setPppoeUsername(`swift_${slug}`);
    }
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || defaultPlan;
  const currentNapBox = napBoxes.find((b) => b.id === selectedNapBoxId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !mobile.trim()) {
      alert('Please provide customer full name and mobile number.');
      return;
    }

    if (isEditing && customerToEdit) {
      updateCustomer(customerToEdit.id, {
        fullName,
        mobile,
        email,
        address: {
          street,
          barangay,
          city,
          province,
          landmark,
        },
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        monthlyFee: selectedPlan.monthlyFee,
        billingDay,
        status,
        network: {
          ...customerToEdit.network,
          pppoeUsername: pppoeUsername || `swift_${customerToEdit.accountNo.toLowerCase()}`,
          ipAddress,
          napBoxId: selectedNapBoxId,
          napPortNumber,
          onuSerial,
          routerModel,
        },
      });
    } else {
      const year = new Date().getFullYear();
      const accountNo = `SWIFT-${year}-${String(Math.floor(Math.random() * 900) + 100)}`;

      addCustomer({
        accountNo,
        fullName,
        mobile,
        email,
        address: {
          street,
          barangay,
          city,
          province,
          landmark,
        },
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        monthlyFee: selectedPlan.monthlyFee,
        billingDay,
        status: 'active',
        installationDate: new Date().toISOString().slice(0, 10),
        balance: 0,
        advanceDeposit: 0,
        network: {
          pppoeUsername: pppoeUsername || `swift_${accountNo.toLowerCase()}`,
          ipAddress,
          napBoxId: selectedNapBoxId,
          napPortNumber,
          onuSerial,
          routerModel,
          vlanId: '100',
          oltPonPort: 'PON-1/1',
          isMikrotikSynced: true,
        },
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                {isEditing ? 'Edit Subscriber Details' : 'Register New Subscriber'}
              </h3>
              <p className="text-xs text-slate-400">
                Configure account, bandwidth plan, and fiber drop box assignment.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {/* Section 1: Customer Profile */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2 text-cyan-400">
              <User className="w-3.5 h-3.5" />
              <span>1. Customer Personal Information</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Mobile Number (PH) *</label>
                <input
                  type="text"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="0917xxxxxxx"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1 font-medium">Email Address (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@gmail.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Address & Location */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2 text-rose-400">
              <MapPin className="w-3.5 h-3.5" />
              <span>2. Installation Address & Landmark</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Street / Zone / Purok *</label>
                <input
                  type="text"
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Purok 2, Main Street"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Barangay *</label>
                <input
                  type="text"
                  required
                  value={barangay}
                  onChange={(e) => setBarangay(e.target.value)}
                  placeholder="Binauahan / Poblacion"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">City / Municipality</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Landmark (Crucial for Techs)</label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near Lagonoy cockpit arena, yellow gate"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Plan & Subscription */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2 text-cyan-400">
              <Layers className="w-3.5 h-3.5" />
              <span>3. Internet Service Plan & Billing Schedule</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Select Internet Plan *</label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ₱{p.monthlyFee.toLocaleString()}/mo ({p.speedMbps} Mbps)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Monthly Billing Cut-Off Day</label>
                <select
                  value={billingDay}
                  onChange={(e) => setBillingDay(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value={1}>1st of Month (Due 10th)</option>
                  <option value={5}>5th of Month (Due 15th)</option>
                  <option value={10}>10th of Month (Due 20th)</option>
                  <option value={15}>15th of Month (Due 25th)</option>
                  <option value={20}>20th of Month (Due 30th)</option>
                  <option value={25}>25th of Month (Due 5th next mo)</option>
                </select>
              </div>

              {isEditing && (
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Account Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="active">Active (Normal)</option>
                    <option value="overdue">Overdue (Grace Period)</option>
                    <option value="suspended">Suspended (Cut Off)</option>
                    <option value="disconnected">Disconnected</option>
                    <option value="pending_install">Pending Installation</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Network & Hardware Provisioning */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-2 text-purple-400">
              <Network className="w-3.5 h-3.5" />
              <span>4. Network Provisioning & Fiber NAP Port</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">PPPoE Username</label>
                <input
                  type="text"
                  value={pppoeUsername}
                  onChange={(e) => setPppoeUsername(e.target.value)}
                  placeholder="swift_username"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Static / Assigned IP</label>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Fiber NAP Box Distribution Point</label>
                <select
                  value={selectedNapBoxId}
                  onChange={(e) => setSelectedNapBoxId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {napBoxes.map((box) => (
                    <option key={box.id} value={box.id}>
                      {box.code} ({box.name}) - Brgy. {box.barangay}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  NAP Port Number (1 to {currentNapBox?.totalPorts || 16})
                </label>
                <select
                  value={napPortNumber}
                  onChange={(e) => setNapPortNumber(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  {Array.from({ length: currentNapBox?.totalPorts || 16 }, (_, i) => i + 1).map((portNum) => {
                    const port = currentNapBox?.ports.find((p) => p.portNumber === portNum);
                    const isTaken = port?.status === 'occupied' && port.customerId !== customerToEdit?.id;
                    return (
                      <option key={portNum} value={portNum} disabled={isTaken}>
                        Port #{portNum} {isTaken ? `(Occupied: ${port?.customerName})` : '(Available)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">ONU Serial Number (ONT)</label>
                <input
                  type="text"
                  value={onuSerial}
                  onChange={(e) => setOnuSerial(e.target.value)}
                  placeholder="HWTC-XXXXXXXX"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Router / Modem Model</label>
                <input
                  type="text"
                  value={routerModel}
                  onChange={(e) => setRouterModel(e.target.value)}
                  placeholder="Huawei EG8145V5 Dual Band"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes' : 'Register Subscriber'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

