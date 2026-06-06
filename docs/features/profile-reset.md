# Profile reset

**Slug:** `profile-reset`
**Owner agent:** `backend-developer`
**Status:** `shipped`
**Last updated:** 2026-05-19

## Context

When a profile gets stuck in `CORRUPT` (Chromium failed to launch, lock files left behind) or in `IN_USE` with a session that can't be released through the normal flow (PIDs gone, ports half-bound), the user needs a single button that brings the row back to a known-good state without restarting the whole backend.

Spec reference: [README.md — Process Cleanup](../../README.md#process-cleanup); this is the manual counterpart to the Zombie Killer.

## Design

`POST /api/profiles/:id/reset` performs, in order:

1. If `status='IN_USE'`, run the normal `releaseBrowser()` flow (best-effort — failures swallowed).
2. Clean Chromium singleton lock files in the profile folder.
3. Force the row to `status='IDLE'`, NULL the slot/port/pid/allocated_at fields, refresh `last_active`.

Profile data on disk (cookies, localStorage, etc.) is left intact — reset is about process state, not user-data wipe. A future endpoint could optionally clear the profile folder.

## Files

- [backend/src/modules/profiles/profiles.service.ts](../../backend/src/modules/profiles/profiles.service.ts) — `resetProfile()`.
- [backend/src/modules/profiles/profiles.routes.ts](../../backend/src/modules/profiles/profiles.routes.ts) — `POST /:id/reset` route.
- [frontend/src/pages/Dashboard.tsx](../../frontend/src/pages/Dashboard.tsx) — Reset button on `CORRUPT` and `IN_USE` rows.

## API / Usage

`POST /api/profiles/:id/reset` → returns the updated `Profile`. 404 if the profile doesn't exist.

## Testing

```powershell
# Force a CORRUPT state by allocating then killing Chromium externally
curl -X POST http://localhost:3000/api/browser/allocate -H "Content-Type: application/json" -d "{\"profile_id\":1}"
docker exec browser-manager-backend bash -c "pkill -9 -f remote-debugging-port"
# Wait a few seconds, status may stay IN_USE because Node didn't notice
curl -X POST http://localhost:3000/api/profiles/1/reset
curl http://localhost:3000/api/profiles | findstr "status"
# expect IDLE
```

## History

- 2026-05-19 — Initial implementation.
