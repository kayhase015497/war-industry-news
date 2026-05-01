# OSRM Fetch SOP

使用 `osrm-fetch.html` 產生貼合真實公路的路線與邊境線 GeoJSON。

---

## 你給我的資訊格式

```
任務：[戰線/走廊/GIS圖層名稱]

路線：
  1. 名稱：xxx 走廊
     起點：城市A
     終點：城市B
     途經：公路編號或城市（可省略）
     顏色：#rrggbb（可省略，預設紅）

  2. 名稱：...

邊境線：是/否
  - 國家A vs 國家B（如：Pakistan vs Iran）

目標檔：war-map/data/xxxx_yyyymmdd.json（新建 or 覆蓋現有檔）
```

---

## 流程

| 步驟 | 誰做 | 內容 |
|------|------|------|
| 1 | Claude | 將路線資訊轉成 waypoints，更新 `osrm-fetch.html` |
| 2 | Claude | commit + PR + merge 到 main |
| 3 | 你 | 等 ~2 分鐘，在瀏覽器開 `osrm-fetch.html` |
| 4 | 你 | 按「抓取所有路線」，完成後按「複製 JSON」 |
| 5 | 你 | 貼到 GitHub 上 `test_routes.json`，用 `?d=test_routes` 確認畫面 |
| 6 | 你/Claude | 確認 OK 後，覆蓋正式 JSON 檔 |

---

## 最簡指令範例

```
OSRM fetch：
- 伊朗→敘利亞走廊，3 條路線，參考 N-7、M-4 公路
- 需要伊朗/伊拉克邊境線
- 存到 iran_syria_routes_20260501.json
```

---

## 技術細節

| 項目 | 設定 |
|------|------|
| 路線 API | `router.project-osrm.org`，`overview=simplified` |
| 邊境線 API | `overpass-api.de`，`way(r.A)(r.B)` 共享段 |
| 簡化算法 | Douglas-Peucker，路線 0.05°（≈5km），邊境 0.02°（≈2km） |
| 接合算法 | 貪心鏈接（從最北段出發，接最近未訪問端點） |
| 輸出格式 | 完整 GeoJSON FeatureCollection，可直接貼入 GitHub 編輯器 |

---

## 注意事項

- `osrm-fetch.html` 須在**瀏覽器**執行（伺服器端會被 API allowlist 擋）
- 每次修改後需 merge 到 **main** 才能透過 GitHub Pages 存取
- 先用 `test_routes.json` 測試，確認後再覆蓋正式檔，避免影響上線報導
