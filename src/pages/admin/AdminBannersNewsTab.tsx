import React, { useState, useEffect, useRef } from 'react';
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
  Upload,
} from 'lucide-react';
import {
  fetchAdminBanners,
  saveAdminBanner,
  deleteAdminBanner,
  fetchAdminNews,
  saveAdminNews,
  deleteAdminNews,
  uploadSiteAsset,
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
  const [uploadingBannerImg, setUploadingBannerImg] = useState(false);
  const bannerFileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (!editingBanner.imageUrl) {
      onShowToast('Please upload a banner image.');
      return;
    }
    try {
      await saveAdminBanner(
        {
          ...editingBanner,
          title: editingBanner.title || 'Promotional Banner',
          subtitle: '',
          ctaText: '',
          badge: '',
          linkUrl: (editingBanner.linkUrl || '').trim(),
          targetTab: (editingBanner.linkUrl || '').trim(),
        },
        adminId
      );
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
                    imageUrl: '',
                    linkUrl: '',
                    priority: banners.length + 1,
                    isActive: true,
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
              className="bg-[#161b22] border border-gray-800 rounded-2xl p-4 flex flex-col justify-between shadow-sm"
            >
              <div>
                {/* Banner Image Preview */}
                <div className="w-full h-36 rounded-xl overflow-hidden bg-black/50 border border-gray-800 mb-3 relative flex items-center justify-center">
                  {b.imageUrl ? (
                    <img
                      src={b.imageUrl}
                      alt="Banner"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-500 text-xs">
                      No banner image uploaded
                    </div>
                  )}
                  <span
                    className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm ${
                      b.isActive !== false
                        ? 'bg-emerald-950/85 text-emerald-400 border border-emerald-800/60'
                        : 'bg-gray-800/85 text-gray-400 border border-gray-700'
                    }`}
                  >
                    {b.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                {/* Banner Destination Link */}
                <div className="text-xs text-gray-300 font-medium bg-[#0d1117] p-2.5 rounded-xl border border-gray-800 flex items-center justify-between gap-2">
                  <span className="text-gray-400 shrink-0">Destination Link:</span>
                  <span className="text-[#FF6000] font-mono text-[11px] truncate max-w-[220px]">
                    {b.linkUrl || b.targetTab || 'None (non-clickable)'}
                  </span>
                </div>

                <div className="mt-2 text-[11px] text-gray-500 flex items-center justify-between px-1">
                  <span>Priority: #{b.priority ?? 1}</span>
                  <span className="font-mono text-[10px]">ID: {b.id.slice(0, 8)}...</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-800">
                <button
                  onClick={() => setEditingBanner({ ...b })}
                  className="flex-1 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleDeleteBanner(b.id)}
                  className="p-1.5 rounded-lg bg-red-950/40 border border-red-800 hover:bg-red-900 text-red-400 cursor-pointer"
                  title="Delete Banner"
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
              <h3 className="text-base font-bold text-white">
                {editingBanner.id ? 'Edit Promotional Banner' : 'Upload Promotional Banner'}
              </h3>
              <button onClick={() => setEditingBanner(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBanner} className="space-y-4 text-xs">
              {/* 1. Banner Image */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Banner Image <span className="text-red-400">*</span>
                </label>
                <div className="space-y-3">
                  <input
                    ref={bannerFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setUploadingBannerImg(true);
                        const url = await uploadSiteAsset(file, 'banner');
                        setEditingBanner((prev) => (prev ? { ...prev, imageUrl: url } : { imageUrl: url }));
                      } catch (err: any) {
                        alert(err.message || 'Failed to upload banner image.');
                      } finally {
                        setUploadingBannerImg(false);
                      }
                    }}
                  />

                  {editingBanner.imageUrl ? (
                    <div className="relative rounded-xl border border-gray-700 overflow-hidden bg-black/40 p-2 flex flex-col gap-2">
                      <img
                        src={editingBanner.imageUrl}
                        alt="Banner Preview"
                        className="w-full h-36 object-cover rounded-lg"
                      />
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs text-emerald-400 font-medium truncate max-w-[200px]">
                          ✓ Image Uploaded
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => bannerFileInputRef.current?.click()}
                            disabled={uploadingBannerImg}
                            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Change
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingBanner({ ...editingBanner, imageUrl: '' })}
                            className="px-3 py-1 bg-red-900/40 hover:bg-red-900/60 text-xs text-red-300 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => bannerFileInputRef.current?.click()}
                      disabled={uploadingBannerImg}
                      className="w-full border-2 border-dashed border-gray-700 hover:border-[#FF6000] rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-all bg-gray-900/30 hover:bg-gray-900/60 text-gray-400 hover:text-[#FF6000] cursor-pointer"
                    >
                      {uploadingBannerImg ? (
                        <>
                          <RefreshCw className="w-8 h-8 animate-spin text-[#FF6000]" />
                          <span className="text-xs font-semibold text-[#FF6000]">Uploading banner to storage...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8" />
                          <span className="text-sm font-semibold text-gray-200">Click to Upload Banner Image</span>
                          <span className="text-xs text-gray-400">Supports PNG, JPG, WebP</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Banner Link / Destination URL */}
              <div>
                <label className="block text-gray-300 font-semibold mb-1">
                  Banner Link / Destination URL
                </label>
                <input
                  type="text"
                  placeholder="/purchase or https://..."
                  value={editingBanner.linkUrl ?? editingBanner.targetTab ?? ''}
                  onChange={(e) =>
                    setEditingBanner({
                      ...editingBanner,
                      linkUrl: e.target.value,
                      targetTab: e.target.value,
                    })
                  }
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none focus:border-[#FF6000]"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Internal route (e.g. <span className="text-gray-200">/purchase</span>) or external URL (e.g. <span className="text-gray-200">https://...</span>). Leave blank if non-clickable.
                </p>
              </div>

              {/* 3. Priority and Active Status */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Sort Priority</label>
                  <input
                    type="number"
                    value={editingBanner.priority ?? 1}
                    onChange={(e) => setEditingBanner({ ...editingBanner, priority: Number(e.target.value) })}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                  />
                </div>

                <div className="flex flex-col justify-end pb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="bannerIsActive"
                      checked={editingBanner.isActive !== false}
                      onChange={(e) => setEditingBanner({ ...editingBanner, isActive: e.target.checked })}
                      className="w-4 h-4 accent-[#FF6000] cursor-pointer"
                    />
                    <label htmlFor="bannerIsActive" className="text-gray-300 font-medium cursor-pointer">
                      Active (Visible)
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingBanner(null)}
                  className="flex-1 py-2.5 bg-gray-800 text-gray-300 rounded-xl font-semibold cursor-pointer hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#FF6000] text-white rounded-xl font-bold cursor-pointer hover:bg-[#e05500]"
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
