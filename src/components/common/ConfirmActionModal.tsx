import React, { useEffect } from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';

export interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'warning' | 'critical';
  icon?: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  title,
  description,
  itemName,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  severity = 'warning',
  icon,
  onConfirm,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isCritical = severity === 'critical';

  const colorScheme = isCritical
    ? {
        iconBg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
        badge: 'text-rose-400/90',
        confirmBtn: 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30',
      }
    : {
        iconBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        badge: 'text-amber-400/90',
        confirmBtn: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30',
      };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-0 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-inner ${colorScheme.iconBg}`}>
              {icon ?? (isCritical ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />)}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
              <p className={`text-xs font-medium mt-0.5 ${colorScheme.badge}`}>
                {isCritical ? 'Critical Action — Requires Confirmation' : 'Action Confirmation Required'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          {itemName && (
            <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block mb-1">
                Target Record:
              </span>
              <span className="font-bold text-slate-100 text-xs font-mono break-all">{itemName}</span>
            </div>
          )}
          <p className="text-xs text-slate-300 leading-relaxed">{description}</p>
        </div>

        <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 cursor-pointer ${colorScheme.confirmBtn}`}
          >
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
