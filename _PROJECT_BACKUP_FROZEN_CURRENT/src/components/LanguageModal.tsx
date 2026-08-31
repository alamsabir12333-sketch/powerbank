import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Globe } from 'lucide-react';

interface LanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang?: string;
  onSelectLang?: (lang: string) => void;
}

export const LanguageModal: React.FC<LanguageModalProps> = ({
  isOpen,
  onClose,
  currentLang = 'English',
  onSelectLang,
}) => {
  const [selected, setSelected] = useState(currentLang);

  const languages = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
    { code: 'bn', name: 'Bengali', native: 'বাংলা' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు' },
    { code: 'mr', name: 'Marathi', native: 'मराठी' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
    { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  ];

  const handleConfirm = (lang: string) => {
    setSelected(lang);
    onSelectLang?.(lang);
    setTimeout(onClose, 150);
  };

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
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#FF6200]" />
                <h3 className="text-base font-bold text-gray-900">
                  Select Language
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {languages.map((item) => {
                const isCurrent = selected === item.name;
                return (
                  <button
                    key={item.code}
                    onClick={() => handleConfirm(item.name)}
                    className={`w-full px-4 py-3 rounded-xl flex items-center justify-between text-left transition-all ${
                      isCurrent
                        ? 'bg-orange-50/80 text-[#FF6200] font-bold border border-orange-200'
                        : 'hover:bg-gray-50 text-gray-700 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{item.name}</span>
                      <span className="text-xs text-gray-400">({item.native})</span>
                    </div>
                    {isCurrent && <Check className="w-4 h-4 text-[#FF6200]" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
