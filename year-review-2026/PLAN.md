# 年度特輯規劃：2026 戰爭即工業力・全球戰區地球儀

> 規劃者：Opus（顧問）｜執行者：Sonnet（新 session，冷啟動）｜建立日期：2026-11-05
> 本文件自成一體。執行前先讀完「0. 一句話結論」與「9. 決策清單」，其餘邊做邊查。

## 0. 一句話結論

做一個 **3D 互動地球儀特輯**：地球儀是「導覽層」，每張現有地圖在地球上是一個光點（beacon）；點選後鏡頭飛過去、在球面上畫出該圖的多邊形／路線／標記、跳出資訊卡，再按鈕以疊層 iframe 開啟既有的 `war-map/siterep.html?d=<slug>` 看細節。
**細節地圖不重做**——街區尺度（康斯坦丁諾夫卡×5、利曼、羅斯托夫、切爾尼亞霍夫斯克、喬克濤）3D 球面畫不好，siterep 已畫好且剛優化過手機版。若將來要街景等級 3D，那是 Cesium 級的獨立專案，不在本案範圍。

### 誠實標示的範圍
- 資料實際涵蓋 **2026-04-25 至 2026-11-05**（外加 2 張歷史／參考圖），不是整年。標題用「2026 年度回顧」但 UI 上顯示實際時間軸 4 月–11 月，不要假裝有 1–3 月。
- 之後有新圖，管線要能 **重新 build 就自動多一顆光點**（見第 3 節），不要寫死 68。

## 1. 現況盤點（已掃描，數字可信）

`war-map/data/*.json`：**68 個檔案，全部可解析**，總計 1.2 MB。

| 項目 | 數量 |
|---|---|
| 標記點 locations | 696（confirmed 265、possible 178、capital 149、reference 47、dam 18、city 16、infra 9、seismic 8、recovery 6） |
| 多邊形 polygons | 154 |
| 路線 lines | 218 |
| 含 geojsonLayers 的圖 | 2 |
| status | breaking 30、ongoing 19、resource 17、reference 2 |
| theme | red 30、blue 15、orange 15、green 3、**null 5** |

月份分布：4 月 10、5 月 12、6 月 10、7 月 8、8 月 10、9 月 8、10 月 6、11 月 3（另有 2022-07 一張）。

另有獨立 HTML（非 siterep 格式）：`war-map/military-bases-world.html`（1,232 座全球軍事基地，資料內嵌在 HTML）、`iraq-marsh.html`、`mali_attack_20260425.html`（**先確認它是否與 `mali_attack_20260425.json` 重複**）。

既有地球儀頁：`misc-data/arctic-route-globe-v2.html`、`ice-avalanche-globe.html`——用 D3 `geoOrthographic` 的 2D 投影地球，約 30 KB，可參考其深色風格與互動，**但本案改用 three.js 真 3D**，不要在它們上面加。

### 資料異常（必須由 manifest 處理，見第 3 節）
- `mali_attack_20260425`：`meta.date` 是 `"2026年4月25日"`（中文格式字串）。
- 5 個檔案 `theme` 為 null。
- `beijing_heli_crashes`：日期 2022-07-01（事件日期，不是製圖日期）。
- 同題材多版本（**使用者決定：做成可切換**）：`europe_na_wildfires_floods_2026`（橘）／`_blue`（藍）、`iraq_marsh_20260428`（線條版）／`iraq_marsh_filled_20260428`（填色版）、哈薩克 `kazakhstan_eurasia_nodes_2026`（鐵路走廊）／`kazakhstan_energy_minerals_europe_2026`（能源礦產）與 `china_iran_trade_network_2026`／`instc_corridor_2026` 屬相關圖，不合併但互相掛為「相關圖」。同題材版本合併成**一顆光點**，資訊卡上有版本切換器。
- 測試殘留：`test_routes`（＝`pakistan_iran_routes_20260425` 的測試副本）仍排除，不提供給使用者。
- `meta.date` 是**事件日期**；git 歷史是淺的（最早 commit 2026-09-08），**不能**用 git 推算製圖日期。
- `theme`、`status` **不代表主題**（theme 只是 UI 顏色），分類必須另外策展。
- 座標約定：一律 `[lat, lng]`；跨換日線的圖用 lng>180（例：謝米亞島 JBER 為 210.2）；`map.mobile` 是手機視野覆寫（只給 siterep 用）。
- 多區域大圖（哈薩克×2、INSTC、絲路、俄羅斯能源）`map.center` 在大陸尺度，不是單一事件點。

