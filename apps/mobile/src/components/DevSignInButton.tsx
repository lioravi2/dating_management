/**
 * DEV SIGN-IN COMPONENT
 * 
 * This component provides a sign-in button that bypasses magic links
 * for faster testing. It should be removed once production is stable.
 * 
 * To remove:
 * 1. Delete this file
 * 2. Remove the import and usage from SignInScreen.tsx
 * 3. Optionally delete apps/web/src/app/api/auth/dev-signin/route.ts
 */

import { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase/client';

interface DevSignInButtonProps {
  onMessageChange: (message: string, type: 'success' | 'error' | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export default function DevSignInButton({ onMessageChange, loading, setLoading }: DevSignInButtonProps) {
  const handleDevSignIn = async () => {
    setLoading(true);
    onMessageChange('', null);

    try {
      const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL;
      
      if (!webAppUrl) {
        onMessageChange('Web app URL not configured. Set EXPO_PUBLIC_WEB_APP_URL in .env', 'error');
        setLoading(false);
        return;
      }

      const apiUrl = `${webAppUrl}/api/auth/dev-signin`;
      console.log('[DEV-SIGNIN] Calling API:', apiUrl);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'avilior@hotmail.com' }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          onMessageChange(errorData.error || 'Dev sign-in failed', 'error');
          setLoading(false);
          return;
        }

        const data = await response.json();

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });

        if (sessionError) {
          onMessageChange(sessionError.message, 'error');
        } else {
          onMessageChange('Dev sign-in successful!', 'success');
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError?.name === 'AbortError') {
          onMessageChange('Request timed out. Please check your network connection and try again.', 'error');
        } else {
          throw fetchError;
        }
      }
    } catch (error) {
      console.error('[DEV-SIGNIN] Error details:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Provide more helpful error messages
      if (errorMsg.includes('Network request failed') || errorMsg.includes('Failed to fetch')) {
        const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || 'not configured';
        const isLocalUrl = webAppUrl.includes('localhost') || 
                          webAppUrl.includes('127.0.0.1') || 
                          /^http:\/\/192\.168\.\d+\.\d+/.test(webAppUrl) ||
                          /^http:\/\/10\.\d+\.\d+\.\d+/.test(webAppUrl);
        
        if (isLocalUrl) {
          onMessageChange(`Cannot connect to local development server at ${webAppUrl}. Make sure the web app is running and accessible from your device.`, 'error');
        } else {
          onMessageChange('Network error: Cannot reach the web app server. Please check your internet connection and that the server is running.', 'error');
        }
      } else {
        onMessageChange(`Dev sign-in failed: ${errorMsg}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, styles.devButton, loading && styles.buttonDisabled]}
      onPress={handleDevSignIn}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>🔧 Dev Sign In</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#dc2626',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  devButton: {
    backgroundColor: '#fbbf24',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});


