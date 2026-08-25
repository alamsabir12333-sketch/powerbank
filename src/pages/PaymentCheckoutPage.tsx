import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Upload,
  Info,
} from 'lucide-react';
import { fetchPaymentSettings, submitRechargeRequest, uploadPaymentProof } from '../services/api';
import { PaymentSettings } from '../types';

interface PaymentCheckoutPageProps {
  onNavigateHome?: () => void;
}

export const PaymentCheckoutPage: React.FC<PaymentCheckoutPageProps> = ({ onNavigateHome }) => {
  const searchParams = useMemo(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  }, []);

  const rawAmount = searchParams.get('amount') || searchParams.get('amt') || '500';
  const displayAmount = Math.max(100, parseFloat(rawAmount) || 500);

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentSettings().then((settings) => {
      setPaymentSettings(settings);
    });
  }, []);

  const activeUpiId = paymentSettings?.upiId || 'powerbank@upi';
  const qrUrl =
    paymentSettings?.qrImageUrl ||
    `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
      `upi://pay?pa=${activeUpiId}&pn=PowerBank&am=${displayAmount}&cu=INR`
    )}`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(activeUpiId);
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

    setError(null);
    setScreenshotFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUtr = utrNumber.trim();
    if (!cleanUtr) {
      setError('Please enter the 12-digit UTR number from your payment receipt.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let uploadedProofUrl: string | undefined = undefined;
      if (screenshotFile) {
        uploadedProofUrl = await uploadPaymentProof(screenshotFile, 'checkout_user');
      }

      await submitRechargeRequest('checkout_user', displayAmount, cleanUtr, uploadedProofUrl);
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit payment proof.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#161b22] border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FF6000]/15 text-[#FF6000] flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-base text-white">Manual UPI Checkout</h1>
              <span className="text-[11px] text-gray-400 font-medium">
                Official PowerBank Deposit
              </span>
            </div>
          </div>
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isSubmitted ? (
          <div className="bg-[#090d16] p-6 rounded-2xl border border-emerald-500/40 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="font-bold text-lg text-white">Deposit Submitted!</h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              Your deposit request for <strong className="text-emerald-400">₹{displayAmount}</strong> with UTR{' '}
              <span className="font-mono font-bold text-white">{utrNumber.trim()}</span> has been submitted to Admin.
            </p>
            <p className="text-[11px] text-gray-500">
              Your wallet recharge balance will be credited once verified.
            </p>
            {onNavigateHome && (
              <button
                onClick={onNavigateHome}
                className="w-full py-2.5 rounded-xl bg-[#FF6000] hover:bg-[#FF8C00] text-white font-bold text-xs mt-3 cursor-pointer"
              >
                Return to Dashboard
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount card */}
            <div className="bg-[#090d16] p-4 rounded-2xl border border-gray-800 text-center">
              <span className="text-xs text-gray-400 font-medium block">Total Payable Amount</span>
              <span className="text-2xl font-extrabold text-emerald-400">₹{displayAmount.toFixed(2)}</span>
            </div>

            {/* QR & UPI */}
            <div className="bg-[#090d16] p-4 rounded-2xl border border-gray-800 flex flex-col items-center space-y-3">
              <div className="bg-white p-3 rounded-2xl shadow-inner">
                <img
                  src={qrUrl}
                  alt="UPI QR Code"
                  className="w-36 h-36 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="w-full flex items-center justify-between p-2.5 bg-[#161b22] rounded-xl border border-gray-700">
                <div className="overflow-hidden">
                  <span className="text-[10px] text-gray-400 block font-medium">Receiver UPI ID</span>
                  <span className="text-xs font-mono font-bold text-white truncate block">
                    {activeUpiId}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="px-3 py-1.5 rounded-lg bg-[#FF6000] text-white text-xs font-bold flex items-center gap-1 shrink-0"
                >
                  {copiedUpi ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* UTR Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Enter 12-Digit UTR / Transaction Reference <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                placeholder="e.g. 423985729104"
                className="w-full bg-[#090d16] border border-gray-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:border-[#FF6000] outline-none"
              />
            </div>

            {/* Screenshot Upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Payment Screenshot
              </label>
              {screenshotPreview ? (
                <div className="p-2 bg-[#090d16] rounded-xl border border-gray-700 flex items-center justify-between">
                  <img
                    src={screenshotPreview}
                    alt="Proof"
                    className="w-10 h-10 object-cover rounded-lg border border-gray-700"
                  />
                  <span className="text-xs text-gray-300 font-medium truncate max-w-[200px]">
                    {screenshotFile?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setScreenshotFile(null);
                      setScreenshotPreview(null);
                    }}
                    className="text-xs text-red-400 hover:underline px-2"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="border border-dashed border-gray-700 hover:border-[#FF6000] rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer bg-[#090d16]">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-300">Upload Screenshot</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !utrNumber.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF6000] to-amber-500 text-white font-bold text-sm shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Deposit Request</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
