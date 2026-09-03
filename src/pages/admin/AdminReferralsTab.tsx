import React, { useState, useEffect } from 'react';
import {
  Gift,
  Users,
  TrendingUp,
  Award,
  RefreshCw,
  Loader2,
  Share2,
  Save,
  CheckCircle2,
  AlertCircle,
  Zap,
  Percent,
  Calendar,
  Layers,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import { fetchAdminReferralData, updateReferralSettings } from '../../services/api';
import { defaultReferralSettings } from '../../data/mockData';
import { ReferralSettings, ReferralRewardLog } from '../../types';

interface AdminReferralsTabProps {
  onShowToast: (msg: string) => void;
}

export const AdminReferralsTab: React.FC<AdminReferralsTabProps> = ({
  onShowToast,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ReferralSettings>(defaultReferralSettings);
  const [stats, setStats] = useState({
    totalReferrals: 0,
    totalCommissionsPaid: 0,
    registrationRewardsPaid: 0,
    streakRewardsPaid: 0,
    topupCommissionsPaid: 0,
    activeReferrersCount: 0,
  });
  const [members, setMembers] = useState<any[]>([]);
  const [rewardsHistory, setRewardsHistory] = useState<ReferralRewardLog[]>([]);
  const [activeView, setActiveView] = useState<'SETTINGS' | 'MEMBERS' | 'LEDGER'>('SETTINGS');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminReferralData();
      setSettings(data.settings);
      setStats(data.stats);
      setMembers(data.members);
      setRewardsHistory(data.rewardsHistory);
    } catch (e: any) {
      onShowToast(e.message || 'Error loading referral data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const updated = await updateReferralSettings(settings, 'adm_master_01');
      setSettings(updated);
      onShowToast('Referral reward rules & rates saved successfully!');
    } catch (e: any) {
      onShowToast(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTierChange = (tierNumber: number, field: string, value: any) => {
    const updatedTiers = settings.topupTiers.map((t) => {
      if (t.tier === tierNumber) {
        return { ...t, [field]: value };
      }
      return t;
    });
    setSettings({ ...settings, topupTiers: updatedTiers });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-pink-400" />
              Dynamic Referral Reward System & Multi-Tier Affiliate Engine
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Configure registration bonuses, consecutive daily claim rewards, and multi-tier top-up commission rates dynamically.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-[#FF6000] hover:bg-[#e05300] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Rules</span>
            </button>
          </div>
        </div>

        {/* 5 Dynamic Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-5">
          <div className="bg-[#0d1117] p-3.5 rounded-xl border border-gray-800">
            <div className="text-[11px] text-gray-400 font-medium">Total Network Invites</div>
            <div className="text-xl font-extrabold text-pink-400 mt-1">{stats.totalReferrals} Active</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{stats.activeReferrersCount} Active Referrers</div>
          </div>

          <div className="bg-[#0d1117] p-3.5 rounded-xl border border-gray-800">
            <div className="text-[11px] text-gray-400 font-medium">Total Rewards Paid</div>
            <div className="text-xl font-extrabold text-emerald-400 mt-1">₹{stats.totalCommissionsPaid.toFixed(2)}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Credited to user wallets</div>
          </div>

          <div className="bg-[#0d1117] p-3.5 rounded-xl border border-gray-800">
            <div className="text-[11px] text-gray-400 font-medium">Registration Rewards</div>
            <div className="text-xl font-extrabold text-blue-400 mt-1">₹{stats.registrationRewardsPaid.toFixed(2)}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Rule 1 (First Login)</div>
          </div>

          <div className="bg-[#0d1117] p-3.5 rounded-xl border border-gray-800">
            <div className="text-[11px] text-gray-400 font-medium">Streak Claim Rewards</div>
            <div className="text-xl font-extrabold text-purple-400 mt-1">₹{stats.streakRewardsPaid.toFixed(2)}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Rule 2 (Consecutive Claims)</div>
          </div>

          <div className="bg-[#0d1117] p-3.5 rounded-xl border border-gray-800">
            <div className="text-[11px] text-gray-400 font-medium">Top-up Commissions</div>
            <div className="text-xl font-extrabold text-amber-400 mt-1">₹{stats.topupCommissionsPaid.toFixed(2)}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Rule 3 (Multi-Tier)</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveView('SETTINGS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
            activeView === 'SETTINGS'
              ? 'bg-[#FF6000] text-white'
              : 'bg-gray-800/60 text-gray-400 hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Reward Rules & Tier Settings</span>
        </button>
        <button
          onClick={() => setActiveView('MEMBERS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
            activeView === 'MEMBERS'
              ? 'bg-[#FF6000] text-white'
              : 'bg-gray-800/60 text-gray-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Affiliate Network ({members.length})</span>
        </button>
        <button
          onClick={() => setActiveView('LEDGER')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors ${
            activeView === 'LEDGER'
              ? 'bg-[#FF6000] text-white'
              : 'bg-gray-800/60 text-gray-400 hover:text-white'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Live Reward Ledger ({rewardsHistory.length})</span>
        </button>
      </div>

      {/* VIEW 1: REWARD RULES & TIER SETTINGS */}
      {activeView === 'SETTINGS' && (
        <div className="space-y-5">
          {/* Master Switch Card */}
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[#FF6000] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Global Referral Engine Status</h3>
                <p className="text-xs text-gray-400">Master switch to enable or pause all referral reward distribution.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.isReferralSystemEnabled}
                onChange={(e) => setSettings({ ...settings, isReferralSystemEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF6000]"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Rule 1: Registration Reward */}
            <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">1. Registration Reward</h3>
                    <span className="text-[10px] text-blue-400 font-mono">Trigger: First Registration & Login</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.registrationReward?.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        registrationReward: { ...settings.registrationReward, enabled: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Reward Amount (₹) per new invited member:
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={settings.registrationReward?.rewardAmount || 0}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          registrationReward: {
                            ...settings.registrationReward,
                            rewardAmount: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full bg-[#0d1117] border border-gray-800 rounded-xl pl-8 pr-4 py-2 text-sm text-white focus:border-blue-500 outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    Default: ₹5. Credited automatically to referrer wallet once new user registers and logs in.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Description / UI Note:</label>
                  <input
                    type="text"
                    value={settings.registrationReward?.description || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        registrationReward: {
                          ...settings.registrationReward,
                          description: e.target.value,
                        },
                      })
                    }
                    className="w-full bg-[#0d1117] border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Rule 2: Consecutive Daily Claim Reward */}
            <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">2. Consecutive Claim Reward</h3>
                    <span className="text-[10px] text-purple-400 font-mono">Trigger: Daily Streak Claim</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.streakReward?.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        streakReward: { ...settings.streakReward, enabled: e.target.checked },
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">Streak Days:</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={settings.streakReward?.consecutiveDays ?? 2}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          streakReward: {
                            ...settings.streakReward,
                            consecutiveDays: Math.max(1, Number(e.target.value)),
                          },
                        })
                      }
                      className="w-full bg-[#0d1117] border border-gray-800 rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">Reward (₹):</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500 font-bold text-sm">₹</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={settings.streakReward?.rewardAmount || 0}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            streakReward: {
                              ...settings.streakReward,
                              rewardAmount: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full bg-[#0d1117] border border-gray-800 rounded-xl pl-7 pr-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">Description / UI Note:</label>
                  <input
                    type="text"
                    value={settings.streakReward?.description || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        streakReward: {
                          ...settings.streakReward,
                          description: e.target.value,
                        },
                      })
                    }
                    className="w-full bg-[#0d1117] border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Rule 3: Dynamic Multi-Tier Top-Up Commission Rules */}
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-[#FF6000] flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">3. Multi-Tier Top-Up Commission Structure</h3>
                  <p className="text-xs text-gray-400">Triggered strictly when Admin approves a user Recharge.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Example Top-up Base:</span>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-gray-500 text-xs font-bold">₹</span>
                  <input
                    type="number"
                    min={100}
                    step={1000}
                    value={settings.exampleTopupAmount || 100000}
                    onChange={(e) => setSettings({ ...settings, exampleTopupAmount: Number(e.target.value) })}
                    className="w-32 bg-[#0d1117] border border-gray-700 rounded-lg pl-6 pr-2 py-1 text-xs text-white outline-none focus:border-[#FF6000]"
                  />
                </div>
              </div>
            </div>

            {/* 3 Tier Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {settings.topupTiers.map((tier) => {
                const examplePayout = ((settings.exampleTopupAmount || 100000) * tier.percentage) / 100;
                return (
                  <div
                    key={tier.tier}
                    className="bg-[#0d1117] border border-gray-800 rounded-xl p-4 space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-orange-500/20 text-[#FF6000] font-bold text-xs flex items-center justify-center">
                          {tier.tier}
                        </span>
                        <h4 className="text-xs font-bold text-white">{tier.name}</h4>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tier.enabled}
                          onChange={(e) => handleTierChange(tier.tier, 'enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#FF6000]"></div>
                      </label>
                    </div>

                    <div>
                      <label className="text-[11px] text-gray-400 font-medium block mb-1">Commission Rate (%):</label>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={tier.percentage}
                          onChange={(e) => handleTierChange(tier.tier, 'percentage', Number(e.target.value))}
                          className="w-full bg-[#161b22] border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white font-bold outline-none focus:border-[#FF6000]"
                        />
                        <span className="absolute right-3 top-2 text-gray-500 font-bold text-xs">%</span>
                      </div>
                    </div>

                    {/* Calculated Preview */}
                    <div className="bg-[#161b22]/70 p-2.5 rounded-lg border border-gray-800 text-[11px] text-gray-300">
                      <div className="text-gray-400">On ₹{(settings.exampleTopupAmount || 100000).toLocaleString('en-IN')}:</div>
                      <div className="text-sm font-extrabold text-[#FF6000] mt-0.5">
                        ₹{examplePayout.toLocaleString('en-IN')} Payout
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: AFFILIATE NETWORK MEMBERS */}
      {activeView === 'MEMBERS' && (
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#FF6000]" />
              Platform Referral Network & Member Downlines
            </h3>
            <span className="text-xs text-gray-400">{members.length} Registered Accounts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#0d1117] text-gray-400 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-800">
                <tr>
                  <th className="py-3.5 px-4">Member Name & Mobile</th>
                  <th className="py-3.5 px-4">Invitation Code</th>
                  <th className="py-3.5 px-4">Direct Referrer</th>
                  <th className="py-3.5 px-4">Direct Invites</th>
                  <th className="py-3.5 px-4">Commissions Earned</th>
                  <th className="py-3.5 px-4">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF6000]" />
                      <span>Loading referral network...</span>
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500">
                      No members found.
                    </td>
                  </tr>
                ) : (
                  members.map((u) => (
                    <tr key={u.userId} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{u.username || 'User'}</div>
                        <div className="text-[10px] text-gray-500 font-mono">+91 {u.mobile}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-pink-400">
                        {u.referralCode}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-300">
                        {u.referredBy && u.referredBy !== 'None (Direct)' ? (
                          <span className="bg-gray-800 px-2 py-0.5 rounded text-[11px]">
                            {u.referredBy}
                          </span>
                        ) : (
                          <span className="text-gray-600 italic">Organic Direct</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {u.directInvites} Members
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        ₹{u.totalCommissionEarned.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-gray-400 font-mono text-[10.5px]">
                        {u.joined}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: LIVE REWARD LEDGER */}
      {activeView === 'LEDGER' && (
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              Live Referral Reward Distribution Audit Ledger
            </h3>
            <span className="text-xs text-gray-400">{rewardsHistory.length} Transactions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#0d1117] text-gray-400 text-[11px] font-semibold uppercase tracking-wider border-b border-gray-800">
                <tr>
                  <th className="py-3.5 px-4">Date / Time</th>
                  <th className="py-3.5 px-4">Reward Type</th>
                  <th className="py-3.5 px-4">Referee (Downline)</th>
                  <th className="py-3.5 px-4">Referrer (Recipient)</th>
                  <th className="py-3.5 px-4">Amount Credited</th>
                  <th className="py-3.5 px-4">Description / Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {rewardsHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500">
                      No referral rewards distributed yet.
                    </td>
                  </tr>
                ) : (
                  rewardsHistory.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 px-4 text-gray-400 font-mono text-[10.5px]">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            r.rewardType === 'REGISTRATION'
                              ? 'bg-blue-900/60 text-blue-300 border border-blue-800'
                              : r.rewardType === 'CONSECUTIVE_CLAIM'
                              ? 'bg-purple-900/60 text-purple-300 border border-purple-800'
                              : 'bg-emerald-900/60 text-emerald-300 border border-emerald-800'
                          }`}
                        >
                          {r.rewardType === 'REGISTRATION'
                            ? 'REGISTRATION'
                            : r.rewardType === 'CONSECUTIVE_CLAIM'
                            ? 'STREAK CLAIM'
                            : `TIER ${r.tier || 1} TOP-UP`}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-white">{r.refereeUsername || r.refereeMobile || r.refereeUserId}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-300">
                        {r.referrerUserId}
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        +₹{r.amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-[11px]">
                        {r.description}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
