/**
 * 我的收藏頁
 * API: trpc.vehicleFavorite.listFavorites
 */
import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { trpc, resolveImageUrl } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

export default function FavoritesScreen() {
  const router = useRouter();
  const { data, isLoading } = trpc.vehicleFavorite.listFavorites.useQuery({ page: 1, pageSize: 50 });
  const items = data?.items || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>我的收藏</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.loading}><ActivityIndicator color={APP_ORANGE} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id || item.postId)}
          renderItem={({ item }) => {
            const post = item.post || item;
            const img = resolveImageUrl(post.coverImageUrl || post.coverUrl);
            return (
              <TouchableOpacity
                style={styles.item}
                onPress={() => router.push(`/vehicle/${post.id}`)}
                activeOpacity={0.7}
              >
                {img ? (
                  <Image source={{ uri: img }} style={styles.img} contentFit="cover" />
                ) : (
                  <View style={[styles.img, styles.imgPlaceholder]}>
                    <Text style={{ color: '#ccc' }}>無圖</Text>
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={2}>
                    {post.brandName || post.brand} {post.modelName || post.modelSeries}
                  </Text>
                  <Text style={styles.price}>
                    {post.price ? `HKD ${Number(post.price).toLocaleString()}` : '面議'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>暫無收藏的車源</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: APP_BORDER,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backText: { fontSize: 28, color: APP_TEXT, marginTop: -4 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: APP_TEXT },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  item: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: APP_BORDER,
  },
  img: { width: 90, height: 68, borderRadius: 8 },
  imgPlaceholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, justifyContent: 'center', gap: 6 },
  title: { fontSize: 14, fontWeight: '600', color: APP_TEXT, lineHeight: 19 },
  price: { fontSize: 15, fontWeight: '700', color: APP_ORANGE },
  empty: { textAlign: 'center', paddingVertical: 40, color: APP_GRAY, fontSize: 14 },
});
