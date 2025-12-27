import { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { supabase } from '../lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import ShareNavigator from './ShareNavigator';
import { View, ActivityIndicator, Text } from 'react-native';
import { getInitialShareIntent, setupShareIntentListener } from '../lib/share-handler';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        // If there's an error (e.g., invalid refresh token), clear session
        console.log('Session error (will redirect to sign in):', error.message);
        setSession(null);
      } else {
        setSession(session);
        
        // Check for share intent when session is available
        if (session && navigationRef.current) {
          const shareIntent = await getInitialShareIntent();
          if (shareIntent) {
            // Reset navigation stack and navigate to share handler
            navigationRef.current.reset({
              index: 0,
              routes: [
                {
                  name: 'Share',
                  params: {
                    screen: 'ShareHandler',
                    params: {
                      imageUri: shareIntent.imageUri,
                    },
                  },
                },
              ],
            });
          }
        }
      }
      setLoading(false);
    }).catch((error) => {
      console.error('Error getting session:', error);
      // On error, assume not authenticated
      setSession(null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Handle SIGNED_OUT event or null session (includes invalid refresh token)
      if (event === 'SIGNED_OUT' || !session) {
        setSession(null);
      } else {
        setSession(session);
      }
    });

    // Listen for share intents when app is already running
    const removeShareListener = setupShareIntentListener((shareIntent) => {
      if (navigationRef.current && session) {
        navigationRef.current.reset({
          index: 0,
          routes: [
            {
              name: 'Share',
              params: {
                screen: 'ShareHandler',
                params: {
                  imageUri: shareIntent.imageUri,
                },
              },
            },
          ],
        });
      }
    });

    return () => {
      subscription.unsubscribe();
      removeShareListener();
    };
  }, [session]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen name="Share" component={ShareNavigator} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
