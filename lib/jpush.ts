/**
 * JPush 極光推送核心模塊
 * 大廠標準：初始化 → 別名綁定（userId）→ 通知接收 → 點擊跳轉
 *
 * 注意：JPush 需要原生 SDK，必須通過 EAS Build 打包，不支持 Expo Go
 */

import { Platform } from 'react-native';

// 動態 import JPush（避免在 Expo Go 環境崩潰）
let JPush: any = null;

function getJPush() {
  if (JPush) return JPush;
  try {
    JPush = require('jpush-react-native');
    return JPush;
  } catch (e) {
    console.warn('[JPush] SDK not available (Expo Go environment)');
    return null;
  }
}

/**
 * 初始化 JPush SDK
 * 在 APP 啟動時調用（_layout.tsx）
 */
export function initJPush() {
  const sdk = getJPush();
  if (!sdk) return;

  try {
    sdk.initPush();
    console.log('[JPush] SDK initialized');

    // 申請通知權限（iOS）
    if (Platform.OS === 'ios') {
      sdk.requestPermission();
    }
  } catch (e) {
    console.error('[JPush] Init failed:', e);
  }
}

/**
 * 綁定用戶別名（登入後調用）
 * 別名格式：user_{userId}，與後端 pushNotification.ts 保持一致
 */
export function bindJPushAlias(userId: number) {
  const sdk = getJPush();
  if (!sdk) return;

  const alias = `user_${userId}`;
  try {
    sdk.setAlias(
      { sequence: 1, alias },
      (result: any) => {
        if (result.errorCode === 0) {
          console.log(`[JPush] Alias bound: ${alias}`);
        } else {
          console.warn(`[JPush] Alias bind failed: ${result.errorCode}`);
        }
      }
    );
  } catch (e) {
    console.error('[JPush] setAlias failed:', e);
  }
}

/**
 * 解綁別名（登出時調用）
 */
export function unbindJPushAlias() {
  const sdk = getJPush();
  if (!sdk) return;

  try {
    sdk.deleteAlias({ sequence: 2 }, (result: any) => {
      console.log('[JPush] Alias unbound');
    });
  } catch (e) {
    console.error('[JPush] deleteAlias failed:', e);
  }
}

/**
 * 監聽通知接收事件
 * 返回清理函數（在 useEffect 中使用）
 */
export function addJPushNotificationListener(
  onReceive: (notification: JPushNotification) => void,
  onOpen: (notification: JPushNotification) => void
): () => void {
  const sdk = getJPush();
  if (!sdk) return () => {};

  try {
    // 收到通知（APP 在前台）
    sdk.addReceiveNotificationListener((result: any) => {
      onReceive({
        title: result.title || '',
        content: result.content || result.alert || '',
        extras: result.extras || {},
      });
    });

    // 點擊通知（APP 在後台或被殺死）
    sdk.addReceiveOpenNotificationListener((result: any) => {
      onOpen({
        title: result.title || '',
        content: result.content || result.alert || '',
        extras: result.extras || {},
      });
    });

    return () => {
      try {
        sdk.removeReceiveNotificationListener();
        sdk.removeReceiveOpenNotificationListener();
      } catch (e) {}
    };
  } catch (e) {
    console.error('[JPush] addListener failed:', e);
    return () => {};
  }
}

/**
 * 獲取 Registration ID（設備唯一標識）
 * 可用於後台精確推送到指定設備
 */
export function getJPushRegistrationId(): Promise<string | null> {
  const sdk = getJPush();
  if (!sdk) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      sdk.getRegistrationID((result: any) => {
        resolve(result.registerID || null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

export interface JPushNotification {
  title: string;
  content: string;
  extras: Record<string, string>;
}
