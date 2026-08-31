# Changelog

All notable changes to ReelLess are documented here.

## 2.2.0 - 2026-08-31

- Retired the unreliable Direct-message video feature. ReelLess no longer changes Instagram Direct or Messenger conversations.
- Migrated saved settings to schema v5, safely removing the retired Direct-video field while preserving supported choices.
- Rebuilt the popup, onboarding, Settings workspace, focus screen, and Store assets around a calmer core-first interface.
- Added the optional Chrome Web Store marquee asset and refreshed release checks for the updated product promise.

## 2.1.3 - 2026-08-31

- Made the Instagram Direct and Facebook Messenger video control an independent toggle in each core platform card.
- Added early interception for recognizable Play, Video, and Reel media controls in direct-message conversations, before their viewer opens.
- Added local feedback and Chrome/DOM coverage for deliberate direct-message video attempts.

## 2.1.2 - 2026-08-31

- Fixed the Ultimate Lock panels so only the relevant action is visible: enable before activation, then removal after activation.
- Added Chrome smoke coverage to prevent both Ultimate Lock flows from appearing at once.

## 2.1.1 - 2026-08-31

- Added a minimal dark appearance as the default, with Light and Use Chrome setting options in Settings.
- Updated the popup, onboarding, in-page focus screen, and public site to use the selected or system dark appearance without returning to gradients or glass effects.
- Migrated saved settings safely to schema v4 to retain the appearance preference locally.

## 2.1.0 - 2026-08-31

- Added an optional Instagram Direct and Facebook Messenger control that hides and pauses inline direct-message videos while preserving the conversation layout.
- Added Ultimate Lock: choose either all core short-form blocking or the current platform choices, confirm with a phrase, and lock protection to always on.
- Ultimate Lock removes normal pause and settings controls. Releasing it requires selecting the removal action, entering a second phrase, and completing an uninterrupted one-minute wait.
- Documented the lock boundary clearly: Chrome can still disable, uninstall, or clear the extension; Ultimate Lock cannot override browser or device controls.
- Migrated local settings safely to the versioned v3 schema.

## 2.0.0 - 2026-08-31

- Rebranded the extension as ReelLess — Shorts & Reels Blocker.
- Replaced core DNR redirects with site-specific navigation and DOM guards for YouTube, Instagram, Facebook, and TikTok.
- Added YouTube Shorts-to-watch conversion, Reels feed redirects, and a calm TikTok focus screen.
- Fixed the Always on midnight gap and added schedule/pause boundary coverage.
- Introduced the versioned v2 settings migration and separate privacy-minimal statistics key.
- Moved seven additional platforms and custom destinations behind explicit optional site access.
- Rebuilt onboarding, popup, settings, privacy/support pages, icon, listing copy, and five real UI screenshots.
- Added DOM fixtures, permission/counter tests, Chrome extension smoke tests, verified packaging, and CI.

## 1.2.5 - 2026-05-30

- Added a social-platform guard for TikTok, Instagram, Facebook, X, Reddit, Snapchat, Twitch, Pinterest, LinkedIn, and Threads section navigation.
- Section-level blocks now redirect blocked in-app navigation back to the platform home page where possible.
- Full-site modes still use Chrome's normal blocked-page behavior, so Block Social Media and per-platform Block All show an error instead of redirecting.

## 1.2.4 - 2026-05-30

- Added an Instagram-only guard script for Reels, Explore, and Stories internal navigation.
- Blocked Instagram sections now redirect back to Instagram home instead of remaining usable after in-app clicks.
- Updated Instagram section rules so page navigation can be handled by the local guard while background media requests remain blocked.

## 1.2.3 - 2026-05-30

- Fixed stale Chrome blocking rules from older builds by clearing all dynamic and session rules before applying the current saved settings.
- This makes platform `Off` settings remove old TikTok rules even if they were created by an earlier extension version.

## 1.2.2 - 2026-05-30

- Fixed background rule syncing so it evaluates the full saved settings when applying blocking rules.
- Platform, schedule, preset, and custom list changes now apply immediately instead of waiting for a separate save click.
- Opening the settings page now asks the extension to resync rules, which helps clear stale rules from older versions.

## 1.2.1 - 2026-05-30

- Fixed schedule preset time fields so Always On, Work Hours, Sleep Time, and other presets immediately show their own time windows.
- Limited direct time editing to the Custom schedule preset.
- Fixed platform controls so changing a platform quick mode or section automatically switches Focus Mode to Custom.

## 1.2.0 - 2026-05-30

- Added global modes for short-form blocking, social media blocking, custom controls, and pause.
- Added schedule presets and manual temporary pause buttons.
- Expanded platform controls to Facebook, X, Reddit, Snapchat, Twitch, Pinterest, LinkedIn, and Threads.
- Added section-level controls for feeds, profiles, messages, create pages, and short-form sections.
- Redesigned the settings page and GitHub Pages site.

## 1.1.0 - 2026-05-29

- Added platform tabs for TikTok, Instagram, and YouTube.
- Added per-platform modes for short-form only, full-site blocking, and off.
- Moved built-in platform blocking to local dynamic rules so settings can control each platform.

## 1.0.2 - 2026-05-29

- Added a YouTube-only guard script that redirects internal Shorts clicks back to YouTube home.
- Updated privacy and store listing text to disclose the YouTube-only script.

## 1.0.1 - 2026-05-29

- Strengthened YouTube Shorts blocking with direct Chrome URL filters.
- Added tests for reported Shorts URLs.

## 1.0.0 - 2026-05-29

- Stabilized the privacy-first extension for public release.
- Added launch-ready documentation and store listing materials.

## 0.5.0 - 2026-05-29

- Added optional short-form blocking presets.
- Added community, security, and issue template documents.

## 0.4.0 - 2026-05-29

- Added local schedules for Always On, Work Hours, and Custom Schedule modes.

## 0.3.0 - 2026-05-29

- Added a local custom block list.
- Added local settings storage without sync or account requirements.

## 0.2.0 - 2026-05-29

- Added a local focus page.
- Improved the popup trust messaging.

## 0.1.0 - 2026-05-29

- Added the first Manifest V3 extension.
- Blocked TikTok, Instagram Reels, and YouTube Shorts using local Chrome rules.
- Added privacy policy, package script, rule tests, and Chrome Web Store listing draft.