## 2. 技術決策（寫成需求，不是建議）

### 2.1 建置與依賴
- **Vite + three.js（npm，鎖定精確版本）**，獨立專案放 `year-review-2026/`，輸出 `year-review-2026/dist/`（比照 `game-v2`）。
- 為什麼不能走 CDN：本沙箱實測 `cdn.jsdelivr.net` 403、`cdnjs` 連不上、OSM 圖磚被擋；**npm registry 與 raw.githubusercontent 可用**。只有打包進來的資產，才能在沙箱內用 Playwright 測試。
- 依賴清單（皆 npm）：`three`、`d3-geo`、`topojson-client`、`world-atlas`、`earcut`（或 three 內建 ShapeUtils）、`vite`。需要別的先說明理由。
- **安裝後先讀 `node_modules/three/examples/jsm` 與 `three/webgpu`、`three/tsl` 的實際匯出**，不要憑記憶寫 TSL／WebGPU API（這部分 API 變動快）。

### 2.2 渲染器
- 使用 `WebGPURenderer`（`three/webgpu`），**自動 fallback 到 WebGL2**。
- **所有自訂 shader（大氣層、弧線、脈衝圈、輝光）一律用 TSL 寫**；GLSL `ShaderMaterial` 在 WebGPURenderer 下不能跑。
- 後處理（bloom 等）用節點式後處理。
- 引入任何第三方地球儀／線條函式庫前，先確認它在 WebGPURenderer 下能渲染，否則自己寫。
- 加入 URL 參數：`?renderer=webgl|webgpu` 強制後端、`?debug=1` 顯示目前後端、FPS、draw calls。**原因**：無頭 Chromium 多半只能驗 WebGL2，使用者要能回報公司 APP 的 WebView 實際跑的是哪個後端。

### 2.3 「精度越高越好」的做法：靠向量圖層，不靠巨型貼圖
- 底圖不用照片貼圖。用 `world-atlas` 的 Natural Earth 向量資料（`countries-50m` 預設，放大時懶載入 `countries-10m`），以 d3-geo 畫到離屏 canvas 產生**程式化深色底圖貼圖**（海 `#0b0f1a`、陸地略亮、國界細線、海岸高亮）。風格一致、零外部素材、任意解析度。
- 貼圖依裝置分級：**手機 ≤ 4096**、桌機 ≤ 8192；不要用 16K（WebView 記憶體會爆）。
- 國界／海岸線另以**向量線**疊在球面上（放大時保持銳利），不要只靠貼圖。
- 夜間燈光、地形起伏等照片類素材為選配；若要用，Sonnet 必須先下載候選 npm tarball 並列出內容、確認檔案真的存在，**不要假設某檔存在**。
- 球面幾何要求：
  - 線段沿**大圓**加密取樣，避免穿透地球。
  - 大多邊形先加密邊再三角化（哈薩克國界 112 點、野火區都很大）；頂點投到球面並加微小半徑偏移避免 z-fighting。
  - 經度先**展開成連續值**再處理（謝米亞島 210.2、跨換日線多邊形）。
- 標籤用 **DOM 疊層**由 3D 座標投影定位；**不要**在 canvas 內畫中文（Noto Sans TC 字集太大）。只顯示「被選中那張圖」的標籤，避免擁擠。

### 2.4 效能預算（硬指標）
- 手機 WebView：穩定 ≥ 30 FPS；首屏可互動 < 3 秒（不含 10m 國界懶載入）。
- 初始載入資料：`index.json` 一次 fetch（目標 < 150 KB gzip），**不要**一次抓 68 個檔。
- 光點用 instancing；每次只在球面上畫「被選中那張圖」的完整幾何。
- 提供 **純 DOM 清單 fallback**（無任何 GPU 路徑時仍可瀏覽全部 68 張並開 siterep）。

