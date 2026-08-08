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
import { Modal } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { trpc, API_BASE_URL } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';

const APP_ORANGE = '#F97316';
const SAFE_TOP = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24) + 8;

type TabType = 'favorites' | 'border' | 'city' | 'carpark';

// ── 停車場類型 ──────────────────────────────────────────────────────────────────
type Carpark = {
  name: string;
  updatedAt: string;
  carAvail: number | null;
  carTotal: number | null;
  motoAvail: number | null;
  motoTotal: number | null;
  status: string;
};

// ── Hook: 停車場實時數據（60 秒自動刷新）────────────────────────────────────────
function useCarparkData() {
  const [data, setData] = useState<Carpark[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/traffic/carparks`);
      if (res.ok) {
        const json = await res.json();
        setData(json.carparks || []);
        setFetchedAt(json.fetchedAt || null);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(); // 立即執行一次，不等 60 秒
    const t = setInterval(fetchData, 60_000);
    return () => clearInterval(t);
  }, [fetchData]);

  return { data, loading, fetchedAt, refetch: fetchData };
}

// ── 停車場卡片 ────────────────────────────────────────────────────────────────
function CarparkCard({ cp }: { cp: Carpark }) {
  const statusColor = cp.status === 'full' ? '#dc2626' : cp.status === 'busy' ? '#f97316' : '#16a34a';
  const statusText = cp.status === 'full' ? '車位已滿' : cp.status === 'busy' ? '車位緊張' : '有車位';
  const statusBg = cp.status === 'full' ? 'rgba(220,38,38,0.1)' : cp.status === 'busy' ? 'rgba(249,115,22,0.1)' : 'rgba(22,163,74,0.1)';
  return (
    <View style={cp2.card}>
      <View style={cp2.cardHeader}>
        <Text style={cp2.name} numberOfLines={1}>{cp.name}</Text>
        <View style={[cp2.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={[cp2.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>
      </View>
      <View style={cp2.stats}>
        {cp.carAvail !== null && (
          <View style={cp2.statItem}>
            <Ionicons name="car-outline" size={14} color="#6b7280" />
            <Text style={cp2.statLabel}>私家車</Text>
            <Text style={[cp2.statNum, { color: statusColor }]}>{cp.carAvail}</Text>
            {cp.carTotal !== null && <Text style={cp2.statTotal}>/{cp.carTotal}</Text>}
          </View>
        )}
        {cp.motoAvail !== null && (
          <View style={cp2.statItem}>
            <Ionicons name="bicycle-outline" size={14} color="#6b7280" />
            <Text style={cp2.statLabel}>電單車</Text>
            <Text style={[cp2.statNum, { color: '#6b7280' }]}>{cp.motoAvail}</Text>
            {cp.motoTotal !== null && <Text style={cp2.statTotal}>/{cp.motoTotal}</Text>}
          </View>
        )}
        {cp.carAvail === null && cp.motoAvail === null && (
          <Text style={cp2.noData}>暫無車位數據</Text>
        )}
      </View>
      <Text style={cp2.time}>更新：{cp.updatedAt}</Text>
    </View>
  );
}

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
  // DSAT HLS 攝像頭：用 imageUrl 欄位作縮圖（BMP 靜態截圖）
  if (camera.streamType === 'hls' && camera.source === 'dsat') {
    if (camera.imageUrl) {
      const bmpId = camera.imageUrl.split('/').pop();
      return `${API_BASE_URL}/api/traffic/dsat-img/${bmpId}`;
    }
    return null;
  }
  if (camera.streamType === 'hls') return null; // 其他 HLS 無縮圖
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

// ── HLS 播放 Modal ────────────────────────────────────────────────────────────
function HlsPlayerModal({ camera, onClose }: { camera: any; onClose: () => void }) {
  const [status, setStatus] = useState<any>({});
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* 關閉按鈕 */}
        <TouchableOpacity
          style={{ position: 'absolute', top: SAFE_TOP, right: 16, zIndex: 10, padding: 8 }}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle" size={32} color="#fff" />
        </TouchableOpacity>
        {/* 視頻播放器 */}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Video
            source={{ uri: camera.streamUrl }}
            style={{ width: '100%', aspectRatio: 16 / 9 }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping
            onPlaybackStatusUpdate={s => setStatus(s)}
          />
          {/* 加載中提示 */}
          {!status.isLoaded && !status.error && (
            <View style={{ position: 'absolute', alignSelf: 'center' }}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                正在連接直播流...
              </Text>
            </View>
          )}
          {/* 錯誤提示 */}
          {status.error && (
            <View style={{ position: 'absolute', alignSelf: 'center', alignItems: 'center', gap: 8 }}>
              <Ionicons name="warning-outline" size={40} color="#ef4444" />
              <Text style={{ color: '#fff', fontSize: 14 }}>直播流暫時不可用</Text>
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>請稍後再試</Text>
            </View>
          )}
        </View>
        {/* 底部信息 */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{camera.name}</Text>
          <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>澳門交通事務局 DSAT 實時直播</Text>
        </View>
      </View>
    </Modal>
  );
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
  const [showPlayer, setShowPlayer] = useState(false);
  // 圖片 URL 加時間戳（每 10 秒更新一次，防緩存）
  const [tick, setTick] = useState(Math.floor(Date.now() / 10000));
  useEffect(() => {
    const t = setInterval(() => setTick(Math.floor(Date.now() / 10000)), 10000);
    return () => clearInterval(t);
  }, []);
  const timedUrl = imgUrl ? `${imgUrl}${imgUrl.includes('?') ? '&' : '?'}t=${tick}` : null;
  const isHls = camera.streamType === 'hls' && !!camera.streamUrl;

  return (
    <View style={s.card}>
      {showPlayer && isHls && (
        <HlsPlayerModal camera={camera} onClose={() => setShowPlayer(false)} />
      )}
      <View style={s.imgBox}>
        {timedUrl ? (
          <TouchableOpacity
            style={s.imgBox}
            onPress={isHls ? () => setShowPlayer(true) : undefined}
            activeOpacity={isHls ? 0.7 : 1}
          >
            <Image
              source={{ uri: timedUrl }}
              style={s.img}
              resizeMode="cover"
            />
            {isHls && (
              <View style={[s.playBadge, { bottom: 8, right: 8 }]}>
                <Ionicons name="play-circle" size={28} color={APP_ORANGE} />
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.img, s.imgPlaceholder]}
            onPress={isHls ? () => setShowPlayer(true) : undefined}
            activeOpacity={isHls ? 0.7 : 1}
          >
            <Ionicons name="videocam-outline" size={20} color="#9ca3af" />
            <Text style={s.imgPlaceholderText}>{isHls ? '點擊播放直播' : '暫無畫面'}</Text>
            {isHls && (
              <View style={s.playBadge}>
                <Ionicons name="play-circle" size={28} color={APP_ORANGE} />
              </View>
            )}
          </TouchableOpacity>
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

  const carparkHook = useCarparkData();

  // 進入停車場 Tab 時自動加載
  useEffect(() => {
    if (activeTab === 'carpark' && carparkHook.data.length === 0) {
      carparkHook.refetch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const isLoading = activeTab === 'border' ? borderQuery.isLoading
    : activeTab === 'city' ? cityQuery.isLoading
    : activeTab === 'carpark' ? carparkHook.loading
    : favQuery.isLoading;

  const handleRefresh = () => {
    if (activeTab === 'border') borderQuery.refetch();
    else if (activeTab === 'city') cityQuery.refetch();
    else if (activeTab === 'carpark') carparkHook.refetch();
    else favQuery.refetch();
  };

  const TABS: { key: TabType; label: string }[] = [
    { key: 'favorites', label: '我的收藏' },
    { key: 'border', label: '口岸通關' },
    { key: 'city', label: '市內路面' },
    { key: 'carpark', label: '停車場' },
  ];

  return (
    <View style={s.container}>
      {/* 頂部標題 */}
      <View style={[s.header, { paddingTop: SAFE_TOP }]}>
        <Text style={s.headerTitle}>實時路況</Text>
        <Text style={s.headerSub}>澳門口岸、市內攝像頭及停車場</Text>
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

          {/* 停車場 */}
          {activeTab === 'carpark' && (
            carparkHook.data.length === 0 ? (
              <View style={s.emptyWrap}>
                <Ionicons name="car-outline" size={48} color="#d1d5db" />
                <Text style={s.emptyTitle}>暫無停車場數據</Text>
                <Text style={s.emptySub}>下拉刷新重試</Text>
              </View>
            ) : (
              <View style={cp2.list}>
                {carparkHook.fetchedAt && (
                  <Text style={cp2.fetchTime}>
                    數據更新：{new Date(carparkHook.fetchedAt).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </Text>
                )}
                {carparkHook.data.map((cp, i) => (
                  <CarparkCard key={i} cp={cp} />
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  gridFav: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  gridItem: { width: '47%' },
  card: { backgroundColor: '#f9fafb', borderRadius: 8, overflow: 'hidden' },
  imgBox: { position: 'relative', aspectRatio: 16 / 9, backgroundColor: '#e5e7eb' },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: { justifyContent: 'center', alignItems: 'center', gap: 4 },
  imgPlaceholderText: { fontSize: 10, color: '#9ca3af' },
  playBadge: { position: 'absolute', bottom: 6, right: 6 },
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

// ── 停車場樣式 ────────────────────────────────────────────────────────────────
const cp2 = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  fetchTime: { fontSize: 11, color: '#9ca3af', textAlign: 'right', marginBottom: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  name: { fontSize: 14, fontWeight: '600', color: '#1c1c1e', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 16, marginBottom: 6 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 12, color: '#6b7280' },
  statNum: { fontSize: 14, fontWeight: '700' },
  statTotal: { fontSize: 11, color: '#9ca3af' },
  noData: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },
  time: { fontSize: 10, color: '#9ca3af' },
});
