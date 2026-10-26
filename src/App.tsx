import { useState, useEffect, useMemo, useRef } from 'react';
import { MenuItem, SiteSettings, ActiveTab } from './types';
import { CMS_CONFIG, DEFAULT_SETTINGS, INITIAL_MENUS, DEFAULT_BANNERS } from './constants';
import BtbLogo from './components/BtbLogo';
import HeroBanner from './components/HeroBanner';
import CardGrid from './components/CardGrid';
import NewsTicker from './components/NewsTicker';
import BottomNav from './components/BottomNav';
import DetailModal from './components/DetailModal';
import AdminModal from './components/AdminModal';
import PWAInstallModal from './components/PWAInstallModal';
import PWAInstallBanner from './components/PWAInstallBanner';
import OfflineIndicator from './components/OfflineIndicator';
import { usePWAInstall } from './hooks/usePWAInstall';
import { Search, SlidersHorizontal, RefreshCw, Clock, Smartphone, Download, Sparkles, X } from 'lucide-react';

export default function App() {
  const [menus, setMenus] = useState<MenuItem[]>(INITIAL_MENUS);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [cmsStatus, setCmsStatus] = useState<{ text: string; state: 'ok' | 'loading' | 'offline' }>({
    text: 'Memuat data...',
    state: 'loading',
  });
  
  // Real-time ticking live clock (updates every 1 second)
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  // Last data synchronization timestamp
  const [lastSyncDate, setLastSyncDate] = useState<Date>(new Date());

  // Interactive filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  // Modals & Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('beranda');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // PWA Install State & Detection
  const { isStandalone, isInstallable, install } = usePWAInstall();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  // Live ticking clock effect (runs every 1000ms)
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Concurrency guard and failure counters for network resilience on cellular data
  const isFetchingRef = useRef(false);
  const failCountRef = useRef(0);

  // Load CMS Data from Google Apps Script with dual-transport (Fetch + JSONP) & smart cache retention
  const loadCMS = async (force = false) => {
    // Prevent overlapping requests that choke mobile/cellular connections
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!force) setIsRefreshing(true);

    try {
      // 1. Immediately read cache first if available so UI is instantly responsive
      if (!force) {
        const cached = localStorage.getItem(CMS_CONFIG.cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
              setMenus(parsed.data);
              if (parsed.settings) setSettings((prev) => ({ ...prev, ...parsed.settings }));
              if (parsed.time) setLastSyncDate(new Date(parsed.time));
              setCmsStatus({ text: 'CMS Aktif', state: 'ok' });
            }
          } catch {}
        }
      }

      // 2. Check if device is explicitly offline
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setCmsStatus({ text: 'Mode Offline (Lokal)', state: 'offline' });
        return;
      }

      // 3. Resilient Fetch: Primary fetch with timeout, followed by JSONP fallback for strict mobile ISPs
      let json: any = null;

      // Strategy A: Modern fetch with follow redirect & 16s AbortController
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 16000);
        const res = await fetch(`${CMS_CONFIG.apiUrl}?action=public&t=${Date.now()}`, {
          cache: 'no-store',
          mode: 'cors',
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          json = await res.json();
        }
      } catch {
        // Fetch failed (network drop or cellular ISP CORS restriction); proceed to fallback
      }

      // Strategy B: JSONP Fallback (works across all cellular data providers & proxy filters)
      if (!json || !json.ok) {
        try {
          json = await new Promise((resolve, reject) => {
            const callbackName = `_gas_cb_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            const script = document.createElement('script');
            let timer: any = null;

            (window as any)[callbackName] = (data: any) => {
              cleanup();
              if (data && data.ok) resolve(data);
              else reject(new Error(data?.message || 'JSONP error'));
            };

            const cleanup = () => {
              if (timer) clearTimeout(timer);
              delete (window as any)[callbackName];
              if (script.parentNode) script.parentNode.removeChild(script);
            };

            timer = setTimeout(() => {
              cleanup();
              reject(new Error('Timeout koneksi seluler'));
            }, 18000);

            script.onerror = () => {
              cleanup();
              reject(new Error('Gagal memuat skrip JSONP'));
            };

            script.src = `${CMS_CONFIG.apiUrl}?action=public&callback=${callbackName}&t=${Date.now()}`;
            document.head.appendChild(script);
          });
        } catch {
          // Both strategies attempted
        }
      }

      // 4. Process successful response
      if (json && json.ok && Array.isArray(json.menus) && json.menus.length > 0) {
        failCountRef.current = 0; // Reset consecutive failures
        const normalized = json.menus.map((m: MenuItem, idx: number) => ({
          nama: m.nama || 'Laporan MD',
          link: m.link || '#',
          status: m.status || 'AKTIF',
          urutan: Number(m.urutan || idx + 1),
          deskripsi: m.deskripsi || '',
          warna: m.warna || '',
          fotoUrl: m.fotoUrl ? String(m.fotoUrl).trim() : '',
        }));

        setMenus(normalized);
        if (json.settings) {
          setSettings((prev) => ({
            ...prev,
            ...json.settings,
            banners:
              json.settings.banners && Array.isArray(json.settings.banners) && json.settings.banners.length > 0
                ? json.settings.banners
                : prev.banners && prev.banners.length > 0
                ? prev.banners
                : DEFAULT_BANNERS,
          }));
        }

        const now = new Date();
        setLastSyncDate(now);

        localStorage.setItem(
          CMS_CONFIG.cacheKey,
          JSON.stringify({
            time: now.getTime(),
            data: normalized,
            settings: json.settings || {},
          })
        );
        setCmsStatus({ text: 'CMS Aktif', state: 'ok' });
      } else {
        throw new Error(json?.message || 'Format respon tidak sesuai');
      }
    } catch {
      failCountRef.current += 1;
      // If we already have cached data, do NOT alarm the user by turning status offline on temporary mobile glitches
      const hasCached = !!localStorage.getItem(CMS_CONFIG.cacheKey);
      if (hasCached && failCountRef.current < 4) {
        // Keep status as active since local data is completely usable
        setCmsStatus({ text: 'CMS Aktif', state: 'ok' });
      } else {
        setCmsStatus({ text: 'Mode Cadangan', state: 'offline' });
      }
    } finally {
      isFetchingRef.current = false;
      setIsRefreshing(false);
    }
  };

  const isAdminOpenRef = useRef(isAdminOpen);
  useEffect(() => {
    isAdminOpenRef.current = isAdminOpen;
  }, [isAdminOpen]);

  // Initial load and Realtime Auto-Sync across all devices (WiFi & Mobile Data)
  useEffect(() => {
    // 1. Initial fetch
    loadCMS();

    // 2. Realtime Polling: Check server every 25 seconds (friendly for cellular data, prevents rate-limits)
    const interval = setInterval(() => {
      if (!isAdminOpenRef.current && !document.hidden) {
        loadCMS(true);
      }
    }, 25000);

    // 3. Sync immediately when user switches back to tab or unlocks phone
    const handleVisibilityChange = () => {
      if (!document.hidden && !isAdminOpenRef.current) {
        loadCMS(true);
      }
    };
    const handleFocus = () => {
      if (!isAdminOpenRef.current) loadCMS(true);
    };

    // 4. Sync immediately when network reconnects (e.g. WiFi <-> Cellular switch)
    const handleOnline = () => {
      loadCMS(true);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 5. Instant cross-tab sync via BroadcastChannel
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('report_md_sync_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'SYNC_DATA') {
          if (event.data.menus) setMenus(event.data.menus);
          if (event.data.settings) setSettings(event.data.settings);
          setLastSyncDate(new Date());
          setCmsStatus({ text: 'CMS Aktif', state: 'ok' });
        }
      };
    } catch {}

    // 6. Instant cross-tab sync via storage event fallback
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CMS_CONFIG.cacheKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.data && Array.isArray(parsed.data)) setMenus(parsed.data);
          if (parsed.settings) setSettings((prev) => ({ ...prev, ...parsed.settings }));
          setLastSyncDate(new Date());
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorage);
      if (channel) channel.close();
    };
  }, []);

  // Filtered menu items
  const filteredMenus = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return menus
      .filter((item) => String(item.status || 'AKTIF').toUpperCase() === 'AKTIF')
      .filter((item) => {
        // Search query filter
        const matchName = (item.nama || '').toLowerCase().includes(q);
        const matchDesc = (item.deskripsi || '').toLowerCase().includes(q);
        if (q && !matchName && !matchDesc) return false;

        // Category filter
        if (selectedCategory === 'all') return true;
        const nameLower = (item.nama || '').toLowerCase();
        if (selectedCategory === 'jadwal') return nameLower.includes('jadwal');
        if (selectedCategory === 'promo') return nameLower.includes('promo');
        if (selectedCategory === 'pasar') return nameLower.includes('pasar');
        if (selectedCategory === 'mobile') return nameLower.includes('mobile');
        if (selectedCategory === 'stay') return nameLower.includes('stay');

        return true;
      })
      .sort((a, b) => Number(a.urutan || 999) - Number(b.urutan || 999));
  }, [menus, searchQuery, selectedCategory]);

  // Handle Tab Switch
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'pengaturan') {
      setIsAdminOpen(true);
    } else if (tab === 'menu') {
      setShowCategoryFilter(true);
      window.scrollTo({ top: 320, behavior: 'smooth' });
    } else {
      setSelectedCategory('all');
      setShowCategoryFilter(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Data update from Admin modal
  const handleUpdateFromAdmin = (newMenus: MenuItem[], newSettings: SiteSettings) => {
    setMenus(newMenus);
    setSettings(newSettings);
    setCmsStatus({ text: 'CMS Diperbarui', state: 'ok' });
    setLastSyncDate(new Date());
  };

  // Format live clock (hours, minutes, seconds) - updates every second
  const formattedClock = useMemo(() => {
    return (
      currentTime.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + ' WIB'
    );
  }, [currentTime]);

  const formattedDate = useMemo(() => {
    return currentTime.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [currentTime]);

  // Format sync timestamp relative / absolute
  const syncLabel = useMemo(() => {
    const diffSec = Math.floor((currentTime.getTime() - lastSyncDate.getTime()) / 1000);
    if (diffSec < 15) return 'Baru saja';
    if (diffSec < 60) return `${diffSec} dtk lalu`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} mnt lalu`;
    return lastSyncDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  }, [currentTime, lastSyncDate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0f7fd] via-[#eaf4fd] to-[#dff0fc] text-[#163f73] pb-24 relative overflow-x-hidden">
      {/* Background radial accent bubbles for depth */}
      <div className="fixed -top-32 -right-32 w-96 h-96 rounded-full bg-blue-300/20 blur-3xl pointer-events-none" />
      <div className="fixed top-1/2 -left-40 w-96 h-96 rounded-full bg-indigo-200/20 blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-[920px] mx-auto px-3.5 sm:px-5 md:px-6 pt-3 sm:pt-5 space-y-2.5 sm:space-y-3.5">
        {/* ============================================================== */}
        {/* 1. BRAND HEADER (Matching screenshot logo, title & CMS badge) */}
        {/* ============================================================== */}
        <header className="flex items-center justify-between gap-3 pt-1 pb-1">
          {/* Left: Logo BTB + Title Lockup */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            {/* Mascot & BTB Branding / Custom Logo */}
            <BtbLogo
              className="h-9 sm:h-11 md:h-12"
              logoUrl={settings.logoUrl}
              logoText={settings.logoText}
            />

            {/* Vertical Blue Separator Line */}
            <div className="h-9 sm:h-11 w-[2.5px] bg-[#164fc1] rounded-full shrink-0" />

            {/* Title & Subtitle */}
            <div className="min-w-0">
              <h1 className="font-black text-[#1244a5] text-base sm:text-lg md:text-xl lg:text-2xl tracking-tight leading-none uppercase truncate">
                {settings.title || 'REPORT MD PURWOKERTO'}
              </h1>
              <p className="text-[#31557e] text-[11px] sm:text-xs md:text-sm font-semibold tracking-wide leading-tight mt-1 truncate">
                {settings.subtitle || 'KAO Peduli Inovasi'}
              </p>
            </div>
          </div>

          {/* Right: CMS Status Badge, Manual Refresh, Install PWA & Real-time Live Clock */}
          <div className="flex flex-col items-end shrink-0 text-right">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {!isStandalone && (
                <button
                  type="button"
                  onClick={() => setIsInstallModalOpen(true)}
                  title="Instal aplikasi ke Layar Utama HP"
                  className="flex items-center gap-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-white font-bold px-2 py-0.5 rounded-full text-[10px] sm:text-xs shadow-2xs transition-all cursor-pointer"
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Pasang di HP</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => loadCMS(true)}
                title="Klik untuk segarkan data dari server"
                className={`p-1 sm:p-1.5 rounded-full text-blue-700 bg-blue-100/70 hover:bg-blue-200 transition-all cursor-pointer shadow-2xs ${
                  isRefreshing ? 'animate-spin text-blue-600' : 'hover:rotate-45'
                }`}
              >
                <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>

              <div className="flex items-center gap-1.5 bg-emerald-50/90 text-emerald-800 border border-emerald-200/70 px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold shadow-2xs backdrop-blur-xs">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    cmsStatus.state === 'ok'
                      ? 'bg-emerald-500 animate-pulse'
                      : cmsStatus.state === 'loading'
                      ? 'bg-amber-500 animate-spin'
                      : 'bg-slate-400'
                  }`}
                />
                <span>{cmsStatus.text}</span>
              </div>
            </div>

            {/* Jam Digital Real-time (Berjalan aktif setiap detik) */}
            <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs font-mono font-bold text-slate-800 bg-white/80 border border-blue-200/60 px-2 py-0.5 rounded-md shadow-2xs">
              <Clock className="w-3 h-3 text-[#1244a5] shrink-0" />
              <span>{formattedClock}</span>
            </div>

            {/* Keterangan Sinkronisasi */}
            <span className="text-[9px] sm:text-[10px] text-slate-500 font-medium mt-0.5">
              {isRefreshing ? 'Menyinkronkan...' : `Sinkron: ${syncLabel}`}
            </span>
          </div>
        </header>

        {/* ============================================================== */}
        {/* PWA INSTALL BANNER (Only shows when not installed in standalone) */}
        {/* ============================================================== */}
        <PWAInstallBanner onOpenGuide={() => setIsInstallModalOpen(true)} />

        {/* ============================================================== */}
        {/* 2. HERO BANNER SLIDER (Auto-Slide, Wider Landscape & HD) */}
        {/* ============================================================== */}
        <div className="-mx-1.5 sm:-mx-1 md:mx-0">
          <HeroBanner
            banners={settings.banners}
            autoSlideInterval={settings.bannerAutoSlideInterval}
          />
        </div>

        {/* ============================================================== */}
        {/* 3. COMPACT SEARCH BAR & FILTER AFFORDANCE */}
        {/* ============================================================== */}
        <div className="relative w-full">
          <div className="relative flex items-center">
            {/* Compact Search Icon */}
            <Search className="absolute left-3 w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#164fc1]/80 pointer-events-none" />

            {/* Slim Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={settings.searchPlaceholder || 'Cari menu atau nama MD...'}
              className="w-full h-9 sm:h-9.5 pl-8.5 sm:pl-9.5 pr-15 rounded-xl border border-blue-200/90 bg-white/90 text-[#163f73] font-medium text-xs sm:text-[13px] shadow-2xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#164fc1] focus:ring-2 focus:ring-blue-100/80 transition-all"
            />

            {/* Right Controls: Clear + Filter Toggle */}
            <div className="absolute right-1.5 flex items-center gap-0.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="w-6.5 h-6.5 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Hapus pencarian"
                  aria-label="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  showCategoryFilter || selectedCategory !== 'all'
                    ? 'bg-blue-100 text-[#1244a5]'
                    : 'text-[#164fc1]/85 hover:bg-slate-100'
                }`}
                title="Filter Kategori"
                aria-label="Filter Kategori"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </div>
          </div>

          {/* Compact Segmented Category Filter */}
          {showCategoryFilter && (
            <div className="flex items-center gap-1 overflow-x-auto mt-1.5 p-1 bg-white/75 border border-blue-100/80 rounded-xl scrollbar-none animate-in fade-in duration-150">
              {[
                { id: 'all', label: 'Semua' },
                { id: 'jadwal', label: 'Jadwal MD' },
                { id: 'promo', label: 'Promo MT / GT' },
                { id: 'pasar', label: 'MD Pasar' },
                { id: 'mobile', label: 'MD Mobile' },
                { id: 'stay', label: 'MD Stay' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-[#1244a5] text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-white hover:text-[#1244a5]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* 4. MAIN CARD GRID (2-Column Layout matching screenshot) */}
        {/* ============================================================== */}
        <main className="w-full">
          <CardGrid
            items={filteredMenus}
            defaultWarna1={settings.warna1}
            defaultWarna2={settings.warna2}
          />
        </main>

        {/* ============================================================== */}
        {/* 5. NEWS / ANNOUNCEMENT TICKER */}
        {/* ============================================================== */}
        <NewsTicker
          onOpenDetail={() => setIsDetailOpen(true)}
          updateDate={formattedDate}
        />

        {/* Quick Refresh Float Link */}
        <div className="flex items-center justify-center pt-1 pb-2">
          <button
            type="button"
            onClick={() => loadCMS(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#1244a5] transition-colors cursor-pointer py-1 px-3 rounded-full hover:bg-white/60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{isRefreshing ? 'Memperbarui...' : 'Sinkronkan data terbaru'}</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* WATERMARK ("Powered by Intisari") - Can be toggled & customized in Admin */}
        {/* ============================================================== */}
        {settings.watermarkEnabled !== false && (
          <div className="flex flex-col items-center justify-center pt-0 pb-4 select-none">
            {settings.watermarkLink ? (
              <a
                href={settings.watermarkLink}
                target="_blank"
                rel="noopener noreferrer"
                title="Buka tautan"
                className="group inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/70 hover:bg-white text-slate-500 hover:text-[#1244a5] text-[11px] sm:text-xs font-semibold border border-blue-100 shadow-2xs backdrop-blur-xs transition-all hover:shadow-xs active:scale-98"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 group-hover:bg-emerald-500 transition-colors" />
                <span className="tracking-wide">
                  {settings.watermarkText || 'Powered by Intisari'}
                </span>
                <span className="text-[10px] text-blue-400 group-hover:translate-x-0.5 transition-transform">
                  &rarr;
                </span>
              </a>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/60 text-slate-500 text-[11px] sm:text-xs font-semibold border border-blue-100/70 shadow-2xs backdrop-blur-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500/80" />
                <span className="tracking-wide">
                  {settings.watermarkText || 'Powered by Intisari'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 6. BOTTOM NAVIGATION BAR */}
      {/* ============================================================== */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={handleTabChange}
        onOpenInstall={() => setIsInstallModalOpen(true)}
        isStandalone={isStandalone}
      />

      {/* ============================================================== */}
      {/* 7. MODALS & PWA PROMPTS */}
      {/* ============================================================== */}
      <DetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        updateDate={formattedDate}
        watermarkText={settings.watermarkText}
      />

      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => {
          setIsAdminOpen(false);
          setActiveTab('beranda');
        }}
        menus={menus}
        settings={settings}
        onUpdateData={handleUpdateFromAdmin}
      />

      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />

      <OfflineIndicator />
    </div>
  );
}
