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
  const [activeTier, setActiveTier] = useState<1 | 2 | 3>(1);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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
      `Join power bank investment and earn daily income! Use my invitation code: ${teamSummary.referralCode}\n${teamSummary.referralLink}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    onShowToast('Opening WhatsApp...');
  };

  const handleShareTelegram = () => {
    const text = encodeURIComponent(
      `Join power bank investment and earn daily income! Use my invitation code: ${teamSummary.referralCode}`
    );
    const url = encodeURIComponent(teamSummary.referralLink);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
    onShowToast('Opening Telegram...');
  };

  const handleShareMore = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join & Earn Daily',
          text: `Join power bank investment with my referral code ${teamSummary.referralCode}`,
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

  const currentTierList = teamSummary.subordinates[activeTier] || [];

  return (
    <div className="w-full min-h-screen bg-[#F8F9FA] text-gray-900 flex flex-col pb-28">
      {/* Top Orange Header */}
      <div className="w-full bg-gradient-to-r from-[#FF6000] via-[#FF7A00] to-[#FFA000] px-5 pt-6 pb-8 shadow-sm">
        <div className="flex items-center justify-between text-white mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <h1 className="text-lg font-bold">Partner Team & Commission</h1>
          </div>
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
          >
            <History className="w-3.5 h-3.5" />
            <span>Reward History</span>
          </button>
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

        {/* Subordinates Section */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-extrabold text-[16px] text-gray-900">
              Team Member Directory
            </h3>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl text-xs">
              {([1, 2, 3] as const).map((tier) => {
                const count = teamSummary.subordinates[tier]?.length || 0;
                return (
                  <button
                    key={tier}
                    onClick={() => setActiveTier(tier)}
                    className={`px-3 py-1 rounded-lg font-medium text-[11px] transition-colors cursor-pointer ${
                      activeTier === tier
                        ? 'bg-white text-[#FF6000] shadow-xs font-bold'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    Level {tier} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xs border border-gray-100 divide-y divide-gray-100 overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((idx) => (
                  <div key={idx} className="flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200" />
                      <div className="space-y-1.5">
                        <div className="h-3.5 bg-gray-200 rounded w-28" />
                        <div className="h-2.5 bg-gray-100 rounded w-20" />
                      </div>
                    </div>
                    <div className="space-y-1.5 text-right">
                      <div className="h-3.5 bg-gray-200 rounded w-16 ml-auto" />
                      <div className="h-2.5 bg-gray-100 rounded w-24 ml-auto" />
                    </div>
                  </div>
                ))}
              </div>
            ) : currentTierList.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500 font-medium">
                  No Level {activeTier} members registered yet.
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Share your invitation link to earn multi-tier rewards!
                </p>
              </div>
            ) : (
              currentTierList.map((member) => (
                <div key={member.id} className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-100 text-[#FF6000] flex items-center justify-center font-bold text-xs">
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
                    <span className="text-[10px] text-[#FF6000] font-semibold">
                      Commission: ₹{member.totalCommissionEarned.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
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

      {/* Reward History Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom-5">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-100 text-[#FF6000] flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900">Referral Reward History</h3>
                  <p className="text-[11px] text-gray-500">Live ledger of referral bonuses</p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-2.5 divide-y divide-gray-50">
              {teamSummary.rewardHistory.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <Gift className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs">No referral rewards credited yet.</p>
                </div>
              ) : (
                teamSummary.rewardHistory.map((item) => (
                  <div key={item.id} className="pt-2.5 first:pt-0 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            item.rewardType === 'REGISTRATION'
                              ? 'bg-blue-100 text-blue-700'
                              : item.rewardType === 'CONSECUTIVE_CLAIM'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {item.rewardType === 'REGISTRATION'
                            ? 'REGISTRATION'
                            : item.rewardType === 'CONSECUTIVE_CLAIM'
                            ? 'STREAK CLAIM'
                            : `TIER ${item.tier || 1} TOP-UP`}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-800">
                          {item.refereeUsername || item.refereeMobile || 'Friend'}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                      <span className="text-[9.5px] text-gray-400 font-mono">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                      </span>
                    </div>
                    <div className="text-right pl-3 shrink-0">
                      <span className="text-sm font-black text-emerald-600">+₹{item.amount.toFixed(2)}</span>
                      <span className="text-[9.5px] text-gray-400 block">Credited</span>
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
