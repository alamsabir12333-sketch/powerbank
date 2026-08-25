import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  FileText,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Building,
  ShieldCheck,
} from 'lucide-react';
import { BankAccount, Wallet, WithdrawalItem } from '../types';
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
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minWithdrawal, setMinWithdrawal] = useState<number>(300);
  const [withdrawalFeePercent, setWithdrawalFeePercent] = useState<number>(10);

  const withdrawableBalance = wallet?.earnedBalance ?? wallet?.availableBalance ?? 7.78;

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
        setSelectedBankId(banks[0].id);
      }
      if (settings?.minWithdrawal) {
        setMinWithdrawal(settings.minWithdrawal);
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

  const feeAmount = (amount * withdrawalFeePercent) / 100;
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

    if (amount < minWithdrawal) {
      setError(`Minimum withdrawal amount is ₹${minWithdrawal}.`);
      return;
    }

    if (amount > withdrawableBalance) {
      setError(
        `Insufficient available balance. You have ₹${withdrawableBalance.toFixed(2)} in balance.`
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await submitWithdrawalRequest(
        userId,
        amount,
        activeBank.id,
        activeBank.upiId || undefined
      );

      onShowToast(`Withdrawal request for ₹${amount} submitted successfully!`);
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

          <h1 className="text-lg font-bold text-white tracking-wide">Withdraw</h1>

          <button
            onClick={() => onNavigateTab('transactions')}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm hover:bg-gray-100 transition-colors cursor-pointer"
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
              Available balance: ₹{withdrawableBalance.toFixed(2)}
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2.5 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Bank Card Selector Box */}
          <div
            onClick={() => {
              if (onOpenBindCard) onOpenBindCard();
              else onNavigateTab('bank_card');
            }}
            className="p-4 rounded-2xl border border-gray-200 hover:border-gray-300 bg-white flex items-center justify-between cursor-pointer transition-all shadow-xs"
          >
            <div className="flex items-center gap-3">
              {/* UPI Logo Icon */}
              <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                <div className="flex items-center gap-0.5">
                  <span className="text-xs font-black italic tracking-tighter text-[#FF6000]">UPI</span>
                  <span className="text-orange-500 text-[10px] font-black">▶</span>
                </div>
              </div>

              <div>
                <span className="text-sm font-bold text-gray-900 flex items-center gap-1">
                  {activeBank ? `${activeBank.bankName} - ${activeBank.accountHolderName}` : 'Add Bank Card'}
                  <span className="text-gray-400 font-normal">›</span>
                </span>
                <span className="text-xs font-mono text-gray-400 block mt-0.5">
                  {activeBank
                    ? `**** **** ${activeBank.accountNumber.slice(-4)}`
                    : '**** ****'}
                </span>
              </div>
            </div>

            {activeBank ? (
              <ShieldCheck className="w-5 h-5 text-orange-500 shrink-0" />
            ) : (
              <span className="text-xs font-bold text-[#FF6000] hover:underline">Link</span>
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
                  onClick={() => setAmount(amt)}
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

          {/* Calculation Details Section */}
          <div className="pt-2 space-y-2">
            <div>
              <span className="text-xs font-semibold text-gray-400 block">Total</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-[#FF6000] tracking-tight">
                ₹{amount}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <div className="space-y-0.5">
                <div className="font-semibold text-gray-700">
                  Amount Received: ₹{receivedAmount.toFixed(2)}
                </div>
                <div className="text-gray-400">
                  Withdrawal Fee: ₹{feeAmount.toFixed(2)}
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-[#FF6000]">
                  Withdrawal Fee: {withdrawalFeePercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Notice Box */}
          <div className="p-4 bg-[#f8f9fa] rounded-2xl border border-gray-100 text-xs text-gray-400 leading-relaxed">
            1. Once your withdrawal request is submitted, it will be reviewed within 48 hours. If there is a public holiday, the review will be processed on the next working day.
          </div>
        </div>

        {/* Fixed / Sticky Bottom Action Button */}
        <div className="pt-8">
          {!activeBank ? (
            <button
              type="button"
              onClick={() => {
                if (onOpenBindCard) onOpenBindCard();
                else onNavigateTab('bank_card');
              }}
              className="w-full py-4 rounded-2xl bg-[#FF6000] hover:bg-[#E05300] active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-orange-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Add Bank Card</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-4 rounded-2xl bg-[#FF6000] hover:bg-[#E05300] active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-orange-700/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Withdrawal...</span>
                </>
              ) : (
                <span>Withdraw (₹{amount})</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
