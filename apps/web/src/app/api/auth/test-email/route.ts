/**
 * TEST EMAIL API ENDPOINT
 * 
 * This endpoint tests Supabase's email sending capability by generating
 * a magic link which should trigger an email to be sent.
 * 
 * This is for diagnostic purposes only and should be removed before production.
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
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
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

    const supabaseAdmin = createSupabaseAdminClient();

    // Check if user exists
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('[TEST-EMAIL] Error listing users:', listError);
      return NextResponse.json(
        { error: 'Failed to check user', details: listError.message },
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
        { error: 'User not found. Please use an existing email address.' },
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

    console.log('[TEST-EMAIL] Generating magic link for:', email);

    // Generate a magic link - this should trigger an email to be sent
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email!,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
      },
    });

    if (linkError) {
      console.error('[TEST-EMAIL] Error generating link:', linkError);
      return NextResponse.json(
        { 
          error: 'Failed to generate magic link',
          details: linkError.message,
          hint: 'This might indicate an email service configuration issue'
        },
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

    console.log('[TEST-EMAIL] Magic link generated successfully');
    console.log('[TEST-EMAIL] Link data:', {
      hasProperties: !!linkData.properties,
      hasActionLink: !!linkData.properties?.action_link,
      hasEmailOtp: !!linkData.properties?.email_otp,
    });

    // Note: We can't directly verify if the email was sent, but if generateLink
    // succeeds without errors, Supabase should have attempted to send the email.
    // Check your email inbox (and spam folder) to confirm receipt.

    return NextResponse.json(
      { 
        success: true,
        message: 'Magic link generated. Check your email inbox (and spam folder) to see if the email was received.',
        email: email,
        note: 'If no email is received, this confirms Supabase\'s email service is not working properly.',
        timestamp: new Date().toISOString(),
      },
      { 
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );

  } catch (error: any) {
    console.error('[TEST-EMAIL] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
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


