# CLAUDE.md — War Industry News

This file provides guidance for AI assistants working on this repository.

## Project Overview

**War Industry News** (戰時工業新聞) is a static, single-author journalistic portfolio site hosted on GitHub Pages. It aggregates military-industrial news articles in Traditional Chinese and includes an interactive educational game.

**Live URL:** `https://kayhase015497.github.io/war-industry-news/`

- **Author:** 張威翔 (Zhang Wei-Xiang), 時報資訊國際軍事組
- **Language:** Traditional Chinese (zh-Hant)
- **Stack:** Vanilla HTML / CSS / JavaScript — zero build tools, zero backend

---

## Repository Structure

```
war-industry-news/
├── index.html              # Main news portal (2,255 lines)
├── game.html               # Interactive game: 工業力試煉 (1,114 lines)
├── images/                 # Static image assets
│   ├── ammo-loading.jpg
│   ├── night-vision.jpg
│   ├── rpg-soldier.jpg
│   └── soldiers-breach.jpg
├── robots.txt              # SEO: allows all crawlers
├── sitemap.xml             # Two URLs: index.html (priority 1.0) + game.html (0.8)
├── .github/
│   └── workflows/
│       ├── static.yml      # GitHub Pages CI/CD deployment
│       └── index.html      # Legacy article link list
└── CLAUDE.md               # This file
```

No `package.json`, `Makefile`, `Dockerfile`, or any build pipeline exists. Changes take effect immediately — edit and commit.

---

## Key Files In Depth

### `index.html` — News Portal

A self-contained HTML page featuring:

- **119 news articles** (2023–2026) embedded directly as HTML cards
- **Tag filtering** by topic: Ukraine, NATO/Europe, Taiwan/China, Military Industry, Middle East, US Policy
- **Full-text search** (live, client-side, `<input>` → DOM filter)
- **Timeline density chart** (monthly article counts, rendered via inline JS)
- **3D interactive globe** (Three.js, shows conflict zone locations)
- **Dark/light theme toggle** (`.dark-mode` class on `<body>`)
- **Featured articles** sidebar (desktop) and mobile strip
- **SoundCloud music player** integration
- **Sticky year navigation bar** (2023 / 2024 / 2025 / 2026)

**Article card structure:**
```html
<div class="news-card" data-tags="ukraine nato">
  <div class="card-date">2025-03-15</div>
  <h3><a href="https://...chinatimes.com/..." target="_blank">Article Title</a></h3>
</div>
```

`data-tags` is a space-separated list of lowercase tag keys used by the JS filter.

**Adding a new article:**
1. Find the correct `<section class="year-section" id="y20XX">` block.
2. Insert a `.news-card` div with the appropriate `data-tags`.
3. Update `sitemap.xml` `lastmod` date.

### `game.html` — 工業力試煉 (Industrial Power Trial)

An educational simulation game. Players allocate industrial power points across 5 resource categories to optimize wartime production for a chosen country and scenario.

**Game flow:** Difficulty → Scenario → Role (Defender/Attacker) → Country → Allocate resources → Score + analysis

**Core game data (JS objects):**

| Object | Purpose |
|---|---|
| `countries` | Per-country total points, debt/GDP, GDP multiplier, industrial index |
| `scenarios` | 6 conflict scenarios with defender/attacker optimal allocation ratios |
| `state` | Current game state (selections, allocations, screen) |

**Scoring formula:**
```
deviation = Σ |playerWeight[i] - optimalWeight[i]|   (per resource)
score     = max(0, 100 - deviation × 100)
debtChange = (1 - score/100) × 25 × gdpMultiplier
```

---

## Development Workflow

### Prerequisites

None. No `npm install`, no build step.

### Running Locally

Open files directly in a browser, or serve with any static HTTP server:

```bash
# Python (built-in)
python3 -m http.server 8080

# Node (npx)
npx serve .
```

### Making Changes

1. Edit `index.html` or `game.html` directly.
2. Commit with a descriptive message.
3. Push to the `main` branch — GitHub Actions deploys automatically.

### Deployment

Defined in `.github/workflows/static.yml`:

- **Trigger:** Push to `main`, or manual `workflow_dispatch`
- **Action:** Uploads the entire repository root as a GitHub Pages artifact and deploys it
- **No build step** — the repo is deployed as-is

---

## Code Conventions

### CSS

- **CSS custom properties** on `:root` for image URLs and chip colors:
  ```css
  :root {
    --img-header: url('images/soldiers-breach.jpg');
    --gdp-chip: #c0392b;
  }
  ```
- **Dark mode** via `.dark-mode` on `<body>` — override variables/colors under that selector.
- **Responsive breakpoint:** `@media (max-width: 1140px)` for tablet/mobile.
- **Color palette:**
  - Primary red: `#c0392b`
  - Dark background: `#0a0f14`, `#1c2e3d`
  - Light text: `#cdd6e0`, `#e0e0e0`

### JavaScript

- **No frameworks** — vanilla DOM only.
- **IIFE pattern** for scoped modules (tag filter, timeline):
  ```js
  (function() { /* module code */ })();
  ```
- **Data-attribute bindings** for filtering:
  ```js
  card.dataset.tags   // read space-separated tag list
  ```
- **State object** for game logic:
  ```js
  const state = { screen: 'difficulty', country: null, ... };
  ```
- No `import`/`export` — all scripts are inline `<script>` blocks.
- **No `console.log`** left in production code.

### HTML

- Semantic HTML5 elements: `<section>`, `<aside>`, `<header>`, `<footer>`, `<nav>`.
- All external links: `target="_blank" rel="noopener"`.
- Article links point to `https://www.chinatimes.com/...` (external, do not modify these URLs).
- Meta tags include Open Graph, Twitter Card, and search engine verification codes — do not remove.

### Content Language

- All user-facing text is in **Traditional Chinese** (zh-Hant).
- Dates follow `YYYY-MM-DD` format in `data-date` attributes and visible `.card-date` spans.
- Do not translate content to Simplified Chinese or English unless explicitly asked.

---

## SEO / Metadata

- **Canonical URL:** `https://kayhase015497.github.io/war-industry-news/`
- **robots.txt:** Allows all crawlers; references sitemap.
- **sitemap.xml:** Update `<lastmod>` whenever content is changed:
  ```xml
  <lastmod>2026-04-02</lastmod>
  ```
- Google and Bing site verification meta tags are present in `<head>` — do not remove.

---

## What NOT to Do

- Do not add a build tool, bundler, or package manager without explicit instruction.
- Do not introduce JavaScript frameworks (React, Vue, etc.).
- Do not modify external article URLs (chinatimes.com links).
- Do not remove SEO meta tags, canonical URL, or site verification codes.
- Do not translate content language without being asked.
- Do not add backend infrastructure — this is intentionally fully static.
- Do not push directly to `main` without review unless deploying a confirmed change.

---

## Branch Strategy

- **`main`** — production branch, auto-deploys to GitHub Pages on push.
- **`claude/*`** — branches created by AI assistants for changes pending review.

When working as an AI assistant, develop on a `claude/...` feature branch and do not merge to `main` unless explicitly instructed.
