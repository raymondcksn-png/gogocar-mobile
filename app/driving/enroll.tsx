/**
 * 考車報名頁 — /driving/enroll
 * 功能：顯示駕校費用列表 + 選擇駕校 + 填寫報名資料 + 提交報名
 * 路由參數：subCategoryId, hasLicense, subName, catName
 * API: trpc.driving.getSchoolsForSubCategory + trpc.driving.submitEnrollment
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

export default function EnrollScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    subCategoryId: string;
    hasLicense: string;
    subName: string;
    catName: string;
  }>();

  const subCategoryId = Number(params.subCategoryId);
  const hasLicense = params.hasLicense === 'true';
  const subName = decodeURIComponent(params.subName || '');
  const catName = decodeURIComponent(params.catName || '');

  const { isLoggedIn, user } = useAuth();

  // 報名表單
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [studentName, setStudentName] = useState((user as any)?.name || '');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState((user as any)?.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [enrollmentId, setEnrollmentId] = useState<number | null>(null);

  // 獲取駕校費用列表
  const { data: schools, isLoading } = trpc.driving.getSchoolsForSubCategory.useQuery(
    { subCategoryId, hasLicense },
    { enabled: !!subCategoryId, staleTime: 5 * 60 * 1000 }
  );

  const enrollMut = trpc.driving.submitEnrollment.useMutation({
    onSuccess: (data: any) => {
      setSuccess(true);
      setEnrollmentId(data.enrollmentId);
      setSubmitting(false);
    },
    onError: (e: any) => {
      Alert.alert('報名失敗', e.message || '請稍後重試');
      setSubmitting(false);
    },
  });

  const selectedSchool = (schools as any[])?.find((s: any) => s.schoolId === selectedSchoolId);

  const handleSubmit = () => {
    if (!isLoggedIn) {
      Alert.alert('請先登入', '報名需要先登入帳號', [
        { text: '去登入', onPress: () => router.push('/(auth)/login' as any) },
        { text: '取消', style: 'cancel' },
      ]);
      return;
    }
    if (!selectedSchoolId) { Alert.alert('提示', '請選擇報名學校'); return; }
    if (!studentName.trim()) { Alert.alert('提示', '請填寫姓名'); return; }
    if (!birthDate.trim()) { Alert.alert('提示', '請填寫出生日期'); return; }
    if (!phone.trim()) { Alert.alert('提示', '請填寫手機號碼'); return; }

    setSubmitting(true);
    enrollMut.mutate({
      schoolId: selectedSchoolId,
      subCategoryId,
      hasLicense,
      studentName: studentName.trim(),
      studentBirthDate: birthDate.trim(),
      studentPhone: phone.trim(),
    });
  };

  // ── 報名成功頁 ──
  if (success) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>報名成功</Text>
        </View>
        <View style={s.successWrap}>
          <View style={s.successIconWrap}>
            <Ionicons name="checkmark-circle" size={64} color={APP_ORANGE} />
          </View>
          <Text style={s.successTitle}>報名申請已提交！</Text>
          <Text style={s.successSub}>駕校將在工作時間內與您聯繫確認</Text>
          <View style={s.successCard}>
            <SRow label="課程" value={subName} />
            <SRow label="駕校" value={selectedSchool?.schoolName || ''} />
            <SRow label="報名號" value={`#${enrollmentId}`} />
            <SRow label="狀態" value="等待確認" orange />
          </View>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.push('/(tabs)/exam' as any)}>
            <Text style={s.primaryBtnText}>返回考車頁面</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ── 頂部欄 ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerContent}>
          <Text style={s.headerTitle}>{subName || '考車報名'}</Text>
          <Text style={s.headerSub}>{hasLicense ? '已有駕照換照' : '全新考取駕照'}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* ── 駕校費用列表 ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>選擇駕校</Text>
          {isLoading ? (
            <ActivityIndicator color={APP_ORANGE} style={{ paddingVertical: 20 }} />
          ) : !schools || (schools as any[]).length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>暫無此課程的駕校資料</Text>
            </View>
          ) : (
            <View style={s.schoolList}>
              {(schools as any[]).map((school: any) => {
                const isSelected = selectedSchoolId === school.schoolId;
                return (
                  <TouchableOpacity
                    key={school.schoolId}
                    style={[s.schoolCard, isSelected && s.schoolCardSelected]}
                    onPress={() => setSelectedSchoolId(school.schoolId)}
                    activeOpacity={0.8}
                  >
                    {/* 選中指示 */}
                    <View style={s.schoolCardTop}>
                      <View style={s.schoolNameRow}>
                        <View style={[s.radioCircle, isSelected && s.radioCircleActive]}>
                          {isSelected && <View style={s.radioDot} />}
                        </View>
                        <Text style={[s.schoolName, isSelected && s.schoolNameSelected]}>{school.schoolName}</Text>
                      </View>
                      {school.schoolPhone ? (
                        <TouchableOpacity onPress={() => Linking.openURL(`tel:${school.schoolPhone}`)}>
                          <Text style={s.schoolPhone}>📞 {school.schoolPhone}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {/* 費用明細 */}
                    <View style={s.feeGrid}>
                      {school.registrationFee > 0 && <FeeItem label="報名費" value={school.registrationFee} />}
                      {school.learningFee > 0 && <FeeItem label="學費" value={school.learningFee} />}
                      {school.examCarRental > 0 && <FeeItem label="考試租車費" value={school.examCarRental} />}
                      {school.trafficSchoolFee > 0 && <FeeItem label="交通學校費" value={school.trafficSchoolFee} />}
                    </View>

                    {/* 合計 */}
                    <View style={s.totalRow}>
                      <Text style={s.totalLabel}>合計費用</Text>
                      <Text style={[s.totalValue, isSelected && s.totalValueSelected]}>
                        MOP {Number(school.totalFee || 0).toLocaleString()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── 報名資料（選了駕校才顯示） ── */}
        {selectedSchoolId && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>報名資料</Text>
            <View style={s.formCard}>
              <View style={s.formRow}>
                <Text style={s.formLabel}>姓名</Text>
                <TextInput
                  style={s.formInput}
                  value={studentName}
                  onChangeText={setStudentName}
                  placeholder="請輸入真實姓名"
                  placeholderTextColor={APP_GRAY}
                />
              </View>
              <View style={[s.formRow, s.formRowBorder]}>
                <Text style={s.formLabel}>出生日期</Text>
                <TextInput
                  style={s.formInput}
                  value={birthDate}
                  onChangeText={setBirthDate}
                  placeholder="日/月/年"
                  placeholderTextColor={APP_GRAY}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={[s.formRow, s.formRowBorder]}>
                <Text style={s.formLabel}>手機號碼</Text>
                <TextInput
                  style={s.formInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="請輸入聯絡電話"
                  placeholderTextColor={APP_GRAY}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>
        )}

        {/* ── 費用說明 ── */}
        <View style={s.tipBox}>
          <Ionicons name="information-circle-outline" size={14} color="#D97706" />
          <Text style={s.tipText}>以上費用僅供參考，最終以各駕駛學校公佈為準</Text>
        </View>

        {/* ── 提交按鈕 ── */}
        <TouchableOpacity
          style={[s.primaryBtn, s.primaryBtnMargin, (!selectedSchoolId || submitting) && s.primaryBtnDisabled]}
          onPress={handleSubmit}
          disabled={!selectedSchoolId || submitting}
          activeOpacity={0.8}
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.primaryBtnText}>確認報名</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── 費用項目組件 ──
function FeeItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.feeItem}>
      <Text style={s.feeLabel}>{label}</Text>
      <Text style={s.feeValue}>MOP {Number(value).toLocaleString()}</Text>
    </View>
  );
}

