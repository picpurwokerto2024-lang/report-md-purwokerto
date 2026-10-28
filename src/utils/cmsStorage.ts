import { MenuItem, SiteSettings } from '../types';
import { CMS_CONFIG } from '../constants';

export interface CachedCmsPayload {
  time: number;
  data: MenuItem[];
  settings: SiteSettings;
}

const IDB_NAME = 'report_md_purwokerto_db';
const IDB_STORE = 'cms_cache_store';
const IDB_KEY = 'latest_cms_state_v2';
const LEGACY_KEYS = ['report-md-cms-cache', 'report-md-cms-v1-cache'];

let memoryCacheAvailable = false;

const openCmsDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open error'));
  });
};

/**
 * Safely writes CMS payload to IndexedDB (unlimited HD banners capacity) AND localStorage
 * with automatic quota fallback so QuotaExceededError NEVER interrupts sync or causes "Mode Cadangan".
 */
export const saveCmsCache = (payload: CachedCmsPayload): void => {
  memoryCacheAvailable = true;

  // 1. Save full high-capacity payload asynchronously to IndexedDB
  openCmsDb()
    .then((db) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(payload, IDB_KEY);
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      } catch {
        db.close();
      }
    })
    .catch(() => {
      // IndexedDB unavailable in private mode; localStorage fallback below handles it
    });

  // 2. Save to localStorage for instant synchronous boot, guarding strictly against QuotaExceededError
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(payload);
  try {
    localStorage.setItem(CMS_CONFIG.cacheKey, serialized);
    return;
  } catch {
    // Evict any obsolete legacy cache keys first and retry
    for (const oldKey of LEGACY_KEYS) {
      try {
        localStorage.removeItem(oldKey);
      } catch {}
    }
    try {
      localStorage.setItem(CMS_CONFIG.cacheKey, serialized);
      return;
    } catch {
      // Payload exceeds browser's ~5MB UTF-16 localStorage ceiling (e.g. 6+ HD banners).
      // Save a compact fast-boot copy in localStorage while full HD images live in IndexedDB!
      try {
        const compactMenus = payload.data.map((m) => ({
          ...m,
          fotoUrl: m.fotoUrl && m.fotoUrl.startsWith('data:image/') ? '' : m.fotoUrl,
        }));
        const compactBanners = (payload.settings.banners || []).filter(
          (b, idx) => idx === 0 || !b.imageUrl?.startsWith('data:image/')
        );
        const compactSettings: SiteSettings = {
          ...payload.settings,
          banners: compactBanners,
        };
        localStorage.setItem(
          CMS_CONFIG.cacheKey,
          JSON.stringify({
            time: payload.time,
            data: compactMenus,
            settings: compactSettings,
            compact: true,
          })
        );
      } catch {
        // Ignore completely if storage is locked
      }
    }
  }
};

/**
 * Synchronous read from localStorage for instant 0ms initial render.
 */
export const readSyncCmsCache = (): (CachedCmsPayload & { compact?: boolean }) | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CMS_CONFIG.cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
      memoryCacheAvailable = true;
      return parsed;
    }
  } catch {
    // ignore corrupt cache
  }
  return null;
};

/**
 * Asynchronous read from IndexedDB (retrieves full HD banners even if localStorage used compact fallback).
 */
export const readAsyncCmsCache = async (): Promise<CachedCmsPayload | null> => {
  try {
    const db = await openCmsDb();
    return await new Promise<CachedCmsPayload | null>((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = () => {
          db.close();
          const val = req.result as CachedCmsPayload | undefined;
          if (val && Array.isArray(val.data) && val.data.length > 0) {
            memoryCacheAvailable = true;
            resolve(val);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    });
  } catch {
    return null;
  }
};

export const hasUsableLocalCache = (): boolean => {
  if (memoryCacheAvailable) return true;
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(localStorage.getItem(CMS_CONFIG.cacheKey));
  } catch {
    return false;
  }
};
