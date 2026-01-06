import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import Stripe from 'stripe';
import { extractSubscriptionPrice } from '@/lib/stripe-helpers';
import { track, setUserProperties } from '@/lib/analytics/server';

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
  // Debug logging for environment check (only in development or when AMPLITUDE_DEBUG=true)
  if (process.env.NODE_ENV === 'development' || process.env.AMPLITUDE_DEBUG === 'true') {
    console.log('[DEBUG] Environment check:', {
      hasAmplitudeKey: !!process.env.AMPLITUDE_API_KEY,
      nodeEnv: process.env.NODE_ENV
    });
  }

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
  // Use admin client for database writes to bypass RLS
  const supabaseAdmin = createSupabaseAdminClient();

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
          
          // Extract price information
          const { price_amount, billing_interval } = extractSubscriptionPrice(subscription);
          
          // Update subscription status (use admin client to bypass RLS)
          await supabaseAdmin
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
              price_amount,
              billing_interval,
            })
            .eq('user_id', userId);

          // Update user account type (use admin client to bypass RLS)
          await supabaseAdmin
            .from('users')
            .update({ account_type: 'pro' })
            .eq('id', userId);

          // Track [Subscription Purchased] event for Amplitude analytics
          // This enables abandoned cart detection via funnel analysis
          // Fire-and-forget: don't await to avoid blocking webhook response
          track(
            '[Subscription Purchased]',
            userId,
            {
              subscription_id: subscriptionId,
              plan_type: 'pro',
              amount: price_amount || 0,
              billing_interval: billing_interval || null,
              timestamp: new Date().toISOString(),
            }
          ).catch((error) => {
            console.error('[Webhook] Error tracking subscription purchase:', error);
          });

          // Update user properties: subscription_status and account_type
          // Fire-and-forget: don't await to avoid blocking webhook response
          setUserProperties(userId, {
            subscription_status: 'active',
            account_type: 'pro',
          }).catch((error) => {
            console.error('[Webhook] Error setting user properties for subscription purchase:', error);
          });

          // Create payment record for the initial checkout payment
          // Get the invoice from the subscription
          if (subscription.latest_invoice) {
            try {
              console.log(`[Webhook] checkout.session.completed: Retrieving invoice ${subscription.latest_invoice}`);
              const invoice = await stripe.invoices.retrieve(
                subscription.latest_invoice as string
              );
              
              console.log(`[Webhook] checkout.session.completed: Invoice ${invoice.id}: status=${invoice.status}, amount_paid=${invoice.amount_paid}`);
              
              if (invoice.amount_paid > 0) {
                // Check if payment already exists (to prevent duplicates)
                const { data: existingPayment, error: checkError } = await supabaseAdmin
                  .from('payments')
                  .select('id')
                  .eq('stripe_invoice_id', invoice.id)
                  .maybeSingle();

                if (checkError) {
                  console.error('[Webhook] checkout.session.completed: Error checking existing payment:', checkError);
                }

                if (existingPayment) {
                  console.log(`[Webhook] checkout.session.completed: Payment already exists for invoice ${invoice.id}, skipping`);
                } else {
                  const paymentData = {
                    user_id: userId,
                    stripe_payment_intent_id: invoice.payment_intent as string | null,
                    stripe_invoice_id: invoice.id,
                    amount: invoice.amount_paid,
                    currency: invoice.currency,
                    status: invoice.status === 'paid' ? 'succeeded' : 'pending',
                    paid_at: invoice.status === 'paid' 
                      ? new Date(invoice.created * 1000).toISOString()
                      : null,
                  };

                  console.log(`[Webhook] checkout.session.completed: Inserting payment:`, paymentData);

                  const { error: paymentError, data: insertedPayment } = await supabaseAdmin
                    .from('payments')
                    .insert(paymentData)
                    .select();

                  if (paymentError) {
                    console.error('[Webhook] checkout.session.completed: Error storing payment:', paymentError);
                  } else {
                    console.log(`[Webhook] checkout.session.completed: Successfully stored payment:`, insertedPayment);
                  }
                }
              } else {
                console.log(`[Webhook] checkout.session.completed: Invoice ${invoice.id} has no amount_paid, skipping payment record`);
              }
            } catch (error) {
              console.error('[Webhook] checkout.session.completed: Error retrieving invoice:', error);
            }
          } else {
            console.log('[Webhook] checkout.session.completed: No latest_invoice in subscription');
          }
        }

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const previousAttributes = (event.data as any).previous_attributes || {};

        // Get user by subscription ID (use admin client to bypass RLS)
        const { data: subData } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id, cancel_at_period_end')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (!subData) {
          console.error('Subscription not found:', subscriptionId);
          break;
        }

        // Use Stripe's previous_attributes to detect actual state changes
        // previous_attributes only includes fields that changed, so undefined means no change
        const previousCancelAtPeriodEnd = previousAttributes.cancel_at_period_end;
        const currentCancelAtPeriodEnd = subscription.cancel_at_period_end;

        // Only trigger events if cancel_at_period_end actually changed
        // Subscription resumed: explicitly changed from true to false
        const subscriptionResumed = 
          previousCancelAtPeriodEnd === true && 
          currentCancelAtPeriodEnd === false && 
          subscription.status === 'active';

        // Subscription cancelled: explicitly changed from false to true
        // IMPORTANT: Only trigger if previousCancelAtPeriodEnd is explicitly false (not undefined)
        const subscriptionCancelled = 
          previousCancelAtPeriodEnd === false && 
          currentCancelAtPeriodEnd === true && 
          subscription.status === 'active';

        // Debug logging for subscription state changes
        if (previousCancelAtPeriodEnd !== undefined) {
          console.log(`[Webhook] Subscription ${subscriptionId} cancel_at_period_end changed:`, {
            previous: previousCancelAtPeriodEnd,
            current: currentCancelAtPeriodEnd,
            status: subscription.status,
            subscriptionResumed,
            subscriptionCancelled
          });
        }

        const isCanceled = subscription.cancel_at_period_end || subscription.status === 'canceled';
        const isActive = subscription.status === 'active' && !subscription.cancel_at_period_end;

        // Extract price information
        const { price_amount, billing_interval } = extractSubscriptionPrice(subscription);

        // Update subscription (use admin client to bypass RLS)
        await supabaseAdmin
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
            price_amount,
            billing_interval,
          })
          .eq('user_id', subData.user_id);

        // Update user account type
        // If canceled at period end, keep as 'pro' until period ends
        // If actually canceled/ended, set to 'free'
        const now = new Date();
        const periodEnd = new Date(subscription.current_period_end * 1000);
        
        if (subscription.status === 'canceled' && now >= periodEnd) {
          // Period has ended, set to free and disconnect calendar
          await supabaseAdmin
            .from('users')
            .update({ account_type: 'free' })
            .eq('id', subData.user_id);
          
          // Disconnect all calendar connections (Pro feature)
          await supabaseAdmin
            .from('calendar_connections')
            .delete()
            .eq('user_id', subData.user_id);
        } else if (isActive) {
          // Active subscription, set to pro (use admin client to bypass RLS)
          await supabaseAdmin
            .from('users')
            .update({ account_type: 'pro' })
            .eq('id', subData.user_id);
        }
        // If cancel_at_period_end is true but period hasn't ended, keep as 'pro'

        // Track [Subscription Resumed] event if subscription was resumed
        if (subscriptionResumed) {
          console.log(`[Webhook] Tracking [Subscription Resumed] event for user: ${subData.user_id}, subscription: ${subscriptionId}`);
          
          // Fire-and-forget: don't await to avoid blocking webhook response
          track(
            '[Subscription Resumed]',
            subData.user_id,
            {
              subscription_id: subscriptionId,
              plan_type: 'pro',
              amount: price_amount || 0,
              billing_interval: billing_interval || null,
              timestamp: new Date().toISOString(),
            }
          ).catch((error) => {
            console.error('[Webhook] Error tracking subscription resumed:', error);
          });

          // Update user properties: subscription_status and account_type
          // Fire-and-forget: don't await to avoid blocking webhook response
          setUserProperties(subData.user_id, {
            subscription_status: 'active',
            account_type: 'pro',
          }).catch((error) => {
            console.error('[Webhook] Error setting user properties for subscription resumed:', error);
          });
        }

        // Track [Subscription Cancelled] event if subscription was cancelled
        if (subscriptionCancelled) {
          console.log(`[Webhook] Tracking [Subscription Cancelled] event for user: ${subData.user_id}, subscription: ${subscriptionId}`);
          
          // Fire-and-forget: don't await to avoid blocking webhook response
          track(
            '[Subscription Cancelled]',
            subData.user_id,
            {
              subscription_id: subscriptionId,
              plan_type: 'pro',
              amount: price_amount || 0,
              billing_interval: billing_interval || null,
              cancel_at_period_end: true,
              timestamp: new Date().toISOString(),
            }
          ).catch((error) => {
            console.error('[Webhook] Error tracking subscription cancelled:', error);
          });

          // Update user properties: subscription_status (account_type remains 'pro' until period ends)
          // Fire-and-forget: don't await to avoid blocking webhook response
          setUserProperties(subData.user_id, {
            subscription_status: 'canceled',
            // Note: account_type remains 'pro' until period ends
          }).catch((error) => {
            console.error('[Webhook] Error setting user properties for subscription cancelled:', error);
          });
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        // Get user and subscription details by subscription ID (use admin client to bypass RLS)
        const { data: subData } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id, price_amount, billing_interval')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (!subData) {
          console.error('Subscription not found:', subscriptionId);
          break;
        }

        // Extract price information for analytics (use from database or extract from subscription)
        const { price_amount, billing_interval } = extractSubscriptionPrice(subscription);

        // Update subscription to canceled (use admin client to bypass RLS)
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'canceled',
            cancel_at_period_end: false,
          })
          .eq('user_id', subData.user_id);

        // Set user to free and disconnect calendar
        await supabaseAdmin
          .from('users')
          .update({ account_type: 'free' })
          .eq('id', subData.user_id);
        
        // Disconnect all calendar connections (Pro feature)
        await supabaseAdmin
          .from('calendar_connections')
          .delete()
          .eq('user_id', subData.user_id);

        // Track [Subscription Cancelled] event (subscription was deleted/ended)
        console.log(`[Webhook] Tracking [Subscription Cancelled] event for user: ${subData.user_id}, subscription: ${subscriptionId}`);
        
        // Fire-and-forget: don't await to avoid blocking webhook response
        track(
          '[Subscription Cancelled]',
          subData.user_id,
          {
            subscription_id: subscriptionId,
            plan_type: 'pro',
            amount: price_amount || 0,
            billing_interval: billing_interval || null,
            cancel_at_period_end: false,
            status: 'deleted',
            timestamp: new Date().toISOString(),
          }
        ).catch((error) => {
          console.error('[Webhook] Error tracking subscription cancelled:', error);
        });

        // Update user properties: subscription_status and account_type
        // Fire-and-forget: don't await to avoid blocking webhook response
        setUserProperties(subData.user_id, {
          subscription_status: 'canceled',
          account_type: 'free',
        }).catch((error) => {
          console.error('[Webhook] Error setting user properties for subscription cancelled:', error);
        });

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        console.log(`[Webhook] invoice.payment_succeeded: invoice=${invoice.id}, subscription=${subscriptionId}, amount_paid=${invoice.amount_paid}`);

        if (!subscriptionId) {
          console.error('[Webhook] invoice.payment_succeeded: No subscription ID in invoice');
          break;
        }

        // Get user by subscription ID (use admin client to bypass RLS)
        const { data: subData, error: subError } = await supabaseAdmin
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle();

        if (subError) {
          console.error('[Webhook] invoice.payment_succeeded: Error fetching subscription:', subError);
          break;
        }

        if (!subData) {
          console.error(`[Webhook] invoice.payment_succeeded: Subscription not found: ${subscriptionId}`);
          break;
        }

        console.log(`[Webhook] invoice.payment_succeeded: Found user ${subData.user_id} for subscription ${subscriptionId}`);

        // Store payment record (use admin client to bypass RLS)
        // Check if payment already exists (to prevent duplicates)
        const { data: existingPayment, error: checkError } = await supabaseAdmin
          .from('payments')
          .select('id')
          .eq('stripe_invoice_id', invoice.id)
          .maybeSingle();

        if (checkError) {
          console.error('[Webhook] invoice.payment_succeeded: Error checking existing payment:', checkError);
        }

        if (existingPayment) {
          console.log(`[Webhook] invoice.payment_succeeded: Payment already exists for invoice ${invoice.id}, skipping`);
        } else {
          const paymentData = {
            user_id: subData.user_id,
            stripe_payment_intent_id: invoice.payment_intent as string | null,
            stripe_invoice_id: invoice.id,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: 'succeeded' as const,
            paid_at: new Date(invoice.created * 1000).toISOString(),
          };

          console.log(`[Webhook] invoice.payment_succeeded: Inserting payment:`, paymentData);

          const { error: paymentError, data: insertedPayment } = await supabaseAdmin
            .from('payments')
            .insert(paymentData)
            .select();

          if (paymentError) {
            console.error('[Webhook] invoice.payment_succeeded: Error storing payment:', paymentError);
          } else {
            console.log(`[Webhook] invoice.payment_succeeded: Successfully stored payment:`, insertedPayment);
          }
        }

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