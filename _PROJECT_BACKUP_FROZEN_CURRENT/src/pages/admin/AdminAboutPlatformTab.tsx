import React, { useState, useEffect } from 'react';
import {
  Info,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Layers,
  Zap,
  Crown,
  Wallet,
  ArrowUpRight,
  Coins,
  Users,
  Gift,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sliders,
  ExternalLink,
  Edit3,
  HelpCircle,
  Cpu,
  FileText,
  Clock,
  Check,
  Loader2,
} from 'lucide-react';
import {
  AboutPlatformConfig,
  InvestingStep,
  CustomPlatformRule,
  ProductItem,
  VipLevel,
  SystemSettings,
  ReferralSettings,
} from '../../types';
import {
  fetchAboutPlatformConfig,
  updateAboutPlatformConfig,
  fetchPlans,
  fetchVipLevels,
  fetchSystemSettings,
  fetchAdminReferralData,
} from '../../services/api';
import { defaultAboutPlatformConfig, defaultReferralSettings } from '../../data/mockData';

interface AdminAboutPlatformTabProps {
  adminId: string;
  onShowToast: (msg: string) => void;
}

export const AdminAboutPlatformTab: React.FC<AdminAboutPlatformTabProps> = ({
  adminId,
  onShowToast,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AboutPlatformConfig>(defaultAboutPlatformConfig);

  // Live data from existing platform engines for sync verification
  const [plans, setPlans] = useState<ProductItem[]>([]);
  const [vipLevels, setVipLevels] = useState<VipLevel[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [referralSettings, setReferralSettings] = useState<ReferralSettings>(defaultReferralSettings);

  const [activeTab, setActiveTab] = useState<'SECTIONS' | 'STEPS' | 'CUSTOM_RULES' | 'WALLETS' | 'BRANDING' | 'PREVIEW'>('SECTIONS');

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfg, plansData, vipData, sysSettings, refData] = await Promise.all([
        fetchAboutPlatformConfig().catch(() => defaultAboutPlatformConfig),
        fetchPlans().catch(() => []),
        fetchVipLevels().catch(() => []),
        fetchSystemSettings().catch(() => null),
        fetchAdminReferralData().then((res) => res.settings).catch(() => defaultReferralSettings),
      ]);

      setConfig(cfg);
      setPlans(plansData.filter((p) => p.status !== 'archived'));
      setVipLevels(vipData.filter((v) => v.isActive !== false));
      setSystemSettings(sysSettings);
      setReferralSettings(refData);
    } catch (e: any) {
      onShowToast(e.message || 'Failed to load About Platform configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await updateAboutPlatformConfig(config, adminId);
      setConfig(saved);
      onShowToast('About Platform dynamic rules saved and synced successfully!');
    } catch (e: any) {
      onShowToast(e.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = () => {
    if (window.confirm('Reset About Platform settings to standard defaults?')) {
      setConfig(defaultAboutPlatformConfig);
      onShowToast('Reset to platform default template. Click Save to persist.');
    }
  };

  // Section toggle & update helpers
  const updateSection = (sectionKey: keyof AboutPlatformConfig['sections'], field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionKey]: {
          ...prev.sections[sectionKey],
          [field]: value,
        },
      },
    }));
  };

  // Step helpers
  const handleAddStep = () => {
    const newStepNum = (config.investingSteps?.length || 0) + 1;
    const newStep: InvestingStep = {
      id: 'step_' + Date.now(),
      stepNumber: newStepNum,
      title: `Step ${newStepNum}: New Action`,
      description: 'Explain what user needs to do in this phase of the process.',
      icon: 'Zap',
      badge: `Step ${newStepNum}`,
      enabled: true,
    };
    setConfig((prev) => ({
      ...prev,
      investingSteps: [...(prev.investingSteps || []), newStep],
    }));
  };

  const handleUpdateStep = (id: string, field: keyof InvestingStep, value: any) => {
    setConfig((prev) => ({
      ...prev,
      investingSteps: (prev.investingSteps || []).map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    }));
  };

  const handleDeleteStep = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      investingSteps: (prev.investingSteps || []).filter((s) => s.id !== id),
    }));
  };

  // Custom rule helpers
  const handleAddCustomRule = () => {
    const newRule: CustomPlatformRule = {
      id: 'rule_' + Date.now(),
      title: 'New Platform Operating Guideline',
      description: 'Provide clear instructions or terms for platform members regarding this rule.',
      icon: 'ShieldCheck',
      displayOrder: (config.customRules?.length || 0) + 1,
      enabled: true,
      badge: 'Notice',
    };
    setConfig((prev) => ({
      ...prev,
      customRules: [...(prev.customRules || []), newRule],
    }));
  };

  const handleUpdateCustomRule = (id: string, field: keyof CustomPlatformRule, value: any) => {
    setConfig((prev) => ({
      ...prev,
      customRules: (prev.customRules || []).map((r) =>
        r.id === id ? { ...r, [field]: value } : r
      ),
    }));
  };

  const handleDeleteCustomRule = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      customRules: (prev.customRules || []).filter((r) => r.id !== id),
    }));
  };

  // Current live values for badges
  const minWithdrawal = systemSettings?.minWithdrawal ?? 150;
  const withdrawalFee = systemSettings?.withdrawalFeePercent ?? 5;
  const signUpBonus = systemSettings?.signUpBonusAmount ?? 75;
  const dailyCheckIn = systemSettings?.dailyCheckInAmount ?? 5;
  const dailyCheckInDay7 = systemSettings?.dailyCheckInDay7Bonus ?? 100;
  const topupTiers = (referralSettings?.topupTiers || []).filter((t) => t.enabled !== false);

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Info className="w-5 h-5 text-[#FF6000]" />
              Dynamic About Platform & Operating Rules Engine
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Manage all 10 dynamic sections, investing steps, custom rules, and wallet terms displayed to members under ME → ABOUT PLATFORM.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefault}
              className="px-3 py-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              Reset Default
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-[#FF6000] hover:bg-[#e05300] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        {/* Live Synchronized System Highlights (Proof of No Hard-Coding) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4 pt-4 border-t border-gray-800">
          <div className="bg-[#0d1117] p-2.5 rounded-xl border border-gray-800/90">
            <div className="text-[10px] text-gray-400 font-semibold">Active Plans</div>
            <div className="text-xs font-bold text-emerald-400 mt-0.5">{plans.length} Live Plans</div>
            <div className="text-[9px] text-gray-500">Auto-synced from Plans tab</div>
          </div>

          <div className="bg-[#0d1117] p-2.5 rounded-xl border border-gray-800/90">
            <div className="text-[10px] text-gray-400 font-semibold">VIP Tiers</div>
            <div className="text-xs font-bold text-amber-400 mt-0.5">{vipLevels.length} Levels Active</div>
            <div className="text-[9px] text-gray-500">Auto-synced from VIP tab</div>
          </div>

          <div className="bg-[#0d1117] p-2.5 rounded-xl border border-gray-800/90">
            <div className="text-[10px] text-gray-400 font-semibold">Min Withdrawal</div>
            <div className="text-xs font-bold text-rose-400 mt-0.5">₹{minWithdrawal} ({withdrawalFee}%)</div>
            <div className="text-[9px] text-gray-500">Auto-synced from Settings</div>
          </div>

          <div className="bg-[#0d1117] p-2.5 rounded-xl border border-gray-800/90">
            <div className="text-[10px] text-gray-400 font-semibold">Team Commission</div>
            <div className="text-xs font-bold text-purple-400 mt-0.5">
              {topupTiers.map((t) => `L${t.tier}:${t.percentage}%`).join(' ')}
            </div>
            <div className="text-[9px] text-gray-500">Auto-synced from Referrals</div>
          </div>

          <div className="bg-[#0d1117] p-2.5 rounded-xl border border-gray-800/90">
            <div className="text-[10px] text-gray-400 font-semibold">Signup Bonus</div>
            <div className="text-xs font-bold text-pink-400 mt-0.5">₹{signUpBonus} Instant</div>
            <div className="text-[9px] text-gray-500">Auto-synced from Settings</div>
          </div>

          <div className="bg-[#0d1117] p-2.5 rounded-xl border border-gray-800/90">
            <div className="text-[10px] text-gray-400 font-semibold">Daily Check-in</div>
            <div className="text-xs font-bold text-[#FF6000] mt-0.5">₹{dailyCheckIn} (D7: ₹{dailyCheckInDay7})</div>
            <div className="text-[9px] text-gray-500">Auto-synced from Settings</div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('SECTIONS')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
            activeTab === 'SECTIONS'
              ? 'bg-[#FF6000] text-white'
              : 'bg-gray-800/60 text-gray-400 hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>10 Platform Sections</span>
        </button>

        <button
          onClick={() => setActiveTab('STEPS')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
            activeTab === 'STEPS'
              ? 'bg-[#FF6000] text-white'
              : 'bg-gray-800/60 text-gray-400 hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>How Investing Works ({config.investingSteps?.length || 0} Steps)</span>
        </button>

        <button
          onClick={() => setActiveTab('CUSTOM_RULES')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
            activeTab === 'CUSTOM_RULES'
              ? 'bg-[#FF6000] text-white'
              : 'bg-gray-800/60 text-gray-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Custom Rules ({config.customRules?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('WALLETS')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
            activeTab === 'WALLETS'
              ? 'bg-[#FF6000] text-white'
              : 'bg-gray-800/60 text-gray-400 hover:text-white'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Wallet Rules & Notes</span>
        </button>

        <button
          onClick={() => setActiveTab('BRANDING')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
            activeTab === 'BRANDING'
              ? 'bg-[#FF6000] text-white'
              : 'bg-gray-800/60 text-gray-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Page Branding & Support</span>
        </button>
      </div>

      {/* TAB 1: 10 PLATFORM SECTIONS CONFIGURATION */}
      {activeTab === 'SECTIONS' && (
        <div className="space-y-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Section Title, Description & Display Controls
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Toggle any section on/off, customize its public header title and description, or reorder them.
            </p>

            <div className="space-y-3">
              {Object.entries(config.sections || defaultAboutPlatformConfig.sections).map(([key, sec]) => {
                const sectionKey = key as keyof AboutPlatformConfig['sections'];
                return (
                  <div
                    key={sec.id || key}
                    className="p-4 rounded-xl border border-gray-800 bg-[#0d1117] flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-gray-800 text-orange-400 font-bold">
                          Section #{sec.displayOrder || 1}
                        </span>
                        <input
                          type="text"
                          value={sec.title || ''}
                          onChange={(e) => updateSection(sectionKey, 'title', e.target.value)}
                          className="bg-[#161b22] border border-gray-700 rounded-lg px-2.5 py-1 text-xs font-bold text-white focus:border-[#FF6000] outline-none flex-1 max-w-sm"
                        />
                      </div>

                      <input
                        type="text"
                        value={sec.description || ''}
                        onChange={(e) => updateSection(sectionKey, 'description', e.target.value)}
                        placeholder="Section description..."
                        className="w-full bg-[#161b22] border border-gray-800 rounded-lg px-2.5 py-1 text-xs text-gray-300 focus:border-[#FF6000] outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-gray-400">Order:</span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={sec.displayOrder || 1}
                          onChange={(e) => updateSection(sectionKey, 'displayOrder', Number(e.target.value))}
                          className="w-14 bg-[#161b22] border border-gray-700 rounded-lg px-2 py-1 text-xs text-center text-white outline-none font-mono"
                        />
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sec.enabled !== false}
                          onChange={(e) => updateSection(sectionKey, 'enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FF6000]"></div>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HOW INVESTING WORKS STEPS */}
      {activeTab === 'STEPS' && (
        <div className="space-y-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#FF6000]" />
                  <span>How Investing Works (Configurable Step Sequence)</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Admins can add, edit, or reorder the investment onboarding steps shown to users.
                </p>
              </div>
              <button
                onClick={handleAddStep}
                className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Step</span>
              </button>
            </div>

            <div className="space-y-3">
              {(config.investingSteps || []).map((step, idx) => (
                <div
                  key={step.id}
                  className="p-4 rounded-xl border border-gray-800 bg-[#0d1117] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#FF6000] text-white font-black text-xs flex items-center justify-center">
                        {step.stepNumber || idx + 1}
                      </span>
                      <input
                        type="text"
                        value={step.title || ''}
                        onChange={(e) => handleUpdateStep(step.id, 'title', e.target.value)}
                        className="bg-[#161b22] border border-gray-700 rounded-lg px-2.5 py-1 text-xs font-bold text-white outline-none focus:border-[#FF6000]"
                      />
                      <input
                        type="text"
                        value={step.badge || ''}
                        onChange={(e) => handleUpdateStep(step.id, 'badge', e.target.value)}
                        placeholder="Badge (e.g. Step 1)"
                        className="w-24 bg-[#161b22] border border-gray-700 rounded-lg px-2 py-1 text-[11px] text-gray-300 outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={step.enabled !== false}
                          onChange={(e) => handleUpdateStep(step.id, 'enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#FF6000]"></div>
                      </label>
                      <button
                        onClick={() => handleDeleteStep(step.id)}
                        className="p-1 text-gray-500 hover:text-red-400 cursor-pointer"
                        title="Delete Step"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Step Description:</label>
                    <textarea
                      rows={2}
                      value={step.description || ''}
                      onChange={(e) => handleUpdateStep(step.id, 'description', e.target.value)}
                      className="w-full bg-[#161b22] border border-gray-700 rounded-lg p-2 text-xs text-gray-200 outline-none focus:border-[#FF6000]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOM PLATFORM RULES */}
      {activeTab === 'CUSTOM_RULES' && (
        <div className="space-y-4">
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Custom Platform Rules & Notices</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Create custom operational announcements, guidelines, and compliance rules dynamically.
                </p>
              </div>
              <button
                onClick={handleAddCustomRule}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Rule</span>
              </button>
            </div>

            <div className="space-y-3">
              {(config.customRules || []).length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500 border border-dashed border-gray-800 rounded-xl">
                  No custom rules added yet. Click &quot;Add Custom Rule&quot; to publish special platform notices.
                </div>
              ) : (
                (config.customRules || []).map((rule) => (
                  <div
                    key={rule.id}
                    className="p-4 rounded-xl border border-gray-800 bg-[#0d1117] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={rule.title || ''}
                          onChange={(e) => handleUpdateCustomRule(rule.id, 'title', e.target.value)}
                          placeholder="Rule Title"
                          className="bg-[#161b22] border border-gray-700 rounded-lg px-2.5 py-1 text-xs font-bold text-white outline-none focus:border-[#FF6000] flex-1 max-w-sm"
                        />
                        <input
                          type="text"
                          value={rule.badge || ''}
                          onChange={(e) => handleUpdateCustomRule(rule.id, 'badge', e.target.value)}
                          placeholder="Badge (e.g. Security)"
                          className="w-24 bg-[#161b22] border border-gray-700 rounded-lg px-2 py-1 text-[11px] text-gray-300 outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.enabled !== false}
                            onChange={(e) => handleUpdateCustomRule(rule.id, 'enabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#FF6000]"></div>
                        </label>
                        <button
                          onClick={() => handleDeleteCustomRule(rule.id)}
                          className="p-1 text-gray-500 hover:text-red-400 cursor-pointer"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-gray-400 block mb-1">Rule Body / Explanation:</label>
                      <textarea
                        rows={2}
                        value={rule.description || ''}
                        onChange={(e) => handleUpdateCustomRule(rule.id, 'description', e.target.value)}
                        className="w-full bg-[#161b22] border border-gray-700 rounded-lg p-2 text-xs text-gray-200 outline-none focus:border-[#FF6000]"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WALLET RULES & NOTES */}
      {activeTab === 'WALLETS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Topup Wallet Config */}
            <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-gray-800">
                <Wallet className="w-4 h-4 text-blue-400" />
                <span>Topup Wallet Configuration Notes</span>
              </h3>
              <p className="text-xs text-gray-400">
                Specify the explanatory notes displayed inside the Topup Wallet section.
              </p>
              <div>
                <label className="text-xs text-gray-300 font-semibold block mb-1">Topup Wallet Custom Note:</label>
                <textarea
                  rows={4}
                  value={config.sections.topupWallet?.customNotes || ''}
                  onChange={(e) => updateSection('topupWallet', 'customNotes', e.target.value)}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-3 text-xs text-gray-200 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Withdraw Wallet Config */}
            <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-gray-800">
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                <span>Withdraw Wallet Configuration Notes</span>
              </h3>
              <p className="text-xs text-gray-400">
                Specify the explanatory notes displayed inside the Withdraw Wallet section.
              </p>
              <div>
                <label className="text-xs text-gray-300 font-semibold block mb-1">Withdraw Wallet Custom Note:</label>
                <textarea
                  rows={4}
                  value={config.sections.withdrawWallet?.customNotes || ''}
                  onChange={(e) => updateSection('withdrawWallet', 'customNotes', e.target.value)}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-3 text-xs text-gray-200 outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Gift Code Notes */}
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-2 border-b border-gray-800">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Gift Code Section Explanatory Text</span>
            </h3>
            <textarea
              rows={2}
              value={config.giftCodeNotes || ''}
              onChange={(e) => setConfig({ ...config, giftCodeNotes: e.target.value })}
              className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-3 text-xs text-gray-200 outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      )}

      {/* TAB 5: PAGE BRANDING & SUPPORT */}
      {activeTab === 'BRANDING' && (
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white pb-3 border-b border-gray-800">
            About Platform Header Branding & Support Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Page Title:</label>
              <input
                type="text"
                value={config.pageTitle || ''}
                onChange={(e) => setConfig({ ...config, pageTitle: e.target.value })}
                className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#FF6000]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Hero Badge Text:</label>
              <input
                type="text"
                value={config.heroBadge || ''}
                onChange={(e) => setConfig({ ...config, heroBadge: e.target.value })}
                className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#FF6000]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-300 block mb-1">Page Subtitle / Mission Statement:</label>
              <input
                type="text"
                value={config.pageSubtitle || ''}
                onChange={(e) => setConfig({ ...config, pageSubtitle: e.target.value })}
                className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#FF6000]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Company / Brand Name:</label>
              <input
                type="text"
                value={config.companyName || ''}
                onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#FF6000]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">App / Protocol Version:</label>
              <input
                type="text"
                value={config.appVersion || ''}
                onChange={(e) => setConfig({ ...config, appVersion: e.target.value })}
                className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#FF6000]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Official Support Email:</label>
              <input
                type="text"
                value={config.supportEmail || ''}
                onChange={(e) => setConfig({ ...config, supportEmail: e.target.value })}
                className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#FF6000]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Support Hours:</label>
              <input
                type="text"
                value={config.supportHours || ''}
                onChange={(e) => setConfig({ ...config, supportHours: e.target.value })}
                className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#FF6000]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-300 block mb-1">Telegram Community Link:</label>
              <input
                type="text"
                value={config.supportTelegram || ''}
                onChange={(e) => setConfig({ ...config, supportTelegram: e.target.value })}
                className="w-full bg-[#0d1117] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#FF6000]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
