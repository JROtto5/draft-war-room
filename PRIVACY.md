# Privacy

Draft War Room is a static page. There is no backend, no accounts, no analytics, no cookies.

- **Your board lives in your browser** (localStorage). Export/share links are created only when you click them.
- **Outbound requests**: player headshots (sleepercdn.com), team logos (a.espncdn.com), live injuries & news (site.api.espn.com), trending adds (api.sleeper.app). These are plain public GETs; no identifying data is sent beyond a normal HTTP request.
- The password screen is a convenience lock, hashed locally; it is not a security boundary.
- Deleting your browser storage deletes everything.
