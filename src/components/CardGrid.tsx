import { MenuItem } from '../types';
import {
  Calendar,
  Megaphone,
  Gift,
  Store,
  ShoppingCart,
  Users,
  MapPin,
  Building2,
  ArrowRight,
  FileSpreadsheet,
} from 'lucide-react';

interface CardGridProps {
  items: MenuItem[];
  defaultWarna1?: string;
  defaultWarna2?: string;
}

// Helper to determine the theme (icon, watermark, gradient) for each card
function getCardTheme(item: MenuItem, defaultWarna1?: string, defaultWarna2?: string) {
  const nameLower = (item.nama || '').toLowerCase();

  // If custom color is explicitly set in CMS for this item
  if (item.warna && /^#[0-9a-fA-F]{6}$/.test(item.warna)) {
    return {
      gradient: `linear-gradient(135deg, ${item.warna} 0%, ${item.warna}dd 100%)`,
      iconColor: item.warna,
      Icon: FileSpreadsheet,
      watermarkType: 'spreadsheet',
    };
  }

  // 1. Jadwal MD
  if (nameLower.includes('jadwal')) {
    return {
      gradient: 'linear-gradient(135deg, #00b4d8 0%, #0096c7 55%, #0077b6 100%)',
      iconColor: '#0096c7',
      Icon: Calendar,
      watermarkType: 'calendar',
    };
  }

  // 2. Promo MT
  if (nameLower.includes('promo mt') || nameLower.includes('informasi promo mt')) {
    return {
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 70%, #b45309 100%)',
      iconColor: '#d97706',
      Icon: Megaphone,
      watermarkType: 'megaphone',
    };
  }

  // 3. Promo GT or Promo
  if (nameLower.includes('promo')) {
    return {
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #e67e22 55%, #d97706 100%)',
      iconColor: '#e67e22',
      Icon: Gift,
      watermarkType: 'gift',
    };
  }

  // 4. MD Pasar
  if (nameLower.includes('pasar')) {
    return {
      gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 65%, #075985 100%)',
      iconColor: '#0284c7',
      Icon: Store,
      watermarkType: 'store',
    };
  }

  // 5. MD Mobile PBG
  if (nameLower.includes('mobile pbg')) {
    return {
      gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 65%, #1e40af 100%)',
      iconColor: '#2563eb',
      Icon: ShoppingCart,
      watermarkType: 'cart',
    };
  }

  // 6. MD Mobile PWK
  if (nameLower.includes('mobile pwk')) {
    return {
      gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 65%, #4338ca 100%)',
      iconColor: '#4f46e5',
      Icon: Users,
      watermarkType: 'users',
    };
  }

  // 7. MD Mobile Other Areas
  if (nameLower.includes('mobile')) {
    if (nameLower.includes('ajb') || nameLower.includes('majenang')) {
      return {
        gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 65%, #0369a1 100%)',
        iconColor: '#0284c7',
        Icon: MapPin,
        watermarkType: 'map',
      };
    }
    if (nameLower.includes('cilacap') || nameLower.includes('banjar')) {
      return {
        gradient: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 65%, #172554 100%)',
        iconColor: '#1d4ed8',
        Icon: MapPin,
        watermarkType: 'map',
      };
    }
    return {
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 65%, #1d4ed8 100%)',
      iconColor: '#2563eb',
      Icon: MapPin,
      watermarkType: 'map',
    };
  }

  // 8. MD Stay
  if (nameLower.includes('stay')) {
    return {
      gradient: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 65%, #2563eb 100%)',
      iconColor: '#1d4ed8',
      Icon: Building2,
      watermarkType: 'building',
    };
  }

  // Global custom gradient fallback
  if (defaultWarna1 && defaultWarna2) {
    return {
      gradient: `linear-gradient(135deg, ${defaultWarna1} 0%, ${defaultWarna2} 100%)`,
      iconColor: defaultWarna1,
      Icon: FileSpreadsheet,
      watermarkType: 'spreadsheet',
    };
  }

  // Default vibrant blue-purple gradient
  return {
    gradient: 'linear-gradient(135deg, #1687e9 0%, #2c6dde 50%, #6849d9 100%)',
    iconColor: '#1687e9',
    Icon: FileSpreadsheet,
    watermarkType: 'spreadsheet',
  };
}

