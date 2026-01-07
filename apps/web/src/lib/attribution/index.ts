/**
 * Attribution tracking utilities for landing page → app install journey
 * Uses simplified deep linking approach (localStorage/cookie with expiration)
 */

/**
 * Attribution data structure
 */
export interface AttributionData {
  visitId: string; // Unique identifier for this visit
  timestamp: number; // When the visit occurred
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
}

const ATTRIBUTION_STORAGE_KEY = 'dating_app_attribution';
const ATTRIBUTION_EXPIRY_DAYS = 30; // Attribution data expires after 30 days

/**
 * Store attribution data in localStorage
 * This is called when a user visits the landing page
 * 
 * @param utmParams - UTM parameters from the URL
 * @param referrer - Referrer URL (optional)
 */
export function storeAttributionData(
  utmParams?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
  },
  referrer?: string
): AttributionData {
  if (typeof window === 'undefined') {
    // Server-side rendering - return empty data
    return {
      visitId: '',
      timestamp: Date.now(),
    };
  }

  try {
    // Generate unique visit ID
    const visitId = `visit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = Date.now();

    const attributionData: AttributionData = {
      visitId,
      timestamp,
      ...utmParams,
      referrer: referrer || document.referrer || undefined,
    };

    // Store in localStorage
    localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attributionData));

    return attributionData;
  } catch (error) {
    console.error('Failed to store attribution data:', error);
    return {
      visitId: '',
      timestamp: Date.now(),
    };
  }
}

/**
 * Retrieve attribution data from localStorage
 * Returns null if data doesn't exist or has expired
 * 
 * @returns AttributionData or null
 */
export function getAttributionData(): AttributionData | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const attributionData: AttributionData = JSON.parse(stored);

    // Check if data has expired
    const expiryTime = attributionData.timestamp + (ATTRIBUTION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    if (Date.now() > expiryTime) {
      // Data expired - remove it
      localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
      return null;
    }

    return attributionData;
  } catch (error) {
    console.error('Failed to retrieve attribution data:', error);
    return null;
  }
}

/**
 * Clear attribution data from localStorage
 * Called after attribution has been successfully sent to the app
 */
export function clearAttributionData(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear attribution data:', error);
  }
}

/**
 * Generate app store URL with attribution data as query parameters
 * This URL can be used in deep links or app store redirects
 * 
 * @param baseUrl - Base URL for the app (e.g., "datingapp://install" or app store URL)
 * @param attributionData - Attribution data to include
 * @returns URL with attribution parameters
 */
export function generateAppStoreUrlWithAttribution(
  baseUrl: string,
  attributionData: AttributionData
): string {
  try {
    const url = new URL(baseUrl);
    
    // Add attribution parameters
    url.searchParams.set('visit_id', attributionData.visitId);
    url.searchParams.set('timestamp', attributionData.timestamp.toString());
    
    if (attributionData.utm_source) {
      url.searchParams.set('utm_source', attributionData.utm_source);
    }
    if (attributionData.utm_medium) {
      url.searchParams.set('utm_medium', attributionData.utm_medium);
    }
    if (attributionData.utm_campaign) {
      url.searchParams.set('utm_campaign', attributionData.utm_campaign);
    }
    if (attributionData.utm_term) {
      url.searchParams.set('utm_term', attributionData.utm_term);
    }
    if (attributionData.utm_content) {
      url.searchParams.set('utm_content', attributionData.utm_content);
    }
    if (attributionData.referrer) {
      url.searchParams.set('referrer', attributionData.referrer);
    }

    return url.toString();
  } catch (error) {
    // If baseUrl is not a valid URL (e.g., custom scheme), construct manually
    const params = new URLSearchParams();
    params.set('visit_id', attributionData.visitId);
    params.set('timestamp', attributionData.timestamp.toString());
    
    if (attributionData.utm_source) params.set('utm_source', attributionData.utm_source);
    if (attributionData.utm_medium) params.set('utm_medium', attributionData.utm_medium);
    if (attributionData.utm_campaign) params.set('utm_campaign', attributionData.utm_campaign);
    if (attributionData.utm_term) params.set('utm_term', attributionData.utm_term);
    if (attributionData.utm_content) params.set('utm_content', attributionData.utm_content);
    if (attributionData.referrer) params.set('referrer', attributionData.referrer);

    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${params.toString()}`;
  }
}


