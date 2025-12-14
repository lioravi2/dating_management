/**
 * Script to properly check database schema using information_schema
 * Run with: npx tsx scripts/check-schema-properly.ts
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
  console.error('Error: .env.local not found.');
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

async function checkSchema() {
  console.log('🔍 Checking database schema using information_schema...\n');

  // Check which tables exist
  const { data: tables, error: tablesError } = await supabaseAdmin.rpc('exec_sql', {
    query: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `,
  }).catch(async () => {
    // Fallback: use direct query
    const { data, error } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');
    return { data, error };
  });

  // Better approach: query each table individually
  console.log('📊 Checking tables:');
  console.log('─'.repeat(60));

  const tableNames = ['users', 'partners', 'partner_notes', 'subscriptions', 'payments', 'partner_photos'];
  
  for (const tableName of tableNames) {
    const { data, error } = await supabaseAdmin
      .rpc('exec_sql', {
        query: `
          SELECT EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${tableName}'
          ) as exists;
        `,
      })
      .catch(async () => {
        // Direct approach: try to get column info
        const { data: cols, error: colsError } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .limit(0);
        
        if (colsError) {
          if (colsError.code === '42P01' || colsError.message.includes('does not exist')) {
            return { data: [{ exists: false }], error: null };
          }
          return { data: null, error: colsError };
        }
        return { data: [{ exists: true }], error: null };
      });

    const exists = !error && (data?.[0]?.exists ?? false);
    console.log(`  ${exists ? '✅' : '❌'} ${tableName}`);
  }

  // Check columns for existing tables
  console.log('\n📋 Checking columns for existing tables:');
  console.log('─'.repeat(60));

  // Check users table
  const checkTableColumns = async (tableName: string, expectedColumns: string[]) => {
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select('*')
      .limit(0);

    if (error && (error.code === '42P01' || error.message.includes('does not exist'))) {
      console.log(`\n  ❌ ${tableName} table does not exist`);
      return;
    }

    console.log(`\n  📄 ${tableName}:`);
    
    // Try to query information_schema for column details
    for (const col of expectedColumns) {
      // Try selecting the column - if it works, it exists
      const { error: colError } = await supabaseAdmin
        .from(tableName)
        .select(col)
        .limit(0);

      if (colError) {
        if (colError.message.includes('column') && colError.message.includes('does not exist')) {
          console.log(`    ❌ ${col} - MISSING`);
        } else {
          console.log(`    ⚠️  ${col} - Error: ${colError.message.substring(0, 50)}`);
        }
      } else {
        // Check if nullable
        const { error: nullableError } = await supabaseAdmin
          .from(tableName)
          .insert({ [col]: null } as any)
          .select()
          .limit(0)
          .catch(() => ({ error: { message: 'NOT NULL constraint' } }));

        const isNullable = nullableError?.message?.includes('NOT NULL') ? false : true;
        console.log(`    ✅ ${col} ${isNullable ? '(nullable)' : '(NOT NULL)'}`);
      }
    }
  };

  // Check users table columns
  await checkTableColumns('users', [
    'id',
    'email',
    'full_name',
    'account_type',
    'email_verified_at',
    'last_login',
    'created_at',
    'updated_at',
  ]);

  // Check subscriptions table columns
  await checkTableColumns('subscriptions', [
    'id',
    'user_id',
    'stripe_subscription_id',
    'stripe_customer_id',
    'status',
    'plan_type',
    'cancel_at_period_end',
    'current_period_start',
    'current_period_end',
    'cancellation_reason',
    'created_at',
    'updated_at',
  ]);

  // Check payments table columns
  await checkTableColumns('payments', [
    'id',
    'user_id',
    'stripe_payment_intent_id',
    'stripe_invoice_id',
    'amount',
    'currency',
    'status',
    'paid_at',
    'created_at',
    'updated_at',
  ]);

  console.log('\n✨ Schema check complete!\n');
}

checkSchema()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });




