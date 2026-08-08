/**
 * 自定義 JPush Config Plugin
 * 直接注入 JPUSH_APPKEY 和 JPUSH_CHANNEL 到 AndroidManifest.xml
 * 替代有問題的 jpush-expo-config-plugin（其 index.js 為空文件）
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const JPUSH_APPKEY = '9e51a43ba697aa616cc1daf2';
const JPUSH_CHANNEL = 'developer-default';

function withJPushAndroid(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    if (!mainApplication['meta-data']) {
      mainApplication['meta-data'] = [];
    }

    // 移除舊的 JPUSH meta-data（如有）
    mainApplication['meta-data'] = mainApplication['meta-data'].filter(
      (item) =>
        item.$['android:name'] !== 'JPUSH_APPKEY' &&
        item.$['android:name'] !== 'JPUSH_CHANNEL'
    );

    // 注入 JPUSH_APPKEY
    mainApplication['meta-data'].push({
      $: {
        'android:name': 'JPUSH_APPKEY',
        'android:value': JPUSH_APPKEY,
      },
    });

    // 注入 JPUSH_CHANNEL
    mainApplication['meta-data'].push({
      $: {
        'android:name': 'JPUSH_CHANNEL',
        'android:value': JPUSH_CHANNEL,
      },
    });

    console.log('[JPush Plugin] Injected JPUSH_APPKEY:', JPUSH_APPKEY);
    console.log('[JPush Plugin] Injected JPUSH_CHANNEL:', JPUSH_CHANNEL);

    return config;
  });
}

module.exports = withJPushAndroid;
