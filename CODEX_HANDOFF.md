# CODEX HANDOFF

## Repo
- Local path: `C:\Git\quran`
- GitHub: `https://github.com/masarray/quran`
- Upstream source: `https://github.com/marwan/quranwbw`
- Current branch: `main`
- Current pushed commit at handoff time: `e57e2d2` (`feat: localize UX and prepare quran pages deployment`)

## Product Direction
- Product name is no longer `QuranWBW` in user-facing branding.
- Direction is now `Al Quran`.
- Product goal:
  - full Bahasa Indonesia UX
  - simple and native for Indonesian mainstream users
  - a companion for reading, reminders, last-read continuity, notes, and lightweight reading progress
- Desired product identity:
  - calm
  - premium
  - easy to use
  - not technical-looking
  - not English-first

## What Changed From Original

### Branding and identity
- User-facing title changed from `QuranWBW` to `Al Quran`.
- Meta/title/manifest language moved toward Indonesian.
- Main homepage copy was rewritten into Indonesian-oriented product messaging.

### Default language behavior
- Default word translation changed to Indonesian.
- Default ayah translation changed to Indonesian Islamic affairs ministry / `Departemen Agama`.
- `html lang` changed to `id`.

### Last-read system
- Original app already had auto last-read behavior.
- Current fork keeps that auto tracking, but adds a manual last-read layer.
- Effective behavior now:
  - auto tracking still updates reading position
  - manual `Set as Last Read` has priority over auto position for resume UX
- This is intended to better match Quran apps that separate passive progress from intentional last-read markers.

### Reading analytics
- Lightweight analytics were added:
  - pages today
  - ayat tracked today
  - 7-day total
  - simple weekly bar chart
- Analytics are intentionally lightweight and local-first, not a heavy dashboard.

### Resume shortcuts
- Resume entry points were added or improved across:
  - homepage
  - chapter view
  - mushaf page view

### UX localization
- Core shell strings were translated in several major surfaces:
  - homepage
  - search
  - site navigation modal
  - Quran navigation modal
  - many settings drawer labels
  - some offline page labels
- This work is incomplete. There are still many English strings left in the repo.

### PWA / GitHub Pages prep
- GitHub Pages deployment workflow was added.
- Static adapter support was added for Pages builds.
- Base-path handling was prepared for `/quran`.
- Service worker registration and cache routing were adjusted for subpath deployment.
- Manifest was updated to better suit standalone PWA behavior.

## Files Touched In This Fork
- `.github/workflows/deploy-pages.yml`
- `package.json`
- `package-lock.json`
- `svelte.config.js`
- `static/manifest.json`
- `src/app.html`
- `src/data/websiteSettings.js`
- `src/hooks.client.js`
- `src/utils/stores.js`
- `src/utils/updateSettings.js`
- `src/utils/offlineModeHandler.js`
- `src/service-worker.js`
- `src/routes/+page.svelte`
- `src/routes/search/+page.svelte`
- `src/routes/offline/+page.svelte`
- `src/routes/page/+page.svelte`
- `src/views/Chapter.svelte`
- `src/components/display/ReadingAnalytics.svelte`
- `src/components/display/verses/VerseOptionButtons.svelte`
- `src/components/display/verses/VerseOptionsDropdown.svelte`
- `src/components/ui/Modals/QuranNavigationModal.svelte`
- `src/components/ui/Modals/SiteNavigationModal.svelte`
- `src/components/ui/SettingsDrawer/SettingsDrawer.svelte`

## Important Implementation Details

### 1. Default translations
- File: `src/hooks.client.js`
- Default word translation set to Indonesian (`id: 4`).
- Default ayah translation set to `Indonesian Islamic affairs ministry` / `Departemen Agama` (`resource_id: 33`).
- Note:
  - this applies cleanly for new users or reset local storage
  - existing users with saved settings may still retain previous stored preferences

### 2. Last-read storage model
- Files:
  - `src/hooks.client.js`
  - `src/utils/updateSettings.js`
  - `src/utils/stores.js`
