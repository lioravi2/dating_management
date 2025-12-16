/**
 * Simple script to check what tables and columns exist
 * Run with: npx tsx scripts/check-schema-simple.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

const envPath = resolve(__dirname, '../.env.local');
if (existsSync(envPath)) {
  config({ path: envPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function checkTable(tableName: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from(tableName).select('*').limit(0);
  if (error) {
    if (error.code === '42P01' || error.message.includes('does not exist') || error.message.includes('schema cache')) {
      return false;
    }
  }
  return !error;
}

async function checkColumn(tableName: string, columnName: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from(tableName).select(columnName).limit(0);
  if (error) {
    if (error.message.includes('column') && error.message.includes('does not exist')) {
      return false;
    }
  }
  return !error;
}

async function main() {
  console.log('🔍 Checking database schema...\n');

  const tables = {
    users: ['id', 'email', 'full_name', 'account_type', 'email_verified_at', 'last_login', 'created_at', 'updated_at'],
    partners: ['id', 'user_id', 'internal_id', 'first_name', 'last_name', 'email', 'phone_number', 'description', 'description_time', 'created_at', 'updated_at'],
    partner_notes: ['id', 'partner_id', 'start_time', 'end_time', 'type', 'location', 'description', 'google_calendar_event_id', 'created_at', 'updated_at'],
    subscriptions: ['id', 'user_id', 'stripe_subscription_id', 'stripe_customer_id', 'status', 'plan_type', 'cancel_at_period_end', 'current_period_start', 'current_period_end', 'cancellation_reason', 'created_at', 'updated_at'],
    payments: ['id', 'user_id', 'stripe_payment_intent_id', 'stripe_invoice_id', 'amount', 'currency', 'status', 'paid_at', 'created_at', 'updated_at'],
    partner_photos: ['id', 'partner_id', 'storage_path', 'file_name', 'file_size', 'mime_type', 'width', 'height', 'uploaded_at', 'created_at', 'updated_at'],
  };

  for (const [tableName, columns] of Object.entries(tables)) {
    const exists = await checkTable(tableName);
    console.log(`${exists ? '✅' : '❌'} Table: ${tableName}`);
    
    if (exists) {
      for (const col of columns) {
        const colExists = await checkColumn(tableName, col);
        if (!colExists) {
          console.log(`   ⚠️  Missing column: ${col}`);
        }
      }
    }
    console.log('');
  }

  console.log('✨ Done!');
}

main().catch(console.error);






