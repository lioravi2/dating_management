#!/usr/bin/env node

/**
 * Standalone APK build script (No Metro)
 * Builds a standalone APK with bundled JavaScript
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SCRIPTS_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPTS_DIR, '..');
const ANDROID_DIR = path.join(PROJECT_ROOT, 'android');
const APK_DEBUG_PATH = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const APK_RELEASE_PATH = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const BUILD_INFO_PATH = path.join(PROJECT_ROOT, 'src', 'lib', 'build-info.ts');

console.log('═══════════════════════════════════════════════════════════');
console.log('  Standalone APK Build Script (No Metro)');
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

// Generate a unique build number (6-digit random number)
function generateBuildNumber() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Write build info to TypeScript file
function writeBuildInfo(buildNumber, buildDate) {
  const content = `// This file is auto-generated during the build process
// Do not edit manually - it will be overwritten on each build

export const BUILD_NUMBER: string = '${buildNumber}';
export const BUILD_DATE: string | undefined = '${buildDate}';
`;
  try {
    fs.writeFileSync(BUILD_INFO_PATH, content, 'utf8');
    console.log(`  ✓ Build info written: ${buildNumber}`);
  } catch (error) {
    console.log(`  ⚠ Could not write build info: ${error.message}`);
  }
}

// Main execution wrapped in async function
(async () => {
  // Phase 1: Cleanup
  console.log('📦 Phase 1: Cleanup');
  console.log('───────────────────────────────────────────────────────────');

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

  // Phase 2: Generate Build Number
  console.log('🔢 Phase 2: Generating Build Number');
  console.log('───────────────────────────────────────────────────────────');
  const buildNumber = generateBuildNumber();
  const buildDate = new Date().toISOString();
  writeBuildInfo(buildNumber, buildDate);
  console.log(`  📦 Build Number: ${buildNumber}\n`);

  // Phase 3: Preparation
  console.log('🔧 Phase 3: Preparation');
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
    }
  }

  // Phase 4: Build
  console.log('🔨 Phase 4: Building APK');
  console.log('───────────────────────────────────────────────────────────');
  console.log('  → Building standalone APK (JavaScript will be bundled into APK)...\n');

  // Verify Android directory and Gradle wrapper exist
  if (!fileExists(ANDROID_DIR)) {
    console.error(`  ✗ Android directory not found: ${ANDROID_DIR}`);
    console.error('     Run "npx expo prebuild" first to generate Android project');
    process.exit(1);
  }

  const gradlewPath = path.join(ANDROID_DIR, os.platform() === 'win32' ? 'gradlew.bat' : 'gradlew');
  if (!fileExists(gradlewPath)) {
    console.error(`  ✗ Gradle wrapper not found: ${gradlewPath}`);
    console.error('     Run "npx expo prebuild" first to generate Android project');
    process.exit(1);
  }

  try {
    // Build the APK using Gradle - this will bundle JavaScript into the APK
    const gradlewCmd = os.platform() === 'win32' ? 'gradlew.bat' : './gradlew';
    const gradleArgs = ['assembleDebug', '--rerun-tasks'];
    
    console.log('  → Executing: Gradle assembleDebug\n');
    
    const buildProcess = spawn(gradlewCmd, gradleArgs, {
      cwd: ANDROID_DIR,
      stdio: 'inherit',
      shell: os.platform() === 'win32', // Only use shell on Windows
      env: process.env
    });

    buildProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error(`\n  ✗ Build failed with exit code ${code}`);
        process.exit(1);
      }

      // Verify APK was actually built (wait a moment for file system)
      await new Promise(resolve => setTimeout(resolve, 1000));
      const debugApkExists = fileExists(APK_DEBUG_PATH);
      const releaseApkExists = fileExists(APK_RELEASE_PATH);
      
      if (!debugApkExists && !releaseApkExists) {
        console.error('\n  ✗ Build completed but APK files not found!');
        console.error('     This might indicate the build didn\'t actually create the APK.');
        console.error('     Check the build output above for errors.\n');
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
        console.log(`  🔢 Build Number: ${buildNumber}`);
      }

      if (releaseApk.exists) {
        apkPath = APK_RELEASE_PATH;
        apkRelativePath = releaseApkRelative;
        console.log('\n  ✓ Release APK built successfully!');
        console.log(`  📦 Size: ${releaseApk.sizeMB} MB`);
        console.log(`  🕒 Modified: ${releaseApk.modified.toLocaleString()}`);
        console.log(`  🔢 Build Number: ${buildNumber}`);
      }

      if (!debugApk.exists && !releaseApk.exists) {
        console.log('\n  ⚠ APK files not found in expected locations');
        console.log('     Check build output above for errors');
        process.exit(1);
      }

      // Make APK location very prominent
      console.log('\n  ═══════════════════════════════════════════════════════');
      console.log('  📍 APK LOCATION (for manual transfer):');
      console.log('  ═══════════════════════════════════════════════════════');
      console.log(`  ${apkPath}`);
      console.log(`\n  Relative path (from project root):`);
      console.log(`  ${apkRelativePath}`);
      console.log('  ═══════════════════════════════════════════════════════');
      console.log('\n  ═══════════════════════════════════════════════════════');
      console.log('  🔢 BUILD NUMBER (check in app dashboard):');
      console.log('  ═══════════════════════════════════════════════════════');
      console.log(`  ${buildNumber}`);
      console.log('  ═══════════════════════════════════════════════════════\n');

      console.log('  💡 Next Steps:');
      console.log('     • Copy the APK file above to your device');
      console.log('     • Install it on your device (enable "Install from unknown sources" if needed)');
      console.log('     • This is a standalone APK - no Metro connection needed');

      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('  ✓ Build completed successfully!');
      console.log('  ✓ Standalone APK ready (JavaScript bundled)');
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
