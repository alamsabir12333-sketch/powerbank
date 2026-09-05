import React, { useState, useEffect } from 'react';
import { FloatingContact } from '../components/FloatingContact';
import { PlaceholderModal } from '../components/PlaceholderModal';
import { CustomerSupportModal } from '../components/CustomerSupportModal';
import { fetchUserTeamSummary } from '../services/api';
import { defaultReferralSettings } from '../data/mockData';
import { TabType, UserTeamSummary, ReferralSettings, UserProfile } from '../types';
import {
  Users,
  Copy,
  Check,
  Share2,
  Send,
  MessageCircle,
  UserCheck,
  Gift,
  Coins,
  History,
  ChevronRight,
  Sparkles,
  Zap,
} from 'lucide-react';

interface TeamPageProps {
  userId?: string;
  userProfile?: UserProfile | null;
  onNavigateTab: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
}

export const TeamPage: React.FC<TeamPageProps> = ({
  userId,
  userProfile,
  onNavigateTab,
  onShowToast,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedTierForModal, setSelectedTierForModal] = useState<1 | 2 | 3 | null>(null);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const activeUserId = userId || userProfile?.userId || userProfile?.id || '';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://gainpower-top-1.com';
  const effectiveRefCode = userProfile?.referralCode || userProfile?.membershipNumber || '';

  // Dynamic team summary state
  const [teamSummary, setTeamSummary] = useState<UserTeamSummary>({
    referralCode: effectiveRefCode,
    referralLink: `${currentOrigin}/invite/${effectiveRefCode}`,
    totalMembers: 0,
    directMembers: 0,
    activeDevices: 0,
    totalCommission: 0,
    level1Commission: 0,
    level2Commission: 0,
    level3Commission: 0,
    subordinates: { 1: [], 2: [], 3: [] },
    rewardHistory: [],
    settings: defaultReferralSettings,
  });

  const getLevelStats = (tier: 1 | 2 | 3) => {
    if (teamSummary.levelPurchases && teamSummary.levelPurchases[tier]) {
      return teamSummary.levelPurchases[tier];
    }
    const list = teamSummary.subordinates[tier] || [];
    const purchaseNumber = list.reduce((sum, m) => sum + (m.devices || 0), 0);
    const purchaseAmount = list.reduce((sum, m) => sum + (m.totalInvested || 0), 0);
    return { purchaseNumber, purchaseAmount };
  };

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: 'Notice',
    message: '',
  });

  const loadTeamData = async () => {
    if (!activeUserId) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchUserTeamSummary(activeUserId);
      setTeamSummary(data);
    } catch (e) {
      console.warn('Error fetching dynamic team summary:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamData();
  }, [activeUserId]);

  const copyCode = () => {
    navigator.clipboard.writeText(teamSummary.referralCode);
    setCopiedCode(true);
    onShowToast('Invitation code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(teamSummary.referralLink);
    setCopiedLink(true);
    onShowToast('Invitation link copied!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Join GAIN POWER investment and earn daily income! Use my invitation code: ${teamSummary.referralCode}\n${teamSummary.referralLink}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    onShowToast('Opening WhatsApp...');
  };

  const handleShareTelegram = () => {
    const text = encodeURIComponent(
      `Join GAIN POWER investment and earn daily income! Use my invitation code: ${teamSummary.referralCode}`
    );
    const url = encodeURIComponent(teamSummary.referralLink);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
    onShowToast('Opening Telegram...');
  };

  const handleShareMore = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join GAIN POWER & Earn Daily',
          text: `Join GAIN POWER investment with my referral code ${teamSummary.referralCode}`,
          url: teamSummary.referralLink,
        });
      } catch {
        copyLink();
      }
    } else {
      copyLink();
    }
  };

  const settings: ReferralSettings = teamSummary.settings || defaultReferralSettings;
  const regReward = settings.registrationReward;
  const streakReward = settings.streakReward;
  const topupTiers = settings.topupTiers || [];
  const exampleAmount = settings.exampleTopupAmount || 100000;

  const renderLevelCard = (tier: 1 | 2 | 3) => {
    const stats = getLevelStats(tier);
    const isL1 = tier === 1;
    const isL2 = tier === 2;

    const styles = isL1
      ? {
          cardBorder: 'border-[#FFA866]/80',
          panelBg: 'bg-[#FF8226]',
          indicatorBg: 'bg-[#FF8226]',
          moreText: 'text-[#FF8226]',
          gradientBg: 'from-orange-50/40 via-white to-white',
        }
      : isL2
      ? {
          cardBorder: 'border-[#8AB9FF]/80',
          panelBg: 'bg-[#4E97FF]',
          indicatorBg: 'bg-[#4E97FF]',
          moreText: 'text-[#4E97FF]',
          gradientBg: 'from-blue-50/40 via-white to-white',
        }
      : {
          cardBorder: 'border-[#AFA8FF]/80',
          panelBg: 'bg-[#7872FF]',
          indicatorBg: 'bg-[#7872FF]',
          moreText: 'text-[#7872FF]',
          gradientBg: 'from-purple-50/40 via-white to-white',
        };

    const formattedAmount =
      stats.purchaseAmount % 1 === 0
        ? stats.purchaseAmount
        : stats.purchaseAmount.toFixed(2);

    return (
      <div
        key={tier}
        className={`w-full ${styles.panelBg} rounded-2xl border ${styles.cardBorder} overflow-hidden flex shadow-xs`}
      >
        {/* LEFT: Solid colored vertical panel with stacked L V 1/2/3 */}
        <div className="w-13 sm:w-15 flex flex-col items-center justify-center text-white shrink-0 py-3 font-black text-sm sm:text-base select-none leading-tight tracking-wider">
          <span>L</span>
          <span className="my-0.5">V</span>
          <span>{tier}</span>
        </div>

        {/* RIGHT: Content Area with rounded-tl-2xl displaying labels, numbers, and More>> */}
        <div
          className={`flex-1 bg-white rounded-tl-2xl px-3.5 sm:px-5 py-3 sm:py-3.5 flex flex-col justify-between bg-gradient-to-br ${styles.gradientBg} min-h-[96px]`}
        >
          {/* Top labels & numbers in 2 columns */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            {/* Purchase Number Column */}
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`w-0.5 sm:w-1 h-3 sm:h-3.5 rounded-full ${styles.indicatorBg} shrink-0`} />
                <span className="text-[11px] sm:text-xs text-gray-500 font-medium whitespace-nowrap">
                  Purchase Number
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight mt-1 pl-2 sm:pl-2.5">
                {stats.purchaseNumber}
              </div>
            </div>

            {/* Purchase Amount Column */}
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`w-0.5 sm:w-1 h-3 sm:h-3.5 rounded-full ${styles.indicatorBg} shrink-0`} />
                <span className="text-[11px] sm:text-xs text-gray-500 font-medium whitespace-nowrap">
                  Purchase Amount ( ₹ )
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight mt-1 pl-2 sm:pl-2.5">
                {formattedAmount}
              </div>
            </div>
          </div>

          {/* Bottom Right: More>> */}
          <div className="flex justify-end -mt-0.5">
            <button
              type="button"
              onClick={() => setSelectedTierForModal(tier)}
              className={`text-xs sm:text-sm font-semibold ${styles.moreText} hover:opacity-80 transition-opacity flex items-center cursor-pointer active:scale-95`}
            >
              More&gt;&gt;
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen bg-[#F8F9FA] text-gray-900 flex flex-col pb-28">
      {/* Top Orange Header */}
      <div className="w-full bg-gradient-to-r from-[#FF6000] via-[#FF7A00] to-[#FFA000] px-5 pt-6 pb-8 shadow-sm">
        <div className="flex items-center gap-2 text-white mb-4">
          <Users className="w-5 h-5" />
          <h1 className="text-lg font-bold">Partner Team & Commission</h1>
        </div>

        {/* Big Team Commission Display */}
        <div className="text-white text-center py-2">
          <span className="text-xs text-white/80 font-medium">Total Team Commission (₹)</span>
          <div className="text-3xl font-black tracking-tight mt-0.5">
            {teamSummary.totalCommission.toFixed(2)}
          </div>
        </div>

        {/* 3 Horizontal sub-stats */}
        <div className="grid grid-cols-3 text-center border-t border-white/20 pt-4 mt-2">
          <div>
            <span className="text-white font-bold text-base">{teamSummary.totalMembers}</span>
            <span className="text-white/80 text-[11px] block mt-0.5">Total Members</span>
          </div>
          <div className="border-x border-white/20 px-1">
            <span className="text-white font-bold text-base">{teamSummary.directMembers}</span>
            <span className="text-white/80 text-[11px] block mt-0.5">Direct Invites</span>
          </div>
          <div>
            <span className="text-white font-bold text-base">{teamSummary.activeDevices}</span>
            <span className="text-white/80 text-[11px] block mt-0.5">Active Devices</span>
          </div>
        </div>
      </div>

      {/* Referral Link & Code Box */}
      <div className="px-4 -mt-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500 font-medium">My Invitation Code</span>
              <div className="text-xl font-black text-[#FF6000] tracking-wider">
                {teamSummary.referralCode}
              </div>
            </div>
            <button
              onClick={copyCode}
              className="px-3.5 py-1.5 rounded-xl bg-orange-50 text-[#FF6000] font-bold text-xs flex items-center gap-1.5 hover:bg-orange-100 transition-colors active:scale-95 cursor-pointer"
            >
              {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500 font-medium block mb-1.5">Invitation Link</span>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200/80">
              <span className="text-xs text-gray-600 font-mono truncate flex-1">
                {teamSummary.referralLink}
              </span>
              <button
                onClick={copyLink}
                className="px-3 py-1 bg-[#FF6000] text-white rounded-lg text-xs font-bold shrink-0 hover:bg-[#E05300] active:scale-95 transition-all cursor-pointer"
              >
                {copiedLink ? 'Copied' : 'Share'}
              </button>
            </div>
          </div>
        </div>

        {/* 3 Direct Share Buttons: WhatsApp, Telegram, More Ways */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* WhatsApp Button */}
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="bg-white p-3.5 rounded-2xl border border-emerald-100 hover:border-emerald-300 shadow-xs flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-[#25D366]/15 text-[#25D366] flex items-center justify-center group-hover:scale-110 transition-transform">
              <MessageCircle className="w-5 h-5 fill-current" />
            </div>
            <span className="text-xs font-bold text-gray-800 block">WhatsApp</span>
            <span className="text-[10px] text-gray-400 font-medium">Direct Share</span>
          </button>

          {/* Telegram Button */}
          <button
            type="button"
            onClick={handleShareTelegram}
            className="bg-white p-3.5 rounded-2xl border border-sky-100 hover:border-sky-300 shadow-xs flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-[#0088cc]/15 text-[#0088cc] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Send className="w-5 h-5 fill-current ml-0.5" />
            </div>
            <span className="text-xs font-bold text-gray-800 block">Telegram</span>
            <span className="text-[10px] text-gray-400 font-medium">Fast Channel</span>
          </button>

          {/* More Ways Button */}
          <button
            type="button"
            onClick={handleShareMore}
            className="bg-white p-3.5 rounded-2xl border border-orange-100 hover:border-orange-300 shadow-xs flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-[#FF6000]/15 text-[#FF6000] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Share2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-gray-800 block">More Way</span>
            <span className="text-[10px] text-gray-400 font-medium">Copy & Other</span>
          </button>
        </div>

        {/* Subordinates / Purchase Cards Section */}
        <div className="pt-1">
          <div className="mb-3">
            <h3 className="font-extrabold text-[16px] text-gray-900 leading-tight">
              Team Member<br />Directory
            </h3>
          </div>

          {loading ? (
            <div className="space-y-3.5">
              {[1, 2, 3].map((k) => (
                <div key={k} className="w-full bg-gray-200/80 rounded-2xl border border-gray-200 overflow-hidden flex animate-pulse min-h-[96px]">
                  <div className="w-13 sm:w-15 bg-gray-300 shrink-0" />
                  <div className="flex-1 bg-white rounded-tl-2xl p-4 flex flex-col justify-between">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="h-3 bg-gray-200 rounded w-24 mb-2" />
                        <div className="h-6 bg-gray-200 rounded w-16" />
                      </div>
                      <div>
                        <div className="h-3 bg-gray-200 rounded w-28 mb-2" />
                        <div className="h-6 bg-gray-200 rounded w-20" />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="h-3 bg-gray-200 rounded w-12" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3.5">
              {([1, 2, 3] as const).map((tier) => renderLevelCard(tier))}
            </div>
          )}
        </div>

        {/* Invitation Process Card (Matching Screenshot 2 in Orange UI) */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-gray-100 space-y-4">
          <h3 className="font-extrabold text-[16px] text-gray-900">
            Invitation process
          </h3>

          {/* Step Graphic Flow */}
          <div className="bg-[#FFF8F3] rounded-2xl p-4 border border-orange-100/70 flex items-center justify-around">
            <div className="flex flex-col items-center text-center max-w-[120px]">
              <div className="w-11 h-11 rounded-full bg-[#FF6000]/15 text-[#FF6000] flex items-center justify-center mb-2 shadow-xs">
                <Share2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-[#FF6000] leading-tight">
                Share Link or Referral Code
              </span>
            </div>

            <div className="text-orange-400 font-bold text-lg flex items-center">
              <span>≫</span>
            </div>

            <div className="flex flex-col items-center text-center max-w-[120px]">
              <div className="w-11 h-11 rounded-full bg-[#FF6000]/15 text-[#FF6000] flex items-center justify-center mb-2 shadow-xs">
                <UserCheck className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-[#FF6000] leading-tight">
                Register via Invitation
              </span>
            </div>
          </div>

          {/* Process Explanations */}
          <div className="space-y-2 text-xs text-gray-600 leading-relaxed pt-1">
            <p>
              <strong className="text-gray-900">1:</strong> Share the above link or referral code with your friends.
            </p>
            <p>
              <strong className="text-gray-900">2:</strong> Friends can sign up and log in through your shared link, or download the app directly and register using your referral code.
            </p>
          </div>
        </div>

        {/* Ways to Earn Card (100% Dynamic from Admin Settings) */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-gray-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-[16px] text-gray-900">
              Ways to Earn
            </h3>
            <span className="text-[10px] bg-orange-100 text-[#FF6000] font-bold px-2 py-0.5 rounded-full">
              Live Rules
            </span>
          </div>

          <div className="space-y-3.5 text-xs text-gray-600 leading-relaxed">
            {/* Rule 1: Registration Reward */}
            {regReward && regReward.enabled && (
              <div className="p-3 bg-orange-50/60 rounded-xl border border-orange-100/60">
                <span className="font-bold text-gray-900">One: </span>
                Earn <strong className="text-[#FF6000]">₹{regReward.rewardAmount}</strong> when your invited friend successfully registers and logs in.
              </div>
            )}

            {/* Rule 2: Consecutive Daily Claim Reward */}
            {streakReward && streakReward.enabled && (
              <div className="p-3 bg-orange-50/60 rounded-xl border border-orange-100/60">
                <span className="font-bold text-gray-900">Two: </span>
                Earn <strong className="text-[#FF6000]">₹{streakReward.rewardAmount}</strong> when your invited friend claims the fund for {streakReward.consecutiveDays} consecutive days.
              </div>
            )}

            {/* Rule 3: Top-up percentage commission */}
            {topupTiers.some((t) => t.enabled) && (
              <div className="space-y-2.5">
                <p className="font-medium text-gray-800">
                  <span className="font-bold text-gray-900">Three: </span>
                  Earn a percentage of the top-up amount when invited users add funds:
                </p>

                <div className="space-y-2 pl-2">
                  {topupTiers.map((tier) => {
                    if (!tier.enabled) return null;
                    const calculatedReward = (exampleAmount * tier.percentage) / 100;
                    let desc = '';
                    if (tier.tier === 1) {
                      desc = `You invite A. If A tops up ₹${exampleAmount.toLocaleString('en-IN')}, you earn ₹${calculatedReward.toLocaleString('en-IN')} (${tier.percentage}%) as a direct referral reward.`;
                    } else if (tier.tier === 2) {
                      desc = `A invites B. If B tops up ₹${exampleAmount.toLocaleString('en-IN')}, you earn ₹${calculatedReward.toLocaleString('en-IN')} (${tier.percentage}%) as a referral reward.`;
                    } else if (tier.tier === 3) {
                      desc = `B invites C. If C tops up ₹${exampleAmount.toLocaleString('en-IN')}, you earn ₹${calculatedReward.toLocaleString('en-IN')} (${tier.percentage}%) as a referral reward.`;
                    } else {
                      desc = `Tier ${tier.tier} members top-up: you earn ${tier.percentage}% as commission.`;
                    }

                    return (
                      <div key={tier.tier} className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-orange-100 text-[#FF6000] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                          {tier.tier}
                        </span>
                        <p className="text-xs text-gray-700">
                          {desc.split(`(${tier.percentage}%)`)[0]}
                          <strong className="text-[#FF6000]">
                            ₹{calculatedReward.toLocaleString('en-IN')} ({tier.percentage}%)
                          </strong>
                          {desc.split(`(${tier.percentage}%)`)[1]}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Member List Modal (Opened by More > button on L1 / L2 / L3 cards) */}
      {selectedTierForModal !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-5">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm text-white ${
                    selectedTierForModal === 1
                      ? 'bg-[#FF6000]'
                      : selectedTierForModal === 2
                      ? 'bg-[#2563EB]'
                      : 'bg-[#9333EA]'
                  }`}
                >
                  L{selectedTierForModal}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900">
                    Level {selectedTierForModal} Member List ({teamSummary.subordinates[selectedTierForModal]?.length || 0})
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {getLevelStats(selectedTierForModal).purchaseNumber} Purchases • ₹{getLevelStats(selectedTierForModal).purchaseAmount.toFixed(2)} Total
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTierForModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Member List Rows */}
            <div className="overflow-y-auto p-4 space-y-2.5 divide-y divide-gray-50 flex-1">
              {(teamSummary.subordinates[selectedTierForModal] || []).length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs font-semibold text-gray-600">No Level {selectedTierForModal} members found</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Share your invitation link to register Level {selectedTierForModal} team members
                  </p>
                </div>
              ) : (
                (teamSummary.subordinates[selectedTierForModal] || []).map((member) => (
                  <div key={member.id || member.userId} className="pt-2.5 first:pt-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          selectedTierForModal === 1
                            ? 'bg-orange-100 text-[#FF6000]'
                            : selectedTierForModal === 2
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-purple-100 text-purple-600'
                        }`}
                      >
                        {member.username ? member.username.slice(0, 2).toUpperCase() : member.mobile.slice(0, 2)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                          <span>{member.username}</span>
                          <span className="text-[10px] text-gray-400 font-mono font-normal">({member.mobile})</span>
                        </h4>
                        <span className="text-[10px] text-gray-400 block mt-0.5">
                          Joined: {member.joined}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-gray-800 block">
                        {member.devices} Device{member.devices !== 1 ? 's' : ''}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          selectedTierForModal === 1
                            ? 'text-[#FF6000]'
                            : selectedTierForModal === 2
                            ? 'text-blue-600'
                            : 'text-purple-600'
                        }`}
                      >
                        Commission: ₹{member.totalCommissionEarned.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Contact Button */}
      <FloatingContact
        isDark={false}
        onClick={() => setIsSupportOpen(true)}
      />

      <PlaceholderModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        message={modalState.message}
      />

      <CustomerSupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />
    </div>
  );
};
