import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error_description = requestUrl.searchParams.get('error_description');
  const error_code = requestUrl.searchParams.get('error_code');

  // Handle errors from Supabase
  if (error_code || error_description) {
    console.error('Auth error:', { error_code, error_description });
    return NextResponse.redirect(
      new URL(
        `/auth/signin?error=${encodeURIComponent(error_description || 'Authentication failed')}`,
        requestUrl.origin
      )
    );
  }

  // If no code, the client-side page will handle hash fragments
  // Return the page HTML instead of redirecting to avoid loops
  if (!code) {
    // Let Next.js serve the page.tsx which can handle hash fragments on client
    return NextResponse.next();
  }

  const supabase = createSupabaseRouteHandlerClient();

  // Exchange code for session
  const { error, data } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Error exchanging code for session:', error);
    return NextResponse.redirect(
      new URL(`/auth/signin?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
    );
  }

  // Verify session was created
  if (!data.session) {
    console.error('No session created after code exchange');
    return NextResponse.redirect(
      new URL('/auth/signin?error=Failed to create session', requestUrl.origin)
    );
  }

  // Update last_login and email_verified_at in users table
  // Also create profile if it doesn't exist (e.g., if manually deleted)
  try {
    // Check if user profile exists
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('email_verified_at')
      .eq('id', data.session.user.id)
      .maybeSingle(); // Use maybeSingle() instead of single() - returns null if no row found

    // If profile doesn't exist (error or null data), create it
    if (fetchError || !currentUser) {
      console.log('User profile not found, creating new profile...');
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: data.session.user.id,
          email: data.session.user.email || null,
          full_name: data.session.user.user_metadata?.full_name || null,
          email_verified_at: data.session.user.email_confirmed_at || null,
          last_login: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error creating user profile:', insertError);
      } else {
        console.log('User profile created successfully');
      }
    } else {
      // Profile exists - update last_login and email_verified_at
      const updateData: any = {
        last_login: new Date().toISOString(),
      };

      // Only set email_verified_at if it's currently null and email is now confirmed
      if (!currentUser.email_verified_at && data.session.user.email_confirmed_at) {
        updateData.email_verified_at = data.session.user.email_confirmed_at;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', data.session.user.id);

      if (updateError) {
        console.error('Error updating user profile:', updateError);
      }
    }
  } catch (updateError) {
    console.error('Error updating user login info:', updateError);
    // Don't fail the login if this update fails
  }

  console.log('Session created successfully, redirecting to dashboard');
  
  // Success - redirect to dashboard
  return NextResponse.redirect(new URL('/dashboard', requestUrl.origin));
}


