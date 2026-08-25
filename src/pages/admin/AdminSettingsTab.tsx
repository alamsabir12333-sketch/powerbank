import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Save,
  QrCode,
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
} from 'lucide-react';
import {
  fetchSystemSettings,
  updateSystemSettings,
  fetchPaymentSettings,
  updatePaymentSettings,
  uploadQrImage,
} from '../../services/api';
import { SystemSettings, PaymentSettings } from '../../types';

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // QR Upload states for each channel
  const [uploadingChannel, setUploadingChannel] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sys, pay] = await Promise.all([
        fetchSystemSettings(),
        fetchPaymentSettings(),
      ]);
      setSettings(sys);
      setPaymentSettings(pay);
    } catch (e: any) {
      onShowToast(e.message || 'Error loading platform settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChannelQrUpload = async (
    channel: 'payu' | 'toppay' | 'upay' | 'default',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onShowToast('QR image file must be less than 5MB.');
      return;
    }

    setUploadingChannel(channel);
    try {
      const uploadedUrl = await uploadQrImage(file);
      if (paymentSettings) {
        if (channel === 'payu') {
          setPaymentSettings({ ...paymentSettings, payuQrImageUrl: uploadedUrl });
        } else if (channel === 'toppay') {
          setPaymentSettings({ ...paymentSettings, toppayQrImageUrl: uploadedUrl });
        } else if (channel === 'upay') {
          setPaymentSettings({ ...paymentSettings, upayQrImageUrl: uploadedUrl });
        } else {
          setPaymentSettings({ ...paymentSettings, qrImageUrl: uploadedUrl });
        }
      }
      onShowToast(`${channel.toUpperCase()} QR code uploaded! Click 'Save Settings' to apply.`);
    } catch (err: any) {
      onShowToast(err.message || 'Failed to upload QR code.');
    } finally {
      setUploadingChannel(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !paymentSettings) return;

    setSaving(true);
    try {
      await Promise.all([
        updateSystemSettings(settings, adminId),
        updatePaymentSettings(paymentSettings),
      ]);
      onShowToast('Platform & Payment Channels updated successfully!');
      onRefreshGlobalStats();
    } catch (e: any) {
      onShowToast(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings || !paymentSettings) {
    return (
      <div className="py-20 text-center text-gray-500 bg-[#161b22] rounded-2xl border border-gray-800">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF6000]" />
        <span>Loading manual payment settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#FF6000]" />
              Platform Settings & Multi-Channel Payment Configuration
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Set separate UPI IDs and QR codes for PayU, TopPay, and UPay deposit channels.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={saving}
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 cursor-pointer self-start sm:self-auto flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Settings</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Section 1: Multi-Channel Manual UPI Settings (PayU, TopPay, UPay) */}
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-800">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#FF6000]" />
              Deposit Channels (PayU, TopPay, UPay)
            </h3>
            <span className="text-[11px] text-gray-400">Independent UPI & QR for Each Channel</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 1. PayU Channel */}
            <div className="bg-[#0d1117] border border-amber-900/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Channel 1: PayU
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-semibold">
                  Fast UPI
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                  PayU UPI ID
                </label>
                <input
                  type="text"
                  value={paymentSettings.payuUpiId || ''}
                  onChange={(e) =>
                    setPaymentSettings({ ...paymentSettings, payuUpiId: e.target.value })
                  }
                  placeholder="payu@okhdfcbank"
                  className="w-full bg-[#161b22] border border-gray-700 focus:border-amber-500 rounded-lg p-2 text-xs text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                  Upload PayU QR Image
                </label>
                <label className="border border-dashed border-gray-700 hover:border-amber-500 rounded-lg p-2.5 flex items-center justify-center gap-2 cursor-pointer bg-[#161b22] transition-colors">
                  {uploadingChannel === 'payu' ? (
                    <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  <span className="text-[11px] text-gray-300 font-semibold">
                    {uploadingChannel === 'payu' ? 'Uploading...' : 'Upload PayU QR'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleChannelQrUpload('payu', e)}
                    disabled={uploadingChannel === 'payu'}
                    className="hidden"
                  />
                </label>
              </div>

              {/* PayU Preview */}
              <div className="bg-[#161b22] p-2.5 rounded-lg border border-gray-800 flex items-center gap-3">
                <div className="bg-white p-1 rounded-md shrink-0">
                  <img
                    src={
                      paymentSettings.payuQrImageUrl ||
                      `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                        `upi://pay?pa=${paymentSettings.payuUpiId || 'payu@upi'}&pn=PowerBank_PayU&cu=INR`
                      )}`
                    }
                    alt="PayU QR"
                    className="w-14 h-14 object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="overflow-hidden">
                  <span className="text-[10px] text-gray-400 block font-medium">Active PayU UPI</span>
                  <span className="text-xs font-mono font-bold text-white truncate block">
                    {paymentSettings.payuUpiId || 'payu@upi'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. TopPay Channel */}
            <div className="bg-[#0d1117] border border-blue-900/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Channel 2: TopPay
                </span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-semibold">
                  Auto Scan
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                  TopPay UPI ID
                </label>
                <input
                  type="text"
                  value={paymentSettings.toppayUpiId || ''}
                  onChange={(e) =>
                    setPaymentSettings({ ...paymentSettings, toppayUpiId: e.target.value })
                  }
                  placeholder="toppay@okaxis"
                  className="w-full bg-[#161b22] border border-gray-700 focus:border-blue-500 rounded-lg p-2 text-xs text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                  Upload TopPay QR Image
                </label>
                <label className="border border-dashed border-gray-700 hover:border-blue-500 rounded-lg p-2.5 flex items-center justify-center gap-2 cursor-pointer bg-[#161b22] transition-colors">
                  {uploadingChannel === 'toppay' ? (
                    <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  <span className="text-[11px] text-gray-300 font-semibold">
                    {uploadingChannel === 'toppay' ? 'Uploading...' : 'Upload TopPay QR'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleChannelQrUpload('toppay', e)}
                    disabled={uploadingChannel === 'toppay'}
                    className="hidden"
                  />
                </label>
              </div>

              {/* TopPay Preview */}
              <div className="bg-[#161b22] p-2.5 rounded-lg border border-gray-800 flex items-center gap-3">
                <div className="bg-white p-1 rounded-md shrink-0">
                  <img
                    src={
                      paymentSettings.toppayQrImageUrl ||
                      `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                        `upi://pay?pa=${paymentSettings.toppayUpiId || 'toppay@upi'}&pn=PowerBank_TopPay&cu=INR`
                      )}`
                    }
                    alt="TopPay QR"
                    className="w-14 h-14 object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="overflow-hidden">
                  <span className="text-[10px] text-gray-400 block font-medium">Active TopPay UPI</span>
                  <span className="text-xs font-mono font-bold text-white truncate block">
                    {paymentSettings.toppayUpiId || 'toppay@upi'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. UPay Channel */}
            <div className="bg-[#0d1117] border border-emerald-900/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Channel 3: UPay
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-semibold">
                  Instant QR
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                  UPay UPI ID
                </label>
                <input
                  type="text"
                  value={paymentSettings.upayUpiId || ''}
                  onChange={(e) =>
                    setPaymentSettings({ ...paymentSettings, upayUpiId: e.target.value })
                  }
                  placeholder="upay@icici"
                  className="w-full bg-[#161b22] border border-gray-700 focus:border-emerald-500 rounded-lg p-2 text-xs text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-300 mb-1">
                  Upload UPay QR Image
                </label>
                <label className="border border-dashed border-gray-700 hover:border-emerald-500 rounded-lg p-2.5 flex items-center justify-center gap-2 cursor-pointer bg-[#161b22] transition-colors">
                  {uploadingChannel === 'upay' ? (
                    <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  <span className="text-[11px] text-gray-300 font-semibold">
                    {uploadingChannel === 'upay' ? 'Uploading...' : 'Upload UPay QR'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleChannelQrUpload('upay', e)}
                    disabled={uploadingChannel === 'upay'}
                    className="hidden"
                  />
                </label>
              </div>

              {/* UPay Preview */}
              <div className="bg-[#161b22] p-2.5 rounded-lg border border-gray-800 flex items-center gap-3">
                <div className="bg-white p-1 rounded-md shrink-0">
                  <img
                    src={
                      paymentSettings.upayQrImageUrl ||
                      `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                        `upi://pay?pa=${paymentSettings.upayUpiId || 'upay@upi'}&pn=PowerBank_UPay&cu=INR`
                      )}`
                    }
                    alt="UPay QR"
                    className="w-14 h-14 object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="overflow-hidden">
                  <span className="text-[10px] text-gray-400 block font-medium">Active UPay UPI</span>
                  <span className="text-xs font-mono font-bold text-white truncate block">
                    {paymentSettings.upayUpiId || 'upay@upi'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <label
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                paymentSettings.isRechargeEnabled
                  ? 'bg-[#0d1117] border-emerald-500/40 text-white'
                  : 'bg-[#0d1117]/60 border-gray-800 text-gray-400'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-white">Enable Recharge & Deposit System</div>
                <div className="text-[10.5px] text-gray-500">Allow users to view deposit channels and submit UTR</div>
              </div>
              <input
                type="checkbox"
                checked={paymentSettings.isRechargeEnabled}
                onChange={(e) =>
                  setPaymentSettings({
                    ...paymentSettings,
                    isRechargeEnabled: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-[#FF6000] cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Section 2: Financial & Withdrawal Thresholds */}
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

        {/* Section 3: Platform Operational Switches */}
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2 pb-3 border-b border-gray-800">
            <Shield className="w-4 h-4 text-amber-400" />
            Store Hall & Yield Operational Switches
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                id: 'isClaimEnabled',
                label: 'Device Yield Claiming (My Device)',
                sub: 'Allows users to claim accumulated device earnings',
                val: settings.isClaimEnabled,
              },
              {
                id: 'isProEnabled',
                label: 'PRO High-Yield Store Hall',
                sub: 'Enables purchase of PRO investment contracts',
                val: settings.isProEnabled,
              },
              {
                id: 'isHourlyPlanEnabled',
                label: 'Hourly Device Store Hall',
                sub: 'Enables purchase of standard hourly sharing devices',
                val: settings.isHourlyPlanEnabled,
              },
            ].map((sw) => (
              <label
                key={sw.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  sw.val
                    ? 'bg-[#0d1117] border-emerald-500/40 text-white'
                    : 'bg-[#0d1117]/60 border-gray-800 text-gray-400'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-white">{sw.label}</div>
                  <div className="text-[10.5px] text-gray-500">{sw.sub}</div>
                </div>
                <input
                  type="checkbox"
                  checked={sw.val}
                  onChange={(e) => setSettings({ ...settings, [sw.id]: e.target.checked })}
                  className="w-4 h-4 accent-[#FF6000] cursor-pointer"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="text-right">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#FF6000] to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-lg shadow-orange-950/40 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Platform & Payment Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
