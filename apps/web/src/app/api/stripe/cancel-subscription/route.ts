import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import Stripe from 'stripe';

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

