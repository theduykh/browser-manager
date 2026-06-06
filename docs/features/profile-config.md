# Profile configuration

**Slug:** `profile-config`
**Owner agent:** `backend-developer`
**Status:** `shipped`
**Last updated:** 2026-06-06

## Context

Different test scenarios need different browser environments — a mobile-emulation suite wants 414×896, a Windows-locale UX test wants `--lang=en-US`, an integration test wants `--disable-web-security`. Hard-coding these in the orchestrator would force a redeploy per scenario, so they belong on the profile row itself. This feature adds user-editable fields stored per profile: `window_width`, `window_height`, `launch_args`, `note`, and `launch_config`.

## Design

### Storage

Columns on `profiles`:

| Column | Type | Default | Validation |
| --- | --- | --- | --- |
| `window_width`  | INTEGER | `1920` | integer, 320–7680 |
| `window_height` | INTEGER | `1080` | integer, 320–7680 |
| `launch_args`   | TEXT    | `''`   | ≤ 4000 chars, raw whitespace-separated tokens |
| `note`          | TEXT    | `''`   | ≤ 2000 chars |
| `launch_config` | TEXT    | `'{}'` | JSON object, serialised ≤ 4000 chars |

Added via idempotent `ALTER TABLE ... ADD COLUMN` in [db/index.ts](../../backend/src/db/index.ts), so existing dev DBs keep working. The full schema definition lives in [db/schema.sql](../../backend/src/db/schema.sql) for fresh installs.

### Applying at allocate

The orchestrator reads the row before spawning:

- `Xvfb` starts at `${window_width}x${window_height}x24` instead of the previous hard-coded `1920x1080`.
- Chromium gets `--window-size=W,H` and `--window-position=0,0`.
- `launch_config` is a structured JSON object whose known keys are each translated to a Chromium flag (see table below). Structured args are injected before `launch_args` tokens, so raw `launch_args` can still override them.
- `launch_args` is split on whitespace (quoting **not** supported — by design, to keep parsing predictable) and the resulting tokens are appended last after all structured args.

`note` is metadata only — never passed to any process.

### `launch_config` field mapping

| Key | Chromium flag |
| --- | --- |
| `lang` (string) | `--lang=<value>` |
| `proxy` (string) | `--proxy-server=<value>` |
| `disableWebSecurity` (bool) | `--disable-web-security` |
| `disableExtensions` (bool) | `--disable-extensions` |
| `muteAudio` (bool) | `--mute-audio` |
| `ignoreCertErrors` (bool) | `--ignore-certificate-errors` |
| `disableNotifications` (bool) | `--disable-notifications` |
| `disablePopupBlocking` (bool) | `--disable-popup-blocking` |

Unknown keys in the stored JSON are silently ignored, keeping the schema forward-compatible.

### Editing rules

- `profile_name` and `window_*` can only be edited when status is not `IN_USE`. Renaming `IN_USE` profiles would invalidate the active `user-data-dir` path; resizing while running would have no effect anyway since Xvfb is already started.
- `launch_args` and `note` can be edited any time. Changes to `launch_args` take effect on the next allocate.

PATCH accepts partial input: only the keys present in the request body are touched. The form on the frontend sends only fields that actually changed.

### Frontend controls

[ProfileForm.tsx](../../frontend/src/components/ProfileForm.tsx) renders dedicated inputs instead of raw flag text:

- **Window size** — a `<select>` of common presets (Full HD, 1440×900, 1366×768, HD, 2K, 4K) plus `Custom`. Picking a preset sets `window_width`/`window_height`; `Custom` reveals the manual `w × h` number inputs. `detectPreset()` maps the current dimensions back to the matching preset label.
- **Language** — a `<select>` writing `launch_config.lang`.
- **Proxy** — a text input writing `launch_config.proxy`; an empty value removes the key.
- **Browser flags** — a checklist for the six boolean keys.
- **Additional arguments** — the raw `launch_args` textarea, kept for flags with no dedicated control.

`launch_config` is an object, so dirty-detection compares `JSON.stringify(v.launch_config)` against the initial value (not reference equality). On save the whole `launch_config` object is sent — not a per-key diff — so the backend applies full-replace semantics for that field.

## Files

