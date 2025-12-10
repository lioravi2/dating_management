# Database Reset Instructions

This guide explains how to completely reset your database when testing or when upgrading versions.

## ⚠️ WARNING
**This will delete ALL data in your database!** Only use this during development.

## Method 1: Reset Public Tables Only (Recommended for Development)

1. Go to your Supabase project dashboard
2. Open **SQL Editor**
3. Copy and paste the entire contents of `supabase/migrations/003_reset_database.sql`
4. Click **Run**
5. This will:
   - Delete all data from `public.users` table
   - Recreate the table structure
   - Recreate all triggers and functions

## Method 2: Reset Everything (Including Auth Users)

### Step 1: Reset Public Tables
Follow Method 1 above.

### Step 2: Delete Auth Users
You have two options:

**Option A: Via Supabase Dashboard**
1. Go to **Authentication** → **Users**
2. Select all users (or specific ones)
3. Click **Delete** and confirm

**Option B: Via SQL (Requires Service Role)**
```sql
-- WARNING: This requires service role access
-- Only run this if you have admin access
DELETE FROM auth.users;
```

**Option C: Via Supabase Admin API**
Use the Supabase Admin API to delete users programmatically.

## Method 3: Complete Fresh Start

If you want to start completely fresh:

1. **Delete the entire project** in Supabase dashboard
2. **Create a new project**
3. Run migrations in order:
   - `001_users_table.sql`
   - `002_add_user_tracking.sql`

## When to Use Reset

- Testing new features
- After major schema changes
- When data integrity is compromised
- Starting a new development phase

## After Reset

1. Test signup flow - create a new user
2. Verify the profile is created automatically
3. Test login flow
4. Verify `last_login` and `email_verified_at` are tracked correctly

## Notes

- The reset migration (`003_reset_database.sql`) is safe to run multiple times
- It will recreate all tables, triggers, and functions
- Auth users are NOT automatically deleted (you must do this manually)
- All RLS policies are recreated


