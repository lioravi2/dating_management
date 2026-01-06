import * as amplitude from '@amplitude/analytics-react-native';
import { supabase } from '../supabase/client';

// Initialize Amplitude SDK
let isInitialized = false;

/**
 * Initialize Amplitude analytics client
 * Should be called once on app load
 */
export function initAmplitude() {
  if (isInitialized) {
    return;
  }

  const apiKey = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;

  if (!apiKey) {
    console.warn('Amplitude API key not found. Analytics will not be initialized.');
    return;
  }

  try {
    // Initialize Amplitude React Native SDK
    // Note: UTM tracking can be configured if landing pages are accessible via mobile web
    amplitude.init(apiKey, {
      defaultTracking: {
        sessions: true,
        // Screen views will be tracked manually via navigation listeners
        screenViews: false,
        appLifecycles: true, // Track app open/close events
      },
    });

    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Amplitude:', error);
  }
}

/**
 * Identify user in Amplitude using Supabase user ID
 * CRITICAL: Only use Supabase user ID - DO NOT send email, full_name, or other PII
 * 
 * @param userId - Supabase user ID (session.user.id)
 */
export function identify(userId: string) {
  if (!isInitialized) {
    console.warn('Amplitude not initialized. Call initAmplitude() first.');
    return;
  }

  try {
    // Set user ID - this will automatically include user_id in all subsequent events
    amplitude.setUserId(userId);
    
    // Identify user (this creates/updates the user in Amplitude)
    // DO NOT include email, full_name, or other PII in user properties
    const identifyObj = new amplitude.Identify();
    amplitude.identify(identifyObj);
  } catch (error) {
    console.error('Failed to identify user in Amplitude:', error);
  }
}

/**
 * Set user ID in Amplitude
 * After calling this, user_id will be automatically included in all subsequent events
 * 
 * @param userId - Supabase user ID (session.user.id) or undefined to clear
 */
export function setUserId(userId: string | undefined) {
  if (!isInitialized) {
    console.warn('Amplitude not initialized. Call initAmplitude() first.');
    return;
  }

  try {
    if (userId) {
      amplitude.setUserId(userId);
    } else {
      // Clear user ID on logout
      amplitude.setUserId(undefined);
    }
  } catch (error) {
    console.error('Failed to set user ID in Amplitude:', error);
  }
}

/**
 * Track an event in Amplitude
 * 
 * @param eventName - Name of the event (e.g., "[App Open]", "[Screen Viewed]", "[Button Clicked]")
 * @param eventProperties - Optional event properties (DO NOT include PII)
 */
export function track(eventName: string, eventProperties?: Record<string, any>) {
  if (!isInitialized) {
    console.warn('Amplitude not initialized. Call initAmplitude() first.');
    return;
  }

  try {
    amplitude.track(eventName, eventProperties);
  } catch (error) {
    console.error('Failed to track event in Amplitude:', error);
  }
}

/**
 * Log an event (alias for track)
 * 
 * @param eventName - Name of the event
 * @param eventProperties - Optional event properties (DO NOT include PII)
 */
export function logEvent(eventName: string, eventProperties?: Record<string, any>) {
  track(eventName, eventProperties);
}

/**
 * Set user properties in Amplitude
 * CRITICAL: DO NOT set email, full_name, or other PII as user properties
 * 
 * @param userProperties - User properties to set (e.g., { account_type: "pro" })
 */
export function setUserProperties(userProperties: Record<string, any>) {
  if (!isInitialized) {
    console.warn('Amplitude not initialized. Call initAmplitude() first.');
    return;
  }

  try {
    const identifyObj = new amplitude.Identify();
    
    // Set each property
    Object.entries(userProperties).forEach(([key, value]) => {
      identifyObj.set(key, value);
    });

    amplitude.identify(identifyObj);
  } catch (error) {
    console.error('Failed to set user properties in Amplitude:', error);
  }
}

/**
 * Update account_type user property
 * Fetches current account_type from user data and updates Amplitude
 * Should be called on [App Open] events when user_id exists
 */
export async function updateAccountType() {
  if (!isInitialized) {
    return;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return;
    }

    // Fetch current account_type from user data
    const { data: userData } = await supabase
      .from('users')
      .select('account_type')
      .eq('id', session.user.id)
      .single();

    if (userData?.account_type) {
      setUserProperties({ account_type: userData.account_type });
    }
  } catch (error) {
    console.error('Failed to update account_type in Amplitude:', error);
  }
}

/**
 * Clear user identification (call on logout)
 */
export function clearUser() {
  if (!isInitialized) {
    return;
  }

  try {
    amplitude.setUserId(undefined);
    // Optionally clear user properties
    // amplitude.clearUserProperties();
  } catch (error) {
    console.error('Failed to clear user in Amplitude:', error);
  }
}

