# Test Suite

This directory contains automated tests for the Dating App.

## Test Files

- `auth-flow.test.ts` - End-to-end tests for authentication and profile flows

## Running Tests

### Prerequisites

1. Make sure you have environment variables set up in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
   
   **Important:** The `SUPABASE_SERVICE_ROLE_KEY` is required for tests to work.
   You can find it in your Supabase Dashboard → Settings → API → Service Role Key
   (Keep this key secret - it bypasses Row Level Security!)

2. Install dependencies:
   ```bash
   npm install
   ```

### Run Tests

```bash
# Run all tests (with detailed output)
npm test

# Run tests with verbose output (even more details)
npm run test:verbose

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Understanding Test Output

- **✓** = Test passed
- **✗** = Test failed
- **🧹** = Cleanup in progress
- **✅** = Cleanup completed
- **❌** = Error occurred

If you see test users in your database after running tests:
1. The cleanup might have failed (check console for errors)
2. Tests might have been interrupted (Ctrl+C)
3. You can manually delete them in Supabase Dashboard → Authentication → Users

## Test Coverage

### Authentication Flow Tests

1. **Sign in with non-existent user** - Verifies error handling
2. **Sign up new user** - Tests user creation and profile creation
3. **Verify email** - Checks email_verified_at is set correctly
4. **Log in** - Verifies last_login is updated
5. **Update profile name** - Tests profile updates and updated_at tracking
6. **Log in again** - Verifies data accuracy and that updated_at doesn't change on login

## Test Data

Tests use unique email addresses generated with timestamps to avoid conflicts:
- Format: `test-{timestamp}-{random}@example.com`
- Tests automatically clean up created users after completion

## Notes

- Tests use the Supabase Admin API (service role key) to bypass RLS
- Tests run against your actual Supabase database
- Make sure you're using a test/development Supabase project
- Tests verify database state directly, not just UI behavior

