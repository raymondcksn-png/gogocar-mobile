const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 啟用 package.json exports 字段解析（支持 ESM 包如 superjson v2 的 copy-anything 依賴）
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
