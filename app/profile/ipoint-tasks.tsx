import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';

const APP_ORANGE = '#FF6B00';

// ── 任務類型圖標 ──────────────────────────────────────────────────────────
function taskIcon(type: string, trigger: string): string {
  if (trigger === 'login') return '🔥';
  if (trigger === 'first_post') return '🎁';
  if (type === 'streak') return '🔥';
  if (type === 'daily') return '📅';
  return '⭐';
}

// ── 進度條 ────────────────────────────────────────────────────────────────
function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.min(1, current / Math.max(1, total));
  return (
    <View style={s.progressBg}>
      <View style={[s.progressFill, { width: `${pct * 100}%` as any }]} />
    </View>
  );
}

// ── 主組件 ────────────────────────────────────────────────────────────────
export default function IpointTasksScreen() {
  const router = useRouter();
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const { data: tasks = [], isLoading, refetch } = trpc.ipoint.getActiveTasks.useQuery();
  const { data: balance } = trpc.ipoint.getBalance.useQuery();
  const triggerMutation = trpc.ipoint.triggerTask.useMutation({
    onSuccess: (data: any) => {
      setClaimingId(null);
      if (data?.rewarded) {
        Alert.alert('🎉 領取成功', `已獲得 +${data.reward} iP！`, [
          { text: '好的', onPress: () => refetch() },
        ]);
      } else {
        Alert.alert('提示', data?.message || '任務尚未完成或已領取', [
          { text: '好的', onPress: () => refetch() },
        ]);
      }
    },
    onError: (err: any) => {
      setClaimingId(null);
      Alert.alert('錯誤', err.message || '操作失敗');
    },
  });

  function handleClaim(task: any) {
    // 登入類任務是自動的，不允許手動觸發
    if (task.trigger === 'login') {
      Alert.alert('自動任務', '每日登入任務由系統自動完成，無需手動領取。');
      return;
    }
    // 已完成一次性任務
    if (task.type === 'one_time' && task.progress?.totalCompletions > 0) {
      Alert.alert('已領取', '此任務已完成並領取獎勵。');
      return;
    }
    Alert.alert(
      '領取任務獎勵',
      `完成「${task.name}」任務？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確認',
          onPress: () => {
            setClaimingId(task.id);
            triggerMutation.mutate({ trigger: task.trigger });
          },
        },
      ]
    );
  }

  // ── 判斷任務狀態 ──────────────────────────────────────────────────────
  function getTaskStatus(task: any): 'auto' | 'claimable' | 'claimed' | 'pending' {
    if (task.trigger === 'login') return 'auto';
    if (task.type === 'one_time') {
      return task.progress?.totalCompletions > 0 ? 'claimed' : 'claimable';
    }
    return 'claimable';
  }

  if (isLoading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="large" color={APP_ORANGE} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* 頂部導航 */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>任務中心</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* 餘額提示 */}
        <View style={s.balanceHint}>
          <Text style={s.balanceHintText}>
            當前餘額：<Text style={s.balanceHintNum}>{balance?.balance ?? 0} iP</Text>
          </Text>
        </View>

        {/* 任務列表 */}
        {tasks.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>暫無可用任務</Text>
          </View>
        ) : (
          tasks.map((task: any) => {
            const status = getTaskStatus(task);
            const progress = task.progress;
            const isStreakTask = task.type === 'streak' && task.streakDays;
            const currentStreak = progress?.currentStreak ?? 0;
            const isClaiming = claimingId === task.id;

            return (
              <View key={task.id} style={s.taskCard}>
                <View style={s.taskLeft}>
                  <View style={[s.taskIconWrap, status === 'claimed' && s.taskIconWrapDone]}>
                    <Text style={s.taskIconText}>{taskIcon(task.type, task.trigger)}</Text>
                  </View>
                </View>

                <View style={s.taskBody}>
                  <View style={s.taskTitleRow}>
                    <Text style={s.taskName}>{task.name}</Text>
                    <Text style={s.taskReward}>+{task.reward} iP</Text>
                  </View>
                  {task.description ? (
                    <Text style={s.taskDesc}>{task.description}</Text>
                  ) : null}

                  {/* 連續登入進度條 */}
                  {isStreakTask && (
                    <View style={s.streakWrap}>
                      <Text style={s.streakText}>
                        🔥 連續 {currentStreak}/{task.streakDays} 天
                        {task.streakReward ? `・達標額外 +${task.streakReward} iP` : ''}
                      </Text>
                      <ProgressBar current={currentStreak} total={task.streakDays} />
                    </View>
                  )}
                </View>

                {/* 右側按鈕 */}
                <View style={s.taskAction}>
                  {status === 'auto' && (
                    <View style={s.autoBadge}>
                      <Text style={s.autoBadgeText}>自動</Text>
                    </View>
                  )}
                  {status === 'claimed' && (
                    <View style={s.claimedBadge}>
                      <Text style={s.claimedBadgeText}>已領取</Text>
                    </View>
                  )}
                  {status === 'claimable' && (
                    <TouchableOpacity
                      style={s.claimBtn}
                      onPress={() => handleClaim(task)}
                      disabled={isClaiming}
                      activeOpacity={0.8}
                    >
                      {isClaiming ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={s.claimBtnText}>領取</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* 說明文字 */}
        <View style={s.tipBox}>
          <Text style={s.tipText}>
            💡 每日登入自動獲得 5 iPoints。連續登入不中斷可獲得額外獎勵（第7天 +50，第30天 +100）。中斷一天重新計算。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── 樣式 ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backText: { fontSize: 28, color: '#333', lineHeight: 32 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },

  scroll: { padding: 16, paddingBottom: 40 },

  balanceHint: {
    backgroundColor: '#FFF7F0', borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#FFE0CC',
  },
  balanceHintText: { fontSize: 14, color: '#666' },
  balanceHintNum: { color: APP_ORANGE, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#999', fontSize: 15 },

  taskCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'flex-start',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  taskLeft: { marginRight: 12 },
  taskIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF3E8', justifyContent: 'center', alignItems: 'center',
  },
  taskIconWrapDone: { backgroundColor: '#F0F0F0' },
  taskIconText: { fontSize: 20 },

  taskBody: { flex: 1 },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  taskName: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', flex: 1, marginRight: 8 },
  taskReward: { fontSize: 14, fontWeight: '700', color: APP_ORANGE },
  taskDesc: { fontSize: 13, color: '#888', marginBottom: 6 },

  streakWrap: { marginTop: 4 },
  streakText: { fontSize: 12, color: '#FF6B00', marginBottom: 4 },
  progressBg: { height: 4, backgroundColor: '#F0F0F0', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: APP_ORANGE, borderRadius: 2 },

  taskAction: { marginLeft: 8, alignItems: 'center', justifyContent: 'center', minWidth: 56 },
  autoBadge: {
    backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  autoBadgeText: { fontSize: 12, color: '#6366F1', fontWeight: '600' },
  claimedBadge: {
    backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  claimedBadgeText: { fontSize: 12, color: '#22C55E', fontWeight: '600' },
  claimBtn: {
    backgroundColor: APP_ORANGE, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    minWidth: 52, alignItems: 'center',
  },
  claimBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },

  tipBox: {
    backgroundColor: '#FFFBEB', borderRadius: 10, padding: 14, marginTop: 8,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  tipText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
});
