import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { BannerCarousel } from '../components/BannerCarousel';
import { AnnouncementBar } from '../components/AnnouncementBar';
import { HomeQuickCards } from '../components/HomeQuickCards';
import { DoubleEarningsCard } from '../components/DoubleEarningsCard';
import { PlatformNews } from '../components/PlatformNews';
import { NewsDetailModal } from '../components/NewsDetailModal';
import { FloatingContact } from '../components/FloatingContact';
import { PlaceholderModal } from '../components/PlaceholderModal';
import { CustomerSupportModal } from '../components/CustomerSupportModal';
import { LanguageModal } from '../components/LanguageModal';
import { DoubleHistoryModal } from '../components/DoubleHistoryModal';
import { homeBanners } from '../data/mockData';
import {
  TabType,
  BannerItem,
  UserProfile,
  Wallet,
  PurchaseItem,
  NotificationItem,
  NewsItem,
} from '../types';
import {
  fetchEligibleHomeNotification,
  dismissHomePopup,
  fetchUnreadNotificationCount,
  fetchPlatformNews,
  fetchUserHomeSummary,
} from '../services/api';
import {
  X,
  Megaphone,
  Sparkles,
  Zap,
  ArrowDownCircle,
  ArrowUpCircle,
  Coins,
  ShieldAlert,
  Info,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface HomePageProps {
  onNavigateTab: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
  userProfile: UserProfile | null;
  wallet: Wallet | null;
  purchases: PurchaseItem[];
  onOpenRecharge: () => void;
  onOpenMyDevice?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateTab,
  onShowToast,
  userProfile,
  wallet,
  purchases,
  onOpenRecharge,
  onOpenMyDevice,
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
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isDoubleHistoryOpen, setIsDoubleHistoryOpen] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('English');

  // News State
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);

  // Home Summary State (Real Supabase Financial & Hourly Calculations)
  const [homeSummary, setHomeSummary] = useState<{
    remainingHours: number;
    totalAssets: number;
    todayEarnings: number;
    promotionEarnings: number;
    activePlansCount: number;
  }>({
    remainingHours: 0,
    totalAssets: 0,
    todayEarnings: 0,
    promotionEarnings: 0,
    activePlansCount: 0,
  });

  // Notification state
  const [unreadCount, setUnreadCount] = useState(0);
  const [homePopupNotif, setHomePopupNotif] = useState<NotificationItem | null>(null);

  const userId = userProfile?.userId || userProfile?.id || '';

  // Load Real Platform News from Supabase
  const loadNews = useCallback(async () => {
    try {
      const items = await fetchPlatformNews();
      setNewsList(items);
    } catch (e) {
      console.warn('Error loading platform news:', e);
    }
  }, []);

  // Load Real Financial & Duration Summary from Supabase
  const loadHomeSummary = useCallback(async () => {
    if (!userId) return;
    try {
      const summary = await fetchUserHomeSummary(userId);
      setHomeSummary(summary);
    } catch (e) {
      console.warn('Error loading user home summary:', e);
    }
  }, [userId]);

  // Fetch unread count & eligible home popup
  const refreshNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const [count, eligible] = await Promise.all([
        fetchUnreadNotificationCount(userId),
        fetchEligibleHomeNotification(userId),
      ]);
      setUnreadCount(count);
      setHomePopupNotif(eligible);
    } catch (e) {
      console.warn('Error refreshing home notifications:', e);
    }
  }, [userId]);

  useEffect(() => {
    loadNews();
    if (userId) {
      loadHomeSummary();
      refreshNotifications();

      const interval = setInterval(() => {
        loadHomeSummary();
        refreshNotifications();
      }, 15000); // 15s periodic refresh

      return () => clearInterval(interval);
    }
  }, [loadNews, loadHomeSummary, refreshNotifications, userId, purchases, wallet, userProfile]);

  // Handle Home Popup Dismissal (X button)
  const handleDismissHomePopup = async () => {
    if (!homePopupNotif) return;
    const notifId = homePopupNotif.id;
    // Optimistic UI dismissal
    setHomePopupNotif(null);
    try {
      await dismissHomePopup(notifId, userId);
    } catch (e) {
      console.error('Error dismissing home notification popup:', e);
    }
  };

  const showPlaceholder = (title: string, message: string) => {
    setModalState({
      isOpen: true,
      title,
      message,
    });
  };

  const handleBannerClick = (banner: BannerItem) => {
    if (banner.artworkType === 'commission') {
      onNavigateTab('team');
    } else {
      onNavigateTab('purchase');
    }
  };

  // Undrawn yield across active hardware devices
  const activePurchases = purchases.filter((p) => p.status === 'ACTIVE');
  const undrawnDeviceYield = activePurchases.reduce((acc, p) => acc + Number(p.totalEarned || 0), 0);

  return (
    <div className="w-full min-h-screen bg-[#121212] text-white flex flex-col pb-28">
      {/* 1. Header with Notification Bell */}
      <Header
        isDark={true}
        title="Power Bank"
        unreadCount={unreadCount}
        onOpenNotifications={() => onNavigateTab('notifications')}
        onOpenLanguageModal={() => setIsLanguageOpen(true)}
      />

      {/* 2. Top Promotional Banner Carousel */}
      <BannerCarousel banners={homeBanners} onBannerClick={handleBannerClick} />

      {/* 3. Dark Announcement Bar */}
      <AnnouncementBar
        onClick={() => {
          onNavigateTab('notifications');
        }}
      />

      {/* 4. Quick Cards: My Device (Left) + Recharge & Revenue course (Right) */}
      <HomeQuickCards
        undrawnAmount={undrawnDeviceYield}
        onMyDeviceClick={() => {
          if (onOpenMyDevice) {
            onOpenMyDevice();
          } else if (activePurchases.length === 0) {
            showPlaceholder(
              'My Devices',
              'You currently have 0 active devices. Visit the Purchase Hall to start earning daily yield.'
            );
          } else {
            onNavigateTab('fortune');
          }
        }}
        onRechargeClick={onOpenRecharge}
        onRevenueCourseClick={() =>
          showPlaceholder(
            'Revenue Course',
            'Tutorial: Power Bank sharing revenue is calculated on an hourly basis and settled automatically into your balance.'
          )
        }
      />

      {/* 5. Duration of Power Bank Double Earnings Section (Real Supabase Data) */}
      <DoubleEarningsCard
        remainingHours={homeSummary.remainingHours}
        totalAssets={homeSummary.totalAssets}
        todayEarnings={homeSummary.todayEarnings}
        promotionEarnings={homeSummary.promotionEarnings}
        onDoubleHistoryClick={() => setIsDoubleHistoryOpen(true)}
        onStatClick={() => onNavigateTab('fortune')}
      />

      {/* 6. Platform News Section (Restored & Connected to Supabase) */}
      <PlatformNews
        newsList={newsList}
        onPurchaseClick={() => onNavigateTab('purchase')}
        onNewsClick={(newsItem) => {
          setSelectedNews(newsItem);
          setIsNewsModalOpen(true);
        }}
      />

      {/* Floating Contact Support Button */}
      <FloatingContact isDark={true} onClick={() => setIsSupportOpen(true)} />

      {/* News Detail Modal */}
      <NewsDetailModal
        news={selectedNews}
        isOpen={isNewsModalOpen}
        onClose={() => setIsNewsModalOpen(false)}
      />

      {/* Home Popup Notification Modal / Card (Shows once per user until dismissed) */}
      {homePopupNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-[#1b1b1b] border border-[#FF6000]/40 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Type & Dismiss X */}
            <div className="px-4 py-3 bg-[#222222] border-b border-[#2d2d2d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FF6000] animate-pulse" />
                <span className="text-[11px] font-bold tracking-wider uppercase text-[#FF6000]">
                  {homePopupNotif.type}
                </span>
              </div>
              <button
                onClick={handleDismissHomePopup}
                className="p-1.5 -mr-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 space-y-3">
              {homePopupNotif.imageUrl && (
                <div className="rounded-xl overflow-hidden max-h-36 border border-[#2a2a2a]">
                  <img
                    src={homePopupNotif.imageUrl}
                    alt={homePopupNotif.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div>
                <h3 className="text-base font-bold text-white leading-snug">
                  {homePopupNotif.title}
                </h3>
                <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">
                  {homePopupNotif.description}
                </p>
              </div>
            </div>

            {/* Action & Footer */}
            <div className="p-3.5 bg-[#171717] border-t border-[#252525] flex items-center justify-between gap-2">
              <button
                onClick={handleDismissHomePopup}
                className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                Dismiss
              </button>

              <button
                onClick={() => {
                  const url = homePopupNotif.actionUrl;
                  handleDismissHomePopup();
                  if (url) {
                    if (url.startsWith('/')) {
                      const tab = url.replace('/', '');
                      onNavigateTab(tab as TabType);
                    } else if (url.startsWith('http')) {
                      window.open(url, '_blank');
                    }
                  } else {
                    onNavigateTab('notifications');
                  }
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#FF6000] hover:bg-[#ff7824] rounded-lg shadow-sm flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <span>{homePopupNotif.actionText || 'View Details'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Modals */}
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

      <LanguageModal
        isOpen={isLanguageOpen}
        onClose={() => setIsLanguageOpen(false)}
        currentLang={currentLanguage}
        onSelectLang={(lang) => {
          setCurrentLanguage(lang);
          onShowToast(`Language set to ${lang}`);
        }}
      />

      <DoubleHistoryModal
        isOpen={isDoubleHistoryOpen}
        onClose={() => setIsDoubleHistoryOpen(false)}
        purchases={purchases}
        onNavigatePurchase={() => onNavigateTab('purchase')}
      />
    </div>
  );
};


