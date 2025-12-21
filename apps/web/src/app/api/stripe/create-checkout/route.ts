import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { PRO_DAILY_PRICE } from '@/lib/pricing';
import Stripe from 'stripe';

// Validate and initialize Stripe
const getStripeInstance = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables. Please check your .env.local file.');
  }
  
  // Validate key format (should start with sk_test_ or sk_live_)
  if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
    throw new Error(`Invalid Stripe secret key format. The key should start with sk_test_ (for test mode) or sk_live_ (for live mode). Current key starts with: ${secretKey.substring(0, 3)}... Please check your .env.local file.`);
  }
  
  try {
    return new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    });
  } catch (error: any) {
    throw new Error(`Failed to initialize Stripe: ${error.message}. Please check your STRIPE_SECRET_KEY in .env.local.`);
  }
};

export async function POST(request: NextRequest) {
  try {
    // Initialize Stripe with validation
    const stripe = getStripeInstance();
    
    const supabase = createSupabaseServerComponentClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await request.json();

    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // If subscription exists, verify it's actually still active
    if (existingSubscription && existingSubscription.status === 'active') {
      const now = new Date();
      const periodEnd = existingSubscription.current_period_end
        ? new Date(existingSubscription.current_period_end)
        : null;

      // If subscription was canceled at period end and period has passed, allow new subscription
      const isExpired = existingSubscription.cancel_at_period_end &&
        periodEnd &&
        now >= periodEnd;

      if (!isExpired) {
        // Check with Stripe to verify subscription is truly active
        if (existingSubscription.stripe_subscription_id) {
          try {
            const stripeSubscription = await stripe.subscriptions.retrieve(
              existingSubscription.stripe_subscription_id
            );
            
            // If Stripe says it's active and not canceled, block checkout
            if (stripeSubscription.status === 'active' && !stripeSubscription.cancel_at_period_end) {
              return NextResponse.json(
                { error: 'User already has an active subscription' },
                { status: 400 }
              );
            }
          } catch (error) {
            // If we can't retrieve from Stripe, fall back to database check
            // If not expired based on database, block checkout
            if (!isExpired) {
              return NextResponse.json(
                { error: 'User already has an active subscription' },
                { status: 400 }
              );
            }
          }
        } else {
          // No Stripe subscription ID, but status is active - block checkout
          return NextResponse.json(
            { error: 'User already has an active subscription' },
            { status: 400 }
          );
        }
      }
    }

    // Get or create Stripe customer
    let customerId: string;
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (subscription?.stripe_customer_id) {
      customerId = subscription.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: session.user.email || undefined,
        metadata: {
          userId: userId,
        },
      });
      customerId = customer.id;

      // Store customer ID
      await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          status: 'incomplete',
        });
    }

    // Create checkout session with daily pricing for testing
    // Daily subscriptions charge for one day at a time, starting from the billing_cycle_anchor
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Dating Assistant Pro',
              description: 'Premium features and advanced functionality',
            },
            recurring: {
              interval: 'day',
            },
            unit_amount: PRO_DAILY_PRICE, // $0.10/day for testing
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // Don't set billing_cycle_anchor - let Stripe set it automatically to the subscription start time
      // This avoids timing issues where the anchor could be before the checkout session creation time
      success_url: `${request.nextUrl.origin}/profile?success=true`,
      cancel_url: `${request.nextUrl.origin}/upgrade?canceled=true`,
      metadata: {
        userId: userId,
      },
    });

    return NextResponse.json({ sessionId: checkoutSession.id });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

