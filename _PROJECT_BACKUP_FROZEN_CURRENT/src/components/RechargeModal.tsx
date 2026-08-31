import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  QrCode,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Copy,
  Check,
  Upload,
  CheckCircle2,
  RefreshCw,
  Info,
  CreditCard,
  Zap,
} from 'lucide-react';
import { fetchPaymentSettings, submitRechargeRequest, uploadPaymentProof } from '../services/api';
import { PaymentSettings } from '../types';

interface RechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: (msg: string) => void;
}

const PRESET_AMOUNTS = [500, 1000, 3000, 6000, 15000, 45000];

type PaymentChannelType = 'payu' | 'toppay' | 'upay';

interface ChannelInfo {
  id: PaymentChannelType;
  name: string;
  badge: string;
  color: string;
}

const CHANNELS: ChannelInfo[] = [
  { id: 'payu', name: 'PayU', badge: 'Fast UPI', color: 'from-amber-500 to-orange-600' },
  { id: 'toppay', name: 'TopPay', badge: 'Auto Scan', color: 'from-blue-500 to-indigo-600' },
  { id: 'upay', name: 'UPay', badge: 'Instant QR', color: 'from-emerald-500 to-teal-600' },
];

export const RechargeModal: React.FC<RechargeModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('1000');
  const [selectedChannel, setSelectedChannel] = useState<PaymentChannelType>('payu');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount(1000);
      setCustomAmount('1000');
      setSelectedChannel('payu');
      setUtrNumber('');
      setScreenshotFile(null);
      setScreenshotPreview(null);
      setError(null);
      setIsSubmitted(false);

      fetchPaymentSettings().then((settings) => {
        setPaymentSettings(settings);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Resolve active UPI ID & QR URL based on selected channel
  const getActiveChannelDetails = () => {
    if (!paymentSettings) {
      return {
        upiId: 'powerbank@upi',
        qrImageUrl: '',
        name: 'PayU',
      };
    }

    if (selectedChannel === 'payu') {
      const upi = paymentSettings.payuUpiId || paymentSettings.upiId || 'payu.powerbank@upi';
      const qr = paymentSettings.payuQrImageUrl || paymentSettings.qrImageUrl || '';
      return { upiId: upi, qrImageUrl: qr, name: 'PayU' };
    } else if (selectedChannel === 'toppay') {
      const upi = paymentSettings.toppayUpiId || paymentSettings.upiId || 'toppay.powerbank@upi';
      const qr = paymentSettings.toppayQrImageUrl || paymentSettings.qrImageUrl || '';
      return { upiId: upi, qrImageUrl: qr, name: 'TopPay' };
    } else {
      const upi = paymentSettings.upayUpiId || paymentSettings.upiId || 'upay.powerbank@upi';
      const qr = paymentSettings.upayQrImageUrl || paymentSettings.qrImageUrl || '';
      return { upiId: upi, qrImageUrl: qr, name: 'UPay' };
    }
  };

  const channelDetails = getActiveChannelDetails();

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

  const handleRemoveScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customAmount);
    if (isNaN(val) || val < 100) {
      setError('Minimum deposit amount is ₹100.');
      return;
    }

    const cleanUtr = utrNumber.trim();
    if (!cleanUtr) {
      setError('Please enter the 12-digit UTR / Reference number from your payment.');
      return;
    }

    if (cleanUtr.length < 6) {
      setError('Please enter a valid UTR number (at least 6-12 digits).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let uploadedProofUrl: string | undefined = undefined;
      if (screenshotFile) {
        uploadedProofUrl = await uploadPaymentProof(screenshotFile, userId);
      }

      await submitRechargeRequest(userId, val, cleanUtr, uploadedProofUrl);

      setIsSubmitted(true);
      onSuccess(`Deposit Request Submitted via ${channelDetails.name}! Your recharge of ₹${val} is under Admin verification.`);
      setTimeout(() => {
        onClose();
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit deposit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const qrUrl =
    channelDetails.qrImageUrl ||
    `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
      `upi://pay?pa=${channelDetails.upiId}&pn=PowerBank_${channelDetails.name}&am=${customAmount || 1000}&cu=INR`
    )}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden text-white z-10 max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a2a2a] bg-[#181818]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FF6000]/15 text-[#FF6000] flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Recharge Deposit</h3>
                <span className="text-[10px] text-gray-400 font-medium">
                  Select Channel & Pay via UPI / QR
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 overflow-y-auto no-scrollbar space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {isSubmitted ? (
              <div className="bg-[#121212] p-6 rounded-2xl border border-emerald-500/40 text-center space-y-3 my-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-white">Deposit Request Submitted!</h4>
                  <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">
                    Your recharge of <strong className="text-emerald-400">₹{customAmount}</strong> via{' '}
                    <strong className="text-white">{channelDetails.name}</strong> is under Admin verification.
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    UTR: <span className="font-mono text-gray-300 font-bold">{utrNumber.trim()}</span>
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#181818] text-[11px] text-gray-400 border border-[#2a2a2a]">
                  Recharge balance will be credited to your wallet once approved by Admin.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 1. Select Recharge Amount (₹) */}
                <div>
                  <label className="block text-xs font-bold text-gray-200 mb-2">
                    1. Select Recharge Amount (₹)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {PRESET_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setAmount(amt);
                          setCustomAmount(amt.toString());
                        }}
                        className={`py-2 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
                          amount === amt && customAmount === amt.toString()
                            ? 'bg-[#FF6000] text-white border-[#FF6000] shadow-sm shadow-orange-500/30'
                            : 'bg-[#121212] border-[#2a2a2a] text-gray-300 hover:border-gray-600'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>

                  {/* Custom input */}
                  <div className="relative mt-2">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => {
                        setCustomAmount(e.target.value);
                        setAmount(parseFloat(e.target.value) || 0);
                      }}
                      placeholder="Enter custom amount (Min ₹100)"
                      className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl pl-8 pr-4 py-2 text-white font-bold text-sm focus:outline-none focus:border-[#FF6000]"
                    />
                  </div>
                </div>

                {/* 2. Select Channel (Deposit with PayU / TopPay / UPay) */}
                <div>
                  <label className="block text-xs font-bold text-gray-200 mb-2">
                    2. Select Deposit Channel
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
                              ? 'bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] border-[#FF6000] text-white shadow-md shadow-orange-500/20 ring-1 ring-[#FF6000]'
                              : 'bg-[#141414] border-[#2a2a2a] text-gray-400 hover:border-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-white">{ch.name}</span>
                            {isSelected && <Check className="w-3 h-3 text-[#FF6000]" />}
                          </div>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                              isSelected
                                ? 'bg-[#FF6000]/20 text-[#FF8C00]'
                                : 'bg-gray-800 text-gray-400'
                            }`}
                          >
                            {ch.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Channel Payment Details (QR & UPI ID) */}
                <div className="bg-[#141414] p-4 rounded-xl border border-[#2a2a2a] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[#FF6000]" />
                      Pay via {channelDetails.name} QR & UPI
                    </span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                      <ShieldCheck className="w-3 h-3" /> Active Channel
                    </span>
                  </div>

                  {/* QR Code */}
                  <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-inner mx-auto max-w-[190px]">
                    <img
                      src={qrUrl}
                      alt={`${channelDetails.name} QR Code`}
                      className="w-36 h-36 object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[10px] text-gray-800 font-bold mt-1">
                      Scan with GooglePay, PhonePe, Paytm
                    </span>
                  </div>

                  {/* Copyable UPI ID */}
                  <div className="flex items-center justify-between p-2.5 bg-[#1e1e1e] rounded-xl border border-[#2a2a2a]">
                    <div className="overflow-hidden">
                      <span className="text-[10px] text-gray-400 block font-medium">
                        {channelDetails.name} UPI ID
                      </span>
                      <span className="text-xs font-mono font-bold text-white truncate block">
                        {channelDetails.upiId}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="px-3 py-1.5 rounded-lg bg-[#FF6000] hover:bg-[#FF8C00] text-white text-xs font-bold flex items-center gap-1 shrink-0 transition-colors shadow-sm cursor-pointer"
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

                {/* 4. Enter 12-Digit UTR Number */}
                <div>
                  <label className="block text-xs font-bold text-gray-200 mb-1.5">
                    3. Enter 12-Digit UTR / Reference No <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    placeholder="e.g. 423985729104"
                    className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[#FF6000]"
                  />
                  <span className="text-[10.5px] text-gray-500 mt-1 block">
                    Found in your UPI payment receipt after completing the transaction.
                  </span>
                </div>

                {/* 5. Upload Payment Screenshot */}
                <div>
                  <label className="block text-xs font-bold text-gray-200 mb-1.5">
                    4. Upload Payment Screenshot (Optional)
                  </label>
                  
                  {screenshotPreview ? (
                    <div className="relative p-2 bg-[#141414] rounded-xl border border-[#2a2a2a] flex items-center justify-between">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <img
                          src={screenshotPreview}
                          alt="Payment Screenshot"
                          className="w-12 h-12 object-cover rounded-lg border border-[#333]"
                        />
                        <div className="overflow-hidden">
                          <span className="text-xs font-semibold text-white truncate block">
                            {screenshotFile?.name || 'Screenshot'}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-medium">Ready to upload</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveScreenshot}
                        className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="border border-dashed border-[#333] hover:border-[#FF6000] rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#121212]">
                      <Upload className="w-4 h-4 text-gray-400 mb-1" />
                      <span className="text-xs text-gray-300 font-semibold">Upload Payment Proof</span>
                      <span className="text-[10px] text-gray-500">JPG, PNG, WEBP (Max 5MB)</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading || !utrNumber.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF6000] to-[#FF8C00] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-98 transition-transform disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Submitting Deposit...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Deposit Request (₹{customAmount || '0'})</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
