/**
 * tRPC client for GoGoCar Native App
 *
 * API 地址配置（本地部署說明）：
 * ─────────────────────────────────────────────────────────────────────────────
 * 修改 app.json 的 extra.apiBaseUrl 即可切換伺服器，無需改代碼：
 *
 *   "extra": {
 *     "apiBaseUrl": "http://192.168.1.100:3000"   // 局域網 IP（測試用）
 *     "apiBaseUrl": "https://your-domain.com"      // 自有域名（生產用）
 *   }
 *
 * 預設值：https://gogocar853.manus.space（Manus 雲端，開發環境）
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// ── tRPC React hooks ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc = createTRPCReact<any>();

// ── API 地址（從 app.json extra.apiBaseUrl 讀取，fallback 到 Manus 雲端）────
export const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'https://gogocar853.manus.space';

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
// 相對路徑（/manus-storage/... 或 /uploads/...）自動補全為絕對 URL
export function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/manus-storage/') || url.startsWith('/uploads/')) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
}
