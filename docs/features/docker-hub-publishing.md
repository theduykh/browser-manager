# Docker Hub Publishing

**Slug:** `docker-hub-publishing`
**Owner agent:** `devops-docker`
**Status:** `shipped`
**Last updated:** 2026-06-09

## Context

While the local tarball distribution (`release.ps1`) is great for offline deployment, some environments and users prefer pulling public images directly from Docker Hub. This eliminates the need to download large `.zip` artifacts manually and load them via `docker load`.

## Design

We provide a script `publish.ps1` that automates building, tagging, and pushing both the backend and frontend production images to Docker Hub.

```
publish.ps1 (maintainer machine)
   │
   ├─ check docker registry status
   ├─ docker build Dockerfile.backend       → browser-manager-backend:<ver>
   ├─ docker build Dockerfile.frontend      → browser-manager-frontend:<ver>
   ├─ docker tag for Docker Hub             → <Username>/browser-manager-backend:<ver>
   └─ docker push                           → Docker Hub Registry (Public)
```

We also provide `docker-compose.prod.yml` which points to these public images, allowing anyone to run the full stack with a single command.

## Files

- [publish.ps1](../../publish.ps1) — PowerShell script to build, tag, and push images to Docker Hub.
- [docker-compose.prod.yml](../../docker-compose.prod.yml) — Production Compose configuration referencing Docker Hub public images.
- [start.ps1](../../start.ps1) — Startup helper for Windows.
- [start.sh](../../start.sh) — Startup helper for macOS/Linux.

## API / Usage

### Prerequisites
1. Docker Desktop or Docker CLI installed and running.
2. A Docker Hub account.
3. Authenticate your CLI session:
   ```bash
   docker login
   ```

### Publishing to Docker Hub
To build and push images:
```powershell
# Default: push to 'theduykh' namespace with tag 'latest'
./publish.ps1

# Custom namespace and version tag
./publish.ps1 -Username "your-docker-username" -Version "v1.0.0"

# Re-use already built local images, skip build phase
./publish.ps1 -Username "your-docker-username" -Version "v1.0.0" -SkipBuild
```

### Running with Public Images
To deploy the application using the published public images, you can use the startup helper scripts:
```bash
# Windows
./start.ps1

# macOS / Linux
chmod +x start.sh
./start.sh
```

Or run Docker Compose manually:
```bash
docker compose -f docker-compose.prod.yml up -d
```

## History

- 2026-06-09 — Initial implementation of publish script, compose file, and documentation.
