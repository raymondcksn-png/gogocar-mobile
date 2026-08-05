/**
 * 考車頁面 — 完整版 v5.0
 * 設計：澳門/香港 Tab + 未有/已有駕照切換 + 可展開駕照類別列表（帶子課程）
 * 路由：點擊子課程 → /driving/enroll?subCategoryId=X&hasLicense=Y
 * API: trpc.driving.getCategoriesWithSubs
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

const REGIONS = [
  { label: '🇲🇴 澳門', value: 'macau' },
  { label: '🇭🇰 香港', value: 'hongkong' },
] as const;

const MACAU_STEPS = [
  '選擇駕校並報名繳費',
  '完成駕校課程（理論 + 實習）',
  '參加交通局筆試',
  '參加交通局路試',
  '領取正式駕照',
];

export default function ExamScreen() {
  const router = useRouter();
  const [region, setRegion] = useState<'macau' | 'hongkong'>('macau');
  const [hasLicense, setHasLicense] = useState(false);
  const [expandedCatId, setExpandedCatId] = useState<number | null>(null);

  const { data: categories, isLoading } = trpc.driving.getCategoriesWithSubs.useQuery(
    undefined,
    { enabled: region === 'macau', staleTime: 5 * 60 * 1000 }
  );

  const toggleCat = (id: number) => setExpandedCatId(prev => prev === id ? null : id);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>考車</Text>
        <Text style={s.headerSub}>駕校報名 · 費用查詢</Text>
      </View>

      <View style={s.regionBar}>
        {REGIONS.map(r => (
          <TouchableOpacity
            key={r.value}
            style={[s.regionTab, region === r.value && s.regionTabActive]}
            onPress={() => { setRegion(r.value); setExpandedCatId(null); }}
            activeOpacity={0.7}
          >
            <Text style={[s.regionTabText, region === r.value && s.regionTabTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {region === 'hongkong' ? (
          <View style={s.comingSoon}>
            <Text style={s.comingSoonIcon}>🇭🇰</Text>
            <Text style={s.comingSoonTitle}>香港考車資訊即將上線</Text>
            <Text style={s.comingSoonSub}>敬請期待</Text>
          </View>
        ) : (
          <>
            <View style={s.licenseToggle}>
              <TouchableOpacity
                style={[s.licenseBtn, !hasLicense && s.licenseBtnActive]}
                onPress={() => setHasLicense(false)}
                activeOpacity={0.8}
              >
                <Text style={[s.licenseBtnText, !hasLicense && s.licenseBtnTextActive]}>未有駕照</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.licenseBtn, hasLicense && s.licenseBtnActive]}
                onPress={() => setHasLicense(true)}
                activeOpacity={0.8}
              >
                <Text style={[s.licenseBtnText, hasLicense && s.licenseBtnTextActive]}>已有駕照</Text>
              </TouchableOpacity>
            </View>

            <View style={s.hintRow}>
              <Ionicons name="checkmark-circle-outline" size={14} color={APP_ORANGE} />
              <Text style={s.hintText}>選擇您想考取的駕照類別</Text>
            </View>

            {isLoading ? (
              <ActivityIndicator color={APP_ORANGE} style={{ marginTop: 40 }} />
            ) : !categories || (categories as any[]).length === 0 ? (
              <View style={s.empty}><Text style={s.emptyText}>暫無駕照類別數據</Text></View>
            ) : (
              <View style={s.catList}>
                {(categories as any[]).map((cat: any) => {
                  const isExpanded = expandedCatId === cat.id;
                  const subCount = cat.subCategories?.length ?? 0;
                  const letter = cat.name?.match(/^([A-E])/)?.[1] || cat.name?.[0] || '?';
                  return (
                    <View key={cat.id} style={s.catCard}>
                      <TouchableOpacity style={s.catHeader} onPress={() => toggleCat(cat.id)} activeOpacity={0.7}>
                        <View style={s.catLetterBadge}>
                          <Text style={s.catLetterText}>{letter}</Text>
                        </View>
                        <View style={s.catInfo}>
                          <Text style={s.catName}>{cat.name}駕照</Text>
                          {!!cat.description && <Text style={s.catDesc} numberOfLines={1}>{cat.description}</Text>}
                        </View>
                        <View style={s.catRight}>
                          <Text style={s.catCount}>{subCount} 個課程</Text>
                          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={APP_GRAY} />
                        </View>
                      </TouchableOpacity>
                      {isExpanded && subCount > 0 && (
                        <View style={s.subList}>
                          {cat.subCategories.map((sub: any, idx: number) => (
                            <TouchableOpacity
                              key={sub.id}
                              style={[s.subItem, idx === cat.subCategories.length - 1 && s.subItemLast]}
                              onPress={() => router.push(`/driving/enroll?subCategoryId=${sub.id}&hasLicense=${hasLicense}&subName=${encodeURIComponent(sub.name)}&catName=${encodeURIComponent(cat.name)}` as any)}
                              activeOpacity={0.7}
                            >
                              <View style={s.subDot} />
                              <Text style={s.subName} numberOfLines={1}>{sub.name}</Text>
                              <Text style={s.subFeeHint}>查看費用</Text>
                              <Ionicons name="chevron-forward" size={14} color={APP_GRAY} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            <View style={s.flowCard}>
              <View style={s.flowHeader}>
                <Text style={s.flowIcon}>📋</Text>
                <Text style={s.flowTitle}>澳門考車流程</Text>
              </View>
              {MACAU_STEPS.map((step, i) => (
                <View key={i} style={s.flowStep}>
                  <View style={s.flowStepNum}><Text style={s.flowStepNumText}>{i + 1}</Text></View>
                  <Text style={s.flowStepText}>{step}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: { backgroundColor: APP_ORANGE, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  regionBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: APP_BORDER },
  regionTab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  regionTabActive: { borderBottomColor: APP_ORANGE },
  regionTabText: { fontSize: 14, color: APP_GRAY, fontWeight: '500' },
  regionTabTextActive: { color: APP_ORANGE, fontWeight: '600' },
  scroll: { paddingBottom: 32 },
  licenseToggle: { flexDirection: 'row', margin: 16, backgroundColor: '#F3F4F6', borderRadius: 10, padding: 3 },
  licenseBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  licenseBtnActive: { backgroundColor: APP_ORANGE, shadowColor: APP_ORANGE, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  licenseBtnText: { fontSize: 14, fontWeight: '500', color: APP_GRAY },
  licenseBtnTextActive: { color: '#fff', fontWeight: '600' },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, marginBottom: 12 },
  hintText: { fontSize: 13, color: APP_GRAY },
  catList: { paddingHorizontal: 16, gap: 10 },
  catCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: APP_BORDER },
  catHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  catLetterBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: APP_ORANGE, alignItems: 'center', justifyContent: 'center' },
  catLetterText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  catInfo: { flex: 1 },
  catName: { fontSize: 15, fontWeight: '600', color: APP_TEXT },
  catDesc: { fontSize: 12, color: APP_GRAY, marginTop: 2 },
  catRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catCount: { fontSize: 12, color: APP_GRAY },
  subList: { borderTopWidth: 1, borderTopColor: APP_BORDER },
  subItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: APP_BORDER },
  subItemLast: { borderBottomWidth: 0 },
  subDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: APP_ORANGE },
  subName: { flex: 1, fontSize: 14, color: APP_TEXT },
  subFeeHint: { fontSize: 12, color: APP_ORANGE },
  flowCard: { margin: 16, backgroundColor: '#FFF7ED', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#FED7AA' },
  flowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  flowIcon: { fontSize: 16 },
  flowTitle: { fontSize: 15, fontWeight: '700', color: APP_ORANGE },
  flowStep: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  flowStepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: APP_ORANGE, alignItems: 'center', justifyContent: 'center' },
  flowStepNumText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  flowStepText: { fontSize: 13, color: APP_TEXT, flex: 1 },
  comingSoon: { alignItems: 'center', paddingTop: 80 },
  comingSoonIcon: { fontSize: 48, marginBottom: 16 },
  comingSoonTitle: { fontSize: 18, fontWeight: '600', color: APP_TEXT },
  comingSoonSub: { fontSize: 14, color: APP_GRAY, marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: APP_GRAY },
});
