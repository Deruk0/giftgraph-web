param(
    [ValidateSet("start", "stop", "restart", "status", "logs")]
    [string]$Action = "status"
)

$ErrorActionPreference = "Stop"

$Dir = $PSScriptRoot
$PidFile = Join-Path $Dir "server.pid"
$LogFile = Join-Path $Dir "server.log"
$ErrFile = Join-Path $Dir "server.err.log"
$Port = if ($env:GIFTGRAPH_WEB_PORT) { $env:GIFTGRAPH_WEB_PORT } else { "5100" }
$BotEnvFile = Join-Path (Split-Path $Dir -Parent) "tg_gift_bot\.env"
$PythonCandidates = @(
    (Join-Path $Dir ".venv\Scripts\python.exe"),
    (Join-Path (Split-Path $Dir -Parent) ".venv\Scripts\python.exe"),
    "python"
)

function Test-PythonCandidate {
    param([string]$Candidate)

    if ($Candidate -ne "python" -and -not (Test-Path -LiteralPath $Candidate)) {
        return $false
    }

    try {
        $null = & $Candidate --version 2>$null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

$PythonExe = $PythonCandidates | Where-Object {
    Test-PythonCandidate $_
} | Select-Object -First 1

if (-not $PythonExe) {
    throw "Python executable was not found"
}

function Get-BotWebSecret {
    if (-not (Test-Path -LiteralPath $BotEnvFile)) {
        return ""
    }

    $line = Get-Content -LiteralPath $BotEnvFile | Where-Object {
        $_ -like "GIFTGRAPH_WEB_SECRET=*"
    } | Select-Object -First 1

    if (-not $line) {
        return ""
    }

    return ($line -replace "^GIFTGRAPH_WEB_SECRET=", "").Trim()
}

function Get-ServerProcess {
    if (-not (Test-Path -LiteralPath $PidFile)) {
        return $null
    }

    $rawPid = (Get-Content -LiteralPath $PidFile -Raw).Trim()
    if (-not $rawPid) {
        return $null
    }

    return Get-Process -Id ([int]$rawPid) -ErrorAction SilentlyContinue
}

function Stop-ProcessTree {
    param([int]$ProcessId)

    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
        Stop-ProcessTree -ProcessId ([int]$child.ProcessId)
    }

    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Start-Server {
    $existing = Get-ServerProcess
    if ($existing) {
        Write-Host "Server is already running (PID $($existing.Id)) on port $Port"
        return
    }

    if (Test-Path -LiteralPath $PidFile) {
        Remove-Item -LiteralPath $PidFile -Force
    }

    $env:PORT = $Port
    $env:PYTHONIOENCODING = "utf-8"
    $LocalDeps = Join-Path $Dir ".deps"
    if (Test-Path -LiteralPath $LocalDeps) {
        $env:PYTHONPATH = if ($env:PYTHONPATH) { "$LocalDeps;$env:PYTHONPATH" } else { $LocalDeps }
    }
    if (-not $env:GIFTGRAPH_SECRET) {
        $botSecret = Get-BotWebSecret
        if ($botSecret) {
            $env:GIFTGRAPH_SECRET = $botSecret
        }
    }
    $process = Start-Process `
        -FilePath $PythonExe `
        -ArgumentList "server.py" `
        -WorkingDirectory $Dir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $LogFile `
        -RedirectStandardError $ErrFile `
        -PassThru

    Set-Content -LiteralPath $PidFile -Value $process.Id
    Start-Sleep -Seconds 1

    $started = Get-ServerProcess
    if ($started) {
        Write-Host "Server started (PID $($started.Id)) on http://0.0.0.0:$Port"
    } else {
        Write-Host "Server failed to start. Check logs:"
        Write-Host $LogFile
        Write-Host $ErrFile
        if (Test-Path -LiteralPath $PidFile) {
            Remove-Item -LiteralPath $PidFile -Force
        }
        exit 1
    }
}

function Stop-Server {
    $process = Get-ServerProcess
    if (-not $process) {
        Write-Host "Server is not running"
        if (Test-Path -LiteralPath $PidFile) {
            Remove-Item -LiteralPath $PidFile -Force
        }
        return
    }

    Stop-ProcessTree -ProcessId $process.Id
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    Write-Host "Server stopped"
}

function Show-Status {
    $process = Get-ServerProcess
    if ($process) {
        Write-Host "Server is running (PID $($process.Id)) on port $Port"
        return
    }
    Write-Host "Server is not running"
}

function Show-Logs {
    if (Test-Path -LiteralPath $LogFile) {
        Get-Content -LiteralPath $LogFile -Tail 80
    }
    if (Test-Path -LiteralPath $ErrFile) {
        Get-Content -LiteralPath $ErrFile -Tail 80
    }
}

switch ($Action) {
    "start" { Start-Server }
    "stop" { Stop-Server }
    "restart" { Stop-Server; Start-Server }
    "status" { Show-Status }
    "logs" { Show-Logs }
}
