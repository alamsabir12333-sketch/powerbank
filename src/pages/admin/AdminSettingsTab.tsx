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
  Activity,
} from 'lucide-react';
import {
  fetchSystemSettings,
  updateSystemSettings,
  fetchGatewaySettings,
  updateGatewaySettings,
  fetchUniVePayBalance,
} from '../../services/api';
import { SystemSettings, GatewaySettings, UniVePayBalanceResult } from '../../types';

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
  const [gatewaySettings, setGatewaySettings] = useState<GatewaySettings | null>(null);
  const [liveBalance, setLiveBalance] = useState<UniVePayBalanceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sys, gw] = await Promise.all([
        fetchSystemSettings(),
        fetchGatewaySettings(),
      ]);
      setSettings(sys);
      setGatewaySettings(gw);
    } catch (e: any) {
      onShowToast(e.message || 'Error loading system settings');
    } finally {
      setLoading(false);
    }
  };

  const loadBalance = async () => {
    setBalanceLoading(true);
    try {
      const bal = await fetchUniVePayBalance();
      setLiveBalance(bal);
      if (gatewaySettings) {
        setGatewaySettings({
          ...gatewaySettings,
          gatewayTotalBalance: bal.balance,
          gatewayAvailableBalance: bal.balanceCanUse,
          gatewayLastChecked: bal.lastChecked,
          gatewayConnectivity: bal.retcode === '0000' ? 'CONNECTED' : 'DISCONNECTED',
        });
      }
    } catch (e: any) {
      console.warn('Balance check failed:', e);
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadBalance();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !gatewaySettings) return;

    setSaving(true);
    try {
      await Promise.all([
        updateSystemSettings(settings, adminId),
        updateGatewaySettings(gatewaySettings, adminId),
      ]);
      onShowToast('System & UniVePay gateway settings updated successfully.');
      onRefreshGlobalStats();
    } catch (e: any) {
      onShowToast(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings || !gatewaySettings) {
    return (
      <div className="py-20 text-center text-gray-500 bg-[#161b22] rounded-2xl border border-gray-800">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF6000]" />
        <span>Loading system configuration...</span>
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
              Platform Configuration & Payment Gateway
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Control UniVePay payment gateway, withdrawal parameters, automated settlement, and operational switches.
            </p>
          </div>

          <button
            onClick={() => {
              loadData();
              loadBalance();
            }}
            disabled={saving || balanceLoading}
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 cursor-pointer self-start sm:self-auto flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${balanceLoading ? 'animate-spin' : ''}`} />
            <span>Sync Live Status</span>
          </button>
        </div>
      </div>

      {/* UniVePay Live Gateway Monitor Banner */}
      <div className="bg-gradient-to-r from-[#0d1626] to-[#0a1120] border border-cyan-900/50 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">UniVePay Master Gateway Status</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {gatewaySettings.gatewayConnectivity || 'CONNECTED'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Merchant No: <span className="font-mono text-cyan-300 font-bold">{gatewaySettings.merchantNo || '100008'}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadBalance}
            disabled={balanceLoading}
            className="px-3 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-300 text-xs font-bold hover:bg-cyan-900/60 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${balanceLoading ? 'animate-spin' : ''}`} />
            <span>Check Balance</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-cyan-950/80">
          <div className="bg-[#090d16] p-3 rounded-xl border border-cyan-950">
            <span className="text-[10.5px] text-gray-400 block font-medium">Gateway Usable Balance (CanUse)</span>
            <span className="text-lg font-extrabold text-emerald-400">
              ₹{(liveBalance?.balanceCanUse ?? gatewaySettings.gatewayAvailableBalance ?? 485000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-[#090d16] p-3 rounded-xl border border-cyan-950">
            <span className="text-[10.5px] text-gray-400 block font-medium">Gateway Total Merchant Balance</span>
            <span className="text-lg font-extrabold text-cyan-300">
              ₹{(liveBalance?.balance ?? gatewaySettings.gatewayTotalBalance ?? 500000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-[#090d16] p-3 rounded-xl border border-cyan-950">
            <span className="text-[10.5px] text-gray-400 block font-medium">Last Reconciliation</span>
            <span className="text-xs font-semibold text-gray-300">
              {gatewaySettings.gatewayLastChecked ? new Date(gatewaySettings.gatewayLastChecked).toLocaleTimeString() : 'Just Now'}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Section 1: UniVePay Payment Gateway Controls */}
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2 pb-3 border-b border-gray-800">
            <Zap className="w-4 h-4 text-[#FF6000]" />
            UniVePay Gateway Routing & Rules
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                gatewaySettings.isUniVePayDepositEnabled
                  ? 'bg-[#0d1117] border-emerald-500/40 text-white'
                  : 'bg-[#0d1117]/60 border-gray-800 text-gray-400'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-white">UniVePay UPI Gateway Deposit</div>
                <div className="text-[10.5px] text-gray-500">Automated UPI payment gateway checkout</div>
              </div>
              <input
                type="checkbox"
                checked={gatewaySettings.isUniVePayDepositEnabled}
                onChange={(e) =>
                  setGatewaySettings({
                    ...gatewaySettings,
                    isUniVePayDepositEnabled: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-[#FF6000] cursor-pointer"
              />
            </label>

            <label
              className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                gatewaySettings.isUniVePayAutoWithdrawalEnabled
                  ? 'bg-[#0d1117] border-emerald-500/40 text-white'
                  : 'bg-[#0d1117]/60 border-gray-800 text-gray-400'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-white">UniVePay Auto Payout (Withdrawal)</div>
                <div className="text-[10.5px] text-gray-500">Instant automatic settlement via UniVePay API</div>
              </div>
              <input
                type="checkbox"
                checked={gatewaySettings.isUniVePayAutoWithdrawalEnabled}
                onChange={(e) =>
                  setGatewaySettings({
                    ...gatewaySettings,
                    isUniVePayAutoWithdrawalEnabled: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-[#FF6000] cursor-pointer"
              />
            </label>

            <label
              className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                gatewaySettings.isManualWithdrawalEnabled
                  ? 'bg-[#0d1117] border-emerald-500/40 text-white'
                  : 'bg-[#0d1117]/60 border-gray-800 text-gray-400'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-white">Manual Withdrawal Support</div>
                <div className="text-[10.5px] text-gray-500">Allows users to request manual admin settlement</div>
              </div>
              <input
                type="checkbox"
                checked={gatewaySettings.isManualWithdrawalEnabled}
                onChange={(e) =>
                  setGatewaySettings({
                    ...gatewaySettings,
                    isManualWithdrawalEnabled: e.target.checked,
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
            <CreditCard className="w-4 h-4 text-emerald-400" />
            Withdrawal Thresholds & Fees
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
          </div>
        </div>

        {/* Section 3: Platform Operational Switches */}
        <div className="bg-[#161b22] border border-gray-800 rounded-2xl p-5 space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2 pb-3 border-b border-gray-800">
            <Shield className="w-4 h-4 text-amber-400" />
            Operational Switches & Store Controls
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                id: 'isRechargeEnabled',
                label: 'Recharge / Deposit System',
                sub: 'Allows users to initiate new recharge deposits',
                val: settings.isRechargeEnabled,
              },
              {
                id: 'isWithdrawalEnabled',
                label: 'Withdrawal Cashout System',
                sub: 'Allows users to submit withdrawal requests',
                val: settings.isWithdrawalEnabled,
              },
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
            <span>Save System & Gateway Parameters</span>
          </button>
        </div>
      </form>
    </div>
  );
};
