/**
 * 我的車源頁 — 完整對齊 WebApp AppSell.tsx
 * 狀態 Tab：全部 / 在售 / 已售 / 已下架 / 草稿
 * 操作按鈕（內嵌卡片）：預覽 / 編輯 / 刷新 / 下架 / 重新上架 / 標記已售 / 增值服務 / 刪除
 * 增值服務 Modal：置頂車源 / 精選推廣 / 急售標籤 / 相片增強（iPoint 支付）
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, ScrollView, Modal,
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

// 增值服務定義（publishPlan 對應後端 ipoint.publishVehicle）
const UPGRADE_SERVICES = [
  {
    plan: 'pinned' as const,
    icon: '📌',
    title: '置頂車源',
    desc: '車源固定在搜索結果頂部，大幅提升曝光',
    badge: '置頂',
    badgeColor: '#EAB308',
    costKey: 'publish_pinned_price',
    defaultCost: 200,
    durationKey: 'pinned_duration_days',
    defaultDays: 3,
  },
  {
    plan: 'featured' as const,
    icon: '⭐',
    title: '精選推廣',
    desc: '精選標記提升搜索排名，增加買家信任',
    badge: '精選',
    badgeColor: '#F97316',
    costKey: 'publish_featured_price',
    defaultCost: 150,
    durationKey: 'featured_duration_days',
    defaultDays: 7,
  },
];

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

// 增值服務 Modal
function UpgradeModal({
  visible, postId, postTitle, settings, onClose, onSuccess,
}: {
  visible: boolean;
  postId: number;
  postTitle: string;
  settings: Record<string, string>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { data: balanceData } = trpc.ipoint.getBalance.useQuery();
  const balance = (balanceData as any)?.balance ?? 0;

  const publishVehicleMut = trpc.ipoint.publishVehicle.useMutation({
    onSuccess: (res: any) => {
      if (res.success) {
        Alert.alert('升級成功！', '增值服務已生效，車源曝光度將大幅提升。');
        onSuccess();
        onClose();
      } else if (res.requiresPayment) {
        Alert.alert('提示', '微信支付暫不支持此操作，請使用 iPoint 支付。');
      }
    },
    onError: (e: any) => {
      Alert.alert('升級失敗', e.message || '請稍後重試');
    },
  });

  const handleUpgrade = (plan: 'pinned' | 'featured', title: string, cost: number) => {
    if (balance < cost) {
      Alert.alert(
        'iPoint 不足',
        `此服務需要 ${cost} iP，您目前餘額為 ${balance} iP。\n\n請先前往「我的 → iPoint」充值。`,
        [{ text: '確定' }]
      );
      return;
    }
    Alert.alert(
      `確認購買「${title}」`,
      `將消耗 ${cost} iP（當前餘額：${balance} iP）\n\n確認後立即生效。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確認購買',
          onPress: () => publishVehicleMut.mutate({ postId, publishPlan: plan, paymentMethod: 'ipoint' }),
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.modalSheet} activeOpacity={1}>
          {/* 拖動條 */}
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>增值服務</Text>
          <Text style={s.modalSubtitle} numberOfLines={1}>{postTitle}</Text>

          {/* iPoint 餘額提示 */}
          <View style={s.balanceRow}>
            <Text style={s.balanceLabel}>當前 iPoint 餘額</Text>
            <Text style={s.balanceValue}>{balance} iP</Text>
          </View>

          {/* 服務列表 */}
          {UPGRADE_SERVICES.map((svc) => {
            const cost = parseInt(settings[svc.costKey] || String(svc.defaultCost));
            const days = parseInt(settings[svc.durationKey] || String(svc.defaultDays));
            const canAfford = balance >= cost;
            return (
              <TouchableOpacity
                key={svc.plan}
                style={[s.svcCard, !canAfford && s.svcCardDisabled]}
                onPress={() => handleUpgrade(svc.plan, svc.title, cost)}
                activeOpacity={0.75}
                disabled={publishVehicleMut.isPending}
              >
                <Text style={s.svcIcon}>{svc.icon}</Text>
                <View style={s.svcInfo}>
                  <View style={s.svcTitleRow}>
                    <Text style={s.svcTitle}>{svc.title}</Text>
                    <View style={[s.svcBadge, { backgroundColor: svc.badgeColor + '20' }]}>
                      <Text style={[s.svcBadgeText, { color: svc.badgeColor }]}>{svc.badge}</Text>
                    </View>
                  </View>
                  <Text style={s.svcDesc}>{svc.desc}</Text>
                  <Text style={s.svcDuration}>有效期 {days} 天</Text>
                </View>
                <View style={s.svcCostWrap}>
                  <Text style={[s.svcCost, !canAfford && s.svcCostInsufficient]}>{cost} iP</Text>
                  {!canAfford && <Text style={s.svcInsufficient}>餘額不足</Text>}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* 急售和相片增強（暫不支持獨立 API，引導到編輯頁） */}
          <View style={s.svcCardGray}>
            <Text style={s.svcIcon}>🔔</Text>
            <View style={s.svcInfo}>
              <Text style={s.svcTitle}>急售標籤</Text>
              <Text style={s.svcDesc}>在編輯車源時添加「急售」標籤，免費使用</Text>
            </View>
            <Text style={s.svcFree}>免費</Text>
          </View>

          <View style={s.svcCardGray}>
            <Text style={s.svcIcon}>📸</Text>
            <View style={s.svcInfo}>
              <Text style={s.svcTitle}>相片增強</Text>
              <Text style={s.svcDesc}>在編輯車源時使用 AI 智能優化相片</Text>
            </View>
            <Text style={s.svcFree}>免費</Text>
          </View>

          {publishVehicleMut.isPending && (
            <View style={s.processingRow}>
              <ActivityIndicator color={APP_ORANGE} size="small" />
              <Text style={s.processingText}>處理中...</Text>
            </View>
          )}

          <TouchableOpacity style={s.modalCloseBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.modalCloseBtnText}>關閉</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function MyPostsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<{ postId: number; title: string } | null>(null);

  const { data, isLoading, refetch } = trpc.vehicle.myPosts.useQuery(
    activeTab === 'all' ? undefined : { status: activeTab }
  );
  const { data: settingsData } = trpc.admin.getSettings.useQuery();
  const settings = (settingsData || {}) as Record<string, string>;

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
    const postTitle  = item.title || `${item.brandName || ''} ${item.modelName || ''}`.trim() || '此車源';

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

          {/* 增值服務入口（僅在售狀態顯示） */}
          {isActive && (
            <ActionBtn label="增值服務" icon="star-outline" bg="#FFFBEB" color="#D97706"
              onPress={() => setUpgradeModal({ postId: item.id, title: postTitle })} />
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

      {/* 增值服務 Modal */}
      {upgradeModal && (
        <UpgradeModal
          visible={!!upgradeModal}
          postId={upgradeModal.postId}
          postTitle={upgradeModal.title}
          settings={settings}
          onClose={() => setUpgradeModal(null)}
          onSuccess={() => refetch()}
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
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: APP_TEXT, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: APP_GRAY, marginBottom: 16 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF7ED', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 16 },
  balanceLabel: { fontSize: 13, color: '#92400E' },
  balanceValue: { fontSize: 15, fontWeight: '700', color: APP_ORANGE },
  svcCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 10 },
  svcCardDisabled: { opacity: 0.6 },
  svcCardGray: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f3f4f6', borderRadius: 14, padding: 14, marginBottom: 10 },
  svcIcon: { fontSize: 28, width: 36, textAlign: 'center' },
  svcInfo: { flex: 1, gap: 2 },
  svcTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  svcTitle: { fontSize: 15, fontWeight: '600', color: APP_TEXT },
  svcBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  svcBadgeText: { fontSize: 10, fontWeight: '700' },
  svcDesc: { fontSize: 12, color: APP_GRAY, lineHeight: 16 },
  svcDuration: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  svcCostWrap: { alignItems: 'flex-end', gap: 2 },
  svcCost: { fontSize: 15, fontWeight: '700', color: APP_ORANGE },
  svcCostInsufficient: { color: '#9ca3af' },
  svcInsufficient: { fontSize: 10, color: '#ef4444' },
  svcFree: { fontSize: 13, fontWeight: '600', color: '#16a34a' },
  processingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  processingText: { fontSize: 14, color: APP_GRAY },
  modalCloseBtn: { marginTop: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center' },
  modalCloseBtnText: { fontSize: 15, fontWeight: '600', color: APP_TEXT },
});
