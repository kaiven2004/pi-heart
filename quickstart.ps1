# 心语 Xinyu - 快速启动
$ErrorActionPreference = "Stop"
$projectDir = "D:\pi-项目\pi-心理"

# Kill old processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# Start backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectDir\server'; node dist\server\index.js"
Write-Host "Backend: http://localhost:8081"

# Start frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectDir\web'; npm run dev"
Write-Host "Frontend: http://localhost:3000"

Write-Host ""
Write-Host "Xinyu started! Close the new windows to stop."
pause
