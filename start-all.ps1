# Start the full ReMedistribution local development stack.
# Opens the backend API and AI microservice in separate PowerShell windows
# so they keep running when the IDE terminal is closed. Logs are also written
# to server.log and ai-service.log in this folder.

$root = $PSScriptRoot

$serverDir = Join-Path $root "server"
$aiDir     = Join-Path $root "ai-service"
$serverLog = Join-Path $root "server.log"
$aiLog     = Join-Path $root "ai-service.log"

$serverCmd = "cd `"$serverDir`"; npm start 2>&1 | Tee-Object -FilePath `"$serverLog`" -Append"
$aiCmd     = "cd `"$aiDir`"; python -m uvicorn app:app --host 0.0.0.0 --port 8000 2>&1 | Tee-Object -FilePath `"$aiLog`" -Append"

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $serverCmd -WindowStyle Minimized
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $aiCmd -WindowStyle Minimized

Write-Host "ReMedistribution stack starting..."
Write-Host "  Backend API:  http://localhost:5000  (log: server.log)"
Write-Host "  AI service:   http://localhost:8000  (log: ai-service.log)"
Write-Host "  Frontend:     run 'npx vite' in the client folder"
