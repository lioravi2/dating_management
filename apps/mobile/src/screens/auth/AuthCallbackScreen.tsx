import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase/client';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { RouteProp } from '@react-navigation/native';
import { identify, updateAccountType, isAmplitudeInitialized } from '../../lib/analytics';

type AuthCallbackScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'AuthCallback'>;
type AuthCallbackScreenRouteProp = RouteProp<AuthStackParamList, 'AuthCallback'>;

interface AuthCallbackScreenProps {
  navigation: AuthCallbackScreenNavigationProp;
  route: AuthCallbackScreenRouteProp;
}

export default function AuthCallbackScreen({ navigation, route }: AuthCallbackScreenProps) {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        const url = route.params?.url;
        if (!url) {
          // If no URL param, try to get from deep link
          // This will be handled by Supabase's session detection
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
              // Identify user in Amplitude (non-blocking)
              if (session.user?.id && isAmplitudeInitialized()) {
                try {
                  identify(session.user.id);
                  // Update account_type user property
                  await updateAccountType();
                } catch (error) {
                  console.log('[AuthCallback] Error identifying user in Amplitude (non-blocking):', error);
                  // Don't block auth flow if analytics fails
                }
              }

              // Call update-profile endpoint to handle both registration and sign-in tracking
              // This tracks [User Registered] for new users and updates last_login for existing users
              // Then call track-signin to explicitly track [User Signed In] for existing users
              // (similar to web app flow where middleware tracks sign-in after profile update)
              try {
                if (session.access_token) {
                  const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL;
                  if (webAppUrl) {
                    // Update profile first (tracks [User Registered] for new users)
                    const profileResponse = await fetch(`${webAppUrl}/api/auth/update-profile`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({}),
                    }).catch((error) => {
                      // Ignore errors - tracking is best effort, don't block sign in
                      console.log('[AuthCallback] Server update-profile call failed (non-blocking):', error);
                      return null;
                    });
                    
                    // Check if user is new (created: true) or existing (updated: true)
                    // For existing users, explicitly track [User Signed In] since middleware won't run on mobile
                    if (profileResponse) {
                      try {
                        const profileData = await profileResponse.json();
                        // If profile was updated (not created), track sign-in explicitly
                        // (for new users, [User Registered] was already tracked by update-profile)
                        if (profileData.updated) {
                          await fetch(`${webAppUrl}/api/auth/track-signin`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${session.access_token}`,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({}),
                          }).catch((error) => {
                            // Ignore errors - tracking is best effort, don't block sign in
                            console.log('[AuthCallback] Server sign-in tracking failed (non-blocking):', error);
                          });
                        }
                      } catch (error) {
                        // If we can't parse the response, still try to track sign-in (non-blocking)
                        console.log('[AuthCallback] Error parsing update-profile response (non-blocking):', error);
                      }
                    }
                  } else {
                    console.warn('[AuthCallback] EXPO_PUBLIC_WEB_APP_URL not set - skipping server-side tracking');
                  }
                }
              } catch (error) {
                // Ignore errors - tracking is best effort
                console.log('[AuthCallback] Error calling update-profile endpoint (non-blocking):', error);
              }
          
          // Navigation will be handled by RootNavigator
          return;
        }
        } else {
          // Parse the callback URL
          const parsedUrl = new URL(url);
          const accessToken = parsedUrl.searchParams.get('access_token') || 
                            parsedUrl.hash.split('access_token=')[1]?.split('&')[0];
          const refreshToken = parsedUrl.searchParams.get('refresh_token') || 
                             parsedUrl.hash.split('refresh_token=')[1]?.split('&')[0];

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('Error setting session:', error);
            } else {
              // Get session after setting it
              const { data: { session } } = await supabase.auth.getSession();
              
              // Identify user in Amplitude (non-blocking)
              if (session?.user?.id && isAmplitudeInitialized()) {
                try {
                  identify(session.user.id);
                  // Update account_type user property
                  await updateAccountType();
                } catch (error) {
                  console.log('[AuthCallback] Error identifying user in Amplitude (non-blocking):', error);
                  // Don't block auth flow if analytics fails
                }
              }

              // Call update-profile endpoint to handle both registration and sign-in tracking
              // This tracks [User Registered] for new users and updates last_login for existing users
              // Then call track-signin to explicitly track [User Signed In] for existing users
              // (similar to web app flow where middleware tracks sign-in after profile update)
              try {
                if (session?.access_token) {
                  const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL;
                  if (webAppUrl) {
                    // Update profile first (tracks [User Registered] for new users)
                    const profileResponse = await fetch(`${webAppUrl}/api/auth/update-profile`, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({}),
                    }).catch((error) => {
                      // Ignore errors - tracking is best effort, don't block sign in
                      console.log('[AuthCallback] Server update-profile call failed (non-blocking):', error);
                      return null;
                    });
                    
                    // Check if user is new (created: true) or existing (updated: true)
                    // For existing users, explicitly track [User Signed In] since middleware won't run on mobile
                    if (profileResponse) {
                      try {
                        const profileData = await profileResponse.json();
                        // If profile was updated (not created), track sign-in explicitly
                        // (for new users, [User Registered] was already tracked by update-profile)
                        if (profileData.updated) {
                          await fetch(`${webAppUrl}/api/auth/track-signin`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${session.access_token}`,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({}),
                          }).catch((error) => {
                            // Ignore errors - tracking is best effort, don't block sign in
                            console.log('[AuthCallback] Server sign-in tracking failed (non-blocking):', error);
                          });
                        }
                      } catch (error) {
                        // If we can't parse the response, still try to track sign-in (non-blocking)
                        console.log('[AuthCallback] Error parsing update-profile response (non-blocking):', error);
                      }
                    }
                  } else {
                    console.warn('[AuthCallback] EXPO_PUBLIC_WEB_APP_URL not set - skipping server-side tracking');
                  }
                }
              } catch (error) {
                // Ignore errors - tracking is best effort
                console.log('[AuthCallback] Error calling update-profile endpoint (non-blocking):', error);
              }
            }
          }
        }
      } catch (error) {
        console.error('Auth callback error:', error);
      }
    };

    handleCallback();
  }, [route.params, navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={styles.text}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
});



