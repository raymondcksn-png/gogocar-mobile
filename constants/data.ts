/**
 * GoGoCar 全局常量
 */

// ── 品牌色 ────────────────────────────────────────────────────────────────────
export const APP_ORANGE = '#FF6B00';
export const APP_BG = '#f2f2f7';
export const APP_CARD = '#ffffff';
export const APP_TEXT = '#1c1c1e';
export const APP_GRAY = '#8e8e93';
export const APP_BORDER = '#e5e5ea';

// ── 首頁品牌快選 ──────────────────────────────────────────────────────────────
export const HOME_BRANDS = [
  { name: 'Toyota', zh: '豐田', logo: null },
  { name: 'Honda', zh: '本田', logo: null },
  { name: 'Nissan', zh: '日產', logo: null },
  { name: 'Mazda', zh: '萬事得', logo: null },
  { name: 'BMW', zh: 'BMW', logo: null },
  { name: 'Benz', zh: '平治', logo: null },
  { name: 'Audi', zh: '奧迪', logo: null },
  { name: 'Lexus', zh: '凌志', logo: null },
  { name: 'Porsche', zh: '保時捷', logo: null },
  { name: 'Yamaha', zh: '雅馬哈', logo: null },
  { name: 'Honda-Bike', zh: '本田電單', logo: null },
  { name: '更多', zh: '更多', logo: null },
];

// ── 快選價格範圍 ──────────────────────────────────────────────────────────────
export const QUICK_PRICES = [
  { label: '10萬以下', max: 100000 },
  { label: '10-20萬', min: 100000, max: 200000 },
  { label: '20-50萬', min: 200000, max: 500000 },
  { label: '50萬以上', min: 500000 },
];

// ── 快選車齡 ──────────────────────────────────────────────────────────────────
export const QUICK_AGES = [
  { label: '3年內', maxAge: 3 },
  { label: '5年內', maxAge: 5 },
  { label: '10年內', maxAge: 10 },
  { label: '10年以上', minAge: 10 },
];

// ── 首頁分類卡片 ──────────────────────────────────────────────────────────────
export const CATEGORIES = [
  {
    title: '私家車',
    subtitle: '轎車 · SUV · MPV',
    vehicleType: 'car',
    img: null,
  },
  {
    title: '電單車',
    subtitle: '街車 · 跑車 · 踏板',
    vehicleType: 'motorcycle',
    img: null,
  },
  {
    title: '急售車源',
    subtitle: '限時優惠',
    filterType: 'tag',
    filterValue: '急售',
    img: null,
  },
  {
    title: '七人車',
    subtitle: 'MPV · 商務車',
    filterType: 'seats',
    filterValue: '7',
    img: null,
  },
];

// ── 燃油類型標籤 ──────────────────────────────────────────────────────────────
export const FUEL_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  petrol: { label: '汽油', color: '#6b7280' },
  diesel: { label: '柴油', color: '#6b7280' },
  electric: { label: '純電', color: '#16a34a' },
  hybrid: { label: '油電混合', color: '#0d9488' },
  pluginHybrid: { label: '插電混動', color: '#0d9488' },
};

// ── 變速箱類型 ────────────────────────────────────────────────────────────────
export const TRANSMISSION_LABELS: Record<string, string> = {
  auto: '自動波',
  manual: '手波',
  cvt: 'CVT',
  dct: 'DCT',
};
