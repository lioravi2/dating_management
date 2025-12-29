import { Platform, AppState, NativeModules } from 'react-native';

export interface ShareIntentData {
  imageUri: string;
  mimeType?: string;
}

// Type definition for the native module
interface ShareIntentModuleInterface {
  getShareIntentUri(): Promise<string | null>;
  getShareIntentMimeType(): Promise<string | null>;
}

// Get the native module with proper typing
const { ShareIntentModule } = NativeModules as {
  ShareIntentModule?: ShareIntentModuleInterface;
};

/**
 * Get the initial share intent data when app is opened from a share action
 * Uses native module to read share intent data stored in SharedPreferences
 */
export async function getInitialShareIntent(): Promise<ShareIntentData | null> {
  try {
    // Only available on Android
    if (Platform.OS !== 'android' || !ShareIntentModule) {
      console.log('[share-handler] Share intent not supported on this platform');
      return null;
    }

    // Get the image URI from native module (one-time read, clears after reading)
    const imageUri: string | null = await ShareIntentModule.getShareIntentUri();
    
    if (imageUri) {
      console.log('[share-handler] Share intent URI found:', imageUri);
      
      // Get the MIME type if available
      const mimeType: string | null = await ShareIntentModule.getShareIntentMimeType();
      
      return {
        imageUri,
        mimeType: mimeType || undefined,
      };
    }
    
    console.log('[share-handler] No share intent found');
  } catch (error) {
    console.error('[share-handler] Error getting initial share intent:', error);
  }
  
  return null;
}

/**
 * Listen for share intents when app is already running
 * When app comes to foreground, check for new share intents
 */
export function setupShareIntentListener(
  callback: (data: ShareIntentData) => void
): () => void {
  if (Platform.OS !== 'android' || !ShareIntentModule) {
    // Return a no-op cleanup function
    return () => {};
  }

  let previousAppState = AppState.currentState;

  const checkForShareIntent = async () => {
    try {
      const imageUri: string | null = await ShareIntentModule.getShareIntentUri();
      
      if (imageUri) {
        console.log('[share-handler] Share intent received while app running:', imageUri);
        
        const mimeType: string | null = await ShareIntentModule.getShareIntentMimeType();
        
        callback({
          imageUri,
          mimeType: mimeType || undefined,
        });
      }
    } catch (error) {
      console.error('[share-handler] Error checking for share intent:', error);
    }
  };

  // Listen for app state changes
  const subscription = AppState.addEventListener('change', (nextAppState) => {
    // When app comes to foreground, check for share intents
    if (previousAppState.match(/inactive|background/) && nextAppState === 'active') {
      checkForShareIntent();
    }
    previousAppState = nextAppState;
  });

  // Also check immediately in case a share intent was received before listener was set up
  checkForShareIntent();

  return () => {
    subscription.remove();
  };
}


