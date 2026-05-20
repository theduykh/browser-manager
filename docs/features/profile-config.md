# Profile configuration

**Slug:** `profile-config`
**Owner agent:** `backend-developer`
**Status:** `shipped`
**Last updated:** 2026-05-19

## Context

Different test scenarios need different browser environments — a mobile-emulation suite wants 414×896, a Windows-locale UX test wants `--lang=en-US`, an integration test wants `--disable-web-security`. Hard-coding these in the orchestrator would force a redeploy per scenario, so they belong on the profile row itself. This feature adds four user-editable fields stored per profile: `window_width`, `window_height`, `launch_args`, `note`.

## Design

### Storage

Four new columns on `profiles`:

| Column | Type | Default | Validation |
| --- | --- | --- | --- |
| `window_width`  | INTEGER | `1920` | integer, 320–7680 |
| `window_height` | INTEGER | `1080` | integer, 320–7680 |
| `launch_args`   | TEXT    | `''`   | ≤ 4000 chars |
| `note`          | TEXT    | `''`   | ≤ 2000 chars |

Added via idempotent `ALTER TABLE ... ADD COLUMN` in [db/index.ts](../../backend/src/db/index.ts), so existing dev DBs keep working. The full schema definition lives in [db/schema.sql](../../backend/src/db/schema.sql) for fresh installs.

### Applying at allocate

The orchestrator reads the row before spawning:

- `Xvfb` starts at `${window_width}x${window_height}x24` instead of the previous hard-coded `1920x1080`.
- Chromium gets `--window-size=W,H` and `--window-position=0,0`.
- `launch_args` is split on whitespace (quoting **not** supported — by design, to keep parsing predictable) and the resulting tokens are appended after the orchestrator's required flags. User flags can override defaults because Chromium honors the last occurrence.

`note` is metadata only — never passed to any process.

### Editing rules

- `profile_name` and `window_*` can only be edited when status is not `IN_USE`. Renaming `IN_USE` profiles would invalidate the active `user-data-dir` path; resizing while running would have no effect anyway since Xvfb is already started.
- `launch_args` and `note` can be edited any time. Changes to `launch_args` take effect on the next allocate.

PATCH accepts partial input: only the keys present in the request body are touched. The form on the frontend sends only fields that actually changed.

## Files

- [backend/src/db/schema.sql](../../backend/src/db/schema.sql), [backend/src/db/index.ts](../../backend/src/db/index.ts) — schema + idempotent column add.
- [backend/src/types.ts](../../backend/src/types.ts) — `ProfileConfigInput`.
- [backend/src/modules/profiles/profiles.service.ts](../../backend/src/modules/profiles/profiles.service.ts) — `createProfile`, `updateProfile`, `normalizeConfig`.
- [backend/src/modules/profiles/profiles.routes.ts](../../backend/src/modules/profiles/profiles.routes.ts) — POST/PATCH body parsing + error mapping.
- [backend/src/modules/browser/orchestrator.service.ts](../../backend/src/modules/browser/orchestrator.service.ts) — Xvfb size + Chromium `--window-size` + extra args.
- [frontend/src/api/types.ts](../../frontend/src/api/types.ts), [frontend/src/api/profiles.ts](../../frontend/src/api/profiles.ts) — typed client.
- [frontend/src/components/ProfileForm.tsx](../../frontend/src/components/ProfileForm.tsx) — shared form, computes which fields are dirty and only sends those.
- [frontend/src/components/CreateProfileModal.tsx](../../frontend/src/components/CreateProfileModal.tsx), [frontend/src/components/ProfileDetail.tsx](../../frontend/src/components/ProfileDetail.tsx) — both wrap `ProfileForm`.

## API / Usage

`POST /api/profiles` body:

```json
{
  "profile_name": "p1",
  "window_width": 1280,
  "window_height": 720,
  "launch_args": "--disable-web-security --lang=en-US",
  "note": "Used by the checkout flow tests."
}
```

All four config fields are optional; defaults apply.

`PATCH /api/profiles/:id` accepts any subset of the same fields plus `profile_name`. Returns the updated `Profile`.

Errors:

- `400 INVALID_NAME` — name fails regex `^[A-Za-z0-9._@-]{1,64}$` (no leading/trailing `.`).
- `400 INVALID_CONFIG` — dimensions out of range or args/note too long.
- `409 PROFILE_BUSY` — rename attempted while `IN_USE`.
- `409 DUPLICATE_PROFILE` — new name collides.

## Testing

```powershell
# Create with custom config
curl -X POST http://localhost:3000/api/profiles `
  -H "Content-Type: application/json" `
  -d '{\"profile_name\":\"mobile1\",\"window_width\":414,\"window_height\":896,\"launch_args\":\"--user-agent=test-ua\",\"note\":\"iPhone XR shape\"}'

# Allocate and verify Xvfb screen
curl -X POST http://localhost:3000/api/browser/allocate -H "Content-Type: application/json" -d '{\"profile_id\":1}'
docker exec browser-manager-backend bash -c "xdpyinfo -display :100 | grep dimensions"
# expected: dimensions:  414x896 pixels

# Check Chromium got the extra arg
docker exec browser-manager-backend bash -c "ps aux | grep -E 'remote-debugging-port=19223' | grep -o 'user-agent=test-ua'"

# Edit note while running, then args (which only applies next time)
curl -X PATCH http://localhost:3000/api/profiles/1 -H "Content-Type: application/json" -d '{\"note\":\"updated\"}'
# rename while running → 409
curl -X PATCH http://localhost:3000/api/profiles/1 -H "Content-Type: application/json" -d '{\"profile_name\":\"x\"}'
```

UI test: open `http://localhost:8080`, create a profile with width 800 / height 600 / arg `--lang=ja`. Allocate it. Live View should show an 800×600 desktop with the Chromium showing Japanese in its menus.

## History

- 2026-05-19 — Initial implementation (4 fields, shared form, orchestrator integration).
- 2026-05-19 — Expanded `profile_name` charset to allow `.` `@` for email-style names. Added safety checks against `.`, `..`, leading/trailing `.`.
