/**
 * 我的收藏頁 — 對齊 WebApp
 * API: trpc.vehicleFavorite.getFavorites + toggleFavorite
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc, resolveImageUrl } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

export default function FavoritesScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, refetch } = trpc.vehicleFavorite.getFavorites.useQuery();
  const toggleFav = trpc.vehicleFavorite.toggleFavorite.useMutation({
    onSuccess: () => refetch(),
    onError: (e: any) => Alert.alert('操作失敗', e.message),
  });

  const items = (data as any) || [];

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>我的收藏</Text>
        <View style={{ width: 40 }} />
      </View>

      {!isLoading && (
        <View style={styles.countRow}>
          <Text style={styles.countText}>共 {items.length} 條收藏</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loading}><ActivityIndicator color={APP_ORANGE} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item: any) => String(item.id || item.postId)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_ORANGE} />}
          renderItem={({ item }: { item: any }) => {
            const post = item.post || item;
            const img = resolveImageUrl(post.coverUrl || post.coverImageUrl || post.thumbnailUrl);
            return (
              <TouchableOpacity
                style={styles.item}
                onPress={() => router.push(`/vehicle/${post.id || item.postId}`)}
                activeOpacity={0.75}
              >
                {img ? (
                  <Image source={{ uri: img }} style={styles.img} contentFit="cover" />
                ) : (
                  <View style={[styles.img, styles.imgPlaceholder]}>
                    <Ionicons name="car-outline" size={28} color="#d1d5db" />
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={1}>
                    {post.year ? `${post.year}年 ` : ''}{post.brandName} {post.modelName || post.modelSeries}
                  </Text>
                  <Text style={styles.price}>
                    {post.price ? `HKD ${Number(post.price).toLocaleString()}` : '面議'}
                  </Text>
                  <View style={styles.metaRow}>
                    {post.mileage && <Text style={styles.metaText}>{Number(post.mileage).toLocaleString()} km</Text>}
                    {post.year && <Text style={styles.metaText}>{post.year} 年</Text>}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.favBtn}
                  onPress={() => toggleFav.mutate({ postId: post.id || item.postId })}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="heart" size={22} color="#EF4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>暫無收藏</Text>
              <Text style={styles.emptySubtitle}>瀏覽車源時點擊心形圖標收藏</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/buy')} activeOpacity={0.8}>
                <Text style={styles.emptyBtnText}>去瀏覽車源</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 8,
    borderBottomWidth: 0.5, borderBottomColor: APP_BORDER,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: APP_TEXT },
  countRow: { paddingHorizontal: 16, paddingVertical: 8 },
  countText: { fontSize: 12, color: APP_GRAY },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: APP_BORDER,
  },
  img: { width: 90, height: 68, borderRadius: 10, flexShrink: 0 },
  imgPlaceholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 14, fontWeight: '600', color: APP_TEXT },
  price: { fontSize: 16, fontWeight: '700', color: APP_ORANGE },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaText: { fontSize: 11, color: APP_GRAY },
  favBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: APP_TEXT, marginTop: 8 },
  emptySubtitle: { fontSize: 13, color: APP_GRAY },
  emptyBtn: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, backgroundColor: APP_ORANGE },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
