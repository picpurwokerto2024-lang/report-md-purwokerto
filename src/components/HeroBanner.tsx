import { useState, useEffect, useRef } from 'react';
import { BannerSlide } from '../types';
import { DEFAULT_BANNERS } from '../constants';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HeroBannerProps {
  banners?: BannerSlide[];
  autoSlideInterval?: number; // detik
}

const normalizeImageUrl = (url?: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  // Convert Google Drive share links to Full HD 1920px direct stream
  const matchFile = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFile && matchFile[1]) {
    return `https://lh3.googleusercontent.com/d/${matchFile[1]}=w1920`;
  }
  const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1] && trimmed.includes('drive.google.com')) {
    return `https://lh3.googleusercontent.com/d/${matchId[1]}=w1920`;
  }

  // Upgrade existing lh3 Google Drive URLs lacking an HD width parameter
  const matchLh3 = trimmed.match(/^https:\/\/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)$/);
  if (matchLh3 && matchLh3[1]) {
    return `https://lh3.googleusercontent.com/d/${matchLh3[1]}=w1920`;
  }

  return trimmed;
};

// Map natural image width/height ratio to a discrete Tailwind aspect-ratio class
// Locked to slide[0] so auto-sliding never causes layout shift (CLS = 0)
const getLandscapeAspectClass = (ratio: number | null): string => {
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) {
    return 'aspect-[16/8.6]';
  }
  if (ratio < 1.66) return 'aspect-[16/10]';
  if (ratio < 1.88) return 'aspect-[16/9]';
  if (ratio < 2.10) return 'aspect-[2/1]';
  if (ratio < 2.34) return 'aspect-[22/10]';
  if (ratio < 2.62) return 'aspect-[12/5]';
  return 'aspect-[28/10]';
};

