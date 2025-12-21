/**
 * DEV SIGN-IN API ENDPOINT
 * 
 * This endpoint provides a sign-in that bypasses magic links for faster testing.
 * It should be removed once production is stable.
 * 
 * To remove:
 * 1. Delete this entire file (apps/web/src/app/api/auth/dev-signin/route.ts)
 * 2. Remove DevSignInButton component from mobile app
 * 3. Remove the import and usage from SignInScreen.tsx and web sign-in page
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    // Only allow specific dev email
    if (email !== 'avilior@hotmail.com') {
      return NextResponse.json(
        { error: 'This endpoint only works for the dev email' },
        { 
          status: 403,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    
    // Find the user
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return NextResponse.json(
        { error: 'Failed to find user' },
        { 
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    const user = usersData?.users?.find((u) => u.email === email);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { 
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }
    
    // Use SDK method to generate link - this includes email_otp which we can use directly
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email!,
      options: {
        redirectTo: 'datingapp://auth/callback',
      },
    });

    if (linkError || !linkData) {
      console.error('Error generating link:', linkError);
      return NextResponse.json(
        { error: 'Failed to generate session' },
        { 
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    // Try using email_otp if available (this is a direct OTP we can verify immediately)
    if (linkData?.properties?.email_otp) {
      // Verify the email OTP to get a session
      const { data: sessionData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
        type: 'email',
        token: linkData.properties.email_otp,
        email: user.email!,
      });

      if (!verifyError && sessionData?.session) {
        const { access_token, refresh_token, expires_in } = sessionData.session;
        
        return NextResponse.json({
          access_token,
          refresh_token,
          expires_in: expires_in || 3600,
          token_type: 'bearer',
          user: {
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata,
          },
        }, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }
    }

    // Fallback: Extract tokens from the magiclink URL
    const actionLink = linkData?.properties?.action_link;
    
    // Try to extract tokens from URL - magiclink might have them in hash or query params
    const url = new URL(actionLink);
    const hash = url.hash;
    const searchParams = url.searchParams;
    
    // Extract tokens from hash (most common for magic links) or query params
    let accessToken = searchParams.get('access_token');
    let refreshToken = searchParams.get('refresh_token');
    
    if (!accessToken && hash) {
      const accessTokenMatch = hash.match(/access_token=([^&]+)/);
      accessToken = accessTokenMatch ? decodeURIComponent(accessTokenMatch[1]) : null;
    }
    
    if (!refreshToken && hash) {
      const refreshTokenMatch = hash.match(/refresh_token=([^&]+)/);
      refreshToken = refreshTokenMatch ? decodeURIComponent(refreshTokenMatch[1]) : null;
    }
    
    // If tokens are in the URL, use them directly
    if (accessToken && refreshToken) {
      const expiresIn = searchParams.get('expires_in') || (hash ? hash.match(/expires_in=(\d+)/)?.[1] : null) || '3600';
      
      return NextResponse.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: parseInt(expiresIn),
        token_type: 'bearer',
        user: {
          id: user.id,
          email: user.email,
          user_metadata: user.user_metadata,
        },
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    
    // If no tokens in URL, try to extract verification token and exchange it
    const verificationToken = searchParams.get('token') || (hash ? hash.match(/token=([^&]+)/)?.[1] : null);
    
    if (verificationToken) {
      // Exchange verification token for session
      const { data: sessionData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
        type: 'magiclink',
        token: verificationToken,
        email: user.email!,
      });

      if (!verifyError && sessionData?.session) {
        const { access_token, refresh_token, expires_in } = sessionData.session;
        
        return NextResponse.json({
          access_token,
          refresh_token,
          expires_in: expires_in || 3600,
          token_type: 'bearer',
          user: {
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata,
          },
        }, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }
    }
    
    // If we get here, we couldn't extract tokens
    console.error('Failed to extract tokens from magiclink');
    console.error('Action link:', actionLink);
    return NextResponse.json(
      { error: 'Failed to extract session tokens from magiclink' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error) {
    console.error('Dev sign-in error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}

