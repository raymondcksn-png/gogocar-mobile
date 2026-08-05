/**
 * 我的消息頁 — 對齊 WebApp AppMessages
 * API: trpc.chat.getRooms
 * 功能：未讀數統計、骨架屏、點擊進入聊天室
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

function formatTime(date: string | Date | null | undefined) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '剛剛';
  if (mins < 60) return `${mins}分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小時前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function SkeletonRow() {
  return (
    <View style={[styles.item, { opacity: 0.5 }]}>
      <View style={[styles.avatar, { backgroundColor: '#e5e7eb' }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ height: 14, backgroundColor: '#e5e7eb', borderRadius: 6, width: '40%' }} />
        <View style={{ height: 12, backgroundColor: '#f3f4f6', borderRadius: 6, width: '65%' }} />
      </View>
    </View>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { data: rooms, isLoading, refetch } = trpc.chat.getRooms.useQuery();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const totalUnread = (rooms as any[])?.reduce((sum: number, r: any) => sum + (r.unreadCount || 0), 0) || 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>我的消息</Text>
          {totalUnread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{totalUnread > 99 ? '99+' : totalUnread}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {totalUnread > 0 && !isLoading && (
        <View style={styles.unreadBanner}>
          <Ionicons name="chatbubble-outline" size={14} color={APP_ORANGE} />
          <Text style={styles.unreadBannerText}>您有 {totalUnread} 條未讀消息</Text>
        </View>
      )}

      {isLoading ? (
        <View>
          {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
        </View>
      ) : (
        <FlatList
          data={rooms as any[]}
          keyExtractor={(item: any) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={APP_ORANGE} />}
          renderItem={({ item }: { item: any }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => router.push(`/chat/${item.id}`)}
              activeOpacity={0.75}
            >
              {/* 頭像 */}
              <View style={styles.avatarWrap}>
                {item.otherUser?.avatar ? (
                  <Image source={{ uri: item.otherUser.avatar }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>
                      {(item.otherUser?.name || '?').charAt(0)}
                    </Text>
                  </View>
                )}
                {item.unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {item.unreadCount > 99 ? '99+' : item.unreadCount}
                    </Text>
                  </View>
                )}
              </View>

              {/* 內容 */}
              <View style={styles.content}>
                <View style={styles.topRow}>
                  <Text style={[styles.name, item.unreadCount > 0 && styles.nameUnread]} numberOfLines={1}>
                    {item.otherUser?.name || '用戶'}
                  </Text>
                  <Text style={styles.time}>{formatTime(item.lastMessageAt)}</Text>
                </View>
                <Text style={[styles.lastMsg, item.unreadCount > 0 && styles.lastMsgUnread]} numberOfLines={1}>
                  {item.lastMessage || '開始聊天吧'}
                </Text>
                {item.post && (
                  <Text style={styles.postRef} numberOfLines={1}>
                    {item.post.brandName} {item.post.modelName}
                  </Text>
                )}
              </View>

              <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>暫無消息</Text>
              <Text style={styles.emptySubtitle}>瀏覽車源時點擊「站內聊天」開始對話</Text>
            </View>
          }
        />
      )}
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
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  headerTitle: { fontSize: 17, fontWeight: '600', color: APP_TEXT },
  unreadBadge: { backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center' },
  unreadBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  unreadBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: `${APP_ORANGE}10`, borderBottomWidth: 0.5, borderBottomColor: `${APP_ORANGE}30`,
  },
  unreadBannerText: { fontSize: 12, color: APP_ORANGE },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: APP_BORDER,
  },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: `${APP_ORANGE}20`, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: APP_ORANGE },
  badge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18,
    paddingHorizontal: 3, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  content: { flex: 1, minWidth: 0, gap: 3 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '500', color: APP_TEXT, flex: 1 },
  nameUnread: { fontWeight: '700' },
  time: { fontSize: 11, color: APP_GRAY, marginLeft: 8, flexShrink: 0 },
  lastMsg: { fontSize: 13, color: APP_GRAY },
  lastMsgUnread: { color: APP_TEXT, fontWeight: '500' },
  postRef: { fontSize: 11, color: APP_ORANGE },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: APP_TEXT, marginTop: 8 },
  emptySubtitle: { fontSize: 13, color: APP_GRAY },
});
