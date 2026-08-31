# Contributing to ReelLess

Keep the extension focused on removing short-form distractions while preserving useful pages.

## Product principles

- Four reliable core sites matter more than a larger platform count.
- Runs only on sites the user enables; Advanced access is requested from a user action.
- No browsing-history permission, telemetry, accounts, remote code, ads, or external requests.
- Never store blocked URLs, titles, or platform history.
- DOM guards must use debounced observers and safe ancestors; never hide an entire main layout accidentally.
- Permission, processing, or storage changes require matching privacy and Store listing updates.

## Checks

```powershell
npm install
npx playwright-core install chromium
npm test
npm run validate
npm run smoke
npm run build
```

Also load the project folder from `chrome://extensions` and manually exercise logged-in and logged-out layouts before a release.
