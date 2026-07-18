/**
 * 首頁 — 對照 WebApp AppHome.tsx
 * API: trpc.vehicle.listPosts + trpc.siteContent.listBanners + trpc.siteContent.listQuickLinks
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, TextInput, FlatList, ActivityIndicator, Dimensions, RefreshControl, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { trpc, resolveImageUrl } from '../../lib/trpc';
import { APP_ORANGE, HOME_BRANDS, QUICK_PRICES, QUICK_AGES, CATEGORIES } from '../../constants/data';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── 能源類型標籤顏色（對照 buy.tsx）────────────────────────────────────────
const FUEL_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  petrol: { label: '汽油', color: '#6b7280' },
  diesel: { label: '柴油', color: '#6b7280' },
  electric: { label: '純電', color: '#16a34a' },
  hybrid: { label: '油電混合', color: '#0d9488' },
  pluginHybrid: { label: '插電混動', color: '#0d9488' },
};

// ─── 車輛列表項（對照 buy.tsx PostListItem）─────────────────────────────────
function VehicleListItem({ post, tagColorMap }: { post: any; tagColorMap?: Record<string, string> }) {
  const router = useRouter();
  const brandDisplay = post.brand || post.brandName || '';
  const modelDisplay = post.modelSeries || post.modelName || '';
  const infoLine = [brandDisplay, modelDisplay].filter(Boolean).join(' ') || '未命名車源';
  const priceTxt =
    post.price && Number(post.price) > 0
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
  return (
    <TouchableOpacity
      style={styles.vehicleItem}
      activeOpacity={0.7}
      onPress={() => router.push(`/vehicle/${post.id}`)}
    >
      <View style={styles.vehicleImgWrap}>
        {img ? (
          <Image source={{ uri: img }} style={styles.vehicleImg} resizeMode="cover" />
        ) : (
          <View style={[styles.vehicleImg, styles.vehicleImgPlaceholder]}>
            <Text style={{ color: '#ccc', fontSize: 12 }}>無圖片</Text>
          </View>
        )}
        {isPinned && <View style={styles.tagBadge}><Text style={styles.tagText}>置頂</Text></View>}
        {isFeatured && <View style={[styles.tagBadge, { backgroundColor: '#F97316' }]}><Text style={styles.tagText}>精選</Text></View>}
        {post.video_url ? (
          <View style={styles.videoIcon}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="#fff">
              <Path d="M8 5v14l11-7z" />
            </Svg>
          </View>
        ) : null}
      </View>
      <View style={styles.vehicleInfo}>
        <Text style={styles.vehicleTitle} numberOfLines={2}>
          <Text style={{ fontWeight: '600' }}>{infoLine}</Text>
          {post.subtitle ? <Text style={{ color: '#8e8e93', fontWeight: '400' }}> · {post.subtitle}</Text> : null}
        </Text>
        {detailParts.length > 0 && (
          <Text style={styles.vehicleMeta}>{detailParts.join(' · ')}</Text>
        )}
        {(tags.length > 0 || fuelInfo) && (
          <View style={styles.tagsRow}>
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
        <Text style={styles.vehiclePrice}>{priceTxt}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function VehicleSkeleton() {
  return (
    <View style={styles.vehicleItem}>
      <View style={[styles.vehicleImg, { backgroundColor: '#f0f0f0', borderRadius: 10 }]} />
      <View style={{ flex: 1, gap: 8, paddingVertical: 4 }}>
        <View style={{ height: 14, width: '80%', backgroundColor: '#f0f0f0', borderRadius: 4 }} />
        <View style={{ height: 12, width: '60%', backgroundColor: '#f0f0f0', borderRadius: 4 }} />
        <View style={{ height: 16, width: '40%', backgroundColor: '#f0f0f0', borderRadius: 4, marginTop: 'auto' }} />
      </View>
    </View>
  );
}

// ─── 主頁面 ──────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const [vehicleType, setVehicleType] = useState<'car' | 'motorcycle'>('car');
  const [page, setPage] = useState(1);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [middleBannerIndex, setMiddleBannerIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const middleBannerTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── API 調用（對照 WebApp）──────────────────────────────────────────────────
  const { data: latestPosts, isLoading, isFetching } = trpc.vehicle.listPosts.useQuery({
    vehicleType,
    page,
    pageSize: 10,
  });

  const { data: banners } = trpc.siteContent.listBanners.useQuery();
  const { data: quickLinks } = trpc.siteContent.listQuickLinks.useQuery();
  const { data: activeTags } = trpc.vehicle.getActiveTags.useQuery();
  const tagColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (activeTags) activeTags.forEach((t: any) => { map[t.name] = t.color; });
    return map;
  }, [activeTags]);
  // ── 切換車輛類型（對照 handleVehicleTypeChange）────────────────────────────
  const handleVehicleTypeChange = useCallback((type: 'car' | 'motorcycle') => {
    setVehicleType(type);
    setPage(1);
    setAllPosts([]);
    setHasMore(true);
  }, []);

  // ── 下拉刷新 ──────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    setAllPosts([]);
    setHasMore(true);
    // refetch 會在 page/vehicleType 變化後自動觸發
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // ── 累積 posts（對照 WebApp useEffect）────────────────────────────────────
  useEffect(() => {
    if (!latestPosts) return;
    if (page === 1) {
      setAllPosts(latestPosts.items || []);
    } else {
      setAllPosts(prev => [...prev, ...(latestPosts.items || [])]);
    }
    setHasMore((latestPosts.items || []).length === 10);
  }, [latestPosts, page]);

  // ── 按位置分組 Banner ──────────────────────────────────────────────────────
  const topBanners = (banners || []).filter((b: any) => !b.position || b.position === 'top');
  const middleBanners = (banners || []).filter((b: any) => b.position === 'middle');

  // ── Banner 點擊跳轉 ────────────────────────────────────────────────────────
  const handleBannerClick = useCallback((banner: any) => {
    if (!banner.jumpUrl) return;
    if (banner.jumpUrl.startsWith('http://') || banner.jumpUrl.startsWith('https://')) {
      Linking.openURL(banner.jumpUrl);
    } else {
      router.push(banner.jumpUrl as any);
    }
  }, [router]);

  // ── 頂部 Banner 自動輪播 ────────────────────────────────────────────────────
  useEffect(() => {
    if (topBanners.length <= 1) return;
    bannerTimer.current = setInterval(() => {
      setBannerIndex(i => (i + 1) % topBanners.length);
    }, 4000);
    return () => { if (bannerTimer.current) clearInterval(bannerTimer.current); };
  }, [topBanners.length]);

  // ── 中部 Banner 自動輪播 ────────────────────────────────────────────────────
  useEffect(() => {
    if (middleBanners.length <= 1) return;
    middleBannerTimer.current = setInterval(() => {
      setMiddleBannerIndex(i => (i + 1) % middleBanners.length);
    }, 5000);
    return () => { if (middleBannerTimer.current) clearInterval(middleBannerTimer.current); };
  }, [middleBanners.length]);

  // ── 無限滾動 ──────────────────────────────────────────────────────────────
  const handleEndReached = useCallback(() => {
    if (hasMore && !isFetching) setPage(p => p + 1);
  }, [hasMore, isFetching]);

  // ── 分類數據（後台 quickLinks 優先，否則用常量）──────────────────────────
  const categories = (quickLinks && quickLinks.length > 0) ? quickLinks : CATEGORIES;

  // ─── 渲染 ─────────────────────────────────────────────────────────────────
  const ListHeader = (
    <View>
      {/* 頂部搜索區（白底，對照 WebApp） */}
      <View style={styles.searchSection}>
        <View style={styles.logoRow}>
          <Text style={styles.logoText}>GoGoCar</Text>
          <Text style={styles.logoSub}>澳門二手車平台</Text>
        </View>
        <TouchableOpacity
          style={styles.searchBar}
          activeOpacity={0.8}
          onPress={() => router.push('/search')}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>輸入品牌、車系、年份...</Text>
        </TouchableOpacity>
      </View>

      {/* 汽車/電單車 Segmented Control（iOS 風格，對照 WebApp） */}
      <View style={styles.segmentedWrap}>
        <View style={styles.segmented}>
          <TouchableOpacity
            style={[styles.segBtn, vehicleType === 'car' && styles.segBtnActive]}
            onPress={() => handleVehicleTypeChange('car')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segBtnText, vehicleType === 'car' && styles.segBtnTextActive]}>汽車</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segBtn, vehicleType === 'motorcycle' && styles.segBtnActive]}
            onPress={() => handleVehicleTypeChange('motorcycle')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segBtnText, vehicleType === 'motorcycle' && styles.segBtnTextActive]}>電單車</Text>
          </TouchableOpacity>
        </View>

        {/* 價格快選（對照 QUICK_PRICES） */}
        <View style={styles.quickGrid}>
          {QUICK_PRICES.map(p => (
            <TouchableOpacity
              key={p}
              style={styles.quickBtn}
              activeOpacity={0.6}
              onPress={() => router.push(`/buy?price=${encodeURIComponent(p)}`)}
            >
              <Text style={styles.quickBtnText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 車齡快選（對照 QUICK_AGES） */}
        <View style={styles.quickGrid}>
          {QUICK_AGES.map(p => (
            <TouchableOpacity
              key={p}
              style={styles.quickBtn}
              activeOpacity={0.6}
              onPress={() => router.push(`/buy?age=${encodeURIComponent(p)}`)}
            >
              <Text style={styles.quickBtnText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 品牌 Logo 網格（對照 HOME_BRANDS） */}
        <View style={styles.brandGrid}>
          {HOME_BRANDS.map(b => (
            <TouchableOpacity
              key={b.name}
              style={styles.brandItem}
              activeOpacity={0.6}
              onPress={() => router.push(`/buy?brand=${encodeURIComponent(b.name)}`)}
            >
              <View style={styles.brandLogoWrap}>
                <Text style={styles.brandInitial}>{b.zh.charAt(0)}</Text>
                <Image
                  source={{ uri: b.logo }}
                  style={styles.brandLogo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandName}>{b.zh}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 查看更多品牌 */}
        <TouchableOpacity
          style={styles.moreBtn}
          activeOpacity={0.6}
          onPress={() => router.push('/buy/brands')}
        >
          <Text style={styles.moreBtnText}>查看更多 ›</Text>
        </TouchableOpacity>
      </View>

      {/* 分類大卡片（對照 CATEGORIES / quickLinks） */}
      <View style={styles.categoryGrid}>
        {categories.slice(0, 6).map((c: any) => (
          <TouchableOpacity
            key={c.id || c.name}
            style={styles.categoryCard}
            activeOpacity={0.7}
            onPress={() => router.push(`/buy?category=${encodeURIComponent(c.name)}`)}
          >
            <View style={styles.categoryTextWrap}>
              <Text style={styles.categoryTitle}>{c.title || c.name}</Text>
              <Text style={styles.categorySubtitle}>{c.subtitle}</Text>
            </View>
            {(c.iconUrl || c.image) && (
              <Image
                source={{ uri: resolveImageUrl(c.iconUrl || c.image) || undefined }}
                style={styles.categoryImg}
                resizeMode="cover"
              />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* 頂部 Banner 輪播 */}
      {topBanners.length > 0 && (
        <View style={styles.bannerWrap}>
          {topBanners.map((banner: any, idx: number) => (
            <TouchableOpacity
              key={banner.id}
              activeOpacity={banner.jumpUrl ? 0.9 : 1}
              onPress={() => handleBannerClick(banner)}
              style={[styles.bannerSlide, { opacity: idx === bannerIndex % topBanners.length ? 1 : 0 }]}
            >
              <Image
                source={{ uri: resolveImageUrl(banner.imageUrl) || undefined }}
                style={styles.bannerImg}
                resizeMode="cover"
              />
              {(banner.title || banner.description) && (
                <View style={styles.bannerOverlay}>
                  {banner.title && <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>}
                  {banner.description && <Text style={styles.bannerDesc} numberOfLines={1}>{banner.description}</Text>}
                </View>
              )}
            </TouchableOpacity>
          ))}
          {topBanners.length > 1 && (
            <View style={styles.bannerDots}>
              {topBanners.map((_: any, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.bannerDot, idx === bannerIndex % topBanners.length && styles.bannerDotActive]}
                  onPress={() => setBannerIndex(idx)}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* 最新上線標題 + 車輛類型 Tab */}
      <View style={styles.latestHeader}>
        <Text style={styles.latestTitle}>最新上線</Text>
        <TouchableOpacity onPress={() => router.push('/buy')} activeOpacity={0.6}>
          <Text style={styles.latestMore}>查看更多 ›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.segmentedWrap2}>
        <View style={styles.segmented}>
          <TouchableOpacity
            style={[styles.segBtn, vehicleType === 'car' && styles.segBtnActive]}
            onPress={() => handleVehicleTypeChange('car')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segBtnText, vehicleType === 'car' && styles.segBtnTextActive]}>汽車</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segBtn, vehicleType === 'motorcycle' && styles.segBtnActive]}
            onPress={() => handleVehicleTypeChange('motorcycle')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segBtnText, vehicleType === 'motorcycle' && styles.segBtnTextActive]}>電單車</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Skeleton 加載 */}
      {isLoading && page === 1 && (
        <View>
          <VehicleSkeleton /><VehicleSkeleton /><VehicleSkeleton />
        </View>
      )}
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      ListHeaderComponent={ListHeader}
      data={allPosts}
      keyExtractor={item => String(item.id)}
      renderItem={({ item, index }) => (
        <>
          <VehicleListItem post={item} tagColorMap={tagColorMap} />
          {/* 中部 Banner：插入第6張車源後 */}
          {index === 5 && middleBanners.length > 0 && (
            <View style={[styles.bannerWrap, { height: 120, marginTop: 0 }]}>
              {middleBanners.map((banner: any, bIdx: number) => (
                <TouchableOpacity
                  key={banner.id}
                  activeOpacity={banner.jumpUrl ? 0.9 : 1}
                  onPress={() => handleBannerClick(banner)}
                  style={[styles.bannerSlide, { opacity: bIdx === middleBannerIndex % middleBanners.length ? 1 : 0 }]}
                >
                  <Image source={{ uri: resolveImageUrl(banner.imageUrl) || undefined }} style={styles.bannerImg} resizeMode="cover" />
                  {(banner.title || banner.description) && (
                    <View style={styles.bannerOverlay}>
                      {banner.title && <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>}
                      {banner.description && <Text style={styles.bannerDesc} numberOfLines={1}>{banner.description}</Text>}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
              {middleBanners.length > 1 && (
                <View style={styles.bannerDots}>
                  {middleBanners.map((_: any, bIdx: number) => (
                    <TouchableOpacity key={bIdx} style={[styles.bannerDot, bIdx === middleBannerIndex % middleBanners.length && styles.bannerDotActive]} onPress={() => setMiddleBannerIndex(bIdx)} />
                  ))}
                </View>
              )}
            </View>
          )}
        </>
      )}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={APP_ORANGE}
          colors={[APP_ORANGE]}
        />
      }
      ListFooterComponent={
        isFetching && page > 1 ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator color={APP_ORANGE} />
          </View>
        ) : !hasMore && allPosts.length > 0 ? (
          <Text style={styles.noMore}>已顯示全部車源</Text>
        ) : null
      }
      ListEmptyComponent={
        !isLoading ? <Text style={styles.empty}>暫無車源</Text> : null
      }
    />
  );
}

// ─── 樣式（對照 WebApp iOS 設計語言）────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },

  // 搜索區
  searchSection: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
  logoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  logoText: { fontSize: 22, fontWeight: '700', color: '#1c1c1e', letterSpacing: -0.5 },
  logoSub: { fontSize: 12, color: '#8e8e93' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f2f2f7', borderRadius: 22, height: 44,
    paddingHorizontal: 16,
  },
  searchIcon: { fontSize: 15, marginRight: 8, color: '#8e8e93' },
  searchPlaceholder: { fontSize: 15, color: '#8e8e93', flex: 1 },

  // Segmented Control
  segmentedWrap: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  segmentedWrap2: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  segmented: {
    flexDirection: 'row', backgroundColor: '#f2f2f7',
    borderRadius: 12, padding: 4, marginBottom: 16,
  },
  segBtn: { flex: 1, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  segBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  segBtnText: { fontSize: 13, fontWeight: '600', color: '#8e8e93' },
  segBtnTextActive: { color: '#1c1c1e' },

  // 快選按鈕
  quickGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  quickBtn: {
    flex: 1, height: 34, backgroundColor: '#f5f5f7',
    borderRadius: 9, justifyContent: 'center', alignItems: 'center',
  },
  quickBtnText: { fontSize: 12, fontWeight: '500', color: '#3c3c43' },

  // 品牌網格
  brandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 },
  brandItem: { width: (SCREEN_W - 32 - 48) / 4, alignItems: 'center', gap: 6 },
  brandLogoWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#f5f5f7', justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  brandInitial: { position: 'absolute', fontSize: 16, fontWeight: '700', color: '#9ca3af' },
  brandLogo: { width: 36, height: 36 },
  brandName: { fontSize: 11, color: '#3c3c43', fontWeight: '500' },
  moreBtn: { alignItems: 'center', paddingVertical: 12 },
  moreBtnText: { fontSize: 12, color: '#8e8e93' },

  // 分類卡片
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0.5, backgroundColor: '#e8e8ed', marginTop: 8 },
  categoryCard: {
    width: (SCREEN_W - 0.5) / 2,
    backgroundColor: '#fff', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    padding: 14, minHeight: 88,
  },
  categoryTextWrap: { flex: 1 },
  categoryTitle: { fontSize: 15, fontWeight: '600', color: '#1c1c1e', lineHeight: 20 },
  categorySubtitle: { fontSize: 11, color: APP_ORANGE, fontWeight: '500', marginTop: 4 },
  categoryImg: { width: 82, height: 56, borderRadius: 6, marginLeft: 10 },

  // Banner
  bannerWrap: { height: 180, marginTop: 8, backgroundColor: '#fff', overflow: 'hidden', position: 'relative' },
  bannerSlide: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bannerImg: { width: '100%', height: '100%' },
  bannerOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'transparent',
    // gradient via background not supported in RN; use semi-transparent bg
    // actual gradient handled by a View with opacity
  },
  bannerTitle: { color: '#fff', fontSize: 14, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  bannerDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  bannerDots: { position: 'absolute', bottom: 8, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 4, zIndex: 2 },
  bannerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  bannerDotActive: { backgroundColor: '#fff' },

  // 最新上線
  latestHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4,
    marginTop: 8,
  },
  latestTitle: { fontSize: 17, fontWeight: '700', color: '#1c1c1e', letterSpacing: -0.3 },
  latestMore: { fontSize: 12, color: '#8e8e93' },

  // 車輛列表項
  vehicleItem: {
    flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#e5e5ea', backgroundColor: '#fff',
  },
  vehicleImgWrap: { position: 'relative', flexShrink: 0 },
  vehicleImg: { width: 100, height: 76, borderRadius: 10 },
  vehicleImgPlaceholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  tagBadge: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: '#EAB308', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2,
  },
  tagText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  videoIcon: {
    position: 'absolute', bottom: 4, left: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  vehicleInfo: { flex: 1, justifyContent: 'space-between', paddingVertical: 2 },
  vehicleTitle: { fontSize: 14, fontWeight: '500', color: '#1c1c1e', lineHeight: 19, letterSpacing: -0.2 },
  vehicleMeta: { fontSize: 11, color: '#8e8e93', marginTop: 3 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tagChip: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagChipText: { color: '#fff', fontSize: 10, fontWeight: '500' },
  vehiclePrice: { fontSize: 16, fontWeight: '700', color: APP_ORANGE, letterSpacing: -0.3, marginTop: 4 },

  // 底部
  noMore: { textAlign: 'center', paddingVertical: 16, color: '#8e8e93', fontSize: 13 },
  empty: { textAlign: 'center', paddingVertical: 32, color: '#8e8e93', fontSize: 14 },
});
