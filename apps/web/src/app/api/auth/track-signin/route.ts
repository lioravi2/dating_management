import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { track, isAmplitudeInitialized } from '@/lib/analytics/server';
import { createClient } from '@supabase/supabase-js';

// In-memory cache to prevent duplicate tracking within a short time window
// Key: userId, Value: timestamp when tracking was attempted
const trackedSignIns = new Map<string, number>();
const TRACKING_WINDOW_MS = 30000; // 30 seconds - prevent duplicate tracking

/**
 * Dedicated endpoint for tracking [User Signed In] events
 * Called automatically by middleware when a fresh sign-in is detected
 * This ensures the event is tracked for ALL sign-in methods (magic link, dev, Facebook, etc.)
 * 
 * NOTE: This endpoint includes its own deduplication to prevent duplicate events
 * even if called multiple times (e.g., from different serverless instances)
 */
export async function POST(request: NextRequest) {
  try {
    const now = Date.now();
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
    
    // Deduplication: Check if we've already tracked this sign-in recently
    // This prevents duplicate events even if called from different serverless instances
    const lastTracked = trackedSignIns.get(user.id);
    if (lastTracked && (now - lastTracked) < TRACKING_WINDOW_MS) {
      console.log('[Track SignIn] Duplicate tracking prevented - already tracked recently:', {
        userId: user.id,
        timeSinceLastTrack: `${Math.round((now - lastTracked) / 1000)}s`,
      });
      return NextResponse.json({ success: true, skipped: true, reason: 'duplicate' });
    }
    
    // Mark as tracked immediately to prevent concurrent requests from also tracking
    trackedSignIns.set(user.id, now);
    
    // Clean up old entries from cache
    if (trackedSignIns.size > 1000) {
      const cutoff = now - TRACKING_WINDOW_MS;
      for (const [userId, timestamp] of trackedSignIns.entries()) {
        if (timestamp < cutoff) {
          trackedSignIns.delete(userId);
        }
      }
    }
    
    // Track [User Signed In] event
    // Only user_id is included (NO UTM params, NO registration_method - tracked via UTM)
    console.log('[Track SignIn] ========== Tracking [User Signed In] event ==========');
    const trackTimestamp = now;
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
      // Generate a stable insert_id for this sign-in session to prevent duplicates in Amplitude
      // Format: "signed-in-{user_id}-{rounded_timestamp_to_nearest_minute}"
      // This ensures that if the same sign-in is tracked multiple times within the same minute,
      // Amplitude will deduplicate it. Using rounded timestamp (to nearest minute) ensures
      // the same sign-in session gets the same insert_id even if tracked slightly later.
      const roundedTimestamp = Math.floor(trackTimestamp / 60000) * 60000; // Round to nearest minute
      const insertId = `signed-in-${user.id}-${roundedTimestamp}`;
      
      await track('[User Signed In]', user.id, {
        timestamp: trackTimestamp,
        insert_id: insertId, // Amplitude will deduplicate events with the same insert_id
      });
      console.log('[Track SignIn] After track() call: [User Signed In] event tracked successfully', {
        insertId,
      });
    } catch (error) {
      // If tracking fails, remove from cache so it can be retried
      trackedSignIns.delete(user.id);
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
