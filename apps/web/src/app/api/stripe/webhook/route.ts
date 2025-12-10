import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

// Validate and initialize Stripe (lazy initialization to avoid build-time errors)
const getStripeInstance = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables.');
  }
  
  if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
    throw new Error('Invalid Stripe secret key format.');
  }
  
  try {
    return new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    });
  } catch (error: any) {
    throw new Error(`Failed to initialize Stripe: ${error.message}`);
  }
};

export async function POST(request: NextRequest) {
  // Initialize Stripe and webhook secret only when the route is called
  const stripe = getStripeInstance();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'STRIPE_WEBHOOK_SECRET is not set in environment variables.' },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  const supabase = createSupabaseRouteHandlerClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;

        if (!userId) {
          console.error('No userId in checkout session metadata');
          break;
        }

        // Get subscription details from Stripe
        const subscriptionId = session.subscription as string;
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          // Update subscription status
          await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              stripe_subscription_id: subscriptionId,
              cancel_at_period_end: subscription.cancel_at_period_end || false,
              current_period_start: new Date(
                subscription.current_period_start * 1000
              ).toISOString(),
              current_period_end: new Date(
                subscription.current_period_end * 1000
              ).toISOString(),
            })
            .eq('user_id', userId);

          // Update user account type
          await supabase
            .from('users')
            .update({ account_type: 'pro' })
            .eq('id', userId);
        }

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        // Get user by subscription ID
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (!subData) {
          console.error('Subscription not found:', subscriptionId);
          break;
        }

        const isCanceled = subscription.cancel_at_period_end || subscription.status === 'canceled';
        const isActive = subscription.status === 'active' && !subscription.cancel_at_period_end;

        // Update subscription
        await supabase
          .from('subscriptions')
          .update({
            status: subscription.status === 'active' ? 'active' : 'canceled',
            cancel_at_period_end: subscription.cancel_at_period_end || false,
            current_period_start: new Date(
              subscription.current_period_start * 1000
            ).toISOString(),
            current_period_end: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
          })
          .eq('user_id', subData.user_id);

        // Update user account type
        // If canceled at period end, keep as 'pro' until period ends
        // If actually canceled/ended, set to 'free'
        const now = new Date();
        const periodEnd = new Date(subscription.current_period_end * 1000);
        
        if (subscription.status === 'canceled' && now >= periodEnd) {
          // Period has ended, set to free
          await supabase
            .from('users')
            .update({ account_type: 'free' })
            .eq('id', subData.user_id);
        } else if (isActive) {
          // Active subscription, set to pro
          await supabase
            .from('users')
            .update({ account_type: 'pro' })
            .eq('id', subData.user_id);
        }
        // If cancel_at_period_end is true but period hasn't ended, keep as 'pro'

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        // Get user by subscription ID
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (!subData) {
          console.error('Subscription not found:', subscriptionId);
          break;
        }

        // Update subscription to canceled
        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            cancel_at_period_end: false,
          })
          .eq('user_id', subData.user_id);

        // Set user to free
        await supabase
          .from('users')
          .update({ account_type: 'free' })
          .eq('id', subData.user_id);

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId) {
          break;
        }

        // Get user by subscription ID
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (!subData) {
          console.error('Subscription not found for invoice:', subscriptionId);
          break;
        }

        // Store payment record
        await supabase
          .from('payments')
          .insert({
            user_id: subData.user_id,
            stripe_payment_intent_id: invoice.payment_intent as string,
            stripe_invoice_id: invoice.id,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: 'succeeded',
            paid_at: new Date(invoice.created * 1000).toISOString(),
          });

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

