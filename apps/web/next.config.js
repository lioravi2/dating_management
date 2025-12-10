/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  env: {
    // Build number - set by CI/CD or generated for local dev
    // In GitHub Actions, use: NEXT_PUBLIC_BUILD_NUMBER=${{ github.run_number }}
    // Or use commit SHA: NEXT_PUBLIC_BUILD_NUMBER=${{ github.sha }}
    NEXT_PUBLIC_BUILD_NUMBER: process.env.NEXT_PUBLIC_BUILD_NUMBER || 
      process.env.NEXT_PUBLIC_GITHUB_RUN_NUMBER ||
      `local-${Date.now().toString(36).slice(-8)}`,
  },
}

module.exports = nextConfig

