/**
 * Metro Bundler Configuration
 * DISABLED - Metro is not used in this app
 * All functions are no-ops to prevent any Metro connection attempts
 */

/**
 * Configure Metro bundler debug server host programmatically
 * DISABLED - Always returns false
 */
export async function configureMetroHost(host: string): Promise<boolean> {
  // Metro is disabled - do nothing
  return false;
}

/**
 * Get stored Metro host
 * DISABLED - Always returns null
 */
export async function getMetroHost(): Promise<string | null> {
  // Metro is disabled - do nothing
  return null;
}

/**
 * Initialize Metro configuration on app startup
 * DISABLED - Does nothing
 */
export async function initMetroConfig(): Promise<void> {
  // Metro is disabled - do nothing
  return;
}

/**
 * Set Metro host manually (for use with setup script or manual configuration)
 * DISABLED - Always returns false
 */
export async function setMetroHost(ip: string): Promise<boolean> {
  // Metro is disabled - do nothing
  return false;
}

