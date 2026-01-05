/**
 * UTM parameter extraction and normalization utilities
 * Used for multi-touch attribution tracking in Amplitude analytics
 */

import { environment } from '@/lib/environment';

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

/**
 * Normalize a UTM parameter value
 * - Converts to lowercase
 * - Trims whitespace
 * - Returns undefined for empty strings
 * 
 * @param value - Raw UTM parameter value
 * @returns Normalized value or undefined
 */
function normalizeUtmValue(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Extract UTM parameters from a URL query string
 * Returns normalized values (lowercase, trimmed) or undefined if not present
 * 
 * @param url - Full URL or query string to extract UTM parameters from
 * @returns Object with utm_source, utm_medium, utm_campaign, utm_term, utm_content (undefined if not present)
 * 
 * @example
 * ```ts
 * const params = extractUtmParams('https://example.com?utm_source=google&utm_medium=cpc');
 * // Returns: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: undefined, ... }
 * ```
 */
export function extractUtmParams(url: string): UtmParams {
  try {
    // Handle both full URLs and query strings
    let searchParams: URLSearchParams;
    
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
      // Full URL - extract query string
      const urlObj = new URL(url);
      searchParams = urlObj.searchParams;
    } else if (url.startsWith('?')) {
      // Query string starting with ?
      searchParams = new URLSearchParams(url);
    } else {
      // Query string without ?
      searchParams = new URLSearchParams(`?${url}`);
    }

    return {
      utm_source: normalizeUtmValue(searchParams.get('utm_source')),
      utm_medium: normalizeUtmValue(searchParams.get('utm_medium')),
      utm_campaign: normalizeUtmValue(searchParams.get('utm_campaign')),
      utm_term: normalizeUtmValue(searchParams.get('utm_term')),
      utm_content: normalizeUtmValue(searchParams.get('utm_content')),
    };
  } catch (error) {
    // If URL parsing fails, return empty object
    console.warn('Failed to extract UTM parameters from URL:', error);
    return {};
  }
}

/**
 * Extract UTM parameters from current page URL (client-side only)
 * Uses environment helper to maintain cross-platform compatibility
 * 
 * @returns Object with UTM parameters or empty object if not available
 */
export function extractUtmParamsFromWindow(): UtmParams {
  // Use environment helper instead of direct window.location access
  // This maintains compatibility with Android migration abstraction
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const currentUrl = environment.getCurrentUrl();
    
    if (!currentUrl) {
      return {};
    }
    
    return extractUtmParams(currentUrl);
  } catch (error) {
    // Fallback: try environment helper again (it might have been a transient error)
    // This should not happen in normal operation, but provides a safety net
    console.warn('Failed to use environment helper, retrying:', error);
    try {
      const currentUrl = environment.getCurrentUrl();
      if (currentUrl) {
        return extractUtmParams(currentUrl);
      }
    } catch (retryError) {
      console.error('Environment helper failed on retry, returning empty UTM params:', retryError);
    }
    return {};
  }
}

