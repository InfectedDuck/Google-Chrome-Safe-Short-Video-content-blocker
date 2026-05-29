# Contributing

Thanks for helping keep Reels Blocker useful and trustworthy.

## Product Principles

- Keep the extension single-purpose: block short-form video distractions.
- Avoid browsing history, host permissions, content scripts, analytics, accounts, and remote code.
- Prefer local Chrome APIs and readable rules over clever background behavior.
- Explain every new permission in `STORE_LISTING.md` and `README.md`.

## Development

Run the checks before opening a pull request:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/test-rules.ps1
node scripts/test-shared.mjs
powershell -ExecutionPolicy Bypass -File scripts/validate-extension.ps1
powershell -ExecutionPolicy Bypass -File scripts/build-package.ps1
```

Load the project folder in `chrome://extensions` to test manually.

## Pull Requests

- Keep changes small and focused.
- Include tests for rule or settings behavior.
- Update privacy and store listing text when permissions or data behavior changes.
