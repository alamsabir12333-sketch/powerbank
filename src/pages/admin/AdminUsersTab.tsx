import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  SlidersHorizontal,
  Eye,
  ShieldAlert,
  ShieldCheck,
  Ban,
  DollarSign,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Clock,
  X,
  CreditCard,
  Zap,
} from 'lucide-react';
import {
  fetchAdminUsers,
  fetchAdminUserDetails,
  updateUserStatus,
  adminAdjustUserWallet,
  adminAdjustUserBalance,
} from '../../services/api';
import { UserProfile, AdminUserDetails, AdminBalanceType } from '../../types';

interface AdminUsersTabProps {
  adminId: string;
  onShowToast: (msg: string) => void;
  onRefreshGlobalStats: () => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  adminId,
  onShowToast,
  onRefreshGlobalStats,
}) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected User Detail Modal
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<AdminUserDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Balance Adjustment Modal
  const [adjustModalUser, setAdjustModalUser] = useState<any | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [adjustBalanceType, setAdjustBalanceType] = useState<AdminBalanceType>('MY_WALLET');
  const [adjustReason, setAdjustReason] = useState('');
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Status Modal
  const [statusModalUser, setStatusModalUser] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState<'active' | 'suspended' | 'banned'>('active');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminUsers(searchQuery);
      setUsers(data);
    } catch (e: any) {
      onShowToast(e.message || 'Error loading users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers();
  };

  const handleOpenDetails = async (userId: string) => {
    setSelectedUserId(userId);
    setLoadingDetails(true);
    try {
      const details = await fetchAdminUserDetails(userId);
      setUserDetails(details);
    } catch (e: any) {
      onShowToast(e.message || 'Failed to load user details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalUser) return;
    const amountNum = parseFloat(adjustAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      onShowToast('Please enter a valid amount greater than zero.');
      return;
    }
    if (!adjustReason.trim()) {
      onShowToast('Mandatory audit justification reason is required.');
      return;
    }

    setSubmittingAdjust(true);
    try {
      const action = adjustType === 'CREDIT' ? 'ADMIN_CREDIT' : 'ADMIN_DEDUCT';
      const res = await adminAdjustUserBalance(
        adjustModalUser.userId || adjustModalUser.id,
        adjustBalanceType,
        amountNum,
        action,
        adjustReason,
        adminId
      );
      onShowToast(
        `Successfully ${adjustType === 'CREDIT' ? 'credited' : 'debited'} ₹${amountNum.toFixed(2)} (${adjustBalanceType.replace('_', ' ')}). New balance: ₹${(res.afterBalance ?? 0).toFixed(2)}`
      );
      setAdjustModalUser(null);
      setAdjustAmount('');
      setAdjustReason('');
      await loadUsers();
      onRefreshGlobalStats();
      if (selectedUserId === (adjustModalUser.userId || adjustModalUser.id)) {
        handleOpenDetails(selectedUserId);
      }
    } catch (e: any) {
      onShowToast(e.message || 'Adjustment failed');
    } finally {
      setSubmittingAdjust(false);
    }
  };

  const handleConfirmStatus = async () => {
    if (!statusModalUser) return;
    setSubmittingStatus(true);
    try {
      await updateUserStatus(statusModalUser.userId || statusModalUser.id, newStatus, adminId);
      onShowToast(`User status successfully updated to ${newStatus.toUpperCase()}`);
      setStatusModalUser(null);
      await loadUsers();
      onRefreshGlobalStats();
    } catch (e: any) {
      onShowToast(e.message || 'Failed to update status');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (statusFilter === 'ALL') return true;
    return (u.status || 'active').toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#FF6000]" />
              User Accounts & Wealth Management
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Inspect user portfolios, adjust wallet balances with audit logs, and manage account authorization status.
            </p>
          </div>

          <button
            onClick={loadUsers}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-200 text-xs font-semibold flex items-center gap-2 transition-all self-start md:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Users</span>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <form onSubmit={handleSearch} className="flex-1 w-full relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by WhatsApp / Mobile, Username, ID, or Referral Code..."
              className="w-full bg-[#0d1117] border border-gray-700/80 focus:border-[#FF6000] rounded-xl py-2.5 pl-10 pr-24 text-xs text-white placeholder-gray-500 outline-none"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-[#FF6000] text-white text-xs font-bold rounded-lg hover:bg-orange-600 cursor-pointer"
            >
              Search
            </button>
          </form>

          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto pb-1 sm:pb-0">
            {['ALL', 'active', 'suspended', 'banned'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#FF6000] text-white shadow-sm'
                    : 'bg-[#0d1117] text-gray-400 border border-gray-800 hover:border-gray-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#0d1117] text-gray-400 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-800">
              <tr>
                <th className="py-3.5 px-4">User / WhatsApp</th>
                <th className="py-3.5 px-4">ID & Referrer</th>
                <th className="py-3.5 px-4">Wallet Balance</th>
                <th className="py-3.5 px-4">Investments</th>
                <th className="py-3.5 px-4">Devices</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF6000]" />
                    <span>Loading platform users...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-500">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const uStatus = (u.status || 'active').toLowerCase();
                  return (
                    <tr key={u.id || u.userId} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{u.username || 'User'}</span>
                          {u.role === 'admin' && (
                            <span className="bg-orange-500/20 text-[#FF6000] text-[9px] px-1.5 py-0.2 rounded font-extrabold">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                          +91 {u.whatsappNo || u.mobile || 'N/A'}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <div className="text-gray-200 text-[11px]">
                          {u.membershipNumber || u.id?.substring(0, 8)}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          Ref: {u.referralCode || 'None'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-extrabold text-emerald-400 text-sm">
                          ₹{(u.availableBalance || u.walletBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-amber-400">
                          ₹{(u.totalInvested || 0).toLocaleString()}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 text-[11px]">
                          {u.activeDevices || 0} active
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider ${
                            uStatus === 'active'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                              : uStatus === 'suspended'
                              ? 'bg-yellow-950/60 text-yellow-400 border border-yellow-800/50'
                              : 'bg-red-950/60 text-red-400 border border-red-800/50'
                          }`}
                        >
                          {uStatus}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {/* Inspect Details */}
                        <button
                          onClick={() => handleOpenDetails(u.userId || u.id)}
                          title="Inspect Details"
                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors inline-flex cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Adjust Balance */}
                        <button
                          onClick={() => {
                            setAdjustModalUser(u);
                            setAdjustAmount('');
                            setAdjustReason('');
                            setAdjustType('CREDIT');
                          }}
                          title="Adjust Balance"
                          className="p-1.5 rounded-lg bg-emerald-950/50 border border-emerald-800/60 hover:bg-emerald-900/60 text-emerald-400 transition-colors inline-flex cursor-pointer"
                        >
                          <DollarSign className="w-4 h-4" />
                        </button>

                        {/* Status Toggle */}
                        <button
                          onClick={() => {
                            setStatusModalUser(u);
                            setNewStatus(u.status || 'active');
                          }}
                          title="Account Status"
                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-amber-400 transition-colors inline-flex cursor-pointer"
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Adjust Balance */}
      {adjustModalUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Audited Wallet Adjustment
              </h3>
              <button
                onClick={() => setAdjustModalUser(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0d1117] p-3 rounded-xl border border-gray-800 mb-4 text-xs text-gray-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Target User:</span>
                <span className="font-bold text-white">{adjustModalUser.username} (+91 {adjustModalUser.whatsappNo || adjustModalUser.mobile})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Available Balance:</span>
                <span className="font-bold text-emerald-400">₹{(adjustModalUser.availableBalance || adjustModalUser.walletBalance || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">Target Account ({adjustBalanceType.replace('_', ' ')}):</span>
                <span className="font-semibold text-cyan-400">
                  ₹{(() => {
                    if (adjustBalanceType === 'TOPUP_WALLET' || adjustBalanceType === 'RECHARGE_BALANCE') {
                      return (adjustModalUser.rechargeBalance ?? adjustModalUser.topupBalance ?? 0).toFixed(2);
                    }
                    if (adjustBalanceType === 'WITHDRAW_WALLET' || adjustBalanceType === 'MY_WALLET') {
                      return (adjustModalUser.withdrawBalance ?? adjustModalUser.myWalletBalance ?? 0).toFixed(2);
                    }
                    if (adjustBalanceType === 'REFERRAL_BALANCE') {
                      return (adjustModalUser.teamCommission ?? 0).toFixed(2);
                    }
                    return (adjustModalUser.availableBalance ?? 0).toFixed(2);
                  })()}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmAdjust} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('CREDIT')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                      adjustType === 'CREDIT'
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-400'
                        : 'bg-[#0d1117] border-gray-800 text-gray-400'
                    }`}
                  >
                    + CREDIT (Add Funds)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('DEBIT')}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                      adjustType === 'DEBIT'
                        ? 'bg-red-950/80 border-red-500 text-red-400'
                        : 'bg-[#0d1117] border-gray-800 text-gray-400'
                    }`}
                  >
                    - DEBIT (Deduct Funds)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5">
                  Target Balance Account
                </label>
                <select
                  value={adjustBalanceType}
                  onChange={(e) => setAdjustBalanceType(e.target.value as AdminBalanceType)}
                  className="w-full bg-[#0d1117] border border-gray-700 focus:border-[#FF6000] rounded-xl py-2.5 px-3 text-xs text-white outline-none font-semibold"
                >
                  <option value="TOPUP_WALLET">Topup Wallet (Plan Purchase Balance)</option>
                  <option value="WITHDRAW_WALLET">Withdraw Wallet (Earnings & Withdrawals)</option>
                  <option value="MY_WALLET">My Wallet (Earning Balance)</option>
                  <option value="RECHARGE_BALANCE">Recharge Balance</option>
                  <option value="REFERRAL_BALANCE">Referral / Team Commission Balance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="e.g. 500"
                  required
                  className="w-full bg-[#0d1117] border border-gray-700 focus:border-[#FF6000] rounded-xl py-2.5 px-3 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-1.5">
                  Mandatory Audit Reason / Justification
                </label>
                <textarea
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g., Verified offline cash deposit ref #8832, or compensation bonus"
                  rows={2}
                  required
                  className="w-full bg-[#0d1117] border border-gray-700 focus:border-[#FF6000] rounded-xl p-2.5 text-xs text-white outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalUser(null)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-xs font-semibold hover:bg-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjust}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6000] text-white text-xs font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submittingAdjust ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Change Account Status */}
      {statusModalUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                Change User Status
              </h3>
              <button onClick={() => setStatusModalUser(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300 mb-4">
              Select status for <strong className="text-white">{statusModalUser.username}</strong> (+91 {statusModalUser.whatsappNo || statusModalUser.mobile}):
            </p>

            <div className="space-y-2 mb-6">
              {[
                { id: 'active', label: 'Active (Normal Access)', color: 'text-emerald-400' },
                { id: 'suspended', label: 'Suspended (Temporary Freeze)', color: 'text-yellow-400' },
                { id: 'banned', label: 'Banned (Blacklisted Account)', color: 'text-red-400' },
              ].map((st) => (
                <label
                  key={st.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    newStatus === st.id
                      ? 'bg-gray-800 border-[#FF6000]'
                      : 'bg-[#0d1117] border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="accountStatus"
                    value={st.id}
                    checked={newStatus === st.id}
                    onChange={() => setNewStatus(st.id as any)}
                    className="accent-[#FF6000]"
                  />
                  <span className={`text-xs font-bold ${st.color}`}>{st.label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStatusModalUser(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatus}
                disabled={submittingStatus}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6000] text-white text-xs font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {submittingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Full User Portfolio Inspector */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-3xl p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-[#FF6000]" />
                  User Portfolio & Financial Deep Dive
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  ID: {selectedUserId}
                </p>
              </div>
              <button onClick={() => setSelectedUserId(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="py-16 text-center text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF6000]" />
                <span>Aggregating user ledger and active device records...</span>
              </div>
            ) : userDetails ? (
              <div className="mt-5 space-y-5 text-xs text-gray-300">
                {/* User Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0d1117] p-4 rounded-xl border border-gray-800">
                  <div>
                    <div className="text-gray-500 text-[10px] uppercase font-semibold">User</div>
                    <div className="text-white font-bold text-sm mt-0.5">{userDetails.profile?.username || 'N/A'}</div>
                    <div className="text-gray-400 font-mono text-[10.5px]">+91 {userDetails.profile?.whatsappNo}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-[10px] uppercase font-semibold">Withdrawable Balance</div>
                    <div className="text-emerald-400 font-extrabold text-sm mt-0.5">₹{(userDetails.wallet?.availableBalance || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-[10px] uppercase font-semibold">Active Hardware</div>
                    <div className="text-amber-400 font-bold text-sm mt-0.5">{userDetails.purchases?.filter((p) => p.status === 'ACTIVE').length || 0} Devices</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-[10px] uppercase font-semibold">Total Earned</div>
                    <div className="text-white font-bold text-sm mt-0.5">₹{(userDetails.wallet?.totalEarned || 0).toFixed(2)}</div>
                  </div>
                </div>

                {/* Active Purchases */}
                <div>
                  <h4 className="font-bold text-white mb-2 flex items-center gap-1.5 text-xs">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Active Sharing Hardware Purchases ({userDetails.purchases?.length || 0})
                  </h4>
                  <div className="bg-[#0d1117] rounded-xl border border-gray-800 divide-y divide-gray-800 max-h-40 overflow-y-auto">
                    {userDetails.purchases?.length === 0 ? (
                      <div className="p-3 text-center text-gray-500">No devices owned.</div>
                    ) : (
                      userDetails.purchases?.map((p) => (
                        <div key={p.id} className="p-3 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-white">{p.planName}</div>
                            <div className="text-[10.5px] text-gray-400 font-mono">
                              Staked: ₹{p.amount} • Yield: ₹{p.earningRate}/hr • Earned: ₹{p.totalEarned.toFixed(2)}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.status === 'ACTIVE' ? 'bg-emerald-950/80 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>
                            {p.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Wallet Transactions */}
                <div>
                  <h4 className="font-bold text-white mb-2 flex items-center gap-1.5 text-xs">
                    <CreditCard className="w-4 h-4 text-cyan-400" />
                    Ledger Transactions ({userDetails.transactions?.length || 0})
                  </h4>
                  <div className="bg-[#0d1117] rounded-xl border border-gray-800 divide-y divide-gray-800 max-h-44 overflow-y-auto font-mono text-[11px]">
                    {userDetails.transactions?.length === 0 ? (
                      <div className="p-3 text-center text-gray-500 font-sans">No transactions recorded.</div>
                    ) : (
                      userDetails.transactions?.map((t) => (
                        <div key={t.id} className="p-2.5 flex items-center justify-between">
                          <div>
                            <div className="text-gray-200 font-sans font-medium">{t.description || t.type}</div>
                            <div className="text-[10px] text-gray-500">{new Date(t.createdAt).toLocaleString()}</div>
                          </div>
                          <div className={`font-bold ${t.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {t.amount >= 0 ? `+₹${t.amount}` : `-₹${Math.abs(t.amount)}`}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-5 pt-4 border-t border-gray-800 text-right">
              <button
                onClick={() => setSelectedUserId(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
