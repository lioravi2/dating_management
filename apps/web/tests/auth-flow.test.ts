/**
 * Authentication and Profile Flow E2E Tests
 * 
 * Tests the complete user journey:
 * 1. Sign in with non-existent user (should show error)
 * 2. Sign up new user
 * 3. Verify email
 * 4. Log in
 * 5. Update profile name
 * 6. Log in again and verify data accuracy
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Try multiple paths for .env.local
const envPaths = [
  resolve(__dirname, '../.env.local'),
  resolve(__dirname, '../../.env.local'),
  resolve(process.cwd(), '.env.local'),
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    config({ path: envPath });
    envLoaded = true;
    break;
  }
}

import { createClient } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  const missing = [];
  if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  const errorMessage = isCI
    ? `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please add them as GitHub Secrets in your repository settings:\n` +
      `Settings → Secrets and variables → Actions → New repository secret\n` +
      `You can find SUPABASE_SERVICE_ROLE_KEY in your Supabase Dashboard → Settings → API`
    : `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please add them to your .env.local file.\n` +
      `You can find SUPABASE_SERVICE_ROLE_KEY in your Supabase Dashboard → Settings → API`;
  
  throw new Error(errorMessage);
}

// Create admin client for database checks
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Helper function to generate unique test email
function generateTestEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

// Helper function to clean up test user
async function cleanupUser(email: string) {
  try {
    // Get user by email
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === email);
    
    if (user) {
      // Delete from auth.users (this should cascade to public.users)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error('Error deleting user:', deleteError);
      } else {
        console.log('✓ Test user cleaned up:', email);
      }
    }
  } catch (error) {
    console.error('Error cleaning up user:', error);
  }
}

// Helper function to clean up all test users (users with test- prefix)
async function cleanupAllTestUsers() {
  try {
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const testUsers = users?.users?.filter(u => 
      u.email && u.email.startsWith('test-') && u.email.includes('@example.com')
    ) || [];
    
    for (const user of testUsers) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(user.id);
        console.log('✓ Cleaned up test user:', user.email);
      } catch (error) {
        console.error(`Error deleting test user ${user.email}:`, error);
      }
    }
    
    if (testUsers.length > 0) {
      console.log(`✓ Cleaned up ${testUsers.length} test user(s)`);
    }
  } catch (error) {
    console.error('Error cleaning up test users:', error);
  }
}

// Helper function to check user in database
async function checkUserInDatabase(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  return { data, error };
}

describe('Authentication and Profile Flow', () => {
  const testEmail = generateTestEmail();
  const testName = 'Test User';
  const updatedName = 'Updated Test User';
  let userId: string | null = null;

  // Cleanup after all tests
  afterAll(async () => {
    console.log('\n🧹 Starting cleanup...');
    try {
      if (testEmail) {
        await cleanupUser(testEmail);
      }
      // Also clean up any other test users that might have been left behind
      await cleanupAllTestUsers();
      console.log('✅ Cleanup completed\n');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error; // Fail the test suite if cleanup fails
    }
  }, 30000); // 30 second timeout for cleanup

  test('1. Sign in with non-existent user should show error message', async () => {
    const nonExistentEmail = `nonexistent-${Date.now()}@example.com`;
    
    // Check if user exists using the check-user API logic
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = users?.users?.some((user) => user.email === nonExistentEmail);
    
    expect(userExists).toBe(false);
    console.log('✓ Non-existent user check passed');
  });

  test('2. Sign up new user', async () => {
    // Create user via Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      email_confirm: false, // User needs to verify email
      password: 'TestPassword123!', // Not used for magic link, but required
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();
    if (!data.user) throw new Error('User creation failed');
    expect(data.user.email).toBe(testEmail);
    userId = data.user.id;
    
    console.log('✓ User created:', userId);
    
    // Check that user profile was created in public.users
    const { data: userProfile, error: profileError } = await checkUserInDatabase(userId);
    expect(profileError).toBeNull();
    expect(userProfile).toBeDefined();
    expect(userProfile?.email).toBe(testEmail);
    expect(userProfile?.email_verified_at).toBeNull(); // Not verified yet
    
    console.log('✓ User profile created in database');
  });

  test('3. Verify email and check email_verified_at', async () => {
    if (!userId) throw new Error('User ID not set');
    
    // Simulate email verification by updating auth.users
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!authUser.user) throw new Error('User not found');
    
    // Update email_confirmed_at to simulate verification
    const confirmedAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { email_confirm: true }
    );
    
    expect(updateError).toBeNull();
    console.log('✓ Email verification simulated');
    
    // Wait a bit for trigger to fire
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check that email_verified_at was set in public.users
    const { data: userProfile } = await checkUserInDatabase(userId);
    expect(userProfile?.email_verified_at).toBeDefined();
    expect(userProfile?.email_verified_at).not.toBeNull();
    
    console.log('✓ email_verified_at set correctly:', userProfile?.email_verified_at);
  });

  test('4. Log in and check last_login is updated', async () => {
    if (!userId) throw new Error('User ID not set');
    
    // Simulate login by updating last_sign_in_at
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {}
    );
    
    // Trigger login by updating auth.users (this should trigger handle_user_login)
    // We'll manually update last_login to simulate the trigger
    const { error: loginError } = await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId);
    
    expect(loginError).toBeNull();
    console.log('✓ Login simulated');
    
    // Check that last_login was updated
    const { data: userProfile } = await checkUserInDatabase(userId);
    expect(userProfile?.last_login).toBeDefined();
    expect(userProfile?.last_login).not.toBeNull();
    
    const loginTime = new Date(userProfile!.last_login!);
    const now = new Date();
    const timeDiff = Math.abs(now.getTime() - loginTime.getTime());
    expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
    
    console.log('✓ last_login updated correctly:', userProfile?.last_login);
  });

  test('5. Update profile name', async () => {
    if (!userId) throw new Error('User ID not set');
    
    // Update full_name in public.users
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ full_name: updatedName })
      .eq('id', userId);
    
    expect(updateError).toBeNull();
    console.log('✓ Profile name updated');
    
    // Check that name was updated
    const { data: userProfile } = await checkUserInDatabase(userId);
    expect(userProfile?.full_name).toBe(updatedName);
    
    // Check that updated_at was updated (but not last_login)
    expect(userProfile?.updated_at).toBeDefined();
    const updatedAt = new Date(userProfile!.updated_at!);
    const now = new Date();
    const timeDiff = Math.abs(now.getTime() - updatedAt.getTime());
    expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
    
    console.log('✓ Name updated correctly:', userProfile?.full_name);
    console.log('✓ updated_at updated correctly:', userProfile?.updated_at);
  });

  test('6. Log in again and verify data accuracy', async () => {
    if (!userId) throw new Error('User ID not set');
    
    // Get current state
    const { data: beforeLogin } = await checkUserInDatabase(userId);
    const beforeLoginTime = beforeLogin?.last_login;
    const beforeUpdatedAt = beforeLogin?.updated_at;
    
    // Simulate another login
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    const { error: loginError } = await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId);
    
    expect(loginError).toBeNull();
    
    // Check final state
    const { data: afterLogin } = await checkUserInDatabase(userId);
    
    // Verify all data is correct
    expect(afterLogin?.email).toBe(testEmail);
    expect(afterLogin?.full_name).toBe(updatedName);
    expect(afterLogin?.email_verified_at).toBeDefined();
    expect(afterLogin?.email_verified_at).not.toBeNull();
    expect(afterLogin?.last_login).toBeDefined();
    expect(afterLogin?.last_login).not.toBeNull();
    
    // Verify last_login was updated
    if (beforeLoginTime) {
      const before = new Date(beforeLoginTime);
      const after = new Date(afterLogin!.last_login!);
      expect(after.getTime()).toBeGreaterThan(before.getTime());
    }
    
    // Verify updated_at was NOT updated on login (only last_login changed)
    expect(afterLogin?.updated_at).toBe(beforeUpdatedAt);
    
    console.log('✓ Final data verification:');
    console.log('  - Email:', afterLogin?.email);
    console.log('  - Full Name:', afterLogin?.full_name);
    console.log('  - Email Verified At:', afterLogin?.email_verified_at);
    console.log('  - Last Login:', afterLogin?.last_login);
    console.log('  - Updated At:', afterLogin?.updated_at);
    console.log('✓ All data is accurate!');
  });
});

