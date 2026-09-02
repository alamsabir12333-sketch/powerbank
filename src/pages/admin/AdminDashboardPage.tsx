import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  ShoppingBasket,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Zap,
  Gift,
  Newspaper,
  Sliders,
  ShieldCheck,
  LogOut,
  Bell,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Cpu,
  Sparkles,
  Crown,
  Info,
  Target,
} from 'lucide-react';
import { AdminSession, AdminDashboardStats, AuditLogEntry } from '../../types';
import { fetchAdminDashboardStats, fetchAdminAuditLogs, logoutAdmin } from '../../services/api';
import { Toast, ToastType } from '../../components/Toast';
import { AdminErrorBoundary } from '../../components/AdminErrorBoundary';
import { AdminDashboardTab } from './AdminDashboardTab';
import { AdminUsersTab } from './AdminUsersTab';
import { AdminPlansTab } from './AdminPlansTab';
import { AdminRechargeTab } from './AdminRechargeTab';
import { AdminWithdrawalsTab } from './AdminWithdrawalsTab';
import { AdminTransactionsTab } from './AdminTransactionsTab';
import { AdminEarningsTab } from './AdminEarningsTab';
import { AdminReferralsTab } from './AdminReferralsTab';
import { AdminMissionsTab } from './AdminMissionsTab';
import { AdminBannersNewsTab } from './AdminBannersNewsTab';
import { AdminSettingsTab } from './AdminSettingsTab';
import { AdminNotificationsTab } from './AdminNotificationsTab';
import { AdminAuditTab } from './AdminAuditTab';
import { AdminGiftCodesTab } from './AdminGiftCodesTab';
import { AdminVipLevelsTab } from './AdminVipLevelsTab';
import { AdminAboutPlatformTab } from './AdminAboutPlatformTab';
import { AdminComplaintsTab } from './AdminComplaintsTab';
import AdminUsdtDepositsTab from './AdminUsdtDepositsTab';
import { AlertCircle, Coins } from 'lucide-react';

