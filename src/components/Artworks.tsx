import React from 'react';

// Power Bank logo matching the top left of Screenshot 1 (orange lightning/loop emblem)
export const PowerBankLogo: React.FC<{ className?: string }> = ({ className = 'w-7 h-7' }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
        <rect width="48" height="48" rx="12" fill="url(#pb-logo-grad)" />
        {/* Lightning / Loop Power graphic */}
        <path
          d="M26 10L14 26H24L22 38L34 22H24L26 10Z"
          fill="#FFFFFF"
          stroke="#FFE0B2"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="pb-logo-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF7A00" />
            <stop offset="1" stopColor="#E65100" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

// 3D Cabinet artwork for "My Device" blue card
export const BlueCabinetArtwork: React.FC<{ className?: string }> = ({ className = 'w-20 h-20' }) => {
  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 100 100" fill="none" className="w-full h-full drop-shadow-md">
        {/* Main Cabinet Body */}
        <rect x="20" y="15" width="60" height="70" rx="10" fill="#4B63EB" />
        <rect x="23" y="18" width="54" height="64" rx="8" fill="#3D53DB" />
        {/* Slots */}
        <rect x="28" y="25" width="44" height="6" rx="3" fill="#8FA2F8" opacity="0.9" />
        <rect x="28" y="35" width="44" height="6" rx="3" fill="#8FA2F8" opacity="0.9" />
        <rect x="28" y="45" width="44" height="6" rx="3" fill="#8FA2F8" opacity="0.9" />
        <rect x="28" y="55" width="44" height="6" rx="3" fill="#8FA2F8" opacity="0.9" />
        <rect x="28" y="65" width="44" height="6" rx="3" fill="#8FA2F8" opacity="0.9" />
        {/* Indicator lights */}
        <circle cx="34" cy="28" r="1.5" fill="#4ADE80" />
        <circle cx="34" cy="38" r="1.5" fill="#4ADE80" />
        <circle cx="34" cy="48" r="1.5" fill="#4ADE80" />
        <circle cx="34" cy="58" r="1.5" fill="#4ADE80" />
        <circle cx="34" cy="68" r="1.5" fill="#4ADE80" />
        {/* 3D Sheen highlight */}
        <path d="M22 22C22 17.5817 25.5817 14 30 14H70C74.4183 14 78 17.5817 78 22V32L22 45V22Z" fill="#FFFFFF" fillOpacity="0.15" />
      </svg>
    </div>
  );
};

// Piggy Bank artwork for Recharge card
export const PiggyBankArtwork: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => {
  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 64 64" fill="none" className="w-full h-full drop-shadow-sm">
        {/* Piggy body */}
        <ellipse cx="32" cy="36" rx="22" ry="18" fill="#FF5252" />
        {/* Snout */}
        <ellipse cx="14" cy="36" rx="6" ry="8" fill="#FF7979" />
        <circle cx="13" cy="34" r="1.5" fill="#C62828" />
        <circle cx="13" cy="38" r="1.5" fill="#C62828" />
        {/* Ear */}
        <path d="M26 22L30 14L34 22Z" fill="#FF7979" />
        {/* Eye */}
        <circle cx="24" cy="30" r="2" fill="#FFFFFF" />
        <circle cx="23" cy="30" r="1" fill="#333333" />
        {/* Legs */}
        <rect x="22" y="48" width="6" height="7" rx="3" fill="#E53935" />
        <rect x="36" y="48" width="6" height="7" rx="3" fill="#E53935" />
        {/* Coin Slot & Coin */}
        <rect x="28" y="16" width="12" height="3" rx="1.5" fill="#C62828" />
        <ellipse cx="34" cy="14" rx="4" ry="2" fill="#FFD54F" />
        <text x="32" y="15" fontSize="3" fill="#8D6E63" textAnchor="middle">₹</text>
      </svg>
    </div>
  );
};

// Revenue Course Rupee Passbook Artwork
export const RevenuePassbookArtwork: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => {
  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 64 64" fill="none" className="w-full h-full drop-shadow-sm">
        {/* Card/book base */}
        <rect x="12" y="14" width="40" height="36" rx="6" fill="#FFA726" />
        <rect x="16" y="18" width="32" height="28" rx="4" fill="#FFB74D" />
        {/* Rupee Coin in center */}
        <circle cx="32" cy="32" r="10" fill="#FFE082" />
        <text x="32" y="37" fontSize="13" fontWeight="bold" fill="#E65100" textAnchor="middle" fontFamily="sans-serif">₹</text>
        {/* Highlight lines */}
        <rect x="18" y="21" width="6" height="2" rx="1" fill="#FFFFFF" opacity="0.6" />
      </svg>
    </div>
  );
};

