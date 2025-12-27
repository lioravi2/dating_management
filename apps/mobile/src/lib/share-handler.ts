import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export interface ShareIntentData {
  imageUri: string;
  mimeType?: string;
}

/**
 * Get the initial share intent data when app is opened from a share action
 * This works for both Android (intent) and iOS (share extension)
 */
export async function getInitialShareIntent(): Promise<ShareIntentData | null> {
  try {
    // For Android, the share intent should be available through the initial URL
    // For iOS, it would come through a share extension
    const initialUrl = await Linking.getInitialURL();
    
    if (initialUrl) {
      // Parse the URL to extract share data
      // Format might be: datingapp://share?uri=file://...
      const parsed = Linking.parse(initialUrl);
      
      if (parsed.hostname === 'share' && parsed.queryParams?.uri) {
        return {
          imageUri: parsed.queryParams.uri as string,
          mimeType: parsed.queryParams.mimeType as string | undefined,
        };
      }
    }
  } catch (error) {
    console.error('[share-handler] Error getting initial share intent:', error);
  }
  
  return null;
}

/**
 * Listen for share intents when app is already running
 */
export function setupShareIntentListener(
  callback: (data: ShareIntentData) => void
): () => void {
  const subscription = Linking.addEventListener('url', (event) => {
    const parsed = Linking.parse(event.url);
    
    if (parsed.hostname === 'share' && parsed.queryParams?.uri) {
      callback({
        imageUri: parsed.queryParams.uri as string,
        mimeType: parsed.queryParams.mimeType as string | undefined,
      });
    }
  });

  return () => subscription.remove();
}

