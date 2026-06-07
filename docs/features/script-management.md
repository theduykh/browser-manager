# Script Management, Recording & Execution

**Slug:** `script-management`
**Owner agent:** `backend-developer`
**Status:** `shipped`
**Last updated:** 2026-06-06

## Context

Profiles could be allocated and driven manually, but there was no way to author repeatable automation. This feature lets a user **record** a sequence of browser actions on an open profile, **manage** those sequences as named scripts (CRUD), and **execute** a script on one or many profiles — including IDLE profiles that are auto-allocated for the run and released afterward. After a run, a **report** is produced; only the latest report per script is kept (no history yet — the schema makes adding history trivial later).

Scripts are profile-agnostic: the same script runs against any profile. Execution reuses the existing per-slot CDP endpoint (see [README.md](../../README.md) → Port Allocation) via `chromium.connectOverCDP`.

## Design

### Script model

A script is a name + description + an ordered list of **structured steps** (JSON), not raw code — so steps are editable in the UI and replayed by a small interpreter with no `eval`.

```ts
type ScriptStep =
  | { id; type: 'navigate'; url }
  | { id; type: 'click'; selector }
  | { id; type: 'fill'; selector; value }      // clears + types
  | { id; type: 'press'; selector?; key }      // e.g. Enter
  | { id; type: 'select'; selector; value }
  | { id; type: 'check' | 'uncheck'; selector }
  | { id; type: 'waitForSelector'; selector; timeoutMs? }
  | { id; type: 'waitForTimeout'; ms };
```

### Connecting to a running profile

The orchestrator binds Chromium's CDP to `127.0.0.1:<internalCdp>` where `internalCdp = portsForSlot(slot_id).cdpPort + 10000`. The backend shares the container, so it connects there directly with `chromium.connectOverCDP` — avoiding any host-rewrite of the `webSocketDebuggerUrl`. `browser.close()` over CDP only **disconnects** the client; killing Chromium remains the orchestrator's PID-based job. All of this lives in [cdp.ts](../../backend/src/modules/scripts/cdp.ts).

### Recording (live capture)

```
record/start ─▶ connectOverCDP ─▶ context.addInitScript(recorder)   (future pages)
                                └▶ page.evaluate(recorder)          (current page)
user drives the browser in the Live View ─▶ real DOM events ─▶ window.__bmRecorderSteps[]
Node drains window.__bmRecorderSteps every 500ms ─▶ session.steps
record/stop ─▶ final drain ─▶ disconnect ─▶ return steps
```

- The injected recorder ([recorder.ts](../../backend/src/modules/scripts/recorder.ts), `RECORDER_SRC`) captures `click` (non-text elements), `input` (text entry → `fill`, coalesced to the latest value per field), `change` (`<select>` → `select`, plus an autofill/paste backstop), and `keydown` (Enter/Tab → `press`). It generates a selector per element: `#id` → `[data-testid]`/`[name]`/`aria-label` → `:nth-of-type` CSS path. Selectors are best-effort; **every step is editable afterward**, which is the safety valve.
  - **Why `input`, not just `change`:** real typing via the Live View rarely blurs the field, and `change` only fires on blur — so `fill` is captured on `input` (every keystroke), coalesced in-page and Node-side so each field collapses to a single step at its final value.
- Navigations are recorded Node-side via `framenavigated`, suppressed within 1.5 s of a click (to avoid duplicating click-driven navigation). An initial `navigate` to the current URL is seeded so the script is self-contained.

### Execution

A **run** executes one script against N target profiles, in a concurrency-capped pool (`SCRIPT_RUN_CONCURRENCY`, default 5). Per target:

1. IN_USE → run as-is (left open afterward). IDLE + `autoAllocate` → `allocateBrowser` (open), run, then `releaseBrowser` (auto-released). IDLE without `autoAllocate` → target fails `not open`.
2. Connect, run each step via [step-interpreter.ts](../../backend/src/modules/scripts/step-interpreter.ts) with a per-step timeout (`SCRIPT_STEP_TIMEOUT_MS`, default 15 s), recording status + duration. `last_active` is bumped each step so the zombie killer doesn't reclaim mid-run.
3. On a failed step a JPEG screenshot (base64 data URI) is captured; with `stopOnError` the remaining steps are `skipped`.

Runs are tracked in an in-memory registry (live progress, polled by the UI) and the final report is **upserted** into `script_runs` keyed by `script_id` — exactly one row per script, overwriting the previous (latest-only). The overall status is `passed` / `failed` / `partial`.

### Data model

Two tables in [schema.sql](../../backend/src/db/schema.sql) (created via `db.exec(schema)`, no migration code):

- `scripts(id, name UNIQUE, description, steps JSON, created_at, updated_at)`
- `script_runs(id, script_id UNIQUE → scripts ON DELETE CASCADE, status, report JSON, started_at, finished_at)` — `UNIQUE(script_id)` enforces latest-only. To enable history later: drop the UNIQUE constraint and stop upsert-replacing.

## Files

