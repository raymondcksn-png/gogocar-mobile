/**
 * 聊天室頁 — 站內聊天
 * API: trpc.chat.getMessages + trpc.chat.sendMessage
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

export default function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const { data, isLoading, refetch } = trpc.chat.getMessages.useQuery(
    { roomId: Number(roomId) },
    { enabled: !!roomId, refetchInterval: 5000 }
  );

  const sendMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setInput('');
      refetch();
    },
  });

  const messages = data?.messages || [];

  const handleSend = () => {
    if (!input.trim()) return;
    sendMutation.mutate({ roomId: Number(roomId), content: input.trim() });
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

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
        <Text style={styles.headerTitle}>聊天</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 消息列表 */}
      {isLoading ? (
        <View style={styles.loading}><ActivityIndicator color={APP_ORANGE} /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => {
            const isMine = item.senderId === user?.id;
            return (
              <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
                <View style={[styles.msgBubble, isMine ? styles.msgBubbleMine : styles.msgBubbleOther]}>
                  <Text style={[styles.msgText, isMine && styles.msgTextMine]}>
                    {item.content}
                  </Text>
                </View>
              </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: APP_BORDER,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  backText: { fontSize: 28, color: APP_TEXT, marginTop: -4 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: APP_TEXT },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageList: { padding: 16, gap: 8 },
  msgRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  msgRowMine: { justifyContent: 'flex-end' },
  msgBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  msgBubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  msgBubbleMine: { backgroundColor: APP_ORANGE, borderBottomRightRadius: 4 },
  msgText: { fontSize: 15, color: APP_TEXT, lineHeight: 20 },
  msgTextMine: { color: '#fff' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: APP_BORDER,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: APP_BORDER,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: APP_TEXT,
  },
  sendBtn: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: APP_ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#ffb380' },
  sendBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
