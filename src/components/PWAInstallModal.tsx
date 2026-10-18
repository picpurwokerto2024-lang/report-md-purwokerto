import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  Share2,
  PlusSquare,
  CheckCircle2,
  X,
  Zap,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PWAInstallModal({ isOpen, onClose }: PWAInstallModalProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'android' | 'ios'>(isIOS ? 'ios' : 'android');
  const [installSuccess, setInstallSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setInstallSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2500);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-blue-100 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with App Branding */}
        <div className="relative bg-gradient-to-r from-[#07172E] via-[#0D2E63] to-[#175BB5] p-5 text-white border-b border-blue-400/20">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5 pr-8">
            <div className="w-13 h-13 rounded-2xl bg-[#07172E] p-1 shadow-lg border border-cyan-400/30 shrink-0 flex items-center justify-center overflow-hidden">
              <img
                src="/pwa-192x192.png"
                alt="Report MD Purwokerto"
                className="w-full h-full object-cover rounded-xl"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider text-amber-200 mb-0.5">
                <Sparkles className="w-3 h-3" /> PWA Mobile App
              </div>
              <h2 className="text-lg sm:text-xl font-black leading-tight tracking-tight">
                Instal Report MD di HP
              </h2>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                Pasang ke Layar Utama layaknya aplikasi asli
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Quick Direct Install Button if supported by browser */}
          {isInstallable && !installSuccess && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-4 text-center">
              <p className="text-xs font-semibold text-blue-900 mb-2.5">
                Browser Anda mendukung instalasi instan 1-klik:
              </p>
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#1244a5] to-[#1976D2] hover:from-[#0d3480] hover:to-[#1565C0] text-white font-bold text-sm shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Instal Aplikasi Sekarang (1-Klik)
              </button>
            </div>
          )}

          {installSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center text-emerald-800">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-1.5" />
              <h4 className="font-bold text-sm">Instalasi Berhasil Dimulai!</h4>
              <p className="text-xs text-emerald-700 mt-1">
                Ikon Report MD sedang ditambahkan ke layar beranda HP Anda.
              </p>
            </div>
          )}

          {/* OS Switcher Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setActiveTab('android')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'android'
                  ? 'bg-white text-[#1244a5] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              Android (Chrome)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ios')}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'ios'
                  ? 'bg-white text-[#1244a5] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Share2 className="w-4 h-4" />
              iPhone / iPad (Safari)
            </button>
          </div>

          {/* Tab 1: Android Instructions */}
          {activeTab === 'android' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="w-6 h-6 rounded-full bg-[#1244a5] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Buka di Google Chrome</p>
                  <p className="text-slate-500 mt-0.5">
                    Buka tautan web ini melalui browser Google Chrome di HP Anda.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="w-6 h-6 rounded-full bg-[#1244a5] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Tekan Menu Titik Tiga (⋮)</p>
                  <p className="text-slate-500 mt-0.5">
                    Ketuk ikon tiga titik di pojok kanan atas layar browser Chrome.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="w-6 h-6 rounded-full bg-[#1244a5] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div className="text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Pilih "Instal aplikasi" / "Tambahkan ke Layar Utama"</p>
                  <p className="text-slate-500 mt-0.5">
                    Klik <strong>Instal</strong> atau <strong>Add to Home screen</strong>. Ikon Report MD akan muncul otomatis di layar HP Anda!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: iPhone / Safari Instructions */}
          {activeTab === 'ios' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="w-6 h-6 rounded-full bg-[#1244a5] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Buka link di Safari</p>
                  <p className="text-slate-500 mt-0.5">
                    Pastikan Anda membuka website menggunakan browser bawaan <strong>Safari</strong> di iPhone.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="w-6 h-6 rounded-full bg-[#1244a5] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Ketuk Tombol Share (Bagikan)</p>
                  <p className="text-slate-500 mt-0.5 flex items-center gap-1.5">
                    Ikon kotak berpanah ke atas <Share2 className="w-3.5 h-3.5 text-blue-600 inline" /> di bilah navigasi bawah Safari.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="w-6 h-6 rounded-full bg-[#1244a5] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div className="text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Pilih "Tambah ke Layar Utama"</p>
                  <p className="text-slate-500 mt-0.5 flex items-center gap-1.5">
                    Scroll ke bawah, pilih <PlusSquare className="w-3.5 h-3.5 text-slate-700 inline" /> <strong>Add to Home Screen</strong>, lalu klik <strong>Tambah</strong> di pojok kanan atas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Key Advantages Checklist */}
          <div className="bg-blue-50/70 rounded-2xl p-3.5 border border-blue-100 text-[11px] text-[#1244a5] space-y-2">
            <div className="font-bold text-xs flex items-center gap-1.5 text-[#1244a5]">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              Keunggulan Setelah Terinstal:
            </div>
            <ul className="grid grid-cols-2 gap-2 text-slate-700">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Layar penuh (tanpa bar URL)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Buka instan dari ikon HP</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Ringan & hemat kuota</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Otomatis sinkron data</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500 font-medium">
            Tanpa perlu download APK manual
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
          >
            Mengerti & Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
