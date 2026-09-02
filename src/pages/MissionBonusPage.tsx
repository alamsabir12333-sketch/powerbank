import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Target,
  Users,
  Trophy,
  Crown,
  Sparkles,
  Zap,
  Gift,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Info,
  ShieldCheck,
  Award,
  Clock,
  Share2,
  Copy,
  Check,
  HelpCircle,
} from 'lucide-react';
import { TabType, UserProfile, UserMissionSummary, UserMissionItem, MissionClaim } from '../types';
import { fetchUserMissionSummary, claimMissionReward } from '../services/api';
import { ProfileAvatar } from '../components/Artworks';
import { SocialShareModal } from '../components/SocialShareModal';

interface MissionBonusPageProps {
  userId: string;
  userProfile: UserProfile | null;
  onBack: () => void;
  onNavigateTab: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
}

export const MissionBonusPage: React.FC<MissionBonusPageProps> = ({
  userId,
  userProfile,
  onBack,
  onNavigateTab,
  onShowToast,
}) => {
  const [summary, setSummary] = useState<UserMissionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'MISSIONS' | 'HISTORY'>('MISSIONS');
  const [copied, setCopied] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareContextTitle, setShareContextTitle] = useState<string>('Mission Bonus Invite');
  const [celebrationData, setCelebrationData] = useState<{
    isOpen: boolean;
    reward: number;
    missionTitle: string;
  } | null>(null);

  const handleOpenShare = (context?: string) => {
    setShareContextTitle(context || 'Mission Bonus: Share with friends to earn withdrawable rewards');
    setIsShareModalOpen(true);
  };

  const loadMissionData = async (isManual: boolean = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await fetchUserMissionSummary(userId);
      setSummary(data);
      if (isManual) {
        onShowToast('Mission progress updated!');
      }
    } catch (err: any) {
      console.error('Failed to load mission summary:', err);
      onShowToast(err.message || 'Failed to update missions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMissionData();
  }, [userId]);

  const handleClaim = async (mission: UserMissionItem) => {
    if (mission.isClaimed || !mission.isCompleted) return;

    setClaimingId(mission.id);
    try {
      const res = await claimMissionReward(userId, mission.id);
      if (res.success) {
        setCelebrationData({
          isOpen: true,
          reward: res.reward,
          missionTitle: mission.title,
        });
        onShowToast(res.message);
        await loadMissionData();
      }
    } catch (err: any) {
      console.error('Failed to claim mission bonus:', err);
      onShowToast(err.message || 'Failed to claim bonus');
    } finally {
      setClaimingId(null);
    }
  };

  const copyReferralLink = () => {
    const code = userProfile?.referralCode || userProfile?.membershipNumber || '2829906';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gainpower-top-1.com';
    const shareUrl = `${origin}/invite/${code}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        onShowToast('Referral link copied to clipboard!');
        setTimeout(() => setCopied(false), 2500);
      });
    } else {
      onShowToast(`Referral Code: ${code}`);
    }
  };

  const renderIcon = (iconName?: string) => {
    switch (iconName?.toLowerCase()) {
      case 'users':
      case 'user':
        return <Users className="w-5 h-5" />;
      case 'trophy':
        return <Trophy className="w-5 h-5" />;
      case 'crown':
        return <Crown className="w-5 h-5" />;
      case 'zap':
        return <Zap className="w-5 h-5" />;
      case 'gift':
        return <Gift className="w-5 h-5" />;
      case 'sparkles':
        return <Sparkles className="w-5 h-5" />;
      case 'award':
        return <Award className="w-5 h-5" />;
      case 'target':
      default:
        return <Target className="w-5 h-5" />;
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-gray-900 flex flex-col pb-28 selection:bg-[#FF6000] selection:text-white">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 px-4 h-14 flex items-center justify-between shadow-2xs">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:scale-95 text-gray-700 transition-all cursor-pointer"
          aria-label="Go Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <h1 className="font-extrabold text-[17px] text-gray-900 tracking-tight flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <span>Mission Bonus</span>
        </h1>

        <button
          onClick={() => loadMissionData(true)}
          disabled={refreshing}
          className="p-2 -mr-2 rounded-full hover:bg-gray-100 active:scale-95 text-gray-600 transition-all cursor-pointer"
          title="Refresh Missions"
        >
          <RefreshCw className={`w-4.5 h-4.5 ${refreshing ? 'animate-spin text-[#FF6000]' : ''}`} />
        </button>
      </header>

      {/* 2. Main Content Container */}
      <main className="px-4 pt-4 space-y-4 max-w-md mx-auto w-full">
        {/* 2.1 Hero Mission Card (Orange + White Theme) */}
        <div className="relative w-full rounded-2xl overflow-hidden p-5 bg-gradient-to-br from-[#FF6000] via-[#FF7A00] to-[#E65100] text-white shadow-lg shadow-orange-600/20">
          {/* Subtle background ambient blur */}
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-black/10 blur-lg pointer-events-none" />

          {/* User Row */}
          <div className="relative z-10 flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ProfileAvatar className="w-12 h-12 border-2 border-white/90 shadow-md" />
              <div>
                <h2 className="font-black text-lg text-white tracking-tight leading-tight">
                  {userProfile?.username || userProfile?.name || 'Power Member'}
                </h2>
                <p className="text-white/80 text-[11.5px] font-medium mt-0.5">
                  ID: {userProfile?.membershipNumber || '2829906'} • Active Direct Referrals
                </p>
              </div>
            </div>

            <button
              onClick={() => handleOpenShare('Mission Bonus: Share with friends to earn withdrawable rewards')}
              className="px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold text-xs flex items-center gap-1.5 border border-white/30 active:scale-95 transition-all shadow-2xs cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Invite</span>
            </button>
          </div>

          {/* 3 Metric Badges */}
          <div className="relative z-10 grid grid-cols-3 gap-2 pt-2 border-t border-white/15">
            <div className="bg-black/15 rounded-xl p-2.5 text-center">
              <span className="text-white/70 text-[10.5px] font-semibold block uppercase tracking-wider">
                Active L1
              </span>
              <div className="text-xl font-black text-white mt-0.5">
                {summary?.totalActiveReferrals ?? 0}
              </div>
              <span className="text-[9.5px] text-white/60 font-medium">with 1st plan</span>
            </div>

            <div className="bg-black/15 rounded-xl p-2.5 text-center">
              <span className="text-white/70 text-[10.5px] font-semibold block uppercase tracking-wider">
                Completed
              </span>
              <div className="text-xl font-black text-amber-300 mt-0.5">
                {summary?.completedMissionsCount ?? 0}
              </div>
              <span className="text-[9.5px] text-white/60 font-medium">
                of {summary?.missions.length ?? 0}
              </span>
            </div>

            <div className="bg-black/15 rounded-xl p-2.5 text-center">
              <span className="text-white/70 text-[10.5px] font-semibold block uppercase tracking-wider">
                Bonus Earned
              </span>
              <div className="text-xl font-black text-white mt-0.5">
                ₹{summary?.totalBonusEarned ?? 0}
              </div>
              <span className="text-[9.5px] text-white/80 font-bold bg-white/20 px-1 rounded">
                Withdraw
              </span>
            </div>
          </div>
        </div>

        {/* 2.2 Notice Banner: 100% Withdrawable Reward Info */}
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 flex items-start gap-2.5 text-amber-900 shadow-2xs">
          <div className="p-1 rounded-lg bg-amber-100 text-[#FF6000] shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-[12px] leading-relaxed">
            <span className="font-bold text-[#FF6000]">Direct Withdraw Wallet Credit:</span> Mission rewards go straight to your <strong>Withdraw Wallet</strong>. Claim instantly whenever your invited direct friends purchase their first plan!
          </div>
        </div>

        {/* 2.3 Navigation Tabs (Missions vs History) */}
        <div className="flex bg-gray-200/80 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveSubTab('MISSIONS')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === 'MISSIONS'
                ? 'bg-white text-[#FF6000] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Available Missions ({summary?.missions.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('HISTORY')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeSubTab === 'HISTORY'
                ? 'bg-white text-[#FF6000] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Claim History ({summary?.history.length || 0})</span>
          </button>
        </div>

        {/* 2.4 Tab Content: Available Missions */}
        {activeSubTab === 'MISSIONS' && (
          <div className="space-y-3">
            {loading ? (
              <div className="py-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-[#FF6000]" />
                <span className="text-xs font-semibold">Loading mission objectives...</span>
              </div>
            ) : summary?.missions && summary.missions.length > 0 ? (
              summary.missions.map((mission) => {
                const progress = Math.min(mission.currentProgress, mission.requiredReferrals);
                const percentage = Math.min(100, Math.round((progress / mission.requiredReferrals) * 100));

                return (
                  <div
                    key={mission.id}
                    className={`bg-white rounded-2xl p-4 border transition-all shadow-xs ${
                      mission.isClaimed
                        ? 'border-gray-200 opacity-80'
                        : mission.isCompleted
                        ? 'border-[#FF6000] shadow-md shadow-orange-500/10'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {/* Header Row: Icon, Title & Reward */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
                            mission.isClaimed
                              ? 'bg-gray-100 text-gray-500'
                              : mission.isCompleted
                              ? 'bg-orange-100 text-[#FF6000]'
                              : 'bg-orange-50 text-orange-600'
                          }`}
                        >
                          {renderIcon(mission.icon)}
                        </div>

                        <div>
                          <h3 className="font-extrabold text-[14.5px] text-gray-900 leading-tight">
                            {mission.title}
                          </h3>
                          <p className="text-gray-500 text-[11.5px] font-medium mt-0.5 line-clamp-1">
                            {mission.description || `Invite ${mission.requiredReferrals} active friends with 1st plan`}
                          </p>
                        </div>
                      </div>

                      {/* Reward Badge */}
                      <div className="text-right shrink-0">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black">
                          <span>+₹{mission.rewardAmount}</span>
                        </div>
                        <span className="text-[9.5px] text-gray-600 font-semibold block mt-0.5">
                          Withdraw Wallet
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar & Status */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-gray-500 font-medium">
                          Progress: <strong className="text-gray-900">{progress} / {mission.requiredReferrals} Friends</strong>
                        </span>
                        <span
                          className={`font-bold text-[11px] ${
                            mission.isClaimed
                              ? 'text-gray-500'
                              : mission.isCompleted
                              ? 'text-[#FF6000]'
                              : 'text-gray-500'
                          }`}
                        >
                          {percentage}%
                        </span>
                      </div>

                      {/* Progress Track */}
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            mission.isClaimed
                              ? 'bg-gray-400'
                              : mission.isCompleted
                              ? 'bg-gradient-to-r from-[#FF6000] to-amber-400'
                              : 'bg-[#FF6000]'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Button Section */}
                    <div className="mt-3.5 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-gray-500 flex items-center gap-1">
                        {mission.isClaimed ? (
                          <span className="text-gray-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Claimed on {mission.claimedAt ? new Date(mission.claimedAt).toLocaleDateString() : 'Record'}
                          </span>
                        ) : mission.isCompleted ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            Target reached! Ready to claim.
                          </span>
                        ) : (
                          <span className="text-gray-600">
                            Need {mission.requiredReferrals - progress} more active friend(s)
                          </span>
                        )}
                      </div>

                      {/* Button */}
                      {mission.isClaimed ? (
                        <button
                          disabled
                          className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 font-bold text-xs flex items-center gap-1.5 cursor-not-allowed"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>CLAIMED</span>
                        </button>
                      ) : mission.isCompleted ? (
                        <button
                          onClick={() => handleClaim(mission)}
                          disabled={claimingId === mission.id}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6000] to-amber-500 hover:brightness-105 active:scale-95 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-all cursor-pointer animate-pulse"
                        >
                          {claimingId === mission.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>CLAIMING...</span>
                            </>
                          ) : (
                            <>
                              <Gift className="w-3.5 h-3.5" />
                              <span>CLAIM BONUS ₹{mission.rewardAmount}</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenShare(`${mission.title} — Need ${mission.requiredReferrals - progress} more active friend(s)`)}
                          className="px-3.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#FF6000] font-bold text-xs flex items-center gap-1 border border-orange-200 active:scale-95 transition-all cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Invite Friends</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-500 border border-gray-100">
                <Target className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-700">No Missions Active</p>
                <p className="text-xs text-gray-400 mt-1">Check back later for new promotional missions.</p>
              </div>
            )}
          </div>
        )}

        {/* 2.5 Tab Content: Claim History */}
        {activeSubTab === 'HISTORY' && (
          <div className="space-y-3">
            {summary?.history && summary.history.length > 0 ? (
              summary.history.map((claim) => (
                <div
                  key={claim.id}
                  className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-2xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-gray-900">{claim.missionTitle}</div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                        <span>{new Date(claim.claimedAt).toLocaleString()}</span>
                        <span>•</span>
                        <span className="text-emerald-600 font-semibold">Credited to Withdraw Wallet</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-black text-emerald-600">+₹{claim.rewardAmount}</span>
                    <span className="text-[10px] text-gray-400 block font-medium">COMPLETED</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-500 border border-gray-100">
                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-700">No Claims Yet</p>
                <p className="text-xs text-gray-400 mt-1">Complete your mission objectives and claim rewards here.</p>
              </div>
            )}
          </div>
        )}

        {/* 2.6 Detailed Rule Explanation Section */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-gray-900">
            <HelpCircle className="w-4.5 h-4.5 text-[#FF6000]" />
            <h3 className="font-extrabold text-[14px]">Mission Bonus Rules & FAQ</h3>
          </div>

          <div className="space-y-2.5 text-[12px] text-gray-600">
            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
              <strong className="text-gray-900 block mb-0.5">What is an Active Referral?</strong>
              A friend who registered using your referral code/link (Level 1 direct referral) AND made their <strong>first eligible plan purchase</strong>.
            </div>

            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
              <strong className="text-gray-900 block mb-0.5">Where does my Mission Bonus go?</strong>
              The bonus is credited straight into your <strong>Withdraw Wallet</strong> and can be withdrawn directly to your linked bank account.
            </div>

            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
              <strong className="text-gray-900 block mb-0.5">Is it separate from Referral Commission?</strong>
              Yes! You receive this extra Mission Bonus in addition to standard L1, L2, and L3 referral commissions.
            </div>

            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
              <strong className="text-gray-900 block mb-0.5">Can I claim a mission more than once?</strong>
              Each mission milestone tier can be claimed once upon reaching the required active referral count.
            </div>
          </div>
        </div>
      </main>

      {/* 3. Celebration Modal Popup */}
      {celebrationData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center relative shadow-2xl border border-orange-100">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FF6000] to-amber-400 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-orange-500/30">
              <Sparkles className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-gray-900">Mission Completed! 🎉</h3>
            <p className="text-xs text-gray-500 mt-1">{celebrationData.missionTitle}</p>

            <div className="my-5 p-4 rounded-2xl bg-orange-50 border border-orange-200 text-[#FF6000]">
              <span className="text-xs font-bold uppercase tracking-wider block">Bonus Credited</span>
              <span className="text-3xl font-black block mt-0.5">+₹{celebrationData.reward}</span>
              <span className="text-[11px] font-semibold text-emerald-700 block mt-1">
                ✓ Deposited to Withdraw Wallet
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCelebrationData(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6000] hover:bg-[#e05500] text-white font-extrabold text-xs shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
              >
                Awesome!
              </button>

              <button
                onClick={() => {
                  setCelebrationData(null);
                  onNavigateTab('withdrawal');
                }}
                className="py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs active:scale-95 transition-all cursor-pointer"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 4. Social Sharing Chooser Modal */}
      <SocialShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        referralCode={userProfile?.referralCode || userProfile?.membershipNumber || '2829906'}
        contextTitle={shareContextTitle}
        onShowToast={onShowToast}
      />
    </div>
  );
};
