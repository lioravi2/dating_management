import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

// Validate and initialize Stripe
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
  try {
    const stripe = getStripeInstance();
    const supabase = createSupabaseRouteHandlerClient();
    
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    console.log('Verifying subscription for user:', userId, 'email:', userEmail);

    // First, try to get customer ID from database
    const { data: dbSubscription } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    console.log('Database subscription:', dbSubscription);

    let customerId = dbSubscription?.stripe_customer_id;

    // If no customer ID, try multiple methods to find it
    if (!customerId) {
      try {
        // Method 1: Look up by email in checkout sessions
        console.log('Looking up checkout sessions for email:', userEmail);
        const checkoutSessions = await stripe.checkout.sessions.list({
          limit: 100,
        });

        // Find a completed session with this user's email
        const completedSession = checkoutSessions.data.find(
          s => s.customer_email === userEmail && 
               s.status === 'complete' && 
               (s.subscription || s.customer)
        );

        console.log('Found checkout session:', completedSession?.id);

        if (completedSession) {
          if (completedSession.customer) {
            customerId = completedSession.customer as string;
            console.log('Found customer ID from checkout session:', customerId);
          }
          
          // If we have a subscription ID from the session, use it directly
          if (completedSession.subscription) {
            const subscriptionId = completedSession.subscription as string;
            console.log('Found subscription ID from checkout session:', subscriptionId);
            
            try {
              const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
              
              if (stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing') {
                // Get customer ID from subscription
                customerId = stripeSubscription.customer as string;
                
                // Store everything in database
                await supabase
                  .from('subscriptions')
                  .upsert({
                    user_id: userId,
                    stripe_subscription_id: subscriptionId,
                    stripe_customer_id: customerId,
                    status: 'active',
                    cancel_at_period_end: stripeSubscription.cancel_at_period_end || false,
                    current_period_start: new Date(
                      stripeSubscription.current_period_start * 1000
                    ).toISOString(),
                    current_period_end: new Date(
                      stripeSubscription.current_period_end * 1000
                    ).toISOString(),
                  }, {
                    onConflict: 'user_id'
                  });

                // Update user account type
                await supabase
                  .from('users')
                  .update({ account_type: 'pro' })
                  .eq('id', userId);

                console.log('Subscription verified and updated from checkout session');
                return NextResponse.json({ 
                  success: true,
                  message: 'Subscription verified and updated',
                });
              }
            } catch (error) {
              console.error('Error retrieving subscription from checkout session:', error);
            }
          }
          
          // Store customer ID if we found it
          if (customerId) {
            await supabase
              .from('subscriptions')
              .upsert({
                user_id: userId,
                stripe_customer_id: customerId,
                status: 'incomplete',
              }, {
                onConflict: 'user_id'
              });
          }
        }

        // Method 2: Look up customers by email (prioritize this - more reliable)
        if (!customerId && userEmail) {
          console.log('Looking up customers by email:', userEmail);
          const customers = await stripe.customers.list({
            email: userEmail,
            limit: 10,
          });

          if (customers.data.length > 0) {
            // Check each customer for active subscriptions
            for (const customer of customers.data) {
              customerId = customer.id;
              console.log('Checking customer for subscriptions:', customerId);
              
              // List subscriptions for this customer
              const subscriptions = await stripe.subscriptions.list({
                customer: customerId,
                limit: 10,
                status: 'all',
              });

              console.log(`Found ${subscriptions.data.length} subscriptions for customer`);

              // Find active subscription
              const activeSubscription = subscriptions.data.find(
                sub => sub.status === 'active' || sub.status === 'trialing'
              );

              if (activeSubscription) {
                console.log('Found active subscription:', activeSubscription.id);
                
                // Update database
                await supabase
                  .from('subscriptions')
                  .upsert({
                    user_id: userId,
                    stripe_subscription_id: activeSubscription.id,
                    stripe_customer_id: customerId,
                    status: 'active',
                    cancel_at_period_end: activeSubscription.cancel_at_period_end || false,
                    current_period_start: new Date(
                      activeSubscription.current_period_start * 1000
                    ).toISOString(),
                    current_period_end: new Date(
                      activeSubscription.current_period_end * 1000
                    ).toISOString(),
                  }, {
                    onConflict: 'user_id'
                  });

                // Update user account type
                await supabase
                  .from('users')
                  .update({ account_type: 'pro' })
                  .eq('id', userId);

                return NextResponse.json({ 
                  success: true,
                  message: 'Subscription verified and updated',
                });
              }
            }
            
            // If we found customers but no active subscription, store the first customer ID
            customerId = customers.data[0].id;
            await supabase
              .from('subscriptions')
              .upsert({
                user_id: userId,
                stripe_customer_id: customerId,
                status: 'incomplete',
              }, {
                onConflict: 'user_id'
              });
          }
        }
      } catch (error) {
        console.error('Error finding customer:', error);
      }
    }

    // Now try to find active subscriptions for this customer
    if (customerId) {
      try {
        // List all subscriptions for this customer
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          limit: 10,
        });

        // Find the most recent active or trialing subscription
        const activeSubscription = subscriptions.data
          .sort((a, b) => b.created - a.created) // Most recent first
          .find(sub => sub.status === 'active' || sub.status === 'trialing');

        if (activeSubscription) {
          // Update database with subscription
          const { error: updateError } = await supabase
            .from('subscriptions')
            .upsert({
              user_id: userId,
              stripe_subscription_id: activeSubscription.id,
              stripe_customer_id: customerId,
              status: 'active',
              cancel_at_period_end: activeSubscription.cancel_at_period_end || false,
              current_period_start: new Date(
                activeSubscription.current_period_start * 1000
              ).toISOString(),
              current_period_end: new Date(
                activeSubscription.current_period_end * 1000
              ).toISOString(),
            }, {
              onConflict: 'user_id'
            });

          if (updateError) {
            console.error('Error updating subscription:', updateError);
          }

          // Update user account type
          const { error: userUpdateError } = await supabase
            .from('users')
            .update({ account_type: 'pro' })
            .eq('id', userId);

          if (userUpdateError) {
            console.error('Error updating user account type:', userUpdateError);
          }

          return NextResponse.json({ 
            success: true,
            message: 'Subscription verified and updated',
          });
        }
      } catch (error) {
        console.error('Error listing subscriptions:', error);
      }
    }

    // If we have a subscription ID in database, verify it directly
    if (dbSubscription?.stripe_subscription_id) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          dbSubscription.stripe_subscription_id
        );

        if (stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing') {
          // Update database
          await supabase
            .from('subscriptions')
            .update({
              status: 'active',
              cancel_at_period_end: stripeSubscription.cancel_at_period_end || false,
              current_period_start: new Date(
                stripeSubscription.current_period_start * 1000
              ).toISOString(),
              current_period_end: new Date(
                stripeSubscription.current_period_end * 1000
              ).toISOString(),
            })
            .eq('user_id', userId);

          // Update user account type
          await supabase
            .from('users')
            .update({ account_type: 'pro' })
            .eq('id', userId);

          return NextResponse.json({ 
            success: true,
            message: 'Subscription verified and updated',
          });
        }
      } catch (error) {
        console.error('Error retrieving subscription:', error);
      }
    }

    return NextResponse.json({ 
      success: false,
      message: 'No active subscription found. Please check your Stripe dashboard or try again in a moment.',
    });

  } catch (error: any) {
    console.error('Verify subscription error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

