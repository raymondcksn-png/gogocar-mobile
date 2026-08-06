/**
 * 車商會員中心 — /profile/dealer-center
 * 功能：顯示車商會員狀態、到期時間、訂單記錄、功能入口
 * API: trpc.dealer.getMyMembership
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

const DEALER_BLUE = '#2563EB';
const DEALER_LIGHT = '#EFF6FF';

export default function DealerCenterScreen() {
  const router = useRouter();
  const { data, isLoading, refetch } = trpc.dealer.getMyMembership.useQuery(undefined, {
    staleTime: 0, refetchOnMount: 'always',
  });

  const isActive = (data as any)?.isActive ?? false;
  const expireAt = (data as any)?.expireAt;
  const orders: any[] = (data as any)?.orders ?? [];

  const expireDate = expireAt ? new Date(expireAt) : null;
  const daysLeft = expireDate ? Math.ceil((expireDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <View style={s.container}>
      {/* ── 頂部欄 ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>車商會員中心</Text>
        <TouchableOpacity onPress={() => refetch()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {isLoading ? (
          <ActivityIndicator color={DEALER_BLUE} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* ── 會員狀態卡 ── */}
            <View style={[s.memberCard, isActive ? s.memberCardActive : s.memberCardInactive]}>
              <View style={s.memberCardTop}>
                <View style={s.memberIconWrap}>
                  <Ionicons name="business" size={28} color={isActive ? '#fff' : DEALER_BLUE} />
                </View>
                <View style={s.memberInfo}>
                  <Text style={[s.memberTitle, isActive && { color: '#fff' }]}>車商會員</Text>
                  {isActive ? (
                    <Text style={s.memberStatusActive}>● 會員有效中</Text>
                  ) : (
                    <Text style={s.memberStatusInactive}>○ 未開通 / 已過期</Text>
                  )}
                </View>
                {isActive && (
                  <View style={s.daysLeftBadge}>
                    <Text style={s.daysLeftNum}>{daysLeft}</Text>
                    <Text style={s.daysLeftLabel}>天</Text>
                  </View>
                )}
              </View>

              {isActive && expireDate && (
                <View style={s.expireRow}>
                  <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={s.expireText}>
                    到期日：{expireDate.toLocaleDateString('zh-HK', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </Text>
                </View>
              )}

              {!isActive && (
                <TouchableOpacity
                  style={s.renewBtn}
                  onPress={() => router.push('/profile/dealer-membership' as any)}
                  activeOpacity={0.8}
                >
                  <Text style={s.renewBtnText}>開通 / 續費車商會員</Text>
                  <Ionicons name="chevron-forward" size={16} color={DEALER_BLUE} />
                </TouchableOpacity>
              )}
            </View>

            {/* ── 車商功能入口 ── */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>車商功能</Text>
              <View style={s.funcGrid}>
                <FuncItem icon="car-outline" label="我的車源" color={DEALER_BLUE} onPress={() => router.push('/profile/my-posts' as any)} />
                <FuncItem icon="add-circle-outline" label="發布車源" color={DEALER_BLUE} onPress={() => router.push('/(tabs)/sell' as any)} />
                <FuncItem icon="star-outline" label="精選推廣" color="#F59E0B" onPress={() => router.push('/(tabs)/sell' as any)} />
                <FuncItem icon="analytics-outline" label="數據統計" color="#6366F1" onPress={() => {}} comingSoon />
              </View>
            </View>

            {/* ── 車商會員特權說明 ── */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>會員特權</Text>
              <View style={s.privilegeList}>
                {[
                  { icon: 'checkmark-circle', text: '批量管理車源（無上限）', active: isActive },
                  { icon: 'checkmark-circle', text: '車源置頂推廣優先展示', active: isActive },
                  { icon: 'checkmark-circle', text: '精選推薦版位（首頁展示）', active: isActive },
                  { icon: 'checkmark-circle', text: '專業車行主頁展示', active: isActive },
                  { icon: 'checkmark-circle', text: '車商標識認證徽章', active: isActive },
                ].map((p, i) => (
                  <View key={i} style={s.privilegeItem}>
                    <Ionicons name={p.icon as any} size={16} color={p.active ? DEALER_BLUE : APP_GRAY} />
                    <Text style={[s.privilegeText, !p.active && { color: APP_GRAY }]}>{p.text}</Text>
                    {!p.active && <Text style={s.lockedTag}>需開通</Text>}
                  </View>
                ))}
              </View>
            </View>

            {/* ── 訂單記錄 ── */}
            {orders.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>訂單記錄</Text>
                {orders.map((order: any) => (
                  <View key={order.id} style={s.orderCard}>
                    <View style={s.orderTop}>
                      <Text style={s.orderPlan}>{order.planName || '車商年度會員'}</Text>
                      <View style={[s.orderStatusBadge, {
                        backgroundColor: order.status === 'approved' ? '#F0FDF4' : order.status === 'rejected' ? '#FEF2F2' : '#FFFBEB'
                      }]}>
                        <Text style={[s.orderStatusText, {
                          color: order.status === 'approved' ? '#16A34A' : order.status === 'rejected' ? '#DC2626' : '#D97706'
                        }]}>
                          {order.status === 'approved' ? '已通過' : order.status === 'rejected' ? '已拒絕' : '審核中'}
                        </Text>
                      </View>
                    </View>
                    <View style={s.orderBottom}>
                      <Text style={s.orderAmount}>MOP {order.amount?.toLocaleString()}</Text>
                      <Text style={s.orderDate}>{new Date(order.createdAt).toLocaleDateString('zh-HK')}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 32 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function FuncItem({ icon, label, color, onPress, comingSoon }: { icon: string; label: string; color: string; onPress: () => void; comingSoon?: boolean }) {
  return (
    <TouchableOpacity style={s.funcItem} onPress={comingSoon ? undefined : onPress} activeOpacity={0.7}>
      <View style={[s.funcIconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={s.funcLabel}>{label}</Text>
      {comingSoon && <Text style={s.comingSoon}>即將上線</Text>}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: { backgroundColor: DEALER_BLUE, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  scroll: { paddingTop: 12 },

  // 會員狀態卡
  memberCard: { marginHorizontal: 16, borderRadius: 16, padding: 20, marginBottom: 12 },
  memberCardActive: { backgroundColor: DEALER_BLUE },
  memberCardInactive: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: DEALER_BLUE },
  memberCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  memberIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  memberInfo: { flex: 1 },
  memberTitle: { fontSize: 18, fontWeight: '700', color: DEALER_BLUE },
  memberStatusActive: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  memberStatusInactive: { fontSize: 13, color: APP_GRAY, marginTop: 2 },
  daysLeftBadge: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  daysLeftNum: { fontSize: 22, fontWeight: '800', color: '#fff' },
  daysLeftLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  expireRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  expireText: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  renewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: DEALER_LIGHT, borderRadius: 10, paddingVertical: 12, marginTop: 4 },
  renewBtnText: { fontSize: 14, fontWeight: '600', color: DEALER_BLUE },

  // 區塊
  section: { backgroundColor: '#fff', marginTop: 8, paddingHorizontal: 16, paddingVertical: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: APP_TEXT, marginBottom: 12 },

  // 功能格子
  funcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  funcItem: { width: '22%', alignItems: 'center', gap: 6 },
  funcIconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  funcLabel: { fontSize: 12, color: APP_TEXT, textAlign: 'center' },
  comingSoon: { fontSize: 10, color: APP_GRAY },

  // 特權列表
  privilegeList: { gap: 10 },
  privilegeItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  privilegeText: { flex: 1, fontSize: 14, color: APP_TEXT },
  lockedTag: { fontSize: 11, color: APP_GRAY, backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  // 訂單
  orderCard: { backgroundColor: APP_BG, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: APP_BORDER },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderPlan: { fontSize: 14, fontWeight: '600', color: APP_TEXT },
  orderStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  orderStatusText: { fontSize: 12, fontWeight: '600' },
  orderBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  orderAmount: { fontSize: 14, fontWeight: '700', color: DEALER_BLUE },
  orderDate: { fontSize: 12, color: APP_GRAY },
});
