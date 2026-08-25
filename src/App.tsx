import React, { useState, useEffect, useCallback } from 'react';
import { TabType, UserProfile, Wallet, PurchaseItem, AdminSession } from './types';
import { HomePage } from './pages/HomePage';
import { MePage } from './pages/MePage';
import { PurchaseHallPage } from './pages/PurchaseHallPage';
import { FortunePage } from './pages/FortunePage';
import { TeamPage } from './pages/TeamPage';
import { TransactionPage } from './pages/TransactionPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { WithdrawalPage } from './pages/WithdrawalPage';
import { TopUpPage } from './pages/TopUpPage';
import { BankCardPage } from './pages/BankCardPage';
import { AddBankCardPage } from './pages/AddBankCardPage';
import { AuthPage } from './pages/AuthPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { PaymentCheckoutPage } from './pages/PaymentCheckoutPage';
import { BottomNav } from './components/BottomNav';
import { Toast, ToastType } from './components/Toast';
import { AdminErrorBoundary } from './components/AdminErrorBoundary';
import { RechargeModal } from './components/RechargeModal';
import { WithdrawalModal } from './components/WithdrawalModal';
import { BindBankCardModal } from './components/FunctionModals';
import { MyDeviceModal } from './components/MyDeviceModal';
import {
  getCurrentUser,
  fetchUserProfile,
  fetchWallet,
  fetchPurchases,
  settleAndFetchEarnings,
  logoutUser,
  getAdminSession,
  logoutAdmin,
} from './services/api';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Zap, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';

const AdminDashboardPage = React.lazy(() =>
  import('./pages/admin/AdminDashboardPage').then((m) => ({
    default: m.AdminDashboardPage,
  }))
);

