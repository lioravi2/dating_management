import * as amplitude from '@amplitude/analytics-react-native';
import { supabase } from '../supabase/client';

// Initialize Amplitude SDK
let isInitialized = false;
let apiKeyValue: string | undefined = undefined;
let sessionReplayAvailable = false;
let sessionReplayInitialized = false;
let sessionReplayError: string | null = null;
let currentUserId: string | undefined = undefined; // Track current user ID to prevent duplicate calls

// Logging infrastructure for debug screen
interface AmplitudeLogEntry {
  timestamp: number;
  level: 'log' | 'warn' | 'error';
  message: string;
  args?: any[];
}

const amplitudeLogs: AmplitudeLogEntry[] = [];
const MAX_LOGS = 500;

function addLog(level: AmplitudeLogEntry['level'], message: string, ...args: any[]) {
  amplitudeLogs.push({
    timestamp: Date.now(),
    level,
    message,
    args: args.length > 0 ? args : undefined,
  });
  
  // Keep only recent logs
  if (amplitudeLogs.length > MAX_LOGS) {
    amplitudeLogs.shift();
  }
  
  // Also log to console
  const consoleFn = console[level] || console.log;
  consoleFn(`[Amplitude] ${message}`, ...args);
}

// Session replay plugin - optional (may not be available in all builds)
let SessionReplayPluginClass: any = null;
try {
  const sessionReplayModule = require('@amplitude/plugin-session-replay-react-native');
  
  // The module exports SessionReplayPlugin (capital S and P) as a class
  SessionReplayPluginClass = sessionReplayModule.SessionReplayPlugin;
  
  if (SessionReplayPluginClass) {
    sessionReplayAvailable = true;
    addLog('log', 'Session replay plugin class loaded successfully', {
      hasSessionReplayPlugin: !!SessionReplayPluginClass,
      pluginType: typeof SessionReplayPluginClass,
    });
  } else {
    sessionReplayAvailable = false; // Module loaded, but plugin class not found
    const moduleKeys = Object.keys(sessionReplayModule || {});
    addLog('warn', 'Session replay module loaded but SessionReplayPlugin class not found', {
      moduleKeys,
    });
  }
} catch (error) {
  sessionReplayAvailable = false;
  const errorMsg = error instanceof Error ? error.message : String(error);
  sessionReplayError = `Plugin not available: ${errorMsg}`;
  addLog('warn', 'Session replay plugin not available (this is okay - analytics will still work)', error);
}


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
    addLog('error', 'API key not found. Analytics will not be initialized.');
    return;
  }

  try {
    // Initialize Amplitude React Native SDK
    // Note: UTM tracking can be configured if landing pages are accessible via mobile web
    addLog('log', 'Initializing Amplitude SDK...', {
      apiKeyLength: apiKey?.length || 0,
      apiKeyPreview: apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : 'missing',
    });
    
    // CRITICAL FIX: init() signature is init(apiKey, userId?, options?)
    // We must pass undefined as userId (second param) before options (third param)
    amplitude.init(apiKey, undefined, {
      defaultTracking: {
        sessions: true,
        // Screen views will be tracked manually via navigation listeners
        screenViews: false,
        appLifecycles: true, // Track app open/close events
      },
      // Explicitly configure flush settings to ensure events are sent promptly
      // Default is 30 events or 30 seconds, but we flush more frequently for better reliability
      flushQueueSize: 10, // Flush after 10 events (good balance between performance and reliability)
      flushIntervalMillis: 10000, // Also flush every 10 seconds as backup
    });

    // Verify optOut is not set (should be false by default)
    // Note: We can't directly check optOut status, but we can ensure it's not set
    // Ensure optOut is disabled
    amplitude.setOptOut(false);
    
    addLog('log', 'Amplitude SDK initialized successfully', {
      apiKey: apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : 'missing',
      deviceId: amplitude.getDeviceId(),
      sessionId: amplitude.getSessionId(),
      userId: amplitude.getUserId(),
      optOut: false, // Explicitly set to false
    });


    // Configure and add Session Replay plugin (non-blocking)
    // Session replay captures user interactions for debugging and analysis
    // If session replay fails or is unavailable, Amplitude will still work for regular events
    // IMPORTANT: Session Replay must use the same API key, device ID, and session ID as the main SDK
    // CRITICAL: Plugin must be added BEFORE any events are tracked to ensure Session Replay ID is attached
    if (SessionReplayPluginClass) {
      try {
        addLog('log', 'Attempting to initialize Session Replay plugin...');
        
        // CORRECT: Pass config object to constructor
        // The plugin constructor accepts SessionReplayConfig with sampleRate, enableRemoteConfig, logLevel, autoStart
        const sessionReplayConfig = {
          // Sample rate: 1.0 = 100% of sessions recorded, 0.1 = 10% of sessions
          // CRITICAL: Must be > 0 for Session Replay to work (default is 0 which disables it)
          sampleRate: 1.0,
          
          // Automatically start recording sessions when initialized
          autoStart: true,
          
          // Allow remote configuration to override local settings
          enableRemoteConfig: true,
        };

        addLog('log', 'Creating session replay plugin instance with config...', { 
          config: sessionReplayConfig,
        });
        
        // SessionReplayPlugin constructor accepts config object
        const pluginInstance = new SessionReplayPluginClass(sessionReplayConfig);
        
        if (!pluginInstance) {
          throw new Error('Session replay plugin returned null/undefined');
        }
        
        addLog('log', 'Adding session replay plugin to Amplitude instance...');
        // CRITICAL: Add plugin BEFORE tracking any events
        // This ensures the Session Replay ID is attached to all events
        amplitude.add(pluginInstance);
        
        sessionReplayInitialized = true;
        sessionReplayError = null;
        addLog('log', 'Session Replay plugin initialized successfully', { 
          config: sessionReplayConfig,
          note: 'Plugin attached to same Amplitude instance with same API key. Plugin added before any events are tracked.',
        });
      } catch (error) {
        // Session replay is optional - log error but don't fail Amplitude initialization
        sessionReplayInitialized = false;
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        sessionReplayError = errorMessage;
        addLog('error', 'Failed to initialize Session Replay plugin (analytics will still work)', error);
        addLog('error', `Session replay error: ${errorMessage}`);
        if (errorStack) {
          addLog('error', `Session replay error stack: ${errorStack}`);
        }
        addLog('log', 'Session replay is optional - Amplitude events will still be tracked');
      }
    } else {
      addLog('log', 'Session Replay plugin not available - skipping (analytics will still work)');
    }

    isInitialized = true;
    addLog('log', 'Amplitude analytics initialized successfully', {
      initialized: true,
      apiKeyPresent: !!apiKeyValue,
      sessionReplayAvailable,
      sessionReplayInitialized,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    addLog('error', 'Failed to initialize Amplitude', error);
    addLog('error', `Error details: ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      addLog('error', `Error stack: ${error.stack}`);
    }
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
    addLog('warn', 'Amplitude not initialized. Call initAmplitude() first.');
    return;
  }

  try {
    // Set user ID - this will automatically include user_id in all subsequent events
    amplitude.setUserId(userId);
    // Update tracking variable to keep it in sync with SDK state
    currentUserId = userId;
    
    // Identify user (this creates/updates the user in Amplitude)
    // DO NOT include email, full_name, or other PII in user properties
    const identifyObj = new amplitude.Identify();
    amplitude.identify(identifyObj);
    addLog('log', `User identified in Amplitude: ${userId.substring(0, 8)}...`);
  } catch (error) {
    addLog('error', 'Failed to identify user in Amplitude', error);
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
    addLog('warn', 'Amplitude not initialized. Call initAmplitude() first.');
    return;
  }

  // Prevent duplicate calls with the same user ID
  if (userId === currentUserId) {
    return; // Already set, skip
  }

  try {
    if (userId) {
      amplitude.setUserId(userId);
      currentUserId = userId;
      addLog('log', `User ID set in Amplitude: ${userId.substring(0, 8)}...`);
    } else {
      // Clear user ID on logout
      amplitude.setUserId(undefined);
      currentUserId = undefined;
      addLog('log', 'User ID cleared from Amplitude (logout)');
    }
  } catch (error) {
    addLog('error', 'Failed to set user ID in Amplitude', error);
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
    addLog('warn', `Cannot track event - Amplitude not initialized. Call initAmplitude() first.`, {
      eventName,
      eventProperties,
    });
    return;
  }

  try {
    addLog('log', `Tracking event: "${eventName}"`, {
      ...(eventProperties || {}),
      deviceId: amplitude.getDeviceId(),
      sessionId: amplitude.getSessionId(),
      userId: amplitude.getUserId(),
    });
    
    const result = amplitude.track(eventName, eventProperties);
    
    // Log result if available (might be a promise)
    if (result && typeof result.then === 'function') {
      result.then((trackResult: any) => {
        if (trackResult) {
          addLog('log', `Event tracking result: "${eventName}"`, {
            code: trackResult.code,
            message: trackResult.message,
            eventsIngested: trackResult.eventsIngested,
          });
        }
      }).catch((error: any) => {
        addLog('error', `Event tracking failed: "${eventName}"`, error);
      });
    }
    
    addLog('log', `Successfully queued event: "${eventName}"`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    addLog('error', `Failed to track event "${eventName}"`, error);
    addLog('error', `Error details: ${errorMessage}`);
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
    addLog('warn', 'Amplitude not initialized. Call initAmplitude() first.');
    return;
  }

  try {
    const identifyObj = new amplitude.Identify();
    
    // Set each property
    Object.entries(userProperties).forEach(([key, value]) => {
      identifyObj.set(key, value);
    });

    amplitude.identify(identifyObj);
    addLog('log', 'User properties set in Amplitude', userProperties);
  } catch (error) {
    addLog('error', 'Failed to set user properties in Amplitude', error);
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
    addLog('error', 'Failed to update account_type in Amplitude', error);
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
    addLog('error', 'Failed to track app open', error);
  }
}

/**
 * Clear user identification (call on logout)
 */
export function clearUser() {
  if (!isInitialized) {
    return;
  }

  // Only clear if we have a user ID set
  if (currentUserId === undefined) {
    return; // Already cleared, skip
  }

  try {
    amplitude.setUserId(undefined);
    currentUserId = undefined;
    // Optionally clear user properties
    // amplitude.clearUserProperties();
    addLog('log', 'User cleared from Amplitude');
  } catch (error) {
    addLog('error', 'Failed to clear user in Amplitude', error);
  }
}

/**
 * Check if Amplitude optOut is enabled (if true, events won't be sent)
 */
export function checkOptOut(): boolean {
  // Note: There's no direct getter for optOut, but we can try to infer it
  // by checking if events are being tracked. For now, we'll assume it's false
  // since we can't directly check it.
  return false; // Default is false (not opted out)
}

/**
 * Ensure optOut is disabled (events will be sent)
 */
export function ensureOptOutDisabled() {
  if (!isInitialized) {
    return;
  }

  try {
    amplitude.setOptOut(false);
    addLog('log', 'Ensured optOut is disabled (events will be sent)');
  } catch (error) {
    addLog('error', 'Failed to set optOut', error);
  }
}

/**
 * Test network connectivity to Amplitude servers
 * Note: We test by attempting to reach the API endpoint (even if it returns an error,
 * a response means connectivity is working)
 */
export async function testNetworkConnectivity(): Promise<{ success: boolean; error?: string }> {
  try {
    addLog('log', 'Testing network connectivity to Amplitude servers...');
    
    // Test connectivity by attempting to reach Amplitude's API endpoint
    // Even a 404 or other error response means we have connectivity
    const response = await fetch('https://api2.amplitude.com/2/httpapi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}), // Empty body will fail but confirms connectivity
    });
    
    // Any response (even error) means we have network connectivity
    // The API key test will verify actual functionality
    addLog('log', 'Network connectivity test successful', {
      status: response.status,
      statusText: response.statusText,
      note: 'Any HTTP response indicates network connectivity',
    });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    addLog('error', 'Network connectivity test failed', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Test API key by attempting to send a test event directly
 */
export async function testApiKey(): Promise<{ success: boolean; error?: string }> {
  if (!apiKeyValue) {
    return { success: false, error: 'API key not set' };
  }

  try {
    addLog('log', 'Testing API key validity...');
    
    // Create a minimal test event payload
    const testEvent = {
      api_key: apiKeyValue,
      events: [
        {
          user_id: 'test-user',
          device_id: amplitude.getDeviceId() || 'test-device',
          event_type: '[API Key Test]',
          time: Date.now(),
          event_properties: {
            test: true,
            source: 'api_key_validation',
          },
        },
      ],
    };

    const response = await fetch('https://api2.amplitude.com/2/httpapi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
      },
      body: JSON.stringify(testEvent),
    });

    const responseText = await response.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (response.ok) {
      addLog('log', 'API key test successful', {
        status: response.status,
        response: responseData,
      });
      return { success: true };
    } else {
      const error = `HTTP ${response.status}: ${response.statusText} - ${JSON.stringify(responseData)}`;
      addLog('error', 'API key test failed', { error, response: responseData });
      return { success: false, error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    addLog('error', 'API key test error', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

/**
 * Flush events to Amplitude server
 * Should be called before app backgrounds to ensure events are sent
 */
export function flush() {
  if (!isInitialized) {
    addLog('warn', 'Cannot flush - Amplitude not initialized');
    return;
  }

  try {
    addLog('log', 'Flushing events to Amplitude server...', {
      deviceId: amplitude.getDeviceId(),
      sessionId: amplitude.getSessionId(),
      userId: amplitude.getUserId(),
    });
    
    const result = amplitude.flush();
    
    // Log result if available (might be a promise)
    if (result && typeof result.then === 'function') {
      result.then((flushResult: any) => {
        if (flushResult) {
          addLog('log', 'Flush completed', {
            code: flushResult.code,
            message: flushResult.message,
            eventsIngested: flushResult.eventsIngested,
          });
        } else {
          addLog('log', 'Flush completed (no result returned)');
        }
      }).catch((error: any) => {
        addLog('error', 'Flush failed', error);
      });
    } else {
      addLog('log', 'Flush called (synchronous)');
    }
  } catch (error) {
    addLog('error', 'Failed to flush events to Amplitude', error);
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
  apiKeyPreview?: string;
  sessionReplayAvailable: boolean;
  sessionReplayInitialized: boolean;
  sessionReplayError: string | null;
} {
  return {
    initialized: isInitialized,
    apiKeyPresent: !!apiKeyValue,
    apiKeyPreview: apiKeyValue ? `${apiKeyValue.substring(0, 8)}...${apiKeyValue.substring(apiKeyValue.length - 4)}` : undefined,
    sessionReplayAvailable,
    sessionReplayInitialized,
    sessionReplayError,
  };
}

/**
 * Get recent Amplitude logs for debugging
 */
export function getRecentLogs(limit: number = 100): AmplitudeLogEntry[] {
  return amplitudeLogs.slice(-limit);
}

/**
 * Format Amplitude debug information as text
 */
export function formatAmplitudeDebugInfo(): string {
  const status = getAmplitudeStatus();
  const recentLogs = getRecentLogs(200);
  
  let debugText = '═══════════════════════════════════════════════════\n';
  debugText += 'AMPLITUDE ANALYTICS DEBUG INFORMATION\n';
  debugText += '═══════════════════════════════════════════════════\n\n';
  
  debugText += 'Initialization Status:\n';
  debugText += `  Initialized: ${status.initialized ? 'YES' : 'NO'}\n`;
  debugText += `  API Key Present: ${status.apiKeyPresent ? 'YES' : 'NO'}\n`;
  if (status.apiKeyPreview) {
    debugText += `  API Key Preview: ${status.apiKeyPreview}\n`;
  }
  debugText += `  Session Replay Available: ${status.sessionReplayAvailable ? 'YES' : 'NO'}\n`;
  debugText += `  Session Replay Initialized: ${status.sessionReplayInitialized ? 'YES' : 'NO'}\n`;
  if (status.sessionReplayError) {
    debugText += `  Session Replay Error: ${status.sessionReplayError}\n`;
  }
  
  debugText += '\n═══════════════════════════════════════════════════\n';
  debugText += `Recent Logs (${recentLogs.length} entries):\n`;
  debugText += '═══════════════════════════════════════════════════\n\n';
  
  recentLogs.forEach((log, index) => {
    const timestamp = new Date(log.timestamp).toISOString();
    debugText += `[${timestamp}] [${log.level.toUpperCase()}]: ${log.message}\n`;
    if (log.args && log.args.length > 0) {
      try {
        debugText += `  Args: ${JSON.stringify(log.args, null, 2)}\n`;
      } catch (e) {
        debugText += `  Args: [Unable to stringify]\n`;
      }
    }
    debugText += '\n';
  });
  
  debugText += '═══════════════════════════════════════════════════\n';
  debugText += 'END OF DEBUG INFORMATION\n';
  debugText += '═══════════════════════════════════════════════════\n';
  
  return debugText;
}

/**
 * Track a test event for debugging
 */
export function trackTestEvent(source: string = 'Unknown'): void {
  const testProperties = {
    test: true,
    source,
    timestamp: new Date().toISOString(),
  };
  
  track('[Debug Test Event]', testProperties);
  addLog('log', `Test event tracked from: ${source}`, testProperties);
}


