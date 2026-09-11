# 心语 Xinyu - 启动脚本
$node = "D:\codex++\node.js\node.exe"
$npm = "D:\codex++\node.js\npm.cmd"
$project = "D:\pi-项目\pi-心理"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   心语 Xinyu - 启动" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 停止旧进程
Write-Host "停止旧进程..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

# 启动后端
Write-Host "启动后端..." -ForegroundColor Green
Start-Process $node -ArgumentList "dist\server\index.js" -WorkingDirectory "$project\server" -WindowStyle Normal

# 启动前端
Write-Host "启动前端..." -ForegroundColor Green
Start-Process $npm -ArgumentList "run","dev" -WorkingDirectory "$project\web" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   心语 Xinyu 已启动" -ForegroundColor Green
Write-Host "   后端: http://localhost:8081"
Write-Host "   前端: http://localhost:3000"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "请在新窗口中查看日志"
Write-Host "按任意键关闭..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
