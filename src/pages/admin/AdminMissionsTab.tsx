import React, { useState, useEffect } from 'react';
import {
  Target,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Users,
  Trophy,
  Crown,
  Zap,
  Gift,
  Award,
  RefreshCw,
  Search,
  Check,
  AlertTriangle,
  FileSpreadsheet,
  Coins,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';
import { Mission, MissionClaim, AdminMissionStats, CreateMissionPayload } from '../../types';
import {
  fetchMissions,
  createMission,
  updateMission,
  deleteMission,
  toggleMissionStatus,
  reorderMissions,
  fetchAdminMissionStats,
  fetchAdminMissionClaims,
} from '../../services/api';

interface AdminMissionsTabProps {
  adminId: string;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const AVAILABLE_ICONS = [
  { name: 'Target', label: 'Target', icon: Target },
  { name: 'Users', label: 'Users', icon: Users },
  { name: 'Trophy', label: 'Trophy', icon: Trophy },
  { name: 'Crown', label: 'Crown', icon: Crown },
  { name: 'Zap', label: 'Zap', icon: Zap },
  { name: 'Gift', label: 'Gift', icon: Gift },
  { name: 'Sparkles', label: 'Sparkles', icon: Sparkles },
  { name: 'Award', label: 'Award', icon: Award },
];

export const AdminMissionsTab: React.FC<AdminMissionsTabProps> = ({
  adminId,
  onShowToast,
}) => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [claims, setClaims] = useState<MissionClaim[]>([]);
  const [stats, setStats] = useState<AdminMissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'MISSIONS' | 'CLAIMS'>('MISSIONS');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [deletingMission, setDeletingMission] = useState<Mission | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CreateMissionPayload>({
    title: '',
    description: '',
    requiredReferrals: 1,
    rewardAmount: 50,
    walletType: 'WITHDRAW_WALLET',
    icon: 'Target',
    status: 'ACTIVE',
    displayOrder: 1,
  });

  const loadData = async (isManual: boolean = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [allMissions, statsData, claimsData] = await Promise.all([
        fetchMissions(true),
        fetchAdminMissionStats(),
        fetchAdminMissionClaims(),
      ]);
      setMissions(allMissions);
      setStats(statsData);
      setClaims(claimsData);
      if (isManual) {
        onShowToast('Missions data refreshed', 'success');
      }
    } catch (err: any) {
      console.error('Failed to load admin missions:', err);
      onShowToast(err.message || 'Failed to load missions data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateModal = () => {
    setFormData({
      title: '',
      description: '',
      requiredReferrals: 1,
      rewardAmount: 50,
      walletType: 'WITHDRAW_WALLET',
      icon: 'Target',
      status: 'ACTIVE',
      displayOrder: missions.length + 1,
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (mission: Mission) => {
    setEditingMission(mission);
    setFormData({
      title: mission.title,
      description: mission.description || '',
      requiredReferrals: mission.requiredReferrals,
      rewardAmount: mission.rewardAmount,
      walletType: 'WITHDRAW_WALLET',
      icon: mission.icon || 'Target',
      status: mission.status,
      displayOrder: mission.displayOrder || 1,
    });
  };

  const handleSaveMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      onShowToast('Please enter a valid mission title', 'error');
      return;
    }
    if (formData.requiredReferrals <= 0) {
      onShowToast('Required active referrals must be at least 1', 'error');
      return;
    }
    if (formData.rewardAmount <= 0) {
      onShowToast('Reward amount must be greater than 0', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (editingMission) {
        await updateMission(editingMission.id, formData, adminId);
        onShowToast(`Mission "${formData.title}" updated successfully`, 'success');
        setEditingMission(null);
      } else {
        await createMission(formData, adminId);
        onShowToast(`Mission "${formData.title}" created successfully`, 'success');
        setIsCreateModalOpen(false);
      }
      await loadData();
    } catch (err: any) {
      console.error('Save mission error:', err);
      onShowToast(err.message || 'Failed to save mission', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingMission) return;
    setSubmitting(true);
    try {
      await deleteMission(deletingMission.id, adminId);
      onShowToast(`Mission "${deletingMission.title}" deleted`, 'success');
      setDeletingMission(null);
      await loadData();
    } catch (err: any) {
      console.error('Delete mission error:', err);
      onShowToast(err.message || 'Failed to delete mission', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (mission: Mission) => {
    const nextStatus = mission.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await toggleMissionStatus(mission.id, nextStatus, adminId);
      onShowToast(`Mission is now ${nextStatus}`, 'success');
      await loadData();
    } catch (err: any) {
      console.error('Toggle status error:', err);
      onShowToast(err.message || 'Failed to toggle status', 'error');
    }
  };

  const handleMoveOrder = async (index: number, direction: 'UP' | 'DOWN') => {
    const newMissions = [...missions];
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newMissions.length) return;

    const temp = newMissions[index];
    newMissions[index] = newMissions[targetIdx];
    newMissions[targetIdx] = temp;

    setMissions(newMissions);
    const orderedIds = newMissions.map((m) => m.id);
    try {
      await reorderMissions(orderedIds, adminId);
      onShowToast('Missions reordered successfully', 'success');
      await loadData();
    } catch (err: any) {
      console.error('Reorder error:', err);
      onShowToast('Failed to save order change', 'error');
    }
  };

  const filteredMissions = missions.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus =
      statusFilter === 'ALL' || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredClaims = claims.filter((c) => {
    return (
      c.missionTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.userMobile && c.userMobile.includes(searchQuery)) ||
      (c.username && c.username.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const renderIconComponent = (iconName?: string) => {
    const found = AVAILABLE_ICONS.find((i) => i.name.toLowerCase() === iconName?.toLowerCase());
    const IconComp = found ? found.icon : Target;
    return <IconComp className="w-4.5 h-4.5" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header with Title, Actions & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#161b22] border border-gray-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#FF6000] to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-950/40">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-xl text-white tracking-tight">
                Mission Bonus Manager
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-950 text-orange-400 border border-orange-800/40">
                DYNAMIC
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Configure referral reward milestones credited straight to Withdraw Wallets upon 1st plan purchase.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white transition-all cursor-pointer"
            title="Refresh Missions"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#FF6000]' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6000] to-[#FF8C00] hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-orange-900/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Mission</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-[#161b22] border border-gray-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-1">
            <span>Total Missions</span>
            <Target className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats?.totalMissions || 0}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Configured Tiers</div>
        </div>

        <div className="bg-[#161b22] border border-gray-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-1">
            <span>Active Missions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{stats?.activeMissions || 0}</div>
          <div className="text-[11px] text-emerald-500/70 mt-0.5">Live for users</div>
        </div>

        <div className="bg-[#161b22] border border-gray-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-1">
            <span>Completed Claims</span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{stats?.completedClaims || 0}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Successful claims</div>
        </div>

        <div className="bg-[#161b22] border border-gray-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-1">
            <span>Total Bonus Distributed</span>
            <Coins className="w-4 h-4 text-[#FF6000]" />
          </div>
          <div className="text-2xl font-black text-[#FF6000]">
            ₹{stats?.totalBonusDistributed?.toLocaleString() || 0}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">Credited to Withdraw Wallets</div>
        </div>
      </div>

      {/* 3. Sub Tabs & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#161b22] border border-gray-800 p-3 rounded-xl">
        <div className="flex bg-[#0d1117] p-1 rounded-lg gap-1">
          <button
            onClick={() => setActiveSubTab('MISSIONS')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'MISSIONS'
                ? 'bg-[#FF6000] text-white shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Missions List ({missions.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('CLAIMS')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'CLAIMS'
                ? 'bg-[#FF6000] text-white shadow-xs'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Claims Log ({claims.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === 'MISSIONS' && (
            <div className="flex items-center bg-[#0d1117] border border-gray-800 rounded-lg px-2 py-1">
              <span className="text-[11px] text-gray-400 font-semibold mr-1.5">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent text-xs text-gray-200 outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-gray-900 text-white">All</option>
                <option value="ACTIVE" className="bg-gray-900 text-white">Active Only</option>
                <option value="DISABLED" className="bg-gray-900 text-white">Disabled Only</option>
              </select>
            </div>
          )}

          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={activeSubTab === 'MISSIONS' ? 'Search missions...' : 'Search claims / users...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0d1117] border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-[#FF6000] outline-none"
            />
          </div>
        </div>
      </div>

      {/* 4. Tab 1: Missions List Table */}
      {activeSubTab === 'MISSIONS' && (
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="py-16 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#FF6000]" />
              <span className="text-xs">Loading missions database...</span>
            </div>
          ) : filteredMissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-[#0d1117] text-gray-400 uppercase font-black tracking-wider text-[10px] border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Mission Details</th>
                    <th className="py-3 px-4 text-center">Required L1 Active</th>
                    <th className="py-3 px-4">Reward Amount</th>
                    <th className="py-3 px-4">Wallet Type</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filteredMissions.map((mission, index) => (
                    <tr
                      key={mission.id}
                      className="hover:bg-gray-800/30 transition-colors group"
                    >
                      {/* Order Controls */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <button
                            onClick={() => handleMoveOrder(index, 'UP')}
                            disabled={index === 0}
                            className={`p-0.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-all cursor-pointer ${
                              index === 0 ? 'opacity-20 cursor-not-allowed' : ''
                            }`}
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <span className="font-mono text-[11px] font-bold text-gray-400">
                            {mission.displayOrder || index + 1}
                          </span>
                          <button
                            onClick={() => handleMoveOrder(index, 'DOWN')}
                            disabled={index === missions.length - 1}
                            className={`p-0.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-all cursor-pointer ${
                              index === missions.length - 1 ? 'opacity-20 cursor-not-allowed' : ''
                            }`}
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Title & Description */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              mission.status === 'ACTIVE'
                                ? 'bg-orange-950/60 text-[#FF6000] border border-orange-800/40'
                                : 'bg-gray-800 text-gray-500 border border-gray-700'
                            }`}
                          >
                            {renderIconComponent(mission.icon)}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm flex items-center gap-2">
                              <span>{mission.title}</span>
                              {mission.status === 'DISABLED' && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-gray-800 text-gray-400 border border-gray-700 uppercase font-semibold">
                                  Disabled
                                </span>
                              )}
                            </div>
                            <p className="text-gray-400 text-[11px] mt-0.5 max-w-sm line-clamp-1">
                              {mission.description || `Requires ${mission.requiredReferrals} active friends with 1st plan`}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Required Referrals */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/60 text-blue-300 border border-blue-800/40 font-bold">
                          <Users className="w-3.5 h-3.5" />
                          <span>{mission.requiredReferrals} Friends</span>
                        </div>
                      </td>

                      {/* Reward Amount */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-black text-sm">
                          <span>₹{mission.rewardAmount}</span>
                        </div>
                      </td>

                      {/* Wallet Type */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-800 text-amber-300 border border-gray-700">
                          Withdraw Wallet
                        </span>
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(mission)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                            mission.status === 'ACTIVE'
                              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/60'
                              : 'bg-red-950/60 text-red-400 border-red-800/40 hover:bg-red-900/60'
                          }`}
                        >
                          {mission.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(mission)}
                            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-all cursor-pointer"
                            title="Edit Mission"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingMission(mission)}
                            className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/70 text-red-400 hover:text-red-300 transition-all cursor-pointer"
                            title="Delete Mission"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-gray-500">
              <Target className="w-12 h-12 text-gray-700 mx-auto mb-2" />
              <p className="font-bold text-gray-300 text-sm">No missions found</p>
              <p className="text-xs text-gray-500 mt-1">Create your first mission using the button above.</p>
            </div>
          )}
        </div>
      )}

      {/* 5. Tab 2: Claims History Log */}
      {activeSubTab === 'CLAIMS' && (
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          {filteredClaims.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-[#0d1117] text-gray-400 uppercase font-black tracking-wider text-[10px] border-b border-gray-800">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Mission Title</th>
                    <th className="py-3 px-4">Reward Amount</th>
                    <th className="py-3 px-4">Wallet Type</th>
                    <th className="py-3 px-4">Claim Date & Time</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filteredClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{claim.username || 'Member'}</div>
                        <div className="text-[11px] text-gray-400">{claim.userMobile || claim.userId}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-200">
                        {claim.missionTitle}
                      </td>
                      <td className="py-3 px-4 font-black text-emerald-400 text-sm">
                        +₹{claim.rewardAmount}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-800 text-amber-300 border border-gray-700">
                          Withdraw Wallet
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        {new Date(claim.claimedAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                          Completed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-gray-500">
              <Clock className="w-12 h-12 text-gray-700 mx-auto mb-2" />
              <p className="font-bold text-gray-300 text-sm">No mission claims recorded</p>
              <p className="text-xs text-gray-500 mt-1">Users will appear here once they complete and claim mission bonuses.</p>
            </div>
          )}
        </div>
      )}

      {/* 6. Create / Edit Mission Modal Form */}
      {(isCreateModalOpen || editingMission) && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-8">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#0d1117] border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FF6000]/20 text-[#FF6000] flex items-center justify-center">
                  <Target className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-extrabold text-white text-base">
                  {editingMission ? 'Edit Mission Tier' : 'Create New Mission Tier'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingMission(null);
                }}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveMission} className="p-6 space-y-4">
              {/* Mission Title */}
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Mission Name / Title <span className="text-[#FF6000]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Invite 3 Active Friends"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-[#0d1117] border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:border-[#FF6000] outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Description / Condition
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Invite 3 friends who purchase their first eligible power bank plan."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#0d1117] border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:border-[#FF6000] outline-none resize-none"
                />
              </div>

              {/* 2-Column: Required Referrals & Reward Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Required Active L1 Referrals <span className="text-[#FF6000]">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formData.requiredReferrals}
                    onChange={(e) =>
                      setFormData({ ...formData, requiredReferrals: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                    className="w-full bg-[#0d1117] border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[#FF6000] outline-none font-bold"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    Direct friends with 1st plan
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Reward Amount (₹) <span className="text-[#FF6000]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formData.rewardAmount}
                      onChange={(e) =>
                        setFormData({ ...formData, rewardAmount: Math.max(1, parseFloat(e.target.value) || 1) })
                      }
                      className="w-full bg-[#0d1117] border border-gray-800 rounded-xl pl-7 pr-3.5 py-2.5 text-xs text-white focus:border-[#FF6000] outline-none font-black text-emerald-400"
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    Deposited on claim
                  </span>
                </div>
              </div>

              {/* Locked Wallet Type & Display Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Reward Destination Wallet
                  </label>
                  <div className="w-full bg-[#0d1117]/80 border border-amber-900/50 rounded-xl px-3.5 py-2.5 text-xs text-amber-300 font-bold flex items-center justify-between">
                    <span>Withdraw Wallet</span>
                    <span className="text-[10px] text-gray-500 uppercase">Fixed</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.displayOrder}
                    onChange={(e) =>
                      setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 1 })
                    }
                    className="w-full bg-[#0d1117] border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[#FF6000] outline-none"
                  />
                </div>
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-2">
                  Select Visual Badge Icon
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {AVAILABLE_ICONS.map((item) => {
                    const isSelected = formData.icon?.toLowerCase() === item.name.toLowerCase();
                    const IconComp = item.icon;
                    return (
                      <button
                        type="button"
                        key={item.name}
                        onClick={() => setFormData({ ...formData, icon: item.name })}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#FF6000]/20 border-[#FF6000] text-[#FF6000]'
                            : 'bg-[#0d1117] border-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        <IconComp className="w-5 h-5" />
                        <span className="text-[10px] font-semibold">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Toggle */}
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Mission Status
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'ACTIVE' })}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      formData.status === 'ACTIVE'
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                        : 'bg-[#0d1117] border-gray-800 text-gray-400'
                    }`}
                  >
                    Active (Visible to users)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'DISABLED' })}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      formData.status === 'DISABLED'
                        ? 'bg-red-950/80 border-red-500 text-red-300'
                        : 'bg-[#0d1117] border-gray-800 text-gray-400'
                    }`}
                  >
                    Disabled (Hidden)
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-gray-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingMission(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6000] to-amber-500 hover:brightness-110 active:scale-95 text-white font-extrabold text-xs shadow-lg shadow-orange-950/40 flex items-center gap-2 transition-all cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{editingMission ? 'Update Mission' : 'Create Mission'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Delete Confirmation Modal */}
      {deletingMission && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#161b22] border border-red-900/50 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-red-950/80 text-red-400 border border-red-800/40 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-white text-base">Delete Mission?</h3>
            <p className="text-xs text-gray-400 mt-1">
              Are you sure you want to delete <strong className="text-white">"{deletingMission.title}"</strong>?
            </p>
            <div className="my-3 p-2.5 bg-gray-900/80 rounded-xl border border-gray-800 text-[11px] text-gray-400 text-left">
              ✓ Past claimed rewards remain safely preserved in user transaction history.
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setDeletingMission(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-900/30 cursor-pointer"
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
