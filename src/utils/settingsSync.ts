import { SiteSettings, BannerSlide } from '../types';
import { CMS_CONFIG, DEFAULT_BANNERS, DEFAULT_SETTINGS } from '../constants';

const META_DELIMITER = '\u2063__CFG__:';
export const WATERMARK_STORAGE_KEY = 'report_md_watermark_v3';
export const CMS_SYNC_META_KEY = 'report_md_cms_sync_v1';

export interface LocalCmsSyncMeta {
  ts: number;
  synced: boolean;
}

/**
 * Detects whether a base64 data:image URL was truncated at Google Sheets' 3-cell (135,000 char) limit.
 */
export const isTruncatedDataImageUrl = (url?: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return trimmed.startsWith('data:image/') && trimmed.length >= 134900;
};

export const readLocalCmsSync = (): LocalCmsSyncMeta | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CMS_SYNC_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.ts === 'number') {
      return { ts: parsed.ts, synced: Boolean(parsed.synced) };
    }
  } catch {
    // ignore storage errors
  }
  return null;
};

export const writeLocalCmsSync = (meta: LocalCmsSyncMeta): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CMS_SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore storage errors
  }
};

interface PackedUiMeta {
  we?: boolean;
  wt?: string;
  wl?: string;
  bf?: Array<'contain' | 'cover'>;
  ts?: number;
}

export interface LocalWatermarkRecord {
  we: boolean;
  wt: string;
  wl: string;
  ts: number;
  synced?: boolean;
}

const parseBooleanFlag = (val: unknown, defaultValue: boolean): boolean => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'false' || lower === '0' || lower === 'off' || lower === 'tidak') return false;
    if (lower === 'true' || lower === '1' || lower === 'on' || lower === 'ya') return true;
  }
  return defaultValue;
};

export const readLocalWatermark = (): LocalWatermarkRecord | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WATERMARK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.we === 'boolean') {
      return {
        we: parsed.we,
        wt: typeof parsed.wt === 'string' ? parsed.wt : DEFAULT_SETTINGS.watermarkText || 'Powered by Intisari',
        wl: typeof parsed.wl === 'string' ? parsed.wl : '',
        ts: typeof parsed.ts === 'number' ? parsed.ts : 0,
        synced: Boolean(parsed.synced),
      };
    }
  } catch {
    // ignore storage errors
  }
  return null;
};

export const writeLocalWatermark = (record: LocalWatermarkRecord): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WATERMARK_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore storage errors
  }
};

/**
 * Strips any packed metadata suffix from searchPlaceholder so UI inputs only ever see clean text.
 */
export const stripSearchPlaceholderMeta = (rawPlaceholder?: string): string => {
  if (!rawPlaceholder) return DEFAULT_SETTINGS.searchPlaceholder;
  const idx = rawPlaceholder.indexOf(META_DELIMITER);
  const clean = idx >= 0 ? rawPlaceholder.slice(0, idx) : rawPlaceholder;
  return clean || DEFAULT_SETTINGS.searchPlaceholder;
};

const stripBannerIdMeta = (rawId?: string, fallbackIdx = 0): string => {
  const fallback = `banner-${fallbackIdx + 1}`;
  if (!rawId) return fallback;
  const idx = rawId.indexOf(META_DELIMITER);
  const clean = idx >= 0 ? rawId.slice(0, idx) : rawId;
  return clean || fallback;
};

const extractMetaFromString = (str?: unknown): PackedUiMeta | null => {
  if (typeof str !== 'string') return null;
  const idx = str.indexOf(META_DELIMITER);
  if (idx < 0) return null;
  const jsonPart = str.slice(idx + META_DELIMITER.length);
  try {
    const parsed = JSON.parse(jsonPart);
    if (parsed && typeof parsed === 'object') {
      return parsed as PackedUiMeta;
    }
  } catch {
    // ignore malformed json
  }
  return null;
};

/**
 * Loads initial settings synchronously on app boot so watermark & branding never flicker or revert.
 */