export default function CardGrid({ items, defaultWarna1, defaultWarna2 }: CardGridProps) {
  if (items.length === 0) {
    return (
      <div className="w-full bg-white/70 border border-white/90 rounded-2xl p-10 text-center text-slate-500 shadow-sm backdrop-blur-xs">
        <p className="text-base font-medium">Menu tidak ditemukan.</p>
        <p className="text-xs text-slate-400 mt-1">Coba kata kunci pencarian lain.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5 w-full">
      {items.map((item, index) => {
        const link = (item.link || '').trim();
        const isDisabled = !link || link === '#';
        const theme = getCardTheme(item, defaultWarna1, defaultWarna2);
        const { Icon, watermarkType } = theme;

        return (
          <a
            key={`${item.nama}-${index}`}
            href={isDisabled ? undefined : link}
            target={isDisabled ? undefined : '_blank'}
            rel={isDisabled ? undefined : 'noopener noreferrer'}
            style={{
              background: theme.gradient,
              animationDelay: `${index * 35}ms`,
            }}
            className={`group relative flex flex-col justify-between p-3.5 sm:p-4 md:p-5 rounded-2xl md:rounded-[22px] min-h-[160px] sm:min-h-[175px] md:min-h-[185px] shadow-md shadow-blue-900/10 transition-all duration-200 overflow-hidden select-none border border-white/20 ${
              isDisabled
                ? 'opacity-60 cursor-not-allowed grayscale-[20%]'
                : 'hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-900/20 active:translate-y-0 cursor-pointer'
            }`}
          >
            {/* Watermark Illustration in the upper-right corner */}
            <div className="absolute -top-1 -right-1 w-24 h-24 sm:w-28 sm:h-28 text-white opacity-[0.14] pointer-events-none transition-transform duration-300 group-hover:scale-110">
              {watermarkType === 'calendar' && (
                <Calendar className="w-full h-full stroke-[1.8]" />
              )}
              {watermarkType === 'megaphone' && (
                <Megaphone className="w-full h-full stroke-[1.8]" />
              )}
              {watermarkType === 'gift' && (
                <Gift className="w-full h-full stroke-[1.8]" />
              )}
              {watermarkType === 'store' && (
                <Store className="w-full h-full stroke-[1.8]" />
              )}
              {watermarkType === 'cart' && (
                <ShoppingCart className="w-full h-full stroke-[1.8]" />
              )}
              {watermarkType === 'users' && (
                <Users className="w-full h-full stroke-[1.8]" />
              )}
              {watermarkType === 'map' && (
                <MapPin className="w-full h-full stroke-[1.8]" />
              )}
              {watermarkType === 'building' && (
                <Building2 className="w-full h-full stroke-[1.8]" />
              )}
              {watermarkType === 'spreadsheet' && (
                <FileSpreadsheet className="w-full h-full stroke-[1.8]" />
              )}
            </div>

            {/* Top row: White circular Icon Badge */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full bg-white shadow-md flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
                <Icon
                  className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]"
                  style={{ color: theme.iconColor }}
                />
              </div>
            </div>

            {/* Middle/Bottom: Title & Description */}
            <div className="relative z-10 mt-3 sm:mt-4 pr-7 sm:pr-8">
              <h3 className="font-extrabold text-white text-xs sm:text-sm md:text-base leading-snug tracking-tight drop-shadow-xs line-clamp-2">
                {item.nama}
              </h3>
              <p className="text-white/85 text-[11px] sm:text-xs md:text-[13px] leading-tight font-normal mt-1 line-clamp-2 drop-shadow-xs">
                {isDisabled ? 'Belum tersedia' : item.deskripsi || 'Klik untuk membuka laporan'}
              </p>
            </div>

            {/* Bottom Right: Arrow Button */}
            <div className="absolute right-3 bottom-3 sm:right-3.5 sm:bottom-3.5 md:right-4 md:bottom-4 z-10">
              <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full bg-white/20 group-hover:bg-white/35 active:scale-90 text-white flex items-center justify-center transition-all duration-200 backdrop-blur-xs shadow-xs">
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5] transition-transform duration-200 group-hover:translate-x-0.5" />
              </div>
            </div>

            {/* Shine overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
          </a>
        );
      })}
    </div>
  );
}
