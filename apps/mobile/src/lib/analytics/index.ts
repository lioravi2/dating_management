import * as amplitude from '@amplitude/analytics-react-native';
import { sessionReplayPlugin } from '@amplitude/plugin-session-replay-react-native';
import { supabase } from '../supabase/client';

// Initialize Amplitude SDK
let isInitialized = false;
let apiKeyValue: string | undefined = undefined;


/**
 * Initialize Amplitude analytics client
 * Should be called once on app load
 */
export function initAmplitude() {
  if (isInitialized) {
    return;
  }

  // Note: In Expo/React Native, EXPO_PUBLIC_* environment variables must be:
  // 1. Set in the environment when building (or in .env file)
  // 2. Available at build time - they are bundled into the JavaScript during build
  // 3. For release builds, ensure the variable is set before running npm run build:apk:release
  // The app.config.js file loads .env files and makes variables available via process.env
  const apiKey = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;
  apiKeyValue = apiKey;

  if (!apiKey) {
    console.error('[Amplitude] ERROR: API key not found. Analytics will not be initialized.');
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

    // Configure and add Session Replay plugin
    // Session replay captures user interactions for debugging and analysis
    const sessionReplayConfig = {
      // Sample rate: 1.0 = 100% of sessions recorded, 0.1 = 10% of sessions
      sampleRate: 1.0,
      
      // Automatically start recording sessions when initialized
      autoStart: true,
      
      // Privacy masking level:
      // - 'light': Masks passwords, emails, credit cards, phone numbers
      // - 'medium': Masks all editable text views
      // - 'conservative': Masks all text views
      maskLevel: 'medium' as const,
      
      // Allow remote configuration to override local settings
      enableRemoteConfig: true,
    };

    amplitude.add(sessionReplayPlugin(sessionReplayConfig));

    isInitialized = true;
  } catch (error) {
    console.error('[Amplitude] ERROR: Failed to initialize Amplitude:', error);
    isInitialized = false;
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
    console.warn('[Amplitude] Cannot track event - Amplitude not initialized. Call initAmplitude() first.');
    return;
  }

  try {
    amplitude.track(eventName, eventProperties);
  } catch (error) {
    console.error(`[Amplitude] ERROR: Failed to track event "${eventName}":`, error);
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
 * Track [App Open] event when app comes to foreground
 * Updates account_type user property when user_id exists
 * NO UTM parameters needed (inherited from user properties automatically)
 */
export async function trackAppOpen() {
  if (!isInitialized) {
    return;
  }

  try {
    // Get current session to check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    
    // Track [App Open] event
    // session_id is automatically included by Amplitude SDK
    // user_id is automatically included if setUserId was called previously
    track('[App Open]', {
      // user_id will be automatically included by SDK if setUserId was called
      // session_id is automatically included by Amplitude SDK
    });

    // Update account_type user property when user_id exists
    if (session) {
      await updateAccountType();
    }
  } catch (error) {
    console.error('[Amplitude] ERROR: Failed to track app open:', error);
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
    console.error('[Amplitude] ERROR: Failed to clear user:', error);
  }
}

/**
 * Check if Amplitude is initialized
 */
export function isAmplitudeInitialized(): boolean {
  return isInitialized;
}

/**
 * Get Amplitude initialization status
 */
export function getAmplitudeStatus(): {
  initialized: boolean;
  apiKeyPresent: boolean;
} {
  return {
    initialized: isInitialized,
    apiKeyPresent: !!apiKeyValue,
  };
}


