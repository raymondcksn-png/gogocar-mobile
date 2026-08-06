/**
 * 我的考車報名記錄頁 — /driving/my-enrollments
 * 功能：顯示用戶所有報名記錄，含狀態、學校聯絡人、電話、地址
 * API: trpc.driving.myEnrollments
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

// ── 狀態配置 ──────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:     { label: '等待確認', color: '#D97706', bg: '#FFFBEB', icon: 'time-outline' },
  confirmed:   { label: '已確認',   color: '#16A34A', bg: '#F0FDF4', icon: 'checkmark-circle-outline' },
  in_progress: { label: '學習中',   color: '#2563EB', bg: '#EFF6FF', icon: 'school-outline' },
  completed:   { label: '已完成',   color: '#6B7280', bg: '#F9FAFB', icon: 'trophy-outline' },
  cancelled:   { label: '已取消',   color: '#EF4444', bg: '#FEF2F2', icon: 'close-circle-outline' },
};

export default function MyEnrollmentsScreen() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();

  const { data: enrollments, isLoading, refetch } = trpc.driving.myEnrollments.useQuery(
    undefined,
    { enabled: isLoggedIn, staleTime: 0, refetchOnMount: 'always' }
  );

  return (
    <View style={s.container}>
      {/* ── 頂部欄 ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>我的考車報名</Text>
        <TouchableOpacity onPress={() => refetch()} style={s.refreshBtn}>
          <Ionicons name="refresh-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {!isLoggedIn ? (
          <View style={s.empty}>
            <Ionicons name="person-outline" size={48} color={APP_GRAY} />
            <Text style={s.emptyTitle}>請先登入</Text>
            <TouchableOpacity style={s.loginBtn} onPress={() => router.push('/(auth)/login' as any)}>
              <Text style={s.loginBtnText}>去登入</Text>
            </TouchableOpacity>
          </View>
        ) : isLoading ? (
          <ActivityIndicator color={APP_ORANGE} style={{ marginTop: 60 }} />
        ) : !enrollments || (enrollments as any[]).length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="book-outline" size={48} color={APP_GRAY} />
            <Text style={s.emptyTitle}>暫無報名記錄</Text>
            <Text style={s.emptySubtitle}>前往考車頁面選擇課程報名</Text>
            <TouchableOpacity style={s.goExamBtn} onPress={() => router.push('/(tabs)/exam' as any)}>
              <Text style={s.goExamBtnText}>去報名考車</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.list}>
            {(enrollments as any[]).map((item: any) => {
              const status = STATUS_META[item.enrollmentStatus] ?? STATUS_META['pending'];
              const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-HK', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
              return (
                <View key={item.id} style={s.card}>
                  {/* ── 狀態標籤 + 報名號 ── */}
                  <View style={s.cardTop}>
                    <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
                      <Ionicons name={status.icon as any} size={12} color={status.color} />
                      <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                    <Text style={s.enrollNo}>#{item.id}</Text>
                  </View>

                  {/* ── 課程信息 ── */}
                  <View style={s.courseRow}>
                    <View style={s.courseIconWrap}>
                      <Ionicons name="school-outline" size={20} color={APP_ORANGE} />
                    </View>
                    <View style={s.courseInfo}>
                      <Text style={s.courseName}>{item.subCategoryName}</Text>
                      <Text style={s.courseType}>{item.hasLicense ? '已有駕照換照' : '全新考取駕照'}</Text>
                    </View>
                    <Text style={s.courseDate}>{date}</Text>
                  </View>

                  <View style={s.divider} />

                  {/* ── 學校聯絡資料 ── */}
                  <View style={s.schoolSection}>
                    <Text style={s.schoolSectionTitle}>報名學校</Text>
                    <View style={s.schoolInfo}>
                      <View style={s.schoolNameRow}>
                        <Ionicons name="business-outline" size={16} color={APP_ORANGE} />
                        <Text style={s.schoolName}>{item.schoolName}</Text>
                      </View>
                      {item.schoolPhone && (
                        <TouchableOpacity
                          style={s.contactRow}
                          onPress={() => Linking.openURL(`tel:${item.schoolPhone}`)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="call-outline" size={15} color={APP_ORANGE} />
                          <Text style={s.contactText}>{item.schoolPhone}</Text>
                          <Text style={s.callHint}>點擊撥打</Text>
                        </TouchableOpacity>
                      )}
                      {item.schoolAddress && (
                        <View style={s.contactRow}>
                          <Ionicons name="location-outline" size={15} color={APP_GRAY} />
                          <Text style={s.addressText} numberOfLines={2}>{item.schoolAddress}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={s.divider} />

                  {/* ── 費用信息 ── */}
                  <View style={s.feeRow}>
                    <Text style={s.feeLabel}>報名費用</Text>
                    <Text style={s.feeValue}>MOP {Number(item.totalFee || 0).toLocaleString()}</Text>
                  </View>

                  {/* ── 狀態說明 ── */}
                  {item.enrollmentStatus === 'pending' && (
                    <View style={s.tipBox}>
                      <Ionicons name="information-circle-outline" size={13} color="#D97706" />
                      <Text style={s.tipText}>學校將在工作時間（09:00–18:00）內聯繫您確認報名</Text>
                    </View>
                  )}
                  {item.enrollmentStatus === 'confirmed' && (
                    <View style={[s.tipBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                      <Ionicons name="checkmark-circle-outline" size={13} color="#16A34A" />
                      <Text style={[s.tipText, { color: '#15803D' }]}>報名已確認，請按學校指示前往報到</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── 底部新報名按鈕 ── */}
        {enrollments && (enrollments as any[]).length > 0 && (
          <TouchableOpacity style={s.newEnrollBtn} onPress={() => router.push('/(tabs)/exam' as any)} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={18} color={APP_ORANGE} />
            <Text style={s.newEnrollBtnText}>報名其他課程</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ── 樣式 ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },

  header: {
    backgroundColor: APP_ORANGE, paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center',
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', marginLeft: 8 },
  refreshBtn: { padding: 4 },

  scroll: { paddingTop: 12, paddingHorizontal: 16 },

  // 列表
  list: { gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: APP_BORDER },

  // 頂部狀態行
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600' },
  enrollNo: { fontSize: 12, color: APP_GRAY },

  // 課程信息
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  courseIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' },
  courseInfo: { flex: 1 },
  courseName: { fontSize: 15, fontWeight: '600', color: APP_TEXT },
  courseType: { fontSize: 12, color: APP_GRAY, marginTop: 2 },
  courseDate: { fontSize: 12, color: APP_GRAY },

  divider: { height: 1, backgroundColor: APP_BORDER, marginVertical: 12 },

  // 學校聯絡資料
  schoolSection: {},
  schoolSectionTitle: { fontSize: 12, color: APP_GRAY, marginBottom: 8 },
  schoolInfo: { gap: 6 },
  schoolNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  schoolName: { fontSize: 15, fontWeight: '600', color: APP_TEXT },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactText: { fontSize: 14, color: APP_ORANGE, fontWeight: '500' },
  callHint: { fontSize: 11, color: APP_GRAY, marginLeft: 4 },
  addressText: { flex: 1, fontSize: 13, color: APP_GRAY, lineHeight: 18 },

  // 費用
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeLabel: { fontSize: 13, color: APP_GRAY },
  feeValue: { fontSize: 15, fontWeight: '700', color: APP_ORANGE },

  // 提示
  tipBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, backgroundColor: '#FFFBEB', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#FDE68A' },
  tipText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },

  // 空狀態
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: APP_TEXT },
  emptySubtitle: { fontSize: 13, color: APP_GRAY },
  loginBtn: { marginTop: 8, paddingHorizontal: 32, paddingVertical: 12, backgroundColor: APP_ORANGE, borderRadius: 10 },
  loginBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  goExamBtn: { marginTop: 8, paddingHorizontal: 32, paddingVertical: 12, backgroundColor: APP_ORANGE, borderRadius: 10 },
  goExamBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // 底部新報名按鈕
  newEnrollBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: APP_ORANGE, borderStyle: 'dashed' },
  newEnrollBtnText: { fontSize: 14, fontWeight: '600', color: APP_ORANGE },
});
