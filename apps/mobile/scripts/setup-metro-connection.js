#!/usr/bin/env node

/**
 * Setup script to help configure Metro connection for WiFi debugging
 * Provides IP address and instructions for manual configuration
 */

const { execSync } = require('child_process');
const http = require('http');
const os = require('os');

const PORT = 8081;

console.log('═══════════════════════════════════════════════════════════');
console.log('  Metro Connection Setup for WiFi Debugging');
console.log('═══════════════════════════════════════════════════════════\n');

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

// Check if device is connected via ADB
function checkADBDevice() {
  try {
    const output = execSync('adb devices', { encoding: 'utf-8', stdio: 'pipe' });
    const devices = output
      .split('\n')
      .filter(line => line.trim() && !line.includes('List of devices'))
      .filter(line => line.includes('device'));
    return devices.length > 0;
  } catch {
    return false;
  }
}

// Set debug server host via ADB
function setDebugServerHost(ip) {
  try {
    const host = `${ip}:${PORT}`;
    execSync(`adb shell "setprop metro.host ${host}"`, { stdio: 'pipe' });
    execSync(`adb shell "setprop debug.remote.url ${host}"`, { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

(async () => {
  const localIP = getLocalIP();
  const metroRunning = await checkMetro();
  const deviceConnected = checkADBDevice();

  console.log('📋 Current Status:\n');
  console.log(`  Metro Running: ${metroRunning ? '✅ Yes' : '❌ No'}`);
  console.log(`  Your IP Address: ${localIP || '❌ Could not detect'}`);
  console.log(`  Device Connected (ADB): ${deviceConnected ? '✅ Yes' : '❌ No'}\n`);

  if (!metroRunning) {
    console.log('⚠️  Metro is not running!\n');
    console.log('  Start Metro first:');
    console.log('    cd apps/mobile');
    console.log('    npm start\n');
    process.exit(1);
  }

  if (!localIP) {
    console.log('⚠️  Could not detect your IP address!\n');
    console.log('  Please find your IP address manually:');
    console.log('    Windows: ipconfig');
    console.log('    Look for IPv4 Address under your WiFi adapter\n');
    process.exit(1);
  }

  const metroURL = `http://${localIP}:${PORT}`;
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Configuration Steps:');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (deviceConnected) {
    console.log('📱 Option 1: Configure via ADB (Automatic)\n');
    console.log(`  Setting debug server host to: ${localIP}:${PORT}...`);
    
    const success = setDebugServerHost(localIP);
    if (success) {
      console.log('  ✅ Debug server host configured!\n');
      console.log('  The app should now connect to Metro automatically.\n');
    } else {
      console.log('  ⚠️  Could not set via ADB (continuing with manual method)\n');
      deviceConnected = false; // Fall through to manual method
    }
  }

  if (!deviceConnected) {
    console.log('📱 Option 2: Configure via Developer Menu (Manual)\n');
    console.log('  Follow these steps on your device:\n');
    console.log('  1. Open your app on the device');
    console.log('  2. Shake the device (or press Ctrl+M / Cmd+M if using emulator)');
    console.log('  3. Tap "Dev Settings" or "Settings"');
    console.log('  4. Tap "Debug server host & port for device"');
    console.log(`  5. Enter: ${localIP}:${PORT}`);
    console.log('  6. Go back and reload the app (or tap "Reload")\n');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Connection Information:');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`  Metro URL: ${metroURL}`);
  console.log(`  Server Host: ${localIP}:${PORT}\n`);

  console.log('✅ Setup Complete!\n');
  console.log('  Make sure:');
  console.log('    • Your device is on the same WiFi network');
  console.log('    • Metro is running with --lan flag');
  console.log('    • Windows Firewall allows port 8081');
  console.log('    • The app is configured with the IP above\n');

  // Test if Metro is accessible on LAN
  console.log('🔍 Testing Metro accessibility on LAN...\n');
  const testReq = http.get(`http://${localIP}:${PORT}/status`, { timeout: 3000 }, (res) => {
    if (res.statusCode === 200) {
      console.log(`  ✅ Metro is accessible at ${metroURL}\n`);
    } else {
      console.log(`  ⚠️  Metro responded but may have issues (status: ${res.statusCode})\n`);
    }
  });

  testReq.on('error', (error) => {
    console.log(`  ⚠️  Could not reach Metro at ${metroURL}`);
    console.log(`     Error: ${error.message}\n`);
    console.log('  This might indicate:');
    console.log('    • Metro is not running with --lan flag');
    console.log('    • Firewall is blocking the connection');
    console.log('    • Device is on a different network\n');
  });

  testReq.on('timeout', () => {
    testReq.destroy();
    console.log(`  ⚠️  Timeout connecting to ${metroURL}\n`);
  });

  console.log('═══════════════════════════════════════════════════════════\n');
})();



