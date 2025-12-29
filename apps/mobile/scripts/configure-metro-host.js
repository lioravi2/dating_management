#!/usr/bin/env node

/**
 * Configure Metro host for the app
 * This script helps you configure the Metro bundler URL
 * Works across different WiFi networks once configured
 */

const { execSync } = require('child_process');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

const PORT = 8081;

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

// Check if Metro is running
function checkMetro() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}/status`, { timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

(async () => {
console.log('═══════════════════════════════════════════════════════════');
console.log('  Metro Host Configuration Helper');
console.log('═══════════════════════════════════════════════════════════\n');

const localIP = getLocalIP();
const metroRunning = await checkMetro();

if (!localIP) {
  console.log('❌ Could not detect your IP address!\n');
  console.log('  Please find your IP address manually:');
  console.log('    Windows: ipconfig');
  console.log('    Look for IPv4 Address under your WiFi adapter\n');
  process.exit(1);
}

if (!metroRunning) {
  console.log('⚠️  Metro is not running!\n');
  console.log('  Start Metro first:');
  console.log('    cd apps/mobile');
  console.log('    npm start\n');
  process.exit(1);
}

const metroHost = `${localIP}:${PORT}`;

console.log('📋 Configuration Information:\n');
console.log(`  Your IP Address: ${localIP}`);
console.log(`  Metro Port: ${PORT}`);
console.log(`  Metro Host: ${metroHost}`);
console.log(`  Metro URL: http://${metroHost}\n`);

console.log('═══════════════════════════════════════════════════════════');
console.log('  How to Configure Metro Host in Your App:');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Since you cannot access the Developer Menu, you have two options:\n');

console.log('OPTION 1: Temporary USB Connection (Recommended)\n');
console.log('  1. Connect your device via USB (temporarily)');
console.log('  2. Run: adb shell input keyevent 82');
console.log('     (This opens the Developer Menu)');
console.log(`  3. In Developer Menu: Dev Settings → Debug server host → Enter: ${metroHost}`);
console.log('  4. Disconnect USB - it will work over WiFi now\n');

console.log('OPTION 2: Use React Native Debugger (Alternative)\n');
console.log('  1. Install React Native Debugger (optional tool)');
console.log('  2. Or use Flipper to configure DevSettings');
console.log('  3. Configure the debug server host to:', metroHost);
console.log('\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('  Important Notes:');
console.log('═══════════════════════════════════════════════════════════\n');
console.log('• Once configured, the app will remember the Metro host');
console.log('• It will work across different WiFi networks');
console.log('• You only need to configure it once');
console.log(`• Use this IP address: ${localIP}:${PORT}`);
console.log('\n');

console.log('═══════════════════════════════════════════════════════════\n');
})();

