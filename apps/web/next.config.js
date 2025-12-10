/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  env: {
    // Build number - set by CI/CD or generated for local dev
    // Vercel automatically provides VERCEL_GIT_COMMIT_SHA
    // We expose it as NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA for client-side use
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || null,
    NEXT_PUBLIC_BUILD_NUMBER: process.env.NEXT_PUBLIC_BUILD_NUMBER || 
      process.env.NEXT_PUBLIC_GITHUB_RUN_NUMBER ||
      `local-${Date.now().toString(36).slice(-8)}`,
  },
}

module.exports = nextConfig

