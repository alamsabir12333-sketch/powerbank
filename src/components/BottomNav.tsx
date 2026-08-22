import React from 'react';
import { TabType } from '../types';
import { Home, ShoppingBasket, Shield, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isDark?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  isDark = true,
}) => {
  const tabs = [
    {
      id: 'home' as TabType,
      label: 'Home',
      icon: Home,
    },
    {
      id: 'fortune' as TabType,
      label: 'Fortune',
      customIcon: (active: boolean) => (
        <div
          className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-colors ${
            active
              ? 'border-[#FF6000] text-[#FF6000]'
              : isDark
              ? 'border-gray-500 text-gray-500'
              : 'border-gray-400 text-gray-400'
          }`}
        >
          <span className="text-[11px] font-bold leading-none">₹</span>
        </div>
      ),
    },
    {
      id: 'purchase' as TabType,
      label: 'Purchase',
      icon: ShoppingBasket,
    },
    {
      id: 'team' as TabType,
      label: 'Team',
      customIcon: (active: boolean) => (
        <div className="relative flex items-center justify-center">
          <Shield
            className={`w-5 h-5 transition-colors ${
              active
                ? 'text-[#FF6000]'
                : isDark
                ? 'text-gray-500'
                : 'text-gray-400'
            }`}
          />
          <span
            className={`absolute font-bold text-[9px] ${
              active
                ? 'text-[#FF6000]'
                : isDark
                ? 'text-gray-500'
                : 'text-gray-400'
            }`}
          >
            T
          </span>
        </div>
      ),
    },
    {
      id: 'me' as TabType,
      label: 'Me',
      icon: User,
    },
  ];

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 transition-colors duration-200 ${
        isDark
          ? 'bg-[#181818] border-t border-gray-800 shadow-2xl'
          : 'bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.04)]'
      }`}
    >
      <div className="max-w-[440px] mx-auto flex items-center justify-around h-[64px] px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex-1 flex flex-col items-center justify-center h-full gap-1 active:scale-95 transition-all select-none"
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-[#FF6000]/15 text-[#FF6000]'
                    : isDark
                    ? 'text-gray-500 hover:text-gray-400'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.customIcon ? (
                  tab.customIcon(isActive)
                ) : Icon ? (
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive
                        ? 'text-[#FF6000]'
                        : isDark
                        ? 'text-gray-500'
                        : 'text-gray-400'
                    }`}
                    strokeWidth={isActive ? 2.4 : 1.8}
                  />
                ) : null}
              </div>

              <span
                className={`text-[9.5px] tracking-tight whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-[#FF6000] font-bold'
                    : isDark
                    ? 'text-gray-500 font-medium'
                    : 'text-gray-400 font-medium'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
      {/* Safe Area bottom padding for mobile */}
      <div className="h-[env(safe-area-inset-bottom)] w-full" />
    </nav>
  );
};