## 3. 資料管線

`year-review-2026/scripts/build-index.mjs`（Node，npm script `prebuild`）：

1. 讀 `war-map/data/*.json`，套用 `year-review-2026/manifest.json` 的覆寫。
2. 輸出 `public/index.json`（只放導覽所需欄位）：
   ```
   { slug, title, shortTitle, date, category, status, theme,
     anchor:[lat,lng], bbox:[[s,w],[n,e]], counts:{loc,poly,line},
     summary(第一段，截斷), series?, hasGeo, featured? }
   ```
3. **不**把完整幾何塞進 index。選取某張圖時才 `fetch('../war-map/data/<slug>.json')`（同源、永遠最新，圖被編輯後特輯自動跟上）。
4. 同時產出 `public/stats.json`（建置時計算的 HUD 統計：圖數、標記總數、confirmed 數、涉及國家／地區數、按月／分類分布）。
5. **驗證報告**（建置失敗條件）：JSON 無法解析、lat 超出 [-90,90]、lng 超出 [-180,360]、manifest 引用不存在的 slug、日期無法解析且 manifest 未提供。警告（不失敗）：近重複圖、`theme` 為 null、座標落在陸地以外的可疑點。

### `manifest.json`（手寫，可編輯）
每張圖可覆寫：`include`（預設 true）、`category`、`displayDate`、`shortTitle`、`featured`、`series`、`anchor`、`variants`（同題材多版本，見下）、`related`（相關圖 slug 陣列）、`note`。

`variants` 格式：掛在「主版本」條目上，例如 `{"slug":"iraq_marsh_20260428","variants":[{"slug":"iraq_marsh_20260428","label":"線條版"},{"slug":"iraq_marsh_filled_20260428","label":"填色版"}]}`；被收編的版本自動不再單獨成為光點。

**必須處理的條目**：`test_routes`→exclude；`europe_na_wildfires_floods_2026`→variants［橘色版／藍色版］；`iraq_marsh_20260428`→variants［線條版／填色版］；哈薩克兩張互掛 `related`；`mali_attack_20260425`→`displayDate: 2026-04-25`；`beijing_heli_crashes`→category 延伸參考，標示「2022 事件」。

**anchor 規則**：預設取「第一個 `confirmed` 標記，否則 `map.center`」；多區域大圖（哈薩克×2、INSTC、絲路、俄羅斯影子能源、中俄互聯互通、非洲綠色長城、三北防護林）用 `map.center` 並在 UI 標為「區域型」，選取時畫出範圍環而非單點。

**series**（戰役鏈，P2 的上一則／下一則用）：康斯坦丁諾夫卡 ×5（20260428、0513、0611、0702 + ukraine_battle_20260428）、馬利 ×4（overview、attack、battle_20260428、kidal_retaken）、伊朗—波灣 ×3、俄烏能源打擊 ×4、哈薩克 ×2、海地 ×2、青年運動 ×2。

### 分類（7 類，先依下表種子，再人工校對）
| 類別 | 色 | 範例 slug |
|---|---|---|
| 戰事衝突 | 紅 | ukraine_*、kostiantynivka_*、lyman_*、mali_*、haiti_*、ethiopia_*、yemen_houthi_*、houthi_saudi_*、niger_mutiny_*、kyauktaw_*、iran_strikes_*、thailand_cambodia_maritime |
| 軍事部署與事故 | 橘紅 | iran_mideast_military、cuba_us_navy、shemya_*、su30sm_*、gulf_monarchies_triple_fragility |
| 能源 | 琥珀 | europe_russia_energy、russia_shadow_energy_global、tengiz_cpc、libya_noc_*、rostov_*、venezuela_oil、greenland_energy_*、taiwan_energy_infra、china_grid_upgrade、myitsone_dam、kazakhstan_energy_minerals_europe |
| 礦產與資源 | 紫 | vietnam_minerals、nigeria_minerals |
| 走廊與產業 | 青 | china_russia_infra、china_iran_trade_network、pakistan_iran_routes、instc_corridor、kazakhstan_eurasia_nodes、byd_europe_sites、ulanqab_vs_colossus_ai、tata_hosur_pollution、aws_mideast_outage |
| 災害與生態 | 綠 | iraq_marsh_*、kumamoto_quake_*、china_nepal_flood、etna_eruption_*、europe_na_wildfires_floods、indonesia_wildfire_*、great_green_wall_africa、china_three_north_shelterbelt |
| 延伸參考 | 灰藍 | silk_road_empires_100ce、greater_israel_map、yemen_coffee_mocha_history、beijing_heli_crashes、ukraine_bio_labs_odni、kailash_kora_fire_horse |

