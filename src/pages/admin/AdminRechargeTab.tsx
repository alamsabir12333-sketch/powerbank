import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Eye,
  RefreshCw,
  Loader2,
  X,
  CreditCard,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  ImageIcon,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchAdminPayments,
  approveRecharge,
  rejectRecharge,
} from '../../services/api';
import { PaymentItem } from '../../types';

interface AdminRechargeTabProps {
  adminId: string;
  onShowToast: (msg: string) => void;
  onRefreshGlobalStats: () => void;
}

export const AdminRechargeTab: React.FC<AdminRechargeTabProps> = ({
  adminId,
  onShowToast,
  onRefreshGlobalStats,
}) => {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  // Screenshot preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Reject modal
  const [rejectItem, setRejectItem] = useState<PaymentItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminPayments();
      setPayments(data);
    } catch (e: any) {
      onShowToast(e.message || 'Error loading recharge requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleCopyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const handleApprove = async (item: PaymentItem) => {
    if (!window.confirm(`Approve recharge of ₹${item.amount} for user ID ${item.userId}?`)) return;
    setProcessingId(item.id);
    try {
      await approveRecharge(item.id, adminId);
      onShowToast(`Recharge of ₹${item.amount} approved and credited to user's recharge balance.`);
      loadPayments();
      onRefreshGlobalStats();
    } catch (e: any) {
      onShowToast(e.message || 'Approval failed');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectItem) return;
    if (!rejectReason.trim()) {
      onShowToast('Please specify a rejection reason.');
      return;
    }

    setProcessingId(rejectItem.id);
    try {
      await rejectRecharge(rejectItem.id, rejectReason, adminId);
      onShowToast('Recharge request rejected.');
      setRejectItem(null);
      setRejectReason('');
      loadPayments();
      onRefreshGlobalStats();
    } catch (e: any) {
      onShowToast(e.message || 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'PENDING') {
        if (p.status !== 'PENDING_VERIFICATION' && p.status !== 'PAYMENT_PENDING') {
          return false;
        }
      } else if (statusFilter === 'PAID') {
        if (p.status !== 'PAID') return false;
      } else if (p.status !== statusFilter) {
        return false;
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (p.utr || '').toLowerCase().includes(q) ||
        (p.id || '').toLowerCase().includes(q) ||
        (p.orderId || '').toLowerCase().includes(q) ||
        (p.userId || '').toLowerCase().includes(q) ||
        (p.userMobile || '').toLowerCase().includes(q) ||
        (p.username || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = payments.filter(
    (p) => p.status === 'PENDING_VERIFICATION' || p.status === 'PAYMENT_PENDING'
  ).length;
  const approvedTotal = payments
    .filter((p) => p.status === 'PAID')
    .reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="space-y-5">
      {/* Top summary card */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
              Manual UPI Deposits & Recharge Review
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Review user-submitted UPI UTR numbers and payment screenshots, approve balance credits, or reject invalid requests.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs font-bold">
              Total Approved: ₹{approvedTotal.toLocaleString()}
            </div>
            <button
              onClick={loadPayments}
              disabled={loading}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by 12-digit UTR, Order ID, User Mobile or ID..."
              className="w-full bg-[#0d1117] border border-gray-700/80 focus:border-[#FF6000] rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-gray-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'PENDING', label: `Pending (${pendingCount})` },
              { id: 'PAID', label: 'Approved (PAID)' },
              { id: 'REJECTED', label: 'Rejected' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  statusFilter === st.id
                    ? 'bg-[#FF6000] text-white shadow-sm'
                    : 'bg-[#0d1117] text-gray-400 border border-gray-800 hover:border-gray-700'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recharges Table */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#0d1117] text-gray-400 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3.5 px-4">Order ID & Date</th>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">12-Digit UTR</th>
                <th className="py-3.5 px-4">Payment Screenshot</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF6000]" />
                    <span>Loading deposit requests...</span>
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-500">
                    No manual deposit records found.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((item) => {
                  const isPending =
                    item.status === 'PENDING_VERIFICATION' ||
                    item.status === 'PAYMENT_PENDING';
                  const isPaid = item.status === 'PAID';
                  const isRejected = item.status === 'REJECTED' || item.status === 'FAILED';

                  return (
                    <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-white text-[11.5px]">
                          {item.orderId || item.id}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-200">{item.username || item.userMobile || 'User'}</div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          ID: {item.userId?.substring(0, 8)}...
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-extrabold text-emerald-400 text-sm">
                          ₹{item.amount.toFixed(2)}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {item.utr ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40 text-[11px]">
                              {item.utr}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyUtr(item.utr!)}
                              className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700 cursor-pointer"
                              title="Copy UTR"
                            >
                              {copiedUtr === item.utr ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-500 italic text-[11px]">No UTR provided</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {item.proofUrl ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(item.proofUrl!)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-cyan-300 font-semibold text-[11px] cursor-pointer"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>View Proof</span>
                          </button>
                        ) : (
                          <span className="text-[10.5px] text-gray-500">No screenshot</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isPaid
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                              : isPending
                              ? 'bg-amber-950/60 text-amber-400 border border-amber-800/50 animate-pulse'
                              : 'bg-red-950/60 text-red-400 border border-red-800/50'
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.rejectionReason && (
                          <div className="text-[9.5px] text-red-400 mt-0.5 line-clamp-1" title={item.rejectionReason}>
                            Reason: {item.rejectionReason}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {isPending ? (
                          <>
                            <button
                              onClick={() => handleApprove(item)}
                              disabled={processingId === item.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>

                            <button
                              onClick={() => {
                                setRejectItem(item);
                                setRejectReason('');
                              }}
                              disabled={processingId === item.id}
                              className="px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-800 hover:bg-red-900 text-red-400 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-500 font-mono">Processed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Screenshot Preview */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl max-w-2xl w-full p-4 overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#FF6000]" />
                <span>Payment Screenshot Proof</span>
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs flex items-center gap-1 px-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Full Size</span>
                </a>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-[#090d16] rounded-xl p-2">
              <img
                src={previewImage}
                alt="Payment proof screenshot"
                className="max-h-[65vh] object-contain rounded-lg shadow-lg"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Reject Modal */}
      {rejectItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Reject Recharge Request #{rejectItem.orderId || rejectItem.id}
              </h3>
              <button onClick={() => setRejectItem(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300 mb-3">
              Please enter the rejection reason. This reason will be recorded and no balance will be credited:
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Invalid 12-digit UTR / Payment not received in bank account"
              rows={3}
              className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-3 text-xs text-white outline-none focus:border-red-500 mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setRejectItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={processingId === rejectItem.id}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {processingId === rejectItem.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
