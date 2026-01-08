'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { environment } from '@/lib/environment';
import { useNavigation } from '@/lib/navigation';

export default function AuthCallbackPage() {
  const navigation = useNavigation();
  const searchParams = useSearchParams();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent multiple executions
    if (hasProcessed.current) {
      return;
    }

    const handleCallback = async () => {
      hasProcessed.current = true;
      const supabase = createSupabaseClient();

      // Check for hash fragment (access_token, etc.) - Magic links use this
      const hashParams = environment.getHashParams();
      const accessToken = hashParams.access_token;
      const refreshToken = hashParams.refresh_token;
      const error = hashParams.error;
      const errorDescription = hashParams.error_description;

      // Check for query parameters (code from PKCE flow - OAuth uses this)
      const code = searchParams.get('code');
      const errorCode = searchParams.get('error_code');
      const errorDesc = searchParams.get('error_description');
      const token = searchParams.get('token'); // Magic link token in query params
      const type = searchParams.get('type'); // Magic link type

      // Handle errors first
      if (error || errorCode || errorDesc || errorDescription) {
        const errorMsg = errorDescription || errorDesc || error || 'Authentication failed';
        navigation.push('/auth/signin', { error: errorMsg });
        return;
      }

      // Priority 1: If we have tokens in hash (magic link implicit flow), use them directly
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          console.error('Error setting session:', sessionError);
          navigation.push('/auth/signin', { error: sessionError.message });
          return;
        }

        // Verify session is set
        const { data: { session: verifiedSession } } = await supabase.auth.getSession();
        if (!verifiedSession) {
          console.error('Session not found after setSession');
          navigation.push('/auth/signin', { error: 'Session verification failed' });
          return;
        }

        // Wait for session to sync to cookies before calling update-profile
        // This ensures the server-side route can read the session from cookies
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update profile
        console.log('[Auth Callback] Calling /api/auth/update-profile...');
        console.log('[Auth Callback] Session before fetch:', {
          userId: verifiedSession?.user?.id,
          email: verifiedSession?.user?.email,
          hasAccessToken: !!verifiedSession?.access_token,
        });
        try {
          const profileResponse = await fetch('/api/auth/update-profile', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              // Pass access token in header as fallback if cookies aren't synced yet
              ...(verifiedSession?.access_token ? {
                'Authorization': `Bearer ${verifiedSession.access_token}`
              } : {}),
            },
            credentials: 'include', // Ensure cookies are sent
          });
          const responseData = await profileResponse.json().catch(() => ({}));
          console.log('[Auth Callback] Profile response status:', profileResponse.status);
          console.log('[Auth Callback] Profile response data:', responseData);
          if (!profileResponse.ok) {
            console.error('[Auth Callback] Profile update failed:', {
              status: profileResponse.status,
              statusText: profileResponse.statusText,
              data: responseData,
            });
          } else {
            console.log('[Auth Callback] Profile update successful:', responseData);
          }
        } catch (error) {
          console.error('[Auth Callback] Error updating profile:', error);
        }
        // Use Next.js navigation instead of full page reload to preserve session
        navigation.push('/dashboard');
        return;
      }

      // Priority 2: If we have a magic link token in query params, verify it
      if (token && type) {
        const email = searchParams.get('email');
        if (email) {
          const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
            type: type as 'magiclink' | 'email',
            token: token,
            email: email,
          });

          if (!otpError && otpData?.session) {
            // Verify session is set
            const { data: { session: verifiedSession } } = await supabase.auth.getSession();
            if (verifiedSession) {
              // Wait for session to sync to cookies before calling update-profile
              await new Promise(resolve => setTimeout(resolve, 1000));

              // Update profile
              console.log('[Auth Callback] Calling /api/auth/update-profile...');
              console.log('[Auth Callback] Session before fetch:', {
                userId: verifiedSession?.user?.id,
                email: verifiedSession?.user?.email,
                hasAccessToken: !!verifiedSession?.access_token,
              });
              try {
                const profileResponse = await fetch('/api/auth/update-profile', {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    // Pass access token in header as fallback if cookies aren't synced yet
                    ...(verifiedSession?.access_token ? {
                      'Authorization': `Bearer ${verifiedSession.access_token}`
                    } : {}),
                  },
                  credentials: 'include', // Ensure cookies are sent
                });
                const responseData = await profileResponse.json().catch(() => ({}));
                console.log('[Auth Callback] Profile response status:', profileResponse.status);
                console.log('[Auth Callback] Profile response data:', responseData);
                if (!profileResponse.ok) {
                  console.error('[Auth Callback] Profile update failed:', {
                    status: profileResponse.status,
                    statusText: profileResponse.statusText,
                    data: responseData,
                  });
                } else {
                  console.log('[Auth Callback] Profile update successful:', responseData);
                }
              } catch (error) {
                console.error('[Auth Callback] Error updating profile:', error);
              }
              // Use Next.js navigation instead of full page reload to preserve session
              navigation.push('/dashboard');
              return;
            }
          } else if (otpError) {
            console.error('Error verifying OTP:', otpError);
            navigation.push('/auth/signin', { error: otpError.message });
            return;
          }
        }
      }

      // Priority 3: If we have a code, exchange it for a session (PKCE flow - OAuth)
      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error('Error exchanging code for session:', exchangeError);
          // If it's a code verifier error, provide helpful message
          if (exchangeError.message.includes('code verifier') || exchangeError.message.includes('non-empty')) {
            navigation.push('/auth/signin', { error: 'Authentication session expired. Please try signing in again.' });
          } else {
            navigation.push('/auth/signin', { error: exchangeError.message });
          }
          return;
        }

        if (!data.session) {
          console.error('No session created after code exchange');
          navigation.push('/auth/signin', { error: 'Failed to create session' });
          return;
        }

        // Verify session is set
        const { data: { session: verifiedSession } } = await supabase.auth.getSession();
        if (!verifiedSession) {
          console.error('Session not found after exchange');
          navigation.push('/auth/signin', { error: 'Session verification failed' });
          return;
        }

        // Wait for session to sync to cookies before calling update-profile
        // This ensures the server-side route can read the session from cookies
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update profile
        console.log('[Auth Callback] Calling /api/auth/update-profile...');
        console.log('[Auth Callback] Session before fetch:', {
          userId: verifiedSession?.user?.id,
          email: verifiedSession?.user?.email,
          hasAccessToken: !!verifiedSession?.access_token,
        });
        try {
          const profileResponse = await fetch('/api/auth/update-profile', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              // Pass access token in header as fallback if cookies aren't synced yet
              ...(verifiedSession?.access_token ? {
                'Authorization': `Bearer ${verifiedSession.access_token}`
              } : {}),
            },
            credentials: 'include', // Ensure cookies are sent
          });
          const responseData = await profileResponse.json().catch(() => ({}));
          console.log('[Auth Callback] Profile response status:', profileResponse.status);
          console.log('[Auth Callback] Profile response data:', responseData);
          if (!profileResponse.ok) {
            console.error('[Auth Callback] Profile update failed:', {
              status: profileResponse.status,
              statusText: profileResponse.statusText,
              data: responseData,
            });
          } else {
            console.log('[Auth Callback] Profile update successful:', responseData);
          }
        } catch (error) {
          console.error('[Auth Callback] Error updating profile:', error);
        }
        // Use Next.js navigation instead of full page reload to preserve session
        navigation.push('/dashboard');
        return;
      }

      // No valid auth data found
      navigation.push('/auth/signin', { error: 'No authorization code provided' });
    };

    handleCallback();
  }, [navigation, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🎭</div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
