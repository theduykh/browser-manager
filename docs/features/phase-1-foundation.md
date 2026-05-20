# Phase 1 — Foundation

**Slug:** `phase-1-foundation`
**Owner agent:** `devops-docker`
**Status:** `shipped`
**Last updated:** 2026-05-19

## Context

The Browser Manager has no runtime substrate yet. Phase 1 establishes the monorepo layout, container image, and a manual smoke test that proves the four-process chain (Xvfb → x11vnc → websockify → Chromium with CDP) works inside the container. This is a prerequisite for all later phases — without a working container, no orchestration logic can be tested.

Spec reference: [yeu-cau.md §2, §7](../../yeu-cau.md).

## Design

A single backend container based on `mcr.microsoft.com/playwright:v1.49.0-jammy`, with the extra system packages required for virtual display + VNC streaming. The container runs `tini` as PID 1 so child processes (Xvfb, x11vnc, websockify, Chromium) get reaped cleanly when the orchestrator kills them.

```
Windows host
└─ Docker Desktop
   └─ browser-manager-backend (container)
      ├─ tini (PID 1)
      └─ node backend/dist/main.js  (Express /health placeholder)
         ── spawned later by orchestrator ──
         ├─ Xvfb :100
         ├─ x11vnc :5901  (attached to :100)
         ├─ websockify :6001 → :5901
         └─ Chromium --remote-debugging-port=9223 --remote-debugging-address=0.0.0.0
```

Decisions:

- **Named volume `profiles_data`** instead of bind mount from Windows. Chromium profiles contain thousands of small files; Docker Desktop's filesystem bridge is too slow. Bind mount remains an opt-in.
- **`shm_size: 2gb`** because Chromium silently crashes when `/dev/shm` runs out.
- **`tini` as PID 1** so SIGKILLed Chromium does not leave defunct entries cluttering the process table.
- **CDP listens on `0.0.0.0`** inside the container; the port range `9223-9272` is published so Playwright running on the Windows host can `connectOverCDP('http://localhost:9223')`.
- Backend HTTP stack is Express for now (placeholder). NestJS migration decision deferred to Phase 2.

## Files

- [Dockerfile.backend](../../Dockerfile.backend) — image build, base + APT deps + tini entrypoint.
- [docker-compose.yml](../../docker-compose.yml) — single `backend` service, port ranges, named volume.
- [.dockerignore](../../.dockerignore) — keeps `node_modules`, `profiles_data`, and SQLite out of the build context.
- [backend/package.json](../../backend/package.json) — minimal Express + TypeScript setup.
- [backend/tsconfig.json](../../backend/tsconfig.json) — strict TS, target ES2022.
- [backend/src/main.ts](../../backend/src/main.ts) — `/health` endpoint placeholder.
- [scripts/smoke-test.sh](../../scripts/smoke-test.sh) — manual end-to-end verifier for slot 1.

## API / Usage

Container environment variables (set in `docker-compose.yml`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port for backend |
| `DATABASE_PATH` | `/app/backend/database.sqlite` | (used from Phase 2) |
| `PROFILES_ROOT` | `/app/profiles_data` | Where profile folders live |
| `MAX_SLOTS` | `50` | Upper bound on parallel browsers |

Exposed ports:

| Range | Purpose |
| --- | --- |
| `3000` | REST API |
| `6001-6050` | noVNC websockify endpoints (Live View) |
| `9223-9272` | Chromium CDP per slot |

HTTP endpoints implemented:

- `GET /health` → `{ status: 'ok', phase: 1, ts }`.

## Testing

From repo root, on Windows PowerShell:

```powershell
docker compose build backend
docker compose up -d backend
curl http://localhost:3000/health
```

Expected: `{"status":"ok","phase":1,"ts":"..."}`.

Run the smoke test inside the container:

```powershell
docker exec -it browser-manager-backend bash /app/scripts/smoke-test.sh
```

Expected output includes:

- `CDP /json/version` returning JSON with `Browser`, `webSocketDebuggerUrl`.
- `Websockify listening` on `:6001`.

Then on the Windows host, open in a browser:

```
http://localhost:6001/vnc.html?host=localhost&port=6001&autoconnect=true&resize=scale
```

Expected: an Xvfb desktop with Chromium showing `about:blank`.

Optional Playwright connect from the host:

```ts
import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://localhost:9223');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto('https://example.com');
await page.screenshot({ path: 'phase1.png' });
await browser.close();
```

While the script runs, the Live View should show `example.com` rendering.

## History

- 2026-05-19 — Initial implementation (monorepo skeleton, Dockerfile, compose, smoke test).
