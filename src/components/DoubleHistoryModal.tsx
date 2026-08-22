import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, Clock, Calendar, ShieldCheck, HelpCircle } from 'lucide-react';
import { PurchaseItem } from '../types';

interface DoubleHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchases?: PurchaseItem[];
  onNavigatePurchase?: () => void;
}

export const DoubleHistoryModal: React.FC<DoubleHistoryModalProps> = ({
  isOpen,
  onClose,
  purchases = [],
  onNavigatePurchase,
}) => {
  // Map real purchases into double history event logs
  const historyItems = purchases.map((p) => {
    const isPro = (p.planCategory || '').toUpperCase() === 'PRO';
    const isRunning = p.status === 'ACTIVE';
    const durationHours = (p.durationDays || 365) * 24;

    const formattedDate = p.startedAt
      ? new Date(p.startedAt).toLocaleString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Recent';

    return {
      id: p.id,
      title: p.planName ? `${p.planName} (2X Yield)` : 'Shared Power Cabinet (2X Yield)',
      duration: `${durationHours} Hours`,
      bonus: isPro ? '+100% Daily Bonus' : '+100% Hourly Yield',
      date: formattedDate,
      status: isRunning ? 'Active' : 'Completed',
      isRunning,
      earned: p.totalEarned || 0,
      amount: p.amount,
    };
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-xs"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            className="relative w-full max-w-sm rounded-3xl bg-[#1e1e1e] border border-gray-800 p-5 shadow-2xl z-10 text-gray-200 flex flex-col max-h-[85vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FF6000]/15 text-[#FF6000] flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    Double History
                  </h3>
                  <p className="text-[10px] text-gray-400">
                    Device 2X Multiplier & Earning Boost Logs
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content List */}
            <div className="py-3 space-y-2.5 overflow-y-auto pr-1 flex-1">
              {historyItems.length > 0 ? (
                historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-[#171717] border border-gray-800/80 flex flex-col gap-2 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-gray-100 leading-snug">
                        {item.title}
                      </h4>
                      <span
                        className={`text-[9.5px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                          item.isRunning
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-gray-800 text-gray-400 border border-gray-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#FF6000]" />
                        <span className="text-[11px] text-gray-300">{item.duration}</span>
                      </div>
                      <span className="text-[#FF6000] font-bold text-[11px]">
                        {item.bonus}
                      </span>
                    </div>

                    <div className="text-[10px] text-gray-500 flex items-center justify-between border-t border-gray-800 pt-2">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        <span>{item.date}</span>
                      </div>
                      <span className="text-gray-400 font-medium">
                        Total Yield: <span className="text-emerald-400 font-semibold">₹{item.earned.toFixed(2)}</span>
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 px-4 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-gray-800/60 text-gray-500 flex items-center justify-center mb-3">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-gray-300">
                    No Double History Records
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1 max-w-[220px] leading-relaxed">
                    You do not have any active or past 2X power bank records. Activate hardware devices to start earning.
                  </p>
                  {onNavigatePurchase && (
                    <button
                      onClick={() => {
                        onClose();
                        onNavigatePurchase();
                      }}
                      className="mt-4 px-4 py-2 rounded-xl bg-[#FF6000] hover:bg-[#E65100] text-white text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      Browse Devices
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer Action */}
            <div className="pt-3 border-t border-gray-800 shrink-0">
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-[#FF6000] hover:bg-[#E65100] text-white font-bold text-xs shadow-md shadow-orange-500/20 active:scale-98 transition-all cursor-pointer"
              >
                Got It
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

