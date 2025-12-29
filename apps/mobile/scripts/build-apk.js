#!/usr/bin/env node

/**
 * Comprehensive APK build script
 * Handles cleanup, preparation, Metro startup, and building with port 8081
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const http = require('http');

const PORT = 8081;
const SCRIPTS_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPTS_DIR, '..');
const ANDROID_DIR = path.join(PROJECT_ROOT, 'android');
const APK_DEBUG_PATH = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const APK_RELEASE_PATH = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

console.log('═══════════════════════════════════════════════════════════');
console.log('  APK Build Script - Clean Build with Port 8081');
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

// Helper function to get file info
function getFileInfo(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    return {
      exists: true,
      size: stats.size,
      sizeMB,
      modified: stats.mtime
    };
  } catch {
    return { exists: false };
  }
}

// Helper to sleep/wait
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check if a port is actually listening
function isPortListening(port, host = 'localhost') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host }, () => {
      socket.end();
      resolve(true);
    });

    socket.on('error', () => {
      resolve(false);
    });

    // Timeout after 500ms
    socket.setTimeout(500);
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

// Check if Metro is ready by checking the status endpoint
function isMetroReady(port = PORT) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/status`, { timeout: 1000 }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Wait for port to be free (for cleanup verification)
async function waitForPortFree(port, maxWait = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    const isListening = await isPortListening(port);
    if (!isListening) {
      return true;
    }
    await sleep(200);
  }
  return false;
}

// Wait for Metro to be ready (checks both port and HTTP endpoint)
async function waitForMetroReady(port = PORT, maxWait = 30000) {
  const startTime = Date.now();
  const checkInterval = 500;

  while (Date.now() - startTime < maxWait) {
    // First check if port is listening
    const portListening = await isPortListening(port);
    if (portListening) {
      // Port is listening, check Metro status endpoint
      const metroReady = await isMetroReady(port);
      if (metroReady) {
        return true;
      }
      // Port is listening but Metro not ready yet, wait a bit
      await sleep(1000);
      const metroReadyRetry = await isMetroReady(port);
      if (metroReadyRetry) {
        return true;
      }
    }
    await sleep(checkInterval);
  }
  return false;
}

// Main execution wrapped in async function
(async () => {
  // Phase 1: Cleanup
  console.log('📦 Phase 1: Cleanup');
  console.log('───────────────────────────────────────────────────────────');

  // Kill Metro instances
  console.log('  → Killing Metro instances on port 8081...');
  const killResult = runCommand(`node ${path.join(SCRIPTS_DIR, 'kill-metro.js')}`, { silent: true });
  if (killResult.success) {
    console.log('  ✓ Metro cleanup completed');
  } else {
    console.log('  ⚠ Metro cleanup had issues (continuing anyway)');
  }

  // Verify port is actually free
  console.log('  → Verifying port 8081 is free...');
  const portFree = await waitForPortFree(PORT, 5000);
  if (portFree) {
    console.log('  ✓ Port 8081 is free\n');
  } else {
    console.log('  ⚠ Port 8081 may still be in use (will attempt to continue)\n');
  }

  // Optional: Clean build artifacts
  const CLEAN_BUILD = process.env.CLEAN_BUILD === 'true';
  if (CLEAN_BUILD) {
    console.log('  → Cleaning build artifacts...');
    const buildDir = path.join(ANDROID_DIR, 'app', 'build');
    if (fileExists(buildDir)) {
      try {
        fs.rmSync(buildDir, { recursive: true, force: true });
        console.log('  ✓ Build artifacts cleaned\n');
      } catch (error) {
        console.log(`  ⚠ Could not clean build artifacts: ${error.message}\n`);
      }
    } else {
      console.log('  ✓ No build artifacts to clean\n');
    }
  } else {
    console.log('  ℹ Skipping build artifact cleanup (set CLEAN_BUILD=true to enable)\n');
  }

  // Phase 2: Preparation
  console.log('🔧 Phase 2: Preparation');
  console.log('───────────────────────────────────────────────────────────');

  // Check ADB connection (optional - only for automatic installation)
  console.log('  → Checking ADB connection (optional for manual APK transfer)...');
  const adbCheck = runCommand('adb devices', { silent: true });
  if (!adbCheck.success) {
    console.log('  ⚠ ADB not found or not in PATH (optional - continuing anyway)');
    console.log('     APK will be built but not automatically installed\n');
  } else {
    const devices = (adbCheck.output || '')
      .split('\n')
      .filter(line => line.trim() && !line.includes('List of devices'))
      .filter(line => line.includes('device'));

    if (devices.length === 0) {
      console.log('  ℹ No Android devices/emulators connected via USB');
      console.log('     APK will be built - you can transfer it manually\n');
    } else {
      console.log(`  ✓ Found ${devices.length} device(s) connected via USB\n`);
      // Setup ADB port forwarding (useful for emulators)
      console.log('  → Setting up ADB port forwarding...');
      const adbForward = runCommand(`adb reverse tcp:${PORT} tcp:${PORT}`, { silent: true });
      if (adbForward.success) {
        console.log(`  ✓ Port forwarding set up: localhost:${PORT} → device:${PORT}\n`);
      } else {
        console.log('  ⚠ Could not set up port forwarding (device may not be connected)\n');
      }
    }
  }

  // Phase 3: Start Metro First
  console.log('🚀 Phase 3: Starting Metro Bundler');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`  → Starting Metro on port ${PORT}...\n`);

  let metroProcess = null;
  let metroReady = false;

  try {
    // Double-check port is free before starting
    const portCheck = await isPortListening(PORT);
    if (portCheck) {
      console.log(`  ⚠ Port ${PORT} is still in use! Attempting to kill again...`);
      runCommand(`node ${path.join(SCRIPTS_DIR, 'kill-metro.js')}`, { silent: true });
      await sleep(2000);
      const portCheck2 = await isPortListening(PORT);
      if (portCheck2) {
        console.error(`  ✗ Port ${PORT} is still in use after cleanup. Please manually kill the process.`);
        process.exit(1);
      }
    }

    // Start Metro in the background
    metroProcess = spawn('npx', ['expo', 'start', '--port', PORT.toString(), '--lan', '--no-dev'], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      detached: false
    });

    // Handle Metro output (but don't rely on it for readiness)
    metroProcess.stdout.on('data', (data) => {
      const output = data.toString();
      // Show Metro output
      process.stdout.write(output);
    });

    metroProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    metroProcess.on('error', (error) => {
      console.error(`\n  ✗ Failed to start Metro: ${error.message}`);
      console.log('  → Attempting to continue with build...\n');
    });

    // Wait for Metro to be ready using actual port and HTTP checks
    console.log('  → Waiting for Metro to be ready (checking port and HTTP endpoint)...');
    metroReady = await waitForMetroReady(PORT, 30000);

    if (metroReady) {
      console.log('  ✓ Metro is ready and responding on port 8081!\n');
    } else {
      console.log('  ⚠ Metro may not be fully ready, but continuing with build...\n');
    }

  } catch (error) {
    console.error(`  ✗ Failed to start Metro: ${error.message}`);
    if (metroProcess) {
      metroProcess.kill();
      metroProcess = null;
    }
    console.log('  → Attempting to continue with build...\n');
  }

  // Phase 4: Build
  console.log('🔨 Phase 4: Building APK');
  console.log('───────────────────────────────────────────────────────────');
  console.log(`  → Building APK (will connect to Metro on port ${PORT})...\n`);
  if (metroReady) {
    console.log(`  ✓ Metro is running - app will connect to it for live updates\n`);
  } else {
    console.log(`  ⚠ Metro status unclear - app may bundle JS instead\n`);
  }

  // Get local IP address for Metro host configuration
  console.log('  → Detecting local IP address for Metro configuration...');
  const localIP = (() => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return null;
  })();

  if (localIP) {
    const metroHost = `${localIP}:${PORT}`;
    console.log(`  ✓ Detected IP: ${localIP}`);
    console.log(`  ✓ Metro host will be configured as: ${metroHost}\n`);
    
    // Set as environment variable for Gradle to use
    process.env.REACT_NATIVE_PACKAGER_HOSTNAME = localIP;
    process.env.REACT_NATIVE_PACKAGER_PORT = PORT.toString();
  } else {
    console.log('  ⚠ Could not detect local IP - Metro may not connect properly\n');
    console.log('  → You may need to configure Metro host manually in Developer Menu\n');
  }

  console.log(`  Executing: Gradle assembleDebug (to avoid Metro conflict)\n`);

  // Verify Android directory and Gradle wrapper exist
  if (!fileExists(ANDROID_DIR)) {
    console.error(`  ✗ Android directory not found: ${ANDROID_DIR}`);
    console.error('     Run "npx expo prebuild" first to generate Android project');
    if (metroProcess) {
      metroProcess.kill();
    }
    process.exit(1);
  }

  const gradlewPath = path.join(ANDROID_DIR, os.platform() === 'win32' ? 'gradlew.bat' : 'gradlew');
  if (!fileExists(gradlewPath)) {
    console.error(`  ✗ Gradle wrapper not found: ${gradlewPath}`);
    console.error('     Run "npx expo prebuild" first to generate Android project');
    if (metroProcess) {
      metroProcess.kill();
    }
    process.exit(1);
  }

  // Write Metro host to a file that the app can read at runtime
  // This is simpler than trying to pass it through BuildConfig
  if (localIP) {
    const metroHostFile = path.join(PROJECT_ROOT, 'metro_host.txt');
    const metroHost = `${localIP}:${PORT}`;
    try {
      fs.writeFileSync(metroHostFile, metroHost, 'utf8');
      console.log(`  ✓ Wrote Metro host to file: ${metroHost}\n`);
    } catch (error) {
      console.log(`  ⚠ Could not write Metro host file: ${error.message}\n`);
    }
  }

  try {
    // Build the APK using Gradle directly to avoid expo run:android trying to start Metro
    // This way we can use the Metro instance we already started
    const gradlewCmd = os.platform() === 'win32' ? 'gradlew.bat' : './gradlew';
    
    // Prepare Gradle arguments with Metro host configuration
    // Use --rerun-tasks to force rebuild and ensure Metro host is picked up
    const gradleArgs = ['assembleDebug', '--rerun-tasks'];
    if (localIP) {
      // Pass Metro host as Gradle property so build.gradle can use it
      // Use -P flag to set project properties
      gradleArgs.push(`-PREACT_NATIVE_PACKAGER_HOSTNAME=${localIP}`);
      gradleArgs.push(`-PREACT_NATIVE_PACKAGER_PORT=${PORT}`);
      console.log(`  → Passing Metro host to Gradle: ${localIP}:${PORT}`);
      console.log(`  → Using --rerun-tasks to force fresh build\n`);
    } else {
      console.log('  ⚠ No IP detected - Metro will use localhost:8081\n');
    }
    
    // Prepare environment with Metro host configuration
    const buildEnv = {
      ...process.env,
      // Also set as environment variables (backup method for build.gradle)
      REACT_NATIVE_PACKAGER_HOSTNAME: localIP || '',
      REACT_NATIVE_PACKAGER_PORT: PORT.toString()
    };
    
    const buildProcess = spawn(gradlewCmd, gradleArgs, {
      cwd: ANDROID_DIR,
      stdio: 'inherit',
      shell: os.platform() === 'win32', // Only use shell on Windows
      env: buildEnv
    });

    buildProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error(`\n  ✗ Build failed with exit code ${code}`);
        // Cleanup Metro on build failure
        if (metroProcess) {
          console.log('  → Cleaning up Metro process...');
          metroProcess.kill();
          metroProcess = null;
          // Wait for port to be free
          await sleep(1000);
        }
        process.exit(1);
      }

      // Verify APK was actually built (wait a moment for file system)
      await sleep(1000);
      const debugApkExists = fileExists(APK_DEBUG_PATH);
      const releaseApkExists = fileExists(APK_RELEASE_PATH);
      
      if (!debugApkExists && !releaseApkExists) {
        console.error('\n  ✗ Build completed but APK files not found!');
        console.error('     This might indicate the build didn\'t actually create the APK.');
        console.error('     Check the build output above for errors.\n');
        if (metroProcess) {
          metroProcess.kill();
          metroProcess = null;
        }
        process.exit(1);
      }

      // Phase 5: Output Results
      console.log('\n📱 Phase 5: Build Results');
      console.log('───────────────────────────────────────────────────────────');

      // Calculate relative paths from apps/mobile directory
      const debugApkRelative = path.relative(PROJECT_ROOT, APK_DEBUG_PATH);
      const releaseApkRelative = path.relative(PROJECT_ROOT, APK_RELEASE_PATH);

      // Find APK files
      const debugApk = getFileInfo(APK_DEBUG_PATH);
      const releaseApk = getFileInfo(APK_RELEASE_PATH);

      let apkPath = null;
      let apkRelativePath = null;

      if (debugApk.exists) {
        apkPath = APK_DEBUG_PATH;
        apkRelativePath = debugApkRelative;
        console.log('\n  ✓ Debug APK built successfully!');
        console.log(`  📦 Size: ${debugApk.sizeMB} MB`);
        console.log(`  🕒 Modified: ${debugApk.modified.toLocaleString()}`);
      }

      if (releaseApk.exists) {
        apkPath = APK_RELEASE_PATH;
        apkRelativePath = releaseApkRelative;
        console.log('\n  ✓ Release APK built successfully!');
        console.log(`  📦 Size: ${releaseApk.sizeMB} MB`);
        console.log(`  🕒 Modified: ${releaseApk.modified.toLocaleString()}`);
      }

      if (!debugApk.exists && !releaseApk.exists) {
        console.log('\n  ⚠ APK files not found in expected locations');
        console.log('     Check build output above for errors');
        // Cleanup Metro on failure
        if (metroProcess) {
          console.log('  → Cleaning up Metro process...');
          metroProcess.kill();
          metroProcess = null;
        }
        process.exit(1);
      }

      // Make APK location very prominent
      console.log('\n  ═══════════════════════════════════════════════════════');
      console.log('  📍 APK LOCATION (for manual transfer):');
      console.log('  ═══════════════════════════════════════════════════════');
      console.log(`  ${apkPath}`);
      console.log(`\n  Relative path (from project root):`);
      console.log(`  ${apkRelativePath}`);
      console.log('  ═══════════════════════════════════════════════════════\n');

      console.log('  💡 Next Steps:');
      console.log('     • Copy the APK file above to your device');
      console.log('     • Install it on your device (enable "Install from unknown sources" if needed)');
      console.log('     • Metro is running in the background');
      console.log('     • The app will connect to Metro automatically when launched');
      console.log('     • Make code changes and press R, R in Metro to reload');
      console.log('     • To stop Metro, press Ctrl+C in this terminal');

      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('  ✓ Build completed successfully!');
      if (metroReady) {
        console.log('  ✓ Metro is running - app connected for live updates');
      }
      console.log('═══════════════════════════════════════════════════════════\n');
      
      // Keep Metro running - don't exit
      console.log('  Metro is running. Press Ctrl+C to stop.\n');
    });

    buildProcess.on('error', async (error) => {
      console.error(`\n  ✗ Build process error: ${error.message}`);
      // Cleanup Metro on error
      if (metroProcess) {
        console.log('  → Cleaning up Metro process...');
        metroProcess.kill();
        metroProcess = null;
        await sleep(1000);
      }
      process.exit(1);
    });

    // Handle Ctrl+C gracefully
    const cleanupAndExit = () => {
      console.log('\n\n  → Stopping Metro and cleaning up...');
      if (metroProcess) {
        metroProcess.kill();
        metroProcess = null;
      }
      // Also kill any remaining processes on port 8081
      runCommand(`node ${path.join(SCRIPTS_DIR, 'kill-metro.js')}`, { silent: true });
      process.exit(0);
    };

    process.on('SIGINT', cleanupAndExit);
    process.on('SIGTERM', cleanupAndExit);
    
    // Also handle process exit to ensure cleanup
    process.on('exit', () => {
      if (metroProcess) {
        metroProcess.kill();
      }
    });

  } catch (error) {
    console.error(`\n  ✗ Build failed: ${error.message}`);
    // Cleanup Metro on error
    if (metroProcess) {
      console.log('  → Cleaning up Metro process...');
      metroProcess.kill();
      metroProcess = null;
    }
    // Kill any remaining processes
    runCommand(`node ${path.join(SCRIPTS_DIR, 'kill-metro.js')}`, { silent: true });
    process.exit(1);
  }
})();