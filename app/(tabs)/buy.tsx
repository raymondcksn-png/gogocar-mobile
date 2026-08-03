/**
 * 買車列表頁 — 篩選 + 搜索 + 車源列表
 * API: trpc.vehicle.listPosts + trpc.vehicle.getActiveTags
 * v3.1 升級：地區 Tab（澳門/香港）+ 跨境牌照篩選
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, Dimensions, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { trpc, resolveImageUrl } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER, FUEL_TYPE_LABELS } from '../../constants/data';

const { width: SCREEN_W } = Dimensions.get('window');

// ── 地區 Tab ──────────────────────────────────────────────────────────────────
const REGION_TABS = [
  { label: '🇲🇴 澳門', value: 'macau' },
  { label: '🇭🇰 香港', value: 'hongkong' },
];

// ── 跨境牌照篩選 ──────────────────────────────────────────────────────────────
const PLATE_FILTERS = [
  { label: '連港澳牌', value: 'hk_macao' },
  { label: '連粵港牌', value: 'gd_hk' },
  { label: '連粵澳牌', value: 'gd_macao' },
  { label: '連三地牌', value: 'triple' },
];

// ── 車輛類型篩選 ──────────────────────────────────────────────────────────────
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
];

// ── 車輛列表項 ─────────────────────────────────────────────────────────────────
function PostListItem({ post, tagColorMap }: { post: any; tagColorMap?: Record<string, string> }) {
  const router = useRouter();
  const brandDisplay = post.brand || post.brandName || '';
  const modelDisplay = post.modelSeries || post.modelName || '';
  const infoLine = [brandDisplay, modelDisplay].filter(Boolean).join(' ') || '未命名車源';
  const priceTxt = post.price && Number(post.price) > 0
    ? `HKD ${Number(post.price).toLocaleString()}`
    : '面議';
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

  // 跨境牌照標籤
  const plateLabels: { label: string; color: string }[] = [];
  const plates: string[] = Array.isArray(post.includedPlates)
    ? post.includedPlates
    : (typeof post.includedPlates === 'string' ? JSON.parse(post.includedPlates || '[]') : []);
  if (plates.includes('triple')) plateLabels.push({ label: '🟡 連三地牌', color: '#d97706' });
  else {
    if (plates.includes('hk_macao')) plateLabels.push({ label: '🔵 連港澳牌', color: '#2563eb' });
    if (plates.includes('gd_hk')) plateLabels.push({ label: '🟢 連粵港牌', color: '#16a34a' });
    if (plates.includes('gd_macao')) plateLabels.push({ label: '🟢 連粵澳牌', color: '#16a34a' });
  }

  return (
    <TouchableOpacity
      style={styles.item}
      activeOpacity={0.7}
      onPress={() => router.push(`/vehicle/${post.id}`)}
    >
      <View style={styles.imgWrap}>
        {img ? (
          <Image source={{ uri: img }} style={styles.img} contentFit="cover" />
        ) : (
          <View style={[styles.img, styles.imgPlaceholder]}>
            <Text style={{ color: '#ccc', fontSize: 12 }}>無圖片</Text>
          </View>
        )}
        {isPinned && <View style={styles.badge}><Text style={styles.badgeText}>置頂</Text></View>}
        {isFeatured && <View style={[styles.badge, { backgroundColor: '#F97316' }]}><Text style={styles.badgeText}>精選</Text></View>}
        {post.video_url && (
          <View style={styles.videoIcon}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="#fff">
              <Path d="M8 5v14l11-7z" />
            </Svg>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          <Text style={{ fontWeight: '600' }}>{infoLine}</Text>
          {post.subtitle ? <Text style={{ color: APP_GRAY, fontWeight: '400' }}> · {post.subtitle}</Text> : null}
        </Text>
        {detailParts.length > 0 && (
          <Text style={styles.meta}>{detailParts.join(' · ')}</Text>
        )}
        {(tags.length > 0 || fuelInfo || plateLabels.length > 0) && (
          <View style={styles.tagsRow}>
            {plateLabels.map((pl, i) => (
              <View key={`plate-${i}`} style={[styles.tagChip, { backgroundColor: pl.color }]}>
                <Text style={styles.tagChipText}>{pl.label}</Text>
              </View>
            ))}
            {tags.map((tag: string, i: number) => (
              <View key={i} style={[styles.tagChip, { backgroundColor: tagColorMap?.[tag] || (i % 2 === 0 ? APP_ORANGE : '#3b82f6') }]}>
                <Text style={styles.tagChipText}>{tag}</Text>
              </View>
            ))}
            {fuelInfo && (
              <View style={[styles.tagChip, { backgroundColor: fuelInfo.color }]}>
                <Text style={styles.tagChipText}>{fuelInfo.label}</Text>
              </View>
            )}
          </View>
        )}
        <Text style={styles.price}>{priceTxt}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────────────────────
export default function BuyScreen() {
  const [region, setRegion] = useState<'macau' | 'hongkong'>('macau');
  const [includedPlate, setIncludedPlate] = useState<string | undefined>(undefined);
  const [vehicleType, setVehicleType] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    page,
    pageSize: 20,
    region: region as any,
    includedPlate: includedPlate as any,
  }), [vehicleType, search, sortBy, page, region, includedPlate]);

  const { data, isLoading, refetch } = trpc.vehicle.listPosts.useQuery(queryParams);

  useEffect(() => {
    if (!data) return;
    if (page === 1) {
      setAllItems(data.items || []);
    } else {
      setAllItems(prev => [...prev, ...(data.items || [])]);
    }
    setHasMore((data.items || []).length === 20);
    setRefreshing(false);
  }, [data, page]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    setAllItems([]);
    refetch();
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    setPage(p => p + 1);
  }, [hasMore, isLoading]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
    setAllItems([]);
  };

  const handleTypeChange = (type: string) => {
    setVehicleType(type);
    setPage(1);
    setAllItems([]);
  };

  const handleRegionChange = (r: 'macau' | 'hongkong') => {
    setRegion(r);
    setPage(1);
    setAllItems([]);
    setIncludedPlate(undefined); // 切換地區時清除牌照篩選
  };

  const handlePlateFilter = (plate: string) => {
    setIncludedPlate(prev => prev === plate ? undefined : plate);
    setPage(1);
    setAllItems([]);
  };

  return (
    <View style={styles.container}>
      {/* 頂部欄 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>買車</Text>
      </View>

      {/* 地區 Tab（澳門 / 香港）+ 跨境牌照篩選 */}
      <View style={styles.regionBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regionBarContent}>
          {REGION_TABS.map(r => (
            <TouchableOpacity
              key={r.value}
              style={[styles.regionTab, region === r.value && styles.regionTabActive]}
              onPress={() => handleRegionChange(r.value as 'macau' | 'hongkong')}
              activeOpacity={0.7}
            >
              <Text style={[styles.regionTabText, region === r.value && styles.regionTabTextActive]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.regionDivider} />
          {PLATE_FILTERS.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[styles.plateFilterBtn, includedPlate === p.value && styles.plateFilterBtnActive]}
              onPress={() => handlePlateFilter(p.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.plateFilterText, includedPlate === p.value && styles.plateFilterTextActive]}>
                {p.label}
              </Text>
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
          <TextInput
            style={styles.searchInput}
            placeholder="搜索品牌、型號..."
            placeholderTextColor={APP_GRAY}
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchInput.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchInput(''); setSearch(''); setPage(1); setAllItems([]); }}>
              <Text style={{ color: APP_GRAY, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 車輛類型篩選 */}
      <View style={styles.typeRow}>
        {VEHICLE_TYPES.map(t => (
          <TouchableOpacity
            key={t.value}
            style={[styles.typeBtn, vehicleType === t.value && styles.typeBtnActive]}
            onPress={() => handleTypeChange(t.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.typeBtnText, vehicleType === t.value && styles.typeBtnTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 排序 */}
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map(s => (
          <TouchableOpacity
            key={s.value}
            style={[styles.sortBtn, sortBy === s.value && styles.sortBtnActive]}
            onPress={() => { setSortBy(s.value); setPage(1); setAllItems([]); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.sortBtnText, sortBy === s.value && styles.sortBtnTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.countText}>
          {data?.total != null ? `共 ${data.total} 輛` : ''}
        </Text>
      </View>

      {/* 列表 */}
      <FlatList
        data={allItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <PostListItem post={item} tagColorMap={tagColorMap} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={APP_ORANGE} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loading}><ActivityIndicator color={APP_ORANGE} size="large" /></View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🚗</Text>
              <Text style={styles.empty}>
                {region === 'hongkong' ? '香港車源即將上線' : '暫無車源'}
              </Text>
              {region === 'hongkong' && (
                <Text style={styles.emptyHint}>敬請期待，或切換至澳門查看車源</Text>
              )}
            </View>
          )
        }
        ListFooterComponent={
          !isLoading && allItems.length > 0 ? (
            hasMore ? (
              <View style={styles.loadingMore}><ActivityIndicator color={APP_ORANGE} size="small" /></View>
            ) : (
              <Text style={styles.noMore}>已顯示全部車源</Text>
            )
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: {
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: APP_BORDER,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: APP_TEXT, letterSpacing: -0.5 },

  // 地區 Tab 欄
  regionBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: APP_BORDER,
  },
  regionBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  regionTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: APP_BG,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  regionTabActive: {
    backgroundColor: `${APP_ORANGE}15`,
    borderColor: APP_ORANGE,
  },
  regionTabText: { fontSize: 13, fontWeight: '500', color: APP_GRAY },
  regionTabTextActive: { color: APP_ORANGE, fontWeight: '700' },
  regionDivider: {
    width: 1,
    height: 20,
    backgroundColor: APP_BORDER,
    marginHorizontal: 4,
  },
  plateFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: APP_BG,
    borderWidth: 1,
    borderColor: APP_BORDER,
  },
  plateFilterBtnActive: {
    backgroundColor: '#2563eb15',
    borderColor: '#2563eb',
  },
  plateFilterText: { fontSize: 12, color: APP_GRAY },
  plateFilterTextActive: { color: '#2563eb', fontWeight: '600' },

  searchWrap: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APP_BG,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 38,
  },
  searchInput: { flex: 1, fontSize: 14, color: APP_TEXT },
  typeRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  typeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: APP_BG,
  },
  typeBtnActive: { backgroundColor: APP_ORANGE },
  typeBtnText: { fontSize: 13, fontWeight: '500', color: APP_GRAY },
  typeBtnTextActive: { color: '#fff' },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: APP_BORDER,
    gap: 12,
    marginBottom: 8,
  },
  sortBtn: { paddingVertical: 4 },
  sortBtnActive: { borderBottomWidth: 1.5, borderBottomColor: APP_ORANGE },
  sortBtnText: { fontSize: 13, color: APP_GRAY },
  sortBtnTextActive: { color: APP_ORANGE, fontWeight: '600' },
  countText: { marginLeft: 'auto', fontSize: 12, color: APP_GRAY },
  item: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: APP_BORDER,
    backgroundColor: '#fff',
  },
  imgWrap: { position: 'relative', flexShrink: 0 },
  img: { width: 110, height: 82, borderRadius: 10 },
  imgPlaceholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  badge: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: '#EAB308', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  videoIcon: {
    position: 'absolute', bottom: 4, left: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, justifyContent: 'space-between', paddingVertical: 2 },
  title: { fontSize: 14, color: APP_TEXT, lineHeight: 19, letterSpacing: -0.2 },
  meta: { fontSize: 11, color: APP_GRAY, marginTop: 3 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tagChip: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagChipText: { color: '#fff', fontSize: 10, fontWeight: '500' },
  price: { fontSize: 16, fontWeight: '700', color: APP_ORANGE, letterSpacing: -0.3, marginTop: 4 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  emptyWrap: { paddingVertical: 48, alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  empty: { textAlign: 'center', color: APP_GRAY, fontSize: 15, fontWeight: '500' },
  emptyHint: { textAlign: 'center', color: APP_GRAY, fontSize: 13, marginTop: 6, opacity: 0.7 },
  loadingMore: { paddingVertical: 16, alignItems: 'center' },
  noMore: { textAlign: 'center', paddingVertical: 16, color: APP_GRAY, fontSize: 13 },
});
