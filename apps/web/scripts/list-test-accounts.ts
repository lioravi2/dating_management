/**
 * Script to list all PRO accounts (for testing purposes)
 * 
 * Usage: npx tsx scripts/list-test-accounts.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

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

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing Supabase environment variables.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function listTestAccounts() {
  console.log('\n📋 Listing all PRO accounts...\n');

  try {
    // Get all PRO users
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, account_type, created_at')
      .eq('account_type', 'pro')
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.log('No PRO accounts found.\n');
      return;
    }

    console.log(`Found ${users.length} PRO account(s):\n`);

    for (const user of users) {
      // Get subscription info
      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log(`📧 Email: ${user.email}`);
      console.log(`   Name: ${user.full_name || 'N/A'}`);
      console.log(`   Account Type: ${user.account_type}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`);
      
      if (subscription) {
        console.log(`   Subscription Status: ${subscription.status}`);
        if (subscription.stripe_subscription_id) {
          console.log(`   Stripe Subscription ID: ${subscription.stripe_subscription_id}`);
        }
        if (subscription.current_period_end) {
          console.log(`   Period End: ${new Date(subscription.current_period_end).toLocaleString()}`);
        }
      } else {
        console.log(`   Subscription: None`);
      }
      console.log('');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

listTestAccounts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });




