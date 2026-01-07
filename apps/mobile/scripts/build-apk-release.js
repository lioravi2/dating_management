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
const BUILD_INFO_PATH = path.join(PROJECT_ROOT, 'src', 'lib', 'build-info.ts');

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

// Load environment variables from .env file if it exists
function loadEnvFile() {
  const envPath = path.join(PROJECT_ROOT, '.env');
  const envLocalPath = path.join(PROJECT_ROOT, '.env.local');
  
  // Try .env.local first, then .env
  const envFile = fileExists(envLocalPath) ? envLocalPath : 
                  fileExists(envPath) ? envPath : null;
  
  if (!envFile) {
    return {};
  }
  
  try {
    const envContent = fs.readFileSync(envFile, 'utf8');
    const envVars = {};
    
    // Simple .env parser (handles basic KEY=VALUE format)
    envContent.split('\n').forEach(line => {
      line = line.trim();
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) {
        return;
      }
      
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        envVars[key] = value;
      }
    });
    
    console.log(`  ✓ Loaded environment variables from ${path.basename(envFile)}`);
    return envVars;
  } catch (error) {
    console.log(`  ⚠ Could not load .env file: ${error.message}`);
    return {};
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

(async () => {
  // Phase 0: Load Environment Variables
  console.log('🔧 Phase 0: Environment Configuration');
  console.log('───────────────────────────────────────────────────────────');
  const envVars = loadEnvFile();
  
  // Merge .env variables into process.env (don't override existing)
  Object.keys(envVars).forEach(key => {
    if (!process.env[key]) {
      process.env[key] = envVars[key];
    }
  });
  
  // Check for required Amplitude API key
  const amplitudeApiKey = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;
  if (!amplitudeApiKey) {
    console.log('  ⚠ WARNING: EXPO_PUBLIC_AMPLITUDE_API_KEY is not set!');
    console.log('     Amplitude analytics will NOT work in this build.');
    console.log('     To fix:');
    console.log('     1. Create a .env file in apps/mobile/');
    console.log('     2. Add: EXPO_PUBLIC_AMPLITUDE_API_KEY=your_api_key_here');
    console.log('     3. Or set it as an environment variable before building');
    console.log('     4. Rebuild the APK\n');
  } else {
    const maskedKey = amplitudeApiKey.length > 8 
      ? `${amplitudeApiKey.substring(0, 4)}...${amplitudeApiKey.substring(amplitudeApiKey.length - 4)}`
      : '****';
    console.log(`  ✓ EXPO_PUBLIC_AMPLITUDE_API_KEY found: ${maskedKey}\n`);
  }

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

  // Phase 2: Generate Build Number
  console.log('🔢 Phase 2: Generating Build Number');
  console.log('───────────────────────────────────────────────────────────');
  const buildNumber = generateBuildNumber();
  const buildDate = new Date().toISOString();
  writeBuildInfo(buildNumber, buildDate);
  console.log(`  📦 Build Number: ${buildNumber}\n`);

  // Phase 3: Build Release APK
  console.log('🔨 Phase 3: Building Release APK');
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

    // Phase 4: Output Results
    console.log('\n📱 Phase 4: Build Results');
    console.log('───────────────────────────────────────────────────────────');

    const releaseApk = getFileInfo(APK_RELEASE_PATH);
    const apkRelativePath = path.relative(PROJECT_ROOT, APK_RELEASE_PATH);

    console.log('\n  ✓ Release APK built successfully!');
    console.log(`  📦 Size: ${releaseApk.sizeMB} MB`);
    console.log(`  🕒 Modified: ${releaseApk.modified.toLocaleString()}`);
    console.log(`  🔢 Build Number: ${buildNumber}`);

    console.log('\n  ═══════════════════════════════════════════════════════');
    console.log('  📍 APK LOCATION (for manual transfer):');
    console.log('  ═══════════════════════════════════════════════════════');
    console.log(`  ${APK_RELEASE_PATH}`);
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



