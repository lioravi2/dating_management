---
description: Build number visibility and summary format requirements for web and mobile app releases
alwaysApply: true
---

# Build Number and Version Publishing Summary Format

**REQUIRED:** When a version is published (code is committed and pushed, or a build is deployed), the summary MUST include build information prominently.

## Web App Build Summary Format

**REQUIRED:** When a web app version is published (committed and pushed, or deployed to Vercel), the first line of the summary MUST include:

**Format:**
- Build status (success/failure)
- Build number (from `BUILD_NUMBER` in `apps/web/src/lib/version.ts`)
- Build timestamp or commit hash if available
- Deployment platform (Vercel, local, etc.) if applicable

**Example:**
```
✅ Build successful - Build #abc1234 - Published to Vercel at 12:45:23 UTC (commit: abc1234)
[Rest of summary...]
```

**OR:**

```
❌ Build failed - Build #dev - Vercel deployment error at 12:45:23 UTC
[Error details and rest of summary...]
```

## Mobile App Build Summary Format

**REQUIRED:** When a mobile app release build completes (`npm run build:apk:release`), the summary MUST include:

**Format:**
- Build status (success/failure)
- Build number (the 6-digit number generated during build)
- APK file location
- Build number MUST be displayed in a clearly marked section

**Example:**
```
✅ Mobile Release Build successful - Build #191016
📦 APK: android\app\build\outputs\apk\release\app-release.apk
🔢 Build Number: 191016 (visible in app dashboard)
[Rest of summary...]
```

**Terminal Output Requirements:**
- Build scripts MUST display build number in a clearly marked section after successful build
- Format should match the example shown in terminal output (lines 1001-1004 in build script output)
- Build number MUST be displayed both inline with build results AND in a dedicated section

## Build Number Visibility Requirements

### Web App
- Build number MUST be visible in the web app UI (via `VersionFooter` component showing `v{APP_VERSION} (build {BUILD_NUMBER})`)
- Build number is sourced from `apps/web/src/lib/version.ts`

### Mobile App
- Build number MUST be visible in the mobile app dashboard (bottom right corner or similar)
- Build number is sourced from `apps/mobile/src/lib/build-info.ts`
- Build number is generated during build process and written to `build-info.ts` before bundling

## 📚 Reference Files

- Web version: `apps/web/src/lib/version.ts`
- Web footer: `apps/web/src/components/VersionFooter.tsx`
- Mobile build info: `apps/mobile/src/lib/build-info.ts`
- Mobile dashboard: `apps/mobile/src/screens/main/DashboardScreen.tsx`

This ensures immediate visibility of build status and build numbers in conversation summaries and in the applications themselves.


