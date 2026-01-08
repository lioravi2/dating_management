import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { NextResponse, NextRequest } from 'next/server';
import { track, isAmplitudeInitialized } from '@/lib/analytics/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  // Comprehensive logging: Route entry point
  console.log('[Auth] ========== update-profile route called ==========');
  const routeStartTime = Date.now();
  
  try {
    // Check for Bearer token in headers (fallback if cookies aren't synced yet)
    const authHeader = request.headers.get('authorization');
    let supabase = createSupabaseRouteHandlerClient();
    let session;
    let user;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Access token passed directly in header (fallback for timing issues)
      const accessToken = authHeader.substring(7);
      console.log('[Auth] Using Bearer token from header');
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
        console.log('[Auth] Route entry: Bearer token authentication failed', { 
          hasUserError: !!userError, 
          hasUser: !!tokenUser,
          userError: userError?.message 
        });
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      user = tokenUser;
      // Create a session-like object for compatibility
      session = { user: tokenUser };
    } else {
      // Use cookies (normal flow)
      console.log('[Auth] Using cookies for authentication');
      // Use getUser() instead of getSession() - more reliable for API routes
      const { data: { user: cookieUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !cookieUser) {
        console.log('[Auth] Route entry: Cookie authentication failed', { 
          hasUserError: !!userError, 
          hasUser: !!cookieUser,
          userError: userError?.message 
        });
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      user = cookieUser;
      // Get session for compatibility
      const { data: { session: cookieSession } } = await supabase.auth.getSession();
      session = cookieSession;
    }
    
    if (!user || !session) {
      console.log('[Auth] Route entry: No user or session after authentication');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Log session user ID
    console.log('[Auth] Route entry: Authenticated user', { 
      userId: user.id,
      email: user.email,
      emailConfirmed: !!user.email_confirmed_at,
      authMethod: authHeader ? 'Bearer token' : 'cookies'
    });

    // Check if user profile exists
    console.log('[Auth] Database query: Checking if profile exists for user:', user.id);
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('email_verified_at, last_login')
      .eq('id', user.id)
      .maybeSingle();

    // Log database query results
    console.log('[Auth] Database query results:', {
      hasError: !!fetchError,
      error: fetchError?.message,
      profileExists: !!currentUser,
      emailVerifiedAt: currentUser?.email_verified_at || null,
      lastLogin: currentUser?.last_login || null,
      lastLoginIsNull: currentUser?.last_login === null
    });

    // If profile doesn't exist, create it (fallback if database trigger failed)
    if (fetchError || !currentUser) {
      console.log('[Auth] Decision logic: Profile does not exist - creating new profile');
      
      const now = new Date().toISOString();
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email || null,
          full_name: user.user_metadata?.full_name || null,
          email_verified_at: user.email_confirmed_at || null,
          last_login: now,
        });

      if (insertError) {
        console.error('[Auth] Error creating user profile:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      console.log('[Auth] Profile created successfully');

      // Track [User Registered] event - new user profile created
      // Only user_id is included (NO UTM params, NO registration_method - tracked via UTM)
      // Await track() to ensure event is sent before route handler returns (important for serverless)
      console.log('[Auth] ========== Tracking [User Registered] event ==========');
      const isInitialized = isAmplitudeInitialized();
      const hasApiKey = !!process.env.AMPLITUDE_API_KEY;
        console.log('[Auth] Before track() call:', {
          eventName: '[User Registered]',
          userId: user.id,
          isInitialized,
          hasApiKey,
          timestamp: now
        });
        
        if (!hasApiKey) {
          console.warn('[Auth] AMPLITUDE_API_KEY not set - event will not be tracked');
        } else if (!isInitialized) {
          console.warn('[Auth] Amplitude not initialized - event may not be tracked');
        }
        
        // Await to ensure event is sent before route handler returns
        try {
          await track('[User Registered]', user.id, {
            timestamp: now,
          });
        console.log('[Auth] After track() call: [User Registered] event tracked successfully');
      } catch (error) {
        // Don't fail the request if analytics fails
        console.error('[Auth] Error tracking [User Registered] event:', error);
      }
      console.log('[Auth] ========== [User Registered] tracking complete ==========');

      const routeDuration = Date.now() - routeStartTime;
      console.log('[Auth] ========== update-profile route completed (new user) ==========', { duration: `${routeDuration}ms` });
      return NextResponse.json({ success: true, created: true });
    }

    // Profile exists - this is an existing user signing in
    // NOTE: [User Signed In] event tracking is now handled by middleware (apps/web/src/middleware.ts)
    // The middleware automatically detects fresh sign-ins and tracks the event, so we don't track here
    // to avoid duplicate events. The middleware will track when the user makes their first authenticated
    // request after the profile update completes.
    console.log('[Auth] Decision logic: Profile exists - existing user sign-in');
    console.log('[Auth] Decision logic: [User Signed In] tracking handled by middleware (not tracked here to avoid duplicates)');
    
    const now = new Date().toISOString();

    // Update last_login and email_verified_at
    const updateData: any = {
      last_login: now,
    };

    // Only set email_verified_at if it's currently null and email is now confirmed
    if (!currentUser.email_verified_at && user.email_confirmed_at) {
      updateData.email_verified_at = user.email_confirmed_at;
      console.log('[Auth] Database update: Setting email_verified_at:', user.email_confirmed_at);
    }

    console.log('[Auth] Database update: Updating profile with:', updateData);
    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('[Auth] Error updating user profile:', updateError);
      // Don't return error - tracking already happened, just log the error
      console.warn('[Auth] Continuing despite database update error (tracking already completed)');
    } else {
      console.log('[Auth] Profile updated successfully');
    }

    const routeDuration = Date.now() - routeStartTime;
    console.log('[Auth] ========== update-profile route completed (existing user) ==========', { duration: `${routeDuration}ms` });
    return NextResponse.json({ success: true, updated: true });
  } catch (error: any) {
    const routeDuration = Date.now() - routeStartTime;
    console.error('[Auth] ========== update-profile route error ==========', {
      error: error.message,
      stack: error.stack,
      duration: `${routeDuration}ms`
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}







