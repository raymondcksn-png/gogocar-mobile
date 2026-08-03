/**
 * 買車列表頁 — 完全對齊 WebApp v2.5 UI
 * 結構：標題欄(買車+地區切換) → 搜索欄 → 單行篩選欄(排序|汽車/電單車|品牌|價格|車齡) → 車源列表
 * 跨境牌照作為進階選項（篩選欄末尾可展開）
 * AsyncStorage 持久化地區選擇，默認澳門
 */
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, Dimensions, ScrollView, Modal,
  Pressable, Platform, Animated, PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { trpc, resolveImageUrl } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER, FUEL_TYPE_LABELS } from '../../constants/data';

const { width: SCREEN_W } = Dimensions.get('window');
const REGION_KEY = 'gogocar_buy_region';
const APP_ORANGE_LIGHT = '#fff7ed';

// ─── 常量 ────────────────────────────────────────────────
const SORT_OPTIONS = [
  { label: '最新上架', value: 'newest' },
  { label: '價格最低', value: 'price_asc' },
  { label: '價格最高', value: 'price_desc' },
  { label: '車齡最短', value: 'year_desc' },
  { label: '里程最少', value: 'mileage_asc' },
];
const CAR_PRICE_OPTIONS = [
  { label: '不限', min: undefined, max: undefined },
  { label: '0-3萬', min: 0, max: 30000 },
  { label: '3-8萬', min: 30000, max: 80000 },
  { label: '8-15萬', min: 80000, max: 150000 },
  { label: '15萬以上', min: 150000, max: undefined },
];
const MOTO_PRICE_OPTIONS = [
  { label: '不限', min: undefined, max: undefined },
  { label: '0-1萬', min: 0, max: 10000 },
  { label: '1-2萬', min: 10000, max: 20000 },
  { label: '2-5萬', min: 20000, max: 50000 },
  { label: '5萬以上', min: 50000, max: undefined },
];
const AGE_OPTIONS = [
  { label: '不限', value: undefined },
  { label: '3年以下', value: 3 },
  { label: '3-5年', value: 5 },
  { label: '5-8年', value: 8 },
  { label: '8年以上', value: 99 },
];
const PLATE_FILTERS = [
  { label: '連港澳牌', value: 'hk_macao' },
  { label: '連粵港牌', value: 'gd_hk' },
  { label: '連粵澳牌', value: 'gd_macao' },
  { label: '連三地牌', value: 'triple' },
];
type ActivePanel = 'sort' | 'brand' | 'price' | 'age' | null;
type VehicleType = 'car' | 'motorcycle';
type Region = 'macau' | 'hongkong';

// ─── 篩選按鈕（對齊 WebApp FilterBtn）────────────────────
function FilterBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[fb.btn, active && fb.btnActive]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Text style={[fb.text, active && fb.textActive]}>{label}</Text>
      <Text style={[fb.arrow, active && fb.arrowActive]}>▾</Text>
    </TouchableOpacity>
  );
}
const fb = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 42 },
  btnActive: {},
  text: { fontSize: 14, color: APP_TEXT, fontWeight: '400' },
  textActive: { color: APP_ORANGE, fontWeight: '600' },
  arrow: { fontSize: 14, color: APP_GRAY, marginLeft: 3 },
  arrowActive: { color: APP_ORANGE },
});

// ─── 下拉面板（緊貼篩選欄，不全屏覆蓋）────────────────────
function DropdownPanel({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      {/* 透明遮罩，點擊關閉，不遮擋面板本身 */}
      <Pressable
        style={{ position: 'absolute', top: 42, left: 0, right: 0, bottom: -2000, zIndex: 199 }}
        onPress={onClose}
      />
      <View style={dp.panel}>
        <Text style={dp.title}>{title}</Text>
        {children}
      </View>
    </>
  );
}
function DropdownOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[dp.opt, active && dp.optActive]} onPress={onPress} activeOpacity={0.6}>
      <Text style={[dp.optText, active && dp.optTextActive]}>{label}</Text>
      {active && <Text style={{ color: APP_ORANGE, fontSize: 15 }}>✓</Text>}
    </TouchableOpacity>
  );
}
const dp = StyleSheet.create({
  panel: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
    paddingBottom: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 10,
    borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.06)',
    zIndex: 200,
  },
  title: { fontSize: 11, color: APP_GRAY, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 2, fontWeight: '500' },
  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  optActive: { backgroundColor: APP_ORANGE_LIGHT },
  optText: { fontSize: 14, color: APP_TEXT },
  optTextActive: { color: APP_ORANGE, fontWeight: '600' },
});

