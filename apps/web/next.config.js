/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  env: {
    // Build number - set by CI/CD or generated for local dev
    // Vercel automatically provides VERCEL_GIT_COMMIT_SHA
    // Priority: 1. Manual NEXT_PUBLIC_BUILD_NUMBER, 2. Vercel commit SHA, 3. GitHub Actions run number, 4. Local fallback
    NEXT_PUBLIC_BUILD_NUMBER: process.env.NEXT_PUBLIC_BUILD_NUMBER || 
      (process.env.VERCEL_GIT_COMMIT_SHA 
        ? process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7)
        : null) ||
      process.env.NEXT_PUBLIC_GITHUB_RUN_NUMBER ||
      `local-${Date.now().toString(36).slice(-8)}`,
  },
}

module.exports = nextConfig

