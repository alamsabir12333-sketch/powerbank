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
  Coins,
  CheckCircle2,
  Copy,
  Check,
  Info,
} from 'lucide-react';
import { BankAccount, Wallet, WithdrawalMethod, UsdtNetwork, UsdtSettings } from '../types';
import {
  fetchBankAccounts,
  submitWithdrawalRequest,
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

export const WithdrawalPage: React.FC<WithdrawalPageProps> = ({
  userId,
  wallet,
  onBack,
  onNavigateTab,
  onShowToast,
  onOpenBindCard,
  onRefreshData,
}) => {
  // Withdrawal Method Selection: 'BANK' or 'USDT'
  const [withdrawalMethod, setWithdrawalMethod] = useState<WithdrawalMethod>('BANK');

  // Amount & PIN
  const [amount, setAmount] = useState<number>(300);
  const [customAmount, setCustomAmount] = useState<string>('300');
  const [withdrawalPassword, setWithdrawalPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Bank Account State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [showBankPicker, setShowBankPicker] = useState(false);

  // USDT Withdrawal State
  const [usdtNetwork, setUsdtNetwork] = useState<UsdtNetwork>('TRC20');
  const [usdtWalletAddress, setUsdtWalletAddress] = useState<string>('');
  const [usdtSettings, setUsdtSettings] = useState<UsdtSettings>({
    isEnabled: true,
    usdtRate: 100,
    trc20Address: '',
    bep20Address: '',
  });

  // System & Limits Configuration
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minWithdrawal, setMinWithdrawal] = useState<number>(300);
  const [maxWithdrawal, setMaxWithdrawal] = useState<number>(100000);
  const [withdrawalFeePercent, setWithdrawalFeePercent] = useState<number>(10);
  const [isWithdrawalEnabled, setIsWithdrawalEnabled] = useState<boolean>(true);

  const withdrawableBalance = wallet?.withdrawBalance ?? wallet?.earnedBalance ?? wallet?.availableBalance ?? 0;
  const topupBalance = wallet?.topupBalance ?? wallet?.rechargeBalance ?? 0;

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [banks, settings, usdt] = await Promise.all([
        fetchBankAccounts(userId),
        fetchSystemSettings().catch(() => null),
        fetchUsdtSettings().catch(() => null),
      ]);
      setBankAccounts(banks);
      if (banks.length > 0) {
        const defaultCard = banks.find((b) => b.isDefault) || banks[0];
        setSelectedBankId(defaultCard.id);
      }
      if (typeof settings?.minWithdrawal === 'number') {
        setMinWithdrawal(settings.minWithdrawal);
      }
      if (typeof settings?.maxWithdrawal === 'number') {
        setMaxWithdrawal(settings.maxWithdrawal);
      }
      if (typeof settings?.withdrawalFeePercent === 'number') {
        setWithdrawalFeePercent(settings.withdrawalFeePercent);
      }
      if (typeof settings?.isWithdrawalEnabled === 'boolean') {
        setIsWithdrawalEnabled(settings.isWithdrawalEnabled);
      }
      if (usdt) {
        setUsdtSettings(usdt);
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

  // Financial calculations using authoritative configured settings
  const feeAmount = amount > 0 ? (amount * withdrawalFeePercent) / 100 : 0;
  const receivedAmount = Math.max(0, amount - feeAmount);
  const currentUsdtRate = Number(usdtSettings.usdtRate) > 0 ? Number(usdtSettings.usdtRate) : 100;
  const estimatedUsdtAmount = receivedAmount > 0 ? +(receivedAmount / currentUsdtRate).toFixed(4) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isWithdrawalEnabled) {
      setError('Withdrawals are temporarily disabled by the administrator.');
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

    // 4-digit PIN verification
    const cleanPin = withdrawalPassword.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      setError('Withdrawal PIN must be exactly 4 digits.');
      return;
    }

    // Specific Method Validations
    if (withdrawalMethod === 'BANK') {
      if (!activeBank) {
        if (onOpenBindCard) {
          onOpenBindCard();
        } else {
          onNavigateTab('bank_card');
        }
        return;
      }
    } else if (withdrawalMethod === 'USDT') {
      const cleanAddr = usdtWalletAddress.trim();
      if (!cleanAddr) {
        setError('Please enter your USDT receiving wallet address.');
        return;
      }

      if (usdtNetwork === 'TRC20') {
        if (cleanAddr.startsWith('0x') || cleanAddr.startsWith('0X')) {
          setError(
            'Invalid TRC20 address: Begins with "0x" (BEP20/EVM format), but TRC20 was selected. TRC20 and BEP20 are not interchangeable.'
          );
          return;
        }
        if (!/^T[1-9A-HJ-NP-za-km-z]{33}$/.test(cleanAddr)) {
          setError('Invalid TRC20 wallet address. TRC20 addresses must start with "T" and contain exactly 34 base58 characters.');
          return;
        }
      } else if (usdtNetwork === 'BEP20') {
        if (cleanAddr.startsWith('T') || cleanAddr.startsWith('t')) {
          setError(
            'Invalid BEP20 address: Begins with "T" (TRON/TRC20 format), but BEP20 was selected. TRC20 and BEP20 are not interchangeable.'
          );
          return;
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddr)) {
          setError('Invalid BEP20 wallet address. BEP20 addresses must start with "0x" and be 42 characters long.');
          return;
        }
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      if (withdrawalMethod === 'BANK') {
        await submitWithdrawalRequest(
          userId,
          amount,
          activeBank?.id,
          cleanPin,
          'BANK'
        );
        onShowToast(`Bank withdrawal request of ₹${amount} submitted successfully!`);
      } else {
        await submitWithdrawalRequest(
          userId,
          amount,
          undefined,
          cleanPin,
          'USDT',
          usdtNetwork,
          usdtWalletAddress.trim()
        );
        onShowToast(`USDT withdrawal of ${estimatedUsdtAmount.toFixed(2)} USDT (₹${amount}) submitted successfully!`);
      }

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

          <h1 className="text-lg font-bold text-white tracking-wide">
            {withdrawalMethod === 'BANK' ? 'Bank Withdrawal' : 'USDT Crypto Withdrawal'}
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
      <div className="relative -mt-6 max-w-lg mx-auto bg-white rounded-t-[32px] shadow-sm px-5 pt-6 pb-10 min-h-[calc(100vh-140px)] flex flex-col justify-between">
        <div className="space-y-4">
          {/* Method Selection Tabs: Bank vs USDT */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100/90 rounded-2xl border border-gray-200/80 shadow-inner">
            <button
              type="button"
              onClick={() => {
                setWithdrawalMethod('BANK');
                setError(null);
              }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                withdrawalMethod === 'BANK'
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Building2 className={`w-4 h-4 ${withdrawalMethod === 'BANK' ? 'text-[#FF6000]' : 'text-gray-400'}`} />
              <span>Bank Card (INR)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setWithdrawalMethod('USDT');
                setError(null);
              }}
              className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                withdrawalMethod === 'USDT'
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Coins className={`w-4 h-4 ${withdrawalMethod === 'USDT' ? 'text-emerald-500' : 'text-gray-400'}`} />
              <span>USDT Crypto</span>
              <span className="text-[9.5px] bg-emerald-100 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded-full">New</span>
            </button>
          </div>

          {/* Main Withdraw Amount Display */}
          <div className="text-center space-y-1">
            <div className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
              ₹{amount.toLocaleString('en-IN')}
            </div>
            {withdrawalMethod === 'USDT' && amount > 0 && (
              <div className="text-xs sm:text-sm font-bold text-emerald-600">
                ≈ {estimatedUsdtAmount.toFixed(4)} USDT (@ ₹{currentUsdtRate}/USDT)
              </div>
            )}
            <p className="text-xs text-gray-500 font-medium">
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

          {/* METHOD 1: BANK CARD SECTION */}
          {withdrawalMethod === 'BANK' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Payout Bank Account
                </label>
                {bankAccounts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowBankPicker(!showBankPicker)}
                    className="text-xs text-[#FF6000] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>Switch Card</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {loading ? (
                <div className="p-4 rounded-2xl border border-gray-100 bg-[#FAFAFA] flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gray-200" />
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-gray-200 rounded" />
                      <div className="h-3 w-44 bg-gray-100 rounded" />
                    </div>
                  </div>
                  <div className="w-6 h-6 bg-gray-200 rounded-full" />
                </div>
              ) : (
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
              )}

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
          )}

          {/* METHOD 2: USDT CRYPTO SECTION */}
          {withdrawalMethod === 'USDT' && (
            <div className="space-y-3.5">
              {/* Network Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block px-1">
                  USDT Blockchain Network
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setUsdtNetwork('TRC20');
                      setError(null);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      usdtNetwork === 'TRC20'
                        ? 'border-[#FF6000] bg-orange-50/50 ring-1 ring-[#FF6000]/30 shadow-xs'
                        : 'border-gray-200 bg-[#FAFAFA] hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
                        TRC20
                      </span>
                      <span className="text-[10px] bg-cyan-100 text-cyan-800 font-bold px-1.5 py-0.5 rounded-md">
                        TRON
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">Starts with 'T' (34 chars)</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUsdtNetwork('BEP20');
                      setError(null);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      usdtNetwork === 'BEP20'
                        ? 'border-[#FF6000] bg-orange-50/50 ring-1 ring-[#FF6000]/30 shadow-xs'
                        : 'border-gray-200 bg-[#FAFAFA] hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        BEP20
                      </span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-md">
                        BNB Chain
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">Starts with '0x' (42 chars)</p>
                  </button>
                </div>
              </div>

              {/* Receiving Wallet Address Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                    USDT Receiving Wallet Address ({usdtNetwork})
                  </label>
                  <span className="text-[11px] text-gray-400 font-medium">
                    {usdtNetwork === 'TRC20' ? 'Format: T...' : 'Format: 0x...'}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={usdtWalletAddress}
                    onChange={(e) => {
                      setUsdtWalletAddress(e.target.value.trim());
                      setError(null);
                    }}
                    placeholder={
                      usdtNetwork === 'TRC20'
                        ? 'Paste your TRC20 wallet address (starts with T)'
                        : 'Paste your BEP20 wallet address (starts with 0x)'
                    }
                    className="w-full bg-[#FAFAFA] border border-gray-200 focus:border-[#FF6000] focus:bg-white rounded-2xl px-4 py-3.5 text-xs text-gray-900 font-mono focus:outline-none transition-colors placeholder:font-sans placeholder:text-gray-400"
                  />
                  {usdtWalletAddress && (
                    <button
                      type="button"
                      onClick={() => setUsdtWalletAddress('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 px-2 py-1 text-xs font-semibold rounded-lg bg-gray-100 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Real-time address mismatch warnings */}
                {usdtNetwork === 'TRC20' && (usdtWalletAddress.startsWith('0x') || usdtWalletAddress.startsWith('0X')) && (
                  <div className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1 px-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Address starts with '0x' (BEP20). Please select BEP20 or paste a TRC20 address.</span>
                  </div>
                )}
                {usdtNetwork === 'BEP20' && (usdtWalletAddress.startsWith('T') || usdtWalletAddress.startsWith('t')) && (
                  <div className="text-[11px] text-red-600 font-medium flex items-center gap-1 mt-1 px-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Address starts with 'T' (TRC20). Please select TRC20 or paste a BEP20 address.</span>
                  </div>
                )}
              </div>

              {/* Strict Network Warning */}
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2.5 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold block text-amber-900">Network Compatibility Notice:</span>
                  Your receiving wallet must strictly match the selected network (<strong>{usdtNetwork}</strong>). TRC20 and BEP20 addresses are on separate blockchains and are <strong>NOT interchangeable</strong>.
                </div>
              </div>
            </div>
          )}

          {/* Grid of Preset Withdrawal Amounts (3 columns) */}
          <div className="grid grid-cols-3 gap-3">
            {PRESET_WITHDRAW_AMOUNTS.map((amt) => {
              const isSelected = amount === amt;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handlePresetSelect(amt)}
                  className={`py-3.5 px-2 rounded-2xl font-extrabold text-base transition-all text-center flex items-center justify-center cursor-pointer ${
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
                placeholder="Enter custom amount"
                className={`w-full bg-[#FAFAFA] border ${
                  customAmount && amount > 0
                    ? 'border-[#FF6000] bg-[#FFF4EB]/20 ring-1 ring-[#FF6000]/20'
                    : 'border-gray-200 focus:border-[#FF6000] focus:bg-white'
                } rounded-2xl pl-9 pr-14 py-3 text-gray-900 font-bold text-base focus:outline-none transition-all placeholder:font-normal placeholder:text-gray-400`}
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
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Requested Amount</span>
              <span className="text-sm font-extrabold text-gray-900">
                ₹{amount > 0 ? amount.toLocaleString('en-IN') : 0}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Platform Fee ({withdrawalFeePercent}%)</span>
              <span className="font-semibold text-gray-700">₹{(Number(feeAmount) || 0).toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Net Settlement Amount</span>
              <span className="font-bold text-gray-900">₹{(Number(receivedAmount) || 0).toFixed(2)}</span>
            </div>

            {withdrawalMethod === 'USDT' && (
              <>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>USDT Conversion Rate</span>
                  <span className="font-bold text-gray-700">1 USDT = ₹{currentUsdtRate}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                  <span className="text-xs font-extrabold text-emerald-700">Net USDT to Receive</span>
                  <span className="text-base font-extrabold text-emerald-600">
                    {estimatedUsdtAmount.toFixed(4)} USDT
                  </span>
                </div>
              </>
            )}

            {withdrawalMethod === 'BANK' && (
              <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                <span className="text-xs font-extrabold text-gray-800">Payout Mode</span>
                <span className="text-xs font-bold text-[#FF6000]">Bank Account (IMPS/NEFT)</span>
              </div>
            )}
          </div>

          {/* Withdrawal PIN Input Card */}
          <div className="space-y-1.5">
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
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Button */}
          <div className="pt-1">
            {withdrawalMethod === 'BANK' && !activeBank ? (
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
                ) : withdrawalMethod === 'USDT' ? (
                  <span>
                    Confirm USDT Withdrawal ({estimatedUsdtAmount > 0 ? estimatedUsdtAmount.toFixed(2) : '0.00'} USDT)
                  </span>
                ) : (
                  <span>Confirm Bank Withdrawal (₹{amount > 0 ? amount.toLocaleString('en-IN') : 0})</span>
                )}
              </button>
            )}
          </div>

          {/* Notice Box */}
          <div className="p-4 bg-[#f8f9fa] rounded-2xl border border-gray-100 text-xs text-gray-500 leading-relaxed space-y-1">
            <p className="font-semibold text-gray-700">
              {withdrawalMethod === 'BANK' ? 'Bank Withdrawal Rules:' : 'USDT Crypto Withdrawal Rules:'}
            </p>
            {withdrawalMethod === 'BANK' ? (
              <>
                <p>1. Withdrawals are processed directly to your bound bank account (IMPS / NEFT transfer).</p>
                <p>2. Review and transfer takes 24–48 hours on standard business banking days.</p>
                <p>3. Ensure bank account details and IFSC are accurate to avoid payout delays.</p>
                <p>4. Standard processing fee of {withdrawalFeePercent}% applies on all withdrawals.</p>
                <p>
                  5. Single withdrawal limits: Minimum ₹{minWithdrawal.toLocaleString('en-IN')}, Maximum ₹{maxWithdrawal.toLocaleString('en-IN')}.
                </p>
              </>
            ) : (
              <>
                <p>1. USDT payouts are manually disbursed to your specified {usdtNetwork} wallet address.</p>
                <p>2. Double-check your receiving wallet address and network before submitting.</p>
                <p>3. Applied exchange rate: 1 USDT = ₹{currentUsdtRate}.</p>
                <p>4. Standard processing fee of {withdrawalFeePercent}% applies on all withdrawals.</p>
                <p>
                  5. Single withdrawal limits: Minimum ₹{minWithdrawal.toLocaleString('en-IN')}, Maximum ₹{maxWithdrawal.toLocaleString('en-IN')}.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