export const getInitialSettingsFromStorage = (): SiteSettings => {
  let base: SiteSettings = { ...DEFAULT_SETTINGS };
  if (typeof window === 'undefined') return base;

  try {
    const cached = localStorage.getItem(CMS_CONFIG.cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.settings && typeof parsed.settings === 'object') {
        base = unpackSettingsFromCloud(parsed.settings, base);
      }
    }
  } catch {
    // ignore cache parse errors
  }

  const localWm = readLocalWatermark();
  if (localWm) {
    base = {
      ...base,
      watermarkEnabled: localWm.we,
      watermarkText: localWm.wt,
      watermarkLink: localWm.wl,
    };
  }

  return base;
};

/**
 * Unpacks settings received from Google Apps Script (both legacy deployments and updated Code.gs)
 * or localStorage, preserving watermarkEnabled, watermarkText, watermarkLink, and banner fitMode
 * with timestamp protection against stale overwrites.
 */
export const unpackSettingsFromCloud = (
  raw: Record<string, unknown> | Partial<SiteSettings> | undefined | null,
  fallback: SiteSettings = DEFAULT_SETTINGS
): SiteSettings => {
  if (!raw || typeof raw !== 'object') {
    const localWm = readLocalWatermark();
    if (localWm) {
      return {
        ...fallback,
        watermarkEnabled: localWm.we,
        watermarkText: localWm.wt,
        watermarkLink: localWm.wl,
      };
    }
    return { ...fallback };
  }

  const record = raw as Record<string, unknown>;

  // Recombine multi-part logo if returned by an older Apps Script deployment
  let resolvedLogoUrl =
    typeof record.logoUrl === 'string' ? record.logoUrl : fallback.logoUrl || '';
  if (typeof record.logoUrl_part2 === 'string' && record.logoUrl_part2) {
    resolvedLogoUrl += record.logoUrl_part2;
  }
  if (typeof record.logoUrl_part3 === 'string' && record.logoUrl_part3) {
    resolvedLogoUrl += record.logoUrl_part3;
  }

  // Extract embedded metadata from searchPlaceholder OR banners[0].id
  const rawPlaceholder =
    typeof record.searchPlaceholder === 'string'
      ? record.searchPlaceholder
      : fallback.searchPlaceholder;

  const cleanPlaceholder = stripSearchPlaceholderMeta(rawPlaceholder);

  const rawBanners =
    Array.isArray(record.banners) && record.banners.length > 0
      ? (record.banners as BannerSlide[])
      : fallback.banners && fallback.banners.length > 0
      ? fallback.banners
      : DEFAULT_BANNERS;

  const metaFromPlaceholder = extractMetaFromString(rawPlaceholder);
  const metaFromBanner = extractMetaFromString(rawBanners[0]?.id);

  // Pick whichever packed metadata has the newer timestamp
  let packedMeta: PackedUiMeta | null = null;
  if (metaFromPlaceholder && metaFromBanner) {
    packedMeta =
      (metaFromBanner.ts || 0) > (metaFromPlaceholder.ts || 0)
        ? metaFromBanner
        : metaFromPlaceholder;
  } else {
    packedMeta = metaFromPlaceholder || metaFromBanner;
  }

  const resolvedBanners: BannerSlide[] = rawBanners.map((b, idx) => {
    const packedFit = packedMeta?.bf?.[idx];
    const explicitFit = b.fitMode === 'cover' || b.fitMode === 'contain' ? b.fitMode : undefined;
    return {
      ...b,
      id: stripBannerIdMeta(b.id, idx),
      fitMode: explicitFit || packedFit || 'contain',
    };
  });

  // Resolve Watermark settings with timestamp-aware conflict resolution
  const localWm = readLocalWatermark();
  const cloudTs = packedMeta?.ts || 0;

  let watermarkEnabled: boolean;
  let watermarkText: string;
  let watermarkLink: string;

  // Determine whether cloud packedMeta is newer than localWatermark
  const cloudHasPacked = Boolean(
    packedMeta && (typeof packedMeta.we === 'boolean' || typeof packedMeta.wt === 'string')
  );

  const shouldTrustCloudPacked =
    cloudHasPacked &&
    (!localWm ||
      cloudTs >= localWm.ts ||
      (localWm.synced === true && cloudTs > 0 && cloudTs !== localWm.ts));

  if (shouldTrustCloudPacked && packedMeta) {
    watermarkEnabled =
      typeof packedMeta.we === 'boolean' ? packedMeta.we : fallback.watermarkEnabled !== false;
    watermarkText =
      typeof packedMeta.wt === 'string'
        ? packedMeta.wt
        : fallback.watermarkText ?? 'Powered by Intisari';
    watermarkLink = typeof packedMeta.wl === 'string' ? packedMeta.wl : fallback.watermarkLink ?? '';

    // Persist newer cloud state locally so future boots stay in sync
    if (!localWm || cloudTs > localWm.ts || localWm.we !== watermarkEnabled || localWm.wt !== watermarkText || localWm.wl !== watermarkLink) {
      writeLocalWatermark({
        we: watermarkEnabled,
        wt: watermarkText,
        wl: watermarkLink,
        ts: cloudTs || Date.now(),
        synced: true,
      });
    }
  } else if (localWm) {
    // Local change is newer (or cloud is a legacy deployment without packedMeta yet) — never revert!
    watermarkEnabled = localWm.we;
    watermarkText = localWm.wt;
    watermarkLink = localWm.wl;
  } else {
    // Neither packedMeta nor localWm exists: check explicit fields on record, then fallback
    if (record.watermarkEnabled !== undefined) {
      watermarkEnabled = parseBooleanFlag(
        record.watermarkEnabled,
        fallback.watermarkEnabled !== false
      );
    } else {
      watermarkEnabled = fallback.watermarkEnabled !== false;
    }

    if (typeof record.watermarkText === 'string') {
      watermarkText = record.watermarkText;
    } else {
      watermarkText = fallback.watermarkText ?? DEFAULT_SETTINGS.watermarkText ?? 'Powered by Intisari';
    }

    if (typeof record.watermarkLink === 'string') {
      watermarkLink = record.watermarkLink;
    } else {
      watermarkLink = fallback.watermarkLink ?? '';
    }
  }

  const intervalNum = Number(record.bannerAutoSlideInterval);

  return {
    title: typeof record.title === 'string' && record.title ? record.title : fallback.title,
    subtitle:
      typeof record.subtitle === 'string' && record.subtitle ? record.subtitle : fallback.subtitle,
    searchPlaceholder: cleanPlaceholder,
    warna1: typeof record.warna1 === 'string' ? record.warna1 : fallback.warna1,
    warna2: typeof record.warna2 === 'string' ? record.warna2 : fallback.warna2,
    bannerAutoSlideInterval:
      Number.isFinite(intervalNum) && intervalNum >= 2
        ? intervalNum
        : fallback.bannerAutoSlideInterval || 4,
    banners: resolvedBanners,
    logoUrl: resolvedLogoUrl,
    logoText:
      typeof record.logoText === 'string' ? record.logoText : fallback.logoText ?? 'BTB',
    watermarkEnabled,
    watermarkText,
    watermarkLink,
  };
};

