import { useState, useEffect, useMemo } from 'react';
import { MenuItem, SiteSettings, ActiveTab } from './types';
import { CMS_CONFIG, DEFAULT_SETTINGS, INITIAL_MENUS } from './constants';
import BtbLogo from './components/BtbLogo';
import HeroBanner from './components/HeroBanner';
import CardGrid from './components/CardGrid';
import NewsTicker from './components/NewsTicker';
import BottomNav from './components/BottomNav';
import DetailModal from './components/DetailModal';
import AdminModal from './components/AdminModal';
import { Search, SlidersHorizontal, RefreshCw } from 'lucide-react';

export default function App() {
  const [menus, setMenus] = useState<MenuItem[]>(INITIAL_MENUS);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [cmsStatus, setCmsStatus] = useState<{ text: string; state: 'ok' | 'loading' | 'offline' }>({
    text: 'Memuat data...',
    state: 'loading',
  });
  const [lastSyncTime, setLastSyncTime] = useState<string>('13 Okt 2026 • 19:56');

  // Interactive filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);

  // Modals & Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('beranda');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load CMS Data on mount
  const loadCMS = async (force = false) => {
    setIsRefreshing(true);
    try {
      // 1. Check local cache first
      if (!force) {
        const cached = localStorage.getItem(CMS_CONFIG.cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
              setMenus(parsed.data);
              if (parsed.settings) setSettings((prev) => ({ ...prev, ...parsed.settings }));
              setCmsStatus({ text: 'CMS Aktif', state: 'ok' });
            }
          } catch {
            // cache corrupt, ignore
          }
        }
      }

      // 2. Fetch from Google Apps Script public API
      const res = await fetch(`${CMS_CONFIG.apiUrl}?action=public&t=${Date.now()}`, {
        cache: 'no-store',
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();

      if (json.ok && Array.isArray(json.menus) && json.menus.length > 0) {
        const normalized = json.menus.map((m: MenuItem, idx: number) => ({
          nama: m.nama || 'Laporan MD',
          link: m.link || '#',
          status: m.status || 'AKTIF',
          urutan: Number(m.urutan || idx + 1),
          deskripsi: m.deskripsi || '',
          warna: m.warna || '',
        }));

        setMenus(normalized);
        if (json.settings) {
          setSettings((prev) => ({ ...prev, ...json.settings }));
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const timeStr = now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const syncLabel = `${dateStr} • ${timeStr}`;
        setLastSyncTime(syncLabel);

        localStorage.setItem(
          CMS_CONFIG.cacheKey,
          JSON.stringify({
            time: Date.now(),
            data: normalized,
            settings: json.settings || {},
          })
        );
        setCmsStatus({ text: 'CMS Aktif', state: 'ok' });
      } else {
        throw new Error(json.message || 'Format respon tidak sesuai');
      }
    } catch {
      // Fallback mode if network or CORS is constrained
      setCmsStatus({ text: 'Mode Cadangan', state: 'offline' });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCMS();
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
    const now = new Date();
    setLastSyncTime(
      `${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} • ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0f7fd] via-[#eaf4fd] to-[#dff0fc] text-[#163f73] pb-24 relative overflow-x-hidden">
      {/* Background radial accent bubbles for depth */}
      <div className="fixed -top-32 -right-32 w-96 h-96 rounded-full bg-blue-300/20 blur-3xl pointer-events-none" />
      <div className="fixed top-1/2 -left-40 w-96 h-96 rounded-full bg-indigo-200/20 blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-[840px] mx-auto px-3.5 sm:px-5 md:px-6 pt-4 sm:pt-6 space-y-4 sm:space-y-5">
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

          {/* Right: CMS Status Badge & Last Sync Time */}
          <div className="flex flex-col items-end shrink-0 text-right">
            <div className="flex items-center gap-1.5 bg-emerald-50/90 text-emerald-800 border border-emerald-200/70 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold shadow-2xs backdrop-blur-xs">
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
            <span className="text-[10px] sm:text-[11px] text-slate-500 mt-1 font-medium hidden sm:inline">
              Data diperbarui
            </span>
            <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium">
              {lastSyncTime}
            </span>
          </div>
        </header>

        {/* ============================================================== */}
        {/* 2. HERO BANNER SLIDER (Auto-Slide, customizable by Admin) */}
        {/* ============================================================== */}
        <HeroBanner
          banners={settings.banners}
          autoSlideInterval={settings.bannerAutoSlideInterval}
        />

        {/* ============================================================== */}
        {/* 3. SEARCH BAR & FILTER AFFORDANCE */}
        {/* ============================================================== */}
        <div className="relative w-full">
          <div className="relative flex items-center">
            {/* Search Icon */}
            <Search className="absolute left-4 w-5 h-5 text-[#164fc1] pointer-events-none" />

            {/* Pill Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={settings.searchPlaceholder || 'Cari menu atau nama MD...'}
              className="w-full h-13 sm:h-14 pl-12 pr-12 rounded-full border-2 border-[#5aa9ff]/70 bg-white/95 text-[#163f73] font-medium text-sm sm:text-base shadow-md shadow-blue-500/10 placeholder:text-slate-400 focus:outline-none focus:border-[#164fc1] focus:ring-4 focus:ring-blue-100 transition-all"
            />

            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setShowCategoryFilter(!showCategoryFilter)}
              className={`absolute right-3.5 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                showCategoryFilter || selectedCategory !== 'all'
                  ? 'bg-blue-100 text-[#1244a5]'
                  : 'text-[#164fc1] hover:bg-slate-100'
              }`}
              title="Filter Kategori"
            >
              <SlidersHorizontal className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>

          {/* Quick Category Filter Pills */}
          {showCategoryFilter && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 px-1 scrollbar-none animate-in fade-in duration-200">
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
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-[#1244a5] text-white shadow-xs'
                      : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200'
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
          updateDate={lastSyncTime.split('•')[0]?.trim()}
        />

        {/* Quick Refresh Float Link */}
        <div className="flex items-center justify-center pt-1 pb-4">
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
      </div>

      {/* ============================================================== */}
      {/* 6. BOTTOM NAVIGATION BAR */}
      {/* ============================================================== */}
      <BottomNav activeTab={activeTab} onChangeTab={handleTabChange} />

      {/* ============================================================== */}
      {/* 7. MODALS */}
      {/* ============================================================== */}
      <DetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        updateDate={lastSyncTime.split('•')[0]?.trim()}
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
    </div>
  );
}
