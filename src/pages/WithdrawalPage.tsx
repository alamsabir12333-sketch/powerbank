import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  FileText,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  Coins,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { Wallet } from '../types';
import {
  submitUsdtWithdrawalRequest,
  fetchSystemSettings,
  fetchUsdtSettings,
} from '../services/api';

interface WithdrawalPageProps {
  userId: string;
  wallet: Wallet | null;
  onBack: () => void;
  onNavigateTab: (tab: any) => void;
  onShowToast: (msg: string) => void;
  onOpenBindCard?: () => void;
  onRefreshData?: () => void;
}

const PRESET_WITHDRAW_AMOUNTS = [300, 1000, 2500, 5000, 10000, 20000, 40000, 70000];

type UsdtNetwork = 'TRC20' | 'BEP20';

export const WithdrawalPage: React.FC<WithdrawalPageProps> = ({
  userId,
  wallet,
  onBack,
  onNavigateTab,
  onShowToast,
  onRefreshData,
}) => {
  const [network, setNetwork] = useState<UsdtNetwork>('TRC20');
  const [usdtAddress, setUsdtAddress] = useState<string>('');
  const [amount, setAmount] = useState<number>(300);
  const [customAmount, setCustomAmount] = useState<string>('300');
  const [withdrawalPassword, setWithdrawalPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dynamic system and USDT settings from Admin Panel
  const [minWithdrawal, setMinWithdrawal] = useState<number>(300);
  const [maxWithdrawal, setMaxWithdrawal] = useState<number>(100000);
  const [withdrawalFeePercent, setWithdrawalFeePercent] = useState<number>(10);
  const [isWithdrawalEnabled, setIsWithdrawalEnabled] = useState<boolean>(true);
  const [isUsdtEnabled, setIsUsdtEnabled] = useState<boolean>(true);
  const [usdtRate, setUsdtRate] = useState<number>(90);

  const withdrawableBalance = wallet?.withdrawBalance ?? wallet?.earnedBalance ?? wallet?.availableBalance ?? 0;
  const topupBalance = wallet?.topupBalance ?? wallet?.rechargeBalance ?? 0;

  const loadSettings = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [sysSettings, usdtSettings] = await Promise.all([
        fetchSystemSettings().catch(() => null),
        fetchUsdtSettings().catch(() => null),
      ]);

      if (sysSettings) {
        if (typeof sysSettings.minWithdrawal === 'number') setMinWithdrawal(sysSettings.minWithdrawal);
        if (typeof sysSettings.maxWithdrawal === 'number') setMaxWithdrawal(sysSettings.maxWithdrawal);
        if (typeof sysSettings.withdrawalFeePercent === 'number') setWithdrawalFeePercent(sysSettings.withdrawalFeePercent);
        if (typeof sysSettings.isWithdrawalEnabled === 'boolean') setIsWithdrawalEnabled(sysSettings.isWithdrawalEnabled);
      }

      if (usdtSettings) {
        if (typeof usdtSettings.isEnabled === 'boolean') setIsUsdtEnabled(usdtSettings.isEnabled);
        if (typeof usdtSettings.usdtRate === 'number' && usdtSettings.usdtRate > 0) {
          setUsdtRate(usdtSettings.usdtRate);
        }
      }
    } catch (err: any) {
      console.error('Failed to load withdrawal settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const handlePresetSelect = (amt: number) => {
    setAmount(amt);
    setCustomAmount(String(amt));
    setError(null);
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    setCustomAmount(digits);
    if (digits) {
      const parsed = parseInt(digits, 10);
      setAmount(parsed);
    } else {
      setAmount(0);
    }
    setError(null);
  };

  // Address validation
  const cleanAddress = usdtAddress.trim();
  const isAddressValid =
    network === 'TRC20'
      ? /^T[1-9A-HJ-NP-za-km-z]{33}$/.test(cleanAddress)
      : /^0x[a-fA-F0-9]{40}$/.test(cleanAddress);

  // Financial calculations
  const feeInr = amount > 0 ? (amount * withdrawalFeePercent) / 100 : 0;
  const netInr = Math.max(0, amount - feeInr);
  const usdtAmount = usdtRate > 0 ? +(netInr / usdtRate).toFixed(4) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isWithdrawalEnabled) {
      setError('Withdrawals are temporarily disabled by the administrator.');
      return;
    }

    if (!isUsdtEnabled) {
      setError('USDT withdrawals are temporarily disabled in system settings.');
      return;
    }

    if (!cleanAddress) {
      setError(`Please enter your destination USDT (${network}) wallet address.`);
      return;
    }

    if (!isAddressValid) {
      if (network === 'TRC20') {
        setError('Invalid TRC20 address. It must start with "T" and be exactly 34 characters.');
      } else {
        setError('Invalid BEP20 address. It must start with "0x" and be exactly 42 characters.');
      }
      return;
    }

    if (!amount || amount <= 0) {
      setError('Please enter a valid withdrawal amount.');
      return;
    }

    if (amount < minWithdrawal) {
      setError(`Minimum withdrawal amount is ₹${minWithdrawal.toLocaleString('en-IN')}.`);
      return;
    }

    if (maxWithdrawal > 0 && amount > maxWithdrawal) {
      setError(`Maximum withdrawal amount is ₹${maxWithdrawal.toLocaleString('en-IN')}.`);
      return;
    }

    if (amount > withdrawableBalance) {
      setError(
        `Insufficient Withdraw Wallet balance. You have ₹${(Number(withdrawableBalance) || 0).toFixed(2)} in your withdraw balance.`
      );
      return;
    }

    const cleanPin = withdrawalPassword.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      setError('Withdrawal PIN must be exactly 4 digits.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await submitUsdtWithdrawalRequest({
        userId,
        amount,
        network,
        usdtAddress: cleanAddress,
        withdrawalPassword: cleanPin,
      });

      onShowToast(`USDT withdrawal request of ${usdtAmount} USDT (₹${amount}) submitted!`);
      if (onRefreshData) onRefreshData();
      await loadSettings();
      setTimeout(() => {
        onNavigateTab('transactions');
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to submit USDT withdrawal request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-gray-900 pb-28">
      {/* Orange Curved Header matching App theme */}
      <div className="relative bg-gradient-to-b from-[#FF6000] to-[#FF7A00] text-white pt-5 pb-14 px-4 overflow-hidden">
        {/* Subtle geometric curved background rings */}
        <div className="absolute inset-0 opacity-15 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 400 200" fill="none" preserveAspectRatio="none">
            <circle cx="200" cy="-50" r="180" stroke="white" strokeWidth="1.5" />
            <circle cx="200" cy="-50" r="230" stroke="white" strokeWidth="1.5" />
            <circle cx="200" cy="-50" r="280" stroke="white" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 -ml-0.5" />
          </button>

          <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-300" />
            <span>USDT Withdrawal</span>
          </h1>

          <button
            onClick={() => onNavigateTab('transactions')}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm hover:bg-gray-100 transition-colors cursor-pointer"
            title="Withdrawal Records"
          >
            <FileText className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Container with rounded top overlapping orange header */}
      <div className="relative -mt-6 max-w-lg mx-auto bg-white rounded-t-[32px] shadow-sm px-5 pt-7 pb-10 min-h-[calc(100vh-140px)] flex flex-col justify-between">
        <div className="space-y-5">
          {/* Main Withdraw Amount Display */}
          <div className="text-center space-y-1.5">
            <div className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
              ₹{amount.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center justify-center gap-1.5 text-emerald-600 font-extrabold text-sm sm:text-base">
              <span>≈ {usdtAmount} USDT</span>
              <span className="text-[11px] text-gray-400 font-normal">(@ ₹{usdtRate}/USDT)</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 font-medium pt-1">
              Withdraw Wallet balance:{' '}
              {loading && !wallet ? (
                <span className="inline-block w-16 h-3.5 bg-gray-200 rounded animate-pulse align-middle ml-1" />
              ) : (
                <span className="font-bold text-gray-800">₹{(Number(withdrawableBalance) || 0).toFixed(2)}</span>
              )}
            </p>
            {topupBalance > 0 && (
              <p className="text-[11px] text-gray-400 font-medium">
                (Topup Wallet: ₹{(Number(topupBalance) || 0).toFixed(2)} — dedicated for plan activations)
              </p>
            )}
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2.5 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Network Selection (TRC20 vs BEP20) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Select USDT Network
              </label>
              <span className="text-[11px] font-semibold text-emerald-600">Manual Payout</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setNetwork('TRC20')}
                className={`py-3 px-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  network === 'TRC20'
                    ? 'border-[#FF6000] bg-[#FFF4EB] text-[#FF6000] shadow-xs'
                    : 'border-gray-200 bg-[#FAFAFA] text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${network === 'TRC20' ? 'bg-[#FF6000]' : 'bg-gray-300'}`} />
                <span>USDT - TRC20 (Tron)</span>
              </button>

              <button
                type="button"
                onClick={() => setNetwork('BEP20')}
                className={`py-3 px-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  network === 'BEP20'
                    ? 'border-[#FF6000] bg-[#FFF4EB] text-[#FF6000] shadow-xs'
                    : 'border-gray-200 bg-[#FAFAFA] text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${network === 'BEP20' ? 'bg-[#FF6000]' : 'bg-gray-300'}`} />
                <span>USDT - BEP20 (BNB Chain)</span>
              </button>
            </div>
          </div>

          {/* USDT Wallet Address Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-[#FF6000]" />
                <span>Destination {network} Address</span>
              </label>
              {cleanAddress && (
                <span className={`text-[11px] font-semibold flex items-center gap-1 ${isAddressValid ? 'text-emerald-600' : 'text-red-500'}`}>
                  {isAddressValid ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Valid Format</span>
                    </>
                  ) : (
                    <span>Invalid Syntax</span>
                  )}
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={usdtAddress}
                onChange={(e) => {
                  setUsdtAddress(e.target.value.trim());
                  setError(null);
                }}
                placeholder={network === 'TRC20' ? 'Starts with T... (34 characters)' : 'Starts with 0x... (42 characters)'}
                className={`w-full bg-[#FAFAFA] border font-mono text-xs ${
                  cleanAddress && isAddressValid
                    ? 'border-emerald-500 ring-1 ring-emerald-500/20'
                    : cleanAddress && !isAddressValid
                    ? 'border-red-400'
                    : 'border-gray-200 focus:border-[#FF6000]'
                } rounded-2xl px-4 py-3.5 text-gray-900 focus:outline-none focus:bg-white transition-all`}
              />
            </div>
            <p className="text-[11px] text-gray-400 px-1">
              {network === 'TRC20'
                ? 'Standard Tron TRC20 address. Starts with "T", 34 characters.'
                : 'Binance Smart Chain BEP20 address. Starts with "0x", 42 characters.'}
            </p>
          </div>

          {/* Grid of Preset Withdrawal Amounts */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider px-1 block">
              Withdrawal Amount (₹ INR)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_WITHDRAW_AMOUNTS.map((amt) => {
                const isSelected = amount === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handlePresetSelect(amt)}
                    className={`py-3 px-1 rounded-2xl font-extrabold text-xs sm:text-sm transition-all text-center flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-[#FFF4EB] border-2 border-[#FF6000] text-[#FF6000] shadow-xs'
                        : 'bg-[#f8f9fa] border border-transparent text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    <span>₹{amt >= 1000 ? `${amt / 1000}k` : amt}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Amount Input Field */}
          <div className="space-y-1">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-base select-none">
                ₹
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={customAmount}
                onChange={handleCustomAmountChange}
                placeholder="Enter custom amount in INR"
                className={`w-full bg-[#FAFAFA] border ${
                  customAmount && amount > 0
                    ? 'border-[#FF6000] bg-[#FFF4EB]/20 ring-1 ring-[#FF6000]/20'
                    : 'border-gray-200 focus:border-[#FF6000] focus:bg-white'
                } rounded-2xl pl-9 pr-14 py-3.5 text-gray-900 font-bold text-sm focus:outline-none transition-all placeholder:font-normal placeholder:text-gray-400`}
              />
              {customAmount && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomAmount('');
                    setAmount(0);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 px-2 py-1 text-xs font-semibold rounded-lg bg-gray-100 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Live Financial Breakdown Card */}
          <div className="p-4 bg-[#FAFAFA] rounded-2xl border border-gray-200 space-y-2 text-xs">
            <div className="flex justify-between items-center text-gray-600">
              <span>Gross Withdrawal:</span>
              <span className="font-bold text-gray-900">₹{amount.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Platform Fee ({withdrawalFeePercent}%):</span>
              <span className="font-semibold text-gray-700">₹{feeInr.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Net INR Amount:</span>
              <span className="font-semibold text-gray-700">₹{netInr.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Admin USDT Exchange Rate:</span>
              <span className="font-bold text-purple-600">1 USDT = ₹{usdtRate}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between items-center font-bold">
              <span className="text-gray-800">You Receive:</span>
              <span className="text-emerald-600 text-base font-extrabold">{usdtAmount} USDT</span>
            </div>
          </div>

          {/* Withdrawal PIN Input */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#FF6000]" />
                <span>Withdrawal PIN</span>
              </label>
              <span className="text-[11px] text-gray-400 font-medium">4-Digit Security PIN</span>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={4}
                value={withdrawalPassword}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setWithdrawalPassword(digits);
                }}
                placeholder="Enter 4-digit withdrawal PIN"
                className="w-full bg-[#FAFAFA] border border-gray-200 rounded-2xl px-4 py-3.5 text-gray-900 font-medium text-sm focus:outline-none focus:border-[#FF6000] focus:bg-white transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !amount || amount <= 0 || !cleanAddress || !isAddressValid}
              className="w-full py-4 rounded-2xl bg-[#FF6000] hover:bg-[#E05300] active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-orange-700/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting USDT Withdrawal...</span>
                </>
              ) : (
                <span>
                  Confirm Withdrawal ({usdtAmount > 0 ? `${usdtAmount} USDT` : `₹${amount}`})
                </span>
              )}
            </button>
          </div>

          {/* Notice Box */}
          <div className="p-4 bg-[#f8f9fa] rounded-2xl border border-gray-100 text-xs text-gray-500 leading-relaxed space-y-1">
            <p className="font-semibold text-gray-700 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-purple-600" />
              <span>USDT Withdrawal Rules:</span>
            </p>
            <p>1. Manual USDT payouts are processed to your provided <strong>{network}</strong> destination wallet address.</p>
            <p>2. Each disbursement is verified on the blockchain and recorded with a valid transaction hash (TXID).</p>
            <p>3. Standard processing fee of <strong>{withdrawalFeePercent}%</strong> applies before conversion at the live admin rate (<strong>₹{usdtRate}/USDT</strong>).</p>
            <p>4. Limits: Minimum ₹{minWithdrawal.toLocaleString('en-IN')}, Maximum ₹{maxWithdrawal.toLocaleString('en-IN')}.</p>
            <p>5. Double-check your destination wallet address carefully. Blockchain transfers cannot be cancelled or reversed once disbursed.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
