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
  const apiKey = process.env.AMPLITUDE_API_KEY || process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

  if (!apiKey) {
    console.warn('Amplitude API key not found. Cannot fetch experiment variant.');
    return undefined;
  }

  try {
    // Use Amplitude Experiment API (vardata endpoint)
    // Documentation: https://amplitude.com/docs/experiment-home
    const response = await fetch('https://api2.amplitude.com/v1/vardata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${apiKey}`,
      },
      body: JSON.stringify({
        user_id: userId,
        user_properties: userProperties || {},
        flag_keys: [flagKey],
      }),
    });

    if (!response.ok) {
      console.error(`Amplitude Experiment API error: ${response.status} ${response.statusText}`);
      return undefined;
    }

    const data = await response.json();

    // Extract variant from response
    const flag = data.flags?.[flagKey];
    if (!flag) {
      return undefined;
    }

    return {
      key: flag.key || flagKey,
      value: flag.value,
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
  const apiKey = process.env.AMPLITUDE_API_KEY || process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

  if (!apiKey) {
    console.warn('Amplitude API key not found. Cannot fetch experiment variants.');
    return {};
  }

  if (flagKeys.length === 0) {
    return {};
  }

  try {
    // Use Amplitude Experiment API (vardata endpoint)
    const response = await fetch('https://api2.amplitude.com/v1/vardata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${apiKey}`,
      },
      body: JSON.stringify({
        user_id: userId,
        user_properties: userProperties || {},
        flag_keys: flagKeys,
      }),
    });

    if (!response.ok) {
      console.error(`Amplitude Experiment API error: ${response.status} ${response.statusText}`);
      return {};
    }

    const data = await response.json();

    // Transform response to our format
    const result: Record<string, Variant> = {};
    const flags = data.flags || {};

    flagKeys.forEach((flagKey) => {
      const flag = flags[flagKey];
      if (flag) {
        result[flagKey] = {
          key: flag.key || flagKey,
          value: flag.value,
        };
      }
    });

    return result;
  } catch (error) {
    console.error('Failed to get variants:', error);
    return {};
  }
}
