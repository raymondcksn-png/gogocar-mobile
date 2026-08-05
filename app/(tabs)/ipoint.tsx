/**
 * iPoint 積分頁 — 積分餘額 + 任務中心 + 微信支付充值 + 消費記錄
 * Sprint D1: WeChat Pay H5 充值流程（WebView 方案，Expo Go 相容）
 * Sprint S5: 加入任務中心（對齊 WebApp）
 * API: trpc.ipoint.getBalance + trpc.ipoint.getActiveTasks + trpc.ipoint.getTransactions
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { trpc, API_BASE_URL } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';

import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

// 微信原生 APP 的 AppID（從 app.json extra.wechatAppId 讀取，後台可配置）
const WECHAT_APP_ID = (Constants.expoConfig?.extra as any)?.wechatAppId || 'wx_placeholder';
// 微信支付回調地址（後端 webhook）
const WECHAT_NOTIFY_URL = `${API_BASE_URL}/api/wechat-pay/notify`;

const RECHARGE_PLANS = [
  { label: '100 iP', ipoint: 100, mop: 10, badge: '' },
  { label: '300 iP', ipoint: 300, mop: 28, badge: '最受歡迎' },
  { label: '500 iP', ipoint: 500, mop: 45, badge: '' },
  { label: '1000 iP', ipoint: 1000, mop: 88, badge: '超值' },
];

const TASK_TYPE_LABEL: Record<string, string> = {
  daily: '每日',
  streak: '連續',
  one_time: '一次性',
};

const TRIGGER_LABEL: Record<string, string> = {
  login: '每日登入',
  post_vehicle: '發佈車源',
  complete_profile: '完善資料',
  share: '分享',
  review: '評價',
};

export default function IPointScreen() {
  const router = useRouter();
  const { isLoggedIn, user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState(1);
  const [paying, setPaying] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [showWebView, setShowWebView] = useState(false);

  const { data: balanceData, isLoading: balanceLoading, refetch: refetchBalance } = trpc.ipoint.getBalance.useQuery(
    undefined, { enabled: isLoggedIn }
  );
  const { data: tasksData, isLoading: tasksLoading, refetch: refetchTasks } = trpc.ipoint.getActiveTasks.useQuery(
    undefined, { enabled: isLoggedIn }
  );
  const { data: txData, isLoading: txLoading, refetch: refetchTx } = trpc.ipoint.getTransactions.useQuery(
    { page: 1, pageSize: 20 }, { enabled: isLoggedIn }
  );
  const { data: rateData } = trpc.wechatPay.getExchangeRate.useQuery();

  const triggerTaskMutation = trpc.ipoint.triggerTask.useMutation({
    onSuccess: (data: any) => {
      refetchBalance();
      refetchTasks();
      refetchTx();
      if (data?.rewards?.length > 0) {
        const totalReward = data.rewards.reduce((sum: number, r: any) => sum + (r.reward || 0), 0);
        Alert.alert('🎉 任務完成！', `獲得 +${totalReward} iPoint！`);
      }
    },
    onError: (err: any) => {
      Alert.alert('提示', err.message || '任務觸發失敗');
    },
  });

  const createOrderMutation = trpc.wechatPay.createOrder.useMutation({
    onSuccess: (data: any) => {
      setPaying(false);
      if (data?.h5Url) {
        setPayUrl(data.h5Url);
        setShowWebView(true);
      } else {
        Alert.alert('支付', '請在微信中完成支付');
      }
    },
    onError: (err: any) => {
      setPaying(false);
      Alert.alert('支付失敗', err.message || '請稍後重試');
    },
  });

  const handleRecharge = () => {
    if (!isLoggedIn) {
      Alert.alert('提示', '請先登入', [
        { text: '去登入', onPress: () => router.push('/(auth)/login') },
        { text: '取消', style: 'cancel' },
      ]);
      return;
    }
    const plan = RECHARGE_PLANS[selectedPlan];
    Alert.alert(
      '確認充值',
      `充值 ${plan.ipoint} iPoint\n費用：澳門幣 MOP ${plan.mop}`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '微信支付',
          onPress: () => {
            setPaying(true);
            createOrderMutation.mutate({
              mopAmount: plan.mop,
              ipointAmount: plan.ipoint,
              appId: WECHAT_APP_ID,
              notifyUrl: WECHAT_NOTIFY_URL,
            });
          },
        },
      ]
    );
  };

  const handleWebViewClose = () => {
    setShowWebView(false);
    setPayUrl(null);
    setTimeout(() => { refetchBalance(); refetchTx(); }, 1000);
    Alert.alert('支付確認', '如已完成支付，iPoint 將在幾秒內到賬', [{ text: '確定' }]);
  };

  const handleTriggerTask = (trigger: string, taskName: string) => {
    if (trigger === 'login') {
      Alert.alert('提示', '登入任務由系統自動觸發，每日登入即可獲得積分');
      return;
    }
    Alert.alert('領取任務獎勵', `完成「${taskName}」任務？`, [
      { text: '取消', style: 'cancel' },
      { text: '確認', onPress: () => triggerTaskMutation.mutate({ trigger }) },
    ]);
  };

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

  const balance = balanceData?.balance ?? (user as any)?.iPointBalance ?? 0;
  const tasks: any[] = tasksData || [];
  const transactions = txData?.items || [];
  const exchangeRate = (rateData as any)?.rate ?? 0.88;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>iPoint</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 餘額卡片 */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>iPoint 餘額</Text>
          {balanceLoading ? <ActivityIndicator color="#fff" size="small" /> : (
            <Text style={styles.balanceValue}>{balance.toLocaleString()}</Text>
          )}
          <Text style={styles.balanceUnit}>積分</Text>
        </View>

        {/* 任務中心 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>✨ 任務中心</Text>
            <Text style={styles.sectionHint}>完成任務免費獲取 iPoint</Text>
          </View>
          {tasksLoading ? (
            <ActivityIndicator color={APP_ORANGE} style={{ paddingVertical: 20 }} />
          ) : tasks.length === 0 ? (
            <Text style={styles.empty}>暫無可用任務</Text>
          ) : (
            tasks.map((task: any) => {
              const progress = task.progress;
              const isCompleted = (() => {
                if (!progress) return false;
                // 後端字段名是 type（非 taskType）
                if (task.type === 'one_time') return (progress.totalCompletions || 0) >= 1;
                if (task.type === 'daily' || task.type === 'streak') {
                  // 後端用 lastStreakDate（YYYY-MM-DD 字串）
                  if (!progress.lastStreakDate) return false;
                  const today = new Date().toISOString().slice(0, 10);
                  return progress.lastStreakDate === today;
                }
                return false;
              })();

              const streakDays = progress?.currentStreak || 0;
              const streakTarget = task.streakDays || 0;

              return (
                <View key={task.id} style={styles.taskItem}>
                  <View style={styles.taskLeft}>
                    <View style={styles.taskTitleRow}>
                      <Text style={styles.taskName}>{task.name}</Text>
                      <View style={[styles.taskTypeBadge, { backgroundColor: task.type === 'daily' ? '#FFF7ED' : task.type === 'streak' ? '#EFF6FF' : '#F0FDF4' }]}>
                        <Text style={[styles.taskTypeBadgeText, { color: task.type === 'daily' ? APP_ORANGE : task.type === 'streak' ? '#1D4ED8' : '#15803D' }]}>
                          {TASK_TYPE_LABEL[task.type] || task.type}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.taskTrigger}>
                      {TRIGGER_LABEL[task.trigger] || task.trigger}
                      {streakTarget > 0 ? `  連續 ${streakDays}/${streakTarget} 天` : ''}
                    </Text>
                    {task.description ? <Text style={styles.taskDesc}>{task.description}</Text> : null}
                  </View>
                  <View style={styles.taskRight}>
                    <Text style={styles.taskReward}>+{task.reward} iP</Text>
                    {(task.streakReward || 0) > 0 && streakTarget > 0 && (
                      <Text style={styles.taskBonus}>達標額外+{task.streakReward}</Text>
                    )}
                    <TouchableOpacity
                      style={[
                        styles.taskBtn,
                        isCompleted && styles.taskBtnDone,
                        task.trigger === 'login' && styles.taskBtnAuto,
                      ]}
                      onPress={() => !isCompleted && !triggerTaskMutation.isPending && handleTriggerTask(task.trigger, task.name)}
                      disabled={isCompleted || triggerTaskMutation.isPending}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.taskBtnText, isCompleted && styles.taskBtnTextDone, task.trigger === 'login' && styles.taskBtnTextAuto]}>
                        {isCompleted ? '已完成' : task.trigger === 'login' ? '自動' : '領取'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* 充值套餐 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>充值 iPoint</Text>
          <Text style={styles.sectionHint}>匯率：MOP 1 ≈ CNY {exchangeRate.toFixed(2)}（微信支付以人民幣結算）</Text>
          <View style={styles.planGrid}>
            {RECHARGE_PLANS.map((plan, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.planCard, selectedPlan === i && styles.planCardActive]}
                onPress={() => setSelectedPlan(i)}
                activeOpacity={0.7}
              >
                {!!plan.badge && (
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>{plan.badge}</Text>
                  </View>
                )}
                <Text style={[styles.planIpoint, selectedPlan === i && styles.planIpointActive]}>{plan.label}</Text>
                <Text style={[styles.planPrice, selectedPlan === i && styles.planPriceActive]}>MOP {plan.mop}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.rechargeBtn, paying && styles.rechargeBtnDisabled]}
            onPress={handleRecharge}
            disabled={paying}
            activeOpacity={0.8}
          >
            {paying ? <ActivityIndicator color="#fff" size="small" /> : (
              <Text style={styles.rechargeBtnText}>微信支付充值 {RECHARGE_PLANS[selectedPlan].ipoint} iP</Text>
            )}
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

      {/* 微信支付 WebView Modal */}
      <Modal visible={showWebView} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleWebViewClose}>
        <View style={styles.webviewContainer}>
          <View style={styles.webviewHeader}>
            <Text style={styles.webviewTitle}>微信支付</Text>
            <TouchableOpacity onPress={handleWebViewClose} style={styles.webviewClose}>
              <Text style={styles.webviewCloseText}>完成</Text>
            </TouchableOpacity>
          </View>
          {payUrl && (
            <WebView
              source={{ uri: payUrl }}
              style={{ flex: 1 }}
              onNavigationStateChange={(state) => {
                if (state.url?.startsWith('gogocar://') || state.url?.includes('pay_success')) {
                  handleWebViewClose();
                }
              }}
            />
          )}
        </View>
      </Modal>
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
  header: { backgroundColor: '#fff', paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  headerTitle: { fontSize: 22, fontWeight: '700', color: APP_TEXT, letterSpacing: -0.5 },
  balanceCard: { margin: 16, borderRadius: 20, backgroundColor: APP_ORANGE, padding: 24, alignItems: 'center', shadowColor: APP_ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  balanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  balanceValue: { fontSize: 48, fontWeight: '800', color: '#fff', letterSpacing: -2 },
  balanceUnit: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  section: { backgroundColor: '#fff', marginTop: 8, paddingHorizontal: 16, paddingVertical: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: APP_TEXT, marginBottom: 4 },
  sectionHint: { fontSize: 11, color: APP_GRAY, marginBottom: 12 },
  // Task styles
  taskItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  taskLeft: { flex: 1, marginRight: 12 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  taskName: { fontSize: 14, fontWeight: '600', color: APP_TEXT },
  taskTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  taskTypeBadgeText: { fontSize: 10, fontWeight: '600' },
  taskTrigger: { fontSize: 12, color: APP_GRAY, marginBottom: 2 },
  taskDesc: { fontSize: 11, color: APP_GRAY },
  taskRight: { alignItems: 'center', minWidth: 60 },
  taskReward: { fontSize: 15, fontWeight: '700', color: APP_ORANGE, marginBottom: 2 },
  taskBonus: { fontSize: 10, color: '#16a34a', marginBottom: 6 },
  taskBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: APP_ORANGE },
  taskBtnDone: { backgroundColor: '#e5e7eb' },
  taskBtnAuto: { backgroundColor: '#EFF6FF' },
  taskBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  taskBtnTextDone: { color: '#9ca3af' },
  taskBtnTextAuto: { color: '#1D4ED8' },
  // Plan styles
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  planCard: { width: '47%', borderRadius: 12, borderWidth: 1.5, borderColor: APP_BORDER, backgroundColor: APP_BG, padding: 14, alignItems: 'center', position: 'relative' },
  planCardActive: { borderColor: APP_ORANGE, backgroundColor: `${APP_ORANGE}08` },
  planBadge: { position: 'absolute', top: -8, right: 8, backgroundColor: APP_ORANGE, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  planBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  planIpoint: { fontSize: 18, fontWeight: '700', color: APP_TEXT, marginBottom: 4 },
  planIpointActive: { color: APP_ORANGE },
  planPrice: { fontSize: 13, color: APP_GRAY },
  planPriceActive: { color: APP_ORANGE },
  rechargeBtn: { height: 50, borderRadius: 14, backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center' },
  rechargeBtnDisabled: { backgroundColor: '#ffb380' },
  rechargeBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  serviceItem: { width: '47%', backgroundColor: APP_BG, borderRadius: 12, padding: 16, alignItems: 'center' },
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
  loginBtn: { width: 200, height: 48, borderRadius: 24, backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center' },
  loginBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  webviewContainer: { flex: 1, backgroundColor: '#fff' },
  webviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: APP_BORDER, backgroundColor: '#fff' },
  webviewTitle: { fontSize: 17, fontWeight: '600', color: APP_TEXT },
  webviewClose: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: `${APP_ORANGE}15` },
  webviewCloseText: { fontSize: 15, fontWeight: '600', color: APP_ORANGE },
});
