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
  Info,
} from 'lucide-react';
import { BankAccount, Wallet } from '../types';
import { fetchBankAccounts, submitWithdrawalRequest } from '../services/api';

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
  const [amount, setAmount] = useState<string>('500');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('');
  const [channel, setChannel] = useState<'bank' | 'upi'>('bank');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      fetchBankAccounts(userId).then((banks) => {
        setBankAccounts(banks);
        if (banks.length > 0) {
          const def = banks.find((b) => b.isDefault) || banks[0];
          setSelectedBankId(def.id);
          if (def.upiId) setUpiId(def.upiId);
        }
      });
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const availableBalance = wallet?.availableBalance || 0;
  const earnedBalance = wallet?.earnedBalance !== undefined ? wallet.earnedBalance : availableBalance;
  const rechargeBalance = wallet?.rechargeBalance || 0;
  const withdrawableEarnings = earnedBalance;

  const numAmount = parseFloat(amount) || 0;
  const fee = 0;
  const netAmount = Math.max(0, numAmount - fee);

  const selectedBank = bankAccounts.find((b) => b.id === selectedBankId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount < 100) {
      setError('Minimum withdrawal amount is ₹100.');
      return;
    }
    if (numAmount > withdrawableEarnings) {
      setError('Insufficient withdrawable device earnings. Recharge money cannot be withdrawn.');
      return;
    }
    if (channel === 'bank' && !selectedBankId) {
      setError('Please select or bind a bank account first.');
      return;
    }
    if (channel === 'upi' && !upiId.trim()) {
      setError('Please enter a valid UPI ID.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await submitWithdrawalRequest(
        userId,
        numAmount,
        channel === 'bank' ? selectedBankId : undefined,
        channel === 'upi' ? upiId.trim() : undefined
      );

      onSuccess(`Manual withdrawal request of ₹${numAmount} submitted for Admin review.`);
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
                <h3 className="font-bold text-base text-white">Manual Withdrawal</h3>
                <span className="text-[10px] text-gray-400 font-medium">Device Earnings Payout</span>
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
                  <span className="text-[11px] text-gray-400 block font-medium">Withdrawable Device Earnings</span>
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

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#222] text-[10.5px]">
                <div className="text-gray-400">
                  Total Balance: <strong className="text-gray-200">₹{availableBalance.toFixed(2)}</strong>
                </div>
                <div className="text-gray-400 text-right">
                  Recharge (Non-withdrawable): <strong className="text-gray-400">₹{rechargeBalance.toFixed(2)}</strong>
                </div>
              </div>
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
                Minimum withdrawal amount is ₹100. Fee: 0%
              </span>
            </div>

            {/* Transfer Destination */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Payout Destination
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChannel('bank')}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    channel === 'bank'
                      ? 'bg-[#FF6000]/15 border-[#FF6000] text-[#FF6000]'
                      : 'bg-[#121212] border-[#2a2a2a] text-gray-400'
                  }`}
                >
                  Bank Account
                </button>
                <button
                  type="button"
                  onClick={() => setChannel('upi')}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    channel === 'upi'
                      ? 'bg-[#FF6000]/15 border-[#FF6000] text-[#FF6000]'
                      : 'bg-[#121212] border-[#2a2a2a] text-gray-400'
                  }`}
                >
                  UPI ID
                </button>
              </div>
            </div>

            {/* Bank Accounts List or UPI Input */}
            {channel === 'bank' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-300">Saved Bank Cards</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenBindCard();
                    }}
                    className="text-xs text-[#FF6000] font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New</span>
                  </button>
                </div>

                {bankAccounts.length === 0 ? (
                  <div className="p-3 bg-[#121212] rounded-xl border border-dashed border-[#2a2a2a] text-center">
                    <p className="text-xs text-gray-400 mb-2">No bank account bound yet.</p>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenBindCard();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#FF6000] text-white text-xs font-bold cursor-pointer"
                    >
                      Bind Bank Card Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                    {bankAccounts.map((b) => (
                      <label
                        key={b.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                          selectedBankId === b.id
                            ? 'bg-[#181818] border-[#FF6000]'
                            : 'bg-[#121212] border-[#2a2a2a] opacity-80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <CreditCard className="w-4 h-4 text-[#FF6000]" />
                          <div>
                            <p className="text-xs font-bold text-white leading-tight">
                              {b.bankName}
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono">
                              •••• {b.accountNumber.slice(-4)} ({b.accountHolderName})
                            </p>
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="bank_choice"
                          checked={selectedBankId === b.id}
                          onChange={() => setSelectedBankId(b.id)}
                          className="accent-[#FF6000]"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Recipient UPI ID
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. mobile@upi or username@okhdfcbank"
                  className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#FF6000]"
                />
              </div>
            )}

            {/* Summary */}
            <div className="bg-[#121212] p-3 rounded-xl border border-[#2a2a2a] text-xs space-y-1">
              <div className="flex justify-between text-gray-400">
                <span>Requested Amount</span>
                <span className="font-bold text-white">₹{numAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Platform Fee</span>
                <span className="font-bold text-emerald-400">₹0.00</span>
              </div>
              <div className="flex justify-between text-white font-bold pt-1 border-t border-[#2a2a2a]">
                <span>Net Received</span>
                <span className="text-[#FF6000] text-sm font-extrabold">₹{netAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              disabled={loading || withdrawableEarnings < 100 || numAmount < 100}
              onClick={handleSubmit}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF6000] to-[#FF8C00] text-white font-bold text-sm shadow-md shadow-orange-500/25 active:scale-98 transition-transform disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Request...</span>
                </>
              ) : (
                <span>Submit Withdrawal Request (₹{numAmount.toFixed(2)})</span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
