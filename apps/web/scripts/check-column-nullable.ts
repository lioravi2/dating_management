/**
 * Quick script to check if partners.first_name is nullable
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

async function checkNullable() {
  // Try to insert a partner with null first_name
  const { error } = await supabaseAdmin
    .from('partners')
    .insert({
      user_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
      first_name: null,
    })
    .select();

  if (error) {
    if (error.message.includes('null value') || error.message.includes('NOT NULL')) {
      console.log('❌ partners.first_name is NOT NULL (needs to be made optional)');
    } else {
      console.log('⚠️  Error (might be due to foreign key):', error.message);
    }
  } else {
    console.log('✅ partners.first_name is already nullable');
    // Clean up test record
    await supabaseAdmin.from('partners').delete().eq('user_id', '00000000-0000-0000-0000-000000000000');
  }
}

checkNullable().then(() => process.exit(0)).catch(console.error);

