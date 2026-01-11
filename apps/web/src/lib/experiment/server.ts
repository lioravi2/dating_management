/**
 * Server-side utilities for Amplitude Experiment
 * Uses Amplitude Experiment API for server-side flag fetching
 */

/**
 * Variant type returned from Amplitude Experiment API
 */
export interface Variant {
  key: string;
  value: any;
}

/**
 * Get variant for a feature flag or experiment (server-side)
 * Uses Amplitude Experiment API to fetch flags server-side
 * 
 * @param flagKey - The feature flag or experiment key
 * @param userId - Supabase user ID (session.user.id) - required for authenticated users
 * @param userProperties - Optional user properties (non-PII only, e.g., account_type, subscription_status)
 * @returns Variant object with key and value, or undefined if not found
 */
export async function getVariant(
  flagKey: string,
  userId: string,
  userProperties?: Record<string, any>
): Promise<Variant | undefined> {
  // Use server deployment key (prefixed with "server-")
  // This is different from the Analytics API key
  const apiKey = process.env.AMPLITUDE_EXPERIMENT_SERVER_KEY || process.env.AMPLITUDE_EXPERIMENT_API_KEY;

  if (!apiKey) {
    console.warn('Amplitude Experiment server deployment key not found. Cannot fetch experiment variant.');
    console.warn('Please set AMPLITUDE_EXPERIMENT_SERVER_KEY with a server- prefixed deployment key.');
    return undefined;
  }

  try {
    // Use Amplitude Experiment API (vardata endpoint)
    // Documentation: https://amplitude.com/docs/experiment-home
    // API uses GET with query parameters
    const params = new URLSearchParams({
      user_id: userId,
      flag_keys: flagKey,
    });

    // Add user properties to context if provided
    if (userProperties && Object.keys(userProperties).length > 0) {
      params.append('context', JSON.stringify({ user_properties: userProperties }));
    }

    const response = await fetch(`https://api2.amplitude.com/v1/vardata?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Api-Key ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error(`Amplitude Experiment API error: ${response.status} ${response.statusText}`);
      return undefined;
    }

    const data = await response.json();

    // Variants are returned at root level: {flagKey: {key, payload}}
    const variant = data[flagKey];
    if (!variant || !variant.key) {
      return undefined;
    }

    // API returns key (variant key) and payload (variant data)
    return {
      key: variant.key,
      value: variant.payload !== undefined ? variant.payload : variant.key,
    };
  } catch (error) {
    console.error(`Failed to get variant for flag "${flagKey}":`, error);
    return undefined;
  }
}

/**
 * Get multiple variants for feature flags or experiments (server-side)
 * 
 * @param flagKeys - Array of feature flag or experiment keys
 * @param userId - Supabase user ID (session.user.id) - required for authenticated users
 * @param userProperties - Optional user properties (non-PII only)
 * @returns Object mapping flag keys to variant objects
 */
export async function getVariants(
  flagKeys: string[],
  userId: string,
  userProperties?: Record<string, any>
): Promise<Record<string, Variant>> {
  // Use server deployment key (prefixed with "server-")
  // This is different from the Analytics API key
  const apiKey = process.env.AMPLITUDE_EXPERIMENT_SERVER_KEY || process.env.AMPLITUDE_EXPERIMENT_API_KEY;

  if (!apiKey) {
    console.warn('Amplitude Experiment server deployment key not found. Cannot fetch experiment variants.');
    console.warn('Please set AMPLITUDE_EXPERIMENT_SERVER_KEY with a server- prefixed deployment key.');
    return {};
  }

  if (flagKeys.length === 0) {
    return {};
  }

  try {
    // Use Amplitude Experiment API (vardata endpoint)
    // API uses GET with query parameters
    const params = new URLSearchParams({
      user_id: userId,
      flag_keys: flagKeys.join(','),
    });

    // Add user properties to context if provided
    if (userProperties && Object.keys(userProperties).length > 0) {
      params.append('context', JSON.stringify({ user_properties: userProperties }));
    }

    const response = await fetch(`https://api2.amplitude.com/v1/vardata?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Api-Key ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error(`Amplitude Experiment API error: ${response.status} ${response.statusText}`);
      return {};
    }

    const data = await response.json();

    // Variants are returned at root level: {flagKey: {key, payload}}
    const result: Record<string, Variant> = {};

    flagKeys.forEach((flagKey) => {
      const variant = data[flagKey];
      if (variant && variant.key) {
        // API returns key (variant key) and payload (variant data)
        result[flagKey] = {
          key: variant.key,
          value: variant.payload !== undefined ? variant.payload : variant.key,
        };
      }
    });

    return result;
  } catch (error) {
    console.error('Failed to get variants:', error);
    return {};
  }
}
