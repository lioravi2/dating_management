import { NavigationState } from '@react-navigation/native';
import { track } from './index';

/**
 * Track screen view event
 * NO UTM parameters needed - inherited from user properties automatically
 * 
 * @param screenName - Name of the screen (e.g., "Dashboard", "PartnersList", "PartnerDetail")
 * @param screenParams - Optional screen parameters (will be stringified as JSON)
 */
export function trackScreenView(
  screenName: string,
  screenParams?: Record<string, any>
) {
  try {
    // Get current session to check if user is authenticated
    // user_id will be automatically included by Amplitude SDK if setUserId was called
    // session_id is automatically included by Amplitude SDK
    
    const eventProperties: Record<string, any> = {
      screen_name: screenName,
    };

    // Include screen params if provided (stringified as JSON for consistency)
    if (screenParams && Object.keys(screenParams).length > 0) {
      // Filter out sensitive data and large objects
      const sanitizedParams: Record<string, any> = {};
      Object.entries(screenParams).forEach(([key, value]) => {
        // Skip large arrays/objects that might contain sensitive data
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          sanitizedParams[key] = value;
        } else if (Array.isArray(value) && value.length <= 10) {
          // Only include small arrays
          sanitizedParams[key] = JSON.stringify(value);
        } else if (typeof value === 'object' && value !== null) {
          // Stringify objects but limit size
          const stringified = JSON.stringify(value);
          if (stringified.length <= 200) {
            sanitizedParams[key] = stringified;
          }
        }
      });
      
      if (Object.keys(sanitizedParams).length > 0) {
        eventProperties.screen_params = JSON.stringify(sanitizedParams);
      }
    }

    // Track [Screen Viewed] event
    // user_id and session_id are automatically included by Amplitude SDK
    // NO UTM parameters needed - inherited from user properties automatically
    track('[Screen Viewed]', eventProperties);
  } catch (error) {
    console.error('[Amplitude] ERROR: Failed to track screen view:', error);
  }
}

/**
 * Handle navigation state change to track screen views
 * Should be passed to NavigationContainer's onStateChange prop
 * 
 * @param state - Navigation state from onStateChange callback
 */
export function handleNavigationStateChange(state: NavigationState | undefined) {
  if (!state) {
    return;
  }

  try {
    // Get the active route from the navigation state
    const route = getActiveRoute(state);
    if (!route) {
      return;
    }

    // Extract screen name and params
    const screenName = route.name;
    const screenParams = route.params as Record<string, any> | undefined;

    // Track screen view
    trackScreenView(screenName, screenParams);
  } catch (error) {
    console.error('[Amplitude] ERROR: Failed to track navigation state change:', error);
  }
}

/**
 * Recursively get the active route from navigation state
 * Handles nested navigators (e.g., Main -> Partners -> PartnerDetail)
 */
function getActiveRoute(state: any): { name: string; params?: any } | null {
  if (!state) {
    return null;
  }

  const route = state.routes[state.index];
  if (!route) {
    return null;
  }

  // If route has nested state, recurse
  if (route.state) {
    return getActiveRoute(route.state);
  }

  // Return the leaf route
  return {
    name: route.name,
    params: route.params,
  };
}