## 4. 視覺與遊戲化設計

**整體氛圍**：深空戰情室。背景 `#0b0f1a`，球體近黑藍，國界淡青細線，光點依分類上色；字型 Noto Sans TC + Space Mono（HUD 數字）。

- **開場**：標題「2026 戰爭即工業力・全球戰區地球儀」、載入進度（資料→底圖→光點逐顆亮起），鏡頭從遠景緩推。
- **球體**：晝夜晨昏線（依選定日期的太陽位置）、薄大氣層輝光（TSL，邊緣菲涅爾）、緩慢自轉（互動時暫停）。
- **光點**：`breaking` 脈衝環（TSL 動畫）、`ongoing` 穩定光、`resource/reference` 暗光；同一區域疊多顆時**聚合成數字氣泡**，放大或點選後展開（烏克蘭、中東、紅海會疊成一團）。
- **選取一張圖**：鏡頭沿弧線飛行（easing）、該圖的多邊形以實心填色（保留原本 fillColor／透明度）、路線畫成**流動虛線**（弧線動畫，沿大圓）、標記點升起、DOM 標籤淡入；旁邊資訊卡顯示標題、日期、分類、首段摘要、**保留各圖的「⚠️ 概略位置」免責字句**；主按鈕「進入戰區地圖」→疊層 iframe 開 `siterep.html?d=<slug>`（右上角關閉）。
- **時間軸（Season Bar）**：4 月→11 月，可拖曳／播放；播放時光點依日期依序點亮，像戰役回放；可以按月或按分類篩選。
- **HUD（遊戲感）**：左上統計（已探索戰區 n/68、confirmed 事件總數、涉及地區數）、右下迷你圖例、分類篩選晶片。已造訪的光點變色並累積「探索進度」，全部探索完顯示結語畫面。
- **自動導覽（Tour）**：P1 的「年度回顧」播放鍵，依月份串起 8～12 個精選事件，自動飛行＋字幕。
- **音效**：選配、預設靜音、需使用者主動開啟（P2，不得自動播放）。

## 5. 互動模型與驗收標準（分階段）

### P0（必須在 **WebGL2、iframe 內嵌、390px 寬**下全部通過）
1. 球體可旋轉／縮放；**內嵌手機沿用 siterep 的手勢規則**：單指捲動頁面、雙指旋轉／縮放（見 `war-map/siterep.html` 的 `gestureMode`，單指觸球顯示提示）；獨立開啟（非 iframe）時允許單指拖曳。
2. 68－（排除／合併後）顆光點正確顯示，含聚合。
3. 時間軸（4–11 月）＋分類篩選。
4. 選取→飛行→球面圖層（多邊形、路線、標記）→資訊卡（含免責字句）→開 siterep 疊層。
   - **版本切換器（使用者需求）**：有 `variants` 的光點，資訊卡頂部顯示分頁式切換（例如「橘色版｜藍色版」），切換時球面圖層與「進入戰區地圖」開啟的 `siterep` 同步換成該版本，不需重新選取光點；沒有 variants 的圖不顯示切換器。
   - **相關圖**：資訊卡底部顯示 `related` 清單，點選直接飛到該光點。
5. 純 DOM 清單 fallback（關閉 WebGL 時仍可用，用 `?renderer=none` 測）。
6. 所有文案 zh-Hant；`yr-` 前綴 CSS（iframe 友善）；RWD breakpoint 約 900px。

