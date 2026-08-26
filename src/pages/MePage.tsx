import React, { useState, useEffect } from 'react';
import { ProfileAvatar } from '../components/Artworks';
import { FloatingContact } from '../components/FloatingContact';
import { PlaceholderModal } from '../components/PlaceholderModal';
import { CustomerSupportModal } from '../components/CustomerSupportModal';
import {
  PersonalInfoModal,
  BindBankCardModal,
  InviteFriendsModal,
} from '../components/FunctionModals';
import { ClaimGiftCodeModal } from '../components/ClaimGiftCodeModal';
import { TabType, UserProfile, Wallet, PurchaseItem, UserVipStatus } from '../types';
import { fetchUserVipStatus } from '../services/api';
import {
  ShieldCheck,
  Smartphone,
  FileText,
  CreditCard,
  Gift,
  Zap,
  Receipt,
  Info,
  LogOut,
  Sliders,
  Crown,
  Sparkles,
  ChevronRight,
  Target,
} from 'lucide-react';

interface MePageProps {
  onNavigateTab: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
  userProfile: UserProfile | null;
  wallet: Wallet | null;
  purchases: PurchaseItem[];
  onOpenRecharge: () => void;
  onOpenWithdrawal: () => void;
  onOpenMyDevice?: () => void;
  onOpenAuthModal?: () => void;
  onLogout?: () => void;
  onRefreshData?: () => void;
}

