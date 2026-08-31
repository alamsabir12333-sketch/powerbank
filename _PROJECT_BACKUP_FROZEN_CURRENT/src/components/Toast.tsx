import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string | null;
  type?: ToastType;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info' }) => {
  return (
    <AnimatePresence>
      {message && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 w-full max-w-xs">
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="bg-[#1f2125]/95 text-white border border-gray-700/80 px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md flex items-center justify-center gap-2 text-xs font-semibold"
          >
            {type === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />}
            {type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
            {type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
            {type === 'info' && <Info className="w-4 h-4 text-[#FF7A00] shrink-0" />}
            <span className="truncate">{message}</span>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
