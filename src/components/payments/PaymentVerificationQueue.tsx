import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Eye,
  RotateCw,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  User,
  FileText,
  AlertTriangle,
  Receipt,
  Check,
  X,
  Smartphone,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PaymentSubmission, PaymentMethod } from '../../types';
import { formatCurrency, formatDateTime, getPaymentMethodLabel } from '../../utils/formatters';

interface PaymentVerificationQueueProps {
  onSelectCustomer?: (customerId: string) => void;
}

export const PaymentVerificationQueue: React.FC<PaymentVerificationQueueProps> = ({
  onSelectCustomer,
}) => {
  const {
    paymentSubmissions,
    approvePaymentSubmission,
    rejectPaymentSubmission,
    submitPaymentProof,
    customers,
    invoices,
    businessProfile,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  // Lightbox & Modal state
  const [activeSubmission, setActiveSubmission] = useState<PaymentSubmission | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('Duplicate Reference Number');
  const [customRejectionText, setCustomRejectionText] = useState<string>('');

  const filteredSubmissions = useMemo(() => {
    return paymentSubmissions.filter((sub) => {
      const matchesSearch =
        sub.submissionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.accountNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sub.invoiceNumber && sub.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
      const matchesMethod = methodFilter === 'all' || sub.paymentMethod === methodFilter;

      return matchesSearch && matchesStatus && matchesMethod;
    });
  }, [paymentSubmissions, searchTerm, statusFilter, methodFilter]);

  const pendingCount = paymentSubmissions.filter((s) => s.status === 'pending_review').length;
  const approvedCount = paymentSubmissions.filter((s) => s.status === 'approved').length;
  const rejectedCount = paymentSubmissions.filter((s) => s.status === 'rejected').length;

  const handleOpenLightbox = (sub: PaymentSubmission) => {
    setActiveSubmission(sub);
    setZoomLevel(1);
    setRotation(0);
    setShowRejectModal(false);
  };

  const handleApprove = (sub: PaymentSubmission) => {
    approvePaymentSubmission(sub.id);
    setActiveSubmission(null);
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubmission) return;

    const finalReason = customRejectionText.trim() ? customRejectionText : rejectionReason;
    rejectPaymentSubmission(activeSubmission.id, finalReason);
    setShowRejectModal(false);
    setActiveSubmission(null);
  };

  const handleSimulateSubmission = () => {
    const cust = customers[Math.floor(Math.random() * customers.length)] || customers[0];
    const inv = invoices.find((i) => i.customerId === cust.id && i.status !== 'paid') || invoices[0];
    const randomRef = `GCASH-${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    submitPaymentProof({
      customerId: cust.id,
      invoiceId: inv?.id,
      amount: inv ? inv.balanceDue : 1299,
      paymentMethod: 'gcash',
      referenceNumber: randomRef,
      receiptImageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80',
      notes: `Simulated portal submission for ${cust.fullName}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase">Pending Verification</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-black font-mono text-amber-400">{pendingCount}</span>
              {pendingCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>
          </div>
          <Clock className="w-6 h-6 text-amber-400 opacity-80" />
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase">Approved & Credited</span>
            <span className="text-2xl font-black font-mono text-emerald-400 block mt-1">
              {approvedCount}
            </span>
          </div>
          <CheckCircle2 className="w-6 h-6 text-emerald-400 opacity-80" />
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase">Rejected Proofs</span>
            <span className="text-2xl font-black font-mono text-rose-400 block mt-1">
              {rejectedCount}
            </span>
          </div>
          <XCircle className="w-6 h-6 text-rose-400 opacity-80" />
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase">Total Submissions</span>
            <span className="text-2xl font-black font-mono text-cyan-400 block mt-1">
              {paymentSubmissions.length}
            </span>
          </div>
          <Receipt className="w-6 h-6 text-cyan-400 opacity-80" />
        </div>
      </div>

      {/* Toolbar & Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Subscriber, Account #, Ref No, or Submission ID..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {(['all', 'pending_review', 'approved', 'rejected'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  statusFilter === st
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st === 'all'
                  ? 'All'
                  : st === 'pending_review'
                  ? `Pending (${pendingCount})`
                  : st === 'approved'
                  ? 'Approved'
                  : 'Rejected'}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSimulateSubmission}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Simulate Client Submission</span>
        </button>
      </div>

      {/* Submissions Table / Cards */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-card">
        {filteredSubmissions.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-xs">
            No proof-of-payment submissions match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Submission #</th>
                  <th className="py-3.5 px-4">Subscriber</th>
                  <th className="py-3.5 px-4">Payment Method</th>
                  <th className="py-3.5 px-4">Reference No.</th>
                  <th className="py-3.5 px-4">Amount Claimed</th>
                  <th className="py-3.5 px-4">Applied Invoice</th>
                  <th className="py-3.5 px-4">Proof Photo</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredSubmissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                      {sub.submissionNumber}
                      <span className="block text-[10px] text-slate-500 font-sans font-normal">
                        {formatDateTime(sub.submittedAt)}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <button
                        onClick={() => onSelectCustomer && onSelectCustomer(sub.customerId)}
                        className="font-bold text-slate-100 hover:text-cyan-400 hover:underline text-left block"
                      >
                        {sub.customerName}
                      </button>
                      <span className="font-mono text-[10px] text-slate-400">{sub.accountNo}</span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 font-medium capitalize">
                        <Smartphone className="w-3 h-3 text-cyan-400" />
                        <span>{getPaymentMethodLabel(sub.paymentMethod).label}</span>
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-slate-200">
                      {sub.referenceNumber}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-emerald-400 text-sm">
                      {formatCurrency(sub.amount)}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300">
                      {sub.invoiceNumber || 'Advance Wallet Deposit'}
                    </td>

                    <td className="py-3 px-4">
                      {sub.receiptImageUrl ? (
                        <button
                          onClick={() => handleOpenLightbox(sub)}
                          className="relative group block w-10 h-10 rounded-xl overflow-hidden border border-slate-700 bg-slate-950"
                        >
                          <img
                            src={sub.receiptImageUrl}
                            alt="Receipt Preview"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="w-3.5 h-3.5 text-white" />
                          </div>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500">No Image</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {sub.status === 'pending_review' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-950/60 text-amber-400 border border-amber-800/50">
                          <Clock className="w-3 h-3" />
                          <span>Review</span>
                        </span>
                      )}
                      {sub.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Approved</span>
                        </span>
                      )}
                      {sub.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-950/60 text-rose-400 border border-rose-800/50">
                          <XCircle className="w-3 h-3" />
                          <span>Rejected</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {sub.status === 'pending_review' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenLightbox(sub)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition-colors flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>

                          <button
                            onClick={() => handleApprove(sub)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-sm shadow-emerald-600/20 flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenLightbox(sub)}
                          className="px-2.5 py-1 text-slate-400 hover:text-slate-200 font-medium"
                        >
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lightbox / Verification Modal */}
      {activeSubmission && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center font-bold">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <span>Proof-of-Payment Verification Lightbox</span>
                    <span className="font-mono text-cyan-400">#{activeSubmission.submissionNumber}</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Verify GCash / Maya reference number, timestamp, and amount before crediting account
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveSubmission(null)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: 2 Columns (Image Inspector vs Data Verification Panel) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
              {/* Left Column: Image Canvas (7 Cols) */}
              <div className="lg:col-span-7 bg-slate-950 p-4 flex flex-col justify-between items-center relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800 min-h-[350px]">
                {/* Image Toolbar */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800">
                  <button
                    onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
                    title="Rotate 90°"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>

                {/* Main Receipt Image */}
                <div className="flex-1 flex items-center justify-center overflow-auto w-full p-4">
                  {activeSubmission.receiptImageUrl ? (
                    <img
                      src={activeSubmission.receiptImageUrl}
                      alt="Subscriber Payment Proof"
                      style={{
                        transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                        transition: 'transform 0.2s ease-out',
                      }}
                      className="max-h-[480px] max-w-full object-contain rounded-2xl shadow-2xl border border-slate-800"
                    />
                  ) : (
                    <div className="text-center text-slate-500 text-xs">
                      No screenshot uploaded for this submission.
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-500 font-mono">
                  Scale: {Math.round(zoomLevel * 100)}% • Rotation: {rotation}°
                </span>
              </div>

              {/* Right Column: Subscriber & Invoice Verification Panel (5 Cols) */}
              <div className="lg:col-span-5 p-6 space-y-4 overflow-y-auto text-xs bg-slate-900/60">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Subscriber:</span>
                    <span className="font-bold text-slate-100">{activeSubmission.customerName}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Account No:</span>
                    <span className="font-mono text-cyan-400 font-bold">{activeSubmission.accountNo}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Payment Channel:</span>
                    <span className="font-semibold text-slate-200 capitalize">
                      {getPaymentMethodLabel(activeSubmission.paymentMethod).label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Reference Number:</span>
                    <span className="font-mono font-bold text-amber-400 text-sm">
                      {activeSubmission.referenceNumber}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                    <span className="text-slate-400 font-semibold">Claimed Amount:</span>
                    <span className="font-mono font-black text-emerald-400 text-base">
                      {formatCurrency(activeSubmission.amount)}
                    </span>
                  </div>
                </div>

                {/* Target Invoice Details */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-slate-400 font-semibold block">Target Applied Bill:</span>
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-slate-300 font-bold">{activeSubmission.invoiceNumber || 'Advance Deposit'}</span>
                    <span className="text-slate-400">{formatDateTime(activeSubmission.submittedAt)}</span>
                  </div>
                  {activeSubmission.notes && (
                    <p className="text-[11px] text-slate-400 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      "{activeSubmission.notes}"
                    </p>
                  )}
                </div>

                {/* Status or Approval Actions */}
                {activeSubmission.status === 'pending_review' ? (
                  <div className="space-y-3 pt-2">
                    <button
                      onClick={() => handleApprove(activeSubmission)}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve & Issue Official Receipt (OR)</span>
                    </button>

                    <button
                      onClick={() => setShowRejectModal(true)}
                      className="w-full py-2.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject Proof Submission</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Review Outcome:</span>
                      <span className="font-bold uppercase text-emerald-400 font-mono">
                        {activeSubmission.status}
                      </span>
                    </div>
                    {activeSubmission.reviewedBy && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Reviewed by:</span>
                        <span>{activeSubmission.reviewedBy}</span>
                      </div>
                    )}
                    {activeSubmission.rejectionReason && (
                      <div className="text-rose-400 bg-rose-950/40 p-2.5 rounded-xl border border-rose-800/40">
                        <strong>Reason:</strong> {activeSubmission.rejectionReason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Prompt Modal */}
      {showRejectModal && activeSubmission && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmReject}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 text-xs"
          >
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Reject Payment Proof #{activeSubmission.submissionNumber}</span>
            </div>

            <p className="text-slate-400">
              Please specify the reason for rejection so the subscriber can re-submit valid payment details.
            </p>

            <div className="space-y-2">
              <label className="block text-slate-300 font-semibold">Canned Reason:</label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100"
              >
                <option value="Duplicate Reference Number">Duplicate Reference Number (Already Claimed)</option>
                <option value="Unreadable / Blurry Screenshot">Unreadable or Blurry Receipt Screenshot</option>
                <option value="Amount Mismatch with Bank Record">Amount Mismatch against Actual Bank Record</option>
                <option value="Payment Sent to Incorrect Account">Payment Sent to Incorrect Account / Mobile Number</option>
                <option value="Custom">Custom Reason</option>
              </select>
            </div>

            {rejectionReason === 'Custom' && (
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Custom Notes:</label>
                <textarea
                  rows={3}
                  required
                  value={customRejectionText}
                  onChange={(e) => setCustomRejectionText(e.target.value)}
                  placeholder="Explain why this receipt cannot be verified..."
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-colors"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
