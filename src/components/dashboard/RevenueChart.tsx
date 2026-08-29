import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';

export const RevenueChart: React.FC = () => {
  const { invoices, payments } = useApp();

  // Aggregate monthly stats
  const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];

  const data = [
    { month: 'Mar', billed: 12500, collected: 12500 },
    { month: 'Apr', billed: 14800, collected: 14200 },
    { month: 'May', billed: 18200, collected: 17500 },
    { month: 'Jun', billed: 21900, collected: 21000 },
    { month: 'Jul', billed: 23696, collected: 21898 },
    {
      month: 'Aug',
      billed: invoices.reduce((acc, inv) => acc + inv.totalAmount, 0),
      collected: payments.reduce((acc, pay) => acc + pay.amount, 0),
    },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1">
          <p className="font-semibold text-slate-200">{label} 2026</p>
          <p className="text-cyan-400">
            Billed Revenue: {formatCurrency(payload[0]?.value || 0)}
          </p>
          <p className="text-emerald-400">
            Collected Cash: {formatCurrency(payload[1]?.value || 0)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-sm text-slate-100">Revenue vs. Collections Trend</h3>
          <p className="text-xs text-slate-400">6-Month Monthly Billing & Cash Inflow (PHP ₱)</p>
        </div>
        <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 text-cyan-400 font-mono border border-slate-700">
          Monthly Comparison
        </span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              iconType="circle"
              formatter={(value) => <span className="text-slate-300 capitalize">{value}</span>}
            />
            <Bar dataKey="billed" name="Billed Amount" fill="#0284c7" radius={[4, 4, 0, 0]} />
            <Bar dataKey="collected" name="Cash Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

