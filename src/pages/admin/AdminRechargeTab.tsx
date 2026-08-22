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
  Zap,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchAdminPayments,
  approveRecharge,
  rejectRecharge,
  fetchDepositTransactions,
  checkUniVePayDepositStatus,
  submitUniVePayUtrSupplement,
} from '../../services/api';
import { PaymentItem, DepositTransaction } from '../../types';

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
  const [gatewayDeposits, setGatewayDeposits] = useState<DepositTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);

  // UTR supplement modal
  const [supplementItem, setSupplementItem] = useState<DepositTransaction | null>(null);
  const [supplementUtr, setSupplementUtr] = useState('');

  // Screenshot preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Reject modal
  const [rejectItem, setRejectItem] = useState<PaymentItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const [data, gw] = await Promise.all([
        fetchAdminPayments(),
        fetchDepositTransactions(),
      ]);
      setPayments(data);
      setGatewayDeposits(gw);
    } catch (e: any) {
      onShowToast(e.message || 'Error loading recharges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const handleApprove = async (item: PaymentItem) => {
    if (!window.confirm(`Approve recharge of ₹${item.amount} for user ID ${item.userId}?`)) return;
    setProcessingId(item.id);
    try {
      await approveRecharge(item.id, adminId);
      onShowToast(`Recharge of ₹${item.amount} approved and credited.`);
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

  const handleQueryGateway = async (traceno: string, amount: number) => {
    setReconcilingId(traceno);
    try {
      const res = await checkUniVePayDepositStatus(traceno, amount);
      if (res.success) {
        onShowToast(`Gateway status: ${res.data?.data?.status || res.data?.status || 'UPDATED'}`);
        loadPayments();
      } else {
        onShowToast('Failed to check gateway status');
      }
    } catch (e: any) {
      onShowToast(e.message || 'Error querying gateway');
    } finally {
      setReconcilingId(null);
    }
  };

  const handleConfirmUtrSupplement = async () => {
    if (!supplementItem || !supplementUtr.trim()) {
      onShowToast('Please enter a valid 12-digit UTR');
      return;
    }

    setProcessingId(supplementItem.id);
    try {
      const res = await submitUniVePayUtrSupplement(
        supplementItem.traceno,
        supplementUtr.trim(),
        supplementItem.amount
      );
      if (res.success) {
        onShowToast(`UTR ${supplementUtr} submitted to UniVePay for reconciliation.`);
        setSupplementItem(null);
        setSupplementUtr('');
        loadPayments();
      } else {
        onShowToast('Failed to submit UTR supplement');
      }
    } catch (e: any) {
      onShowToast(e.message || 'UTR supplement failed');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredPayments = payments.filter((p) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'PENDING') {
        if (p.status !== 'PENDING_VERIFICATION' && p.status !== 'PAYMENT_PENDING') return false;
      } else if (p.status !== statusFilter) {
        return false;
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (p.utrNumber || '').toLowerCase().includes(q) ||
        (p.id || '').toLowerCase().includes(q) ||
        (p.userId || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = payments.filter((p) => p.status === 'PENDING_VERIFICATION' || p.status === 'PAYMENT_PENDING').length;
  const approvedTotal = payments.filter((p) => p.status === 'PAID').reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="space-y-5">
      {/* Top summary card */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
              UniVePay Gateway Recharges & Deposits
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Automated UniVePay UPI Gateway transactions, real-time webhook verifications, and UTR supplements.
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
              placeholder="Search by 12-digit UTR, Order Traceno, or User ID..."
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
                <th className="py-3.5 px-4">Order Traceno & Date</th>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Channel / UTR</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF6000]" />
                    <span>Loading deposit ledger...</span>
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-500">
                    No recharge records found.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((item) => {
                  const isPending =
                    item.status === 'PENDING_VERIFICATION' || item.status === 'PAYMENT_PENDING';
                  const isPaid = item.status === 'PAID';
                  const isRejected = item.status === 'REJECTED';

                  const gwTxn = gatewayDeposits.find(
                    (g) => g.id === item.id || g.traceno === item.id || g.utr === item.utrNumber
                  );

                  return (
                    <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-white text-[11.5px] flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>{item.id}</span>
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-200">{item.username || 'User'}</div>
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
                        <div className="text-xs font-bold text-white">
                          {item.utrNumber ? (
                            <span className="text-amber-400">{item.utrNumber}</span>
                          ) : (
                            <span className="text-cyan-300 font-sans text-[11px]">UniVePay Gateway</span>
                          )}
                        </div>
                        {gwTxn?.gatewayOrderId && (
                          <div className="text-[10px] text-gray-500 font-mono">
                            OID: {gwTxn.gatewayOrderId}
                          </div>
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
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {gwTxn?.traceno && isPending && (
                          <button
                            onClick={() => handleQueryGateway(gwTxn.traceno, item.amount)}
                            disabled={reconcilingId === gwTxn.traceno}
                            className="px-2 py-1 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-300 hover:bg-cyan-900 text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <RefreshCw className={`w-3 h-3 ${reconcilingId === gwTxn.traceno ? 'animate-spin' : ''}`} />
                            <span>Check Gateway</span>
                          </button>
                        )}

                        {gwTxn && isPending && (
                          <button
                            onClick={() => {
                              setSupplementItem(gwTxn);
                              setSupplementUtr('');
                            }}
                            className="px-2 py-1 rounded-lg bg-purple-950/60 border border-purple-800 text-purple-300 hover:bg-purple-900 text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <span>UTR Supplement</span>
                          </button>
                        )}

                        {isPending && (
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

      {/* MODAL 1: UTR Supplement Dialog */}
      {supplementItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                Submit UTR Supplement to UniVePay
              </h3>
              <button onClick={() => setSupplementItem(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300 mb-3">
              If user completed payment via bank UPI app and gateway order is pending, forward the 12-digit UTR directly to UniVePay for automated reconciliation:
            </p>

            <div className="bg-[#0d1117] p-3 rounded-xl border border-gray-800 mb-4 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-gray-400 font-sans">Order Ref:</span>
                <span className="text-cyan-300 font-bold">{supplementItem.traceno}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-sans">Amount:</span>
                <span className="text-emerald-400 font-bold">₹{supplementItem.amount}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5">
                12-Digit Bank UTR Number
              </label>
              <input
                type="text"
                value={supplementUtr}
                onChange={(e) => setSupplementUtr(e.target.value)}
                placeholder="e.g. 423985729104"
                className="w-full bg-[#0d1117] border border-gray-700 focus:border-cyan-500 rounded-xl p-2.5 text-xs text-white outline-none font-mono"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSupplementItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUtrSupplement}
                disabled={processingId === supplementItem.id}
                className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {processingId === supplementItem.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit to Gateway'}
              </button>
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
                Reject Recharge Request #{rejectItem.id}
              </h3>
              <button onClick={() => setRejectItem(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300 mb-3">
              Rejecting will notify the user and void this deposit submission.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Invalid UTR / Payment not received on gateway"
              rows={3}
              className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-3 text-xs text-white outline-none focus:border-red-500 mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setRejectItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={processingId === rejectItem.id}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
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
