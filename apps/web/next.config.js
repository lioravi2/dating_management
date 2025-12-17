/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'localhost',
      'tpidbrwziqoujspvradj.supabase.co', // Your Supabase project domain
    ],
  },
  webpack: (config, { isServer, webpack }) => {
    // Fix for face-api.js Node.js module warnings
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        encoding: false,
        path: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        url: false,
        util: false,
      };
      // Ignore encoding module when required by node-fetch (used by face-api.js)
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^encoding$/,
          contextRegExp: /node-fetch/,
        })
      );
    }
    return config;
  },
  env: {
    // Build number - set by CI/CD or generated for local dev
    // Vercel automatically provides VERCEL_GIT_COMMIT_SHA
    // Priority: 1. Manual NEXT_PUBLIC_BUILD_NUMBER, 2. Vercel commit SHA, 3. GitHub Actions run number, 4. Static 'dev' for local
    // Note: Using static 'dev' instead of Date.now() to avoid hydration mismatches during hot reloading
    NEXT_PUBLIC_BUILD_NUMBER: process.env.NEXT_PUBLIC_BUILD_NUMBER || 
      (process.env.VERCEL_GIT_COMMIT_SHA 
        ? process.env.VERCEL_GIT_COMMIT_SHA.substring(0, 7)
        : null) ||
      process.env.NEXT_PUBLIC_GITHUB_RUN_NUMBER ||
      'dev', // Static value for local dev to prevent hydration mismatches
  },
}

module.exports = nextConfig

