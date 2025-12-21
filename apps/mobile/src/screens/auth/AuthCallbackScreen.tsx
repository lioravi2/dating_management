import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase/client';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { RouteProp } from '@react-navigation/native';

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



