/**
 * 設置頁 — 對齊 WebApp AppSettings
 * 包含：個人資料 / 修改手機 / 通知設置 / 隱私設置 / 關於 GoGoCar / 登出
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Switch, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

function SettingRow({
  icon, iconBg, label, value, onPress, rightEl, showArrow = true,
}: {
  icon: string; iconBg: string; label: string; value?: string;
  onPress?: () => void; rightEl?: React.ReactNode; showArrow?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !rightEl}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={18} color="#fff" />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue} numberOfLines={1}>{value}</Text> : null}
        {rightEl}
        {showArrow && onPress && <Ionicons name="chevron-forward" size={16} color="#d1d5db" style={{ marginLeft: 4 }} />}
      </View>
    </TouchableOpacity>
  );
}

export default function EditScreen() {
  const router = useRouter();
  const { data: user, refetch } = trpc.auth.me.useQuery();
  const logoutMut = trpc.auth.logout.useMutation({
    onSuccess: () => { refetch(); router.replace('/'); },
  });
  const [notifyMsg, setNotifyMsg] = useState(true);
  const [notifyPrice, setNotifyPrice] = useState(true);
  const [notifySystem, setNotifySystem] = useState(true);

  const handleLogout = () => {
    Alert.alert('確認登出', '確定要登出帳號嗎？', [
      { text: '取消', style: 'cancel' },
      { text: '登出', style: 'destructive', onPress: () => logoutMut.mutate() },
    ]);
  };

  const maskedPhone = (user as any)?.phone
    ? (user as any).phone.replace(/(\+\d{3})(\d+)(\d{4})/, '$1****$3')
    : '未設置';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>設置</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 個人資料 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>個人資料</Text>
          {/* 頭像行 */}
          <TouchableOpacity style={styles.avatarRow} onPress={() => router.push('/profile/edit-profile')} activeOpacity={0.7}>
            <View style={[styles.rowIcon, { backgroundColor: '#F97316' }]}>
              <Ionicons name="person" size={18} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>頭像與暱稱</Text>
            <View style={styles.rowRight}>
              {(user as any)?.avatar ? (
                <Image source={{ uri: (user as any).avatar }} style={styles.miniAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.miniAvatar, { backgroundColor: `${APP_ORANGE}20`, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ fontSize: 14, color: APP_ORANGE, fontWeight: '700' }}>
                    {((user as any)?.nickname || (user as any)?.name || '?').charAt(0)}
                  </Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color="#d1d5db" style={{ marginLeft: 8 }} />
            </View>
          </TouchableOpacity>
          <SettingRow
            icon="call" iconBg="#3B82F6" label="手機號碼"
            value={maskedPhone}
            onPress={() => router.push('/profile/change-phone')}
          />
        </View>

        {/* 通知設置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>通知設置</Text>
          <SettingRow
            icon="chatbubble" iconBg="#8B5CF6" label="消息通知"
            showArrow={false}
            rightEl={<Switch value={notifyMsg} onValueChange={setNotifyMsg} trackColor={{ true: APP_ORANGE }} thumbColor="#fff" />}
          />
          <SettingRow
            icon="pricetag" iconBg="#EC4899" label="降價提醒"
            showArrow={false}
            rightEl={<Switch value={notifyPrice} onValueChange={setNotifyPrice} trackColor={{ true: APP_ORANGE }} thumbColor="#fff" />}
          />
          <SettingRow
            icon="notifications" iconBg="#6366F1" label="系統通知"
            showArrow={false}
            rightEl={<Switch value={notifySystem} onValueChange={setNotifySystem} trackColor={{ true: APP_ORANGE }} thumbColor="#fff" />}
          />
        </View>

        {/* 隱私設置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>隱私設置</Text>
          <SettingRow
            icon="eye-off" iconBg="#64748B" label="隱私政策"
            onPress={() => Linking.openURL('https://gogocar853.manus.space/privacy')}
          />
          <SettingRow
            icon="document-text" iconBg="#475569" label="用戶協議"
            onPress={() => Linking.openURL('https://gogocar853.manus.space/terms')}
          />
        </View>

        {/* 關於 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>關於</Text>
          <SettingRow
            icon="information-circle" iconBg="#0EA5E9" label="關於 GoGoCar"
            onPress={() => router.push('/profile/about')}
          />
          <SettingRow
            icon="call" iconBg="#10B981" label="聯繫客服"
            onPress={() => Linking.openURL('tel:+85366563101')}
          />
          <SettingRow
            icon="star" iconBg="#F59E0B" label="給我們評分"
            onPress={() => Alert.alert('感謝支持', '請在應用商店給我們五星好評！')}
          />
        </View>

        {/* 登出 */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={styles.logoutText}>退出登入</Text>
          </TouchableOpacity>
        </View>
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
  section: { marginTop: 16, backgroundColor: '#fff', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: APP_BORDER },
  sectionTitle: { fontSize: 12, color: APP_GRAY, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontWeight: '500' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 0.5, borderTopColor: APP_BORDER,
  },
  avatarRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 0.5, borderTopColor: APP_BORDER,
  },
  rowIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  rowLabel: { flex: 1, fontSize: 15, color: APP_TEXT },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowValue: { fontSize: 14, color: APP_GRAY, maxWidth: 140 },
  miniAvatar: { width: 28, height: 28, borderRadius: 14 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, marginHorizontal: 16, marginVertical: 12,
    borderRadius: 12, backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FECACA',
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
});
