import React, { useState } from 'react';
import { X, Wrench, Plus, Trash2, Check, User, DollarSign } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RepairOrder, RepairPart, RepairStatus } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface RepairOrderModalProps {
  orderToEdit?: RepairOrder | null;
  onClose: () => void;
}

export const RepairOrderModal: React.FC<RepairOrderModalProps> = ({ orderToEdit, onClose }) => {
  const { customers, addRepairOrder, updateRepairOrder, businessProfile } = useApp();

  const isEditing = !!orderToEdit;

  const [customerId, setCustomerId] = useState(orderToEdit?.customerId || '');
  const [customerName, setCustomerName] = useState(orderToEdit?.customerName || '');
  const [contactNumber, setContactNumber] = useState(orderToEdit?.contactNumber || '09');
  const [address, setAddress] = useState(orderToEdit?.address || 'Binauahan, Lagonoy, Cam. Sur');
  const [deviceType, setDeviceType] = useState<RepairOrder['deviceType']>(
    orderToEdit?.deviceType || 'ONU/Router'
  );
  const [issueDescription, setIssueDescription] = useState(orderToEdit?.issueDescription || '');
  const [diagnosisNotes, setDiagnosisNotes] = useState(orderToEdit?.diagnosisNotes || '');
  const [technician, setTechnician] = useState(
    orderToEdit?.technician || 'Leonardo Flojo (IT Lead)'
  );
  const [status, setStatus] = useState<RepairStatus>(orderToEdit?.status || 'received');
  const [laborCost, setLaborCost] = useState<number>(orderToEdit?.laborCost || 350);
  const [parts, setParts] = useState<RepairPart[]>(
    orderToEdit?.partsUsed || []
  );

  // New part temp state
  const [newPartName, setNewPartName] = useState('');
  const [newPartCost, setNewPartCost] = useState<number>(0);
  const [newPartQty, setNewPartQty] = useState<number>(1);

  // Handle customer picker auto-fill
  const handleSelectCustomer = (id: string) => {
    setCustomerId(id);
    if (id) {
      const cust = customers.find((c) => c.id === id);
      if (cust) {
        setCustomerName(cust.fullName);
        setContactNumber(cust.mobile);
        setAddress(`${cust.address.street}, Brgy. ${cust.address.barangay}`);
      }
    }
  };

  const handleAddPart = () => {
    if (!newPartName.trim() || newPartCost <= 0) return;
    setParts((prev) => [...prev, { name: newPartName, cost: newPartCost, quantity: newPartQty }]);
    setNewPartName('');
    setNewPartCost(0);
    setNewPartQty(1);
  };

  const handleRemovePart = (index: number) => {
    setParts((prev) => prev.filter((_, i) => i !== index));
  };

  const partsTotal = parts.reduce((sum, p) => sum + p.cost * p.quantity, 0);
  const grandTotal = laborCost + partsTotal;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim() || !contactNumber.trim() || !issueDescription.trim()) {
      alert('Please fill in customer name, phone number, and issue description.');
      return;
    }

    if (isEditing && orderToEdit) {
      updateRepairOrder(orderToEdit.id, {
        customerId: customerId || undefined,
        customerName,
        contactNumber,
        address,
        deviceType,
        issueDescription,
        diagnosisNotes,
        technician,
        status,
        laborCost,
        partsUsed: parts,
        totalCost: grandTotal,
      });
    } else {
      const orderNum = `REP-${new Date().getFullYear().toString().slice(2)}${String(Math.floor(Math.random() * 900) + 100)}`;

      addRepairOrder({
        orderNumber: orderNum,
        customerId: customerId || undefined,
        customerName,
        contactNumber,
        address,
        deviceType,
        issueDescription,
        diagnosisNotes,
        technician,
        status,
        laborCost,
        partsUsed: parts,
        totalCost: grandTotal,
        dateReceived: new Date().toISOString(),
        isPaid: false,
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
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                {isEditing ? 'Edit Service Job Ticket' : 'Create Repair & Field Job Order'}
              </h3>
              <p className="text-xs text-slate-400">
                Record hardware fixes, drop wire splicing, and parts replacement fees.
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* Customer Selection or Walk-in */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Link to Fiber Subscriber (Optional)</label>
            <select
              value={customerId}
              onChange={(e) => handleSelectCustomer(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
            >
              <option value="">-- Walk-in Shop Client (Not Subscribed) --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} ({c.accountNo})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Client / Contact Name *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Full Name"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Mobile Phone *</label>
              <input
                type="text"
                required
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="0917xxxxxxx"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Device / Issue Category</label>
              <select
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="ONU/Router">ONU / Fiber Modem</option>
                <option value="Fiber Line Cut">Fiber Line Drop / Splicing</option>
                <option value="Desktop/Laptop">Desktop / Laptop PC Repair</option>
                <option value="Power Adapter">Power Adapter / Voltage Issue</option>
                <option value="Switch/AP">Switch / Outdoor Access Point</option>
                <option value="Other">Other Electronic Device</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Assigned Technician</label>
              <input
                type="text"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Problem / Issue Description *</label>
            <textarea
              rows={2}
              required
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="Describe symptoms (e.g. Red LOS light blinking, drop wire severed by truck, laptop no power)..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Technician Diagnosis & Action Taken</label>
            <textarea
              rows={2}
              value={diagnosisNotes}
              onChange={(e) => setDiagnosisNotes(e.target.value)}
              placeholder="Re-spliced with 2x SC connectors, replaced blown capacitor..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Parts Used Section */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 uppercase text-[11px]">
                Replacement Parts & Materials
              </span>
              <span className="font-mono text-cyan-400">Parts Subtotal: {formatCurrency(partsTotal)}</span>
            </div>

            {parts.length > 0 && (
              <div className="space-y-1.5">
                {parts.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800"
                  >
                    <span className="text-slate-200">
                      {p.name} (x{p.quantity}) @ {formatCurrency(p.cost)} ea
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-300">
                        {formatCurrency(p.cost * p.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePart(idx)}
                        className="text-rose-400 hover:text-rose-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Part Row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
              <input
                type="text"
                value={newPartName}
                onChange={(e) => setNewPartName(e.target.value)}
                placeholder="Part Name (e.g. SC Connector)"
                className="sm:col-span-2 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
              />
              <input
                type="number"
                value={newPartCost || ''}
                onChange={(e) => setNewPartCost(Number(e.target.value))}
                placeholder="Price (PHP)"
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 font-mono"
              />
              <button
                type="button"
                onClick={handleAddPart}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 rounded-lg font-semibold flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Part</span>
              </button>
            </div>
          </div>

          {/* Pricing & Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Labor & Diagnostics Fee (PHP ₱)</label>
              <input
                type="number"
                value={laborCost}
                onChange={(e) => setLaborCost(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono font-bold focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Job Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RepairStatus)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="received">Received / Logged</option>
                <option value="diagnosing">Diagnosing</option>
                <option value="in_progress">In Progress</option>
                <option value="ready">Ready for Pickup / Fixed</option>
                <option value="completed">Completed & Released</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Total Fee Banner */}
          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 flex items-center justify-between">
            <span className="font-bold text-slate-200">TOTAL SERVICE CHARGE:</span>
            <span className="font-mono font-black text-base text-cyan-300">
              {formatCurrency(grandTotal)}
            </span>
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
              <span>{isEditing ? 'Save Job Changes' : 'Create Job Ticket'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

