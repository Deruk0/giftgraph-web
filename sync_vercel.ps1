# Copy only application source and public assets into the deployment directory.
$ErrorActionPreference = 'Stop'
$target = Join-Path $PSScriptRoot 'vercel'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'server.py') -Destination (Join-Path $target 'site_server.py') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'graph_storage.py') -Destination (Join-Path $target 'graph_storage.py') -Force
$htdocs = Join-Path $target 'htdocs'
New-Item -ItemType Directory -Path $htdocs -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'htdocs/assets') -Destination $htdocs -Recurse -Force
Write-Output 'Application source and assets synchronized for Vercel.'
