# UI redesign — Linear/Vercel devtools aesthetic

**Slug:** `ui-redesign`
**Owner agent:** `frontend-developer`
**Status:** `shipped` (Phase 1 — Profiles + shell; Scripts pending)
**Last updated:** 2026-06-08

## Context

The original dashboard was a functional but plain dark-only UI (hardcoded colors in `styles.css`). A polished design sample was added at `docs/ui/ui-sample` (a standalone React/UMD mock with inline styles, design tokens, and `window.BM` mock data) in the Linear/Vercel devtools style — dark + light themes, Geist fonts, indigo accent, capacity meters, grid/table views, a Live Wall, and a richer profile operate screen.

This feature ports that **visual design onto the real data layer** (react-query + the real REST API + real `@novnc/novnc`). It is **not** a drop-in of the mock — the mock's fields, statuses, and fake live view were reconciled against the real backend.

Phased delivery (decided 2026-06-07): **Profiles + shell first**, review, then Scripts. This doc covers Phase 1.

## Design

### Theming (tokens)
- `frontend/src/theme/tokens.css` (copied from the sample) defines CSS variables under `[data-theme="dark"]` / `[data-theme="light"]`, plus accent/status hues, radii, motion, and keyframes (`spin`, `livepulse`, `shimmer`, `fadeup`, …).
- `ThemeProvider` sets `data-theme` on `<html>` (synchronously in the state initializer to avoid a flash) and persists the choice in `localStorage('bm-theme')`. `useTheme()` exposes `{ theme, setTheme, toggleTheme }`.
- `tokens.css` is imported **before** `styles.css` so a small "theme bridge" block appended to `styles.css` can re-map the surviving legacy className controls (forms, modals, toasts, tag inputs) onto tokens — making reused components theme-aware without rewriting them.

### `ui/` primitive library
Shared, typed, inline-styled primitives ported from the sample's `components.jsx`. Inline styles were kept deliberately (themeable via CSS vars, 1:1 with the design, low divergence risk). Barrel at `frontend/src/ui/index.ts`.

### Status reconcile
The DB persists `IDLE | IN_USE | CORRUPT`. The UI adds a transient `ALLOCATING` (type `UiStatus`) derived from a **pending allocate mutation** (`allocateM.variables`), never from the backend.

### Live stream
`LiveStream` wraps the real `@novnc/novnc` RFB canvas in the sample's monitoring shell (browser-chrome bar showing the ws endpoint, LIVE/CONNECTING/OFFLINE badge, native-Fullscreen-API toggle, Reconnect). The mock's faux page / fps / latency / cursor were dropped (no real data source). A `disposed` guard in the RFB effect prevents React StrictMode's mount→cleanup→remount from letting a torn-down socket's `disconnect` event clobber the fresh connection.

### Backend additions (data gaps)
- `GET /api/capacity` → `{ total: MAX_SLOTS, used, free }` for the capacity meters.
- `profiles.created_at` column (migration adds it nullable + backfills from `last_active`, since SQLite forbids a `CURRENT_TIMESTAMP` default in `ALTER ADD COLUMN`; new inserts set it explicitly).

## Files

**Theme**
- [frontend/src/theme/tokens.css](../../frontend/src/theme/tokens.css) — design tokens + base + keyframes.
- [frontend/src/theme/ThemeProvider.tsx](../../frontend/src/theme/ThemeProvider.tsx) — dark/light context, persistence, `useTheme`.

**`ui/` library** — [Icon](../../frontend/src/ui/Icon.tsx), [Button](../../frontend/src/ui/Button.tsx), [IconButton](../../frontend/src/ui/IconButton.tsx), [StatusDot](../../frontend/src/ui/StatusDot.tsx), [StatusPill](../../frontend/src/ui/StatusPill.tsx), [TagChip](../../frontend/src/ui/TagChip.tsx), [Toggle](../../frontend/src/ui/Toggle.tsx), [Field](../../frontend/src/ui/Field.tsx), [Input](../../frontend/src/ui/Input.tsx), [KV](../../frontend/src/ui/KV.tsx), [Modal](../../frontend/src/ui/Modal.tsx), [SectionCard](../../frontend/src/ui/SectionCard.tsx), [CapacityMeter](../../frontend/src/ui/CapacityMeter.tsx), [status](../../frontend/src/ui/status.ts), [format](../../frontend/src/ui/format.ts), [index](../../frontend/src/ui/index.ts).

