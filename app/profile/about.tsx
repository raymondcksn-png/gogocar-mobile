/**
 * 關於我們頁 — 讀取後台 siteContent API（key: about_us）
 * 對齊 WebApp AppAbout
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../lib/trpc';
import { APP_ORANGE, APP_BG, APP_TEXT, APP_GRAY, APP_BORDER } from '../../constants/data';

export default function AboutScreen() {
  const router = useRouter();
  const { data, isLoading } = trpc.siteContent.getContent.useQuery({ key: 'about_us' });

  const content = (data as any)?.content || '';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, 'PingFang TC', 'Heiti TC', sans-serif;
          font-size: 15px;
          line-height: 1.7;
          color: #1f2937;
          padding: 16px;
          background: #fff;
          word-break: break-word;
        }
        h1, h2, h3 { color: #111827; margin: 16px 0 8px; font-weight: 600; }
        h1 { font-size: 20px; }
        h2 { font-size: 17px; }
        h3 { font-size: 15px; }
        p { margin: 8px 0; color: #374151; }
        ul, ol { padding-left: 20px; margin: 8px 0; }
        li { margin: 4px 0; }
        a { color: #F97316; text-decoration: none; }
        strong { font-weight: 600; }
        hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
      </style>
    </head>
    <body>${content}</body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>關於我們</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Logo + 版本 */}
      <View style={styles.logoSection}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>🚗</Text>
        </View>
        <Text style={styles.appName}>GoGoCar 2.0</Text>
        <Text style={styles.version}>版本 2.0.0</Text>
      </View>

      {/* 後台內容 */}
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={APP_ORANGE} />
        </View>
      ) : content ? (
        <WebView
          source={{ html: htmlContent }}
          style={styles.webview}
          showsVerticalScrollIndicator={false}
          scrollEnabled
          originWhitelist={['*']}
          javaScriptEnabled={false}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* 後台無內容時顯示預設文字 */}
          <View style={styles.section}>
            <Text style={styles.desc}>
              GoGoCar 是澳門領先的二手車買賣平台，連接粵港澳三地車主與車商。我們致力於提供安全、透明、便捷的二手車交易體驗。
            </Text>
          </View>

          {/* 快速連結 */}
          <View style={styles.linkSection}>
            {[
              { icon: 'globe', label: '官方網站', url: 'https://gogocar853.manus.space' },
              { icon: 'call', label: '客服熱線', url: 'tel:+85366993008' },
              { icon: 'logo-whatsapp', label: 'WhatsApp', url: 'https://wa.me/85366993008' },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.linkRow}
                onPress={() => Linking.openURL(item.url)}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon as any} size={18} color={APP_ORANGE} />
                <Text style={styles.linkText}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.copyright}>© 2025 GoGoCar. All rights reserved.</Text>
        </ScrollView>
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: APP_TEXT },
  logoSection: {
    alignItems: 'center', paddingVertical: 28, backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: APP_BORDER,
  },
  logoCircle: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: `${APP_ORANGE}15`,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  logoText: { fontSize: 36 },
  appName: { fontSize: 20, fontWeight: '700', color: APP_TEXT },
  version: { fontSize: 13, color: APP_GRAY, marginTop: 4 },
  webview: { flex: 1, backgroundColor: '#fff' },
  loadingWrap: { paddingVertical: 24, alignItems: 'center' },
  section: { marginHorizontal: 16, marginTop: 16, marginBottom: 8, padding: 16, backgroundColor: '#fff', borderRadius: 12 },
  desc: { fontSize: 14, color: APP_GRAY, lineHeight: 22 },
  linkSection: { marginTop: 16, backgroundColor: '#fff', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: APP_BORDER },
  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: APP_BORDER,
  },
  linkText: { flex: 1, fontSize: 15, color: APP_TEXT },
  copyright: { textAlign: 'center', fontSize: 12, color: APP_GRAY, paddingVertical: 24 },
});
