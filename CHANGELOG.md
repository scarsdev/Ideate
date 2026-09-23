# Changelog

All notable changes to Ideate (the app formerly known as Gather).
Format: [Keep a Changelog](https://keepachangelog.com/). Details are grouped by area.

## [0.1.0] — 2026-09-23

The first public build: a local, private save-library for Mac with browser sync.

### Added

**Library & browsing**
- Three-tab library (All / Saved / Unsorted / Trash) with masonry grid, zoom density, and infinite scroll.
- Item detail view: zoom, slideshow, keyboard navigation (`←/→`, `Esc`), metadata sidebar, and assign overlay (`1–9`, arrows, `⌘K` palette).
- Multi-image posts: "1/N" counter with hover chevrons to flip through an item's photos in place.
- Video items: play badge, hover-to-play, download and copy actions.
- Search via command palette (`⌘K`), light/dark themes (`⌘,` for settings).

**Collections & Spaces**
- Collections with a shelf (coverflow) view and a grid view — stacked covers, hover pull-out, renaming, and assignment flows.
- Spaces: user-created boards for arranging library items.
- AI "File saves into collections" and "Tag & name" flows with per-engine progress, cancel, and re-run.

**Pinterest (separate universe)**
- A dedicated Pinterest tab mirroring the Library layout: tabs row → boards strip → all-pins masonry.
- Pins are grouped into their real Pinterest boards, isolated from the Library — X/IG/bookmarks never mix with pins, and pins are excluded from Library views, AI flows, and search.
- Board tiles: right-click to **Rename** / **Delete**, drag to **re-order**; all persisted per board key and surviving re-imports.
- Pin context menu: **Move to board** with cover thumbnails, excluding the current board.

**Sync engine**
- Local HTTP sync server (127.0.0.1) with token auth; store dedupes by source + external id and upgrades rows in place.
- Chrome extension ("Gather Capture") bundles in the app; popup with per-source importers and a live status readout.
- Browser bookmark sync (Chrome bookmarks API) and a "Save this page / capture area / capture page" toolkit.
- Offline queue for captures, watcher alarms with configurable interval, and per-source enable/disable.

**X (Twitter)**
- Bookmark importer with full multi-image capture (all photos per post), live capture as you browse, and a toast-based fallback when buttons re-render.
- Photo backfill for older items via the syndication API, video URL enrichment, and duplicate-safe re-imports.

**Instagram**
- Saved-page importer (auto-redirects to All posts), carousel and reel detection from grid tiles, and per-post enrichment via the embed endpoint (full carousel images + reel mp4 links).
- Rate-limited enrichment queue with adaptive auto-pausing (escalating cooldowns when Instagram throttles) and retry-safe item accounting.
- Expiring reel links **self-heal**: the app publishes which video URLs are about to expire, and the extension refreshes them in the background before they die.

**Pinterest import**
- Board walker: opens your boards page, clicks into the real Boards tab, crawls every board (scrolling to load all pins), and files each pin under its board — with a saved-feed fallback when Pinterest reroutes.
- Clean board names (`bar ideas` instead of `bar ideas, 30 Pins, 4mo`), region-aware URLs (`au.pinterest.com` and friends).

**AI**
- Jev (TypeSafe System One) and DeepSeek support: text tagging/naming and vision-based categorization (photos filed into collections), with an engine picker (Auto / Jev / DeepSeek) and key management in Settings → AI Usage.

**Distribution**
- Packaged macOS builds (dmg + zip) via electron-builder; the Chrome extension ships inside the app and is revealed from Settings → Sync.
- One-click Gatekeeper helper and a friend-setup guide; GitHub releases.

### Fixed
- Collections view: settings modal rendered behind coverflow slides; toolbar dropdown (sort menu) drawn beneath collection-strip tiles.
- Masonry grid now fills left → right (row-major) instead of stacking new items down the left column.
- Avatar chip sizing on cards (CSS specificity).
- Video playback: hovered videos and the detail player could stall on queue-soaked CDNs — cards now load media on demand instead of pre-fetching for hundreds of items at once.
- Long videos no longer stop mid-play when the app window is unfocused (background throttling disabled).
- Dead video links degrade gracefully to the poster instead of a dead player.
- Instagram backfill: no more silent retry exhaustion dropping items; queue cap raised and full-batch failures pause instead of burning attempts.
- Pinterest walker no longer loops on `_boards` / `_pins` / `_saved` profile URLs, and no longer files pins under junk buckets.
- Pinterest board names no longer carry pin counts and dates; a re-run cleans already-imported rows in place.

### Changed
- IG enrichment goes through the embed endpoint first (server-rendered data, no hydration wait) with the old post-page route as fallback.
- Video cards use `preload="none"` — drastically less network churn and snappier starts.
- Library sorting options: Recently added / Oldest added / Created newest / Created oldest / Name / Most saves / Color.

[0.1.0]: https://github.com/scarsdev/Ideate/releases/tag/v0.1.0
