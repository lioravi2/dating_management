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

      // Check for hash fragment (access_token, etc.)
      const hashParams = environment.getHashParams();
      const accessToken = hashParams.access_token;
      const refreshToken = hashParams.refresh_token;
      const error = hashParams.error;
      const errorDescription = hashParams.error_description;

      // Check for query parameters (code from PKCE flow)
      const code = searchParams.get('code');
      const errorCode = searchParams.get('error_code');
      const errorDesc = searchParams.get('error_description');

      // Handle errors
      if (error || errorCode || errorDesc || errorDescription) {
        const errorMsg = errorDescription || errorDesc || error || 'Authentication failed';
        navigation.push('/auth/signin', { error: errorMsg });
        return;
      }

      // If we have a code, exchange it for a session (PKCE flow)
      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error('Error exchanging code for session:', exchangeError);
          environment.redirect(`/auth/signin?error=${encodeURIComponent(exchangeError.message)}`);
          return;
        }

        if (!data.session) {
          console.error('No session created after code exchange');
          environment.redirect('/auth/signin?error=Failed to create session');
          return;
        }

        // Verify session is set by checking it again
        const { data: { session: verifiedSession } } = await supabase.auth.getSession();
        if (!verifiedSession) {
          console.error('Session not found after exchange');
          environment.redirect('/auth/signin?error=Session verification failed');
          return;
        }

        // Update user profile and verify session is accessible from server
        // This ensures cookies are properly set before redirecting
        try {
          const profileResponse = await fetch('/api/auth/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (!profileResponse.ok) {
            console.error('Profile update failed, but continuing with login');
          }
        } catch (error) {
          console.error('Error updating profile:', error);
          // Don't fail login if profile update fails
        }

        // Wait a moment for cookies to sync, then redirect
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Clear hash and redirect to dashboard with full page reload
        environment.clearHash();
        environment.redirect('/dashboard');
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
          environment.redirect(`/auth/signin?error=${encodeURIComponent(sessionError.message)}`);
          return;
        }

        // Verify session is set by checking it again
        const { data: { session: verifiedSession } } = await supabase.auth.getSession();
        if (!verifiedSession) {
          console.error('Session not found after setSession');
          environment.redirect('/auth/signin?error=Session verification failed');
          return;
        }

        // Update user profile and verify session is accessible from server
        // This ensures cookies are properly set before redirecting
        try {
          const profileResponse = await fetch('/api/auth/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (!profileResponse.ok) {
            console.error('Profile update failed, but continuing with login');
          }
        } catch (error) {
          console.error('Error updating profile:', error);
          // Don't fail login if profile update fails
        }

        // Wait a moment for cookies to sync, then redirect
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Clear hash and redirect to dashboard with full page reload
        environment.clearHash();
        environment.redirect('/dashboard');
        return;
      }

      // No valid auth data found
      environment.redirect('/auth/signin?error=No authorization code provided');
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

