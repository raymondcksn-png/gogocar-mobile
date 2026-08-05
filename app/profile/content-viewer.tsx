/**
 * 內容查看頁 — 從後台 siteContent API 讀取 HTML 內容
 * 用於：關於我們 / 隱私權政策 / 條款與細則
 */
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { trpc } from '../../lib/trpc';
import { APP_BG, APP_TEXT, APP_GRAY, APP_BORDER, APP_ORANGE } from '../../constants/data';

export default function ContentViewerScreen() {
  const router = useRouter();
  const { key, title } = useLocalSearchParams<{ key: string; title: string }>();

  const { data, isLoading, error } = trpc.siteContent.getContent.useQuery(
    { key: key || 'about_us' },
    { enabled: !!key }
  );

  const content = (data as any)?.content || '';
  const pageTitle = (data as any)?.title || title || '內容';

  // 包裝 HTML 內容，確保字體和排版正確
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
        .updated { font-size: 12px; color: #9ca3af; margin-top: 24px; }
      </style>
    </head>
    <body>
      ${content || '<p style="color:#9ca3af;text-align:center;padding:40px 0;">暫無內容</p>'}
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={APP_TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{pageTitle}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={APP_ORANGE} />
          <Text style={styles.loadingText}>加載中...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={APP_GRAY} />
          <Text style={styles.errorText}>加載失敗，請稍後重試</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.retryText}>返回</Text>
          </TouchableOpacity>
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
        <ScrollView contentContainerStyle={styles.emptyWrap}>
          <Ionicons name="document-outline" size={48} color={APP_GRAY} />
          <Text style={styles.emptyText}>暫無內容</Text>
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
  webview: { flex: 1, backgroundColor: '#fff' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: APP_GRAY },
  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 32 },
  errorText: { fontSize: 15, color: APP_GRAY, textAlign: 'center' },
  retryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: APP_ORANGE, borderRadius: 8 },
  retryText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 80 },
  emptyText: { fontSize: 15, color: APP_GRAY },
});
