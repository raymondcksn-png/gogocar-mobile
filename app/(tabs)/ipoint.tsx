/**
 * iPoint 積分頁 — 積分餘額 + 充值 + 消費記錄
 * API: trpc.ipoint.getBalance + trpc.ipoint.getTransactions
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

export default function IPointScreen() {
  const router = useRouter();
  const { isLoggedIn, user } = useAuth();

  const { data: balanceData, isLoading: balanceLoading } = trpc.ipoint.getBalance.useQuery(
    undefined,
    { enabled: isLoggedIn }
  );

  const { data: txData, isLoading: txLoading } = trpc.ipoint.getTransactions.useQuery(
    { page: 1, pageSize: 20 },
    { enabled: isLoggedIn }
  );

  if (!isLoggedIn) {
    return (
      <View style={styles.guestWrap}>
        <Text style={styles.guestIcon}>💎</Text>
        <Text style={styles.guestTitle}>登入後查看 iPoint</Text>
        <Text style={styles.guestSubtitle}>iPoint 可用於置頂車源、精選推廣等服務</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginBtnText}>立即登入</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const balance = balanceData?.balance ?? user?.iPointBalance ?? 0;
  const transactions = txData?.items || [];

  return (
    <View style={styles.container}>
      {/* 頂部欄 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>iPoint</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 餘額卡片 */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>iPoint 餘額</Text>
          {balanceLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.balanceValue}>{balance.toLocaleString()}</Text>
          )}
          <Text style={styles.balanceUnit}>積分</Text>
          <TouchableOpacity style={styles.rechargeBtn} activeOpacity={0.8}>
            <Text style={styles.rechargeBtnText}>充值 iPoint</Text>
          </TouchableOpacity>
        </View>

        {/* 服務說明 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>iPoint 用途</Text>
          <View style={styles.serviceGrid}>
            <ServiceItem icon="📌" title="置頂車源" desc="7天 / 100 iP" />
            <ServiceItem icon="⭐" title="精選推廣" desc="7天 / 200 iP" />
            <ServiceItem icon="🔔" title="急售標籤" desc="3天 / 50 iP" />
            <ServiceItem icon="📸" title="相片增強" desc="每次 / 20 iP" />
          </View>
        </View>

        {/* 交易記錄 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>交易記錄</Text>
          {txLoading ? (
            <ActivityIndicator color={APP_ORANGE} style={{ paddingVertical: 20 }} />
          ) : transactions.length === 0 ? (
            <Text style={styles.empty}>暫無交易記錄</Text>
          ) : (
            transactions.map((tx: any, i: number) => (
              <View key={tx.id || i} style={[styles.txItem, i < transactions.length - 1 && styles.txItemBorder]}>
                <View style={styles.txLeft}>
                  <Text style={styles.txDesc}>{tx.description || tx.type || '交易'}</Text>
                  <Text style={styles.txDate}>{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('zh-HK') : ''}</Text>
                </View>
                <Text style={[styles.txAmount, tx.amount > 0 ? styles.txAmountIn : styles.txAmountOut]}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount} iP
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function ServiceItem({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <View style={styles.serviceItem}>
      <Text style={styles.serviceIcon}>{icon}</Text>
      <Text style={styles.serviceTitle}>{title}</Text>
      <Text style={styles.serviceDesc}>{desc}</Text>
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
  balanceCard: {
    margin: 16,
    borderRadius: 20,
    backgroundColor: APP_ORANGE,
    padding: 24,
    alignItems: 'center',
    shadowColor: APP_ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  balanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  balanceValue: { fontSize: 48, fontWeight: '800', color: '#fff', letterSpacing: -2 },
  balanceUnit: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4, marginBottom: 20 },
  rechargeBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  rechargeBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 0,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: APP_TEXT, marginBottom: 12 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  serviceItem: {
    width: '47%',
    backgroundColor: APP_BG,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  serviceIcon: { fontSize: 28, marginBottom: 8 },
  serviceTitle: { fontSize: 14, fontWeight: '600', color: APP_TEXT, marginBottom: 4 },
  serviceDesc: { fontSize: 12, color: APP_GRAY },
  txItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  txItemBorder: { borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  txLeft: { flex: 1 },
  txDesc: { fontSize: 14, color: APP_TEXT, fontWeight: '500' },
  txDate: { fontSize: 12, color: APP_GRAY, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '700' },
  txAmountIn: { color: '#16a34a' },
  txAmountOut: { color: '#ef4444' },
  empty: { textAlign: 'center', paddingVertical: 24, color: APP_GRAY, fontSize: 14 },
  guestWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: APP_BG, padding: 32 },
  guestIcon: { fontSize: 64, marginBottom: 16 },
  guestTitle: { fontSize: 20, fontWeight: '700', color: APP_TEXT, marginBottom: 8 },
  guestSubtitle: { fontSize: 14, color: APP_GRAY, marginBottom: 32, textAlign: 'center' },
  loginBtn: {
    width: 200,
    height: 48,
    borderRadius: 24,
    backgroundColor: APP_ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
