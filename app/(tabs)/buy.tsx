/**
 * 買車列表頁 — 統一篩選 v2.5
 * 對齊 WebApp AppBuy.tsx v2.5：品牌篩選 + 價格區間 + 車齡篩選 + 地區 Tab + 跨境牌照篩選
 * AsyncStorage 持久化地區選擇，默認澳門
 */
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, Dimensions, ScrollView, Modal, Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { trpc, resolveImageUrl } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER, FUEL_TYPE_LABELS } from '../../constants/data';

const { width: SCREEN_W } = Dimensions.get('window');
const REGION_KEY = 'gogocar_buy_region';

const REGION_TABS = [
  { label: '🇲🇴 澳門', value: 'macau' },
  { label: '🇭🇰 香港', value: 'hongkong' },
];
const PLATE_FILTERS = [
  { label: '連港澳牌', value: 'hk_macao' },
  { label: '連粵港牌', value: 'gd_hk' },
  { label: '連粵澳牌', value: 'gd_macao' },
  { label: '連三地牌', value: 'triple' },
];
const VEHICLE_TYPES = [
  { label: '全部', value: '' },
  { label: '私家車', value: 'car' },
  { label: '電單車', value: 'motorcycle' },
  { label: '商用車', value: 'commercial' },
];
const SORT_OPTIONS = [
  { label: '最新上線', value: 'newest' },
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
type ActivePanel = 'sort' | 'brand' | 'price' | 'age' | null;

function PostListItem({ post, tagColorMap }: { post: any; tagColorMap?: Record<string, string> }) {
  const router = useRouter();
  const brandDisplay = post.brand || post.brandName || '';
  const modelDisplay = post.modelSeries || post.modelName || '';
  const infoLine = [brandDisplay, modelDisplay].filter(Boolean).join(' ') || '未命名車源';
  const priceTxt = post.price && Number(post.price) > 0 ? `HKD ${Number(post.price).toLocaleString()}` : '面議';
  const img = resolveImageUrl(post.coverImageUrl || post.coverUrl);
  const detailParts = [
    post.year ? `${post.year}年` : null,
    (post.mileage || post.mileageKm) ? `${(post.mileage || post.mileageKm).toLocaleString()}km` : null,
    post.transmission || null,
  ].filter(Boolean);
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const fuelInfo = post.fuelType ? FUEL_TYPE_LABELS[post.fuelType] : null;
  const now = new Date();
  const isPinned = post.pinnedExpireAt && new Date(post.pinnedExpireAt) > now;
  const isFeatured = !isPinned && post.featuredExpireAt && new Date(post.featuredExpireAt) > now;
  const plateLabels: { label: string; color: string }[] = [];
  const plates: string[] = Array.isArray(post.includedPlates) ? post.includedPlates
    : (typeof post.includedPlates === 'string' ? JSON.parse(post.includedPlates || '[]') : []);
  if (plates.includes('triple')) plateLabels.push({ label: '🟡 連三地牌', color: '#d97706' });
  else {
    if (plates.includes('hk_macao')) plateLabels.push({ label: '🔵 連港澳牌', color: '#2563eb' });
    if (plates.includes('gd_hk')) plateLabels.push({ label: '🟢 連粵港牌', color: '#16a34a' });
    if (plates.includes('gd_macao')) plateLabels.push({ label: '🟢 連粵澳牌', color: '#16a34a' });
  }
  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={() => router.push(`/vehicle/${post.id}`)}>
      <View style={styles.imgWrap}>
        {img ? <Image source={{ uri: img }} style={styles.img} contentFit="cover" />
          : <View style={[styles.img, styles.imgPlaceholder]}><Text style={{ color: '#ccc', fontSize: 12 }}>無圖片</Text></View>}
        {isPinned && <View style={styles.badge}><Text style={styles.badgeText}>置頂</Text></View>}
        {isFeatured && <View style={[styles.badge, { backgroundColor: '#F97316' }]}><Text style={styles.badgeText}>精選</Text></View>}
        {post.video_url && <View style={styles.videoIcon}><Svg width={14} height={14} viewBox="0 0 24 24" fill="#fff"><Path d="M8 5v14l11-7z" /></Svg></View>}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          <Text style={{ fontWeight: '600' }}>{infoLine}</Text>
          {post.subtitle ? <Text style={{ color: APP_GRAY, fontWeight: '400' }}> · {post.subtitle}</Text> : null}
        </Text>
        {detailParts.length > 0 && <Text style={styles.meta}>{detailParts.join(' · ')}</Text>}
        {(tags.length > 0 || fuelInfo || plateLabels.length > 0) && (
          <View style={styles.tagsRow}>
            {plateLabels.map((pl, i) => <View key={`pl-${i}`} style={[styles.tagChip, { backgroundColor: pl.color }]}><Text style={styles.tagChipText}>{pl.label}</Text></View>)}
            {tags.map((tag: string, i: number) => <View key={i} style={[styles.tagChip, { backgroundColor: tagColorMap?.[tag] || (i % 2 === 0 ? APP_ORANGE : '#3b82f6') }]}><Text style={styles.tagChipText}>{tag}</Text></View>)}
            {fuelInfo && <View style={[styles.tagChip, { backgroundColor: fuelInfo.color }]}><Text style={styles.tagChipText}>{fuelInfo.label}</Text></View>}
          </View>
        )}
        <Text style={styles.price}>{priceTxt}</Text>
      </View>
    </TouchableOpacity>
  );
}

