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
    // Android: JPushModule.init()，iOS: JPushModule.setupWithConfig(params)
    sdk.init({
      appKey: '9e51a43ba697aa616cc1daf2',
      channel: 'developer-default',
    });
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
    // 先添加 TagAlias 監聽器再設置別名
    sdk.addTagAliasListener((result: any) => {
      if (result.errorCode === 0) {
        console.log(`[JPush] Alias operation success: sequence=${result.sequence}`);
      } else {
        console.warn(`[JPush] Alias operation failed: errorCode=${result.errorCode}`);
      }
    });
    sdk.setAlias({ sequence: Date.now(), alias });
    console.log(`[JPush] setAlias called: ${alias}`);
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
    sdk.deleteAlias({ sequence: Date.now() });
    console.log('[JPush] deleteAlias called');
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
    // 收到通知（APP 在前台或後台）
    const receiveCallback = (result: any) => {
      onReceive({
        title: result.title || '',
        content: result.content || result.alert || '',
        extras: result.extras || {},
      });
    };
    // 點擊通知打開 APP
    const openCallback = (result: any) => {
      onOpen({
        title: result.title || '',
        content: result.content || result.alert || '',
        extras: result.extras || {},
      });
    };
    sdk.addNotificationListener(receiveCallback);
    sdk.addNotificationListener(openCallback);
    return () => {
      try {
        sdk.removeListener(receiveCallback);
        sdk.removeListener(openCallback);
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
        const regId = result.registerID || result.registrationID || null;
        console.log('[JPush] Registration ID:', regId);
        resolve(regId);
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