### P1
WebGPU 加分特效（大氣層、bloom、流動弧線、脈衝環）、晝夜晨昏線、分類 HUD 統計、自動導覽播放鍵、已探索進度。

### P2
戰役鏈上一則／下一則（series）、全球軍事基地圖層（需先從 `military-bases-world.html` 內嵌資料抽出 JSON，1,232 筆，用 instancing 畫）、選配音效、成就／結語畫面。

## 6. 文案與用詞規則（沿用專案慣例）
- 繁體中文；用「中國大陸」「大陸」，**不要單寫「中國」**；「青年運動」（不寫胡塞）。
- 主題色深色 `#0b0f1a`；Noto Sans TC / Noto Serif TC + Space Mono。
- CSS class 一律 `yr-` 前綴；純 CSS + Vanilla JS（three.js 為唯一重型依賴）。
- 所有座標一律標明「概略」，不得因為視覺好看而移動位置。

## 7. 測試策略（沙箱限制下）
- 本地：`vite build` + `vite preview`，用 Playwright（`/opt/pw-browsers/chromium`，**不要** `playwright install`）搭配 SwiftShader（`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`）跑 WebGL2。
- 全部資產打包進 dist；Playwright 用 `page.route` 擋掉外網請求，確保離線可跑。
- 必截圖：390×844 與 1280×800；首屏、選取某圖、時間軸播放中、清單 fallback。
- **WebGPU 無法在無頭環境驗證**：以 `?renderer=webgpu` / `?debug=1` 讓使用者在真機回報；任何 WebGPU 專屬特效必須有 WebGL2 降級路徑，不可因為 WebGPU 缺席而整頁壞掉。
- 啟動 dev／preview server 後，呼叫 `report_preview_port` 讓使用者能看預覽。
- 單元層：build-index 的驗證報告要有測試（異常日期、重複、跨換日線座標）。

## 8. 部署
- 比照 `game-v2`：先讀 `.github/workflows/static.yml` 看 game-v2 如何 build／發布。
- 嵌入網址預期：`https://kayhase015497.github.io/war-industry-news/year-review-2026/dist/`（以實際發布路徑為準）。
- 嵌入碼（沿用專案格式，`height` 建議 600；公司 APP 為主要目標）：
  ```html
  <figure style="margin:0">
    <iframe src="…/year-review-2026/dist/index.html" width="100%" height="600"
      style="border:none;display:block" loading="lazy" allowfullscreen
      title="2026 戰爭即工業力・全球戰區地球儀"></iframe>
    <figcaption style="font-size:0.8em;color:#666;margin-top:4px">資料：張威翔製圖｜底圖：Natural Earth</figcaption>
  </figure>
  ```
- 底圖來源標示 Natural Earth（公有領域），並保留各圖原始來源。

## 9. 需要使用者決策的事項（附預設值，Sonnet 不必卡住）

1. **CI 建置 vs 提交建置產物**：（待使用者說明後決定）修改 `static.yml` 需使用者同意。**預設**：不動 CI，先把 `dist/` 提交進 repo；使用者同意後再比照 game-v2 加 CI 建置步驟。
2. **歷史／參考圖**（絲路 100CE、大以色列、摩卡咖啡史、北京直升機 2022、生物實驗室）：**已決定：納入**，歸「延伸參考」類，正常顯示於篩選（不收合）；年度統計數字不計入這一類，並在 HUD 標註「不含延伸參考」。
3. **重複／多版本圖**：**已決定：做成可切換**——同題材版本合併為一顆光點，資訊卡有版本切換器（見第 5 節 P0-4）；只有 `test_routes` 這個測試殘留排除。
4. **嵌入目標**：**預設**以公司 APP 的 iframe（手機 WebView）為首要目標，其次才是獨立頁面。

## 10. 執行順序（每步獨立 PR，依慣例 squash 或一般 merge 皆可，使用者會說）