function BrandPanel({ brands, selectedBrandId, onSelect, onClear, onClose }: {
  brands: any[]; selectedBrandId: number | undefined;
  onSelect: (id: number, name: string) => void; onClear: () => void; onClose: () => void;
}) {
  const hotBrands = useMemo(() => brands.filter(b => b.logoUrl && b.showOnHome).slice(0, 8), [brands]);
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    brands.forEach(b => { const l = (b.name || '').charAt(0).toUpperCase(); if (!map[l]) map[l] = []; map[l].push(b); });
    return map;
  }, [brands]);
  const letters = useMemo(() => Object.keys(grouped).sort(), [grouped]);
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={bs.overlay}>
        <View style={bs.panel}>
          <View style={bs.header}>
            <Text style={bs.title}>選擇品牌</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={bs.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={[bs.clearBtn, !selectedBrandId && bs.clearBtnActive]} onPress={onClear}>
              <Text style={[bs.clearBtnText, !selectedBrandId && bs.clearBtnTextActive]}>不限品牌</Text>
            </TouchableOpacity>
            {hotBrands.length > 0 && (
              <View>
                <Text style={bs.sectionLabel}>熱門品牌</Text>
                <View style={bs.hotGrid}>
                  {hotBrands.map(b => (
                    <TouchableOpacity key={b.id} style={[bs.hotItem, selectedBrandId === b.id && bs.hotItemActive]}
                      onPress={() => onSelect(b.id, b.brandNameZh || b.name)} activeOpacity={0.7}>
                      <Image source={{ uri: resolveImageUrl(b.logoUrl) || '' }} style={bs.hotLogo} contentFit="contain" />
                      <Text style={bs.hotName} numberOfLines={1}>{b.brandNameZh || b.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            {letters.map(letter => (
              <View key={letter}>
                <View style={bs.letterHeader}><Text style={bs.letterText}>{letter}</Text></View>
                {grouped[letter].map(b => (
                  <TouchableOpacity key={b.id} style={[bs.brandRow, selectedBrandId === b.id && bs.brandRowActive]}
                    onPress={() => onSelect(b.id, b.brandNameZh || b.name)} activeOpacity={0.7}>
                    {b.logoUrl ? <Image source={{ uri: resolveImageUrl(b.logoUrl) || '' }} style={bs.rowLogo} contentFit="contain" />
                      : <View style={bs.rowLogoPlaceholder} />}
                    <Text style={[bs.brandName, selectedBrandId === b.id && bs.brandNameActive]}>
                      {b.brandNameZh ? `${b.brandNameZh} ${b.name}` : b.name}
                    </Text>
                    {selectedBrandId === b.id && <Text style={{ color: APP_ORANGE, fontSize: 16, marginLeft: 'auto' }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function DropdownPanel({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <View style={ds.container}>
      <Pressable style={ds.backdrop} onPress={onClose} />
      <View style={ds.panel}>
        <Text style={ds.title}>{title}</Text>
        {children}
      </View>
    </View>
  );
}
function DropdownOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[ds.option, active && ds.optionActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[ds.optionText, active && ds.optionTextActive]}>{label}</Text>
      {active && <Text style={{ color: APP_ORANGE, fontSize: 16 }}>✓</Text>}
    </TouchableOpacity>
  );
}
function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.filterPill, active && styles.filterPillActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{label}</Text>
      <Text style={[styles.filterPillArrow, active && styles.filterPillArrowActive]}>▾</Text>
    </TouchableOpacity>
  );
}

export default function BuyScreen() {
  const [region, setRegion] = useState<'macau' | 'hongkong'>('macau');
  const [regionLoaded, setRegionLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(REGION_KEY).then(val => {
      if (val === 'macau' || val === 'hongkong') setRegion(val);
      setRegionLoaded(true);
    }).catch(() => setRegionLoaded(true));
  }, []);

  const [includedPlate, setIncludedPlate] = useState<string | undefined>(undefined);
  const [vehicleType, setVehicleType] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState<number | undefined>(undefined);
  const [selectedBrandName, setSelectedBrandName] = useState('');
  const [priceIdx, setPriceIdx] = useState(0);
  const [ageIdx, setAgeIdx] = useState(0);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    setPriceIdx(0);
  }, [vehicleType]);

  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { data: brandsData } = trpc.vehicle.getBrands.useQuery(
    vehicleType === 'motorcycle' ? { vehicleType: 'motorcycle' as any } : { vehicleType: 'car' as any },
    { enabled: regionLoaded }
  );
  const brands = useMemo(() => (brandsData as any[]) || [], [brandsData]);
  const { data: tagsData } = trpc.vehicle.getActiveTags.useQuery();
  const tagColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    (tagsData || []).forEach((t: any) => { if (t.name && t.color) map[t.name] = t.color; });
    return map;
  }, [tagsData]);

  const priceOptions = vehicleType === 'motorcycle' ? MOTO_PRICE_OPTIONS : CAR_PRICE_OPTIONS;
  const selectedPrice = priceOptions[priceIdx];
  const selectedAge = AGE_OPTIONS[ageIdx];

  const queryParams = useMemo(() => ({
    vehicleType: vehicleType || undefined,
    search: search || undefined,
    sortBy: sortBy as any,
    page, pageSize: 20,
    region: region as any,
    includedPlate: includedPlate as any,
    brandId: selectedBrandId,
    minPrice: selectedPrice?.min,
    maxPrice: selectedPrice?.max,
    maxAge: selectedAge?.value,
  }), [vehicleType, search, sortBy, page, region, includedPlate, selectedBrandId, selectedPrice, selectedAge]);

  const { data, isLoading, refetch } = trpc.vehicle.listPosts.useQuery(queryParams as any, { enabled: regionLoaded });
  useEffect(() => {
    if (!data) return;
    if (page === 1) setAllItems((data as any).items || []);
    else setAllItems(prev => [...prev, ...((data as any).items || [])]);
    setHasMore(((data as any).items || []).length === 20);
    setRefreshing(false);
  }, [data, page]);

  const resetPage = useCallback(() => { setPage(1); setAllItems([]); }, []);
  const handleRefresh = useCallback(() => { setRefreshing(true); setPage(1); setAllItems([]); refetch(); }, [refetch]);
  const handleLoadMore = useCallback(() => { if (!hasMore || isLoading) return; setPage(p => p + 1); }, [hasMore, isLoading]);
  const handleSearch = () => { setSearch(searchInput); resetPage(); };
  const handleTypeChange = (type: string) => { setVehicleType(type); resetPage(); };
  const handleRegionChange = (r: 'macau' | 'hongkong') => {
    setRegion(r);
    AsyncStorage.setItem(REGION_KEY, r).catch(() => {});
    setIncludedPlate(undefined);
    resetPage();
  };
  const handlePlateFilter = (plate: string) => {
    setIncludedPlate(prev => prev === plate ? undefined : plate);
    resetPage();
  };
  const togglePanel = (panel: ActivePanel) => setActivePanel(prev => prev === panel ? null : panel);
  const closePanel = () => setActivePanel(null);
  const hasActiveFilters = selectedBrandId || priceIdx !== 0 || ageIdx !== 0;

  if (!regionLoaded) {
    return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={APP_ORANGE} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>買車</Text></View>

      {/* 地區 Tab + 跨境牌照 */}
      <View style={styles.regionBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regionBarContent}>
          {REGION_TABS.map(r => (
            <TouchableOpacity key={r.value} style={[styles.regionTab, region === r.value && styles.regionTabActive]}
              onPress={() => handleRegionChange(r.value as any)} activeOpacity={0.7}>
              <Text style={[styles.regionTabText, region === r.value && styles.regionTabTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.regionDivider} />
          {PLATE_FILTERS.map(p => (
            <TouchableOpacity key={p.value} style={[styles.plateFilterBtn, includedPlate === p.value && styles.plateFilterBtnActive]}
              onPress={() => handlePlateFilter(p.value)} activeOpacity={0.7}>
              <Text style={[styles.plateFilterText, includedPlate === p.value && styles.plateFilterTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 搜索欄 */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
            <Path d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" stroke={APP_GRAY} strokeWidth={2} strokeLinecap="round" />
          </Svg>
          <TextInput style={styles.searchInput} placeholder="搜索品牌、型號..." placeholderTextColor={APP_GRAY}
            value={searchInput} onChangeText={setSearchInput} onSubmitEditing={handleSearch} returnKeyType="search" />
          {searchInput.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchInput(''); setSearch(''); resetPage(); }}>
              <Text style={{ color: APP_GRAY, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 車輛類型 */}
      <View style={styles.typeRow}>
        {VEHICLE_TYPES.map(t => (
          <TouchableOpacity key={t.value} style={[styles.typeBtn, vehicleType === t.value && styles.typeBtnActive]}
            onPress={() => handleTypeChange(t.value)} activeOpacity={0.7}>
            <Text style={[styles.typeBtnText, vehicleType === t.value && styles.typeBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 篩選 Pill 欄 */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRowContent}>
          <FilterPill label={sortBy === 'newest' ? '排序' : SORT_OPTIONS.find(s => s.value === sortBy)?.label || '排序'}
            active={activePanel === 'sort' || sortBy !== 'newest'} onPress={() => togglePanel('sort')} />
          <FilterPill label={selectedBrandName || '品牌'} active={activePanel === 'brand' || !!selectedBrandId} onPress={() => togglePanel('brand')} />
          <FilterPill label={priceIdx === 0 ? '價格' : priceOptions[priceIdx]?.label || '價格'}
            active={activePanel === 'price' || priceIdx !== 0} onPress={() => togglePanel('price')} />
          <FilterPill label={ageIdx === 0 ? '車齡' : AGE_OPTIONS[ageIdx]?.label || '車齡'}
            active={activePanel === 'age' || ageIdx !== 0} onPress={() => togglePanel('age')} />
          <Text style={styles.countText}>{(data as any)?.total != null ? `共 ${(data as any).total} 輛` : ''}</Text>
        </ScrollView>
      </View>

      {/* 下拉面板 */}
      {activePanel === 'sort' && (
        <DropdownPanel title="排序方式" onClose={closePanel}>
          {SORT_OPTIONS.map(opt => <DropdownOption key={opt.value} label={opt.label} active={sortBy === opt.value}
            onPress={() => { setSortBy(opt.value); resetPage(); closePanel(); }} />)}
        </DropdownPanel>
      )}
      {activePanel === 'price' && (
        <DropdownPanel title="價格區間" onClose={closePanel}>
          {priceOptions.map((opt, i) => <DropdownOption key={i} label={opt.label} active={priceIdx === i}
            onPress={() => { setPriceIdx(i); resetPage(); closePanel(); }} />)}
        </DropdownPanel>
      )}
      {activePanel === 'age' && (
        <DropdownPanel title="車齡區間" onClose={closePanel}>
          {AGE_OPTIONS.map((opt, i) => <DropdownOption key={i} label={opt.label} active={ageIdx === i}
            onPress={() => { setAgeIdx(i); resetPage(); closePanel(); }} />)}
        </DropdownPanel>
      )}

      {/* 已選篩選標籤 */}
      {hasActiveFilters ? (
        <View style={styles.activeTagsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {selectedBrandName ? <TouchableOpacity style={styles.activeTag} onPress={() => { setSelectedBrandId(undefined); setSelectedBrandName(''); resetPage(); }}><Text style={styles.activeTagText}>{selectedBrandName} ✕</Text></TouchableOpacity> : null}
            {priceIdx !== 0 ? <TouchableOpacity style={styles.activeTag} onPress={() => { setPriceIdx(0); resetPage(); }}><Text style={styles.activeTagText}>{priceOptions[priceIdx]?.label} ✕</Text></TouchableOpacity> : null}
            {ageIdx !== 0 ? <TouchableOpacity style={styles.activeTag} onPress={() => { setAgeIdx(0); resetPage(); }}><Text style={styles.activeTagText}>{AGE_OPTIONS[ageIdx]?.label} ✕</Text></TouchableOpacity> : null}
            <TouchableOpacity style={[styles.activeTag, { backgroundColor: '#fee2e2' }]} onPress={() => { setSelectedBrandId(undefined); setSelectedBrandName(''); setPriceIdx(0); setAgeIdx(0); setSortBy('newest'); resetPage(); }}>
              <Text style={[styles.activeTagText, { color: '#ef4444' }]}>清除全部</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      ) : null}

      {/* 品牌 Modal */}
      {activePanel === 'brand' && (
        <BrandPanel brands={brands} selectedBrandId={selectedBrandId}
          onSelect={(id, name) => { setSelectedBrandId(id); setSelectedBrandName(name); resetPage(); closePanel(); }}
          onClear={() => { setSelectedBrandId(undefined); setSelectedBrandName(''); resetPage(); closePanel(); }}
          onClose={closePanel} />
      )}

      {/* 列表 */}
      <FlatList
        data={allItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <PostListItem post={item} tagColorMap={tagColorMap} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={APP_ORANGE} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={APP_ORANGE} size="large" /></View>
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🚗</Text>
            <Text style={styles.empty}>{region === 'hongkong' ? '香港車源即將上線' : '暫無車源'}</Text>
            {region === 'hongkong' && <Text style={styles.emptyHint}>敬請期待，或切換至澳門查看車源</Text>}
          </View>
        )}
        ListFooterComponent={!isLoading && allItems.length > 0 ? (
          hasMore ? <View style={styles.loadingMore}><ActivityIndicator color={APP_ORANGE} size="small" /></View>
            : <Text style={styles.noMore}>已顯示全部車源</Text>
        ) : null}
      />
    </View>
  );
}

const bs = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  panel: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  title: { fontSize: 16, fontWeight: '700', color: APP_TEXT },
  close: { fontSize: 18, color: APP_GRAY },
  clearBtn: { marginHorizontal: 16, marginTop: 12, marginBottom: 4, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: APP_BORDER, alignItems: 'center' },
  clearBtnActive: { borderColor: APP_ORANGE, backgroundColor: '#fff7ed' },
  clearBtnText: { fontSize: 14, color: APP_GRAY },
  clearBtnTextActive: { color: APP_ORANGE, fontWeight: '600' },
  sectionLabel: { fontSize: 12, color: APP_GRAY, marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  hotGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  hotItem: { width: (SCREEN_W - 32) / 4, alignItems: 'center', paddingVertical: 10, borderRadius: 8, marginBottom: 4 },
  hotItemActive: { backgroundColor: '#fff7ed' },
  hotLogo: { width: 44, height: 44, marginBottom: 4 },
  hotName: { fontSize: 11, color: APP_TEXT, textAlign: 'center' },
  letterHeader: { backgroundColor: '#f8f8f8', paddingHorizontal: 16, paddingVertical: 4 },
  letterText: { fontSize: 12, fontWeight: '700', color: APP_GRAY },
  brandRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  brandRowActive: { backgroundColor: '#fff7ed' },
  rowLogo: { width: 28, height: 28, marginRight: 12 },
  rowLogoPlaceholder: { width: 28, height: 28, marginRight: 12 },
  brandName: { fontSize: 14, color: APP_TEXT },
  brandNameActive: { color: APP_ORANGE, fontWeight: '600' },
});
const ds = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)' },
  panel: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#fff', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, paddingBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 8 },
  title: { fontSize: 13, fontWeight: '600', color: APP_GRAY, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  optionActive: { backgroundColor: '#fff7ed' },
  optionText: { fontSize: 14, color: APP_TEXT },
  optionTextActive: { color: APP_ORANGE, fontWeight: '600' },
});
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: { backgroundColor: '#fff', paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  headerTitle: { fontSize: 22, fontWeight: '700', color: APP_TEXT, letterSpacing: -0.5 },
  regionBar: { backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  regionBarContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, flexDirection: 'row', alignItems: 'center' },
  regionTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f5f5f5' },
  regionTabActive: { backgroundColor: APP_ORANGE },
  regionTabText: { fontSize: 13, fontWeight: '500', color: APP_GRAY },
  regionTabTextActive: { color: '#fff', fontWeight: '700' },
  regionDivider: { width: 1, height: 20, backgroundColor: APP_BORDER, marginHorizontal: 4 },
  plateFilterBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: 'transparent' },
  plateFilterBtnActive: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  plateFilterText: { fontSize: 12, color: APP_GRAY },
  plateFilterTextActive: { color: '#2563eb', fontWeight: '600' },
  searchWrap: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14, color: APP_TEXT },
  typeRow: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  typeBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f5f5f5' },
  typeBtnActive: { backgroundColor: APP_ORANGE },
  typeBtnText: { fontSize: 13, fontWeight: '500', color: APP_GRAY },
  typeBtnTextActive: { color: '#fff' },
  filterRow: { backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  filterRowContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, flexDirection: 'row', alignItems: 'center' },
  filterPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: 'transparent' },
  filterPillActive: { backgroundColor: '#fff7ed', borderColor: APP_ORANGE },
  filterPillText: { fontSize: 13, color: APP_GRAY },
  filterPillTextActive: { color: APP_ORANGE, fontWeight: '600' },
  filterPillArrow: { fontSize: 10, color: APP_GRAY, marginLeft: 3 },
  filterPillArrowActive: { color: APP_ORANGE },
  countText: { marginLeft: 8, fontSize: 12, color: APP_GRAY, alignSelf: 'center' },
  activeTagsRow: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  activeTag: { backgroundColor: '#fff7ed', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6 },
  activeTagText: { fontSize: 12, color: APP_ORANGE },
  item: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10, borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  imgWrap: { width: 120, height: 90, position: 'relative' },
  img: { width: 120, height: 90 },
  imgPlaceholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  badge: { position: 'absolute', top: 6, left: 6, backgroundColor: '#ef4444', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  videoIcon: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, padding: 10, justifyContent: 'space-between' },
  title: { fontSize: 14, color: APP_TEXT, lineHeight: 19, letterSpacing: -0.2 },
  meta: { fontSize: 11, color: APP_GRAY, marginTop: 3 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tagChip: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  tagChipText: { color: '#fff', fontSize: 10, fontWeight: '500' },
  price: { fontSize: 16, fontWeight: '700', color: APP_ORANGE, letterSpacing: -0.3, marginTop: 4 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  emptyWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  empty: { textAlign: 'center', color: APP_GRAY, fontSize: 14 },
  emptyHint: { textAlign: 'center', color: APP_GRAY, fontSize: 12, marginTop: 6 },
  loadingMore: { paddingVertical: 16, alignItems: 'center' },
  noMore: { textAlign: 'center', paddingVertical: 16, color: APP_GRAY, fontSize: 13 },
});
