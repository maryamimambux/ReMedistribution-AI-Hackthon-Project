# Start the ReMedistribution AI microservice in a new PowerShell window.
# This keeps the service alive with its logs visible and avoids it being tied
# to the IDE terminal session.

$aiDir = Join-Path $PSScriptRoot "ai-service"
$logFile = Join-Path $PSScriptRoot "ai-service.log"
$command = "cd `"$aiDir`"; python -m uvicorn app:app --host 0.0.0.0 --port 8000 2>&1 | Tee-Object -FilePath `"$logFile`" -Append"

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $command -WindowStyle Minimized
Write-Host "AI microservice starting in a new window on http://localhost:8000"
Write-Host "Logs are also written to: $logFile"
