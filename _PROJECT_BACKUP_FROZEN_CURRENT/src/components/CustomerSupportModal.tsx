import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Headphones, Send, MessageCircle, Clock, ShieldCheck } from 'lucide-react';

interface CustomerSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerSupportModal: React.FC<CustomerSupportModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl z-10 text-gray-800"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#FF6200] flex items-center justify-center">
                <Headphones className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 leading-tight">
                  Customer Service
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-green-600 mt-0.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span>Online (09:00 - 22:00)</span>
                </div>
              </div>
            </div>

            {/* Contact Options */}
            <div className="space-y-3 mb-5">
              <button
                onClick={() => {
                  window.open('https://telegram.org', '_blank');
                }}
                className="w-full p-3.5 rounded-2xl border border-gray-100 bg-gray-50/80 hover:bg-orange-50/50 hover:border-orange-200 transition-all flex items-center justify-between group active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-xs">
                    <Send className="w-5 h-5 -rotate-45" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-800">
                      Official Telegram Channel
                    </p>
                    <p className="text-xs text-gray-500">
                      Latest announcements & group
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#FF6200] group-hover:translate-x-0.5 transition-transform">
                  Join &gt;
                </span>
              </button>

              <button
                onClick={() => {
                  window.open('https://whatsapp.com', '_blank');
                }}
                className="w-full p-3.5 rounded-2xl border border-gray-100 bg-gray-50/80 hover:bg-orange-50/50 hover:border-orange-200 transition-all flex items-center justify-between group active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500 text-white flex items-center justify-center shadow-xs">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-800">
                      WhatsApp 24/7 Agent
                    </p>
                    <p className="text-xs text-gray-500">
                      Instant response & resolution
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#FF6200] group-hover:translate-x-0.5 transition-transform">
                  Chat &gt;
                </span>
              </button>
            </div>

            <div className="bg-orange-50/60 rounded-xl p-3 text-xs text-orange-900/80 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#FF6200] shrink-0 mt-0.5" />
              <p>
                Please verify you are communicating through official platform channels only. Never share your password or OTP.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
