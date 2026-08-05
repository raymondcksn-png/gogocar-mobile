/**
 * 我的車源頁 — 完整對齊 WebApp AppSell.tsx
 * 狀態 Tab：全部 / 在售 / 已售 / 已下架 / 草稿
 * 操作按鈕（內嵌卡片）：預覽 / 編輯 / 刷新 / 下架 / 重新上架 / 標記已售 / 刪除
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc, resolveImageUrl } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

// 狀態 Tab（對齊 WebApp AppSell.tsx）
const STATUS_TABS = [
  { key: 'all',      label: '全部' },
  { key: 'active',   label: '在售' },
  { key: 'sold',     label: '已售' },
  { key: 'archived', label: '已下架' },
  { key: 'draft',    label: '草稿' },
];

// 狀態標籤樣式
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: '草稿',   color: '#6b7280', bg: '#f5f5f7' },
  pending:  { label: '審核中', color: '#D97706', bg: '#FEF3C7' },
  active:   { label: '在售',   color: '#15803D', bg: '#DCFCE7' },
  archived: { label: '已下架', color: '#4B5563', bg: '#E5E7EB' },
  sold:     { label: '已售',   color: '#4B5563', bg: '#E5E7EB' },
  rejected: { label: '已拒絕', color: '#DC2626', bg: '#FEE2E2' },
  expired:  { label: '已過期', color: '#9CA3AF', bg: '#F9FAFB' },
};

function ActionBtn({ label, icon, bg, color, onPress }: {
  label: string; icon: string; bg: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[s.actionBtn, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon as any} size={12} color={color} />
      <Text style={[s.actionBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

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
    onSuccess: (res: any) => { Alert.alert('刷新成功', `車源已刷新至頂部，剩餘 ${res.balanceAfter} iP`); refetch(); },
    onError: (e: any) => Alert.alert('刷新失敗', e.message),
  });

  const posts = (data as any)?.items || [];

  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const confirm = (title: string, msg: string, confirmLabel: string, onConfirm: () => void) => {
    Alert.alert(title, msg, [
      { text: '取消', style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ]);
  };

  const renderItem = ({ item }: { item: any }) => {
    const img = resolveImageUrl(item.coverUrl || item.coverImageUrl);
    const meta = STATUS_META[item.status] || { label: item.status, color: APP_GRAY, bg: '#f3f4f6' };
    const isActive   = item.status === 'active';
    const isArchived = item.status === 'archived';
    const isSold     = item.status === 'sold';

    return (
      <View style={s.card}>
        {/* 上半：圖片 + 信息 */}
        <TouchableOpacity style={s.cardMain} onPress={() => router.push(`/vehicle/${item.id}`)} activeOpacity={0.75}>
          <View style={s.imgWrap}>
            {img ? (
              <Image source={{ uri: img }} style={s.img} contentFit="cover" />
            ) : (
              <View style={[s.img, s.imgPlaceholder]}>
                <Ionicons name="car-outline" size={28} color="#d1d5db" />
              </View>
            )}
            <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
              <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
          <View style={s.info}>
            <Text style={s.title} numberOfLines={2}>
              {item.title || `${item.year ? item.year + '年 ' : ''}${item.brandName || ''} ${item.modelName || ''}`.trim() || '未命名車源'}
            </Text>
            <Text style={s.price}>
              {item.price && Number(item.price) > 0 ? `HKD ${Number(item.price).toLocaleString()}` : '面議'}
            </Text>
            <View style={s.metaRow}>
              {item.mileage ? <Text style={s.metaText}>{Number(item.mileage).toLocaleString()} km</Text> : null}
              <View style={s.metaItem}>
                <Ionicons name="eye-outline" size={11} color={APP_GRAY} />
                <Text style={s.metaText}> {item.viewCount || 0}</Text>
              </View>
              <View style={s.metaItem}>
                <Ionicons name="heart-outline" size={11} color={APP_GRAY} />
                <Text style={s.metaText}> {item.favoriteCount || 0}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* 下半：操作按鈕（對齊 WebApp） */}
        <View style={s.actions}>
          <ActionBtn label="預覽" icon="eye-outline" bg="#f5f5f7" color="#6b7280"
            onPress={() => router.push(`/vehicle/${item.id}`)} />

          {!isSold && (
            <ActionBtn label="編輯" icon="pencil-outline" bg="#FFF7ED" color={APP_ORANGE}
              onPress={() => router.push(`/vehicle/edit/${item.id}`)} />
          )}

          {isActive && (
            <ActionBtn label="刷新" icon="refresh-outline" bg="#FFF7ED" color={APP_ORANGE}
              onPress={() => Alert.alert('刷新車源', '刷新後車源排序將提前，增加曝光機會。每次刷新消耗 1 iPoint。', [
                { text: '取消', style: 'cancel' },
                { text: '確認刷新', onPress: () => refreshPostMut.mutate({ postId: item.id }) },
              ])} />
          )}

          {isActive && (
            <ActionBtn label="下架" icon="chevron-down-outline" bg="#f5f5f7" color="#6b7280"
              onPress={() => confirm('確定下架？', '下架後車源將不再顯示在搜索結果中，可隨時重新上架。',
                '下架', () => updateStatusMut.mutate({ postId: item.id, status: 'archived' }))} />
          )}

          {isArchived && (
            <ActionBtn label="重新上架" icon="arrow-up-outline" bg="#FFF7ED" color={APP_ORANGE}
              onPress={() => updateStatusMut.mutate({ postId: item.id, status: 'active' })} />
          )}

          {isActive && (
            <ActionBtn label="標記已售" icon="checkmark-circle-outline" bg="#F0FDF4" color="#16a34a"
              onPress={() => confirm('確定標記為已售？', '已售車源將從在售列表中移除，此操作可在「已售」Tab 查看。',
                '確認已售', () => updateStatusMut.mutate({ postId: item.id, status: 'sold' }))} />
          )}

          <View style={{ flex: 1 }} />
          <ActionBtn label="刪除" icon="trash-outline" bg="#FEF2F2" color="#dc2626"
            onPress={() => confirm('確定刪除？', '此操作不可恢復，車源將被永久刪除。',
              '刪除', () => deletePostMut.mutate({ postId: item.id }))} />
        </View>
      </View>
    );
  };

  return (
    <View style={s.container}>
      {/* 頂部導航 */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>我的車源</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => router.push('/(tabs)/sell')} activeOpacity={0.7}>
          <Ionicons name="add" size={26} color={APP_ORANGE} />
        </TouchableOpacity>
      </View>

      {/* 狀態篩選 Tab */}
      <View style={s.tabBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBar}>
          {STATUS_TABS.map(tab => (
            <TouchableOpacity key={tab.key}
              style={[s.tab, activeTab === tab.key && s.tabActive]}
              onPress={() => setActiveTab(tab.key)} activeOpacity={0.7}>
              <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!isLoading && (
        <View style={s.countRow}>
          <Text style={s.countText}>共 {posts.length} 條車源</Text>
        </View>
      )}

      {isLoading ? (
        <View style={s.loading}><ActivityIndicator color={APP_ORANGE} size="large" /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item: any) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={posts.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_ORANGE} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="car-outline" size={48} color="#d1d5db" />
              <Text style={s.emptyTitle}>暫無車源</Text>
              <Text style={s.emptySubtitle}>點擊右上角「+」發佈第一條車源</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/(tabs)/sell')} activeOpacity={0.8}>
                <Text style={s.emptyBtnText}>立即發佈</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 8,
    borderBottomWidth: 0.5, borderBottomColor: APP_BORDER,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: APP_TEXT },
  addBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  tabBarWrap: { backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  tabBar: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6' },
  tabActive: { backgroundColor: `${APP_ORANGE}18` },
  tabText: { fontSize: 13, color: APP_GRAY, fontWeight: '500' },
  tabTextActive: { color: APP_ORANGE, fontWeight: '600' },
  countRow: { paddingHorizontal: 16, paddingVertical: 8 },
  countText: { fontSize: 12, color: APP_GRAY },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, paddingBottom: 10 },
  imgWrap: { position: 'relative', flexShrink: 0 },
  img: { width: 90, height: 68, borderRadius: 10 },
  imgPlaceholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  statusBadge: { position: 'absolute', bottom: 4, left: 4, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '600' },
  info: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 14, fontWeight: '600', color: APP_TEXT, lineHeight: 20 },
  price: { fontSize: 16, fontWeight: '700', color: APP_ORANGE },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 11, color: APP_GRAY },
  actions: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    gap: 6, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 6,
    borderTopWidth: 0.5, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionBtnText: { fontSize: 12, fontWeight: '500' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: APP_TEXT, marginTop: 8 },
  emptySubtitle: { fontSize: 13, color: APP_GRAY },
  emptyBtn: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, backgroundColor: APP_ORANGE },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
