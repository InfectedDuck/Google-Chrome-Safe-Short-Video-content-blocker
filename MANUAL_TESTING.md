# ReelLess v2.2.0 Manual Release Matrix

Automated fixtures and Chrome-for-Testing smoke checks cover the repeatable core paths. Complete this matrix with real logged-in and logged-out desktop accounts before Web Store submission.

## Core platforms

For YouTube, Instagram, Facebook, and TikTok, test:

- desktop logged in and logged out;
- `www` and mobile hostnames;
- direct short-form link, in-app click, and refreshed blocked page;
- back/forward navigation and SPA transitions;
- two or more open tabs;
- pause start, pause expiry, and Resume now;
- platform Off and restored default;
- extension Reload/update with existing tabs open;
- Chrome site access set to allowed and restricted.

Expected specifics:

- YouTube Short links and channel Shorts tabs disappear; direct `/shorts/{id}` becomes `/watch?v={id}`; ordinary videos and subscriptions remain.
- Instagram/Facebook Reels links disappear; direct Reels return to the feed; messages and ordinary posts remain in the default mode.
- TikTok feed/video navigation shows the ReelLess focus screen; allowed Advanced utility sections remain reachable.
- Counts rise once for a deliberate blocked attempt, not for hidden cards or repeated DOM mutations.

## Ultimate Lock

- Confirm Instagram Direct and Messenger conversations, including their videos, remain outside ReelLess protection and are not modified or counted.
- Enable Ultimate Lock using both profiles. Confirm protection stays on, schedules stay Always on, all normal platform controls and pauses are unavailable, and TikTok's focus screen has no pause button.
- Start Ultimate removal: select **Remove Ultimate Lock**, enter `REMOVE ULTIMATE`, and verify Confirm stays disabled for 60 seconds.
- Switch tabs, minimize/defocus, close, or reload Settings while the countdown runs. It must reset and require a new uninterrupted minute.
- Confirm removal after the minute; normal controls should return. Verify the wording does not imply it can prevent Chrome from disabling or uninstalling the extension.

## Appearance

- Confirm a fresh install opens ReelLess in the Dark theme without gradients or glass effects.
- Switch Settings between Dark, Light, and Use Chrome setting. Confirm the popup, Settings, onboarding, and TikTok focus screen follow the selected appearance.
- With Use Chrome setting selected, change Chrome/system appearance and reopen the popup or focus screen. It should follow the current system preference.

## Permissions and migration

- Deny an Advanced platform request: its mode must remain Off and no extension error should appear.
- Grant an Advanced site, confirm its dynamic guard, disable it, and confirm the access and guard are removed.
- Add a custom domain/path, deny and then grant access, verify block-only behavior, then remove it.
- Update a profile containing v1 or v4 settings and confirm schedule, platform selections, and custom entries are preserved in v5 `settingsV2`; the retired Direct-video setting must disappear.

## Release gate

- `npm test`, `npm run validate`, `npm run smoke`, and `npm run build` pass.
- Extension card and service-worker console have no errors.
- Five Store screenshots and permission/privacy copy match the current build.
- No unresolved core-platform bug remains.
- “ReelLess” trademark clearance is complete.
