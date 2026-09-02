import React, { useState, useEffect } from 'react';
import { FloatingContact } from '../components/FloatingContact';
import { CustomerSupportModal } from '../components/CustomerSupportModal';
import { TabType, UserProfile, Wallet as WalletType, PurchaseItem, DailyCheckInStatus } from '../types';
import {
  settleAndCalculateEarnings,
  fetchDailyCheckInStatus,
  performDailyCheckIn,
  fetchWallet,
} from '../services/api';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Zap,
  RefreshCw,
  Gift,
  CalendarCheck,
  Check,
  Sparkles,
  Flame,
  Loader2,
  HelpCircle,
  Clock,
  History,
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
  const [checkInStatus, setCheckInStatus] = useState<DailyCheckInStatus | null>(null);
  const [loadingCheckIn, setLoadingCheckIn] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [liveWallet, setLiveWallet] = useState<WalletType | null>(wallet);

  const userId = userProfile?.userId || userProfile?.id || '';

  useEffect(() => {
    setLiveWallet(wallet);
  }, [wallet]);

  const loadPageData = async () => {
    if (!userId) {
      setLoadingCheckIn(false);
      return;
    }
    try {
      // Settle any pending yield calculation in background so stats are up to date
      await settleAndCalculateEarnings(userId);

      // Fetch fresh wallet
      const freshWallet = await fetchWallet(userId);
      if (freshWallet) {
        setLiveWallet(freshWallet);
      }

      // Load dynamic Daily Check-in status
      const status = await fetchDailyCheckInStatus(userId);
      setCheckInStatus(status);
    } catch (e) {
      console.error('Error loading fortune data:', e);
    } finally {
      setLoadingCheckIn(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, [userId, wallet?.availableBalance]);

  const handleManualRefresh = async () => {
    await loadPageData();
    if (onRefreshData) onRefreshData();
    onShowToast('Financial statistics and check-in status refreshed.');
  };

  const handleDailyCheckIn = async () => {
    if (claiming) return;
    if (checkInStatus?.hasCheckedInToday) {
      onShowToast('You have already checked in today! Please return tomorrow.');
      return;
    }

    setClaiming(true);
    try {
      const res = await performDailyCheckIn(userId);
      onShowToast(`🎉 Daily Check-in Successful! Credited ₹${res.reward.toFixed(2)} to your Topup Wallet.`);
      // Reload check-in data and trigger parent wallet refresh
      await loadPageData();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to complete daily check-in');
    } finally {
      setClaiming(false);
    }
  };

  const activePurchases = purchases.filter((p) => p.status === 'ACTIVE');
  const activeDeviceInvestments = activePurchases.reduce((acc, p) => acc + (p.amount || 0), 0);
  const topupBalance = Number(
    liveWallet?.rechargeBalance !== undefined
      ? liveWallet.rechargeBalance
      : liveWallet?.topupBalance !== undefined
      ? liveWallet.topupBalance
      : wallet?.rechargeBalance !== undefined
      ? wallet.rechargeBalance
      : wallet?.topupBalance || 0
  );
  const withdrawBalance = Number(
    liveWallet?.withdrawBalance !== undefined
      ? liveWallet.withdrawBalance
      : liveWallet?.earnedBalance !== undefined
      ? liveWallet.earnedBalance
      : liveWallet?.availableBalance !== undefined
      ? liveWallet.availableBalance
      : wallet?.withdrawBalance !== undefined
      ? wallet.withdrawBalance
      : wallet?.earnedBalance !== undefined
      ? wallet.earnedBalance
      : wallet?.availableBalance || 0
  );
  const withdrawableEarnings = withdrawBalance;
  const totalAssets = Number((topupBalance + withdrawBalance).toFixed(2));
  const todayEstimatedEarnings = activePurchases.reduce((acc, p) => {
    const daily = p.dailyEarnings || (p.earningRate * 24) || 0;
    return acc + daily;
  }, 0);
  const totalEarned = Number(wallet?.totalEarned || 0);

  // Daily check-in calculations
  const streak = checkInStatus?.currentStreak || 0;
  const hasCheckedInToday = !!checkInStatus?.hasCheckedInToday;
  const dailyReward = checkInStatus?.dailyReward || 5.00;
  const day7Bonus = checkInStatus?.day7Bonus || 100.00;

  // Compute checked-in status for days 1 to 7
  // If user checked in today, days 1..streak (mod 7) are completed
  // If not checked in today, days 1..(streak % 7) are completed, and next day is ((streak % 7) + 1)
  const completedDaysCount = hasCheckedInToday
    ? (streak % 7 === 0 && streak > 0 ? 7 : streak % 7)
    : (streak % 7);
  const nextTargetDay = hasCheckedInToday ? 0 : completedDaysCount + 1;

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
          className="flex-1 py-3 px-4 bg-white rounded-2xl shadow-xs border border-gray-100 flex items-center justify-center gap-2 text-[#FF6200] font-bold text-sm hover:shadow-md transition-all active:scale-98 cursor-pointer"
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>Recharge</span>
        </button>

        <button
          onClick={onOpenWithdrawal}
          className="flex-1 py-3 px-4 bg-white rounded-2xl shadow-xs border border-gray-100 flex items-center justify-center gap-2 text-gray-800 font-bold text-sm hover:shadow-md transition-all active:scale-98 cursor-pointer"
        >
          <ArrowUpRight className="w-4 h-4 text-blue-600" />
          <span>Withdraw</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* DYNAMIC DAILY CHECK-IN SECTION (Orange UI Themed) */}
      {/* ========================================================================= */}
      <div className="px-4 pt-4">
        <div className="w-full bg-gradient-to-r from-[#FF6B00] via-[#FF7D00] to-[#FFA000] rounded-3xl p-4 sm:p-5 text-white shadow-md shadow-orange-500/15 relative overflow-hidden">
          {/* Subtle background glow effect */}
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

          {/* Header Row */}
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5">
                  <Flame className="w-5 h-5 text-amber-200 fill-amber-200" />
                  Daily Check-in
                </h3>
                {!loadingCheckIn && hasCheckedInToday && (
                  <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-xs">
                    Claimed Today
                  </span>
                )}
              </div>
              <p className="text-white/85 text-xs mt-0.5">
                Check in daily to earn continuous cash rewards
              </p>
            </div>

            <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-xs flex items-center justify-center text-white shadow-xs shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>

          {/* Loading Skeleton or 7-Day Cycle Grid */}
          {loadingCheckIn ? (
            <div className="space-y-4 animate-pulse relative z-10">
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-4">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <div key={n} className="flex flex-col items-center gap-1.5">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/20" />
                    <div className="w-8 h-2.5 bg-white/20 rounded-full" />
                    <div className="w-6 h-2 bg-white/15 rounded-full" />
                  </div>
                ))}
              </div>
              <div className="h-14 bg-black/15 rounded-2xl border border-white/10" />
            </div>
          ) : (
            <>
              {/* 7-Day Cycle Grid */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-4 relative z-10">
                {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
                  const isChecked = dayNum <= completedDaysCount;
                  const isTargetToday = !hasCheckedInToday && dayNum === nextTargetDay;
                  const isDay7 = dayNum === 7;
                  const amount = isDay7 ? day7Bonus : dailyReward;

                  return (
                    <div
                      key={dayNum}
                      className={`flex flex-col items-center justify-center text-center transition-all ${
                        isTargetToday ? 'scale-105' : ''
                      }`}
                    >
                      {/* Day Circle */}
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all relative ${
                          isChecked
                            ? 'bg-white text-[#FF6B00] shadow-sm ring-2 ring-white/60'
                            : isTargetToday
                            ? 'bg-white text-[#FF6B00] shadow-lg ring-3 ring-amber-300 animate-pulse font-extrabold'
                            : 'bg-white/20 border border-white/30 text-white'
                        }`}
                      >
                        {isChecked ? (
                          <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3] text-[#FF6B00]" />
                        ) : isDay7 ? (
                          <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-amber-200" />
                        ) : (
                          <span>{dayNum}</span>
                        )}

                        {isDay7 && (
                          <span className="absolute -top-1.5 -right-1 bg-amber-300 text-amber-950 text-[8px] font-black px-1 py-0.2 rounded-full uppercase leading-none shadow-xs">
                            MAX
                          </span>
                        )}
                      </div>

                      {/* Reward Text */}
                      <span
                        className={`text-[10px] sm:text-[11px] font-bold mt-1.5 whitespace-nowrap leading-tight ${
                          isChecked
                            ? 'text-white font-extrabold'
                            : isTargetToday
                            ? 'text-amber-200 font-extrabold'
                            : 'text-white/80'
                        }`}
                      >
                        Rs {amount.toFixed(0)}
                      </span>
                      <span className="text-[9px] text-white/60 font-medium">
                        Day {dayNum}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Card Bottom Bar (Streak Info & Action Button) */}
              <div className="bg-black/15 backdrop-blur-xs rounded-2xl p-3 flex items-center justify-between gap-3 relative z-10 border border-white/10">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="truncate">
                      Current Streak: <strong className="text-amber-200 font-extrabold">{streak}</strong> day{streak === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/80 mt-0.5 truncate">
                    Day 7 mega bonus: <strong className="text-white font-bold">Rs {day7Bonus.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={handleDailyCheckIn}
                    disabled={hasCheckedInToday || claiming || loadingCheckIn}
                    className={`px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
                      hasCheckedInToday
                        ? 'bg-white/25 text-white/90 cursor-not-allowed border border-white/20'
                        : 'bg-white text-[#FF6B00] hover:bg-orange-50 active:scale-95 hover:shadow-lg'
                    }`}
                  >
                    {claiming ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Claiming...</span>
                      </>
                    ) : hasCheckedInToday ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Checked In</span>
                      </>
                    ) : (
                      <>
                        <Gift className="w-3.5 h-3.5" />
                        <span>Check In</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick History Toggle */}
              <div className="mt-3 text-center">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-[11px] text-white/80 hover:text-white font-semibold flex items-center justify-center gap-1 mx-auto transition-colors cursor-pointer"
                >
                  <History className="w-3 h-3" />
                  <span>{showHistory ? 'Hide Check-in Logs' : 'View Check-in History'}</span>
                </button>

                {showHistory && (
                  <div className="mt-2.5 bg-black/20 rounded-2xl p-3 text-left max-h-44 overflow-y-auto space-y-1.5 border border-white/10 text-xs">
                    {checkInStatus?.history && checkInStatus.history.length > 0 ? (
                      checkInStatus.history.map((h, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-white/10 last:border-0">
                          <div className="flex items-center gap-1.5 text-white/90">
                            <Check className="w-3 h-3 text-amber-300" />
                            <span>Day {h.dayNumber} Check-in</span>
                            <span className="text-white/60 text-[10px]">({h.date})</span>
                          </div>
                          <span className="font-bold text-amber-200">+₹{h.amount.toFixed(2)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-2 text-[11px] text-white/70">
                        No check-in history found yet. Check in today to start your streak!
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Active Operating Device Overview */}
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
              className="text-[11px] text-[#FF6200] font-bold hover:underline cursor-pointer"
            >
              + Acquire Devices
            </button>
          </div>

          {activePurchases.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-xl text-center space-y-2">
              <p className="text-xs text-gray-500">No active cabinets operating right now.</p>
              <button
                onClick={() => onNavigateTab('purchase')}
                className="px-4 py-1.5 rounded-lg bg-[#FF6200] text-white text-xs font-bold shadow-xs cursor-pointer"
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

