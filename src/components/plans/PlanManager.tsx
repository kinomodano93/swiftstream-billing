import React, { useState } from 'react';
import { Layers, Plus, Edit2, Trash2, Check, Zap, Wifi, ShieldCheck, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Plan } from '../../types';
import { formatCurrency } from '../../utils/formatters';

export const PlanManager: React.FC = () => {
  const { plans, customers, addPlan, updatePlan, deletePlan } = useApp();

  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const [name, setName] = useState('');
  const [speedMbps, setSpeedMbps] = useState<number>(50);
  const [monthlyFee, setMonthlyFee] = useState<number>(1299);
  const [installationFee, setInstallationFee] = useState<number>(1500);
  const [category, setCategory] = useState<'residential' | 'business' | 'enterprise' | 'piso_wifi'>('residential');
  const [description, setDescription] = useState('');
  const [featuresText, setFeaturesText] = useState('');

  const handleOpenAdd = () => {
    setEditingPlan(null);
    setName('');
    setSpeedMbps(50);
    setMonthlyFee(1299);
    setInstallationFee(1500);
    setCategory('residential');
    setDescription('');
    setFeaturesText('Unlimited High-Speed Fiber\nDual-Band ONU Included\n24/7 Hotline Support');
    setShowModal(true);
  };

  const handleOpenEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setName(plan.name);
    setSpeedMbps(plan.speedMbps);
    setMonthlyFee(plan.monthlyFee);
    setInstallationFee(plan.installationFee);
    setCategory(plan.category);
    setDescription(plan.description);
    setFeaturesText(plan.features.join('\n'));
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const features = featuresText.split('\n').map((f) => f.trim()).filter(Boolean);

    if (editingPlan) {
      updatePlan(editingPlan.id, {
        name,
        speedMbps,
        monthlyFee,
        installationFee,
        category,
        description,
        features,
      });
    } else {
      addPlan({
        name,
        speedMbps,
        monthlyFee,
        installationFee,
        category,
        description,
        features,
        isActive: true,
      });
    }

    setShowModal(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <span>Internet Plans & Bandwidth Packages</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure fiber internet rates, dedicated business CIR lines, and piso-wifi feeding speeds.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Plan</span>
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const subscriberCount = customers.filter((c) => c.planId === plan.id).length;
          const planMrr = subscriberCount * plan.monthlyFee;

          return (
            <div
              key={plan.id}
              className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card flex flex-col justify-between hover:border-cyan-500/40 transition-all group"
            >
              <div>
                {/* Category & Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-400 border border-slate-700">
                    {plan.category}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 font-mono">
                    {subscriberCount} Subscribers
                  </span>
                </div>

                {/* Plan Name & Speed */}
                <h3 className="text-lg font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-3xl font-extrabold text-slate-100 font-mono">
                    {formatCurrency(plan.monthlyFee)}
                  </span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>

                {/* Speed indicator */}
                <div className="mt-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    Allocated Speed:
                  </span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {plan.speedMbps} Mbps
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-3 line-clamp-2">{plan.description}</p>

                {/* Features List */}
                <ul className="mt-4 space-y-2 text-xs border-t border-slate-800/80 pt-4">
                  {plan.features.map((f, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-slate-300">
                      <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Plan Footer */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Plan MRR Value:</span>
                  <span className="font-mono font-bold text-cyan-400">{formatCurrency(planMrr)}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(plan)}
                    className="p-1.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    title="Edit Plan"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      if (window.confirm(`Delete plan ${plan.name}?`)) {
                        deletePlan(plan.id);
                      }
                    }}
                    className="p-1.5 bg-slate-800 text-rose-400 hover:text-white hover:bg-rose-600 rounded-lg transition-colors"
                    title="Delete Plan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Plan Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-100">
                {editingPlan ? 'Edit Internet Plan' : 'Create New Internet Plan'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Plan Package Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SwiftStream Pro Fiber 100M"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Speed (Mbps) *</label>
                  <input
                    type="number"
                    required
                    value={speedMbps}
                    onChange={(e) => setSpeedMbps(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Monthly Fee (PHP ₱) *</label>
                  <input
                    type="number"
                    required
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Installation Fee (PHP ₱)</label>
                  <input
                    type="number"
                    value={installationFee}
                    onChange={(e) => setInstallationFee(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="residential">Residential</option>
                    <option value="business">Business</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="piso_wifi">Piso WiFi Hotspot</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Short Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optimal for remote work and streaming..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Features (One line per feature)
                </label>
                <textarea
                  rows={3}
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  placeholder="Unlimited Fiber\nGigabit ONU\n24/7 Hotline"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-cyan-600/20"
                >
                  {editingPlan ? 'Save Plan Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

