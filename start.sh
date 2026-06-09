#!/bin/bash
echo "--> Pulling latest images from Docker Hub..."
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

echo ""
echo -e "\033[36m====================================================================\033[0m"
echo -e "\033[32m🚀 BROWSER MANAGER IS RUNNING!\033[0m"
echo -e "\033[36m====================================================================\033[0m"
echo -e "\033[33m👉 Access the Dashboard:  http://localhost:8088\033[0m"
echo -e "\033[33m👉 Backend API Status:    http://localhost:3000/health\033[0m"
echo -e "\033[36m====================================================================\033[0m"
echo -e "\033[90mTo view real-time logs, run: docker compose logs -f\033[0m"
echo ""
