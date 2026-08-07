/**
 * 通關頁面 — 澳門口岸實時情況
 * 對照 WebApp AppBorder.tsx
 * 
 * 功能：
 * - 三 Tab：我的收藏 / 口岸通關 / 市內路面
 * - 攝像頭圖片（fsm/gzazhka/hktd 三種來源）
 * - 珠海口岸擁堵狀態 badge（20 秒自動刷新）
 * - 收藏/取消收藏（需登入）
 * - 口岸/區域手風琴展開
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, RefreshControl, ActivityIndicator,
  Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trpc, API_BASE_URL } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';

const APP_ORANGE = '#F97316';
const SAFE_TOP = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24) + 8;

type TabType = 'favorites' | 'border' | 'city';

// ── 珠海擁堵狀態類型 ──────────────────────────────────────────────────────────
type ZhuhaiCameraRoute = {
  routeId: number;
  routeName: string;
  congestionLevel: number;
  direction: string;
  camera: Array<{ cid: string; cname: string; sort: number; level: string; isCongestion: boolean; image: string }>;
};
type ZhuhaiStatusResponse = { cameras: ZhuhaiCameraRoute[]; congestionLevel: any[] };

// ── 擁堵 Badge 顏色 ──────────────────────────────────────────────────────────
function getCongestionBadge(level: string): { text: string; color: string; bg: string } | null {
  const l = level?.toLowerCase();
  if (l === 'green' || l === 'yellow') return { text: '順暢', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' };
  if (l === 'orange' || l === 'red') return { text: '繁忙', color: '#dc2626', bg: 'rgba(220,38,38,0.12)' };
  return null;
}

function getCongestionBadgeForCamera(camera: any, zhuhaiStatus: ZhuhaiStatusResponse | null): { text: string; color: string; bg: string } | null {
  if (camera.source !== 'gzazhka') return null;
  if (!zhuhaiStatus?.cameras?.length) return null;
  for (const route of zhuhaiStatus.cameras) {
    for (const cam of (route.camera || [])) {
      if (cam.cid === camera.sourceId) return getCongestionBadge(cam.level);
    }
  }
  return null;
}

// ── 攝像頭圖片 URL ────────────────────────────────────────────────────────────
function getCameraImgUrl(camera: any): string | null {
  if (camera.streamType === 'hls') return null;
  if (camera.source === 'fsm') return `${API_BASE_URL}/api/traffic/fsm/${camera.sourceId}.jpg`;
  if (camera.source === 'gzazhka') return `${API_BASE_URL}/api/traffic/zhuhai/${camera.sourceId}`;
  if (camera.source === 'hktd') return `https://tdcctv.data.one.gov.hk/${camera.sourceId}.JPG`;
  return null;
}

// ── Hook: 珠海擁堵狀態（20 秒自動刷新）────────────────────────────────────────
function useZhuhaiStatus() {
  const [data, setData] = useState<ZhuhaiStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/traffic/zhuhai-status`);
      if (res.ok) {
        const json: ZhuhaiStatusResponse = await res.json();
        setData(json);
        setError(null);
      } else {
        setError('擁堵狀態暫時不可用');
      }
    } catch {
      setError('網絡連接失敗');
    }
  }, []);

  useEffect(() => {
    fetch_();
    intervalRef.current = setInterval(fetch_, 20_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetch_]);

  return { data, error };
}

// ── 攝像頭卡片 ────────────────────────────────────────────────────────────────
function CameraCard({ camera, zhuhaiStatus, onFavToggle, isFav }: {
  camera: any;
  zhuhaiStatus?: ZhuhaiStatusResponse | null;
  onFavToggle?: (cam: any) => void;
  isFav?: boolean;
}) {
  const imgUrl = getCameraImgUrl(camera);
  const badge = getCongestionBadgeForCamera(camera, zhuhaiStatus || null);
  // 圖片 URL 加時間戳（每 10 秒更新一次，防緩存）
  const [tick, setTick] = useState(Math.floor(Date.now() / 10000));
  useEffect(() => {
    const t = setInterval(() => setTick(Math.floor(Date.now() / 10000)), 10000);
    return () => clearInterval(t);
  }, []);
  const timedUrl = imgUrl ? `${imgUrl}${imgUrl.includes('?') ? '&' : '?'}t=${tick}` : null;

  return (
    <View style={s.card}>
      <View style={s.imgBox}>
        {timedUrl ? (
          <Image
            source={{ uri: timedUrl }}
            style={s.img}
            resizeMode="cover"
          />
        ) : (
          <View style={[s.img, s.imgPlaceholder]}>
            <Ionicons name="videocam-outline" size={20} color="#9ca3af" />
            <Text style={s.imgPlaceholderText}>點擊播放</Text>
          </View>
        )}
        {badge && (
          <View style={[s.badge, { backgroundColor: badge.bg, borderColor: badge.color }]}>
            <Text style={[s.badgeText, { color: badge.color }]}>{badge.text}</Text>
          </View>
        )}
        {onFavToggle && (
          <TouchableOpacity
            style={s.starBtn}
            onPress={() => onFavToggle(camera)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isFav ? 'star' : 'star-outline'}
              size={14}
              color={isFav ? APP_ORANGE : '#fff'}
            />
          </TouchableOpacity>
        )}
      </View>
      <Text style={s.camName} numberOfLines={1}>{camera.name}</Text>
    </View>
  );
}

// ── 口岸手風琴 ────────────────────────────────────────────────────────────────
function BorderAccordion({ point, zhuhaiStatus, onFavToggle, favIds }: {
  point: any;
  zhuhaiStatus: ZhuhaiStatusResponse | null;
  onFavToggle: (cam: any) => void;
  favIds: Set<number>;
}) {
  const [expanded, setExpanded] = useState(false);
  const total = (point.vehicleCameras?.length || 0) + (point.pedestrianCameras?.length || 0);
  return (
    <View style={s.accordion}>
      <TouchableOpacity style={s.accordionHeader} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <Text style={s.accordionTitle}>{point.name}</Text>
        <View style={s.accordionRight}>
          <Text style={s.accordionCount}>{total} 個攝像頭</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#9ca3af" />
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={s.accordionBody}>
          {point.vehicleCameras?.length > 0 && (
            <View style={s.subSection}>
              <View style={s.subHeader}>
                <Text style={s.subIcon}>🚗</Text>
                <Text style={s.subTitle}>車道通關</Text>
              </View>
              <View style={s.grid}>
                {point.vehicleCameras.map((cam: any) => (
                  <View key={cam.id} style={s.gridItem}>
                    <CameraCard camera={cam} zhuhaiStatus={zhuhaiStatus} onFavToggle={onFavToggle} isFav={favIds.has(cam.id)} />
                  </View>
                ))}
              </View>
            </View>
          )}
          {point.pedestrianCameras?.length > 0 && (
            <View style={s.subSection}>
              <View style={s.subHeader}>
                <Text style={s.subIcon}>🚶</Text>
                <Text style={s.subTitle}>人流通關</Text>
              </View>
              <View style={s.grid}>
                {point.pedestrianCameras.map((cam: any) => (
                  <View key={cam.id} style={s.gridItem}>
                    <CameraCard camera={cam} zhuhaiStatus={zhuhaiStatus} onFavToggle={onFavToggle} isFav={favIds.has(cam.id)} />
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── 區域手風琴 ────────────────────────────────────────────────────────────────
function CityAccordion({ group, onFavToggle, favIds }: {
  group: any;
  onFavToggle: (cam: any) => void;
  favIds: Set<number>;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={s.accordion}>
      <TouchableOpacity style={s.accordionHeader} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <Text style={s.accordionTitle}>{group.region}</Text>
        <View style={s.accordionRight}>
          <Text style={s.accordionCount}>{group.cameras?.length || 0} 個攝像頭</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#9ca3af" />
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={s.accordionBody}>
          <View style={s.grid}>
            {group.cameras?.map((cam: any) => (
              <View key={cam.id} style={s.gridItem}>
                <CameraCard camera={cam} onFavToggle={onFavToggle} isFav={favIds.has(cam.id)} />
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────────────────────
export default function BorderScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('border');
  const { user } = useAuth();
  const { data: zhuhaiStatus, error: zhuhaiError } = useZhuhaiStatus();

  // 攝像頭數據
  const borderQuery = trpc.traffic.getBorderPoints.useQuery(undefined, { staleTime: 60_000 });
  const cityQuery = trpc.traffic.getCityCameras.useQuery(undefined, { staleTime: 60_000 });
  const favQuery = trpc.traffic.getFavorites.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30_000,
  });

  // 收藏操作
  const utils = trpc.useUtils();
  const addFav = trpc.traffic.addFavorite.useMutation({
    onSuccess: () => utils.traffic.getFavorites.invalidate(),
  });
  const removeFav = trpc.traffic.removeFavorite.useMutation({
    onSuccess: () => utils.traffic.getFavorites.invalidate(),
  });

  const favIds = new Set<number>((favQuery.data || []).map((f: any) => f.camera?.id).filter(Boolean));

  const handleFavToggle = (cam: any) => {
    if (!user) {
      Alert.alert('請先登入', '登入後即可收藏攝像頭');
      return;
    }
    if (favIds.has(cam.id)) {
      removeFav.mutate({ cameraId: cam.id });
    } else {
      addFav.mutate({ cameraId: cam.id });
    }
  };

  const isLoading = activeTab === 'border' ? borderQuery.isLoading
    : activeTab === 'city' ? cityQuery.isLoading
    : favQuery.isLoading;

  const handleRefresh = () => {
    if (activeTab === 'border') borderQuery.refetch();
    else if (activeTab === 'city') cityQuery.refetch();
    else favQuery.refetch();
  };

  const TABS: { key: TabType; label: string }[] = [
    { key: 'favorites', label: '我的收藏' },
    { key: 'border', label: '口岸通關' },
    { key: 'city', label: '市內路面' },
  ];

  return (
    <View style={s.container}>
      {/* 頂部標題 */}
      <View style={[s.header, { paddingTop: SAFE_TOP }]}>
        <Text style={s.headerTitle}>實時路況</Text>
        <Text style={s.headerSub}>澳門口岸及市內攝像頭</Text>
      </View>

      {/* Segmented Control */}
      <View style={s.tabBar}>
        <View style={s.tabBg}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[s.tabItem, activeTab === tab.key && s.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 珠海擁堵狀態錯誤提示 */}
      {zhuhaiError && activeTab === 'border' && (
        <View style={s.warnBanner}>
          <Ionicons name="warning-outline" size={14} color="#92400e" />
          <Text style={s.warnText}>{zhuhaiError}，口岸攝像頭正常顯示</Text>
        </View>
      )}

      {/* 內容區 */}
      {isLoading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={APP_ORANGE} size="large" />
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={handleRefresh}
              tintColor={APP_ORANGE}
              colors={[APP_ORANGE]}
            />
          }
        >
          {/* 我的收藏 */}
          {activeTab === 'favorites' && (
            !user ? (
              <View style={s.emptyWrap}>
                <Ionicons name="star-outline" size={48} color="#d1d5db" />
                <Text style={s.emptyTitle}>登入後即可使用收藏功能</Text>
              </View>
            ) : (favQuery.data || []).length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyBig}>⭐</Text>
                <Text style={s.emptyTitle}>尚未收藏任何攝像頭</Text>
                <Text style={s.emptySub}>在「口岸通關」或「市內路面」點擊星標即可收藏</Text>
              </View>
            ) : (
              <View style={s.gridFav}>
                {(favQuery.data || []).map((fav: any) => fav.camera && (
                  <View key={fav.id} style={s.gridItem}>
                    <CameraCard
                      camera={fav.camera}
                      zhuhaiStatus={zhuhaiStatus}
                      onFavToggle={handleFavToggle}
                      isFav={true}
                    />
                  </View>
                ))}
              </View>
            )
          )}

          {/* 口岸通關 */}
          {activeTab === 'border' && (
            (borderQuery.data || []).length === 0 ? (
              <View style={s.emptyWrap}>
                <Ionicons name="camera-outline" size={48} color="#d1d5db" />
                <Text style={s.emptyTitle}>暫無口岸攝像頭數據</Text>
              </View>
            ) : (
              <View style={s.sectionList}>
                {(borderQuery.data || []).map((point: any) => (
                  <BorderAccordion
                    key={point.name}
                    point={point}
                    zhuhaiStatus={zhuhaiStatus}
                    onFavToggle={handleFavToggle}
                    favIds={favIds}
                  />
                ))}
              </View>
            )
          )}

          {/* 市內路面 */}
          {activeTab === 'city' && (
            (cityQuery.data || []).length === 0 ? (
              <View style={s.emptyWrap}>
                <Ionicons name="camera-outline" size={48} color="#d1d5db" />
                <Text style={s.emptyTitle}>暫無市內攝像頭數據</Text>
              </View>
            ) : (
              <View style={s.sectionList}>
                {(cityQuery.data || []).map((group: any) => (
                  <CityAccordion
                    key={group.region}
                    group={group}
                    onFavToggle={handleFavToggle}
                    favIds={favIds}
                  />
                ))}
              </View>
            )
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── 樣式 ──────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: {
    backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 10,
    borderBottomWidth: 0.5, borderBottomColor: '#e5e5ea',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#1c1c1e' },
  headerSub: { fontSize: 13, color: '#8e8e93', marginTop: 2 },
  tabBar: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8 },
  tabBg: { flexDirection: 'row', backgroundColor: '#f2f2f7', borderRadius: 10, padding: 3 },
  tabItem: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  tabItemActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '500', color: '#8e8e93' },
  tabTextActive: { color: APP_ORANGE, fontWeight: '600' },
  warnBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fef3c7', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: '#fde68a',
  },
  warnText: { fontSize: 12, color: '#92400e', flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  sectionList: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  accordion: {
    backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  accordionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  accordionTitle: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  accordionRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accordionCount: { fontSize: 12, color: '#8e8e93' },
  accordionBody: { paddingHorizontal: 12, paddingBottom: 12 },
  subSection: { marginBottom: 8 },
  subHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  subIcon: { fontSize: 14 },
  subTitle: { fontSize: 13, fontWeight: '600', color: '#374151' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  gridItem: { width: '47%' },
  card: { backgroundColor: '#f9fafb', borderRadius: 8, overflow: 'hidden' },
  imgBox: { position: 'relative', aspectRatio: 16 / 9, backgroundColor: '#e5e7eb' },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: { justifyContent: 'center', alignItems: 'center', gap: 4 },
  imgPlaceholderText: { fontSize: 10, color: '#9ca3af' },
  badge: {
    position: 'absolute', top: 4, left: 4,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
  starBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center',
  },
  camName: { fontSize: 11, fontWeight: '500', color: '#374151', paddingHorizontal: 6, paddingVertical: 5 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyBig: { fontSize: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySub: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 32 },
});
