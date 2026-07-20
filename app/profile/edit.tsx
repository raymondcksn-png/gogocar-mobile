/**
 * 個人資料編輯頁
 * API: trpc.auth.updateProfile
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../contexts/AuthContext';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const updateMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: (data) => {
      if (user) {
        refreshUser({ ...user, name: data.name });
      }
      setSaving(false);
      Alert.alert('成功', '個人資料已更新', [
        { text: '確定', onPress: () => router.back() },
      ]);
    },
    onError: (err) => {
      setSaving(false);
      Alert.alert('更新失敗', err.message || '請稍後重試');
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('提示', '請輸入暱稱');
      return;
    }
    setSaving(true);
    updateMutation.mutate({ name: name.trim() });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>編輯資料</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving ? (
            <ActivityIndicator color={APP_ORANGE} size="small" />
          ) : (
            <Text style={styles.saveBtnText}>保存</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>暱稱</Text>
          <TextInput
            style={styles.input}
            placeholder="輸入您的暱稱"
            placeholderTextColor={APP_GRAY}
            value={name}
            onChangeText={setName}
            maxLength={20}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>手機號碼</Text>
          <View style={styles.readonlyField}>
            <Text style={styles.readonlyText}>{user?.phone ? `+853 ${user.phone}` : '未綁定'}</Text>
          </View>
          <Text style={styles.hint}>手機號碼不可修改</Text>
        </View>
      </ScrollView>
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
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backText: { fontSize: 28, color: APP_TEXT, marginTop: -4 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: APP_TEXT },
  saveBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: APP_ORANGE },
  section: { backgroundColor: '#fff', marginTop: 8, padding: 16 },
  fieldLabel: { fontSize: 13, color: APP_GRAY, marginBottom: 8 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: APP_BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: APP_TEXT,
  },
  readonlyField: {
    height: 44,
    borderWidth: 1,
    borderColor: APP_BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    backgroundColor: '#f5f5f7',
  },
  readonlyText: { fontSize: 15, color: APP_GRAY },
  hint: { fontSize: 12, color: APP_GRAY, marginTop: 6 },
});
