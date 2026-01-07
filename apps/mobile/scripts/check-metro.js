#!/usr/bin/env node

/**
 * Check if Metro bundler is running and accessible
 * Shows connection info for mobile app
 */

const { execSync } = require('child_process');
const http = require('http');
const os = require('os');

const PORT = 8081;

console.log('═══════════════════════════════════════════════════════════');
console.log('  Metro Bundler Connection Check');
console.log('═══════════════════════════════════════════════════════════\n');

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Check if Metro is running on localhost
function checkMetroLocalhost() {
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

// Check if Metro is accessible on LAN IP
function checkMetroLAN(lanIP) {
  return new Promise((resolve) => {
    const req = http.get(`http://${lanIP}:${PORT}/status`, { timeout: 2000 }, (res) => {
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
  const localIP = getLocalIP();
  
  console.log('🔍 Checking Metro Bundler Status...\n');
  
  // Check localhost
  console.log(`  → Checking localhost:${PORT}...`);
  const localhostRunning = await checkMetroLocalhost();
  if (localhostRunning) {
    console.log(`  ✓ Metro is running on localhost:${PORT}\n`);
  } else {
    console.log(`  ✗ Metro is NOT running on localhost:${PORT}\n`);
  }
  
  // Check LAN IP
  if (localIP !== 'localhost') {
    console.log(`  → Checking LAN IP (${localIP}:${PORT})...`);
    const lanRunning = await checkMetroLAN(localIP);
    if (lanRunning) {
      console.log(`  ✓ Metro is accessible on LAN: ${localIP}:${PORT}\n`);
    } else {
      console.log(`  ⚠ Metro may not be accessible on LAN: ${localIP}:${PORT}\n`);
      console.log(`     (This is OK if Metro is running with --lan flag)\n`);
    }
  }
  
  // Show connection info
  console.log('📱 Connection Information for Mobile App:\n');
  console.log('  Your computer\'s IP address:', localIP);
  console.log('  Metro port:', PORT);
  console.log(`  Metro URL: http://${localIP}:${PORT}\n`);
  
  if (localhostRunning) {
    console.log('✅ Metro is running!\n');
    console.log('  For your mobile app to connect:');
    console.log('  1. Make sure your device is on the same WiFi network');
    console.log('  2. Metro should be started with --lan flag');
    console.log(`  3. The app should connect to: http://${localIP}:${PORT}\n`);
    
    // Check if Metro was started with --lan
    try {
      const psOutput = execSync(
        process.platform === 'win32' 
          ? `tasklist /FI "IMAGENAME eq node.exe" /FO CSV`
          : `ps aux | grep -i "expo start.*lan"`,
        { encoding: 'utf-8', stdio: 'pipe' }
      );
      
      if (psOutput.includes('expo') || psOutput.includes('--lan')) {
        console.log('  ℹ Metro appears to be running with --lan flag\n');
      }
    } catch (e) {
      // Couldn't check, that's OK
    }
    
  } else {
    console.log('❌ Metro is NOT running!\n');
    console.log('  To start Metro:');
    console.log('    cd apps/mobile');
    console.log('    npm start');
    console.log('  Or use the build script:');
    console.log('    npm run build:apk\n');
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
})();









