import { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Linking } from 'react-native';
import { RootStackParamList } from './types';
import { supabase } from '../lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import ShareNavigator from './ShareNavigator';
import MetroConfigScreen from '../screens/dev/MetroConfigScreen';
import { View, ActivityIndicator, Text } from 'react-native';
import { getInitialShareIntent, setupShareIntentListener } from '../lib/share-handler';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigationRef = useRef<any>(null);

  // Handle deep links (magic link callbacks)
  const handleDeepLink = (url: string) => {
    console.log('[RootNavigator] Deep link received:', url);
    
    // Check if it's an auth callback
    if (url && url.startsWith('datingapp://auth/callback')) {
      try {
        // Parse the URL - replace datingapp:// with https:// for URL parsing
        const urlForParsing = url.replace('datingapp://', 'https://');
        const parsed = new URL(urlForParsing);
        
        // Try to get tokens from query params first
        let accessToken = parsed.searchParams.get('access_token');
        let refreshToken = parsed.searchParams.get('refresh_token');
        
        // If not in query params, try hash fragment
        if (!accessToken && parsed.hash) {
          const accessTokenMatch = parsed.hash.match(/access_token=([^&]+)/);
          accessToken = accessTokenMatch ? decodeURIComponent(accessTokenMatch[1]) : null;
        }
        
        if (!refreshToken && parsed.hash) {
          const refreshTokenMatch = parsed.hash.match(/refresh_token=([^&]+)/);
          refreshToken = refreshTokenMatch ? decodeURIComponent(refreshTokenMatch[1]) : null;
        }

        if (accessToken && refreshToken) {
          console.log('[RootNavigator] Found tokens in deep link, setting session...');
          // Set the session
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }).then(({ data, error }) => {
            if (error) {
              console.error('[RootNavigator] Error setting session from deep link:', error);
            } else {
              console.log('[RootNavigator] Session set successfully from deep link');
              // Session state will update via onAuthStateChange listener
            }
          });
        } else {
          console.log('[RootNavigator] No tokens found in deep link, navigating to AuthCallback');
          // If tokens aren't in URL, navigate to AuthCallback screen to handle it
          if (navigationRef.current) {
            navigationRef.current.navigate('Auth', {
              screen: 'AuthCallback',
              params: { url },
            });
          }
        }
      } catch (error) {
        console.error('[RootNavigator] Error parsing deep link:', error);
        // Fallback: navigate to AuthCallback with the raw URL
        if (navigationRef.current) {
          navigationRef.current.navigate('Auth', {
            screen: 'AuthCallback',
            params: { url },
          });
        }
      }
    }
  };

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
            // Reset navigation stack to Dashboard first, then navigate to PhotoUpload
            // This ensures the user sees the Dashboard before the upload screen
            navigationRef.current.reset({
              index: 0,
              routes: [
                {
                  name: 'Main',
                  state: {
                    routes: [
                      {
                        name: 'Dashboard',
                      },
                      {
                        name: 'Partners',
                        state: {
                          routes: [
                            {
                              name: 'PhotoUpload',
                              params: {
                                imageUri: shareIntent.imageUri,
                                source: 'Share',
                              },
                            },
                          ],
                          index: 0,
                        },
                      },
                    ],
                    index: 0, // Start at Dashboard tab
                  },
                },
              ],
            });
            
            // Navigate to PhotoUpload after a short delay to show Dashboard first
            setTimeout(() => {
              if (navigationRef.current) {
                navigationRef.current.navigate('Main', {
                  screen: 'Partners',
                  params: {
                    screen: 'PhotoUpload',
                    params: {
                      imageUri: shareIntent.imageUri,
                      source: 'Share',
                    },
                  },
                });
              }
            }, 300);
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
      console.log('[RootNavigator] Auth state changed:', event, session ? 'has session' : 'no session');
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
        // When sharing again, navigate to Dashboard first, then to PhotoUpload
        // This ensures the user sees the Dashboard before the upload screen
        navigationRef.current.reset({
          index: 0,
          routes: [
            {
              name: 'Main',
              state: {
                routes: [
                  {
                    name: 'Dashboard',
                  },
                  {
                    name: 'Partners',
                    state: {
                      routes: [
                        {
                          name: 'PhotoUpload',
                          params: {
                            imageUri: shareIntent.imageUri,
                            source: 'Share',
                          },
                        },
                      ],
                      index: 0,
                    },
                  },
                ],
                index: 0, // Start at Dashboard tab
              },
            },
          ],
        });
        
        // Navigate to PhotoUpload after a short delay to show Dashboard first
        setTimeout(() => {
          if (navigationRef.current) {
            navigationRef.current.navigate('Main', {
              screen: 'Partners',
              params: {
                screen: 'PhotoUpload',
                params: {
                  imageUri: shareIntent.imageUri,
                  source: 'Share',
                },
              },
            });
          }
        }, 300);
      }
    });

    return () => {
      subscription.unsubscribe();
      removeShareListener();
    };
  }, [session]);

  // Handle deep links (magic link callbacks)
  useEffect(() => {
    // Get initial URL when app opens from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[RootNavigator] Initial URL:', url);
        handleDeepLink(url);
      }
    }).catch((error) => {
      console.error('[RootNavigator] Error getting initial URL:', error);
    });

    // Listen for deep links when app is already running
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('[RootNavigator] Deep link event:', event.url);
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []); // Empty deps - only run once on mount

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
            <Stack.Screen 
              name="MetroConfig" 
              component={MetroConfigScreen}
              options={{
                headerShown: true,
                title: 'Metro Configuration',
                presentation: 'modal',
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}