import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  FileText,
  AlertCircle,
  RefreshCw,
  Building2,
  ShieldCheck,
  CreditCard,
  Plus,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { BankAccount, Wallet } from '../types';
import {
  fetchBankAccounts,
  submitWithdrawalRequest,
  fetchSystemSettings,
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

export const WithdrawalPage: React.FC<WithdrawalPageProps> = ({
  userId,
  wallet,
  onBack,
  onNavigateTab,
  onShowToast,
  onOpenBindCard,
  onRefreshData,
}) => {
  const [amount, setAmount] = useState<number>(300);
  const [customAmount, setCustomAmount] = useState<string>('300');
  const [withdrawalPassword, setWithdrawalPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minWithdrawal, setMinWithdrawal] = useState<number>(300);
  const [withdrawalFeePercent, setWithdrawalFeePercent] = useState<number>(10);

  const withdrawableBalance = wallet?.withdrawBalance ?? wallet?.earnedBalance ?? wallet?.availableBalance ?? 0;
  const topupBalance = wallet?.topupBalance ?? wallet?.rechargeBalance ?? 0;

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [banks, settings] = await Promise.all([
        fetchBankAccounts(userId),
        fetchSystemSettings().catch(() => null),
      ]);
      setBankAccounts(banks);
      if (banks.length > 0) {
        const defaultCard = banks.find((b) => b.isDefault) || banks[0];
        setSelectedBankId(defaultCard.id);
      }
      if (settings?.minWithdrawal) {
        setMinWithdrawal(settings.minWithdrawal);
      }
      if (typeof settings?.withdrawalFeePercent === 'number') {
        setWithdrawalFeePercent(settings.withdrawalFeePercent);
      }
    } catch (err: any) {
      console.error('Failed to load withdrawal details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const activeBank = bankAccounts.find((b) => b.id === selectedBankId) || (bankAccounts.length > 0 ? bankAccounts[0] : null);

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

  const feeAmount = amount > 0 ? (amount * withdrawalFeePercent) / 100 : 0;
  const receivedAmount = Math.max(0, amount - feeAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeBank) {
      if (onOpenBindCard) {
        onOpenBindCard();
      } else {
        onNavigateTab('bank_card');
      }
      return;
    }

    if (!amount || amount <= 0) {
      setError('Please enter a valid withdrawal amount.');
      return;
    }

    if (amount < minWithdrawal) {
      setError(`Minimum withdrawal amount is ₹${minWithdrawal}.`);
      return;
    }

    if (amount > withdrawableBalance) {
      setError(
        `Insufficient Withdraw Wallet balance. You have ₹${withdrawableBalance.toFixed(2)} in your withdraw balance.`
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
      await submitWithdrawalRequest(
        userId,
        amount,
        activeBank.id,
        withdrawalPassword.trim()
      );

      onShowToast(`Withdrawal request of ₹${amount} submitted successfully!`);
      if (onRefreshData) onRefreshData();
      await loadData();
      setTimeout(() => {
        onNavigateTab('transactions');
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to submit withdrawal request.');
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

          <h1 className="text-lg font-bold text-white tracking-wide">Bank Withdrawal</h1>

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
            <p className="text-xs sm:text-sm text-gray-500 font-medium">
              Withdraw Wallet balance: <span className="font-bold text-gray-800">₹{withdrawableBalance.toFixed(2)}</span>
            </p>
            {topupBalance > 0 && (
              <p className="text-[11px] text-gray-400 font-medium">
                (Topup Wallet: ₹{topupBalance.toFixed(2)} — dedicated for plan activations)
              </p>
            )}
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2.5 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Bank Card Selector Box (Bank Account Only) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                Payout Bank Account
              </label>
              {bankAccounts.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowBankPicker(!showBankPicker)}
                  className="text-xs text-[#FF6000] font-semibold flex items-center gap-1 hover:underline"
                >
                  <span>Switch Card</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div
              onClick={() => {
                if (!activeBank) {
                  if (onOpenBindCard) onOpenBindCard();
                  else onNavigateTab('bank_card');
                } else if (bankAccounts.length > 1) {
                  setShowBankPicker(!showBankPicker);
                } else {
                  onNavigateTab('bank_card');
                }
              }}
              className="p-4 rounded-2xl border border-gray-200 hover:border-gray-300 bg-[#FAFAFA] flex items-center justify-between cursor-pointer transition-all shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-orange-100 text-[#FF6000] flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>

                <div>
                  <span className="text-sm font-bold text-gray-900 flex items-center gap-1">
                    {activeBank
                      ? `${activeBank.bankName} - ${activeBank.accountHolderName || activeBank.holderName}`
                      : 'Add Bank Card'}
                    <span className="text-gray-400 font-normal">›</span>
                  </span>
                  <span className="text-xs font-mono text-gray-500 block mt-0.5">
                    {activeBank
                      ? `A/C: •••• ${activeBank.accountNumber.slice(-4)} (${activeBank.ifsc || activeBank.ifscCode})`
                      : 'Link bank account to withdraw'}
                  </span>
                </div>
              </div>

              {activeBank ? (
                <ShieldCheck className="w-5 h-5 text-[#FF6000] shrink-0" />
              ) : (
                <span className="text-xs font-bold text-[#FF6000] hover:underline">Link</span>
              )}
            </div>

            {/* Dropdown for selecting alternative bank accounts */}
            {showBankPicker && bankAccounts.length > 1 && (
              <div className="p-2 bg-gray-50 rounded-2xl border border-gray-200 space-y-1.5 animate-in fade-in">
                <p className="text-[11px] font-bold text-gray-500 px-2 pt-1">Select Bank Card:</p>
                {bankAccounts.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      setSelectedBankId(b.id);
                      setShowBankPicker(false);
                    }}
                    className={`p-2.5 rounded-xl text-xs flex items-center justify-between cursor-pointer ${
                      b.id === activeBank?.id
                        ? 'bg-orange-100 text-[#FF6000] font-bold'
                        : 'bg-white hover:bg-gray-100 text-gray-700 font-medium'
                    }`}
                  >
                    <span>
                      {b.bankName} — A/C •••• {b.accountNumber.slice(-4)}
                    </span>
                    {b.isDefault && <span className="text-[10px] bg-orange-200/60 px-2 py-0.5 rounded-full">Default</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grid of Preset Withdrawal Amounts (3 columns) */}
          <div className="grid grid-cols-3 gap-3">
            {PRESET_WITHDRAW_AMOUNTS.map((amt) => {
              const isSelected = amount === amt;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handlePresetSelect(amt)}
                  className={`py-4 px-2 rounded-2xl font-extrabold text-base sm:text-lg transition-all text-center flex items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'bg-[#FFF4EB] border-2 border-[#FF6000] text-[#FF6000] shadow-sm'
                      : 'bg-[#f8f9fa] border border-transparent text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <span>₹{amt}</span>
                </button>
              );
            })}
          </div>

          {/* Custom Amount Input Field immediately below preset buttons */}
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
                placeholder="Enter custom amount"
                className={`w-full bg-[#FAFAFA] border ${
                  customAmount && amount > 0
                    ? 'border-[#FF6000] bg-[#FFF4EB]/20 ring-1 ring-[#FF6000]/20'
                    : 'border-gray-200 focus:border-[#FF6000] focus:bg-white'
                } rounded-2xl pl-9 pr-14 py-3.5 text-gray-900 font-bold text-base focus:outline-none transition-all placeholder:font-normal placeholder:text-gray-400`}
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

          {/* Calculation Details Section */}
          <div className="pt-2 space-y-2">
            <div>
              <span className="text-xs font-semibold text-gray-400 block">Total Withdrawal</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-[#FF6000] tracking-tight">
                ₹{amount > 0 ? amount.toLocaleString('en-IN') : 0}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <div className="space-y-0.5">
                <div className="font-semibold text-gray-700">
                  Bank Settlement Amount: ₹{receivedAmount.toFixed(2)}
                </div>
                <div className="text-gray-400">
                  Processing Fee ({withdrawalFeePercent}%): ₹{feeAmount.toFixed(2)}
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-[#FF6000]">
                  Payout Mode: Bank Card
                </span>
              </div>
            </div>
          </div>

          {/* Withdrawal PIN Input Card */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#FF6000]" />
                <span>Withdrawal PIN</span>
              </label>
              <span className="text-[11px] text-gray-400 font-medium">Security Verification</span>
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

          {/* Confirm Button immediately BELOW the Withdrawal PIN section */}
          <div className="pt-2">
            {!activeBank ? (
              <button
                type="button"
                onClick={() => {
                  if (onOpenBindCard) onOpenBindCard();
                  else onNavigateTab('bank_card');
                }}
                className="w-full py-4 rounded-2xl bg-[#FF6000] hover:bg-[#E05300] active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-orange-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>Bind Bank Card to Withdraw</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !amount || amount <= 0}
                className="w-full py-4 rounded-2xl bg-[#FF6000] hover:bg-[#E05300] active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-orange-700/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting Withdrawal...</span>
                  </>
                ) : (
                  <span>Confirm Bank Withdrawal (₹{amount > 0 ? amount.toLocaleString('en-IN') : 0})</span>
                )}
              </button>
            )}
          </div>

          {/* Notice Box */}
          <div className="p-4 bg-[#f8f9fa] rounded-2xl border border-gray-100 text-xs text-gray-500 leading-relaxed space-y-1">
            <p className="font-semibold text-gray-700">Withdrawal Rules:</p>
            <p>1. Withdrawals are processed directly to your bound bank account (IMPS / NEFT transfer).</p>
            <p>2. Review and transfer takes 24–48 hours on standard business banking days.</p>
            <p>3. Ensure bank account details and IFSC are accurate to avoid payout delays.</p>
            <p>4. Standard processing fee of {withdrawalFeePercent}% applies on all withdrawals.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
