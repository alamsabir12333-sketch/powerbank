import React from 'react';
import { NewsItem } from '../types';
import { ChevronRight, Newspaper, Calendar } from 'lucide-react';

interface PlatformNewsProps {
  newsList: NewsItem[];
  onPurchaseClick?: () => void;
  onViewAllClick?: () => void;
  onNewsClick?: (news: NewsItem) => void;
}

export const PlatformNews: React.FC<PlatformNewsProps> = ({
  newsList,
  onPurchaseClick,
  onViewAllClick,
  onNewsClick,
}) => {
  if (!newsList || newsList.length === 0) return null;

  return (
    <div className="w-full px-4 pt-3 pb-6">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold text-[16px] tracking-tight flex items-center gap-2">
          Platform News
        </h3>
        <div className="flex items-center gap-2">
          {onViewAllClick && (
            <button
              onClick={onViewAllClick}
              className="text-gray-400 hover:text-white text-xs font-medium px-2 py-1 transition-colors cursor-pointer"
            >
              View All
            </button>
          )}
          {onPurchaseClick && (
            <button
              onClick={onPurchaseClick}
              className="bg-[#FF6000] hover:bg-[#E65100] active:scale-95 transition-all text-white font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-sm cursor-pointer"
            >
              Purchase
            </button>
          )}
        </div>
      </div>

      {/* News Items List */}
      <div className="flex flex-col gap-2.5">
        {newsList.map((item) => {
          const category = item.category || item.tag || 'Notice';
          const description = item.description || item.content || '';
          const imageUrl = item.imageUrl || item.image_url;
          const displayDate = item.date || (item.createdAt ? item.createdAt.split('T')[0] : '2026-08-21');

          return (
            <div
              key={item.id}
              onClick={() => onNewsClick?.(item)}
              className="w-full bg-[#1e1e1e] border border-gray-800 rounded-xl p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:border-gray-700 active:scale-[0.99] transition-all shadow-xs"
            >
              <div className="flex items-start gap-3 overflow-hidden flex-1">
                {imageUrl ? (
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-700 bg-black/30">
                    <img
                      src={imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-[#FF6000]/15 text-[#FF6000] flex items-center justify-center shrink-0 mt-0.5">
                    <Newspaper className="w-4 h-4" />
                  </div>
                )}

                <div className="overflow-hidden flex-1">
                  <p className="text-xs font-semibold text-gray-200 truncate leading-snug">
                    {item.title}
                  </p>
                  {description && (
                    <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5 leading-tight">
                      {description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-[#FF6000]/20 text-[#FF8C00] font-medium">
                      {category}
                    </span>
                    <span className="text-[9.5px] text-gray-500 flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      {displayDate}
                    </span>
                  </div>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

