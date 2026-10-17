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
  Coins,
  ExternalLink,
} from 'lucide-react';
import {
  fetchAdminWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  requestUniVePayGatewayPayout,
} from '../../services/api';
import { WithdrawalItem, WithdrawalMethod } from '../../types';

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
  const [methodFilter, setMethodFilter] = useState<'ALL' | 'BANK' | 'USDT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Complete manual bank payout modal
  const [payoutItem, setPayoutItem] = useState<WithdrawalItem | null>(null);
  const [bankRefNo, setBankRefNo] = useState('');

  // Complete manual USDT payout modal
  const [usdtPayoutItem, setUsdtPayoutItem] = useState<WithdrawalItem | null>(null);
  const [usdtTxHash, setUsdtTxHash] = useState('');

  // Execution states
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingGatewayId, setProcessingGatewayId] = useState<string | null>(null);

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

  const handleConfirmBankPayout = async () => {
    if (!payoutItem) return;
    setProcessingId(payoutItem.id);
    try {
      await approveWithdrawal(payoutItem.id, bankRefNo.trim() || undefined, adminId);
      onShowToast(`Bank withdrawal of ₹${payoutItem.amount} marked as COMPLETED.`);
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

  const handleConfirmUsdtPayout = async () => {
    if (!usdtPayoutItem) return;
    setProcessingId(usdtPayoutItem.id);
    try {
      const ref = usdtTxHash.trim() || `TX-${Date.now()}`;
      await approveWithdrawal(usdtPayoutItem.id, ref, adminId);
      onShowToast(`USDT withdrawal of ${usdtPayoutItem.usdtAmount || ''} USDT marked as COMPLETED.`);
      setUsdtPayoutItem(null);
      setUsdtTxHash('');
      loadWithdrawals();
      onRefreshGlobalStats();
    } catch (e: any) {
      onShowToast(e.message || 'USDT Approval failed');
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

  const handleGatewayPayout = async (item: WithdrawalItem) => {
    if (!item || !item.id) return;
    if (processingGatewayId || processingId) return;

    if (item.withdrawalMethod === 'USDT' || item.walletAddress) {
      onShowToast('USDT withdrawals must be disbursed manually on-chain, not sent to bank gateway.');
      return;
    }

    setProcessingGatewayId(item.id);
    try {
      const res = await requestUniVePayGatewayPayout(item.id);
      const gatewayStatus = (res.gatewayStatus || '').toUpperCase();
      const remarkMsg = res.remark ? ` - ${res.remark}` : '';

      if (gatewayStatus === 'SUCCESS') {
        onShowToast(`Payout Successful${remarkMsg}`);
      } else if (gatewayStatus === 'ACCEPTED' || res.success) {
        onShowToast(`Payout Request Accepted / Processing${remarkMsg}`);
      } else if (gatewayStatus === 'REFUSE') {
        onShowToast(`Gateway Refused Payout${remarkMsg}`);
      } else if (gatewayStatus === 'FAIL') {
        onShowToast(`Gateway Payout Failed${remarkMsg}`);
      } else {
        onShowToast(res.message || `Payout request processed${remarkMsg}`);
      }
    } catch (err: any) {
      onShowToast(err.message || 'Gateway payout request failed');
    } finally {
      setProcessingGatewayId(null);
      loadWithdrawals();
      onRefreshGlobalStats();
    }
  };

  const filteredWithdrawals = withdrawals.filter((w) => {
    // 1. Method Filter
    if (methodFilter !== 'ALL') {
      const isUsdt = w.withdrawalMethod === 'USDT' || Boolean(w.walletAddress);
      if (methodFilter === 'USDT' && !isUsdt) return false;
      if (methodFilter === 'BANK' && isUsdt) return false;
    }

    // 2. Status Filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'PENDING') {
        if (w.status !== 'PENDING' && w.status !== 'PROCESSING') return false;
      } else if (statusFilter === 'COMPLETED') {
        if (w.status !== 'COMPLETED' && w.status !== 'APPROVED') return false;
      } else if (w.status !== statusFilter) {
        return false;
      }
    }

    // 3. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (w.id || '').toLowerCase().includes(q) ||
        (w.userId || '').toLowerCase().includes(q) ||
        (w.username || '').toLowerCase().includes(q) ||
        (w.userMobile || '').toLowerCase().includes(q) ||
        (w.walletAddress || '').toLowerCase().includes(q) ||
        (w.network || '').toLowerCase().includes(q) ||
        (w.bankDetails?.accountNumber || '').toLowerCase().includes(q) ||
        (w.bankDetails?.accountHolderName || w.bankDetails?.holderName || '').toLowerCase().includes(q) ||
        (w.bankDetails?.ifscCode || w.bankDetails?.ifsc || '').toLowerCase().includes(q) ||
        (w.bankDetails?.upiId || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = withdrawals.filter(
    (w) => w.status === 'PENDING' || w.status === 'PROCESSING'
  ).length;
  const usdtCount = withdrawals.filter(
    (w) => w.withdrawalMethod === 'USDT' || Boolean(w.walletAddress)
  ).length;
  const bankCount = withdrawals.length - usdtCount;
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
              Withdrawal Queue & Manual Payout Review
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Review user Bank and USDT withdrawal requests, copy beneficiary or blockchain addresses, disburse payouts, or reject with atomic wallet refund.
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
              title="Refresh queue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Method & Status Filters */}
        <div className="mt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-3 border-t border-gray-800/80">
          {/* Method selector tabs */}
          <div className="flex items-center gap-1.5 bg-[#0d1117] p-1 rounded-xl border border-gray-800">
            <button
              type="button"
              onClick={() => setMethodFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                methodFilter === 'ALL'
                  ? 'bg-gray-700 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All Methods ({withdrawals.length})
            </button>
            <button
              type="button"
              onClick={() => setMethodFilter('BANK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                methodFilter === 'BANK'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Bank Card ({bankCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setMethodFilter('USDT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                methodFilter === 'USDT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>USDT Crypto ({usdtCount})</span>
            </button>
          </div>

          {/* Status selector tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'ALL', label: 'All Status' },
              { id: 'PENDING', label: `Action Required (${pendingCount})` },
              { id: 'COMPLETED', label: 'Completed' },
              { id: 'REJECTED', label: 'Rejected' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
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

        {/* Search input */}
        <div className="mt-3 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Bank Account, IFSC, USDT Wallet Address, Network, User Mobile, Request ID..."
            className="w-full bg-[#0d1117] border border-gray-700/80 focus:border-[#FF6000] rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-gray-500 outline-none"
          />
        </div>
      </div>

      {/* Withdrawals Table */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#0d1117] text-gray-400 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3.5 px-4">Request ID & Method</th>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Amount & Net Payout</th>
                <th className="py-3.5 px-4">Beneficiary / Wallet Details</th>
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
                  const isUsdt = item.withdrawalMethod === 'USDT' || Boolean(item.walletAddress);

                  return (
                    <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                      {/* Request ID, Date & Method Badge */}
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-white text-[11.5px]">{item.id}</div>
                        <div className="text-[10px] text-gray-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </div>
                        <div className="mt-1">
                          {isUsdt ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                              <Coins className="w-3 h-3" />
                              <span>USDT • {item.network || 'TRC20'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-blue-950/80 text-blue-400 border border-blue-800/60">
                              <Building2 className="w-3 h-3" />
                              <span>BANK</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* User Profile */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-200">
                          {item.username || item.userMobile || 'User'}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          ID: {item.userId?.substring(0, 8)}...
                        </div>
                        {item.userMobile && (
                          <div className="text-[10px] text-gray-400">
                            Mob: {item.userMobile}
                          </div>
                        )}
                      </td>

                      {/* Amount & Net Calculation */}
                      <td className="py-3 px-4">
                        {isUsdt ? (
                          <div>
                            <div className="font-extrabold text-emerald-400 text-sm flex items-center gap-1">
                              <Coins className="w-3.5 h-3.5" />
                              <span>
                                {item.usdtAmount !== undefined
                                  ? item.usdtAmount
                                  : (item.netAmount / (item.usdtRate || 100)).toFixed(4)}{' '}
                                USDT
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              ₹{item.amount.toFixed(2)} (Fee: ₹{item.fee.toFixed(2)})
                            </div>
                            <div className="text-[9.5px] text-gray-500">
                              Net: ₹{item.netAmount.toFixed(2)} @ ₹{item.usdtRate || 100}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-extrabold text-purple-400 text-sm">
                              ₹{item.amount.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              Net: ₹{item.netAmount.toFixed(2)}
                            </div>
                            <div className="text-[9.5px] text-gray-500">
                              Fee: ₹{item.fee.toFixed(2)}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Beneficiary Details (Bank Account vs USDT Wallet) */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {isUsdt ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  item.network === 'BEP20'
                                    ? 'bg-amber-950/80 text-amber-400 border border-amber-800'
                                    : 'bg-cyan-950/80 text-cyan-400 border border-cyan-800'
                                }`}
                              >
                                {item.network || 'TRC20'}
                              </span>
                              <span className="text-[10px] text-gray-400 font-sans">
                                (Rate: ₹{item.usdtRate || 100}/USDT)
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1.5 rounded-lg border border-gray-800 max-w-xs">
                              <span className="text-white font-mono text-[11px] truncate flex-1" title={item.walletAddress}>
                                {item.walletAddress || 'N/A'}
                              </span>
                              {item.walletAddress && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(item.walletAddress!)}
                                  className="p-1 text-gray-400 hover:text-white shrink-0 cursor-pointer"
                                  title="Copy USDT Address"
                                >
                                  {copiedText === item.walletAddress ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        ) : item.bankDetails?.upiId && !item.bankDetails?.accountNumber ? (
                          <div>
                            <div className="text-white font-bold mb-0.5">UPI Payout</div>
                            <div className="flex items-center gap-1">
                              <span className="text-amber-400 font-bold">{item.bankDetails.upiId}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.bankDetails!.upiId!)}
                                className="p-0.5 text-gray-400 hover:text-white cursor-pointer"
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
                            <div className="text-white font-bold">
                              {item.bankDetails?.accountHolderName || item.bankDetails?.holderName || 'Account Holder'}
                            </div>
                            <div className="text-gray-400 flex items-center gap-1">
                              <span>
                                A/C: <span className="text-amber-400">{item.bankDetails?.accountNumber}</span>
                              </span>
                              {item.bankDetails?.accountNumber && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(item.bankDetails!.accountNumber)}
                                  className="p-0.5 text-gray-400 hover:text-white cursor-pointer"
                                  title="Copy Account Number"
                                >
                                  {copiedText === item.bankDetails.accountNumber ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                              <span>
                                • IFSC:{' '}
                                <span className="text-cyan-400">
                                  {item.bankDetails?.ifscCode || item.bankDetails?.ifsc || 'N/A'}
                                </span>
                              </span>
                              {(item.bankDetails?.ifscCode || item.bankDetails?.ifsc) &&
                                item.bankDetails?.ifscCode !== 'N/A' &&
                                item.bankDetails?.ifsc !== 'N/A' && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopy((item.bankDetails?.ifscCode || item.bankDetails?.ifsc)!)}
                                    className="p-0.5 text-gray-400 hover:text-white cursor-pointer"
                                    title="Copy IFSC"
                                  >
                                    {copiedText === (item.bankDetails?.ifscCode || item.bankDetails?.ifsc) ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              Bank: {item.bankDetails?.bankName || 'Standard Bank'}{' '}
                              {item.bankDetails?.upiId ? `• UPI: ${item.bankDetails.upiId}` : ''}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Status */}
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
                          <div className="text-[9.5px] text-gray-400 font-mono mt-0.5 truncate max-w-[140px]" title={item.referenceId}>
                            Ref: {item.referenceId}
                          </div>
                        )}
                        {item.rejectionReason && (
                          <div className="text-[9.5px] text-red-400 mt-0.5 line-clamp-1" title={item.rejectionReason}>
                            Reason: {item.rejectionReason}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {isPending ? (
                          <>
                            {/* USDT DISBURSE ACTION */}
                            {isUsdt ? (
                              <button
                                onClick={() => {
                                  setUsdtPayoutItem(item);
                                  setUsdtTxHash('');
                                }}
                                disabled={processingId === item.id}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                              >
                                <Coins className="w-3.5 h-3.5" />
                                <span>Disburse USDT</span>
                              </button>
                            ) : (
                              /* BANK DISBURSE ACTION */
                              <>
                                <button
                                  onClick={() => {
                                    setPayoutItem(item);
                                    setBankRefNo('');
                                  }}
                                  disabled={processingId === item.id || processingGatewayId === item.id}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Disburse Payout</span>
                                </button>

                                <button
                                  onClick={() => handleGatewayPayout(item)}
                                  disabled={processingGatewayId === item.id || processingId === item.id}
                                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  {processingGatewayId === item.id ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Processing...</span>
                                    </>
                                  ) : (
                                    <>
                                      <CreditCard className="w-3.5 h-3.5" />
                                      <span>Gateway Payout</span>
                                    </>
                                  )}
                                </button>
                              </>
                            )}

                            {/* REJECT & REFUND (Both BANK and USDT) */}
                            <button
                              onClick={() => {
                                setRejectItem(item);
                                setRejectReason('');
                              }}
                              disabled={processingId === item.id || processingGatewayId === item.id}
                              className="px-2.5 py-1.5 rounded-lg bg-red-950/60 border border-red-800 hover:bg-red-900 text-red-400 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
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

      {/* MODAL 1: Confirm Manual Bank Payout */}
      {payoutItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Confirm Manual Bank Payout Disbursement
              </h3>
              <button onClick={() => setPayoutItem(null)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0d1117] p-3 rounded-xl border border-gray-800 mb-4 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between font-sans">
                <span className="text-gray-400">Recipient Name:</span>
                <span className="font-bold text-white">
                  {payoutItem.bankDetails?.accountHolderName || payoutItem.bankDetails?.holderName || 'Account Holder'}
                </span>
              </div>
              {payoutItem.bankDetails?.accountNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-400 font-sans">Bank Account:</span>
                  <span className="text-amber-400 font-bold">{payoutItem.bankDetails?.accountNumber}</span>
                </div>
              )}
              {(payoutItem.bankDetails?.ifscCode || payoutItem.bankDetails?.ifsc) && (
                <div className="flex justify-between">
                  <span className="text-gray-400 font-sans">IFSC Code:</span>
                  <span className="text-cyan-400 font-bold">
                    {payoutItem.bankDetails?.ifscCode || payoutItem.bankDetails?.ifsc}
                  </span>
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
                onClick={handleConfirmBankPayout}
                disabled={processingId === payoutItem.id}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {processingId === payoutItem.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark Completed'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Confirm Manual USDT Payout */}
      {usdtPayoutItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-400" />
                Manual USDT Payout Disbursement
              </h3>
              <button onClick={() => setUsdtPayoutItem(null)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-xs text-emerald-300/90 mb-4 leading-relaxed">
              <strong>Manual Payout Only:</strong> The administrator transfers USDT externally using their external crypto wallet or exchange. Do not complete this request until the transaction is successfully broadcasted on-chain.
            </div>

            <div className="bg-[#0d1117] p-3 rounded-xl border border-gray-800 mb-4 text-xs space-y-2 font-mono">
              <div className="flex justify-between font-sans">
                <span className="text-gray-400">User:</span>
                <span className="font-bold text-white">{usdtPayoutItem.username || usdtPayoutItem.userMobile || 'User'}</span>
              </div>

              <div className="flex justify-between font-sans items-center">
                <span className="text-gray-400">Blockchain Network:</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10.5px] font-bold uppercase tracking-wider ${
                    usdtPayoutItem.network === 'BEP20'
                      ? 'bg-amber-950/80 text-amber-400 border border-amber-800'
                      : 'bg-cyan-950/80 text-cyan-400 border border-cyan-800'
                  }`}
                >
                  {usdtPayoutItem.network || 'TRC20'}
                </span>
              </div>

              <div>
                <span className="text-gray-400 font-sans block mb-1">Receiving Wallet Address:</span>
                <div className="flex items-center gap-1.5 bg-black/50 p-2 rounded-lg border border-gray-800">
                  <span className="text-emerald-400 font-mono text-[11px] break-all select-all flex-1">
                    {usdtPayoutItem.walletAddress}
                  </span>
                  {usdtPayoutItem.walletAddress && (
                    <button
                      type="button"
                      onClick={() => handleCopy(usdtPayoutItem.walletAddress!)}
                      className="p-1 text-gray-400 hover:text-white shrink-0 cursor-pointer"
                      title="Copy Address"
                    >
                      {copiedText === usdtPayoutItem.walletAddress ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-between font-sans border-t border-gray-800 pt-2 font-bold">
                <span className="text-gray-300">Net Amount to Transfer:</span>
                <span className="text-emerald-400 text-sm">
                  {usdtPayoutItem.usdtAmount !== undefined
                    ? usdtPayoutItem.usdtAmount
                    : (usdtPayoutItem.netAmount / (usdtPayoutItem.usdtRate || 100)).toFixed(4)}{' '}
                  USDT
                </span>
              </div>
              <div className="flex justify-between font-sans text-[11px] text-gray-500">
                <span>Equivalent INR:</span>
                <span>₹{usdtPayoutItem.netAmount.toFixed(2)} (Fee: ₹{usdtPayoutItem.fee.toFixed(2)})</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5">
                Blockchain Tx Hash / Transaction Reference ID
              </label>
              <input
                type="text"
                value={usdtTxHash}
                onChange={(e) => setUsdtTxHash(e.target.value)}
                placeholder="e.g. 0x8f2d4e... or 7b3a9c... or TX-1002"
                className="w-full bg-[#0d1117] border border-gray-700 focus:border-emerald-500 rounded-xl p-2.5 text-xs text-white font-mono outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setUsdtPayoutItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUsdtPayout}
                disabled={processingId === usdtPayoutItem.id}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {processingId === usdtPayoutItem.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm USDT Sent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Reject and Refund Modal */}
      {rejectItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Reject & Refund Withdrawal #{rejectItem.id}
              </h3>
              <button onClick={() => setRejectItem(null)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300 mb-3">
              Rejecting this {rejectItem.withdrawalMethod === 'USDT' ? 'USDT' : 'Bank'} request will automatically refund{' '}
              <strong className="text-emerald-400">₹{rejectItem.amount.toFixed(2)}</strong> back to the user's available device earnings wallet balance.
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={
                rejectItem.withdrawalMethod === 'USDT'
                  ? 'e.g., Invalid USDT wallet address / Unsupported chain'
                  : 'e.g., Invalid IFSC code / Beneficiary account name mismatch'
              }
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
