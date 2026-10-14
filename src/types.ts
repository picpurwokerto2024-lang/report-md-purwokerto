export interface BannerSlide {
  id: string;
  imageUrl: string;
  scriptText?: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  linkUrl?: string;
  hideOverlay?: boolean;
}

export interface MenuItem {
  nama: string;
  link: string;
  status: 'AKTIF' | 'NONAKTIF' | string;
  urutan: number;
  deskripsi?: string;
  warna?: string;
  kategori?: string;
}

export interface SiteSettings {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  warna1?: string;
  warna2?: string;
  bannerAutoSlideInterval?: number; // detik, default 4
  banners?: BannerSlide[];
  logoUrl?: string;
  logoText?: string;
}

export interface CMSApiResponse {
  ok: boolean;
  menus?: MenuItem[];
  settings?: Partial<SiteSettings>;
  message?: string;
}

export type ActiveTab = 'beranda' | 'menu' | 'pengaturan';

