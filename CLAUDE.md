# 戰爭即工業力｜交錯地帶 — 專案說明

張威翔的新聞數據視覺化專案，部署於 GitHub Pages。所有頁面為獨立 HTML 檔案，可嵌入 iframe 使用。

## 部署

- **平台**：GitHub Pages，repo: `kayhase015497/war-industry-news`
- **上線網址**：`https://kayhase015497.github.io/war-industry-news/`
- **觸發條件**：push 到 `main` branch 後，CI 自動部署（約 2~5 分鐘）
- **工作流程**：`.github/workflows/static.yml`（含 game-v2 Vite build）

## 開發慣例

### Branch
- 所有新功能在 feature branch 開發，完成後 merge 到 `main`
- Claude Code session 自動分配 branch，開發完直接 merge main 推送即可

### 頁面風格（所有 HTML 都應遵守）
- **語言**：繁體中文（zh-Hant）
- **主題**：深色（背景 `#0b0f1a` 或近似深藍黑）
- **字型**：`Noto Sans TC` 或 `Noto Serif TC`（中文）+ `Space Mono`（數字/標籤）
- **設計系統**：無框架，純 CSS + Vanilla JS
- **iframe 友善**：CSS class 加命名空間前綴（如 `.ue-`、`.cri-`），避免污染外部樣式
- **RWD**：行動優先，用 `clamp()` 處理字型大小，breakpoint 約 900px

### 常用外部資源（CDN）
- D3.js v7：`https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js`
- TopoJSON：`https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js`
- US Atlas：`https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json`
- Leaflet 1.9.4：`https://unpkg.com/leaflet@1.9.4/`
- Google Fonts：Noto Sans TC / Noto Serif TC / Space Mono

## 目錄結構

```
war-industry-news/
├── index.html                  # 首頁
├── CLAUDE.md                   # 本文件
├── misc-data/                  # 數據視覺化頁面（可 iframe 嵌入）
│   ├── us-election-2026.html       # 美國期中選舉前台（含互動地圖）
│   ├── us-election-2026-data.json  # 選舉資料（編輯室更新用）
│   ├── us-election-2026-admin.html # 選舉後台管理 UI
│   ├── china-russia-infra-embed.html
│   ├── philippines-timeline-rwd.html
│   └── ...（其他數據頁面）
├── war-map/                    # 戰場地圖頁面（Leaflet）
│   ├── siterep.html
│   ├── data/                   # 各地圖的 GeoJSON / TopoJSON 資料
│   └── ...
├── game-v2/                    # Phaser 互動遊戲（Vite 建置）
│   ├── src/
│   ├── dist/                   # 建置產出（CI 自動產生）
│   └── package.json
├── images/
├── music/
└── .github/workflows/static.yml
```

## 美國期中選舉頁面（2026）

### 前台
- **網址**：`/misc-data/us-election-2026.html`
- D3 + TopoJSON SVG 地圖、參眾院席次計分板、關鍵選區列表
- 每 60 秒自動 fetch `us-election-2026-data.json` 更新資料

### 資料格式（`us-election-2026-data.json`）
```json
{
  "meta": { "lastUpdated": "ISO 8601 -05:00", "reporting": "已開出 XX%", "source": "...", "note": "..." },
  "senate": { "dem": { "seats": 0, "net": 0 }, "rep": {...}, "ind": {...}, "uncalled": 0, "total": 100, "threshold": 51, "currentControl": "R" },
  "house":  { ... "total": 435, "threshold": 218 },
  "governor": { ... "total": 50 },
  "states": {
    "TX": { "winner": "R", "called": true, "margin": 10.0, "office": "Senate" }
  },
  "keyRaces": [
    { "id": "PA-S", "state": "PA", "stateName": "賓夕法尼亞州", "office": "Senate",
      "dem": { "name": "候選人", "pct": 49.2, "votes": 0 },
      "rep": { "name": "候選人", "pct": 50.1, "votes": 0 },
      "reporting": 87, "called": false, "winner": null, "competitive": true }
  ]
}
```

### 後台管理 UI
- **網址**：`/misc-data/us-election-2026-admin.html`
- 需要 GitHub Classic PAT（勾選完整 `repo` scope）
- Token 存在 sessionStorage，關閉分頁後自動清除
- 功能：從 GitHub 載入 → 表單編輯 → 直接透過 API 推送 JSON → 前台 2 分鐘後更新
- **Ctrl+S** 快速推送

### 嵌入碼
```html
<iframe src="https://kayhase015497.github.io/war-industry-news/misc-data/us-election-2026.html"
  width="100%" height="900" frameborder="0"
  style="border:none;max-width:100%"></iframe>
```

## 新增頁面 SOP

1. 在 `misc-data/` 或 `war-map/` 建立新 HTML 檔案
2. 採用深色主題、繁中、Space Mono 標籤
3. CSS class 加命名空間前綴防衝突
4. 確認 RWD（測試 375px 與 1200px）
5. Merge 到 `main` 觸發部署
