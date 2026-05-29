# Chrome Web Store Listing Draft

## Short Description

Blocks short-form video with local Chrome rules and privacy-first permissions.

## Detailed Description

Reels Blocker helps reduce short-form video distractions by blocking TikTok, Instagram Reels, and YouTube Shorts. You can also add your own local block entries, enable optional short-form presets, and choose Always On, Work Hours, or Custom Schedule modes.

The extension is intentionally simple and privacy-friendly. It uses Chrome's built-in Manifest V3 `declarativeNetRequest` API, which means Chrome applies the block rules locally. There are no content scripts, no host permissions, no analytics, no remote code, and no browsing history access.

Blocked destinations:

- TikTok website
- Instagram Reels
- YouTube Shorts
- Optional preset short-form destinations
- Custom domain/path entries you add locally

## Single Purpose

Block selected short-form video destinations in Chrome.

## Permission Justification

`declarativeNetRequest`: Required so Chrome can apply local block rules for TikTok, Instagram Reels, and YouTube Shorts.

`storage`: Required to save custom block entries, preset toggles, and schedule settings locally on the user's device.

`alarms`: Required to apply schedule changes at the correct local time.

## Data Use

This extension does not collect or transmit user data.
