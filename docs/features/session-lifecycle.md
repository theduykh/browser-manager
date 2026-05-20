# Session lifecycle — heartbeat & zombie killer

**Slug:** `session-lifecycle`
**Owner agent:** `backend-developer`
**Status:** `shipped`
**Last updated:** 2026-05-19

## Context

Allocated browsers consume an Xvfb display, two listening ports and ~300 MB of RAM each. A test client that crashes or forgets to `release` would leak these resources until manual intervention. Phase 3+5 add two cooperating mechanisms: a client-driven **heartbeat** that keeps a session alive, and a server-driven **zombie killer** that force-releases sessions whose heartbeat stops.

Spec reference: [yeu-cau.md §5.3](../../yeu-cau.md).

## Design

Each `profiles` row has a `last_active` timestamp. It is set by:

- `POST /api/browser/allocate` (initial).
- `POST /api/browser/heartbeat` (client ping while a session is in use).

A background interval (default every 5 minutes) scans rows where `status='IN_USE'` and `(now - last_active) > MAX_SESSION_MS` (default 30 minutes). Each match is force-released through the same `releaseBrowser()` code path used by `/api/browser/release`, so processes are killed and the row resets to `IDLE`.

The Live View component in the frontend posts a heartbeat every 60 seconds while open. Test clients connecting via CDP from outside should heartbeat themselves if their tests last longer than `MAX_SESSION_MS`. Alternatively, raise `MAX_SESSION_MS` for long-running suites.

## Files

- [backend/src/cron/zombie-killer.ts](../../backend/src/cron/zombie-killer.ts) — interval loop.
- [backend/src/modules/browser/browser.routes.ts](../../backend/src/modules/browser/browser.routes.ts) — `/heartbeat` endpoint.
- [backend/src/main.ts](../../backend/src/main.ts) — starts the cron and tears it down on signal.
- [frontend/src/lib/heartbeat.ts](../../frontend/src/lib/heartbeat.ts) — React hook for the Live View page.

## API / Usage

`POST /api/browser/heartbeat` body `{ profile_id }` → `{ ok: true, last_active }`. Returns 409 `NOT_IN_USE` if the profile is not currently allocated.

Env vars:

| Name | Default | Meaning |
| --- | --- | --- |
| `MAX_SESSION_MS` | `1800000` (30 min) | Idle threshold before force-release |
| `ZOMBIE_SCAN_MS` | `300000` (5 min) | How often the cron runs |

## Testing

```powershell
# Reduce timeouts to make the test fast
docker compose run --rm -e MAX_SESSION_MS=10000 -e ZOMBIE_SCAN_MS=5000 backend node backend/dist/main.js &
# (or restart with these env values in docker-compose.yml temporarily)

curl -X POST http://localhost:3000/api/browser/allocate -H "Content-Type: application/json" -d "{}"
# wait > 10s without sending heartbeat
Start-Sleep 15
curl http://localhost:3000/api/profiles
# expect status back to IDLE
```

Heartbeat keep-alive check:

```powershell
$id = 1
1..3 | ForEach-Object {
  curl -X POST http://localhost:3000/api/browser/heartbeat -H "Content-Type: application/json" -d "{\"profile_id\":$id}"
  Start-Sleep 5
}
# profile should remain IN_USE even after total elapsed > MAX_SESSION_MS, because last_active is refreshed.
```

## History

- 2026-05-19 — Initial implementation (heartbeat endpoint + zombie killer cron).
