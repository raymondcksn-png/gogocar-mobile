/**
 * 我的車源頁 — 對齊 WebApp AppMyCars 功能
 * - 狀態篩選 Tab（全部/上架/審核中/已售/已下架）
 * - 操作按鈕：刷新/下架/刪除
 * - 真實 API: trpc.vehicle.myPosts
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc, resolveImageUrl } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

const STATUS_TABS = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '上架中' },
  { key: 'pending', label: '審核中' },
  { key: 'sold', label: '已售出' },
  { key: 'inactive', label: '已下架' },
  { key: 'rejected', label: '已拒絕' },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: '審核中', color: '#D97706', bg: '#FEF3C7' },
  active:   { label: '上架中', color: '#16A34A', bg: '#DCFCE7' },
  rejected: { label: '已拒絕', color: '#DC2626', bg: '#FEE2E2' },
  sold:     { label: '已售出', color: '#6B7280', bg: '#F3F4F6' },
  inactive: { label: '已下架', color: '#6B7280', bg: '#F3F4F6' },
  expired:  { label: '已過期', color: '#9CA3AF', bg: '#F9FAFB' },
};

export default function MyPostsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = trpc.vehicle.myPosts.useQuery(
    activeTab === 'all' ? undefined : { status: activeTab }
  );
  const updateStatusMut = trpc.vehicle.updateStatus.useMutation({
    onSuccess: () => refetch(),
    onError: (e: any) => Alert.alert('操作失敗', e.message),
  });
  const deletePostMut = trpc.vehicle.deletePost.useMutation({
    onSuccess: () => refetch(),
    onError: (e: any) => Alert.alert('刪除失敗', e.message),
  });
  const refreshPostMut = trpc.vehicle.refreshPost.useMutation({
    onSuccess: () => { Alert.alert('刷新成功', '車源已刷新至頂部'); refetch(); },
    onError: (e: any) => Alert.alert('刷新失敗', e.message),
  });

  const posts = (data as any)?.items || [];
  const totalCount = posts.length;

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleAction = (item: any) => {
    const actions: any[] = [];
    if (item.status === 'active') {
      actions.push({ text: '下架車源', onPress: () => updateStatusMut.mutate({ id: item.id, status: 'inactive' }) });
      actions.push({ text: '刷新排序', onPress: () => refreshPostMut.mutate({ id: item.id }) });
    }
    if (item.status === 'inactive' || item.status === 'rejected') {
      actions.push({ text: '重新上架', onPress: () => updateStatusMut.mutate({ id: item.id, status: 'active' }) });
    }
    if (item.status === 'active' || item.status === 'inactive') {
      actions.push({ text: '編輯車源', onPress: () => router.push(`/vehicle/edit/${item.id}`) });
    }
    actions.push({
      text: '刪除車源', style: 'destructive' as const,
      onPress: () => Alert.alert('確認刪除', '刪除後無法恢復，確定要刪除嗎？', [
        { text: '取消', style: 'cancel' },
        { text: '刪除', style: 'destructive', onPress: () => deletePostMut.mutate({ id: item.id }) },
      ]),
    });
    actions.push({ text: '取消', style: 'cancel' as const });
    Alert.alert('操作', `${item.brandName || ''} ${item.modelName || ''}`, actions);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>我的車源</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(tabs)/sell')} activeOpacity={0.7}>
          <Ionicons name="add" size={22} color={APP_ORANGE} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <FlatList
          horizontal data={STATUS_TABS} keyExtractor={(t) => t.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          renderItem={({ item: tab }) => (
            <TouchableOpacity
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)} activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {!isLoading && (
        <View style={styles.countRow}>
          <Text style={styles.countText}>共 {totalCount} 條車源</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loading}><ActivityIndicator color={APP_ORANGE} size="large" /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item: any) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_ORANGE} />}
          renderItem={({ item }: { item: any }) => {
            const img = resolveImageUrl(item.coverUrl || item.coverImageUrl);
            const meta = STATUS_META[item.status] || { label: item.status, color: APP_GRAY, bg: '#f3f4f6' };
            return (
              <TouchableOpacity style={styles.item} onPress={() => router.push(`/vehicle/${item.id}`)} activeOpacity={0.75}>
                <View style={styles.imgWrap}>
                  {img ? (
                    <Image source={{ uri: img }} style={styles.img} contentFit="cover" />
                  ) : (
                    <View style={[styles.img, styles.imgPlaceholder]}>
                      <Ionicons name="car-outline" size={28} color="#d1d5db" />
                    </View>
                  )}
                  <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.year ? `${item.year}年 ` : ''}{item.brandName} {item.modelName}
                  </Text>
                  <Text style={styles.price}>
                    {item.price ? `HKD ${Number(item.price).toLocaleString()}` : '面議'}
                  </Text>
                  <View style={styles.metaRow}>
                    {item.mileage && <Text style={styles.metaText}>{Number(item.mileage).toLocaleString()} km</Text>}
                    <Text style={styles.metaText}>👁 {item.viewCount || 0}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.moreBtn} onPress={() => handleAction(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="ellipsis-vertical" size={18} color={APP_GRAY} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="car-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>暫無車源</Text>
              <Text style={styles.emptySubtitle}>點擊右上角「+」發佈第一條車源</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/sell')} activeOpacity={0.8}>
                <Text style={styles.emptyBtnText}>立即發佈</Text>
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
  addBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  tabBar: { backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6' },
  tabActive: { backgroundColor: `${APP_ORANGE}18` },
  tabText: { fontSize: 13, color: APP_GRAY, fontWeight: '500' },
  tabTextActive: { color: APP_ORANGE, fontWeight: '600' },
  countRow: { paddingHorizontal: 16, paddingVertical: 8 },
  countText: { fontSize: 12, color: APP_GRAY },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: APP_BORDER,
  },
  imgWrap: { position: 'relative', flexShrink: 0 },
  img: { width: 90, height: 68, borderRadius: 10 },
  imgPlaceholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  statusBadge: { position: 'absolute', bottom: 4, left: 4, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '600' },
  info: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 14, fontWeight: '600', color: APP_TEXT },
  price: { fontSize: 16, fontWeight: '700', color: APP_ORANGE },
  metaRow: { flexDirection: 'row', gap: 12 },
  metaText: { fontSize: 11, color: APP_GRAY },
  moreBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: APP_TEXT, marginTop: 8 },
  emptySubtitle: { fontSize: 13, color: APP_GRAY },
  emptyBtn: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, backgroundColor: APP_ORANGE },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
