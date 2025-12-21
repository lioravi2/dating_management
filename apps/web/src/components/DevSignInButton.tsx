/**
 * DEV SIGN-IN COMPONENT
 * 
 * This component provides a sign-in button that bypasses magic links
 * for faster testing. It should be removed once production is stable.
 * 
 * To remove:
 * 1. Delete this file
 * 2. Remove the import and usage from apps/web/src/app/auth/signin/page.tsx
 * 3. Optionally delete apps/web/src/app/api/auth/dev-signin/route.ts
 */

'use client';

import { useState } from 'react';
import { createSupabaseClient } from '@/lib/supabase/client';
import { environment } from '@/lib/environment';

interface DevSignInButtonProps {
  disabled?: boolean;
}

export default function DevSignInButton({ disabled = false }: DevSignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseClient();

  const handleDevSignIn = async () => {
    if (loading || disabled) return;

    setLoading(true);
    setError(null);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const apiUrl = `${origin}/api/auth/dev-signin`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'avilior@hotmail.com' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        setError(errorData.error || 'Dev sign-in failed');
        setLoading(false);
        return;
      }

      const data = await response.json();

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (sessionError) {
        setError(sessionError.message);
      } else {
        // Redirect to dashboard on success
        environment.redirect('/dashboard');
      }
    } catch (error) {
      console.error('[DEV-SIGNIN] Error:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setError(`Dev sign-in failed: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={handleDevSignIn}
        disabled={loading || disabled}
        className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Signing in...</span>
          </>
        ) : (
          <>
            <span>🔧</span>
            <span>Dev Sign In</span>
          </>
        )}
      </button>
      {error && (
        <div className="mt-2 p-2 bg-red-50 text-red-800 rounded text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

