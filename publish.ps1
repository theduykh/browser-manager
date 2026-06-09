[CmdletBinding()]
param(
    [string]$Username = 'theduykh',
    [string]$Version = 'latest',
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

$backendImg  = "browser-manager-backend"
$frontendImg = "browser-manager-frontend"

Write-Host "==> Publishing Browser Manager to Docker Hub ($Version)" -ForegroundColor Cyan

# Check docker CLI login status
Write-Host "--> Checking Docker login status..." -ForegroundColor Yellow
try {
    # Check if docker is running and we can query login info
    $info = docker info
    # In some docker versions, username is listed in docker info, but not always.
    # We will verify that we can contact the registry or just warn if not.
} catch {
    Write-Host "Docker daemon is not running. Please start Docker." -ForegroundColor Red
    exit 1
}

if (-not $SkipBuild) {
    Write-Host "--> Building backend image..." -ForegroundColor Yellow
    docker build -f Dockerfile.backend -t "${backendImg}:${Version}" -t "${backendImg}:latest" .
    if ($LASTEXITCODE -ne 0) { throw "backend build failed" }

    Write-Host "--> Building frontend production image..." -ForegroundColor Yellow
    docker build -f Dockerfile.frontend -t "${frontendImg}:${Version}" -t "${frontendImg}:latest" .
    if ($LASTEXITCODE -ne 0) { throw "frontend build failed" }
}

# Tag images for Docker Hub
Write-Host "--> Tagging images for Docker Hub user: $Username..." -ForegroundColor Yellow
docker tag "${backendImg}:${Version}" "${Username}/${backendImg}:${Version}"
docker tag "${backendImg}:latest" "${Username}/${backendImg}:latest"
docker tag "${frontendImg}:${Version}" "${Username}/${frontendImg}:${Version}"
docker tag "${frontendImg}:latest" "${Username}/${frontendImg}:latest"

# Push to Docker Hub
Write-Host "--> Pushing backend images to Docker Hub..." -ForegroundColor Yellow
docker push "${Username}/${backendImg}:${Version}"
docker push "${Username}/${backendImg}:latest"

Write-Host "--> Pushing frontend images to Docker Hub..." -ForegroundColor Yellow
docker push "${Username}/${frontendImg}:${Version}"
docker push "${Username}/${frontendImg}:latest"

# Zip packaging block
$distDir     = Join-Path $repoRoot 'release/dist'
$stageDir    = Join-Path $distDir  "browser-manager-public-$Version"
$zipPath     = Join-Path $distDir  "browser-manager-public-$Version.zip"

Write-Host "--> Preparing public release zip package..." -ForegroundColor Yellow
if (Test-Path $stageDir) { Remove-Item -Recurse -Force $stageDir }
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null

# 1. Process and copy docker-compose.prod.yml -> docker-compose.yml
$composeContent = Get-Content (Join-Path $repoRoot 'docker-compose.prod.yml') -Raw
$composeContent = $composeContent -replace "theduykh/browser-manager-backend:latest", "${Username}/${backendImg}:${Version}"
$composeContent = $composeContent -replace "theduykh/browser-manager-frontend:latest", "${Username}/${frontendImg}:${Version}"
$composeContent | Set-Content (Join-Path $stageDir 'docker-compose.yml') -NoNewline

# 2. Process and copy start scripts (remove -f flag as docker-compose.yml is default in zip)
$startBatContent = Get-Content (Join-Path $repoRoot 'start.bat') -Raw
$startBatContent = $startBatContent -replace '-f docker-compose.prod.yml ', ''
$startBatContent | Set-Content (Join-Path $stageDir 'start.bat') -NoNewline

$startShContent = Get-Content (Join-Path $repoRoot 'start.sh') -Raw
$startShContent = $startShContent -replace '-f docker-compose.prod.yml ', ''
$startShContent | Set-Content (Join-Path $stageDir 'start.sh') -NoNewline

# 3. Copy INSTALL.md
if (Test-Path (Join-Path $repoRoot 'release/INSTALL.md')) {
    Copy-Item -Path (Join-Path $repoRoot 'release/INSTALL.md') -Destination (Join-Path $stageDir 'INSTALL.md')
}

# 4. Stamp VERSION
"$Version`n$(Get-Date -Format o)" | Set-Content -Path (Join-Path $stageDir 'VERSION') -NoNewline

# 5. Compress into zip
Write-Host "--> Zipping package to $zipPath..." -ForegroundColor Yellow
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $stageDir '*') -DestinationPath $zipPath -CompressionLevel Optimal

$zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
if ($zipSize -eq 0) {
    $zipSize = [math]::Round((Get-Item $zipPath).Length / 1KB, 2)
    $sizeStr = "$zipSize KB"
} else {
    $sizeStr = "$zipSize MB"
}

Write-Host ""
Write-Host "==> Successfully published and packaged!" -ForegroundColor Green
Write-Host "    Backend Image:  ${Username}/${backendImg}:${Version}"
Write-Host "    Frontend Image: ${Username}/${frontendImg}:${Version}"
Write-Host "    Release Zip:    $zipPath ($sizeStr)"
Write-Host "    Send this lightweight zip to your users."

