import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { track } from '@/lib/analytics/server';

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseRouteHandlerClient();
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user profile exists
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('email_verified_at, last_login')
      .eq('id', session.user.id)
      .maybeSingle();

    // If profile doesn't exist, create it (fallback if database trigger failed)
    if (fetchError || !currentUser) {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: session.user.id,
          email: session.user.email || null,
          full_name: session.user.user_metadata?.full_name || null,
          email_verified_at: session.user.email_confirmed_at || null,
          last_login: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error creating user profile:', insertError);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      // Track [User Registered] event - new user profile created
      // Only user_id is included (NO UTM params, NO registration_method - tracked via UTM)
      try {
        await track('[User Registered]', session.user.id, {
          timestamp: new Date().toISOString(),
        });
      } catch (analyticsError) {
        // Don't fail the request if analytics fails
        console.error('Error tracking [User Registered] event:', analyticsError);
      }

      return NextResponse.json({ success: true, created: true });
    }

    // Profile exists - check if this is first login (registration) or subsequent login
    const isFirstLogin = currentUser.last_login === null;
    const now = new Date().toISOString();

    // Update last_login and email_verified_at
    const updateData: any = {
      last_login: now,
    };

    // Only set email_verified_at if it's currently null and email is now confirmed
    if (!currentUser.email_verified_at && session.user.email_confirmed_at) {
      updateData.email_verified_at = session.user.email_confirmed_at;
    }

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Error updating user profile:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Track appropriate event based on whether this is first login
    try {
      if (isFirstLogin) {
        // First login after registration - track [User Registered]
        // Only user_id is included (NO UTM params, NO registration_method - tracked via UTM)
        await track('[User Registered]', session.user.id, {
          timestamp: now,
        });
      } else {
        // Subsequent login - track [User Signed In]
        // Only user_id is included (NO UTM params, NO registration_method - tracked via UTM)
        await track('[User Signed In]', session.user.id, {
          timestamp: now,
        });
      }
    } catch (analyticsError) {
      // Don't fail the request if analytics fails
      console.error('Error tracking authentication event:', analyticsError);
    }

    return NextResponse.json({ success: true, updated: true });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}







