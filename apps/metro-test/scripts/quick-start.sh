#!/bin/bash
# Quick Start Script for Metro Test App (Bash)
# This script helps you get started quickly

echo "═══════════════════════════════════════════════════════════"
echo "  Metro Test App - Quick Start"
echo "═══════════════════════════════════════════════════════════"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if node_modules exists
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd "$PROJECT_ROOT"
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed"
    echo ""
else
    echo "✅ Dependencies found"
    echo ""
fi

# Get local IP
echo "🌐 Detecting local IP address..."
LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' || \
           ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)

if [ -n "$LOCAL_IP" ]; then
    echo "✅ Detected IP: $LOCAL_IP"
else
    echo "⚠️  Could not detect local IP"
fi
echo ""

# Check if Metro is running
echo "🔍 Checking if Metro is running..."
if curl -s -f "http://localhost:8082/status" > /dev/null 2>&1; then
    echo "✅ Metro is running on port 8082"
    if [ -n "$LOCAL_IP" ]; then
        echo "   Metro host: $LOCAL_IP:8082"
    fi
else
    echo "❌ Metro is NOT running"
    echo ""
    echo "To start Metro, run in a separate terminal:"
    echo "  cd apps/metro-test"
    echo "  npm start"
    echo ""
fi
echo ""

# Check if Android directory exists
if [ ! -d "$PROJECT_ROOT/android" ]; then
    echo "📱 Android directory not found"
    echo "   The build script will run 'expo prebuild' automatically"
    echo ""
else
    echo "✅ Android directory exists"
    echo ""
fi

# Show next steps
echo "═══════════════════════════════════════════════════════════"
echo "  Next Steps:"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "1. Start Metro (in a separate terminal):"
echo "   cd apps/metro-test"
echo "   npm start"
echo ""
echo "2. Build the APK:"
echo "   cd apps/metro-test"
echo "   npm run build:apk"
echo ""
if [ -n "$LOCAL_IP" ]; then
    echo "3. Install APK on device and enter Metro host:"
    echo "   $LOCAL_IP:8082"
    echo ""
fi
echo "═══════════════════════════════════════════════════════════"
echo ""

