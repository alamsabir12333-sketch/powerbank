import React from 'react';
import { X, ExternalLink, ChevronRight, Globe, Send, MessageCircle, Sparkles } from 'lucide-react';
import { WebsitePopupConfig, TabType } from '../types';

interface WebsitePopupModalProps {
  config: WebsitePopupConfig | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: TabType) => void;
}

export const WebsitePopupModal: React.FC<WebsitePopupModalProps> = ({
  config,
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  if (!isOpen || !config || !config.isActive) return null;

  const handleLinkClick = (url?: string) => {
    if (!url) return;
    onClose();
    if (url.startsWith('/')) {
      const tab = url.replace('/', '') as TabType;
      onNavigateTab(tab);
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const links = [
    { text: config.link1Text, url: config.link1Url, icon: <Send className="w-3.5 h-3.5 text-[#FF6000]" /> },
    { text: config.link2Text, url: config.link2Url, icon: <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> },
    { text: config.link3Text, url: config.link3Url, icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" /> },
    { text: config.link4Text, url: config.link4Url, icon: <Globe className="w-3.5 h-3.5 text-cyan-400" /> },
  ].filter((l) => Boolean(l.text && l.url));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-[#1b1b1b] border border-[#FF6000]/40 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title & Dismiss Button */}
        <div className="px-4 py-3.5 bg-[#222222] border-b border-[#2d2d2d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF6000] animate-pulse" />
            <h3 className="text-sm font-bold tracking-wide uppercase text-white truncate max-w-[240px]">
              {config.title || 'Official Announcement'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Optional Banner / Poster Image */}
        {config.imageUrl && (
          <div className="w-full max-h-40 overflow-hidden bg-black/40 border-b border-[#2a2a2a]">
            <img
              src={config.imageUrl}
              alt={config.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Description Body */}
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
            {config.description}
          </p>

          {/* 4 Interactive Links */}
          {links.length > 0 && (
            <div className="space-y-2 pt-2">
              {links.map((link, idx) => (
                <button
                  key={idx}
                  onClick={() => handleLinkClick(link.url)}
                  className="w-full py-2.5 px-3.5 bg-[#242424] hover:bg-[#2e2e2e] active:scale-[0.98] border border-gray-700/60 hover:border-[#FF6000]/60 rounded-xl flex items-center justify-between text-xs font-semibold text-gray-200 hover:text-white transition-all cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {link.icon}
                    <span className="truncate">{link.text}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer Dismiss Action */}
        <div className="p-3 bg-[#171717] border-t border-[#252525] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-white bg-[#FF6000] hover:bg-[#ff7824] active:scale-95 rounded-lg transition-all cursor-pointer"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
