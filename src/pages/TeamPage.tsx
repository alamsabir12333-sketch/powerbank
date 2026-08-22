import React, { useState } from 'react';
import { FloatingContact } from '../components/FloatingContact';
import { PlaceholderModal } from '../components/PlaceholderModal';
import { CustomerSupportModal } from '../components/CustomerSupportModal';
import { teamStatsData } from '../data/mockData';
import { TabType } from '../types';
import {
  Users,
  Copy,
  Check,
  Award,
  UserPlus,
  Share2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface TeamPageProps {
  onNavigateTab: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
}

export const TeamPage: React.FC<TeamPageProps> = ({
  onNavigateTab,
  onShowToast,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTier, setActiveTier] = useState<1 | 2 | 3>(1);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: 'Notice',
    message: '',
  });

  const copyCode = () => {
    navigator.clipboard.writeText(teamStatsData.referralCode);
    setCopiedCode(true);
    onShowToast('Invitation code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(teamStatsData.referralLink);
    setCopiedLink(true);
    onShowToast('Invitation link copied!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Mock subordinate members
  const subordinates = {
    1: [
      { id: 'u1', mobile: '9845******12', joined: '2026-08-16', devices: 1, yield: '150.00₹' },
      { id: 'u2', mobile: '9120******88', joined: '2026-08-15', devices: 2, yield: '280.00₹' },
      { id: 'u3', mobile: '9440******34', joined: '2026-08-12', devices: 0, yield: '0.00₹' },
      { id: 'u4', mobile: '8876******90', joined: '2026-08-11', devices: 1, yield: '120.00₹' },
      { id: 'u5', mobile: '7002******51', joined: '2026-08-10', devices: 0, yield: '0.00₹' },
    ],
    2: [
      { id: 'u6', mobile: '9811******32', joined: '2026-08-14', devices: 1, yield: '75.00₹' },
      { id: 'u7', mobile: '9833******99', joined: '2026-08-13', devices: 1, yield: '60.00₹' },
    ],
    3: [
      { id: 'u8', mobile: '9765******40', joined: '2026-08-14', devices: 0, yield: '0.00₹' },
    ],
  };

  return (
    <div className="w-full min-h-screen bg-[#F8F9FA] text-gray-900 flex flex-col pb-28">
      {/* Top Orange Header */}
      <div className="w-full bg-gradient-to-r from-[#FF6B00] via-[#FF7D00] to-[#FFA000] px-5 pt-6 pb-8 shadow-sm">
        <div className="flex items-center justify-between text-white mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <h1 className="text-lg font-bold">Partner Team & Commission</h1>
          </div>
          <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-semibold">
            3-Tier System
          </span>
        </div>

        {/* Big Team Commission Display */}
        <div className="text-white text-center py-2">
          <span className="text-xs text-white/80 font-medium">Total Team Commission (₹)</span>
          <div className="text-3xl font-black tracking-tight mt-0.5">
            {teamStatsData.totalCommission.toFixed(2)}
          </div>
        </div>

        {/* 3 Horizontal sub-stats */}
        <div className="grid grid-cols-3 text-center border-t border-white/20 pt-4 mt-2">
          <div>
            <span className="text-white font-bold text-base">{teamStatsData.totalMembers}</span>
            <span className="text-white/80 text-[11px] block mt-0.5">Total Members</span>
          </div>
          <div className="border-x border-white/20 px-1">
            <span className="text-white font-bold text-base">{teamStatsData.directMembers}</span>
            <span className="text-white/80 text-[11px] block mt-0.5">Direct Invites</span>
          </div>
          <div>
            <span className="text-white font-bold text-base">{teamStatsData.activeDevices}</span>
            <span className="text-white/80 text-[11px] block mt-0.5">Active Devices</span>
          </div>
        </div>
      </div>

      {/* Referral Link & Code Box */}
      <div className="px-4 -mt-4 space-y-3">
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500 font-medium">My Invitation Code</span>
              <div className="text-xl font-black text-[#FF6200] tracking-wider">
                {teamStatsData.referralCode}
              </div>
            </div>
            <button
              onClick={copyCode}
              className="px-3.5 py-1.5 rounded-xl bg-orange-50 text-[#FF6200] font-bold text-xs flex items-center gap-1.5 hover:bg-orange-100 transition-colors active:scale-95"
            >
              {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500 font-medium block mb-1.5">Invitation Link</span>
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200/80">
              <span className="text-xs text-gray-600 font-mono truncate flex-1">
                {teamStatsData.referralLink}
              </span>
              <button
                onClick={copyLink}
                className="px-3 py-1 bg-[#FF6200] text-white rounded-lg text-xs font-bold shrink-0 hover:bg-[#E65100] active:scale-95 transition-all"
              >
                {copiedLink ? 'Copied' : 'Share'}
              </button>
            </div>
          </div>
        </div>

        {/* Tier Rate Cards */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white p-3 rounded-2xl border border-orange-100 shadow-2xs text-center">
            <span className="text-[11px] text-gray-500 font-medium block">Level 1</span>
            <span className="text-lg font-black text-[#FF6200] block mt-0.5">10%</span>
            <span className="text-[10px] text-gray-400">Direct Share</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-orange-100 shadow-2xs text-center">
            <span className="text-[11px] text-gray-500 font-medium block">Level 2</span>
            <span className="text-lg font-black text-[#FF6200] block mt-0.5">5%</span>
            <span className="text-[10px] text-gray-400">Sub-level</span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-orange-100 shadow-2xs text-center">
            <span className="text-[11px] text-gray-500 font-medium block">Level 3</span>
            <span className="text-lg font-black text-[#FF6200] block mt-0.5">2%</span>
            <span className="text-[10px] text-gray-400">Team Base</span>
          </div>
        </div>

        {/* Subordinates Section */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-extrabold text-[16px] text-gray-900">
              Team Member Directory
            </h3>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl text-xs">
              {([1, 2, 3] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setActiveTier(tier)}
                  className={`px-3 py-1 rounded-lg font-medium text-[11px] transition-colors ${
                    activeTier === tier
                      ? 'bg-white text-[#FF6200] shadow-xs font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Level {tier}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xs border border-gray-100 divide-y divide-gray-100 overflow-hidden">
            {subordinates[activeTier].map((member) => (
              <div key={member.id} className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-[#FF6200] flex items-center justify-center font-bold text-xs">
                    {member.mobile.slice(0, 2)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{member.mobile}</h4>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      Joined: {member.joined}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-gray-800 block">
                    {member.devices} Device{member.devices !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[10px] text-[#FF6200] font-semibold">
                    Commission: {member.yield}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

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
