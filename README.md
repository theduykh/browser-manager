# Browser Manager

A self-hosted system for allocating and managing multiple Chromium profiles in parallel for automated testing with Playwright. Each browser runs headful inside Xvfb, streams its screen via x11vnc + websockify + noVNC, and exposes CDP so remote test scripts can connect.

## Features

- **Profile Pooling** — each profile maps to a dedicated `user-data-dir`, preserving cookies, localStorage, and cache across sessions. Lock-based allocation prevents concurrency conflicts.
- **Live View** — watch any active browser in real time through the React dashboard (noVNC canvas). Mouse and keyboard interaction supported.
- **CDP Remote** — Playwright test scripts connect via `chromium.connectOverCDP()` to the port assigned to each slot.
- **Zombie Killer** — background job scans every 5 minutes, force-kills sessions that exceed the timeout, and resets their profiles to `IDLE`.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 22, TypeScript (strict), Express |
| Database | SQLite |
| Automation | Playwright (Chromium) |
| Frontend | React 18, Vite, `@novnc/novnc` |
| Virtual display | Xvfb, x11vnc, websockify, noVNC |
| Container | Docker Desktop (Windows host), `tini` as PID 1 |

## Repository Layout

```
browser-manager/
├── backend/              # Orchestrator, REST API, SQLite, process lifecycle
│   └── src/
├── frontend/             # Dashboard UI, Live View (noVNC)
│   └── src/
├── profiles_data/        # Mount point for profile folders
├── scripts/              # smoke-test.sh and helper scripts
├── docs/
│   ├── api.md            # HTTP API reference
│   └── features/         # One .md file per feature
├── Dockerfile.backend
├── Dockerfile.frontend
├── Dockerfile.frontend.prod
├── docker-compose.yml
└── release.ps1
```

## Architecture

### Port Allocation

Ports are derived from `slot_id` (1 – N) so every slot occupies a fixed, predictable port range with no dynamic lookup needed at runtime.

| Resource | Formula | Example (slot 1) |
|---|---|---|
| Xvfb display | `:99 + slot_id` | `:100` |
| VNC port | `5900 + slot_id` | `5901` |
| WebSocket / noVNC | `6000 + slot_id` | `6001` |
| CDP port | `9222 + slot_id` | `9223` |

### Browser Allocation Flow

When a client calls `POST /api/browser/allocate`:

1. Query DB for a row with `status = 'IDLE'`; update to `IN_USE`, assign `slot_id`.
2. Spawn `Xvfb :<display> -screen 0 1920x1080x24`.
3. Spawn `x11vnc -display :<display> -nopw -listen localhost -rfbport <vnc_port>`.
4. Spawn `websockify <ws_port> localhost:<vnc_port>`.
5. Launch Chromium via `chromium.launchPersistentContext(folder_path, { headless: false, env: { DISPLAY }, args: ['--remote-debugging-port=<cdp_port>'] })`.
6. Store PIDs in an in-memory registry keyed by `slot_id`.
7. Return `{ ws_url, cdp_endpoint, profile_id, slot_id }` to the caller.

### Process Cleanup

- **Release** (`POST /api/browser/release`) — kills all PIDs in the slot's registry entry and sets `status = 'IDLE'`.
- **Zombie Killer** — scans `IN_USE` profiles every 5 minutes; any session older than `MAX_SESSION_MS` is force-killed and reset.

### Database Schema

Table: `profiles`

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `profile_name` | TEXT | Human-readable name, e.g. `Profile_01` |
| `folder_path` | TEXT | Absolute path inside the container |
| `status` | TEXT | `IDLE` · `IN_USE` · `CORRUPT` |
| `slot_id` | INTEGER | Assigned slot (NULL when IDLE) |
| `ws_port` | INTEGER | noVNC WebSocket port in use |
| `cdp_port` | INTEGER | Chromium CDP port in use |
| `last_active` | DATETIME | Last update timestamp (used by Zombie Killer) |

Table: `scripts` — reusable automation scripts (see [docs/features/script-management.md](docs/features/script-management.md)).

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `name` | TEXT | Unique script name |
| `description` | TEXT | Free-form description |
| `steps` | TEXT | JSON array of structured steps |
| `created_at` / `updated_at` | DATETIME | Timestamps |

Table: `script_runs` — latest run report per script (one row per `script_id`; overwritten each run — no history yet).

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `script_id` | INTEGER | Unique FK → `scripts(id)` `ON DELETE CASCADE` |
| `status` | TEXT | `passed` · `failed` · `partial` |
| `report` | TEXT | JSON run report (per-profile, per-step) |
| `started_at` / `finished_at` | DATETIME | Timestamps |

## Port Mapping

| Port | Purpose |
|---|---|
| `3000` | Backend REST API |
| `8088` | Frontend dashboard (dev) |
| `6001–6050` | noVNC WebSocket — Live View (one per slot) |
| `9223–9272` | Chromium CDP — Playwright remote (one per slot) |

## Running the Dev Environment

**Requirements:** Docker Desktop (Windows) running, PowerShell 5.1+.

### Start the full stack

```powershell
docker compose up -d --build

# Follow logs
docker compose logs -f
```

Frontend: `http://localhost:8088`  
Backend health check: `http://localhost:3000/health`

### Start a single service

```powershell
docker compose up -d --build backend
docker compose up -d --build frontend   # requires backend to be running
```

### Smoke test — verify the full process chain

```powershell
docker exec -it browser-manager-backend bash /app/scripts/smoke-test.sh
```

Checks: Xvfb up, x11vnc listening, websockify ready, CDP returning valid JSON.

### Connect Playwright from the Windows host

```ts
import { chromium } from 'playwright';

// Slot 1 → CDP port 9223
const browser = await chromium.connectOverCDP('http://localhost:9223');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto('https://example.com');
await browser.close();
```

### Stop the stack

```powershell
docker compose down
```

> The named volume `browser-manager-profiles` survives `down`. Use `docker compose down -v` to remove all data.

## Release Packaging

The release bundles both Docker images and the production compose file into a single `.zip`. Recipients only need Docker installed — no source code, no Node.

### Cut a release (maintainer)

```powershell
# Tag as 'latest'
./release.ps1

# Versioned release
./release.ps1 -Version v1.0.0

# Skip image rebuild (re-package only)
./release.ps1 -Version v1.0.0 -SkipBuild
```

Output: `release/dist/browser-manager-<version>.zip`

```
browser-manager-v1.0.0.zip
├── docker-compose.yml   # production compose (named volumes, restart policy)
├── images.tar.gz        # backend + frontend images (~400–500 MB)
├── INSTALL.md
└── VERSION
```

### Install from a release zip (end user)

```powershell
Expand-Archive browser-manager-v1.0.0.zip -DestinationPath browser-manager
cd browser-manager

# Decompress and load images
$tar = "$PWD\images.tar"
$gz  = [System.IO.File]::OpenRead("$PWD\images.tar.gz")
$out = [System.IO.File]::Create($tar)
[System.IO.Compression.GZipStream]::new($gz, [System.IO.Compression.CompressionMode]::Decompress).CopyTo($out)
$gz.Close(); $out.Close()
docker load -i $tar
Remove-Item $tar

docker compose up -d
```

Open `http://localhost:8088`.

### Upgrade

```powershell
docker compose down          # volumes are preserved
# replace zip contents with the new version, then:
docker load -i images.tar
docker compose up -d
```

## Documentation

- [docs/api.md](docs/api.md) — HTTP API reference
- [docs/features/](docs/features/) — per-feature design docs
- [release/INSTALL.md](release/INSTALL.md) — end-user install guide (shipped inside the zip)
