import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, StatusBar, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../lib/trpc';

const APP_ORANGE = '#F97316';

function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `https://gogocar853.manus.space${url}`;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return '剛剛';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return date.toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' });
}

function cleanModel(model: string | null | undefined): string {
  if (!model) return '';
  const sep = model.indexOf('｜') >= 0 ? '｜' : (model.indexOf('|') >= 0 ? '|' : null);
  return sep ? model.split(sep)[0].trim() : model;
}

export default function ViewHistoryScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = trpc.vehicle.myViewHistory.useQuery(
    { limit: 50 },
    { staleTime: 0 }
  );
  const items = data?.items || [];

  const renderItem = ({ item }: { item: any }) => {
    const brand = item.brandName || '';
    const model = cleanModel(item.modelName);
    const title = brand && model ? `${brand} ${model}` : (item.title || '未命名車源');
    const price = item.price && Number(item.price) > 0
      ? `HKD ${Number(item.price).toLocaleString()}`
      : '面議';
    const coverUrl = resolveImageUrl(item.coverUrl);
    const isExpired = item.publishExpireAt && new Date(item.publishExpireAt) < new Date();
    const isOffline = item.status !== 'active' || isExpired;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/vehicle/${item.postId}`)}
        activeOpacity={0.75}
      >
        <View style={styles.imgWrap}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.img} contentFit="cover" />
          ) : (
            <View style={[styles.img, styles.imgPlaceholder]}>
              <Ionicons name="car-outline" size={24} color="#c7c7cc" />
            </View>
          )}
          {isOffline && (
            <View style={styles.offlineBadge}>
              <Text style={styles.offlineBadgeText}>已下架</Text>
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {item.year || item.mileage ? (
            <Text style={styles.detail} numberOfLines={1}>
              {[item.year ? `${item.year}年` : null, item.mileage ? `${Number(item.mileage).toLocaleString()}km` : null].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          <Text style={styles.price}>{price}</Text>
          <Text style={styles.time}>{timeAgo(item.viewedAt)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#c7c7cc" style={{ alignSelf: 'center' }} />
      </TouchableOpacity>
    );
  };

  const SAFE_TOP = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 24) + 8;

  return (
    <View style={styles.container}>
      {/* 頂部導航 */}
      <View style={[styles.header, { paddingTop: SAFE_TOP }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1c1c1e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>瀏覽記錄</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>載入中...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="eye-off-outline" size={48} color="#c7c7cc" />
          <Text style={styles.emptyTitle}>暫無瀏覽記錄</Text>
          <Text style={styles.emptyText}>瀏覽車源後，記錄將顯示在這裡</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/(tabs)/buy')}>
            <Text style={styles.browseBtnText}>去看看車源</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={APP_ORANGE}
              colors={[APP_ORANGE]}
            />
          }
          ListHeaderComponent={
            <Text style={styles.countText}>共 {items.length} 條瀏覽記錄</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: '#e5e5ea',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1c1c1e' },
  countText: { fontSize: 13, color: '#8e8e93', paddingHorizontal: 16, paddingVertical: 10 },
  card: {
    flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 8,
    borderRadius: 12, padding: 12, gap: 12, alignItems: 'flex-start',
  },
  imgWrap: { position: 'relative' },
  img: { width: 90, height: 68, borderRadius: 8 },
  imgPlaceholder: { backgroundColor: '#f2f2f7', justifyContent: 'center', alignItems: 'center' },
  offlineBadge: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  offlineBadgeText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  info: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '600', color: '#1c1c1e' },
  detail: { fontSize: 12, color: '#8e8e93' },
  price: { fontSize: 15, fontWeight: '700', color: APP_ORANGE },
  time: { fontSize: 11, color: '#c7c7cc' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingBottom: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1c1c1e' },
  emptyText: { fontSize: 14, color: '#8e8e93' },
  browseBtn: { marginTop: 8, backgroundColor: APP_ORANGE, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  browseBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
