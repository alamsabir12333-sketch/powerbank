import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ShieldCheck,
  CreditCard,
  AlertCircle,
  Plus,
  Banknote,
  CheckCircle2,
  RefreshCw,
  Building2,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { BankAccount, Wallet } from '../types';
import { fetchBankAccounts, submitWithdrawalRequest, fetchSystemSettings } from '../services/api';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  wallet: Wallet | null;
  onOpenBindCard: () => void;
  onSuccess: (msg: string) => void;
}

export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  isOpen,
  onClose,
  userId,
  wallet,
  onOpenBindCard,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<string>('300');
  const [withdrawalPassword, setWithdrawalPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minWithdrawal, setMinWithdrawal] = useState<number>(300);
  const [withdrawalFeePercent, setWithdrawalFeePercent] = useState<number>(10);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setWithdrawalPassword('');
      fetchBankAccounts(userId).then((banks) => {
        setBankAccounts(banks);
        if (banks.length > 0) {
          const def = banks.find((b) => b.isDefault) || banks[0];
          setSelectedBankId(def.id);
        }
      });
      fetchSystemSettings().then((sys) => {
        if (sys) {
          if (typeof sys.minWithdrawal === 'number' && sys.minWithdrawal > 0) {
            setMinWithdrawal(sys.minWithdrawal);
            setAmount(String(sys.minWithdrawal));
          }
          if (typeof sys.withdrawalFeePercent === 'number') {
            setWithdrawalFeePercent(sys.withdrawalFeePercent);
          }
        }
      }).catch(() => {});
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const withdrawableEarnings = wallet?.withdrawBalance ?? wallet?.earnedBalance ?? wallet?.availableBalance ?? 0;
  const rechargeBalance = wallet?.topupBalance ?? wallet?.rechargeBalance ?? 0;

  const numAmount = parseFloat(amount) || 0;
  const selectedBank = bankAccounts.find((b) => b.id === selectedBankId);
  const feeAmount = +((numAmount * withdrawalFeePercent) / 100).toFixed(2);
  const netReceivedAmount = Math.max(0, +(numAmount - feeAmount).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount < minWithdrawal) {
      setError(`Minimum withdrawal amount is ₹${minWithdrawal}.`);
      return;
    }
    if (numAmount > withdrawableEarnings) {
      setError('Insufficient withdrawable balance in Withdraw Wallet.');
      return;
    }
    if (!selectedBankId) {
      setError('Please select or bind a bank account first.');
      return;
    }
    const cleanPin = withdrawalPassword.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      setError('Withdrawal PIN must be exactly 4 digits.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await submitWithdrawalRequest(
        userId,
        numAmount,
        selectedBankId,
        withdrawalPassword.trim()
      );

      onSuccess(`Bank withdrawal request of ₹${numAmount} submitted for processing.`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit withdrawal request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-sm bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden text-white z-10 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] bg-[#181818]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FF6000]/15 text-[#FF6000] flex items-center justify-center">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Bank Withdrawal</h3>
                <span className="text-[10px] text-gray-400 font-medium">Direct Bank Settlement (IMPS/NEFT)</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto no-scrollbar space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Balance Breakdown Display */}
            <div className="p-3.5 bg-[#121212] rounded-xl border border-[#2a2a2a] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-gray-400 block font-medium">Withdraw Wallet Balance</span>
                  <span className="text-xl font-extrabold text-[#FF6000]">
                    ₹{withdrawableEarnings.toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAmount(withdrawableEarnings.toString())}
                  className="px-2.5 py-1 rounded-lg bg-[#2a2a2a] hover:bg-[#333] text-gray-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  All In
                </button>
              </div>

              {rechargeBalance > 0 && (
                <div className="pt-2 border-t border-[#222] text-[10.5px] text-gray-400">
                  Topup Wallet (Non-withdrawable): <strong className="text-gray-200">₹{rechargeBalance.toFixed(2)}</strong>
                </div>
              )}
            </div>

            {/* Amount input */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Withdrawal Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Min ₹100"
                  className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl pl-8 pr-4 py-2.5 text-white font-bold text-base focus:outline-none focus:border-[#FF6000]"
                />
              </div>
              <span className="text-[10.5px] text-gray-500 mt-1 block">
                Minimum withdrawal amount is ₹100.
              </span>
            </div>

            {/* Bank Accounts List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">Select Bank Card</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBindCard();
                  }}
                  className="text-xs text-[#FF6000] font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Bank Card</span>
                </button>
              </div>

              {bankAccounts.length === 0 ? (
                <div className="p-4 bg-[#121212] rounded-xl border border-dashed border-[#333] text-center space-y-2">
                  <Building2 className="w-6 h-6 text-gray-500 mx-auto" />
                  <p className="text-xs text-gray-400">No bank account linked yet.</p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenBindCard();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#FF6000] text-white text-xs font-bold"
                  >
                    Bind Bank Card Now
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                  {bankAccounts.map((bank) => {
                    const isSelected = bank.id === selectedBankId;
                    return (
                      <div
                        key={bank.id}
                        onClick={() => setSelectedBankId(bank.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#FF6000]/15 border-[#FF6000] text-white'
                            : 'bg-[#121212] border-[#2a2a2a] text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Building2 className={`w-4 h-4 ${isSelected ? 'text-[#FF6000]' : 'text-gray-500'}`} />
                          <div>
                            <span className="text-xs font-bold text-gray-200 block">
                              {bank.bankName} - {bank.accountHolderName || bank.holderName}
                            </span>
                            <span className="text-[10px] font-mono text-gray-400">
                              A/C: •••• {bank.accountNumber.slice(-4)} | IFSC: {bank.ifsc || bank.ifscCode}
                            </span>
                          </div>
                        </div>

                        {isSelected && <CheckCircle2 className="w-4 h-4 text-[#FF6000]" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Withdrawal PIN Field */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#FF6000]" />
                <span>Withdrawal PIN</span>
              </label>
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
                  className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FF6000]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Summary info */}
            <div className="p-3 bg-[#181818] rounded-xl border border-[#262626] text-xs text-gray-400 space-y-1.5">
              <div className="flex justify-between">
                <span>Requested Amount:</span>
                <span className="text-white font-bold">₹{numAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Handling Fee ({withdrawalFeePercent}%):</span>
                <span className="text-red-400 font-medium">-₹{feeAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-[#262626] pt-1.5 font-semibold">
                <span className="text-gray-300">Net to Bank:</span>
                <span className="text-green-400 font-bold">₹{netReceivedAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span>Payout Method:</span>
                <span className="text-[#FF6000] font-semibold">Bank Account</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-[#2a2a2a] hover:bg-[#333] text-gray-300 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !selectedBankId}
                className="flex-1 py-3 rounded-xl bg-[#FF6000] hover:bg-[#E05300] text-white font-bold text-xs shadow-lg shadow-orange-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Confirm Withdraw</span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