- Current settings model includes:
  - `lastReadAuto`
  - `lastReadManual`
  - effective `lastRead`
- Priority model:
  - manual last-read should win over auto last-read in resume surfaces

### 3. Analytics model
- Files:
  - `src/hooks.client.js`
  - `src/utils/updateSettings.js`
  - `src/utils/stores.js`
  - `src/components/display/ReadingAnalytics.svelte`
- Current analytics state:
  - stored locally
  - lightweight
  - based on reading updates rather than a full telemetry/event system
- Current intent:
  - keep it simple
  - avoid turning the product into a noisy dashboard

### 4. GitHub Pages / PWA
- Files:
  - `.github/workflows/deploy-pages.yml`
  - `svelte.config.js`
  - `src/service-worker.js`
  - `src/utils/offlineModeHandler.js`
  - `static/manifest.json`
- Build mode for Pages uses:
  - `GITHUB_PAGES=true`
  - `BASE_PATH=/quran`
- This was already tested locally with successful build.

## What Still Remains In English
This is the major unfinished area.

The app is not yet full Bahasa Indonesia. Large parts of shell UX were translated, but many English strings still remain.

Likely remaining hotspots:
- verse action menus and per-ayah tools
- settings option values and descriptions
- theme names
- display mode names
- FAQ/about/help content
- offline page body copy
- small tooltips and helper text on homepage
- data-driven labels from option/config arrays
- any remaining modal copy outside the main shell pass

Specific examples that still need attention were visible during this fork:
- some labels in `src/components/display/verses/VerseOptionsDropdown.svelte`
- many English values and descriptions sourced from `src/data/options.js`
- broader content pages that were not fully swept

## Recommended Next Phase

### Primary objective
Continue turning this fork into:

`Al Quran`

An Indonesian-first Quran companion for:
- membaca
- melanjutkan bacaan terakhir
- menerima pengingat
- menyimpan catatan
- melihat progres membaca ringan

### Priority order
1. Finish full Bahasa Indonesia UX shell.
2. Sweep option labels, descriptions, and helper copy that still appear in English.
3. Normalize terminology consistently:
   - Al Quran
   - Surah
   - Ayat
   - Juz
   - Halaman
   - Terakhir Dibaca
   - Penanda
   - Catatan
   - Statistik
4. Refine reminder UX so it feels native and intentional for Indonesian Muslim users.
5. Polish analytics UX so it stays elegant and lightweight.
6. Continue PWA polish so install/offline feels more native and less beta-like.

## UX Guardrails For Continuation
- Do not revert back toward English-first UX.
- Do not let the app feel technical or hobbyist.
- Keep changes patch-first and focused.
- Preserve the strong parts of upstream reading experience.
- Avoid bloated dashboards.
- Prefer calm, elegant, obvious UX over feature clutter.
- For Indonesian users, default assumptions should feel local and natural.

## Suggested Work Plan For Next Codex Thread
1. Audit all remaining English user-facing strings.
2. Classify them by surface:
   - shell/navigation
   - reading surfaces
   - settings
   - helper text
   - data-driven labels
3. Finish Indonesian localization in the highest-traffic surfaces first.
4. Verify that resume, notes, bookmarks, and analytics labels are all consistent.
5. Re-test Pages build with `/quran`.
6. Re-test core flows:
   - homepage
   - search
   - reading surah
   - mushaf page
   - settings
   - offline page
   - install/PWA behavior

## Commands Previously Verified
- Standard build:
```powershell
npm run build
```

- GitHub Pages build:
```powershell
$env:BASE_PATH='/quran'; $env:GITHUB_PAGES='true'; npm.cmd run build
```

## Notes For Office Laptop / New Thread
- Start from repo `C:\Git\quran` or a fresh clone of `https://github.com/masarray/quran`.
- Compare against `upstream/main` when needed to understand what changed from original `quranwbw`.
- The major unfinished work is localization completion, not foundational architecture.
- Treat this as a product-localization and UX-continuity continuation, not a rewrite.
