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

    // Update database (use admin client to bypass RLS and reset cancellation_reason)
    const { error: updateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        cancel_at_period_end: false,
        cancellation_reason: null, // Reset cancellation reason when resuming
        status: 'active',
        current_period_end: new Date(
          resumedSubscription.current_period_end * 1000
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

    // Ensure user account_type is set to 'pro' when resuming
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('account_type')
      .eq('id', session.user.id)
      .single();

    if (userData && userData.account_type !== 'pro') {
      const { error: userUpdateError } = await supabaseAdmin
        .from('users')
        .update({ account_type: 'pro' })
        .eq('id', session.user.id);

      if (userUpdateError) {
        console.error('Error updating user account type:', userUpdateError);
      }
    }

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

