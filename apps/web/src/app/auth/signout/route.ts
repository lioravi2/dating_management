import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { track, isAmplitudeInitialized } from '@/lib/analytics/server';

export async function POST(request: Request) {
  const supabase = createSupabaseRouteHandlerClient();
  
  // Get user session BEFORE signing out (needed for analytics tracking)
  let userId: string | undefined;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      userId = session.user.id;
      console.log('[Sign Out] ========== Tracking [User Signed Out] event ==========');
      const now = Date.now();
      const isInitialized = isAmplitudeInitialized();
      const hasApiKey = !!process.env.AMPLITUDE_API_KEY;
      
      console.log('[Sign Out] Before track() call:', {
        eventName: '[User Signed Out]',
        userId: userId,
        isInitialized,
        hasApiKey,
        timestamp: now
      });
      
      if (!hasApiKey) {
        console.warn('[Sign Out] AMPLITUDE_API_KEY not set - event will not be tracked');
      } else if (!isInitialized) {
        console.warn('[Sign Out] Amplitude not initialized - event may not be tracked');
      }
      
      // Track [User Signed Out] event before signing out
      // Await to ensure event is sent before sign out completes
      try {
        await track('[User Signed Out]', userId, {
          timestamp: now,
        });
        console.log('[Sign Out] After track() call: [User Signed Out] event tracked successfully');
      } catch (error) {
        // Don't fail the sign out if analytics fails
        console.error('[Sign Out] Error tracking [User Signed Out] event:', error);
      }
      console.log('[Sign Out] ========== [User Signed Out] tracking complete ==========');
    } else {
      console.log('[Sign Out] No active session found - skipping analytics tracking');
    }
  } catch (error) {
    console.error('[Sign Out] Error getting session for analytics:', error);
    // Continue with sign out even if analytics fails
  }
  
  // Sign out from Supabase
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Sign out error:', error);
  }
  
  // Clear all Supabase-related cookies
  const cookieStore = cookies();
  const cookieNames = [
    'sb-access-token',
    'sb-refresh-token',
    'supabase-auth-token',
  ];
  
  // Get all cookies and clear Supabase ones
  cookieStore.getAll().forEach((cookie) => {
    if (cookie.name.includes('supabase') || cookie.name.includes('sb-')) {
      cookieStore.delete(cookie.name);
    }
  });
  
  const requestUrl = new URL(request.url);
  const response = NextResponse.redirect(new URL('/', requestUrl.origin));
  
  // Also clear cookies in the response
  cookieNames.forEach((name) => {
    response.cookies.delete(name);
  });
  
  return response;
}

