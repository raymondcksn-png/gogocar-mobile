/**
 * 個人資料編輯頁 — 對齊 WebApp AppProfile
 * 功能：修改暱稱 + 上傳頭像
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://gogocar853.manus.space';

export default function EditProfileScreen() {
  const router = useRouter();
  const { data: user, refetch } = trpc.auth.me.useQuery();
  // 暱稱預設值：優先 nickname，否則空字串（讓用戶自行填寫，placeholder 顯示帳號名稱）
  const [nickname, setNickname] = useState((user as any)?.nickname || '');
  // 頭像：確保使用完整 URL
  const resolveUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${API_BASE}${url}`;
  };
  const [avatar, setAvatar] = useState(resolveUrl((user as any)?.avatar || ''));
  const [uploading, setUploading] = useState(false);

  const updateMut = trpc.auth.updateProfile.useMutation({
    onSuccess: () => { refetch(); Alert.alert('保存成功', '個人資料已更新'); router.back(); },
    onError: (e: any) => Alert.alert('保存失敗', e.message),
  });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('需要相冊權限'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const formData = new FormData();
      // 動態確定 MIME type（支持 HEIC/HEIF）
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg',
        png: 'image/png', webp: 'image/webp',
        gif: 'image/gif', heic: 'image/jpeg', heif: 'image/jpeg',
      };
      const mimeType = mimeMap[ext] || 'image/jpeg';
      const fileName = `avatar.${ext === 'heic' || ext === 'heif' ? 'jpg' : ext}`;
      formData.append('file', { uri: asset.uri, type: mimeType, name: fileName } as any);
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        // 確保使用完整 URL 顯示
        const fullUrl = data.url.startsWith('http') ? data.url : `${API_BASE}${data.url}`;
        setAvatar(fullUrl);
      } else {
        Alert.alert('上傳失敗', data.error || '請重試');
      }
    } catch {
      Alert.alert('上傳失敗', '網絡錯誤，請重試');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    // 儲存時將完整 URL 轉回相對路徑（後端存儲格式）
    const avatarToSave = avatar ? avatar.replace(API_BASE, '') : undefined;
    updateMut.mutate({ nickname: nickname.trim() || undefined, avatar: avatarToSave });
  };

  const initials = ((user as any)?.nickname || (user as any)?.name || '?').charAt(0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>個人資料</Text>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={updateMut.isPending || uploading}
          activeOpacity={0.7}
        >
          {updateMut.isPending ? (
            <ActivityIndicator size="small" color={APP_ORANGE} />
          ) : (
            <Text style={styles.saveBtnText}>保存</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 頭像 */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrap} onPress={pickImage} activeOpacity={0.8}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.cameraBtn}>
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={16} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>點擊更換頭像（自動裁剪為圓形）</Text>
        </View>

        {/* 暱稱 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>暱稱</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder={`預設：${(user as any)?.name || '未設置'}`}
              placeholderTextColor={APP_GRAY}
              maxLength={30}
              returnKeyType="done"
            />
            <Text style={styles.charCount}>{nickname.length}/30</Text>
          </View>
        </View>

        {/* 帳號信息（只讀） */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>帳號信息</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>手機號碼</Text>
            <Text style={styles.infoValue}>{(user as any)?.phone || '未設置'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>用戶 ID</Text>
            <Text style={styles.infoValue}>#{(user as any)?.id}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>帳號名稱</Text>
            <Text style={styles.infoValue}>{(user as any)?.name || '未設置'}</Text>
          </View>
        </View>
      </ScrollView>
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: APP_TEXT },
  saveBtn: { width: 56, height: 40, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 8 },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: APP_ORANGE },
  avatarSection: { alignItems: 'center', paddingVertical: 32, backgroundColor: '#fff', marginTop: 16, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: APP_BORDER },
  avatarWrap: { position: 'relative' },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: { backgroundColor: `${APP_ORANGE}20`, justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 36, fontWeight: '700', color: APP_ORANGE },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: APP_ORANGE, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarHint: { marginTop: 10, fontSize: 13, color: APP_GRAY },
  section: { marginTop: 16, backgroundColor: '#fff', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: APP_BORDER, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 12, color: APP_GRAY, paddingTop: 12, paddingBottom: 4, fontWeight: '500' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: APP_BORDER },
  input: { flex: 1, fontSize: 15, color: APP_TEXT, padding: 0 },
  charCount: { fontSize: 12, color: APP_GRAY, marginLeft: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderTopWidth: 0.5, borderTopColor: APP_BORDER },
  infoLabel: { fontSize: 15, color: APP_TEXT },
  infoValue: { fontSize: 14, color: APP_GRAY },
});