interface AdminDashboardPageProps {
  session: AdminSession;
  onLogout: () => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  session,
  onLogout,
}) => {
  // Parse sub-route from URL pathname
  const getInitialTabFromPath = (): string => {
    if (typeof window === 'undefined') return 'DASHBOARD';
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/adminbank/users')) return 'USERS';
    if (path.includes('/adminbank/plans')) return 'PLANS';
    if (path.includes('/adminbank/vip-levels') || path.includes('/adminbank/vip')) return 'VIP_LEVELS';
    if (path.includes('/adminbank/complaints') || path.includes('/adminbank/deposit-problems') || path.includes('/adminbank/deposit-complaints')) return 'COMPLAINTS';
    if (path.includes('/adminbank/usdt') || path.includes('/adminbank/usdt-deposits')) return 'USDT_DEPOSITS';
    if (path.includes('/adminbank/recharge')) return 'RECHARGE';
    if (path.includes('/adminbank/withdrawals')) return 'WITHDRAWALS';
    if (path.includes('/adminbank/transactions')) return 'TRANSACTIONS';
    if (path.includes('/adminbank/earnings')) return 'EARNINGS';
    if (path.includes('/adminbank/referrals')) return 'REFERRALS';
    if (path.includes('/adminbank/missions') || path.includes('/adminbank/mission')) return 'MISSIONS';
    if (path.includes('/adminbank/gift-codes') || path.includes('/adminbank/giftcodes')) return 'GIFT_CODES';
    if (path.includes('/adminbank/notifications')) return 'NOTIFICATIONS';
    if (path.includes('/adminbank/platform-news') || path.includes('/adminbank/banners')) return 'BANNERS_NEWS';
    if (path.includes('/adminbank/about-platform') || path.includes('/adminbank/about') || path.includes('/adminbank/platform-rules')) return 'ABOUT_PLATFORM';
    if (path.includes('/adminbank/settings')) return 'SETTINGS';
    if (path.includes('/adminbank/audit')) return 'AUDIT';
    return 'DASHBOARD';
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTabFromPath);
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<ToastType>('info');

  const adminIdentifier = session.adminId || (session as any).userId || 'adm_root_700';

  const showToast = (msg: string, type: ToastType = 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleTabChange = (tabId: string) => {
    const normalized = tabId.toUpperCase();
    setActiveTab(normalized);
    setSidebarOpen(false);

    // Sync browser URL cleanly
    if (typeof window !== 'undefined') {
      const tabPathMap: Record<string, string> = {
        DASHBOARD: '/adminbank/dashboard',
        USERS: '/adminbank/users',
        PLANS: '/adminbank/plans',
        VIP_LEVELS: '/adminbank/vip-levels',
        COMPLAINTS: '/adminbank/complaints',
        USDT_DEPOSITS: '/adminbank/usdt-deposits',
        RECHARGE: '/adminbank/recharge',
        WITHDRAWALS: '/adminbank/withdrawals',
        TRANSACTIONS: '/adminbank/transactions',
        EARNINGS: '/adminbank/earnings',
        REFERRALS: '/adminbank/referrals',
        MISSIONS: '/adminbank/missions',
        GIFT_CODES: '/adminbank/gift-codes',
        NOTIFICATIONS: '/adminbank/notifications',
        BANNERS_NEWS: '/adminbank/platform-news',
        ABOUT_PLATFORM: '/adminbank/about-platform',
        SETTINGS: '/adminbank/settings',
        AUDIT: '/adminbank/audit',
      };
      const newPath = tabPathMap[normalized] || '/adminbank/dashboard';
      window.history.replaceState({}, '', newPath);
    }
  };

  const loadGlobalStats = async () => {
    setStatsLoading(true);
    try {
      const [statsData, logsData] = await Promise.all([
        fetchAdminDashboardStats(),
        fetchAdminAuditLogs(),
      ]);
      setStats(statsData);
      setAuditLogs(logsData || []);
    } catch (e: any) {
      console.error('Failed to load global stats:', e);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadGlobalStats();
    // Auto-refresh stats every 60 seconds
    const interval = setInterval(loadGlobalStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogoutClick = () => {
    if (window.confirm('Are you sure you want to sign out of the Admin Console?')) {
      logoutAdmin();
      onLogout();
    }
  };

  const navItems = [
    { id: 'DASHBOARD', label: 'Dashboard Overview', icon: LayoutDashboard, badge: null },
    { id: 'USERS', label: 'User Directory & Portfolios', icon: Users, badge: stats?.totalUsers },
    { id: 'PLANS', label: 'Investment Plans & Hardware', icon: ShoppingBasket, badge: null },
    { id: 'VIP_LEVELS', label: 'VIP Membership Levels', icon: Crown, badge: null },
    {
      id: 'COMPLAINTS',
      label: 'Deposit Problems',
      icon: AlertCircle,
      badge: stats?.pendingComplaintsCount ? `${stats.pendingComplaintsCount}` : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'USDT_DEPOSITS',
      label: 'USDT Deposits',
      icon: Coins,
      badge: null,
    },
    {
      id: 'RECHARGE',
      label: 'Recharge Verifications',
      icon: ArrowDownLeft,
      badge: stats?.pendingRechargesCount ? `${stats.pendingRechargesCount}` : null,
      badgeColor: 'bg-emerald-500 text-black',
    },
    {
      id: 'WITHDRAWALS',
      label: 'Withdrawal Queue',
      icon: ArrowUpRight,
      badge: stats?.pendingWithdrawalsCount ? `${stats.pendingWithdrawalsCount}` : null,
      badgeColor: 'bg-purple-500 text-white',
    },
    { id: 'TRANSACTIONS', label: 'Financial Ledger', icon: CreditCard, badge: null },
    { id: 'EARNINGS', label: 'Device Yields & Claims', icon: Zap, badge: null },
    { id: 'REFERRALS', label: 'Referrals & Affiliates', icon: Gift, badge: null },
    { id: 'MISSIONS', label: 'Mission Bonus Manager', icon: Target, badge: null },
    { id: 'GIFT_CODES', label: 'Gift Code Vouchers', icon: Sparkles, badge: null },
    { id: 'NOTIFICATIONS', label: 'Broadcast Notifications', icon: Bell, badge: null },
    { id: 'BANNERS_NEWS', label: 'Banners & Announcements', icon: Newspaper, badge: null },
    { id: 'ABOUT_PLATFORM', label: 'About Platform & Rules', icon: Info, badge: null },
    { id: 'SETTINGS', label: 'System Configuration', icon: Sliders, badge: null },
    { id: 'AUDIT', label: 'Security Audit Trail', icon: ShieldCheck, badge: null },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-200 flex flex-col font-sans selection:bg-[#FF6000] selection:text-white">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-[#161b22] border border-[#FF6000]/60 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="w-2 h-2 rounded-full bg-[#FF6000] animate-ping" />
          <span className="text-xs font-semibold">{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-gray-400 hover:text-white text-xs">
            &times;
          </button>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-gray-800 bg-[#161b22]/90 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-xl bg-gray-800 text-gray-300 hover:text-white"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF6000] to-amber-500 flex items-center justify-center shadow-md shadow-orange-950/30">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white tracking-wide">GAIN POWER</span>
                <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-800/40">
                  ADMIN CONSOLE
                </span>
              </div>
              <p className="text-[10.5px] text-gray-400 hidden sm:block">
                Bank-Grade Administrative Control Center
              </p>
            </div>
          </div>
        </div>

        {/* Right tools */}
        <div className="flex items-center gap-3">
          {/* Quick status pill */}
          <div className="hidden sm:flex items-center gap-2 bg-[#0d1117] border border-gray-800 rounded-full px-3 py-1 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-gray-300 text-[11px]">System Online</span>
          </div>

          <button
            onClick={loadGlobalStats}
            title="Refresh All Real-time Aggregates"
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Admin Profile & Logout */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-gray-800">
            <div className="text-right hidden md:block">
              <div className="text-xs font-bold text-white leading-tight">{session.username}</div>
              <div className="text-[10px] text-gray-500 uppercase font-semibold">{session.role}</div>
            </div>

            <button
              onClick={handleLogoutClick}
              title="Sign Out of Admin Console"
              className="px-3 py-1.5 rounded-xl bg-red-950/40 border border-red-800/50 hover:bg-red-900/50 text-red-400 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 bg-[#161b22] border-r border-gray-800 pt-16 lg:pt-0 lg:static lg:block transform transition-transform duration-200 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="h-full flex flex-col justify-between p-3 overflow-y-auto">
            <div className="space-y-1">
              <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Platform Operations
              </div>

              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#FF6000] text-white shadow-lg shadow-orange-950/50'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge !== null && item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-white text-black'
                            : item.badgeColor || 'bg-gray-800 text-gray-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Admin Footer Info */}
            <div className="pt-4 mt-4 border-t border-gray-800/80 px-3 text-[11px] text-gray-500">
              <div className="flex items-center justify-between">
                <span>Session:</span>
                <span className="font-mono text-gray-400">Authenticated (Admin)</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span>Access URL:</span>
                <span className="font-mono text-emerald-400">/adminbank</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
          />
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'DASHBOARD' && (
            <AdminDashboardTab
              stats={stats}
              auditLogs={auditLogs}
              loading={statsLoading}
              onRefresh={loadGlobalStats}
              onNavigateTab={(tab) => handleTabChange(tab)}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'USERS' && (
            <AdminUsersTab
              adminId={adminIdentifier}
              onShowToast={showToast}
              onRefreshGlobalStats={loadGlobalStats}
            />
          )}

          {activeTab === 'PLANS' && (
            <AdminPlansTab
              adminId={adminIdentifier}
              onShowToast={showToast}
              onRefreshGlobalStats={loadGlobalStats}
            />
          )}

          {activeTab === 'VIP_LEVELS' && (
            <AdminVipLevelsTab
              adminId={adminIdentifier}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'COMPLAINTS' && (
            <AdminComplaintsTab
              adminId={adminIdentifier}
              onShowToast={showToast}
              onRefreshGlobalStats={loadGlobalStats}
            />
          )}

          {activeTab === 'USDT_DEPOSITS' && (
            <AdminUsdtDepositsTab onShowToast={showToast} />
          )}

          {activeTab === 'RECHARGE' && (
            <AdminRechargeTab
              adminId={adminIdentifier}
              onShowToast={showToast}
              onRefreshGlobalStats={loadGlobalStats}
            />
          )}

          {activeTab === 'WITHDRAWALS' && (
            <AdminWithdrawalsTab
              adminId={adminIdentifier}
              onShowToast={showToast}
              onRefreshGlobalStats={loadGlobalStats}
            />
          )}

          {activeTab === 'TRANSACTIONS' && (
            <AdminTransactionsTab onShowToast={showToast} />
          )}

          {activeTab === 'EARNINGS' && (
            <AdminEarningsTab
              adminId={adminIdentifier}
              onShowToast={showToast}
              onRefreshGlobalStats={loadGlobalStats}
            />
          )}

          {activeTab === 'REFERRALS' && (
            <AdminReferralsTab onShowToast={showToast} />
          )}

          {activeTab === 'MISSIONS' && (
            <AdminMissionsTab
              adminId={adminIdentifier}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'GIFT_CODES' && (
            <AdminGiftCodesTab
              adminId={adminIdentifier}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'NOTIFICATIONS' && (
            <AdminNotificationsTab
              adminId={adminIdentifier}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'BANNERS_NEWS' && (
            <AdminBannersNewsTab
              adminId={adminIdentifier}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'ABOUT_PLATFORM' && (
            <AdminAboutPlatformTab
              adminId={adminIdentifier}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'SETTINGS' && (
            <AdminSettingsTab
              adminId={adminIdentifier}
              onShowToast={showToast}
              onRefreshGlobalStats={loadGlobalStats}
            />
          )}

          {activeTab === 'AUDIT' && (
            <AdminAuditTab onShowToast={showToast} />
          )}
        </main>
      </div>

      {/* Global Dashboard Feedback Toast */}
      <Toast message={toastMessage} type={toastType} />
    </div>
  );
};
