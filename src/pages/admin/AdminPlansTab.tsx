import React, { useState, useEffect } from 'react';
import {
  ShoppingBasket,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Zap,
  Cpu,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
  Tag,
  DollarSign,
  Clock,
  Calendar,
  Flame,
  Gift,
} from 'lucide-react';
import { fetchProducts, saveAdminPlan, deleteAdminPlan } from '../../services/api';
import { ProductItem } from '../../types';

interface AdminPlansTabProps {
  adminId: string;
  onShowToast: (msg: string) => void;
  onRefreshGlobalStats: () => void;
}

export const AdminPlansTab: React.FC<AdminPlansTabProps> = ({
  adminId,
  onShowToast,
  onRefreshGlobalStats,
}) => {
  const [plans, setPlans] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'VIP' | 'PRO' | 'EVENT'>('ALL');

  // Edit / Create Modal
  const [editingPlan, setEditingPlan] = useState<Partial<ProductItem> | null>(null);
  const [isNewPlan, setIsNewPlan] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await fetchProducts();
      // Normalize any older categories to VIP
      const normalized = (data || []).map((p) => {
        let cat = (p.category || '').toUpperCase();
        if (cat === 'STANDARD' || cat === 'HOURLY' || !cat) {
          cat = 'VIP';
        }
        return { ...p, category: cat as any };
      });
      setPlans(normalized);
    } catch (e: any) {
      onShowToast(e.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleOpenCreate = (category: 'VIP' | 'PRO' | 'EVENT' = 'VIP') => {
    const daily = category === 'PRO' ? 850 : category === 'EVENT' ? 520 : 84;
    const hourly = Number((daily / 24).toFixed(2));
    setIsNewPlan(true);

    const today = new Date().toISOString().slice(0, 10);
    const inThirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    setEditingPlan({
      name: category === 'PRO'
        ? 'PRO-Cabinet ' + Math.floor(Math.random() * 900 + 100)
        : category === 'EVENT'
        ? 'Festival-Cabinet ' + Math.floor(Math.random() * 900 + 100)
        : 'VIP-Cabinet ' + Math.floor(Math.random() * 900 + 100),
      category,
      devicePrice: category === 'PRO' ? 10000 : category === 'EVENT' ? 5000 : 1500,
      hourlyEarnings: hourly,
      dailyEarnings: daily,
      limit: category === 'EVENT' ? 2 : 5,
      durationDays: category === 'PRO' ? 45 : category === 'EVENT' ? 15 : 365,
      instantBonus: category === 'PRO' ? 500 : category === 'EVENT' ? 300 : 0,
      requiresActiveHourlyPlan: category === 'PRO',
      startDate: category === 'EVENT' ? today : undefined,
      endDate: category === 'EVENT' ? inThirtyDays : undefined,
      tags: category === 'PRO'
        ? ['Maturity Yield', 'High Return']
        : category === 'EVENT'
        ? ['Limited Event', 'High Yield', 'Instant Bonus']
        : ['VIP Hourly Yield', 'Auto Settle'],
      imageType: category === 'PRO' ? 'cabinet-pro' : category === 'EVENT' ? 'cabinet-gold' : 'cabinet-green',
      status: 'active',
    });
  };

  const handleOpenEdit = (plan: ProductItem) => {
    setIsNewPlan(false);
    setEditingPlan({ ...plan });
  };

  const handleDuplicate = (plan: ProductItem) => {
    setIsNewPlan(true);
    setEditingPlan({
      ...plan,
      id: undefined,
      name: `${plan.name} (Copy)`,
    });
  };

  const handleDelete = async (planId: string) => {
    if (!window.confirm('Are you sure you want to archive this plan?')) return;
    try {
      await deleteAdminPlan(planId);
      onShowToast('Plan archived successfully.');
      loadPlans();
      onRefreshGlobalStats();
    } catch (e: any) {
      onShowToast(e.message || 'Error deleting plan');
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    if (!editingPlan.name?.trim() || !editingPlan.devicePrice) {
      onShowToast('Please provide valid name and pricing.');
      return;
    }

    setSubmitting(true);
    try {
      await saveAdminPlan(editingPlan, adminId);
      onShowToast(`Plan ${isNewPlan ? 'created' : 'updated'} successfully.`);
      setEditingPlan(null);
      loadPlans();
      onRefreshGlobalStats();
    } catch (e: any) {
      onShowToast(e.message || 'Failed to save plan');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPlans = plans.filter((p) => {
    if (activeCategory === 'ALL') return true;
    let cat = (p.category || '').toUpperCase();
    if (cat === 'STANDARD' || cat === 'HOURLY' || !cat) cat = 'VIP';
    return cat === activeCategory;
  });

  return (
    <div className="space-y-5">
      {/* Header and Actions */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShoppingBasket className="w-5 h-5 text-[#FF6000]" />
              Sharing Hardware & Investment Plans
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Manage VIP Power Stations, High-Yield PRO Plans, and Limited Festival Event Packages.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => handleOpenCreate('VIP')}
              className="px-3.5 py-2 rounded-xl bg-[#FF6000] hover:bg-orange-600 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-orange-950/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add VIP Plan</span>
            </button>

            <button
              onClick={() => handleOpenCreate('PRO')}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 active:scale-95 text-black text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>Add PRO Plan</span>
            </button>

            <button
              onClick={() => handleOpenCreate('EVENT')}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 active:scale-95 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Flame className="w-4 h-4" />
              <span>Add Event Plan</span>
            </button>

            <button
              onClick={loadPlans}
              disabled={loading}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {[
            { id: 'ALL', label: 'All Plans' },
            { id: 'VIP', label: 'VIP Devices' },
            { id: 'PRO', label: 'High-Yield PRO Plans' },
            { id: 'EVENT', label: 'Festival & Event Plans' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === tab.id
                  ? 'bg-gray-800 text-white border border-[#FF6000]'
                  : 'bg-[#0d1117] text-gray-400 border border-gray-800 hover:border-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Plan Grid */}
      {loading ? (
        <div className="py-20 text-center text-gray-500 bg-[#161b22] rounded-2xl border border-gray-800">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF6000]" />
          <span>Loading investment plans...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map((plan) => {
            const isPro = (plan.category || '').toUpperCase() === 'PRO';
            const isEvent = (plan.category || '').toUpperCase() === 'EVENT';
            return (
              <div
                key={plan.id}
                className={`bg-[#161b22] border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                  isPro
                    ? 'border-amber-500/40 shadow-lg shadow-amber-950/20'
                    : isEvent
                    ? 'border-rose-500/40 shadow-lg shadow-rose-950/20'
                    : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                <div>
                  {/* Top badges */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                        isPro
                          ? 'bg-amber-500 text-black font-extrabold'
                          : isEvent
                          ? 'bg-rose-600 text-white font-extrabold'
                          : 'bg-[#FF6000]/20 text-[#FF6000] border border-[#FF6000]/30'
                      }`}
                    >
                      {plan.category || 'HOURLY'}
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">
                      Limit: {plan.limit} per user
                    </span>
                  </div>

                  {/* Plan Name & Price */}
                  <h3 className="text-base font-bold text-white mb-1">{plan.name}</h3>
                  <div className="text-2xl font-black text-white tracking-tight mb-3">
                    ₹{plan.devicePrice?.toLocaleString()}
                  </div>

                  {/* Financial Attributes */}
                  <div className="space-y-1.5 text-xs text-gray-300 bg-[#0d1117] p-3 rounded-xl border border-gray-800/80 mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Hourly Yield:</span>
                      <span className="font-bold text-emerald-400">₹{plan.hourlyEarnings?.toFixed(2)} / hr</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Daily Revenue:</span>
                      <span className="font-bold text-white">₹{plan.dailyEarnings?.toFixed(2)} / day</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Duration:</span>
                      <span className="font-semibold text-gray-200">{plan.durationDays} Days</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-800 pt-1.5 font-bold">
                      <span className="text-gray-400">Total Yield:</span>
                      <span className="text-[#FF6000]">₹{((plan.dailyEarnings || 0) * (plan.durationDays || 30)).toLocaleString()}</span>
                    </div>
                    {plan.instantBonus && plan.instantBonus > 0 ? (
                      <div className="flex justify-between text-amber-400 font-bold">
                        <span>Instant Bonus:</span>
                        <span>₹{plan.instantBonus}</span>
                      </div>
                    ) : null}
                    {(plan.startDate || plan.endDate) && (
                      <div className="flex justify-between text-rose-400 font-medium text-[11px] pt-1 border-t border-gray-800/60">
                        <span>Event Dates:</span>
                        <span>{plan.startDate || 'Now'} ~ {plan.endDate || 'Ongoing'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Plan Card Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-800">
                  <button
                    onClick={() => handleOpenEdit(plan)}
                    className="flex-1 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDuplicate(plan)}
                    title="Duplicate Plan"
                    className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(plan.id)}
                    title="Archive Plan"
                    className="p-2 rounded-xl bg-red-950/40 border border-red-800/50 hover:bg-red-900/50 text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT / CREATE PLAN MODAL */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingBasket className="w-5 h-5 text-[#FF6000]" />
                {isNewPlan ? 'Create New Investment Plan' : 'Edit Plan Configuration'}
              </h3>
              <button onClick={() => setEditingPlan(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Plan Name</label>
                  <input
                    type="text"
                    value={editingPlan.name || ''}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    required
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none focus:border-[#FF6000]"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Category</label>
                  <select
                    value={editingPlan.category || 'VIP'}
                    onChange={(e) => setEditingPlan({ ...editingPlan, category: e.target.value as any })}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none focus:border-[#FF6000]"
                  >
                    <option value="VIP">VIP (VIP Hourly Yield Device)</option>
                    <option value="PRO">PRO (High-Yield Maturity Contract)</option>
                    <option value="EVENT">EVENT (Festival & Limited Event Plan)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Device Price (₹)</label>
                  <input
                    type="number"
                    value={editingPlan.devicePrice || 0}
                    onChange={(e) => setEditingPlan({ ...editingPlan, devicePrice: Number(e.target.value) })}
                    required
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Daily Total (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingPlan.dailyEarnings || 0}
                    onChange={(e) => {
                      const daily = Number(e.target.value);
                      const hourly = Number((daily / 24).toFixed(2));
                      setEditingPlan({ ...editingPlan, dailyEarnings: daily, hourlyEarnings: hourly });
                    }}
                    required
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none focus:border-[#FF6000]"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Hourly Yield (₹/hr)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingPlan.hourlyEarnings || 0}
                    onChange={(e) => {
                      const hourly = Number(e.target.value);
                      const daily = Number((hourly * 24).toFixed(2));
                      setEditingPlan({ ...editingPlan, hourlyEarnings: hourly, dailyEarnings: daily });
                    }}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none focus:border-[#FF6000]"
                  />
                </div>
              </div>

              {/* Hourly Yield Auto-Calculation helper note */}
              <div className="p-2.5 rounded-xl bg-[#0d1117] border border-gray-800 flex items-center justify-between text-[11px] text-gray-400">
                <span>
                  Hourly Rate: <strong className="text-orange-400 font-mono">₹{((editingPlan.dailyEarnings || 0) / 24).toFixed(2)}/hr</strong> (Daily ÷ 24)
                </span>
                <span>
                  Est. Total: <strong className="text-amber-400 font-mono">₹{((editingPlan.dailyEarnings || 0) * (editingPlan.durationDays || 30)).toFixed(2)}</strong> ({editingPlan.durationDays || 30} days)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    value={editingPlan.durationDays || 30}
                    onChange={(e) => setEditingPlan({ ...editingPlan, durationDays: Number(e.target.value) })}
                    required
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Purchase Limit</label>
                  <input
                    type="number"
                    value={editingPlan.limit || 5}
                    onChange={(e) => setEditingPlan({ ...editingPlan, limit: Number(e.target.value) })}
                    required
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Instant Bonus (₹)</label>
                  <input
                    type="number"
                    value={editingPlan.instantBonus || 0}
                    onChange={(e) => setEditingPlan({ ...editingPlan, instantBonus: Number(e.target.value) })}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                  />
                </div>
              </div>

              {/* Event Date Range (for EVENT category) */}
              {editingPlan.category === 'EVENT' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-rose-950/20 border border-rose-900/40 rounded-xl">
                  <div>
                    <label className="block text-rose-300 font-semibold mb-1">Event Start Date</label>
                    <input
                      type="date"
                      value={editingPlan.startDate || ''}
                      onChange={(e) => setEditingPlan({ ...editingPlan, startDate: e.target.value })}
                      className="w-full bg-[#0d1117] border border-rose-800 rounded-xl p-2 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-rose-300 font-semibold mb-1">Event End Date</label>
                    <input
                      type="date"
                      value={editingPlan.endDate || ''}
                      onChange={(e) => setEditingPlan({ ...editingPlan, endDate: e.target.value })}
                      className="w-full bg-[#0d1117] border border-rose-800 rounded-xl p-2 text-white outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Visual Image Style</label>
                  <select
                    value={editingPlan.imageType || 'cabinet-green'}
                    onChange={(e) => setEditingPlan({ ...editingPlan, imageType: e.target.value as any })}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                  >
                    <option value="cabinet-green">Standard Green Cabinet</option>
                    <option value="cabinet-orange">High-Power Orange Cabinet</option>
                    <option value="cabinet-blue">Enterprise Blue Station</option>
                    <option value="cabinet-pro">Exclusive PRO Gold Station</option>
                    <option value="cabinet-gold">Festival Special Station</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Status</label>
                  <select
                    value={editingPlan.status || 'active'}
                    onChange={(e) => setEditingPlan({ ...editingPlan, status: e.target.value as any })}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                  >
                    <option value="active">Active (Available for purchase)</option>
                    <option value="disabled">Disabled (Hidden from store)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPlan.requiresActiveHourlyPlan ?? false}
                    onChange={(e) => setEditingPlan({ ...editingPlan, requiresActiveHourlyPlan: e.target.checked })}
                    className="accent-[#FF6000]"
                  />
                  <span className="text-gray-300 font-semibold">
                    Requires User to hold at least 1 Active Hourly Device (Gatekeeper)
                  </span>
                </label>
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 font-semibold hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6000] text-white font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Plan Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
