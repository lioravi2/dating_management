import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import Stripe from 'stripe';
import { track, setUserProperties } from '@/lib/analytics/server';
import { extractSubscriptionPrice } from '@/lib/stripe-helpers';

// Lazy initialization to avoid build-time errors
const getStripeInstance = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables.');
  }
  
  return new Stripe(secretKey, {
    apiVersion: '2023-10-16',
  });
};

export async function POST(request: NextRequest) {
  try {
    // Debug logging for environment check (only in development or when AMPLITUDE_DEBUG=true)
    if (process.env.NODE_ENV === 'development' || process.env.AMPLITUDE_DEBUG === 'true') {
      console.log('[DEBUG] Environment check:', {
        hasAmplitudeKey: !!process.env.AMPLITUDE_API_KEY,
        nodeEnv: process.env.NODE_ENV
      });
    }

    const body = await request.json().catch(() => ({}));
    const cancellationReason = body.reason || null;
    
    const supabase = createSupabaseRouteHandlerClient();
    const supabaseAdmin = createSupabaseAdminClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's subscription (use admin client to bypass RLS)
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, status, cancel_at_period_end')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (subError) {
      console.error('Error fetching subscription:', subError);
      return NextResponse.json(
        { error: `Failed to fetch subscription: ${subError.message}` },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      );
    }

    // Check if already canceled
    if (subscription.cancel_at_period_end) {
      return NextResponse.json(
        { error: 'Subscription is already scheduled for cancellation' },
        { status: 400 }
      );
    }

    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      return NextResponse.json(
        { error: `Subscription is not active (status: ${subscription.status})` },
        { status: 400 }
      );
    }

    if (!subscription.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'Invalid subscription' },
        { status: 400 }
      );
    }

    // Initialize Stripe only when the route is called
    const stripe = getStripeInstance();

    // Cancel subscription at period end (graceful cancellation)
    const canceledSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        cancel_at_period_end: true,
      }
    );

    // Extract price information for analytics
    const { price_amount, billing_interval } = extractSubscriptionPrice(canceledSubscription);

    // Update database (use admin client to bypass RLS)
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        cancellation_reason: cancellationReason,
        current_period_end: new Date(
          canceledSubscription.current_period_end * 1000
        ).toISOString(),
      })
      .eq('user_id', session.user.id);

    if (updateError) {
      console.error('Error updating subscription:', updateError);
      return NextResponse.json(
        { error: `Failed to update subscription: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Track [Subscription Cancelled] event for Amplitude analytics
    // Note: This is a backup - the webhook will also track this event when it receives customer.subscription.updated
    // Fire-and-forget: don't await to avoid blocking API response
    console.log(`[Cancel Subscription] Tracking [Subscription Cancelled] event for user: ${session.user.id}, subscription: ${subscription.stripe_subscription_id}`);
    
    track(
      '[Subscription Cancelled]',
      session.user.id,
      {
        subscription_id: subscription.stripe_subscription_id,
        plan_type: 'pro',
        amount: price_amount || 0,
        billing_interval: billing_interval || null,
        cancel_at_period_end: true,
        cancellation_reason: cancellationReason || null,
        timestamp: new Date().toISOString(),
      }
    ).catch((error) => {
      console.error('[Cancel Subscription] Error tracking subscription cancelled:', error);
    });

    // Update user properties: subscription_status (account_type remains 'pro' until period ends)
    // Fire-and-forget: don't await to avoid blocking API response
    setUserProperties(session.user.id, {
      subscription_status: 'canceled',
      // Note: account_type remains 'pro' until period ends
    }).catch((error) => {
      console.error('[Cancel Subscription] Error setting user properties for subscription cancelled:', error);
    });

    return NextResponse.json({
      message: 'Subscription will be canceled at the end of the billing period',
      cancel_at: new Date(
        canceledSubscription.current_period_end * 1000
      ).toISOString(),
    });
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

