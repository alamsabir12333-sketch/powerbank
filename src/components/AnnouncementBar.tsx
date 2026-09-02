import React from 'react';
import { Volume2 } from 'lucide-react';

interface AnnouncementBarProps {
  text?: string;
  onClick?: () => void;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({
  text = 'Welcome to GAIN POWER! Connect high-yield sharing economy devices to earn daily returns. Complete tasks to get double bonus!',
  onClick,
}) => {
  return (
    <div className="w-full px-4 py-1.5">
      <div
        onClick={onClick}
        className="w-full h-10 rounded-xl bg-[#222222] border border-gray-800 px-3 flex items-center gap-2.5 cursor-pointer hover:bg-[#282828] transition-colors shadow-xs"
      >
        <Volume2 className="w-4 h-4 text-[#FF6000] shrink-0" />
        <div className="overflow-hidden whitespace-nowrap w-full text-xs text-gray-300">
          <div className="inline-block animate-marquee font-normal">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
};

