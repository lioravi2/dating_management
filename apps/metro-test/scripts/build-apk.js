#!/usr/bin/env node

/**
 * Simplified APK build script for Metro Test App
 * Handles IP detection, prebuild, and APK building
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8082;
const SCRIPTS_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPTS_DIR, '..');
const ANDROID_DIR = path.join(PROJECT_ROOT, 'android');
const APK_DEBUG_PATH = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

console.log('═══════════════════════════════════════════════════════════');
console.log('  Metro Test App - APK Build Script');
console.log('═══════════════════════════════════════════════════════════\n');

// Helper function to run commands
function runCommand(command, options = {}) {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: PROJECT_ROOT,
      ...options
    });
    return { success: true, output };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout || error.stderr };
  }
}

// Helper function to check if file exists
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

// Helper to sleep/wait
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

// Main execution wrapped in async function
(async () => {
  // Phase 1: Check Dependencies
  console.log('📦 Phase 1: Checking Dependencies');
  console.log('───────────────────────────────────────────────────────────');

  // Check if node_modules exists
  const nodeModulesPath = path.join(PROJECT_ROOT, 'node_modules');
  if (!fileExists(nodeModulesPath)) {
    console.log('  → Installing dependencies...');
    const installResult = runCommand('npm install');
    if (!installResult.success) {
      console.error('  ✗ Failed to install dependencies');
      process.exit(1);
    }
    console.log('  ✓ Dependencies installed\n');
  } else {
    console.log('  ✓ Dependencies found\n');
  }

  // Phase 2: Prebuild (if Android directory doesn't exist)
  console.log('🔧 Phase 2: Preparing Android Project');
  console.log('───────────────────────────────────────────────────────────');

  if (!fileExists(ANDROID_DIR)) {
    console.log('  → Android directory not found, running expo prebuild...');
    const prebuildResult = runCommand('npx expo prebuild --platform android');
    if (!prebuildResult.success) {
      console.error('  ✗ Failed to run expo prebuild');
      process.exit(1);
    }
    console.log('  ✓ Android project generated\n');
  } else {
    console.log('  ✓ Android directory exists\n');
  }

  // Phase 3: Detect IP Address
  console.log('🌐 Phase 3: Detecting Local IP Address');
  console.log('───────────────────────────────────────────────────────────');

  const localIP = getLocalIP();
  if (localIP) {
    const metroHost = `${localIP}:${PORT}`;
    console.log(`  ✓ Detected IP: ${localIP}`);
    console.log(`  ✓ Metro host: ${metroHost}`);
    console.log(`  → Configure this in the app: ${metroHost}\n`);
    
    // Set as environment variable for Gradle to use
    process.env.REACT_NATIVE_PACKAGER_HOSTNAME = localIP;
    process.env.REACT_NATIVE_PACKAGER_PORT = PORT.toString();
  } else {
    console.log('  ⚠ Could not detect local IP');
    console.log('  → You may need to configure Metro host manually in the app\n');
  }

  // Phase 4: Build APK
  console.log('🔨 Phase 4: Building APK');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`  → Building APK (Metro should be running on port ${PORT})...\n`);

  // Verify Android directory and Gradle wrapper exist
  if (!fileExists(ANDROID_DIR)) {
    console.error(`  ✗ Android directory not found: ${ANDROID_DIR}`);
    console.error('     This should not happen after prebuild. Please check the error above.');
    process.exit(1);
  }

  const gradlewPath = path.join(ANDROID_DIR, os.platform() === 'win32' ? 'gradlew.bat' : 'gradlew');
  if (!fileExists(gradlewPath)) {
    console.error(`  ✗ Gradle wrapper not found: ${gradlewPath}`);
    console.error('     Run "npx expo prebuild" first to generate Android project');
    process.exit(1);
  }

  try {
    // Build the APK using Gradle
    const gradlewCmd = os.platform() === 'win32' ? 'gradlew.bat' : './gradlew';
    const gradleArgs = ['assembleDebug'];
    
    if (localIP) {
      // Pass Metro host as Gradle property
      gradleArgs.push(`-PREACT_NATIVE_PACKAGER_HOSTNAME=${localIP}`);
      gradleArgs.push(`-PREACT_NATIVE_PACKAGER_PORT=${PORT}`);
      console.log(`  → Passing Metro host to Gradle: ${localIP}:${PORT}\n`);
    }
    
    // Prepare environment with Metro host configuration
    const buildEnv = {
      ...process.env,
      REACT_NATIVE_PACKAGER_HOSTNAME: localIP || '',
      REACT_NATIVE_PACKAGER_PORT: PORT.toString()
    };
    
    const buildProcess = spawn(gradlewCmd, gradleArgs, {
      cwd: ANDROID_DIR,
      stdio: 'inherit',
      shell: os.platform() === 'win32',
      env: buildEnv
    });

    buildProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error(`\n  ✗ Build failed with exit code ${code}`);
        process.exit(1);
      }

      // Verify APK was actually built
      await sleep(1000);
      const apkExists = fileExists(APK_DEBUG_PATH);
      
      if (!apkExists) {
        console.error('\n  ✗ Build completed but APK file not found!');
        console.error('     Check the build output above for errors.\n');
        process.exit(1);
      }

      // Phase 5: Output Results
      console.log('\n📱 Phase 5: Build Results');
      console.log('───────────────────────────────────────────────────────────');

      const stats = fs.statSync(APK_DEBUG_PATH);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      console.log('\n  ✓ APK built successfully!');
      console.log(`  📦 Size: ${sizeMB} MB`);
      console.log(`  🕒 Modified: ${stats.mtime.toLocaleString()}`);

      // Make APK location very prominent
      console.log('\n  ═══════════════════════════════════════════════════════');
      console.log('  📍 APK LOCATION:');
      console.log('  ═══════════════════════════════════════════════════════');
      console.log(`  ${APK_DEBUG_PATH}`);
      console.log('  ═══════════════════════════════════════════════════════\n');

      console.log('  💡 Next Steps:');
      console.log('     • Copy the APK file above to your device');
      console.log('     • Install it on your device');
      console.log('     • Start Metro: npm run start (from apps/mobile or apps/metro-test)');
      if (localIP) {
        console.log(`     • Enter Metro host in app: ${localIP}:${PORT}`);
      } else {
        console.log(`     • Enter Metro host in app: YOUR_IP:${PORT}`);
      }
      console.log('     • Test the connection in the app');

      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('  ✓ Build completed successfully!');
      console.log('═══════════════════════════════════════════════════════════\n');
    });

    buildProcess.on('error', (error) => {
      console.error(`\n  ✗ Build process error: ${error.message}`);
      process.exit(1);
    });

  } catch (error) {
    console.error(`\n  ✗ Build failed: ${error.message}`);
    process.exit(1);
  }
})();
