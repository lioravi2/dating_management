import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerComponentClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.redirect(
        new URL('/auth/signin?error=Unauthorized', request.url)
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Verify state matches user ID
    if (state !== session.user.id) {
      return NextResponse.redirect(
        new URL('/profile?error=Invalid state parameter', request.url)
      );
    }

    if (error) {
      return NextResponse.redirect(
        new URL(`/profile?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/profile?error=No authorization code', request.url)
      );
    }

    // Check if user has Pro account (required for calendar connection)
    const { data: userData } = await supabase
      .from('users')
      .select('account_type')
      .eq('id', session.user.id)
      .single();

    if (!userData || userData.account_type !== 'pro') {
      return NextResponse.redirect(
        new URL('/profile?error=Calendar synchronization is only available for Pro accounts. Please upgrade to Pro.', request.url)
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALENDAR_REDIRECT_URI
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(
        new URL('/profile?error=Failed to get access token', request.url)
      );
    }

    // Store tokens in database
    const { error: dbError } = await supabase
      .from('calendar_connections')
      .upsert(
        {
          user_id: session.user.id,
          provider: 'google',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          calendar_id: 'primary',
        },
        {
          onConflict: 'user_id,provider',
        }
      );

    if (dbError) {
      console.error('Error storing calendar connection:', dbError);
      return NextResponse.redirect(
        new URL(
          `/profile?error=${encodeURIComponent(dbError.message)}`,
          request.url
        )
      );
    }

    // Redirect to profile page with success message
    return NextResponse.redirect(
      new URL('/profile?success=Google Calendar connected', request.url)
    );
  } catch (error: any) {
    console.error('Error in Google OAuth callback:', error);
    return NextResponse.redirect(
      new URL(
        `/profile?error=${encodeURIComponent(error.message || 'OAuth error')}`,
        request.url
      )
    );
  }
}

