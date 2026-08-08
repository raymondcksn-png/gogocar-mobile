/**
 * GA4 Firebase Analytics 模塊
 * 使用 Measurement Protocol for Firebase（純 HTTP API，無需原生 SDK）
 * 文檔：https://developers.google.com/analytics/devguides/collection/protocol/ga4
 *
 * 工作原理：
 * 1. APP 啟動時從後台讀取 ga4Firebase 配置（streamId + apiSecret）
 * 2. 生成設備唯一 client_id（存儲在 AsyncStorage）
 * 3. 通過 HTTP POST 發送事件到 GA4 Measurement Protocol API
 * 4. 完全不需要 EAS Build，純 JS 實現
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
// Firebase APP 串流使用 firebase_app_id（非網頁串流的 measurement_id）
// 文檔：https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=firebase
const CLIENT_ID_KEY = '@gogocar_ga4_client_id';

interface GA4Config {
  ios: { appId: string; streamId: string; apiSecret: string };
  android: { appId: string; streamId: string; apiSecret: string };
}

interface AnalyticsState {
  config: GA4Config | null;
  clientId: string | null;
  appInstanceId: string | null;
}

const state: AnalyticsState = {
  config: null,
  clientId: null,
  appInstanceId: null,
};

/**
 * 生成或讀取設備唯一 client_id
 */
async function getOrCreateClientId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(CLIENT_ID_KEY);
    if (stored) return stored;
    // 生成新的 client_id（UUID v4 格式）
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    await AsyncStorage.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    return `fallback_${Date.now()}`;
  }
}

/**
 * 初始化 Analytics（APP 啟動時調用）
 * 傳入從後台讀取的 ga4Firebase 配置
 */
export async function initAnalytics(config: GA4Config | null): Promise<void> {
  if (!config) {
    console.log('[Analytics] No GA4 config, analytics disabled');
    return;
  }
  state.config = config;
  state.clientId = await getOrCreateClientId();
  // app_instance_id 使用 clientId 的 hash（GA4 要求 int64 格式）
  state.appInstanceId = Math.abs(
    state.clientId.split('').reduce((a, c) => (a << 5) - a + c.charCodeAt(0), 0)
  ).toString();
  console.log('[Analytics] Initialized, clientId:', state.clientId?.substring(0, 8) + '...');
}

/**
 * 發送 GA4 事件
 * @param eventName 事件名稱（snake_case）
 * @param params 事件參數
 */
export async function logEvent(
  eventName: string,
  params: Record<string, string | number | boolean> = {}
): Promise<void> {
  if (!state.config || !state.clientId) return;

  const platformConfig = Platform.OS === 'ios' ? state.config.ios : state.config.android;
  const { streamId, apiSecret, appId } = platformConfig;

  // Firebase APP 串流必須用 firebase_app_id（不是 measurement_id/streamId）
  const url = `${GA4_ENDPOINT}?firebase_app_id=${encodeURIComponent(appId)}&api_secret=${apiSecret}`;

  const payload = {
    client_id: state.clientId,
    non_personalized_ads: false,
    events: [{
      name: eventName,
      params: {
        ...params,
        app_id: appId,
        platform: Platform.OS,
        engagement_time_msec: 1,
        ...(state.appInstanceId ? { app_instance_id: state.appInstanceId } : {}),
      },
    }],
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (resp.status === 204) {
      console.log(`[Analytics] Event sent: ${eventName}`);
    } else {
      console.warn(`[Analytics] Event failed: ${eventName}, status: ${resp.status}`);
    }
  } catch (e) {
    // 靜默失敗，不影響用戶體驗
    console.warn(`[Analytics] Network error for event: ${eventName}`);
  }
}

// ─── 預定義事件（大廠標準命名）───

/** APP 啟動 */
export const trackAppOpen = () => logEvent('app_open');

/** 頁面瀏覽 */
export const trackScreenView = (screenName: string) =>
  logEvent('screen_view', { screen_name: screenName, screen_class: screenName });

/** 車源詳情頁瀏覽 */
export const trackVehicleView = (vehicleId: string | number, title: string, price?: number) =>
  logEvent('view_item', {
    item_id: String(vehicleId),
    item_name: title,
    ...(price ? { value: price, currency: 'HKD' } : {}),
  });

/** 搜索 */
export const trackSearch = (searchTerm: string) =>
  logEvent('search', { search_term: searchTerm });

/** 發佈車源 */
export const trackPublishVehicle = (vehicleId: string | number) =>
  logEvent('generate_lead', { item_id: String(vehicleId), lead_source: 'vehicle_publish' });

/** 登入 */
export const trackLogin = (method: string = 'phone') =>
  logEvent('login', { method });

/** 收藏車源 */
export const trackAddToWishlist = (vehicleId: string | number, title: string) =>
  logEvent('add_to_wishlist', { item_id: String(vehicleId), item_name: title });

/** iPoint 充值 */
export const trackPurchase = (amount: number, currency: string = 'HKD') =>
  logEvent('purchase', { value: amount, currency });
