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
├── medias/                     # 前台圖文區塊的 GIF／圖片／MP4（後台可直接上傳）
├── images/
├── music/
└── .github/workflows/static.yml
```

## 美國期中選舉頁面（2026）

### 前台
- **網址**：`/misc-data/us-election-2026.html`
- **兩層結構（單一 iframe 內以網址 hash 切換）**：第一層專頁首頁（`#` 或無 hash）→ 第二層子頁 `#p1`…`#p6`
  - p1 選舉全解析／p2 眾議院決戰／p3 參議院關鍵戰／p4 民調預測／p5 開票結果專區（地圖＋計分板＋戰區列表）／p6 深度分析
  - p1–p4、p6 是「圖文子頁」：顯示 `stories` 中 `page` 等於該頁 id 的圖文卡；沒內容顯示「內容準備中」
  - 首頁卡片封面＝該子頁第一張圖片/影片；p5 卡片有 LIVE 標；`#p5` 可直接深層連結到開票專區
  - 頂列（sticky）：返回首頁、6 顆子頁標籤、亮暗切換；整頁 `max-width:1280px` 置中，未來可直接作為獨立滿版網站部署（`MEDIA_BASE` 常數可調整 medias 路徑）
- D3 + TopoJSON SVG 地圖、參眾院席次計分板、關鍵選區列表（位於 p5）
- 每 60 秒自動 fetch `us-election-2026-data.json` 更新資料
- 預設亮色，右上角可切換暗色（記憶在 localStorage；網址參數 `?theme=dark|light` 優先，方便 CMS 嵌入時指定）
- 字體：標題/大數字 Noto Serif TC、內文 Noto Sans TC、標籤與數字 Barlow Condensed（CSS 變數 `--ff-display/--ff-body/--ff-label`）；`?font=b|c` 可臨時預覽其他字體組合（LXGW WenKai TC／Chiron GoRound TC），定案後可移除

### 資料格式（`us-election-2026-data.json`）
```json
{
  "meta": { "lastUpdated": "ISO 8601 -05:00", "reporting": "已開出 XX%", "source": "...", "note": "..." },
  "senate": { "dem": { "seats": 0, "net": 0 }, "rep": {...}, "ind": {...}, "uncalled": 0, "total": 100, "threshold": 51, "currentControl": "R" },
  "house":  { ... "total": 435, "threshold": 218 },
  "governor": { ... "total": 50 },
  "hub": { "title": "首頁大標", "subtitle": "首頁副標" },
  "topics": [ { "id": "p1", "name": "子頁名稱", "headline": "一句話說明" } ],   // p1–p6 固定六筆
  "stories": [ { "id": "s-1", "page": "p1", "title": "標題", "text": "文字", "src": "medias/xxx.mp4 或 https://… 或 YouTube/Vimeo 連結",
      "links": [ { "url": "https://www.chinatimes.com/…", "title": "報導標題" } ] } ],
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
- 手機優先、遊戲風 UI：手機底部分頁列／桌機左側選單（總覽、參議院、眾議院、地圖、戰區）；各州用方塊地圖點選設定
- 「內容」分頁：管理地圖下方圖文區塊（可多則、可排序；清空則前台不顯示）；檔案上傳至 `medias/`，src 副檔名自動判斷 圖片/GIF、MP4（靜音循環自動播放）、YouTube/Vimeo 嵌入
- 「總覽」分頁可編輯首頁大標／副標與六個子頁的名稱、一句話說明；「內容」分頁每則圖文需指定所屬子頁（預設 p5，新增時沿用上一則）
- 圖文「報導連結」：每則可加多個，貼上網址自動抓標題（microlink → allorigins 備援，去掉「- 中時新聞網」後綴；抓不到可手動輸入，不填則前台顯示網站名稱）；前台以文字超連結呈現（僅允許 http/https，新分頁開啟）
- 防呆：未確定席次、過半控制黨、最後更新時間皆由系統自動計算，不需手填；席次加總超過總數時禁止存檔

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
