import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { PRO_MONTHLY_PRICE } from '@/lib/pricing';
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
      .eq('status', 'active')
      .single();

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'User already has an active subscription' },
        { status: 400 }
      );
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

    // Create checkout session
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
              interval: 'month',
            },
            unit_amount: PRO_MONTHLY_PRICE, // $9.99 (configurable)
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
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

