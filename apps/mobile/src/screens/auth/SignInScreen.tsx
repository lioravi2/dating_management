import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase/client';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
// DEV-ONLY: Remove this import to disable dev sign-in
import DevSignInButton from '../../components/DevSignInButton';

type SignInScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignIn'>;

interface SignInScreenProps {
  navigation: SignInScreenNavigationProp;
}

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Google Icon SVG Component
const GoogleIcon = () => (
  <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#4285f4' }}>G</Text>
  </View>
);

// Facebook Icon SVG Component  
const FacebookIcon = () => (
  <View style={{ width: 20, height: 20, backgroundColor: '#fff', borderRadius: 2, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ color: '#1877f2', fontSize: 16, fontWeight: 'bold' }}>f</Text>
  </View>
);

export default function SignInScreen({ navigation }: SignInScreenProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setMessage('Please enter your email');
      setMessageType('error');
      return;
    }

    if (!isValidEmail(email)) {
      setMessage('Please enter a valid email address');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage('');
    setMessageType(null);

    try {
      // Optional: Check if user exists via web app API
      const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL;
      if (webAppUrl) {
        try {
          const checkResponse = await fetch(`${webAppUrl}/api/auth/check-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });

          if (checkResponse.ok) {
            const checkData = await checkResponse.json();
            if (checkData.exists === false) {
              setMessage('A user with this email wasn\'t found. Would you like to sign up instead?');
              setMessageType('error');
              setLoading(false);
              return;
            }
          }
        } catch (checkError) {
          // If check fails, continue with normal flow
          console.error('Error checking user:', checkError);
        }
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: 'datingapp://auth/callback',
          shouldCreateUser: false,
        },
      });

      if (error) {
        // Check for rate limit errors
        if (
          error.message.toLowerCase().includes('rate limit') ||
          error.message.toLowerCase().includes('too many requests') ||
          error.status === 429
        ) {
          setMessage('Too many requests. Please wait about an hour before requesting another magic link, or use the dev sign-in button for testing.');
          setMessageType('error');
        } else if (
          error.message.toLowerCase().includes('user not found') ||
          error.message.toLowerCase().includes('does not exist') ||
          error.message.toLowerCase().includes('no user found') ||
          error.message.toLowerCase().includes('signups not allowed') ||
          error.message.toLowerCase().includes('signup not allowed')
        ) {
          setMessage('A user with this email wasn\'t found. Would you like to sign up instead?');
          setMessageType('error');
        } else {
          setMessage(error.message);
          setMessageType('error');
        }
      } else {
        setMessage('Check your email for the magic link!');
        setMessageType('success');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setMessage('An error occurred. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessage('');
    setMessageType(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'datingapp://auth/callback',
        },
      });

      if (error) {
        setMessage(error.message);
        setMessageType('error');
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      setMessage('An error occurred. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    setLoading(true);
    setMessage('');
    setMessageType(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: 'datingapp://auth/callback',
        },
      });

      if (error) {
        setMessage(error.message);
        setMessageType('error');
      }
    } catch (error) {
      console.error('Facebook sign in error:', error);
      setMessage('An error occurred. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView 
      contentContainerStyle={styles.scrollContent}
      style={styles.scrollView}
    >
      <View style={styles.gradientBackground}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.emoji}>🎭</Text>
            <Text style={styles.title}>Sign In</Text>
          </View>

          {message ? (
            <View style={[
              styles.messageContainer,
              messageType === 'error' ? styles.errorMessage : styles.successMessage
            ]}>
              <Text style={[
                styles.messageText,
                messageType === 'error' ? styles.errorText : styles.successText
              ]}>
                {message.includes("A user with this email wasn't found") ? (
                  <>
                    A user with this email wasn't found. Would you like to{' '}
                    <Text 
                      style={styles.linkText}
                      onPress={() => navigation.navigate('SignUp')}
                    >
                      sign up
                    </Text>
                    {' '}instead?
                  </>
                ) : (
                  message
                )}
              </Text>
            </View>
          ) : null}

          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={[styles.oauthButton, loading && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              <GoogleIcon />
              <Text style={styles.oauthButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.oauthButton, styles.facebookButton, loading && styles.buttonDisabled]}
              onPress={handleFacebookSignIn}
              disabled={loading}
            >
              <FacebookIcon />
              <Text style={styles.facebookButtonText}>Continue with Facebook</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.emailForm}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.magicLinkButton, loading && styles.buttonDisabled]}
                onPress={handleMagicLink}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.magicLinkButtonText}>Send Magic Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* DEV-ONLY: Remove this component to disable dev sign-in */}
          <DevSignInButton
            onMessageChange={(msg, type) => {
              setMessage(msg);
              setMessageType(type);
            }}
            loading={loading}
            setLoading={setLoading}
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('SignUp')}
            disabled={loading}
            style={styles.footerLink}
          >
            <Text style={styles.footerText}>
              Don't have an account? <Text style={styles.footerLinkText}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  gradientBackground: {
    flex: 1,
    backgroundColor: '#fdf2f8', // pink-50
    background: 'linear-gradient(to bottom right, #fdf2f8, #fef2f2)', // from-pink-50 to-red-50
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 448,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    padding: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827', // gray-900
  },
  messageContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
  },
  errorMessage: {
    backgroundColor: '#fee2e2', // red-50
  },
  successMessage: {
    backgroundColor: '#d1fae5', // green-50
  },
  messageText: {
    fontSize: 14,
  },
  errorText: {
    color: '#991b1b', // red-800
  },
  successText: {
    color: '#065f46', // green-800
  },
  linkText: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  buttonsContainer: {
    gap: 16,
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d1d5db', // gray-300
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  facebookButton: {
    backgroundColor: '#1877f2', // Facebook blue
    borderColor: '#1877f2',
  },
  oauthButtonText: {
    color: '#374151', // gray-700
    fontSize: 16,
    fontWeight: '600',
  },
  facebookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#d1d5db', // gray-300
  },
  dividerText: {
    paddingHorizontal: 8,
    color: '#6b7280', // gray-500
    fontSize: 14,
    backgroundColor: '#fff',
  },
  emailForm: {
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151', // gray-700
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db', // gray-300
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  magicLinkButton: {
    backgroundColor: '#dc2626', // primary-600 / red-600
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  magicLinkButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footerLink: {
    marginTop: 24,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#4b5563', // gray-600
  },
  footerLinkText: {
    color: '#dc2626', // primary-600
    textDecorationLine: 'underline',
  },
});
