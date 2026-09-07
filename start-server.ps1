# Start the ReMedistribution backend API server in a new PowerShell window.

$serverDir = Join-Path $PSScriptRoot "server"
$logFile = Join-Path $PSScriptRoot "server.log"
$command = "cd `"$serverDir`"; npm start 2>&1 | Tee-Object -FilePath `"$logFile`" -Append"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $command -WindowStyle Minimized
Write-Host "Backend API starting in a new window on http://localhost:5000"
Write-Host "Logs are also written to: $logFile"
