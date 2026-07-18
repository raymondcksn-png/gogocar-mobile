/**
 * 我的消息頁 — 聊天室列表
 * API: trpc.chat.getRooms
 */
import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

export default function MessagesScreen() {
  const router = useRouter();
  const { data, isLoading } = trpc.chat.getRooms.useQuery();
  const rooms = data?.rooms || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>我的消息</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.loading}><ActivityIndicator color={APP_ORANGE} size="large" /></View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.room}
              onPress={() => router.push(`/chat/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.otherUser?.name || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.roomInfo}>
                <Text style={styles.roomName}>{item.otherUser?.name || `用戶 ${item.otherUser?.id}`}</Text>
                <Text style={styles.lastMsg} numberOfLines={1}>
                  {item.lastMessage?.content || '暫無消息'}
                </Text>
              </View>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>暫無消息</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: APP_BORDER,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backText: { fontSize: 28, color: APP_TEXT, marginTop: -4 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: APP_TEXT },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  room: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: APP_BORDER,
    gap: 12,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  roomInfo: { flex: 1 },
  roomName: { fontSize: 15, fontWeight: '600', color: APP_TEXT, marginBottom: 4 },
  lastMsg: { fontSize: 13, color: APP_GRAY },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  empty: { textAlign: 'center', paddingVertical: 40, color: APP_GRAY, fontSize: 14 },
});
