# Groups and tags

**Slug:** `groups-and-tags`
**Owner agent:** `backend-developer` (DB/API), `frontend-developer` (sidebar/UI)
**Status:** `shipped`
**Last updated:** 2026-06-09

## Context

At a few hundred profiles the flat sidebar list becomes unmanageable. Users need to organize profiles and narrow the list quickly. This feature adds:

- **Groups** — each profile belongs to at most one group, or none (`NULL` = "Ungrouped", the implicit default). Groups have explicit CRUD.
- **Tags** — each profile can carry many free-form tags, created on the fly when a profile is saved.
- A **filter bar** in the left sidebar: filter by group and/or by tags (combined with AND).

See [README.md — Features](../../README.md#features).

## Design

### Storage

Two different models, chosen per access pattern:

- **Groups → relational.** A `groups` table (`id`, `name` unique, `created_at`) plus `profiles.group_id` (nullable). One group per profile. Deleting a group re-parents its profiles to Ungrouped (`group_id = NULL`) in the same transaction — profiles are never deleted with a group.
- **Tags → JSON array on the profile.** `profiles.tags TEXT NOT NULL DEFAULT '[]'`. Tags are free-form, per-profile, and filtered **client-side** (the dashboard already polls the full profile list), so a junction table would be over-engineering. The tag universe for the filter UI is derived from the loaded profiles.

`groups` is declared above `profiles` in [schema.sql](../../backend/src/db/schema.sql) so the `group_id` foreign key resolves on fresh installs. For legacy DBs, `db.exec(schema)` re-runs `CREATE TABLE IF NOT EXISTS groups` and `ensureColumn` adds `group_id`/`tags` (the column is added without the inline FK clause, which SQLite's `ALTER TABLE ADD COLUMN` restricts; group integrity is enforced in app code instead).

### Validation

- **Group name**: trimmed, `^[\p{L}\p{N} ._@-]{1,64}$` (Unicode letters → Vietnamese names work), case-insensitively unique.
- **Tag**: `^[\p{L}\p{N}._-]{1,32}$` (no spaces), de-duplicated, max 20 per profile. Enforced on the backend (source of truth) and mirrored in the [TagInput](../../frontend/src/components/TagInput.tsx) so malformed tags never reach a save.
- **group_id on a profile**: must be `null` or reference an existing group, else `INVALID_CONFIG`.

### Replace semantics

On `PATCH /api/profiles/:id`, both `tags` and `group_id` are replaced wholesale when present, and preserved when omitted (same partial-update rule as the other config fields). The frontend form sends only fields that actually changed.

### Sidebar (flat list + filter)

The sidebar keeps a single flat profile list (no nesting) and adds a filter bar above it:

- A group `<select>`: *All groups* / *Ungrouped* / each group.
- A row of toggleable tag chips built from the tag universe; selected chips highlight.
- Filters combine with **AND**: a profile shows iff it matches the group filter **and** contains every selected tag.
- Each list item shows a secondary meta line: the group name + the profile's tags as read-only chips.
- A **Manage groups** button opens a modal for group create / rename / delete.

## Files

- [backend/src/db/schema.sql](../../backend/src/db/schema.sql) — `groups` table; `group_id` + `tags` columns on `profiles`.
- [backend/src/db/index.ts](../../backend/src/db/index.ts) — `ensureColumn` migration for legacy DBs.
- [backend/src/types.ts](../../backend/src/types.ts) — `GroupRow`, `Group`, `parseTags`; `group_id`/`tags` on `ProfileRow`; `Profile.tags` parsed to `string[]`.
- [backend/src/modules/groups/groups.service.ts](../../backend/src/modules/groups/groups.service.ts) — list/create/rename/delete + `groupExists`.
- [backend/src/modules/groups/groups.routes.ts](../../backend/src/modules/groups/groups.routes.ts) — `/api/groups` router.
- [backend/src/modules/profiles/profiles.service.ts](../../backend/src/modules/profiles/profiles.service.ts) — tag validation in `normalizeConfig`, `resolveGroupId`, INSERT/UPDATE wiring.
- [backend/src/modules/profiles/profiles.routes.ts](../../backend/src/modules/profiles/profiles.routes.ts) — `pickConfig` passes through `group_id`/`tags`.
- [backend/src/main.ts](../../backend/src/main.ts) — mounts `groupsRouter` at `/api/groups`.
- [frontend/src/api/groups.ts](../../frontend/src/api/groups.ts) — group CRUD client.
- [frontend/src/api/types.ts](../../frontend/src/api/types.ts) — `Group`; `group_id`/`tags` on `Profile` + `ProfileConfigInput`.
- [frontend/src/components/TagInput.tsx](../../frontend/src/components/TagInput.tsx) — chip input with client-side validation + live autocomplete dropdown (substring match of existing tags, keyboard + mouse selection).
- [frontend/src/components/ManageGroupsModal.tsx](../../frontend/src/components/ManageGroupsModal.tsx) — group CRUD modal.
- [frontend/src/components/ProfileForm.tsx](../../frontend/src/components/ProfileForm.tsx) — Group `<select>` + Tags `TagInput` rows.
- [frontend/src/pages/Dashboard.tsx](../../frontend/src/pages/Dashboard.tsx) — groups query, group mutations, filter state, filter bar, meta line.
- [frontend/src/styles.css](../../frontend/src/styles.css) — filter bar, tag chips/input, group modal styles.

## API / Usage

Endpoints (full detail in [docs/api.md](../api.md)):

- `GET /api/groups` → `Group[]` (with `profile_count`).
- `POST /api/groups` `{ name }` → `Group`.
- `PATCH /api/groups/:id` `{ name }` → `Group`.
- `DELETE /api/groups/:id` → 204 (profiles re-parented to Ungrouped).
- `POST`/`PATCH /api/profiles` additionally accept `group_id?: number | null` and `tags?: string[]`.

`Group` JSON: `{ id, name, created_at, profile_count }`. `Profile` gains `group_id: number | null` and `tags: string[]`.

## Testing

```powershell
docker compose up -d --build
```

Backend:

```powershell
# Create a group
curl -X POST http://localhost:3000/api/groups -H "Content-Type: application/json" -d '{\"name\":\"QA\"}'
# → {"id":1,"name":"QA","created_at":"...","profile_count":0}

# Create a profile in that group with tags
curl -X POST http://localhost:3000/api/profiles -H "Content-Type: application/json" `
  -d '{\"profile_name\":\"qa_01\",\"group_id\":1,\"tags\":[\"smoke\",\"prod\"]}'

# Reassign / retag via PATCH (group_id and tags replace wholesale)
curl -X PATCH http://localhost:3000/api/profiles/1 -H "Content-Type: application/json" -d '{\"group_id\":null,\"tags\":[\"smoke\"]}'

# Delete the group → its profiles become Ungrouped, not deleted
curl -X DELETE http://localhost:3000/api/groups/1
curl http://localhost:3000/api/profiles   # qa_01 still present, group_id now null
```

UI (`http://localhost:8088`):

1. **Manage groups** → add "QA" and "Marketing"; rename and delete work; deleting a non-empty group ungroups its profiles (confirm prompt).
2. Create/edit a profile → assign a **Group** from the dropdown and add **Tags**. As you type, a dropdown suggests matching existing tags (matched characters bolded); pick with ↑/↓ + Enter or by clicking. Enter/comma also commits a free-typed tag; invalid characters are rejected in-place; max 20.
3. Filter bar: pick a group → list narrows; click tag chips → AND-narrows further; **Clear** resets. Footer shows `N of M profile(s)` while filtering.
4. Each sidebar item shows its group name + tag chips.

## History

- 2026-06-06 — Initial implementation: `groups` table + `group_id`/`tags` columns, `/api/groups` CRUD, sidebar filter bar (group select + tag chips, AND semantics), Manage-groups modal, Group/Tags inputs on the profile form.
- 2026-06-06 — Replaced the `TagInput` native `<datalist>` with a custom live-autocomplete dropdown: substring-filters existing tags per keystroke, bolds the matched characters, and supports ↑/↓ + Enter and mouse selection.
- 2026-06-09 — Moved the Close button in the Manage Groups modal to the header, and disabled closing on clicking outside the modal backdrop.
- 2026-06-09 — Added the "Manage groups" button next to the group selection dropdown in the Create Profile modal, and disabled closing on clicking outside the backdrop for the Create Profile modal.
- 2026-06-09 — Replaced the settings icon button in ProfileRail header with an uppercase text button "MANAGE GROUPS" for better usability.
- 2026-06-09 — Replaced the browser's default confirm dialog with the app's custom Modal component when deleting groups in the Manage Groups popup.
