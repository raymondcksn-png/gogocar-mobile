/**
 * 切換身份頁 — 對齊 WebApp AppRoleSwitch
 * 功能：個人車主 / 車商 / 駕校校長 三種身份切換
 */
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { trpc } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

const ROLES = [
  {
    key: 'personal',
    label: '個人車主',
    subtitle: '買賣二手車、管理個人車源',
    icon: 'person',
    colors: ['#F97316', '#EA580C'] as [string, string],
    features: ['發佈個人車源', '瀏覽買賣車源', '使用 iPoint 積分', '考車報名'],
  },
  {
    key: 'dealer',
    label: '車商',
    subtitle: '專業車行、車源批量管理',
    icon: 'business',
    colors: ['#3B82F6', '#2563EB'] as [string, string],
    features: ['批量管理車源', '車商會員特權', '精選推廣功能', '專業車行主頁'],
  },
  {
    key: 'school',
    label: '駕校校長',
    subtitle: '管理駕校、招收學員',
    icon: 'school',
    colors: ['#10B981', '#059669'] as [string, string],
    features: ['管理駕校信息', '招收考車學員', '課程管理', '學員進度追蹤'],
  },
];

export default function RoleSwitchScreen() {
  const router = useRouter();
  const { data: user, refetch } = trpc.auth.me.useQuery();
  const setRoleTypeMut = trpc.phoneAuth.setRoleType.useMutation({
    onSuccess: () => { refetch(); Alert.alert('切換成功', '身份已切換'); router.back(); },
    onError: (e: any) => Alert.alert('切換失敗', e.message),
  });

  const currentRole = (user as any)?.roleType || 'personal';

  const handleSwitch = (roleKey: string) => {
    if (roleKey === currentRole) { Alert.alert('提示', '您已是該身份'); return; }
    Alert.alert(
      '確認切換',
      `確定要切換為「${ROLES.find(r => r.key === roleKey)?.label}」身份嗎？`,
      [
        { text: '取消', style: 'cancel' },
        { text: '確認切換', onPress: () => setRoleTypeMut.mutate({ roleType: roleKey as any }) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>切換身份</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={styles.hint}>選擇您的身份，享受對應功能與服務</Text>

        {ROLES.map((role) => {
          const isActive = currentRole === role.key;
          return (
            <TouchableOpacity
              key={role.key}
              style={[styles.card, isActive && styles.cardActive]}
              onPress={() => handleSwitch(role.key)}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <LinearGradient colors={role.colors} style={styles.iconWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Ionicons name={role.icon as any} size={24} color="#fff" />
                </LinearGradient>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardLabel}>{role.label}</Text>
                  <Text style={styles.cardSubtitle}>{role.subtitle}</Text>
                </View>
                {isActive ? (
                  <View style={[styles.badge, { backgroundColor: role.colors[0] }]}>
                    <Text style={styles.badgeText}>當前身份</Text>
                  </View>
                ) : (
                  setRoleTypeMut.isPending ? (
                    <ActivityIndicator size="small" color={role.colors[0]} />
                  ) : (
                    <View style={[styles.switchBtn, { borderColor: role.colors[0] }]}>
                      <Text style={[styles.switchBtnText, { color: role.colors[0] }]}>切換</Text>
                    </View>
                  )
                )}
              </View>
              <View style={styles.features}>
                {role.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={14} color={role.colors[0]} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 8,
    borderBottomWidth: 0.5, borderBottomColor: APP_BORDER,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: APP_TEXT },
  hint: { fontSize: 13, color: APP_GRAY, textAlign: 'center', marginBottom: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1.5, borderColor: APP_BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardActive: { borderColor: APP_ORANGE, backgroundColor: '#FFFBF5' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  cardInfo: { flex: 1 },
  cardLabel: { fontSize: 16, fontWeight: '700', color: APP_TEXT },
  cardSubtitle: { fontSize: 12, color: APP_GRAY, marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  switchBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5 },
  switchBtnText: { fontSize: 13, fontWeight: '600' },
  features: { gap: 6, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#f3f4f6' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { fontSize: 13, color: APP_GRAY },
});
