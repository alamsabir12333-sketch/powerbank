import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BannerItem } from '../types';

interface BannerCarouselProps {
  banners: BannerItem[];
  onBannerClick?: (banner: BannerItem) => void;
}

export const BannerCarousel: React.FC<BannerCarouselProps> = ({
  banners,
  onBannerClick,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  useEffect(() => {
    timerRef.current = setInterval(nextSlide, 4500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [banners.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (diff > 40) {
      nextSlide();
    } else if (diff < -40) {
      prevSlide();
    }
    setTouchStart(null);
  };

  const currentBanner = banners[currentIndex];
  if (!currentBanner) return null;

  // Banner Link must be a valid, non-empty string and not whitespace or fallback
  const rawLink = currentBanner.linkUrl !== undefined && currentBanner.linkUrl !== null ? currentBanner.linkUrl : currentBanner.targetTab;
  const bannerLink = typeof rawLink === 'string' ? rawLink.trim() : '';
  const hasLink = Boolean(bannerLink && bannerLink !== '#' && bannerLink.toUpperCase() !== 'INVEST');

  return (
    <div className="w-full px-4 pt-1.5 pb-2">
      <div
        className={`relative w-full h-[152px] rounded-[18px] overflow-hidden select-none shadow-lg ${
          hasLink ? 'cursor-pointer active:opacity-95' : 'cursor-default'
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (!hasLink) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          onBannerClick?.(currentBanner);
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentBanner.id}
            initial={{ opacity: 0.6, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0.6, scale: 0.98 }}
            transition={{ duration: 0.4 }}
            className="w-full h-full relative overflow-hidden bg-gradient-to-br from-[#FF8C00] to-[#FF4500]"
          >
            {currentBanner.imageUrl ? (
              <img
                src={currentBanner.imageUrl}
                alt=""
                className="w-full h-full object-cover select-none pointer-events-none"
              />
            ) : (
              <div className="w-full h-full relative p-4 flex items-center justify-between overflow-hidden">
                {/* Background glowing circles and floating coins */}
                <div className="absolute -top-12 -left-12 w-36 h-36 rounded-full bg-white/15 blur-md pointer-events-none" />
                <div className="absolute -bottom-10 right-10 w-32 h-32 rounded-full bg-[#FF4500]/40 blur-lg pointer-events-none" />

                {/* Left Artwork Composition matching Screenshot 1 */}
                <div className="relative z-10 flex items-center justify-center w-[45%] h-full">
                  {/* Floating translucent Rupee coin top-left */}
                  <div className="absolute top-1 left-2 w-7 h-7 rounded-full bg-white/20 border border-white/40 flex items-center justify-center shadow-xs">
                    <span className="text-[12px] font-bold text-white/80">₹</span>
                  </div>
                  
                  {/* x2 badge tag */}
                  <div className="absolute top-3 right-4 bg-orange-400/60 text-white font-extrabold text-[10px] px-1.5 py-0.5 rounded-sm transform -rotate-12 border border-white/30">
                    x2
                  </div>

                  {/* Central 3D Power Bank station platform */}
                  <div className="relative mt-2 flex flex-col items-center">
                    {/* 3D Rack Device Graphic */}
                    <div className="w-16 h-20 bg-gradient-to-b from-[#FF5722] to-[#D84315] rounded-xl p-1.5 shadow-md border border-white/30 flex flex-col justify-between">
                      <div className="w-full h-2 rounded-full bg-white/40 mb-1" />
                      <div className="grid grid-cols-2 gap-1 my-auto">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <div key={i} className="h-2 rounded-sm bg-white/80" />
                        ))}
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-black/20 mt-1" />
                    </div>
                    
                    {/* Yellow platform cylinder base */}
                    <div className="w-24 h-6 -mt-3 bg-gradient-to-r from-[#FFD54F] via-[#FFCA28] to-[#FFA000] rounded-full shadow-md border-t border-white/50" />
                  </div>

                  {/* Floating coin bottom-left */}
                  <div className="absolute bottom-2 left-6 w-6 h-6 rounded-full bg-white/25 border border-white/40 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white/90">₹</span>
                  </div>
                </div>

                {/* Right Promotional Content fallback */}
                <div className="relative z-10 w-[55%] flex flex-col items-end text-right pl-2 pr-1 ml-auto">
                  <h2 className="text-[18px] font-extrabold text-white leading-tight drop-shadow-md">
                    {currentBanner.title || 'Platform Promotion'}
                  </h2>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Carousel indicator dots */}
        {banners.length > 1 && (
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 pointer-events-auto">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentIndex
                    ? 'w-4 bg-[#FF6000]'
                    : 'w-1.5 bg-white/60 hover:bg-white'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
