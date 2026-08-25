import React, { useState, useEffect } from 'react';
import { ChevronLeft, Wifi, CheckCircle2 } from 'lucide-react';
import { BankAccount } from '../types';
import { fetchBankAccounts } from '../services/api';

interface BankCardPageProps {
  userId: string;
  onBack: () => void;
  onNavigateTab: (tab: any) => void;
  onOpenAddCard: () => void;
}

export const BankCardPage: React.FC<BankCardPageProps> = ({
  userId,
  onBack,
  onOpenAddCard,
}) => {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetchBankAccounts(userId)
      .then((banks) => setBankAccounts(banks))
      .finally(() => setLoading(false));
  }, [userId]);

  const defaultBank = bankAccounts.length > 0 ? bankAccounts[0] : null;

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col justify-between pb-8">
      {/* Top Header matching Screenshot 2 */}
      <div className="pt-4 px-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-800 hover:bg-gray-200 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5 -ml-0.5" />
        </button>

        <h1 className="text-base font-bold text-gray-900">Bank Card</h1>

        <div className="w-9 h-9" />
      </div>

      {/* Center Card & Concentric Background Rings */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Soft Concentric Background Rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
          <div className="w-80 h-80 rounded-full border border-orange-100" />
          <div className="w-96 h-96 rounded-full border border-orange-50 absolute" />
          <div className="w-[440px] h-[440px] rounded-full border border-gray-50 absolute" />
        </div>

        {/* Vertical Orange Bank / UPI Card matching App theme */}
        <div className="relative z-10 w-64 h-[370px] sm:w-72 sm:h-[400px] rounded-[28px] bg-gradient-to-b from-[#E05300] via-[#FF6000] to-[#E64A00] p-6 text-white shadow-2xl shadow-orange-900/25 flex flex-col justify-between border border-orange-300/30 overflow-hidden">
          {/* Top Row: UPI Logo on the right */}
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-0.5">
              <span className="text-2xl font-black italic tracking-tighter text-white">UPI</span>
              <span className="text-orange-200 text-lg font-black">▶</span>
            </div>
          </div>

          {/* Middle Row: Contactless + Golden Chip + Asterisks */}
          <div className="flex items-center justify-between my-auto">
            {/* Left: Contactless icon & Chip */}
            <div className="space-y-4">
              <div className="text-orange-200">
                <Wifi className="w-6 h-6 rotate-90 opacity-80" />
              </div>

              {/* Realistic Gold EMV Chip */}
              <div className="w-12 h-9 rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/80 shadow-md flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 border-t border-b border-amber-700/30">
                  <div className="border-r border-amber-700/30" />
                  <div className="border-r border-amber-700/30" />
                  <div />
                </div>
                <div className="w-4 h-4 rounded-full border border-amber-700/40" />
              </div>
            </div>

            {/* Vertical Asterisks / Card Number */}
            <div className="flex flex-col items-center gap-1.5 text-orange-100 font-mono text-sm tracking-widest font-bold">
              <span>* * * *</span>
              <span>* * * *</span>
              <span>* * * *</span>
              <span>* * * *</span>
            </div>

            {/* Right: Bank Details */}
            <div className="text-right flex flex-col justify-end space-y-1">
              <span className="text-xs font-bold text-white block truncate max-w-[90px]">
                {defaultBank?.bankName || 'Bank Name'}
              </span>
              <span className="text-[11px] font-mono text-orange-200 block truncate max-w-[90px]">
                {defaultBank?.ifsc || 'IFSC Code'}
              </span>
            </div>
          </div>

          {/* Bottom Card Holder or Masked Number */}
          <div className="pt-2 border-t border-orange-400/40 flex items-center justify-between text-[11px] text-orange-100 font-medium">
            <span className="truncate max-w-[140px]">
              {defaultBank?.accountHolderName || 'YOUR NAME'}
            </span>
            {defaultBank && (
              <span className="flex items-center gap-1 text-orange-200 font-bold text-[10px]">
                <CheckCircle2 className="w-3.5 h-3.5" /> LINKED
              </span>
            )}
          </div>
        </div>

        {/* Text Below Card */}
        <div className="text-center mt-8 space-y-1.5 z-10">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            {defaultBank ? 'Bank Account Connected' : 'Please link your bank account'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 font-medium">
            {defaultBank
              ? `${defaultBank.bankName} (A/C: ${defaultBank.accountNumber.slice(-4).padStart(defaultBank.accountNumber.length, '*')})`
              : 'Then start investing.'}
          </p>
        </div>
      </div>

      {/* Fixed Bottom Action Button */}
      <div className="px-5 w-full max-w-lg mx-auto">
        <button
          type="button"
          onClick={onOpenAddCard}
          className="w-full py-4 rounded-2xl bg-[#FF6000] hover:bg-[#E05300] active:scale-[0.99] text-white font-bold text-base shadow-lg shadow-orange-700/20 transition-all cursor-pointer flex items-center justify-center"
        >
          <span>{defaultBank ? 'Add Another Bank Card' : 'Add Bank Card'}</span>
        </button>
      </div>
    </div>
  );
};
