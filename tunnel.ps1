param(
    [ValidateSet('start', 'stop', 'status')]
    [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$Binary = (Get-Command ssh -ErrorAction Stop).Source
$StateFile = Join-Path $PSScriptRoot 'tunnel.json'
$OutputLog = Join-Path $PSScriptRoot 'tunnel.out.log'
$ErrorLog = Join-Path $PSScriptRoot 'tunnel.err.log'

function Get-TunnelState {
    if (-not (Test-Path -LiteralPath $StateFile)) { return $null }
    $state = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
    $process = Get-Process -Id $state.pid -ErrorAction SilentlyContinue
    if ($process -and $process.Path -eq $Binary) {
        $details = Get-CimInstance Win32_Process -Filter "ProcessId=$($state.pid)"
        if ($details.CommandLine -like '*nokey@localhost.run*' -and $details.CommandLine -like '*80:127.0.0.1:5100*') {
            if (Test-Path -LiteralPath $OutputLog) {
                $urls = [regex]::Matches((Get-Content -LiteralPath $OutputLog -Raw), 'https://[a-z0-9-]+\.(?:lhr\.life|lhr\.rocks|localhost\.run)')
                if ($urls.Count -gt 0 -and $state.url -ne $urls[$urls.Count - 1].Value) {
                    $state.url = $urls[$urls.Count - 1].Value
                    $state | ConvertTo-Json | Set-Content -LiteralPath $StateFile
                }
            }
            return $state
        }
    }
    return $null
}

$current = Get-TunnelState
if ($Action -eq 'status') {
    if ($current) { Write-Output "Tunnel running: $($current.url) (PID $($current.pid))" }
    else { Write-Output 'Tunnel is not running' }
    exit 0
}
if ($Action -eq 'stop') {
    if ($current) { Stop-Process -Id $current.pid }
    if (Test-Path -LiteralPath $StateFile) { Remove-Item -LiteralPath $StateFile }
    Write-Output 'Tunnel stopped'
    exit 0
}
if ($current) {
    Write-Output "Tunnel already running: $($current.url)"
    exit 0
}
$ToolsDir = Join-Path $PSScriptRoot '.tools'
New-Item -ItemType Directory -Path $ToolsDir -Force | Out-Null
$health = Invoke-RestMethod -Uri 'http://127.0.0.1:5100/health' -TimeoutSec 5
if ($health.status -ne 'ok') { throw 'Start the local web server first' }

$addresses = @([System.Net.Dns]::GetHostAddresses('localhost.run') |
    Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork } |
    ForEach-Object { $_.IPAddressToString } | Select-Object -Unique)
if (-not $addresses.Count) { throw 'No IPv4 addresses found for localhost.run' }
$lastError = ''
foreach ($address in $addresses) {
Write-Output "Connecting to tunnel server $address..."
$process = Start-Process -FilePath $Binary -ArgumentList @(
    '-o', "HostName=$address",
    '-o', 'StrictHostKeyChecking=accept-new', '-o', 'UserKnownHostsFile=.tools/lhr-known-hosts',
    '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'IdentityAgent=none',
    '-o', 'ConnectTimeout=12', '-o', 'ExitOnForwardFailure=yes',
    '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3',
    '-R', '80:127.0.0.1:5100', 'nokey@localhost.run', '--', '--output', 'json'
) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden `
    -RedirectStandardOutput $OutputLog -RedirectStandardError $ErrorLog -PassThru

for ($attempt = 0; $attempt -lt 35; $attempt++) {
    if ($process.HasExited) { break }
    if (Test-Path -LiteralPath $OutputLog) {
        $log = Get-Content -LiteralPath $OutputLog -Raw
        if ($log -match 'https://[a-z0-9-]+\.(?:lhr\.life|lhr\.rocks|localhost\.run)') {
            $url = $Matches[0]
            @{pid=$process.Id; url=$url} | ConvertTo-Json | Set-Content -LiteralPath $StateFile
            Write-Output "Tunnel started: $url (PID $($process.Id))"
            exit 0
        }
    }
    Start-Sleep -Seconds 1
}
if (-not $process.HasExited) { Stop-Process -Id $process.Id }
$lastError = (Get-Content -LiteralPath $ErrorLog -Raw -ErrorAction SilentlyContinue).Trim()
Write-Output 'Tunnel server did not connect; trying the next DNS address.'
}
throw "None of the tunnel servers connected. $lastError See $ErrorLog"
