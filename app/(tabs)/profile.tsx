/**
 * 個人中心頁 — 完整對齊 WebApp AppMe.tsx
 * S5 對齊：Hero 漸層 + 角色 badge + 數據統計 + 彩色圖標菜單 + 角色動態菜單
 * 角色：personal（個人車主）/ dealer（車商）/ school（駕校校長）
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { trpc, resolveImageUrl } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

// ── 角色配置 ──────────────────────────────────────────────────────────────────
type RoleType = 'personal' | 'dealer' | 'school';

const ROLE_META: Record<RoleType, { label: string; color: string }> = {
  personal: { label: '個人車主', color: APP_ORANGE },
  dealer: { label: '車商', color: '#2563EB' },
  school: { label: '駕校校長', color: '#16A34A' },
};

// ── 彩色圖標組件（iOS 風格方形漸層圖標） ──────────────────────────────────────
function IconBox({
  name,
  colors,
  size = 20,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  colors: [string, string];
  size?: number;
}) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.iconBox}
    >
      <Ionicons name={name} size={size} color="#fff" />
    </LinearGradient>
  );
}

// ── 菜單行組件 ─────────────────────────────────────────────────────────────────
function MenuRow({
  iconName,
  iconColors,
  label,
  badge,
  comingSoon,
  onPress,
  last,
}: {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  iconColors: [string, string];
  label: string;
  badge?: string | number;
  comingSoon?: boolean;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, !last && styles.menuRowBorder]}
      onPress={comingSoon ? () => Alert.alert('即將上線', '此功能即將推出，敬請期待') : onPress}
      activeOpacity={0.7}
    >
      <IconBox name={iconName} colors={iconColors} />
      <Text style={styles.menuRowLabel}>{label}</Text>
      {comingSoon && (
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>即將上線</Text>
        </View>
      )}
      {badge !== undefined && !comingSoon && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color="#c7c7cc" />
    </TouchableOpacity>
  );
}

// ── 菜單分組組件 ───────────────────────────────────────────────────────────────
function MenuGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.menuGroup}>
      {title && <Text style={styles.menuGroupTitle}>{title}</Text>}
      <View style={styles.menuGroupCard}>{children}</View>
    </View>
  );
}

// ── 數據統計組件 ───────────────────────────────────────────────────────────────
function StatItem({
  iconName,
  label,
  value,
  border,
}: {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string | number;
  border?: boolean;
}) {
  return (
    <View style={[styles.statItem, border && styles.statItemBorder]}>
      <Text style={styles.statValue}>{value}</Text>
      <View style={styles.statLabelRow}>
        <Ionicons name={iconName} size={12} color={APP_ORANGE} style={{ marginRight: 3 }} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const { isLoggedIn, user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const logoutMutation = trpc.auth.logout.useMutation();
  const { data: meData } = trpc.auth.me.useQuery(undefined, { enabled: isLoggedIn });
  const { data: myPostsData } = trpc.vehicle.myPosts.useQuery(
    undefined,
    { enabled: isLoggedIn }
  );
  const { data: ipointData } = trpc.ipoint.getBalance.useQuery(undefined, { enabled: isLoggedIn });

  const handleLogout = () => {
    Alert.alert('確認登出', '確定要登出嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '登出',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
            logoutMutation.mutate().catch(() => {});
          } catch (err) {
            console.warn('[Profile] Logout error:', err);
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  // ── 訪客態 ─────────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>我的</Text>
        </View>
        <ScrollView>
          <View style={styles.guestHero}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person-outline" size={40} color={APP_GRAY} />
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
          <MenuGroup>
            <MenuRow iconName="car-outline" iconColors={[APP_ORANGE, '#EA580C']} label="瀏覽車源" onPress={() => router.push('/(tabs)/buy')} />
            <MenuRow iconName="call-outline" iconColors={['#3B82F6', '#2563EB']} label="聯繫我們" onPress={() => Linking.openURL('tel:+85366563101')} />
            <MenuRow iconName="information-circle-outline" iconColors={['#6B7280', '#4B5563']} label="關於 GoGoCar" onPress={() => {}} last />
          </MenuGroup>
        </ScrollView>
      </View>
    );
  }

  // ── 登入態數據 ─────────────────────────────────────────────────────────────
  const me = meData || user;
  const rawRole = ((me as any)?.activeRole || (me as any)?.roleType || 'personal') as string;
  const activeRole: RoleType = rawRole === 'personalOwner' ? 'personal' : (rawRole as RoleType) in ROLE_META ? (rawRole as RoleType) : 'personal';
  const role = ROLE_META[activeRole] ?? ROLE_META['personal'];

  const displayName = (me as any)?.name || (me as any)?.nickname || `用戶 ${(me as any)?.phone?.slice(-4) || ''}`;
  const avatarUrl = resolveImageUrl((me as any)?.avatar || (me as any)?.avatarUrl);
  const phone = (me as any)?.phone ? `${(me as any).phone.slice(0, 3)}****${(me as any).phone.slice(-4)}` : '未綁定手機';
  const initial = displayName.charAt(0).toUpperCase();
  const ipointBalance = ipointData?.balance ?? (me as any)?.iPointBalance ?? 0;
  const postCount = (myPostsData as any)?.items?.length ?? 0;

  const dealerMemberExpireAt = (me as any)?.dealerMemberExpireAt;
  const dealerMemberActive = dealerMemberExpireAt && new Date(dealerMemberExpireAt) > new Date();
  const dealerMemberDaysLeft = dealerMemberActive
    ? Math.ceil((new Date(dealerMemberExpireAt).getTime() - Date.now()) / 86400000)
    : 0;

  const heroGradientStart = `${role.color}18`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>我的</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero 區域 ── */}
        <LinearGradient
          colors={[heroGradientStart as any, '#ffffff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.hero}
        >
          {/* 設置按鈕 */}
          <TouchableOpacity
            style={styles.heroActionBtn}
            onPress={() => router.push('/profile/edit')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={18} color="#6b7280" />
          </TouchableOpacity>

          {/* 頭像 + 信息 */}
          <View style={styles.heroUserRow}>
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl || undefined }} style={styles.avatar} />
              ) : (
                <LinearGradient
                  colors={[role.color, `${role.color}CC`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarDefault}
                >
                  <Text style={styles.avatarDefaultText}>{initial}</Text>
                </LinearGradient>
              )}
              {/* 角色小圖標 */}
              <View style={[styles.roleIconBadge, { backgroundColor: role.color }]}>
                <Ionicons
                  name={activeRole === 'dealer' ? 'ribbon-outline' : activeRole === 'school' ? 'school-outline' : 'person-outline'}
                  size={10}
                  color="#fff"
                />
              </View>
            </View>

            <View style={styles.heroUserInfo}>
              <Text style={styles.heroName}>{displayName}</Text>
              <View style={styles.heroMeta}>
                <View style={[styles.roleBadge, { backgroundColor: `${role.color}18` }]}>
                  <Text style={[styles.roleBadgeText, { color: role.color }]}>{role.label}</Text>
                </View>
                <Text style={styles.heroPhone}>{phone}</Text>
              </View>
              {activeRole === 'dealer' && (
                <Text style={[styles.dealerMemberText, { color: dealerMemberActive ? '#D97706' : APP_GRAY }]}>
                  {dealerMemberActive ? `✦ 年度會員 · 剩餘 ${dealerMemberDaysLeft} 天` : '普通車商帳號'}
                </Text>
              )}
            </View>

            {/* 切換身份按鈕 */}
            <TouchableOpacity
              style={styles.heroActionBtn}
              onPress={() => router.push('/profile/edit')}
              activeOpacity={0.7}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* iPoint 卡片（駕校不顯示） */}
          {activeRole !== 'school' && (
            <View style={styles.ipointCard}>
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ipointIconBox}
              >
                <Ionicons name="wallet-outline" size={18} color="#fff" />
              </LinearGradient>
              <View style={styles.ipointInfo}>
                <Text style={styles.ipointLabel}>iPoint 餘額</Text>
                <View style={styles.ipointValueRow}>
                  <Text style={styles.ipointValue}>{ipointBalance.toLocaleString()}</Text>
                  <Text style={styles.ipointUnit}> iP</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.rechargeBtn}
                onPress={() => router.push('/(tabs)/ipoint')}
                activeOpacity={0.8}
              >
                <Text style={styles.rechargeBtnText}>充值</Text>
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>

        {/* ── 數據統計 ── */}
        <View style={styles.statsCard}>
          <StatItem iconName="clipboard-outline" label="已發佈" value={postCount} />
          <StatItem iconName="heart-outline" label="收藏" value={0} border />
          <StatItem iconName="eye-outline" label="瀏覽過" value={0} />
        </View>

        {/* ── 個人車主菜單 ── */}
        {activeRole === 'personal' && (
          <>
            <MenuGroup title="我的車源">
              <MenuRow iconName="car-outline" iconColors={[APP_ORANGE, '#EA580C']} label="我的車源" badge={postCount > 0 ? postCount : undefined} onPress={() => router.push('/profile/my-posts')} />
              <MenuRow iconName="heart-outline" iconColors={['#EF4444', '#DC2626']} label="我的收藏" onPress={() => router.push('/profile/favorites')} />
              <MenuRow iconName="eye-outline" iconColors={['#8B5CF6', '#7C3AED']} label="瀏覽記錄" comingSoon />
              <MenuRow iconName="document-text-outline" iconColors={['#06B6D4', '#0891B2']} label="我的訂單" comingSoon last />
            </MenuGroup>

            <MenuGroup title="iPoint 錢包">
              <MenuRow iconName="wallet-outline" iconColors={['#F59E0B', '#D97706']} label="iPoint 餘額" badge={ipointBalance > 0 ? ipointBalance : undefined} onPress={() => router.push('/(tabs)/ipoint')} />
              <MenuRow iconName="add-circle-outline" iconColors={['#10B981', '#059669']} label="充值" onPress={() => router.push('/(tabs)/ipoint')} />
              <MenuRow iconName="star-outline" iconColors={['#22C55E', '#16A34A']} label="賺 iPoint" onPress={() => router.push('/(tabs)/ipoint')} last />
            </MenuGroup>

            <MenuGroup title="iCar 服務">
              <MenuRow iconName="book-outline" iconColors={['#3B82F6', '#2563EB']} label="考車報名" onPress={() => router.push('/(tabs)/exam')} />
              <MenuRow iconName="construct-outline" iconColors={['#6366F1', '#4F46E5']} label="養車服務" comingSoon />
              <MenuRow iconName="shield-checkmark-outline" iconColors={['#14B8A6', '#0D9488']} label="驗車服務" comingSoon last />
            </MenuGroup>
          </>
        )}

        {/* ── 車商菜單 ── */}
        {activeRole === 'dealer' && (
          <>
            <MenuGroup title="車源管理">
              <MenuRow iconName="car-outline" iconColors={[APP_ORANGE, '#EA580C']} label="我的車源" badge={postCount > 0 ? postCount : undefined} onPress={() => router.push('/profile/my-posts')} />
              <MenuRow iconName="add-circle-outline" iconColors={['#22C55E', '#16A34A']} label="發佈車源" onPress={() => router.push('/(tabs)/sell')} />
              <MenuRow iconName="list-outline" iconColors={['#8B5CF6', '#7C3AED']} label="批量管理" comingSoon={!dealerMemberActive} onPress={() => {}} last />
            </MenuGroup>

            <MenuGroup title="會員中心">
              <MenuRow iconName="ribbon-outline" iconColors={['#F59E0B', '#B45309']} label="年度付費會員" onPress={() => {}} />
              <MenuRow iconName="trophy-outline" iconColors={['#D97706', '#92400E']} label="會員權益" onPress={() => {}} last />
            </MenuGroup>

            <MenuGroup title="iPoint 錢包">
              <MenuRow iconName="wallet-outline" iconColors={['#F59E0B', '#D97706']} label="iPoint 餘額" badge={ipointBalance > 0 ? ipointBalance : undefined} onPress={() => router.push('/(tabs)/ipoint')} />
              <MenuRow iconName="add-circle-outline" iconColors={['#10B981', '#059669']} label="充值" onPress={() => router.push('/(tabs)/ipoint')} />
              <MenuRow iconName="star-outline" iconColors={['#22C55E', '#16A34A']} label="賺 iPoint" onPress={() => router.push('/(tabs)/ipoint')} last />
            </MenuGroup>
          </>
        )}

        {/* ── 駕校校長菜單 ── */}
        {activeRole === 'school' && (
          <>
            <MenuGroup title="我的駕校">
              <MenuRow iconName="business-outline" iconColors={['#16A34A', '#15803D']} label="駕校資料" onPress={() => router.push('/(tabs)/exam')} />
              <MenuRow iconName="bar-chart-outline" iconColors={['#0EA5E9', '#0284C7']} label="今日概覽" onPress={() => {}} last />
            </MenuGroup>

            <MenuGroup title="業務管理">
              <MenuRow iconName="book-outline" iconColors={['#3B82F6', '#2563EB']} label="課程管理" onPress={() => {}} />
              <MenuRow iconName="school-outline" iconColors={['#8B5CF6', '#7C3AED']} label="學員訂單" onPress={() => {}} />
              <MenuRow iconName="people-outline" iconColors={['#10B981', '#059669']} label="教練管理" onPress={() => {}} last />
            </MenuGroup>

            <MenuGroup title="收入">
              <MenuRow iconName="trending-up-outline" iconColors={['#F59E0B', '#D97706']} label="收入統計" onPress={() => {}} last />
            </MenuGroup>
          </>
        )}

        {/* ── 系統菜單（所有身份共用） ── */}
        <MenuGroup title="系統">
          <MenuRow iconName="chatbubble-outline" iconColors={['#3B82F6', '#2563EB']} label="消息" onPress={() => router.push('/profile/messages')} />
          <MenuRow iconName="settings-outline" iconColors={['#94A3B8', '#64748B']} label="設置" onPress={() => router.push('/profile/edit')} />
          <MenuRow iconName="swap-horizontal-outline" iconColors={['#6B7280', '#4B5563']} label="切換身份" onPress={() => Alert.alert('切換身份', '請前往個人資料頁面切換身份')} last />
        </MenuGroup>

        {/* ── 登出 ── */}
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

        <View style={{ paddingVertical: 16, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: APP_GRAY }}>GoGoCar v2.0 · 粵港澳三地二手車平台</Text>
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
  guestHero: { alignItems: 'center', paddingVertical: 48, backgroundColor: '#fff', marginBottom: 8 },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  guestTitle: { fontSize: 18, fontWeight: '600', color: APP_TEXT, marginBottom: 6 },
  guestSubtitle: { fontSize: 13, color: APP_GRAY, marginBottom: 20 },
  loginBtn: {
    width: 180, height: 44, borderRadius: 22,
    backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center',
  },
  loginBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Hero
  hero: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  heroActionBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  heroUserRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 44 },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 3, borderColor: '#fff',
  },
  avatarDefault: {
    width: 68, height: 68, borderRadius: 34,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#fff',
  },
  avatarDefaultText: { fontSize: 26, fontWeight: '700', color: '#fff' },
  roleIconBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  heroUserInfo: { flex: 1, minWidth: 0 },
  heroName: { fontSize: 20, fontWeight: '700', color: APP_TEXT, letterSpacing: -0.5 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleBadgeText: { fontSize: 11, fontWeight: '600' },
  heroPhone: { fontSize: 12, color: APP_GRAY },
  dealerMemberText: { fontSize: 11, marginTop: 4 },

  // iPoint 卡片
  ipointCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  ipointIconBox: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  ipointInfo: { flex: 1 },
  ipointLabel: { fontSize: 11, color: APP_GRAY },
  ipointValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  ipointValue: { fontSize: 22, fontWeight: '800', color: APP_ORANGE, letterSpacing: -1 },
  ipointUnit: { fontSize: 12, color: APP_GRAY, fontWeight: '500' },
  rechargeBtn: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: APP_ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rechargeBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // 數據統計
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statItemBorder: {
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  statValue: { fontSize: 22, fontWeight: '700', color: APP_ORANGE, letterSpacing: -0.5 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statLabel: { fontSize: 11, color: APP_GRAY },

  // 菜單分組
  menuGroup: { paddingHorizontal: 16, marginTop: 16 },
  menuGroupTitle: {
    fontSize: 12, fontWeight: '600', color: APP_GRAY,
    textTransform: 'uppercase', letterSpacing: 0.5,
    paddingHorizontal: 2, paddingBottom: 8,
  },
  menuGroupCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },

  // 菜單行
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  iconBox: {
    width: 30, height: 30, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12, flexShrink: 0,
  },
  menuRowLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: APP_TEXT },
  comingSoonBadge: {
    backgroundColor: '#f5f5f7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  comingSoonText: { fontSize: 10, color: APP_GRAY, fontWeight: '500' },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
    minWidth: 18,
    alignItems: 'center',
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
