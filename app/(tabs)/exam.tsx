/**
 * 考車頁面 — Sprint D3 升級版
 * 新增：地區切換（澳門/香港）、駕照類別列表、駕校列表、報名入口
 * API: trpc.driving.getCategoriesWithSubs + trpc.driving.getSchoolsForSubCategory
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

const REGIONS = [
  { label: '🇲🇴 澳門', value: 'macau' },
  { label: '🇭🇰 香港', value: 'hongkong' },
];

// 澳門駕照類別圖標映射
const CAT_ICONS: Record<string, string> = {
  '輕型汽車': '🚗',
  '重型汽車': '🚛',
  '電單車': '🏍️',
  '輕型電單車': '🛵',
  '重型電單車': '🏍️',
  '輕型客車': '🚌',
};

export default function ExamScreen() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [region, setRegion] = useState<'macau' | 'hongkong'>('macau');
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [hasLicense, setHasLicense] = useState(false);

  // 獲取駕照類別（澳門有數據，香港顯示即將上線）
  const { data: categories, isLoading: catLoading } = trpc.driving.getCategoriesWithSubs.useQuery(
    undefined,
    { enabled: region === 'macau' }
  );

  // 獲取指定小類的駕校列表
  const { data: schools, isLoading: schoolLoading } = trpc.driving.getSchoolsForSubCategory.useQuery(
    { subCategoryId: selectedSubId!, hasLicense },
    { enabled: !!selectedSubId }
  );

  const selectedCat = categories?.find((c: any) => c.id === selectedCatId);

  return (
    <View style={styles.container}>
      {/* 頂部欄 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>考車</Text>
        <Text style={styles.headerSub}>駕校報名 · 費用查詢</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 地區切換 */}
        <View style={styles.regionBar}>
          {REGIONS.map(r => (
            <TouchableOpacity
              key={r.value}
              style={[styles.regionTab, region === r.value && styles.regionTabActive]}
              onPress={() => { setRegion(r.value as 'macau' | 'hongkong'); setSelectedCatId(null); setSelectedSubId(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.regionTabText, region === r.value && styles.regionTabTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {region === 'hongkong' ? (
          /* 香港：即將上線 */
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonIcon}>🇭🇰</Text>
            <Text style={styles.comingSoonTitle}>香港考車資訊即將上線</Text>
            <Text style={styles.comingSoonDesc}>香港運輸署駕照申請、駕校資訊敬請期待</Text>
          </View>
        ) : catLoading ? (
          <View style={styles.loadingWrap}><ActivityIndicator color={APP_ORANGE} size="large" /></View>
        ) : (
          <>
            {/* 駕照類別 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>選擇駕照類別</Text>
              {(!categories || categories.length === 0) ? (
                <Text style={styles.emptyText}>暫無駕照類別資料</Text>
              ) : (
                <View style={styles.catGrid}>
                  {categories.map((cat: any) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catCard, selectedCatId === cat.id && styles.catCardActive]}
                      onPress={() => { setSelectedCatId(cat.id === selectedCatId ? null : cat.id); setSelectedSubId(null); }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.catIcon}>{CAT_ICONS[cat.name] || '🚗'}</Text>
                      <Text style={[styles.catName, selectedCatId === cat.id && styles.catNameActive]} numberOfLines={2}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* 小類選擇（展開後顯示） */}
            {selectedCat && selectedCat.subCategories?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>選擇考試類型</Text>
                <View style={styles.subCatList}>
                  {selectedCat.subCategories.map((sub: any) => (
                    <TouchableOpacity
                      key={sub.id}
                      style={[styles.subCatItem, selectedSubId === sub.id && styles.subCatItemActive]}
                      onPress={() => setSelectedSubId(sub.id === selectedSubId ? null : sub.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.subCatText, selectedSubId === sub.id && styles.subCatTextActive]}>{sub.name}</Text>
                      {selectedSubId === sub.id && <Text style={styles.subCatCheck}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* 有無牌照選擇 */}
            {selectedSubId && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>你是否已持有其他駕照？</Text>
                <View style={styles.licenseRow}>
                  <TouchableOpacity
                    style={[styles.licenseBtn, !hasLicense && styles.licenseBtnActive]}
                    onPress={() => setHasLicense(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.licenseBtnText, !hasLicense && styles.licenseBtnTextActive]}>無牌照（初學）</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.licenseBtn, hasLicense && styles.licenseBtnActive]}
                    onPress={() => setHasLicense(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.licenseBtnText, hasLicense && styles.licenseBtnTextActive]}>已持有駕照</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 駕校列表 */}
            {selectedSubId && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>澳門駕校費用比較</Text>
                {schoolLoading ? (
                  <ActivityIndicator color={APP_ORANGE} style={{ paddingVertical: 20 }} />
                ) : !schools || schools.length === 0 ? (
                  <Text style={styles.emptyText}>暫無此類別的駕校資料</Text>
                ) : (
                  schools.map((school: any, i: number) => (
                    <View key={school.schoolId || i} style={styles.schoolCard}>
                      <View style={styles.schoolHeader}>
                        <Text style={styles.schoolName}>{school.schoolName}</Text>
                        {school.schoolPhone ? (
                          <TouchableOpacity onPress={() => Linking.openURL(`tel:${school.schoolPhone}`)}>
                            <Text style={styles.schoolPhone}>📞 {school.schoolPhone}</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <View style={styles.feeGrid}>
                        {school.registrationFee > 0 && <FeeItem label="報名費" value={school.registrationFee} />}
                        {school.learningFee > 0 && <FeeItem label="學費" value={school.learningFee} />}
                        {school.examCarRental > 0 && <FeeItem label="考試租車" value={school.examCarRental} />}
                        {school.trafficSchoolFee > 0 && <FeeItem label="交通學校" value={school.trafficSchoolFee} />}
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>合計費用</Text>
                        <Text style={styles.totalValue}>MOP {school.totalFee?.toLocaleString()}</Text>
                      </View>
                      {isLoggedIn && (
                        <TouchableOpacity
                          style={styles.enrollBtn}
                          onPress={() => Alert.alert('報名', `確認向 ${school.schoolName} 提交報名申請？`, [
                            { text: '取消', style: 'cancel' },
                            { text: '確認報名', onPress: () => router.push(`/driving/enroll?schoolId=${school.schoolId}&subCategoryId=${selectedSubId}&hasLicense=${hasLicense}` as any) },
                          ])}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.enrollBtnText}>立即報名</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}

            {/* 提示 */}
            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>📋 澳門考車流程</Text>
              <Text style={styles.tipText}>1. 選擇駕校並報名繳費</Text>
              <Text style={styles.tipText}>2. 完成駕校課程（理論 + 實習）</Text>
              <Text style={styles.tipText}>3. 參加交通局筆試</Text>
              <Text style={styles.tipText}>4. 參加交通局路試</Text>
              <Text style={styles.tipText}>5. 領取正式駕照</Text>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function FeeItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.feeItem}>
      <Text style={styles.feeLabel}>{label}</Text>
      <Text style={styles.feeValue}>MOP {value.toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: {
    backgroundColor: APP_ORANGE, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  // 地區切換
  regionBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: APP_BORDER,
  },
  regionTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  regionTabActive: { borderBottomColor: APP_ORANGE },
  regionTabText: { fontSize: 14, fontWeight: '500', color: APP_GRAY },
  regionTabTextActive: { color: APP_ORANGE, fontWeight: '700' },
  // 即將上線
  comingSoon: { flex: 1, paddingTop: 80, alignItems: 'center', paddingHorizontal: 32 },
  comingSoonIcon: { fontSize: 64, marginBottom: 16 },
  comingSoonTitle: { fontSize: 18, fontWeight: '700', color: APP_TEXT, marginBottom: 8 },
  comingSoonDesc: { fontSize: 14, color: APP_GRAY, textAlign: 'center' },
  // 通用
  loadingWrap: { paddingTop: 80, alignItems: 'center' },
  section: { backgroundColor: '#fff', marginTop: 8, paddingHorizontal: 16, paddingVertical: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: APP_TEXT, marginBottom: 12 },
  emptyText: { textAlign: 'center', paddingVertical: 16, color: APP_GRAY, fontSize: 14 },
  // 類別卡片
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catCard: {
    width: '30%', borderRadius: 12, borderWidth: 1.5, borderColor: APP_BORDER,
    backgroundColor: APP_BG, padding: 12, alignItems: 'center',
  },
  catCardActive: { borderColor: APP_ORANGE, backgroundColor: `${APP_ORANGE}08` },
  catIcon: { fontSize: 28, marginBottom: 6 },
  catName: { fontSize: 12, color: APP_TEXT, textAlign: 'center', fontWeight: '500' },
  catNameActive: { color: APP_ORANGE, fontWeight: '700' },
  // 小類
  subCatList: { gap: 8 },
  subCatItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: APP_BORDER, backgroundColor: APP_BG,
  },
  subCatItemActive: { borderColor: APP_ORANGE, backgroundColor: `${APP_ORANGE}08` },
  subCatText: { fontSize: 14, color: APP_TEXT },
  subCatTextActive: { color: APP_ORANGE, fontWeight: '600' },
  subCatCheck: { fontSize: 16, color: APP_ORANGE, fontWeight: '700' },
  // 牌照選擇
  licenseRow: { flexDirection: 'row', gap: 12 },
  licenseBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: APP_BORDER, alignItems: 'center',
  },
  licenseBtnActive: { borderColor: APP_ORANGE, backgroundColor: `${APP_ORANGE}08` },
  licenseBtnText: { fontSize: 13, color: APP_GRAY, fontWeight: '500' },
  licenseBtnTextActive: { color: APP_ORANGE, fontWeight: '700' },
  // 駕校卡片
  schoolCard: {
    borderRadius: 12, borderWidth: 1, borderColor: APP_BORDER,
    backgroundColor: APP_BG, padding: 14, marginBottom: 12,
  },
  schoolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  schoolName: { fontSize: 15, fontWeight: '700', color: APP_TEXT },
  schoolPhone: { fontSize: 13, color: APP_ORANGE },
  feeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  feeItem: { width: '47%', backgroundColor: '#fff', borderRadius: 8, padding: 8 },
  feeLabel: { fontSize: 11, color: APP_GRAY, marginBottom: 2 },
  feeValue: { fontSize: 13, fontWeight: '600', color: APP_TEXT },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTopWidth: 0.5, borderTopColor: APP_BORDER,
  },
  totalLabel: { fontSize: 14, fontWeight: '600', color: APP_TEXT },
  totalValue: { fontSize: 16, fontWeight: '800', color: APP_ORANGE },
  enrollBtn: {
    marginTop: 12, height: 44, borderRadius: 10,
    backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center',
  },
  enrollBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  // 流程提示
  tipBox: {
    margin: 16, borderRadius: 12, backgroundColor: `${APP_ORANGE}10`,
    padding: 16, borderWidth: 1, borderColor: `${APP_ORANGE}30`,
  },
  tipTitle: { fontSize: 14, fontWeight: '700', color: APP_ORANGE, marginBottom: 10 },
  tipText: { fontSize: 13, color: APP_TEXT, marginBottom: 4, lineHeight: 20 },
});
