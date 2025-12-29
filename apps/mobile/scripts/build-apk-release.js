#!/usr/bin/env node

/**
 * Production APK build script - No Metro connection
 * Builds a standalone APK with bundled JavaScript
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SCRIPTS_DIR = __dirname;
const PROJECT_ROOT = path.resolve(SCRIPTS_DIR, '..');
const ANDROID_DIR = path.join(PROJECT_ROOT, 'android');
const APK_RELEASE_PATH = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

console.log('═══════════════════════════════════════════════════════════');
console.log('  Production APK Build - Standalone (No Metro)');
console.log('═══════════════════════════════════════════════════════════\n');

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  // Phase 1: Cleanup (optional)
  console.log('📦 Phase 1: Cleanup');
  console.log('───────────────────────────────────────────────────────────');
  
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

  // Phase 2: Build Release APK
  console.log('🔨 Phase 2: Building Release APK');
  console.log('───────────────────────────────────────────────────────────');
  console.log('  → Building standalone APK (JS bundled, no Metro connection)...\n');

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

  const gradlewCmd = os.platform() === 'win32' ? 'gradlew.bat' : './gradlew';
  const gradleArgs = ['assembleRelease', '--rerun-tasks'];
  
  console.log(`  Executing: ${gradlewCmd} ${gradleArgs.join(' ')}\n`);

  const buildProcess = spawn(gradlewCmd, gradleArgs, {
    cwd: ANDROID_DIR,
    stdio: 'inherit',
    shell: os.platform() === 'win32',
    env: {
      ...process.env,
      // Ensure production build
      NODE_ENV: 'production'
    }
  });

  buildProcess.on('close', async (code) => {
    if (code !== 0) {
      console.error(`\n  ✗ Build failed with exit code ${code}`);
      process.exit(1);
    }

    await sleep(1000);
    const releaseApkExists = fileExists(APK_RELEASE_PATH);
    
    if (!releaseApkExists) {
      console.error('\n  ✗ Build completed but APK file not found!');
      console.error('     Check the build output above for errors.\n');
      process.exit(1);
    }

    // Phase 3: Output Results
    console.log('\n📱 Phase 3: Build Results');
    console.log('───────────────────────────────────────────────────────────');

    const releaseApk = getFileInfo(APK_RELEASE_PATH);
    const apkRelativePath = path.relative(PROJECT_ROOT, APK_RELEASE_PATH);

    console.log('\n  ✓ Release APK built successfully!');
    console.log(`  📦 Size: ${releaseApk.sizeMB} MB`);
    console.log(`  🕒 Modified: ${releaseApk.modified.toLocaleString()}`);

    console.log('\n  ═══════════════════════════════════════════════════════');
    console.log('  📍 APK LOCATION (for manual transfer):');
    console.log('  ═══════════════════════════════════════════════════════');
    console.log(`  ${APK_RELEASE_PATH}`);
    console.log(`\n  Relative path (from project root):`);
    console.log(`  ${apkRelativePath}`);
    console.log('  ═══════════════════════════════════════════════════════\n');

    console.log('  💡 Next Steps:');
    console.log('     • Copy the APK file above to your device');
    console.log('     • Install it on your device (enable "Install from unknown sources" if needed)');
    console.log('     • The app is standalone - no Metro connection needed');
    console.log('     • The app will connect only to your production server');
    console.log('     • To make code changes, rebuild the APK');

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  ✓ Production build completed successfully!');
    console.log('  ✓ APK is standalone - no Metro connection required');
    console.log('═══════════════════════════════════════════════════════════\n');
  });

  buildProcess.on('error', (error) => {
    console.error(`\n  ✗ Build process error: ${error.message}`);
    process.exit(1);
  });
})();


