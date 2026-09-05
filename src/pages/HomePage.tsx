import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { DoubleHistoryModal } from '../components/DoubleHistoryModal';
import { WebsitePopupModal } from '../components/WebsitePopupModal';
import { HomeSkeleton } from '../components/HomeSkeleton';
import { useAuth } from '../context/AuthContext';
import { homeBanners } from '../data/mockData';
import {
  TabType,
  BannerItem,
  UserProfile,
  Wallet,
  PurchaseItem,
  NotificationItem,
  NewsItem,
  WebsitePopupConfig,
} from '../types';
import {
  fetchEligibleHomeNotification,
  dismissHomePopup,
  fetchUnreadNotificationCount,
  fetchPlatformNews,
  fetchUserHomeSummary,
  fetchActiveBanners,
  fetchWebsitePopup,
  calculateDeviceHourlyStatus,
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
  isRefreshing?: boolean;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigateTab,
  onShowToast,
  userProfile,
  wallet,
  purchases,
  onOpenRecharge,
  onOpenMyDevice,
  isRefreshing = false,
}) => {
  const { authLoading } = useAuth();

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
  const [isDoubleHistoryOpen, setIsDoubleHistoryOpen] = useState(false);

  // Home Loading States
  const [isHomeLoading, setIsHomeLoading] = useState<boolean>(true);
  const [hasTimedOut, setHasTimedOut] = useState<boolean>(false);
  const initialLoadedRef = useRef<boolean>(false);

  // Dynamic Banners
  const [activeBanners, setActiveBanners] = useState<BannerItem[]>(homeBanners);

  // Dynamic Website Popup Modal
  const [websitePopupConfig, setWebsitePopupConfig] = useState<WebsitePopupConfig | null>(null);
  const [isWebsitePopupOpen, setIsWebsitePopupOpen] = useState(false);

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

  // Safety fallback timeout: prevent stuck skeleton if network stalls (4.5s max)
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasTimedOut(true);
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

  // Load Active Banners from Supabase
  const loadBanners = useCallback(async () => {
    try {
      const banners = await fetchActiveBanners();
      if (banners && banners.length > 0) {
        setActiveBanners(banners);
      }
    } catch (e) {
      console.warn('Error loading banners:', e);
    }
  }, []);

  // Load Website Popup
  const loadWebsitePopup = useCallback(async () => {
    try {
      const config = await fetchWebsitePopup();
      if (config && config.isActive) {
        const dismissedSession = sessionStorage.getItem('gp_popup_dismissed');
        if (!dismissedSession) {
          setWebsitePopupConfig(config);
          setIsWebsitePopupOpen(true);
        }
      }
    } catch (e) {
      console.warn('Error loading website popup:', e);
    }
  }, []);

  // Load Real Platform News from Supabase
  const loadNews = useCallback(async () => {
    try {
      const items = await fetchPlatformNews();
      if (items && Array.isArray(items)) {
        setNewsList(items);
      }
    } catch (e) {
      console.warn('Error loading platform news:', e);
    }
  }, []);

  // Load Real Financial & Duration Summary from Supabase
  const loadHomeSummary = useCallback(async (targetUserId?: string) => {
    const id = targetUserId || userId;
    if (!id) return;
    try {
      const summary = await fetchUserHomeSummary(id);
      if (summary) {
        setHomeSummary(summary);
      }
    } catch (e) {
      console.warn('Error loading user home summary:', e);
    }
  }, [userId]);

  // Fetch unread count & eligible home popup
  const refreshNotifications = useCallback(async (targetUserId?: string) => {
    const id = targetUserId || userId;
    if (!id) return;
    try {
      const [count, eligible] = await Promise.all([
        fetchUnreadNotificationCount(id),
        fetchEligibleHomeNotification(id),
      ]);
      setUnreadCount(count);
      setHomePopupNotif(eligible);
    } catch (e) {
      console.warn('Error refreshing home notifications:', e);
    }
  }, [userId]);

  // Comprehensive Home Data Fetcher
  const loadAllHomeData = useCallback(
    async (targetUserId?: string) => {
      try {
        const tasks: Promise<any>[] = [
          loadBanners(),
          loadWebsitePopup(),
          loadNews(),
        ];
        const activeId = targetUserId !== undefined ? targetUserId : userId;
        if (activeId) {
          tasks.push(loadHomeSummary(activeId));
          tasks.push(refreshNotifications(activeId));
        }
        await Promise.allSettled(tasks);
      } catch (err) {
        console.warn('[HOME] Error loading home data:', err);
      } finally {
        setIsHomeLoading(false);
        initialLoadedRef.current = true;
      }
    },
    [loadBanners, loadWebsitePopup, loadNews, loadHomeSummary, refreshNotifications, userId]
  );

  // Initial load gate: triggered when auth status is known
  useEffect(() => {
    if (!authLoading) {
      loadAllHomeData(userId);
    }
  }, [authLoading, userId, loadAllHomeData]);

  // 15s periodic background refresh without re-flashing the skeleton
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      loadHomeSummary(userId);
      refreshNotifications(userId);
    }, 15000);

    return () => clearInterval(interval);
  }, [loadHomeSummary, refreshNotifications, userId]);

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
    const rawLink = banner.linkUrl !== undefined && banner.linkUrl !== null ? banner.linkUrl : banner.targetTab;
    const cleanLink = typeof rawLink === 'string' ? rawLink.trim() : '';
    if (!cleanLink || cleanLink === '#' || cleanLink.toUpperCase() === 'INVEST') {
      // Banner with no valid link: completely non-clickable, no navigation, no route change
      return;
    }

    // External URL: http://, https://, or //
    if (/^(https?:)?\/\//i.test(cleanLink)) {
      window.open(cleanLink, '_blank', 'noopener,noreferrer');
      return;
    }

    // Normalized internal link (e.g. '/purchase' -> 'purchase')
    const cleanPath = cleanLink.startsWith('/') ? cleanLink.slice(1) : cleanLink;
    const [route] = cleanPath.split(/[?#]/);
    const normalized = route.toLowerCase();

    const tabMap: Record<string, TabType> = {
      purchase: 'purchase',
      products: 'purchase',
      plans: 'purchase',
      invest: 'purchase',
      team: 'team',
      referral: 'team',
      referrals: 'team',
      invite: 'team',
      fortune: 'fortune',
      devices: 'fortune',
      mydevice: 'fortune',
      me: 'me',
      profile: 'me',
      wallet: 'me',
      home: 'home',
      notifications: 'notifications',
    };

    if (tabMap[normalized]) {
      onNavigateTab(tabMap[normalized]);
      return;
    }

    if (normalized === 'recharge') {
      if (onOpenRecharge) onOpenRecharge();
      return;
    }

    // Internal path fallback navigation
    if (rawLink.startsWith('/')) {
      window.location.href = rawLink;
      return;
    }

    window.location.href = rawLink;
  };

  // Undrawn claimable yield across active hardware devices strictly calculated on completed hourly cycles
  const activePurchases = purchases.filter((p) => p.status === 'ACTIVE' || (p.status as string) === 'active');
  const undrawnDeviceYield = activePurchases.reduce(
    (acc, p) => acc + calculateDeviceHourlyStatus(p, Date.now()).claimableAmount,
    0
  );

  // Master loading condition: shows skeleton while essential Home data is being fetched
  const showSkeleton = !hasTimedOut && (isHomeLoading || authLoading || isRefreshing);

  return (
    <div className="w-full min-h-screen bg-[#121212] text-white flex flex-col pb-28">
      {/* 1. Header with Notification Bell & Dynamic Brand Logo Skeleton */}
      <Header
        isDark={true}
        title="GAIN POWER"
        unreadCount={unreadCount}
        isLoading={showSkeleton}
        onOpenNotifications={() => onNavigateTab('notifications')}
      />

      {/* Main Home Content: Polished skeleton while loading, real UI once loaded */}
      {showSkeleton ? (
        <HomeSkeleton />
      ) : (
        <div className="w-full flex flex-col transition-opacity duration-200 animate-in fade-in">
          {/* 2. Top Promotional Banner Carousel */}
          <BannerCarousel banners={activeBanners} onBannerClick={handleBannerClick} />

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
                'Tutorial: GAIN POWER sharing revenue is calculated on an hourly basis and settled automatically into your balance.'
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

          {/* 6. Platform News Section (Connected to Supabase) */}
          <PlatformNews
            newsList={newsList}
            onPurchaseClick={() => onNavigateTab('purchase')}
            onNewsClick={(newsItem) => {
              setSelectedNews(newsItem);
              setIsNewsModalOpen(true);
            }}
          />
        </div>
      )}

      {/* Floating Contact Support Button */}
      <FloatingContact isDark={true} onClick={() => setIsSupportOpen(true)} />

      {/* News Detail Modal */}
      <NewsDetailModal
        news={selectedNews}
        isOpen={isNewsModalOpen}
        onClose={() => setIsNewsModalOpen(false)}
      />

      {/* Home Popup Notification Modal / Card (Shows once per user until dismissed, only after loading) */}
      {!showSkeleton && homePopupNotif && (
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

      {/* Website Popup Modal (4 Links + Image, only after loading) */}
      {!showSkeleton && (
        <WebsitePopupModal
          isOpen={isWebsitePopupOpen}
          config={websitePopupConfig}
          onClose={() => {
            setIsWebsitePopupOpen(false);
            sessionStorage.setItem('gp_popup_dismissed', 'true');
          }}
          onNavigateTab={onNavigateTab}
        />
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

      <DoubleHistoryModal
        isOpen={isDoubleHistoryOpen}
        onClose={() => setIsDoubleHistoryOpen(false)}
        purchases={purchases}
        onNavigatePurchase={() => onNavigateTab('purchase')}
      />
    </div>
  );
};


