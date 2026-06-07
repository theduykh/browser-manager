# Browser Manager — HTTP API Reference

Reference for integrating a test framework (Playwright, Puppeteer, custom CDP client) with a running Browser Manager instance.

- **Base URL:** `http://<host>:3000` (default port; configurable via `PORT` env var).
- **Auth:** none. The service is designed for LAN / localhost deployment.
- **Content type:** all request and response bodies are JSON. Always send `Content-Type: application/json` on requests with a body.
- **Versioning:** unversioned during MVP; breaking changes will be announced in [docs/features/](features/) commits.

---

## 1. Concepts

A **profile** is a persistent Chromium user-data directory on the server, with an associated configuration (window size, launch options, note), optional organization (one **group** + many free-form **tags**), and a lifecycle status:

| Status | Meaning |
| --- | --- |
| `IDLE` | Available to allocate. |
| `IN_USE` | Currently bound to a running browser; do not reallocate. |
| `CORRUPT` | Last launch failed or the row needs manual recovery. Use `POST /:id/reset`. |

A **slot** is a numeric reservation (1..`MAX_SLOTS`) that maps to a unique set of network ports:

| Resource | Port formula | Example (slot 3) |
| --- | --- | --- |
| Xvfb display | `:${99 + slot}` | `:102` |
| Live View WebSocket (noVNC) | `6000 + slot` | `6003` |
| Chromium CDP | `9222 + slot` | `9225` |

Internally the orchestrator also uses `19222 + slot` for Chromium-bound CDP and bridges it via `socat`; integrators never see that port.

### Typical session flow

```
POST /api/browser/allocate          → returns slot, ws_port, cdp_port, cdp_endpoint
chromium.connectOverCDP(cdp_endpoint)
... drive the browser ...
POST /api/browser/heartbeat         (optional, every <30 min)
POST /api/browser/release           → tears the browser down
```

---

## 2. Error format

Every error returns:

```json
{ "error": "<MACHINE_CODE>", "message": "<human readable>" }
```

with an HTTP status that reflects the category (400 invalid input, 404 not found, 409 conflict, 503 capacity, 500 internal). All `error` codes used by the service are listed at the end of this document.

---

## 3. Endpoints

### 3.1 `GET /health`

Liveness probe.

**Response 200**
```json
{ "status": "ok", "phase": 2, "ts": "2026-05-19T03:21:00.000Z" }
```

---

### 3.2 `GET /api/profiles`

List every profile, ordered by id ascending.

