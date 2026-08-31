import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Zap,
  Sparkles,
  Gift,
  Users,
  Coins,
  RotateCcw,
  Sliders,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Copy,
  Check,
  X,
  Receipt,
  CreditCard,
  Building,
  HelpCircle,
} from 'lucide-react';
import { TabType, WalletTransaction, TransactionType, TransactionStatus, Wallet, UserProfile } from '../types';
import { fetchWalletTransactions } from '../services/api';

interface TransactionPageProps {
  onNavigateTab: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
  userId?: string;
  wallet?: Wallet | null;
  userProfile?: UserProfile | null;
  onOpenRecharge?: () => void;
  onOpenWithdrawal?: () => void;
}

type FilterCategory = 'ALL' | 'RECHARGE' | 'PURCHASE' | 'EARNINGS' | 'CLAIM' | 'WITHDRAWAL' | 'REFERRAL' | 'OTHER';

export const TransactionPage: React.FC<TransactionPageProps> = ({
  onNavigateTab,
  onShowToast,
  userId = '',
  wallet,
  userProfile,
  onOpenRecharge,
  onOpenWithdrawal,
}) => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await fetchWalletTransactions(userId);
      setTransactions(data);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      onShowToast?.(err.message || 'Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [userId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    onShowToast?.(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filterTabs: { id: FilterCategory; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'RECHARGE', label: 'Recharge' },
    { id: 'PURCHASE', label: 'Purchase' },
    { id: 'EARNINGS', label: 'Earnings' },
    { id: 'CLAIM', label: 'Claim' },
    { id: 'WITHDRAWAL', label: 'Withdrawal' },
    { id: 'REFERRAL', label: 'Referral' },
    { id: 'OTHER', label: 'Other' },
  ];

  const filteredTransactions = transactions.filter((tx) => {
    // 1. Category Matching
    let matchesCategory = true;
    const typeUpper = (tx.type || '').toUpperCase();

    if (activeCategory === 'RECHARGE') {
      matchesCategory = typeUpper === 'RECHARGE';
    } else if (activeCategory === 'PURCHASE') {
      matchesCategory = typeUpper === 'PLAN_PURCHASE' || typeUpper === 'PRO_PLAN_PURCHASE';
    } else if (activeCategory === 'EARNINGS') {
      matchesCategory = typeUpper === 'HOURLY_EARNING' || typeUpper === 'PRO_EARNING' || typeUpper === 'EARNING';
    } else if (activeCategory === 'CLAIM') {
      matchesCategory = typeUpper === 'EARNING_CLAIM';
    } else if (activeCategory === 'WITHDRAWAL') {
      matchesCategory = typeUpper === 'WITHDRAWAL' || typeUpper === 'WITHDRAWAL_REVERSAL';
    } else if (activeCategory === 'REFERRAL') {
      matchesCategory = typeUpper === 'REFERRAL_BONUS' || typeUpper === 'TEAM_BONUS' || typeUpper === 'PRO_INSTANT_BONUS';
    } else if (activeCategory === 'OTHER') {
      matchesCategory = typeUpper === 'REFUND' || typeUpper === 'ADMIN_ADJUSTMENT';
    }

    if (!matchesCategory) return false;

    // 2. Search Query Matching
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (tx.description && tx.description.toLowerCase().includes(q)) ||
      (tx.referenceId && tx.referenceId.toLowerCase().includes(q)) ||
      (tx.id && tx.id.toLowerCase().includes(q)) ||
      (tx.utr && tx.utr.toLowerCase().includes(q)) ||
      (tx.planName && tx.planName.toLowerCase().includes(q)) ||
      (tx.orderId && tx.orderId.toLowerCase().includes(q)) ||
      (tx.type && tx.type.toLowerCase().includes(q))
    );
  });

  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case 'RECHARGE':
        return {
          icon: <ArrowDownLeft className="w-5 h-5 text-emerald-600" />,
          bg: 'bg-emerald-50 border-emerald-200',
        };
      case 'PLAN_PURCHASE':
        return {
          icon: <Zap className="w-5 h-5 text-blue-600" />,
          bg: 'bg-blue-50 border-blue-200',
        };
      case 'PRO_PLAN_PURCHASE':
        return {
          icon: <Sparkles className="w-5 h-5 text-purple-600" />,
          bg: 'bg-purple-50 border-purple-200',
        };
      case 'PRO_INSTANT_BONUS':
        return {
          icon: <Sparkles className="w-5 h-5 text-amber-500" />,
          bg: 'bg-amber-50 border-amber-200',
        };
      case 'EARNING_CLAIM':
        return {
          icon: <Coins className="w-5 h-5 text-orange-600" />,
          bg: 'bg-orange-50 border-orange-200',
        };
      case 'HOURLY_EARNING':
      case 'PRO_EARNING':
      case 'EARNING':
        return {
          icon: <Coins className="w-5 h-5 text-amber-600" />,
          bg: 'bg-amber-50 border-amber-200',
        };
      case 'REFERRAL_BONUS':
      case 'TEAM_BONUS':
        return {
          icon: <Gift className="w-5 h-5 text-rose-600" />,
          bg: 'bg-rose-50 border-rose-200',
        };
      case 'WITHDRAWAL':
        return {
          icon: <ArrowUpRight className="w-5 h-5 text-red-500" />,
          bg: 'bg-red-50 border-red-200',
        };
      case 'WITHDRAWAL_REVERSAL':
      case 'REFUND':
        return {
          icon: <RotateCcw className="w-5 h-5 text-teal-600" />,
          bg: 'bg-teal-50 border-teal-200',
        };
      case 'ADMIN_ADJUSTMENT':
      default:
        return {
          icon: <Sliders className="w-5 h-5 text-indigo-600" />,
          bg: 'bg-indigo-50 border-indigo-200',
        };
    }
  };

  const getTransactionTitle = (tx: WalletTransaction) => {
    if (tx.planName) return tx.planName;
    switch (tx.type) {
      case 'RECHARGE':
        return 'Wallet Recharge';
      case 'PLAN_PURCHASE':
        return 'Power Cabinet Purchase';
      case 'PRO_PLAN_PURCHASE':
        return 'PRO Cabinet Purchase';
      case 'PRO_INSTANT_BONUS':
        return 'PRO Instant Bonus Cashback';
      case 'EARNING_CLAIM':
        return 'Device Yield Claim';
      case 'HOURLY_EARNING':
        return 'Hourly Device Earning';
      case 'PRO_EARNING':
        return 'PRO Daily Earning';
      case 'REFERRAL_BONUS':
        return 'Referral Commission';
      case 'TEAM_BONUS':
        return 'Team Base Commission';
      case 'WITHDRAWAL':
        return 'Withdrawal Request';
      case 'WITHDRAWAL_REVERSAL':
        return 'Withdrawal Refund / Reversal';
      case 'REFUND':
        return 'Plan Refund';
      case 'ADMIN_ADJUSTMENT':
        return 'Admin Balance Adjustment';
      default:
        return tx.description || 'Wallet Transaction';
    }
  };

  const formatDateTime = (iso: string) => {
    if (!iso) return 'Just now';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  const getStatusBadge = (status?: string, type?: TransactionType) => {
    const s = (status || 'Completed').toLowerCase();
    if (s.includes('pending') || s.includes('processing')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3" />
          Pending
        </span>
      );
    }
    if (s.includes('reject') || s.includes('failed') || s.includes('cancel')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
          <XCircle className="w-3 h-3" />
          Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3" />
        Completed
      </span>
    );
  };

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-gray-900 flex flex-col pb-28">
      {/* 1. Header Banner */}
      <div className="w-full bg-gradient-to-r from-[#FF6000] via-[#FF7A00] to-[#FFA000] px-4 pt-5 pb-6 text-white shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNavigateTab('me')}
              className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              <h1 className="text-lg font-bold">Transaction History</h1>
            </div>
          </div>
          <button
            onClick={loadTransactions}
            disabled={loading}
            className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium text-xs flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Balance Overview Cards */}
        <div className="grid grid-cols-3 gap-2 text-center bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/20">
          <div>
            <span className="text-[11px] text-white/80 font-medium block">Topup Wallet</span>
            <span className="text-base font-black text-white block mt-0.5">
              ₹{(wallet?.topupBalance ?? wallet?.rechargeBalance ?? 0).toFixed(2)}
            </span>
          </div>
          <div className="border-x border-white/20 px-1">
            <span className="text-[11px] text-white/80 font-medium block">Withdraw Wallet</span>
            <span className="text-base font-black text-white block mt-0.5">
              ₹{(wallet?.withdrawBalance ?? wallet?.earnedBalance ?? wallet?.availableBalance ?? 0).toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-white/80 font-medium block">Withdrawn</span>
            <span className="text-base font-black text-white block mt-0.5">
              ₹{(wallet?.totalWithdrawn || 0).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Search & Filter Section */}
      <div className="px-4 -mt-3 space-y-3">
        {/* Search Bar */}
        <div className="bg-white rounded-2xl p-2.5 shadow-xs border border-gray-100 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400 shrink-0 ml-1.5" />
          <input
            type="text"
            placeholder="Search by Ref ID, UTR, plan name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs text-gray-800 placeholder-gray-400 bg-transparent outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-gray-400 hover:text-gray-600 p-1 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs Horizontal Scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
          {filterTabs.map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all active:scale-95 ${
                  isActive
                    ? 'bg-[#FF6200] text-white shadow-xs font-bold'
                    : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 3. Transaction Items List */}
        <div className="space-y-2.5 pt-1">
          {loading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-gray-100 space-y-3 shadow-xs">
              <RefreshCw className="w-7 h-7 text-[#FF6200] animate-spin mx-auto" />
              <p className="text-xs text-gray-500 font-medium">Loading transactions from secure ledger...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-gray-100 space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#FF6200] flex items-center justify-center mx-auto">
                <Receipt className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-gray-800">No Transactions Found</h4>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                {searchQuery
                  ? 'No records match your search query.'
                  : activeCategory !== 'ALL'
                  ? `No ${activeCategory.toLowerCase()} transactions recorded yet.`
                  : 'Your transaction records will appear here as you recharge, claim device yields, or withdraw.'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                {onOpenRecharge && (
                  <button
                    onClick={onOpenRecharge}
                    className="px-4 py-2 rounded-xl bg-[#FF6200] text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
                  >
                    Recharge Wallet
                  </button>
                )}
                <button
                  onClick={() => onNavigateTab('purchase')}
                  className="px-4 py-2 rounded-xl bg-orange-50 text-[#FF6200] text-xs font-bold border border-orange-200 active:scale-95 transition-all"
                >
                  Explore Plans
                </button>
              </div>
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const { icon, bg } = getTransactionIcon(tx.type);
              const isCredit = tx.amount > 0;
              const formattedAmt = `${isCredit ? '+' : ''}₹${Math.abs(tx.amount).toFixed(2)}`;
              const isTopupWallet = tx.balanceType === 'TOPUP_WALLET' || tx.balanceType === 'RECHARGE_BALANCE' || tx.type === 'RECHARGE' || tx.type === 'PLAN_PURCHASE' || tx.type === 'PRO_PLAN_PURCHASE';

              return (
                <motion.div
                  key={tx.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedTx(tx)}
                  className="bg-white rounded-2xl p-3.5 shadow-2xs border border-gray-100 hover:border-orange-200 cursor-pointer active:scale-[0.99] transition-all flex items-center justify-between gap-3"
                >
                  {/* Left: Icon & Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${bg}`}
                    >
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-bold text-gray-900 truncate">
                          {getTransactionTitle(tx)}
                        </h4>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold whitespace-nowrap ${
                            isTopupWallet
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {isTopupWallet ? 'Topup Wallet' : 'Withdraw Wallet'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                        <span>{formatDateTime(tx.createdAt)}</span>
                        {tx.referenceId && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-gray-500 truncate max-w-[120px]">
                              {tx.referenceId}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount & Status */}
                  <div className="text-right shrink-0">
                    <span
                      className={`text-sm font-black tracking-tight ${
                        isCredit ? 'text-emerald-600' : 'text-gray-900'
                      }`}
                    >
                      {formattedAmt}
                    </span>
                    <div className="mt-1 flex justify-end">
                      {getStatusBadge(tx.status, tx.type)}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. Detailed Transaction Modal */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTx(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl z-10 text-gray-800 space-y-4"
            >
              {/* Top Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-[#FF6200] flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">Transaction Details</h3>
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Big Amount Card */}
              <div className="text-center py-3 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-xs text-gray-500 font-medium">Transaction Amount</span>
                <div
                  className={`text-3xl font-black mt-0.5 ${
                    selectedTx.amount > 0 ? 'text-emerald-600' : 'text-gray-900'
                  }`}
                >
                  {selectedTx.amount > 0 ? '+' : ''}₹{Math.abs(selectedTx.amount).toFixed(2)}
                </div>
                <div className="mt-2 flex justify-center">
                  {getStatusBadge(selectedTx.status, selectedTx.type)}
                </div>
              </div>

              {/* Data Rows */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center p-2 bg-gray-50 rounded-xl">
                  <span className="text-gray-500">Transaction Type</span>
                  <span className="font-bold text-gray-900">{getTransactionTitle(selectedTx)}</span>
                </div>

                <div className="flex justify-between items-center p-2 bg-gray-50 rounded-xl">
                  <span className="text-gray-500">Date & Time</span>
                  <span className="font-semibold text-gray-900">{formatDateTime(selectedTx.createdAt)}</span>
                </div>

                {selectedTx.referenceId && (
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded-xl">
                    <span className="text-gray-500">Reference / Order ID</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-gray-900">
                      <span>{selectedTx.referenceId}</span>
                      <button
                        onClick={() => copyToClipboard(selectedTx.referenceId!, 'Reference ID')}
                        className="text-gray-400 hover:text-[#FF6200] p-0.5"
                      >
                        {copiedId === selectedTx.referenceId ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {selectedTx.utr && (
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded-xl">
                    <span className="text-gray-500">Bank UTR / Ref No.</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-[#FF6200]">
                      <span>{selectedTx.utr}</span>
                      <button
                        onClick={() => copyToClipboard(selectedTx.utr!, 'UTR Number')}
                        className="text-gray-400 hover:text-[#FF6200] p-0.5"
                      >
                        {copiedId === selectedTx.utr ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {selectedTx.paymentMethod && (
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded-xl">
                    <span className="text-gray-500">Payment Method</span>
                    <span className="font-semibold text-gray-900">{selectedTx.paymentMethod}</span>
                  </div>
                )}

                {selectedTx.balanceType && (
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded-xl">
                    <span className="text-gray-500">Wallet Target</span>
                    <span className="font-bold text-xs text-gray-800">
                      {selectedTx.balanceType === 'TOPUP_WALLET' || selectedTx.balanceType === 'RECHARGE_BALANCE'
                        ? 'Topup Wallet (Plan Purchase)'
                        : selectedTx.balanceType === 'WITHDRAW_WALLET' || selectedTx.balanceType === 'DEVICE_EARNING_BALANCE'
                        ? 'Withdraw Wallet (Withdrawable)'
                        : selectedTx.balanceType}
                    </span>
                  </div>
                )}

                {selectedTx.balanceBefore !== undefined && selectedTx.balanceAfter !== undefined && (
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded-xl">
                    <span className="text-gray-500">Wallet Balance Delta</span>
                    <span className="font-mono text-gray-700">
                      ₹{selectedTx.balanceBefore.toFixed(2)} → ₹{selectedTx.balanceAfter.toFixed(2)}
                    </span>
                  </div>
                )}

                {selectedTx.description && (
                  <div className="p-2.5 bg-orange-50/50 border border-orange-100 rounded-xl text-gray-600">
                    <span className="font-semibold text-gray-700 block mb-0.5">Note:</span>
                    <p className="text-[11px] leading-relaxed">{selectedTx.description}</p>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="pt-2">
                <button
                  onClick={() => setSelectedTx(null)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FF6000] to-[#FF8C00] text-white font-bold text-xs shadow-md shadow-orange-500/20 active:scale-98 transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
