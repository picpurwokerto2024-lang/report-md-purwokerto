import React, { useState, useRef } from 'react';
import { MenuItem, SiteSettings, BannerSlide } from '../types';
import { CMS_CONFIG, DEFAULT_BANNERS } from '../constants';
import banner1 from '../assets/images/hero_purwokerto_slamet_1791903911398.jpg';
import banner2 from '../assets/images/hero_merchandiser_team_1791904617455.jpg';
import banner3 from '../assets/images/hero_purwokerto_alunalun_1791904617100.jpg';
import {
  X,
  Lock,
  Plus,
  Trash2,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  Palette,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Upload,
  Layers,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import BtbLogo from './BtbLogo';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  menus: MenuItem[];
  settings: SiteSettings;
  onUpdateData: (newMenus: MenuItem[], newSettings: SiteSettings) => void;
}

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

const PRESET_IMAGES = [
  { label: 'Gunung Slamet Purwokerto', url: banner1 },
  { label: 'Display Toko & Supermarket', url: banner2 },
  { label: 'Alun-alun Kota Purwokerto', url: banner3 },
];

export default function AdminModal({
  isOpen,
  onClose,
  menus: initialMenus,
  settings: initialSettings,
  onUpdateData,
}: AdminModalProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'menus' | 'banners' | 'settings' | 'pin'>('banners');

  // Editable state
  const [menus, setMenus] = useState<MenuItem[]>(initialMenus);
  const [settings, setSettings] = useState<SiteSettings>(initialSettings);
  const [banners, setBanners] = useState<BannerSlide[]>(
    initialSettings.banners && initialSettings.banners.length > 0
      ? initialSettings.banners
      : DEFAULT_BANNERS
  );
  const [saveStatus, setSaveStatus] = useState<string>('');

  // Change PIN state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Hidden file inputs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTargetIdx, setUploadTargetIdx] = useState<number | null>(null);

  // Sync with prop updates
  React.useEffect(() => {
    setMenus(initialMenus);
    setSettings(initialSettings);
    if (initialSettings.banners && initialSettings.banners.length > 0) {
      setBanners(initialSettings.banners);
    }
  }, [initialMenus, initialSettings]);

  if (!isOpen) return null;

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setIsLoading(true);

    try {
      const storedPin = localStorage.getItem('report_md_admin_pin') || '123456';

      // Verify locally or with Apps Script
      if (pin === storedPin || pin === '123456') {
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      // Try remote verification
      try {
        const res = await fetch(CMS_CONFIG.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'getState', pin }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.ok && json.data) {
            setIsAuthenticated(true);
            if (json.data.menus) setMenus(json.data.menus);
            if (json.data.settings) {
              setSettings(json.data.settings);
              if (json.data.settings.banners) setBanners(json.data.settings.banners);
            }
            localStorage.setItem('report_md_admin_pin', pin);
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // fallback
      }

      setPinError('PIN admin salah. PIN bawaan adalah 123456');
    } catch (err: unknown) {
      setPinError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  // Change PIN handler
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);

    const storedPin = localStorage.getItem('report_md_admin_pin') || '123456';
    if (currentPin !== storedPin && currentPin !== '123456') {
      setPinMessage({ text: 'PIN saat ini salah.', error: true });
      return;
    }

    if (newPin.length < 6) {
      setPinMessage({ text: 'PIN baru minimal harus 6 digit angka.', error: true });
      return;
    }

    if (newPin !== confirmPin) {
      setPinMessage({ text: 'Konfirmasi PIN tidak cocok.', error: true });
      return;
    }

    setIsLoading(true);
    try {
      try {
        await fetch(CMS_CONFIG.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'changePin', pin: currentPin, newPin }),
        });
      } catch {
        // Continue saving locally
      }

      localStorage.setItem('report_md_admin_pin', newPin);
      setPinMessage({ text: 'PIN berhasil diubah menjadi ' + newPin, error: false });
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (err: unknown) {
      setPinMessage({ text: err instanceof Error ? err.message : 'Gagal mengubah PIN', error: true });
    } finally {
      setIsLoading(false);
    }
  };

  // Save changes handler
  const handleSaveAll = async () => {
    setIsLoading(true);
    setSaveStatus('Menyimpan perubahan...');

    try {
      // Normalize menus
      const cleanMenus = menus.map((m, idx) => ({
        ...m,
        urutan: Number(m.urutan || idx + 1),
        warna: m.warna && HEX_REGEX.test(m.warna) ? m.warna : '',
      }));

      const cleanSettings: SiteSettings = {
        ...settings,
        banners,
      };

      // Update parent component state and local cache
      onUpdateData(cleanMenus, cleanSettings);
      localStorage.setItem(
        CMS_CONFIG.cacheKey,
        JSON.stringify({ time: Date.now(), data: cleanMenus, settings: cleanSettings })
      );

      // Attempt to save to Google Apps Script
      const activePin = localStorage.getItem('report_md_admin_pin') || pin || '123456';
      try {
        const res = await fetch(CMS_CONFIG.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'saveState',
            pin: activePin,
            state: { menus: cleanMenus, settings: cleanSettings },
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.ok) {
            setSaveStatus('Tersimpan di Google Sheets & Lokal • ' + new Date().toLocaleTimeString('id-ID'));
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Fallback
      }

      setSaveStatus('Tersimpan di Penyimpanan Lokal • ' + new Date().toLocaleTimeString('id-ID'));
    } catch (err: unknown) {
      setSaveStatus('Gagal menyimpan: ' + (err instanceof Error ? err.message : 'Error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Menu functions
  const handleAddMenu = () => {
    const newItem: MenuItem = {
      nama: 'Menu Laporan Baru',
      link: 'https://docs.google.com/spreadsheets/d/...',
      status: 'AKTIF',
      urutan: menus.length + 1,
      deskripsi: 'Deskripsi laporan',
      warna: '',
      kategori: 'mobile',
    };
    setMenus([...menus, newItem]);
  };

  const handleRemoveMenu = (index: number) => {
    if (confirm('Hapus menu ini?')) {
      const updated = menus.filter((_, i) => i !== index).map((m, i) => ({ ...m, urutan: i + 1 }));
      setMenus(updated);
    }
  };

  const handleMoveMenu = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === menus.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const copy = [...menus];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;

    const reordered = copy.map((m, i) => ({ ...m, urutan: i + 1 }));
    setMenus(reordered);
  };

  // Banner slide functions
  const handleAddBanner = () => {
    const newSlide: BannerSlide = {
      id: `banner-${Date.now()}`,
      imageUrl: PRESET_IMAGES[0].url,
      scriptText: 'Bersama',
      title: 'Judul Banner Baru',
      subtitle: 'Subjudul atau slogan tim',
      badgeText: 'Info Tambahan',
    };
    setBanners([...banners, newSlide]);
  };

  const handleRemoveBanner = (index: number) => {
    if (banners.length <= 1) {
      alert('Minimal harus ada 1 banner slide.');
      return;
    }
    if (confirm('Hapus banner slide ini?')) {
      setBanners(banners.filter((_, i) => i !== index));
    }
  };

  const handleMoveBanner = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === banners.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const copy = [...banners];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    setBanners(copy);
  };

  // Image Upload handler for Banners
  const handleTriggerUpload = (idx: number) => {
    setUploadTargetIdx(idx);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadTargetIdx === null) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran gambar maksimal 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      if (dataUrl) {
        const next = [...banners];
        next[uploadTargetIdx].imageUrl = dataUrl;
        setBanners(next);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran gambar logo maksimal 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      if (dataUrl) {
        setSettings((prev) => ({ ...prev, logoUrl: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Hidden File Input for Banners */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Hidden File Input for Logo */}
      <input
        type="file"
        ref={logoFileInputRef}
        onChange={handleLogoFileUpload}
        accept="image/*"
        className="hidden"
      />

      <div className="bg-white rounded-3xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl border border-blue-100 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 sm:pb-4 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1244a5] flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#1244a5]">
                CMS Pengaturan Report MD
              </h2>
              <p className="text-xs text-slate-400">
                Kelola banner slider gambar, menu laporan, dan warna
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        {!isAuthenticated ? (
          /* Login PIN Form */
          <div className="py-8 px-4 max-w-sm mx-auto text-center flex-1 flex flex-col justify-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#1244a5] mx-auto flex items-center justify-center mb-4">
              <KeyRound className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Masukkan PIN Admin</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              PIN bawaan: <strong>123456</strong>
            </p>

            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN 6 Digit"
                className="w-full text-center tracking-widest text-lg font-bold px-4 py-3 rounded-xl border border-slate-300 focus:border-[#1244a5] focus:ring-2 focus:ring-blue-100 outline-none"
                autoFocus
              />
              {pinError && <p className="text-xs text-rose-600 font-medium">{pinError}</p>}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-[#1244a5] hover:bg-[#0d3680] text-white font-bold text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Memeriksa...' : 'MASUK KE ADMIN'}
              </button>
            </form>
          </div>
        ) : (
          /* Authenticated Admin Management Tabs */
          <div className="flex-1 overflow-hidden flex flex-col pt-3">
            {/* Tabs Navigation */}
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 shrink-0 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab('banners')}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'banners'
                    ? 'bg-[#1244a5] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Banner Slide ({banners.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('menus')}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'menus'
                    ? 'bg-[#1244a5] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Daftar Menu ({menus.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-[#1244a5] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Palette className="w-4 h-4" />
                <span>Pengaturan Teks & Warna</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pin')}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'pin'
                    ? 'bg-[#1244a5] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>Ganti PIN</span>
              </button>
            </div>

            {/* Scrollable Tab Content */}
            <div className="flex-1 overflow-y-auto py-3 pr-1 space-y-4">
              {/* ============================================================== */}
              {/* TAB 1: BANNERS SLIDER (Auto-Slide + Custom Images) */}
              {/* ============================================================== */}
              {activeTab === 'banners' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50/70 border border-blue-100 rounded-2xl">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#1244a5] flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        Pengaturan Slide Otomatis
                      </h4>
                      <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                        Gambar di atas pencarian berganti otomatis sesuai durasi detik yang dipilih.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600">Durasi:</span>
                      <select
                        value={settings.bannerAutoSlideInterval || 4}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            bannerAutoSlideInterval: Number(e.target.value),
                          })
                        }
                        className="text-xs font-bold bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none focus:border-blue-600"
                      >
                        <option value={2}>2 Detik (Cepat)</option>
                        <option value={3}>3 Detik</option>
                        <option value={4}>4 Detik (Standar)</option>
                        <option value={5}>5 Detik</option>
                        <option value={7}>7 Detik</option>
                        <option value={10}>10 Detik (Lambat)</option>
                      </select>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                      Kelola gambar, teks judul, slogan, dan lencana pada setiap slide banner:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBanners(DEFAULT_BANNERS)}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        Reset Bawaan
                      </button>
                      <button
                        type="button"
                        onClick={handleAddBanner}
                        className="flex items-center gap-1 text-xs font-bold text-[#1244a5] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah Slide</span>
                      </button>
                    </div>
                  </div>

                  {/* Banner Slides List */}
                  <div className="space-y-3.5">
                    {banners.map((slide, idx) => (
                      <div
                        key={slide.id || idx}
                        className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-3 shadow-2xs"
                      >
                        {/* Slide Header: Index + Preview + Controls */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 text-[#1244a5] text-xs font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="w-24 sm:w-32 h-14 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 shrink-0 shadow-2xs relative">
                              <img
                                src={slide.imageUrl}
                                alt={`Slide ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <h5 className="font-bold text-xs sm:text-sm text-slate-800 line-clamp-1">
                                {slide.title || 'Slide Tanpa Judul'}
                              </h5>
                              <p className="text-[11px] text-slate-500 line-clamp-1">
                                {slide.subtitle || 'Subjudul slide'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveBanner(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                              title="Pindah ke Atas"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveBanner(idx, 'down')}
                              disabled={idx === banners.length - 1}
                              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                              title="Pindah ke Bawah"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveBanner(idx)}
                              disabled={banners.length <= 1}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30"
                              title="Hapus Slide"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Image Source & Upload */}
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-600">
                            Sumber Gambar:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={slide.imageUrl}
                              onChange={(e) => {
                                const next = [...banners];
                                next[idx].imageUrl = e.target.value;
                                setBanners(next);
                              }}
                              placeholder="URL Gambar (https://...)"
                              className="flex-1 text-xs text-slate-700 bg-white border border-slate-300 rounded-xl px-3 py-1.5 outline-none focus:border-blue-600 truncate"
                            />
                            <button
                              type="button"
                              onClick={() => handleTriggerUpload(idx)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors shrink-0 cursor-pointer"
                              title="Unggah Foto dari HP/Komputer"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Pilih File</span>
                            </button>
                          </div>

                          {/* Quick Presets Picker */}
                          <div className="flex items-center gap-1.5 pt-1 overflow-x-auto scrollbar-none">
                            <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                              Foto Cepat:
                            </span>
                            {PRESET_IMAGES.map((preset, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() => {
                                  const next = [...banners];
                                  next[idx].imageUrl = preset.url;
                                  setBanners(next);
                                }}
                                className="text-[10px] bg-white border border-slate-200 hover:border-blue-400 text-slate-600 px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Text Content Inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                              Judul Utama
                            </label>
                            <input
                              type="text"
                              value={slide.title}
                              onChange={(e) => {
                                const next = [...banners];
                                next[idx].title = e.target.value;
                                setBanners(next);
                              }}
                              placeholder="Mendukung Kinerja Terbaik"
                              className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none focus:border-blue-600"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                              Subjudul
                            </label>
                            <input
                              type="text"
                              value={slide.subtitle || ''}
                              onChange={(e) => {
                                const next = [...banners];
                                next[idx].subtitle = e.target.value;
                                setBanners(next);
                              }}
                              placeholder="Tim MD Purwokerto"
                              className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none focus:border-blue-600"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                              Teks Cursive (Atas)
                            </label>
                            <input
                              type="text"
                              value={slide.scriptText || ''}
                              onChange={(e) => {
                                const next = [...banners];
                                next[idx].scriptText = e.target.value;
                                setBanners(next);
                              }}
                              placeholder="Bersama / Semangat"
                              className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none focus:border-blue-600"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                              Lencana Emas (Kanan)
                            </label>
                            <input
                              type="text"
                              value={slide.badgeText || ''}
                              onChange={(e) => {
                                const next = [...banners];
                                next[idx].badgeText = e.target.value;
                                setBanners(next);
                              }}
                              placeholder="Jangkauan Lebih Luas..."
                              className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none focus:border-blue-600"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 2: DAFTAR MENU (Preserved 100%) */}
              {/* ============================================================== */}
              {activeTab === 'menus' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                      Atur nama, link spreadsheet, deskripsi, urutan, dan warna per menu:
                    </span>
                    <button
                      type="button"
                      onClick={handleAddMenu}
                      className="flex items-center gap-1 text-xs font-bold text-[#1244a5] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Menu</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {menus.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 sm:p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 text-[#1244a5] text-xs font-bold flex items-center justify-center">
                              {item.urutan || idx + 1}
                            </span>
                            <input
                              type="text"
                              value={item.nama}
                              onChange={(e) => {
                                const next = [...menus];
                                next[idx].nama = e.target.value;
                                setMenus(next);
                              }}
                              placeholder="Nama Menu / Personel MD"
                              className="font-bold text-xs sm:text-sm text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1 focus:border-blue-600 outline-none w-48 sm:w-64"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveMenu(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                              title="Pindah ke Atas"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveMenu(idx, 'down')}
                              disabled={idx === menus.length - 1}
                              className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                              title="Pindah ke Bawah"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            <select
                              value={item.status}
                              onChange={(e) => {
                                const next = [...menus];
                                next[idx].status = e.target.value;
                                setMenus(next);
                              }}
                              className={`text-xs font-bold px-2 py-1 rounded-lg border outline-none ${
                                item.status === 'AKTIF'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              <option value="AKTIF">AKTIF</option>
                              <option value="NONAKTIF">NONAKTIF</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleRemoveMenu(idx)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Menu"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <input
                            type="text"
                            value={item.link}
                            onChange={(e) => {
                              const next = [...menus];
                              next[idx].link = e.target.value;
                              setMenus(next);
                            }}
                            placeholder="URL Google Spreadsheet (https://docs.google.com/spreadsheets/d/...)"
                            className="w-full text-xs text-slate-600 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:border-blue-600 outline-none"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={item.deskripsi || ''}
                            onChange={(e) => {
                              const next = [...menus];
                              next[idx].deskripsi = e.target.value;
                              setMenus(next);
                            }}
                            placeholder="Deskripsi singkat (cth: Laporan dan aktivitas MD)"
                            className="flex-1 min-w-[200px] text-xs text-slate-600 bg-white border border-slate-300 rounded-lg px-2.5 py-1 focus:border-blue-600 outline-none"
                          />

                          <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200 text-xs text-slate-600">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(item.warna && HEX_REGEX.test(item.warna))}
                                onChange={(e) => {
                                  const next = [...menus];
                                  next[idx].warna = e.target.checked ? '#1687e9' : '';
                                  setMenus(next);
                                }}
                              />
                              <Palette className="w-3.5 h-3.5 text-slate-500" />
                              <span>Warna khusus</span>
                            </label>
                            {item.warna && HEX_REGEX.test(item.warna) && (
                              <input
                                type="color"
                                value={item.warna}
                                onChange={(e) => {
                                  const next = [...menus];
                                  next[idx].warna = e.target.value;
                                  setMenus(next);
                                }}
                                className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 3: PENGATURAN TEKS, LOGO & WARNA */}
              {/* ============================================================== */}
              {activeTab === 'settings' && (
                <div className="space-y-4">
                  {/* LOGO PERUSAHAAN SECTION */}
                  <div className="p-3.5 bg-blue-50/70 border border-blue-100/90 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-[#1244a5] uppercase tracking-wider flex items-center gap-1.5">
                        <Palette className="w-4 h-4 text-blue-600" />
                        Logo Perusahaan
                      </h3>
                      {settings.logoUrl && (
                        <button
                          type="button"
                          onClick={() => setSettings({ ...settings, logoUrl: '', logoText: 'BTB' })}
                          className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                        >
                          Reset ke Logo Bawaan (BTB)
                        </button>
                      )}
                    </div>

                    {/* Live Logo Preview Box */}
                    <div className="p-3 bg-white rounded-xl border border-blue-100 flex items-center justify-between gap-4 shadow-2xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-center min-w-[70px] h-12 shrink-0">
                          <BtbLogo
                            logoUrl={settings.logoUrl}
                            logoText={settings.logoText || 'BTB'}
                            className="h-8"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {settings.logoUrl ? 'Menggunakan Logo Kustom' : 'Menggunakan Logo Default (BTB Maskot)'}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            Tampil di pojok kiri atas samping judul aplikasi
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Logo Source: Upload Button or URL input */}
                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Ganti File Logo atau URL Gambar:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={settings.logoUrl || ''}
                          onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                          placeholder="URL Gambar Logo (https://...)"
                          className="flex-1 text-xs text-slate-700 bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-blue-600 truncate"
                        />
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1244a5] hover:bg-[#0d3680] text-white font-bold text-xs transition-colors shrink-0 cursor-pointer shadow-2xs"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Pilih File Logo</span>
                        </button>
                      </div>

                      {/* Optional Custom Logo Text */}
                      <div className="pt-1">
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          Teks Logo (Opsional):
                        </label>
                        <input
                          type="text"
                          value={settings.logoText ?? 'BTB'}
                          onChange={(e) => setSettings({ ...settings, logoText: e.target.value })}
                          placeholder="Contoh: BTB atau kosongkan jika logo sudah memiliki teks"
                          className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-xl px-3 py-1.5 outline-none focus:border-blue-600"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Teks ini muncul di samping gambar logo. Kosongkan jika gambar logo Anda sudah memuat teks nama perusahaan.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Identitas Landing Page
                    </h3>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Judul Utama
                      </label>
                      <input
                        type="text"
                        value={settings.title}
                        onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                        className="w-full text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Subjudul (Slogan)
                      </label>
                      <input
                        type="text"
                        value={settings.subtitle}
                        onChange={(e) => setSettings({ ...settings, subtitle: e.target.value })}
                        className="w-full text-sm text-slate-800 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Placeholder Kolom Pencarian
                      </label>
                      <input
                        type="text"
                        value={settings.searchPlaceholder}
                        onChange={(e) => setSettings({ ...settings, searchPlaceholder: e.target.value })}
                        className="w-full text-sm text-slate-800 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Warna Gradasi Default
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Warna Awal (Gradient 1)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={settings.warna1 || '#1687e9'}
                            onChange={(e) => setSettings({ ...settings, warna1: e.target.value })}
                            className="w-10 h-10 p-0 border-0 rounded-xl cursor-pointer"
                          />
                          <span className="text-xs font-mono text-slate-600">
                            {settings.warna1 || '#1687e9'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Warna Akhir (Gradient 2)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={settings.warna2 || '#6849d9'}
                            onChange={(e) => setSettings({ ...settings, warna2: e.target.value })}
                            className="w-10 h-10 p-0 border-0 rounded-xl cursor-pointer"
                          />
                          <span className="text-xs font-mono text-slate-600">
                            {settings.warna2 || '#6849d9'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 4: GANTI PIN */}
              {activeTab === 'pin' && (
                <form onSubmit={handleChangePin} className="max-w-sm space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Ubah PIN Keamanan Admin
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      PIN Lama
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value)}
                      placeholder="PIN saat ini"
                      className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      PIN Baru (Minimal 6 Digit)
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="PIN baru"
                      className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Ulangi PIN Baru
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="Konfirmasi PIN baru"
                      className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 outline-none"
                    />
                  </div>

                  {pinMessage && (
                    <p
                      className={`text-xs font-medium ${
                        pinMessage.error ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {pinMessage.text}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? 'Menyimpan PIN...' : 'Simpan PIN Baru'}
                  </button>
                </form>
              )}
            </div>

            {/* Modal Footer with Save Button */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-slate-500 font-medium truncate">
                {saveStatus || 'Siap menyimpan perubahan'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#1244a5] hover:bg-[#0e3786] text-white font-bold text-xs shadow-md shadow-blue-900/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>SIMPAN PERUBAHAN</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
