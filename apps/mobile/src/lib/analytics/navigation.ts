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
    const eventProperties: Record<string, any> = {
      screen_name: screenName,
    };

    // Extract partner_id if present in screenParams and remove it from screen_params
    if (screenParams?.partnerId) {
      eventProperties.partner_id = screenParams.partnerId;
    }

    // Include screen params if provided (stringified as JSON for consistency)
    // Exclude partnerId from screen_params since we extract it as partner_id above
    if (screenParams && Object.keys(screenParams).length > 0) {
      // Filter out sensitive data and large objects
      const sanitizedParams: Record<string, any> = {};
      Object.entries(screenParams).forEach(([key, value]) => {
        // Skip partnerId - it's extracted as partner_id above
        if (key === 'partnerId') {
          return;
        }
        
        // Store values as-is (not stringified) - final stringify will handle serialization
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          sanitizedParams[key] = value;
        } else if (Array.isArray(value) && value.length <= 10) {
          sanitizedParams[key] = value; // Store array as-is
        } else if (typeof value === 'object' && value !== null) {
          // Limit size by checking stringified length
          const stringified = JSON.stringify(value);
          if (stringified.length <= 200) {
            sanitizedParams[key] = value; // Store object as-is
          }
        }
      });
      
      if (Object.keys(sanitizedParams).length > 0) {
        // Stringify once at the end - this handles all serialization
        eventProperties.screen_params = JSON.stringify(sanitizedParams);
      }
    }

    // Track [Screen Viewed] event
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

