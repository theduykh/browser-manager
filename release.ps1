<#
.SYNOPSIS
    Build, package, and emit a single .zip release artifact for Browser Manager.

.DESCRIPTION
    Steps:
      1. Build production images for backend and frontend, tagged with -Version and 'latest'.
      2. docker save both images to a single compressed tarball.
      3. Copy docker-compose.release.yml + INSTALL.md alongside.
      4. Compress everything into release/dist/browser-manager-<version>.zip.

    Members extract the zip, run `docker load` then `docker compose up -d`.
    No source code is shipped.

.PARAMETER Version
    Version tag (e.g., v0.2.0). Default: 'latest'.

.PARAMETER SkipBuild
    Skip docker build (use existing local images). Useful for iterating on the packaging itself.

.EXAMPLE
    ./release.ps1
    ./release.ps1 -Version v0.2.0
    ./release.ps1 -Version v0.2.0 -SkipBuild
#>
[CmdletBinding()]
param(
    [string]$Version = 'latest',
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

$backendImg  = "browser-manager-backend"
$frontendImg = "browser-manager-frontend"
$distDir     = Join-Path $repoRoot 'release/dist'
$stageDir    = Join-Path $distDir  "browser-manager-$Version"
$zipPath     = Join-Path $distDir  "browser-manager-$Version.zip"

Write-Host "==> Browser Manager release pipeline ($Version)" -ForegroundColor Cyan

if (-not $SkipBuild) {
    Write-Host "--> Building backend image..." -ForegroundColor Yellow
    docker build -f Dockerfile.backend -t "${backendImg}:${Version}" -t "${backendImg}:latest" .
    if ($LASTEXITCODE -ne 0) { throw "backend build failed" }

    Write-Host "--> Building frontend production image..." -ForegroundColor Yellow
    docker build -f Dockerfile.frontend.prod -t "${frontendImg}:${Version}" -t "${frontendImg}:latest" .
    if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }
}

# Clean and prepare staging
if (Test-Path $stageDir) { Remove-Item -Recurse -Force $stageDir }
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null

Write-Host "--> Saving images to combined tarball..." -ForegroundColor Yellow
$tarPath = Join-Path $stageDir 'images.tar'
# docker save accepts multiple images and writes a single archive
docker save -o $tarPath "${backendImg}:${Version}" "${backendImg}:latest" "${frontendImg}:${Version}" "${frontendImg}:latest"
if ($LASTEXITCODE -ne 0) { throw "docker save failed" }

# Compress the tar (gzip via 7z if available, else PowerShell built-in)
$tarSize = [math]::Round((Get-Item $tarPath).Length / 1MB, 1)
Write-Host "    images.tar = $tarSize MB" -ForegroundColor Gray

Write-Host "--> Compressing images.tar -> images.tar.gz..." -ForegroundColor Yellow
$gzPath = "$tarPath.gz"
$srcStream = [System.IO.File]::OpenRead($tarPath)
$dstStream = [System.IO.File]::Create($gzPath)
$gzStream  = New-Object System.IO.Compression.GZipStream(
    $dstStream, [System.IO.Compression.CompressionLevel]::Optimal)
try {
    $srcStream.CopyTo($gzStream)
} finally {
    $gzStream.Dispose()
    $dstStream.Dispose()
    $srcStream.Dispose()
}
Remove-Item $tarPath
$gzSize = [math]::Round((Get-Item $gzPath).Length / 1MB, 1)
Write-Host "    images.tar.gz = $gzSize MB" -ForegroundColor Gray

# Copy compose + install doc
Copy-Item -Path (Join-Path $repoRoot 'docker-compose.release.yml') `
          -Destination (Join-Path $stageDir 'docker-compose.yml')
Copy-Item -Path (Join-Path $repoRoot 'release/INSTALL.md') `
          -Destination (Join-Path $stageDir 'INSTALL.md')

# Stamp version into a small file for traceability
"$Version`n$(Get-Date -Format o)" | Set-Content -Path (Join-Path $stageDir 'VERSION') -NoNewline

Write-Host "--> Zipping release/dist/browser-manager-$Version.zip..." -ForegroundColor Yellow
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $stageDir '*') -DestinationPath $zipPath -CompressionLevel Optimal

$zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "==> Done." -ForegroundColor Green
Write-Host "    Artifact: $zipPath ($zipSize MB)"
Write-Host "    Share this single .zip with team members."
