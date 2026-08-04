/**
 * 我的車源管理頁
 * 功能：列表（訪客態 / 空態 / 列表態）+ 上架/下架/刪除/編輯
 * API: trpc.vehicle.myPosts + trpc.vehicle.updateStatus + trpc.vehicle.deletePost
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Image, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { trpc, resolveImageUrl } from '../lib/trpc';
import { useAuth } from '../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../constants/data';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: '已上架', color: '#16a34a', bg: '#f0fdf4' },
  archived: { label: '已下架', color: '#6b7280', bg: '#f9fafb' },
  sold:     { label: '已售出', color: '#2563eb', bg: '#eff6ff' },
  pending:  { label: '審核中', color: '#d97706', bg: '#fffbeb' },
  deleted:  { label: '已刪除', color: '#dc2626', bg: '#fef2f2' },
};

const FILTER_TABS = [
  { label: '全部', value: undefined },
  { label: '已上架', value: 'active' },
  { label: '已下架', value: 'archived' },
  { label: '已售出', value: 'sold' },
];

function formatPrice(price: number | null | undefined) {
  if (!price) return '未定價';
  if (price >= 10000) return `${(price / 10000).toFixed(1)}萬`;
  return `MOP ${price.toLocaleString()}`;
}

function formatMileage(mileage: number | null | undefined) {
  if (!mileage) return '—';
  if (mileage >= 10000) return `${(mileage / 10000).toFixed(1)}萬km`;
  return `${mileage.toLocaleString()}km`;
}

function timeAgo(dateStr: string | Date | null | undefined) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 30) return `${days}天前`;
  if (days < 365) return `${Math.floor(days / 30)}個月前`;
  return `${Math.floor(days / 365)}年前`;
}

export default function MyPostsScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = trpc.vehicle.myPosts.useQuery(
    filterStatus ? { status: filterStatus } : undefined,
    { enabled: !!user }
  );
  const utils = trpc.useUtils();

  const updateStatusMutation = trpc.vehicle.updateStatus.useMutation({
    onSuccess: () => {
      utils.vehicle.myPosts.invalidate();
    },
    onError: (err) => {
      Alert.alert('操作失敗', err.message || '請稍後再試');
    },
  });

  const deletePostMutation = trpc.vehicle.deletePost.useMutation({
    onSuccess: () => {
      utils.vehicle.myPosts.invalidate();
    },
    onError: (err) => {
      Alert.alert('刪除失敗', err.message || '請稍後再試');
    },
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleToggleStatus = useCallback((postId: number, currentStatus: string) => {
    const isActive = currentStatus === 'active';
    const newStatus = isActive ? 'archived' : 'active';
    const actionLabel = isActive ? '下架' : '上架';
    Alert.alert(
      `確認${actionLabel}`,
      isActive ? '下架後車源將不再顯示在買車列表中' : '上架後車源將重新顯示在買車列表中',
      [
        { text: '取消', style: 'cancel' },
        {
          text: actionLabel,
          style: isActive ? 'destructive' : 'default',
          onPress: () => updateStatusMutation.mutate({ postId, status: newStatus as any }),
        },
      ]
    );
  }, [updateStatusMutation]);

  const handleMarkSold = useCallback((postId: number) => {
    Alert.alert('標記為已售出', '確認此車輛已成功出售？', [
      { text: '取消', style: 'cancel' },
      {
        text: '確認售出',
        onPress: () => updateStatusMutation.mutate({ postId, status: 'sold' }),
      },
    ]);
  }, [updateStatusMutation]);

  const handleDelete = useCallback((postId: number) => {
    Alert.alert(
      '刪除車源',
      '刪除後無法恢復，確認刪除？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確認刪除',
          style: 'destructive',
          onPress: () => deletePostMutation.mutate({ postId }),
        },
      ]
    );
  }, [deletePostMutation]);

  const handleEdit = useCallback((postId: number) => {
    router.push(`/vehicle/edit/${postId}` as any);
  }, [router]);

  const items = data?.items || [];

  // ── 訪客態 ──
  if (!authLoading && !user) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>我的車源</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.guestWrap}>
          <Text style={s.guestIcon}>🚗</Text>
          <Text style={s.guestTitle}>登入後管理您的車源</Text>
          <Text style={s.guestSub}>發佈、上架、下架、編輯一手掌控</Text>
          <TouchableOpacity style={s.loginBtn} onPress={() => router.push('/(auth)/login' as any)}>
            <Text style={s.loginBtnText}>立即登入</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* 標題欄 */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>我的車源</Text>
        <TouchableOpacity
          style={s.publishBtn}
          onPress={() => router.push('/(tabs)/sell' as any)}
          activeOpacity={0.8}
        >
          <Text style={s.publishBtnText}>+ 發佈</Text>
        </TouchableOpacity>
      </View>

      {/* 狀態篩選 Tab */}
      <View style={s.tabRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabScroll}>
          {FILTER_TABS.map(tab => (
            <TouchableOpacity
              key={String(tab.value)}
              style={[s.tab, filterStatus === tab.value && s.tabActive]}
              onPress={() => setFilterStatus(tab.value)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabText, filterStatus === tab.value && s.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 列表 */}
      <ScrollView
        style={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={APP_ORANGE} />}
        showsVerticalScrollIndicator={false}
      >
        {/* 加載中 */}
        {isLoading && (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={APP_ORANGE} size="large" />
          </View>
        )}

        {/* 空態 */}
        {!isLoading && items.length === 0 && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>🚗</Text>
            <Text style={s.emptyTitle}>
              {filterStatus ? '該狀態下暫無車源' : '您還沒有發佈任何車源'}
            </Text>
            {!filterStatus && (
              <>
                <Text style={s.emptySub}>免費發佈，快速出售您的愛車</Text>
                <TouchableOpacity
                  style={s.publishBtnLarge}
                  onPress={() => router.push('/(tabs)/sell' as any)}
                  activeOpacity={0.8}
                >
                  <Text style={s.publishBtnLargeText}>立即發佈車源</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* 車源卡片列表 */}
        {items.map(item => {
          const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.archived;
          const isActive = item.status === 'active';
          const canEdit = item.status !== 'deleted' && item.status !== 'sold';
          const canToggle = item.status === 'active' || item.status === 'archived';
          const canDelete = item.status !== 'deleted';

          return (
            <View key={item.id} style={s.card}>
              {/* 封面圖 + 基本信息 */}
              <TouchableOpacity
                style={s.cardTop}
                onPress={() => router.push(`/vehicle/${item.id}` as any)}
                activeOpacity={0.85}
              >
                <View style={s.coverWrap}>
                  {item.coverUrl ? (
                    <Image
                      source={{ uri: resolveImageUrl(item.coverUrl) || '' }}
                      style={s.cover}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[s.cover, s.coverEmpty]}>
                      <Text style={{ fontSize: 28 }}>🚗</Text>
                    </View>
                  )}
                  {/* 狀態標籤 */}
                  <View style={[s.statusBadge, { backgroundColor: statusInfo.bg }]}>
                    <Text style={[s.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                  </View>
                </View>
                <View style={s.cardInfo}>
                  <Text style={s.cardTitle} numberOfLines={2}>
                    {item.title || `${item.year || ''} ${item.brandName || ''} ${item.modelName || ''}`.trim() || '未命名車源'}
                  </Text>
                  <Text style={s.cardPrice}>{formatPrice(item.price)}</Text>
                  <View style={s.cardMeta}>
                    <Text style={s.cardMetaText}>{item.year || '—'} · {formatMileage(item.mileage)}</Text>
                  </View>
                  <View style={s.cardStats}>
                    <Text style={s.cardStatItem}>👁 {item.viewCount || 0}</Text>
                    <Text style={s.cardStatItem}>❤️ {item.favoriteCount || 0}</Text>
                    <Text style={s.cardStatTime}>{timeAgo(item.updatedAt)}</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* 操作按鈕欄 */}
              <View style={s.cardActions}>
                {canEdit && (
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => handleEdit(item.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.actionBtnText}>✏️ 編輯</Text>
                  </TouchableOpacity>
                )}
                {canToggle && (
                  <TouchableOpacity
                    style={[s.actionBtn, isActive ? s.actionBtnDanger : s.actionBtnPrimary]}
                    onPress={() => handleToggleStatus(item.id, item.status)}
                    activeOpacity={0.7}
                    disabled={updateStatusMutation.isPending}
                  >
                    <Text style={[s.actionBtnText, isActive ? s.actionBtnDangerText : s.actionBtnPrimaryText]}>
                      {isActive ? '⬇ 下架' : '⬆ 上架'}
                    </Text>
                  </TouchableOpacity>
                )}
                {isActive && (
                  <TouchableOpacity
                    style={[s.actionBtn, s.actionBtnSold]}
                    onPress={() => handleMarkSold(item.id)}
                    activeOpacity={0.7}
                    disabled={updateStatusMutation.isPending}
                  >
                    <Text style={[s.actionBtnText, s.actionBtnSoldText]}>✅ 售出</Text>
                  </TouchableOpacity>
                )}
                {canDelete && (
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => handleDelete(item.id)}
                    activeOpacity={0.7}
                    disabled={deletePostMutation.isPending}
                  >
                    <Text style={[s.actionBtnText, { color: '#dc2626' }]}>🗑 刪除</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },

  // 標題欄
  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: APP_BORDER,
  },
  backBtn: { width: 40, justifyContent: 'center' },
  backIcon: { fontSize: 28, color: APP_TEXT, lineHeight: 32 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: APP_TEXT, textAlign: 'center' },
  publishBtn: {
    backgroundColor: APP_ORANGE,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  publishBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // 篩選 Tab
  tabRow: {
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: APP_BORDER,
  },
  tabScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: APP_BORDER,
    backgroundColor: '#fff',
  },
  tabActive: { borderColor: APP_ORANGE, backgroundColor: '#fff7ed' },
  tabText: { fontSize: 13, color: APP_GRAY },
  tabTextActive: { color: APP_ORANGE, fontWeight: '600' },

  // 列表
  list: { flex: 1 },
  loadingWrap: { paddingTop: 80, alignItems: 'center' },

  // 空態
  emptyWrap: { paddingTop: 80, alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: APP_TEXT, textAlign: 'center', marginBottom: 8 },
  emptySub: { fontSize: 14, color: APP_GRAY, textAlign: 'center', marginBottom: 24 },
  publishBtnLarge: {
    backgroundColor: APP_ORANGE,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
  },
  publishBtnLargeText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // 訪客態
  guestWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  guestIcon: { fontSize: 64, marginBottom: 20 },
  guestTitle: { fontSize: 18, fontWeight: '700', color: APP_TEXT, marginBottom: 8, textAlign: 'center' },
  guestSub: { fontSize: 14, color: APP_GRAY, textAlign: 'center', marginBottom: 28 },
  loginBtn: {
    backgroundColor: APP_ORANGE,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 28,
  },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // 卡片
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: APP_BORDER,
    overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', padding: 12 },
  coverWrap: { position: 'relative', marginRight: 12 },
  cover: { width: 100, height: 80, borderRadius: 8, backgroundColor: '#f5f5f5' },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  statusBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: APP_TEXT, marginBottom: 4, lineHeight: 20 },
  cardPrice: { fontSize: 16, fontWeight: '700', color: APP_ORANGE, marginBottom: 4 },
  cardMeta: { marginBottom: 4 },
  cardMetaText: { fontSize: 12, color: APP_GRAY },
  cardStats: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardStatItem: { fontSize: 12, color: APP_GRAY },
  cardStatTime: { fontSize: 12, color: APP_GRAY, marginLeft: 'auto' },

  // 操作按鈕
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: APP_BORDER,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: APP_BORDER,
    backgroundColor: '#fff',
  },
  actionBtnText: { fontSize: 13, color: APP_TEXT },
  actionBtnPrimary: { borderColor: APP_ORANGE, backgroundColor: '#fff7ed' },
  actionBtnPrimaryText: { color: APP_ORANGE, fontWeight: '600' },
  actionBtnDanger: { borderColor: '#6b7280', backgroundColor: '#f9fafb' },
  actionBtnDangerText: { color: '#6b7280' },
  actionBtnSold: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  actionBtnSoldText: { color: '#2563eb', fontWeight: '600' },
});
