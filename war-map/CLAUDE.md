# War-Map 製圖規格手冊

## 工作分支

```
branch: claude/map-drone-strike-nYEQq
repo:   kayhase015497/war-industry-news
```

所有製圖工作在此分支開發，完成後開 PR squash merge 進 main。

---

## 製圖流程

1. 在 `war-map/data/` 新增 JSON 檔
2. `python3 -c "import json; json.load(open('war-map/data/XXX.json')); print('JSON OK')"` 驗證
3. `git add` → `git commit` → `git push -u origin claude/map-drone-strike-nYEQq`
4. 用 GitHub MCP (`mcp__github__create_pull_request`) 開 PR

---

## 崁入語法（figcaption 格式）

```html
<figure style="margin:0">
  <iframe src="https://kayhase015497.github.io/war-industry-news/war-map/siterep.html?d=FILENAME" width="100%" height="500" style="border:none;display:block" loading="lazy" allowfullscreen title="地圖標題"></iframe>
  <figcaption style="font-size:0.8em;color:#666;margin-top:4px">說明文字｜底圖 © OpenStreetMap｜來源：張威翔製圖</figcaption>
</figure>
```

`FILENAME` = JSON 檔名去掉 `.json`。

---

## JSON Schema

### meta

```json
{
  "title": "中文標題",
  "titleEn": "English Title",
  "subtitle": "副標題",
  "date": "YYYY-MM-DD",
  "status": "breaking | resource",
  "theme": "blue | red | orange | green",
  "sources": ["來源1", "來源2"]
}
```

`theme` 只控制 UI 色彩主題，**不影響**多邊形或線條顏色。

### map

```json
{
  "center": [lat, lng],
  "zoom": 7,
  "bounds": [[south, west], [north, east]]
}
```

### infoPanel

```json
{
  "title": "說明面板標題",
  "paragraphs": ["段落1", "段落2", "段落3"]
}
```

### locations（標記點）

```json
{
  "latlng": [lat, lng],
  "name": "英文名稱",
  "nameLocal": "中文名稱（外文名稱）",
  "type": "confirmed | capital | possible | dam",
  "tag": "圖示 標籤文字",
  "tagClass": "tag-confirmed | tag-strategic | tag-possible | tag-reference",
  "desc": "彈出視窗詳細說明",
  "coords": "00°00'N 000°00'E",
  "source": "資料來源"
}
```

#### type 對應視覺效果

| type | 顏色 | 大小 | 脈衝動畫 | 用途 |
|------|------|------|----------|------|
| `confirmed` | 紅 #e74c3c | 15px | ✅ 有 | 確認事件、重要目標 |
| `dam` | 紅 #e74c3c | 15px | ✅ 有 | 與 confirmed 相同 |
| `capital` / `city` | 黃 #f1c40f | 18px | ❌ 無 | 首都、大城市、參考點 |
| `possible` | 藍 #64B5F6 | 13px | ❌ 無 | 推測位置、次要標記 |
| 其他（預設） | 綠 #27ae60 | 11px | ❌ 無 | 基礎設施 |

`nameLocal` 格式：**中文優先**，括號內放外文：`"密松（Myitsone）・大壩壩址"`

### polygons

```json
{
  "points": [[lat, lng], ...],
  "fillColor": "#1A6FA5",
  "fillOpacity": 0.30,
  "borderColor": "#1565C0",
  "borderWeight": 1.8,
  "borderOpacity": 0.75,
  "borderDashArray": "8,4",
  "popup": {
    "title": "標題",
    "tag": "🔴 標籤",
    "tagClass": "tag-confirmed",
    "desc": "說明",
    "source": "來源"
  }
}
```

`borderDashArray` 省略或設 `"0"` 為實線；`"8,4"` 為虛線。

### lines

```json
{
  "points": [[lat, lng], ...],
  "color": "#FF8C00",
  "weight": 2,
  "opacity": 0.65,
  "dashArray": "7,5",
  "popup": { ... }
}
```

### legend

```json
[
  { "symbol": "polygon", "fillColor": "#1A6FA5", "fillOpacity": 0.35, "borderColor": "#1565C0", "label": "說明文字" },
  { "symbol": "dot",     "color": "#e74c3c", "pulse": true,  "label": "說明文字" },
  { "symbol": "dot",     "color": "#f1c40f", "pulse": false, "label": "說明文字" },
  { "symbol": "line",    "color": "#FF8C00", "weight": 2, "dash": "7,5", "label": "說明文字" }
]
```

---

## 已完成地圖清單

| 檔案名稱 | 主題 | PR |
|----------|------|----|
| `china_iran_trade_network_2026.json` | 中伊貿易網絡（西安→德黑蘭） | #136, #139 |
| `ukraine_bio_labs_odni.json` | 烏克蘭生物實驗室・ODNI解密 | #138 |
| `lyman_battle_20260619.json` | 紅利曼市區攻防（2026年6月19日） | #141 |
| `beijing_heli_crashes.json` | 北京直升機墜毀事故（2008–2022） | #143 |
| `greater_israel_map.json` | 大以色列歷史疆域演變 | #144 |
| `nigeria_minerals_2026.json` | 奈及利亞礦藏分布與地緣賽局 | #145 |
| `myitsone_dam_2026.json` | 密松水電站工程計畫（緬甸） | #151 |

---

## Git 常用指令

```bash
# 確認分支狀態
git status

# 驗證 JSON
python3 -c "import json; json.load(open('war-map/data/XXX.json')); print('JSON OK')"

# commit & push
git add war-map/data/XXX.json
git commit -m "feat: 地圖描述"
git push -u origin claude/map-drone-strike-nYEQq

# 若 push 失敗（branch diverged）
git fetch origin main && git rebase origin/main && git push -f origin claude/map-drone-strike-nYEQq
```

## GitHub MCP

開 PR 用 `mcp__github__create_pull_request`（需先 ToolSearch 載入）：
- owner: `kayhase015497`
- repo: `war-industry-news`
- head: `claude/map-drone-strike-nYEQq`
- base: `main`
- merge_method: `squash`

---

## 注意事項

- `polygons` / `lines` 若無資料仍需保留空陣列 `[]`，不可省略
- 座標格式一律 `[lat, lng]`（緯度在前）
- `nameLocal` 一定要有，tooltip 顯示用
- 說明文字（`desc`、`paragraphs`）用繁體中文
- 地點概略位置加上 `⚠️ 概略位置` 免責說明
