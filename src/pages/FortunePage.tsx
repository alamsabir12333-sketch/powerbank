import React, { useState, useEffect } from 'react';
import { FloatingContact } from '../components/FloatingContact';
import { CustomerSupportModal } from '../components/CustomerSupportModal';
import { TabType, UserProfile, Wallet as WalletType, PurchaseItem, WalletTransaction } from '../types';
import {
  fetchWalletTransactions,
  settleAndCalculateEarnings,
} from '../services/api';
import {
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Zap,
  RefreshCw,
  Gift,
  Coins,
} from 'lucide-react';

interface FortunePageProps {
  onNavigateTab: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
  userProfile: UserProfile | null;
  wallet: WalletType | null;
  purchases: PurchaseItem[];
  onOpenRecharge: () => void;
  onOpenWithdrawal: () => void;
  onRefreshData?: () => void;
}

export const FortunePage: React.FC<FortunePageProps> = ({
  onNavigateTab,
  onShowToast,
  userProfile,
  wallet,
  purchases,
  onOpenRecharge,
  onOpenWithdrawal,
  onRefreshData,
}) => {
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'claims' | 'recharge' | 'withdraw'>('all');
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  const userId = userProfile?.userId || userProfile?.id || 'usr_demo_01';

  const loadPageData = async () => {
    try {
      // Settle any pending yield calculation in background so stats are up to date
      await settleAndCalculateEarnings(userId);

      const txs = await fetchWalletTransactions(userId);
      setTransactions(txs);
    } catch (e) {
      console.error('Error loading fortune data:', e);
    }
  };

  useEffect(() => {
    loadPageData();
  }, [userId, wallet?.availableBalance]);

  const handleManualRefresh = async () => {
    await loadPageData();
    if (onRefreshData) onRefreshData();
    onShowToast('Financial statistics and ledger refreshed.');
  };

  const activePurchases = purchases.filter((p) => p.status === 'ACTIVE');
  const activeDeviceInvestments = activePurchases.reduce((acc, p) => acc + p.amount, 0);
  const availableBalance = wallet?.availableBalance || 0;
  const earnedBalance = wallet?.earnedBalance !== undefined ? wallet.earnedBalance : availableBalance;
  const rechargeBalance = wallet?.rechargeBalance || 0;
  const withdrawableEarnings = earnedBalance;
  const totalAssets = +(activeDeviceInvestments + availableBalance).toFixed(2);
  const todayEstimatedEarnings = activePurchases.reduce((acc, p) => {
    const daily = p.dailyEarnings || (p.earningRate * 24) || 0;
    return acc + daily;
  }, 0);
  const totalEarned = wallet?.totalEarned || 0;

  const filteredTransactions = transactions.filter((tx) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'claims') return tx.type === 'EARNING_CLAIM' || tx.type === 'PRO_INSTANT_BONUS' || tx.type === 'EARNING' || tx.type === 'REFERRAL_BONUS';
    if (activeFilter === 'recharge') return tx.type === 'RECHARGE';
    if (activeFilter === 'withdraw') return tx.type === 'WITHDRAWAL' || tx.type === 'WITHDRAWAL_REVERSAL';
    return true;
  });

  return (
    <div className="w-full min-h-screen bg-[#F8F9FA] text-gray-900 flex flex-col pb-28">
      {/* Top Orange Header Banner */}
      <div className="w-full bg-gradient-to-r from-[#FF6B00] via-[#FF7D00] to-[#FFA000] px-5 pt-6 pb-8 shadow-sm">
        <div className="flex items-center justify-between text-white mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            <h1 className="text-lg font-bold">Fortune & Assets</h1>
          </div>
          <button
            onClick={handleManualRefresh}
            className="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-full font-medium flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync Stats</span>
          </button>
        </div>

        {/* Big Total Assets Display */}
        <div className="text-white text-center py-2">
          <span className="text-xs text-white/80 font-medium">Total Assets (₹)</span>
          <div className="text-3xl font-black tracking-tight mt-0.5">
            ₹{totalAssets.toFixed(2)}
          </div>
        </div>

        {/* 3 Horizontal sub-stats */}
        <div className="grid grid-cols-3 text-center border-t border-white/20 pt-4 mt-2">
          <div>
            <span className="text-white font-bold text-base">₹{withdrawableEarnings.toFixed(2)}</span>
            <span className="text-white/80 text-[11px] block mt-0.5">Device Earned</span>
          </div>
          <div className="border-x border-white/20 px-1">
            <span className="text-white font-bold text-base">+₹{todayEstimatedEarnings.toFixed(2)}</span>
            <span className="text-white/80 text-[11px] block mt-0.5">Est. Daily Yield</span>
          </div>
          <div>
            <span className="text-white font-bold text-base">+₹{totalEarned.toFixed(2)}</span>
            <span className="text-white/80 text-[11px] block mt-0.5">Total Claimed</span>
          </div>
        </div>
      </div>

      {/* Action Buttons (Recharge & Withdraw) */}
      <div className="px-4 -mt-4 flex gap-3">
        <button
          onClick={onOpenRecharge}
          className="flex-1 py-3 px-4 bg-white rounded-2xl shadow-xs border border-gray-100 flex items-center justify-center gap-2 text-[#FF6200] font-bold text-sm hover:shadow-md transition-all active:scale-98"
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>Recharge</span>
        </button>

        <button
          onClick={onOpenWithdrawal}
          className="flex-1 py-3 px-4 bg-white rounded-2xl shadow-xs border border-gray-100 flex items-center justify-center gap-2 text-gray-800 font-bold text-sm hover:shadow-md transition-all active:scale-98"
        >
          <ArrowUpRight className="w-4 h-4 text-blue-600" />
          <span>Withdraw</span>
        </button>
      </div>

      {/* Active Device Overview */}
      <div className="px-4 pt-4">
        <div className="w-full bg-white rounded-2xl p-4 border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#FF6200]" />
              <h3 className="font-bold text-sm text-gray-900">
                Operating Devices ({activePurchases.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('purchase')}
              className="text-[11px] text-[#FF6200] font-bold hover:underline"
            >
              + Acquire Devices
            </button>
          </div>

          {activePurchases.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-xl text-center space-y-2">
              <p className="text-xs text-gray-500">No active cabinets operating right now.</p>
              <button
                onClick={() => onNavigateTab('purchase')}
                className="px-4 py-1.5 rounded-lg bg-[#FF6200] text-white text-xs font-bold shadow-xs"
              >
                Go to Purchase Hall
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {activePurchases.map((p) => {
                const isPro = (p.planCategory || '').toUpperCase() === 'PRO';
                const daily = p.dailyEarnings || (p.earningRate * 24);
                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-xl flex items-center justify-between text-xs border ${
                      isPro
                        ? 'bg-gradient-to-r from-amber-50/50 to-white border-amber-200/80'
                        : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-gray-800">{p.planName}</p>
                        <span className={`text-[9px] px-1.5 py-0.2 font-bold rounded ${
                          isPro ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-700'
                        }`}>
                          {isPro ? 'PRO ACTIVE' : 'RUNNING'}
                        </span>
                      </div>
                      <p className="text-gray-500 text-[10.5px] mt-0.5 font-mono">
                        Yield: ₹{daily.toFixed(2)}/day (₹{p.earningRate.toFixed(2)}/hr)
                      </p>
                      {p.instantBonus && p.instantBonus > 0 ? (
                        <p className="text-amber-700 text-[10px] font-bold mt-0.5">
                          🎁 Instant Bonus ₹{p.instantBonus} Claimed
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <span className="text-[#FF6200] font-black text-sm">
                        +₹{p.totalEarned.toFixed(2)}
                      </span>
                      <p className="text-gray-400 text-[9.5px]">Total Accrued</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Transaction Records */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-extrabold text-[16px] text-gray-900">
            Financial Ledger
          </h3>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl text-xs">
            {(['all', 'claims', 'recharge', 'withdraw'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-2.5 py-1 rounded-lg font-medium capitalize text-[11px] transition-colors ${
                  activeFilter === filter
                    ? 'bg-white text-[#FF6200] shadow-xs font-bold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {filter === 'claims' ? 'Claims & Yield' : filter}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((item) => (
              <div key={item.id} className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      item.type === 'PRO_INSTANT_BONUS'
                        ? 'bg-amber-100 text-amber-700'
                        : item.type === 'EARNING_CLAIM'
                        ? 'bg-green-50 text-green-600'
                        : item.amount >= 0
                        ? 'bg-orange-50 text-[#FF6200]'
                        : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    {item.type === 'PRO_INSTANT_BONUS' ? (
                      <Gift className="w-4 h-4" />
                    ) : item.type === 'EARNING_CLAIM' ? (
                      <Coins className="w-4 h-4" />
                    ) : item.amount >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 leading-snug">
                      {item.description || item.type}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`font-extrabold text-sm ${
                      item.type === 'PRO_INSTANT_BONUS'
                        ? 'text-amber-600'
                        : item.amount >= 0
                        ? 'text-[#FF6200]'
                        : 'text-gray-800'
                    }`}
                  >
                    {item.amount >= 0 ? `+₹${item.amount.toFixed(2)}` : `-₹${Math.abs(item.amount).toFixed(2)}`}
                  </span>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-green-600 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Settled</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-gray-400 text-xs">
              No transactions recorded in this filter.
            </div>
          )}
        </div>
      </div>

      {/* Floating Contact */}
      <FloatingContact
        isDark={false}
        onClick={() => setIsSupportOpen(true)}
      />

      <CustomerSupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />
    </div>
  );
};
