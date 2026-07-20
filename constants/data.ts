/**
 * GoGoCar 全局常量 — 完全對照 WebApp mockData.ts
 */

// ── 品牌色 ────────────────────────────────────────────────────────────────────
export const APP_ORANGE = '#FF6B00';
export const APP_BG = '#f2f2f7';
export const APP_CARD = '#ffffff';
export const APP_TEXT = '#1c1c1e';
export const APP_GRAY = '#8e8e93';
export const APP_BORDER = '#e5e5ea';

// ── 首頁品牌快選（對照 WebApp HOME_BRANDS，8個，2行4列）────────────────────
export const HOME_BRANDS = [
  { name: 'BMW',        zh: '寶馬',   initial: '寶' },
  { name: 'Honda',      zh: '本田',   initial: '本' },
  { name: 'Volkswagen', zh: '福士',   initial: '福' },
  { name: 'Porsche',    zh: '保時捷', initial: '保' },
  { name: 'Toyota',     zh: '豐田',   initial: '豐' },
  { name: 'Mercedes',   zh: '平治',   initial: '平' },
  { name: 'MINI',       zh: 'MINI',   initial: 'M'  },
  { name: 'Mazda',      zh: '萬事得', initial: '萬' },
];

// ── 快選價格範圍（對照 WebApp QUICK_PRICES 字符串數組）──────────────────────
export const QUICK_PRICES = ['0-3萬', '3-8萬', '8-15萬', '15萬以上'];

// ── 快選車齡（對照 WebApp QUICK_AGES 字符串數組）────────────────────────────
export const QUICK_AGES = ['3年以下', '3-5年', '5-8年', '8年以上'];

// ── 首頁分類卡片（對照 WebApp CATEGORIES，6個，2列）──────────────────────────
export const CATEGORIES = [
  { title: '七人車', subtitle: '適合一家人出行', key: 'mpv' },
  { title: '急售',   subtitle: '賣家急套現',     key: 'urgent' },
  { title: '跑車',   subtitle: '追求刺激享受',   key: 'sports' },
  { title: '新車',   subtitle: '3年或以下',       key: 'new' },
  { title: 'SUV',    subtitle: '喜歡休閒綜合',   key: 'suv' },
  { title: '粵澳',   subtitle: '經常兩地跑',     key: 'cross' },
];

// ── 燃油類型標籤 ──────────────────────────────────────────────────────────────
export const FUEL_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  petrol:       { label: '汽油',     color: '#6b7280' },
  diesel:       { label: '柴油',     color: '#6b7280' },
  electric:     { label: '純電',     color: '#16a34a' },
  hybrid:       { label: '油電混合', color: '#0d9488' },
  pluginHybrid: { label: '插電混動', color: '#0d9488' },
};

// ── 變速箱類型 ────────────────────────────────────────────────────────────────
export const TRANSMISSION_LABELS: Record<string, string> = {
  auto:   '自動波',
  manual: '手波',
  cvt:    'CVT',
  dct:    'DCT',
};
