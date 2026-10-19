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
  Coins,
} from 'lucide-react';
import { BankAccount, Wallet, UsdtSettings } from '../types';
import {
  fetchBankAccounts,
  submitWithdrawalRequest,
  submitUsdtWithdrawalRequest,
  fetchSystemSettings,
  fetchUsdtSettings,
} from '../services/api';

type WithdrawalMethod = 'BANK' | 'USDT';
type UsdtNetwork = 'TRC20' | 'BEP20';

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
  const [withdrawalMethod, setWithdrawalMethod] = useState<WithdrawalMethod>('BANK');
  const [amount, setAmount] = useState<string>('300');
  const [withdrawalPassword, setWithdrawalPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Bank state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');

  // USDT state
  const [usdtNetwork, setUsdtNetwork] = useState<UsdtNetwork>('TRC20');
  const [usdtWalletAddress, setUsdtWalletAddress] = useState<string>('');
  const [usdtSettings, setUsdtSettings] = useState<UsdtSettings>({
    isEnabled: true,
    usdtRate: 100,
    trc20Address: '',
    bep20Address: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minWithdrawal, setMinWithdrawal] = useState<number>(300);
  const [maxWithdrawal, setMaxWithdrawal] = useState<number>(100000);
  const [withdrawalFeePercent, setWithdrawalFeePercent] = useState<number>(10);
  const [isWithdrawalEnabled, setIsWithdrawalEnabled] = useState<boolean>(true);

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
      fetchSystemSettings()
        .then((sys) => {
          if (sys) {
            if (typeof sys.minWithdrawal === 'number' && sys.minWithdrawal > 0) {
              setMinWithdrawal(sys.minWithdrawal);
              setAmount(String(sys.minWithdrawal));
            }
            if (typeof sys.maxWithdrawal === 'number' && sys.maxWithdrawal > 0) {
              setMaxWithdrawal(sys.maxWithdrawal);
            }
            if (typeof sys.withdrawalFeePercent === 'number') {
              setWithdrawalFeePercent(sys.withdrawalFeePercent);
            }
            if (typeof sys.isWithdrawalEnabled === 'boolean') {
              setIsWithdrawalEnabled(sys.isWithdrawalEnabled);
            }
          }
        })
        .catch(() => {});
      fetchUsdtSettings()
        .then((usdt) => {
          if (usdt) setUsdtSettings(usdt);
        })
        .catch(() => {});
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const withdrawableEarnings = wallet?.withdrawBalance ?? wallet?.earnedBalance ?? wallet?.availableBalance ?? 0;
  const rechargeBalance = wallet?.topupBalance ?? wallet?.rechargeBalance ?? 0;

  const numAmount = parseFloat(amount) || 0;
  const feeAmount = +((numAmount * withdrawalFeePercent) / 100).toFixed(2);
  const netReceivedAmount = Math.max(0, +(numAmount - feeAmount).toFixed(2));
  const currentUsdtRate = Number(usdtSettings.usdtRate) > 0 ? Number(usdtSettings.usdtRate) : 100;
  const estimatedUsdt = netReceivedAmount > 0 ? +(netReceivedAmount / currentUsdtRate).toFixed(4) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWithdrawalEnabled) {
      setError('Withdrawals are temporarily disabled by the administrator.');
      return;
    }
    if (numAmount < minWithdrawal) {
      setError(`Minimum withdrawal amount is ₹${minWithdrawal.toLocaleString('en-IN')}.`);
      return;
    }
    if (maxWithdrawal > 0 && numAmount > maxWithdrawal) {
      setError(`Maximum single withdrawal amount is ₹${maxWithdrawal.toLocaleString('en-IN')}.`);
      return;
    }
    if (numAmount > withdrawableEarnings) {
      setError('Insufficient withdrawable balance in Withdraw Wallet.');
      return;
    }

    const cleanPin = withdrawalPassword.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      setError('Withdrawal PIN must be exactly 4 digits.');
      return;
    }

    if (withdrawalMethod === 'BANK') {
      if (!selectedBankId) {
        setError('Please select or bind a bank account first.');
        return;
      }
    } else {
      const cleanAddr = usdtWalletAddress.trim();
      if (!cleanAddr) {
        setError('Please enter your USDT receiving wallet address.');
        return;
      }
      if (usdtNetwork === 'TRC20') {
        if (cleanAddr.startsWith('0x') || cleanAddr.startsWith('0X')) {
          setError('Invalid TRC20 address: Begins with "0x" (BEP20 format), but TRC20 was selected.');
          return;
        }
        if (!/^T[1-9A-HJ-NP-za-km-z]{33}$/.test(cleanAddr)) {
          setError('Invalid TRC20 wallet address. TRC20 addresses must start with "T" and contain 34 characters.');
          return;
        }
      } else if (usdtNetwork === 'BEP20') {
        if (cleanAddr.startsWith('T') || cleanAddr.startsWith('t')) {
          setError('Invalid BEP20 address: Begins with "T" (TRC20 format), but BEP20 was selected.');
          return;
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddr)) {
          setError('Invalid BEP20 wallet address. BEP20 addresses must start with "0x" and be 42 characters long.');
          return;
        }
      }
    }

    setLoading(true);
    setError(null);

    try {
      if (withdrawalMethod === 'BANK') {
        await submitWithdrawalRequest(
          userId,
          numAmount,
          selectedBankId,
          withdrawalPassword.trim()
        );
        onSuccess(`Bank withdrawal request of ₹${numAmount} submitted for processing.`);
      } else {
        await submitUsdtWithdrawalRequest({
          userId,
          amount: numAmount,
          network: usdtNetwork,
          usdtAddress: usdtWalletAddress.trim(),
          withdrawalPassword: withdrawalPassword.trim(),
        });
        onSuccess(`USDT withdrawal request of ${estimatedUsdt.toFixed(2)} USDT (₹${numAmount}) submitted for processing.`);
      }
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
                {withdrawalMethod === 'BANK' ? <Banknote className="w-5 h-5" /> : <Coins className="w-5 h-5 text-emerald-400" />}
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  {withdrawalMethod === 'BANK' ? 'Bank Withdrawal' : 'USDT Crypto Withdrawal'}
                </h3>
                <span className="text-[10px] text-gray-400 font-medium">
                  {withdrawalMethod === 'BANK' ? 'Direct Bank Settlement (IMPS/NEFT)' : 'USDT Transfer (TRC20 / BEP20)'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto no-scrollbar space-y-4">
            {/* Method Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#121212] rounded-xl border border-[#2a2a2a]">
              <button
                type="button"
                onClick={() => {
                  setWithdrawalMethod('BANK');
                  setError(null);
                }}
                className={`py-2 px-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  withdrawalMethod === 'BANK'
                    ? 'bg-[#2a2a2a] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Building2 className={`w-3.5 h-3.5 ${withdrawalMethod === 'BANK' ? 'text-[#FF6000]' : 'text-gray-500'}`} />
                <span>Bank Card</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setWithdrawalMethod('USDT');
                  setError(null);
                }}
                className={`py-2 px-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  withdrawalMethod === 'USDT'
                    ? 'bg-[#2a2a2a] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Coins className={`w-3.5 h-3.5 ${withdrawalMethod === 'USDT' ? 'text-emerald-400' : 'text-gray-500'}`} />
                <span>USDT Crypto</span>
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Balance Breakdown Display */}
            <div className="p-3 bg-[#121212] rounded-xl border border-[#2a2a2a] space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10.5px] text-gray-400 block font-medium">Withdrawable Balance</span>
                  <span className="text-lg font-extrabold text-[#FF6000]">
                    ₹{(Number(withdrawableEarnings) || 0).toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAmount(withdrawableEarnings.toString())}
                  className="px-2.5 py-1 rounded-lg bg-[#2a2a2a] hover:bg-[#333] text-gray-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Max
                </button>
              </div>

              {rechargeBalance > 0 && (
                <div className="pt-1.5 border-t border-[#222] text-[10px] text-gray-500">
                  Topup Wallet (Plan Activation): ₹{(Number(rechargeBalance) || 0).toFixed(2)}
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
                  placeholder={`Min ₹${minWithdrawal}`}
                  className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl pl-8 pr-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-[#FF6000]"
                />
              </div>
              {withdrawalMethod === 'USDT' && numAmount > 0 && (
                <span className="text-[11px] text-emerald-400 font-semibold mt-1 block">
                  ≈ {estimatedUsdt.toFixed(4)} USDT (@ ₹{currentUsdtRate}/USDT)
                </span>
              )}
            </div>

            {/* BANK METHOD: Bank Accounts List */}
            {withdrawalMethod === 'BANK' && (
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
                      className="px-3 py-1.5 rounded-lg bg-[#FF6000] text-white text-xs font-bold cursor-pointer"
                    >
                      Bind Bank Card Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                    {bankAccounts.map((bank) => {
                      const isSelected = bank.id === selectedBankId;
                      return (
                        <div
                          key={bank.id}
                          onClick={() => setSelectedBankId(bank.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#FF6000]/15 border-[#FF6000] text-white'
                              : 'bg-[#121212] border-[#2a2a2a] text-gray-400 hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center gap-2">
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
            )}

            {/* USDT METHOD: Network Selector & Address */}
            {withdrawalMethod === 'USDT' && (
              <div className="space-y-3">
                {/* Network Buttons */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Select Network
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUsdtNetwork('TRC20')}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        usdtNetwork === 'TRC20'
                          ? 'border-[#FF6000] bg-orange-500/10 text-white font-bold'
                          : 'border-[#2a2a2a] bg-[#121212] text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <span className="text-xs block">TRC20 (TRON)</span>
                      <span className="text-[9.5px] text-gray-500">Starts with T</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUsdtNetwork('BEP20')}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        usdtNetwork === 'BEP20'
                          ? 'border-[#FF6000] bg-orange-500/10 text-white font-bold'
                          : 'border-[#2a2a2a] bg-[#121212] text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      <span className="text-xs block">BEP20 (BNB Chain)</span>
                      <span className="text-[9.5px] text-gray-500">Starts with 0x</span>
                    </button>
                  </div>
                </div>

                {/* Receiving Address */}
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Receiving Wallet Address ({usdtNetwork})
                  </label>
                  <input
                    type="text"
                    value={usdtWalletAddress}
                    onChange={(e) => setUsdtWalletAddress(e.target.value.trim())}
                    placeholder={
                      usdtNetwork === 'TRC20'
                        ? 'Paste TRC20 address (T...)'
                        : 'Paste BEP20 address (0x...)'
                    }
                    className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:font-sans placeholder:text-gray-500 focus:outline-none focus:border-[#FF6000]"
                  />
                  <div className="p-2 mt-2 bg-amber-950/40 border border-amber-800/40 rounded-lg text-[10px] text-amber-300/90 leading-tight">
                    ⚠️ Verify network ({usdtNetwork}). TRC20 and BEP20 addresses are not interchangeable.
                  </div>
                </div>
              </div>
            )}

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
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Summary info */}
            <div className="p-3 bg-[#181818] rounded-xl border border-[#262626] text-xs text-gray-400 space-y-1.5">
              <div className="flex justify-between">
                <span>Requested Amount:</span>
                <span className="text-white font-bold">₹{(Number(numAmount) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform Fee ({withdrawalFeePercent}%):</span>
                <span className="text-red-400 font-medium">-₹{(Number(feeAmount) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-[#262626] pt-1 font-semibold">
                <span className="text-gray-300">Net Settlement:</span>
                <span className="text-emerald-400 font-bold">₹{(Number(netReceivedAmount) || 0).toFixed(2)}</span>
              </div>
              {withdrawalMethod === 'USDT' && (
                <div className="flex justify-between font-bold text-emerald-400">
                  <span>Net USDT Payable:</span>
                  <span>{estimatedUsdt.toFixed(4)} USDT</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-[#2a2a2a] hover:bg-[#333] text-gray-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || (withdrawalMethod === 'BANK' && !selectedBankId) || !numAmount}
                className="flex-1 py-3 rounded-xl bg-[#FF6000] hover:bg-[#E05300] text-white font-bold text-xs shadow-lg shadow-orange-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>
                    {withdrawalMethod === 'USDT'
                      ? `Confirm USDT (${estimatedUsdt > 0 ? estimatedUsdt.toFixed(2) : '0.00'})`
                      : 'Confirm Withdraw'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
