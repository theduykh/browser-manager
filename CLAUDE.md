# CLAUDE.md — Browser Manager project guide

This file is loaded automatically by Claude Code in every session for this repo. It encodes the conventions all contributors (human and AI) must follow.

## Project at a glance

A self-hosted system for managing multiple Chromium profiles to support parallel automated testing (Playwright). Each allocated browser runs headful inside Xvfb, streams to the browser via x11vnc + websockify + noVNC, and exposes CDP for remote test scripts. Single-host deployment, 10–50 parallel browsers, LAN-only.

- Spec: [README.md](README.md) (architecture, schema, port allocation)
- Implementation plan: `~/.claude/plans/t-i-ang-mu-n-tri-n-linear-gosling.md`
- HTTP API reference for integrators: [docs/api.md](docs/api.md)
- Release packaging (tarball distribution): [docs/features/release-packaging.md](docs/features/release-packaging.md) — run `./release.ps1 -Version vX.Y.Z` to produce `release/dist/browser-manager-vX.Y.Z.zip`.
- Docker Hub publishing: [docs/features/docker-hub-publishing.md](docs/features/docker-hub-publishing.md) — run `./publish.ps1` to build and push images directly to Docker Hub.
- Phase 1 (foundation) complete. Phase 2 (core backend) is next.

## Agents — who owns what

| Domain | Agent |
| --- | --- |
| Node/TypeScript, Playwright, SQLite, process lifecycle, REST API | `backend-developer` |
| React, Vite, noVNC, Live View, Dashboard UI | `frontend-developer` |
| Dockerfile, docker-compose, base images, port ranges, volumes | `devops-docker` |

When a task crosses domains, the agent that touches the most code drives. The others review their portion.

## Feature documentation — mandatory

**Every implemented or updated feature must have a corresponding doc at `docs/features/<feature-slug>.md`.** Use `kebab-case` for the slug.

This is the single most important convention in this repo. If you change behavior, you update the doc — same PR, same commit.

### When to create / update

- **Create** when adding a new capability that a user or another developer would search for ("how does profile allocation work?", "where is the live view configured?").
- **Update** when changing behavior, fixing a non-trivial bug, adding fields to a schema, changing an API contract, or altering a workflow.
- **Don't create** for typos, formatting, dependency bumps without behavior change, or one-off scripts.

### Doc structure (use this template verbatim)

```markdown
# <Feature title>

**Slug:** `<feature-slug>`
**Owner agent:** `<backend-developer | frontend-developer | devops-docker>`
**Status:** `draft | shipped | deprecated`
**Last updated:** YYYY-MM-DD

## Context

Why this exists. What problem it solves. Link to the relevant section in [README.md](README.md) if applicable.

## Design

How it works. Key decisions and trade-offs. Diagrams welcome (ASCII or mermaid).

## Files

Bullet list of the source files that implement this feature, with one-line descriptions. Use clickable markdown links.

## API / Usage

For backend features: HTTP endpoints, request/response shapes, status codes.
For frontend features: components, props, hooks.
For DevOps features: ports, volumes, env vars, commands.

## Testing

Concrete steps to verify the feature end-to-end. Include commands the reviewer can copy-paste.

## History

- YYYY-MM-DD — Initial implementation.
- YYYY-MM-DD — <change summary>.
```

A blank template lives at [docs/features/_template.md](docs/features/_template.md) — copy it to start a new feature doc.

### Workflow

1. Before coding: skim related existing docs in `docs/features/` to avoid duplication.
2. While coding: open or create the doc and fill **Context** and **Design** sections first.
3. After verification passes: fill **Files**, **API/Usage**, **Testing**, and append to **History**.
4. Commit the doc with the code change.

## Coding standards (applies to all agents)

- TypeScript strict mode. No `any` without an inline justification.
- No comments explaining *what*. Only comments for non-obvious *why*.
- No premature abstractions, no speculative generality.
- No mocks for things that should be tested against the real system (DB, Chromium).
- Errors handled at boundaries (HTTP handlers, top-level event handlers); internal code throws.
- File names follow language convention: `PascalCase.tsx` for React components, `kebab-case.ts` for backend modules.

## Repo layout

```
browser-manager/
├── backend/            # Node/TS backend (orchestrator + REST API)
│   ├── src/
│   └── package.json
├── frontend/           # React + Vite dashboard
├── profiles_data/      # Mount point (named volume in container)
├── scripts/            # Container-side scripts (smoke-test.sh, etc.)
├── docs/features/      # One markdown file per feature — see above
├── Dockerfile.backend
├── docker-compose.yml
└── CLAUDE.md           # This file
```

## Verification expectations

Every feature must be verified against a real `docker compose up` stack. Unit tests are fine for pure logic (e.g., slot allocator), but the merge bar is **end-to-end success**, not green unit tests.

## Out of scope (do not introduce without asking)

- Authentication / authorization (LAN-only MVP).
- Stealth / anti-fingerprint plugins (basic Xvfb + headful is sufficient for now).
- Multi-host orchestration.
- CI/CD pipelines.
- Logging libraries (use a tiny `log()` helper until volume justifies pino).
