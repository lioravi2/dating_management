'use client';

import { initialize, ExperimentClient, Variant } from '@amplitude/experiment-js-client';

// Initialize Experiment SDK
let experimentClient: ExperimentClient | null = null;
let isInitialized = false;

/**
 * Initialize Amplitude Experiment SDK
 * Should be called after Analytics SDK initialization
 * Uses the same API key as Analytics SDK
 */
export function initExperiment() {
  if (isInitialized) {
    return;
  }

  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

  if (!apiKey) {
    console.warn('Amplitude API key not found. Experiment SDK will not be initialized.');
    return;
  }

  try {
    // Initialize Experiment SDK
    experimentClient = initialize(apiKey, {
      // Fetch flags on initialization
      fetchOnStart: true,
      // User context will be set via setUserId()
    });

    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Amplitude Experiment SDK:', error);
  }
}

/**
 * Set user ID in Experiment SDK
 * CRITICAL: Only use Supabase user ID - DO NOT send email, full_name, or other PII
 * 
 * @param userId - Supabase user ID (session.user.id)
 */
export function setUserId(userId: string | undefined) {
  if (!experimentClient) {
    console.warn('Experiment SDK not initialized. Call initExperiment() first.');
    return;
  }

  try {
    if (userId) {
      // Set user context for experiment evaluation
      experimentClient.setUser({
        user_id: userId,
      });
    } else {
      // Clear user context on logout
      experimentClient.setUser({});
    }
  } catch (error) {
    console.error('Failed to set user ID in Experiment SDK:', error);
  }
}

/**
 * Get variant for a feature flag or experiment
 * 
 * @param flagKey - The feature flag or experiment key
 * @param userId - Optional user ID (if not set, uses current user from setUserId)
 * @returns Variant object with key and value, or undefined if not found
 */
export async function getVariant(
  flagKey: string,
  userId?: string
): Promise<{ key: string; value: any } | undefined> {
  if (!experimentClient) {
    console.warn('Experiment SDK not initialized. Call initExperiment() first.');
    return undefined;
  }

  try {
    // Set user context if provided and fetch variants
    if (userId) {
      await experimentClient.fetch({
        user_id: userId,
      });
    } else {
      // Fetch variants for current user
      await experimentClient.fetch();
    }
    
    // Get the variant for the requested flag (synchronous after fetch)
    const variant = experimentClient.variant(flagKey);
    
    if (!variant || variant.value === undefined) {
      return undefined;
    }

    return {
      key: variant.key || flagKey,
      value: variant.value,
    };
  } catch (error) {
    console.error(`Failed to get variant for flag "${flagKey}":`, error);
    return undefined;
  }
}

/**
 * Fetch all variants for the current user
 * 
 * @param userId - Optional user ID (if not set, uses current user from setUserId)
 * @returns Object mapping flag keys to variant objects
 */
export async function fetchVariants(
  userId?: string
): Promise<Record<string, { key: string; value: any }>> {
  if (!experimentClient) {
    console.warn('Experiment SDK not initialized. Call initExperiment() first.');
    return {};
  }

  try {
    // Set user context if provided and fetch variants
    if (userId) {
      await experimentClient.fetch({
        user_id: userId,
      });
    } else {
      // Fetch variants for current user
      await experimentClient.fetch();
    }
    
    // Get all variants (synchronous after fetch)
    const variants = experimentClient.all();
    
    // Transform to our format
    const result: Record<string, { key: string; value: any }> = {};
    Object.entries(variants).forEach(([flagKey, variant]) => {
      if (variant && variant.value !== undefined) {
        result[flagKey] = {
          key: variant.key || flagKey,
          value: variant.value,
        };
      }
    });

    return result;
  } catch (error) {
    console.error('Failed to fetch variants:', error);
    return {};
  }
}

/**
 * Track experiment exposure
 * This automatically tracks exposure events to Amplitude Analytics
 * 
 * @param flagKey - The feature flag or experiment key
 */
export function exposure(flagKey: string) {
  if (!experimentClient) {
    console.warn('Experiment SDK not initialized. Call initExperiment() first.');
    return;
  }

  try {
    // Track exposure using Experiment SDK
    // This automatically sends an exposure event to Amplitude Analytics
    experimentClient.exposure(flagKey);
  } catch (error) {
    console.error(`Failed to track exposure for flag "${flagKey}":`, error);
  }
}

/**
 * Check if Experiment SDK is initialized
 * 
 * @returns true if Experiment SDK is initialized, false otherwise
 */
export function isExperimentInitialized(): boolean {
  return isInitialized && experimentClient !== null;
}
