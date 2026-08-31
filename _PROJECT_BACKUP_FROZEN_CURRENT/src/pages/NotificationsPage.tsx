import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
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
  X,
  Clock,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { NotificationItem, NotificationType } from '../types';
import {
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/api';

interface NotificationsPageProps {
  userId: string;
  onBack: () => void;
  onNavigate?: (tab: string) => void;
  onUnreadCountChange?: (newCount: number) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  userId,
  onBack,
  onNavigate,
  onUnreadCountChange,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'UNREAD' | 'ANNOUNCEMENTS' | 'TRANSACTIONS' | 'PROMOTIONS'>('ALL');
  const [activeNotification, setActiveNotification] = useState<NotificationItem | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // Load user notifications
  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await fetchUserNotifications(userId);
      setNotifications(data);
      const unread = data.filter((n) => !n.isRead).length;
      if (onUnreadCountChange) onUnreadCountChange(unread);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [userId]);

  // Handle Mark All Read
  const handleMarkAllRead = async () => {
    try {
      setIsMarkingAll(true);
      await markAllNotificationsAsRead(userId);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      if (onUnreadCountChange) onUnreadCountChange(0);
    } catch (e) {
      console.error('Error marking all as read:', e);
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Handle Opening a Notification
  const handleOpenNotification = async (item: NotificationItem) => {
    setActiveNotification(item);

    // If unread, mark as read immediately
    if (!item.isRead) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      const updatedUnread = notifications.filter((n) => n.id !== item.id && !n.isRead).length;
      if (onUnreadCountChange) onUnreadCountChange(updatedUnread);

      // Backend sync
      await markNotificationAsRead(item.id, userId);
    }
  };

  // Filter list
  const filteredNotifications = notifications.filter((n) => {
    if (selectedFilter === 'UNREAD') return !n.isRead;
    if (selectedFilter === 'ANNOUNCEMENTS') return n.type === 'ANNOUNCEMENT' || n.type === 'SYSTEM' || n.type === 'MAINTENANCE';
    if (selectedFilter === 'TRANSACTIONS') return n.type === 'RECHARGE' || n.type === 'WITHDRAWAL' || n.type === 'EARNING' || n.type === 'PLAN';
    if (selectedFilter === 'PROMOTIONS') return n.type === 'PROMOTION';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Render Icon according to notification type
  const renderTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'ANNOUNCEMENT':
        return (
          <div className="w-9 h-9 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 border border-blue-500/20">
            <Megaphone className="w-4.5 h-4.5" />
          </div>
        );
      case 'PROMOTION':
        return (
          <div className="w-9 h-9 rounded-full bg-[#FF6000]/10 text-[#FF6000] flex items-center justify-center shrink-0 border border-[#FF6000]/20">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
        );
      case 'PLAN':
        return (
          <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Zap className="w-4.5 h-4.5" />
          </div>
        );
      case 'RECHARGE':
        return (
          <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <ArrowDownCircle className="w-4.5 h-4.5" />
          </div>
        );
      case 'WITHDRAWAL':
        return (
          <div className="w-9 h-9 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20">
            <ArrowUpCircle className="w-4.5 h-4.5" />
          </div>
        );
      case 'EARNING':
        return (
          <div className="w-9 h-9 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center shrink-0 border border-yellow-500/20">
            <Coins className="w-4.5 h-4.5" />
          </div>
        );
      case 'MAINTENANCE':
        return (
          <div className="w-9 h-9 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0 border border-red-500/20">
            <ShieldAlert className="w-4.5 h-4.5" />
          </div>
        );
      default:
        return (
          <div className="w-9 h-9 rounded-full bg-gray-500/10 text-gray-400 flex items-center justify-center shrink-0 border border-gray-500/20">
            <Info className="w-4.5 h-4.5" />
          </div>
        );
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col pb-16">
      {/* Top App Bar */}
      <header className="sticky top-0 z-20 bg-[#121212]/95 backdrop-blur-md border-b border-[#252525] px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 text-gray-300 hover:text-white rounded-full hover:bg-white/5 active:scale-95 transition-all cursor-pointer"
            aria-label="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-[#FF6000]/20 text-[#FF6000] border border-[#FF6000]/30 text-[11px] font-bold rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={isMarkingAll}
            className="flex items-center gap-1 text-xs font-semibold text-[#FF6000] hover:text-[#ff7824] px-2.5 py-1 rounded-lg hover:bg-[#FF6000]/10 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </header>

      {/* Filter Tabs */}
      <div className="px-4 py-2.5 overflow-x-auto no-scrollbar border-b border-[#1e1e1e] flex items-center gap-2 bg-[#161616]">
        {[
          { key: 'ALL', label: 'All' },
          { key: 'UNREAD', label: `Unread (${unreadCount})` },
          { key: 'ANNOUNCEMENTS', label: 'Announcements' },
          { key: 'TRANSACTIONS', label: 'Finance & Yield' },
          { key: 'PROMOTIONS', label: 'Promotions' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedFilter(tab.key as any)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedFilter === tab.key
                ? 'bg-[#FF6000] text-white shadow-xs'
                : 'bg-[#222222] text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification List Content */}
      <main className="flex-1 px-4 py-3 max-w-xl mx-auto w-full">
        {loading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-[#1c1c1c] border border-[#282828] rounded-xl p-4 flex gap-3 animate-pulse"
              >
                <div className="w-9 h-9 rounded-full bg-[#2a2a2a] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#2a2a2a] rounded-sm w-3/4" />
                  <div className="h-3 bg-[#2a2a2a] rounded-sm w-full" />
                  <div className="h-2 bg-[#2a2a2a] rounded-sm w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-[#1c1c1c] border border-[#282828] flex items-center justify-center text-gray-500 mb-3.5">
              <Bell className="w-7 h-7 opacity-40" />
            </div>
            <h3 className="text-base font-bold text-gray-200 mb-1">No notifications</h3>
            <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
              {selectedFilter === 'UNREAD'
                ? "You've read all your notifications. New platform updates and earnings will appear here."
                : 'No notification records match this filter category.'}
            </p>
            {selectedFilter !== 'ALL' && (
              <button
                onClick={() => setSelectedFilter('ALL')}
                className="mt-4 px-4 py-1.5 bg-[#222] hover:bg-[#2a2a2a] text-xs font-semibold text-gray-300 rounded-full border border-[#333] transition-all cursor-pointer"
              >
                View all notifications
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleOpenNotification(item)}
                className={`relative rounded-xl p-3.5 flex gap-3 transition-all cursor-pointer border active:scale-[0.99] ${
                  !item.isRead
                    ? 'bg-[#1e1a17] hover:bg-[#25201b] border-[#FF6000]/30 shadow-xs'
                    : 'bg-[#181818] hover:bg-[#202020] border-[#252525]'
                }`}
              >
                {/* Unread Glow Pill */}
                {!item.isRead && (
                  <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-[#FF6000] ring-4 ring-[#FF6000]/20 animate-pulse" />
                )}

                {/* Icon */}
                {renderTypeIcon(item.type)}

                {/* Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                        item.type === 'PROMOTION'
                          ? 'bg-[#FF6000]/15 text-[#FF6000]'
                          : item.type === 'ANNOUNCEMENT'
                          ? 'bg-blue-500/15 text-blue-400'
                          : item.type === 'RECHARGE'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : item.type === 'WITHDRAWAL'
                          ? 'bg-indigo-500/15 text-indigo-400'
                          : 'bg-gray-700/40 text-gray-300'
                      }`}
                    >
                      {item.type}
                    </span>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(item.createdAt)}
                    </span>
                  </div>

                  <h3
                    className={`text-sm font-semibold leading-snug line-clamp-1 ${
                      !item.isRead ? 'text-white font-bold' : 'text-gray-300'
                    }`}
                  >
                    {item.title}
                  </h3>

                  <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>

                  {item.actionText && (
                    <div className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#FF6000] hover:underline">
                      <span>{item.actionText}</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Detail Modal */}
      {activeNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-[#1c1c1c] border border-[#2e2e2e] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between bg-[#191919]">
              <div className="flex items-center gap-2.5">
                {renderTypeIcon(activeNotification.type)}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF6000]">
                    {activeNotification.type}
                  </span>
                  <p className="text-[11px] text-gray-400">
                    {new Date(activeNotification.createdAt).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveNotification(null)}
                className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              <h2 className="text-lg font-bold text-white leading-tight">
                {activeNotification.title}
              </h2>

              {activeNotification.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-[#2a2a2a] max-h-48">
                  <img
                    src={activeNotification.imageUrl}
                    alt={activeNotification.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="text-sm text-gray-300 whitespace-pre-line leading-relaxed bg-[#151515] p-3.5 rounded-xl border border-[#262626]">
                {activeNotification.description}
              </div>

              {activeNotification.readAt && (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Read on {new Date(activeNotification.readAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#2a2a2a] bg-[#191919] flex items-center justify-end gap-2.5">
              <button
                onClick={() => setActiveNotification(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-[#262626] hover:bg-[#303030] rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>

              {activeNotification.actionUrl && (
                <button
                  onClick={() => {
                    const url = activeNotification.actionUrl!;
                    setActiveNotification(null);
                    if (url.startsWith('/') && onNavigate) {
                      const tab = url.replace('/', '');
                      onNavigate(tab);
                    } else if (url.startsWith('http')) {
                      window.open(url, '_blank');
                    }
                  }}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#FF6000] hover:bg-[#ff7824] rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <span>{activeNotification.actionText || 'Explore Now'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
