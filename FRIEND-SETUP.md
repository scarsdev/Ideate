# Setting up Ideate (Gather) — no terminal needed

This guide is for trying the app on your Mac. Everything below is normal
clicking — no command line.

## 1. Install

1. Open `Gather-0.1.0-arm64.dmg` and drag **Gather** into **Applications**.
2. Try opening Gather from Applications.
3. macOS will block the first launch (the app isn't notarized). Pick whichever
   applies:
   - **Right-click (or Control-click) Gather → Open → Open.** The app now
     opens normally forever after.
   - If it instead says *"Gather is damaged and can't be opened"*: open
     **System Settings → Privacy & Security**, scroll down, and click
     **"Open Anyway"** next to the Gather message. Then open Gather again.
   - Still stuck? Double-click **Fix-Gatekeeper.command** (in this folder) —
     it does the fix for you and closes itself.

> This build is for Apple Silicon (M-series) Macs. Intel Macs need a different build.

## 2. Connect the Chrome extension

1. In Gather: **Settings (⌘,) → Sync**.
2. Click **Reveal extension folder** — Finder opens at a `sync-extension`
   folder inside the app. Leave that window open.
3. In Chrome: open `chrome://extensions`, flip on **Developer mode** (top-right),
   click **Load unpacked**, and choose the `sync-extension` folder from Finder.
4. Back in Gather's Sync settings, click **Copy** next to **Access token**.
5. Click the **Gather Capture** icon in Chrome's toolbar → **Options**:
   - Server URL: `http://127.0.0.1:47821`
   - Token: paste what you copied
   - Instagram username (optional — only needed for the Instagram import)
   - Click **Save**, then **Test connection** — you should see a green success.

## 3. Getting your stuff in

- **X bookmarks**: open `x.com/i/bookmarks`, click the extension → **Import bookmarks**.
- **Instagram saves**: open your Saved page, extension → **Import saved**.
- **Pinterest**: extension → **Import Pinterest**; leave the tab it opens until
  it says complete.
- **As you browse**: with the extension enabled, new saves and boosts are
  captured automatically.

## 4. Good to know

- Your data stays on your Mac: `~/Library/Application Support/gatheros-clone/`
  (delete it together with the app to remove everything).
- AI tagging is optional and needs keys in Settings → AI Usage.
- If a video reports an expired link (Instagram), re-run that import —
  links refresh automatically in the background.
- Problems? Tell the person who gave you this.
