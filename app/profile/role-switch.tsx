/**
 * 切換身份頁 — 申請制（大廠標準）
 * - 個人車主：直接切換
 * - 車商：需申請（填車行名稱/牌照/聯絡人），已解鎖才能切換
 * - 駕校校長：領取制（從 DSAT 認可學校列表選擇，填聯繫人提交），已解鎖才能切換
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  ScrollView, TextInput, Modal, KeyboardAvoidingView, Platform,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

const ROLE_CONFIG = {
  personal: { label: '個人車主', subtitle: '買賣二手車、管理個人車源', icon: 'person' as const, color: APP_ORANGE, bg: '#FFF7ED', features: ['發佈個人車源', '瀏覽買賣車源', '使用 iPoint 積分', '考車報名'] },
  dealer:   { label: '車商',     subtitle: '專業車行、車源批量管理',   icon: 'business' as const, color: '#2563EB', bg: '#EFF6FF', features: ['批量管理車源', '車商會員特權', '精選推廣功能', '專業車行主頁'] },
  school:   { label: '駕校校長', subtitle: '管理駕校、招收學員',       icon: 'school' as const,   color: '#059669', bg: '#F0FDF4', features: ['管理駕校信息', '招收考車學員', '課程管理', '學員進度追蹤'] },
};
type RoleKey = keyof typeof ROLE_CONFIG;

export default function RoleSwitchScreen() {
  const router = useRouter();
  const { data: user, refetch } = trpc.auth.me.useQuery(undefined, { staleTime: 0, refetchOnMount: 'always' });
  const { data: myApps, refetch: refetchApps } = trpc.identity.myApplications.useQuery(undefined, { staleTime: 0, refetchOnMount: 'always' });
  // 駕校領取制
  const { data: schoolList = [] } = trpc.driving.listSchoolsForClaim.useQuery(undefined, { staleTime: 60000 });
  const { data: myClaimedSchool, refetch: refetchClaimedSchool } = trpc.driving.myClaimedSchool.useQuery(undefined, { staleTime: 0, refetchOnMount: 'always' });
  const [schoolSearchText, setSchoolSearchText] = useState('');
  const [selectedSchool, setSelectedSchool] = useState<any>(null);
  const [claimStep, setClaimStep] = useState<'list' | 'form'>('list');
  const [claimForm, setClaimForm] = useState({ contactName: '', contactPhone: '', contactTitle: '' });

  const [applyModal, setApplyModal] = useState<'dealer' | 'school' | null>(null);
  const [dealerForm, setDealerForm] = useState({ dealerName: '', businessLicense: '', contactName: '', contactPhone: '', address: '' });
  const [submitting, setSubmitting] = useState(false);

  const setRoleTypeMut = trpc.phoneAuth.setRoleType.useMutation({
    onSuccess: () => { refetch(); router.back(); },
    onError: (e: any) => Alert.alert('切換失敗', e.message),
  });

  const applyMut = trpc.identity.applyIdentity.useMutation({
    onSuccess: () => {
      setSubmitting(false); setApplyModal(null); refetchApps();
      Alert.alert('申請已提交', '我們將在 1-3 個工作日內審核您的申請，審核結果將通過消息通知您。');
    },
    onError: (e: any) => { setSubmitting(false); Alert.alert('申請失敗', e.message); },
  });

  const claimMut = trpc.driving.claimSchool.useMutation({
    onSuccess: () => {
      setSubmitting(false); setApplyModal(null); refetchClaimedSchool();
      Alert.alert('申請已提交', '我們將在 1-3 個工作日內審核您的申請，審核結果將通過消息通知您。');
    },
    onError: (e: any) => { setSubmitting(false); Alert.alert('申請失敗', e.message); },
  });

  const currentRole = (user as any)?.roleType || 'personal';
  const unlockedRoles: string[] = (user as any)?.unlockedRoles || ['personal'];

  const getAppStatus = (role: 'dealer' | 'school') => {
    if (!myApps) return null;
    const apps = (myApps as any[]).filter((a: any) => a.targetRole === role);
    if (apps.length === 0) return null;
    return apps.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  };

  const handleSwitch = (roleKey: RoleKey) => {
    if (roleKey === currentRole) return;
    if (roleKey === 'personal' || unlockedRoles.includes(roleKey)) {
      Alert.alert(`切換為${ROLE_CONFIG[roleKey].label}`, `確定切換為「${ROLE_CONFIG[roleKey].label}」身份？`, [
        { text: '取消', style: 'cancel' },
        { text: '確認切換', onPress: () => setRoleTypeMut.mutate({ roleType: roleKey as any }) },
      ]);
    }
  };

  const submitDealerApply = () => {
    if (!dealerForm.dealerName.trim()) { Alert.alert('提示', '請填寫車行名稱'); return; }
    if (!dealerForm.contactName.trim()) { Alert.alert('提示', '請填寫聯絡人姓名'); return; }
    if (!dealerForm.contactPhone.trim()) { Alert.alert('提示', '請填寫聯絡電話'); return; }
    if (!dealerForm.address.trim()) { Alert.alert('提示', '請填寫車行地址'); return; }
    setSubmitting(true);
    applyMut.mutate({ targetRole: 'dealer', dealerName: dealerForm.dealerName.trim(), businessLicense: dealerForm.businessLicense.trim() || undefined, contactName: dealerForm.contactName.trim(), contactPhone: dealerForm.contactPhone.trim(), address: dealerForm.address.trim() });
  };

  const submitClaimApply = () => {
    if (!selectedSchool) { Alert.alert('提示', '請選擇學校'); return; }
    if (!claimForm.contactName.trim()) { Alert.alert('提示', '請填寫聯繫人姓名'); return; }
    if (!claimForm.contactPhone.trim()) { Alert.alert('提示', '請填寫聯繫電話'); return; }
    if (!claimForm.contactTitle.trim()) { Alert.alert('提示', '請填寫職稱（如：校長/負責人）'); return; }
    setSubmitting(true);
    claimMut.mutate({ schoolId: selectedSchool.id, contactName: claimForm.contactName.trim(), contactPhone: claimForm.contactPhone.trim(), contactTitle: claimForm.contactTitle.trim() });
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>切換身份</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.hint}>選擇您的身份，享受對應功能與服務</Text>

        {(['personal', 'dealer', 'school'] as RoleKey[]).map((roleKey) => {
          const cfg = ROLE_CONFIG[roleKey];
          const isActive = currentRole === roleKey;
          const isUnlocked = unlockedRoles.includes(roleKey);
          const appStatus = roleKey !== 'personal' ? getAppStatus(roleKey as 'dealer' | 'school') : null;
          const isPending = appStatus?.status === 'pending';
          const isRejected = appStatus?.status === 'rejected';

          return (
            <View key={roleKey} style={[s.card, isActive && { borderColor: cfg.color, borderWidth: 2 }]}>
              <View style={s.cardTop}>
                <View style={[s.iconWrap, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={22} color={cfg.color} />
                </View>
                <View style={s.cardInfo}>
                  <Text style={s.cardLabel}>{cfg.label}</Text>
                  <Text style={s.cardSubtitle}>{cfg.subtitle}</Text>
                </View>
                {isActive ? (
                  <View style={[s.actionBtn, { backgroundColor: cfg.color }]}><Text style={s.btnTextWhite}>當前身份</Text></View>
                ) : isUnlocked ? (
                  <TouchableOpacity style={[s.actionBtn, s.actionBtnOutline, { borderColor: cfg.color }]} onPress={() => handleSwitch(roleKey)} activeOpacity={0.7}>
                    <Text style={[s.btnTextOutline, { color: cfg.color }]}>切換</Text>
                  </TouchableOpacity>
                ) : isPending ? (
                  <View style={[s.actionBtn, { backgroundColor: '#F59E0B' }]}><Text style={s.btnTextWhite}>審核中</Text></View>
                ) : roleKey !== 'personal' ? (
                  <TouchableOpacity style={[s.actionBtn, s.actionBtnOutline, { borderColor: cfg.color }]} onPress={() => { setApplyModal(roleKey as 'dealer' | 'school'); }} activeOpacity={0.7}>
                    <Text style={[s.btnTextOutline, { color: cfg.color }]}>申請開通</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {isPending && (
                <View style={s.statusBar}>
                  <Ionicons name="time-outline" size={13} color="#D97706" />
                  <Text style={s.statusBarText}>申請審核中，預計 1-3 個工作日內完成</Text>
                </View>
              )}
              {isRejected && (
                <View style={[s.statusBar, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                  <Ionicons name="close-circle-outline" size={13} color="#DC2626" />
                  <Text style={[s.statusBarText, { color: '#DC2626', flex: 1 }]}>申請被拒絕：{appStatus.rejectReason || '資料不符合要求'}</Text>
                  <TouchableOpacity onPress={() => setApplyModal(roleKey as 'dealer' | 'school')} style={s.reApplyBtn}>
                    <Text style={s.reApplyBtnText}>重新申請</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={s.featureList}>
                {cfg.features.map((f, i) => (
                  <View key={i} style={s.featureItem}>
                    <Ionicons name="checkmark-circle" size={14} color={isUnlocked || isActive ? cfg.color : APP_GRAY} />
                    <Text style={[s.featureText, !isUnlocked && !isActive && { color: APP_GRAY }]}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        <Text style={s.footerNote}>身份認證後可隨時在此切換，不影響個人車主功能</Text>
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* 車商申請 Modal */}
      <Modal visible={applyModal === 'dealer'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setApplyModal(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setApplyModal(null)} style={s.backBtn}><Ionicons name="close" size={22} color={APP_TEXT} /></TouchableOpacity>
              <Text style={s.headerTitle}>申請車商認證</Text>
              <View style={{ width: 40 }} />
            </View>
            <Text style={s.modalSub}>填寫車行資料，提交後 1-3 個工作日內審核</Text>
            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              <FF label="車行名稱" required value={dealerForm.dealerName} onChange={(v) => setDealerForm(f => ({ ...f, dealerName: v }))} placeholder="請輸入車行名稱" />
              <FF label="澳門營業牌照號碼" value={dealerForm.businessLicense} onChange={(v) => setDealerForm(f => ({ ...f, businessLicense: v }))} placeholder="選填，如有請填寫" />
              <FF label="車行地址" required value={dealerForm.address} onChange={(v) => setDealerForm(f => ({ ...f, address: v }))} placeholder="請輸入車行地址" />
              <FF label="聯絡人姓名" required value={dealerForm.contactName} onChange={(v) => setDealerForm(f => ({ ...f, contactName: v }))} placeholder="請輸入聯絡人姓名" />
              <FF label="聯絡電話" required value={dealerForm.contactPhone} onChange={(v) => setDealerForm(f => ({ ...f, contactPhone: v }))} placeholder="請輸入聯絡電話" kbType="phone-pad" />
              <View style={{ height: 24 }} />
            </ScrollView>
            <View style={s.modalFooter}>
              <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.5 }]} onPress={submitDealerApply} disabled={submitting} activeOpacity={0.8}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.submitBtnText}>提交申請</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 駕校申請 Modal */}
      <Modal visible={applyModal === 'school'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setApplyModal(null); setClaimStep('list'); setSelectedSchool(null); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => { if (claimStep === 'form') { setClaimStep('list'); } else { setApplyModal(null); } }} style={s.backBtn}>
                <Ionicons name={claimStep === 'form' ? 'chevron-back' : 'close'} size={22} color={APP_TEXT} />
              </TouchableOpacity>
              <Text style={s.headerTitle}>{claimStep === 'list' ? '選擇駕校' : '填寫聯繫資料'}</Text>
              <View style={{ width: 40 }} />
            </View>

            {claimStep === 'list' && (
              <>
                <Text style={s.modalSub}>從 DSAT 認可的 {schoolList.length} 間駕校中選擇您所屬的學校</Text>
                <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                  <TextInput
                    style={[s.ffInput, { marginBottom: 0 }]}
                    value={schoolSearchText}
                    onChangeText={setSchoolSearchText}
                    placeholder="搜索學校名稱..."
                    placeholderTextColor={APP_GRAY}
                  />
                </View>
                <FlatList
                  data={(schoolList as any[]).filter((s: any) =>
                    !schoolSearchText || s.name.includes(schoolSearchText)
                  )}
                  keyExtractor={(item: any) => String(item.id)}
                  renderItem={({ item }: { item: any }) => {
                    const isClaimed = item.claimStatus === 'claimed';
                    const isPending = item.claimStatus === 'pending';
                    return (
                      <TouchableOpacity
                        style={[sc.schoolItem, isClaimed && { opacity: 0.5 }]}
                        onPress={() => {
                          if (isClaimed) { Alert.alert('提示', '該學校已被領取'); return; }
                          if (isPending) { Alert.alert('提示', '該學校有待審核的申請'); return; }
                          setSelectedSchool(item);
                          setClaimStep('form');
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={sc.schoolName}>{item.name}</Text>
                          {item.motorcycleCapacities && (
                            <Text style={sc.schoolSub}>可教排量：{item.motorcycleCapacities}cc</Text>
                          )}
                        </View>
                        {isClaimed && <Text style={sc.claimedBadge}>已領取</Text>}
                        {isPending && <Text style={sc.pendingBadge}>申請中</Text>}
                        {!isClaimed && !isPending && <Ionicons name="chevron-forward" size={16} color={APP_GRAY} />}
                      </TouchableOpacity>
                    );
                  }}
                  ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: APP_BORDER, marginHorizontal: 16 }} />}
                />
              </>
            )}

            {claimStep === 'form' && (
              <>
                <View style={sc.selectedSchoolBar}>
                  <Ionicons name="school" size={16} color="#059669" />
                  <Text style={sc.selectedSchoolText} numberOfLines={1}>{selectedSchool?.name}</Text>
                </View>
                <Text style={s.modalSub}>填寫您的聯繫資料，提交後 1-3 個工作日內審核</Text>
                <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
                  <FF label="聯繫人姓名" required value={claimForm.contactName} onChange={(v) => setClaimForm(f => ({ ...f, contactName: v }))} placeholder="請輸入姓名" />
                  <FF label="聯繫電話" required value={claimForm.contactPhone} onChange={(v) => setClaimForm(f => ({ ...f, contactPhone: v }))} placeholder="請輸入電話" kbType="phone-pad" />
                  <FF label="職稱" required value={claimForm.contactTitle} onChange={(v) => setClaimForm(f => ({ ...f, contactTitle: v }))} placeholder="如：校長、負責人、管理員" />
                  <View style={{ height: 24 }} />
                </ScrollView>
              </>
            )}

            <View style={s.modalFooter}>
              <TouchableOpacity
                style={[s.submitBtn, (submitting || claimStep === 'list') && { opacity: claimStep === 'list' ? 0.3 : 0.5 }]}
                onPress={submitClaimApply}
                disabled={submitting || claimStep === 'list'}
                activeOpacity={0.8}
              >
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.submitBtnText}>提交領取申請</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FF({ label, required, value, onChange, placeholder, kbType }: { label: string; required?: boolean; value: string; onChange: (v: string) => void; placeholder: string; kbType?: any }) {
  return (
    <View style={s.ff}>
      <Text style={s.ffLabel}>{label}{required && <Text style={{ color: '#EF4444' }}> *</Text>}</Text>
      <TextInput style={s.ffInput} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={APP_GRAY} keyboardType={kbType || 'default'} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: APP_BORDER },
  backBtn: { width: 40, padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: APP_TEXT, textAlign: 'center' },
  scroll: { padding: 16, gap: 12 },
  hint: { fontSize: 13, color: APP_GRAY, textAlign: 'center', marginBottom: 4 },
  footerNote: { fontSize: 12, color: APP_GRAY, textAlign: 'center', marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: APP_BORDER },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardLabel: { fontSize: 16, fontWeight: '700', color: APP_TEXT },
  cardSubtitle: { fontSize: 12, color: APP_GRAY, marginTop: 2 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  actionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5 },
  btnTextWhite: { fontSize: 13, fontWeight: '600', color: '#fff' },
  btnTextOutline: { fontSize: 13, fontWeight: '600' },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFBEB', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#FDE68A', marginBottom: 10 },
  statusBarText: { fontSize: 12, color: '#D97706' },
  reApplyBtn: { paddingHorizontal: 8 },
  reApplyBtnText: { fontSize: 12, color: '#DC2626', fontWeight: '600' },
  featureList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '47%' },
  featureText: { fontSize: 12, color: APP_TEXT },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: 20, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: APP_BORDER },
  modalSub: { fontSize: 13, color: APP_GRAY, textAlign: 'center', paddingHorizontal: 24, paddingVertical: 12 },
  modalBody: { flex: 1, paddingHorizontal: 16 },
  modalFooter: { padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: APP_BORDER },
  ff: { marginBottom: 16 },
  ffLabel: { fontSize: 14, fontWeight: '500', color: APP_TEXT, marginBottom: 8 },
  ffInput: { borderWidth: 1, borderColor: APP_BORDER, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: APP_TEXT, backgroundColor: APP_BG },
  submitBtn: { height: 52, borderRadius: 12, backgroundColor: APP_ORANGE, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

const sc = StyleSheet.create({
  schoolItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff' },
  schoolName: { fontSize: 15, fontWeight: '500', color: APP_TEXT },
  schoolSub: { fontSize: 12, color: APP_GRAY, marginTop: 2 },
  claimedBadge: { fontSize: 11, color: '#059669', backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  pendingBadge: { fontSize: 11, color: '#D97706', backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  selectedSchoolBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', marginHorizontal: 16, marginTop: 8, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0' },
  selectedSchoolText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#059669' },
});
