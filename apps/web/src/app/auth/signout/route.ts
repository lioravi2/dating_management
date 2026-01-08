import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { track, isAmplitudeInitialized } from '@/lib/analytics/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  // Check for Bearer token in headers (for mobile app support)
  const authHeader = request.headers.get('authorization');
  let supabase = createSupabaseRouteHandlerClient();
  let session;
  let user;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Access token passed directly in header (mobile app or fallback)
    const accessToken = authHeader.substring(7);
    console.log('[Sign Out] Using Bearer token from header');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
    
    const { data: { user: tokenUser }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !tokenUser) {
      console.log('[Sign Out] Bearer token authentication failed', { 
        hasUserError: !!userError, 
        hasUser: !!tokenUser,
        userError: userError?.message 
      });
      // For mobile, return JSON instead of redirect
      if (authHeader) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/', new URL(request.url).origin));
    }
    user = tokenUser;
    // Create a session-like object for compatibility
    session = { user: tokenUser };
  } else {
    // Use cookies (normal web flow)
    console.log('[Sign Out] Using cookies for authentication');
    const { data: { session: cookieSession } } = await supabase.auth.getSession();
    session = cookieSession;
    user = session?.user;
  }
  
  // Get user session BEFORE signing out (needed for analytics tracking)
  let userId: string | undefined;
  try {
    if (session?.user || user) {
      userId = (session?.user || user)?.id;
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
  
  // For mobile app (Bearer token), return JSON instead of redirect
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const response = NextResponse.json({ success: true });
    // Clear cookies in response (even though mobile doesn't use them)
    cookieNames.forEach((name) => {
      response.cookies.delete(name);
    });
    return response;
  }
  
  // For web app (cookies), return redirect
  const response = NextResponse.redirect(new URL('/', requestUrl.origin));
  
  // Also clear cookies in the response
  cookieNames.forEach((name) => {
    response.cookies.delete(name);
  });
  
  return response;
}

