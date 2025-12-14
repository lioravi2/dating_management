/**
 * Script to check current database schema in Supabase
 * Run with: npx tsx scripts/check-database-schema.ts
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
  console.error('NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkSchema() {
  console.log('🔍 Checking current database schema...\n');

  // Check for tables
  const tables = [
    'users',
    'partners',
    'partner_notes',
    'subscriptions',
    'payments',
    'partner_photos',
  ];

  console.log('📊 Tables Status:');
  console.log('─'.repeat(50));

  for (const table of tables) {
    try {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('*')
        .limit(0);

      if (error) {
        if (error.code === '42P01') {
          console.log(`  ❌ ${table}: NOT EXISTS`);
        } else {
          console.log(`  ⚠️  ${table}: ERROR - ${error.message}`);
        }
      } else {
        console.log(`  ✅ ${table}: EXISTS`);
        
        // Check columns for key tables
        if (table === 'partners') {
          const { data: columns } = await supabaseAdmin.rpc('get_table_columns', {
            table_name: table,
          }).catch(() => ({ data: null }));
          
          // Alternative: try to query with specific columns
          const testQueries = [
            { col: 'internal_id', query: supabaseAdmin.from(table).select('internal_id').limit(0) },
            { col: 'first_name', query: supabaseAdmin.from(table).select('first_name').limit(0) },
          ];
          
          for (const test of testQueries) {
            const { error: colError } = await test.query;
            if (colError && colError.message.includes('column') && colError.message.includes('does not exist')) {
              console.log(`     ⚠️  Missing column: ${test.col}`);
            }
          }
        }
      }
    } catch (error: any) {
      console.log(`  ❌ ${table}: ERROR - ${error.message}`);
    }
  }

  console.log('\n📋 Checking specific columns:');
  console.log('─'.repeat(50));

  // Check partners table columns
  if (await tableExists('partners')) {
    const partnerColumns = [
      'id',
      'user_id',
      'internal_id',
      'first_name',
      'last_name',
      'email',
      'phone_number',
      'description',
      'description_time',
      'created_at',
      'updated_at',
    ];

    for (const col of partnerColumns) {
      const exists = await columnExists('partners', col);
      console.log(`  ${exists ? '✅' : '❌'} partners.${col}`);
    }
  }

  // Check subscriptions table columns
  if (await tableExists('subscriptions')) {
    const subscriptionColumns = [
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
    ];

    for (const col of subscriptionColumns) {
      const exists = await columnExists('subscriptions', col);
      console.log(`  ${exists ? '✅' : '❌'} subscriptions.${col}`);
    }
  }

  // Check if partner_photos table exists
  if (await tableExists('partner_photos')) {
    console.log('\n✅ partner_photos table exists');
    const photoColumns = [
      'id',
      'partner_id',
      'storage_path',
      'file_name',
      'file_size',
      'mime_type',
      'width',
      'height',
      'uploaded_at',
      'created_at',
      'updated_at',
    ];

    for (const col of photoColumns) {
      const exists = await columnExists('partner_photos', col);
      console.log(`  ${exists ? '✅' : '❌'} partner_photos.${col}`);
    }
  } else {
    console.log('\n❌ partner_photos table does NOT exist');
  }

  console.log('\n✨ Schema check complete!\n');
}

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from(tableName).select('*').limit(0);
    return !error || error.code !== '42P01';
  } catch {
    return false;
  }
}

async function columnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    // Try to select the column - if it doesn't exist, we'll get an error
    const { error } = await supabaseAdmin
      .from(tableName)
      .select(columnName)
      .limit(0);
    
    if (error) {
      // Check if error is about missing column
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        return false;
      }
      // Other errors might mean column exists but there's a different issue
      return true;
    }
    return true;
  } catch {
    return false;
  }
}

// Run check
checkSchema()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });




