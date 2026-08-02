# Live Sleeper sync

If the draft runs on Sleeper (league drafts or public mocks):

1. Settings → paste the **league ID** (from the league URL). This imports the
   real team names into the board and finds the draft automatically. Or paste
   a **draft ID** directly.
2. Hit **🔄 Sync** in the header when the draft starts. Every 10 seconds the
   app pulls `/v1/draft/{id}/picks` (public, no login) and marks new picks —
   yours land as ✓ MINE (matched by your draft slot), everyone else's as
   ✕ taken. The chip in the header shows progress.
3. Manual clicks still work — sync only appends picks it hasn't seen and
   never overwrites your board (it skips players already marked).

Player matching uses the same Sleeper IDs that power the headshots (355/390
skill players + all 32 team defenses). Unmatched players simply stay manual.

Not on Sleeper? The board works exactly as before — mark picks yourself or
📋 Paste the pick log.
