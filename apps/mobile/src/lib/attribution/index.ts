/**
 * Attribution tracking utilities for mobile app
 * Detects first app launch and tracks [App Installed] event with attribution data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { track } from '../analytics';
import { supabase } from '../supabase/client';

const INSTALL_TRACKED_KEY = 'dating_app_install_tracked';
const ATTRIBUTION_DATA_KEY = 'dating_app_attribution_data';

/**
 * Attribution data structure (matches web app structure)
 */
export interface AttributionData {
  visitId?: string;
  timestamp?: number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  install_source?: string; // 'deep_link', 'app_store', 'unknown'
}

/**
 * Parse attribution data from URL query parameters
 * Used when app is opened via deep link with attribution data
 * 
 * @param url - Deep link URL with attribution parameters
 * @returns AttributionData or null
 */
export function parseAttributionFromUrl(url: string): AttributionData | null {
  try {
    // Handle custom scheme URLs (e.g., datingapp://install?visit_id=...)
    let searchParams: URLSearchParams;
    
    if (url.includes('?')) {
      const queryString = url.split('?')[1].split('#')[0];
      searchParams = new URLSearchParams(queryString);
    } else {
      return null;
    }

    const visitId = searchParams.get('visit_id');
    const timestamp = searchParams.get('timestamp');

    if (!visitId) {
      // No attribution data in URL
      return null;
    }

    return {
      visitId,
      timestamp: timestamp ? parseInt(timestamp, 10) : undefined,
      utm_source: searchParams.get('utm_source') || undefined,
      utm_medium: searchParams.get('utm_medium') || undefined,
      utm_campaign: searchParams.get('utm_campaign') || undefined,
      utm_term: searchParams.get('utm_term') || undefined,
      utm_content: searchParams.get('utm_content') || undefined,
      referrer: searchParams.get('referrer') || undefined,
      install_source: 'deep_link',
    };
  } catch (error) {
    console.error('Failed to parse attribution from URL:', error);
    return null;
  }
}

/**
 * Check if app install has already been tracked
 * 
 * @returns true if install was already tracked, false otherwise
 */
export async function isInstallTracked(): Promise<boolean> {
  try {
    const tracked = await AsyncStorage.getItem(INSTALL_TRACKED_KEY);
    return tracked === 'true';
  } catch (error) {
    console.error('Failed to check install tracked status:', error);
    return false;
  }
}

/**
 * Mark app install as tracked
 */
async function markInstallTracked(): Promise<void> {
  try {
    await AsyncStorage.setItem(INSTALL_TRACKED_KEY, 'true');
  } catch (error) {
    console.error('Failed to mark install as tracked:', error);
  }
}

/**
 * Store attribution data for later use
 * 
 * @param attributionData - Attribution data to store
 */
export async function storeAttributionData(attributionData: AttributionData): Promise<void> {
  try {
    await AsyncStorage.setItem(ATTRIBUTION_DATA_KEY, JSON.stringify(attributionData));
  } catch (error) {
    console.error('Failed to store attribution data:', error);
  }
}

/**
 * Retrieve stored attribution data
 * 
 * @returns AttributionData or null
 */
export async function getStoredAttributionData(): Promise<AttributionData | null> {
  try {
    const stored = await AsyncStorage.getItem(ATTRIBUTION_DATA_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as AttributionData;
  } catch (error) {
    console.error('Failed to retrieve stored attribution data:', error);
    return null;
  }
}

/**
 * Track [App Installed] event with attribution data
 * Should be called on first app launch
 * 
 * @param attributionData - Attribution data (optional, will use stored data if not provided)
 */
export async function trackAppInstalled(attributionData?: AttributionData): Promise<void> {
  try {
    // Check if already tracked
    const alreadyTracked = await isInstallTracked();
    if (alreadyTracked) {
      return;
    }

    // Get user ID if authenticated
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    // Use provided attribution data or retrieve stored data
    const finalAttributionData = attributionData || await getStoredAttributionData();

    // Build event properties
    const eventProperties: Record<string, any> = {};

    if (finalAttributionData) {
      if (finalAttributionData.visitId) {
        eventProperties.visit_id = finalAttributionData.visitId;
      }
      if (finalAttributionData.install_source) {
        eventProperties.install_source = finalAttributionData.install_source;
      } else {
        eventProperties.install_source = 'unknown';
      }
      if (finalAttributionData.utm_source) {
        eventProperties.utm_source = finalAttributionData.utm_source;
      }
      if (finalAttributionData.utm_medium) {
        eventProperties.utm_medium = finalAttributionData.utm_medium;
      }
      if (finalAttributionData.utm_campaign) {
        eventProperties.utm_campaign = finalAttributionData.utm_campaign;
      }
      if (finalAttributionData.utm_term) {
        eventProperties.utm_term = finalAttributionData.utm_term;
      }
      if (finalAttributionData.utm_content) {
        eventProperties.utm_content = finalAttributionData.utm_content;
      }
      if (finalAttributionData.referrer) {
        eventProperties.referrer = finalAttributionData.referrer;
      }
    } else {
      eventProperties.install_source = 'unknown';
    }

    // Track the event
    track('[App Installed]', eventProperties);

    // Mark as tracked
    await markInstallTracked();

    console.log('[Attribution] Tracked [App Installed] event with attribution data:', eventProperties);
  } catch (error) {
    console.error('Failed to track app installed event:', error);
  }
}

/**
 * Check for attribution data in initial deep link URL
 * Called on app launch to detect if app was opened via deep link with attribution
 * 
 * @returns AttributionData if found, null otherwise
 */
export async function checkInitialAttribution(): Promise<AttributionData | null> {
  try {
    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      // Check if URL contains attribution data
      const attributionData = parseAttributionFromUrl(initialUrl);
      if (attributionData) {
        // Store for later use
        await storeAttributionData(attributionData);
        return attributionData;
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to check initial attribution:', error);
    return null;
  }
}


