import React, { useMemo } from 'react';
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
import { BarChart3 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';

export const RevenueChart: React.FC = () => {
  const { invoices, payments } = useApp();

  // Dynamically compute the last 6 calendar months based on current date
  const data = useMemo(() => {
    const result = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthShort = d.toLocaleString('en-US', { month: 'short' });
      const year = d.getFullYear();
      const monthIndex = d.getMonth();

      const billed = invoices
        .filter((inv) => {
          const dStr = inv.issueDate || inv.createdAt;
          if (!dStr) return false;
          const invDate = new Date(dStr);
          return invDate.getFullYear() === year && invDate.getMonth() === monthIndex;
        })
        .reduce((sum, inv) => sum + inv.totalAmount, 0);

      const collected = payments
        .filter((pay) => {
          const dStr = pay.paymentDate || pay.createdAt;
          if (!dStr) return false;
          const payDate = new Date(dStr);
          return payDate.getFullYear() === year && payDate.getMonth() === monthIndex;
        })
        .reduce((sum, pay) => sum + pay.amount, 0);

      result.push({
        month: monthShort,
        year,
        fullLabel: `${monthShort} ${year}`,
        billed,
        collected,
      });
    }

    return result;
  }, [invoices, payments]);

  const hasAnyData = useMemo(() => {
    return data.some((d) => d.billed > 0 || d.collected > 0);
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const year = payload[0]?.payload?.year || new Date().getFullYear();
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1">
          <p className="font-semibold text-slate-200">{label} {year}</p>
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

      {!hasAnyData && invoices.length === 0 && payments.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs text-center">
          <BarChart3 className="w-8 h-8 opacity-30 mb-2" />
          <p>No billing or collection records yet.</p>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Generate invoices or record payments to visualize dynamic 6-month trends.
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
};


