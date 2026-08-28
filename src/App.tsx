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
import { VIPLevelsPage } from './pages/VIPLevelsPage';
import { AboutPlatformPage } from './pages/AboutPlatformPage';
import { MissionBonusPage } from './pages/MissionBonusPage';
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
import { AuthProvider, useAuth } from './context/AuthContext';
import { getAdminSession, logoutAdmin } from './services/api';
import { Zap, RefreshCw, ShieldCheck, Loader2 } from 'lucide-react';

const AdminDashboardPage = React.lazy(() =>
  import('./pages/admin/AdminDashboardPage').then((m) => ({
    default: m.AdminDashboardPage,
  }))
);

function AppContent() {
  const {
    session,
    user,
    profile: userProfile,
    wallet,
    purchases,
    authStatus,
    authLoading,
    isAuthenticated,
    signOut,
    refreshUserData,
  } = useAuth();

  // Active route path tracking
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  });

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

  // Unauthenticated Route / Entry Mode
  const [authMode, setAuthMode] = useState<'register' | 'login'>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const lastAuthAction = sessionStorage.getItem('pb_last_auth_action');
      if (path === '/login' || lastAuthAction === 'logout') {
        return 'login';
      }
    }
    return 'register';
  });

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

  // Helper to guard protected actions for unauthenticated visitors
  const requireAuth = useCallback(
    (onAllowed: () => void, targetMode: 'login' | 'register' = 'login') => {
      if (!isAuthenticated) {
        showToast('Please sign in or create an account to access this feature.', 'info');
        setAuthMode(targetMode);
        if (typeof window !== 'undefined') {
          const targetUrl = targetMode === 'register' ? '/register' : '/login';
          window.history.pushState({}, '', targetUrl);
          setCurrentPath(targetUrl);
        }
        return;
      }
      onAllowed();
    },
    [isAuthenticated]
  );

  // 1. Parse URL for route, referral link, and admin route listener
  useEffect(() => {
    const handleLocationCheck = () => {
      if (typeof window === 'undefined') return;
      const path = window.location.pathname;
      setCurrentPath(path);

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
      const paymentStatus = searchParams.get('status');

      if (paymentStatus === 'success' || path === '/wallet' || path === '/wallet/success') {
        setActiveTab('recharge');
        showToast('Payment successful! Your wallet has been credited.', 'success');
        refreshUserData();
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/');
          setCurrentPath('/');
        }
      }

      // Check for /invite/:referralCode
      if (!refParam && path.includes('/invite/')) {
        const segments = path.split('/invite/');
        if (segments[1]) {
          refParam = segments[1].split('/')[0].split('?')[0].trim();
        }
      }

      // Handle referral links (both /invite/:code and /register?ref=:code)
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
        const savedInvite =
          sessionStorage.getItem('pb_pending_invite_code') || localStorage.getItem('pb_pending_invite_code');
        if (savedInvite) {
          setInviteCode(savedInvite.toUpperCase());
          setIsInviteReadOnly(true);
        }
      } else if (path === '/notifications') {
        setActiveTab('notifications');
      } else if (path === '/vip' || path === '/vip-levels') {
        setActiveTab('vip_levels');
      } else if (path === '/about-platform' || path === '/about') {
        setActiveTab('about_platform');
      } else if (path === '/purchase' || path === '/products') {
        setActiveTab('purchase');
      } else if (path === '/fortune') {
        setActiveTab('fortune');
      } else if (path === '/team') {
        setActiveTab('team');
      } else if (path === '/me' || path === '/profile') {
        setActiveTab('me');
      } else if (path === '/home' || path === '/') {
        setActiveTab('home');
      } else if (path === '/transactions') {
        setActiveTab('transactions');
      } else {
        const savedInvite =
          sessionStorage.getItem('pb_pending_invite_code') || localStorage.getItem('pb_pending_invite_code');
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

  // Sync auth mode based on location or explicit logout
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const lastAuthAction = sessionStorage.getItem('pb_last_auth_action');
      if (isAuthenticated) {
        if (path === '/register' || path === '/login' || path.startsWith('/invite/')) {
          window.history.replaceState({}, '', '/');
          setCurrentPath('/');
        }
      } else {
        if (path === '/login' || lastAuthAction === 'logout') {
          setAuthMode('login');
        } else if (path === '/register' || path.includes('/invite/')) {
          setAuthMode('register');
        }
      }
    }
  }, [authStatus, isAuthenticated]);

  const handleLogout = async () => {
    await signOut();
    setAuthMode('login');
    setCurrentPath('/login');
    showToast('Logged out successfully.', 'info');
  };

  const handleAuthSuccess = (profile: UserProfile, isNewUser?: boolean) => {
    setActiveTab('home');
    setCurrentPath('/');
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
    refreshUserData();
  };

  // Determine whether current route should display AuthPage
  const isAuthRoute =
    currentPath === '/login' ||
    currentPath === '/register' ||
    currentPath.startsWith('/invite/');

  // =========================================================================
  // ADMIN PANEL ROUTE HANDLER (/adminbank)
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
  // =========================================================================
  if (isCheckoutRoute) {
    return (
      <PaymentCheckoutPage
        onNavigateHome={() => {
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/');
            setIsCheckoutRoute(false);
            setCurrentPath('/');
          }
        }}
      />
    );
  }

  // 1. Initial Session Check Loading Screen
  if (authLoading) {
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

  // 2. Explicit Auth Routes: /login, /register, /register?ref=..., /invite/:code
  if (!isAuthenticated && isAuthRoute) {
    return (
      <>
        <AuthPage
          initialMode={authMode}
          initialReferralCode={inviteCode}
          isReferralReadOnly={isInviteReadOnly}
          onAuthSuccess={handleAuthSuccess}
          onShowToast={showToast}
          onModeChange={(mode) => {
            setAuthMode(mode);
            if (typeof window !== 'undefined') {
              const newUrl = mode === 'login' ? '/login' : '/register';
              window.history.replaceState({}, '', newUrl);
              setCurrentPath(newUrl);
            }
          }}
        />
        <Toast message={toastMessage} type={toastType} />
      </>
    );
  }

  // 3. Main Application Flow (Home, Tabs, Modals)
  const activeUserId = userProfile?.userId || userProfile?.id || user?.id || '';
  const isDarkTab = activeTab === 'home';

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex justify-center selection:bg-[#FF6000] selection:text-white">
      {/* Mobile-First Centered Container */}
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
                if (tab === 'home' || tab === 'about_platform') {
                  setActiveTab(tab);
                  window.scrollTo({ top: 0, behavior: 'instant' });
                  return;
                }
                requireAuth(() => {
                  setActiveTab(tab);
                  window.scrollTo({ top: 0, behavior: 'instant' });
                });
              }}
              onShowToast={showToast}
              userProfile={userProfile}
              wallet={wallet}
              purchases={purchases}
              onOpenRecharge={() => {
                requireAuth(() => {
                  setActiveTab('recharge');
                  window.scrollTo({ top: 0, behavior: 'instant' });
                });
              }}
              onOpenMyDevice={() => {
                requireAuth(() => {
                  setIsMyDeviceOpen(true);
                });
              }}
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
              onRefreshData={() => refreshUserData()}
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
                refreshUserData();
              }}
            />
          )}

          {activeTab === 'team' && (
            <TeamPage
              userId={activeUserId}
              userProfile={userProfile}
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
              onRefreshData={() => refreshUserData()}
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
              onRefreshData={() => refreshUserData()}
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
              onRefreshData={() => refreshUserData()}
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
                refreshUserData();
                setActiveTab('bank_card');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'vip_levels' && (
            <VIPLevelsPage
              userId={activeUserId}
              userProfile={userProfile}
              onBack={() => {
                setActiveTab('me');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onNavigateTab={(tab) => {
                setActiveTab(tab as TabType);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onShowToast={showToast}
              onOpenRecharge={() => {
                setActiveTab('recharge');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
            />
          )}

          {activeTab === 'about_platform' && (
            <AboutPlatformPage
              onBack={() => {
                setActiveTab('me');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onNavigateTab={(tab) => {
                setActiveTab(tab as TabType);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'mission_bonus' && (
            <MissionBonusPage
              userId={activeUserId}
              userProfile={userProfile}
              onBack={() => {
                setActiveTab('me');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onNavigateTab={(tab) => {
                setActiveTab(tab as TabType);
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
              onShowToast={showToast}
            />
          )}
        </main>

        {/* Global Bottom Navigation */}
        {activeTab !== 'transactions' &&
          activeTab !== 'notifications' &&
          activeTab !== 'withdrawal' &&
          activeTab !== 'recharge' &&
          activeTab !== 'bank_card' &&
          activeTab !== 'add_bank_card' &&
          activeTab !== 'vip_levels' &&
          activeTab !== 'about_platform' &&
          activeTab !== 'mission_bonus' && (
          <BottomNav
            activeTab={activeTab}
            onTabChange={(tab) => {
              if (tab === 'home' || tab === 'about_platform') {
                setActiveTab(tab);
                window.scrollTo({ top: 0, behavior: 'instant' });
                return;
              }
              requireAuth(() => {
                setActiveTab(tab);
                window.scrollTo({ top: 0, behavior: 'instant' });
              });
            }}
            isDark={isDarkTab}
          />
        )}

        {/* Modal Components */}
        <RechargeModal
          isOpen={isRechargeOpen}
          onClose={() => setIsRechargeOpen(false)}
          userId={activeUserId}
          onSuccess={(msg) => {
            showToast(msg);
            refreshUserData();
          }}
        />

        <WithdrawalModal
          isOpen={isWithdrawalOpen}
          onClose={() => setIsWithdrawalOpen(false)}
          userId={activeUserId}
          wallet={wallet}
          onOpenBindCard={() => setIsBindCardOpen(true)}
          onSuccess={(msg) => {
            showToast(msg);
            refreshUserData();
          }}
        />

        <BindBankCardModal
          isOpen={isBindCardOpen}
          onClose={() => setIsBindCardOpen(false)}
          userId={activeUserId}
          onSuccess={() => {
            showToast('Bank card bound successfully');
            refreshUserData();
          }}
        />

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
            refreshUserData();
          }}
        />

        <Toast message={toastMessage} type={toastType} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