- [backend/src/db/schema.sql](../../backend/src/db/schema.sql), [backend/src/db/index.ts](../../backend/src/db/index.ts) — schema + idempotent column add.
- [backend/src/types.ts](../../backend/src/types.ts) — `ProfileConfigInput`, `LaunchConfig`, `parseLaunchConfig`.
- [backend/src/modules/profiles/profiles.service.ts](../../backend/src/modules/profiles/profiles.service.ts) — `createProfile`, `updateProfile`, `normalizeConfig`.
- [backend/src/modules/profiles/profiles.routes.ts](../../backend/src/modules/profiles/profiles.routes.ts) — POST/PATCH body parsing + error mapping.
- [backend/src/modules/browser/orchestrator.service.ts](../../backend/src/modules/browser/orchestrator.service.ts) — Xvfb size + Chromium `--window-size` + extra args.
- [frontend/src/api/types.ts](../../frontend/src/api/types.ts), [frontend/src/api/profiles.ts](../../frontend/src/api/profiles.ts) — typed client.
- [frontend/src/components/ProfileForm.tsx](../../frontend/src/components/ProfileForm.tsx) — shared form, structured controls (presets, language, proxy, flags), computes which fields are dirty and only sends those.
- [frontend/src/components/CreateProfileModal.tsx](../../frontend/src/components/CreateProfileModal.tsx), [frontend/src/components/ProfileDetail.tsx](../../frontend/src/components/ProfileDetail.tsx) — both wrap `ProfileForm`; `ProfileDetail` parses the stored `launch_config` JSON into the form's initial values.
- [frontend/src/styles.css](../../frontend/src/styles.css) — `select`, `.flag-list`, `.flag-item` styling for the new controls.

## API / Usage

`POST /api/profiles` body:

```json
{
  "profile_name": "p1",
  "window_width": 1280,
  "window_height": 720,
  "launch_args": "--extra-flag",
  "note": "Used by the checkout flow tests.",
  "launch_config": {
    "lang": "en-US",
    "proxy": "http://proxy.internal:3128",
    "disableWebSecurity": true,
    "muteAudio": true
  }
}
```

All config fields are optional; defaults apply. `launch_config` defaults to `{}` (no extra flags).

`PATCH /api/profiles/:id` accepts any subset of the same fields plus `profile_name`. Returns the updated `Profile`.

Errors:

- `400 INVALID_NAME` — name fails regex `^[A-Za-z0-9._@-]{1,64}$` (no leading/trailing `.`).
- `400 INVALID_CONFIG` — dimensions out of range, args/note too long, or `launch_config` serialises to more than 4000 chars.
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

UI test: open `http://localhost:8088` and open the create panel. Verify the Configuration section shows the structured controls:

1. **Window size** defaults to "1920 × 1080 — Full HD"; selecting `Custom` reveals the `w × h` number inputs; entering `800 × 600` and re-opening a preset hides them again.
2. **Language** → pick "Japanese"; **Browser flags** → check "Mute audio"; **Proxy** → enter `1.2.3.4:8080`. Save.
3. Allocate the profile, then confirm the flags reached Chromium:

   ```powershell
   docker exec browser-manager-backend bash -c "ps aux | grep -- '--remote-debugging-port' | grep -oE -- '--lang=ja-JP|--mute-audio|--proxy-server=[^ ]+'"
   ```

   Expected: `--lang=ja-JP`, `--mute-audio`, `--proxy-server=1.2.3.4:8080`.
4. Re-open the saved profile (detail panel) and change only the language; the browser DevTools Network tab should show a PATCH body containing only `{"launch_config":{...}}` — dirty-field tracking sends nothing else.

## History

- 2026-05-19 — Initial implementation (4 fields, shared form, orchestrator integration).
- 2026-05-19 — Expanded `profile_name` charset to allow `.` `@` for email-style names. Added safety checks against `.`, `..`, leading/trailing `.`.
- 2026-06-06 — Added `launch_config` structured JSON field; maps to Chromium flags at allocate time. Raw `launch_args` preserved as power-user escape hatch.
- 2026-06-06 — Fixed: the Dashboard create payload omitted `launch_config`, so structured options set in the create modal were dropped on create (edit was unaffected). The create handler now spreads all form values.
