import React, { useState, useEffect } from 'react';
import {
  Bell,
  Send,
  Sparkles,
  Users,
  Megaphone,
  Zap,
  ArrowDownCircle,
  ArrowUpCircle,
  Coins,
  ShieldAlert,
  Info,
  Calendar,
  Link,
  Image,
  CheckCircle2,
  Clock,
  Archive,
  RefreshCw,
  Eye,
  AlertCircle,
  ChevronRight,
  Filter,
} from 'lucide-react';
import {
  NotificationType,
  TargetAudienceType,
  AdminCreateNotificationPayload,
  AdminNotificationHistoryItem,
  UserProfile,
} from '../../types';
import {
  adminSendNotification,
  fetchAdminNotificationHistory,
  archiveAdminNotification,
  fetchAdminUsers,
} from '../../services/api';

interface AdminNotificationsTabProps {
  adminId: string;
  onShowToast: (msg: string) => void;
}

export const AdminNotificationsTab: React.FC<AdminNotificationsTabProps> = ({
  adminId,
  onShowToast,
}) => {
  const [history, setHistory] = useState<AdminNotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [userList, setUserList] = useState<UserProfile[]>([]);

  // Form State
  const [formData, setFormData] = useState<AdminCreateNotificationPayload>({
    title: '',
    description: '',
    type: 'ANNOUNCEMENT',
    targetAudience: 'ALL_USERS',
    specificUserIds: [],
    isHomePopup: true,
    expiresAt: '',
    imageUrl: '',
    actionUrl: '/purchase',
    actionText: 'Explore Now',
  });

  const [specificUserSearch, setSpecificUserSearch] = useState('');
  const [selectedUserMobile, setSelectedUserMobile] = useState('');

  // Load history & users
  const loadData = async () => {
    try {
      setLoading(true);
      const [histData, users] = await Promise.all([
        fetchAdminNotificationHistory(),
        fetchAdminUsers(),
      ]);
      setHistory(histData);
      setUserList(users);
    } catch (e) {
      console.error('Failed to load admin notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle send notification
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      onShowToast('Please enter a notification title');
      return;
    }
    if (!formData.description.trim()) {
      onShowToast('Please enter notification description/message');
      return;
    }

    if (
      formData.targetAudience === 'SPECIFIC_USER' &&
      (!formData.specificUserIds || formData.specificUserIds.length === 0)
    ) {
      onShowToast('Please select a specific recipient user');
      return;
    }

    try {
      setIsSending(true);
      const result = await adminSendNotification(formData, adminId);
      onShowToast(`Successfully sent notification to ${result.deliveredCount} user(s)!`);

      // Reset form
      setFormData({
        title: '',
        description: '',
        type: 'ANNOUNCEMENT',
        targetAudience: 'ALL_USERS',
        specificUserIds: [],
        isHomePopup: true,
        expiresAt: '',
        imageUrl: '',
        actionUrl: '',
        actionText: '',
      });
      setSelectedUserMobile('');
      setSpecificUserSearch('');

      // Reload history
      await loadData();
    } catch (e: any) {
      onShowToast(`Failed to send notification: ${e.message || 'Unknown error'}`);
    } finally {
      setIsSending(false);
    }
  };

  // Handle archive
  const handleArchive = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to archive this notification broadcast?')) return;
    try {
      await archiveAdminNotification(batchId, adminId);
      onShowToast('Notification batch archived');
      await loadData();
    } catch (e: any) {
      onShowToast(`Failed to archive: ${e.message}`);
    }
  };

  // Stats
  const totalBroadcasts = history.length;
  const totalDelivered = history.reduce((acc, h) => acc + (h.targetCount || 0), 0);
  const totalReads = history.reduce((acc, h) => acc + (h.readCount || 0), 0);
  const activePopups = history.filter((h) => h.isHomePopup && h.status === 'active').length;
  const overallReadRate = totalDelivered > 0 ? Math.round((totalReads / totalDelivered) * 100) : 0;

  // Filtered users for specific user target
  const filteredUsers = userList.filter((u) => {
    if (!specificUserSearch) return false;
    const term = specificUserSearch.toLowerCase();
    return (
      (u.mobile && u.mobile.includes(term)) ||
      (u.username && u.username.toLowerCase().includes(term)) ||
      (u.membershipNumber && u.membershipNumber.toLowerCase().includes(term)) ||
      (u.userId && u.userId.toLowerCase().includes(term))
    );
  });

  const renderTypeIcon = (type: NotificationType) => {
    switch (type) {
      case 'ANNOUNCEMENT':
        return <Megaphone className="w-4 h-4 text-blue-400" />;
      case 'PROMOTION':
        return <Sparkles className="w-4 h-4 text-[#FF6000]" />;
      case 'PLAN':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'RECHARGE':
        return <ArrowDownCircle className="w-4 h-4 text-emerald-400" />;
      case 'WITHDRAWAL':
        return <ArrowUpCircle className="w-4 h-4 text-indigo-400" />;
      case 'EARNING':
        return <Coins className="w-4 h-4 text-yellow-400" />;
      case 'MAINTENANCE':
        return <ShieldAlert className="w-4 h-4 text-red-400" />;
      default:
        return <Info className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Summary Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-[#FF6000]" />
            <span>Notification & Broadcast Center</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Dispatch announcements, system alerts, promotions, and targeted Home popups to members.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="self-start sm:self-auto px-3.5 py-2 bg-[#222] hover:bg-[#2c2c2c] text-xs font-semibold text-gray-300 rounded-xl border border-[#333] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#181818] border border-[#262626] rounded-xl p-3.5">
          <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
            Total Broadcasts
          </span>
          <div className="text-xl font-black text-white mt-1">{totalBroadcasts}</div>
        </div>

        <div className="bg-[#181818] border border-[#262626] rounded-xl p-3.5">
          <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
            Delivered Copies
          </span>
          <div className="text-xl font-black text-emerald-400 mt-1">
            {totalDelivered.toLocaleString()}
          </div>
        </div>

        <div className="bg-[#181818] border border-[#262626] rounded-xl p-3.5">
          <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
            Overall Read Rate
          </span>
          <div className="text-xl font-black text-blue-400 mt-1">{overallReadRate}%</div>
        </div>

        <div className="bg-[#181818] border border-[#262626] rounded-xl p-3.5">
          <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
            Active Home Popups
          </span>
          <div className="text-xl font-black text-[#FF6000] mt-1">{activePopups}</div>
        </div>
      </div>

      {/* 2. Main Grid: Create Notification Form & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Creation Form (7 cols) */}
        <div className="lg:col-span-7 bg-[#181818] border border-[#282828] rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#252525]">
            <Send className="w-4 h-4 text-[#FF6000]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Create & Dispatch Notification
            </h3>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Notification Title <span className="text-[#FF6000]">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Double Earnings Hardware Weekend!"
                maxLength={90}
                required
                className="w-full bg-[#121212] border border-[#2c2c2c] focus:border-[#FF6000] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-hidden transition-all"
              />
            </div>

            {/* Description / Message */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Message Description <span className="text-[#FF6000]">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter detailed notification content here..."
                rows={4}
                required
                className="w-full bg-[#121212] border border-[#2c2c2c] focus:border-[#FF6000] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-hidden transition-all resize-none"
              />
            </div>

            {/* Type & Audience in 2 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Notification Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as NotificationType })
                  }
                  className="w-full bg-[#121212] border border-[#2c2c2c] focus:border-[#FF6000] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-hidden transition-all"
                >
                  <option value="ANNOUNCEMENT">Announcement (General)</option>
                  <option value="PROMOTION">Promotion / Bonus</option>
                  <option value="PLAN">Plan / Hardware Alert</option>
                  <option value="SYSTEM">System Notice</option>
                  <option value="RECHARGE">Recharge Event</option>
                  <option value="WITHDRAWAL">Withdrawal Event</option>
                  <option value="EARNING">Earnings / Yield</option>
                  <option value="MAINTENANCE">Maintenance Alert</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Target Audience
                </label>
                <select
                  value={formData.targetAudience}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      targetAudience: e.target.value as TargetAudienceType,
                    })
                  }
                  className="w-full bg-[#121212] border border-[#2c2c2c] focus:border-[#FF6000] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-hidden transition-all"
                >
                  <option value="ALL_USERS">All Registered Users</option>
                  <option value="ACTIVE_USERS">Active Hardware Investors</option>
                  <option value="HOURLY_PLAN_USERS">Hourly Plan Holders</option>
                  <option value="PRO_PLAN_USERS">PRO Plan Holders</option>
                  <option value="SPECIFIC_USER">Specific Individual User</option>
                </select>
              </div>
            </div>

            {/* If Specific User Selected: User Search Box */}
            {formData.targetAudience === 'SPECIFIC_USER' && (
              <div className="p-3.5 bg-[#121212] border border-[#2e2e2e] rounded-xl space-y-2">
                <label className="block text-xs font-semibold text-gray-300">
                  Select Recipient User (Search by Mobile or ID)
                </label>
                <input
                  type="text"
                  value={specificUserSearch}
                  onChange={(e) => setSpecificUserSearch(e.target.value)}
                  placeholder="Type mobile or username..."
                  className="w-full bg-[#181818] border border-[#333] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-hidden"
                />

                {selectedUserMobile && (
                  <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Selected: {selectedUserMobile}</span>
                  </div>
                )}

                {filteredUsers.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-1 border border-[#282828] rounded-lg p-1 bg-[#141414]">
                    {filteredUsers.slice(0, 5).map((u) => (
                      <button
                        key={u.userId || u.id}
                        type="button"
                        onClick={() => {
                          const id = u.userId || u.id;
                          setFormData({ ...formData, specificUserIds: [id] });
                          setSelectedUserMobile(`${u.mobile || u.username} (${u.membershipNumber})`);
                          setSpecificUserSearch('');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[#222] text-xs text-gray-300 flex items-center justify-between"
                      >
                        <span>
                          {u.mobile} - {u.username || 'User'}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {u.membershipNumber}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Home Popup Switch & Expiration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Home Popup Switch */}
              <div className="bg-[#121212] border border-[#2a2a2a] p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">
                    Show Once on Home
                  </span>
                  <span className="text-[10px] text-gray-400">
                    Displays popup on next Home launch
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isHomePopup}
                    onChange={(e) =>
                      setFormData({ ...formData, isHomePopup: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-[#333] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FF6000]"></div>
                </label>
              </div>

              {/* Expiration Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  className="w-full bg-[#121212] border border-[#2c2c2c] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                />
              </div>
            </div>

            {/* Action Link & Text */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1">
                  <Link className="w-3.5 h-3.5 text-gray-400" />
                  <span>Action URL / Route</span>
                </label>
                <input
                  type="text"
                  value={formData.actionUrl}
                  onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
                  placeholder="e.g. /purchase, /fortune or https://..."
                  className="w-full bg-[#121212] border border-[#2c2c2c] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Action Button Text
                </label>
                <input
                  type="text"
                  value={formData.actionText}
                  onChange={(e) => setFormData({ ...formData, actionText: e.target.value })}
                  placeholder="e.g. Rent Power Bank"
                  className="w-full bg-[#121212] border border-[#2c2c2c] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1">
                <Image className="w-3.5 h-3.5 text-gray-400" />
                <span>Optional Header Image URL</span>
              </label>
              <input
                type="url"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://..."
                className="w-full bg-[#121212] border border-[#2c2c2c] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-hidden"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSending}
                className="w-full py-3 bg-[#FF6000] hover:bg-[#ff7824] active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Broadcasting to Members...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Notification Broadcast</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Live Card Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#181818] border border-[#282828] rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#252525]">
              <Eye className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Live User Preview
              </h3>
            </div>

            <div className="space-y-4">
              {/* Home Popup Card Preview */}
              {formData.isHomePopup && (
                <div>
                  <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-2 block">
                    1. Home Page Popup Card
                  </span>
                  <div className="bg-[#1b1b1b] border border-[#FF6000]/40 rounded-xl overflow-hidden shadow-md">
                    <div className="px-3.5 py-2 bg-[#222] border-b border-[#2d2d2d] flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#FF6000]" />
                        <span className="text-[10px] font-bold text-[#FF6000] uppercase">
                          {formData.type}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 font-bold">✕</span>
                    </div>

                    <div className="p-3.5 space-y-2">
                      {formData.imageUrl && (
                        <div className="rounded-lg overflow-hidden max-h-24 border border-[#2a2a2a]">
                          <img
                            src={formData.imageUrl}
                            alt="preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <h4 className="text-xs font-bold text-white">
                        {formData.title || 'Notification Title Preview'}
                      </h4>
                      <p className="text-[11px] text-gray-300 line-clamp-3">
                        {formData.description || 'Notification message description preview text...'}
                      </p>
                    </div>

                    <div className="px-3 py-2 bg-[#171717] border-t border-[#252525] flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">Dismiss</span>
                      <span className="text-[10px] font-bold text-white bg-[#FF6000] px-2.5 py-1 rounded-md">
                        {formData.actionText || 'View Details'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notification Center List Item Preview */}
              <div>
                <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-2 block">
                  2. Notification Center Item
                </span>
                <div className="bg-[#1e1a17] border border-[#FF6000]/30 rounded-xl p-3.5 flex gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#FF6000]/15 flex items-center justify-center shrink-0">
                    {renderTypeIcon(formData.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-bold uppercase text-[#FF6000] bg-[#FF6000]/10 px-1.5 py-0.5 rounded-sm">
                        {formData.type}
                      </span>
                      <span className="text-[10px] text-gray-400">Just now</span>
                    </div>
                    <h5 className="text-xs font-bold text-white truncate">
                      {formData.title || 'Notification Title'}
                    </h5>
                    <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">
                      {formData.description || 'Message description preview...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Broadcast History & Performance Table */}
      <div className="bg-[#181818] border border-[#282828] rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#252525]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Broadcast History & Engagement
            </h3>
          </div>
          <span className="text-xs text-gray-400">{history.length} broadcast records</span>
        </div>

        {history.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-xs">
            No notification broadcasts found. Send your first announcement above!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141414] text-gray-400 uppercase tracking-wider font-semibold border-b border-[#252525]">
                <tr>
                  <th className="py-3 px-3">Title & Type</th>
                  <th className="py-3 px-3">Target Audience</th>
                  <th className="py-3 px-3">Home Popup</th>
                  <th className="py-3 px-3">Read Engagement</th>
                  <th className="py-3 px-3">Sent Time</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {history.map((item) => {
                  const rate =
                    item.targetCount > 0 ? Math.round((item.readCount / item.targetCount) * 100) : 0;
                  return (
                    <tr key={item.id} className="hover:bg-[#1f1f1f] transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {renderTypeIcon(item.type)}
                          <div>
                            <span className="font-bold text-white block max-w-xs truncate">
                              {item.title}
                            </span>
                            <span className="text-[10px] text-gray-400 uppercase font-semibold">
                              {item.type}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-[#262626] rounded-md text-[11px] font-semibold text-gray-300">
                          {item.targetAudience} ({item.targetCount})
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        {item.isHomePopup ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="text-gray-500 font-medium">Off</span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="w-28 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-300 font-semibold">
                              {item.readCount}/{item.targetCount}
                            </span>
                            <span className="text-blue-400 font-bold">{rate}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#252525] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-gray-400 text-[11px]">
                        {new Date(item.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-gray-700/30 text-gray-400'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        {item.status === 'active' && (
                          <button
                            onClick={() => handleArchive(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 active:scale-95 transition-all cursor-pointer"
                            title="Archive Broadcast"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
