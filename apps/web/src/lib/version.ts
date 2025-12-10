// App version - update this when you make significant changes
export const APP_VERSION = '0.5.1';

// Build number - set via environment variable
// In CI/CD (GitHub Actions), set NEXT_PUBLIC_BUILD_NUMBER env var
// For local dev, next.config.js generates a timestamp-based build number
export const BUILD_NUMBER = 
  process.env.NEXT_PUBLIC_BUILD_NUMBER || 
  process.env.NEXT_PUBLIC_GITHUB_RUN_NUMBER ||
  'dev';

