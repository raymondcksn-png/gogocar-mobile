/**
 * 聊天室頁 — Sprint D2 完善版
 * 新增：車源信息卡片、對方用戶名、消息時間戳、分頁加載
 * API: trpc.chat.getRoomInfo + trpc.chat.getMessages + trpc.chat.sendMessage
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { trpc, resolveImageUrl } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

function formatTime(ts: number | string | Date): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return `昨天 ${d.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('zh-HK', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ChatRoomScreen() {
  const { roomId, title: titleParam } = useLocalSearchParams<{ roomId: string; title?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);

  // 獲取聊天室信息（對方用戶 + 車源卡片）
  const { data: roomInfo } = (trpc as any).chat.getRoomInfo.useQuery(
    { roomId: Number(roomId) },
    { enabled: !!roomId }
  );

  // 獲取消息（輪詢 5s）
  const { data, isLoading, refetch } = trpc.chat.getMessages.useQuery(
    { roomId: Number(roomId), limit: 30 } as any,
    { enabled: !!roomId, refetchInterval: 5000 }
  );

  const sendMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setInput('');
      refetch();
    },
  });

  // 初始化消息列表
  useEffect(() => {
    if (data?.messages) {
      setAllMessages(data.messages);
    }
  }, [data?.messages]);

  // 新消息時滾動到底部
  useEffect(() => {
    if (allMessages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [allMessages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMutation.mutate({ roomId: Number(roomId), content: input.trim() } as any);
  };

  const otherUser = roomInfo?.otherUser;
  const post = roomInfo?.post;
  const headerTitle = otherUser?.name || titleParam || '聊天';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* 頂部欄 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
          {otherUser && <Text style={styles.headerSub}>GoGoCar 用戶</Text>}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* 車源信息卡片（如有） */}
      {post && (
        <TouchableOpacity
          style={styles.postCard}
          onPress={() => router.push(`/vehicle/${post.id}` as any)}
          activeOpacity={0.8}
        >
          {post.coverImage ? (
            <Image source={{ uri: resolveImageUrl(post.coverImage) || post.coverImage }} style={styles.postImg} />
          ) : (
            <View style={[styles.postImg, { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ fontSize: 20 }}>🚗</Text>
            </View>
          )}
          <View style={styles.postInfo}>
            <Text style={styles.postTitle} numberOfLines={1}>{post.title || `${post.brandName} ${post.modelName}`}</Text>
            <Text style={styles.postMeta}>{post.year}年 · MOP {post.price?.toLocaleString()}</Text>
          </View>
          <Text style={styles.postArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* 消息列表 */}
      {isLoading ? (
        <View style={styles.loading}><ActivityIndicator color={APP_ORANGE} /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={allMessages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>發送第一條消息開始聊天 👋</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isMine = item.senderId === user?.id;
            const prevItem = allMessages[index - 1];
            const showTime = !prevItem || (new Date(item.createdAt).getTime() - new Date(prevItem.createdAt).getTime()) > 5 * 60 * 1000;
            return (
              <>
                {showTime && (
                  <Text style={styles.timeLabel}>{formatTime(item.createdAt)}</Text>
                )}
                <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
                  {!isMine && (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(otherUser?.name || '?')[0]}</Text>
                    </View>
                  )}
                  <View style={[styles.msgBubble, isMine ? styles.msgBubbleMine : styles.msgBubbleOther]}>
                    <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.content}</Text>
                  </View>
                </View>
              </>
            );
          }}
        />
      )}

      {/* 輸入欄 */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="輸入消息..."
          placeholderTextColor={APP_GRAY}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sendMutation.isPending}
          activeOpacity={0.8}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendBtnText}>發送</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_BG },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    borderBottomWidth: 0.5, borderBottomColor: APP_BORDER,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 28, color: APP_TEXT, marginTop: -4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: APP_TEXT },
  headerSub: { fontSize: 11, color: APP_GRAY, marginTop: 1 },
  // 車源卡片
  postCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: APP_BORDER,
  },
  postImg: { width: 52, height: 40, borderRadius: 6, marginRight: 10 },
  postInfo: { flex: 1 },
  postTitle: { fontSize: 13, fontWeight: '600', color: APP_TEXT },
  postMeta: { fontSize: 12, color: APP_ORANGE, marginTop: 2 },
  postArrow: { fontSize: 20, color: APP_GRAY, marginLeft: 8 },
  // 消息
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageList: { padding: 16, gap: 4, paddingBottom: 8 },
  emptyWrap: { flex: 1, paddingTop: 60, alignItems: 'center' },
  emptyText: { fontSize: 14, color: APP_GRAY },
  timeLabel: { textAlign: 'center', fontSize: 11, color: APP_GRAY, marginVertical: 8 },
  msgRow: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'flex-end', marginVertical: 2 },
  msgRowMine: { justifyContent: 'flex-end' },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: `${APP_ORANGE}20`, justifyContent: 'center', alignItems: 'center',
    marginRight: 8, marginBottom: 2,
  },
  avatarText: { fontSize: 13, fontWeight: '700', color: APP_ORANGE },
  msgBubble: { maxWidth: '72%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  msgBubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  msgBubbleMine: { backgroundColor: APP_ORANGE, borderBottomRightRadius: 4 },
  msgText: { fontSize: 15, color: APP_TEXT, lineHeight: 20 },
  msgTextMine: { color: '#fff' },
  // 輸入欄
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 0.5, borderTopColor: APP_BORDER, gap: 10,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 100,
    borderWidth: 1, borderColor: APP_BORDER, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: APP_TEXT,
  },
  sendBtn: { height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#ffb380' },
  sendBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
