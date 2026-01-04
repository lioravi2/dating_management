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
    // Add alias for shared package
    config.resolve.alias = {
      ...config.resolve.alias,
      '@dating-app/shared': require('path').resolve(__dirname, '../../packages/shared'),
    };
    
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
        buffer: false,
        process: false,
      };
      // Ignore Node.js-only modules that face-api.js/node-fetch try to use in browser
      // This prevents webpack from trying to bundle Node.js-only modules for the browser
      config.plugins = config.plugins || [];
      
      // Ignore encoding module completely (required by node-fetch, but not needed in browser)
      // face-api.js will use browser's native fetch API instead of node-fetch
      // Using checkResource to catch all cases where encoding is requested
      config.plugins.push(
        new webpack.IgnorePlugin({
          checkResource(resource, context) {
            // Ignore encoding module when requested from node-fetch or anywhere else
            if (resource === 'encoding') {
              return true;
            }
            return false;
          },
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

