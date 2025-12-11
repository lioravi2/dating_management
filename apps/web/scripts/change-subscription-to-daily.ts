/**
 * Script to change subscription billing interval to daily (for testing)
 * 
 * Usage: npx tsx scripts/change-subscription-to-daily.ts <email>
 * 
 * This will:
 * 1. Find the user's Stripe subscription
 * 2. Update it to bill daily instead of monthly
 * 3. Update the price to $0.10/day (for testing)
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

async function changeSubscriptionToDaily(email: string) {
  console.log(`\n🔄 Changing subscription to daily billing for: ${email}\n`);

  try {
    // 1. Find user by email
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.users?.find((u) => u.email === email);

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    console.log(`✓ Found user: ${user.id}`);

    // 2. Get subscription info
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!subscription?.stripe_subscription_id) {
      console.error(`❌ No active subscription found for user: ${email}`);
      console.log('💡 Tip: User needs to have an active subscription first.');
      process.exit(1);
    }

    console.log(`✓ Found subscription: ${subscription.stripe_subscription_id}`);

    // 3. Get the Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id
    );

    if (!stripeSubscription.items.data[0]) {
      console.error('❌ No subscription items found');
      process.exit(1);
    }

    const currentPriceId = stripeSubscription.items.data[0].price.id;

    // 4. Create a new daily price ($0.10/day for testing)
    console.log('\n📋 Creating daily price ($0.10/day)...');
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

    console.log(`✓ Created daily price: ${dailyPrice.id}`);

    // 5. Update subscription to use daily price
    console.log('\n📋 Updating subscription to daily billing...');
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

    console.log('✓ Subscription updated to daily billing');
    console.log(`\n📊 Subscription Details:`);
    console.log(`   - Billing Interval: ${updatedSubscription.items.data[0].price.recurring?.interval}`);
    console.log(`   - Price: $${(updatedSubscription.items.data[0].price.unit_amount! / 100).toFixed(2)}`);
    console.log(`   - Next billing date: ${new Date(updatedSubscription.current_period_end * 1000).toLocaleString()}`);

    // 6. Update database with new period dates
    const { error: dbError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        current_period_start: new Date(updatedSubscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
      })
      .eq('user_id', user.id);

    if (dbError) {
      console.warn(`⚠ Could not update database: ${dbError.message}`);
    } else {
      console.log('✓ Database updated with new billing period');
    }

    console.log('\n✅ Successfully changed subscription to daily billing!\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/change-subscription-to-daily.ts <email>');
  console.error('Example: npx tsx scripts/change-subscription-to-daily.ts test@example.com');
  process.exit(1);
}

changeSubscriptionToDaily(email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

