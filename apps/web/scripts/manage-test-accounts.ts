/**
 * Script to manage multiple test accounts at once
 * 
 * Usage: 
 *   npx tsx scripts/manage-test-accounts.ts cancel <email1> <email2> ...
 *   npx tsx scripts/manage-test-accounts.ts daily <email1> <email2> ...
 *   npx tsx scripts/manage-test-accounts.ts free <email1> <email2> ...
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
import Stripe from 'stripe';

// Load environment variables
const envPath = resolve(__dirname, '../.env.local');
if (existsSync(envPath)) {
  config({ path: envPath });
} else {
  console.error('Error: .env.local not found. Please ensure it exists in apps/web/.env.local');
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing Supabase environment variables.');
  process.exit(1);
}

if (!STRIPE_SECRET_KEY) {
  console.error('Error: Missing STRIPE_SECRET_KEY environment variable.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

async function cancelSubscription(email: string) {
  console.log(`\n🔄 Canceling subscription for: ${email}`);

  try {
    // Find user by email
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.users?.find((u) => u.email === email);

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      return false;
    }

    // Get subscription info
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!subscription?.stripe_subscription_id) {
      console.log(`⚠ No active subscription found for: ${email}`);
      return true;
    }

    console.log(`   Found subscription: ${subscription.stripe_subscription_id}`);

    // Cancel Stripe subscription immediately
    try {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      console.log('   ✓ Stripe subscription canceled');
    } catch (error: any) {
      console.warn(`   ⚠ Could not cancel Stripe subscription: ${error.message}`);
    }

    // Update subscription status in database
    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'canceled',
      })
      .eq('user_id', user.id);

    if (subError) {
      console.error(`   ❌ Error updating subscription: ${subError.message}`);
      return false;
    }

    console.log('   ✓ Subscription canceled in database');
    return true;
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function changeToDaily(email: string) {
  console.log(`\n🔄 Changing subscription to daily billing for: ${email}`);

  try {
    // Find user by email
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.users?.find((u) => u.email === email);

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      return false;
    }

    // Get subscription info
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!subscription?.stripe_subscription_id) {
      console.error(`❌ No active subscription found for: ${email}`);
      return false;
    }

    console.log(`   Found subscription: ${subscription.stripe_subscription_id}`);

    // Get the Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );

    if (!stripeSubscription.items.data[0]) {
      console.error('   ❌ No subscription items found');
      return false;
    }

    // Create a new daily price ($0.10/day for testing)
    console.log('   Creating daily price ($0.10/day)...');
    const dailyPrice = await stripe.prices.create({
      currency: 'usd',
      unit_amount: 10, // $0.10 in cents
      recurring: {
        interval: 'day',
      },
      product_data: {
        name: 'Dating Assistant Pro (Daily)',
        description: 'Premium features - Daily billing (Testing)',
      },
    });

    console.log(`   ✓ Created daily price: ${dailyPrice.id}`);

    // Update subscription to use daily price
    console.log('   Updating subscription to daily billing...');
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: dailyPrice.id,
          },
        ],
        proration_behavior: 'none', // Don't charge for proration
      }
    );

    console.log('   ✓ Subscription updated to daily billing');

    // Update database with new period dates
    const { error: dbError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        current_period_start: new Date(updatedSubscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
      })
      .eq('user_id', user.id);

    if (dbError) {
      console.warn(`   ⚠ Could not update database: ${dbError.message}`);
    } else {
      console.log('   ✓ Database updated');
    }

    return true;
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function changeToFree(email: string) {
  console.log(`\n🔄 Changing account to FREE for: ${email}`);

  try {
    // Find user by email
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.users?.find((u) => u.email === email);

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      return false;
    }

    // Cancel subscription first
    await cancelSubscription(email);

    // Change account type to FREE
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({ account_type: 'free' })
      .eq('id', user.id);

    if (userError) {
      console.error(`   ❌ Error updating account type: ${userError.message}`);
      return false;
    }

    console.log('   ✓ Account type changed to FREE');
    return true;
  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  const action = process.argv[2];
  const emails = process.argv.slice(3);

  if (!action || !['cancel', 'daily', 'free'].includes(action)) {
    console.error('Usage:');
    console.error('  npx tsx scripts/manage-test-accounts.ts cancel <email1> <email2> ...');
    console.error('  npx tsx scripts/manage-test-accounts.ts daily <email1> <email2> ...');
    console.error('  npx tsx scripts/manage-test-accounts.ts free <email1> <email2> ...');
    console.error('');
    console.error('Examples:');
    console.error('  npx tsx scripts/manage-test-accounts.ts cancel avilior@hotmail.com avilior2@gmail.com');
    console.error('  npx tsx scripts/manage-test-accounts.ts daily avilior@hotmail.com avilior2@gmail.com');
    console.error('  npx tsx scripts/manage-test-accounts.ts free avilior@hotmail.com avilior2@gmail.com');
    process.exit(1);
  }

  if (emails.length === 0) {
    console.error('Error: Please provide at least one email address');
    process.exit(1);
  }

  console.log(`\n📋 Processing ${emails.length} account(s) with action: ${action}\n`);

  const results: boolean[] = [];
  for (const email of emails) {
    let result = false;
    switch (action) {
      case 'cancel':
        result = await cancelSubscription(email);
        break;
      case 'daily':
        result = await changeToDaily(email);
        break;
      case 'free':
        result = await changeToFree(email);
        break;
    }
    results.push(result);
  }

  const successCount = results.filter((r) => r).length;
  console.log(`\n✅ Completed: ${successCount}/${emails.length} account(s) processed successfully\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

