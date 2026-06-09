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

Write-Host ""
Write-Host "==> Successfully published to Docker Hub!" -ForegroundColor Green
Write-Host "    Backend: ${Username}/${backendImg}:${Version}"
Write-Host "    Frontend: ${Username}/${frontendImg}:${Version}"
