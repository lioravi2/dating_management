import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

// In-memory cache to prevent duplicate tracking within a short time window
// Key: userId, Value: timestamp when tracking was attempted
const trackedSignIns = new Map<string, number>();
const TRACKING_WINDOW_MS = 30000; // 30 seconds - prevent duplicate tracking

/**
 * Middleware to automatically track [User Signed In] events
 * 
 * This middleware detects fresh sign-ins by checking if the user's last_login
 * was updated recently (within the last 30 seconds). When a fresh sign-in is
 * detected, it automatically calls the track-signin endpoint to log the event.
 * 
 * This ensures [User Signed In] events are tracked for ALL sign-in methods:
 * - Magic link sign-in
 * - Dev sign-in
 * - OAuth sign-in (Facebook, Google, etc.)
 * - Any future sign-in methods
 * 
 * The tracking happens automatically when the user makes their first
 * authenticated request after signing in, regardless of which route they hit.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Skip middleware for certain routes to avoid infinite loops or unnecessary processing
  const skipRoutes = [
    '/api/auth/track-signin',      // Don't track when calling track-signin itself
    '/api/auth/dev-signin',        // Dev sign-in creates session, but we track after
    '/api/auth/update-profile',    // Update-profile already has its own tracking logic
    '/auth/signout',               // Sign out route
    '/auth/callback',              // Auth callback page (handles its own flow)
    '/_next',                      // Next.js internal routes
    '/static',                     // Static assets
    '/favicon.ico',                // Favicon
  ];
  
  if (skipRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Only check authenticated routes (skip public routes)
  // Check for authentication via cookies (web) or Bearer token (mobile)
  const authHeader = request.headers.get('authorization');
  let supabase = createSupabaseRouteHandlerClient();
  let user;
  let accessToken: string | null = null;
  
  try {
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Mobile app or Bearer token authentication
      accessToken = authHeader.substring(7);
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
        // Not authenticated, continue without tracking
        return NextResponse.next();
      }
      user = tokenUser;
    } else {
      // Web app - use cookies
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        // Not authenticated, continue without tracking
        return NextResponse.next();
      }
      user = session.user;
      accessToken = session.access_token || null;
    }
    
    // Check if we've already tracked this sign-in recently (prevent duplicates)
    const lastTracked = trackedSignIns.get(user.id);
    const now = Date.now();
    if (lastTracked && (now - lastTracked) < TRACKING_WINDOW_MS) {
      // Already tracked recently, skip
      return NextResponse.next();
    }
    
    // Check if this is a fresh sign-in by checking last_login timestamp
    // If last_login was updated within the last 30 seconds, this is likely a new sign-in
    const { data: userData } = await supabase
      .from('users')
      .select('last_login')
      .eq('id', user.id)
      .single();
    
    if (userData?.last_login) {
      const lastLoginTime = new Date(userData.last_login).getTime();
      const timeSinceLogin = now - lastLoginTime;
      
      // If last_login was updated in the last 30 seconds, this is a fresh sign-in
      if (timeSinceLogin < 30000 && timeSinceLogin >= 0) {
        // Mark as tracked to prevent duplicates
        trackedSignIns.set(user.id, now);
        
        // Clean up old entries from cache (keep only recent entries)
        if (trackedSignIns.size > 1000) {
          const cutoff = now - TRACKING_WINDOW_MS;
          for (const [userId, timestamp] of trackedSignIns.entries()) {
            if (timestamp < cutoff) {
              trackedSignIns.delete(userId);
            }
          }
        }
        
        // Trigger tracking asynchronously (don't block the request)
        // Fire and forget - tracking is best effort
        const origin = request.nextUrl.origin;
        fetch(`${origin}/api/auth/track-signin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          },
          // Don't await - this is fire and forget to avoid blocking the request
        }).catch((error) => {
          // Silently fail - tracking shouldn't block user requests
          console.error('[Middleware] Error calling track-signin endpoint:', error);
        });
        
        console.log('[Middleware] Detected fresh sign-in, triggering [User Signed In] tracking:', {
          userId: user.id,
          timeSinceLogin: `${Math.round(timeSinceLogin / 1000)}s`,
        });
      }
    }
  } catch (error) {
    // Silently fail - middleware errors shouldn't break the app
    console.error('[Middleware] Error in sign-in tracking middleware:', error);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
