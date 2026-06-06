# Frontend — Dashboard & Live View

**Slug:** `frontend`
**Owner agent:** `frontend-developer`
**Status:** `shipped`
**Last updated:** 2026-05-19

## Context

Phase 4 puts a human-friendly face on the backend. Without it, the only way to manage profiles is curl — fine for the test runner, painful for a developer who wants to log in to a fresh profile or watch a flaky test in real time. The frontend gives two screens: a Dashboard for CRUD/allocate/release, and a Live View embedding the noVNC canvas of an allocated browser.

Spec reference: [README.md — Features](../../README.md#features).

## Design

React 18 + Vite + TypeScript (strict). TanStack Query handles data fetching and cache invalidation; no Redux, no routing library (state-based view switching is enough for two screens).

```
App.tsx
 └─ Dashboard.tsx                       ← polls /api/profiles every 3 s
      ├─ Sidebar (left, 280px)
      │   ├─ "+ Create profile" → CreateProfileModal
      │   └─ Profile list (selectable, shows status pill)
      └─ ProfileDetail (right)
           ├─ Header: title + status pill + ACTION BUTTONS (top)
           ├─ Live View section          ← rendered only when status === IN_USE
           │    └─ LiveView (embedded)   ← noVNC RFB(ws://host:ws_port/)
           │         └─ useHeartbeat()   ← POST /heartbeat every 60 s while mounted
           ├─ Configuration form         ← ProfileForm (name + window size + args + note)
           └─ Runtime info               ← folder, slot, ports, pids, timestamps
```

### Layout

Two-column shell: a 280 px-wide sidebar lists every profile with a status pill, and a flex-1 detail panel shows the selected profile. Selecting auto-falls-back to the first profile when the current selection is deleted. Profile creation happens in a modal triggered from the sidebar header, so the main pane is never blocked.

**Action buttons live at the top of the detail panel** (Allocate / Release / Reset / Delete) so the primary actions are reachable without scrolling.

**Live View is embedded inside the detail panel** (no longer a separate page). When the selected profile is `IN_USE`, a `<LiveView>` section appears right under the header — the user can switch profiles in the sidebar and the canvas remounts automatically. When the status is not `IN_USE`, the section is hidden. The canvas takes 65vh (min 420 px) and the noVNC RFB scales the Chromium desktop to fit.

### Live View details

- Uses `@novnc/novnc` (default export — exports map points to `./core/rfb.js`). The package's type definitions are partial, so a few `any` casts are accepted with an inline `@ts-ignore` / `eslint-disable` on each. noVNC 1.7+ uses top-level await, so `vite.config.ts` sets `build.target`, `esbuild.target`, and `optimizeDeps.esbuildOptions.target` all to `esnext`.
- `scaleViewport: true` so the Chromium window scales to whatever fits the parent container. `resizeSession: false` so we don't try to make Xvfb resize on the fly.
- WS URL is built at runtime from `window.location.hostname` so the dashboard works whether you open it on localhost or another LAN host.
- The component is keyed on `${profile.id}-${ws_port}` so switching profiles in the sidebar correctly tears down and re-establishes the RFB connection.
- On unmount, calls `rfb.disconnect()` — the cleanup is essential or browser tabs will leak websockets to dead containers.

### Sizing on a 1920×1080 display

Optimized for FHD: a typical FHD profile (16:9) leaves the sidebar at 280 px, the detail column at ~1640 px content width, and roughly 860 px of vertical headroom (viewport minus header / status row / margins).

The canvas uses two inline style hints derived from the profile's own `window_width × window_height`:

- `aspectRatio: "<w> / <h>"` — fixed ratio, no internal letterboxing.
- `maxWidth: calc((100vh - 220px) * <w/h>)` — caps the width so that, when viewport-height is the bottleneck, the box shrinks proportionally instead of overflowing.

Result on an FHD screen with an FHD profile: ~1500×845 canvas — fills almost all available real estate. Mobile-portrait profiles (e.g. 414×896) render as a tall narrow column with no horizontal overflow.

### Fullscreen

The status row has a **Fullscreen** button. Clicking calls `wrapperRef.current.requestFullscreen()`. When in fullscreen:

- The canvas takes the entire screen (with `aspect-ratio` removed and `height: calc(100vh - 40px)`).
- A small status strip stays at the top.
- Escape, F11, or clicking **Exit fullscreen** all return to the embedded layout. We listen for `fullscreenchange` to keep state in sync — even when the user exits via OS-level shortcuts.
- After every fullscreen transition we re-set `rfb.scaleViewport = true` (with a 50 ms tick) to force noVNC to recompute the scale against the new container size.

### Dev container

`Dockerfile.frontend` runs `vite dev --host 0.0.0.0 --port 8080`. The frontend folder is bind-mounted from the host so file changes hot-reload. `node_modules` is a named volume so the install survives bind mounts (Linux container's `node_modules` would otherwise be shadowed by the empty Windows host folder).

Vite proxies `/api/*` to `http://backend:3000` via the Docker network. WebSocket connections for noVNC go direct from the browser to `ws://localhost:<ws_port>/` — they hit the backend's published port range, not the frontend container.

## Files

- [frontend/package.json](../../frontend/package.json) — deps lockstep with React 18, Vite 5, noVNC 1.5, TanStack Query 5.
- [frontend/vite.config.ts](../../frontend/vite.config.ts) — proxy to backend, listens 0.0.0.0:8080.
- [frontend/index.html](../../frontend/index.html), [frontend/src/main.tsx](../../frontend/src/main.tsx) — bootstrap.
- [frontend/src/App.tsx](../../frontend/src/App.tsx) — state-based view switcher.
- [frontend/src/api/client.ts](../../frontend/src/api/client.ts), [frontend/src/api/profiles.ts](../../frontend/src/api/profiles.ts), [frontend/src/api/browser.ts](../../frontend/src/api/browser.ts), [frontend/src/api/types.ts](../../frontend/src/api/types.ts) — typed fetch wrapper + endpoints.
- [frontend/src/pages/Dashboard.tsx](../../frontend/src/pages/Dashboard.tsx) — shell with sidebar list + detail panel, owns selection and mutations.
- [frontend/src/components/CreateProfileModal.tsx](../../frontend/src/components/CreateProfileModal.tsx) — focused-modal for new profiles.
- [frontend/src/components/ProfileDetail.tsx](../../frontend/src/components/ProfileDetail.tsx) — info table, editable name, action buttons.
- [frontend/src/pages/LiveView.tsx](../../frontend/src/pages/LiveView.tsx) — noVNC RFB embed + heartbeat.
- [frontend/src/lib/heartbeat.ts](../../frontend/src/lib/heartbeat.ts) — `useHeartbeat(profileId)` hook.
- [frontend/src/styles.css](../../frontend/src/styles.css) — flat dark theme, no framework.
- [Dockerfile.frontend](../../Dockerfile.frontend), [docker-compose.yml](../../docker-compose.yml) — frontend service + named volume for `node_modules`.

## API / Usage

Open `http://localhost:8088` after `docker compose up`. The flow:

1. Click **+ Create profile** in the sidebar header. Modal opens; type a name matching `^[A-Za-z0-9_-]{1,64}$` → Enter or **Create**.
2. The new profile auto-selects in the detail panel. Rename it in the **Name** field and click **Save** (button is disabled while the value is unchanged or while the profile is `IN_USE`).
3. Click **Allocate** in the Actions section. The page jumps to Live View as soon as the backend confirms.
4. Live View renders the Chromium desktop. Mouse + keyboard work. Click **Release session** to stop, or **← Back** to return to the dashboard (the session stays running — release later from the Actions section).
5. **Reset** brings stuck rows back to IDLE without restarting the backend.

Error responses from the API surface in a dismissible banner above the detail panel.

## Testing

```powershell
docker compose build frontend
docker compose up -d
# Open http://localhost:8088 in a browser
```

End-to-end sanity:

- Create a profile, allocate it, confirm Live View shows Chromium with about:blank.
- Run a Playwright script from the Windows host against `http://localhost:<cdp_port>` and watch the page navigate in Live View.
- Release from the Live View page; the row should flip back to IDLE in the dashboard within 3 seconds (next poll).
- Stop the backend container with `docker stop browser-manager-backend`. The Live View shows a disconnect error; the Dashboard's profile list query starts failing (banner). Restart backend; everything recovers.

## History

- 2026-05-19 — Initial implementation (Dashboard, Live View, dev container, hot reload).
- 2026-05-19 — Layout redesign: sidebar (list + Create modal) + right detail panel with editable name and action buttons. Backed by new `PATCH /api/profiles/:id` endpoint.
- 2026-05-19 — Added `ProfileForm` shared by Create modal and Detail; fields: name, window size, launch args, note. See [profile-config](profile-config.md).
- 2026-05-19 — Embedded Live View into the detail panel (no longer a full page); auto-shown when status is `IN_USE`. Action buttons moved to the top of the panel. App-level view switching removed.
- 2026-05-19 — Live View sized for FHD: canvas takes the profile's natural aspect ratio with a viewport-height-based `maxWidth` so it fills almost all of a 1920×1080 detail column. Added native Fullscreen toggle (button + Escape).
