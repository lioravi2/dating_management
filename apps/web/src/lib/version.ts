// App version - update this when you make significant changes
export const APP_VERSION = '0.6.0';

// Build number - set via environment variable
// Priority:
// 1. NEXT_PUBLIC_BUILD_NUMBER (manually set)
// 2. Vercel's VERCEL_GIT_COMMIT_SHA (shortened to 7 chars)
// 3. GitHub Actions run number
// 4. Local dev fallback
export const BUILD_NUMBER = 
  process.env.NEXT_PUBLIC_BUILD_NUMBER || 
  (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA 
    ? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.substring(0, 7)
    : null) ||
  process.env.NEXT_PUBLIC_GITHUB_RUN_NUMBER ||
  'dev';

