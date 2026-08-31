import React from 'react';
import { BlueCabinetArtwork, PiggyBankArtwork, RevenuePassbookArtwork } from './Artworks';

interface HomeQuickCardsProps {
  undrawnAmount?: number;
  onMyDeviceClick?: () => void;
  onRechargeClick?: () => void;
  onRevenueCourseClick?: () => void;
}

export const HomeQuickCards: React.FC<HomeQuickCardsProps> = ({
  undrawnAmount = 0,
  onMyDeviceClick,
  onRechargeClick,
  onRevenueCourseClick,
}) => {
  return (
    <div className="w-full px-4 py-2">
      <div className="grid grid-cols-2 gap-3 h-[156px]">
        {/* Left Large Card: MY DEVICE */}
        <div
          onClick={onMyDeviceClick}
          className="relative rounded-2xl p-4 flex flex-col justify-between overflow-hidden cursor-pointer active:scale-[0.98] transition-transform shadow-md bg-[#1e1e1e] border border-gray-800"
        >
          {/* Subtle background ambient blur */}
          <div className="absolute -top-10 -left-10 w-28 h-28 rounded-full bg-[#FF6000]/5 blur-md pointer-events-none" />

          {/* Top text */}
          <div className="relative z-10">
            <span className="text-gray-400 font-bold text-[10.5px] uppercase tracking-wider">
              My Device
            </span>
            <div className="mt-1 flex items-baseline">
              <span className="text-white font-black text-2xl tracking-tight">
                {undrawnAmount}₹
              </span>
            </div>
          </div>

          {/* Bottom text & 3D Cabinet graphic */}
          <div className="relative z-10 flex items-end justify-between">
            <span className="text-gray-500 text-[11px] font-medium leading-tight max-w-[70px]">
              Undrawn amount
            </span>
            <div className="absolute -bottom-2 -right-2 transform translate-x-1 translate-y-1">
              <BlueCabinetArtwork className="w-16 h-16" />
            </div>
          </div>
        </div>

        {/* Right Column: RECHARGE (top) + REVENUE COURSE (bottom) */}
        <div className="flex flex-col gap-2.5 h-full">
          {/* Top Right: RECHARGE */}
          <div
            onClick={onRechargeClick}
            className="flex-1 rounded-xl px-3.5 py-2 flex items-center justify-center gap-2.5 overflow-hidden cursor-pointer active:scale-[0.98] transition-transform shadow-sm bg-[#FF6000] border border-[#FF6000] relative hover:brightness-105"
          >
            <PiggyBankArtwork className="w-7 h-7 shrink-0 drop-shadow-xs" />
            <span className="text-white font-bold text-[13px] tracking-wider uppercase">
              Recharge
            </span>
          </div>

          {/* Bottom Right: REVENUE COURSE */}
          <div
            onClick={onRevenueCourseClick}
            className="flex-1 rounded-xl px-3.5 py-2 flex items-center justify-center gap-2.5 overflow-hidden cursor-pointer active:scale-[0.98] transition-transform shadow-sm bg-[#1e1e1e] border border-gray-800 relative hover:bg-[#252525]"
          >
            <RevenuePassbookArtwork className="w-7 h-7 shrink-0 opacity-90" />
            <div className="flex flex-col leading-tight text-center">
              <span className="text-gray-300 font-bold text-[11px] uppercase tracking-wider">
                Revenue
              </span>
              <span className="text-gray-400 font-bold text-[11px] uppercase tracking-wider">
                course
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