Backend ([backend/src/modules/scripts/](../../backend/src/modules/scripts/)):
- [types.ts](../../backend/src/modules/scripts/types.ts) — step union, script/report/recording types.
- [steps.ts](../../backend/src/modules/scripts/steps.ts) — `validateSteps` (boundary validation, id backfill).
- [scripts.service.ts](../../backend/src/modules/scripts/scripts.service.ts) — CRUD + report persistence (`saveRunReport`/`getLatestReport`).
- [cdp.ts](../../backend/src/modules/scripts/cdp.ts) — `connectToProfile` / `getOpenProfile`.
- [step-interpreter.ts](../../backend/src/modules/scripts/step-interpreter.ts) — one step → Playwright `page` call.
- [script-runner.ts](../../backend/src/modules/scripts/script-runner.ts) — run registry, pool, auto-allocate/release, screenshots.
- [recorder.ts](../../backend/src/modules/scripts/recorder.ts) — live recorder + injected `RECORDER_SRC`.
- [scripts.routes.ts](../../backend/src/modules/scripts/scripts.routes.ts) — HTTP boundary; wired in [main.ts](../../backend/src/main.ts).
- [config.ts](../../backend/src/config.ts) — `scriptStepTimeoutMs`, `scriptRunConcurrency`. `playwright` promoted to a runtime dependency in [package.json](../../backend/package.json).

Frontend:
- [api/scripts.ts](../../frontend/src/api/scripts.ts), [api/types.ts](../../frontend/src/api/types.ts) — client + types.
- [lib/steps.ts](../../frontend/src/lib/steps.ts) — step helpers (uid, blank step, summary).
- [pages/Scripts.tsx](../../frontend/src/pages/Scripts.tsx) — master-detail Scripts page + new-script modal.
- [components/ScriptDetail.tsx](../../frontend/src/components/ScriptDetail.tsx), [StepEditor.tsx](../../frontend/src/components/StepEditor.tsx), [RunModal.tsx](../../frontend/src/components/RunModal.tsx), [RecordPanel.tsx](../../frontend/src/components/RecordPanel.tsx), [RunReportView.tsx](../../frontend/src/components/RunReportView.tsx), [QuickRunScript.tsx](../../frontend/src/components/QuickRunScript.tsx).
- [App.tsx](../../frontend/src/App.tsx) — top-nav between Profiles and Scripts. [ProfileDetail.tsx](../../frontend/src/components/ProfileDetail.tsx) — quick-run on open profiles.

## API / Usage

Base `http://<host>:3000`. See [docs/api.md](../api.md) §3.14 for full shapes.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/scripts` | List scripts (+ each script's last-run summary). |
| `POST` | `/api/scripts` | Create `{ name, description?, steps? }`. |
| `GET` | `/api/scripts/:id` | One script (+ last-run summary). |
| `PATCH` | `/api/scripts/:id` | Update `{ name?, description?, steps? }`. |
| `DELETE` | `/api/scripts/:id` | Delete (cascades the run row). |
| `GET` | `/api/scripts/:id/report` | Full latest `RunReport` (or `null`). |
| `POST` | `/api/scripts/:id/run` | `{ targets: number[], autoAllocate?, stopOnError? }` → `202 { run_id }`. |
| `GET` | `/api/scripts/runs/:runId` | Live `RunReport` (in-memory). |
| `POST` | `/api/scripts/record/start` | `{ profile_id }` → `{ recording_id }` (profile must be IN_USE). |
| `GET` | `/api/scripts/record/:recordingId` | `{ status, steps }`. |
| `POST` | `/api/scripts/record/:recordingId/stop` | → `{ steps }`. |

UI: **Scripts** tab → create, edit steps, **Record** (drive an open profile in the embedded Live View), **Run** (pick IDLE/IN_USE profiles). On an open profile's detail panel, **Run script** quick-runs a saved script directly.

## Testing

```powershell
# Host typecheck
cd backend;  .\node_modules\.bin\tsc.cmd --noEmit
cd ..\frontend; .\node_modules\.bin\tsc.cmd -b

# End-to-end
docker compose up -d --build
# open http://localhost:8088 → Scripts tab
```

1. **CRUD:** create a script, add steps manually, save, reload — confirm persisted; edit + delete.
2. **Record:** allocate a profile → Scripts → a script → Record → in the Live View navigate, click, type, press Enter → steps stream in → Stop & save.
3. **Quick-run:** on the IN_USE profile's panel, pick the script under "Run script" → replays in the Live View, report appears.
4. **Auto-allocate:** Scripts → Run → select an IDLE profile, keep auto-allocate on → it opens, replays, reports, then returns to IDLE.
5. **Multi-profile:** select one IN_USE + one IDLE → both report; IN_USE stays open, IDLE released.
6. **Latest-only:** run the same script twice →
   `docker compose exec backend sqlite3 /app/data/database.sqlite "SELECT script_id,count(*) FROM script_runs GROUP BY script_id;"` shows count 1.
7. **Failure path:** add a step with a bad selector → that step `failed`, later steps `skipped`, a screenshot shows in the report.

## History

- 2026-06-06 — Initial implementation (CRUD, live recording over CDP, multi-profile execution with auto-allocate/release, latest-only report).
- 2026-06-06 — Recorder: capture text entry on `input` (every keystroke) instead of only `change` (blur). Real typing in the Live View rarely blurs, so `fill` steps were being missed; now coalesced per field to the final value.
