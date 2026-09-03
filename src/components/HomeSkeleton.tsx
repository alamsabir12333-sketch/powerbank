import React from 'react';

/**
 * HomeSkeleton
 * Polished, high-fidelity loading skeleton matching the GAINPOWER Home page layout.
 * Prevents layout shift and eliminates flash of 0/null/stale data.
 */
export const HomeSkeleton: React.FC = () => {
  return (
    <div className="w-full flex flex-col animate-in fade-in duration-150">
      {/* 1. Promotional Banner Carousel Skeleton */}
      <div className="w-full px-4 pt-1.5 pb-2">
        <div className="relative w-full h-[152px] rounded-[18px] overflow-hidden bg-[#1e1e1e] border border-gray-800 shadow-lg">
          {/* Subtle horizontal shimmer reflection */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-shimmer" />

          <div className="p-4 flex items-center justify-between h-full relative z-10">
            {/* Left artwork graphic placeholder */}
            <div className="flex items-center gap-3">
              <div className="w-16 h-20 rounded-xl bg-[#262626] border border-white/5 animate-pulse flex flex-col justify-between p-2">
                <div className="w-full h-1.5 rounded-full bg-white/20" />
                <div className="grid grid-cols-2 gap-1 my-auto">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-2 rounded-xs bg-white/20" />
                  ))}
                </div>
                <div className="w-3/4 h-1.5 rounded-full bg-white/20" />
              </div>

              {/* Middle title & tag placeholders */}
              <div className="space-y-2">
                <div className="w-28 h-4 rounded-md bg-white/15 animate-pulse" />
                <div className="w-36 h-3 rounded-md bg-white/10 animate-pulse" />
                <div className="w-20 h-5 rounded-full bg-[#FF6000]/25 border border-[#FF6000]/20 animate-pulse mt-1" />
              </div>
            </div>

            {/* Right floating decorative badge placeholder */}
            <div className="w-12 h-12 rounded-full bg-[#262626] border border-white/5 animate-pulse shrink-0 mr-1" />
          </div>

          {/* Carousel dots skeleton */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
            <div className="w-4 h-1 rounded-full bg-[#FF6000]/60" />
            <div className="w-1.5 h-1 rounded-full bg-white/20" />
            <div className="w-1.5 h-1 rounded-full bg-white/20" />
          </div>
        </div>
      </div>

      {/* 2. Announcement Bar Skeleton */}
      <div className="w-full px-4 py-1.5">
        <div className="w-full h-10 rounded-xl bg-[#222222] border border-gray-800 px-3 flex items-center gap-2.5 shadow-xs overflow-hidden">
          {/* Speaker icon skeleton */}
          <div className="w-4 h-4 rounded-full bg-[#FF6000]/30 animate-pulse shrink-0" />
          {/* Marquee text skeleton */}
          <div className="h-3 w-4/5 rounded bg-white/10 animate-pulse" />
        </div>
      </div>

      {/* 3. Home Quick Cards Skeleton (My Device + Recharge / Revenue Course) */}
      <div className="w-full px-4 py-2">
        <div className="grid grid-cols-2 gap-3 h-[156px]">
          {/* Left Large Card: MY DEVICE */}
          <div className="relative rounded-2xl p-4 flex flex-col justify-between overflow-hidden shadow-md bg-[#1e1e1e] border border-gray-800">
            <div className="relative z-10 space-y-2">
              <div className="w-16 h-2.5 rounded bg-white/10 animate-pulse" />
              <div className="w-20 h-7 rounded bg-white/15 animate-pulse mt-1" />
            </div>

            <div className="relative z-10 flex items-end justify-between">
              <div className="w-16 h-2.5 rounded bg-white/5 animate-pulse" />
              <div className="w-12 h-12 rounded-xl bg-[#282828] border border-white/5 animate-pulse" />
            </div>
          </div>

          {/* Right Column: RECHARGE (top) + REVENUE COURSE (bottom) */}
          <div className="flex flex-col gap-2.5 h-full">
            {/* Top Right: RECHARGE */}
            <div className="flex-1 rounded-xl px-3.5 py-2 flex items-center justify-center gap-2.5 bg-[#FF6000]/35 border border-[#FF6000]/30 shadow-sm animate-pulse">
              <div className="w-6 h-6 rounded-full bg-white/25" />
              <div className="w-16 h-3.5 rounded bg-white/25" />
            </div>

            {/* Bottom Right: REVENUE COURSE */}
            <div className="flex-1 rounded-xl px-3.5 py-2 flex items-center justify-center gap-2.5 bg-[#1e1e1e] border border-gray-800 shadow-sm">
              <div className="w-6 h-6 rounded-md bg-white/10 animate-pulse" />
              <div className="space-y-1">
                <div className="w-14 h-2.5 rounded bg-white/10 animate-pulse" />
                <div className="w-12 h-2.5 rounded bg-white/10 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Duration of GAIN POWER Double Earnings Card Skeleton */}
      <div className="w-full px-4 py-2">
        <div className="w-full rounded-2xl bg-[#1e1e1e] border border-gray-800 p-4 shadow-md">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="w-28 h-2.5 rounded bg-white/10 animate-pulse" />
              <div className="w-36 h-4.5 rounded bg-white/15 animate-pulse" />
            </div>
            <div className="w-22 h-6 rounded-lg bg-[#FF6000]/30 animate-pulse" />
          </div>

          {/* 4 Horizontal Statistics Grid with Subtle Dividers */}
          <div className="grid grid-cols-4 mt-4 pt-3 border-t border-gray-800 text-center gap-1">
            {/* 1. Remaining Hours */}
            <div className="border-r border-gray-800 pr-1 text-center">
              <div className="mx-auto w-12 h-3.5 rounded bg-[#FF6000]/35 animate-pulse mb-1.5" />
              <div className="mx-auto w-14 h-2 rounded bg-white/5 animate-pulse" />
            </div>

            {/* 2. Total Assets */}
            <div className="border-r border-gray-800 px-1 text-center">
              <div className="mx-auto w-14 h-3.5 rounded bg-white/20 animate-pulse mb-1.5" />
              <div className="mx-auto w-12 h-2 rounded bg-white/5 animate-pulse" />
            </div>

            {/* 3. Today Earnings */}
            <div className="border-r border-gray-800 px-1 text-center">
              <div className="mx-auto w-12 h-3.5 rounded bg-emerald-500/25 animate-pulse mb-1.5" />
              <div className="mx-auto w-14 h-2 rounded bg-white/5 animate-pulse" />
            </div>

            {/* 4. Promotion Earnings */}
            <div className="pl-1 text-center">
              <div className="mx-auto w-12 h-3.5 rounded bg-blue-500/25 animate-pulse mb-1.5" />
              <div className="mx-auto w-14 h-2 rounded bg-white/5 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Platform News Section Skeleton */}
      <div className="w-full px-4 pt-3 pb-6">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="w-28 h-4 rounded bg-white/15 animate-pulse" />
          <div className="w-16 h-6 rounded-lg bg-[#FF6000]/30 animate-pulse" />
        </div>

        {/* News Items List Skeletons (3 items) */}
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-full bg-[#1e1e1e] border border-gray-800 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-xs"
            >
              <div className="flex items-start gap-3 overflow-hidden flex-1">
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded-lg bg-white/10 animate-pulse shrink-0" />

                {/* Content */}
                <div className="overflow-hidden flex-1 space-y-2">
                  <div className="w-3/4 h-3.5 rounded bg-white/15 animate-pulse" />
                  <div className="w-1/2 h-2.5 rounded bg-white/5 animate-pulse" />
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-10 h-3 rounded bg-[#FF6000]/15 animate-pulse" />
                    <div className="w-14 h-3 rounded bg-white/5 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
