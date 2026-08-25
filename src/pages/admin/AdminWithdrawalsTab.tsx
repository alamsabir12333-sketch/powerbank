import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Building2,
  RefreshCw,
  Loader2,
  X,
  CreditCard,
  AlertTriangle,
  Send,
  Banknote,
  Copy,
  Check,
} from 'lucide-react';
import {
  fetchAdminWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
} from '../../services/api';
import { WithdrawalItem } from '../../types';

interface AdminWithdrawalsTabProps {
  adminId: string;
  onShowToast: (msg: string) => void;
  onRefreshGlobalStats: () => void;
}

export const AdminWithdrawalsTab: React.FC<AdminWithdrawalsTabProps> = ({
  adminId,
  onShowToast,
  onRefreshGlobalStats,
}) => {
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Complete payout modal
  const [payoutItem, setPayoutItem] = useState<WithdrawalItem | null>(null);
  const [bankRefNo, setBankRefNo] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Reject modal
  const [rejectItem, setRejectItem] = useState<WithdrawalItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadWithdrawals = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminWithdrawals();
      setWithdrawals(data);
    } catch (e: any) {
      onShowToast(e.message || 'Error loading withdrawals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleConfirmPayout = async () => {
    if (!payoutItem) return;
    setProcessingId(payoutItem.id);
    try {
      await approveWithdrawal(payoutItem.id, bankRefNo, adminId);
      onShowToast(`Withdrawal of ₹${payoutItem.amount} marked as COMPLETED.`);
      setPayoutItem(null);
      setBankRefNo('');
      loadWithdrawals();
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
      onShowToast('Please provide a rejection reason.');
      return;
    }

    setProcessingId(rejectItem.id);
    try {
      await rejectWithdrawal(rejectItem.id, rejectReason, adminId);
      onShowToast(`Withdrawal rejected and ₹${rejectItem.amount} refunded to user wallet.`);
      setRejectItem(null);
      setRejectReason('');
      loadWithdrawals();
      onRefreshGlobalStats();
    } catch (e: any) {
      onShowToast(e.message || 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'PENDING') {
        if (w.status !== 'PENDING' && w.status !== 'PROCESSING') return false;
      } else if (statusFilter === 'COMPLETED') {
        if (w.status !== 'COMPLETED' && w.status !== 'APPROVED') return false;
      } else if (w.status !== statusFilter) {
        return false;
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (w.id || '').toLowerCase().includes(q) ||
        (w.userId || '').toLowerCase().includes(q) ||
        (w.username || '').toLowerCase().includes(q) ||
        (w.userMobile || '').toLowerCase().includes(q) ||
        (w.bankDetails?.accountNumber || '').toLowerCase().includes(q) ||
        (w.bankDetails?.holderName || '').toLowerCase().includes(q) ||
        (w.bankDetails?.ifscCode || '').toLowerCase().includes(q) ||
        (w.bankDetails?.upiId || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = withdrawals.filter(
    (w) => w.status === 'PENDING' || w.status === 'PROCESSING'
  ).length;
  const completedTotal = withdrawals
    .filter((w) => w.status === 'COMPLETED' || w.status === 'APPROVED')
    .reduce((acc, w) => acc + w.amount, 0);

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-purple-400" />
              Manual Withdrawal Queue & Payout Review
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Review user withdrawal requests, copy beneficiary banking / UPI details, mark payouts as disbursed, or reject with atomic refund.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-800/40 text-purple-400 text-xs font-bold">
              Total Disbursed: ₹{completedTotal.toLocaleString()}
            </div>
            <button
              onClick={loadWithdrawals}
              disabled={loading}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Bank Account, IFSC, Holder Name, UPI ID, User ID..."
              className="w-full bg-[#0d1117] border border-gray-700/80 focus:border-[#FF6000] rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-gray-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'PENDING', label: `Action Required (${pendingCount})` },
              { id: 'COMPLETED', label: 'Completed' },
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

      {/* Withdrawals Table */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#0d1117] text-gray-400 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3.5 px-4">Request ID & Date</th>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Beneficiary Details</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF6000]" />
                    <span>Loading withdrawal queue...</span>
                  </td>
                </tr>
              ) : filteredWithdrawals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-500">
                    No withdrawal records found.
                  </td>
                </tr>
              ) : (
                filteredWithdrawals.map((item) => {
                  const isPending = item.status === 'PENDING' || item.status === 'PROCESSING';
                  const isCompleted = item.status === 'COMPLETED' || item.status === 'APPROVED';
                  const isRejected = item.status === 'REJECTED';

                  return (
                    <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-white text-[11.5px]">{item.id}</div>
                        <div className="text-[10px] text-gray-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-200">
                          {item.username || item.userMobile || 'User'}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          ID: {item.userId?.substring(0, 8)}...
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-extrabold text-purple-400 text-sm">
                          ₹{item.amount.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-gray-500">Fee: ₹0.00</div>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px]">
                        {item.bankDetails?.upiId && !item.bankDetails?.accountNumber ? (
                          <div>
                            <div className="text-white font-bold mb-0.5">UPI Payout</div>
                            <div className="flex items-center gap-1">
                              <span className="text-amber-400 font-bold">{item.bankDetails.upiId}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.bankDetails!.upiId!)}
                                className="p-0.5 text-gray-400 hover:text-white"
                                title="Copy UPI ID"
                              >
                                {copiedText === item.bankDetails.upiId ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-white font-bold">{item.bankDetails?.holderName || 'Account Holder'}</div>
                            <div className="text-gray-400 flex items-center gap-1">
                              <span>A/C: <span className="text-amber-400">{item.bankDetails?.accountNumber}</span></span>
                              {item.bankDetails?.accountNumber && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(item.bankDetails!.accountNumber)}
                                  className="p-0.5 text-gray-400 hover:text-white"
                                  title="Copy Account Number"
                                >
                                  {copiedText === item.bankDetails.accountNumber ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                              <span>• IFSC: <span className="text-cyan-400">{item.bankDetails?.ifscCode}</span></span>
                              {item.bankDetails?.ifscCode && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(item.bankDetails!.ifscCode)}
                                  className="p-0.5 text-gray-400 hover:text-white"
                                  title="Copy IFSC"
                                >
                                  {copiedText === item.bankDetails.ifscCode ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              Bank: {item.bankDetails?.bankName || 'Standard Bank'} {item.bankDetails?.upiId ? `• UPI: ${item.bankDetails.upiId}` : ''}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCompleted
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                              : isPending
                              ? 'bg-purple-950/60 text-purple-400 border border-purple-800/50 animate-pulse'
                              : 'bg-red-950/60 text-red-400 border border-red-800/50'
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.referenceId && (
                          <div className="text-[9.5px] text-gray-400 font-mono mt-0.5">
                            Ref: {item.referenceId}
                          </div>
                        )}
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
                              onClick={() => {
                                setPayoutItem(item);
                                setBankRefNo('');
                              }}
                              disabled={processingId === item.id}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Disburse Payout</span>
                            </button>

                            <button
                              onClick={() => {
                                setRejectItem(item);
                                setRejectReason('');
                              }}
                              disabled={processingId === item.id}
                              className="px-2.5 py-1.5 rounded-lg bg-red-950/60 border border-red-800 hover:bg-red-900 text-red-400 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject & Refund</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-gray-500 font-mono">
                            {item.referenceId ? `Ref: ${item.referenceId}` : 'Finalized'}
                          </span>
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

      {/* MODAL 1: Confirm Disburse Payout */}
      {payoutItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Confirm Manual Payout Disbursement
              </h3>
              <button onClick={() => setPayoutItem(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0d1117] p-3 rounded-xl border border-gray-800 mb-4 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between font-sans">
                <span className="text-gray-400">Recipient Name:</span>
                <span className="font-bold text-white">{payoutItem.bankDetails?.holderName || 'Account Holder'}</span>
              </div>
              {payoutItem.bankDetails?.accountNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-400 font-sans">Bank Account:</span>
                  <span className="text-amber-400 font-bold">{payoutItem.bankDetails?.accountNumber}</span>
                </div>
              )}
              {payoutItem.bankDetails?.ifscCode && (
                <div className="flex justify-between">
                  <span className="text-gray-400 font-sans">IFSC Code:</span>
                  <span className="text-cyan-400 font-bold">{payoutItem.bankDetails?.ifscCode}</span>
                </div>
              )}
              {payoutItem.bankDetails?.bankName && (
                <div className="flex justify-between font-sans">
                  <span className="text-gray-400">Bank Name:</span>
                  <span className="text-gray-200">{payoutItem.bankDetails?.bankName}</span>
                </div>
              )}
              {payoutItem.bankDetails?.upiId && (
                <div className="flex justify-between">
                  <span className="text-gray-400 font-sans">UPI ID:</span>
                  <span className="text-emerald-400 font-bold">{payoutItem.bankDetails?.upiId}</span>
                </div>
              )}
              <div className="flex justify-between font-sans border-t border-gray-800 pt-1.5 font-bold">
                <span className="text-gray-300">Amount to Transfer:</span>
                <span className="text-emerald-400 text-sm">₹{payoutItem.amount.toFixed(2)}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5">
                Bank IMPS RRN / UPI UTR / Reference No (Optional)
              </label>
              <input
                type="text"
                value={bankRefNo}
                onChange={(e) => setBankRefNo(e.target.value)}
                placeholder="e.g. IMPS-9827361829 or UPI-29837192"
                className="w-full bg-[#0d1117] border border-gray-700 focus:border-emerald-500 rounded-xl p-2.5 text-xs text-white outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPayoutItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayout}
                disabled={processingId === payoutItem.id}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {processingId === payoutItem.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark Completed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Reject and Refund Modal */}
      {rejectItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Reject & Refund Withdrawal #{rejectItem.id}
              </h3>
              <button onClick={() => setRejectItem(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300 mb-3">
              Rejecting this request will automatically refund <strong className="text-emerald-400">₹{rejectItem.amount.toFixed(2)}</strong> back to the user's available device earnings wallet balance.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Invalid IFSC code / Beneficiary account name mismatch"
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
                {processingId === rejectItem.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Refund & Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