**Shell + Profiles**
- [frontend/src/App.tsx](../../frontend/src/App.tsx) — TopBar shell, capacity query, Live Wall + focus state.
- [frontend/src/components/TopBar.tsx](../../frontend/src/components/TopBar.tsx) — brand, nav, capacity, Live Wall, theme toggle.
- [frontend/src/pages/Dashboard.tsx](../../frontend/src/pages/Dashboard.tsx) — orchestrates rail + grid/table + detail + mutations + filter/sort.
- [frontend/src/components/ProfileRail.tsx](../../frontend/src/components/ProfileRail.tsx), [ProfilesToolbar.tsx](../../frontend/src/components/ProfilesToolbar.tsx), [ProfileCard.tsx](../../frontend/src/components/ProfileCard.tsx), [ProfileTable.tsx](../../frontend/src/components/ProfileTable.tsx), [ProfileDetailView.tsx](../../frontend/src/components/ProfileDetailView.tsx), [profiles.types.ts](../../frontend/src/components/profiles.types.ts).
- [frontend/src/components/LiveStream.tsx](../../frontend/src/components/LiveStream.tsx) — real noVNC in the new shell.
- [frontend/src/components/LiveWall.tsx](../../frontend/src/components/LiveWall.tsx) — grid of compact streams.

**Reused (wrapped, not rewritten):** `ProfileForm`, `CreateProfileModal`, `ManageGroupsModal`, `QuickRunScript`, `TagInput`, `Toast` — re-themed via the `styles.css` bridge block.

**Backend**
- [backend/src/main.ts](../../backend/src/main.ts) — `GET /api/capacity`.
- [backend/src/db/schema.sql](../../backend/src/db/schema.sql) + [db/index.ts](../../backend/src/db/index.ts) — `created_at` column + migration.
- [backend/src/types.ts](../../backend/src/types.ts), [modules/profiles/profiles.service.ts](../../backend/src/modules/profiles/profiles.service.ts) — `created_at` on `ProfileRow` + create insert.
- [frontend/src/api/capacity.ts](../../frontend/src/api/capacity.ts), [api/types.ts](../../frontend/src/api/types.ts) — client + `Capacity`/`Profile.created_at` types.

## API / Usage

- `GET /api/capacity` → `{ "total": 50, "used": 12, "free": 38 }`. Polled every 3 s by `App` (TopBar meter) and `Dashboard` (rail meter); react-query dedupes the `['capacity']` key.
- `Profile.created_at` — ISO/SQLite timestamp, shown as "x ago" in the profile detail sidebar.
- Theme toggle persists to `localStorage('bm-theme')`; defaults to dark.
- Vite host-dev proxy now falls back to `http://localhost:3000` when `VITE_BACKEND_URL` is unset (Docker still injects `http://backend:3000`), so `npm run dev` works on the host.

## Testing

```powershell
# Backend additions (against a running stack)
docker compose up -d --build
Invoke-RestMethod http://localhost:3000/api/capacity            # {total,used,free}
(Invoke-RestMethod http://localhost:3000/api/profiles)[0].created_at  # non-null

# Type + build gate
cd backend;  .\node_modules\.bin\tsc.cmd --noEmit
cd ..\frontend; .\node_modules\.bin\tsc.cmd -b; npm run build
```

Manual (browser at `http://localhost:8088`, or host `npm run dev` at `:8080`):
1. Dark/light toggle re-themes the whole app.
2. Rail filters (search, group, tags, status segments), toolbar grid/table + density + sort.
3. Open a profile → Allocate → detail hero shows the **live noVNC stream** (LIVE badge, fullscreen, reconnect); Runtime + Profile sidebars populate; `created_at` shows "x ago".
4. TopBar "Live Wall N" → grid of live streams with 2/3/4 column control.
5. Release → detail returns to the empty/allocate state; capacity meter decrements.

Verified end-to-end on the Docker stack 2026-06-08 (allocate → live stream → Live Wall → release).

## History

