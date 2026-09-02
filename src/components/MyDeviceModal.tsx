import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Zap,
  Clock,
  Coins,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Plus,
  Sparkles,
  RefreshCw,
  Receipt,
  Check,
  Timer,
  Calendar,
} from 'lucide-react';
import { PurchaseItem, TabType, EarningRecord } from '../types';
import { ProductCabinetArtwork } from './Artworks';
import {
  fetchClaimableEarnings,
  claimUserEarnings,
  settleAndCalculateEarnings,
  calculateDeviceHourlyStatus,
  DeviceHourlyStatus,
} from '../services/api';
import { playCoinSound, playSuccessChime } from '../utils/audio';

interface MyDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  purchases: PurchaseItem[];
  onNavigateTab: (tab: TabType) => void;
  onShowToast?: (msg: string) => void;
  onClaimSuccess?: () => void;
}

export const MyDeviceModal: React.FC<MyDeviceModalProps> = ({
  isOpen,
  onClose,
  userId = '',
  purchases,
  onNavigateTab,
  onShowToast,
  onClaimSuccess,
}) => {
  const [claimableData, setClaimableData] = useState<{
    totalClaimable: number;
    count: number;
    records: EarningRecord[];
    deviceStatuses?: DeviceHourlyStatus[];
  }>({ totalClaimable: 0, count: 0, records: [] });
  const [isClaiming, setIsClaiming] = useState(false);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(false);
  const [tick, setTick] = useState(0);
  const [claimSuccessModal, setClaimSuccessModal] = useState<{
    isOpen: boolean;
    amount: number;
    batchId: string;
  }>({ isOpen: false, amount: 0, batchId: '' });

  const loadEarnings = async () => {
    if (!userId) return;
    setIsLoadingEarnings(true);
    try {
      // Settle discrete hourly cycles first
      await settleAndCalculateEarnings(userId);
      const claimable = await fetchClaimableEarnings(userId);
      setClaimableData(claimable);
    } catch (e) {
      console.error('Error loading claimable earnings:', e);
    } finally {
      setIsLoadingEarnings(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadEarnings();
      // Tick every 10 seconds to keep countdown fresh
      const interval = setInterval(() => {
        setTick((t) => t + 1);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen, userId]);

  const handleClaim = async () => {
    if (!userId || isClaiming || claimableData.totalClaimable <= 0) {
      return;
    }

    setIsClaiming(true);
    try {
      const res = await claimUserEarnings(userId);

      // Play coin sound ONLY after the claim has actually succeeded
      playCoinSound();
      playSuccessChime();

      setClaimSuccessModal({
        isOpen: true,
        amount: res.amount,
        batchId: res.claimBatchId,
      });

      // Reset local claimable amount to 0
      setClaimableData({ totalClaimable: 0, count: 0, records: [] });

      if (onShowToast) {
        onShowToast(`🎉 Claimed ₹${res.amount.toFixed(2)} to your wallet!`);
      }
      if (onClaimSuccess) {
        onClaimSuccess();
      }
      await loadEarnings();
    } catch (err: any) {
      console.error('Claim error:', err);
      if (onShowToast) {
        onShowToast(err.message || 'Failed to claim earnings');
      } else {
        alert(err.message || 'Failed to claim earnings');
      }
    } finally {
      setIsClaiming(false);
    }
  };

  if (!isOpen) return null;

  const now = Date.now();
  const activeDevices = purchases.filter((p) => p.status === 'ACTIVE');
  const totalInvested = activeDevices.reduce((sum, p) => sum + p.amount, 0);
  const totalDailyEarn = activeDevices.reduce(
    (sum, p) => sum + (p.dailyEarnings || p.earningRate * 24),
    0
  );
  const totalEarnedSoFar = purchases.reduce((sum, p) => sum + (p.totalEarned || 0), 0);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-xs"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="relative w-full max-w-md bg-[#181818] border border-[#2a2a2a] rounded-3xl shadow-2xl z-10 flex flex-col max-h-[88vh] overflow-hidden text-gray-100"
        >
          {/* Header */}
          <div className="p-4 bg-[#1f1f1f] border-b border-[#2e2e2e] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FF6000] text-white flex items-center justify-center font-bold text-sm shadow-md shadow-orange-500/20">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white tracking-tight">
                  My GAIN POWER Devices
                </h3>
                <span className="text-[10.5px] text-gray-400">
                  {activeDevices.length} Active Node{activeDevices.length !== 1 ? 's' : ''} Online
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadEarnings}
                disabled={isLoadingEarnings}
                title="Refresh Earnings"
                className="p-1.5 rounded-xl bg-[#2a2a2a] hover:bg-[#333] text-gray-300 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingEarnings ? 'animate-spin text-[#FF6000]' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl bg-[#2a2a2a] hover:bg-[#333] text-gray-300 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CLAIMABLE EARNINGS HERO SECTION (EXCLUSIVE CLAIM ENTRY POINT) */}
          <div className="p-3.5 mx-4 mt-3 bg-gradient-to-br from-[#2b1f14] via-[#221810] to-[#1a1512] border border-orange-500/35 rounded-2xl shadow-lg relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-28 h-28 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-[#FF6000] flex items-center justify-center text-white shadow-md shadow-orange-500/25 shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                    Claimable Earnings
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl font-black text-white tracking-tight">
                      ₹{claimableData.totalClaimable.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Secure CLAIM Action Button */}
              <button
                type="button"
                onClick={handleClaim}
                disabled={isClaiming || claimableData.totalClaimable <= 0}
                className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5 shrink-0 ${
                  claimableData.totalClaimable > 0
                    ? 'bg-gradient-to-r from-[#FF6000] to-[#FFA000] text-white hover:brightness-110 shadow-orange-500/30 cursor-pointer animate-pulse'
                    : 'bg-[#282828] text-gray-500 cursor-not-allowed border border-[#383838]'
                }`}
              >
                {isClaiming ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Claiming...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>CLAIM</span>
                  </>
                )}
              </button>
            </div>

            {/* Helper status text */}
            <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] relative z-10">
              {claimableData.totalClaimable > 0 ? (
                <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  <span>{claimableData.count} hourly cycle{claimableData.count !== 1 ? 's' : ''} ready to credit to wallet</span>
                </span>
              ) : (
                <span className="text-gray-400 font-medium">
                  Earnings generate strictly upon completing each full 1-hour cycle.
                </span>
              )}
              <span className="text-gray-400 text-[10px]">
                Instant Settlement
              </span>
            </div>
          </div>

          {/* Overview Stat Strip */}
          <div className="grid grid-cols-3 gap-2 p-3.5 bg-[#141414] border-y border-[#262626] text-center mt-3">
            <div className="p-2 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a]">
              <span className="text-[9.5px] text-gray-400 uppercase font-semibold block">
                Active Devices
              </span>
              <span className="text-sm font-black text-white">{activeDevices.length}</span>
            </div>
            <div className="p-2 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a]">
              <span className="text-[9.5px] text-gray-400 uppercase font-semibold block">
                Daily Yield
              </span>
              <span className="text-sm font-black text-green-400">
                ₹{totalDailyEarn.toFixed(2)}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a]">
              <span className="text-[9.5px] text-gray-400 uppercase font-semibold block">
                Total Claimed
              </span>
              <span className="text-sm font-black text-amber-400">
                ₹{totalEarnedSoFar.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Devices List Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
            {purchases.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-[#222] border border-[#333] flex items-center justify-center mx-auto text-gray-500">
                  <Zap className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">No Devices Activated Yet</h4>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1">
                    Visit the Purchase Hall to activate VIP, PRO or EVENT power stations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateTab('purchase');
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF6000] hover:bg-[#E65100] text-white text-xs font-bold shadow-md shadow-orange-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Go to Purchase Hall</span>
                </button>
              </div>
            ) : (
              purchases.map((device) => {
                const status = calculateDeviceHourlyStatus(device, now);
                const isPro = status.planCategory === 'PRO';

                return (
                  <div
                    key={device.id}
                    className={`p-3.5 rounded-2xl border ${
                      isPro
                        ? 'bg-gradient-to-br from-[#241f15] to-[#1a160d] border-amber-500/30'
                        : 'bg-[#202020] border-[#2e2e2e]'
                    } space-y-2.5 relative overflow-hidden`}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-11 h-11 rounded-xl bg-[#151515] border border-[#2a2a2a] flex items-center justify-center p-1 shrink-0">
                          <ProductCabinetArtwork
                            type={isPro ? 'cabinet-pro' : 'cabinet-green'}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-bold text-white text-xs sm:text-sm">
                              {status.planName}
                            </h4>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase ${
                                isPro
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                              }`}
                            >
                              {status.planCategory}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">
                            Progress: <strong className="text-orange-300 font-semibold">{status.totalCompletedHours} / {status.totalPlanHours} hrs</strong>
                          </span>
                        </div>
                      </div>

                      {/* Status indicator */}
                      <div className="flex items-center gap-1 shrink-0">
                        {status.isActive ? (
                          <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold text-[9.5px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 font-bold text-[9.5px]">
                            Completed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metrics grid */}
                    <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-[#141414] border border-[#262626] text-[10.5px]">
                      <div>
                        <span className="text-gray-500 block text-[9px]">Hourly Rate</span>
                        <span className="font-bold text-green-400">₹{status.hourlyEarnings.toFixed(2)}/hr</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[9px]">Remaining</span>
                        <span className="font-bold text-gray-200">{status.remainingHours}h</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[9px]">Claimable</span>
                        <span className={`font-black ${status.claimableAmount > 0 ? 'text-amber-400 animate-pulse' : 'text-gray-400'}`}>
                          ₹{status.claimableAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Next Earning Cycle Info Bar */}
                    {status.isActive && (
                      <div className="p-2 rounded-xl bg-[#171717] border border-[#2a2a2a] flex items-center justify-between text-[10.5px]">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <Timer className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          <span>Next Hour Earning:</span>
                        </div>
                        <span className="font-mono font-bold text-amber-300">
                          {status.nextEarningTimeFormatted}
                        </span>
                      </div>
                    )}

                    {/* Footer Info */}
                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5">
                      <span>
                        Total Earned:{' '}
                        <strong className="text-amber-400">
                          ₹{status.totalEarnedAmount.toFixed(2)}
                        </strong>
                      </span>
                      <span className="font-mono text-gray-400">
                        Last Claim: {status.lastClaimTimeFormatted}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="p-3.5 bg-[#1a1a1a] border-t border-[#2a2a2a] flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateTab('transactions');
              }}
              className="flex-1 py-2.5 rounded-xl bg-[#2a2a2a] hover:bg-[#333] text-gray-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Receipt className="w-3.5 h-3.5 text-orange-400" />
              <span>View Ledger</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateTab('purchase');
              }}
              className="flex-1 py-2.5 rounded-xl bg-[#FF6000] hover:bg-[#E65100] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 transition-all active:scale-98"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Purchase Device</span>
            </button>
          </div>
        </motion.div>

        {/* Claim Success Celebratory Dialog */}
        <AnimatePresence>
          {claimSuccessModal.isOpen && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setClaimSuccessModal({ isOpen: false, amount: 0, batchId: '' })}
                className="absolute inset-0 bg-black/75 backdrop-blur-xs"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-sm bg-[#1e1e1e] border border-[#333] rounded-3xl p-6 shadow-2xl z-10 text-center space-y-4 text-white"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-gray-950 mx-auto flex items-center justify-center shadow-lg shadow-amber-400/30">
                  <Coins className="w-8 h-8 animate-bounce" />
                </div>

                <div>
                  <h3 className="text-lg font-black text-white">Earnings Claimed Successfully!</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Claim Batch ID: <span className="font-mono font-bold text-amber-400">{claimSuccessModal.batchId}</span>
                  </p>
                </div>

                <div className="p-3.5 bg-orange-500/10 rounded-2xl border border-orange-500/30 text-center">
                  <span className="text-xs text-orange-300 font-semibold block">Credited to Withdraw Wallet:</span>
                  <span className="text-2xl font-black text-amber-400 mt-0.5 block">
                    +₹{claimSuccessModal.amount.toFixed(2)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setClaimSuccessModal({ isOpen: false, amount: 0, batchId: '' })}
                  className="w-full py-3 rounded-xl bg-[#FF6000] hover:bg-[#E65100] text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Done
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
};
