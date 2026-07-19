/**
 * 通關頁面 — 澳門口岸實時情況
 * 對照 WebApp AppBorder.tsx
 */
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const APP_ORANGE = '#FF6B00';

function BorderEmptyIcon() {
  return (
    <Svg width={64} height={64} viewBox="0 0 24 24" fill="#3b82f6">
      <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93Zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39Z" />
    </Svg>
  );
}

export default function BorderScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>通關</Text>
        <Text style={styles.headerSubtitle}>澳門口岸實時情況</Text>
      </View>
      <View style={styles.body}>
        <BorderEmptyIcon />
        <Text style={styles.emptyTitle}>口岸通關資訊</Text>
        <Text style={styles.emptySubtitle}>功能開發中</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: APP_ORANGE,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8e8e93',
  },
});
