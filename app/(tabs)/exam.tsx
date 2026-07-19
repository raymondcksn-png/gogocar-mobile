/**
 * 考車頁面 — 澳門駕校資訊
 * 對照 WebApp AppDriving.tsx
 */
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const APP_ORANGE = '#FF6B00';

function DrivingIcon() {
  return (
    <Svg width={64} height={64} viewBox="0 0 24 24" fill={APP_ORANGE}>
      <Path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 2a7 7 0 0 1 6.93 6h-4.66a2.5 2.5 0 0 0-4.54 0H5.07A7 7 0 0 1 12 5Zm-1 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm-5.93 1h4.66a2.5 2.5 0 0 0 1.77 1.77V18.93A7 7 0 0 1 5.07 13Zm7.93 5.93V14.77A2.5 2.5 0 0 0 14.27 13h4.66A7 7 0 0 1 13 18.93Z" />
    </Svg>
  );
}

export default function ExamScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>考車</Text>
        <Text style={styles.headerSubtitle}>澳門駕校資訊</Text>
      </View>
      <View style={styles.body}>
        <DrivingIcon />
        <Text style={styles.emptyTitle}>考車功能開發中</Text>
        <Text style={styles.emptyDesc}>澳門各大駕校資訊、報名指引即將上線</Text>
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
    gap: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c1c1e',
  },
  emptyDesc: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
