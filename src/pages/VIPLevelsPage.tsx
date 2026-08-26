import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Crown,
  Sparkles,
  Shield,
  Award,
  Zap,
  Star,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Info,
  Layers,
  Percent,
} from 'lucide-react';
import { TabType, UserProfile, UserVipStatus, VipLevel } from '../types';
import { fetchUserVipStatus } from '../services/api';
import { ProfileAvatar } from '../components/Artworks';

interface VIPLevelsPageProps {
  userId: string;
  userProfile: UserProfile | null;
  onBack: () => void;
  onNavigateTab: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
  onOpenRecharge?: () => void;
}

export const VIPLevelsPage: React.FC<VIPLevelsPageProps> = ({
  userId,
  userProfile,
  onBack,
  onNavigateTab,
  onShowToast,
  onOpenRecharge,
}) => {
  const [vipStatus, setVipStatus] = useState<UserVipStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStatus = async (isManualRefresh: boolean = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const status = await fetchUserVipStatus(userId);
      setVipStatus(status);
      if (isManualRefresh) {
        onShowToast('VIP status updated successfully');
      }
    } catch (err) {
      console.error('Failed to load VIP status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [userId]);

  const getTierIcon = (iconName?: string) => {
    switch (iconName?.toLowerCase()) {
      case 'crown':
        return <Crown className="w-5 h-5" />;
      case 'star':
        return <Star className="w-5 h-5" />;
      case 'gem':
      case 'diamond':
        return <Sparkles className="w-5 h-5" />;
      case 'zap':
        return <Zap className="w-5 h-5" />;
      case 'shield':
        return <Shield className="w-5 h-5" />;
      case 'award':
      case 'medal':
        return <Award className="w-5 h-5" />;
      default:
        return <Crown className="w-5 h-5" />;
    }
  };

  const getTierColorClasses = (levelNumber: number, isCurrent: boolean) => {
    if (isCurrent) {
      return {
        cardBorder: 'border-2 border-[#FF6000] shadow-md shadow-orange-500/10 bg-white',
        badgeBg: 'bg-gradient-to-r from-[#FF6000] to-[#FF8C00] text-white',
        iconBg: 'bg-orange-100 text-[#FF6000]',
        pillBg: 'bg-orange-50 text-[#FF6000] border border-orange-200',
      };
    }
    if (levelNumber === 6) {
      return {
        cardBorder: 'border border-amber-300 bg-gradient-to-b from-[#FFFDF7] to-white',
        badgeBg: 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white',
        iconBg: 'bg-amber-100 text-amber-600',
        pillBg: 'bg-amber-50 text-amber-700 border border-amber-200',
      };
    }
    return {
      cardBorder: 'border border-gray-100 bg-white shadow-2xs',
      badgeBg: 'bg-gray-100 text-gray-700',
      iconBg: 'bg-gray-50 text-gray-600',
      pillBg: 'bg-gray-50 text-gray-600 border border-gray-100',
    };
  };

  const currentLevel = vipStatus?.currentLevel;
  const nextLevel = vipStatus?.nextLevel;
  const totalInvested = vipStatus?.totalInvested || 0;
  const remainingForNext = vipStatus?.remainingForNextLevel || 0;
  const progressPercent = vipStatus?.progressPercentage ?? 0;

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-gray-900 flex flex-col pb-24 selection:bg-[#FF6000] selection:text-white">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 h-14 flex items-center justify-between shadow-2xs">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:scale-95 text-gray-700 transition-all cursor-pointer"
          aria-label="Go Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <h1 className="font-extrabold text-[17px] text-gray-900 tracking-tight flex items-center gap-1.5">
          <Crown className="w-4.5 h-4.5 text-[#FF6000]" />
          <span>VIP Membership Levels</span>
        </h1>

        <button
          onClick={() => loadStatus(true)}
          disabled={refreshing}
          className="p-2 -mr-2 rounded-full hover:bg-gray-100 active:scale-95 text-gray-600 transition-all cursor-pointer"
          title="Refresh VIP Status"
        >
          <RefreshCw className={`w-4.5 h-4.5 ${refreshing ? 'animate-spin text-[#FF6000]' : ''}`} />
        </button>
      </header>

      {/* 2. Main Body Content */}
      <main className="px-4 pt-4 space-y-4 max-w-md mx-auto w-full">
        {/* 2.1 Hero VIP Member Card (Orange Theme matching website) */}
        <div className="relative w-full rounded-2xl overflow-hidden p-5 bg-gradient-to-br from-[#FF6000] via-[#FF7A00] to-[#E65100] text-white shadow-lg shadow-orange-600/20">
          {/* Subtle geometric & light reflections */}
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-black/10 blur-lg pointer-events-none" />

          {/* User Row with VIP Badge */}
          <div className="relative z-10 flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <ProfileAvatar className="w-13 h-13 border-2 border-white/90 shadow-md" />
                <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-300 to-yellow-400 text-gray-950 font-black text-[9px] shadow-sm flex items-center gap-0.5 border border-white">
                  <Crown className="w-2.5 h-2.5" />
                  <span>{currentLevel?.badgeText || 'VIP 0'}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-lg text-white tracking-tight leading-tight">
                    {userProfile?.username || userProfile?.name || 'Power Member'}
                  </h2>
                </div>
                <p className="text-white/80 text-[11px] font-medium mt-0.5">
                  ID: {userProfile?.membershipNumber || '2829906'} • {currentLevel?.name || 'VIP 0 - Starter Member'}
                </p>
              </div>
            </div>

            {/* Current Level Pill Badge */}
            <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white font-extrabold text-xs shadow-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-200" />
              <span>{currentLevel?.badgeText || 'VIP 0'}</span>
            </div>
          </div>

          {/* Investment & Progress Section */}
          <div className="relative z-10 bg-white/15 backdrop-blur-md rounded-xl p-3.5 border border-white/20 mt-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex flex-col">
                <span className="text-white/75 text-[10.5px] font-medium">Total Qualifying Investment</span>
                <span className="text-white font-black text-[16px] tracking-tight">
                  ₹{totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {nextLevel ? (
                <div className="text-right flex flex-col items-end">
                  <span className="text-white/75 text-[10.5px] font-medium">Next Tier Target</span>
                  <span className="text-amber-200 font-extrabold text-xs flex items-center gap-1">
                    {nextLevel.badgeText} (₹{nextLevel.minInvestment.toLocaleString('en-IN')})
                  </span>
                </div>
              ) : (
                <div className="text-right">
                  <span className="text-amber-200 font-bold text-xs">Max VIP Reached</span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-black/20 rounded-full h-2.5 p-0.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 via-yellow-200 to-white shadow-xs transition-all duration-500 ease-out"
                style={{ width: `${Math.max(4, Math.min(100, progressPercent))}%` }}
              />
            </div>

            {/* Subtitle instructions */}
            <div className="flex items-center justify-between text-[11px] text-white/90">
              {nextLevel ? (
                <span>
                  Invest <strong className="text-amber-200 font-bold">₹{remainingForNext.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> more to reach <strong className="text-white font-bold">{nextLevel.badgeText}</strong>
                </span>
              ) : (
                <span className="text-amber-200 font-medium">You hold the premier highest VIP tier!</span>
              )}
              <span className="font-black text-amber-200">{progressPercent}%</span>
            </div>
          </div>

          {/* Quick CTA button */}
          <div className="relative z-10 mt-3.5 flex items-center justify-between gap-2">
            <button
              onClick={() => onNavigateTab('purchase')}
              className="flex-1 py-2.5 rounded-xl bg-white text-[#FF6000] font-black text-xs shadow-md hover:bg-orange-50 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5 text-[#FF6000]" />
              <span>Upgrade VIP By Investing</span>
            </button>

            {onOpenRecharge && (
              <button
                onClick={onOpenRecharge}
                className="px-4 py-2.5 rounded-xl bg-black/25 hover:bg-black/35 text-white font-bold text-xs border border-white/25 active:scale-98 transition-all cursor-pointer"
              >
                Top Up
              </button>
            )}
          </div>
        </div>

        {/* 2.2 Privileges Overview Card */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#FF6000]" />
              <span>Your Current VIP Privileges</span>
            </h3>
            <span className="text-[11px] font-bold text-[#FF6000] bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
              {currentLevel?.badgeText || 'VIP 0'} Active
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-[#FFF8F3] border border-[#FFE7D6] flex flex-col justify-between">
              <span className="text-[10px] text-gray-500 font-medium">Daily Device Bonus</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-black text-[#FF6000]">
                  +{currentLevel?.dailyBonusRate || 0}%
                </span>
                <span className="text-[10px] text-gray-400 font-medium">yield</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F0FDF4] border border-[#DCFCE7] flex flex-col justify-between">
              <span className="text-[10px] text-gray-500 font-medium">Withdrawal Fee Discount</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-black text-emerald-600">
                  {currentLevel?.withdrawalFeeDiscount ? `${currentLevel.withdrawalFeeDiscount}% OFF` : 'Standard'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2.3 VIP Tiers List Header */}
        <div className="flex items-center justify-between pt-1">
          <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#FF6000]" />
            <span>All VIP Membership Tiers</span>
          </h3>
          <span className="text-gray-400 text-[11px]">Auto-upgrades immediately</span>
        </div>

        {/* 2.4 All VIP Levels Cards */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 text-[#FF6000] animate-spin" />
            <p className="text-xs text-gray-500 font-medium">Loading VIP levels...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vipStatus?.allLevels.map((level) => {
              const isCurrent = currentLevel?.levelNumber === level.levelNumber;
              const isUnlocked = totalInvested >= level.minInvestment;
              const styles = getTierColorClasses(level.levelNumber, isCurrent);

              return (
                <div
                  key={level.id}
                  className={`rounded-2xl p-4 transition-all ${styles.cardBorder} relative overflow-hidden`}
                >
                  {/* Active Now Ribbon */}
                  {isCurrent && (
                    <div className="absolute top-0 right-0 bg-[#FF6000] text-white text-[9.5px] font-black px-3 py-0.5 rounded-bl-xl shadow-xs tracking-wide">
                      CURRENT LEVEL
                    </div>
                  )}

                  {/* Top Row: Tier Icon, Level Name, Min Investment */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${styles.iconBg} flex items-center justify-center shrink-0 shadow-xs font-bold`}>
                        {getTierIcon(level.icon)}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-gray-900 text-[15px] tracking-tight">
                            {level.name}
                          </h4>
                        </div>
                        <p className="text-gray-500 text-[11px] font-medium mt-0.5">
                          Requires investment: <strong className="text-gray-800 font-bold">₹{level.minInvestment.toLocaleString('en-IN')}</strong>
                          {level.maxInvestment ? ` – ₹${level.maxInvestment.toLocaleString('en-IN')}` : '+'}
                        </p>
                      </div>
                    </div>

                    {/* Status Pill */}
                    {!isCurrent && (
                      <div className="shrink-0 mt-0.5">
                        {isUnlocked ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Unlocked
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 text-[10px] font-bold flex items-center gap-1">
                            <Lock className="w-3 h-3 text-gray-400" />
                            Locked
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Description if present */}
                  {level.description && (
                    <p className="text-gray-600 text-xs mb-3 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100 leading-relaxed">
                      {level.description}
                    </p>
                  )}

                  {/* Privileges / Benefits Grid */}
                  <div className="space-y-1.5 border-t border-gray-100 pt-2.5">
                    <span className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider block">
                      Tier Privileges
                    </span>

                    <div className="space-y-1.5">
                      {level.benefits && level.benefits.length > 0 ? (
                        level.benefits.map((b, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-gray-700">
                            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${isUnlocked ? 'text-[#FF6000]' : 'text-gray-300'}`} />
                            <span className="font-medium">{b}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#FF6000]" />
                          <span>Standard Device Earnings & Withdrawal Support</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* If Locked, Action Bar */}
                  {!isUnlocked && (
                    <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center justify-between bg-orange-50/50 -mx-4 -mb-4 p-3 rounded-b-2xl">
                      <span className="text-[11px] text-gray-600 font-medium">
                        Need <strong className="text-[#FF6000] font-black">₹{(level.minInvestment - totalInvested).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> more
                      </span>
                      <button
                        onClick={() => onNavigateTab('purchase')}
                        className="px-3 py-1.5 rounded-lg bg-[#FF6000] hover:bg-[#e05500] text-white text-xs font-black shadow-2xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                      >
                        <span>Invest Now</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 2.5 Rules & Transparency Card */}
        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-2xs space-y-2">
          <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-gray-400" />
            <span>VIP Upgrade Rules</span>
          </h4>
          <ul className="text-[11px] text-gray-500 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>Your VIP tier is automatically evaluated in real-time based on your total qualifying equipment purchases.</li>
            <li>Once an investment threshold is met, your account permanently enjoys the higher tier yield bonuses and fee reductions.</li>
            <li>No manual claim is required; bonuses apply immediately across your active and future devices.</li>
          </ul>
        </div>
      </main>
    </div>
  );
};
