import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Newspaper, Calendar, Tag } from 'lucide-react';
import { NewsItem } from '../types';

interface NewsDetailModalProps {
  news: NewsItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const NewsDetailModal: React.FC<NewsDetailModalProps> = ({
  news,
  isOpen,
  onClose,
}) => {
  if (!news) return null;

  const category = news.category || news.tag || 'Platform News';
  const description = news.description || news.content || '';
  const imageUrl = news.imageUrl || news.image_url;
  const publishedDate = news.date || (news.createdAt ? news.createdAt.split('T')[0] : '2026-08-21');

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-xs"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            className="relative w-full max-w-md rounded-2xl bg-[#1a1a1a] border border-gray-800 p-5 shadow-2xl z-10 text-gray-200 flex flex-col max-h-[85vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#FF6000]/15 text-[#FF6000] flex items-center justify-center">
                  <Newspaper className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#FF6000]/20 text-[#FF8C00] tracking-wide uppercase">
                  {category}
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="py-4 space-y-3.5 overflow-y-auto pr-1">
              {imageUrl && (
                <div className="w-full h-44 rounded-xl overflow-hidden border border-gray-800 shrink-0 bg-black/40">
                  <img
                    src={imageUrl}
                    alt={news.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              <h2 className="text-base font-bold text-white leading-snug">
                {news.title}
              </h2>

              <div className="flex items-center gap-4 text-[11px] text-gray-400">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#FF6000]" />
                  <span>{publishedDate}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-gray-500" />
                  <span>{category}</span>
                </div>
              </div>

              <div className="text-xs text-gray-300 leading-relaxed pt-1 space-y-2 whitespace-pre-line border-t border-gray-800/80">
                {description}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-gray-800 shrink-0">
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FF6000] to-[#FF8A00] text-white font-bold text-xs shadow-md shadow-orange-500/20 active:scale-98 transition-all cursor-pointer hover:brightness-105"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