| 步驟 | 內容 | 驗收 |
|---|---|---|
| T0 | 腳手架：Vite + three（鎖版本）、`yr-` 樣式骨架、預覽可開、`?debug=1` | 空球體在 WebGL2 下顯示，HUD 顯示後端／FPS |
| T1 | 資料管線：`build-index.mjs`、`manifest.json`、驗證報告與測試 | `index.json` 產出、異常條目處理正確、報告無錯誤 |
| T2 | 球體基底：向量底圖貼圖（分級）、國界／海岸向量線、大氣層（先 TSL 簡版）、旋轉縮放、手機手勢規則 | 390px／1280px 截圖正常、30+ FPS（SwiftShader 下僅看不崩） |
| T3 | 光點＋聚合＋選取＋飛行＋資訊卡＋siterep 疊層 | 點任一光點可開對應 siterep；免責字句保留 |
| T4 | 球面圖層：多邊形／路線（大圓加密）／標記／跨換日線／範圍環 | 抽測：謝米亞島（210.2）、哈薩克國界、野火多邊形、跨洲路線 |
| T5 | 時間軸＋篩選＋DOM 清單 fallback | `?renderer=none` 可完整使用 |
| T6 | P1 特效：bloom、流動弧線、脈衝環、晨昏線、HUD 統計、導覽播放 | WebGL2 有降級；`?renderer=webgpu` 不報錯 |
| T7 | P2：series、軍事基地圖層、音效、成就 | 各自可關閉，不影響 P0 |
| T8 | 收尾：效能（手機預算）、QA 矩陣、嵌入碼、文件、CLAUDE.md 目錄補充 | 預算達標、使用者在公司 APP 實測通過 |

## 11. 已知風險
- **WebGPU 在公司 APP WebView 不一定可用** → 全程以 WebGL2 為底，WebGPU 只加效果。
- **TSL／three 的 WebGPU API 變動快** → 鎖版本、先讀已安裝套件的實際範例再寫。
- **聚合與標籤擁擠**（烏克蘭、中東、紅海）→ 聚合氣泡＋只標示選取圖的標籤。
- **記憶體**（手機）→ 貼圖分級、懶載入 10m、不一次載入全部圖層。
- **資料持續增加** → 一切由 build 管線生成，不寫死 68；manifest 是唯一人工維護點。

## 12. 進度紀錄

- **2026-11-05**：T0–T5 完成（P0）：Vite + three.js（0.187.0）、WebGPURenderer 自動降級 WebGL2、向量底圖、光點聚合、選取飛行、球面圖層（多邊形／大圓路線／跨換日線）、資訊卡（版本切換、相關圖、標記詳情）、siterep 疊層、時間軸／分類篩選、清單 fallback、手機雙指手勢。
  - 已在 SwiftShader（WebGL2）下以 390px／1100px 驗證；**WebGPU 後端尚未在真機驗證**，請以 `?debug=1` 回報。
  - 尚未做（P1／P2）：bloom、流動弧線動畫、晨昏線、自動導覽、10m 國界懶載入、戰役鏈、軍事基地圖層、音效、成就。
- **2026-11-05（P1／P2）**：
  - 精度：放大（dist < 2.5）時以 10m 向量即時重繪視野範圍的細節貼片（2048/1536 px，邊緣羽化），並隱藏 50m 3D 國界線；底圖對比與格網加強。
  - 效能：像素比自動調節（< 32 fps 才降）、閒置自轉限 30 fps、桌機高 DPR 時關閉 MSAA。
  - 特效：路線改為 TSL 動畫材質（虛線流動／實線流光）、已確認標記的 GPU 脈衝環、受光陰影與邊緣暗化（取代原規劃的晨昏線，改為跟隨相機的光源）、可選「高畫質」bloom（RenderPipeline）。
  - 內容：戰役鏈上一則／下一則（manifest `series`）、自動導覽（manifest `featured`，12 張，9.5 秒／張，結尾顯示年度統計）、分類計數、成就提示與探索完成畫面、全球 1,232 座軍事基地圖層（`scripts/extract-bases.mjs` 從 `military-bases-world.html` 抽出）、選配合成音效（預設靜音）。
  - 實測備註：UE5 等重度程式佔用 GPU 時 fps 會明顯下降，與特輯本身無關。
  - 尚未驗證：WebGPU 下的 bloom／TSL 動畫材質、真機手勢。
