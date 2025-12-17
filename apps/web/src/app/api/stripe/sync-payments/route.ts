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
    // Include all subscriptions (active, canceled, canceling) to find customer ID
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, status, cancel_at_period_end')
      .eq('user_id', userId)
      .maybeSingle();

    if (subError) {
      console.error('[SyncPayments] Error fetching subscription:', subError);
      return NextResponse.json({ 
        success: false,
        message: `Error fetching subscription: ${subError.message}`,
      }, { status: 500 });
    }

    if (!subscription) {
      return NextResponse.json({ 
        success: false,
        message: 'No subscription found. Please sync your subscription first.',
      });
    }

    console.log(`[SyncPayments] Found subscription: status=${subscription.status}, cancel_at_period_end=${subscription.cancel_at_period_end}, customer_id=${subscription.stripe_customer_id}`);

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

    console.log(`[SyncPayments] Found ${invoices.data.length} invoices for customer ${customerId}`);

    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Sync each paid invoice as a payment
    for (const invoice of invoices.data) {
      // Log all invoice details for debugging
      console.log(`[SyncPayments] Processing invoice ${invoice.id}:`, {
        status: invoice.status,
        amount_paid: invoice.amount_paid,
        amount_due: invoice.amount_due,
        total: invoice.total,
        currency: invoice.currency,
        created: new Date(invoice.created * 1000).toISOString(),
        payment_intent: invoice.payment_intent,
      });
      
      // Sync all paid invoices, including:
      // 1. Invoices with amount_paid > 0 (normal payments)
      // 2. Invoices paid with credits (amount_paid = 0 but total > 0 and status = 'paid')
      // Note: amount_paid and total are in cents, so $0.10 = 10 cents
      const hasNormalPayment = invoice.amount_paid !== null && invoice.amount_paid > 0;
      const paidWithCredits = invoice.status === 'paid' && 
                              invoice.total !== null && 
                              invoice.total > 0 && 
                              (invoice.amount_paid === 0 || invoice.amount_paid === null);
      
      if (invoice.status === 'paid' && (hasNormalPayment || paidWithCredits)) {
        // Check if payment already exists
        const { data: existingPayment } = await supabaseAdmin
          .from('payments')
          .select('id')
          .eq('stripe_invoice_id', invoice.id)
          .maybeSingle();

        if (existingPayment) {
          console.log(`[SyncPayments] Payment already exists for invoice ${invoice.id}, skipping`);
          skippedCount++;
          continue;
        }

        // Insert payment record
        // For normal payments: use amount_paid (in cents)
        // For credit payments: use total (invoice was paid with credits, so amount_paid = 0)
        // For $0.10, amount_paid should be 10 (cents)
        const paymentAmount = hasNormalPayment 
          ? invoice.amount_paid 
          : (invoice.total || 0); // Use total for credit payments
        
        const paymentData = {
          user_id: userId,
          stripe_payment_intent_id: invoice.payment_intent as string | null,
          stripe_invoice_id: invoice.id,
          amount: paymentAmount,
          currency: invoice.currency,
          status: 'succeeded' as const,
          paid_at: new Date(invoice.created * 1000).toISOString(),
        };
        
        console.log(`[SyncPayments] Payment details: amount=${paymentAmount}, hasNormalPayment=${hasNormalPayment}, paidWithCredits=${paidWithCredits}`);

        console.log(`[SyncPayments] Inserting payment:`, paymentData);

        const { error: insertError } = await supabaseAdmin
          .from('payments')
          .insert(paymentData);

        if (!insertError) {
          syncedCount++;
          console.log(`[SyncPayments] Successfully synced payment for invoice ${invoice.id}`);
        } else {
          errorCount++;
          console.error(`[SyncPayments] Error inserting payment for invoice ${invoice.id}:`, insertError);
        }
      } else {
        console.log(`[SyncPayments] Skipping invoice ${invoice.id}: status=${invoice.status}, amount_paid=${invoice.amount_paid}, amount_due=${invoice.amount_due}`);
      }
    }

    console.log(`[SyncPayments] Sync complete: ${syncedCount} synced, ${skippedCount} skipped, ${errorCount} errors`);

    return NextResponse.json({ 
      success: true,
      message: `Synced ${syncedCount} payment(s) from Stripe (${skippedCount} already existed, ${errorCount} errors)`,
      syncedCount,
      skippedCount,
      errorCount,
    });
  } catch (error: any) {
    console.error('Sync payments error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}






