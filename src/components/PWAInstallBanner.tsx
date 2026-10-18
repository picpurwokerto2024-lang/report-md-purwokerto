import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallBannerProps {
  onOpenGuide: () => void;
}

export default function PWAInstallBanner({ onOpenGuide }: PWAInstallBannerProps) {
  const { isInstallable, isInstalled, isStandalone, install } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);

  // Check localStorage if user previously dismissed banner
  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    } catch {}
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('pwa_banner_dismissed', 'true');
    } catch {}
  };

  // If already installed and running in standalone, don't show the prompt
  if (isStandalone || isDismissed) {
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (!outcome) {
        onOpenGuide();
      }
    } else {
      onOpenGuide();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#07172E] via-[#0D2E63] to-[#175BB5] p-3 sm:p-3.5 text-white shadow-lg shadow-blue-950/20 border border-blue-400/30 transition-all animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Background ambient bubble */}
      <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-cyan-400/10 blur-xl pointer-events-none" />

      <div className="flex items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#07172E] border border-cyan-400/40 p-0.5 flex items-center justify-center shrink-0 shadow-md overflow-hidden">
            <img
              src="/pwa-192x192.png"
              alt="Report MD"
              className="w-full h-full object-cover rounded-lg"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-white tracking-tight">
                Instal Report MD di HP
              </span>
              <span className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-cyan-400/20 text-cyan-200 text-[10px] font-semibold border border-cyan-400/30">
                <Sparkles className="w-2.5 h-2.5 text-amber-300" /> Resmi Corporate
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-blue-100 truncate mt-0.5">
              Pasang ke layar beranda HP seperti aplikasi Play Store
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleAction}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-[#0d3480] font-black text-xs sm:text-xs shadow-md transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isInstallable ? 'Instal Sekarang' : 'Pasang di HP'}</span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            title="Sembunyikan"
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Tutup Banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
