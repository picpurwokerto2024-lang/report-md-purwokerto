import { Bell, ArrowRight } from 'lucide-react';

interface NewsTickerProps {
  onOpenDetail: () => void;
  updateDate?: string;
}

export default function NewsTicker({ onOpenDetail, updateDate = '13 Okt 2026' }: NewsTickerProps) {
  return (
    <div className="w-full bg-white/90 border border-blue-100 rounded-2xl p-3 sm:p-3.5 shadow-sm shadow-blue-900/5 flex items-center justify-between gap-3 backdrop-blur-xs">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-50 border border-blue-200/60 flex items-center justify-center shrink-0 text-[#1565c0]">
          <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs sm:text-sm font-bold text-[#1244a5] leading-none truncate">
            Informasi Terbaru
          </h4>
          <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-1">
            Update data area Purwokerto - {updateDate}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenDetail}
        className="flex items-center gap-1 text-xs sm:text-sm font-bold text-[#176fd0] hover:text-[#0d47a1] shrink-0 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50 active:scale-95 cursor-pointer"
      >
        <span>Lihat Detail</span>
        <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
      </button>
    </div>
  );
}
