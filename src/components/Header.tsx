import React from 'react';
import { Bell } from 'lucide-react';
import { useSiteBranding } from '../context/SiteBrandingContext';

interface HeaderProps {
  onOpenNotifications?: () => void;
  unreadCount?: number;
  title?: string;
  isDark?: boolean;
  isLoading?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNotifications,
  unreadCount = 0,
  title,
  isDark = true,
  isLoading = false,
}) => {
  const { siteSettings, isLoading: brandingLoading } = useSiteBranding();
  const [logoLoadError, setLogoLoadError] = React.useState(false);

  const displayTitle = title || siteSettings?.siteTitle || 'GAIN POWER';
  const logoUrl = siteSettings?.logoUrl;
  const isLogoLoading = isLoading || brandingLoading;

  return (
    <header className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${
      isDark ? 'bg-[#121212] text-white' : 'bg-white text-gray-900 border-b border-gray-100'
    }`}>
      {/* Left: Brand logo area (shows sleek skeleton placeholder until dynamic logo data is ready) */}
      <div className="flex items-center">
        {isLogoLoading ? (
          <div className="h-7 w-28 rounded-md bg-white/10 animate-pulse border border-white/5" />
        ) : logoUrl && !logoLoadError ? (
          <img
            src={logoUrl}
            alt={displayTitle || 'Platform Logo'}
            className="h-8 max-h-8 w-auto max-w-[140px] object-contain rounded-sm shadow-xs"
            onError={() => setLogoLoadError(true)}
          />
        ) : (
          <div className="w-7 h-7 bg-[#FF6000] rounded-full flex items-center justify-center shadow-xs">
            <span className="text-[11px] text-white font-bold tracking-tight">GP</span>
          </div>
        )}
      </div>

      {/* Right controls: Notification Bell */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenNotifications}
          aria-label="Notifications"
          className={`relative p-1.5 rounded-full transition-all cursor-pointer active:scale-95 ${
            isDark
              ? 'text-gray-300 hover:text-white hover:bg-white/5'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          <Bell className="w-4.5 h-4.5" />
          {!isLogoLoading && unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-[#FF6000] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#121212] shadow-sm animate-in zoom-in-50 duration-200">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};


