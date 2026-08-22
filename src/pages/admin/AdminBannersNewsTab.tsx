import React, { useState, useEffect } from 'react';
import {
  Image,
  Newspaper,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  RefreshCw,
  Tag,
  Calendar,
} from 'lucide-react';
import {
  fetchAdminBanners,
  saveAdminBanner,
  deleteAdminBanner,
  fetchAdminNews,
  saveAdminNews,
  deleteAdminNews,
} from '../../services/api';
import { BannerItem, NewsItem } from '../../types';

interface AdminBannersNewsTabProps {
  adminId: string;
  onShowToast: (msg: string) => void;
}

export const AdminBannersNewsTab: React.FC<AdminBannersNewsTabProps> = ({
  adminId,
  onShowToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'BANNERS' | 'NEWS'>('BANNERS');

  // Banners state
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loadingBanners, setLoadingBanners] = useState(true);
  const [editingBanner, setEditingBanner] = useState<Partial<BannerItem> | null>(null);

  // News state
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [editingNews, setEditingNews] = useState<Partial<NewsItem> | null>(null);

  const loadData = async () => {
    setLoadingBanners(true);
    setLoadingNews(true);
    try {
      const [bannersRes, newsRes] = await Promise.all([
        fetchAdminBanners(),
        fetchAdminNews(),
      ]);
      setBanners(bannersRes);
      setNews(newsRes);
    } catch (e: any) {
      onShowToast(e.message || 'Error loading banners/news');
    } finally {
      setLoadingBanners(false);
      setLoadingNews(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save Banner
  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;
    try {
      await saveAdminBanner(editingBanner, adminId);
      onShowToast('Banner saved successfully.');
      setEditingBanner(null);
      loadData();
    } catch (e: any) {
      onShowToast(e.message || 'Failed to save banner');
    }
  };

  // Delete Banner
  const handleDeleteBanner = async (id: string) => {
    if (!window.confirm('Delete this banner?')) return;
    try {
      await deleteAdminBanner(id, adminId);
      onShowToast('Banner deleted.');
      loadData();
    } catch (e: any) {
      onShowToast(e.message || 'Failed to delete banner');
    }
  };

  // Save News
  const handleSaveNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNews) return;
    try {
      await saveAdminNews(editingNews, adminId);
      onShowToast('News article saved.');
      setEditingNews(null);
      loadData();
    } catch (e: any) {
      onShowToast(e.message || 'Failed to save news');
    }
  };

  // Delete News
  const handleDeleteNews = async (id: string) => {
    if (!window.confirm('Delete this news announcement?')) return;
    try {
      await deleteAdminNews(id, adminId);
      onShowToast('News item deleted.');
      loadData();
    } catch (e: any) {
      onShowToast(e.message || 'Failed to delete news');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-[#FF6000]" />
              Promotional Banners & Platform Announcements
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Customize Home carousel banners and real-time operational bulletins.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeSubTab === 'BANNERS' ? (
              <button
                onClick={() =>
                  setEditingBanner({
                    title: 'New High-Yield Hardware Campaign',
                    subtitle: 'Earn continuous hourly dividends',
                    ctaText: 'Explore >',
                    badge: 'HOT',
                    artworkType: 'commission',
                  })
                }
                className="px-3 py-1.5 bg-[#FF6000] text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Banner</span>
              </button>
            ) : (
              <button
                onClick={() =>
                  setEditingNews({
                    title: 'Platform System Notice',
                    content: 'Sharing infrastructure updated to v3.4.',
                    tag: 'Update',
                    date: new Date().toISOString().split('T')[0],
                  })
                }
                className="px-3 py-1.5 bg-[#FF6000] text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Publish Announcement</span>
              </button>
            )}

            <button
              onClick={loadData}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub tabs */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('BANNERS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'BANNERS'
                ? 'bg-gray-800 text-white border border-[#FF6000]'
                : 'bg-[#0d1117] text-gray-400 border border-gray-800 hover:border-gray-700'
            }`}
          >
            Carousel Banners ({banners.length})
          </button>
          <button
            onClick={() => setActiveSubTab('NEWS')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'NEWS'
                ? 'bg-gray-800 text-white border border-[#FF6000]'
                : 'bg-[#0d1117] text-gray-400 border border-gray-800 hover:border-gray-700'
            }`}
          >
            Platform News & Announcements ({news.length})
          </button>
        </div>
      </div>

      {/* Subtab 1: Banners */}
      {activeSubTab === 'BANNERS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {banners.map((b) => (
            <div
              key={b.id}
              className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-950/60 text-[#FF6000] border border-orange-800/40 uppercase">
                    {b.badge || 'PROMO'}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">ID: {b.id}</span>
                </div>
                <h3 className="font-bold text-white text-base mb-1">{b.title}</h3>
                <p className="text-xs text-gray-400 mb-3">{b.subtitle || 'Sharing platform promotional highlight'}</p>
                <div className="text-xs text-gray-300 font-medium bg-[#0d1117] p-2.5 rounded-xl border border-gray-800">
                  CTA Label: <span className="text-[#FF6000] font-bold">{b.ctaText || 'Go Now >'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-800">
                <button
                  onClick={() => setEditingBanner({ ...b })}
                  className="flex-1 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDeleteBanner(b.id)}
                  className="p-1.5 rounded-lg bg-red-950/40 border border-red-800 hover:bg-red-900 text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Subtab 2: News */}
      {activeSubTab === 'NEWS' && (
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl divide-y divide-gray-800">
          {news.map((n) => (
            <div key={n.id} className="p-4 flex items-center justify-between text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-gray-800 text-[#FF6000] text-[10px] font-bold">
                    {n.tag || 'Notice'}
                  </span>
                  <h4 className="font-bold text-white text-sm">{n.title}</h4>
                </div>
                <p className="text-gray-400 max-w-xl">{n.content}</p>
                <div className="text-[10px] text-gray-500 font-mono">Date: {n.date}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingNews({ ...n })}
                  className="p-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteNews(n.id)}
                  className="p-1.5 rounded-lg bg-red-950/50 text-red-400 hover:bg-red-900"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDIT BANNER MODAL */}
      {editingBanner && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
              <h3 className="text-base font-bold text-white">Edit Banner</h3>
              <button onClick={() => setEditingBanner(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBanner} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Banner Title</label>
                <input
                  type="text"
                  value={editingBanner.title || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                  required
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Subtitle</label>
                <input
                  type="text"
                  value={editingBanner.subtitle || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, subtitle: e.target.value })}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">CTA Text</label>
                  <input
                    type="text"
                    value={editingBanner.ctaText || 'Go Now >'}
                    onChange={(e) => setEditingBanner({ ...editingBanner, ctaText: e.target.value })}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Badge</label>
                  <input
                    type="text"
                    value={editingBanner.badge || 'HOT'}
                    onChange={(e) => setEditingBanner({ ...editingBanner, badge: e.target.value })}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingBanner(null)}
                  className="flex-1 py-2.5 bg-gray-800 text-gray-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#FF6000] text-white rounded-xl font-bold"
                >
                  Save Banner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT NEWS MODAL */}
      {editingNews && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
              <h3 className="text-base font-bold text-white">Edit Announcement</h3>
              <button onClick={() => setEditingNews(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNews} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Headline</label>
                <input
                  type="text"
                  value={editingNews.title || ''}
                  onChange={(e) => setEditingNews({ ...editingNews, title: e.target.value })}
                  required
                  placeholder="e.g. Platform Daily Settlement System Update"
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Tag / Category</label>
                  <input
                    type="text"
                    value={editingNews.tag || editingNews.category || 'Notice'}
                    onChange={(e) =>
                      setEditingNews({
                        ...editingNews,
                        tag: e.target.value,
                        category: e.target.value,
                      })
                    }
                    placeholder="e.g. System, Notice, Update"
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={editingNews.sortOrder ?? editingNews.sort_order ?? 1}
                    onChange={(e) =>
                      setEditingNews({
                        ...editingNews,
                        sortOrder: parseInt(e.target.value, 10) || 0,
                        sort_order: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Optional Image URL</label>
                <input
                  type="url"
                  value={editingNews.imageUrl || editingNews.image_url || ''}
                  onChange={(e) =>
                    setEditingNews({
                      ...editingNews,
                      imageUrl: e.target.value,
                      image_url: e.target.value,
                    })
                  }
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Short Description</label>
                <textarea
                  value={editingNews.description || editingNews.content || ''}
                  onChange={(e) =>
                    setEditingNews({
                      ...editingNews,
                      description: e.target.value,
                      content: e.target.value,
                    })
                  }
                  rows={3}
                  required
                  placeholder="Brief bulletin summary displayed on the home page and in the news feed..."
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="newsPublishedCheck"
                  checked={editingNews.isPublished !== false && editingNews.is_published !== false}
                  onChange={(e) =>
                    setEditingNews({
                      ...editingNews,
                      isPublished: e.target.checked,
                      is_published: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded text-[#FF6000] accent-[#FF6000] cursor-pointer"
                />
                <label htmlFor="newsPublishedCheck" className="text-gray-300 font-semibold cursor-pointer">
                  Publish to Platform (Visible on Home & App news)
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingNews(null)}
                  className="flex-1 py-2.5 bg-gray-800 text-gray-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#FF6000] hover:bg-[#E65100] text-white rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Save Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