export default function App() {
  // Admin Route Isolation
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname === '/adminbank' || window.location.pathname.startsWith('/adminbank');
    }
    return false;
  });
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() => getAdminSession());

  // Public Payment Checkout Route Isolation (/payment/checkout)
  const [isCheckoutRoute, setIsCheckoutRoute] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      return path === '/payment/checkout' || path.startsWith('/payment/checkout');
    }
    return false;
  });

  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<ToastType>('info');

  // Core Global States
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Unauthenticated Route / Entry Mode
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [inviteCode, setInviteCode] = useState<string>('');
  const [isInviteReadOnly, setIsInviteReadOnly] = useState<boolean>(false);

  // Modals
  const [isRechargeOpen, setIsRechargeOpen] = useState(false);
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false);
  const [isMyDeviceOpen, setIsMyDeviceOpen] = useState(false);
  const [isBindCardOpen, setIsBindCardOpen] = useState(false);

  const showToast = (msg: string, type: ToastType = 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // 1. Parse URL for route, referral link, and admin route listener
  useEffect(() => {
    const handleLocationCheck = () => {
      if (typeof window === 'undefined') return;
      const path = window.location.pathname;
      if (path === '/adminbank' || path.startsWith('/adminbank')) {
        setIsAdminRoute(true);
        setIsCheckoutRoute(false);
        setAdminSession(getAdminSession());
        return;
      }
      setIsAdminRoute(false);

      if (path === '/payment/checkout' || path.startsWith('/payment/checkout')) {
        setIsCheckoutRoute(true);
        return;
      }
      setIsCheckoutRoute(false);

      const searchParams = new URLSearchParams(window.location.search);
      let refParam = searchParams.get('ref') || searchParams.get('code') || '';

      if (!refParam && path.includes('/invite/')) {
        const segments = path.split('/invite/');
        if (segments[1]) {
          refParam = segments[1].split('/')[0].split('?')[0].trim();
        }
      }

      if (refParam) {
        const cleanRef = refParam.toUpperCase();
        setInviteCode(cleanRef);
        setIsInviteReadOnly(true);
        setAuthMode('register');
        sessionStorage.setItem('pb_pending_invite_code', cleanRef);
        localStorage.setItem('pb_pending_invite_code', cleanRef);
      } else if (path === '/login') {
        setAuthMode('login');
      } else if (path === '/register') {
        setAuthMode('register');
      } else if (path === '/notifications') {
        setActiveTab('notifications');
      } else {
        const savedInvite = sessionStorage.getItem('pb_pending_invite_code') || localStorage.getItem('pb_pending_invite_code');
        if (savedInvite) {
          setInviteCode(savedInvite.toUpperCase());
          setIsInviteReadOnly(true);
        }
      }
    };

    handleLocationCheck();
    window.addEventListener('popstate', handleLocationCheck);
    return () => window.removeEventListener('popstate', handleLocationCheck);
  }, []);

  // 2. Load User Data and Validate Session
  const loadUserData = useCallback(async (forcedUserId?: string) => {
    try {
      const user = await getCurrentUser();
      const currentId = forcedUserId || user?.id;

      if (!currentId) {
        setIsAuthenticated(false);
        setUserProfile(null);
        setWallet(null);
        setPurchases([]);
        setIsAuthChecking(false);
        return;
      }

      // Settle hourly device yields
      await settleAndFetchEarnings(currentId);

      const [profile, wal, purchs] = await Promise.all([
        fetchUserProfile(currentId),
        fetchWallet(currentId),
        fetchPurchases(currentId),
      ]);

      setUserProfile(profile);
      setWallet(wal);
      setPurchases(purchs);
      setIsAuthenticated(true);
    } catch (err) {
      console.error('Error loading app data:', err);
      setIsAuthenticated(false);
    } finally {
      setIsAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    loadUserData();

    // Supabase auth state change listener
    if (isSupabaseConfigured && supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          loadUserData(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setIsAuthenticated(false);
          setUserProfile(null);
          loadUserData();
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, [loadUserData]);

  // Periodic earnings settlement (every 30 seconds for active session)
  useEffect(() => {
    if (!isAuthenticated || !userProfile?.userId) return;

    const interval = setInterval(() => {
      const currentId = userProfile.userId || userProfile.id;
      settleAndFetchEarnings(currentId).then(() => {
        fetchWallet(currentId).then(setWallet);
        fetchPurchases(currentId).then(setPurchases);
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, userProfile?.userId, userProfile?.id]);

  const handleLogout = async () => {
    await logoutUser();
    setIsAuthenticated(false);
    setUserProfile(null);
    setWallet(null);
    setPurchases([]);
    setAuthMode('login');
    showToast('Logged out successfully.');
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/login');
    }
  };

  const handleAuthSuccess = (profile: UserProfile, isNewUser?: boolean) => {
    setUserProfile(profile);
    setIsAuthenticated(true);
    setActiveTab('home');
    loadUserData(profile.userId || profile.id);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
  };

  // =========================================================================
  // ADMIN PANEL ROUTE HANDLER (/adminbank)
  // Dedicated, isolated, password-protected admin access
  // =========================================================================
  if (isAdminRoute) {
    if (adminSession) {
      if (adminSession.role !== 'admin') {
        showToast('You are not authorized to access the Admin Panel.', 'error');
        setAdminSession(null);
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/adminbank');
        }
      } else {
        return (
          <AdminErrorBoundary onReset={() => setAdminSession(getAdminSession())}>
            <React.Suspense
              fallback={
                <div className="min-h-screen w-full bg-[#0d1117] text-white flex flex-col justify-center items-center p-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FF6000] to-amber-500 flex items-center justify-center shadow-lg shadow-orange-950/40 mb-4 animate-pulse">
                    <ShieldCheck className="w-9 h-9 text-white" />
                  </div>
                  <h1 className="text-xl font-bold text-white">Power Bank Admin</h1>
                  <p className="text-gray-400 text-xs mt-1.5 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF6000]" />
                    <span>Loading Control Terminal...</span>
                  </p>
                </div>
              }
            >
              <AdminDashboardPage
                session={adminSession}
                onLogout={async () => {
                  await logoutAdmin();
                  setAdminSession(null);
                  showToast('Logged out of Admin Terminal.', 'info');
                  if (typeof window !== 'undefined') {
                    window.history.replaceState({}, '', '/adminbank');
                  }
                }}
              />
            </React.Suspense>
            <Toast message={toastMessage} type={toastType} />
          </AdminErrorBoundary>
        );
      }
    }

    return (
      <AdminErrorBoundary>
        <AdminLoginPage
          onLoginSuccess={(session) => {
            setAdminSession(session);
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, '', '/adminbank/dashboard');
            }
          }}
          onShowToast={showToast}
        />
        <Toast message={toastMessage} type={toastType} />
      </AdminErrorBoundary>
    );
  }

  // =========================================================================
  // PUBLIC PAYMENT CHECKOUT ROUTE HANDLER (/payment/checkout)
  // Publicly accessible payment gateway checkout:
  // - Bypasses global visitor login/register guard
  // - Does NOT require Supabase authenticated session
  // - Safely reads URL parameters and verifies server-side
  // =========================================================================
  if (isCheckoutRoute) {
    return (
      <PaymentCheckoutPage
        onNavigateHome={() => {
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/');
            setIsCheckoutRoute(false);
          }
        }}
      />
    );
  }

  // 1. While initial session is resolving, show sleek splash screen to avoid UI flashes
  if (isAuthChecking) {
    return (
      <div className="w-full min-h-screen bg-[#121212] flex flex-col items-center justify-center text-white space-y-4 p-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FF6000] to-[#FFA000] flex items-center justify-center shadow-lg shadow-orange-500/30 animate-pulse">
          <Zap className="w-9 h-9 fill-current" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-xl font-black tracking-tight">Power Bank</h2>
          <p className="text-xs text-gray-400 font-medium flex items-center justify-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#FF6200]" />
            <span>Connecting to secure network...</span>
          </p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated User Flow: FIRST SHOW REGISTER PAGE (or Login if selected)
  if (!isAuthenticated) {
    return (
      <>
        <AuthPage
          initialMode={authMode}
          initialReferralCode={inviteCode}
          isReferralReadOnly={isInviteReadOnly}
          onAuthSuccess={handleAuthSuccess}
          onShowToast={showToast}
          onModeChange={(mode) => setAuthMode(mode)}
        />
        <Toast message={toastMessage} />
      </>
    );
  }

  // 3. Authenticated User Flow: Main Application Container
  const activeUserId = userProfile?.userId || userProfile?.id || 'usr_demo_01';
  const isDarkTab = activeTab === 'home';

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex justify-center selection:bg-[#FF6000] selection:text-white">
      {/* Mobile-First Centered Container (Max 440px wide on desktop to preserve mobile screen ratios) */}
      <div
        className={`w-full max-w-[440px] min-h-screen flex flex-col relative shadow-[0_0_50px_rgba(0,0,0,0.8)] transition-colors duration-200 ${
          isDarkTab ? 'bg-[#121212]' : 'bg-[#F8F9FA]'
        }`}
      >
        {/* Active Page Content */}
        <main className="flex-1 w-full overflow-x-hidden">
          {activeTab === 'home' && (
            <HomePage
              onNavigateTab={(tab) => {
                setActiveTab(tab);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onShowToast={showToast}
              userProfile={userProfile}
              wallet={wallet}
              purchases={purchases}
              onOpenRecharge={() => {
                setActiveTab('recharge');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onOpenMyDevice={() => setIsMyDeviceOpen(true)}
            />
          )}

          {activeTab === 'fortune' && (
            <FortunePage
              onNavigateTab={(tab) => {
                setActiveTab(tab);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onShowToast={showToast}
              userProfile={userProfile}
              wallet={wallet}
              purchases={purchases}
              onOpenRecharge={() => {
                setActiveTab('recharge');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onOpenWithdrawal={() => {
                setActiveTab('withdrawal');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onRefreshData={() => loadUserData()}
            />
          )}

          {activeTab === 'purchase' && (
            <PurchaseHallPage
              onNavigateTab={(tab) => {
                setActiveTab(tab);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onShowToast={showToast}
              userId={activeUserId}
              wallet={wallet}
              onOpenRecharge={() => {
                setActiveTab('recharge');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onPurchaseSuccess={() => {
                loadUserData();
              }}
            />
          )}

          {activeTab === 'team' && (
            <TeamPage
              onNavigateTab={(tab) => {
                setActiveTab(tab);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'me' && (
            <MePage
              onNavigateTab={(tab) => {
                setActiveTab(tab);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onShowToast={showToast}
              userProfile={userProfile}
              wallet={wallet}
              purchases={purchases}
              onOpenRecharge={() => {
                setActiveTab('recharge');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onOpenWithdrawal={() => {
                setActiveTab('withdrawal');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onOpenMyDevice={() => setIsMyDeviceOpen(true)}
              onLogout={handleLogout}
              onRefreshData={() => loadUserData()}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionPage
              onNavigateTab={(tab) => {
                setActiveTab(tab);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onShowToast={showToast}
              userId={activeUserId}
              wallet={wallet}
              userProfile={userProfile}
              onOpenRecharge={() => setIsRechargeOpen(true)}
              onOpenWithdrawal={() => {
                setActiveTab('withdrawal');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsPage
              userId={activeUserId}
              onBack={() => {
                setActiveTab('home');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onNavigate={(tab) => {
                setActiveTab(tab as TabType);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
            />
          )}

          {activeTab === 'withdrawal' && (
            <WithdrawalPage
              userId={activeUserId}
              wallet={wallet}
              onBack={() => {
                setActiveTab('me');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onNavigateTab={(tab) => {
                setActiveTab(tab as TabType);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onShowToast={showToast}
              onOpenBindCard={() => {
                setActiveTab('bank_card');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onRefreshData={() => loadUserData()}
            />
          )}

          {activeTab === 'recharge' && (
            <TopUpPage
              userId={activeUserId}
              wallet={wallet}
              onBack={() => {
                setActiveTab('home');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onNavigateTab={(tab) => {
                setActiveTab(tab as TabType);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onShowToast={showToast}
              onRefreshData={() => loadUserData()}
            />
          )}

          {activeTab === 'bank_card' && (
            <BankCardPage
              userId={activeUserId}
              onBack={() => {
                setActiveTab('me');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onNavigateTab={(tab) => {
                setActiveTab(tab as TabType);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onOpenAddCard={() => {
                setActiveTab('add_bank_card');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
            />
          )}

          {activeTab === 'add_bank_card' && (
            <AddBankCardPage
              userId={activeUserId}
              onBack={() => {
                setActiveTab('bank_card');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onSuccess={() => {
                loadUserData();
                setActiveTab('bank_card');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onShowToast={showToast}
            />
          )}
        </main>

        {/* Global Bottom Navigation (Visible on main tabs) */}
        {activeTab !== 'transactions' &&
          activeTab !== 'notifications' &&
          activeTab !== 'withdrawal' &&
          activeTab !== 'recharge' &&
          activeTab !== 'bank_card' &&
          activeTab !== 'add_bank_card' && (
          <BottomNav
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'instant' });
            }}
            isDark={isDarkTab}
          />
        )}

        {/* ========================================================================= */}
        {/* REAL BACKEND MODALS */}
        {/* ========================================================================= */}

        {/* 1. Manual UPI Recharge Modal */}
        <RechargeModal
          isOpen={isRechargeOpen}
          onClose={() => setIsRechargeOpen(false)}
          userId={activeUserId}
          onSuccess={(msg) => {
            showToast(msg);
            loadUserData();
          }}
        />

        {/* 2. Real Withdrawal Modal */}
        <WithdrawalModal
          isOpen={isWithdrawalOpen}
          onClose={() => setIsWithdrawalOpen(false)}
          userId={activeUserId}
          wallet={wallet}
          onOpenBindCard={() => setIsBindCardOpen(true)}
          onSuccess={(msg) => {
            showToast(msg);
            loadUserData();
          }}
        />

        {/* 3. Bind Bank Card Modal */}
        <BindBankCardModal
          isOpen={isBindCardOpen}
          onClose={() => setIsBindCardOpen(false)}
          userId={activeUserId}
          onSuccess={() => {
            showToast('Bank card bound successfully');
            loadUserData();
          }}
        />

        {/* 4. My Devices Modal */}
        <MyDeviceModal
          isOpen={isMyDeviceOpen}
          onClose={() => setIsMyDeviceOpen(false)}
          userId={activeUserId}
          purchases={purchases}
          onNavigateTab={(tab) => {
            setIsMyDeviceOpen(false);
            setActiveTab(tab);
          }}
          onShowToast={showToast}
          onClaimSuccess={() => {
            loadUserData();
          }}
        />

        {/* Global Feedback Toast */}
        <Toast message={toastMessage} type={toastType} />
      </div>
    </div>
  );
}