/**
 * Packs SiteSettings for saving to Google Apps Script across dual channels (searchPlaceholder + banners[0].id)
 * plus explicit top-level keys so watermark & banner fitMode persist on ALL Code.gs versions.
 */
export const packSettingsForCloud = (settings: SiteSettings, timestamp = Date.now()): SiteSettings => {
  const cleanPlaceholder = stripSearchPlaceholderMeta(settings.searchPlaceholder);
  const cleanBanners = (settings.banners || []).map((b, idx) => ({
    ...b,
    id: stripBannerIdMeta(b.id, idx),
  }));

  const meta: PackedUiMeta = {
    we: settings.watermarkEnabled !== false,
    wt: settings.watermarkText ?? '',
    wl: settings.watermarkLink ?? '',
    bf: cleanBanners.map((b) => (b.fitMode === 'cover' ? 'cover' : 'contain')),
    ts: timestamp,
  };

  const packedSuffix = `${META_DELIMITER}${JSON.stringify(meta)}`;

  const packedBanners = cleanBanners.map((b, idx) =>
    idx === 0 ? { ...b, id: `${b.id}${packedSuffix}` } : b
  );

  return {
    ...settings,
    searchPlaceholder: `${cleanPlaceholder}${packedSuffix}`,
    banners: packedBanners,
    watermarkEnabled: settings.watermarkEnabled !== false,
    watermarkText: settings.watermarkText ?? '',
    watermarkLink: settings.watermarkLink ?? '',
  };
};
