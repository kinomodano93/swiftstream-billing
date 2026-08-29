import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const NotificationToast: React.FC = () => {
  const { notifications, removeToast } = useApp();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map((notif) => {
        let Icon = Info;
        let borderCol = 'border-cyan-500/40';
        let bgCol = 'bg-slate-900/95';
        let iconCol = 'text-cyan-400';

        if (notif.type === 'success') {
          Icon = CheckCircle2;
          borderCol = 'border-emerald-500/40';
          iconCol = 'text-emerald-400';
        } else if (notif.type === 'warning') {
          Icon = AlertTriangle;
          borderCol = 'border-amber-500/40';
          iconCol = 'text-amber-400';
        } else if (notif.type === 'error') {
          Icon = AlertCircle;
          borderCol = 'border-rose-500/40';
          iconCol = 'text-rose-400';
        }

        return (
          <div
            key={notif.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border ${borderCol} ${bgCol} shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5`}
          >
            <Icon className={`w-5 h-5 ${iconCol} flex-shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-slate-100">{notif.title}</h4>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{notif.message}</p>
            </div>
            <button
              onClick={() => removeToast(notif.id)}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