- 2026-06-08 — Live Wall "Release all" now opens a **selectable** confirm modal: every shown stream is checked by default, each row can be checked/unchecked, and a Select-all/Clear-all toggle flips the lot. Only the checked profiles are released ("Release N" reflects the selection; disabled at 0). `ReleaseConfirmModal` holds the selection state and returns the chosen `Profile[]` to `doRelease`.
- 2026-06-08 — Compacted the Profiles toolbar sort control (sort icon + bare value like "Status" + chevron, was the wider "Sort: Status") and grouped the Live Wall button, sort, density, and grid/table toggles into a single non-wrapping row so they always stay together on the right.
- 2026-06-08 — Moved the "Live Wall N" button out of the global `TopBar` and into the Profiles toolbar (`ProfilesToolbar`), next to the sort/density/view controls — it's a Profiles-context action, so it no longer shows on the Scripts tab. `App` passes `onOpenLiveWall` to `Dashboard`, which computes `liveCount` (IN_USE count) and feeds the toolbar; `TopBar` keeps only the capacity meter + theme toggle.
- 2026-06-08 — Live Wall control/operate upgrade. New filter row: group dropdown (groups present on live streams + Ungrouped, with counts) and a Tags multi-select popover (tags on active streams + counts), both with a Reset. **Allocate** opens a picker of IDLE profiles (search + multi-select + free-slot warning) that launches the selected onto the wall. **Release all** releases only the filtered streams (label becomes "Release all shown · N") behind a confirm modal listing them with slot numbers. Each tile gained a top-right ⋯ menu with **View fullscreen** (via a new `LiveStreamHandle.requestFullscreen()` ref) and **Release this profile** — both act immediately without leaving the wall. `LiveWall` self-fetches profiles/groups and runs allocate/release via `Promise.allSettled` + react-query invalidation. Files: [LiveWall.tsx](../../frontend/src/components/LiveWall.tsx), [LiveStream.tsx](../../frontend/src/components/LiveStream.tsx). Verified e2e on the Docker stack (allocate ee via picker → live; release-this-profile; release-all → 0/50).
- 2026-06-08 — Moved the Configuration "Save changes" button from the bottom of the form into the panel header (it was easy to miss/scroll past). `ProfileForm` is now a `forwardRef` exposing `ProfileFormHandle.submit()`, reports its can-save state via `onCanSaveChange`, and hides its built-in action bar via `hideActions`; `ProfileDetailView` renders the header Save button (disabled until there are valid changes). The create-profile modal still uses the form's built-in buttons.
- 2026-06-08 — Profile detail layout reworked to a single full-width column: the live view (`HERO_H = clamp(440px, calc(100vh - 165px), 1180px)`) now fills most of the viewport so the open profile is operable without fullscreen; Runtime + Profile panels moved **below** "Run a script" as a 2-column row; Configuration uses a 2-column `ProfileForm` (`twoCol` prop → `.pf-grid`, short fields paired, wide fields `.pf-full`). The standalone corrupt banner was dropped (the empty-hero corrupt state already covers it). The create-profile modal keeps the single-column form.
- 2026-06-08 — Phase 1: theme tokens + `ui/` library + TopBar shell + Profiles redesign (rail/toolbar/cards/table/detail) + LiveStream + Live Wall; backend `GET /api/capacity` and `profiles.created_at`. Scripts tab still on the legacy UI (Phase 2 / P5).
- 2026-06-08 — Added `ui/ImageLightbox` and wired it into `RunReportView`: the failure screenshot of a failed run is now clickable (cursor `zoom-in` + hint) and opens full screen (close via backdrop / × / Esc; locks body scroll). Verified e2e with a real failing run.
- 2026-06-08 — `IconButton`: reset inherited legacy `button { padding: 6px 12px }` to `padding: 0` — it was shoving the centered SVG off to the right (measured leftGap 13 / rightGap 0 → 6.5 / 6.5). Affects every icon-only button (toggles, column selector, back/trash/copy/close).
- 2026-06-08 — `QuickRunScript` (the IN_USE "Run a script" card): added a **"Record new script"** button beside "Run on this profile". It opens `RecordPanel` locked to the current profile (`profiles={[profile]}`); on stop, a "Save recorded script" dialog (ui `Modal`) names the capture and `createScript`s it into the Scripts tab. Verified e2e (record → name → create → appears in `GET /api/scripts`).
