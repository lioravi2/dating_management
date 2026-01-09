import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { initMetroConfig } from './src/lib/metro-config';
import { initAmplitude, trackAppOpen, flush } from './src/lib/analytics';
import { checkInitialAttribution, trackAppInstalled } from './src/lib/attribution';

export default function App() {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    console.log('[App] Initializing app...');
    
    // Initialize Metro configuration for WiFi debugging
    initMetroConfig().catch(console.error);

    // Initialize Amplitude analytics
    initAmplitude();

    // Check for attribution data and track app install on first launch
    const handleAttribution = async () => {
      try {
        // Check if app was opened via deep link with attribution data
        const attributionData = await checkInitialAttribution();
        
        // Track app install event (will only track once)
        await trackAppInstalled(attributionData);
      } catch (error) {
        console.error('[App] Failed to handle attribution:', error);
      }
    };

    handleAttribution();

    // Track initial app open (when app first loads)
    console.log('[App] Calling trackAppOpen() for initial app load...');
    trackAppOpen().catch((error) => {
      console.error('[App] Failed to track initial app open:', error);
    });
  }, []);

  useEffect(() => {
    // Listen for app state changes to track [App Open] when app comes to foreground
    // and flush events when app goes to background
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log(`[App] AppState changed: ${appState.current} -> ${nextAppState}`);
      
      // Flush events when app goes to background to ensure they're sent
      if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        console.log('[App] App going to background, flushing Amplitude events...');
        flush();
      }
      
      // Track [App Open] when app comes to foreground (from background or inactive)
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[App] App came to foreground, calling trackAppOpen()...');
        trackAppOpen().catch((error) => {
          console.error('[App] Failed to track app open on foreground:', error);
        });
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
