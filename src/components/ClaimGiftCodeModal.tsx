import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Gift, Sparkles, CheckCircle2, AlertCircle, Loader2, ArrowRight, Clipboard } from 'lucide-react';
import { claimGiftCode } from '../services/api';

interface ClaimGiftCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: (amount: number, message: string) => void;
}

export const ClaimGiftCodeModal: React.FC<ClaimGiftCodeModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSuccess,
}) => {
  const [giftCode, setGiftCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    amount: number;
    code: string;
    destination: string;
  } | null>(null);

  const handleClaim = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = giftCode.trim().toUpperCase();
    if (!clean) {
      setErrorMessage('Please enter a valid gift code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await claimGiftCode(clean, userId);
      setSuccessData({
        amount: res.rewardAmount,
        code: res.code,
        destination: res.destination,
      });
      onSuccess(res.rewardAmount, `Successfully claimed ₹${res.rewardAmount} from code ${res.code}!`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to claim gift code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setGiftCode(text.trim().toUpperCase());
          setErrorMessage(null);
        }
      }
    } catch {
      // ignore clipboard error
    }
  };

  const handleClose = () => {
    setGiftCode('');
    setErrorMessage(null);
    setSuccessData(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="claim-gift-code-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl z-10 text-gray-800 border border-orange-100 overflow-hidden"
          >
            {/* Background subtle glow */}
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-orange-100/60 rounded-full blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4 relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-orange-100 text-[#FF6000] flex items-center justify-center shadow-xs">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">Claim Gift Code</h3>
                  <p className="text-[10px] text-gray-500 font-medium">Instant balance reward</p>
                </div>
              </div>
              <button
                id="close-gift-code-modal-btn"
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Success State View */}
            {successData ? (
              <div className="py-4 text-center space-y-4 relative z-10">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-amber-400 to-[#FF6000] text-white flex items-center justify-center shadow-lg shadow-orange-500/20 animate-bounce">
                  <Sparkles className="w-8 h-8" />
                </div>

                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Claim Successful
                  </div>
                  <h4 className="text-sm font-semibold text-gray-700">Congratulations!</h4>
                  <div className="text-3xl font-black text-[#FF6000] mt-1 tracking-tight">
                    +₹{successData.amount.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 font-medium">
                    Reward for code <span className="font-mono font-bold text-gray-800">{successData.code}</span> has been credited to your{' '}
                    <span className="font-bold text-gray-800">
                      {successData.destination === 'RECHARGE_BALANCE' ? 'Recharge Balance' : 'My Wallet (Earning)'}
                    </span>.
                  </p>
                </div>

                <button
                  id="gift-code-success-done-btn"
                  onClick={handleClose}
                  className="w-full py-3 rounded-xl bg-[#FF6000] hover:bg-[#e05500] active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                >
                  Awesome, Thanks!
                </button>
              </div>
            ) : (
              /* Input Form View */
              <form onSubmit={handleClaim} className="space-y-4 relative z-10">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Enter Gift Code
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#FF6000]">
                      <Gift className="w-4 h-4" />
                    </div>
                    <input
                      id="gift-code-input"
                      type="text"
                      value={giftCode}
                      onChange={(e) => {
                        setGiftCode(e.target.value.toUpperCase());
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="e.g. GAIN100, LUCKY2026"
                      autoFocus
                      maxLength={30}
                      className="w-full pl-10 pr-20 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 font-mono font-bold text-sm tracking-wider uppercase placeholder:text-gray-400 placeholder:font-sans placeholder:font-normal focus:outline-hidden focus:border-[#FF6000] focus:ring-2 focus:ring-orange-500/20 transition-all"
                    />

                    <div className="absolute inset-y-0 right-1.5 flex items-center gap-1">
                      {giftCode ? (
                        <button
                          type="button"
                          onClick={() => setGiftCode('')}
                          className="px-2 py-1 text-[11px] font-semibold text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                        >
                          Clear
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handlePaste}
                          className="px-2.5 py-1 text-[11px] font-bold text-[#FF6000] bg-orange-50 hover:bg-orange-100 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <Clipboard className="w-3 h-3" />
                          Paste
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="font-medium leading-snug">{errorMessage}</span>
                  </motion.div>
                )}

                <div className="bg-orange-50/60 rounded-xl p-3 border border-orange-100 text-[11px] text-gray-600 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#FF6000]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>How it works</span>
                  </div>
                  <p className="leading-relaxed">
                    Official gift codes provide instant cash rewards added directly to your balance. Codes are distributed via announcements and official telegram/community events.
                  </p>
                </div>

                <div className="pt-1">
                  <button
                    id="submit-claim-gift-code-btn"
                    type="submit"
                    disabled={loading || !giftCode.trim()}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                      loading || !giftCode.trim()
                        ? 'bg-gray-300 shadow-none cursor-not-allowed'
                        : 'bg-gradient-to-r from-[#FF6000] to-amber-500 hover:from-[#e55600] hover:to-amber-600 active:scale-[0.98] shadow-orange-500/25'
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying & Claiming...</span>
                      </>
                    ) : (
                      <>
                        <span>CLAIM REWARD</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