// Product Cabinet Illustrations for Screenshot 3 (Green, Silver, Multi-door)
export const ProductCabinetArtwork: React.FC<{ type: string; className?: string }> = ({
  type,
  className = 'w-14 h-14',
}) => {
  return (
    <div className={`relative flex items-center justify-center bg-black rounded-lg overflow-hidden p-1 ${className}`}>
      <svg viewBox="0 0 60 70" fill="none" className="w-full h-full">
        {type === 'cabinet-green' && (
          <>
            {/* Top header screen */}
            <rect x="10" y="6" width="40" height="14" rx="3" fill="#10B981" />
            <rect x="14" y="9" width="32" height="8" rx="1.5" fill="#047857" />
            <text x="30" y="15" fontSize="4" fill="#FFFFFF" textAnchor="middle" fontWeight="bold">POWER</text>
            {/* Cabinet body */}
            <rect x="10" y="22" width="40" height="42" rx="2" fill="#E5E7EB" />
            {/* Slots grid */}
            {[26, 32, 38, 44, 50, 56].map((y, idx) => (
              <g key={idx}>
                <rect x="14" y={y} width="32" height="3.5" rx="1" fill="#111827" />
                <circle cx="17" cy={y + 1.8} r="0.8" fill="#10B981" />
                <circle cx="21" cy={y + 1.8} r="0.8" fill="#10B981" />
                <circle cx="25" cy={y + 1.8} r="0.8" fill="#10B981" />
              </g>
            ))}
          </>
        )}

        {type === 'cabinet-silver' && (
          <>
            {/* Tower silver body */}
            <rect x="14" y="6" width="32" height="58" rx="3" fill="#D1D5DB" />
            <rect x="18" y="10" width="24" height="12" rx="2" fill="#3B82F6" />
            <text x="30" y="18" fontSize="4" fill="#FFFFFF" textAnchor="middle" fontWeight="bold">AIRPORT</text>
            {/* Slots */}
            {[26, 33, 40, 47, 54].map((y, idx) => (
              <g key={idx}>
                <rect x="18" y={y} width="24" height="4" rx="1" fill="#1F2937" />
                <circle cx="21" cy={y + 2} r="0.8" fill="#60A5FA" />
              </g>
            ))}
          </>
        )}

        {type === 'cabinet-medium' && (
          <>
            <rect x="12" y="6" width="36" height="58" rx="3" fill="#F3F4F6" />
            <rect x="16" y="9" width="28" height="10" rx="2" fill="#10B981" />
            <text x="30" y="16" fontSize="4" fill="#FFFFFF" textAnchor="middle" fontWeight="bold">48 PORT</text>
            {[22, 28, 34, 40, 46, 52, 57].map((y, idx) => (
              <g key={idx}>
                <rect x="16" y={y} width="28" height="3" rx="1" fill="#111827" />
                <circle cx="19" cy={y + 1.5} r="0.7" fill="#34D399" />
              </g>
            ))}
          </>
        )}

        {type === 'cabinet-small' && (
          <>
            <rect x="14" y="10" width="32" height="52" rx="3" fill="#E5E7EB" />
            <rect x="18" y="14" width="24" height="8" rx="2" fill="#059669" />
            <text x="30" y="20" fontSize="3.5" fill="#FFFFFF" textAnchor="middle" fontWeight="bold">36 SLOTS</text>
            {[25, 32, 39, 46, 53].map((y, idx) => (
              <g key={idx}>
                <rect x="18" y={y} width="24" height="3.5" rx="1" fill="#1F2937" />
                <circle cx="21" cy={y + 1.7} r="0.7" fill="#10B981" />
              </g>
            ))}
          </>
        )}

        {type === 'cabinet-mini' && (
          <>
            <rect x="16" y="14" width="28" height="46" rx="3" fill="#E2E8F0" />
            <rect x="20" y="18" width="20" height="7" rx="1.5" fill="#EA580C" />
            <text x="30" y="23" fontSize="3.5" fill="#FFFFFF" textAnchor="middle" fontWeight="bold">MINI</text>
            {[28, 35, 42, 49].map((y, idx) => (
              <g key={idx}>
                <rect x="20" y={y} width="20" height="3.5" rx="1" fill="#0F172A" />
                <circle cx="23" cy={y + 1.7} r="0.7" fill="#F97316" />
              </g>
            ))}
          </>
        )}

        {(type === 'cabinet-pro' || !['cabinet-green', 'cabinet-silver', 'cabinet-medium', 'cabinet-small', 'cabinet-mini'].includes(type)) && (
          <>
            {/* PRO High-yield Gold & Obsidian Cabinet */}
            <rect x="12" y="6" width="36" height="58" rx="4" fill="#18181B" stroke="#F59E0B" strokeWidth="1" />
            <rect x="16" y="10" width="28" height="10" rx="2" fill="url(#pro-gold-grad)" />
            <text x="30" y="17" fontSize="4" fill="#18181B" textAnchor="middle" fontWeight="900" letterSpacing="0.5">PRO YIELD</text>
            {[23, 30, 37, 44, 51, 57].map((y, idx) => (
              <g key={idx}>
                <rect x="16" y={y} width="28" height="3.5" rx="1" fill="#27272A" stroke="#EAB308" strokeWidth="0.5" />
                <circle cx="19" cy={y + 1.75} r="0.8" fill="#FACC15" />
                <circle cx="41" cy={y + 1.75} r="0.8" fill="#22C55E" />
              </g>
            ))}
            <defs>
              <linearGradient id="pro-gold-grad" x1="0" y1="0" x2="28" y2="10" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FDE047" />
                <stop offset="1" stopColor="#EAB308" />
              </linearGradient>
            </defs>
          </>
        )}
      </svg>
    </div>
  );
};

