/**
 * Root Layout — GoGoCar Native App
 * 加入 ErrorBoundary 顯示崩潰錯誤而不是白屏
 */
import React, { useState, Component } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { AuthProvider } from '../contexts/AuthContext';
import { trpc, createTRPCClient } from '../lib/trpc';

// ── ErrorBoundary: 崩潰時顯示錯誤而不是白屏 ─────────────────────────────────
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }
class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errContainer}>
          <Text style={styles.errTitle}>❌ App 崩潰</Text>
          <ScrollView style={styles.errScroll}>
            <Text style={styles.errMsg}>{this.state.error?.message}</Text>
            <Text style={styles.errStack}>{this.state.error?.stack}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.errBtn} onPress={() => this.setState({ hasError: false, error: null })}>
            <Text style={styles.errBtnText}>重試</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errContainer: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  errTitle: { fontSize: 20, fontWeight: 'bold', color: '#e53e3e', marginBottom: 12 },
  errScroll: { flex: 1, backgroundColor: '#f7fafc', borderRadius: 8, padding: 12, marginBottom: 12 },
  errMsg: { fontSize: 14, color: '#c53030', fontWeight: '600', marginBottom: 8 },
  errStack: { fontSize: 11, color: '#718096', fontFamily: 'monospace' },
  errBtn: { backgroundColor: '#FF6B00', padding: 14, borderRadius: 8, alignItems: 'center' },
  errBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

// ── Root Layout ───────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
    },
  }));
  const [trpcClient] = useState(() => createTRPCClient());

  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="vehicle/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="chat/[roomId]" options={{ headerShown: false }} />
            </Stack>
          </AuthProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}
