import React, { useState } from 'react';
import { ProfileAvatar } from '../components/Artworks';
import { FloatingContact } from '../components/FloatingContact';
import { PlaceholderModal } from '../components/PlaceholderModal';
import { CustomerSupportModal } from '../components/CustomerSupportModal';
import {
  PersonalInfoModal,
  BindBankCardModal,
  ResaleModal,
  InviteFriendsModal,
} from '../components/FunctionModals';
import { TabType, UserProfile, Wallet, PurchaseItem } from '../types';
import {
  ShieldCheck,
  Smartphone,
  FileText,
  CreditCard,
  RefreshCw,
  Gift,
  Zap,
  Receipt,
  Info,
  LogOut,
  Sliders,
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
  const [isResaleOpen, setIsResaleOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const showPlaceholder = (title: string, message: string) => {
    setModalState({
      isOpen: true,
      title,
      message,
    });
  };

  const mobile = userProfile?.mobile || '9876543210';
  const membershipNumber = userProfile?.membershipNumber || 'PB888999';
  const referralCode = userProfile?.referralCode || membershipNumber;
  const deviceEarnings = userProfile?.deviceEarnings || wallet?.totalEarned || 0;
  const teamEarnings = userProfile?.teamEarnings || 0;
  const walletBalance = wallet?.availableBalance || 0;
  const userId = userProfile?.userId || userProfile?.id || 'usr_demo_01';

  const commonFunctions = [
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
      onClick: () => setIsBankCardOpen(true),
    },
    {
      id: 'resale',
      label: 'Resale',
      icon: RefreshCw,
      bgColor: 'bg-[#E6FFFB]',
      iconColor: 'text-[#13C2C2]',
      onClick: () => setIsResaleOpen(true),
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
      onClick: () =>
        showPlaceholder(
          'About Power Bank',
          'Power Bank Platform v2.4.0 — Cloud-synchronized sharing economy infrastructure with instant automated earnings settlement.'
        ),
    },
  ];

  return (
    <div className="w-full min-h-screen bg-[#F5F6F8] text-gray-900 flex flex-col pb-28">
      {/* 1. Orange Profile Header */}
      <div className="w-full bg-gradient-to-b from-[#FF6000] to-[#FF8C00] px-5 pt-8 pb-7 shadow-sm">
        {/* User Info Row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3.5">
            <ProfileAvatar className="w-15 h-15 shadow-md shrink-0" />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-white font-extrabold text-[20px] tracking-tight leading-tight">
                  {userProfile?.username || userProfile?.name || mobile}
                </h2>
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
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Financial Statistics horizontally with dividers */}
        <div className="grid grid-cols-3 text-center border-t border-white/20 pt-4">
          {/* Device Earnings */}
          <div className="flex flex-col items-center">
            <span className="text-white font-extrabold text-[17px] tracking-tight">
              {deviceEarnings.toFixed(2)}₹
            </span>
            <span className="text-white/75 text-[10px] font-medium mt-0.5 whitespace-nowrap">
              Device Earn
            </span>
          </div>

          {/* Team Earnings */}
          <div className="flex flex-col items-center border-x border-white/20 px-1">
            <span className="text-white font-extrabold text-[17px] tracking-tight">
              {teamEarnings}₹
            </span>
            <span className="text-white/75 text-[10px] font-medium mt-0.5 whitespace-nowrap">
              Team Earn
            </span>
          </div>

          {/* My Wallet */}
          <div className="flex flex-col items-center">
            <span className="text-white font-extrabold text-[17px] tracking-tight">
              {walletBalance.toFixed(2)}₹
            </span>
            <span className="text-white/75 text-[10px] font-medium mt-0.5 whitespace-nowrap">
              My Wallet
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

        {/* 3. Promotional Banner */}
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
                  <span className="text-gray-400 text-lg leading-none font-light">›</span>
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

      <ResaleModal
        isOpen={isResaleOpen}
        onClose={() => setIsResaleOpen(false)}
      />

      <InviteFriendsModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        referralCode={referralCode}
        onCopyToast={(msg) => onShowToast(msg)}
      />
    </div>
  );
};
