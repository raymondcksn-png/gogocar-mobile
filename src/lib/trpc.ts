/**
 * tRPC client for GoGoCar Native App
 * 連接至 https://gogocar853.manus.space
 */
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import * as SecureStore from 'expo-secure-store';

// ── tRPC React hooks ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc = createTRPCReact<any>();

// ── 生產 API 地址 ──────────────────────────────────────────────────────────────
const API_BASE_URL = 'https://gogocar853.manus.space';

// ── tRPC client factory ───────────────────────────────────────────────────────
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_BASE_URL}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = await SecureStore.getItemAsync('jwt_token');
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}

// ── 圖片 URL 解析（對照 WebApp resolveImageUrl）──────────────────────────────
export function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/manus-storage/') || url.startsWith('/uploads/')) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
}
