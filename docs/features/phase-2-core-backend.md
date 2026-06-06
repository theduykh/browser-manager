# Phase 2 — Core Backend

**Slug:** `phase-2-core-backend`
**Owner agent:** `backend-developer`
**Status:** `shipped`
**Last updated:** 2026-05-19

## Context

Phase 1 proved the four-process chain works manually. Phase 2 turns that into a programmable service: an HTTP API that allocates and releases real browser sessions, backed by SQLite for state and a persistent PID registry that survives backend crashes. Without this layer, the system cannot be driven from a test script or the future React dashboard.

Spec reference: [README.md — Architecture](../../README.md#architecture).

## Design

### Lifecycle of a single allocation

```
POST /api/browser/allocate { profile_id? }
        │
        ▼
┌──────────────────────────────────────────┐
│ DB transaction (atomic)                  │
│  1. compute first free slot_id (1..N)    │
│  2. UPDATE profiles SET status='IN_USE', │
│     slot_id, ws_port, cdp_port,          │
│     allocated_at=now WHERE id matches    │
│     and status='IDLE' RETURNING *        │
└──────────────────────────────────────────┘
        │ row (or throw)
        ▼
Profile lock cleaner: rm SingletonLock*
        ▼
Spawn Xvfb     → PID saved
Spawn x11vnc   → PID saved
Spawn websockify → PID saved
Spawn Chromium → PID saved
        ▼
Wait for CDP /json/version (max ~10 s)
        ▼
UPDATE profiles SET pids=JSON([...])
        ▼
Return { profile_id, slot_id, ws_port, cdp_port, cdp_endpoint }
```

On any spawn / CDP-wait failure: kill whatever has been spawned, set `status='CORRUPT'`, surface the error.

### Release

```
POST /api/browser/release { profile_id }
        │
        ▼
SELECT pids, slot_id FROM profiles WHERE id=?
        ▼
SIGKILL in order: chromium → websockify → x11vnc → Xvfb
(also pkill -f patterns as a belt-and-suspenders for any survivors)
        ▼
UPDATE profiles SET status='IDLE', slot_id=NULL, ws_port=NULL,
                    cdp_port=NULL, pids=NULL, allocated_at=NULL,
                    last_active=now
```

### Reconcile on boot

The backend is the sole process inside the container, so when it dies its children die with it (tini reaps them). Reconcile is therefore mostly defensive: every row with `status='IN_USE'` from the previous run is assumed stale, its PIDs (if still alive somehow) are killed, profile locks cleaned, row reset to `IDLE`. Runs before the HTTP server starts accepting traffic.

### Atomic slot allocation

The plan calls out the race condition as the #1 risk. The implementation:

1. The transaction starts.
2. `SELECT slot_id FROM profiles WHERE status='IN_USE'` → in-use set.
3. Pick the smallest `slot_id` in `1..MAX_SLOTS` not in that set.
4. `UPDATE profiles SET status='IN_USE', slot_id=?, ... WHERE id=(...) AND status='IDLE' RETURNING *`.
5. If no row returned → throw `NO_IDLE_PROFILE`. If no free slot found → throw `NO_FREE_SLOT`.
6. Commit.

`better-sqlite3` is synchronous and single-threaded; with Node.js's event loop this is effectively atomic against any other JS handler. The partial unique index `idx_slot_in_use` enforces the invariant at the DB layer too — a bug that double-allocates a slot would fail the INSERT/UPDATE.

### Process supervision (light)

Process manager keeps an in-memory `Map<slot_id, ChildProcess[]>` for fast kill, but the **source of truth** for "what is running" is the `pids` JSON column. If the backend restarts, the in-memory map is empty but the row is reconciled from `pids`.

Children are spawned with `stdio: ['ignore', logFile, logFile]` so their output goes to per-slot log files in `/tmp/slot_<n>.log` (not /app to keep the volume clean). No piping back to the parent — avoids backpressure problems.

### Heartbeat and zombie killer — deferred

Heartbeat (`/api/browser/heartbeat`) and the periodic zombie killer cron are explicitly **deferred to Phase 3 / 5** as in the master plan. Phase 2 is allocate / release / list only.

### CDP exposure via socat

Chromium since M111 rejects HTTP requests to its remote-debugging port unless the connection appears to come from a local loopback interface. When the Windows host connects through Docker's port forwarding, Chromium sees a non-loopback source and silently closes the connection (`ERR_EMPTY_RESPONSE` in the browser, no body in curl).

Fix: Chromium binds to `127.0.0.1:<internal_port>` where `internal_port = cdp_port + 10000` (e.g., slot 1 → Chromium on `127.0.0.1:19223`). A `socat` process listens on `0.0.0.0:<cdp_port>` (e.g., `0.0.0.0:9223`) and forwards to `127.0.0.1:<internal_port>`. Chromium now sees every request originating from `127.0.0.1` (socat) and accepts it. The `Host` header from the original client (`localhost:9223`) is still loopback-like, so Chromium's host validation also passes. The internal port range (`19223-19272`) is **not** published to the host.

socat is part of the per-slot PID chain (Xvfb → x11vnc → websockify → Chromium → socat) and is cleaned up by release / reconcile / belt-and-suspenders pkill.

### Storage choices

- `better-sqlite3` (synchronous API, prebuilt binaries for jammy x64, supports `RETURNING`).
- DB file at `/app/data/database.sqlite`, host-bind-mounted from `./data/` — folder-level bind avoids the "file doesn't exist yet" trap and lets the user inspect the DB from Windows.

## Files

- [data/.gitkeep](../../data/.gitkeep) — host folder for the SQLite file.
- [docker-compose.yml](../../docker-compose.yml) — adds `./data:/app/data` mount, sets `DATABASE_PATH`.
- [backend/package.json](../../backend/package.json) — adds `better-sqlite3`.
- [backend/src/main.ts](../../backend/src/main.ts) — bootstrap order: load config → open DB → run migrations → reconcile → mount routes → listen.
- [backend/src/config.ts](../../backend/src/config.ts) — typed env reader.
- [backend/src/log.ts](../../backend/src/log.ts) — single-line JSON logger.
- [backend/src/db/schema.sql](../../backend/src/db/schema.sql) — `profiles` table + partial unique index.
- [backend/src/db/index.ts](../../backend/src/db/index.ts) — opens DB and applies schema idempotently.
- [backend/src/modules/browser/slot-allocator.ts](../../backend/src/modules/browser/slot-allocator.ts) — atomic transaction.
- [backend/src/modules/browser/process-manager.ts](../../backend/src/modules/browser/process-manager.ts) — spawn/kill helpers.
- [backend/src/modules/browser/profile-lock-cleaner.ts](../../backend/src/modules/browser/profile-lock-cleaner.ts) — `rm SingletonLock*` before launch.
- [backend/src/modules/browser/orchestrator.service.ts](../../backend/src/modules/browser/orchestrator.service.ts) — high-level allocate/release.
- [backend/src/modules/browser/browser.routes.ts](../../backend/src/modules/browser/browser.routes.ts) — `/api/browser/*` endpoints.
- [backend/src/modules/profiles/profiles.service.ts](../../backend/src/modules/profiles/profiles.service.ts) — CRUD.
- [backend/src/modules/profiles/profiles.routes.ts](../../backend/src/modules/profiles/profiles.routes.ts) — `/api/profiles/*` endpoints.
- [backend/src/bootstrap/reconcile.ts](../../backend/src/bootstrap/reconcile.ts) — boot-time cleanup.

## API / Usage

### Env vars

| Name | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATABASE_PATH` | `/app/data/database.sqlite` | SQLite file |
| `PROFILES_ROOT` | `/app/profiles_data` | Where profile folders live |
| `MAX_SLOTS` | `50` | Upper bound for parallel browsers |
| `CDP_WAIT_MS` | `10000` | Max wait for CDP /json/version |

### Endpoints

`GET /api/profiles` → `Profile[]`

`POST /api/profiles` body `{ profile_name }` → `Profile` (folder created on disk).

`DELETE /api/profiles/:id` — only allowed when `status` is `IDLE` or `CORRUPT`. Folder removed.

`POST /api/browser/allocate` body `{ profile_id? }` →

```json
{
  "profile_id": 7,
  "slot_id": 3,
  "ws_port": 6003,
  "cdp_port": 9225,
  "cdp_endpoint": "http://<host>:9225"
}
```

If `profile_id` is omitted, the oldest `IDLE` profile is chosen.

`POST /api/browser/release` body `{ profile_id }` → `{ ok: true }`.

Errors come back as `{ error: "<CODE>", message: "<detail>" }` with appropriate 4xx/5xx.

### Profile shape

```ts
type Profile = {
  id: number;
  profile_name: string;
  folder_path: string;
  status: 'IDLE' | 'IN_USE' | 'CORRUPT';
  slot_id: number | null;
  ws_port: number | null;
  cdp_port: number | null;
  pids: number[] | null;
  allocated_at: string | null; // ISO
  last_active: string;         // ISO
};
```

## Testing

After rebuilding the image:

```powershell
docker compose build backend
docker compose up -d backend
curl http://localhost:3000/health
```

Create three profiles and allocate them concurrently:

```powershell
curl -X POST http://localhost:3000/api/profiles -H "Content-Type: application/json" -d "{\"profile_name\":\"p1\"}"
curl -X POST http://localhost:3000/api/profiles -H "Content-Type: application/json" -d "{\"profile_name\":\"p2\"}"
curl -X POST http://localhost:3000/api/profiles -H "Content-Type: application/json" -d "{\"profile_name\":\"p3\"}"

# fire three allocates in parallel from PowerShell
$jobs = 1..3 | ForEach-Object {
  Start-Job { curl -s -X POST http://localhost:3000/api/browser/allocate -H "Content-Type: application/json" -d "{}" }
}
$jobs | Wait-Job | Receive-Job
```

Expected: three different `slot_id` values (1, 2, 3) and three different ports. Open three Live View tabs at `http://localhost:600{1,2,3}/vnc.html?host=localhost&port=600{1,2,3}&autoconnect=true&resize=scale`.

Verify CDP per slot:

```powershell
curl http://localhost:9223/json/version
curl http://localhost:9224/json/version
curl http://localhost:9225/json/version
```

Release all:

```powershell
1..3 | ForEach-Object { curl -X POST http://localhost:3000/api/browser/release -H "Content-Type: application/json" -d "{\"profile_id\":$_}" }
docker exec browser-manager-backend bash -c "pgrep -af 'Xvfb|x11vnc|websockify|chrome' || echo NONE"
```

Expected: `NONE` — every spawned process is gone.

Crash test:

```powershell
docker compose up -d backend
curl -X POST http://localhost:3000/api/browser/allocate -H "Content-Type: application/json" -d "{}"
docker kill browser-manager-backend
docker start browser-manager-backend
Start-Sleep 3
curl http://localhost:3000/api/profiles
```

Expected: every profile back to `IDLE`, no orphan processes inside the container.

## History

- 2026-05-19 — Initial design.
- 2026-05-19 — Added socat bridge to work around Chromium M111+ remote-debugging host rejection (ERR_EMPTY_RESPONSE from host).
