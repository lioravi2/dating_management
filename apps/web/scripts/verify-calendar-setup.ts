/**
 * Script to verify calendar integration setup
 * Run with: tsx scripts/verify-calendar-setup.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifySetup() {
  console.log('🔍 Verifying Calendar Integration Setup...\n');

  let allGood = true;

  // 1. Check timezone column
  console.log('1. Checking users table timezone column...');
  try {
    const { data, error } = await supabase
      .from('users')
      .select('timezone')
      .limit(1);

    if (error) {
      console.error('   ❌ Error:', error.message);
      allGood = false;
    } else {
      console.log('   ✅ timezone column exists');
      if (data && data.length > 0) {
        console.log(`   ✅ Sample timezone value: ${data[0].timezone || 'NULL'}`);
      }
    }
  } catch (err: any) {
    console.error('   ❌ Failed:', err.message);
    allGood = false;
  }

  // 2. Check calendar_connections table
  console.log('\n2. Checking calendar_connections table...');
  try {
    const { data, error } = await supabase
      .from('calendar_connections')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        console.error('   ❌ Table does not exist - run migration 014_create_calendar_connections.sql');
        allGood = false;
      } else {
        console.error('   ❌ Error:', error.message);
        allGood = false;
      }
    } else {
      console.log('   ✅ calendar_connections table exists');
    }
  } catch (err: any) {
    console.error('   ❌ Failed:', err.message);
    allGood = false;
  }

  // 3. Check environment variables
  console.log('\n3. Checking environment variables...');
  const requiredVars = {
    'NEXT_PUBLIC_GOOGLE_PLACES_API_KEY': process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY,
    'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID,
    'GOOGLE_CLIENT_SECRET': process.env.GOOGLE_CLIENT_SECRET,
    'GOOGLE_CALENDAR_REDIRECT_URI': process.env.GOOGLE_CALENDAR_REDIRECT_URI,
  };

  for (const [key, value] of Object.entries(requiredVars)) {
    if (value) {
      // Mask sensitive values
      const displayValue = key.includes('SECRET') || key.includes('KEY')
        ? `${value.substring(0, 8)}...`
        : value;
      console.log(`   ✅ ${key}: ${displayValue}`);
    } else {
      console.error(`   ❌ ${key}: NOT SET`);
      allGood = false;
    }
  }

  // 4. Summary
  console.log('\n' + '='.repeat(50));
  if (allGood) {
    console.log('✅ All checks passed! Setup looks good.');
    console.log('\nNext steps:');
    console.log('1. Start your dev server: npm run dev');
    console.log('2. Go to Profile page and try connecting Google Calendar');
    console.log('3. Create an activity and test the sync button');
  } else {
    console.log('❌ Some checks failed. Please review the errors above.');
  }
  console.log('='.repeat(50));
}

verifySetup().catch(console.error);

