import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { track, isAmplitudeInitialized } from '@/lib/analytics/server';

/**
 * Test endpoint for verifying auth event tracking
 * 
 * This endpoint simulates the same logic as /api/auth/update-profile
 * to test if [User Signed In] events can be tracked successfully.
 * 
 * Usage: POST /api/debug/test-auth-tracking
 */
export async function POST(request: NextRequest) {
  const testStartTime = Date.now();
  const testResults: any = {
    timestamp: new Date().toISOString(),
    steps: [],
    errors: [],
    success: false,
  };

  try {
    // Step 1: Check authentication
    testResults.steps.push({ step: 1, name: 'Check authentication', status: 'in_progress' });
    console.log('[Test Auth Tracking] ========== Starting test ==========');
    
    const supabase = createSupabaseRouteHandlerClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      testResults.steps[0].status = 'failed';
      testResults.steps[0].error = sessionError?.message || 'No session';
      testResults.errors.push('Authentication failed');
      console.log('[Test Auth Tracking] Authentication failed:', { 
        hasSessionError: !!sessionError, 
        hasSession: !!session,
        sessionError: sessionError?.message 
      });
      return NextResponse.json({
        status: 'error',
        message: 'Not authenticated',
        results: testResults,
      }, { status: 401 });
    }

    testResults.steps[0].status = 'success';
    testResults.steps[0].data = {
      userId: session.user.id,
      email: session.user.email,
      emailConfirmed: !!session.user.email_confirmed_at
    };
    console.log('[Test Auth Tracking] Authenticated user:', testResults.steps[0].data);

    // Step 2: Check if profile exists
    testResults.steps.push({ step: 2, name: 'Check profile exists', status: 'in_progress' });
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('email_verified_at, last_login')
      .eq('id', session.user.id)
      .maybeSingle();

    if (fetchError) {
      testResults.steps[1].status = 'failed';
      testResults.steps[1].error = fetchError.message;
      testResults.errors.push('Failed to fetch profile');
      console.log('[Test Auth Tracking] Profile fetch error:', fetchError);
    } else if (!currentUser) {
      testResults.steps[1].status = 'warning';
      testResults.steps[1].message = 'Profile does not exist (would create new profile)';
      console.log('[Test Auth Tracking] Profile does not exist');
    } else {
      testResults.steps[1].status = 'success';
      testResults.steps[1].data = {
        profileExists: true,
        emailVerifiedAt: currentUser.email_verified_at || null,
        lastLogin: currentUser.last_login || null,
      };
      console.log('[Test Auth Tracking] Profile exists:', testResults.steps[1].data);
    }

    // Step 3: Check Amplitude initialization
    testResults.steps.push({ step: 3, name: 'Check Amplitude initialization', status: 'in_progress' });
    const isInitialized = isAmplitudeInitialized();
    const hasApiKey = !!process.env.AMPLITUDE_API_KEY;
    
    testResults.steps[2].status = isInitialized && hasApiKey ? 'success' : 'failed';
    testResults.steps[2].data = {
      isInitialized,
      hasApiKey,
      apiKeyLength: process.env.AMPLITUDE_API_KEY?.length || 0,
    };

    if (!hasApiKey) {
      testResults.errors.push('AMPLITUDE_API_KEY not set');
      console.warn('[Test Auth Tracking] AMPLITUDE_API_KEY not set');
    } else if (!isInitialized) {
      testResults.errors.push('Amplitude not initialized');
      console.warn('[Test Auth Tracking] Amplitude not initialized');
    } else {
      console.log('[Test Auth Tracking] Amplitude initialized:', testResults.steps[2].data);
    }

    // Step 4: Attempt to track [User Signed In] event
    testResults.steps.push({ step: 4, name: 'Track [User Signed In] event', status: 'in_progress' });
    const now = new Date().toISOString();
    
    console.log('[Test Auth Tracking] ========== Attempting to track [User Signed In] ==========');
    console.log('[Test Auth Tracking] Before track() call:', {
      eventName: '[User Signed In]',
      userId: session.user.id,
      isInitialized,
      hasApiKey,
      timestamp: now
    });

    try {
      await track('[User Signed In]', session.user.id, {
        timestamp: now,
        test: true, // Mark as test event
        source: 'debug-endpoint',
      });
      
      testResults.steps[3].status = 'success';
      testResults.steps[3].data = {
        eventName: '[User Signed In]',
        userId: session.user.id,
        timestamp: now,
      };
      testResults.success = true;
      console.log('[Test Auth Tracking] After track() call: [User Signed In] event tracked successfully');
    } catch (trackError: any) {
      testResults.steps[3].status = 'failed';
      testResults.steps[3].error = trackError.message;
      testResults.steps[3].errorStack = trackError.stack;
      testResults.errors.push(`Track failed: ${trackError.message}`);
      console.error('[Test Auth Tracking] Error tracking [User Signed In] event:', trackError);
    }

    const testDuration = Date.now() - testStartTime;
    testResults.duration = `${testDuration}ms`;
    console.log('[Test Auth Tracking] ========== Test completed ==========', { 
      success: testResults.success,
      duration: testResults.duration,
      errors: testResults.errors.length 
    });

    return NextResponse.json({
      status: testResults.success ? 'success' : 'error',
      message: testResults.success 
        ? 'Test event tracked successfully - check Amplitude dashboard in 2-5 minutes'
        : 'Test failed - see errors below',
      results: testResults,
      instructions: testResults.success ? [
        '1. Wait 2-5 minutes for event to appear in Amplitude',
        '2. Go to Amplitude dashboard → User Lookup',
        '3. Enter user ID: ' + session.user.id,
        '4. Look for event: [User Signed In]',
        '5. Check event properties for test: true',
      ] : [
        '1. Check errors above for details',
        '2. Verify AMPLITUDE_API_KEY is set in environment',
        '3. Check server logs for detailed error information',
      ],
    }, { 
      status: testResults.success ? 200 : 500 
    });

  } catch (error: any) {
    const testDuration = Date.now() - testStartTime;
    testResults.duration = `${testDuration}ms`;
    testResults.errors.push(`Unexpected error: ${error.message}`);
    console.error('[Test Auth Tracking] ========== Unexpected error ==========', {
      error: error.message,
      stack: error.stack,
      duration: testResults.duration
    });

    return NextResponse.json({
      status: 'error',
      message: 'Unexpected error occurred',
      results: testResults,
    }, { status: 500 });
  }
}
