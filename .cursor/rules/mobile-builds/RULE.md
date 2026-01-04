---
description: Mobile app build requirements: standalone release APK builds with no USB debugging or Metro bundler connection
globs:
  - apps/mobile/**
  - "**/build-apk*.js"
alwaysApply: false
---

# Mobile App Build Requirements

**CRITICAL:** The mobile app is built as a standalone release APK with no development dependencies.

## Build Configuration

- **ONLY use release builds:** `npm run build:apk:release` in `apps/mobile/`
- **NO USB debugging:** Mobile device is NOT connected via USB cable - builds must be transferable as standalone APK files
- **NO Metro bundler connection:** JavaScript code MUST be bundled into the APK during build - the app runs independently without requiring a Metro bundler connection to the development PC
- **Standalone operation:** The built APK must function completely independently - no network connection to development machine required

## Build Process Requirements

- Build scripts MUST generate a unique build number for each release build
- Build number MUST be written to `apps/mobile/src/lib/build-info.ts` during the build process
- Build number MUST be displayed in the app's dashboard screen (see `apps/mobile/src/screens/main/DashboardScreen.tsx`)
- Build number MUST be prominently displayed in the terminal output after successful build completion

## Build Number Display Format

**In Terminal (after build):**
```
════════════════════════════════════════════════════════
  🔢 BUILD NUMBER (check in app dashboard):
  ══════════════════════════════════════════════════════
  [BUILD_NUMBER]
  ══════════════════════════════════════════════════════
```

**In App Dashboard:**
- Build number MUST be visible in the dashboard UI (bottom right corner or similar location)
- Import from `apps/mobile/src/lib/build-info.ts`: `import { BUILD_NUMBER } from '../../lib/build-info';`
- Display format: `{BUILD_NUMBER}` (e.g., "191016")

## Build Script Requirements

Build scripts (`apps/mobile/scripts/build-apk-release.js`) MUST:

1. Generate a unique 6-digit build number
2. Write the build number to `apps/mobile/src/lib/build-info.ts` before bundling
3. Display the build number prominently in terminal output after successful build
4. Include build number in the build results summary section

## 📋 Code Review Checklist

Before submitting mobile build code, verify:

- [ ] Mobile builds use `npm run build:apk:release` only (no debug builds)
- [ ] Mobile build scripts generate and display build numbers correctly
- [ ] No references to USB debugging or Metro bundler connections
- [ ] APK is standalone and doesn't require development machine connection

## 🔍 Common Mistakes to Avoid

1. **Suggesting USB debugging for mobile** - Mobile device is NOT connected via USB
2. **Suggesting Metro bundler for mobile** - Mobile app must be standalone with bundled JS
3. **Forgetting build numbers** - Every release build MUST have a visible build number

## 📚 Reference Documentation

- Mobile Build Scripts: `apps/mobile/scripts/build-apk-release.js`
- Mobile Build Info: `apps/mobile/src/lib/build-info.ts`
- Mobile Dashboard: `apps/mobile/src/screens/main/DashboardScreen.tsx`


