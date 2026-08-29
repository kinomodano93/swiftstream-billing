import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  trendPositive?: boolean;
  colorScheme: 'cyan' | 'emerald' | 'amber' | 'rose' | 'purple' | 'blue';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendPositive = true,
  colorScheme,
  onClick,
}) => {
  const colorMap = {
    cyan: {
      border: 'border-cyan-500/30',
      bgIcon: 'bg-cyan-500/10 text-cyan-400',
      glow: 'hover:border-cyan-400/50 hover:shadow-cyan-500/10',
    },
    emerald: {
      border: 'border-emerald-500/30',
      bgIcon: 'bg-emerald-500/10 text-emerald-400',
      glow: 'hover:border-emerald-400/50 hover:shadow-emerald-500/10',
    },
    amber: {
      border: 'border-amber-500/30',
      bgIcon: 'bg-amber-500/10 text-amber-400',
      glow: 'hover:border-amber-400/50 hover:shadow-amber-500/10',
    },
    rose: {
      border: 'border-rose-500/30',
      bgIcon: 'bg-rose-500/10 text-rose-400',
      glow: 'hover:border-rose-400/50 hover:shadow-rose-500/10',
    },
    purple: {
      border: 'border-purple-500/30',
      bgIcon: 'bg-purple-500/10 text-purple-400',
      glow: 'hover:border-purple-400/50 hover:shadow-purple-500/10',
    },
    blue: {
      border: 'border-blue-500/30',
      bgIcon: 'bg-blue-500/10 text-blue-400',
      glow: 'hover:border-blue-400/50 hover:shadow-blue-500/10',
    },
  };

  const scheme = colorMap[colorScheme];

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-2xl bg-slate-900/80 border ${scheme.border} ${scheme.glow} shadow-card transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-slate-100 mt-1.5 tracking-tight">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${scheme.bgIcon}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        {subtitle && <span className="text-slate-400 truncate">{subtitle}</span>}
        {trend && (
          <span
            className={`font-semibold flex items-center gap-0.5 ${
              trendPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {trendPositive ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
    </div>
  );
};

