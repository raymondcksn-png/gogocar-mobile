/**
 * 個人中心頁 — 登入態/訪客態 + 登出（修復 bug）
 * 登出必須清除 SecureStore token，不能只調用後端 API
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

// ── 菜單項組件 ────────────────────────────────────────────────────────────────
function MenuItem({
  icon, label, onPress, danger, badge,
}: {
  icon: string; label: string; onPress: () => void; danger?: boolean; badge?: string;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      {badge && <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>}
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const { isLoggedIn, user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  // 嘗試調用後端 logout（可選，失敗不影響本地登出）
  const logoutMutation = trpc.auth.logout.useMutation();

  /**
   * 登出處理 — 修復版
   * 1. 先清除本地 SecureStore token（最重要）
   * 2. 嘗試通知後端（可選，失敗不影響）
   * 3. 重置 React state
   */
  const handleLogout = () => {
    Alert.alert(
      '確認登出',
      '確定要登出嗎？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '登出',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              // 先清除本地 token（最關鍵步驟）
              await logout();
              // 嘗試通知後端（可選）
              logoutMutation.mutate().catch(() => {});
            } catch (err) {
              console.warn('[Profile] Logout error:', err);
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  // ── 訪客態 ─────────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>我的</Text>
        </View>
        <ScrollView>
          {/* 訪客頭像區 */}
          <View style={styles.guestHero}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>👤</Text>
            </View>
            <Text style={styles.guestTitle}>未登入</Text>
            <Text style={styles.guestSubtitle}>登入後享受完整功能</Text>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => router.push('/(auth)/login')}
              activeOpacity={0.8}
            >
              <Text style={styles.loginBtnText}>登入 / 注冊</Text>
            </TouchableOpacity>
          </View>

          {/* 訪客菜單 */}
          <View style={styles.menuSection}>
            <MenuItem icon="🚗" label="瀏覽車源" onPress={() => router.push('/(tabs)/buy')} />
            <MenuItem icon="📞" label="聯繫我們" onPress={() => {}} />
            <MenuItem icon="ℹ️" label="關於 GoGoCar" onPress={() => {}} />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── 登入態 ─────────────────────────────────────────────────────────────────
  const avatarUrl = user?.avatarUrl;
  const displayName = user?.name || `用戶 ${user?.phone?.slice(-4) || ''}`;
  const phone = user?.phone ? `+853 ${user.phone}` : '';
  const iPointBalance = user?.iPointBalance ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>我的</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 用戶信息卡片 */}
        <View style={styles.userCard}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarDefault}>
                <Text style={styles.avatarDefaultText}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{displayName}</Text>
            <Text style={styles.userPhone}>{phone}</Text>
          </View>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push('/profile/edit')}
            activeOpacity={0.7}
          >
            <Text style={styles.editBtnText}>編輯</Text>
          </TouchableOpacity>
        </View>

        {/* iPoint 快捷 */}
        <TouchableOpacity
          style={styles.ipointCard}
          onPress={() => router.push('/(tabs)/ipoint')}
          activeOpacity={0.8}
        >
          <View>
            <Text style={styles.ipointLabel}>iPoint 餘額</Text>
            <Text style={styles.ipointValue}>{iPointBalance.toLocaleString()} iP</Text>
          </View>
          <Text style={styles.ipointArrow}>›</Text>
        </TouchableOpacity>

        {/* 我的車源 */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>我的車源</Text>
          <MenuItem icon="📋" label="我發佈的車源" onPress={() => router.push('/profile/my-posts')} />
          <MenuItem icon="❤️" label="我的收藏" onPress={() => router.push('/profile/favorites')} />
          <MenuItem icon="💬" label="我的消息" onPress={() => router.push('/profile/messages')} />
        </View>

        {/* 賬戶設置 */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>賬戶設置</Text>
          <MenuItem icon="👤" label="個人資料" onPress={() => router.push('/profile/edit')} />
          <MenuItem icon="🔔" label="通知設置" onPress={() => {}} />
          <MenuItem icon="🔒" label="隱私設置" onPress={() => {}} />
        </View>

        {/* 其他 */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>其他</Text>
          <MenuItem icon="📞" label="聯繫客服" onPress={() => {}} />
          <MenuItem icon="ℹ️" label="關於 GoGoCar" onPress={() => {}} />
          <MenuItem icon="📄" label="服務條款" onPress={() => {}} />
        </View>

        {/* 登出按鈕 */}
        <View style={styles.logoutWrap}>
          <TouchableOpacity
            style={[styles.logoutBtn, loggingOut && styles.logoutBtnDisabled]}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.8}
          >
            {loggingOut ? (
              <ActivityIndicator color="#ef4444" size="small" />
            ) : (
              <Text style={styles.logoutBtnText}>登出</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: {
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: APP_BORDER,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: APP_TEXT, letterSpacing: -0.5 },
  // 訪客
  guestHero: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#fff', marginBottom: 8 },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarPlaceholderText: { fontSize: 36 },
  guestTitle: { fontSize: 18, fontWeight: '600', color: APP_TEXT, marginBottom: 6 },
  guestSubtitle: { fontSize: 13, color: APP_GRAY, marginBottom: 20 },
  loginBtn: {
    width: 180, height: 44, borderRadius: 22,
    backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center',
  },
  loginBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  // 用戶卡片
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  avatarWrap: { marginRight: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarDefault: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center',
  },
  avatarDefaultText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  userInfo: { flex: 1 },
  userName: { fontSize: 17, fontWeight: '700', color: APP_TEXT, marginBottom: 4 },
  userPhone: { fontSize: 13, color: APP_GRAY },
  editBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1, borderColor: APP_BORDER,
  },
  editBtnText: { fontSize: 13, color: APP_TEXT },
  // iPoint 卡片
  ipointCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff9f0',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffe0c0',
  },
  ipointLabel: { fontSize: 12, color: APP_ORANGE, marginBottom: 4 },
  ipointValue: { fontSize: 20, fontWeight: '700', color: APP_ORANGE },
  ipointArrow: { fontSize: 22, color: APP_ORANGE },
  // 菜單
  menuSection: { backgroundColor: '#fff', marginBottom: 8 },
  menuSectionTitle: {
    fontSize: 12, color: APP_GRAY, fontWeight: '500',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 0.5, borderTopColor: APP_BORDER,
  },
  menuIcon: { fontSize: 18, marginRight: 12, width: 24, textAlign: 'center' },
  menuLabel: { flex: 1, fontSize: 15, color: APP_TEXT },
  menuLabelDanger: { color: '#ef4444' },
  menuArrow: { fontSize: 18, color: '#c7c7cc' },
  badge: {
    backgroundColor: '#ef4444', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2, marginRight: 8,
  },
  badgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  // 登出
  logoutWrap: { paddingHorizontal: 16, paddingTop: 16 },
  logoutBtn: {
    height: 50, borderRadius: 14,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ef4444',
    justifyContent: 'center', alignItems: 'center',
  },
  logoutBtnDisabled: { opacity: 0.6 },
  logoutBtnText: { fontSize: 16, fontWeight: '600', color: '#ef4444' },
});
