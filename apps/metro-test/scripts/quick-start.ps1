# Quick Start Script for Metro Test App (PowerShell)
# This script helps you get started quickly

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Metro Test App - Quick Start" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

# Check if node_modules exists
$nodeModulesPath = Join-Path $projectRoot "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    Set-Location $projectRoot
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "✅ Dependencies found" -ForegroundColor Green
    Write-Host ""
}

# Get local IP
Write-Host "🌐 Detecting local IP address..." -ForegroundColor Yellow
$localIP = $null
$interfaces = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { -not $_.IPAddress.StartsWith("127.") -and -not $_.IPAddress.StartsWith("169.254.") }
if ($interfaces) {
    $localIP = $interfaces[0].IPAddress
    Write-Host "✅ Detected IP: $localIP" -ForegroundColor Green
} else {
    Write-Host "⚠️  Could not detect local IP" -ForegroundColor Yellow
}
Write-Host ""

# Check if Metro is running
Write-Host "🔍 Checking if Metro is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8082/status" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Metro is running on port 8082" -ForegroundColor Green
        if ($localIP) {
            Write-Host "   Metro host: $localIP:8082" -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "❌ Metro is NOT running" -ForegroundColor Red
    Write-Host ""
    Write-Host "To start Metro, run in a separate terminal:" -ForegroundColor Yellow
    Write-Host "  cd apps/metro-test" -ForegroundColor White
    Write-Host "  npm start" -ForegroundColor White
    Write-Host ""
}
Write-Host ""

# Check if Android directory exists
$androidDir = Join-Path $projectRoot "android"
if (-not (Test-Path $androidDir)) {
    Write-Host "📱 Android directory not found" -ForegroundColor Yellow
    Write-Host "   The build script will run 'expo prebuild' automatically" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "✅ Android directory exists" -ForegroundColor Green
    Write-Host ""
}

# Show next steps
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Next Steps:" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Start Metro (in a separate terminal):" -ForegroundColor White
Write-Host "   cd apps/metro-test" -ForegroundColor Gray
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Build the APK:" -ForegroundColor White
Write-Host "   cd apps/metro-test" -ForegroundColor Gray
Write-Host "   npm run build:apk" -ForegroundColor Gray
Write-Host ""
if ($localIP) {
    Write-Host "3. Install APK on device and enter Metro host:" -ForegroundColor White
    Write-Host "   $localIP:8082" -ForegroundColor Cyan
    Write-Host ""
}
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

