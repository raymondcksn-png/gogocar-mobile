/**
 * 我的車源頁 — 用戶發佈的車源列表
 * API: trpc.vehicle.getMyPosts
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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '審核中', color: '#f59e0b' },
  active: { label: '已上架', color: '#16a34a' },
  rejected: { label: '已拒絕', color: '#ef4444' },
  sold: { label: '已售出', color: '#6b7280' },
  inactive: { label: '已下架', color: '#6b7280' },
};

export default function MyPostsScreen() {
  const router = useRouter();
  const { data, isLoading } = trpc.vehicle.getMyPosts.useQuery({ page: 1, pageSize: 50 });
  const posts = data?.items || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>我的車源</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.loading}><ActivityIndicator color={APP_ORANGE} size="large" /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const img = resolveImageUrl(item.coverImageUrl || item.coverUrl);
            const status = STATUS_LABELS[item.status] || { label: item.status, color: APP_GRAY };
            return (
              <TouchableOpacity
                style={styles.item}
                onPress={() => router.push(`/vehicle/${item.id}`)}
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
                    {item.brandName || item.brand} {item.modelName || item.modelSeries}
                  </Text>
                  <Text style={styles.price}>
                    {item.price ? `HKD ${Number(item.price).toLocaleString()}` : '面議'}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>暫無發佈的車源</Text>}
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
  info: { flex: 1, justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: '600', color: APP_TEXT, lineHeight: 19 },
  price: { fontSize: 15, fontWeight: '700', color: APP_ORANGE },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  empty: { textAlign: 'center', paddingVertical: 40, color: APP_GRAY, fontSize: 14 },
});
