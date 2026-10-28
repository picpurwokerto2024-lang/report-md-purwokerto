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
  Camera,
  User,
} from 'lucide-react';
import BtbLogo from './BtbLogo';
import {
  packSettingsForCloud,
  unpackSettingsFromCloud,
  stripSearchPlaceholderMeta,
  writeLocalWatermark,
  isTruncatedDataImageUrl,
  writeLocalCmsSync,
} from '../utils/settingsSync';
import { saveCmsCache } from '../utils/cmsStorage';

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
  const menuPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const slideListEndRef = useRef<HTMLDivElement | null>(null);
  const [uploadTargetIdx, setUploadTargetIdx] = useState<number | null>(null);
  const [uploadMenuIdx, setUploadMenuIdx] = useState<number | null>(null);
  const [confirmDeleteSlideIdx, setConfirmDeleteSlideIdx] = useState<number | null>(null);
  const [confirmDeleteMenuIdx, setConfirmDeleteMenuIdx] = useState<number | null>(null);
  const [brokenSlideIds, setBrokenSlideIds] = useState<Record<string, boolean>>({});

  // Keep live refs so instant watermark/banner toggles & debounced cloud saves always read latest state
  const menusRef = useRef<MenuItem[]>(menus);
  const bannersRef = useRef<BannerSlide[]>(banners);
  const settingsStateRef = useRef<SiteSettings>(settings);
  const pinRef = useRef<string>(pin);
  const wmSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCloudSyncRef = useRef<(() => void) | null>(null);
  const cloudSaveChainRef = useRef<Promise<{ ok: boolean; message?: string }>>(
    Promise.resolve({ ok: true })
  );

  React.useEffect(() => {
    menusRef.current = menus;
  }, [menus]);
  React.useEffect(() => {
    bannersRef.current = banners;
  }, [banners]);
  React.useEffect(() => {
    settingsStateRef.current = settings;
  }, [settings]);
  React.useEffect(() => {
    pinRef.current = pin;
  }, [pin]);

  // Sync with prop updates ONLY when modal opens to prevent overwriting active edits
  const prevIsOpenRef = useRef(false);
  React.useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setMenus(initialMenus);
      setSettings(initialSettings);
      settingsStateRef.current = initialSettings;
      if (initialSettings.banners && initialSettings.banners.length > 0) {
        setBanners(initialSettings.banners);
        bannersRef.current = initialSettings.banners;
      }
      setConfirmDeleteSlideIdx(null);
      setConfirmDeleteMenuIdx(null);
      setBrokenSlideIds({});
      setSaveStatus('');
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialMenus, initialSettings]);

  const handleCloseModal = () => {
    if (wmSyncTimerRef.current) {
      clearTimeout(wmSyncTimerRef.current);
      wmSyncTimerRef.current = null;
    }
    if (bannerSyncTimerRef.current) {
      clearTimeout(bannerSyncTimerRef.current);
      bannerSyncTimerRef.current = null;
    }
    if (pendingCloudSyncRef.current) {
      const flush = pendingCloudSyncRef.current;
      pendingCloudSyncRef.current = null;
      flush();
    }
    onClose();
  };

  if (!isOpen) return null;

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setIsLoading(true);

    const cleanPin = pin.trim();
    if (!cleanPin) {
      setPinError('Masukkan PIN admin.');
      setIsLoading(false);
      return;
    }

    try {
      const storedPin = localStorage.getItem('report_md_admin_pin');

      // 1. Coba verifikasi remote ke Google Apps Script terlebih dahulu jika terhubung
      let remoteChecked = false;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(CMS_CONFIG.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'getState', pin: cleanPin }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          remoteChecked = true;
          if (json.ok && json.data) {
            setIsAuthenticated(true);
            pinRef.current = cleanPin;
            if (json.data.menus) {
              setMenus(json.data.menus);
              menusRef.current = json.data.menus;
            }
            if (json.data.settings) {
              const unpacked = unpackSettingsFromCloud(json.data.settings, initialSettings);
              setSettings(unpacked);
              settingsStateRef.current = unpacked;
              if (unpacked.banners && unpacked.banners.length > 0) {
                setBanners(unpacked.banners);
                bannersRef.current = unpacked.banners;
              }
            }
            // Simpan PIN yang valid ke localStorage perangkat ini
            localStorage.setItem('report_md_admin_pin', cleanPin);
            setIsLoading(false);
            return;
          } else {
            // Google Apps Script secara eksplisit menolak PIN
            setPinError(json.message || 'PIN admin salah. Silakan periksa kembali.');
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Mode offline / jaringan lambat
      }

      // 2. Jika offline / server tidak dapat dihubungi:
      // Hanya izinkan PIN yang tersimpan di perangkat ini (atau PIN bawaan jika BELUM pernah diganti)
      const validLocalPin = storedPin || '123456';
      if (!remoteChecked && cleanPin === validLocalPin) {
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      setPinError('PIN admin salah. Silakan periksa kembali.');
    } catch (err: unknown) {
      setPinError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  // Change PIN handler - Responsive & Instant
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);

    const storedPin = localStorage.getItem('report_md_admin_pin') || '123456';
    const activePin = pin.trim() || storedPin;

    const cleanCurrent = currentPin.trim();
    if (cleanCurrent && cleanCurrent !== activePin && cleanCurrent !== storedPin) {
      setPinMessage({ text: 'PIN lama yang Anda masukkan salah.', error: true });
      return;
    }

    const cleanNewPin = newPin.trim();
    if (!cleanNewPin || cleanNewPin.length < 4) {
      setPinMessage({ text: 'PIN baru minimal harus 4-6 digit angka.', error: true });
      return;
    }

    if (confirmPin && cleanNewPin !== confirmPin.trim()) {
      setPinMessage({ text: 'Konfirmasi PIN tidak cocok dengan PIN baru.', error: true });
      return;
    }

    setIsLoading(true);

    // Langsung simpan di localStorage agar PIN baru aktif seketika di perangkat ini
    localStorage.setItem('report_md_admin_pin', cleanNewPin);
    setPin(cleanNewPin);

    // Kirim pembaruan ke Google Apps Script (25s timeout untuk jaringan seluler)
    let remoteSaved = false;
    let serverErrorMsg = '';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const res = await fetch(CMS_CONFIG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'changePin',
          pin: cleanCurrent || activePin,
          newPin: cleanNewPin,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.ok) {
          remoteSaved = true;
        } else {
          serverErrorMsg = json.message || 'Gagal mengubah di server';
        }
      }
    } catch {
      // Offline atau jaringan lambat, pembaruan lokal sudah aktif
    }

    if (remoteSaved) {
      setPinMessage({
        text: 'PIN berhasil diubah di database cloud & perangkat ini! PIN bawaan lama tidak dapat digunakan lagi.',
        error: false,
      });
    } else if (serverErrorMsg) {
      setPinMessage({
        text: `PIN tersimpan di perangkat ini, namun server Google Sheets merespons: ${serverErrorMsg}. Pastikan kode Apps Script telah diperbarui ke versi terbaru.`,
        error: false,
      });
    } else {
      setPinMessage({
        text: 'PIN berhasil diubah dan aktif! Gunakan PIN baru ini untuk login berikutnya.',
        error: false,
      });
    }

    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setIsLoading(false);
  };

  // Shared helper to push state to Google Apps Script sequentially (prevents concurrent sheet rewrite collisions)
  const pushStateToCloud = (
    cleanMenus: MenuItem[],
    cleanSettings: SiteSettings,
    saveTs: number
  ): Promise<{ ok: boolean; message?: string }> => {
    const runTask = async (): Promise<{ ok: boolean; message?: string }> => {
      writeLocalCmsSync({ ts: saveTs, synced: false });
      const cloudSettingsPayload = packSettingsForCloud(cleanSettings, saveTs);
      const activePin = localStorage.getItem('report_md_admin_pin') || pinRef.current || '123456';
      const bodyStr = JSON.stringify({
        action: 'saveState',
        pin: activePin,
        state: { menus: cleanMenus, settings: cloudSettingsPayload },
      });

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 50000);

          const res = await fetch(CMS_CONFIG.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: bodyStr,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const json = await res.json();
            if (json.ok) {
              writeLocalCmsSync({ ts: saveTs, synced: true });
              writeLocalWatermark({
                we: cleanSettings.watermarkEnabled !== false,
                wt: cleanSettings.watermarkText ?? '',
                wl: cleanSettings.watermarkLink ?? '',
                ts: saveTs,
                synced: true,
              });
              onUpdateData(cleanMenus, cleanSettings);
              return { ok: true };
            }
            return { ok: false, message: json.message || 'Gagal menyimpan' };
          }
        } catch {
          // Retry once after 2.5s on cellular hiccup or Google Apps Script busy lock
          if (attempt === 1) {
            await new Promise((r) => setTimeout(r, 2500));
          }
        }
      }
      return { ok: false };
    };

    const queued = cloudSaveChainRef.current.catch(() => ({ ok: false })).then(() => runTask());
    cloudSaveChainRef.current = queued;
    return queued;
  };

  // Instant Banner Commit: updates React state + IndexedDB/localStorage immediately AND syncs to Cloud
  const commitBannersChange = (
    nextBanners: BannerSlide[],
    statusLabel?: string,
    immediateCloudSync = false
  ) => {
    const saveTs = Date.now();
    bannersRef.current = nextBanners;
    setBanners(nextBanners);

    const current = settingsStateRef.current;
    const updatedSettings: SiteSettings = {
      ...current,
      searchPlaceholder: stripSearchPlaceholderMeta(current.searchPlaceholder),
      banners: nextBanners,
      watermarkEnabled: current.watermarkEnabled !== false,
      watermarkText: (current.watermarkText ?? '').trim(),
      watermarkLink: (current.watermarkLink ?? '').trim(),
    };

    settingsStateRef.current = updatedSettings;
    setSettings(updatedSettings);

    const cleanMenus = menusRef.current.map((m, idx) => ({
      ...m,
      urutan: Number(m.urutan || idx + 1),
      warna: m.warna && HEX_REGEX.test(m.warna) ? m.warna : '',
      fotoUrl: m.fotoUrl ? String(m.fotoUrl).trim() : '',
    }));

    writeLocalCmsSync({ ts: saveTs, synced: false });
    onUpdateData(cleanMenus, updatedSettings);
    saveCmsCache({ time: saveTs, data: cleanMenus, settings: updatedSettings });

    try {
      const channel = new BroadcastChannel('report_md_sync_channel');
      channel.postMessage({ type: 'SYNC_DATA', menus: cleanMenus, settings: updatedSettings });
      channel.close();
    } catch {}

    const runCloudSync = () => {
      pendingCloudSyncRef.current = null;
      if (statusLabel) {
        setSaveStatus(statusLabel);
      } else {
        setSaveStatus('Menyimpan perubahan banner ke Cloud...');
      }
      pushStateToCloud(cleanMenus, updatedSettings, saveTs).then((result) => {
        if (result.ok) {
          setSaveStatus('✅ Perubahan banner berhasil disimpan permanen ke Google Sheets!');
        } else if (result.message) {
          setSaveStatus(`⚠️ Tersimpan di perangkat ini. Cloud: ${result.message}`);
        } else {
          setSaveStatus('✅ Perubahan banner aktif & tersimpan di perangkat ini.');
        }
      });
    };

    if (bannerSyncTimerRef.current) {
      clearTimeout(bannerSyncTimerRef.current);
      bannerSyncTimerRef.current = null;
    }

    if (immediateCloudSync) {
      runCloudSync();
    } else {
      if (statusLabel) setSaveStatus(statusLabel);
      pendingCloudSyncRef.current = runCloudSync;
      bannerSyncTimerRef.current = setTimeout(runCloudSync, 900);
    }
  };

  // Instant Watermark Commit: updates React state + localStorage immediately AND syncs to Cloud
  const commitWatermarkChange = (
    patch: Partial<Pick<SiteSettings, 'watermarkEnabled' | 'watermarkText' | 'watermarkLink'>>,
    immediateCloudSync: boolean
  ) => {
    const saveTs = Date.now();
    const current = settingsStateRef.current;
    const nextEnabled =
      patch.watermarkEnabled !== undefined
        ? patch.watermarkEnabled
        : current.watermarkEnabled !== false;
    const nextText =
      patch.watermarkText !== undefined ? patch.watermarkText : current.watermarkText ?? '';
    const nextLink =
      patch.watermarkLink !== undefined ? patch.watermarkLink : current.watermarkLink ?? '';

    const updatedSettings: SiteSettings = {
      ...current,
      searchPlaceholder: stripSearchPlaceholderMeta(current.searchPlaceholder),
      banners: bannersRef.current,
      watermarkEnabled: nextEnabled,
      watermarkText: nextText,
      watermarkLink: nextLink,
    };

    settingsStateRef.current = updatedSettings;
    setSettings(updatedSettings);

    // Persist immediately to dedicated watermark storage with timestamp so polling NEVER reverts it
    writeLocalWatermark({
      we: nextEnabled,
      wt: nextText.trim(),
      wl: nextLink.trim(),
      ts: saveTs,
      synced: false,
    });

    const cleanMenus = menusRef.current.map((m, idx) => ({
      ...m,
      urutan: Number(m.urutan || idx + 1),
      warna: m.warna && HEX_REGEX.test(m.warna) ? m.warna : '',
      fotoUrl: m.fotoUrl ? String(m.fotoUrl).trim() : '',
    }));

    const parentSettings: SiteSettings = {
      ...updatedSettings,
      watermarkText: nextText.trim(),
      watermarkLink: nextLink.trim(),
    };

    onUpdateData(cleanMenus, parentSettings);
    saveCmsCache({ time: saveTs, data: cleanMenus, settings: parentSettings });

    try {
      const channel = new BroadcastChannel('report_md_sync_channel');
      channel.postMessage({ type: 'SYNC_DATA', menus: cleanMenus, settings: parentSettings });
      channel.close();
    } catch {}

    const runCloudSync = () => {
      pendingCloudSyncRef.current = null;
      setSaveStatus('Menyimpan pengaturan watermark...');
      pushStateToCloud(cleanMenus, parentSettings, saveTs).then((result) => {
        if (result.ok) {
          setSaveStatus(
            nextEnabled && nextText.trim().length > 0
              ? '✅ Watermark berhasil diperbarui & tersimpan permanen!'
              : '✅ Watermark berhasil dinonaktifkan & tersimpan permanen!'
          );
        } else {
          setSaveStatus('✅ Pengaturan watermark aktif & tersimpan di perangkat ini.');
        }
      });
    };

    if (wmSyncTimerRef.current) {
      clearTimeout(wmSyncTimerRef.current);
      wmSyncTimerRef.current = null;
    }

    if (immediateCloudSync) {
      runCloudSync();
    } else {
      setSaveStatus('Perubahan diterapkan — menyimpan otomatis...');
      pendingCloudSyncRef.current = runCloudSync;
      wmSyncTimerRef.current = setTimeout(runCloudSync, 750);
    }
  };

  // Save changes handler
  const handleSaveAll = async () => {
    if (wmSyncTimerRef.current) {
      clearTimeout(wmSyncTimerRef.current);
      wmSyncTimerRef.current = null;
    }
    if (bannerSyncTimerRef.current) {
      clearTimeout(bannerSyncTimerRef.current);
      bannerSyncTimerRef.current = null;
    }
    pendingCloudSyncRef.current = null;

    setIsLoading(true);
    setSaveStatus('Menyimpan perubahan ke Cloud...');

    try {
      const saveTs = Date.now();
      const latestBanners = bannersRef.current;
      // Normalize menus
      const cleanMenus = menusRef.current.map((m, idx) => ({
        ...m,
        urutan: Number(m.urutan || idx + 1),
        warna: m.warna && HEX_REGEX.test(m.warna) ? m.warna : '',
        fotoUrl: m.fotoUrl ? String(m.fotoUrl).trim() : '',
      }));

      const trimmedWmText = (settings.watermarkText ?? '').trim();
      const effectiveWatermarkEnabled = settings.watermarkEnabled !== false;

      const cleanSettings: SiteSettings = {
        ...settings,
        searchPlaceholder: stripSearchPlaceholderMeta(settings.searchPlaceholder),
        banners: latestBanners,
        watermarkText: trimmedWmText,
        watermarkEnabled: effectiveWatermarkEnabled,
        watermarkLink: (settings.watermarkLink || '').trim(),
      };

      // Write timestamped watermark & CMS sync state immediately
      writeLocalCmsSync({ ts: saveTs, synced: false });
      writeLocalWatermark({
        we: effectiveWatermarkEnabled,
        wt: trimmedWmText,
        wl: cleanSettings.watermarkLink || '',
        ts: saveTs,
        synced: false,
      });

      // Update parent component state and high-capacity local cache immediately
      settingsStateRef.current = cleanSettings;
      setSettings(cleanSettings);
      onUpdateData(cleanMenus, cleanSettings);
      saveCmsCache({ time: saveTs, data: cleanMenus, settings: cleanSettings });

      // Instant cross-tab broadcast for same device
      try {
        const channel = new BroadcastChannel('report_md_sync_channel');
        channel.postMessage({ type: 'SYNC_DATA', menus: cleanMenus, settings: cleanSettings });
        channel.close();
      } catch {}

      const result = await pushStateToCloud(cleanMenus, cleanSettings, saveTs);
      if (result.ok) {
        setSaveStatus('✅ Tersimpan di Google Sheets & Cloud! Seluruh perangkat akan otomatis ter-update.');
      } else if (result.message) {
        setSaveStatus('⚠️ Tersimpan lokal. Google Sheets: ' + result.message);
      } else {
        setSaveStatus('✅ Tersimpan dan aktif di perangkat ini.');
      }
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
      fotoUrl: '',
    };
    setMenus([...menus, newItem]);
  };

  const handleRemoveMenu = (index: number) => {
    if (confirmDeleteMenuIdx !== index) {
      setConfirmDeleteMenuIdx(index);
      return;
    }
    const updated = menus.filter((_, i) => i !== index).map((m, i) => ({ ...m, urutan: i + 1 }));
    setMenus(updated);
    setConfirmDeleteMenuIdx(null);
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
    const inheritHideOverlay =
      banners.length > 0 ? banners.some((b) => Boolean(b.hideOverlay)) : true;
    const newIdx = banners.length;
    const newSlide: BannerSlide = {
      id: `banner-${Date.now()}`,
      imageUrl: PRESET_IMAGES[0].url,
      scriptText: inheritHideOverlay ? '' : 'Bersama',
      title: inheritHideOverlay ? '' : 'Judul Banner Baru',
      subtitle: inheritHideOverlay ? '' : 'Subjudul atau slogan tim',
      badgeText: '',
      hideOverlay: inheritHideOverlay,
      fitMode: 'contain',
    };
    const next = [...banners, newSlide];
    bannersRef.current = next;
    setBanners(next);
    setSaveStatus('📷 Slide baru ditambahkan — silakan pilih file foto banner Anda.');

    // Scroll to the new slide and immediately open the file picker for convenience
    setTimeout(() => {
      slideListEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 60);
    handleTriggerUpload(newIdx);
  };

  const handleRemoveBanner = (index: number) => {
    if (banners.length <= 1) {
      setSaveStatus('⚠️ Minimal harus ada 1 banner slide.');
      return;
    }
    if (confirmDeleteSlideIdx !== index) {
      setConfirmDeleteSlideIdx(index);
      return;
    }
    const next = banners.filter((_, i) => i !== index);
    setConfirmDeleteSlideIdx(null);
    commitBannersChange(next, 'Menghapus slide & menyimpan ke Cloud...', true);
  };

  const handleMoveBanner = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === banners.length - 1) return;

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const copy = [...banners];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    commitBannersChange(copy, 'Mengurutkan slide & menyimpan...', true);
  };

  // Image Upload handler for Banners
  const handleTriggerUpload = (idx: number) => {
    setUploadTargetIdx(idx);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Progressive multi-step high-quality downscaler to preserve crisp HD edges & text
  const renderHighQualityCanvas = (
    img: HTMLImageElement,
    maxW: number,
    maxH: number
  ): HTMLCanvasElement => {
    let targetW = img.naturalWidth || img.width;
    let targetH = img.naturalHeight || img.height;
    if (targetW > maxW || targetH > maxH) {
      const ratio = Math.min(maxW / targetW, maxH / targetH);
      targetW = Math.max(1, Math.round(targetW * ratio));
      targetH = Math.max(1, Math.round(targetH * ratio));
    }

    // Step down progressively by 50% if source image is >2x larger than target
    let curSource: CanvasImageSource = img;
    let curW = img.naturalWidth || img.width;
    let curH = img.naturalHeight || img.height;

    while (curW * 0.5 > targetW && curH * 0.5 > targetH) {
      const nextW = Math.max(targetW, Math.round(curW * 0.5));
      const nextH = Math.max(targetH, Math.round(curH * 0.5));
      const stepCanvas = document.createElement('canvas');
      stepCanvas.width = nextW;
      stepCanvas.height = nextH;
      const stepCtx = stepCanvas.getContext('2d');
      if (!stepCtx) break;
      stepCtx.imageSmoothingEnabled = true;
      stepCtx.imageSmoothingQuality = 'high';
      stepCtx.drawImage(curSource, 0, 0, nextW, nextH);
      curSource = stepCanvas;
      curW = nextW;
      curH = nextH;
    }

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = targetW;
    finalCanvas.height = targetH;
    const finalCtx = finalCanvas.getContext('2d');
    if (finalCtx) {
      finalCtx.imageSmoothingEnabled = true;
      finalCtx.imageSmoothingQuality = 'high';
      finalCtx.drawImage(curSource, 0, 0, targetW, targetH);
    }
    return finalCanvas;
  };

  const encodeHdBannerDataUrl = (
    img: HTMLImageElement
  ): { dataUrl: string; width: number; height: number } => {
    // Strictly <= 124,000 base64 chars so Google Sheets 3-cell (135,000 char) limit NEVER truncates the image
    const MAX_BASE64_CHARS = 124000;
    const dimensionTiers = [
      { maxW: 1600, maxH: 900 },
      { maxW: 1366, maxH: 768 },
      { maxW: 1200, maxH: 675 },
      { maxW: 1024, maxH: 576 },
      { maxW: 896, maxH: 504 },
      { maxW: 768, maxH: 432 },
    ];
    const qualities = [0.90, 0.84, 0.78, 0.72, 0.65];

    let bestUrl = '';
    let bestW = 0;
    let bestH = 0;

    for (const tier of dimensionTiers) {
      const canvas = renderHighQualityCanvas(img, tier.maxW, tier.maxH);
      bestW = canvas.width;
      bestH = canvas.height;

      for (const q of qualities) {
        const webpCandidate = canvas.toDataURL('image/webp', q);
        const hasWebp = webpCandidate.startsWith('data:image/webp');
        if (hasWebp && webpCandidate.length <= MAX_BASE64_CHARS) {
          return { dataUrl: webpCandidate, width: bestW, height: bestH };
        }

        const jpegCandidate = canvas.toDataURL('image/jpeg', q);
        const smallerCandidate =
          hasWebp && webpCandidate.length <= jpegCandidate.length ? webpCandidate : jpegCandidate;

        bestUrl = smallerCandidate;
        if (smallerCandidate.length <= MAX_BASE64_CHARS) {
          return { dataUrl: smallerCandidate, width: bestW, height: bestH };
        }
      }
    }

    // Final mathematical guarantee loop so NO image ever exceeds MAX_BASE64_CHARS
    let curMaxW = 680;
    let curMaxH = 382;
    while (bestUrl.length > MAX_BASE64_CHARS && curMaxW >= 320) {
      const canvas = renderHighQualityCanvas(img, curMaxW, curMaxH);
      bestW = canvas.width;
      bestH = canvas.height;
      const webp = canvas.toDataURL('image/webp', 0.60);
      const jpeg = canvas.toDataURL('image/jpeg', 0.60);
      bestUrl =
        webp.startsWith('data:image/webp') && webp.length <= jpeg.length ? webp : jpeg;
      curMaxW = Math.round(curMaxW * 0.85);
      curMaxH = Math.round(curMaxH * 0.85);
    }

    return { dataUrl: bestUrl, width: bestW, height: bestH };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadTargetIdx === null) return;

    if (file.size > 20 * 1024 * 1024) {
      setSaveStatus('⚠️ Ukuran file maksimal 20MB. Silakan pilih gambar lain.');
      return;
    }

    const targetIndex = uploadTargetIdx;
    setSaveStatus('⏳ Mengoptimalkan foto banner HD agar utuh & tajam...');
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      img.src = uploadEvent.target?.result as string;
      img.onload = () => {
        const { dataUrl, width, height } = encodeHdBannerDataUrl(img);
        if (!dataUrl) {
          setSaveStatus('⚠️ Gagal memproses gambar. Silakan coba foto lain.');
          return;
        }

        // Verify browser decodes the generated dataUrl cleanly before saving
        const verifyImg = new Image();
        verifyImg.onload = () => {
          const baseList = [...bannersRef.current];
          if (baseList[targetIndex]) {
            const slideKey = baseList[targetIndex].id || String(targetIndex);
            setBrokenSlideIds((prev) => {
              if (!prev[slideKey]) return prev;
              const copy = { ...prev };
              delete copy[slideKey];
              return copy;
            });
            baseList[targetIndex] = {
              ...baseList[targetIndex],
              imageUrl: dataUrl,
              fitMode: baseList[targetIndex].fitMode || 'contain',
            };
            commitBannersChange(
              baseList,
              `⏳ Foto HD (${width}×${height} px) dipasang — menyimpan otomatis ke Google Sheets...`,
              true
            );
          }
        };
        verifyImg.onerror = () => {
          setSaveStatus('⚠️ Format gambar tidak didukung. Silakan gunakan foto JPG atau PNG.');
        };
        verifyImg.src = dataUrl;
      };
      img.onerror = () => {
        setSaveStatus('⚠️ File gambar tidak dapat dibaca. Silakan pilih foto JPG atau PNG.');
      };
    };
    reader.readAsDataURL(file);
  };

  const convertGoogleDriveUrl = (url: string): string => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('data:image/')) return trimmed;

    const matchFile = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (matchFile && matchFile[1]) {
      return `https://lh3.googleusercontent.com/d/${matchFile[1]}=w1920`;
    }
    const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId && matchId[1] && trimmed.includes('drive.google.com')) {
      return `https://lh3.googleusercontent.com/d/${matchId[1]}=w1920`;
    }
    const matchLh3 = trimmed.match(/^https:\/\/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)$/);
    if (matchLh3 && matchLh3[1]) {
      return `https://lh3.googleusercontent.com/d/${matchLh3[1]}=w1920`;
    }
    return trimmed;
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setSaveStatus('⚠️ Ukuran gambar logo maksimal 8MB.');
      return;
    }

    // Auto-compress logo so base64 string is < 15KB (fits cleanly in Google Sheets)
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      img.src = uploadEvent.target?.result as string;
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        const maxW = 240;
        const maxH = 90;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          // Try PNG first, if large compress to JPEG
          let compressed = canvas.toDataURL('image/png');
          if (compressed.length > 25000) {
            compressed = canvas.toDataURL('image/jpeg', 0.85);
          }
          setSettings((prev) => ({ ...prev, logoUrl: compressed }));
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const triggerMenuPhotoUpload = (idx: number) => {
    setUploadMenuIdx(idx);
    if (menuPhotoInputRef.current) {
      menuPhotoInputRef.current.value = '';
      menuPhotoInputRef.current.click();
    }
  };

  const handleMenuPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadMenuIdx === null) return;

    if (file.size > 8 * 1024 * 1024) {
      setSaveStatus('⚠️ Ukuran foto menu maksimal 8MB.');
      return;
    }

    // Compress photo to 200x200 square avatar JPEG 0.75 (~8-12KB base64, fits cleanly in Google Sheets)
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      img.src = uploadEvent.target?.result as string;
      img.onload = () => {
        // Crop center square for crisp round avatar (compact 160x160 JPEG ~5-8KB base64)
        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;
        const targetDim = 160;

        const canvas = document.createElement('canvas');
        canvas.width = targetDim;
        canvas.height = targetDim;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, startX, startY, size, size, 0, 0, targetDim, targetDim);
          const compressed = canvas.toDataURL('image/jpeg', 0.72);
          const next = [...menus];
          next[uploadMenuIdx].fotoUrl = compressed;
          setMenus(next);
        }
      };
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

      {/* Hidden File Input for Menu / MD Photo */}
      <input
        type="file"
        ref={menuPhotoInputRef}
        onChange={handleMenuPhotoUpload}
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
            onClick={handleCloseModal}
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
              Masukkan PIN keamanan untuk mengakses menu pengaturan
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
                <span>Logo, Teks & Watermark</span>
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
                  {/* Panduan Agar Gambar Muncul */}
                  <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50/70 border border-blue-200/80 rounded-2xl text-xs space-y-1.5 shadow-2xs">
                    <div className="font-bold text-[#1244a5] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Petunjuk Gambar Banner Kualitas HD & Landscape Utuh:</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-700">
                      <li>
                        <strong>Kualitas HD Otomatis:</strong> Klik <strong>Pilih File</strong> (hingga resolusi 1600×900 HD tajam) atau tempel link <strong>Google Drive</strong> (otomatis dimuat dalam Full HD 1920px). <em>Jika ada banner lama yang sebelumnya buram, cukup unggah ulang fotonya sekali lewat Pilih File.</em>
                      </li>
                      <li>
                        <strong>Landscape Tidak Terpotong:</strong> Gunakan mode <strong>&quot;Utuh Tanpa Terpotong (Landscape)&quot;</strong> agar seluruh isi poster/foto melebar tampil penuh tanpa terpotong kiri-kanan maupun atas-bawah.
                      </li>
                      <li>
                        <strong>Wajib Klik Simpan:</strong> Setelah selesai mengatur foto, klik tombol biru <strong>SIMPAN PERUBAHAN</strong> di kanan bawah!
                      </li>
                    </ul>
                  </div>

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
                    <span className="text-xs text-slate-600 font-semibold">
                      Daftar Banner Slide ({banners.length} Slide):
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          commitBannersChange(
                            DEFAULT_BANNERS,
                            'Mereset banner ke bawaan...',
                            true
                          )
                        }
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        Reset Bawaan
                      </button>
                      <button
                        type="button"
                        onClick={handleAddBanner}
                        className="flex items-center gap-1 text-xs font-bold text-white bg-[#1244a5] hover:bg-[#0e3786] px-3.5 py-2 rounded-xl transition-colors cursor-pointer shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tambah Slide Baru</span>
                      </button>
                    </div>
                  </div>

                  {/* Banner Slides List */}
                  <div className="space-y-3.5">
                    {banners.map((slide, idx) => {
                      const slideKey = slide.id || String(idx);
                      const isTruncated =
                        isTruncatedDataImageUrl(slide.imageUrl) || Boolean(brokenSlideIds[slideKey]);
                      const isPresetDefault = PRESET_IMAGES.some((p) => p.url === slide.imageUrl);
                      const displayImg = isTruncated
                        ? PRESET_IMAGES[0].url
                        : convertGoogleDriveUrl(slide.imageUrl) || PRESET_IMAGES[0].url;
                      const previewImgKey = `${slideKey}-${displayImg.length}-${displayImg.slice(-20)}`;

                      return (
                        <div
                          key={slideKey}
                          className={`p-3.5 rounded-2xl border space-y-3 shadow-2xs transition-colors ${
                            isTruncated
                              ? 'bg-amber-50/70 border-amber-300'
                              : 'bg-slate-50/90 border-slate-200/90'
                          }`}
                        >
                          {/* Warning Callout if a slide was previously truncated at 135k chars */}
                          {isTruncated && (
                            <div className="p-2.5 rounded-xl bg-amber-100/90 border border-amber-300 text-amber-950 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-start gap-2">
                                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                <span>
                                  <strong>Foto sebelumnya terpotong batas ukuran server</strong> sehingga tampil sebagai foto bawaan. Klik tombol di samping untuk mengunggah ulang — kini otomatis dioptimalkan agar utuh 100% &amp; langsung tersimpan!
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleTriggerUpload(idx)}
                                className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-[#1244a5] hover:bg-[#0e3786] text-white font-bold text-[11px] shrink-0 cursor-pointer shadow-2xs"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Unggah Ulang Foto</span>
                              </button>
                            </div>
                          )}

                          {/* Slide Header: Index + Preview + Controls */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-blue-100 text-[#1244a5] text-xs font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div className="w-28 sm:w-36 h-16 rounded-xl overflow-hidden bg-slate-900 border border-slate-300 shrink-0 shadow-2xs relative">
                                <img
                                  key={previewImgKey}
                                  src={displayImg}
                                  alt={`Slide ${idx + 1}`}
                                  className={`w-full h-full ${
                                    slide.fitMode === 'cover' ? 'object-cover' : 'object-contain'
                                  }`}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    if (slide.imageUrl?.startsWith('data:image/')) {
                                      setBrokenSlideIds((prev) =>
                                        prev[slideKey] ? prev : { ...prev, [slideKey]: true }
                                      );
                                    }
                                    if (target.src !== PRESET_IMAGES[0].url) {
                                      target.src = PRESET_IMAGES[0].url;
                                    }
                                  }}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h5 className="font-bold text-xs sm:text-sm text-slate-800 truncate">
                                    {slide.title || `Slide Banner ${idx + 1}`}
                                  </h5>
                                  {isTruncated ? (
                                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-extrabold shrink-0">
                                      Perlu Unggah Ulang
                                    </span>
                                  ) : isPresetDefault ? (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-extrabold shrink-0">
                                      Foto Bawaan
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-extrabold shrink-0">
                                      Foto Kustom HD
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {isPresetDefault
                                    ? 'Klik "Pilih File" di bawah untuk memakai foto Anda sendiri'
                                    : slide.hideOverlay
                                    ? '🖼️ Mode Gambar Penuh (Tanpa pita biru)'
                                    : slide.subtitle || 'Teks standar aktif'}
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
                              {confirmDeleteSlideIdx === idx ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBanner(idx)}
                                    className="px-2 py-1 text-[10px] font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 cursor-pointer"
                                  >
                                    Hapus
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteSlideIdx(null)}
                                    className="px-1.5 py-1 text-[10px] font-semibold bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 cursor-pointer"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBanner(idx)}
                                  disabled={banners.length <= 1}
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30"
                                  title="Hapus Slide"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Image Source & Upload */}
                          <div className="space-y-1.5">
                            <label className="block text-[11px] font-bold text-slate-700">
                              Foto Slide Banner:
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={
                                  slide.imageUrl?.startsWith('data:image/')
                                    ? isTruncated
                                      ? '[Foto terpotong — silakan klik Pilih File untuk unggah ulang]'
                                      : `[Foto Kustom HD Terunggah (${Math.round(slide.imageUrl.length / 1024)} KB)]`
                                    : slide.imageUrl
                                }
                                readOnly={Boolean(slide.imageUrl?.startsWith('data:image/'))}
                                onChange={(e) => {
                                  const converted = convertGoogleDriveUrl(e.target.value);
                                  const next = [...banners];
                                  next[idx] = { ...next[idx], imageUrl: converted };
                                  setBrokenSlideIds((prev) => {
                                    if (!prev[slideKey]) return prev;
                                    const copy = { ...prev };
                                    delete copy[slideKey];
                                    return copy;
                                  });
                                  commitBannersChange(
                                    next,
                                    'Link foto diterapkan — menyimpan otomatis...',
                                    false
                                  );
                                }}
                                placeholder="Pilih file dari HP/PC atau tempel link Google Drive (https://...)"
                                className={`flex-1 text-xs bg-white border border-slate-300 rounded-xl px-3 py-1.5 outline-none focus:border-blue-600 truncate ${
                                  slide.imageUrl?.startsWith('data:image/')
                                    ? 'text-emerald-700 font-semibold bg-emerald-50/40'
                                    : 'text-slate-700'
                                }`}
                              />
                              {slide.imageUrl?.startsWith('data:image/') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...banners];
                                    next[idx] = { ...next[idx], imageUrl: '' };
                                    setBanners(next);
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-[11px] shrink-0 cursor-pointer"
                                  title="Ganti dengan Link URL / Google Drive"
                                >
                                  Pakai Link
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleTriggerUpload(idx)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1244a5] hover:bg-[#0e3786] text-white font-bold text-xs transition-colors shrink-0 cursor-pointer shadow-2xs"
                                title="Unggah Foto dari HP/Komputer"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Pilih File</span>
                              </button>
                            </div>

                            {/* Quick Presets Picker */}
                            <div className="flex items-center gap-1.5 pt-1 overflow-x-auto scrollbar-none">
                              <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                                Contoh Foto:
                              </span>
                              {PRESET_IMAGES.map((preset, pIdx) => (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={() => {
                                    const next = [...banners];
                                    next[idx] = { ...next[idx], imageUrl: preset.url };
                                    setBrokenSlideIds((prev) => {
                                      if (!prev[slideKey]) return prev;
                                      const copy = { ...prev };
                                      delete copy[slideKey];
                                      return copy;
                                    });
                                    commitBannersChange(
                                      next,
                                      'Contoh foto dipilih — menyimpan otomatis...',
                                      true
                                    );
                                  }}
                                  className="text-[10px] bg-white border border-slate-200 hover:border-blue-400 text-slate-600 px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer"
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Proporsi Landscape & Mode Gambar Penuh */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 pb-1">
                            <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Tampilan Proporsi Gambar:
                              </label>
                              <select
                                value={slide.fitMode || 'contain'}
                                onChange={(e) => {
                                  const next = [...banners];
                                  next[idx] = {
                                    ...next[idx],
                                    fitMode: e.target.value as 'contain' | 'cover',
                                  };
                                  commitBannersChange(
                                    next,
                                    'Proporsi banner diperbarui — menyimpan otomatis...',
                                    true
                                  );
                                }}
                                className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-600 cursor-pointer"
                              >
                                <option value="contain">
                                  Utuh Tanpa Terpotong (Rekomendasi Landscape)
                                </option>
                                <option value="cover">
                                  Penuhi Bingkai (Cover)
                                </option>
                              </select>
                            </div>

                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none bg-white p-2.5 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors">
                              <input
                                type="checkbox"
                                checked={Boolean(slide.hideOverlay)}
                                onChange={(e) => {
                                  const next = [...banners];
                                  next[idx] = {
                                    ...next[idx],
                                    hideOverlay: e.target.checked,
                                  };
                                  commitBannersChange(
                                    next,
                                    'Tampilan pita teks diperbarui — menyimpan otomatis...',
                                    true
                                  );
                                }}
                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer shrink-0"
                              />
                              <span className="leading-snug">
                                🖼️ <strong>Sembunyikan Pita Teks:</strong> Tampilkan murni poster/foto tanpa pita biru.
                              </span>
                            </label>
                          </div>

                          {/* Text Content Inputs (Only relevant if not full image mode) */}
                          {!slide.hideOverlay && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                                  Judul Utama
                                </label>
                                <input
                                  type="text"
                                  value={slide.title || ''}
                                  onChange={(e) => {
                                    const next = [...banners];
                                    next[idx] = { ...next[idx], title: e.target.value };
                                    commitBannersChange(next, undefined, false);
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
                                    next[idx] = { ...next[idx], subtitle: e.target.value };
                                    commitBannersChange(next, undefined, false);
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
                                    next[idx] = { ...next[idx], scriptText: e.target.value };
                                    commitBannersChange(next, undefined, false);
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
                                    next[idx] = { ...next[idx], badgeText: e.target.value };
                                    commitBannersChange(next, undefined, false);
                                  }}
                                  placeholder="Jangkauan Lebih Luas..."
                                  className="w-full text-xs text-slate-700 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none focus:border-blue-600"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={slideListEndRef} />
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

                            {confirmDeleteMenuIdx === idx ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMenu(idx)}
                                  className="px-2 py-1 text-[10px] font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 cursor-pointer"
                                >
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteMenuIdx(null)}
                                  className="px-1.5 py-1 text-[10px] font-semibold bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRemoveMenu(idx)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Menu"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
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

                        {/* FOTO / ICON PERSONEL MD */}
                        <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2.5 bg-white/70 p-2.5 rounded-xl">
                          <div className="flex items-center gap-2.5">
                            {/* Avatar Preview */}
                            <div className="relative w-10 h-10 rounded-full bg-slate-100 border-2 border-blue-200 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                              {item.fotoUrl ? (
                                <img
                                  src={convertGoogleDriveUrl(item.fotoUrl)}
                                  alt={item.nama}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover rounded-full"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <User className="w-5 h-5 text-slate-400" />
                              )}
                            </div>

                            <div className="flex flex-col">
                              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                                <Camera className="w-3.5 h-3.5 text-blue-600" />
                                <span>Foto / Icon MD</span>
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {item.fotoUrl ? 'Foto MD kustom terpasang' : 'Menggunakan icon bawaan'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => triggerMenuPhotoUpload(idx)}
                              className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200/80 transition-colors cursor-pointer"
                              title="Pilih foto dari HP/Laptop"
                            >
                              <Upload className="w-3 h-3" />
                              <span>{item.fotoUrl ? 'Ganti Foto' : 'Unggah Foto MD'}</span>
                            </button>

                            {item.fotoUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...menus];
                                  next[idx].fotoUrl = '';
                                  setMenus(next);
                                }}
                                className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                                title="Hapus foto dan kembali ke icon bawaan"
                              >
                                <X className="w-3 h-3" />
                                <span>Hapus</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Optional Direct URL / Google Drive link input */}
                        <div className="flex items-center gap-1.5 px-1">
                          <span className="text-[10px] font-medium text-slate-400 shrink-0">Atau Link Foto:</span>
                          <input
                            type="text"
                            value={item.fotoUrl || ''}
                            onChange={(e) => {
                              const next = [...menus];
                              next[idx].fotoUrl = convertGoogleDriveUrl(e.target.value);
                              setMenus(next);
                            }}
                            placeholder="URL gambar atau link Google Drive (https://...)"
                            className="flex-1 text-[11px] text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-0.5 focus:border-blue-500 outline-none"
                          />
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
                          onChange={(e) => setSettings({ ...settings, logoUrl: convertGoogleDriveUrl(e.target.value) })}
                          placeholder="Pilih file logo atau tempel link gambar / Google Drive"
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

                  {/* Watermark & Footer Branding */}
                  <div className="space-y-3.5 pt-4 border-t border-slate-100">
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div>
                        <h3 className="text-xs font-bold text-[#1244a5] uppercase tracking-wider">
                          Watermark Halaman (&quot;Powered by&quot;)
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Perubahan teks maupun status Aktif / Nonaktif langsung tersimpan otomatis.
                        </p>
                      </div>

                      {/* Explicit Segmented Buttons for Aktif / Nonaktif (Auto-Saves Immediately!) */}
                      <div className="inline-flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            const restoredText =
                              settings.watermarkText && settings.watermarkText.trim().length > 0
                                ? settings.watermarkText
                                : 'Powered by Intisari';
                            commitWatermarkChange(
                              {
                                watermarkEnabled: true,
                                watermarkText: restoredText,
                              },
                              true
                            );
                          }}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            settings.watermarkEnabled !== false
                              ? 'bg-[#1244a5] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Aktif
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            commitWatermarkChange({ watermarkEnabled: false }, true);
                          }}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            settings.watermarkEnabled === false
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Nonaktif
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90">
                      {settings.watermarkEnabled === false && (
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                          <span>Status: Watermark sedang NONAKTIF (disembunyikan).</span>
                          <button
                            type="button"
                            onClick={() =>
                              commitWatermarkChange(
                                {
                                  watermarkEnabled: true,
                                  watermarkText:
                                    settings.watermarkText && settings.watermarkText.trim().length > 0
                                      ? settings.watermarkText
                                      : 'Powered by Intisari',
                                },
                                true
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-white text-[#1244a5] border border-rose-200 hover:bg-blue-50 font-bold text-[11px] shrink-0 cursor-pointer"
                          >
                            Aktifkan
                          </button>
                        </div>
                      )}

                      <div
                        className={
                          settings.watermarkEnabled === false ? 'opacity-65 transition-opacity' : ''
                        }
                      >
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            Teks Watermark
                          </label>
                          <div className="flex items-center gap-2.5">
                            {Boolean((settings.watermarkText ?? '').length > 0) && (
                              <button
                                type="button"
                                onClick={() =>
                                  commitWatermarkChange({ watermarkText: '' }, true)
                                }
                                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
                              >
                                Kosongkan Teks
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                commitWatermarkChange(
                                  {
                                    watermarkEnabled: true,
                                    watermarkText: 'Powered by Intisari',
                                  },
                                  true
                                )
                              }
                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                            >
                              Reset Default
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={settings.watermarkText ?? ''}
                          onChange={(e) => {
                            commitWatermarkChange({ watermarkText: e.target.value }, false);
                          }}
                          onBlur={() => {
                            if (pendingCloudSyncRef.current) {
                              if (wmSyncTimerRef.current) {
                                clearTimeout(wmSyncTimerRef.current);
                                wmSyncTimerRef.current = null;
                              }
                              const flush = pendingCloudSyncRef.current;
                              pendingCloudSyncRef.current = null;
                              flush();
                            }
                          }}
                          placeholder="Ketik teks watermark (misal: Powered by Perusahaan Anda)"
                          className="w-full text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Ketik teks baru untuk mengganti tulisan watermark, atau klik tombol <strong>Nonaktif</strong> di kanan atas untuk menyembunyikannya secara permanen.
                        </p>
                      </div>

                      <div
                        className={
                          settings.watermarkEnabled === false ? 'opacity-65 transition-opacity' : ''
                        }
                      >
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Tautan URL saat Diklik (Opsional)
                        </label>
                        <input
                          type="text"
                          value={settings.watermarkLink || ''}
                          onChange={(e) => {
                            commitWatermarkChange({ watermarkLink: e.target.value }, false);
                          }}
                          placeholder="https://... (kosongkan jika tidak perlu link)"
                          className="w-full text-sm text-slate-800 bg-white border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>

                      {/* Live Preview Box */}
                      <div className="pt-1">
                        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Pratinjau di Halaman Utama:
                        </span>
                        <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl border border-blue-100 flex items-center justify-center">
                          {settings.watermarkEnabled !== false &&
                          (settings.watermarkText ?? '').trim().length > 0 ? (
                            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white text-slate-600 text-xs font-semibold border border-blue-100 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500/80" />
                              <span>{(settings.watermarkText ?? '').trim()}</span>
                              {settings.watermarkLink && (
                                <span className="text-[10px] text-blue-500">&rarr;</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-rose-600">
                              Watermark Disembunyikan dari Halaman Utama
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 4: GANTI PIN */}
              {activeTab === 'pin' && (
                <form onSubmit={handleChangePin} className="max-w-md space-y-3.5 pt-2">
                  <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-2xl">
                    <h3 className="text-xs font-bold text-[#1244a5] uppercase tracking-wider mb-1">
                      Ubah PIN Keamanan Admin
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Ganti PIN rahasia untuk melindungi akses menu pengaturan.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      PIN Lama (Kosongkan jika lupa)
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value)}
                      placeholder="Masukkan PIN lama (opsional)"
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1244a5] focus:ring-2 focus:ring-blue-100 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      PIN Baru (Minimal 4 - 6 Digit)
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="Masukkan angka PIN baru"
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1244a5] focus:ring-2 focus:ring-blue-100 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ulangi PIN Baru
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="Ketik ulang PIN baru untuk konfirmasi"
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 focus:border-[#1244a5] focus:ring-2 focus:ring-blue-100 outline-none"
                      required
                    />
                  </div>

                  {pinMessage && (
                    <div
                      className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                        pinMessage.error
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${pinMessage.error ? 'text-rose-500' : 'text-emerald-500'}`} />
                      <span>{pinMessage.text}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl bg-[#1244a5] hover:bg-[#0d3680] text-white font-bold text-xs shadow-md shadow-blue-900/10 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? 'Menyimpan PIN...' : 'SIMPAN PIN BARU SEKARANG'}
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
                  onClick={handleCloseModal}
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
