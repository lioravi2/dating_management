import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
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
    const supabase = createSupabaseRouteHandlerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, status, cancel_at_period_end')
      .eq('user_id', session.user.id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      );
    }

    if (!subscription.cancel_at_period_end) {
      return NextResponse.json(
        { error: 'Subscription is not scheduled for cancellation' },
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

    // Resume subscription (remove cancel_at_period_end)
    const resumedSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        cancel_at_period_end: false,
      }
    );

    // Update database
    await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: false,
        status: 'active',
        current_period_end: new Date(
          resumedSubscription.current_period_end * 1000
        ).toISOString(),
      })
      .eq('user_id', session.user.id);

    return NextResponse.json({
      message: 'Subscription has been resumed',
    });
  } catch (error: any) {
    console.error('Resume subscription error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

