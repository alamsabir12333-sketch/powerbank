import React, { useState, useEffect } from 'react';
import { UsdtDepositItem } from '../../types';
import {
  fetchAdminUsdtDeposits,
  fetchUsdtSignedUrl,
  approveUsdtDeposit,
  rejectUsdtDeposit,
} from '../../services/api';
import {
  Coins,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  X,
  Loader2,
  ExternalLink,
  DollarSign,
  User,
} from 'lucide-react';

interface AdminUsdtDepositsTabProps {
  onShowToast?: (msg: string) => void;
}

export default function AdminUsdtDepositsTab({ onShowToast }: AdminUsdtDepositsTabProps) {
  const [deposits, setDeposits] = useState<UsdtDepositItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedProofUrl, setSelectedProofUrl] = useState<string | null>(null);
  const [selectedDepositForProof, setSelectedDepositForProof] = useState<UsdtDepositItem | null>(null);
  const [loadingSignedUrl, setLoadingSignedUrl] = useState(false);

  // Action Modals
  const [approveModalItem, setApproveModalItem] = useState<UsdtDepositItem | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [approving, setApproving] = useState(false);

  const [rejectModalItem, setRejectModalItem] = useState<UsdtDepositItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadDeposits = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsdtDeposits();
      setDeposits(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch USDT deposits.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeposits();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    if (onShowToast) onShowToast('Copied to clipboard!');
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleOpenProof = async (item: UsdtDepositItem) => {
    setSelectedDepositForProof(item);
    if (item.signedProofUrl) {
      setSelectedProofUrl(item.signedProofUrl);
      return;
    }
    setLoadingSignedUrl(true);
    setSelectedProofUrl(null);
    try {
      const url = await fetchUsdtSignedUrl(item.userId, item.id, item.proofUrl);
      setSelectedProofUrl(url || item.proofUrl);
    } catch {
      setSelectedProofUrl(item.proofUrl);
    } finally {
      setLoadingSignedUrl(false);
    }
  };

  const handleApprove = async () => {
    if (!approveModalItem) return;
    setApproving(true);
    try {
      const res = await approveUsdtDeposit(approveModalItem.id, 'adm_root', adminNote.trim());
      if (onShowToast) onShowToast(res.message || 'USDT Deposit approved and wallet credited!');
      setApproveModalItem(null);
      setAdminNote('');
      await loadDeposits();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Approval failed.');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModalItem) return;
    if (!rejectionReason.trim()) {
      if (onShowToast) onShowToast('Please provide a reason for rejection.');
      return;
    }
    setRejecting(true);
    try {
      const res = await rejectUsdtDeposit(rejectModalItem.id, rejectionReason.trim(), 'adm_root');
      if (onShowToast) onShowToast(res.message || 'USDT Deposit rejected.');
      setRejectModalItem(null);
      setRejectionReason('');
      await loadDeposits();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Rejection failed.');
    } finally {
      setRejecting(false);
    }
  };

  const filteredDeposits = deposits.filter((item) => {
    if (filterStatus !== 'ALL' && item.status.toUpperCase() !== filterStatus) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = item.id.toLowerCase().includes(q);
      const matchUser = (item.username || '').toLowerCase().includes(q) || item.userId.toLowerCase().includes(q);
      const matchPhone = (item.phone || '').toLowerCase().includes(q);
      const matchTx = (item.txHash || '').toLowerCase().includes(q);
      const matchAmt = String(item.amountInr).includes(q) || String(item.usdtAmount).includes(q);
      return matchId || matchUser || matchPhone || matchTx || matchAmt;
    }
    return true;
  });

  const pendingCount = deposits.filter((d) => d.status.toUpperCase() === 'PENDING').length;
  const approvedCount = deposits.filter((d) => ['APPROVED', 'PAID', 'SUCCESS'].includes(d.status.toUpperCase())).length;
  const totalApprovedInr = deposits
    .filter((d) => ['APPROVED', 'PAID', 'SUCCESS'].includes(d.status.toUpperCase()))
    .reduce((sum, d) => sum + (d.amountInr || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF5500] flex items-center justify-center font-bold">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">USDT Manual Deposits</h2>
            <p className="text-xs text-gray-500">
              Review blockchain transfer screenshots and manually credit user wallets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/60 text-xs">
            <span className="text-amber-700 font-semibold">Pending: </span>
            <span className="font-bold text-amber-900">{pendingCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/60 text-xs">
            <span className="text-emerald-700 font-semibold">Approved: </span>
            <span className="font-bold text-emerald-900">{approvedCount} (₹{totalApprovedInr.toLocaleString('en-IN')})</span>
          </div>
          <button
            type="button"
            onClick={loadDeposits}
            disabled={loading}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by User, Phone, TXID, Amount..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#FF5500]"
          />
        </div>

        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 w-full sm:w-auto">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                filterStatus === st
                  ? 'bg-[#FF5500] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table / List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#FF5500]" />
            <p className="text-xs font-medium">Loading USDT deposits...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-500 space-y-2">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="text-xs font-bold">{error}</p>
            <button
              type="button"
              onClick={loadDeposits}
              className="px-4 py-1.5 bg-red-100 text-red-700 rounded-xl text-xs font-bold"
            >
              Retry
            </button>
          </div>
        ) : filteredDeposits.length === 0 ? (
          <div className="py-16 text-center text-gray-400 space-y-1">
            <Coins className="w-8 h-8 mx-auto opacity-30" />
            <p className="text-xs font-medium">No USDT deposits found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-100 text-gray-500 uppercase tracking-wider font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">User Details</th>
                  <th className="py-3 px-4">INR Amount</th>
                  <th className="py-3 px-4">USDT Sent</th>
                  <th className="py-3 px-4">Network & Hash</th>
                  <th className="py-3 px-4">Proof</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDeposits.map((item) => {
                  const isPending = item.status.toUpperCase() === 'PENDING';
                  const isApproved = ['APPROVED', 'PAID', 'SUCCESS'].includes(item.status.toUpperCase());
                  const isRejected = ['REJECTED', 'FAILED'].includes(item.status.toUpperCase());

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* User Info */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900">
                          {item.username || item.phone || 'User'}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          ID: {item.userId.substring(0, 10)}...
                        </div>
                        {item.phone && (
                          <div className="text-[11px] text-gray-500">{item.phone}</div>
                        )}
                      </td>

                      {/* INR Amount */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-base text-gray-900">
                          ₹{item.amountInr.toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* USDT Amount */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#FF5500] text-sm">
                          {item.usdtAmount} USDT
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Rate: ₹{item.usdtRate || 100}
                        </div>
                      </td>

                      {/* Network & Hash */}
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md font-bold text-[10px] bg-gray-100 text-gray-700 mb-1">
                          {item.network}
                        </span>
                        {item.txHash ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-[10px] text-gray-500 truncate max-w-[120px]">
                              {item.txHash}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(item.txHash!, item.id + '-tx')}
                              className="text-gray-400 hover:text-gray-600 cursor-pointer"
                              title="Copy Hash"
                            >
                              {copiedField === item.id + '-tx' ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-400 italic">No TXID</div>
                        )}
                      </td>

                      {/* Proof Screenshot */}
                      <td className="py-3 px-4">
                        {item.proofUrl ? (
                          <button
                            type="button"
                            onClick={() => handleOpenProof(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#FF5500] font-bold text-[11px] transition-colors cursor-pointer border border-orange-200/60"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Proof</span>
                          </button>
                        ) : (
                          <span className="text-gray-400 text-[11px]">No proof</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>APPROVED</span>
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3 h-3" />
                            <span>REJECTED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 animate-spin" />
                            <span>PENDING</span>
                          </span>
                        )}
                        {item.adminNote && (
                          <p className="text-[10px] text-gray-400 mt-1 max-w-[130px] truncate" title={item.adminNote}>
                            {item.adminNote}
                          </p>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-gray-500 text-[11px]">
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setApproveModalItem(item);
                                setAdminNote('');
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectModalItem(item);
                                setRejectionReason('');
                              }}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg font-bold text-[11px] cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 font-medium">Settled</span>
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

      {/* Proof Screenshot Viewer Modal */}
      {selectedDepositForProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-gray-900">USDT Transfer Screenshot Proof</h4>
                <p className="text-[11px] text-gray-500">
                  User: {selectedDepositForProof.username || selectedDepositForProof.phone || selectedDepositForProof.userId} • ₹{selectedDepositForProof.amountInr} ({selectedDepositForProof.usdtAmount} USDT)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedDepositForProof(null);
                  setSelectedProofUrl(null);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 max-h-[65vh] overflow-auto flex items-center justify-center bg-gray-50 min-h-[250px]">
              {loadingSignedUrl ? (
                <div className="text-center py-10 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#FF5500]" />
                  <p className="text-xs text-gray-500">Generating secure signed URL...</p>
                </div>
              ) : selectedProofUrl ? (
                <img
                  src={selectedProofUrl}
                  alt="USDT Proof"
                  className="max-h-[60vh] object-contain rounded-lg border border-gray-200"
                />
              ) : (
                <p className="text-xs text-gray-400">Unable to load screenshot</p>
              )}
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <div className="text-[11px] font-mono text-gray-500 truncate max-w-[250px]">
                TX: {selectedDepositForProof.txHash || 'None'}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedDepositForProof(null);
                  setSelectedProofUrl(null);
                }}
                className="px-4 py-1.5 bg-gray-800 text-white rounded-xl text-xs font-bold hover:bg-gray-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Confirmation Modal */}
      {approveModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-gray-900">Approve USDT Deposit</h4>
                <p className="text-xs text-gray-500">This will immediately credit the user's wallet.</p>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">User:</span>
                <span className="font-bold text-gray-900">{approveModalItem.username || approveModalItem.phone || approveModalItem.userId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Recharge Amount (INR):</span>
                <span className="font-black text-emerald-800 text-sm">₹{approveModalItem.amountInr.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">USDT Sent:</span>
                <span className="font-bold text-gray-900">{approveModalItem.usdtAmount} USDT ({approveModalItem.network})</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Admin Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Verified on Tronscan"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApproveModalItem(null)}
                disabled={approving}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {approving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Crediting Wallet...</span>
                  </>
                ) : (
                  <span>Confirm & Credit ₹{approveModalItem.amountInr}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-base text-gray-900">Reject USDT Deposit</h4>
                <p className="text-xs text-gray-500">Provide a reason visible to the user.</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. TXID not found on blockchain / Amount mismatch"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                disabled={rejecting}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={rejecting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {rejecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <span>Confirm Rejection</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
