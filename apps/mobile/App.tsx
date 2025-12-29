import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import RootNavigator from './src/navigation/RootNavigator';
import { initMetroConfig } from './src/lib/metro-config';

export default function App() {
  useEffect(() => {
    // Initialize Metro configuration for WiFi debugging
    initMetroConfig().catch(console.error);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
