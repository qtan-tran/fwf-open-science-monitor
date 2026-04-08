$ErrorActionPreference = "Stop"

Write-Host "=== Push Prisma Schema to Neon ===" -ForegroundColor Cyan
Write-Host ""

$env:DATABASE_URL = Read-Host "Enter your Neon POOLED connection string (DATABASE_URL)"
$env:DIRECT_URL   = Read-Host "Enter your Neon DIRECT connection string (DIRECT_URL)"

Write-Host "`nPushing schema..." -ForegroundColor Yellow
Push-Location apps/web
npx prisma db push --accept-data-loss
Write-Host "Schema pushed successfully!" -ForegroundColor Green

Pop-Location
Write-Host "`nDone! Now load data with seed or ETL." -ForegroundColor Green
Write-Host "  Option A: Paste seed.sql into the Neon SQL Editor (browser)" -ForegroundColor Yellow
Write-Host "  Option B: Run the ETL pipeline:" -ForegroundColor Yellow
Write-Host "    cd etl" -ForegroundColor Gray
Write-Host "    `$env:DATABASE_URL = '<your direct Neon string>'" -ForegroundColor Gray
Write-Host "    `$env:FWF_API_KEY  = '<your key>'" -ForegroundColor Gray
Write-Host "    python -m src.pipeline" -ForegroundColor Gray
