import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  DollarSign,
  ShieldCheck,
  FileText,
  Eye,
  X,
  AlertTriangle,
  User,
  Phone,
  Hash,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { DepositComplaint } from '../../types';
import {
  fetchAdminDepositComplaints,
  approveDepositComplaint,
  rejectDepositComplaint,
} from '../../services/api';

interface AdminComplaintsTabProps {
  adminId: string;
  onShowToast: (msg: string) => void;
  onRefreshGlobalStats: () => void;
}

export const AdminComplaintsTab: React.FC<AdminComplaintsTabProps> = ({
  adminId,
  onShowToast,
  onRefreshGlobalStats,
}) => {
  const [complaints, setComplaints] = useState<DepositComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Modals & Action States
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
  const [approvingComplaint, setApprovingComplaint] = useState<DepositComplaint | null>(null);
  const [rejectingComplaint, setRejectingComplaint] = useState<DepositComplaint | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('Invalid UTR / Payment not received in merchant account');
  const [actionLoading, setActionLoading] = useState(false);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminDepositComplaints();
      setComplaints(data || []);
    } catch (err: any) {
      onShowToast(err.message || 'Failed to load deposit complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleApprove = async () => {
    if (!approvingComplaint) return;
    setActionLoading(true);
    try {
      const res = await approveDepositComplaint(approvingComplaint.id, adminId, adminNote);
      onShowToast(res.message || `Complaint approved! ₹${approvingComplaint.amount} credited to user Recharge Wallet.`);
      setApprovingComplaint(null);
      setAdminNote('');
      await loadComplaints();
      onRefreshGlobalStats();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to approve deposit complaint');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingComplaint) return;
    if (!rejectionReason.trim()) {
      onShowToast('Please provide a rejection reason');
      return;
    }
    setActionLoading(true);
    try {
      const res = await rejectDepositComplaint(rejectingComplaint.id, rejectionReason, adminId);
      onShowToast(res.message || 'Complaint rejected successfully.');
      setRejectingComplaint(null);
      setRejectionReason('Invalid UTR / Payment not received in merchant account');
      await loadComplaints();
      onRefreshGlobalStats();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to reject complaint');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered complaints
  const filteredComplaints = complaints.filter((c) => {
    const matchesSearch =
      (c.utr || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.orderId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.userMobile || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(c.amount).includes(searchQuery);

    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PENDING') {
      return c.status === 'PENDING_VERIFICATION' || c.status === ('PENDING' as any);
    }
    if (statusFilter === 'APPROVED') {
      return c.status === 'PAID' || c.status === 'APPROVED';
    }
    if (statusFilter === 'REJECTED') {
      return c.status === 'REJECTED';
    }
    return true;
  });

  // Calculate Metrics
  const totalCount = complaints.length;
  const pendingCount = complaints.filter(
    (c) => c.status === 'PENDING_VERIFICATION' || c.status === ('PENDING' as any)
  ).length;
  const approvedTotal = complaints
    .filter((c) => c.status === 'PAID' || c.status === 'APPROVED')
    .reduce((acc, c) => acc + (c.amount || 0), 0);
  const rejectedCount = complaints.filter((c) => c.status === 'REJECTED').length;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-[#161b22] border border-gray-800/80 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <span>Deposit Problems & Manual Complaints</span>
              {pendingCount > 0 && (
                <span className="bg-rose-950/80 text-rose-400 border border-rose-800/60 text-xs font-semibold px-2.5 py-0.5 rounded-full animate-pulse">
                  {pendingCount} Pending Review
                </span>
              )}
            </h2>
            <p className="text-gray-400 text-xs mt-1">
              Review and manually verify user deposit payment disputes with 12-digit UTR and payment screenshot proofs.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadComplaints}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-200 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh List</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-5">
          <div className="bg-[#0d1117] border border-gray-800/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-1">
              <span>Total Disputes</span>
              <FileText className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-lg font-bold text-white">{totalCount}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">All complaints submitted</div>
          </div>

          <div className="bg-[#0d1117] border border-rose-900/40 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-rose-400 text-xs font-medium mb-1">
              <span>Pending Review</span>
              <Clock className="w-3.5 h-3.5 text-rose-400 animate-spin" />
            </div>
            <div className="text-lg font-bold text-rose-400">{pendingCount}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Action required</div>
          </div>

          <div className="bg-[#0d1117] border border-emerald-900/40 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-medium mb-1">
              <span>Total Approved</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-emerald-400">
              ₹{approvedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Credited to Recharge Wallet</div>
          </div>

          <div className="bg-[#0d1117] border border-gray-800/80 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-1">
              <span>Rejected</span>
              <XCircle className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <div className="text-lg font-bold text-gray-300">{rejectedCount}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Invalid disputes</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-[#161b22] border border-gray-800/80 rounded-2xl p-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 bg-[#0d1117] p-1 rounded-xl border border-gray-800/60 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-[#FF6000] text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'PENDING'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-400/90 hover:text-rose-300'
            }`}
          >
            <span>Pending</span>
            {pendingCount > 0 && (
              <span className="bg-black/40 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-400/90 hover:text-emerald-300'
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'REJECTED'
                ? 'bg-gray-700 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Rejected
          </button>
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search UTR, Order, Phone, User..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0d1117] border border-gray-800 text-white text-xs rounded-xl pl-9 pr-4 py-2 outline-none focus:border-[#FF6000] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Complaints List Table / Cards */}
      <div className="bg-[#161b22] border border-gray-800/80 rounded-2xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-12 text-center text-gray-400 space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin text-[#FF6000]" />
            <p className="text-sm font-medium">Loading deposit complaints from Supabase...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="p-12 text-center text-gray-500 space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-gray-600 opacity-60" />
            <p className="text-sm font-semibold text-gray-300">No deposit complaints found</p>
            <p className="text-xs text-gray-500">
              {searchQuery
                ? 'No complaints matched your search filter.'
                : 'All user deposit disputes have been reviewed and settled.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-800/80 bg-[#0d1117]/60 text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">User & Contact</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">12-Digit UTR</th>
                  <th className="py-3.5 px-4">Order / Traceno</th>
                  <th className="py-3.5 px-4">Proof Screenshot</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Submitted At</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredComplaints.map((item) => {
                  const isPending =
                    item.status === 'PENDING_VERIFICATION' || item.status === ('PENDING' as any);
                  const isApproved = item.status === 'PAID' || item.status === 'APPROVED';
                  const isRejected = item.status === 'REJECTED';

                  const dateStr = item.createdAt
                    ? new Date(item.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-800/30 transition-colors group"
                    >
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-300 font-bold text-xs uppercase">
                            {item.username ? item.username.charAt(0) : 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-white text-xs flex items-center gap-1.5">
                              <span>{item.username || 'User'}</span>
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono mt-0.5 flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5 text-gray-500" />
                              <span>{item.userMobile || 'No mobile'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-white text-sm text-emerald-400">
                          +₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-gray-500">Topup Credit</div>
                      </td>

                      {/* UTR */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-amber-300 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-md">
                            {item.utr || 'N/A'}
                          </span>
                          {item.utr && (
                            <button
                              onClick={() => handleCopy(item.utr)}
                              className="text-gray-500 hover:text-gray-300 p-1 rounded hover:bg-gray-800 transition-colors cursor-pointer"
                              title="Copy UTR"
                            >
                              {copiedText === item.utr ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                        {item.userNote && (
                          <p className="text-[11px] text-gray-400 italic mt-1 line-clamp-1">
                            💬 "{item.userNote}"
                          </p>
                        )}
                      </td>

                      {/* Order / Traceno */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-300">
                          <span>#{item.traceno || item.orderId}</span>
                          <button
                            onClick={() => handleCopy(item.traceno || item.orderId)}
                            className="text-gray-500 hover:text-gray-300 p-0.5 cursor-pointer"
                            title="Copy Order ID"
                          >
                            {copiedText === (item.traceno || item.orderId) ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Proof Screenshot */}
                      <td className="py-3.5 px-4">
                        {item.proofUrl || item.receiptUrl ? (
                          <button
                            onClick={() => setSelectedProofUrl(item.proofUrl || item.receiptUrl || '')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/40 text-blue-400 border border-blue-800/40 text-[11px] font-semibold hover:bg-blue-900/50 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View Proof</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-gray-500 italic">No image</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950/80 text-rose-400 border border-rose-800/60">
                            <Clock className="w-3 h-3 animate-spin" />
                            <span>PENDING</span>
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>APPROVED</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-800 text-gray-400 border border-gray-700">
                            <XCircle className="w-3 h-3" />
                            <span>REJECTED</span>
                          </span>
                        )}
                        {item.rejectionReason && !isPending && (
                          <div className="text-[10px] text-gray-400 mt-1 max-w-[140px] truncate" title={item.rejectionReason}>
                            {item.rejectionReason}
                          </div>
                        )}
                      </td>

                      {/* Submitted At */}
                      <td className="py-3.5 px-4 text-gray-400 text-[11px]">
                        {dateStr}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setApprovingComplaint(item);
                                setAdminNote('');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-sm"
                              title="Approve and Credit Topup Wallet"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => {
                                setRejectingComplaint(item);
                                setRejectionReason('Invalid UTR / Payment not received in merchant account');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-800/60 active:scale-95 text-rose-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all"
                              title="Reject Dispute"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-500 font-medium">Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PROOF SCREENSHOT PREVIEW MODAL */}
      {selectedProofUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-700 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-400" />
                <span>Payment Screenshot Proof</span>
              </h3>
              <button
                onClick={() => setSelectedProofUrl(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-[#0d1117] flex items-center justify-center max-h-[70vh] overflow-auto">
              <img
                src={selectedProofUrl}
                alt="Payment Proof"
                className="max-h-[60vh] max-w-full rounded-xl object-contain border border-gray-800"
              />
            </div>
            <div className="p-3 bg-[#161b22] border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setSelectedProofUrl(null)}
                className="px-4 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPROVAL CONFIRMATION MODAL */}
      {approvingComplaint && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-emerald-700/60 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Approve Deposit Dispute</span>
              </h3>
              <button
                onClick={() => setApprovingComplaint(null)}
                disabled={actionLoading}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center text-emerald-300">
                  <span className="font-semibold">Crediting User:</span>
                  <span className="font-bold text-white">{approvingComplaint.username || 'User'}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-300">
                  <span className="font-semibold">Credit Amount:</span>
                  <span className="font-extrabold text-white text-sm">
                    +₹{approvingComplaint.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-emerald-300">
                  <span className="font-semibold">Target Wallet:</span>
                  <span className="font-bold text-amber-300">TOPUP / RECHARGE WALLET</span>
                </div>
                <div className="flex justify-between items-center text-emerald-300">
                  <span className="font-semibold">12-Digit UTR:</span>
                  <span className="font-mono font-bold text-white">{approvingComplaint.utr}</span>
                </div>
              </div>

              <p className="text-gray-300 text-xs leading-relaxed">
                By confirming, ₹{approvingComplaint.amount} will be immediately credited to the user's Recharge Wallet, a permanent ledger entry created, and the user notified.
              </p>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">
                  Optional Admin Note (for audit record):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified via Bank Statement UTR match"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full bg-[#0d1117] border border-gray-700 text-white rounded-xl p-2.5 outline-none focus:border-emerald-500 text-xs"
                />
              </div>
            </div>

            <div className="p-4 bg-[#0d1117] border-t border-gray-800 flex justify-end gap-2">
              <button
                onClick={() => setApprovingComplaint(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-md"
              >
                {actionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Confirm & Credit ₹{approvingComplaint.amount}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {rejectingComplaint && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-rose-700/60 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>Reject Deposit Dispute</span>
              </h3>
              <button
                onClick={() => setRejectingComplaint(null)}
                disabled={actionLoading}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-rose-950/40 border border-rose-800/40 rounded-xl p-3.5 space-y-1.5 text-rose-300">
                <div>
                  <span className="font-semibold">User:</span> {rejectingComplaint.username || 'User'}
                </div>
                <div>
                  <span className="font-semibold">Disputed Amount:</span> ₹{rejectingComplaint.amount}
                </div>
                <div>
                  <span className="font-semibold">Submitted UTR:</span> {rejectingComplaint.utr}
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Rejection Reason (visible to user):
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full bg-[#0d1117] border border-gray-700 text-white rounded-xl p-2.5 outline-none focus:border-rose-500 text-xs mb-2"
                >
                  <option value="Invalid UTR / Payment not received in merchant account">
                    Invalid UTR / Payment not received in merchant account
                  </option>
                  <option value="Amount in screenshot does not match claim">
                    Amount in screenshot does not match claim
                  </option>
                  <option value="Duplicate UTR already claimed by another user">
                    Duplicate UTR already claimed by another user
                  </option>
                  <option value="Fake / Manipulated Payment Screenshot">
                    Fake / Manipulated Payment Screenshot
                  </option>
                  <option value="Transaction failed on banking network">
                    Transaction failed on banking network
                  </option>
                  <option value="Custom">Custom Reason (Type below)</option>
                </select>

                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide detailed explanation for user..."
                  className="w-full bg-[#0d1117] border border-gray-700 text-white rounded-xl p-2.5 outline-none focus:border-rose-500 text-xs"
                />
              </div>
            </div>

            <div className="p-4 bg-[#0d1117] border-t border-gray-800 flex justify-end gap-2">
              <button
                onClick={() => setRejectingComplaint(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-md"
              >
                {actionLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
