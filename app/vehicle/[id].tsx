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
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { trpc, resolveImageUrl, API_BASE_URL } from '../../lib/trpc';
import { APP_ORANGE } from '../../constants/data';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const IMG_H = Math.round(SCREEN_H * 0.40);

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
  // engineCapacity 可能是數字(cc)或字串(如'1.5T 渦輪')，數字才加 cc
  const rawEngine = (post as any)?.engineCapacity;
  const engine = rawEngine
    ? (typeof rawEngine === 'number' ? `${rawEngine} cc` : String(rawEngine))
    : '';
  const gear = (post as any)?.transmission ? ((post as any).transmission === 'auto' ? '自動波' : '手波') : '';
  const fuelType = (post as any)?.fuelType ? (FUEL_TYPE_LABELS[(post as any).fuelType] || (post as any).fuelType) : '';
  const subtitle = (post as any)?.subtitle || '';
  const colorName = (post as any)?.colorName || (post as any)?.color || '';
  const seats = (post as any)?.seats || '';
  const doors = (post as any)?.doors || '';
  const horsepower = (post as any)?.horsepower || '';
  const sellerAddr = (post as any)?.address || '';
  const description = (post as any)?.description || '暫無描述';
  // features 優先讀 features 字段，fallback 到 tags（WebApp 配置亮點來源）
  const features: string[] = (post as any)?.features || (post as any)?.tags || [];
  const plateNumber = (post as any)?.plateNumber || '';
  const showFullPlate = (post as any)?.showFullPlate || false;
  const registrationDate = (post as any)?.firstRegDate || (post as any)?.registrationDate || '';
  const transferCount = (post as any)?.transferCount ?? null;
  const vin = (post as any)?.vin || '';
  const inspectionExpiry = (post as any)?.inspectionExpiry || '';
  const insuranceExpiry = (post as any)?.insuranceExpiry || '';
  // 更多參數
  const originCountry = (post as any)?.originCountry || '';
  const totalWeight = (post as any)?.totalWeight || null;
  const frontTire = (post as any)?.frontTire || '';
  const rearTire = (post as any)?.rearTire || '';
  // 證件照
  const documents: { id: number; docType: string; url: string }[] = (data as any)?.documents || [];
  // 粵港澳三地市場字段（v3.1）
  const registrationRegion: string = (post as any)?.registrationRegion || 'macau';
  const rawPlates = (post as any)?.includedPlates;
  const includedPlates: string[] = Array.isArray(rawPlates)
    ? rawPlates
    : (typeof rawPlates === 'string' && rawPlates ? (() => { try { return JSON.parse(rawPlates); } catch { return []; } })() : []);
  const REGION_LABELS: Record<string, string> = { macau: '🇲🇴 澳門', hongkong: '🇭🇰 香港', guangdong: '🇨🇳 廣東' };
  const PLATE_LABEL_MAP: Record<string, { label: string; color: string }> = {
    hk_macao: { label: '🔵 連港澳牌', color: '#2563eb' },
    gd_hk: { label: '🟢 連粵港牌', color: '#16a34a' },
    gd_macao: { label: '🟢 連粵澳牌', color: '#16a34a' },
    triple: { label: '🟡 連三地牌', color: '#d97706' },
  };
  const plateChips = includedPlates.map(p => PLATE_LABEL_MAP[p]).filter(Boolean) as { label: string; color: string }[];

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
      await Share.share({ message: `GoGoCar 車源：${title}\n${API_BASE_URL}/app/vehicle/${id}` });
    } catch {}
  };

  const handleWhatsApp = () => {
    const msgText = quickMsg
      ? `你好，我想查詢這輛車：${API_BASE_URL}/app/vehicle/${id}\n${quickMsg}`
      : `你好，我想查詢這輛車：${API_BASE_URL}/app/vehicle/${id}`;
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
          {/* subtitle 副標題灰底標籤（如「1.5T 渦輪」） */}
          {subtitle ? (
            <View style={{ marginTop: 6, marginBottom: 2 }}>
              <View style={styles.subtitleBadge}>
                <Text style={styles.subtitleBadgeText}>{subtitle}</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.chipRow}>
            {year ? <ChipTag label={year} /> : null}
            {mileage ? <ChipTag label={mileage} /> : null}
            {gear ? <ChipTag label={gear} /> : null}
            {engine ? <ChipTag label={engine} /> : null}
          </View>
          {/* 登記地 + 跨境牌照標籤 */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            <View style={{ backgroundColor: '#f3f4f6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 11, color: '#6b7280' }}>登記地：{REGION_LABELS[registrationRegion] || registrationRegion}</Text>
            </View>
            {plateChips.map((chip, i) => (
              <View key={i} style={{ backgroundColor: `${chip.color}18`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: `${chip.color}40` }}>
                <Text style={{ fontSize: 11, color: chip.color, fontWeight: '600' }}>{chip.label}</Text>
              </View>
            ))}
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

        {/* 更多參數 */}
        {(originCountry || totalWeight || frontTire || rearTire) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>更多參數</Text>
            {originCountry ? <Text style={styles.infoText}>來源地：{originCountry}</Text> : null}
            {totalWeight ? <Text style={styles.infoText}>整備重量：{totalWeight} kgs</Text> : null}
            {frontTire ? <Text style={styles.infoText}>前輪胎：{frontTire}</Text> : null}
            {rearTire ? <Text style={styles.infoText}>後輪胎：{rearTire}</Text> : null}
          </View>
        )}
        {/* 證件信息 */}
        {documents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>證件信息</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {documents.map((doc) => {
                const DOC_LABELS: Record<string, string> = {
                  title_deed: '車契',
                  registration_front: '登記止正面',
                  registration_back: '登記止反面',
                  macau_insurance: '澳門保險',
                  permit_front: '粵澳批文正面',
                  permit_back: '粵澳批文反面',
                  hk_permit_front: '香港禁區紙正面',
                  hk_permit_back: '香港禁區紙反面',
                  mainland_license: '大陸行使證',
                  hk_insurance: '香港保險',
                  livrete: 'Livrete',
                  inspection: '驗車紙',
                  insurance: '保險單',
                  other: '其他文件',
                };
                return (
                  <TouchableOpacity
                    key={doc.id}
                    onPress={() => Linking.openURL(doc.url)}
                    style={{ backgroundColor: '#f3f4f6', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 }}
                  >
                    <Text style={{ fontSize: 12, color: '#374151' }}>✓ {DOC_LABELS[doc.docType] || doc.docType}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
            <Text style={styles.sellerLabel}>{seller?.role === 'dealer' ? '認證經銷商' : sellerName !== 'GoGoCar 認證賣家' ? '個人賣家' : 'GoGoCar 認證賣家'}</Text>
          </View>
        </View>

        {/* Layer 3: 操作按鈕 */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.chatBtn} onPress={handleChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={APP_ORANGE} style={{ marginRight: 4 }} />
            <Text style={styles.chatBtnText}>站內聊天</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp}>
            {/* WhatsApp 官方圖標 */}
            <Svg width={18} height={18} viewBox="0 0 24 24" style={{ marginRight: 4 }}>
              <Path fill="#fff" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <Path fill="#fff" d="M12 0C5.373 0 0 5.373 0 12c0 2.123.558 4.116 1.535 5.845L.057 23.5l5.797-1.52A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.373l-.359-.213-3.44.902.917-3.349-.234-.374A9.818 9.818 0 1112 21.818z" />
            </Svg>
            <Text style={styles.whatsappBtnText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.wechatBtn} onPress={() => Linking.openURL('weixin://')}>
            {/* 微信官方圖標 */}
            <Svg width={18} height={18} viewBox="0 0 24 24" style={{ marginRight: 4 }}>
              <Path fill="#fff" d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.295.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-3.895-6.348-7.601-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.49.49 0 01.177-.554 6.257 6.257 0 002.499-4.617c.012-3.582-3.016-6.068-6.058-6.126zm-2.58 3.274c.535 0 .969.44.969.983a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.543.434-.983.969-.983zm5.16 0c.535 0 .969.44.969.983a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.543.434-.983.969-.983z" />
            </Svg>
            <Text style={styles.wechatBtnText}>微信</Text>
          </TouchableOpacity>
          {sellerPhone ? (
            <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${sellerPhone}`)}>
              <Ionicons name="call" size={16} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.callBtnText}>直接聯絡</Text>
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
  vehicleNo: { fontSize: 12, color: '#8e8e93', marginBottom: 4, letterSpacing: 0.5 },
  price: { fontSize: 30, fontWeight: '700', color: APP_ORANGE, letterSpacing: -0.5 },
  originalPrice: { fontSize: 13, color: '#8e8e93' },
  vehicleTitle: { fontSize: 17, fontWeight: '600', color: '#1c1c1e', lineHeight: 24 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { backgroundColor: '#f5f5f7', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 13, color: '#3c3c43', fontWeight: '500' },
  // 副標題灰底標籤
  subtitleBadge: { backgroundColor: '#f3f4f6', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  subtitleBadgeText: { fontSize: 13, color: '#374151', fontWeight: '500' },

  // 通用 section
  section: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1c1c1e', marginBottom: 10 },

  // 規格表
  specRow: { flexDirection: 'row', alignItems: 'center', height: 48 },
  specRowBorder: { borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  specLabel: { fontSize: 14, color: '#8e8e93', width: 96, flexShrink: 0 },
  specValue: { fontSize: 14, color: '#1c1c1e', fontWeight: '500', flex: 1, textAlign: 'right' },

  // 配置亮點
  featuresWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  featureTag: { backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: '#FFE0B2', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  featureTagText: { fontSize: 13, color: '#E65100', fontWeight: '500' },

  // 車輛信息
  infoText: { fontSize: 13, color: '#6b7280', marginBottom: 5 },

  // 描述
  description: { fontSize: 14, color: '#6b7280', lineHeight: 22 },

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
  similarTitle: { fontSize: 13, color: '#1c1c1e', fontWeight: '600', marginTop: 6, lineHeight: 18 },
  similarPrice: { fontSize: 14, color: APP_ORANGE, fontWeight: '700', marginTop: 4 },
  similarMeta: { fontSize: 12, color: '#8e8e93', marginTop: 2 },

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
  quickMsgText: { fontSize: 13, color: '#3c3c43' },
  quickMsgTextActive: { color: '#E65100', fontWeight: '500' },
  sellerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  sellerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f2f2f7', justifyContent: 'center', alignItems: 'center' },
  sellerName: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  sellerLabel: { fontSize: 12, color: '#8e8e93' },
  actionRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  chatBtn: { flex: 1, height: 48, borderRadius: 10, borderWidth: 1.5, borderColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  chatBtnText: { fontSize: 15, color: APP_ORANGE, fontWeight: '600' },
  whatsappBtn: { flex: 1, height: 48, borderRadius: 10, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  whatsappBtnText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  callBtn: { flex: 1, height: 48, borderRadius: 10, backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  callBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  wechatBtn: { flex: 1, height: 48, borderRadius: 10, backgroundColor: '#07C160', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' },
  wechatBtnText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
