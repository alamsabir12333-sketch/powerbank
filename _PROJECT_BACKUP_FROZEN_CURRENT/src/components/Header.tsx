import React from 'react';
import { Globe, Bell } from 'lucide-react';
import { PowerBankLogo } from './Artworks';

interface HeaderProps {
  onOpenLanguageModal?: () => void;
  onOpenNotifications?: () => void;
  unreadCount?: number;
  title?: string;
  isDark?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenLanguageModal,
  onOpenNotifications,
  unreadCount = 0,
  title = 'Power Bank',
  isDark = true,
}) => {
  return (
    <header className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${
      isDark ? 'bg-[#121212] text-white' : 'bg-white text-gray-900 border-b border-gray-100'
    }`}>
      {/* Left: Brand logo & name */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-[#FF6000] rounded-full flex items-center justify-center shadow-xs">
          <span className="text-[10px] text-white font-bold">PB</span>
        </div>
        <span className={`text-[15px] font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </span>
      </div>

      {/* Right controls: Notification Bell & Language Selector */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
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
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-[#FF6000] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#121212] shadow-sm animate-in zoom-in-50 duration-200">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Language Selector */}
        <button
          onClick={onOpenLanguageModal}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all opacity-80 hover:opacity-100 active:scale-95 cursor-pointer ${
            isDark
              ? 'text-gray-300 hover:text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="w-3.5 h-3.5 border border-current rounded-full flex items-center justify-center text-[8px]">
            <Globe className="w-2.5 h-2.5" />
          </div>
          <span className="text-[11px]">English</span>
        </button>
      </div>
    </header>
  );
};


