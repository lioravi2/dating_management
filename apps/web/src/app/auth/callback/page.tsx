'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createSupabaseClient();

      // Check for hash fragment (access_token, etc.)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const error = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');

      // Check for query parameters (code from PKCE flow)
      const code = searchParams.get('code');
      const errorCode = searchParams.get('error_code');
      const errorDesc = searchParams.get('error_description');

      // Handle errors
      if (error || errorCode || errorDesc || errorDescription) {
        const errorMsg = errorDescription || errorDesc || error || 'Authentication failed';
        router.push(`/auth/signin?error=${encodeURIComponent(errorMsg)}`);
        return;
      }

      // If we have a code, exchange it for a session (PKCE flow)
      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error('Error exchanging code for session:', exchangeError);
          router.push(`/auth/signin?error=${encodeURIComponent(exchangeError.message)}`);
          return;
        }

        if (!data.session) {
          console.error('No session created after code exchange');
          router.push('/auth/signin?error=Failed to create session');
          return;
        }

        // Update user profile (last_login, email_verified_at, create if needed)
        try {
          await fetch('/api/auth/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Error updating profile:', error);
          // Don't fail login if profile update fails
        }

        // Success - redirect to dashboard
        router.push('/dashboard');
        return;
      }

      // If we have access_token in hash, set the session directly (implicit flow)
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          console.error('Error setting session:', sessionError);
          router.push(`/auth/signin?error=${encodeURIComponent(sessionError.message)}`);
          return;
        }

        // Update user profile (last_login, email_verified_at, create if needed)
        try {
          await fetch('/api/auth/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Error updating profile:', error);
          // Don't fail login if profile update fails
        }

        // Success - redirect to dashboard
        router.push('/dashboard');
        return;
      }

      // No valid auth data found
      router.push('/auth/signin?error=No authorization code provided');
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🎭</div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}

