# Release packaging — tarball distribution

**Slug:** `release-packaging`
**Owner agent:** `devops-docker`
**Status:** `shipped`
**Last updated:** 2026-05-19

## Context

Team members and downstream consumers should be able to run Browser Manager with **only Docker installed** — no source, no Node, no Python. The release flow packages both container images plus the minimal compose file and install guide into a single `.zip` artifact that can be shared over Drive, USB, or any file-transfer channel. No registry, no network dependency for installation.

## Design

```
release.ps1 (one command on the maintainer's machine)
   │
    ├─ docker build  Dockerfile.backend         → browser-manager-backend:<ver>
    ├─ docker build  Dockerfile.frontend        → browser-manager-frontend:<ver>
    │       (multi-stage: vite build → nginx static + /api proxy)
    ├─ docker save   both images               → images.tar
    ├─ gzip          images.tar                → images.tar.gz (~400–500 MB)
    ├─ copy          docker-compose.prod.yml   → docker-compose.yml
    ├─ copy          release/INSTALL.md
    ├─ write         VERSION stamp
    └─ Compress-Archive                        → release/dist/browser-manager-<ver>.zip
```

The member's workflow is the inverse:

```
unzip browser-manager-<ver>.zip
gunzip -c images.tar.gz | docker load
docker compose up -d
open http://localhost:8088
```

### Why a separate prod frontend image

In dev we run `vite dev` with a bind-mounted source folder for HMR. That can't ship. For release we use a two-stage build:

1. Stage 1 (`node:20-bookworm-slim`): `npm install` + `vite build` to produce `dist/`.
2. Stage 2 (`nginx:1.27-alpine`): serve the static files and **proxy `/api/`** to the backend service so the browser only talks to one origin. WebSocket connections for noVNC still go straight from the browser to the published backend ports (6001-6050) — nginx is not in that path.

The runtime image is small (≈40 MB) because nothing from stage 1 ships.

### Why named volumes in the release compose

The dev compose bind-mounts `./data` so the maintainer can inspect the SQLite file on Windows. Members don't need that, and bind-mounting requires the host folder to exist. Named volumes (`browser-manager-data`, `browser-manager-profiles`) survive container recreates and `docker compose down`, and are managed entirely by Docker — zero setup for the member.

### What the release does NOT include

- Source code.
- The dev `docker-compose.yml`, `Dockerfile.backend`, `Dockerfile.frontend.dev`.
- Any `.env` or example env file — the prod compose has sensible defaults baked in. Members who need to override port mappings edit the included `docker-compose.yml` directly.

## Files

- [Dockerfile.frontend](../../Dockerfile.frontend) — multi-stage build + nginx runtime.
- [release/nginx.conf](../../release/nginx.conf) — static + `/api` proxy.
- [docker-compose.prod.yml](../../docker-compose.prod.yml) — image-only compose (no `build:`), named volumes, restart policy.
- [release.ps1](../../release.ps1) — single-command release pipeline.
- [release/INSTALL.md](../../release/INSTALL.md) — member-facing install + troubleshooting doc shipped inside the zip.

## API / Usage

### Maintainer — cut a release

```powershell
# Default: tags 'latest', zip name browser-manager-latest.zip
./release.ps1

# Versioned
./release.ps1 -Version v0.2.0

# Iterating on packaging only — reuse already-built images
./release.ps1 -Version v0.2.0 -SkipBuild
```

Output: `release/dist/browser-manager-<version>.zip`. That's the single file to share.

### Member — install

See [release/INSTALL.md](../../release/INSTALL.md). The summary is: extract zip, `docker load`, `docker compose up -d`, open `http://localhost:8088`.

### Member — upgrade

The named volumes preserve data across upgrades:

```bash
docker compose down                           # keeps volumes
# replace zip contents with new version
gunzip -c images.tar.gz | docker load         # loads new tagged images
docker compose up -d                          # picks up new :latest
```

## Testing

```powershell
# From a fresh clone:
./release.ps1 -Version v0.0.1-test
# Verify the zip size and contents
Get-ChildItem release/dist/
Expand-Archive release/dist/browser-manager-v0.0.1-test.zip -DestinationPath /tmp/bm-release-test
Get-ChildItem /tmp/bm-release-test
# Expect: docker-compose.yml, images.tar.gz, INSTALL.md, VERSION
```

End-to-end install rehearsal (simulate a member):

```powershell
# Pretend you don't have the images locally
docker rmi browser-manager-backend:latest browser-manager-frontend:latest -f
cd /tmp/bm-release-test
# Linux/macOS one-liner:
# gunzip -c images.tar.gz | docker load
# PowerShell:
$tarP = "$PWD/images.tar"
[System.IO.Compression.GZipStream]::new(
  [System.IO.File]::OpenRead("$PWD/images.tar.gz"),
  [System.IO.Compression.CompressionMode]::Decompress
).CopyTo([System.IO.File]::Create($tarP))
docker load -i $tarP
Remove-Item $tarP
docker compose up -d
Start-Sleep 5
Invoke-WebRequest http://localhost:3000/health
Invoke-WebRequest http://localhost:8088
```

## History

- 2026-05-19 — Initial implementation (Dockerfile.frontend.prod, nginx proxy, release.ps1, INSTALL.md).