// ─── 品牌選擇 Modal（支持向下滑手勢關閉）────────────────────
function BrandModal({ brands, selectedBrandId, onSelect, onClear, onClose }: {
  brands: any[]; selectedBrandId: number | undefined;
  onSelect: (id: number, name: string) => void;
  onClear: () => void; onClose: () => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(translateY, { toValue: 600, duration: 200, useNativeDriver: true }).start(onClose);
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;
  const { hotBrands, grouped, letters } = useMemo(() => {
    const hot = brands.filter(b => b.logoUrl && b.showOnHome).slice(0, 8);
    const g: Record<string, any[]> = {};
    brands.forEach(b => {
      const k = (b.name || '').charAt(0).toUpperCase();
      if (!g[k]) g[k] = [];
      g[k].push(b);
    });
    return { hotBrands: hot, grouped: g, letters: Object.keys(g).sort() };
  }, [brands]);
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={bm.overlay}>
        <Animated.View style={[bm.panel, { transform: [{ translateY }] }]}>
          {/* 拖拉條 + 手勢區域 */}
          <View {...panResponder.panHandlers} style={bm.dragHandle}>
            <View style={bm.dragBar} />
          </View>
          <View style={bm.header}>
            <Text style={bm.title}>選擇品牌</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={bm.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={[bm.clearBtn, !selectedBrandId && bm.clearBtnActive]}
              onPress={onClear}
            >
              <Text style={[bm.clearText, !selectedBrandId && bm.clearTextActive]}>不限品牌</Text>
            </TouchableOpacity>
            {hotBrands.length > 0 && (
              <>
                <Text style={bm.sectionLabel}>熱門品牌</Text>
                <View style={bm.hotGrid}>
                  {hotBrands.map(b => (
                    <TouchableOpacity
                      key={b.id}
                      style={[bm.hotItem, selectedBrandId === b.id && bm.hotItemActive]}
                      onPress={() => onSelect(b.id, b.brandNameZh || b.name)}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: resolveImageUrl(b.logoUrl) || '' }} style={bm.hotLogo} contentFit="contain" />
                      <Text style={bm.hotName} numberOfLines={1}>{b.brandNameZh || b.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            {letters.map(letter => (
              <View key={letter}>
                <View style={bm.letterRow}><Text style={bm.letterText}>{letter}</Text></View>
                {grouped[letter].map(b => (
                  <TouchableOpacity
                    key={b.id}
                    style={[bm.brandRow, selectedBrandId === b.id && bm.brandRowActive]}
                    onPress={() => onSelect(b.id, b.brandNameZh || b.name)}
                    activeOpacity={0.7}
                  >
                    {b.logoUrl
                      ? <Image source={{ uri: resolveImageUrl(b.logoUrl) || '' }} style={bm.rowLogo} contentFit="contain" />
                      : <View style={bm.rowLogoEmpty} />}
                    <Text style={[bm.brandName, selectedBrandId === b.id && bm.brandNameActive]}>
                      {b.brandNameZh ? `${b.brandNameZh}  ${b.name}` : b.name}
                    </Text>
                    {selectedBrandId === b.id && <Text style={{ color: APP_ORANGE, fontSize: 16, marginLeft: 'auto' }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <View style={{ height: 48 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
// ─── 進階篩選 Modal（標籤篩選，大廠做法：底部 Sheet）────────────────────────
function AdvancedFilterModal({ tags, selectedTags, onToggle, onClear, onClose }: {
  tags: any[]; selectedTags: string[];
  onToggle: (name: string) => void;
  onClear: () => void; onClose: () => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) {
          Animated.timing(translateY, { toValue: 600, duration: 200, useNativeDriver: true }).start(onClose);
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={bm.overlay}>
        <Animated.View style={[bm.panel, { transform: [{ translateY }] }]}>
          <View {...panResponder.panHandlers} style={bm.dragHandle}>
            <View style={bm.dragBar} />
          </View>
          <View style={bm.header}>
            <Text style={bm.title}>進階篩選</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={bm.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
            <Text style={bm.sectionLabel}>車輛標籤</Text>
            <Text style={{ fontSize: 12, color: APP_GRAY, marginBottom: 12 }}>選擇你感興趣的車輛特色，可多選</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {tags.map(tag => {
                const active = selectedTags.includes(tag.name);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    onPress={() => onToggle(tag.name)}
                    activeOpacity={0.7}
                    style={[
                      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                        borderColor: active ? (tag.color || APP_ORANGE) : APP_BORDER,
                        backgroundColor: active ? (tag.color || APP_ORANGE) + '18' : '#fff' }
                    ]}
                  >
                    <Text style={{ fontSize: 14, color: active ? (tag.color || APP_ORANGE) : APP_TEXT, fontWeight: active ? '600' : '400' }}>
                      {tag.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedTags.length > 0 && (
              <TouchableOpacity
                onPress={onClear}
                style={{ marginTop: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f5f5f5', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, color: APP_GRAY }}>清除標籤篩選</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
const bm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  panel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%', paddingBottom: 20 },
  dragHandle: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  dragBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0e0e0' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.08)' },
  title: { fontSize: 16, fontWeight: '700', color: APP_TEXT },
  close: { fontSize: 18, color: APP_GRAY },
  clearBtn: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, paddingVertical: 11, borderRadius: 8, borderWidth: 1, borderColor: APP_BORDER, alignItems: 'center' },
  clearBtnActive: { borderColor: APP_ORANGE, backgroundColor: APP_ORANGE_LIGHT },
  clearText: { fontSize: 14, color: APP_GRAY },
  clearTextActive: { color: APP_ORANGE, fontWeight: '600' },
  sectionLabel: { fontSize: 11, color: APP_GRAY, marginHorizontal: 16, marginTop: 16, marginBottom: 8, fontWeight: '500' },
  hotGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  hotItem: { width: (SCREEN_W - 32) / 4, alignItems: 'center', paddingVertical: 10, borderRadius: 8 },
  hotItemActive: { backgroundColor: APP_ORANGE_LIGHT },
  hotLogo: { width: 44, height: 44, marginBottom: 4 },
  hotName: { fontSize: 11, color: APP_TEXT, textAlign: 'center' },
  letterRow: { backgroundColor: '#f8f8f8', paddingHorizontal: 16, paddingVertical: 5 },
  letterText: { fontSize: 12, fontWeight: '700', color: APP_GRAY },
  brandRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  brandRowActive: { backgroundColor: APP_ORANGE_LIGHT },
  rowLogo: { width: 28, height: 28, marginRight: 12 },
  rowLogoEmpty: { width: 28, height: 28, marginRight: 12 },
  brandName: { fontSize: 14, color: APP_TEXT },
  brandNameActive: { color: APP_ORANGE, fontWeight: '600' },
});

// ─── 車源列表項 ───────────────────────────────────────────
function PostItem({ post, tagColorMap }: { post: any; tagColorMap: Record<string, string> }) {
  const router = useRouter();
  const brandDisplay = post.brand || post.brandName || '';
  const modelDisplay = post.modelSeries || post.modelName || '';
  const title = [brandDisplay, modelDisplay].filter(Boolean).join(' ') || '未命名車源';
  const price = post.price && Number(post.price) > 0
    ? `HKD ${Number(post.price).toLocaleString()}` : '面議';
  const img = resolveImageUrl(post.coverImageUrl || post.coverUrl);
  const meta = [
    post.year ? `${post.year}年` : null,
    (post.mileage || post.mileageKm) ? `${Number(post.mileage || post.mileageKm).toLocaleString()}km` : null,
    post.transmission || null,
  ].filter(Boolean).join(' · ');
  const tags: string[] = Array.isArray(post.tags) ? post.tags : [];
  const fuelInfo = post.fuelType ? FUEL_TYPE_LABELS[post.fuelType] : null;
  const now = new Date();
  const isPinned = post.pinnedExpireAt && new Date(post.pinnedExpireAt) > now;
  const isFeatured = !isPinned && post.featuredExpireAt && new Date(post.featuredExpireAt) > now;
  const plates: string[] = Array.isArray(post.includedPlates) ? post.includedPlates
    : (typeof post.includedPlates === 'string' ? (() => { try { return JSON.parse(post.includedPlates); } catch { return []; } })() : []);
  const plateLabels: { label: string; color: string }[] = [];
  if (plates.includes('triple')) plateLabels.push({ label: '🟡 連三地牌', color: '#d97706' });
  else {
    if (plates.includes('hk_macao')) plateLabels.push({ label: '🔵 連港澳牌', color: '#2563eb' });
    if (plates.includes('gd_hk')) plateLabels.push({ label: '🟢 連粵港牌', color: '#16a34a' });
    if (plates.includes('gd_macao')) plateLabels.push({ label: '🟢 連粵澳牌', color: '#16a34a' });
  }
  return (
    <TouchableOpacity style={pi.wrap} activeOpacity={0.72} onPress={() => router.push(`/vehicle/${post.id}`)}>
      <View style={pi.imgWrap}>
        {img
          ? <Image source={{ uri: img }} style={pi.img} contentFit="cover" />
          : <View style={[pi.img, pi.imgEmpty]}><Text style={{ color: '#ccc', fontSize: 11 }}>無圖片</Text></View>}
        {isPinned && <View style={pi.badge}><Text style={pi.badgeText}>置頂</Text></View>}
        {isFeatured && <View style={[pi.badge, { backgroundColor: APP_ORANGE }]}><Text style={pi.badgeText}>精選</Text></View>}
        {post.video_url && (
          <View style={pi.videoIcon}>
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="#fff"><Path d="M8 5v14l11-7z" /></Svg>
          </View>
        )}
      </View>
      <View style={pi.info}>
        <Text style={pi.title} numberOfLines={2}>
          <Text style={{ fontWeight: '600' }}>{title}</Text>
          {post.subtitle ? <Text style={{ color: APP_GRAY, fontWeight: '400' }}> · {post.subtitle}</Text> : null}
        </Text>
        {meta ? <Text style={pi.meta}>{meta}</Text> : null}
        {(tags.length > 0 || fuelInfo || plateLabels.length > 0) && (
          <View style={pi.tagsRow}>
            {plateLabels.map((pl, i) => (
              <View key={`pl-${i}`} style={[pi.chip, { backgroundColor: pl.color }]}>
                <Text style={pi.chipText}>{pl.label}</Text>
              </View>
            ))}
            {tags.map((tag, i) => (
              <View key={i} style={[pi.chip, { backgroundColor: tagColorMap[tag] || (i % 2 === 0 ? APP_ORANGE : '#3b82f6') }]}>
                <Text style={pi.chipText}>{tag}</Text>
              </View>
            ))}
            {fuelInfo && (
              <View style={[pi.chip, { backgroundColor: fuelInfo.color }]}>
                <Text style={pi.chipText}>{fuelInfo.label}</Text>
              </View>
            )}
          </View>
        )}
        <Text style={pi.price}>{price}</Text>
      </View>
    </TouchableOpacity>
  );
}
const pi = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10, borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  imgWrap: { width: 120, height: 90, position: 'relative' },
  img: { width: 120, height: 90 },
  imgEmpty: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  badge: { position: 'absolute', top: 6, left: 6, backgroundColor: '#ef4444', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  videoIcon: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, padding: 10, justifyContent: 'space-between' },
  title: { fontSize: 16, color: APP_TEXT, lineHeight: 22, letterSpacing: -0.3, fontWeight: '600' },
  meta: { fontSize: 13, color: APP_GRAY, marginTop: 3 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  chip: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  price: { fontSize: 18, fontWeight: '700', color: APP_ORANGE, letterSpacing: -0.3, marginTop: 5 },
});

// ─── 主頁面 ───────────────────────────────────────────────
export default function BuyScreen() {
  // 地區（AsyncStorage 持久化）
  const [region, setRegion] = useState<Region>('macau');
  const [regionLoaded, setRegionLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(REGION_KEY)
      .then(v => { if (v === 'macau' || v === 'hongkong') setRegion(v); })
      .catch(() => {})
      .finally(() => setRegionLoaded(true));
  }, []);

  // 篩選狀態
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  // 接收搜索頁傳來的參數
  const params = useLocalSearchParams<{ search?: string; brand?: string; vehicleType?: string; minPrice?: string; maxPrice?: string; maxAge?: string; sortBy?: string }>();
  const [sortBy, setSortBy] = useState(params.sortBy || 'newest');
  const [selectedBrandId, setSelectedBrandId] = useState<number | undefined>(undefined);
  const [selectedBrandName, setSelectedBrandName] = useState(params.brand || '');
  const [priceIdx, setPriceIdx] = useState(0);
  const [ageIdx, setAgeIdx] = useState(0);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [includedPlate, setIncludedPlate] = useState<string | undefined>(undefined);
  const [showPlateFilter, setShowPlateFilter] = useState(false);
  const [searchInput, setSearchInput] = useState(params.search || '');
  const [search, setSearch] = useState(params.search || '');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  // 切換車輛類型時重置價格
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    setPriceIdx(0);
    setSelectedBrandId(undefined);
    setSelectedBrandName('');
  }, [vehicleType]);

  const priceOptions = vehicleType === 'motorcycle' ? MOTO_PRICE_OPTIONS : CAR_PRICE_OPTIONS;

  // 分頁
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // API 查詢
  const { data: brandsData } = trpc.vehicle.getBrands.useQuery(
    { vehicleType: vehicleType as any },
    { enabled: regionLoaded }
  );
  const brands = useMemo(() => (brandsData as any[]) || [], [brandsData]);
  const { data: tagsData } = trpc.vehicle.getActiveTags.useQuery();
  const tagColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    (tagsData || []).forEach((t: any) => { if (t.name && t.color) map[t.name] = t.color; });
    return map;
  }, [tagsData]);

  const queryParams = useMemo(() => ({
    vehicleType: vehicleType || undefined,
    search: search || undefined,
    sortBy: sortBy as any,
    page, pageSize: 20,
    region: region as any,
    includedPlate: includedPlate as any,
    brandId: selectedBrandId,
    minPrice: priceOptions[priceIdx]?.min,
    maxPrice: priceOptions[priceIdx]?.max,
    maxAge: AGE_OPTIONS[ageIdx]?.value,
  }), [vehicleType, search, sortBy, page, region, includedPlate, selectedBrandId, priceOptions, priceIdx, ageIdx]);

  const { data, isLoading, refetch } = trpc.vehicle.listPosts.useQuery(
    queryParams as any,
    { enabled: regionLoaded }
  );

  useEffect(() => {
    if (!data) return;
    const items = (data as any).items || [];
    if (page === 1) setAllItems(items);
    else setAllItems(prev => [...prev, ...items]);
    setHasMore(items.length === 20);
    setRefreshing(false);
  }, [data, page]);

  const resetPage = useCallback(() => { setPage(1); setAllItems([]); }, []);
  const handleRefresh = useCallback(() => { setRefreshing(true); setPage(1); setAllItems([]); refetch(); }, [refetch]);
  const handleLoadMore = useCallback(() => { if (!hasMore || isLoading) return; setPage(p => p + 1); }, [hasMore, isLoading]);
  const handleSearch = () => { setSearch(searchInput); resetPage(); };
  const togglePanel = (p: ActivePanel) => setActivePanel(prev => prev === p ? null : p);
  const closePanel = () => setActivePanel(null);

  const handleRegionChange = (r: Region) => {
    setRegion(r);
    AsyncStorage.setItem(REGION_KEY, r).catch(() => {});
    setIncludedPlate(undefined);
    setShowPlateFilter(false);
    resetPage();
  };
  const handleTypeToggle = () => {
    setVehicleType(prev => prev === 'car' ? 'motorcycle' : 'car');
    closePanel();
    resetPage();
  };

  const hasActiveFilters = !!selectedBrandId || priceIdx !== 0 || ageIdx !== 0 || !!includedPlate;
  const total = (data as any)?.total;

  if (!regionLoaded) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={APP_ORANGE} size="large" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* ── 標題欄：買車 + 地區切換 ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>買車</Text>
        <View style={s.regionSwitch}>
          {(['macau', 'hongkong'] as Region[]).map(r => (
            <TouchableOpacity
              key={r}
              style={[s.regionBtn, region === r && s.regionBtnActive]}
              onPress={() => handleRegionChange(r)}
              activeOpacity={0.7}
            >
              <Text style={[s.regionBtnText, region === r && s.regionBtnTextActive]}>
                {r === 'macau' ? '🇲🇴 澳門' : '🇭🇰 香港'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── 搜索欄（點擊跳搜索頁） ── */}
      <TouchableOpacity style={s.searchWrap} activeOpacity={0.7} onPress={() => router.push('/search')}>
        <View style={s.searchBar}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
            <Path d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" stroke={APP_GRAY} strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
          <Text style={{ flex: 1, fontSize: 15, color: APP_GRAY }}>搜索品牌、車系、年份...</Text>
        </View>
      </TouchableOpacity>

      {/* ── 篩選菜單欄（sticky，對齊 WebApp）── */}
      <View style={s.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
          <View style={s.filterBarInner}>
            {/* 排序 */}
            <FilterBtn
              label={sortBy === 'newest' ? '排序' : SORT_OPTIONS.find(s => s.value === sortBy)?.label || '排序'}
              active={activePanel === 'sort' || sortBy !== 'newest'}
              onPress={() => togglePanel('sort')}
            />
            <View style={s.filterDivider} />
            {/* 汽車/電單車 切換（橙色，對齊 WebApp）*/}
            <TouchableOpacity style={s.typeToggle} onPress={handleTypeToggle} activeOpacity={0.6}>
              <Text style={s.typeToggleText}>{vehicleType === 'car' ? '汽車' : '電單車'}</Text>
              <Text style={s.typeToggleArrow}>▾</Text>
            </TouchableOpacity>
            <View style={s.filterDivider} />
            {/* 品牌 */}
            <FilterBtn
              label={selectedBrandName || '品牌'}
              active={activePanel === 'brand' || !!selectedBrandId}
              onPress={() => togglePanel('brand')}
            />
            {/* 價格 */}
            <FilterBtn
              label={priceIdx === 0 ? '價格' : priceOptions[priceIdx]?.label || '價格'}
              active={activePanel === 'price' || priceIdx !== 0}
              onPress={() => togglePanel('price')}
            />
            {/* 車齡 */}
            <FilterBtn
              label={ageIdx === 0 ? '車齡' : AGE_OPTIONS[ageIdx]?.label || '車齡'}
              active={activePanel === 'age' || ageIdx !== 0}
              onPress={() => togglePanel('age')}
            />
            {/* 跨境牌照（進階選項，折疊）*/}
            <TouchableOpacity
              style={[s.plateToggle, (showPlateFilter || !!includedPlate) && s.plateToggleActive]}
              onPress={() => setShowPlateFilter(p => !p)}
              activeOpacity={0.6}
            >
              <Text style={[s.plateToggleText, (showPlateFilter || !!includedPlate) && s.plateToggleTextActive]}>
                {includedPlate ? PLATE_FILTERS.find(p => p.value === includedPlate)?.label || '跨境牌' : '跨境牌'}
              </Text>
              <Text style={[s.typeToggleArrow, (showPlateFilter || !!includedPlate) && { color: APP_ORANGE }]}>▾</Text>
            </TouchableOpacity>
            {/* 進階篩選按鈕 */}
            <TouchableOpacity
              style={[s.plateToggle, (showAdvancedFilter || selectedTags.length > 0) && s.plateToggleActive]}
              onPress={() => setShowAdvancedFilter(true)}
              activeOpacity={0.6}
            >
              <Text style={[s.plateToggleText, (showAdvancedFilter || selectedTags.length > 0) && { color: APP_ORANGE, fontWeight: '600' }]}>
                {selectedTags.length > 0 ? `進階(${selectedTags.length})` : '進階'}
              </Text>
              <Text style={[s.typeToggleArrow, { color: (showAdvancedFilter || selectedTags.length > 0) ? APP_ORANGE : APP_GRAY }]}>▾</Text>
            </TouchableOpacity>
            {/* 結果數量 */}
            {total != null && (
              <Text style={s.countText}>共 {total} 輛</Text>
            )}
          </View>
        </ScrollView>

        {/* 下拉面板（在篩選欄下方展開）*/}
        {activePanel === 'sort' && (
          <DropdownPanel title="排序方式" onClose={closePanel}>
            {SORT_OPTIONS.map(opt => (
              <DropdownOption key={opt.value} label={opt.label} active={sortBy === opt.value}
                onPress={() => { setSortBy(opt.value); resetPage(); closePanel(); }} />
            ))}
          </DropdownPanel>
        )}
        {activePanel === 'price' && (
          <DropdownPanel title="價格區間" onClose={closePanel}>
            {priceOptions.map((opt, i) => (
              <DropdownOption key={i} label={opt.label} active={priceIdx === i}
                onPress={() => { setPriceIdx(i); resetPage(); closePanel(); }} />
            ))}
          </DropdownPanel>
        )}
        {activePanel === 'age' && (
          <DropdownPanel title="車齡區間" onClose={closePanel}>
            {AGE_OPTIONS.map((opt, i) => (
              <DropdownOption key={i} label={opt.label} active={ageIdx === i}
                onPress={() => { setAgeIdx(i); resetPage(); closePanel(); }} />
            ))}
          </DropdownPanel>
        )}
      </View>

      {/* ── 跨境牌照篩選（展開後顯示）── */}
      {showPlateFilter && vehicleType === 'car' && (
        <View style={s.plateRow}>
          <TouchableOpacity
            style={[s.plateChip, !includedPlate && s.plateChipActive]}
            onPress={() => { setIncludedPlate(undefined); resetPage(); }}
            activeOpacity={0.7}
          >
            <Text style={[s.plateChipText, !includedPlate && s.plateChipTextActive]}>不限</Text>
          </TouchableOpacity>
          {PLATE_FILTERS.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[s.plateChip, includedPlate === p.value && s.plateChipActive]}
              onPress={() => { setIncludedPlate(prev => prev === p.value ? undefined : p.value); resetPage(); }}
              activeOpacity={0.7}
            >
              <Text style={[s.plateChipText, includedPlate === p.value && s.plateChipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── 已選篩選標籤 ── */}
      {hasActiveFilters && (
        <View style={s.activeTagsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {selectedBrandName ? (
              <TouchableOpacity style={s.activeTag} onPress={() => { setSelectedBrandId(undefined); setSelectedBrandName(''); resetPage(); }}>
                <Text style={s.activeTagText}>{selectedBrandName} ✕</Text>
              </TouchableOpacity>
            ) : null}
            {priceIdx !== 0 ? (
              <TouchableOpacity style={s.activeTag} onPress={() => { setPriceIdx(0); resetPage(); }}>
                <Text style={s.activeTagText}>{priceOptions[priceIdx]?.label} ✕</Text>
              </TouchableOpacity>
            ) : null}
            {ageIdx !== 0 ? (
              <TouchableOpacity style={s.activeTag} onPress={() => { setAgeIdx(0); resetPage(); }}>
                <Text style={s.activeTagText}>{AGE_OPTIONS[ageIdx]?.label} ✕</Text>
              </TouchableOpacity>
            ) : null}
            {includedPlate ? (
              <TouchableOpacity style={s.activeTag} onPress={() => { setIncludedPlate(undefined); resetPage(); }}>
                <Text style={s.activeTagText}>{PLATE_FILTERS.find(p => p.value === includedPlate)?.label} ✕</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[s.activeTag, { backgroundColor: '#fee2e2' }]}
              onPress={() => { setSelectedBrandId(undefined); setSelectedBrandName(''); setPriceIdx(0); setAgeIdx(0); setIncludedPlate(undefined); setSortBy('newest'); resetPage(); }}>
              <Text style={[s.activeTagText, { color: '#ef4444' }]}>清除全部</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* ── 品牌 Modal ── */}
      {activePanel === 'brand' && (
        <BrandModal
          brands={brands}
          selectedBrandId={selectedBrandId}
          onSelect={(id, name) => { setSelectedBrandId(id); setSelectedBrandName(name); resetPage(); closePanel(); }}
          onClear={() => { setSelectedBrandId(undefined); setSelectedBrandName(''); resetPage(); closePanel(); }}
          onClose={closePanel}
        />
      )}

      {/* ── 進階篩選 Modal ── */}
      {showAdvancedFilter && (
        <AdvancedFilterModal
          tags={(tagsData || []) as any[]}
          selectedTags={selectedTags}
          onToggle={(name) => setSelectedTags(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name])}
          onClear={() => { setSelectedTags([]); resetPage(); }}
          onClose={() => setShowAdvancedFilter(false)}
        />
      )}

      {/* ── 車源列表 ── */}
      <FlatList
        data={allItems}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => <PostItem post={item} tagColorMap={tagColorMap} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={APP_ORANGE} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          isLoading ? (
            <View style={s.loading}><ActivityIndicator color={APP_ORANGE} size="large" /></View>
          ) : (
            <View style={s.emptyWrap}>
              <Text style={s.emptyIcon}>🚗</Text>
              <Text style={s.emptyText}>{region === 'hongkong' ? '香港車源即將上線' : '暫無符合條件的車源'}</Text>
              {region === 'hongkong' && <Text style={s.emptyHint}>敬請期待，或切換至澳門查看車源</Text>}
            </View>
          )
        }
        ListFooterComponent={
          !isLoading && allItems.length > 0
            ? hasMore
              ? <View style={s.loadingMore}><ActivityIndicator color={APP_ORANGE} size="small" /></View>
              : <Text style={s.noMore}>已顯示全部車源</Text>
            : null
        }
      />
    </View>
  );
}

// ─── 樣式 ─────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },

  // 標題欄
  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: APP_TEXT, letterSpacing: -0.5 },
  regionSwitch: { flexDirection: 'row', backgroundColor: '#f2f2f7', borderRadius: 20, padding: 2 },
  regionBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 18 },
  regionBtnActive: { backgroundColor: APP_ORANGE },
  regionBtnText: { fontSize: 13, color: APP_GRAY, fontWeight: '500' },
  regionBtnTextActive: { color: '#fff', fontWeight: '700' },

  // 搜索欄（無底部邊框，與篩選欄無縫連接）
  searchWrap: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f2f7', borderRadius: 22, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 15, color: APP_TEXT },

  // 篩選欄（與搜索欄無縫連接）
  filterBar: { backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)', zIndex: 100, overflow: 'visible' },
  filterBarInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  filterDivider: { width: 0.5, height: 16, backgroundColor: 'rgba(0,0,0,0.12)', marginHorizontal: 2 },

  // 汽車/電單車切換（橙色）
  typeToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 42 },
  typeToggleText: { fontSize: 13, color: APP_ORANGE, fontWeight: '600' },
  typeToggleArrow: { fontSize: 14, color: APP_ORANGE, marginLeft: 3 },

  // 跨境牌照進階選項
  plateToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 42 },
  plateToggleActive: {},
  plateToggleText: { fontSize: 13, color: APP_TEXT },
  plateToggleTextActive: { color: APP_ORANGE, fontWeight: '600' },

  // 結果數量
  countText: { fontSize: 12, color: APP_GRAY, paddingHorizontal: 10, alignSelf: 'center' },

  // 跨境牌照展開行
  plateRow: { backgroundColor: '#fff', flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6, flexWrap: 'wrap', borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  plateChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f2f2f7', borderWidth: 1, borderColor: 'transparent' },
  plateChipActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  plateChipText: { fontSize: 13, color: APP_GRAY },
  plateChipTextActive: { color: '#2563eb', fontWeight: '600' },

  // 已選篩選標籤
  activeTagsRow: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  activeTag: { backgroundColor: APP_ORANGE_LIGHT, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6 },
  activeTagText: { fontSize: 12, color: APP_ORANGE },

  // 空狀態 / 加載
  loading: { paddingVertical: 48, alignItems: 'center' },
  emptyWrap: { paddingVertical: 64, alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: APP_GRAY, textAlign: 'center' },
  emptyHint: { fontSize: 12, color: APP_GRAY, marginTop: 6, textAlign: 'center' },
  loadingMore: { paddingVertical: 16, alignItems: 'center' },
  noMore: { textAlign: 'center', paddingVertical: 16, color: APP_GRAY, fontSize: 13 },
});
