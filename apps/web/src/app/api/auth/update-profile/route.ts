import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { track, isAmplitudeInitialized } from '@/lib/analytics/server';

export async function POST(request: Request) {
  // Comprehensive logging: Route entry point
  console.log('[Auth] ========== update-profile route called ==========');
  const routeStartTime = Date.now();
  
  try {
    const supabase = createSupabaseRouteHandlerClient();
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.log('[Auth] Route entry: Authentication failed', { 
        hasSessionError: !!sessionError, 
        hasSession: !!session,
        sessionError: sessionError?.message 
      });
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Log session user ID
    console.log('[Auth] Route entry: Authenticated user', { 
      userId: session.user.id,
      email: session.user.email,
      emailConfirmed: !!session.user.email_confirmed_at
    });

    // Check if user profile exists
    console.log('[Auth] Database query: Checking if profile exists for user:', session.user.id);
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('email_verified_at, last_login')
      .eq('id', session.user.id)
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
          id: session.user.id,
          email: session.user.email || null,
          full_name: session.user.user_metadata?.full_name || null,
          email_verified_at: session.user.email_confirmed_at || null,
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
        userId: session.user.id,
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
        await track('[User Registered]', session.user.id, {
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
    // FIXED: Remove isFirstLogin check based on last_login (database trigger sets it before this check)
    // Track [User Signed In] for ALL existing profile updates
    console.log('[Auth] Decision logic: Profile exists - existing user sign-in');
    console.log('[Auth] Decision logic: Will track [User Signed In] (not [User Registered])');
    
    const now = new Date().toISOString();

    // Update last_login and email_verified_at
    const updateData: any = {
      last_login: now,
    };

    // Only set email_verified_at if it's currently null and email is now confirmed
    if (!currentUser.email_verified_at && session.user.email_confirmed_at) {
      updateData.email_verified_at = session.user.email_confirmed_at;
      console.log('[Auth] Database update: Setting email_verified_at:', session.user.email_confirmed_at);
    }

    console.log('[Auth] Database update: Updating profile with:', updateData);
    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', session.user.id);

    if (updateError) {
      console.error('[Auth] Error updating user profile:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log('[Auth] Profile updated successfully');

    // Track [User Signed In] event for existing user
    // Only user_id is included (NO UTM params, NO registration_method - tracked via UTM)
    // Await track() to ensure event is sent before route handler returns (important for serverless)
    console.log('[Auth] ========== Tracking [User Signed In] event ==========');
    const isInitialized = isAmplitudeInitialized();
    const hasApiKey = !!process.env.AMPLITUDE_API_KEY;
    
    console.log('[Auth] Before track() call:', {
      eventName: '[User Signed In]',
      userId: session.user.id,
      isInitialized,
      hasApiKey,
      timestamp: now
    });
    
    if (!hasApiKey) {
      console.warn('[Auth] AMPLITUDE_API_KEY not set - event will not be tracked');
    } else if (!isInitialized) {
      console.warn('[Auth] Amplitude not initialized - event may not be tracked');
    }
    
    // Track [User Signed In] for all existing profile updates
    // Await to ensure event is sent before route handler returns
    try {
      await track('[User Signed In]', session.user.id, {
        timestamp: now,
      });
      console.log('[Auth] After track() call: [User Signed In] event tracked successfully');
    } catch (error) {
      // Don't fail the request if analytics fails
      console.error('[Auth] Error tracking [User Signed In] event:', error);
    }
    console.log('[Auth] ========== [User Signed In] tracking complete ==========');

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







