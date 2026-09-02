import React from 'react';

interface DoubleEarningsCardProps {
  remainingHours?: number | string;
  totalAssets?: number;
  todayEarnings?: number;
  promotionEarnings?: number;
  onDoubleHistoryClick?: () => void;
  onStatClick?: (type: string) => void;
}

export const DoubleEarningsCard: React.FC<DoubleEarningsCardProps> = ({
  remainingHours = 0,
  totalAssets = 0,
  todayEarnings = 0,
  promotionEarnings = 0,
  onDoubleHistoryClick,
  onStatClick,
}) => {
  // Format remaining hours label
  const formattedHours =
    typeof remainingHours === 'number'
      ? `${remainingHours} Hour(s)`
      : remainingHours || '0 Hour(s)';

  // Format financial numbers
  const formattedAssets = `₹${Number(totalAssets || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

  const formattedToday = `+₹${Number(todayEarnings || 0) > 0 ? Number(todayEarnings).toFixed(2) : '0'}`;
  const formattedPromo = `+₹${Number(promotionEarnings || 0) > 0 ? Number(promotionEarnings).toFixed(2) : '0'}`;

  return (
    <div className="w-full px-4 py-2">
      <div className="w-full rounded-2xl bg-[#1e1e1e] border border-gray-800 p-4 shadow-md">
        {/* Top Header Row: Title & Double History Button */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-gray-400 text-[10.5px] font-medium block">
              Duration of GAIN POWER
            </span>
            <h4 className="text-white font-bold text-[16px] leading-tight mt-0.5">
              Double Earnings
            </h4>
          </div>

          <button
            onClick={onDoubleHistoryClick}
            className="shrink-0 bg-[#FF6000] hover:bg-[#E65100] active:scale-95 transition-all text-white font-bold text-[10px] px-3 py-1.5 rounded-lg shadow-sm cursor-pointer"
          >
            Double history
          </button>
        </div>

        {/* 4 Horizontal Statistics Grid with Subtle Dividers */}
        <div className="grid grid-cols-4 mt-4 pt-3 border-t border-gray-800 text-center gap-1">
          {/* 1. Remaining Hours */}
          <div
            onClick={() => onStatClick?.('hours')}
            className="border-r border-gray-800 pr-1 text-center cursor-pointer hover:opacity-80 transition-opacity"
          >
            <p className="text-[#FF6000] font-bold text-[13px] sm:text-[14px] leading-tight truncate">
              {formattedHours}
            </p>
            <p className="text-gray-500 text-[8.5px] sm:text-[9.5px] mt-1 whitespace-nowrap">
              Remaining Hours
            </p>
          </div>

          {/* 2. Total Assets */}
          <div
            onClick={() => onStatClick?.('assets')}
            className="border-r border-gray-800 px-1 text-center cursor-pointer hover:opacity-80 transition-opacity"
          >
            <p className="text-white font-bold text-[13px] sm:text-[14px] leading-tight truncate">
              {formattedAssets}
            </p>
            <p className="text-gray-500 text-[8.5px] sm:text-[9.5px] mt-1 whitespace-nowrap">
              Total Assets
            </p>
          </div>

          {/* 3. Today's Earnings */}
          <div
            onClick={() => onStatClick?.('today')}
            className="border-r border-gray-800 px-1 text-center cursor-pointer hover:opacity-80 transition-opacity"
          >
            <p className="text-emerald-400 font-bold text-[13px] sm:text-[14px] leading-tight truncate">
              {formattedToday}
            </p>
            <p className="text-gray-500 text-[8.5px] sm:text-[9.5px] mt-1 whitespace-nowrap">
              Today Earnings
            </p>
          </div>

          {/* 4. Promotion Earnings */}
          <div
            onClick={() => onStatClick?.('promo')}
            className="pl-1 text-center cursor-pointer hover:opacity-80 transition-opacity"
          >
            <p className="text-amber-400 font-bold text-[13px] sm:text-[14px] leading-tight truncate">
              {formattedPromo}
            </p>
            <p className="text-gray-500 text-[8.5px] sm:text-[9.5px] mt-1 whitespace-nowrap">
              Promotion
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

