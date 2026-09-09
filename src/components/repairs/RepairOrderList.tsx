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
  MessageSquare,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RepairOrder, RepairStatus } from '../../types';
import { formatCurrency, formatDate, formatDateTime, getRepairStatusBadge } from '../../utils/formatters';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { TicketChatModal } from '../support/TicketChatModal';

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
  const [selectedChatTicket, setSelectedChatTicket] = useState<RepairOrder | null>(null);

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
  const pendingCount = repairOrders.filter((r) => r.status !== 'completed' && r.status !== 'closed' && r.status !== 'cancelled').length;

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
            {repairOrders.filter((r) => r.status === 'completed' || r.status === 'resolved' || r.status === 'closed').length} Finished
          </h4>
          <span className="text-[11px] text-slate-500">Resolved or released to customer</span>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Jobs' },
              { id: 'open', label: 'Open' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'resolved', label: 'Resolved' },
              { id: 'closed', label: 'Closed' },
              { id: 'ready', label: 'Ready for Pickup' },
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

      {/* Orders Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-card overflow-hidden">
        {filteredRepairs.length === 0 ? (
          <div className="p-12 text-center space-y-2 text-slate-500 text-xs">
            <Wrench className="w-8 h-8 text-slate-600 mx-auto" />
            <p>No repair job tickets found matching your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Ticket # & Date</th>
                  <th className="py-3 px-4">Customer / Contact</th>
                  <th className="py-3 px-4">Device & Problem Description</th>
                  <th className="py-3 px-4">Parts & Diagnosis</th>
                  <th className="py-3 px-4">Assigned Tech</th>
                  <th className="py-3 px-4">Service Fee</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRepairs.map((order) => {
                  const badge = getRepairStatusBadge(order.status);

                  return (
                    <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Ticket # & Date */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-xs text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
                          {order.orderNumber}
                        </span>
                        {order.dateReceived && (
                          <div className="text-[10px] text-slate-500 mt-1">
                            {formatDate(order.dateReceived)}
                          </div>
                        )}
                      </td>

                      {/* Customer / Contact */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="font-bold text-slate-100 text-sm">{order.customerName}</div>
                        {order.contactNumber && (
                          <div className="text-[11px] text-cyan-400 font-mono mt-0.5 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <a href={`tel:${order.contactNumber}`} className="hover:underline">
                              {order.contactNumber}
                            </a>
                          </div>
                        )}
                        {order.address && (
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">
                            {order.address}
                          </div>
                        )}
                      </td>

                      {/* Device & Problem Description */}
                      <td className="py-3 px-4 max-w-[240px]">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold text-[10px] uppercase">
                          {order.deviceType}
                        </span>
                        <p className="text-slate-200 mt-1 line-clamp-2 leading-snug">
                          {order.issueDescription}
                        </p>
                      </td>

                      {/* Parts & Diagnosis */}
                      <td className="py-3 px-4 max-w-[180px]">
                        {order.diagnosisNotes && (
                          <p className="text-[11px] text-slate-400 italic line-clamp-2">
                            {order.diagnosisNotes}
                          </p>
                        )}
                        {order.partsUsed && order.partsUsed.length > 0 ? (
                          <div className="text-[10px] text-emerald-400 mt-0.5 font-medium">
                            {order.partsUsed.length} parts replaced
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[10px]">No hardware parts</span>
                        )}
                      </td>

                      {/* Assigned Tech */}
                      <td className="py-3 px-4">
                        <span className="text-slate-300 font-medium">{order.technician}</span>
                      </td>

                      {/* Service Fee */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-sm text-emerald-400">
                          {formatCurrency(order.totalCost)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase ${badge.bg} ${badge.textCol}`}>
                          {badge.text}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedChatTicket(order)}
                            className="p-1.5 bg-slate-800 text-cyan-400 hover:text-white hover:bg-cyan-600 rounded-lg transition-colors cursor-pointer"
                            title="Chat Thread with Subscriber"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenRepairModal(order)}
                            className="p-1.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Edit Job Order"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {!order.billedToInvoiceId ? (
                            <button
                              type="button"
                              onClick={() => convertRepairToInvoice(order.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600 hover:text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                              title="Convert to Billing Invoice"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">Bill</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSelectInvoice(order.billedToInvoiceId!)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 text-cyan-300 hover:bg-slate-700 rounded-lg text-[11px] font-mono cursor-pointer"
                              title="View Linked Invoice"
                            >
                              <span className="hidden xl:inline">Invoice</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setOrderToDelete(order)}
                            className="p-1.5 bg-slate-800 text-rose-400 hover:text-white hover:bg-rose-600 rounded-lg transition-colors cursor-pointer"
                            title="Delete Ticket"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

      {/* Desk Agent / Admin Ticket Chat Window */}
      {selectedChatTicket && (
        <TicketChatModal
          ticket={selectedChatTicket}
          currentRole="admin"
          currentUserName="Desk Support Lead"
          onClose={() => setSelectedChatTicket(null)}
          onUpdateTicket={(ticketId, updates) => {
            updateRepairOrder(ticketId, updates);
            setSelectedChatTicket((prev) => (prev && prev.id === ticketId ? { ...prev, ...updates } : prev));
          }}
        />
      )}
    </div>
  );
};

