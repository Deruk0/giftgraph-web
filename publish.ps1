# Publish the standalone cloud site. No local server or tunnel is required.
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'sync_vercel.ps1')

Push-Location (Join-Path $PSScriptRoot 'vercel')
try {
    & npx vercel deploy --prod --yes --scope deruko77-3626
    if ($LASTEXITCODE -ne 0) { throw 'Vercel deployment failed' }
} finally {
    Pop-Location
}
