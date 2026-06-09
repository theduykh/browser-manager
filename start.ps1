# Powershell startup helper
Write-Host "--> Pulling latest images from Docker Hub..." -ForegroundColor Yellow
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "🚀 BROWSER MANAGER IS RUNNING!" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "👉 Access the Dashboard:  http://localhost:8088" -ForegroundColor Yellow
Write-Host "👉 Backend API Status:    http://localhost:3000/health" -ForegroundColor Yellow
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "To view real-time logs, run: docker compose logs -f" -ForegroundColor Gray
Write-Host ""