// Avatar graphic matching Screenshot 2 (clean cartoon boy with white shirt / orange outline)
export const ProfileAvatar: React.FC<{
  className?: string;
  vipBadge?: string;
  showVipBadge?: boolean;
}> = ({
  className = 'w-14 h-14',
  vipBadge,
  showVipBadge = false,
}) => {
  return (
    <div className={`relative ${className}`}>
      <div className="w-full h-full rounded-full overflow-hidden border-2 border-white/80 bg-orange-100 shadow-md">
        <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
          {/* Background circle */}
          <circle cx="32" cy="32" r="32" fill="#FFEDD5" />
          {/* Hair back */}
          <path d="M16 32C16 18 24 10 32 10C40 10 48 18 48 32H16Z" fill="#78350F" />
          {/* Face */}
          <ellipse cx="32" cy="34" rx="14" ry="15" fill="#FED7AA" />
          {/* Hair bangs */}
          <path d="M18 24C22 18 28 20 32 18C36 20 42 18 46 24C44 17 38 13 32 13C26 13 20 17 18 24Z" fill="#92400E" />
          {/* Eyes */}
          <ellipse cx="27" cy="33" rx="2" ry="2.5" fill="#1E293B" />
          <ellipse cx="37" cy="33" rx="2" ry="2.5" fill="#1E293B" />
          <circle cx="27.5" cy="32" r="0.7" fill="#FFFFFF" />
          <circle cx="37.5" cy="32" r="0.7" fill="#FFFFFF" />
          {/* Smile */}
          <path d="M29 40C30.5 42 33.5 42 35 40" stroke="#C2410C" strokeWidth="1.5" strokeLinecap="round" />
          {/* Cheeks */}
          <circle cx="23" cy="37" r="2.5" fill="#FCA5A5" opacity="0.6" />
          <circle cx="41" cy="37" r="2.5" fill="#FCA5A5" opacity="0.6" />
          {/* Body / Shirt */}
          <path d="M16 58C16 50 23 48 32 48C41 48 48 50 48 58V64H16V58Z" fill="#FFFFFF" />
          <path d="M28 48L32 54L36 48" stroke="#FB923C" strokeWidth="1.5" fill="none" />
        </svg>
      </div>

      {(vipBadge || showVipBadge) && (
        <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-gray-950 font-black text-[9px] shadow-sm flex items-center gap-0.5 border border-white tracking-tight z-10">
          <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
            <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5m14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
          </svg>
          <span>{vipBadge || 'VIP 0'}</span>
        </div>
      )}
    </div>
  );
};
