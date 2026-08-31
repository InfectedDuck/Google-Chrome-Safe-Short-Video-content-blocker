# Security Policy

The latest tagged release is supported. Report a vulnerability through a private GitHub security advisory; do not publish exploit details before the maintainer can investigate.

## Security and privacy goals

- No browsing-history, cookies, account, or message access.
- Core scripts are limited to YouTube, Instagram, Facebook, and TikTok.
- Advanced origins are optional and requested only when enabled.
- Custom-domain rules use `declarativeNetRequestWithHostAccess` only after an exact origin grant.
- No remote code, analytics, tracking, or extension-originated network calls.
- Local statistics contain only a local date and two counts.
