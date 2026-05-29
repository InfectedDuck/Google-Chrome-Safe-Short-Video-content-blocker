# Reels Blocker

A privacy-friendly Chrome extension that blocks short-form video with local Chrome rules.

## Trust First

Reels Blocker is designed for people who want fewer short-form video distractions without installing an extension that can read every site they visit.

It does not request browsing history, host permissions, content scripts, cookies, account access, analytics, or remote code. Custom entries, presets, and schedules are stored locally in Chrome.

## What It Blocks

- `tiktok.com` and subdomains
- `instagram.com/reel/...`
- `instagram.com/reels/...`
- `youtube.com/shorts/...`
- YouTube channel Shorts tabs, such as `youtube.com/@channel/shorts`
- Optional presets for Facebook Reels, Snapchat Spotlight, and Reddit Shorts
- Custom domain/path entries that you add yourself

## Why It Is Safe

- Uses Manifest V3.
- Uses Chrome's `declarativeNetRequest` API, so Chrome applies the block rules locally.
- Does not use content scripts.
- Does not request host permissions.
- Does not read browsing history.
- Does not collect, store, sell, or transmit user data.
- Does not load remote code.
- Stores settings only in `chrome.storage.local`.

## Features

- Always On, Work Hours, and Custom Schedule modes.
- Local custom block list.
- Optional preset toggles for additional short-form sites.
- Trust-focused popup and local focus page.

## Install Locally

1. Open `chrome://extensions`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select this project folder.
5. Visit `https://www.tiktok.com`, `https://www.instagram.com/reels/`, or `https://www.youtube.com/shorts/...` to confirm Chrome blocks the page.

## Build A Store ZIP

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-package.ps1
```

The ZIP will be created at `dist/reels-blocker.zip`.

## GitHub Pages

The public website lives in `docs/` so GitHub Pages can deploy directly from the `main` branch.

After pushing the repository, enable it in GitHub:

1. Open repository Settings.
2. Open Pages.
3. Set Source to Deploy from a branch.
4. Select `main` and `/docs`.

## Publish Checklist

1. Create a Chrome Web Store developer account.
2. Build `dist/reels-blocker.zip`.
3. Upload the ZIP in the Chrome Web Store Developer Dashboard.
4. Use the text in `STORE_LISTING.md` as a starting point.
5. Use `PRIVACY.md` as the extension privacy policy.
6. Declare that the extension does not collect user data.
7. Submit for review.

Chrome Web Store rules can change, so verify the final listing requirements in the official dashboard before submitting.

## Git Release Flow

This repository uses manual SemVer tags.

```powershell
git add .
git commit -m "release: v1.0.0"
git tag -a v1.0.0 -m "v1.0.0"
git push origin main --follow-tags
```

Upload `dist/reels-blocker.zip` to GitHub Releases and Chrome Web Store after the release checks pass.

## Release Checklist

Before each release:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/test-rules.ps1
powershell -ExecutionPolicy Bypass -File scripts/validate-extension.ps1
powershell -ExecutionPolicy Bypass -File scripts/build-package.ps1
```

Then commit, tag, push, and upload `dist/reels-blocker.zip` as the release artifact.
