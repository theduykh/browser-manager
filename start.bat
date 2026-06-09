@echo off

echo.
echo --^> Pulling latest images from Docker Hub...
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

echo.
echo ====================================================================
echo *** BROWSER MANAGER IS RUNNING! ***
echo ====================================================================
echo - Access the Dashboard:  http://localhost:8088
echo - Backend API Status:    http://localhost:3000/health
echo ====================================================================
echo To view real-time logs, run: docker compose logs -f
echo.
pause