// ── 成功頁行組件 ──
function SRow({ label, value, orange }: { label: string; value: string; orange?: boolean }) {
  return (
    <View style={s.sRow}>
      <Text style={s.sRowLabel}>{label}</Text>
      <Text style={[s.sRowValue, orange && { color: APP_ORANGE }]}>{value}</Text>
    </View>
  );
}

// ── 樣式 ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },

  // 頂部欄
  header: { backgroundColor: APP_ORANGE, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { padding: 4 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  scroll: { paddingBottom: 20 },

  // 區塊
  section: { backgroundColor: '#fff', marginTop: 8, paddingHorizontal: 16, paddingVertical: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: APP_TEXT, marginBottom: 12 },

  // 駕校列表
  schoolList: { gap: 12 },
  schoolCard: {
    borderRadius: 12, borderWidth: 1.5, borderColor: APP_BORDER,
    backgroundColor: APP_BG, padding: 14,
  },
  schoolCardSelected: { borderColor: APP_ORANGE, backgroundColor: '#FFF7ED' },
  schoolCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  schoolNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: APP_BORDER, alignItems: 'center', justifyContent: 'center' },
  radioCircleActive: { borderColor: APP_ORANGE },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: APP_ORANGE },
  schoolName: { fontSize: 15, fontWeight: '600', color: APP_TEXT },
  schoolNameSelected: { color: APP_ORANGE },
  schoolPhone: { fontSize: 12, color: APP_ORANGE },

  // 費用明細
  feeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  feeItem: { width: '47%', backgroundColor: '#fff', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: APP_BORDER },
  feeLabel: { fontSize: 11, color: APP_GRAY, marginBottom: 2 },
  feeValue: { fontSize: 13, fontWeight: '600', color: APP_TEXT },

  // 合計
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: APP_BORDER },
  totalLabel: { fontSize: 13, fontWeight: '600', color: APP_TEXT },
  totalValue: { fontSize: 16, fontWeight: '800', color: APP_TEXT },
  totalValueSelected: { color: APP_ORANGE },

  // 報名表單
  formCard: { backgroundColor: APP_BG, borderRadius: 12, borderWidth: 1, borderColor: APP_BORDER, overflow: 'hidden' },
  formRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  formRowBorder: { borderTopWidth: 1, borderTopColor: APP_BORDER },
  formLabel: { fontSize: 14, color: APP_TEXT, width: 72, fontWeight: '500' },
  formInput: { flex: 1, fontSize: 14, color: APP_TEXT, textAlign: 'right' },

  // 費用說明
  tipBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginHorizontal: 16, marginTop: 12, backgroundColor: '#FFFBEB', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#FDE68A' },
  tipText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },

  // 提交按鈕
  primaryBtn: { marginHorizontal: 16, height: 50, borderRadius: 12, backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center' },
  primaryBtnMargin: { marginTop: 16 },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // 成功頁
  successWrap: { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  successIconWrap: { marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '700', color: APP_TEXT, marginBottom: 8 },
  successSub: { fontSize: 14, color: APP_GRAY, textAlign: 'center', marginBottom: 24 },
  successCard: { width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: APP_BORDER, marginBottom: 24 },
  sRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: APP_BORDER },
  sRowLabel: { fontSize: 13, color: APP_GRAY },
  sRowValue: { fontSize: 13, fontWeight: '600', color: APP_TEXT },

  // 空狀態
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 14, color: APP_GRAY },
});
