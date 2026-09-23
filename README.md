# Ideate

A local, private save-library for Mac — your X bookmarks, Instagram saves, and
Pinterest boards in one calm place, with a Chrome extension that syncs them in
as you browse. (Built as a faithful re-creation of the Gather app.)

## Download

1. Grab **Gather-Share.zip** from the [latest release](../../releases/latest).
2. Unzip, then follow **FRIEND-SETUP.md** inside:
   - Drag **Gather** into Applications
   - First launch is blocked by macOS (not notarized) — right-click → Open,
     or double-click **Fix-Gatekeeper.command**
   - Connect the Chrome extension from the app: **Settings → Sync →
     Reveal extension folder**, then `chrome://extensions` → Developer mode →
     Load unpacked → pick that folder → paste the server URL + token
3. Import your stuff from the extension popup: **Import bookmarks** (X),
   **Import saved** (Instagram), **Import Pinterest**.

> This build is Apple Silicon (M-series) only.

## What's inside

- `src/` — the renderer (React + Vite)
- `electron/` — the app: local store, sync server, AI tagging
- `sync-extension/` — the Chrome extension (also bundled inside the app)
- `scripts/` — dev harness and tests

## Develop

```bash
npm install
npm run dev
```

Tests: `npm run test:sync`, `test:sync:ui`, `test:scraper`, `test:video`.

Build a shareable app: `npm run dist` (outputs to `release/`).
