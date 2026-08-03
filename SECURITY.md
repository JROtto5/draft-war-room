# Security Policy

## Scope

Draft War Room is a fully static PWA — no server, no accounts, no database.
All state lives in the browser's localStorage. Network calls go only to
public, read-only Sleeper and ESPN endpoints over HTTPS.

Already in place:

- Content-Security-Policy meta (no external script origins, self-hosted fonts)
- Security headers via `vercel.json` (nosniff, frame-deny, referrer policy)
- The lock screen is a convenience gate (SHA-256 compare), **not** a security
  boundary — anything in this app is client-side and inspectable.
- `integrity.json` ships a sha256 manifest of all files per release.

## Reporting

Open a GitHub issue, or email the address on the JROtto5 profile for
anything sensitive. It's a fantasy football tool — but broken CSP, XSS via
player data, or supply-chain issues in CI actions are all real and welcome
reports.
