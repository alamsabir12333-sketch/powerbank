import React, { useState, useEffect } from 'react';
import {
  Gift,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  PauseCircle,
  PlayCircle,
  Ban,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Check,
  Calendar,
  DollarSign,
  Users,
  Sparkles,
  Layers,
  ArrowRight,
  TrendingUp,
  Percent,
  Clock,
  Shuffle,
  ShieldCheck,
  Loader2,
  X,
  ChevronDown,
} from 'lucide-react';
import {
  GiftCode,
  GiftCodeClaim,
  GiftCodeAnalytics,
  GiftCodeAmountType,
  GiftCodeStatus,
  GiftCodeDestination,
} from '../../types';
import {
  fetchGiftCodes,
  createGiftCode,
  updateGiftCode,
  deleteGiftCode,
  fetchGiftCodeClaims,
  fetchGiftCodeAnalytics,
} from '../../services/api';

interface AdminGiftCodesTabProps {
  adminId: string;
  onShowToast: (msg: string) => void;
}

export const AdminGiftCodesTab: React.FC<AdminGiftCodesTabProps> = ({
  adminId,
  onShowToast,
}) => {
  const [giftCodes, setGiftCodes] = useState<GiftCode[]>([]);
  const [analytics, setAnalytics] = useState<GiftCodeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Create / Edit Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<GiftCode | null>(null);
  const [submittingForm, setSubmittingForm] = useState(false);

  // Form Fields
  const [formCode, setFormCode] = useState('');
  const [formAmountType, setFormAmountType] = useState<GiftCodeAmountType>('FIXED');
  const [formAmount, setFormAmount] = useState<string>('100');
  const [formMinAmount, setFormMinAmount] = useState<string>('10');
  const [formMaxAmount, setFormMaxAmount] = useState<string>('250');
  const [formTotalPool, setFormTotalPool] = useState<string>('50000');
  const [formTotalUses, setFormTotalUses] = useState<string>('500');
  const [formPerUserLimit, setFormPerUserLimit] = useState<string>('1');
  const [formStartDate, setFormStartDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [formExpiryDate, setFormExpiryDate] = useState<string>(
    new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 16)
  );
  const [formStatus, setFormStatus] = useState<GiftCodeStatus>('ACTIVE');
  const [formDescription, setFormDescription] = useState('');
  const [formWalletDestination, setFormWalletDestination] = useState<GiftCodeDestination>('EARNING_BALANCE');

  // Claims Modal State
  const [claimsModalCode, setClaimsModalCode] = useState<GiftCode | null>(null);
  const [claimsList, setClaimsList] = useState<GiftCodeClaim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [claimsSearch, setClaimsSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [codesData, statsData] = await Promise.all([
        fetchGiftCodes(),
        fetchGiftCodeAnalytics(),
      ]);
      setGiftCodes(codesData);
      setAnalytics(statsData);
    } catch (e: any) {
      onShowToast(e.message || 'Failed to load gift codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    onShowToast(`Copied code "${code}" to clipboard`);
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

  const generateRandomCode = () => {
    const prefixes = ['GAIN', 'GP', 'POWER', 'BONUS', 'LUCKY'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormCode(`${prefix}${rand}`);
  };

  const handleOpenCreateModal = () => {
    setEditingCode(null);
    setFormCode('');
    generateRandomCode();
    setFormAmountType('FIXED');
    setFormAmount('100');
    setFormMinAmount('10');
    setFormMaxAmount('250');
    setFormTotalPool('50000');
    setFormTotalUses('500');
    setFormPerUserLimit('1');
    setFormStartDate(new Date().toISOString().slice(0, 16));
    setFormExpiryDate(new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 16));
    setFormStatus('ACTIVE');
    setFormDescription('Community bonus gift code');
    setFormWalletDestination('EARNING_BALANCE');
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (code: GiftCode) => {
    setEditingCode(code);
    setFormCode(code.code);
    setFormAmountType(code.amountType);
    setFormAmount(code.amount?.toString() || '100');
    setFormMinAmount(code.minAmount?.toString() || '10');
    setFormMaxAmount(code.maxAmount?.toString() || '250');
    setFormTotalPool(code.totalPool.toString());
    setFormTotalUses(code.totalUses.toString());
    setFormPerUserLimit(code.perUserLimit.toString());
    setFormStartDate(
      code.startDate ? new Date(code.startDate).toISOString().slice(0, 16) : ''
    );
    setFormExpiryDate(
      code.expiryDate ? new Date(code.expiryDate).toISOString().slice(0, 16) : ''
    );
    setFormStatus(code.status);
    setFormDescription(code.description || '');
    setFormWalletDestination(code.walletDestination || 'EARNING_BALANCE');
    setIsFormModalOpen(true);
  };

  const handleSaveGiftCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formCode.trim().toUpperCase();
    if (!cleanCode) {
      onShowToast('Gift code cannot be empty.');
      return;
    }

    const poolNum = parseFloat(formTotalPool);
    const usesNum = parseInt(formTotalUses, 10);
    const perUserNum = parseInt(formPerUserLimit, 10) || 1;

    if (isNaN(poolNum) || poolNum <= 0) {
      onShowToast('Total pool must be a valid amount greater than zero.');
      return;
    }
    if (isNaN(usesNum) || usesNum <= 0) {
      onShowToast('Total uses must be a valid number greater than zero.');
      return;
    }

    let fixedAmt: number | undefined;
    let minAmt: number | undefined;
    let maxAmt: number | undefined;

    if (formAmountType === 'FIXED') {
      fixedAmt = parseFloat(formAmount);
      if (isNaN(fixedAmt) || fixedAmt <= 0) {
        onShowToast('Fixed reward amount must be greater than zero.');
        return;
      }
      if (fixedAmt > poolNum) {
        onShowToast('Fixed reward amount cannot exceed total pool.');
        return;
      }
    } else {
      minAmt = parseFloat(formMinAmount);
      maxAmt = parseFloat(formMaxAmount);
      if (isNaN(minAmt) || isNaN(maxAmt) || minAmt <= 0 || maxAmt <= 0 || minAmt > maxAmt) {
        onShowToast('Please set a valid Random amount range (Min <= Max).');
        return;
      }
      if (maxAmt > poolNum) {
        onShowToast('Maximum random amount cannot exceed total pool.');
        return;
      }
    }

    setSubmittingForm(true);
    try {
      if (editingCode) {
        await updateGiftCode(
          editingCode.id,
          {
            code: cleanCode,
            amountType: formAmountType,
            amount: fixedAmt,
            minAmount: minAmt,
            maxAmount: maxAmt,
            totalPool: poolNum,
            totalUses: usesNum,
            perUserLimit: perUserNum,
            startDate: formStartDate ? new Date(formStartDate).toISOString() : undefined,
            expiryDate: formExpiryDate ? new Date(formExpiryDate).toISOString() : undefined,
            status: formStatus,
            description: formDescription,
            walletDestination: formWalletDestination,
          },
          adminId
        );
        onShowToast(`Successfully updated gift code "${cleanCode}".`);
      } else {
        await createGiftCode(
          {
            code: cleanCode,
            amountType: formAmountType,
            amount: fixedAmt,
            minAmount: minAmt,
            maxAmount: maxAmt,
            totalPool: poolNum,
            totalUses: usesNum,
            perUserLimit: perUserNum,
            startDate: formStartDate ? new Date(formStartDate).toISOString() : undefined,
            expiryDate: formExpiryDate ? new Date(formExpiryDate).toISOString() : undefined,
            status: formStatus,
            description: formDescription,
            walletDestination: formWalletDestination,
          },
          adminId
        );
        onShowToast(`Successfully created gift code "${cleanCode}".`);
      }
      setIsFormModalOpen(false);
      loadData();
    } catch (e: any) {
      onShowToast(e.message || 'Failed to save gift code.');
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleToggleStatus = async (code: GiftCode) => {
    const nextStatus: GiftCodeStatus =
      code.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await updateGiftCode(code.id, { status: nextStatus }, adminId);
      onShowToast(`Gift code "${code.code}" status changed to ${nextStatus}.`);
      loadData();
    } catch (e: any) {
      onShowToast(e.message || 'Status update failed.');
    }
  };

  const handleDelete = async (code: GiftCode) => {
    if (!window.confirm(`Are you sure you want to permanently delete gift code "${code.code}"?`)) {
      return;
    }
    try {
      await deleteGiftCode(code.id, adminId);
      onShowToast(`Gift code "${code.code}" deleted successfully.`);
      loadData();
    } catch (e: any) {
      onShowToast(e.message || 'Delete failed.');
    }
  };

  const handleOpenClaims = async (code: GiftCode) => {
    setClaimsModalCode(code);
    setLoadingClaims(true);
    try {
      const list = await fetchGiftCodeClaims(code.id);
      setClaimsList(list);
    } catch (e: any) {
      onShowToast(e.message || 'Failed to load claims.');
    } finally {
      setLoadingClaims(false);
    }
  };

  const filteredCodes = giftCodes.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && c.amountType !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      return (
        c.code.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredClaims = claimsList.filter((claim) => {
    if (!claimsSearch) return true;
    const q = claimsSearch.toLowerCase().trim();
    return (
      (claim.username || '').toLowerCase().includes(q) ||
      (claim.mobile || '').toLowerCase().includes(q) ||
      (claim.txId || '').toLowerCase().includes(q) ||
      claim.userId.toLowerCase().includes(q)
    );
  });

  return (
    <div id="admin-gift-codes-tab" className="space-y-6">
      {/* Top Banner & Analytics Summary */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-[#FF6000] text-white flex items-center justify-center shadow-md shadow-orange-950/40 shrink-0">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                Gift Code Management Center
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-950 text-[#FF6000] border border-orange-800/40 uppercase">
                  Active System
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Create, monitor, and distribute atomic gift vouchers with fixed or randomized wallet incentives.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              title="Refresh Codes"
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="create-gift-code-btn"
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6000] to-amber-500 hover:from-[#e55600] hover:to-amber-600 active:scale-95 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-orange-950/40 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Gift Code</span>
            </button>
          </div>
        </div>

        {/* Aggregate KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-4">
          <div className="bg-[#0d1117] p-3 rounded-xl border border-gray-800">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Codes</div>
            <div className="text-lg font-extrabold text-white mt-0.5">{analytics?.totalCodes || 0}</div>
          </div>
          <div className="bg-[#0d1117] p-3 rounded-xl border border-gray-800">
            <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Active Codes</div>
            <div className="text-lg font-extrabold text-emerald-400 mt-0.5">{analytics?.activeCodes || 0}</div>
          </div>
          <div className="bg-[#0d1117] p-3 rounded-xl border border-gray-800">
            <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Exhausted</div>
            <div className="text-lg font-extrabold text-amber-400 mt-0.5">{analytics?.exhaustedCodes || 0}</div>
          </div>
          <div className="bg-[#0d1117] p-3 rounded-xl border border-gray-800">
            <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Expired</div>
            <div className="text-lg font-extrabold text-red-400 mt-0.5">{analytics?.expiredCodes || 0}</div>
          </div>
          <div className="bg-[#0d1117] p-3 rounded-xl border border-gray-800">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Allocated Pool</div>
            <div className="text-lg font-extrabold text-blue-400 mt-0.5">
              ₹{(analytics?.totalPoolAllocated || 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="bg-[#0d1117] p-3 rounded-xl border border-gray-800">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Distributed ₹</div>
            <div className="text-lg font-extrabold text-[#FF6000] mt-0.5">
              ₹{(analytics?.totalDistributedAmount || 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="bg-[#0d1117] p-3 rounded-xl border border-gray-800">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Claims</div>
            <div className="text-lg font-extrabold text-purple-400 mt-0.5">{analytics?.totalClaimsCount || 0}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2 bg-[#0d1117] px-3 py-2 rounded-xl border border-gray-800 focus-within:border-[#FF6000] transition-colors">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            id="admin-search-gift-codes"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code or description..."
            className="w-full bg-transparent text-xs text-white placeholder:text-gray-500 focus:outline-hidden"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-gray-400 hover:text-white text-xs"
            >
              &times;
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center bg-[#0d1117] p-1 rounded-xl border border-gray-800">
            {['ALL', 'ACTIVE', 'PAUSED', 'EXHAUSTED', 'EXPIRED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#FF6000] text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-[#0d1117] p-1 rounded-xl border border-gray-800">
            {['ALL', 'FIXED', 'RANDOM'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  typeFilter === t
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Gift Codes Table */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#0d1117] text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800">
              <tr>
                <th className="px-4 py-3.5">Gift Code</th>
                <th className="px-4 py-3.5">Reward Config</th>
                <th className="px-4 py-3.5">Pool & Progress</th>
                <th className="px-4 py-3.5">Claims / Limit</th>
                <th className="px-4 py-3.5">Destination</th>
                <th className="px-4 py-3.5">Validity</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF6000]" />
                    Loading gift codes...
                  </td>
                </tr>
              ) : filteredCodes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500">
                    <Gift className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                    No gift codes found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredCodes.map((code) => {
                  const percentClaimed =
                    code.totalPool > 0
                      ? Math.min(
                          100,
                          Math.round(
                            ((code.totalPool - code.remainingPool) / code.totalPool) * 100
                          )
                        )
                      : 0;

                  return (
                    <tr
                      key={code.id}
                      className="hover:bg-gray-800/40 transition-colors group"
                    >
                      {/* Code */}
                      <td className="px-4 py-3.5 font-medium">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-[#FF6000] bg-orange-950/40 px-2 py-1 rounded-lg border border-orange-800/40 tracking-wider">
                            {code.code}
                          </span>
                          <button
                            onClick={() => handleCopy(code.code, code.id)}
                            title="Copy Code"
                            className="p-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors cursor-pointer"
                          >
                            {copiedCodeId === code.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {code.description && (
                          <div className="text-[10px] text-gray-400 mt-1 max-w-[200px] truncate">
                            {code.description}
                          </div>
                        )}
                      </td>

                      {/* Reward Config */}
                      <td className="px-4 py-3.5">
                        {code.amountType === 'FIXED' ? (
                          <div>
                            <span className="font-bold text-white text-sm">
                              ₹{code.amount?.toLocaleString('en-IN')}
                            </span>
                            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 font-semibold border border-blue-800/30">
                              Fixed
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold text-white text-xs">
                              ₹{code.minAmount} – ₹{code.maxAmount}
                            </span>
                            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 font-semibold border border-purple-800/30">
                              Random
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Pool & Progress */}
                      <td className="px-4 py-3.5 min-w-[150px]">
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-gray-400">
                            ₹{code.remainingPool.toLocaleString('en-IN')} left
                          </span>
                          <span className="font-semibold text-gray-300">
                            {percentClaimed}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              percentClaimed >= 100
                                ? 'bg-red-500'
                                : percentClaimed > 75
                                ? 'bg-amber-500'
                                : 'bg-[#FF6000]'
                            }`}
                            style={{ width: `${percentClaimed}%` }}
                          />
                        </div>
                        <div className="text-[9.5px] text-gray-500 mt-0.5">
                          Total: ₹{code.totalPool.toLocaleString('en-IN')}
                        </div>
                      </td>

                      {/* Claims / Limit */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-white">
                          {code.usedCount}{' '}
                          <span className="text-gray-500 font-normal">
                            / {code.totalUses}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400">
                          Per user: {code.perUserLimit}x
                        </div>
                      </td>

                      {/* Destination */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            code.walletDestination === 'RECHARGE_BALANCE'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800/40'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                          }`}
                        >
                          {code.walletDestination === 'RECHARGE_BALANCE'
                            ? 'Recharge'
                            : 'Earning / Wallet'}
                        </span>
                      </td>

                      {/* Validity */}
                      <td className="px-4 py-3.5 text-[11px]">
                        {code.expiryDate ? (
                          <div>
                            <div className="text-gray-300">
                              {new Date(code.expiryDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {new Date(code.expiryDate).getTime() < Date.now() ? (
                                <span className="text-red-400 font-semibold">Expired</span>
                              ) : (
                                <span>
                                  in{' '}
                                  {Math.ceil(
                                    (new Date(code.expiryDate).getTime() - Date.now()) /
                                      (1000 * 60 * 60 * 24)
                                  )}{' '}
                                  days
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">No Expiry</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            code.status === 'ACTIVE'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                              : code.status === 'PAUSED'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800/40'
                              : code.status === 'EXHAUSTED'
                              ? 'bg-gray-800 text-gray-400 border border-gray-700'
                              : code.status === 'EXPIRED'
                              ? 'bg-red-950 text-red-400 border border-red-800/40'
                              : 'bg-gray-900 text-gray-500 border border-gray-800'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              code.status === 'ACTIVE'
                                ? 'bg-emerald-400 animate-pulse'
                                : code.status === 'PAUSED'
                                ? 'bg-amber-400'
                                : 'bg-gray-400'
                            }`}
                          />
                          {code.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenClaims(code)}
                            title="View Claim History"
                            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(code)}
                            title={code.status === 'ACTIVE' ? 'Pause Code' : 'Activate Code'}
                            className={`p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer ${
                              code.status === 'ACTIVE'
                                ? 'text-amber-400 hover:text-amber-300'
                                : 'text-emerald-400 hover:text-emerald-300'
                            }`}
                          >
                            {code.status === 'ACTIVE' ? (
                              <PauseCircle className="w-3.5 h-3.5" />
                            ) : (
                              <PlayCircle className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(code)}
                            title="Edit Code"
                            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(code)}
                            title="Delete Code"
                            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT GIFT CODE MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-[#161b22] border border-gray-800 rounded-3xl p-6 shadow-2xl text-gray-200 my-8">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-[#FF6000] text-white flex items-center justify-center shadow-md">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingCode ? 'Edit Gift Code' : 'Create New Gift Code'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Configure voucher pool, reward amount type, and per-user limits.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGiftCode} className="space-y-4">
              {/* Row 1: Code & Generator */}
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  Gift Code (Alphanumeric, Uppercase)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. GAIN100, LUCKY2026"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0d1117] border border-gray-700 text-white font-mono font-bold text-sm tracking-wider uppercase focus:outline-hidden focus:border-[#FF6000]"
                  />
                  <button
                    type="button"
                    onClick={generateRandomCode}
                    className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-amber-400 text-xs font-bold flex items-center gap-1.5 border border-gray-700 transition-colors cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Generate
                  </button>
                </div>
              </div>

              {/* Row 2: Amount Type Switcher */}
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  Reward Amount Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormAmountType('FIXED')}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      formAmountType === 'FIXED'
                        ? 'bg-[#FF6000]/20 border-[#FF6000] text-[#FF6000]'
                        : 'bg-[#0d1117] border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    Fixed Amount (Same reward for all)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAmountType('RANDOM')}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      formAmountType === 'RANDOM'
                        ? 'bg-purple-950/40 border-purple-500 text-purple-400'
                        : 'bg-[#0d1117] border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    Random Mystery (Within range)
                  </button>
                </div>
              </div>

              {/* Dynamic Reward inputs */}
              {formAmountType === 'FIXED' ? (
                <div className="p-3.5 rounded-xl bg-[#0d1117] border border-gray-800 space-y-2">
                  <label className="block text-xs font-bold text-gray-300">
                    Fixed Reward Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="100"
                    className="w-full px-3 py-2 rounded-lg bg-[#161b22] border border-gray-700 text-white font-bold text-sm focus:outline-hidden focus:border-[#FF6000]"
                  />
                  <p className="text-[11px] text-gray-500">
                    Every user claiming this code will receive exactly ₹{formAmount || 0}.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#0d1117] border border-gray-800 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Min Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      value={formMinAmount}
                      onChange={(e) => setFormMinAmount(e.target.value)}
                      placeholder="10"
                      className="w-full px-3 py-2 rounded-lg bg-[#161b22] border border-gray-700 text-white font-bold text-sm focus:outline-hidden focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Max Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      required
                      value={formMaxAmount}
                      onChange={(e) => setFormMaxAmount(e.target.value)}
                      placeholder="250"
                      className="w-full px-3 py-2 rounded-lg bg-[#161b22] border border-gray-700 text-white font-bold text-sm focus:outline-hidden focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* Row 3: Pool & Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Total Pool Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formTotalPool}
                    onChange={(e) => setFormTotalPool(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0d1117] border border-gray-700 text-white font-bold text-sm focus:outline-hidden focus:border-[#FF6000]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Total Uses Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formTotalUses}
                    onChange={(e) => setFormTotalUses(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0d1117] border border-gray-700 text-white font-bold text-sm focus:outline-hidden focus:border-[#FF6000]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Per User Claim Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formPerUserLimit}
                    onChange={(e) => setFormPerUserLimit(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0d1117] border border-gray-700 text-white font-bold text-sm focus:outline-hidden focus:border-[#FF6000]"
                  />
                </div>
              </div>

              {/* Row 4: Dates & Destination */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Expiry Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0d1117] border border-gray-700 text-white text-xs focus:outline-hidden focus:border-[#FF6000]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Wallet Destination
                  </label>
                  <select
                    value={formWalletDestination}
                    onChange={(e) =>
                      setFormWalletDestination(e.target.value as GiftCodeDestination)
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0d1117] border border-gray-700 text-white text-xs font-semibold focus:outline-hidden focus:border-[#FF6000]"
                  >
                    <option value="EARNING_BALANCE">
                      Earning / My Wallet (Recommended)
                    </option>
                    <option value="RECHARGE_BALANCE">Recharge Balance</option>
                  </select>
                </div>
              </div>

              {/* Description & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Description / Purpose Note
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="e.g. Official Telegram Giveaway"
                    className="w-full px-3 py-2 rounded-lg bg-[#0d1117] border border-gray-700 text-white text-xs focus:outline-hidden focus:border-[#FF6000]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as GiftCodeStatus)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0d1117] border border-gray-700 text-white text-xs font-semibold focus:outline-hidden focus:border-[#FF6000]"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PAUSED">PAUSED</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="p-3 rounded-xl bg-orange-950/20 border border-orange-800/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FF6000] text-white flex items-center justify-center font-bold">
                    <Gift className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>Code:</span>
                      <span className="font-mono text-[#FF6000] tracking-wider">
                        {formCode || 'CODE_PREVIEW'}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      Reward:{' '}
                      {formAmountType === 'FIXED'
                        ? `₹${formAmount || 0} Fixed`
                        : `₹${formMinAmount || 0} - ₹${formMaxAmount || 0} Random`}
                      {' • '}Pool: ₹{formTotalPool || 0} ({formTotalUses || 0} uses)
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                  Ready to Publish
                </span>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingForm}
                  className="px-5 py-2 rounded-xl bg-[#FF6000] hover:bg-[#e05500] text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-orange-950/40 transition-all cursor-pointer"
                >
                  {submittingForm && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingCode ? 'Save Changes' : 'Create Gift Code'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW CLAIMS MODAL */}
      {claimsModalCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-[#161b22] border border-gray-800 rounded-3xl p-6 shadow-2xl text-gray-200 my-8">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">
                    Claim History & Audit
                  </h3>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-orange-950 text-[#FF6000] border border-orange-800/40">
                    {claimsModalCode.code}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Audited list of all user claims processed for this gift code.
                </p>
              </div>
              <button
                onClick={() => setClaimsModalCode(null)}
                className="p-1.5 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-[#0d1117] rounded-xl border border-gray-800 mb-4 text-xs">
              <div>
                <span className="text-gray-500">Total Claims:</span>{' '}
                <span className="font-bold text-white">{claimsList.length}</span>
              </div>
              <div>
                <span className="text-gray-500">Total Distributed:</span>{' '}
                <span className="font-bold text-[#FF6000]">
                  ₹
                  {claimsList
                    .reduce((acc, c) => acc + (c.rewardAmount || 0), 0)
                    .toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Remaining Pool:</span>{' '}
                <span className="font-bold text-emerald-400">
                  ₹{claimsModalCode.remainingPool.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Search Claims */}
            <div className="mb-3">
              <input
                type="text"
                value={claimsSearch}
                onChange={(e) => setClaimsSearch(e.target.value)}
                placeholder="Filter by user, mobile, or TxID..."
                className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-gray-800 text-xs text-white placeholder:text-gray-500 focus:outline-hidden focus:border-[#FF6000]"
              />
            </div>

            {/* Claims Table */}
            <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-800">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-[#0d1117] text-gray-400 uppercase text-[10px] tracking-wider sticky top-0">
                  <tr>
                    <th className="px-3.5 py-2.5">User</th>
                    <th className="px-3.5 py-2.5">Mobile</th>
                    <th className="px-3.5 py-2.5">Reward</th>
                    <th className="px-3.5 py-2.5">Destination</th>
                    <th className="px-3.5 py-2.5">Claimed At</th>
                    <th className="px-3.5 py-2.5">Tx ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {loadingClaims ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#FF6000]" />
                        Loading claims...
                      </td>
                    </tr>
                  ) : filteredClaims.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">
                        No claims recorded yet for this gift code.
                      </td>
                    </tr>
                  ) : (
                    filteredClaims.map((claim) => (
                      <tr key={claim.id} className="hover:bg-gray-800/40">
                        <td className="px-3.5 py-2.5 font-semibold text-white">
                          {claim.username}
                        </td>
                        <td className="px-3.5 py-2.5 text-gray-400 font-mono">
                          {claim.mobile}
                        </td>
                        <td className="px-3.5 py-2.5 font-bold text-[#FF6000]">
                          +₹{claim.rewardAmount.toFixed(2)}
                        </td>
                        <td className="px-3.5 py-2.5 text-[10px] text-gray-400">
                          {claim.walletDestination === 'RECHARGE_BALANCE'
                            ? 'Recharge'
                            : 'Wallet'}
                        </td>
                        <td className="px-3.5 py-2.5 text-gray-400 text-[11px]">
                          {new Date(claim.claimedAt).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-[10px] text-gray-500 truncate max-w-[100px]">
                          {claim.txId || claim.id}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-4 mt-2 flex justify-end">
              <button
                onClick={() => setClaimsModalCode(null)}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