export default function HeroBanner({
  banners = DEFAULT_BANNERS,
  autoSlideInterval = 4,
}: HeroBannerProps) {
  const slides = banners && banners.length > 0 ? banners : DEFAULT_BANNERS;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [primaryRatio, setPrimaryRatio] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset measured ratio when primary slide image changes
  const firstSlideUrl = slides[0]?.imageUrl;
  useEffect(() => {
    setPrimaryRatio(null);
  }, [firstSlideUrl]);

  // Auto-slide effect
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;

    const intervalMs = Math.max(2, autoSlideInterval) * 1000;
    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slides.length, autoSlideInterval, isPaused, currentIndex]);

  // Handle slide bounds
  useEffect(() => {
    if (currentIndex >= slides.length) {
      setCurrentIndex(0);
    }
  }, [slides.length, currentIndex]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const aspectClass = getLandscapeAspectClass(primaryRatio);

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      className={`group relative w-full overflow-hidden rounded-2xl md:rounded-3xl shadow-lg shadow-blue-900/12 bg-slate-900 ${aspectClass} min-h-[125px] max-h-[500px] select-none ring-1 ring-blue-950/10`}
    >
      {/* Slides Container */}
      {slides.map((slide, index) => {
        const isActive = index === currentIndex;
        const imgUrl = normalizeImageUrl(slide.imageUrl);
        const hasTextContent = Boolean(
          (slide.scriptText && slide.scriptText.trim()) ||
          (slide.title && slide.title.trim()) ||
          (slide.subtitle && slide.subtitle.trim())
        );
        const showTextOverlay = !slide.hideOverlay && hasTextContent;
        // Default to 'contain' (uncropped landscape) unless user explicitly picks 'cover'
        const useUncroppedContain = slide.fitMode !== 'cover';

        return (
          <div
            key={slide.id || index}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            {/* Soft Ambient Backdrop Layer so uncropped landscape banners never show black bars */}
            {useUncroppedContain && (
              <img
                src={imgUrl}
                alt=""
                aria-hidden="true"
                decoding="async"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover object-center scale-110 blur-xl opacity-65 brightness-75 pointer-events-none"
              />
            )}

            {/* Crisp HD Foreground Banner Image (No scale-105 crop/blur) */}
            <img
              src={imgUrl}
              alt={slide.title || 'Banner MD Purwokerto'}
              decoding="async"
              fetchPriority={isActive ? 'high' : 'auto'}
              referrerPolicy="no-referrer"
              onLoad={(e) => {
                if (index === 0) {
                  const target = e.currentTarget;
                  if (target.naturalWidth > 0 && target.naturalHeight > 0) {
                    setPrimaryRatio(target.naturalWidth / target.naturalHeight);
                  }
                }
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                // If it was a drive URL using lh3, try uc export fallback
                const driveMatch = slide.imageUrl?.match(/([a-zA-Z0-9_-]{25,})/);
                if (driveMatch && !target.src.includes('uc?export=view')) {
                  target.src = `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
                  return;
                }
                // Fallback to default banner if custom URL fails
                if (target.src !== DEFAULT_BANNERS[0].imageUrl) {
                  target.src = DEFAULT_BANNERS[0].imageUrl;
                }
              }}
              className={`relative z-[1] w-full h-full ${
                useUncroppedContain ? 'object-contain' : 'object-cover'
              } object-center`}
            />

            {/* Dark gradient for text legibility (Only when text overlay is active) */}
            {showTextOverlay && (
              <div className="absolute inset-0 z-[2] bg-gradient-to-r from-blue-950/80 via-transparent to-transparent pointer-events-none" />
            )}

            {/* Left Blue Gradient Ribbon with Text Content (Only when enabled and has text) */}
            {showTextOverlay && (
              <div className="absolute inset-y-0 left-0 w-[62%] sm:w-[56%] md:w-[48%] bg-gradient-to-r from-[#0d3b82]/95 via-[#1a56b7]/88 to-transparent flex flex-col justify-center px-4 sm:px-6 md:px-7 z-10 pointer-events-none">
                {slide.scriptText && (
                  <span className="font-['Dancing_Script',cursive] text-white text-xl sm:text-2xl md:text-3xl font-bold -mb-1 drop-shadow">
                    {slide.scriptText}
                  </span>
                )}
                {slide.title && (
                  <h2 className="text-white font-extrabold text-sm sm:text-base md:text-xl lg:text-2xl leading-tight tracking-tight drop-shadow-md line-clamp-2">
                    {slide.title}
                  </h2>
                )}
                {slide.subtitle && (
                  <p className="text-blue-100 text-[10px] sm:text-xs md:text-sm font-medium mt-0.5 drop-shadow line-clamp-1">
                    {slide.subtitle}
                  </p>
                )}
              </div>
            )}

            {/* Right Golden Yellow Slogan Badge */}
            {slide.badgeText && !slide.hideOverlay && (
              <div className="absolute top-0 right-0 bottom-0 flex items-center pr-3 sm:pr-5 md:pr-7 z-10 pointer-events-none">
                <div className="relative bg-gradient-to-r from-[#f59e0b]/95 to-[#d97706]/95 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl shadow-md border border-amber-300/40 transform -rotate-1 sm:-rotate-2 backdrop-blur-xs max-w-[130px] sm:max-w-[170px] md:max-w-[210px] text-right">
                  <p className="font-bold italic text-[10px] sm:text-xs md:text-sm leading-tight text-white drop-shadow">
                    {slide.badgeText}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Navigation Arrow Controls (Visible on hover or tap) */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/35 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity backdrop-blur-xs cursor-pointer shadow-sm"
            aria-label="Slide sebelumnya"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/35 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity backdrop-blur-xs cursor-pointer shadow-sm"
            aria-label="Slide berikutnya"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          </button>
        </>
      )}

      {/* Slide Indicator Dots (Bottom Center) */}
      {slides.length > 1 && (
        <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/25 backdrop-blur-xs">
          {slides.map((_, dotIdx) => (
            <button
              key={dotIdx}
              type="button"
              onClick={() => setCurrentIndex(dotIdx)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                dotIdx === currentIndex
                  ? 'w-5 bg-white shadow-xs'
                  : 'w-1.5 bg-white/50 hover:bg-white/80'
              }`}
              aria-label={`Pindah ke slide ${dotIdx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
