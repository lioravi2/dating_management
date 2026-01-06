import { init, NodeClient } from '@amplitude/node';
import { Identify } from '@amplitude/identify';

// Initialize Amplitude SDK
let client: NodeClient | null = null;

/**
 * Initialize Amplitude analytics server SDK
 * Should be called once on server startup
 */
export function initAmplitude() {
  if (client) {
    return;
  }

  const apiKey = process.env.AMPLITUDE_API_KEY;

  if (!apiKey) {
    console.warn('Amplitude API key not found. Server-side analytics will not be initialized.');
    return;
  }

  try {
    // Initialize Amplitude Node SDK
    client = init(apiKey);
  } catch (error) {
    console.error('Failed to initialize Amplitude server SDK:', error);
  }
}

/**
 * Track an event on the server side
 * CRITICAL: Only use Supabase user ID - DO NOT send email, full_name, or other PII
 * 
 * @param eventName - Name of the event (e.g., "[User Registered]", "[Partner Added]")
 * @param userId - Supabase user ID (session.user.id) - required when user is authenticated
 * @param eventProperties - Optional event properties (DO NOT include PII or UTM params)
 * @returns Promise that resolves when event is sent (or rejects if there's an error)
 * 
 * Note: UTM parameters are automatically inherited from user properties set client-side.
 * No need to include UTM params in event properties.
 */
export async function track(
  eventName: string,
  userId: string | undefined,
  eventProperties?: Record<string, any>
): Promise<void> {
  if (!client) {
    // Try to initialize if not already done
    initAmplitude();
    if (!client) {
      console.warn('Amplitude not initialized. Server-side analytics will not track events.');
      return;
    }
  }

  if (!userId) {
    console.warn(`[Amplitude] Cannot track event "${eventName}" without userId`);
    return;
  }

  try {
    // Build event object - use object literal instead of BaseEvent type
    // BaseEvent is not exported from @amplitude/node, but logEvent accepts the same structure
    const event = {
      event_type: eventName,
      user_id: userId, // Supabase user ID - user properties (including UTM) automatically inherited
      event_properties: eventProperties || {},
    };

    // Track the event and await the result
    await client.logEvent(event);
  } catch (error) {
    console.error(`[Amplitude] Failed to track event "${eventName}":`, error);
    // Don't throw - analytics failures shouldn't break application flow
  }
}

/**
 * Log an event (alias for track)
 * 
 * @param eventName - Name of the event
 * @param userId - Supabase user ID (required when user is authenticated)
 * @param eventProperties - Optional event properties (DO NOT include PII or UTM params)
 * @returns Promise that resolves when event is sent (or rejects if there's an error)
 */
export async function logEvent(
  eventName: string,
  userId: string | undefined,
  eventProperties?: Record<string, any>
): Promise<void> {
  return track(eventName, userId, eventProperties);
}

/**
 * Set user properties on the server side
 * CRITICAL: DO NOT set email, full_name, or other PII as user properties
 * 
 * @param userId - Supabase user ID (required)
 * @param userProperties - User properties to set (e.g., { account_type: "pro", subscription_status: "active" })
 * @returns Promise that resolves when properties are set (or rejects if there's an error)
 */
export async function setUserProperties(
  userId: string,
  userProperties: Record<string, any>
): Promise<void> {
  if (!client) {
    initAmplitude();
    if (!client) {
      console.warn('Amplitude not initialized. Cannot set user properties.');
      return;
    }
  }

  try {
    // Create Identify instance and set properties
    const identify = new Identify();
    
    // Set each property
    Object.entries(userProperties).forEach(([key, value]) => {
      identify.set(key, value);
    });

    // Set user properties (deviceId is null for server-side) and await the result
    await client.identify(userId, null, identify);
  } catch (error) {
    console.error(`[Amplitude] Failed to set user properties for user "${userId}":`, error);
    // Don't throw - analytics failures shouldn't break application flow
  }
}

// Auto-initialize on module load (for server-side usage)
if (typeof window === 'undefined') {
  // Only initialize on server side
  initAmplitude();
}

