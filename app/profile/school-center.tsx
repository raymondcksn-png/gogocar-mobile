/**
 * 駕校校長管理中心 — /profile/school-center
 * 功能：顯示駕校信息、報名統計、學員管理、課程費用管理
 * API: trpc.driving.principalDashboard + principalEnrollments + principalPricing
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';
import { APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

const SCHOOL_GREEN = '#059669';
const SCHOOL_LIGHT = '#F0FDF4';

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: '等待確認', color: '#D97706', bg: '#FFFBEB' },
  confirmed:   { label: '已確認',   color: '#16A34A', bg: '#F0FDF4' },
  in_progress: { label: '學習中',   color: '#2563EB', bg: '#EFF6FF' },
  completed:   { label: '已完成',   color: '#6B7280', bg: '#F9FAFB' },
  cancelled:   { label: '已取消',   color: '#EF4444', bg: '#FEF2F2' },
};

export default function SchoolCenterScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'enrollments' | 'pricing'>('enrollments');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: dashboard, isLoading: dashLoading, refetch } = trpc.driving.principalDashboard.useQuery(undefined, {
    staleTime: 0, refetchOnMount: 'always',
  });

  const { data: enrollments, isLoading: enrollLoading } = trpc.driving.principalEnrollments.useQuery(
    { enrollmentStatus: statusFilter === 'all' ? undefined : statusFilter },
    { staleTime: 0, refetchOnMount: 'always' }
  );

  const { data: pricing, isLoading: pricingLoading } = trpc.driving.principalPricing.useQuery(undefined, {
    staleTime: 0, refetchOnMount: 'always',
  });

  const dash = dashboard as any;
  const hasSchool = dash?.schoolId != null;

  return (
    <View style={s.container}>
      {/* ── 頂部欄 ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>駕校管理中心</Text>
        <TouchableOpacity onPress={() => refetch()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {dashLoading ? (
          <ActivityIndicator color={SCHOOL_GREEN} style={{ marginTop: 60 }} />
        ) : !hasSchool ? (
          /* ── 未綁定駕校提示 ── */
          <View style={s.noSchoolWrap}>
            <Ionicons name="school-outline" size={56} color={APP_GRAY} />
            <Text style={s.noSchoolTitle}>駕校尚未設置</Text>
            <Text style={s.noSchoolSub}>您的申請已通過，管理員正在設置您的駕校信息{'\n'}請稍後刷新或聯繫平台客服</Text>
            <TouchableOpacity style={s.refreshBtn} onPress={() => refetch()} activeOpacity={0.8}>
              <Text style={s.refreshBtnText}>刷新狀態</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── 駕校信息卡 ── */}
            <View style={s.schoolCard}>
              <View style={s.schoolCardTop}>
                <View style={s.schoolIconWrap}>
                  <Ionicons name="school" size={28} color="#fff" />
                </View>
                <View style={s.schoolInfo}>
                  <Text style={s.schoolName}>{dash.schoolName}</Text>
                  <Text style={s.schoolBadge}>✓ 認證駕校</Text>
                </View>
              </View>
            </View>

            {/* ── 統計數字 ── */}
            <View style={s.statsRow}>
              <StatCard label="總報名" value={dash.totalEnrollments} color={SCHOOL_GREEN} />
              <StatCard label="待確認" value={dash.pendingEnrollments} color="#D97706" />
              <StatCard label="已確認" value={dash.confirmedEnrollments} color="#2563EB" />
              <StatCard label="已完成" value={dash.completedEnrollments} color="#6B7280" />
            </View>

            {/* ── Tab 切換 ── */}
            <View style={s.tabRow}>
              <TouchableOpacity style={[s.tab, activeTab === 'enrollments' && s.tabActive]} onPress={() => setActiveTab('enrollments')} activeOpacity={0.7}>
                <Text style={[s.tabText, activeTab === 'enrollments' && s.tabTextActive]}>報名管理</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.tab, activeTab === 'pricing' && s.tabActive]} onPress={() => setActiveTab('pricing')} activeOpacity={0.7}>
                <Text style={[s.tabText, activeTab === 'pricing' && s.tabTextActive]}>課程費用</Text>
              </TouchableOpacity>
            </View>

            {/* ── 報名管理 Tab ── */}
            {activeTab === 'enrollments' && (
              <View style={s.section}>
                {/* 狀態篩選 */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                  {[
                    { key: 'all', label: '全部' },
                    { key: 'pending', label: '待確認' },
                    { key: 'confirmed', label: '已確認' },
                    { key: 'in_progress', label: '學習中' },
                    { key: 'completed', label: '已完成' },
                  ].map((f) => (
                    <TouchableOpacity
                      key={f.key}
                      style={[s.filterChip, statusFilter === f.key && s.filterChipActive]}
                      onPress={() => setStatusFilter(f.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.filterChipText, statusFilter === f.key && s.filterChipTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {enrollLoading ? (
                  <ActivityIndicator color={SCHOOL_GREEN} style={{ marginTop: 24 }} />
                ) : !enrollments || (enrollments as any[]).length === 0 ? (
                  <View style={s.empty}>
                    <Ionicons name="people-outline" size={40} color={APP_GRAY} />
                    <Text style={s.emptyText}>暫無報名記錄</Text>
                  </View>
                ) : (
                  <View style={s.enrollList}>
                    {(enrollments as any[]).map((e: any) => {
                      const st = STATUS_META[e.enrollmentStatus] ?? STATUS_META['pending'];
                      return (
                        <View key={e.id} style={s.enrollCard}>
                          <View style={s.enrollTop}>
                            <Text style={s.enrollName}>{e.studentName}</Text>
                            <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                              <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                            </View>
                          </View>
                          <Text style={s.enrollCourse}>{e.subCategoryName}</Text>
                          <View style={s.enrollBottom}>
                            {e.studentPhone ? (
                              <TouchableOpacity onPress={() => Linking.openURL(`tel:${e.studentPhone}`)} style={s.callBtn}>
                                <Ionicons name="call-outline" size={14} color={SCHOOL_GREEN} />
                                <Text style={s.callBtnText}>{e.studentPhone}</Text>
                              </TouchableOpacity>
                            ) : null}
                            <Text style={s.enrollDate}>{new Date(e.createdAt).toLocaleDateString('zh-HK')}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* ── 課程費用 Tab ── */}
            {activeTab === 'pricing' && (
              <View style={s.section}>
                {pricingLoading ? (
                  <ActivityIndicator color={SCHOOL_GREEN} style={{ marginTop: 24 }} />
                ) : !pricing || (pricing as any[]).length === 0 ? (
                  <View style={s.empty}>
                    <Ionicons name="pricetag-outline" size={40} color={APP_GRAY} />
                    <Text style={s.emptyText}>暫無課程費用設置</Text>
                    <Text style={s.emptySubText}>請聯繫平台管理員添加課程費用</Text>
                  </View>
                ) : (
                  <View style={s.pricingList}>
                    {(pricing as any[]).map((p: any) => (
                      <View key={p.id} style={s.pricingCard}>
                        <Text style={s.pricingCourse}>{p.subCategoryName}</Text>
                        <Text style={s.pricingType}>{p.hasLicense ? '已有駕照換照' : '全新考取'}</Text>
                        <View style={s.pricingFees}>
                          {Number(p.registrationFee) > 0 && <PriceFee label="報名費" value={p.registrationFee} />}
                          {Number(p.learningFee) > 0 && <PriceFee label="學費" value={p.learningFee} />}
                          {Number(p.examCarRental) > 0 && <PriceFee label="租車費" value={p.examCarRental} />}
                        </View>
                        <View style={s.pricingTotal}>
                          <Text style={s.pricingTotalLabel}>合計</Text>
                          <Text style={s.pricingTotalValue}>MOP {Number(p.totalFee || 0).toLocaleString()}</Text>
                        </View>
                      </View>
                    ))}
                    <View style={s.pricingNote}>
                      <Ionicons name="information-circle-outline" size={14} color={APP_GRAY} />
                      <Text style={s.pricingNoteText}>如需修改課程費用，請聯繫平台管理員</Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            <View style={{ height: 32 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={s.statCard}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function PriceFee({ label, value }: { label: string; value: any }) {
  return (
    <View style={s.priceFee}>
      <Text style={s.priceFeeLabel}>{label}</Text>
      <Text style={s.priceFeeValue}>MOP {Number(value).toLocaleString()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: { backgroundColor: SCHOOL_GREEN, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  scroll: { paddingTop: 0 },

  // 無駕校提示
  noSchoolWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32, gap: 12 },
  noSchoolTitle: { fontSize: 18, fontWeight: '600', color: APP_TEXT },
  noSchoolSub: { fontSize: 13, color: APP_GRAY, textAlign: 'center', lineHeight: 20 },
  refreshBtn: { marginTop: 8, paddingHorizontal: 32, paddingVertical: 12, backgroundColor: SCHOOL_GREEN, borderRadius: 10 },
  refreshBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // 駕校信息卡
  schoolCard: { backgroundColor: SCHOOL_GREEN, padding: 20 },
  schoolCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  schoolIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  schoolInfo: { flex: 1 },
  schoolName: { fontSize: 20, fontWeight: '700', color: '#fff' },
  schoolBadge: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 },

  // 統計
  statsRow: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 16, paddingHorizontal: 8 },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, color: APP_GRAY, marginTop: 2 },

  // Tab
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: APP_BORDER },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: SCHOOL_GREEN },
  tabText: { fontSize: 14, color: APP_GRAY },
  tabTextActive: { color: SCHOOL_GREEN, fontWeight: '600' },

  // 區塊
  section: { backgroundColor: '#fff', marginTop: 8, paddingVertical: 12 },
  filterRow: { marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: APP_BORDER, backgroundColor: '#fff' },
  filterChipActive: { borderColor: SCHOOL_GREEN, backgroundColor: SCHOOL_LIGHT },
  filterChipText: { fontSize: 13, color: APP_GRAY },
  filterChipTextActive: { color: SCHOOL_GREEN, fontWeight: '600' },

  // 報名列表
  enrollList: { gap: 8, paddingHorizontal: 16 },
  enrollCard: { backgroundColor: APP_BG, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: APP_BORDER },
  enrollTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  enrollName: { fontSize: 15, fontWeight: '600', color: APP_TEXT },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '600' },
  enrollCourse: { fontSize: 13, color: APP_GRAY, marginBottom: 8 },
  enrollBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  callBtnText: { fontSize: 13, color: SCHOOL_GREEN, fontWeight: '500' },
  enrollDate: { fontSize: 12, color: APP_GRAY },

  // 空狀態
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: APP_GRAY },
  emptySubText: { fontSize: 12, color: APP_GRAY },

  // 課程費用
  pricingList: { paddingHorizontal: 16, gap: 10 },
  pricingCard: { backgroundColor: APP_BG, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: APP_BORDER },
  pricingCourse: { fontSize: 14, fontWeight: '600', color: APP_TEXT, marginBottom: 2 },
  pricingType: { fontSize: 12, color: APP_GRAY, marginBottom: 8 },
  pricingFees: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  priceFee: { backgroundColor: '#fff', borderRadius: 6, padding: 6, borderWidth: 1, borderColor: APP_BORDER, minWidth: 80 },
  priceFeeLabel: { fontSize: 10, color: APP_GRAY },
  priceFeeValue: { fontSize: 12, fontWeight: '600', color: APP_TEXT },
  pricingTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: APP_BORDER },
  pricingTotalLabel: { fontSize: 13, color: APP_TEXT },
  pricingTotalValue: { fontSize: 14, fontWeight: '700', color: SCHOOL_GREEN },
  pricingNote: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  pricingNoteText: { fontSize: 12, color: APP_GRAY },
});
