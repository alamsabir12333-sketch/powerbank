import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, QrCode, AlertCircle, ArrowRight, ShieldCheck, ExternalLink, RefreshCw, CheckCircle2, Lock } from 'lucide-react';
import { createUniVePayDeposit, checkUniVePayDepositStatus } from '../services/api';

interface RechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: (msg: string) => void;
}

const PRESET_AMOUNTS = [500, 1000, 3000, 6000, 15000, 45000];

export const RechargeModal: React.FC<RechargeModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('1000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active Gateway Transaction State
  const [activeTraceno, setActiveTraceno] = useState<string | null>(null);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount(1000);
      setCustomAmount('1000');
      setError(null);
      setActiveTraceno(null);
      setPayUrl(null);
      setIsVerifying(false);
      setIsSuccess(false);
    }
  }, [isOpen]);

  // Polling for automated payment completion when an order is open
  useEffect(() => {
    if (!activeTraceno || isSuccess) return;

    const interval = setInterval(async () => {
      try {
        const queryRes = await checkUniVePayDepositStatus(activeTraceno, amount);
        if (queryRes?.data?.data?.status === 'SUCCESS' || queryRes?.data?.status === 'SUCCESS') {
          setIsSuccess(true);
          setIsVerifying(false);
          onSuccess(`Recharge of ₹${amount} completed successfully! Your Recharge Balance is updated.`);
          setTimeout(() => {
            onClose();
          }, 2000);
        }
      } catch (err) {
        console.warn('Reconciliation poll check error:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeTraceno, isSuccess, amount, onSuccess, onClose]);

  if (!isOpen) return null;

  const handleInitiateGatewayDeposit = async () => {
    const val = parseFloat(customAmount);
    if (isNaN(val) || val < 100) {
      setError('Minimum deposit amount is ₹100');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createUniVePayDeposit({
        userId,
        amount: val,
        name: 'User',
      });

      if (res.success && res.traceno) {
        setActiveTraceno(res.traceno);
        setPayUrl(res.payUrl || null);

        if (res.payUrl) {
          // Open gateway checkout
          window.open(res.payUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        throw new Error(res.error || 'Failed to create payment order');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to UniVePay payment gateway');
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheckStatus = async () => {
    if (!activeTraceno) return;
    setIsVerifying(true);
    setError(null);

    try {
      const res = await checkUniVePayDepositStatus(activeTraceno, amount);
      if (res?.data?.data?.status === 'SUCCESS' || res?.data?.status === 'SUCCESS') {
        setIsSuccess(true);
        onSuccess(`Recharge of ₹${amount} confirmed! Your Recharge Balance is updated.`);
        setTimeout(() => onClose(), 1500);
      } else {
        setError('Payment verification pending. If you completed UPI transfer, please allow 30-60 seconds for gateway callback.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification check failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
          className="relative w-full max-w-sm bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden text-white z-10 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] bg-[#181818]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FF6000]/15 text-[#FF6000] flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">UniVePay UPI Deposit</h3>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3 h-3" /> Automatic Instant Gateway
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

          <div className="p-5 overflow-y-auto no-scrollbar space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!activeTraceno ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Select Recharge Amount (₹)
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
                        className={`py-2.5 rounded-xl font-bold text-sm border transition-all ${
                          amount === amt && customAmount === amt.toString()
                            ? 'bg-[#FF6000] text-white border-[#FF6000] shadow-sm shadow-orange-500/30'
                            : 'bg-[#121212] border-[#2a2a2a] text-gray-300 hover:border-gray-600'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Custom Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                      ₹
                    </span>
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => {
                        setCustomAmount(e.target.value);
                        setAmount(parseFloat(e.target.value) || 0);
                      }}
                      placeholder="Min ₹100"
                      className="w-full bg-[#121212] border border-[#2a2a2a] rounded-xl pl-8 pr-4 py-2.5 text-white font-bold text-base focus:outline-none focus:border-[#FF6000]"
                    />
                  </div>
                </div>

                <div className="bg-[#141414] p-3.5 rounded-xl border border-[#2a2a2a] space-y-2 text-xs text-gray-400">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Direct UPI Auto-Recharge</span>
                  </div>
                  <p className="leading-relaxed">
                    1. Deposit connects directly with official UPI gateways (GPay, PhonePe, Paytm, BHIM).
                  </p>
                  <p className="leading-relaxed">
                    2. <strong className="text-gray-300">Recharge Balance</strong> can only be used for renting power banks and hardware devices.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleInitiateGatewayDeposit}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF6000] to-[#FF8C00] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-98 transition-transform disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Initiating Payment...</span>
                    </>
                  ) : (
                    <>
                      <span>Pay ₹{customAmount || '0'} via UPI Gateway</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="space-y-4">
                {isSuccess ? (
                  <div className="bg-[#121212] p-5 rounded-2xl border border-emerald-500/40 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-white">Payment Received!</h4>
                      <p className="text-xs text-gray-400 mt-1">₹{amount} credited to your Recharge Balance.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-[#121212] p-4 rounded-xl border border-[#2a2a2a] text-center space-y-3">
                      <div className="w-10 h-10 rounded-full bg-[#FF6000]/15 text-[#FF6000] mx-auto flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white">Awaiting Payment Confirmation</h4>
                        <p className="text-xs text-gray-400 mt-1">
                          Order Ref: <span className="font-mono text-gray-200">{activeTraceno}</span>
                        </p>
                        <p className="text-xs text-[#FF6000] font-bold mt-1">Amount: ₹{amount}</p>
                      </div>

                      {payUrl && (
                        <a
                          href={payUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-md active:scale-98 transition-transform"
                        >
                          <span>Open UPI Checkout Window</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    <div className="bg-[#161616] p-3 rounded-xl border border-[#2a2a2a] text-[11px] text-gray-400 space-y-1">
                      <p className="flex items-center gap-1.5 text-gray-300 font-semibold">
                        <Lock className="w-3.5 h-3.5 text-emerald-400" /> Auto Verification Active
                      </p>
                      <p>
                        Once you finish the UPI transfer on your phone, this page will automatically confirm and update your wallet.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleManualCheckStatus}
                        disabled={isVerifying}
                        className="flex-1 py-2.5 rounded-xl bg-[#222] border border-[#333] text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#2a2a2a]"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                        <span>{isVerifying ? 'Checking...' : 'Check Status'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTraceno(null);
                          setPayUrl(null);
                        }}
                        className="py-2.5 px-3 rounded-xl bg-[#181818] border border-[#2a2a2a] text-gray-400 text-xs hover:text-white"
                      >
                        New Order
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
