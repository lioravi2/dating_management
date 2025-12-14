/**
 * Script to change user account type from PRO to FREE
 * 
 * Usage: npx tsx scripts/change-account-to-free.ts <email>
 * 
 * This will:
 * 1. Set account_type to 'free' in the users table
 * 2. Cancel any active Stripe subscriptions
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

async function changeAccountToFree(email: string) {
  console.log(`\n🔄 Changing account to FREE for: ${email}\n`);

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

    // 3. Cancel Stripe subscription if exists
    if (subscription?.stripe_subscription_id) {
      console.log(`\n📋 Canceling Stripe subscription: ${subscription.stripe_subscription_id}`);
      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        console.log('✓ Stripe subscription canceled');
      } catch (error: any) {
        console.warn(`⚠ Could not cancel Stripe subscription: ${error.message}`);
      }
    }

    // 4. Update subscription status in database
    if (subscription) {
      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'canceled',
        })
        .eq('user_id', user.id);

      if (subError) {
        console.error('❌ Error updating subscription:', subError);
      } else {
        console.log('✓ Subscription status updated to canceled');
      }
    }

    // 5. Change account type to FREE
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({ account_type: 'free' })
      .eq('id', user.id);

    if (userError) {
      console.error('❌ Error updating user account type:', userError);
      process.exit(1);
    }

    console.log('✓ Account type changed to FREE');
    console.log('\n✅ Successfully changed account to FREE!\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Usage: npx tsx scripts/change-account-to-free.ts <email>');
  console.error('Example: npx tsx scripts/change-account-to-free.ts test@example.com');
  process.exit(1);
}

changeAccountToFree(email)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });




