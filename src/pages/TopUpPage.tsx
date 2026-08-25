import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  FileText,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Zap,
  QrCode,
  ShieldCheck,
  Copy,
  Check,
  Upload,
  X,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Wallet, PaymentSettings } from '../types';
import {
  fetchPaymentSettings,
  submitRechargeRequest,
  uploadPaymentProof,
  createUniVePayDeposit,
  checkUniVePayDepositStatus,
} from '../services/api';

interface TopUpPageProps {
  userId: string;
  wallet: Wallet | null;
  onBack: () => void;
  onNavigateTab: (tab: any) => void;
  onShowToast: (msg: string) => void;
  onRefreshData?: () => void;
}

interface PresetAmount {
  value: number;
  recommended?: boolean;
}

const PRESET_AMOUNTS: PresetAmount[] = [
  { value: 500 },
  { value: 1500, recommended: true },
  { value: 2000 },
  { value: 3000 },
  { value: 3500, recommended: true },
  { value: 5000, recommended: true },
  { value: 7000 },
  { value: 10000 },
  { value: 20000 },
  { value: 30000 },
];

type ChannelType = 'payu' | 'toppay' | 'upay';

interface ChannelConfig {
  id: ChannelType;
  name: string;
  badge: string;
}

const CHANNELS: ChannelConfig[] = [
  { id: 'payu', name: 'PayU', badge: 'Fast UPI' },
  { id: 'toppay', name: 'TopPay', badge: 'Auto Scan' },
  { id: 'upay', name: 'UPay', badge: 'Instant QR' },
];

export const TopUpPage: React.FC<TopUpPageProps> = ({
  userId,
  wallet,
  onBack,
  onNavigateTab,
  onShowToast,
  onRefreshData,
}) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(500);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  // Multi-channel deposit modal states
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>('payu');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [isRedirecting, setIsRedirecting] = useState(false);
  const [activeTraceno, setActiveTraceno] = useState<string | null>(null);

  const availableBalance = wallet?.rechargeBalance ?? wallet?.availableBalance ?? 7.78;
  const activeAmount = customAmount ? parseFloat(customAmount) || selectedAmount : selectedAmount;

  useEffect(() => {
    fetchPaymentSettings().then((settings) => {
      setPaymentSettings(settings);
    });
  }, []);

  // Poll for deposit completion when an active order is initiated
  useEffect(() => {
    if (!activeTraceno) return;
    const interval = setInterval(async () => {
      try {
        const result = await checkUniVePayDepositStatus(activeTraceno);
        if (result.status === 'SUCCESS') {
          onShowToast(`Recharge of ₹${result.amount || activeAmount} successful!`);
          if (onRefreshData) onRefreshData();
          setActiveTraceno(null);
          clearInterval(interval);
        }
      } catch (e) {}
    }, 4000);

    return () => clearInterval(interval);
  }, [activeTraceno, onRefreshData, onShowToast, activeAmount]);

  // Resolve channel details
  const getChannelDetails = () => {
    if (!paymentSettings) {
      return { upiId: 'powerbank.pay@upi', qrImageUrl: '', name: 'PayU' };
    }
    if (selectedChannel === 'payu') {
      return {
        upiId: paymentSettings.payuUpiId || paymentSettings.upiId || 'payu.powerbank@upi',
        qrImageUrl: paymentSettings.payuQrImageUrl || paymentSettings.qrImageUrl || '',
        name: 'PayU',
      };
    } else if (selectedChannel === 'toppay') {
      return {
        upiId: paymentSettings.toppayUpiId || paymentSettings.upiId || 'toppay.powerbank@upi',
        qrImageUrl: paymentSettings.toppayQrImageUrl || paymentSettings.qrImageUrl || '',
        name: 'TopPay',
      };
    } else {
      return {
        upiId: paymentSettings.upayUpiId || paymentSettings.upiId || 'upay.powerbank@upi',
        qrImageUrl: paymentSettings.upayQrImageUrl || paymentSettings.qrImageUrl || '',
        name: 'UPay',
      };
    }
  };

  const channelDetails = getChannelDetails();

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(channelDetails.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Screenshot file size must be less than 5MB.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid image (JPG, PNG, or WEBP).');
      return;
    }

    setError(null);
    setScreenshotFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleProceedTopUp = async () => {
    if (activeAmount < 100) {
      onShowToast('Minimum top up amount is ₹100.');
      return;
    }
    setError(null);
    setIsSubmitted(false);
    setUtrNumber('');
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setIsRedirecting(true);

    try {
      const order = await createUniVePayDeposit({
        userId,
        amount: activeAmount,
        payCode: '印度UPI-银台',
      });

      if (order.success && order.payUrl && typeof order.payUrl === 'string' && (order.payUrl.startsWith('https://') || order.payUrl.startsWith('http://'))) {
        setActiveTraceno(order.traceno);
        onShowToast(`Opening Univepay payment gateway for ₹${activeAmount}...`);

        // Redirect user to the official gateway checkout URL
        try {
          window.location.href = order.payUrl;
        } catch (navErr) {
          window.open(order.payUrl, '_self');
        }
        return;
      }

      // If status is not 00 or payUrl is missing/invalid, show error without opening manual modal
      onShowToast('Payment gateway temporarily unavailable. Please try again.');
    } catch (err: any) {
      console.error('Univepay payment initiation error:', err.message);
      onShowToast('Payment gateway temporarily unavailable. Please try again.');
    } finally {
      setIsRedirecting(false);
    }
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrNumber.trim()) {
      setError('Please enter the 12-digit UTR number from your payment receipt.');
      return;
    }
    if (utrNumber.trim().length < 6) {
      setError('Please enter a valid 12-digit UTR reference number.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let uploadedProofUrl: string | undefined = undefined;
      if (screenshotFile) {
        uploadedProofUrl = await uploadPaymentProof(screenshotFile, userId);
      }

      await submitRechargeRequest(userId, activeAmount, utrNumber.trim(), uploadedProofUrl);

      setIsSubmitted(true);
      onShowToast(`Deposit request of ₹${activeAmount} submitted via ${channelDetails.name}!`);
      if (onRefreshData) onRefreshData();
      setTimeout(() => {
        setIsDepositModalOpen(false);
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit deposit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const qrUrl =
    channelDetails.qrImageUrl ||
    `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
      `upi://pay?pa=${channelDetails.upiId}&pn=PowerBank_${channelDetails.name}&am=${activeAmount}&cu=INR`
    )}`;

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-gray-900 pb-28">
      {/* Orange Curved Header matching App theme */}
      <div className="relative bg-gradient-to-b from-[#FF6000] to-[#FF7A00] text-white pt-5 pb-14 px-4 overflow-hidden">
        {/* Subtle geometric background curved waves */}
        <div className="absolute inset-0 opacity-15 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 400 200" fill="none" preserveAspectRatio="none">
            <circle cx="200" cy="-50" r="180" stroke="white" strokeWidth="1.5" />
            <circle cx="200" cy="-50" r="230" stroke="white" strokeWidth="1.5" />
            <circle cx="200" cy="-50" r="280" stroke="white" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Top bar with circular action buttons */}
        <div className="relative z-10 flex items-center justify-between max-w-lg mx-auto">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 -ml-0.5" />
          </button>

          <h1 className="text-lg font-bold text-white tracking-wide">Top Up</h1>

          <button
            onClick={() => onNavigateTab('transactions')}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-gray-800 shadow-sm hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Container with deep rounded top corners overlapping orange header */}
      <div className="relative -mt-6 max-w-lg mx-auto bg-white rounded-t-[32px] shadow-sm px-5 pt-7 pb-10 min-h-[calc(100vh-140px)] flex flex-col justify-between">
        <div className="space-y-6">
          {/* Main Top Up Amount Display */}
          <div className="text-center space-y-1.5">
            <div className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
              ₹{activeAmount.toLocaleString('en-IN')}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 font-medium">
              Available balance: ₹{availableBalance.toFixed(2)}
            </p>
          </div>

          {/* Grid of Preset Amounts (3 columns) */}
          <div className="grid grid-cols-3 gap-3">
            {PRESET_AMOUNTS.map((item) => {
              const isSelected = selectedAmount === item.value && !customAmount;
              return (
                <div key={item.value} className="relative flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAmount(item.value);
                      setCustomAmount('');
                    }}
                    className={`w-full py-4 px-2 rounded-2xl font-extrabold text-base sm:text-lg transition-all text-center flex flex-col items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-[#FFF4EB] border-2 border-[#FF6000] text-[#FF6000] shadow-sm'
                        : 'bg-[#f8f9fa] border border-transparent text-gray-800 hover:bg-gray-100'
                    }`}
                  >
                    <span>₹{item.value}</span>
                  </button>

                  {/* "Recommended" Badge attached below preset button */}
                  {item.recommended && (
                    <span className="bg-[#FF6000] text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm -mt-2 z-10 whitespace-nowrap">
                      Recommended
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Optional Custom Input */}
          <div className="pt-1">
            <div className="relative bg-[#f8f9fa] rounded-2xl border border-gray-200 focus-within:border-[#FF6000] transition-colors">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
                ₹
              </span>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                }}
                placeholder="Or enter other amount (Min ₹100)"
                className="w-full bg-transparent pl-8 pr-4 py-3 text-gray-900 font-bold text-sm outline-none placeholder:text-gray-400 placeholder:font-normal"
              />
            </div>
          </div>
        </div>

        {/* Fixed / Sticky Bottom Action Button */}
        <div className="pt-8">
          <button
            type="button"
            disabled={isRedirecting}
            onClick={handleProceedTopUp}
            className="w-full py-4 rounded-2xl bg-[#FF6000] hover:bg-[#E05300] active:scale-[0.99] disabled:opacity-75 text-white font-bold text-base shadow-lg shadow-orange-700/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {isRedirecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Connecting to Gateway...</span>
              </>
            ) : (
              <span>Top Up</span>
            )}
          </button>
        </div>
      </div>

      {/* Multi-Channel Deposit & UTR Verification Modal */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden text-gray-900 max-h-[92vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-[#f8f9fa]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#FF6000]/15 text-[#FF6000] flex items-center justify-center font-black">
                  ₹
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">Complete Top Up</h3>
                  <span className="text-[11px] text-gray-500 font-medium">
                    Deposit ₹{activeAmount.toLocaleString('en-IN')} via UPI
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsDepositModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto no-scrollbar space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {isSubmitted ? (
                <div className="bg-orange-50 p-6 rounded-2xl border border-orange-200 text-center space-y-3 my-3">
                  <div className="w-14 h-14 rounded-full bg-[#FF6000] text-white mx-auto flex items-center justify-center shadow-md">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-900">Top Up Request Submitted!</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Your deposit of <strong className="text-[#FF6000]">₹{activeAmount}</strong> via{' '}
                      <strong>{channelDetails.name}</strong> is under review.
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1 font-mono">UTR: {utrNumber.trim()}</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitDeposit} className="space-y-4">
                  {/* Select Channel (PayU, TopPay, UPay) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">
                      1. Select Payment Channel
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {CHANNELS.map((ch) => {
                        const isSelected = selectedChannel === ch.id;
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => setSelectedChannel(ch.id)}
                            className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#FFF4EB] border-2 border-[#FF6000] text-[#FF6000] shadow-sm'
                                : 'bg-[#f8f9fa] border-gray-200 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <span className="text-xs font-bold">{ch.name}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                isSelected ? 'bg-[#FF6000] text-white' : 'bg-gray-200 text-gray-600'
                              }`}
                            >
                              {ch.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* QR & UPI Section */}
                  <div className="bg-[#f8f9fa] p-4 rounded-2xl border border-gray-200 space-y-3 text-center">
                    <div className="flex items-center justify-between text-xs text-gray-600 font-semibold">
                      <span className="flex items-center gap-1 text-[#FF6000]">
                        <Zap className="w-3.5 h-3.5" /> Pay via {channelDetails.name} QR
                      </span>
                      <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold">
                        Verified Channel
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-2xl border border-gray-200 inline-block shadow-inner">
                      <img
                        src={qrUrl}
                        alt={`${channelDetails.name} QR Code`}
                        className="w-36 h-36 object-contain mx-auto"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[10px] text-gray-500 font-bold block mt-1">
                        Scan with GooglePay / PhonePe / Paytm / UPI
                      </span>
                    </div>

                    {/* Copy UPI ID */}
                    <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-gray-200 text-left">
                      <div className="overflow-hidden pr-2">
                        <span className="text-[10px] text-gray-400 block font-medium">
                          {channelDetails.name} UPI ID
                        </span>
                        <span className="text-xs font-mono font-bold text-gray-900 truncate block">
                          {channelDetails.upiId}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="px-3 py-1.5 rounded-lg bg-[#FF6000] hover:bg-[#E05300] text-white text-xs font-bold flex items-center gap-1 shrink-0 transition-colors shadow-sm cursor-pointer"
                      >
                        {copiedUpi ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 12-Digit UTR Number */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      2. Enter 12-Digit UTR / Reference No <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      placeholder="e.g. 423985729104"
                      className="w-full bg-[#f8f9fa] border border-gray-200 rounded-xl px-3.5 py-3 text-gray-900 font-mono text-sm focus:outline-none focus:border-[#FF6000] transition-colors"
                    />
                  </div>

                  {/* Upload Screenshot */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      3. Upload Payment Receipt (Optional)
                    </label>
                    {screenshotPreview ? (
                      <div className="p-2 bg-[#f8f9fa] rounded-xl border border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <img
                            src={screenshotPreview}
                            alt="Receipt"
                            className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                          />
                          <span className="text-xs font-semibold text-gray-800 truncate">
                            {screenshotFile?.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setScreenshotFile(null);
                            setScreenshotPreview(null);
                          }}
                          className="p-1.5 rounded-lg bg-red-100 text-red-600 text-xs"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="border border-dashed border-gray-300 hover:border-[#FF6000] rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#f8f9fa]">
                        <Upload className="w-4 h-4 text-gray-400 mb-1" />
                        <span className="text-xs text-gray-600 font-semibold">Upload Screenshot</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading || !utrNumber.trim()}
                    className="w-full py-3.5 rounded-xl bg-[#FF6000] hover:bg-[#E05300] text-white font-bold text-sm shadow-md transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Submitting Deposit...</span>
                      </>
                    ) : (
                      <span>Submit Top Up Request (₹{activeAmount})</span>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
