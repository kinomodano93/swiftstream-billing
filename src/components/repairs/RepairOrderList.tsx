import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  FileText,
  DollarSign,
  User,
  Phone,
  ArrowRight,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RepairOrder, RepairStatus } from '../../types';
import { formatCurrency, formatDateTime, getRepairStatusBadge } from '../../utils/formatters';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';

interface RepairOrderListProps {
  onOpenRepairModal: (repair?: RepairOrder) => void;
  onSelectCustomer: (customerId: string) => void;
  onSelectInvoice: (invoiceId: string) => void;
}

export const RepairOrderList: React.FC<RepairOrderListProps> = ({
  onOpenRepairModal,
  onSelectCustomer,
  onSelectInvoice,
}) => {
  const { repairOrders, updateRepairOrder, deleteRepairOrder, convertRepairToInvoice, searchTerm, setSearchTerm } = useApp();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderToDelete, setOrderToDelete] = useState<RepairOrder | null>(null);

  const filteredRepairs = repairOrders.filter((rep) => {
    const matchesSearch =
      rep.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.contactNumber.includes(searchTerm) ||
      rep.deviceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.issueDescription.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || rep.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalRepairRevenue = repairOrders.reduce((sum, r) => sum + r.totalCost, 0);
  const pendingCount = repairOrders.filter((r) => r.status !== 'completed' && r.status !== 'cancelled').length;

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-cyan-400" />
            <span>Repair Shop & Field Technical Job Orders</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track hardware diagnostics, fiber splicing repairs, parts replacement, and bill directly to subscribers.
          </p>
        </div>

        <button
          onClick={() => onOpenRepairModal()}
          className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          <span>New Repair Ticket</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <p className="text-xs text-slate-400">Total Active Service Orders</p>
          <h4 className="text-xl font-bold text-cyan-400 mt-1">{pendingCount} Open Jobs</h4>
          <span className="text-[11px] text-slate-500">In shop & field technician queues</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <p className="text-xs text-slate-400">Total Repair Shop Volume</p>
          <h4 className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(totalRepairRevenue)}</h4>
          <span className="text-[11px] text-slate-500">{repairOrders.length} all-time work orders</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <p className="text-xs text-slate-400">Completed & Released</p>
          <h4 className="text-xl font-bold text-purple-400 mt-1">
            {repairOrders.filter((r) => r.status === 'completed').length} Finished
          </h4>
          <span className="text-[11px] text-slate-500">Ready or delivered to customer</span>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Jobs' },
              { id: 'received', label: 'Received' },
              { id: 'diagnosing', label: 'Diagnosing' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'ready', label: 'Ready for Pickup' },
              { id: 'completed', label: 'Completed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === tab.id
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search ticket #, device, customer..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Orders Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRepairs.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-slate-500 text-xs">
            No repair job tickets found matching your criteria.
          </div>
        ) : (
          filteredRepairs.map((order) => {
            const badge = getRepairStatusBadge(order.status);

            return (
              <div
                key={order.id}
                className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card flex flex-col justify-between hover:border-slate-700 transition-all space-y-4"
              >
                <div>
                  {/* Top line */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/40">
                      {order.orderNumber}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-semibold ${badge.bg} ${badge.textCol}`}>
                      {badge.text}
                    </span>
                  </div>

                  {/* Customer and Device */}
                  <div className="mt-3">
                    <h3 className="font-bold text-sm text-slate-100">{order.customerName}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{order.contactNumber}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold text-[11px]">
                      {order.deviceType}
                    </span>
                  </div>

                  {/* Issue Description */}
                  <p className="text-xs text-slate-300 mt-2.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                    {order.issueDescription}
                  </p>

                  {/* Tech notes */}
                  {order.diagnosisNotes && (
                    <p className="text-[11px] text-slate-400 mt-2 italic">
                      Diagnosis: {order.diagnosisNotes}
                    </p>
                  )}

                  {/* Parts List */}
                  {order.partsUsed.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-800/80 space-y-1 text-[11px]">
                      <span className="text-slate-500 font-semibold uppercase text-[10px]">Parts Replaced:</span>
                      {order.partsUsed.map((p, idx) => (
                        <div key={idx} className="flex justify-between text-slate-300">
                          <span>• {p.name} (x{p.quantity})</span>
                          <span className="font-mono text-slate-400">{formatCurrency(p.cost * p.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Cost & Actions */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Assigned Tech: {order.technician}</span>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Total Service Fee:</span>
                      <span className="font-mono font-bold text-sm text-emerald-400">
                        {formatCurrency(order.totalCost)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onOpenRepairModal(order)}
                        className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
                        title="Edit Job Order"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setOrderToDelete(order)}
                        className="p-1.5 bg-slate-800 text-rose-400 hover:text-white hover:bg-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="Delete Ticket"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {!order.billedToInvoiceId ? (
                      <button
                        onClick={() => convertRepairToInvoice(order.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600 hover:text-white rounded-lg text-[11px] font-semibold transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Bill to Invoice</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onSelectInvoice(order.billedToInvoiceId!)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 text-cyan-300 rounded-lg text-[11px] font-mono"
                      >
                        <span>View Invoice</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Dialog for Repair Ticket Deletion */}
      <ConfirmDeleteModal
        isOpen={!!orderToDelete}
        title="Delete Repair & Maintenance Ticket"
        itemName={orderToDelete ? `Job Order #${orderToDelete.orderNumber} — ${orderToDelete.customerName} (${orderToDelete.issueDescription.slice(0, 40)}...)` : undefined}
        description="Are you sure you want to permanently delete this repair ticket? The service log and technician dispatch history will be removed from your system."
        confirmLabel="Yes, Delete Ticket"
        onConfirm={() => {
          if (orderToDelete) {
            deleteRepairOrder(orderToDelete.id);
            setOrderToDelete(null);
          }
        }}
        onClose={() => setOrderToDelete(null)}
      />
    </div>
  );
};

