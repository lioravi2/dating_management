import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import Stripe from 'stripe';

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
    const supabaseAdmin = createSupabaseAdminClient();
    
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user's subscription to find customer ID
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!subscription) {
      return NextResponse.json({ 
        success: false,
        message: 'No subscription found. Please sync your subscription first.',
      });
    }

    // Get customer ID - either from subscription record or from Stripe
    let customerId = subscription.stripe_customer_id;
    
    if (!customerId && subscription.stripe_subscription_id) {
      // Fetch customer ID from Stripe subscription
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id
        );
        customerId = stripeSubscription.customer as string;
        
        // Update subscription record with customer ID for future use
        await supabaseAdmin
          .from('subscriptions')
          .update({ stripe_customer_id: customerId })
          .eq('user_id', userId);
      } catch (error) {
        console.error('Error fetching subscription from Stripe:', error);
        return NextResponse.json({ 
          success: false,
          message: 'Unable to retrieve subscription information from Stripe.',
        });
      }
    }

    if (!customerId) {
      return NextResponse.json({ 
        success: false,
        message: 'No customer ID found. Please sync your subscription first.',
      });
    }

    // Get all invoices for this customer
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 100,
    });

    let syncedCount = 0;

    // Sync each paid invoice as a payment
    for (const invoice of invoices.data) {
      if (invoice.status === 'paid' && invoice.amount_paid > 0) {
        // Check if payment already exists
        const { data: existingPayment } = await supabaseAdmin
          .from('payments')
          .select('id')
          .eq('stripe_invoice_id', invoice.id)
          .maybeSingle();

        if (!existingPayment) {
          // Insert payment record
          const { error: insertError } = await supabaseAdmin
            .from('payments')
            .insert({
              user_id: userId,
              stripe_payment_intent_id: invoice.payment_intent as string,
              stripe_invoice_id: invoice.id,
              amount: invoice.amount_paid,
              currency: invoice.currency,
              status: 'succeeded',
              paid_at: new Date(invoice.created * 1000).toISOString(),
            });

          if (!insertError) {
            syncedCount++;
          } else {
            console.error('Error inserting payment:', insertError);
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Synced ${syncedCount} payment(s) from Stripe`,
      syncedCount,
    });
  } catch (error: any) {
    console.error('Sync payments error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}






