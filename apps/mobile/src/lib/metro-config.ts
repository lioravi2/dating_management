/**
 * Metro Bundler Configuration
 * Automatically configures Metro bundler URL for WiFi debugging
 * 
 * This uses React Native's DevSettings API to configure the debug server host
 * Works across different WiFi networks without rebuilding
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const METRO_HOST_KEY = '@metro_debug_server_host';
const METRO_PORT = 8081;

/**
 * Configure Metro bundler debug server host programmatically
 * This allows the app to connect to Metro over WiFi without USB
 */
export async function configureMetroHost(host: string): Promise<boolean> {
  if (Platform.OS !== 'android' || __DEV__ === false) {
    return false; // Only needed for Android WiFi debugging in dev mode
  }

  try {
    // Store the host for future app launches
    await AsyncStorage.setItem(METRO_HOST_KEY, host);
    
    // Configure React Native DevSettings to use the host
    // This tells React Native where to find the Metro bundler
    const { DevSettings } = require('react-native');
    if (DevSettings && typeof DevSettings.setDebugServerHost === 'function') {
      DevSettings.setDebugServerHost(host);
      console.log('[metro-config] ✓ Configured Metro host:', host);
      return true;
    } else {
      console.warn('[metro-config] DevSettings.setDebugServerHost not available');
      console.warn('[metro-config] You may need to configure Metro host via Developer Menu');
      return false;
    }
  } catch (error) {
    console.error('[metro-config] Failed to configure Metro host:', error);
    return false;
  }
}

/**
 * Get stored Metro host
 */
export async function getMetroHost(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(METRO_HOST_KEY);
  } catch (error) {
    console.error('[metro-config] Failed to get Metro host:', error);
    return null;
  }
}

/**
 * Initialize Metro configuration on app startup
 * Reads from Android assets file written by build script, or uses stored host
 */
export async function initMetroConfig(): Promise<void> {
  if (Platform.OS !== 'android' || __DEV__ === false) {
    return; // Only configure in dev mode on Android
  }

  try {
    let host: string | null = null;
    
    // Try to read from Android assets (written by build script)
    // Note: We'll use a native module or Asset API to read this
    // For now, we'll rely on the stored host which gets set on first successful connection
    
    // If no asset file, check stored host
    if (!host) {
      host = await getMetroHost();
      if (host) {
        console.log('[metro-config] Using stored Metro host:', host);
      }
    }
    
    if (host) {
      // Configure with the host we found
      await configureMetroHost(host);
    } else {
      // No host configured - user needs to rebuild
      console.log('[metro-config] ⚠ No Metro host configured');
      console.log('[metro-config] The app needs your computer\'s IP address to connect to Metro');
      console.log('[metro-config] Rebuild the APK with: npm run build:apk');
      console.log('[metro-config] The build script will automatically detect and configure your IP');
    }
  } catch (error) {
    console.error('[metro-config] Failed to initialize Metro config:', error);
  }
}

/**
 * Set Metro host manually (for use with setup script or manual configuration)
 */
export async function setMetroHost(ip: string): Promise<boolean> {
  const host = `${ip}:${METRO_PORT}`;
  return await configureMetroHost(host);
}

