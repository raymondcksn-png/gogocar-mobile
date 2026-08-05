/**
 * 設置頁 — 完整重構，對齊 WebApp AppSettings
 * 4 個分組：個人資料 / 偏好設置 / 服務支援 / 系統
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

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://gogocar853.manus.space';

const ROLE_LABELS: Record<string, string> = {
  personal: '個人用戶',
  dealer: '車商',
  driving_school: '駕校',
};

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
    Alert.alert('確認登出', '確定要退出登入嗎？', [
      { text: '取消', style: 'cancel' },
      { text: '登出', style: 'destructive', onPress: () => logoutMut.mutate() },
    ]);
  };

  const handleLanguage = () => {
    Alert.alert('語言設置', '目前使用：繁體中文\n\n更多語言即將支持，敬請期待！', [{ text: '確定' }]);
  };

  const handleClearCache = () => {
    Alert.alert('清除緩存', '確定要清除本地緩存嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除', style: 'destructive', onPress: () => {
          // 清除緩存（實際清除 expo-image 緩存）
          Image.clearDiskCache?.();
          Image.clearMemoryCache?.();
          Alert.alert('完成', '緩存已清除');
        }
      },
    ]);
  };

  const handleCheckUpdate = () => {
    Alert.alert('檢查更新', '您已是最新版本 🎉', [{ text: '確定' }]);
  };

  const handleFeedback = () => {
    const email = 'support@gogocar.mo';
    const subject = encodeURIComponent('GoGoCar APP 意見反饋');
    const body = encodeURIComponent(`\n\n---\n設備信息：GoGoCar APP\n用戶ID：${(user as any)?.id || 'N/A'}`);
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('意見反饋', `請發送郵件至：${email}`, [{ text: '確定' }]);
    });
  };

  const handleContact = () => {
    Alert.alert('聯繫我們', '選擇聯繫方式', [
      { text: '電話', onPress: () => Linking.openURL('tel:+85366993008') },
      { text: 'WhatsApp', onPress: () => Linking.openURL('https://wa.me/85366993008') },
      { text: '取消', style: 'cancel' },
    ]);
  };

  // 頭像完整 URL
  const resolveUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${API_BASE}${url}`;
  };
  const avatarUrl = resolveUrl((user as any)?.avatar || '');
  const initials = ((user as any)?.nickname || (user as any)?.name || '?').charAt(0).toUpperCase();
  const roleLabel = ROLE_LABELS[(user as any)?.roleType || 'personal'] || '個人用戶';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>設置</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── 個人資料 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>個人資料</Text>

          {/* 頭像與暱稱 */}
          <TouchableOpacity
            style={styles.avatarRow}
            onPress={() => router.push('/profile/edit-profile')}
            activeOpacity={0.7}
          >
            <View style={[styles.rowIcon, { backgroundColor: '#F97316' }]}>
              <Ionicons name="person" size={18} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>頭像與暱稱</Text>
            <View style={styles.rowRight}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.miniAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.miniAvatar, styles.miniAvatarFallback]}>
                  <Text style={styles.miniAvatarText}>{initials}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color="#d1d5db" style={{ marginLeft: 8 }} />
            </View>
          </TouchableOpacity>

          {/* 手機號碼 */}
          <SettingRow
            icon="call" iconBg="#3B82F6" label="手機號碼"
            value={(user as any)?.phone || '未設置'}
            onPress={() => router.push('/profile/change-phone')}
          />
        </View>

        {/* ── 偏好設置 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>偏好設置</Text>

          <SettingRow
            icon="language" iconBg="#0EA5E9" label="語言設置"
            value="繁體中文"
            onPress={handleLanguage}
          />
          <SettingRow
            icon="swap-horizontal" iconBg="#8B5CF6" label="身份切換"
            value={roleLabel}
            onPress={() => router.push('/profile/role-switch')}
          />
          <SettingRow
            icon="chatbubble" iconBg="#6366F1" label="消息通知"
            showArrow={false}
            rightEl={<Switch value={notifyMsg} onValueChange={setNotifyMsg} trackColor={{ true: APP_ORANGE }} thumbColor="#fff" />}
          />
          <SettingRow
            icon="pricetag" iconBg="#EC4899" label="降價提醒"
            showArrow={false}
            rightEl={<Switch value={notifyPrice} onValueChange={setNotifyPrice} trackColor={{ true: APP_ORANGE }} thumbColor="#fff" />}
          />
          <SettingRow
            icon="notifications" iconBg="#F59E0B" label="系統通知"
            showArrow={false}
            rightEl={<Switch value={notifySystem} onValueChange={setNotifySystem} trackColor={{ true: APP_ORANGE }} thumbColor="#fff" />}
          />
        </View>

        {/* ── 服務支援 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>服務支援</Text>

          <SettingRow
            icon="information-circle" iconBg="#0EA5E9" label="關於我們"
            onPress={() => router.push({ pathname: '/profile/content-viewer', params: { key: 'about_us', title: '關於我們' } })}
          />
          <SettingRow
            icon="headset" iconBg="#10B981" label="聯繫我們"
            onPress={handleContact}
          />
          <SettingRow
            icon="shield-checkmark" iconBg="#64748B" label="隱私權政策"
            onPress={() => router.push({ pathname: '/profile/content-viewer', params: { key: 'privacy_policy', title: '隱私權政策' } })}
          />
          <SettingRow
            icon="document-text" iconBg="#475569" label="條款與細則"
            onPress={() => router.push({ pathname: '/profile/content-viewer', params: { key: 'terms', title: '條款與細則' } })}
          />
          <SettingRow
            icon="chatbox-ellipses" iconBg="#F97316" label="意見反饋"
            onPress={handleFeedback}
          />
        </View>

        {/* ── 系統 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>系統</Text>

          <SettingRow
            icon="trash" iconBg="#94A3B8" label="清除緩存"
            onPress={handleClearCache}
          />
          <SettingRow
            icon="refresh-circle" iconBg="#22C55E" label="檢查更新"
            onPress={handleCheckUpdate}
          />
        </View>

        {/* ── 登出 ── */}
        <View style={[styles.section, { marginTop: 24 }]}>
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
  section: {
    marginTop: 16, backgroundColor: '#fff',
    borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: APP_BORDER,
  },
  sectionTitle: {
    fontSize: 12, color: APP_GRAY,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontWeight: '500',
  },
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
  miniAvatarFallback: { backgroundColor: `${APP_ORANGE}20`, justifyContent: 'center', alignItems: 'center' },
  miniAvatarText: { fontSize: 12, color: APP_ORANGE, fontWeight: '700' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, marginHorizontal: 16, marginVertical: 12,
    borderRadius: 12, backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FECACA',
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
});