**Response 200** — array of [Profile](#profile-shape).

---

### 3.3 `POST /api/profiles`

Create a new profile and its on-disk folder.

**Request body**

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `profile_name` | string | yes | — | Must match `^[A-Za-z0-9._@-]{1,64}$` (also rejects `.`, `..`, leading/trailing `.`). Also used as the folder name under `PROFILES_ROOT`. |
| `window_width` | integer | no | `1920` | 320–7680. Sets both Xvfb screen and Chromium window size. |
| `window_height` | integer | no | `1080` | 320–7680. |
| `launch_args` | string | no | `""` | Whitespace-separated Chromium flags appended **after** all `launch_config` flags. Quoted args are **not** supported. Max 4000 chars. |
| `note` | string | no | `""` | Free-form metadata; not used at launch. Max 2000 chars. |
| `launch_config` | object | no | `{}` | Structured Chromium options (see [launch_config](#launch-config)). Stored as JSON; serialised form max 4000 chars. |
| `group_id` | integer \| null | no | `null` | The [group](#group-shape) this profile belongs to. `null` = Ungrouped (the default). Must reference an existing group. |
| `tags` | string[] | no | `[]` | Free-form labels. Each tag matches `^[\p{L}\p{N}._-]{1,32}$`; max 20 per profile. Duplicates are de-duplicated. |

**Response 201** — the created [Profile](#profile-shape).

**Errors**
- `400 INVALID_NAME` — `profile_name` fails regex.
- `400 INVALID_CONFIG` — dimensions out of range, args/note too long, or `launch_config` serialises to more than 4000 chars.
- `409 DUPLICATE_PROFILE` — name already in use.

**Example**

```bash
curl -X POST http://localhost:3000/api/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "profile_name": "checkout_flow",
    "window_width": 1280,
    "window_height": 720,
    "launch_config": {
      "lang": "en-US",
      "proxy": "http://proxy.internal:3128",
      "disableWebSecurity": true,
      "muteAudio": true
    },
    "launch_args": "--user-agent=custom-ua",
    "note": "Used by the checkout-flow regression suite."
  }'
```

---

### 3.4 `PATCH /api/profiles/:id`

Partial update. Only fields present in the body are touched.

**Request body** — same shape as create, all fields optional, plus `profile_name`. Renaming is rejected while `IN_USE`. Renaming also renames the on-disk folder.

**Response 200** — the updated [Profile](#profile-shape).

**Errors**
- `400 BAD_ID`, `400 INVALID_NAME`, `400 INVALID_CONFIG`.
- `404 PROFILE_NOT_FOUND`.
- `409 PROFILE_BUSY` — rename attempted while `IN_USE`.
- `409 DUPLICATE_PROFILE`.

**Example**

```bash
curl -X PATCH http://localhost:3000/api/profiles/7 \
  -H "Content-Type: application/json" \
  -d '{"note":"Updated by CI on 2026-05-19"}'
```

---

### 3.5 `POST /api/profiles/:id/reset`

Force a profile back to `IDLE`. If it was `IN_USE`, the running browser is torn down (best effort). Chromium singleton lock files are cleaned. Disk data (cookies, localStorage, etc.) is preserved.

**Request body** — none.

**Response 200** — the updated [Profile](#profile-shape).

**Errors**
- `400 BAD_ID`, `404 PROFILE_NOT_FOUND`.

Use this when a row is stuck in `CORRUPT`, or when a release was missed (e.g., client crashed) and you don't want to wait for the zombie killer.

---

### 3.6 `DELETE /api/profiles/:id`

Delete the profile row and its folder. Only allowed when not `IN_USE`.

**Response 204** — empty body on success.

**Errors**
- `400 BAD_ID`, `404 PROFILE_NOT_FOUND`, `409 PROFILE_BUSY`.

---

### 3.7 `POST /api/browser/allocate`

Reserve a slot, spawn the four-process chain (Xvfb → x11vnc → websockify → Chromium with socat bridge) for the chosen profile, and wait for CDP to become reachable.

**Request body**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `profile_id` | integer | no | If omitted, the **oldest `IDLE` profile** is allocated (by `last_active`). |

**Response 200**

```json
{
  "profile_id": 7,
  "slot_id": 3,
  "ws_port": 6003,
  "cdp_port": 9225,
  "cdp_endpoint": "http://localhost:9225",
  "ws_url": "ws://localhost:6003/"
}
```

`cdp_endpoint` is built from the request's `Host` header — point your CDP client at the host where the API is reachable.

**Errors**
- `400 BAD_PROFILE_ID`.
- `409 NO_IDLE_PROFILE` — no IDLE rows exist (when `profile_id` is omitted).
- `409 PROFILE_NOT_IDLE` — explicit `profile_id` exists but is not IDLE.
- `503 NO_FREE_SLOT` — `MAX_SLOTS` reached.
- `500 ALLOCATE_FAILED` — Chromium failed to launch or CDP timeout; the profile is automatically marked `CORRUPT`.

Allocation can take **up to ~10 seconds** (Chromium boot + CDP wait, configurable via `CDP_WAIT_MS`). Treat it as a slow call.

---

### 3.8 `POST /api/browser/release`

Stop a session and return the profile to `IDLE`. Idempotent — calling on a non-`IN_USE` profile is a no-op.

**Request body**

```json
{ "profile_id": 7 }
```

**Response 200**

```json
{ "ok": true }
```

**Errors**
- `400 BAD_PROFILE_ID`, `500 RELEASE_FAILED`.

---

### 3.9 `POST /api/browser/heartbeat`

Refresh the profile's `last_active` timestamp so the zombie killer doesn't reclaim it.

**Request body**

```json
{ "profile_id": 7 }
```

**Response 200**

```json
{ "ok": true, "last_active": "2026-05-19T03:21:00.000Z" }
```

**Errors**
- `400 BAD_PROFILE_ID`, `409 NOT_IN_USE`.

Send a heartbeat every **30–90 seconds** while a session is open. The server's `MAX_SESSION_MS` (default 30 minutes) is the maximum idle window before the zombie killer fires; the cron scans every `ZOMBIE_SCAN_MS` (default 5 minutes), so leave at least one scan interval of headroom.

---

### 3.10 `GET /api/groups`

List every group, ordered by name (case-insensitive), each with the count of profiles assigned to it.

**Response 200** — array of [Group](#group-shape).

---

### 3.11 `POST /api/groups`

Create a group.

**Request body**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | Trimmed; must match `^[\p{L}\p{N} ._@-]{1,64}$` (Unicode letters allowed, so Vietnamese names work). Case-insensitively unique. |

**Response 201** — the created [Group](#group-shape) (`profile_count` 0).

**Errors**
- `400 INVALID_GROUP_NAME` — name fails the regex.
- `409 DUPLICATE_GROUP` — name already in use (case-insensitive).

---

### 3.12 `PATCH /api/groups/:id`

Rename a group.

**Request body** — `{ "name": "<new name>" }` (same rules as create).

**Response 200** — the updated [Group](#group-shape).

**Errors**
- `400 BAD_ID`, `400 INVALID_GROUP_NAME`.
- `404 GROUP_NOT_FOUND`.
- `409 DUPLICATE_GROUP`.

---

### 3.13 `DELETE /api/groups/:id`

Delete a group. Profiles in the group are **not** deleted — they become Ungrouped (`group_id` set to `null`) atomically with the delete.

**Response 204** — empty body on success.

**Errors**
- `400 BAD_ID`, `404 GROUP_NOT_FOUND`.

---

### 3.14 Scripts — CRUD

A **script** is a named, ordered list of structured [steps](#script-step-shape) that can be replayed against any profile. See [docs/features/script-management.md](features/script-management.md).

- `GET /api/scripts` → **200** array of [Script](#script-shape) (each with a `last_run` summary or `null`).
- `POST /api/scripts` — body `{ name, description?, steps? }` → **201** [Script](#script-shape).
- `GET /api/scripts/:id` → **200** [Script](#script-shape).
- `PATCH /api/scripts/:id` — body `{ name?, description?, steps? }` → **200** [Script](#script-shape).
- `DELETE /api/scripts/:id` → **204** (cascades the run report).

**Errors** — `400 INVALID_SCRIPT` (bad name/description/steps), `404 SCRIPT_NOT_FOUND`, `409 DUPLICATE_SCRIPT`.

### 3.15 `POST /api/scripts/:id/run`

Start an asynchronous run of the script against one or more profiles.

**Request body**

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `targets` | integer[] | yes | — | Profile ids. De-duplicated; must be non-empty. |
| `autoAllocate` | boolean | no | `false` | IDLE targets are allocated (opened), run, then released. Without it, an IDLE target fails. IN_USE targets always run as-is and stay open. |
| `stopOnError` | boolean | no | `true` | Stop a profile after its first failed step (remaining steps `skipped`). |

**Response 202** — `{ "run_id": "<uuid>" }`. Poll §3.16 for progress.

**Errors** — `400 BAD_ID`, `400 NO_TARGETS`, `404 SCRIPT_NOT_FOUND`.

### 3.16 `GET /api/scripts/runs/:runId`

Live run state from the in-memory registry (survives until process restart).

**Response 200** — a [RunReport](#run-report-shape). **404 RUN_NOT_FOUND** if unknown.

### 3.17 `GET /api/scripts/:id/report`

The persisted **latest** report for a script (or `null` if it has never run).

**Response 200** — [RunReport](#run-report-shape) or `null`.

### 3.18 Recording

Live-capture steps by driving an already-open profile (must be `IN_USE`).

- `POST /api/scripts/record/start` — body `{ profile_id }` → **200** `{ recording_id }`.
- `GET /api/scripts/record/:recordingId` → **200** `{ recordingId, profileId, profileName, status, steps }`.
- `POST /api/scripts/record/:recordingId/stop` → **200** `{ steps }`.

**Errors** — `400 BAD_PROFILE_ID`, `404 PROFILE_NOT_FOUND` / `RECORDING_NOT_FOUND`, `409 PROFILE_NOT_OPEN` / `ALREADY_RECORDING`.

---

## 4. Profile shape <a name="profile-shape"></a>

```ts
type ProfileStatus = 'IDLE' | 'IN_USE' | 'CORRUPT';

interface Profile {
  id: number;
  profile_name: string;
  folder_path: string;          // absolute path inside the container
  status: ProfileStatus;
  slot_id: number | null;       // set while IN_USE
  ws_port: number | null;       // set while IN_USE
  cdp_port: number | null;      // set while IN_USE
  pids: number[] | null;        // [xvfb, x11vnc, websockify, chromium, socat]
  allocated_at: string | null;  // ISO-8601, set at allocate, cleared at release
  last_active: string;          // ISO-8601, refreshed by heartbeat / allocate
  window_width: number;
  window_height: number;
  launch_args: string;
  note: string;
  launch_config: string;        // JSON string; see §4.1
  group_id: number | null;      // owning group, null = Ungrouped
  tags: string[];               // parsed array (not a raw string)
}
```

### Group shape <a name="group-shape"></a>

```ts
interface Group {
  id: number;
  name: string;
  created_at: string;           // ISO-8601
  profile_count: number;        // profiles currently assigned to this group
}
```

Note: on `Profile`, `tags` is returned as a parsed `string[]`, while `launch_config` is a raw JSON string — they differ because tags are a first-class list the UI iterates, whereas `launch_config` is an opaque options blob.

### 4.1 launch_config <a name="launch-config"></a>

A structured set of common Chromium options. On the wire it is sent as a JSON **object** on create/update, but stored and returned on the `Profile` as a JSON **string** (`"{}"` when empty). At allocate time each present key becomes a Chromium flag, injected **before** the raw `launch_args` tokens (so `launch_args` can still override).

```ts
interface LaunchConfig {
  lang?: string;                 // → --lang=<value>
  proxy?: string;                // → --proxy-server=<value>  (e.g. "1.2.3.4:8080" or "socks5://1.2.3.4:1080")
  disableWebSecurity?: boolean;  // → --disable-web-security
  disableExtensions?: boolean;   // → --disable-extensions
  muteAudio?: boolean;           // → --mute-audio
  ignoreCertErrors?: boolean;    // → --ignore-certificate-errors
  disableNotifications?: boolean;// → --disable-notifications
  disablePopupBlocking?: boolean;// → --disable-popup-blocking
}
```

On `PATCH`, `launch_config` is replaced wholesale (not merged) — send the complete desired object. Unknown keys in the stored JSON are ignored, keeping the field forward-compatible.

### 4.2 Script shapes <a name="script-shape"></a>

```ts
interface Script {
  id: number;
  name: string;
  description: string;
  steps: ScriptStep[];
  created_at: string;
  updated_at: string;
  last_run: { status: RunStatus; started_at: string; finished_at: string } | null;
}
```

A **step** <a name="script-step-shape"></a> is a discriminated union; only the fields for its `type` are kept on save (`id` is generated server-side if omitted):

```ts
type ScriptStep =
  | { id: string; type: 'navigate'; url: string }
  | { id: string; type: 'click'; selector: string }
  | { id: string; type: 'fill'; selector: string; value: string }
  | { id: string; type: 'press'; selector?: string; key: string }
  | { id: string; type: 'select'; selector: string; value: string }
  | { id: string; type: 'check' | 'uncheck'; selector: string }
  | { id: string; type: 'waitForSelector'; selector: string; timeoutMs?: number }
  | { id: string; type: 'waitForTimeout'; ms: number };
```

A **run report** <a name="run-report-shape"></a> aggregates per-profile, per-step results:

```ts
type RunStatus    = 'running' | 'passed' | 'failed' | 'partial';
type StepStatus   = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
type TargetStatus = 'pending' | 'allocating' | 'running' | 'passed' | 'failed';

interface RunReport {
  runId: string;
  scriptId: number;
  scriptName: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  targets: {
    profileId: number;
    profileName: string;
    status: TargetStatus;
    allocated: boolean;            // true if this run opened the profile (and will release it)
    steps: { stepId: string; type: string; status: StepStatus; error?: string; durationMs?: number }[];
    error?: string;
    screenshot?: string;           // data:image/jpeg;base64,... captured on failure
  }[];
}
```

---

## 5. Error code reference

| Code | HTTP | Where | Meaning |
| --- | --- | --- | --- |
| `BAD_ID` | 400 | routes | URL `:id` is not an integer |
| `BAD_PROFILE_ID` | 400 | browser routes | `profile_id` body field invalid |
| `INVALID_NAME` | 400 | profiles | name fails `^[A-Za-z0-9._@-]{1,64}$` (also rejects `.`, `..`, leading/trailing `.`) |
| `INVALID_CONFIG` | 400 | profiles | width/height out of `[320, 7680]`, args/note/launch_config too long, an invalid tag, too many tags, or `group_id` does not reference an existing group |
| `PROFILE_NOT_FOUND` | 404 | profiles | no row with that id |
| `PROFILE_BUSY` | 409 | profiles | operation requires the profile not to be `IN_USE` |
| `DUPLICATE_PROFILE` | 409 | profiles | name collides with another row |
| `INVALID_GROUP_NAME` | 400 | groups | name fails `^[\p{L}\p{N} ._@-]{1,64}$` |
| `GROUP_NOT_FOUND` | 404 | groups | no group with that id |
| `DUPLICATE_GROUP` | 409 | groups | group name already in use (case-insensitive) |
| `NO_IDLE_PROFILE` | 409 | allocate | no IDLE rows exist |
| `PROFILE_NOT_IDLE` | 409 | allocate | requested `profile_id` is not IDLE |
| `NOT_IN_USE` | 409 | heartbeat | profile is not currently allocated |
| `NO_FREE_SLOT` | 503 | allocate | every slot in 1..`MAX_SLOTS` is taken |
| `ALLOCATE_FAILED` | 500 | allocate | Chromium did not come up; profile auto-marked `CORRUPT` |
| `RELEASE_FAILED` | 500 | release | unexpected exception during teardown |
| `INVALID_SCRIPT` | 400 | scripts | name/description/steps fail validation |
| `SCRIPT_NOT_FOUND` | 404 | scripts | no script with that id |
| `DUPLICATE_SCRIPT` | 409 | scripts | script name already in use |
| `NO_TARGETS` | 400 | scripts run | `targets` missing or empty |
| `RUN_NOT_FOUND` | 404 | scripts run | unknown `run_id` (or lost on restart) |
| `PROFILE_NOT_OPEN` | 409 | scripts record | recording requires the profile to be `IN_USE` |
| `ALREADY_RECORDING` | 409 | scripts record | a recording is already active for that profile |
| `RECORDING_NOT_FOUND` | 404 | scripts record | unknown `recording_id` |
| `INTERNAL` | 500 | global | unhandled — check backend logs |

---

## 6. Integration recipes

### 6.1 Playwright (Node.js) end-to-end

```ts
import { chromium } from 'playwright';

const BASE = process.env.BM_BASE_URL ?? 'http://localhost:3000';

async function withAllocatedBrowser<T>(
  profileName: string,
  fn: (cdpEndpoint: string, profileId: number) => Promise<T>,
): Promise<T> {
  // 1. Ensure a profile exists. If it doesn't, create it.
  const profiles: { id: number; profile_name: string; status: string }[] =
    await fetch(`${BASE}/api/profiles`).then((r) => r.json());
  let p = profiles.find((x) => x.profile_name === profileName);
  if (!p) {
    p = await fetch(`${BASE}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_name: profileName }),
    }).then((r) => r.json());
  }

  // 2. Allocate.
  const alloc = await fetch(`${BASE}/api/browser/allocate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile_id: p!.id }),
  }).then((r) => r.json());

  // 3. Heartbeat every 60 s while we're working.
  const hb = setInterval(() => {
    fetch(`${BASE}/api/browser/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: alloc.profile_id }),
    }).catch(() => { /* ignore */ });
  }, 60_000);

  try {
    return await fn(alloc.cdp_endpoint, alloc.profile_id);
  } finally {
    clearInterval(hb);
    // 4. Always release, even on test failure.
    await fetch(`${BASE}/api/browser/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: alloc.profile_id }),
    }).catch(() => { /* swallow */ });
  }
}

// Usage
await withAllocatedBrowser('checkout_flow', async (cdpEndpoint) => {
  const browser = await chromium.connectOverCDP(cdpEndpoint);
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  await page.goto('https://example.com');
  await page.screenshot({ path: 'example.png' });
  await browser.close();
});
```

### 6.2 Parallel pool

Allocate N profiles up front, then dispatch tests via a worker queue. Each worker keeps its assigned `profile_id` for the run and releases on shutdown.

```ts
const POOL_SIZE = 10;

// Create N profiles named worker_1..worker_N (idempotent).
for (let i = 1; i <= POOL_SIZE; i++) {
  await fetch(`${BASE}/api/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile_name: `worker_${i}` }),
  }).catch(() => { /* duplicate ok */ });
}

// Allocate them all in parallel.
const allocs = await Promise.all(
  Array.from({ length: POOL_SIZE }, (_, i) =>
    fetch(`${BASE}/api/browser/allocate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_name: `worker_${i + 1}` }),
    }).then((r) => r.json()),
  ),
);
// allocs[i].cdp_endpoint goes to worker i.
```

### 6.3 Live View embed

```html
<iframe
  src="http://<host>:<ws_port>/vnc.html?host=<host>&port=<ws_port>&autoconnect=true&resize=scale"
  width="1280" height="720"
  style="border: 0">
</iframe>
```

Or use `@novnc/novnc` directly — see [frontend/src/pages/LiveView.tsx](../frontend/src/pages/LiveView.tsx) for a working React example.

---

## 7. Operational notes for integrators

- **Allocate is slow** (~3–10 s). Pool ahead of time if possible.
- **Release is fast** (~200 ms). Always call it in a `finally` block.
- **Profiles persist** across sessions. Cookies and localStorage survive release. Use this for pre-logged-in test accounts.
- **Concurrent allocate is safe** — the server uses a SQLite transaction with `RETURNING *` to guarantee unique slot assignment.
- **CDP host validation:** Chromium since M111 only accepts requests whose source appears local. The orchestrator handles this with an internal socat bridge, so your client just connects to the published `cdp_port` as usual.
- **Heartbeat is the only opt-in:** without it, sessions older than `MAX_SESSION_MS` (default 30 min) are reclaimed. Long-running suites must either ping or raise the limit.
- **Logs:** per-slot logs are at `/tmp/slot_<n>_{xvfb,x11vnc,websockify,chromium,socat}.log` inside the container. `docker exec ... cat /tmp/slot_3_chromium.log` is the first place to look when allocate fails.
