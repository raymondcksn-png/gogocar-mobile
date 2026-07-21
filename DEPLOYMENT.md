# GoGoCar Mobile — 本地伺服器部署指南

## 切換 API 伺服器地址

只需修改 `app.json` 中的 `extra.apiBaseUrl`，**無需改任何代碼**：

```json
{
  "expo": {
    "extra": {
      "apiBaseUrl": "https://your-domain.com"
    }
  }
}
```

### 常見場景

| 場景 | apiBaseUrl 值 |
|------|--------------|
| 開發（Manus 雲端） | `https://gogocar853.manus.space`（預設） |
| 局域網測試 | `http://192.168.1.100:3000` |
| 自有域名生產環境 | `https://your-domain.com` |

修改後需重新執行 `eas update` 或重新 build APP 才能生效。

---

## Manus 依賴清單（本地部署需處理）

### Native APP（gogocar-mobile）— 無 Manus npm 依賴 ✅

| 項目 | 處理方式 |
|------|---------|
| API 地址 | 修改 `app.json` 的 `extra.apiBaseUrl` |
| 分享/WhatsApp URL | 自動跟隨 `apiBaseUrl` |
| EAS Update（OTA）| 本地部署後不可用，需重新 build APK/IPA |

### 後端（gogocar20）— 雙軌存儲已就緒 ✅

| 項目 | 本地部署狀態 |
|------|------------|
| SMS OTP（創藍253） | ✅ 直接調用 `smssh1.253.com`，無 Manus 依賴 |
| 手機號登入/註冊 | ✅ bcrypt + JWT，完全獨立 |
| 圖片/文件存儲 | ✅ 無 `BUILT_IN_FORGE_API_KEY` 時自動用本地 `/uploads/` |
| 管理員登入 | ⚠️ 目前用 Manus OAuth，本地部署需配置替代方案 |
| Google Maps | ⚠️ 目前走 Manus Forge 代理，本地部署需直接配置 Google Maps API Key |

---

## 本地部署環境變量（後端 .env）

```env
# 必填
DATABASE_URL=mysql://user:pass@localhost:3306/gogocar
JWT_SECRET=your-random-secret-here

# 創藍253 SMS（OTP 驗證碼）
CHUANGLAN_ACCOUNT=your-account
CHUANGLAN_PASSWORD=your-password

# 存儲（留空則自動使用本地 /uploads/ 目錄）
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
```
