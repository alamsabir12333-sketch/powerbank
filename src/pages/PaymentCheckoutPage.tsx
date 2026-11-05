import React, { useState, useEffect, useMemo } from 'react';
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
  Clock,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { fetchPaymentSettings, submitRechargeRequest, uploadPaymentProof } from '../services/api';
import { PaymentSettings } from '../types';

interface PaymentCheckoutPageProps {
  initialAmount?: number;
  userId?: string;
  userProfile?: any;
  onBack?: () => void;
  onSuccess?: (orderId: string) => void;
  onNavigateHome?: () => void;
  onShowToast?: (msg: string) => void;
}

export const PaymentCheckoutPage: React.FC<PaymentCheckoutPageProps> = ({
  initialAmount,
  userId: propUserId,
  userProfile,
  onBack,
  onSuccess,
  onNavigateHome,
  onShowToast,
}) => {
  const searchParams = useMemo(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  }, []);

  const rawAmount = initialAmount
    ? String(initialAmount)
    : searchParams.get('amount') || searchParams.get('amt') || '500';
  const displayAmount = Math.max(100, parseFloat(rawAmount) || 500);

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>(propUserId || '');
  const [utrNumber, setUtrNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedOrderId, setSubmittedOrderId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Authenticate user & load payment settings
  useEffect(() => {
    async function init() {
      if (supabase && !propUserId) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            setCurrentUserId(user.id);
          }
        } catch {}
      }
      try {
        const settings = await fetchPaymentSettings();
        if (settings) {
          setPaymentSettings(settings);
        }
      } catch (err) {
        console.warn('[PaymentCheckoutPage] Failed to fetch payment settings:', err);
      }
    }
    init();
  }, [propUserId]);

  const activeUpiId = paymentSettings?.upiId || 'powerbank.pay@upi';
  const qrUrl =
    paymentSettings?.qrImageUrl ||
    `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
      `upi://pay?pa=${activeUpiId}&pn=GAINPOWER&am=${displayAmount}&cu=INR`
    )}`;

  const instructionsText =
    paymentSettings?.instructions ||
    '1. Open your UPI App (PhonePe, Google Pay, Paytm, etc.).\n2. Scan the QR code or transfer to the UPI ID.\n3. Copy the 12-digit UTR/Reference number from your payment confirmation.\n4. Enter the UTR number below and submit.';

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(activeUpiId);
    setCopiedUpi(true);
    if (onShowToast) onShowToast('UPI ID copied to clipboard');
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
      setError('Please enter the 12-digit UTR / Transaction Reference number from your payment receipt.');
      return;
    }

    if (cleanUtr.length < 8 || cleanUtr.length > 30) {
      setError('Please enter a valid UPI UTR number (typically 12 digits).');
      return;
    }

    const effectiveUid = currentUserId || propUserId;
    if (!effectiveUid) {
      setError('Please sign in first to submit a deposit request.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let uploadedProofUrl: string | undefined = undefined;
      if (screenshotFile) {
        uploadedProofUrl = await uploadPaymentProof(screenshotFile, effectiveUid);
      }

      const res = await submitRechargeRequest(
        effectiveUid,
        displayAmount,
        cleanUtr,
        uploadedProofUrl,
        notes.trim() || undefined
      );

      const generatedOrderId = res.orderId || `ORD_${Date.now()}`;
      setSubmittedOrderId(generatedOrderId);
      setIsSubmitted(true);
      if (onShowToast) {
        onShowToast('Deposit request submitted! Recharge Wallet will be credited once verified.');
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to submit payment proof. Please try again.';
      setError(msg);
      if (onShowToast) onShowToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    if (onSuccess) {
      onSuccess(submittedOrderId);
    } else if (onBack) {
      onBack();
    } else if (onNavigateHome) {
      onNavigateHome();
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md bg-[#161b22] border border-gray-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FF6000]/15 text-[#FF6000] flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm sm:text-base text-white">Auto UPI Deposit</h1>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Official GAINPOWER Gateway
              </span>
            </div>
          </div>
          {(onBack || onNavigateHome) && (
            <button
              onClick={onBack || onNavigateHome}
              className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors cursor-pointer"
              title="Go Back"
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
          <div className="bg-[#090d16] p-6 rounded-2xl border border-emerald-500/40 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Deposit Request Submitted!</h2>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>Status: PENDING ADMIN APPROVAL</span>
              </div>
            </div>

            <div className="bg-[#161b22] p-3.5 rounded-xl border border-gray-800 text-left space-y-2 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Amount:</span>
                <span className="text-emerald-400 font-bold font-mono">₹{displayAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>UTR / Ref:</span>
                <span className="text-white font-mono font-bold">{utrNumber.trim()}</span>
              </div>
              {submittedOrderId && (
                <div className="flex justify-between text-gray-400">
                  <span>Order ID:</span>
                  <span className="text-gray-300 font-mono text-[11px]">{submittedOrderId}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Your payment has been logged in your deposit history. The Admin will verify the UTR against actual bank records and credit your <strong className="text-emerald-400">Recharge Wallet</strong> immediately.
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleDone}
                className="w-full py-2.5 rounded-xl bg-[#FF6000] hover:bg-[#FF8C00] text-white font-bold text-xs cursor-pointer shadow-lg shadow-orange-500/20"
              >
                View in Deposit History
              </button>
              {onNavigateHome && (
                <button
                  type="button"
                  onClick={onNavigateHome}
                  className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs cursor-pointer"
                >
                  Return to Dashboard
                </button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount card */}
            <div className="bg-[#090d16] p-4 rounded-2xl border border-gray-800 text-center relative overflow-hidden">
              <span className="text-xs text-gray-400 font-medium block">Total Payable Amount</span>
              <span className="text-2xl font-black text-emerald-400 tracking-tight">
                ₹{displayAmount.toFixed(2)}
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">
                Recharge Wallet Credited Upon Approval
              </span>
            </div>

            {/* QR & UPI ID Box */}
            <div className="bg-[#090d16] p-4 rounded-2xl border border-gray-800 flex flex-col items-center space-y-3">
              <div className="bg-white p-3 rounded-2xl shadow-inner relative group">
                <img
                  src={qrUrl}
                  alt="Official UPI QR Code"
                  className="w-40 h-40 object-contain mx-auto"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-[11px] text-gray-400 font-medium">
                Scan with PhonePe, Google Pay, Paytm, or BHIM
              </span>

              {/* UPI ID copy */}
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
                  className="px-3 py-1.5 rounded-lg bg-[#FF6000] hover:bg-[#FF8C00] text-white text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                >
                  {copiedUpi ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Payment Instructions */}
            <div className="bg-[#090d16] p-3 rounded-xl border border-gray-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-300">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span>Payment Instructions</span>
              </div>
              <p className="text-[11px] text-gray-400 whitespace-pre-line leading-relaxed pl-5">
                {instructionsText}
              </p>
            </div>

            {/* UTR Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                12-Digit UTR / Transaction Reference Number <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                placeholder="e.g. 423985729104"
                className="w-full bg-[#090d16] border border-gray-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm focus:border-[#FF6000] outline-none"
              />
              <span className="text-[10px] text-gray-500 mt-1 block">
                Found in your UPI app receipt under "UPI Ref ID" or "UTR".
              </span>
            </div>

            {/* Screenshot Upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Payment Screenshot (Optional, helps faster verification)
              </label>
              {screenshotPreview ? (
                <div className="p-2 bg-[#090d16] rounded-xl border border-gray-700 flex items-center justify-between">
                  <img
                    src={screenshotPreview}
                    alt="Proof preview"
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
                    className="text-xs text-red-400 hover:underline px-2 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="border border-dashed border-gray-700 hover:border-[#FF6000] rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer bg-[#090d16] transition-colors">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-300">Upload Screenshot Proof</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Optional Notes */}
            <div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarks or sender name (optional)"
                className="w-full bg-[#090d16] border border-gray-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-[#FF6000]"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !utrNumber.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF6000] to-amber-500 text-white font-bold text-sm shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all hover:brightness-110"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Deposit Request...</span>
                </>
              ) : (
                <span>Submit Deposit Request (₹{displayAmount})</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
