import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { useApp } from '../../context/AppContext';

export const PlanDistributionChart: React.FC = () => {
  const { customers, plans } = useApp();

  const planCounts: { [key: string]: number } = {};
  customers.forEach((c) => {
    planCounts[c.planName] = (planCounts[c.planName] || 0) + 1;
  });

  const COLORS = ['#06b6d4', '#0284c7', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b'];

  const data = Object.keys(planCounts).map((planName, index) => ({
    name: planName.replace('SwiftStream ', ''),
    value: planCounts[planName],
    color: COLORS[index % COLORS.length],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs">
          <p className="font-semibold text-slate-200">{payload[0]?.name}</p>
          <p className="text-cyan-400 font-mono">
            {payload[0]?.value} Subscribers ({((payload[0]?.value / customers.length) * 100).toFixed(0)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-card flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-bold text-sm text-slate-100">Plan Subscriptions</h3>
          <p className="text-xs text-slate-400">Bandwidth Tier Share</p>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
          {customers.length} Total Lines
        </span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }}
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              formatter={(value) => <span className="text-slate-300">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

