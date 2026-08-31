import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Save,
  CreditCard,
  Shield,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Zap,
  Building,
  DollarSign,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Check,
  Info,
  Layers,
  Gift,
  CalendarCheck,
  Sparkles,
  Flame,
  Globe,
  Coins,
  Link as LinkIcon,
} from 'lucide-react';
import {
  fetchSystemSettings,
  updateSystemSettings,
  fetchPaymentSettings,
  updatePaymentSettings,
  fetchWebsitePopup,
  saveWebsitePopup,
  fetchSiteSettings,
  saveSiteSettings,
  uploadSiteAsset,
  fetchRechargeSettings,
  saveRechargeSettings,
  fetchUsdtSettings,
  saveUsdtSettings,
} from '../../services/api';
import {
  SystemSettings,
  PaymentSettings,
  WebsitePopupConfig,
  SiteSettings,
  RechargeSettings,
  UsdtSettings,
} from '../../types';

interface AdminSettingsTabProps {
  adminId: string;
  onShowToast: (msg: string) => void;
  onRefreshGlobalStats: () => void;
}

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({
  adminId,
  onShowToast,
  onRefreshGlobalStats,
}) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [popupConfig, setPopupConfig] = useState<WebsitePopupConfig | null>(null);
  
  // New Configurations
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    siteTitle: 'GAINPOWER',
    logoUrl: '',
    faviconUrl: '',
  });
  const [rechargeSettings, setRechargeSettings] = useState<RechargeSettings>({
    presetAmounts: [500, 1500, 2000, 3000, 3500, 5000, 7000, 10000, 20000, 30000],
    minRecharge: 100,
    maxRecharge: 50000,
    isEnabled: true,
  });
  const [presetAmountsString, setPresetAmountsString] = useState<string>(
    '500, 1500, 2000, 3000, 3500, 5000, 7000, 10000, 20000, 30000'
  );
  const [usdtSettings, setUsdtSettings] = useState<UsdtSettings>({
    isEnabled: true,
    usdtRate: 100,
    trc20Address: '',
    bep20Address: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sys, pay, popup, site, rech, usdt] = await Promise.all([
        fetchSystemSettings(),
        fetchPaymentSettings(),
        fetchWebsitePopup(),
        fetchSiteSettings(),
        fetchRechargeSettings(),
        fetchUsdtSettings(),
      ]);
      setSettings(sys);
      setPaymentSettings(pay);
      setPopupConfig(popup);
      if (site) setSiteSettings(site);
      if (rech) {
        setRechargeSettings(rech);
        if (Array.isArray(rech.presetAmounts)) {
          setPresetAmountsString(rech.presetAmounts.join(', '));
        }
      }
      if (usdt) setUsdtSettings(usdt);
    } catch (e: any) {
      onShowToast(e.message || 'Error loading platform settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadSiteAsset(file, 'logo');
      setSiteSettings((prev) => ({ ...prev, logoUrl: url }));
      onShowToast('Logo uploaded! Click "Save Settings" to apply.');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to upload logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFavicon(true);
    try {
      const url = await uploadSiteAsset(file, 'favicon');
      setSiteSettings((prev) => ({ ...prev, faviconUrl: url }));
      onShowToast('Favicon uploaded! Click "Save Settings" to apply.');
    } catch (err: any) {
      onShowToast(err.message || 'Failed to upload favicon.');
    } finally {
      setUploadingFavicon(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Parse preset amounts
      const parsedPresets = presetAmountsString
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n) && n > 0);

      const finalRecharge = {
        ...rechargeSettings,
        presetAmounts: parsedPresets.length > 0 ? parsedPresets : [500, 1500, 2000, 3000, 5000],
      };

      const promises: Promise<any>[] = [
        saveSiteSettings(siteSettings, adminId),
        saveRechargeSettings(finalRecharge, adminId),
        saveUsdtSettings(usdtSettings, adminId),
      ];

      if (settings) {
        promises.push(updateSystemSettings(settings, adminId));
      }
      if (popupConfig) {
        promises.push(saveWebsitePopup(popupConfig, adminId));
      }

      await Promise.all(promises);
      onShowToast('All Settings (Site Branding, Recharge, USDT, Popup, Rules) saved successfully!');
      onRefreshGlobalStats();
    } catch (e: any) {
      onShowToast(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="py-20 text-center text-gray-500 bg-[#161b22] rounded-2xl border border-gray-800">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF6000]" />
        <span>Loading system settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#FF6000]" />
              Platform Configuration & Branding Settings
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Manage Site Logo/Favicon, Preset Recharge Amounts, USDT Manual Deposit, and Platform Rules.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={saving}
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 cursor-pointer self-start sm:self-auto flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Settings</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Site Branding & Identity */}
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              Site Branding & Identity
            </h3>
            <span className="text-[11px] text-gray-400">Dynamic Title, Logo & Favicon</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Site Title */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Site Title
              </label>
              <input
                type="text"
                value={siteSettings.siteTitle || ''}
                onChange={(e) => setSiteSettings({ ...siteSettings, siteTitle: e.target.value })}
                placeholder="GAINPOWER"
                className="w-full bg-[#0d1117] border border-gray-700 focus:border-[#FF6000] rounded-xl p-2.5 text-xs text-white outline-none"
              />
              <p className="text-[10px] text-gray-500 mt-1">Displayed in browser tab and headers.</p>
            </div>

            {/* Site Logo */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Site Logo
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={siteSettings.logoUrl || ''}
                  onChange={(e) => setSiteSettings({ ...siteSettings, logoUrl: e.target.value })}
                  placeholder="https://... or upload below"
                  className="w-full bg-[#0d1117] border border-gray-700 focus:border-[#FF6000] rounded-xl p-2 text-xs text-white outline-none"
                />
                <label className="border border-dashed border-gray-700 hover:border-cyan-500 rounded-xl p-2 flex items-center justify-center gap-2 cursor-pointer bg-[#0d1117] transition-colors">
                  {uploadingLogo ? (
                    <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  <span className="text-[11px] text-gray-300 font-semibold">
                    {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Favicon */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Favicon
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={siteSettings.faviconUrl || ''}
                  onChange={(e) => setSiteSettings({ ...siteSettings, faviconUrl: e.target.value })}
                  placeholder="https://... or upload below"
                  className="w-full bg-[#0d1117] border border-gray-700 focus:border-[#FF6000] rounded-xl p-2 text-xs text-white outline-none"
                />
                <label className="border border-dashed border-gray-700 hover:border-cyan-500 rounded-xl p-2 flex items-center justify-center gap-2 cursor-pointer bg-[#0d1117] transition-colors">
                  {uploadingFavicon ? (
                    <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  <span className="text-[11px] text-gray-300 font-semibold">
                    {uploadingFavicon ? 'Uploading...' : 'Upload Favicon'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFaviconUpload}
                    disabled={uploadingFavicon}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Recharge Configuration */}
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#FF6000]" />
              Recharge Configuration & Presets
            </h3>
            <span className="text-[11px] text-gray-400">Controls amount buttons in user recharge screen</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Preset Recharge Amounts (Comma-separated INR values)
              </label>
              <input
                type="text"
                value={presetAmountsString}
                onChange={(e) => setPresetAmountsString(e.target.value)}
                placeholder="500, 1500, 2000, 3000, 3500, 5000, 7000, 10000, 20000, 30000"
                className="w-full bg-[#0d1117] border border-gray-700 focus:border-[#FF6000] rounded-xl p-2.5 text-xs text-white font-mono outline-none"
              />
              <p className="text-[10.5px] text-gray-500 mt-1">
                Users will see these preset buttons on the Recharge page.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Minimum Recharge (₹)
              </label>
              <input
                type="number"
                value={rechargeSettings.minRecharge || 100}
                onChange={(e) =>
                  setRechargeSettings({ ...rechargeSettings, minRecharge: Number(e.target.value) })
                }
                min={1}
                className="w-full bg-[#0d1117] border border-gray-700 focus:border-[#FF6000] rounded-xl p-2.5 text-xs text-white outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: USDT Manual Deposit Configuration */}
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-yellow-400" />
              USDT Manual Deposit Configuration
            </h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-bold text-gray-300">Enable USDT Deposits:</span>
              <input
                type="checkbox"
                checked={usdtSettings.isEnabled !== false}
                onChange={(e) =>
                  setUsdtSettings({ ...usdtSettings, isEnabled: e.target.checked })
                }
                className="w-4 h-4 accent-[#FF6000] cursor-pointer"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                USDT Conversion Rate (INR per 1 USDT)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-yellow-400 font-bold">₹</span>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={usdtSettings.usdtRate || 100}
                  onChange={(e) =>
                    setUsdtSettings({ ...usdtSettings, usdtRate: Number(e.target.value) })
                  }
                  className="w-full bg-[#0d1117] border border-gray-700 focus:border-yellow-500 rounded-xl p-2.5 pl-7 text-xs text-white outline-none font-bold"
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                E.g. If set to 100, a ₹1000 recharge requires 10 USDT.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                TRC20 Wallet Address (Tron)
              </label>
              <input
                type="text"
                value={usdtSettings.trc20Address || ''}
                onChange={(e) =>
                  setUsdtSettings({ ...usdtSettings, trc20Address: e.target.value })
                }
                placeholder="T..."
                className="w-full bg-[#0d1117] border border-gray-700 focus:border-yellow-500 rounded-xl p-2.5 text-xs text-white font-mono outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                BEP20 Wallet Address (BNB Smart Chain)
              </label>
              <input
                type="text"
                value={usdtSettings.bep20Address || ''}
                onChange={(e) =>
                  setUsdtSettings({ ...usdtSettings, bep20Address: e.target.value })
                }
                placeholder="0x..."
                className="w-full bg-[#0d1117] border border-gray-700 focus:border-yellow-500 rounded-xl p-2.5 text-xs text-white font-mono outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Manual Withdrawal Limits & Financial Thresholds */}
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2 pb-3 border-b border-gray-800">
            <CreditCard className="w-4 h-4 text-purple-400" />
            Manual Withdrawal Limits & Fee
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Minimum Withdrawal (₹)
              </label>
              <input
                type="number"
                value={settings.minWithdrawal}
                onChange={(e) => setSettings({ ...settings, minWithdrawal: Number(e.target.value) })}
                required
                className="w-full bg-[#0d1117] border border-gray-700 focus:border-[#FF6000] rounded-xl p-2.5 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Maximum Single Withdrawal (₹)
              </label>
              <input
                type="number"
                value={settings.maxWithdrawal}
                onChange={(e) => setSettings({ ...settings, maxWithdrawal: Number(e.target.value) })}
                required
                className="w-full bg-[#0d1117] border border-gray-700 focus:border-[#FF6000] rounded-xl p-2.5 text-xs text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Withdrawal Fee (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.withdrawalFeePercent}
                onChange={(e) => setSettings({ ...settings, withdrawalFeePercent: Number(e.target.value) })}
                required
                className="w-full bg-[#0d1117] border border-gray-700 focus:border-[#FF6000] rounded-xl p-2.5 text-xs text-white outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Referral Direct Bonus Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.referralBonusPercent}
                onChange={(e) => setSettings({ ...settings, referralBonusPercent: Number(e.target.value) })}
                required
                className="w-full bg-[#0d1117] border border-gray-700 focus:border-[#FF6000] rounded-xl p-2.5 text-xs text-white outline-none"
              />
            </div>

            <div className="flex items-end">
              <label
                className={`p-2.5 rounded-xl border flex items-center justify-between w-full cursor-pointer transition-all ${
                  settings.isWithdrawalEnabled
                    ? 'bg-[#0d1117] border-emerald-500/40 text-white'
                    : 'bg-[#0d1117]/60 border-gray-800 text-gray-400'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-white">Enable Manual Withdrawals</div>
                  <div className="text-[10px] text-gray-500">Allow users to submit withdrawal requests</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.isWithdrawalEnabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      isWithdrawalEnabled: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-[#FF6000] cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Section 5: Sign-up Welcome Bonus */}
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Gift className="w-4 h-4 text-amber-400" />
              Sign-up Welcome Bonus
            </h3>
            <span className="text-[11px] text-gray-400">Credited instantly upon new registration</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Sign-up Bonus Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-amber-400 font-bold">₹</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={settings.signUpBonusAmount !== undefined ? settings.signUpBonusAmount : 50}
                  onChange={(e) => setSettings({ ...settings, signUpBonusAmount: Number(e.target.value) })}
                  required
                  className="w-full bg-[#0d1117] border border-gray-700 focus:border-[#FF6000] rounded-xl p-2.5 pl-8 text-xs text-white outline-none font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 6: Website Popup Notice Configuration */}
        {popupConfig && (
          <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-400" />
                Website Popup Notice Modal
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-bold text-gray-300">Popup Enabled:</span>
                <input
                  type="checkbox"
                  checked={popupConfig.isActive}
                  onChange={(e) => setPopupConfig({ ...popupConfig, isActive: e.target.checked })}
                  className="w-4 h-4 accent-[#FF6000] cursor-pointer"
                />
              </label>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Popup Title</label>
                  <input
                    type="text"
                    value={popupConfig.title}
                    onChange={(e) => setPopupConfig({ ...popupConfig, title: e.target.value })}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                    placeholder="Official Notice"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Poster / Banner Image URL</label>
                  <input
                    type="text"
                    value={popupConfig.imageUrl || ''}
                    onChange={(e) => setPopupConfig({ ...popupConfig, imageUrl: e.target.value })}
                    className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                    placeholder="https://example.com/popup-banner.png"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Popup Description / Message</label>
                <textarea
                  rows={2}
                  value={popupConfig.description}
                  onChange={(e) => setPopupConfig({ ...popupConfig, description: e.target.value })}
                  className="w-full bg-[#0d1117] border border-gray-700 rounded-xl p-2.5 text-white outline-none"
                  placeholder="Enter detailed notice message..."
                />
              </div>

              {/* 4 Custom Action Links */}
              <div className="pt-2 border-t border-gray-800 space-y-2">
                <div className="text-xs font-bold text-gray-400">4 Custom Action Links (Max 4 buttons)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Button 1</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Button Text"
                        value={popupConfig.link1Text || ''}
                        onChange={(e) => setPopupConfig({ ...popupConfig, link1Text: e.target.value })}
                        className="w-1/2 bg-[#0d1117] border border-gray-700 rounded-xl p-2 text-white outline-none text-xs"
                      />
                      <input
                        type="text"
                        placeholder="URL / Path"
                        value={popupConfig.link1Url || ''}
                        onChange={(e) => setPopupConfig({ ...popupConfig, link1Url: e.target.value })}
                        className="w-1/2 bg-[#0d1117] border border-gray-700 rounded-xl p-2 text-white outline-none text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Button 2</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Button Text"
                        value={popupConfig.link2Text || ''}
                        onChange={(e) => setPopupConfig({ ...popupConfig, link2Text: e.target.value })}
                        className="w-1/2 bg-[#0d1117] border border-gray-700 rounded-xl p-2 text-white outline-none text-xs"
                      />
                      <input
                        type="text"
                        placeholder="URL / Path"
                        value={popupConfig.link2Url || ''}
                        onChange={(e) => setPopupConfig({ ...popupConfig, link2Url: e.target.value })}
                        className="w-1/2 bg-[#0d1117] border border-gray-700 rounded-xl p-2 text-white outline-none text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Button 3</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Button Text"
                        value={popupConfig.link3Text || ''}
                        onChange={(e) => setPopupConfig({ ...popupConfig, link3Text: e.target.value })}
                        className="w-1/2 bg-[#0d1117] border border-gray-700 rounded-xl p-2 text-white outline-none text-xs"
                      />
                      <input
                        type="text"
                        placeholder="URL / Path"
                        value={popupConfig.link3Url || ''}
                        onChange={(e) => setPopupConfig({ ...popupConfig, link3Url: e.target.value })}
                        className="w-1/2 bg-[#0d1117] border border-gray-700 rounded-xl p-2 text-white outline-none text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-gray-400">Button 4</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Button Text"
                        value={popupConfig.link4Text || ''}
                        onChange={(e) => setPopupConfig({ ...popupConfig, link4Text: e.target.value })}
                        className="w-1/2 bg-[#0d1117] border border-gray-700 rounded-xl p-2 text-white outline-none text-xs"
                      />
                      <input
                        type="text"
                        placeholder="URL / Path"
                        value={popupConfig.link4Url || ''}
                        onChange={(e) => setPopupConfig({ ...popupConfig, link4Url: e.target.value })}
                        className="w-1/2 bg-[#0d1117] border border-gray-700 rounded-xl p-2 text-white outline-none text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="text-right">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#FF6000] to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-lg shadow-orange-950/40 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save All Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
