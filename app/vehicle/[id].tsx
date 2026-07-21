/**
 * 車輛詳情頁 — 對照 WebApp AppDetail.tsx
 * API: trpc.vehicle.getPostById + trpc.vehicleFavorite + trpc.chat.getOrCreateRoom
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, FlatList, Linking, Share, Alert,
  Platform, StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { trpc, resolveImageUrl } from '../../lib/trpc';
import { APP_ORANGE } from '../../constants/data';

const { width: SCREEN_W } = Dimensions.get('window');
const IMG_H = 260;

const QUICK_QUESTIONS = [
  '可以試車嗎？', '價錢有得傾嗎？', '有冇事故記錄？',
  '可以分期嗎？', '幾時可以睇車？', '有冇保養記錄？',
];

const FUEL_TYPE_LABELS: Record<string, string> = {
  petrol: '汽油', diesel: '柴油', electric: '純電',
  hybrid: '油電混合', pluginHybrid: '插電混合',
};

function maskPlate(plate: string, showFull: boolean): string {
  if (showFull || !plate) return plate;
  const parts = plate.split('-');
  if (parts.length === 3) return `${parts[0]}-**-${parts[2]}`;
  return plate.replace(/(.{2})(.+)(.{2})$/, '$1****$3');
}

function maskVin(v: string): string {
  if (!v || v.length < 10) return v;
  return `${v.slice(0, 6)}***${v.slice(-4)}`;
}

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const numId = Number(id);
  const isNumericId = !isNaN(numId) && numId > 0;

  const [imgIdx, setImgIdx] = useState(0);
  const [quickMsg, setQuickMsg] = useState<string | null>(null);
  const [favorited, setFavorited] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // ── API 調用（對照 WebApp）──────────────────────────────────────────────────
  const { data: me } = trpc.auth.me.useQuery();
  const { data, isLoading } = trpc.vehicle.getPostById.useQuery(
    { id: numId },
    { enabled: isNumericId, retry: false }
  );
  const { data: isFavoritedData } = trpc.vehicleFavorite.isFavorited.useQuery(
    { postId: numId },
    { enabled: isNumericId && !!me }
  );
  const { data: similarData } = trpc.vehicle.listPosts.useQuery(
    { vehicleType: 'car', page: 1, pageSize: 6 },
    { enabled: isNumericId }
  );

  const toggleFavoriteMutation = trpc.vehicleFavorite.toggleFavorite.useMutation({
    onSuccess: (res) => setFavorited(res.favorited),
  });
  const createRoomMutation = trpc.chat.getOrCreateRoom.useMutation({
    onSuccess: (res) => router.push(`/chat/${res.roomId}`),
    onError: (err) => {
      if (err.message === '不能與自己聊天') Alert.alert('提示', '不能與自己聊天');
      else router.push('/login');
    },
  });

  useEffect(() => {
    if (isFavoritedData !== undefined) setFavorited(isFavoritedData);
  }, [isFavoritedData]);

  const post = isNumericId ? data?.post : null;
  const photos = isNumericId ? (data?.photos || []) : [];
  const seller = isNumericId ? data?.seller : null;
  const similarPosts = (similarData?.items || []).filter((p: any) => p.id !== numId).slice(0, 4);

  // 解析顯示值（對照 WebApp）
  const images: string[] = photos.length ? photos.map((p: any) => resolveImageUrl(p.url) || p.url) : [];
  const title = post ? (post.title || `${(post as any).brandName || ''} ${(post as any).modelName || ''}`.trim() || '未命名車源') : '載入中...';
  const priceVal = (post as any)?.price;
  const priceTxt = priceVal && Number(priceVal) > 0 ? `HKD ${Number(priceVal).toLocaleString()}` : '面議';
  const originalPrice = (post as any)?.originalPrice ? `新車含稅價 MOP ${Number((post as any).originalPrice).toLocaleString()}` : null;
  const sellerPhone = (post as any)?.contactPhone || seller?.phone || '';
  const sellerName = seller?.name || 'GoGoCar 認證賣家';
  const no = post?.id ? `GG-${post.id.toString().padStart(6, '0')}` : '';
  const videoUrl = (post as any)?.videoUrl || null;

  const brandName = (post as any)?.brandName || '';
  const modelName = (post as any)?.modelName || '';
  const year = (post as any)?.year ? `${(post as any).year} 年` : '';
  const mileage = (post as any)?.mileage ? `${(post as any).mileage.toLocaleString()} km` : '';
  const engine = (post as any)?.engineCapacity ? `${(post as any).engineCapacity} cc` : '';
  const gear = (post as any)?.transmission ? ((post as any).transmission === 'auto' ? '自動波' : '手波') : '';
  const fuelType = (post as any)?.fuelType ? (FUEL_TYPE_LABELS[(post as any).fuelType] || (post as any).fuelType) : '';
  const colorName = (post as any)?.colorName || '';
  const seats = (post as any)?.seats || '';
  const doors = (post as any)?.doors || '';
  const horsepower = (post as any)?.horsepower || '';
  const sellerAddr = (post as any)?.address || '';
  const description = (post as any)?.description || '暫無描述';
  const features: string[] = (post as any)?.features || [];
  const plateNumber = (post as any)?.plateNumber || '';
  const showFullPlate = (post as any)?.showFullPlate || false;
  const registrationDate = (post as any)?.firstRegDate || (post as any)?.registrationDate || '';
  const transferCount = (post as any)?.transferCount ?? null;
  const vin = (post as any)?.vin || '';
  const inspectionExpiry = (post as any)?.inspectionExpiry || '';
  const insuranceExpiry = (post as any)?.insuranceExpiry || '';

  const specRows = [
    brandName ? { label: '品牌', value: brandName } : null,
    modelName ? { label: '型號', value: modelName } : null,
    year ? { label: '首次登記', value: year } : null,
    mileage ? { label: '行駛里數', value: mileage } : null,
    engine ? { label: '排氣量', value: engine } : null,
    gear ? { label: '變速箱', value: gear } : null,
    fuelType ? { label: '燃油類型', value: fuelType } : null,
    colorName ? { label: '車身顏色', value: colorName } : null,
    seats ? { label: '座位數', value: `${seats} 座` } : null,
    doors ? { label: '車門數', value: `${doors} 門` } : null,
    horsepower ? { label: '馬力', value: `${horsepower} HP` } : null,
    sellerAddr ? { label: '看車地址', value: sellerAddr } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  // ── 操作處理 ─────────────────────────────────────────────────────────────────
  const handleFavorite = () => {
    if (!me) { Alert.alert('提示', '請先登入才能收藏'); return; }
    if (isNumericId) toggleFavoriteMutation.mutate({ postId: numId });
    else setFavorited(v => !v);
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `GoGoCar 車源：${title}\nhttps://gogocar853.manus.space/app/vehicle/${id}` });
    } catch {}
  };

  const handleWhatsApp = () => {
    const msgText = quickMsg
      ? `你好，我想查詢這輛車：https://gogocar853.manus.space/app/vehicle/${id}\n${quickMsg}`
      : `你好，我想查詢這輛車：https://gogocar853.manus.space/app/vehicle/${id}`;
    const phone = sellerPhone?.replace(/\D/g, '');
    const url = phone
      ? `https://wa.me/853${phone}?text=${encodeURIComponent(msgText)}`
      : `https://wa.me/?text=${encodeURIComponent(msgText)}`;
    Linking.openURL(url);
  };

  const handleChat = () => {
    if (!me) { Alert.alert('提示', '請先登入才能使用站內聊天'); return; }
    if (isNumericId) createRoomMutation.mutate({ postId: numId });
  };

  // ── 載入中 ────────────────────────────────────────────────────────────────────
  if (isLoading && isNumericId) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        {/* 載入中也顯示返回按鈕 */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnAbsolute} activeOpacity={0.8}>
          <Text style={styles.backBtnText}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={APP_ORANGE} size="large" />
          <Text style={styles.loadingText}>載入中...</Text>
        </View>
      </View>
    );
  }

  // ── 渲染 ──────────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 圖片輪播（對照 WebApp 圖片輪播） */}
        <View style={styles.imageSection}>
          {images.length > 0 ? (
            <>
              <FlatList
                ref={flatListRef}
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={styles.carImage} contentFit="cover" />
                )}
                onMomentumScrollEnd={e => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                  setImgIdx(idx);
                }}
              />
              <View style={styles.imgCounter}>
                <Text style={styles.imgCounterText}>{imgIdx + 1} / {images.length}</Text>
              </View>
              <View style={styles.imgDots}>
                {images.map((_, i) => (
                  <View key={i} style={[styles.dot, i === imgIdx && styles.dotActive]} />
                ))}
              </View>
            </>
          ) : (
            <View style={[styles.carImage, styles.carImagePlaceholder]}>
              <Text style={{ fontSize: 48 }}>🚗</Text>
            </View>
          )}

          {/* 自定義返回按鈕（疊加在圖片左上角） */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.backBtnText}>{'‹'}</Text>
          </TouchableOpacity>

          {/* 右上角操作按鈕（收藏 + 分享） */}
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleFavorite} style={styles.headerActionBtn} activeOpacity={0.8}>
              <Text style={{ fontSize: 16 }}>{favorited ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.headerActionBtn} activeOpacity={0.8}>
              <Text style={{ fontSize: 16 }}>📤</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 價格與標題（對照 WebApp 價格區塊） */}
        <View style={styles.priceSection}>
          {no ? <Text style={styles.vehicleNo}>編號 {no}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <Text style={styles.price}>{priceTxt}</Text>
            {originalPrice && <Text style={styles.originalPrice}>{originalPrice}</Text>}
          </View>
          <Text style={styles.vehicleTitle}>{title}</Text>
          <View style={styles.chipRow}>
            {year ? <ChipTag label={year} /> : null}
            {mileage ? <ChipTag label={mileage} /> : null}
            {gear ? <ChipTag label={gear} /> : null}
            {engine ? <ChipTag label={engine} /> : null}
          </View>
        </View>

        {/* 車輛規格（對照 WebApp specRows） */}
        {specRows.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>車輛規格</Text>
            {specRows.map((row, i) => (
              <View key={row.label} style={[styles.specRow, i < specRows.length - 1 && styles.specRowBorder]}>
                <Text style={styles.specLabel}>{row.label}</Text>
                <Text style={styles.specValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 配置亮點 */}
        {features.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>配置亮點</Text>
            <View style={styles.featuresWrap}>
              {features.map((f, i) => (
                <View key={i} style={styles.featureTag}>
                  <Text style={styles.featureTagText}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 車輛信息 */}
        {(plateNumber || registrationDate || inspectionExpiry || insuranceExpiry || transferCount !== null || vin) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>車輛信息</Text>
            {plateNumber ? <Text style={styles.infoText}>車牌號：{maskPlate(plateNumber, showFullPlate)}</Text> : null}
            {registrationDate ? <Text style={styles.infoText}>首次登記：{registrationDate}</Text> : null}
            {transferCount !== null ? <Text style={styles.infoText}>轉手次數：轉手 {transferCount} 次</Text> : null}
            {vin ? <Text style={styles.infoText}>VIN 車架號：{maskVin(vin)}</Text> : null}
            {inspectionExpiry ? <Text style={styles.infoText}>驗車有效期：{inspectionExpiry}</Text> : null}
            {insuranceExpiry ? <Text style={styles.infoText}>保險有效期：{insuranceExpiry}</Text> : null}
          </View>
        )}

        {/* 車輛描述 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>車輛描述</Text>
          <Text style={styles.description}>{description}</Text>
        </View>

        {/* 影片（如有） */}
        {videoUrl ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>車輛影片</Text>
            <TouchableOpacity
              style={styles.videoThumb}
              onPress={() => Linking.openURL(videoUrl)}
              activeOpacity={0.85}
            >
              <View style={styles.videoPlayIcon}>
                <Text style={styles.videoPlayText}>▶</Text>
              </View>
              <Text style={styles.videoHint}>點擊觀看影片</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* 舉報 */}
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <TouchableOpacity onPress={() => Alert.alert('提示', '舉報已提交，我們將在 24 小時內處理')}>
            <Text style={{ fontSize: 12, color: '#8e8e93' }}>舉報此車源</Text>
          </TouchableOpacity>
        </View>

        {/* 相似車源（對照 WebApp 橫向滾動） */}
        {similarPosts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>相似車源</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
              {similarPosts.map((v: any) => {
                const vTitle = v.title || `${v.brandName || ''} ${v.modelName || ''}`.trim();
                const vPrice = v.price ? `HKD ${Number(v.price).toLocaleString()}` : '面議';
                const vImg = resolveImageUrl(v.coverImageUrl || v.coverUrl);
                const vYear = v.year ? `${v.year}年` : '';
                const vMileage = v.mileage ? `${Number(v.mileage).toLocaleString()} km` : '';
                return (
                  <TouchableOpacity key={v.id} style={styles.similarCard} onPress={() => router.push(`/vehicle/${v.id}`)}>
                    {vImg ? (
                      <Image source={{ uri: vImg }} style={styles.similarImg} contentFit="cover" />
                    ) : (
                      <View style={[styles.similarImg, { backgroundColor: '#f2f2f7', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ fontSize: 24 }}>🚗</Text>
                      </View>
                    )}
                    <Text style={styles.similarTitle} numberOfLines={2}>{vTitle}</Text>
                    <Text style={styles.similarPrice}>{vPrice}</Text>
                    <Text style={styles.similarMeta}>{vYear}{vMileage ? ` · ${vMileage}` : ''}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 底部留白（給 BottomBar 讓位） */}
        <View style={{ height: 180 }} />
      </ScrollView>

      {/* 底部操作欄（對照 WebApp BottomBar） */}
      <View style={styles.bottomBar}>
        {/* Layer 1: 快速提問 chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickMsgRow} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
          {QUICK_QUESTIONS.map(q => (
            <TouchableOpacity
              key={q}
              style={[styles.quickMsgChip, quickMsg === q && styles.quickMsgChipActive]}
              onPress={() => setQuickMsg(quickMsg === q ? null : q)}
            >
              <Text style={[styles.quickMsgText, quickMsg === q && styles.quickMsgTextActive]}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Layer 2: 賣家信息 */}
        <View style={styles.sellerRow}>
          <View style={styles.sellerAvatar}>
            <Text style={{ fontSize: 18 }}>👤</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sellerName}>{sellerName}</Text>
            <Text style={styles.sellerLabel}>GoGoCar 認證賣家</Text>
          </View>
        </View>

        {/* Layer 3: 操作按鈕 */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.chatBtn} onPress={handleChat}>
            <Text style={styles.chatBtnText}>💬 站內聊天</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp}>
            <Text style={styles.whatsappBtnText}>📱 WhatsApp</Text>
          </TouchableOpacity>
          {sellerPhone ? (
            <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${sellerPhone}`)}>
              <Text style={styles.callBtnText}>📞</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ChipTag({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const SAFE_TOP = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24) + 8;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#8e8e93', fontSize: 14 },
  scroll: { flex: 1 },
  headerBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },

  // 自定義返回按鈕（疊加在圖片上）
  backBtn: {
    position: 'absolute',
    top: SAFE_TOP,
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnAbsolute: {
    position: 'absolute',
    top: SAFE_TOP,
    left: 16,
    zIndex: 100,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 32,
    marginTop: -2,
    textAlign: 'center',
  },

  // 右上角操作按鈕
  headerActions: {
    position: 'absolute',
    top: SAFE_TOP,
    right: 12,
    zIndex: 10,
    flexDirection: 'row',
    gap: 8,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 圖片
  imageSection: { backgroundColor: '#f2f2f7', height: IMG_H },
  carImage: { width: SCREEN_W, height: IMG_H },
  carImagePlaceholder: { backgroundColor: '#f2f2f7', justifyContent: 'center', alignItems: 'center' },
  imgCounter: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  imgCounterText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  imgDots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotActive: { width: 16, backgroundColor: '#fff' },

  // 價格區塊
  priceSection: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  vehicleNo: { fontSize: 11, color: '#8e8e93', marginBottom: 4, letterSpacing: 0.5 },
  price: { fontSize: 28, fontWeight: '700', color: APP_ORANGE, letterSpacing: -0.5 },
  originalPrice: { fontSize: 12, color: '#8e8e93' },
  vehicleTitle: { fontSize: 15, fontWeight: '600', color: '#1c1c1e', lineHeight: 22 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { backgroundColor: '#f5f5f7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 11, color: '#3c3c43', fontWeight: '500' },

  // 通用 section
  section: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1c1c1e', marginBottom: 8 },

  // 規格表
  specRow: { flexDirection: 'row', alignItems: 'center', height: 44 },
  specRowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  specLabel: { fontSize: 13, color: '#8e8e93', width: 88, flexShrink: 0 },
  specValue: { fontSize: 13, color: '#1c1c1e', fontWeight: '500', flex: 1, textAlign: 'right' },

  // 配置亮點
  featuresWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureTag: { backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: '#FFE0B2', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  featureTagText: { fontSize: 12, color: '#E65100', fontWeight: '500' },

  // 車輛信息
  infoText: { fontSize: 12, color: '#6b7280', marginBottom: 4 },

  // 描述
  description: { fontSize: 13, color: '#6b7280', lineHeight: 20 },

  // 影片
  videoThumb: {
    height: 80,
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  videoPlayIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: APP_ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayText: { color: '#fff', fontSize: 18, marginLeft: 3 },
  videoHint: { color: '#fff', fontSize: 14, fontWeight: '500' },

  // 相似車源
  similarCard: { width: 160, marginRight: 12 },
  similarImg: { width: 160, height: 110, borderRadius: 10 },
  similarTitle: { fontSize: 12, color: '#1c1c1e', fontWeight: '600', marginTop: 6, lineHeight: 16 },
  similarPrice: { fontSize: 13, color: APP_ORANGE, fontWeight: '700', marginTop: 4 },
  similarMeta: { fontSize: 11, color: '#8e8e93', marginTop: 2 },

  // 底部操作欄
  bottomBar: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.1)',
    paddingBottom: 24,
  },
  quickMsgRow: { paddingVertical: 8, maxHeight: 52 },
  quickMsgChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#fff',
  },
  quickMsgChipActive: { borderColor: '#F57C00', borderWidth: 1.5, backgroundColor: '#FFF3E0' },
  quickMsgText: { fontSize: 12, color: '#3c3c43' },
  quickMsgTextActive: { color: '#E65100', fontWeight: '500' },
  sellerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 10 },
  sellerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f2f2f7', justifyContent: 'center', alignItems: 'center' },
  sellerName: { fontSize: 13, fontWeight: '600', color: '#1c1c1e' },
  sellerLabel: { fontSize: 11, color: '#8e8e93' },
  actionRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  chatBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center' },
  chatBtnText: { fontSize: 14, color: APP_ORANGE, fontWeight: '600' },
  whatsappBtn: { flex: 1, height: 44, borderRadius: 10, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center' },
  whatsappBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  callBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center' },
  callBtnText: { fontSize: 18 },
});
