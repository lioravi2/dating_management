import { track } from './index';

/**
 * Track button click event
 * NO UTM parameters needed - inherited from user properties automatically
 * 
 * @param buttonId - Identifier for the button (e.g., "create_partner", "upload_photo", "delete_photo")
 * @param buttonText - Display text of the button (optional, for context)
 * @param screenName - Name of the screen where the button was clicked (optional)
 * @param additionalProps - Additional event properties (optional)
 */
export function trackButtonClick(
  buttonId: string,
  buttonText?: string,
  screenName?: string,
  additionalProps?: Record<string, any>
) {
  try {
    // user_id will be automatically included by Amplitude SDK if setUserId was called
    // session_id is automatically included by Amplitude SDK
    
    const eventProperties: Record<string, any> = {
      button_id: buttonId,
    };

    if (buttonText) {
      eventProperties.button_text = buttonText;
    }

    if (screenName) {
      eventProperties.screen_name = screenName;
    }

    // Include any additional properties
    if (additionalProps) {
      Object.assign(eventProperties, additionalProps);
    }

    // Track [Button Clicked] event
    // user_id and session_id are automatically included by Amplitude SDK
    // NO UTM parameters needed - inherited from user properties automatically
    track('[Button Clicked]', eventProperties);
  } catch (error) {
    console.error('[Amplitude] ERROR: Failed to track button click:', error);
  }
}

