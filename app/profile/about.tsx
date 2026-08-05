/**
 * 關於 GoGoCar 頁
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

export default function AboutScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>關於 GoGoCar</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>🚗</Text>
          </View>
          <Text style={styles.appName}>GoGoCar 2.0</Text>
          <Text style={styles.version}>版本 2.0.0</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.desc}>
            GoGoCar 是澳門領先的二手車買賣平台，連接粵港澳三地車主與車商。我們致力於提供安全、透明、便捷的二手車交易體驗。
          </Text>
        </View>
        <View style={styles.linkSection}>
          {[
            { icon: 'globe', label: '官方網站', url: 'https://gogocar853.manus.space' },
            { icon: 'call', label: '客服熱線', url: 'tel:+85366563101' },
            { icon: 'document-text', label: '用戶協議', url: 'https://gogocar853.manus.space/terms' },
            { icon: 'shield-checkmark', label: '隱私政策', url: 'https://gogocar853.manus.space/privacy' },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.linkRow} onPress={() => Linking.openURL(item.url)} activeOpacity={0.7}>
              <Ionicons name={item.icon as any} size={18} color={APP_ORANGE} />
              <Text style={styles.linkText}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.copyright}>© 2025 GoGoCar. All rights reserved.</Text>
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
  logoSection: { alignItems: 'center', paddingVertical: 40 },
  logoCircle: { width: 80, height: 80, borderRadius: 20, backgroundColor: `${APP_ORANGE}15`, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  logoText: { fontSize: 40 },
  appName: { fontSize: 22, fontWeight: '700', color: APP_TEXT },
  version: { fontSize: 14, color: APP_GRAY, marginTop: 4 },
  section: { marginHorizontal: 16, marginBottom: 16, padding: 16, backgroundColor: '#fff', borderRadius: 12 },
  desc: { fontSize: 14, color: APP_GRAY, lineHeight: 22 },
  linkSection: { backgroundColor: '#fff', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: APP_BORDER },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: APP_BORDER },
  linkText: { flex: 1, fontSize: 15, color: APP_TEXT },
  copyright: { textAlign: 'center', fontSize: 12, color: APP_GRAY, paddingVertical: 24 },
});
