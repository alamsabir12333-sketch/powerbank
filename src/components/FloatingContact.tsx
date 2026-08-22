import React from 'react';
import { Headphones } from 'lucide-react';

interface FloatingContactProps {
  isDark?: boolean;
  onClick?: () => void;
}

export const FloatingContact: React.FC<FloatingContactProps> = ({
  isDark = true,
  onClick,
}) => {
  return (
    <div className="fixed right-3 bottom-24 z-40">
      <button
        onClick={onClick}
        className={`w-13 h-13 rounded-full shadow-xl border flex flex-col items-center justify-center transition-all active:scale-95 duration-200 ${
          isDark
            ? 'bg-[#1e1e1e] border-[#FF6000] text-[#FF6000] shadow-black/60'
            : 'bg-white border-[#FF6000] text-[#FF6000] shadow-orange-500/15'
        }`}
      >
        <Headphones className="w-4 h-4 text-[#FF6000]" />
        <span className="text-[8.5px] font-bold text-[#FF6000] leading-none mt-0.5">
          Contact
        </span>
      </button>
    </div>
  );
};