export const MePage: React.FC<MePageProps> = ({
  onNavigateTab,
  onShowToast,
  userProfile,
  wallet,
  purchases,
  onOpenRecharge,
  onOpenWithdrawal,
  onOpenMyDevice,
  onOpenAuthModal,
  onLogout,
  onRefreshData,
}) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: 'Notice',
    message: '',
  });

  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isPersonalInfoOpen, setIsPersonalInfoOpen] = useState(false);
  const [isBankCardOpen, setIsBankCardOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isGiftCodeOpen, setIsGiftCodeOpen] = useState(false);
  const [vipStatus, setVipStatus] = useState<UserVipStatus | null>(null);

  const mobile = userProfile?.mobile || '9876543210';
  const membershipNumber = userProfile?.membershipNumber || 'PB888999';
  const referralCode = userProfile?.referralCode || membershipNumber;
  const deviceEarnings = userProfile?.deviceEarnings || wallet?.totalEarned || 0;
  const teamEarnings = userProfile?.teamEarnings || 0;
  const topupBalance = wallet?.topupBalance ?? wallet?.rechargeBalance ?? 0;
  const withdrawBalance = wallet?.withdrawBalance ?? wallet?.earnedBalance ?? wallet?.availableBalance ?? 0;
  const userId = userProfile?.userId || userProfile?.id || 'usr_demo_01';

  useEffect(() => {
    let isMounted = true;
    fetchUserVipStatus(userId)
      .then((status) => {
        if (isMounted) setVipStatus(status);
      })
      .catch((err) => console.warn('Failed to load VIP status in MePage:', err));
    return () => {
      isMounted = false;
    };
  }, [userId, purchases]);

  const showPlaceholder = (title: string, message: string) => {
    setModalState({
      isOpen: true,
      title,
      message,
    });
  };

  const commonFunctions = [
    {
      id: 'mission_bonus',
      label: 'Mission Bonus',
      icon: Target,
      bgColor: 'bg-[#FFF2E8]',
      iconColor: 'text-[#FF6000]',
      badge: '🎯 Bonus',
      highlightBadge: true,
      onClick: () => onNavigateTab('mission_bonus'),
    },
    {
      id: 'vip_levels',
      label: 'VIP Levels',
      icon: Crown,
      bgColor: 'bg-[#FFF7E6]',
      iconColor: 'text-[#FF6000]',
      badge: vipStatus?.currentLevel.badgeText || 'VIP 0',
      highlightBadge: true,
      onClick: () => onNavigateTab('vip_levels'),
    },
    {
      id: 'personal_info',
      label: 'Personal Information',
      icon: FileText,
      bgColor: 'bg-[#FFEBEB]',
      iconColor: 'text-[#FF4D4D]',
      onClick: () => setIsPersonalInfoOpen(true),
    },
    {
      id: 'bind_bank',
      label: 'Bind Bank Card',
      icon: CreditCard,
      bgColor: 'bg-[#E6F4FF]',
      iconColor: 'text-[#1890FF]',
      onClick: () => onNavigateTab('bank_card'),
    },
    {
      id: 'invite_friends',
      label: 'Invite Friends',
      icon: Gift,
      bgColor: 'bg-[#FFF0F6]',
      iconColor: 'text-[#EB2F96]',
      onClick: () => setIsInviteOpen(true),
    },
    {
      id: 'device_records',
      label: 'My Device Records',
      icon: Zap,
      bgColor: 'bg-[#F9F0FF]',
      iconColor: 'text-[#722ED1]',
      onClick: () => {
        if (onOpenMyDevice) {
          onOpenMyDevice();
        } else {
          onNavigateTab('fortune');
        }
      },
    },
    {
      id: 'transactions',
      label: 'Transaction',
      icon: Receipt,
      bgColor: 'bg-[#FFF7E6]',
      iconColor: 'text-[#FA8C16]',
      onClick: () => onNavigateTab('transactions'),
    },
    {
      id: 'about_us',
      label: 'About Platform',
      icon: Info,
      bgColor: 'bg-[#F0F5FF]',
      iconColor: 'text-[#2F54EB]',
      onClick: () => onNavigateTab('about_platform'),
    },
  ];

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-gray-900 flex flex-col pb-28">
      {/* 1. Orange Profile Header */}
      <div className="w-full bg-gradient-to-b from-[#FF6000] to-[#FF8C00] px-5 pt-8 pb-7 shadow-sm">
        {/* User Info Row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3.5">
            <div
              onClick={() => onNavigateTab('vip_levels')}
              className="cursor-pointer transition-transform active:scale-95"
              title="View VIP Levels"
            >
              <ProfileAvatar
                className="w-15 h-15 shadow-md shrink-0"
                vipBadge={vipStatus?.currentLevel.badgeText || 'VIP 0'}
                showVipBadge={true}
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-white font-extrabold text-[20px] tracking-tight leading-tight">
                  {userProfile?.username || userProfile?.name || mobile}
                </h2>
                <button
                  onClick={() => onNavigateTab('vip_levels')}
                  className="px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white font-extrabold text-[10px] flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-xs"
                >
                  <Crown className="w-3 h-3 text-amber-200" />
                  <span>{vipStatus?.currentLevel.badgeText || 'VIP 0'}</span>
                </button>
              </div>
              <div className="flex items-center gap-2 text-white/85 text-[11px] font-medium mt-0.5">
                <span>+91 {userProfile?.whatsappNo || mobile}</span>
                <span>•</span>
                <span>ID: {membershipNumber}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* 4 Financial Statistics horizontally with dividers */}
        <div className="grid grid-cols-4 text-center border-t border-white/20 pt-4 gap-1">
          {/* Topup Wallet */}
          <div className="flex flex-col items-center">
            <span className="text-white font-extrabold text-[15px] tracking-tight">
              {topupBalance.toFixed(2)}₹
            </span>
            <span className="text-white/75 text-[10px] font-medium mt-0.5 whitespace-nowrap">
              Topup Wallet
            </span>
          </div>

          {/* Withdraw Wallet */}
          <div className="flex flex-col items-center border-l border-white/20">
            <span className="text-white font-extrabold text-[15px] tracking-tight">
              {withdrawBalance.toFixed(2)}₹
            </span>
            <span className="text-white/75 text-[10px] font-medium mt-0.5 whitespace-nowrap">
              Withdraw
            </span>
          </div>

          {/* Device Earnings */}
          <div className="flex flex-col items-center border-l border-white/20">
            <span className="text-white font-extrabold text-[15px] tracking-tight">
              {deviceEarnings.toFixed(2)}₹
            </span>
            <span className="text-white/75 text-[10px] font-medium mt-0.5 whitespace-nowrap">
              Device Earn
            </span>
          </div>

          {/* Team Earnings */}
          <div className="flex flex-col items-center border-l border-white/20">
            <span className="text-white font-extrabold text-[15px] tracking-tight">
              {teamEarnings}₹
            </span>
            <span className="text-white/75 text-[10px] font-medium mt-0.5 whitespace-nowrap">
              Team Earn
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-3.5">
        {/* 2. Me Action Cards: Withdrawal Management & Recharge */}
        <div className="grid grid-cols-2 gap-3">
          {/* Withdrawal Management */}
          <div
            onClick={onOpenWithdrawal}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow active:scale-98"
          >
            <div className="w-9 h-9 rounded-lg bg-orange-100/80 text-[#FF6000] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-gray-800 text-xs">Withdrawal</span>
              <span className="font-bold text-gray-800 text-xs">Management</span>
            </div>
          </div>

          {/* Recharge */}
          <div
            onClick={onOpenRecharge}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow active:scale-98"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-100/80 text-blue-600 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <span className="font-bold text-gray-800 text-xs">Recharge</span>
          </div>
        </div>

        {/* 3. Promotional Banners */}
        <div className="space-y-3">
          {/* 3.1 Invite Friends */}
          <div
            onClick={() => setIsInviteOpen(true)}
            className="relative w-full rounded-xl overflow-hidden p-4 bg-[#FFF4ED] border border-[#FFD9C0] shadow-2xs cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-[#FF6000] font-black italic text-base tracking-tight">
                  INVITE FRIENDS
                </p>
                <p className="text-gray-500 text-[10px] font-medium mt-0.5">
                  Earn more commissions & double equipment benefits
                </p>
              </div>

              {/* Circular GO Button */}
              <div className="w-10 h-10 rounded-full bg-[#FF6000] text-white flex items-center justify-center font-bold text-xs shadow-sm active:scale-95 shrink-0">
                GO
              </div>
            </div>
          </div>

          {/* 3.2 CLAIM GIFT CODE */}
          <div
            id="me-claim-gift-code-card"
            onClick={() => setIsGiftCodeOpen(true)}
            className="relative w-full rounded-xl overflow-hidden p-4 bg-gradient-to-r from-[#FFF8F3] to-[#FFF0E6] border border-[#FFD9C0] shadow-2xs cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-[#FF6000] text-white flex items-center justify-center shadow-xs shrink-0">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[#FF6000] font-black italic text-base tracking-tight flex items-center gap-1.5">
                    CLAIM GIFT CODE
                  </p>
                  <p className="text-gray-500 text-[10px] font-medium mt-0.5">
                    Enter your gift code and claim your reward
                  </p>
                </div>
              </div>

              {/* Pill CLAIM Button */}
              <div className="px-3.5 h-9 rounded-full bg-[#FF6000] hover:bg-[#e05500] text-white flex items-center justify-center font-bold text-xs shadow-sm active:scale-95 shrink-0 tracking-wide">
                CLAIM
              </div>
            </div>
          </div>
        </div>

        {/* 4. Common Functions Section */}
        <div className="pt-2">
          <h3 className="text-gray-800 font-bold text-sm mb-3">
            Common Functions
          </h3>

          <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {commonFunctions.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={item.onClick}
                  className="w-full px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-8 h-8 rounded-full ${item.bgColor} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${item.iconColor}`} />
                    </div>
                    <span className="font-medium text-gray-700 text-[13px]">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(item as any).badge && (
                      <span className="px-2 py-0.5 rounded-full bg-orange-50 text-[#FF6000] border border-orange-200 text-[10px] font-extrabold flex items-center gap-1">
                        <Crown className="w-2.5 h-2.5" />
                        <span>{(item as any).badge}</span>
                      </span>
                    )}
                    <span className="text-gray-400 text-lg leading-none font-light">›</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Contact Button on Light Theme */}
      <FloatingContact
        isDark={false}
        onClick={() => setIsSupportOpen(true)}
      />

      {/* Function Modals */}
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

      {userProfile && (
        <PersonalInfoModal
          isOpen={isPersonalInfoOpen}
          onClose={() => setIsPersonalInfoOpen(false)}
          user={userProfile}
        />
      )}

      <BindBankCardModal
        isOpen={isBankCardOpen}
        onClose={() => setIsBankCardOpen(false)}
        userId={userId}
        onSuccess={() => {
          onShowToast('Bank card bound successfully');
          onRefreshData?.();
        }}
      />

      <InviteFriendsModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        referralCode={referralCode}
        onCopyToast={(msg) => onShowToast(msg)}
      />

      <ClaimGiftCodeModal
        isOpen={isGiftCodeOpen}
        onClose={() => setIsGiftCodeOpen(false)}
        userId={userId}
        onSuccess={(amount, msg) => {
          onShowToast(msg);
          onRefreshData?.();
        }}
      />
    </div>
  );
};
