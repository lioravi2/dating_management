/**
 * Script to clean up test users from Supabase
 * Run with: npx tsx scripts/cleanup-test-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables:');
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

async function cleanupTestUsers() {
  console.log('🧹 Starting cleanup of test users...\n');

  try {
    // Get all users
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return;
    }

    const users = usersData?.users || [];
    console.log(`Found ${users.length} total user(s)\n`);

    // Filter test users (emails starting with 'test-' and ending with '@example.com')
    const testUsers = users.filter(
      (user) => user.email && user.email.startsWith('test-') && user.email.includes('@example.com')
    );

    if (testUsers.length === 0) {
      console.log('✓ No test users found to clean up');
      return;
    }

    console.log(`Found ${testUsers.length} test user(s) to delete:\n`);
    testUsers.forEach((user) => {
      console.log(`  - ${user.email} (${user.id})`);
    });
    console.log('');

    // Delete each test user
    let deletedCount = 0;
    for (const user of testUsers) {
      try {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (deleteError) {
          console.error(`✗ Error deleting ${user.email}:`, deleteError.message);
        } else {
          console.log(`✓ Deleted: ${user.email}`);
          deletedCount++;
        }
      } catch (error: any) {
        console.error(`✗ Error deleting ${user.email}:`, error.message);
      }
    }

    console.log(`\n✅ Cleanup completed: ${deletedCount}/${testUsers.length} user(s) deleted`);
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

// Run cleanup
cleanupTestUsers()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

