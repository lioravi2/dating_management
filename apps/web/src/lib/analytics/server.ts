import { init, NodeClient } from '@amplitude/node';
import { Identify } from '@amplitude/identify';

// Initialize Amplitude SDK
let client: NodeClient | null = null;

/**
 * Check if debug logging is enabled
 * Debug logs are enabled in development or when AMPLITUDE_DEBUG env var is set
 */
function isDebugEnabled(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.AMPLITUDE_DEBUG === 'true';
}

/**
 * Debug log helper - only logs when debug is enabled
 */
function debugLog(...args: any[]): void {
  if (isDebugEnabled()) {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Check if Amplitude client is initialized
 * Useful for debugging initialization issues
 */
export function isAmplitudeInitialized(): boolean {
  return client !== null;
}

/**
 * Initialize Amplitude analytics server SDK
 * Should be called once on server startup
 */
export function initAmplitude() {
  if (client) {
    return;
  }

  const apiKey = process.env.AMPLITUDE_API_KEY;

  // Debug logging for environment variables
  debugLog('AMPLITUDE_API_KEY exists:', !!apiKey);
  debugLog('AMPLITUDE_API_KEY length:', apiKey?.length || 0);
  debugLog('Environment check:', {
    hasAmplitudeKey: !!apiKey,
    nodeEnv: process.env.NODE_ENV
  });

  if (!apiKey) {
    console.warn('Amplitude API key not found. Server-side analytics will not be initialized.');
    return;
  }

  try {
    // Initialize Amplitude Node SDK
    debugLog('Initializing Amplitude server SDK...');
    client = init(apiKey);
    debugLog('Amplitude server SDK initialized successfully');
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
  // Always log tracking attempts (not just in debug mode)
  console.log(`[Amplitude] track() called:`, {
    eventName,
    userId,
    hasUserId: !!userId,
    userIdLength: userId?.length || 0,
    hasEventProperties: !!eventProperties,
    eventPropertiesKeys: eventProperties ? Object.keys(eventProperties) : []
  });

  // Debug logging for tracking function call
  debugLog('Tracking event:', {
    eventName,
    userId,
    hasUserId: !!userId,
    userIdLength: userId?.length || 0,
    hasEventProperties: !!eventProperties,
    eventPropertiesKeys: eventProperties ? Object.keys(eventProperties) : []
  });

  if (!client) {
    // Try to initialize if not already done
    console.log('[Amplitude] Client not initialized, attempting initialization...');
    debugLog('Client not initialized, attempting initialization...');
    initAmplitude();
    if (!client) {
      const error = new Error(`[Amplitude] Amplitude not initialized. Server-side analytics will not track events.`);
      console.warn(error.message);
      throw error;
    }
    console.log('[Amplitude] Client initialized successfully');
  }

  if (!userId) {
    const error = new Error(`[Amplitude] Cannot track event "${eventName}" without userId`);
    console.warn(error.message);
    throw error;
  }

  try {
    // Build event object - use object literal instead of BaseEvent type
    // BaseEvent is not exported from @amplitude/node, but logEvent accepts the same structure
    const event = {
      event_type: eventName,
      user_id: userId, // Supabase user ID - user properties (including UTM) automatically inherited
      event_properties: eventProperties || {},
    };

    // Always log event object
    console.log(`[Amplitude] Event object:`, JSON.stringify(event, null, 2));
    // Debug logging for event object
    debugLog('Event object:', JSON.stringify(event, null, 2));

    // Track the event and await the result
    console.log(`[Amplitude] Calling client.logEvent() for "${eventName}"...`);
    debugLog('Calling client.logEvent()...');
    await client.logEvent(event);
    console.log(`[Amplitude] logEvent() completed successfully for "${eventName}"`);
    debugLog('logEvent() completed successfully');
    
    // Flush to ensure event is sent immediately (important for serverless environments)
    console.log(`[Amplitude] Calling client.flush() for "${eventName}"...`);
    debugLog('Calling client.flush()...');
    await client.flush();
    console.log(`[Amplitude] Flush completed successfully for "${eventName}"`);
    debugLog('Flush completed successfully');
  } catch (error) {
    console.error(`[Amplitude] Failed to track event "${eventName}":`, error);
    // Log stack trace for debugging
    if (error instanceof Error) {
      console.error(`[Amplitude] Error stack:`, error.stack);
    }
    // Re-throw error so calling code can handle it properly
    // The calling code has try/catch blocks to handle errors gracefully without breaking application flow
    throw error;
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
  debugLog('Auto-initializing Amplitude server SDK...');
  initAmplitude();
  debugLog('Amplitude initialized:', client !== null);
}

