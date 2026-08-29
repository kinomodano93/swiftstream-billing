import React, { useState } from 'react';
import {
  Zap,
  X,
  Radio,
  Wifi,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  User,
  Phone,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface ProvisionModalProps {
  customer: Customer;
  onClose: () => void;
}

export const ProvisionModal: React.FC<ProvisionModalProps> = ({ customer, onClose }) => {
  const { napBoxes, provisionSubscriber } = useApp();

  const [technician, setTechnician] = useState<string>('Leonardo Flojo Jr. (Lead Tech)');
  const [opticalPowerDbm, setOpticalPowerDbm] = useState<number>(-18.5);
  const [dropCableMeters, setDropCableMeters] = useState<number>(120);
  const [onuSerial, setOnuSerial] = useState<string>(
    customer.network.onuSerial && customer.network.onuSerial !== 'HWTC-NEWAPPLICANT'
      ? customer.network.onuSerial
      : `HWTC-${Math.floor(Math.random() * 899999 + 100000)}`
  );
  const [routerModel, setRouterModel] = useState<string>(
    customer.network.routerModel || 'Huawei EG8145V5 Dual-Band WiFi 6 ONU'
  );
  const [surveyNotes, setSurveyNotes] = useState<string>(
    `Field splice successful. Direct optical line hooked to ${customer.address.street}, ${customer.address.barangay}.`
  );
  const [createInitialInvoice, setCreateInitialInvoice] = useState<boolean>(true);

  // Optical dBm Quality Status
  const getSignalStatus = (dbm: number) => {
    if (dbm >= -22 && dbm <= -14) {
      return { label: 'Optimal / Excellent (-14 to -22 dBm)', color: 'text-emerald-400', bg: 'bg-emerald-950/60 border-emerald-500/40' };
    }
    if (dbm < -22 && dbm >= -26) {
      return { label: 'Acceptable / Moderate (-23 to -26 dBm)', color: 'text-amber-400', bg: 'bg-amber-950/60 border-amber-500/40' };
    }
    return { label: 'Critical / High Attenuation (≤ -27 dBm)', color: 'text-rose-400', bg: 'bg-rose-950/60 border-rose-500/40' };
  };

  const signal = getSignalStatus(opticalPowerDbm);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    provisionSubscriber(customer.id, {
      technician,
      opticalPowerDbm,
      dropCableMeters,
      onuSerial,
      routerModel,
      surveyNotes,
      createInitialInvoice,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Top Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">
                Fiber Installation & Mikrotik Provisioning
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Account: {customer.accountNo} • {customer.fullName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Applicant Summary Banner */}
        <div className="p-4 bg-slate-950/50 border-b border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-200">{customer.fullName} ({customer.mobile})</p>
            <p className="text-slate-400 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span>{customer.address.street}, Brgy. {customer.address.barangay}</span>
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/40">
              {customer.planName}
            </span>
            <p className="font-mono font-bold text-slate-200 mt-0.5">
              {formatCurrency(customer.monthlyFee)}/mo
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Signal & Cable Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">
                Measured Optical Power Rx (dBm) *
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={opticalPowerDbm}
                onChange={(e) => setOpticalPowerDbm(parseFloat(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono font-bold focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">
                Drop Cable Used (Meters) *
              </label>
              <input
                type="number"
                required
                value={dropCableMeters}
                onChange={(e) => setDropCableMeters(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono font-bold focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Optical Quality Card */}
          <div className={`p-3 rounded-2xl border ${signal.bg} flex items-center justify-between text-xs`}>
            <span className="text-slate-300 font-medium">Optical Signal Quality:</span>
            <span className={`font-mono font-bold ${signal.color}`}>{signal.label}</span>
          </div>

          {/* Hardware & Serial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">
                ONU Serial Number (SN / GPON ID) *
              </label>
              <input
                type="text"
                required
                value={onuSerial}
                onChange={(e) => setOnuSerial(e.target.value)}
                placeholder="HWTC-12345678"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">
                Assigned Lead Technician *
              </label>
              <input
                type="text"
                required
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Router / ONU Hardware Model</label>
            <input
              type="text"
              value={routerModel}
              onChange={(e) => setRouterModel(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Field Installation / Splicing Notes</label>
            <textarea
              rows={2}
              value={surveyNotes}
              onChange={(e) => setSurveyNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Initial Invoice Checkbox */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-200 block">
                Generate 1st Month Billing Statement (SOA)
              </span>
              <p className="text-[11px] text-slate-400">
                Creates initial invoice of {formatCurrency(customer.monthlyFee)} with 7-day grace period.
              </p>
            </div>
            <input
              type="checkbox"
              checked={createInitialInvoice}
              onChange={(e) => setCreateInitialInvoice(e.target.checked)}
              className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-105"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete Installation & Activate Line</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

