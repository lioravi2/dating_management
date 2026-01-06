import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { initMetroConfig } from './src/lib/metro-config';
import { initAmplitude, trackAppOpen } from './src/lib/analytics';
import { checkInitialAttribution, trackAppInstalled } from './src/lib/attribution';

export default function App() {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
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
        console.error('Failed to handle attribution:', error);
      }
    };

    handleAttribution();

    // Track initial app open (when app first loads)
    trackAppOpen().catch(console.error);
  }, []);

  useEffect(() => {
    // Listen for app state changes to track [App Open] when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // Track [App Open] when app comes to foreground (from background or inactive)
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        trackAppOpen().catch(console.error);
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
