import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { track, isAmplitudeInitialized } from '@/lib/analytics/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Dedicated endpoint for tracking [User Signed In] events
 * Called automatically by middleware when a fresh sign-in is detected
 * This ensures the event is tracked for ALL sign-in methods (magic link, dev, Facebook, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    // Check for Bearer token in headers (for mobile app support)
    const authHeader = request.headers.get('authorization');
    let supabase = createSupabaseRouteHandlerClient();
    let user;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Access token passed directly in header (mobile app)
      const accessToken = authHeader.substring(7);
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
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      user = tokenUser;
    } else {
      // Use cookies (normal web flow)
      const { data: { user: cookieUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !cookieUser) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
      user = cookieUser;
    }
    
    // Track [User Signed In] event
    // Only user_id is included (NO UTM params, NO registration_method - tracked via UTM)
    console.log('[Track SignIn] ========== Tracking [User Signed In] event ==========');
    const trackTimestamp = Date.now();
    const isInitialized = isAmplitudeInitialized();
    const hasApiKey = !!process.env.AMPLITUDE_API_KEY;
    
    console.log('[Track SignIn] Before track() call:', {
      eventName: '[User Signed In]',
      userId: user.id,
      isInitialized,
      hasApiKey,
      timestamp: trackTimestamp
    });
    
    if (!hasApiKey) {
      console.warn('[Track SignIn] AMPLITUDE_API_KEY not set - event will not be tracked');
    } else if (!isInitialized) {
      console.warn('[Track SignIn] Amplitude not initialized - event may not be tracked');
    }
    
    try {
      await track('[User Signed In]', user.id, {
        timestamp: trackTimestamp,
      });
      console.log('[Track SignIn] After track() call: [User Signed In] event tracked successfully');
    } catch (error) {
      console.error('[Track SignIn] Error tracking [User Signed In] event:', error);
      return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
    }
    
    console.log('[Track SignIn] ========== [User Signed In] tracking complete ==========');
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Track SignIn] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
