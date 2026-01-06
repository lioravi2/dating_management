import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { track, setUserProperties, isAmplitudeInitialized } from '@/lib/analytics/server';

/**
 * Test endpoint for verifying Amplitude server-side tracking
 * 
 * Usage:
 * - GET: Check Amplitude initialization status
 * - POST: Send a test event to Amplitude
 * 
 * POST body (optional):
 * {
 *   "eventName": "[Test Event]",
 *   "eventProperties": { "test": true }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseRouteHandlerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Check environment variables
    const hasApiKey = !!process.env.AMPLITUDE_API_KEY;
    const apiKeyLength = process.env.AMPLITUDE_API_KEY?.length || 0;
    const isInitialized = isAmplitudeInitialized();

    return NextResponse.json({
      status: 'ok',
      amplitude: {
        hasApiKey,
        apiKeyLength,
        isInitialized,
        nodeEnv: process.env.NODE_ENV,
      },
      user: {
        authenticated: !!session,
        userId: session?.user?.id || null,
      },
      message: 'Amplitude test endpoint - use POST to send a test event',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseRouteHandlerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - must be authenticated to test Amplitude tracking' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const eventName = body.eventName || '[Test Event]';
    const eventProperties = body.eventProperties || {
      test: true,
      timestamp: new Date().toISOString(),
      source: 'debug-endpoint',
    };

    // Log all debug information
    console.log('[DEBUG] Amplitude Test Endpoint - Starting test');
    console.log('[DEBUG] Environment check:', {
      hasAmplitudeKey: !!process.env.AMPLITUDE_API_KEY,
      apiKeyLength: process.env.AMPLITUDE_API_KEY?.length || 0,
      nodeEnv: process.env.NODE_ENV,
      isInitialized: isAmplitudeInitialized(),
    });
    console.log('[DEBUG] Test event details:', {
      eventName,
      userId: session.user.id,
      eventProperties,
    });

    // Track the test event
    try {
      await track(eventName, session.user.id, eventProperties);
      console.log('[DEBUG] Test event tracked successfully');

      // Also test user properties
      await setUserProperties(session.user.id, {
        test_property: 'test_value',
        last_test_at: new Date().toISOString(),
      });
      console.log('[DEBUG] Test user properties set successfully');

      return NextResponse.json({
        status: 'success',
        message: 'Test event sent to Amplitude',
        details: {
          eventName,
          userId: session.user.id,
          eventProperties,
          amplitude: {
            hasApiKey: !!process.env.AMPLITUDE_API_KEY,
            isInitialized: isAmplitudeInitialized(),
          },
        },
        instructions: [
          '1. Check server logs for detailed debug output',
          '2. Wait 2-5 minutes for event to appear in Amplitude dashboard',
          '3. Search for event in Amplitude: User Lookup → Enter user ID → View events',
          '4. Look for event name: ' + eventName,
        ],
      });
    } catch (trackError: any) {
      console.error('[DEBUG] Error tracking test event:', trackError);
      return NextResponse.json(
        {
          status: 'error',
          error: 'Failed to track test event',
          details: trackError.message,
          amplitude: {
            hasApiKey: !!process.env.AMPLITUDE_API_KEY,
            isInitialized: isAmplitudeInitialized(),
          },
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[DEBUG] Amplitude test endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

