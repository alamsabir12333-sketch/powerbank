import React, { useState, useEffect } from 'react';
import {
  Crown,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Award,
  Shield,
  Zap,
  Star,
  Sparkles,
  Layers,
  Percent,
  TrendingUp,
  X,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { VipLevel } from '../../types';
import {
  fetchVipLevels,
  createVipLevel,
  updateVipLevel,
  deleteVipLevel,
  seedDefaultVipLevels,
} from '../../services/api';

interface AdminVipLevelsTabProps {
  adminId: string;
  onShowToast: (msg: string) => void;
}

export const AdminVipLevelsTab: React.FC<AdminVipLevelsTabProps> = ({
  adminId,
  onShowToast,
}) => {
  const [levels, setLevels] = useState<VipLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<VipLevel | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [formLevelNumber, setFormLevelNumber] = useState<number>(1);
  const [formName, setFormName] = useState('');
  const [formBadgeText, setFormBadgeText] = useState('VIP 1');
  const [formMinInvestment, setFormMinInvestment] = useState<string>('500');
  const [formMaxInvestment, setFormMaxInvestment] = useState<string>('1999');
  const [formIcon, setFormIcon] = useState('crown');
  const [formDailyBonusRate, setFormDailyBonusRate] = useState<string>('2');
  const [formWithdrawalFeeDiscount, setFormWithdrawalFeeDiscount] = useState<string>('0');
  const [formDescription, setFormDescription] = useState('');
  const [formBenefits, setFormBenefits] = useState<string>(
    '+2% Daily Device Earnings Boost\nPriority Recharge Confirmation\nStandard Daily Withdrawals'
  );
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(1);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  const loadLevels = async () => {
    setLoading(true);
    try {
      const data = await fetchVipLevels(true);
      setLevels(data);
    } catch (err: any) {
      onShowToast(`Failed to load VIP levels: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLevels();
  }, []);

  const openCreateModal = () => {
    const nextLevelNum = levels.length > 0 ? Math.max(...levels.map((l) => l.levelNumber)) + 1 : 1;
    setEditingLevel(null);
    setFormLevelNumber(nextLevelNum);
    setFormName(`VIP ${nextLevelNum} - Member`);
    setFormBadgeText(`VIP ${nextLevelNum}`);
    setFormMinInvestment('1000');
    setFormMaxInvestment('');
    setFormIcon('crown');
    setFormDailyBonusRate('3');
    setFormWithdrawalFeeDiscount('1');
    setFormDescription('Exclusive membership tier with elevated yield rates.');
    setFormBenefits('+3% Daily Device Earnings Boost\n1% Withdrawal Fee Discount\nPriority Customer Support');
    setFormDisplayOrder(nextLevelNum);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (level: VipLevel) => {
    setEditingLevel(level);
    setFormLevelNumber(level.levelNumber);
    setFormName(level.name);
    setFormBadgeText(level.badgeText);
    setFormMinInvestment(String(level.minInvestment));
    setFormMaxInvestment(level.maxInvestment !== null && level.maxInvestment !== undefined ? String(level.maxInvestment) : '');
    setFormIcon(level.icon || 'crown');
    setFormDailyBonusRate(String(level.dailyBonusRate || 0));
    setFormWithdrawalFeeDiscount(String(level.withdrawalFeeDiscount || 0));
    setFormDescription(level.description || '');
    setFormBenefits((level.benefits || []).join('\n'));
    setFormDisplayOrder(level.displayOrder);
    setFormIsActive(level.isActive);
    setIsModalOpen(true);
  };

  const handleSaveLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      onShowToast('Please enter a tier name');
      return;
    }
    const minInv = parseFloat(formMinInvestment);
    if (isNaN(minInv) || minInv < 0) {
      onShowToast('Please enter a valid minimum investment');
      return;
    }

    const maxInv = formMaxInvestment.trim() ? parseFloat(formMaxInvestment) : null;
    const bonusRate = parseFloat(formDailyBonusRate) || 0;
    const feeDiscount = parseFloat(formWithdrawalFeeDiscount) || 0;

    const benefitsArray = formBenefits
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    setSubmitting(true);
    try {
      if (editingLevel) {
        await updateVipLevel(
          editingLevel.id,
          {
            levelNumber: formLevelNumber,
            name: formName.trim(),
            badgeText: formBadgeText.trim(),
            minInvestment: minInv,
            maxInvestment: maxInv,
            icon: formIcon,
            dailyBonusRate: bonusRate,
            withdrawalFeeDiscount: feeDiscount,
            description: formDescription.trim(),
            benefits: benefitsArray,
            displayOrder: formDisplayOrder,
            isActive: formIsActive,
          },
          adminId
        );
        onShowToast(`VIP Level "${formName}" updated successfully`);
      } else {
        await createVipLevel(
          {
            levelNumber: formLevelNumber,
            name: formName.trim(),
            badgeText: formBadgeText.trim(),
            minInvestment: minInv,
            maxInvestment: maxInv,
            icon: formIcon,
            dailyBonusRate: bonusRate,
            withdrawalFeeDiscount: feeDiscount,
            description: formDescription.trim(),
            benefits: benefitsArray,
            displayOrder: formDisplayOrder,
            isActive: formIsActive,
          },
          adminId
        );
        onShowToast(`VIP Level "${formName}" created successfully`);
      }
      setIsModalOpen(false);
      await loadLevels();
    } catch (err: any) {
      onShowToast(`Save failed: ${err.message || 'Error occurred'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (level: VipLevel) => {
    try {
      await updateVipLevel(level.id, { isActive: !level.isActive }, adminId);
      onShowToast(`Tier ${level.badgeText} is now ${!level.isActive ? 'Active' : 'Disabled'}`);
      await loadLevels();
    } catch (err: any) {
      onShowToast(`Failed to update status: ${err.message}`);
    }
  };

  const handleDelete = async (level: VipLevel) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${level.name}" (${level.badgeText})? This action cannot be undone.`
      )
    ) {
      try {
        await deleteVipLevel(level.id, adminId);
        onShowToast(`Deleted "${level.name}"`);
        await loadLevels();
      } catch (err: any) {
        onShowToast(`Failed to delete: ${err.message}`);
      }
    }
  };

  const handleResetDefaults = async () => {
    if (
      window.confirm(
        'Reset all VIP levels to factory standard defaults (VIP 0 to VIP 6)? Custom changes will be replaced.'
      )
    ) {
      try {
        await seedDefaultVipLevels(adminId);
        onShowToast('Reset VIP levels to standard defaults');
        await loadLevels();
      } catch (err: any) {
        onShowToast(`Reset failed: ${err.message}`);
      }
    }
  };

  const filteredLevels = levels.filter((l) => {
    const matchSearch =
      l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.badgeText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.description && l.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchSearch) return false;
    if (statusFilter === 'ACTIVE') return l.isActive;
    if (statusFilter === 'INACTIVE') return !l.isActive;
    return true;
  });

  const getTierIcon = (iconName?: string) => {
    switch (iconName?.toLowerCase()) {
      case 'crown':
        return <Crown className="w-4 h-4 text-amber-400" />;
      case 'star':
        return <Star className="w-4 h-4 text-amber-400" />;
      case 'gem':
      case 'diamond':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'zap':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'shield':
        return <Shield className="w-4 h-4 text-amber-400" />;
      case 'award':
      case 'medal':
        return <Award className="w-4 h-4 text-amber-400" />;
      default:
        return <Crown className="w-4 h-4 text-amber-400" />;
    }
  };

  const activeCount = levels.filter((l) => l.isActive).length;
  const maxBonus = levels.reduce((max, l) => Math.max(max, l.dailyBonusRate || 0), 0);

  return (
    <div className="space-y-6">
      {/* 1. Header & KPI Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Crown className="w-6 h-6 text-[#FF6000]" />
            <span>VIP Levels Management</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Dynamic database-controlled VIP tiers, qualification thresholds, and automatic investment upgrades.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold flex items-center gap-1.5 transition-colors border border-gray-700 cursor-pointer"
            title="Reset standard tiers"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>

          <button
            onClick={loadLevels}
            disabled={loading}
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-colors border border-gray-700 cursor-pointer"
            title="Refresh VIP List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6000] to-[#FF8C00] hover:opacity-90 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-orange-950/40 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add VIP Level</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-[#161b22] border border-gray-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-orange-950/60 text-[#FF6000] border border-orange-800/40 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-gray-400 font-medium">Total Tiers</div>
            <div className="text-lg font-black text-white">{levels.length} Levels</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#161b22] border border-gray-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-gray-400 font-medium">Active Tiers</div>
            <div className="text-lg font-black text-white">{activeCount} Active</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#161b22] border border-gray-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-950/60 text-amber-400 border border-amber-800/40 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-gray-400 font-medium">Max Daily Bonus</div>
            <div className="text-lg font-black text-white">+{maxBonus}% Boost</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#161b22] border border-gray-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-950/60 text-purple-400 border border-purple-800/40 flex items-center justify-center shrink-0">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-gray-400 font-medium">Upgrade Trigger</div>
            <div className="text-lg font-black text-white">Auto On-Investment</div>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="p-3.5 rounded-2xl bg-[#161b22] border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search VIP tier, name, badge..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9.5 pr-4 py-2 rounded-xl bg-[#0d1117] border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-hidden focus:border-[#FF6000]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-[#0d1117] p-1 rounded-xl border border-gray-700 text-xs w-full sm:w-auto">
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex-1 sm:flex-initial ${
                  statusFilter === st
                    ? 'bg-[#FF6000] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. VIP Levels Table */}
      <div className="rounded-2xl bg-[#161b22] border border-gray-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-[#0d1117]/60 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Level</th>
                <th className="py-3 px-4">Tier Details</th>
                <th className="py-3 px-4">Min. Investment (₹)</th>
                <th className="py-3 px-4">Daily Yield Bonus</th>
                <th className="py-3 px-4">Fee Discount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin text-[#FF6000] mx-auto mb-2" />
                    <span>Loading VIP tiers...</span>
                  </td>
                </tr>
              ) : filteredLevels.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <AlertCircle className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                    <span>No VIP levels found matching criteria.</span>
                  </td>
                </tr>
              ) : (
                filteredLevels.map((lvl) => (
                  <tr
                    key={lvl.id}
                    className="hover:bg-gray-800/30 transition-colors group"
                  >
                    {/* Level Number & Emblem */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-orange-950/50 border border-orange-800/40 flex items-center justify-center">
                          {getTierIcon(lvl.icon)}
                        </div>
                        <div>
                          <span className="font-extrabold text-white text-sm">
                            {lvl.badgeText}
                          </span>
                          <span className="block text-[10px] text-gray-500 font-mono">
                            Order: #{lvl.displayOrder}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Tier Details */}
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-bold text-gray-200 text-xs block">
                          {lvl.name}
                        </span>
                        <span className="text-gray-400 text-[11px] line-clamp-1">
                          {lvl.description || 'No description'}
                        </span>
                      </div>
                    </td>

                    {/* Min Investment */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-white text-xs">
                        ₹{lvl.minInvestment.toLocaleString('en-IN')}
                        {lvl.maxInvestment ? (
                          <span className="text-gray-500 font-normal ml-1">
                            - ₹{lvl.maxInvestment.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-amber-400 font-normal ml-1">+</span>
                        )}
                      </div>
                    </td>

                    {/* Daily Yield Bonus */}
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-orange-950/60 text-orange-400 border border-orange-800/40 font-mono font-bold text-[11px]">
                        +{lvl.dailyBonusRate || 0}%
                      </span>
                    </td>

                    {/* Fee Discount */}
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono font-bold text-[11px]">
                        {lvl.withdrawalFeeDiscount ? `${lvl.withdrawalFeeDiscount}% OFF` : '0%'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleActive(lvl)}
                        className={`px-2.5 py-1 rounded-full text-[10.5px] font-extrabold cursor-pointer border transition-colors ${
                          lvl.isActive
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/60'
                            : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
                        }`}
                      >
                        {lvl.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(lvl)}
                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors cursor-pointer"
                          title="Edit VIP Level"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(lvl)}
                          className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-800/40 transition-colors cursor-pointer"
                          title="Delete VIP Level"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Create / Edit VIP Level Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#161b22] border border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-[#0d1117]/60">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#FF6000]" />
                <span>{editingLevel ? `Edit ${editingLevel.badgeText}` : 'Create New VIP Level'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveLevel} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Level Number</label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={formLevelNumber}
                    onChange={(e) => setFormLevelNumber(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-gray-700 text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Badge Text</label>
                  <input
                    type="text"
                    value={formBadgeText}
                    onChange={(e) => setFormBadgeText(e.target.value)}
                    placeholder="e.g. VIP 1"
                    className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-gray-700 text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">Tier Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. VIP 1 - Bronze Member"
                  className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-gray-700 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Min Investment (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formMinInvestment}
                    onChange={(e) => setFormMinInvestment(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-gray-700 text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Max Investment (₹, optional)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formMaxInvestment}
                    onChange={(e) => setFormMaxInvestment(e.target.value)}
                    placeholder="Leave empty for unlimited"
                    className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-gray-700 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Daily Bonus (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={formDailyBonusRate}
                    onChange={(e) => setFormDailyBonusRate(e.target.value)}
                    placeholder="e.g. 2"
                    className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-gray-700 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Fee Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={formWithdrawalFeeDiscount}
                    onChange={(e) => setFormWithdrawalFeeDiscount(e.target.value)}
                    placeholder="e.g. 1"
                    className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-gray-700 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Icon Style</label>
                  <select
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-gray-700 text-white cursor-pointer"
                  >
                    <option value="crown">Crown</option>
                    <option value="award">Award / Medal</option>
                    <option value="shield">Shield</option>
                    <option value="zap">Zap / Lightning</option>
                    <option value="gem">Gem / Diamond</option>
                    <option value="star">Star</option>
                    <option value="user">User</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Short marketing description of tier..."
                  className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-gray-700 text-white"
                />
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">
                  Privileges & Benefits (one per line)
                </label>
                <textarea
                  rows={3}
                  value={formBenefits}
                  onChange={(e) => setFormBenefits(e.target.value)}
                  placeholder="+2% Daily Device Earnings Boost&#10;Priority Recharge Confirmation"
                  className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-gray-700 text-white font-sans"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-gray-300 font-medium">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-[#FF6000] focus:ring-0 bg-[#0d1117] border-gray-700"
                  />
                  <span>Active & Visible to Members</span>
                </label>

                <div>
                  <label className="text-gray-400 font-medium mr-2">Display Order:</label>
                  <input
                    type="number"
                    value={formDisplayOrder}
                    onChange={(e) => setFormDisplayOrder(parseInt(e.target.value) || 0)}
                    className="w-16 px-2 py-1 rounded-lg bg-[#0d1117] border border-gray-700 text-white font-mono text-center"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF6000] to-[#FF8C00] hover:opacity-90 text-white font-extrabold shadow-lg shadow-orange-950/50 flex items-center gap-2 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingLevel ? 'Save Changes' : 'Create Level'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
