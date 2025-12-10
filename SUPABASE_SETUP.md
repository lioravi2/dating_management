# Supabase Setup Instructions

## Step 1: Create Supabase Account

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub, Google, or email
4. Verify your email if required

## Step 2: Create a New Project

1. Click "New Project" in the dashboard
2. Fill in the details:
   - **Name**: Dating App (or any name you prefer)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier is fine for development
3. Click "Create new project"
4. Wait 2-3 minutes for the project to be created

## Step 3: Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** (gear icon in sidebar)
2. Click **API** in the settings menu
3. You'll see:
   - **Project URL**: Something like `https://xxxxx.supabase.co`
   - **anon public** key: A long string starting with `eyJ...`
   - **service_role** key: Another long string (keep this secret!)

## Step 4: Set Up Authentication

1. In Supabase dashboard, go to **Authentication** in the sidebar
2. Click **Providers**
3. Make sure **Email** provider is enabled (it should be by default)
4. Under Email settings:
   - **Enable email confirmations**: You can disable this for development (toggle off)
   - **Enable email change confirmations**: Optional
5. Click **Save**

## Step 5: Configure Email Templates (Optional for Development)

For local development with magic links:

1. Go to **Authentication** → **Email Templates**
2. Click on **Magic Link** template
3. You can customize:
   - The subject line
   - The email body text (change "Log in" to "Sign in" or customize as needed)
   - The button text
4. The email will use the same template for both sign up and sign in
5. Click **Save** when done

## Step 6: Set Up Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   - `http://localhost:3000/auth/callback` (for local development)
   - Add your production URL later when you deploy

## Step 7: Create Database Schema

1. Go to **SQL Editor** in the sidebar
2. Click **New query**
3. Copy and paste the SQL from `supabase/migrations/001_users_table.sql`
4. Click **Run** (or press Ctrl+Enter)
5. You should see "Success. No rows returned"

## Step 8: Add Environment Variables

1. In your project root, create `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

2. Replace the values with your actual Project URL and anon key from Step 3

## Step 9: Test the Setup

1. Run `npm run dev` in your project
2. Go to http://localhost:3000
3. Try signing up with your email
4. Check your email for the magic link
5. Click the link to sign in

## Troubleshooting

### "Invalid API key"
- Make sure you copied the **anon public** key, not the service_role key
- Check that `.env.local` has the correct variable names (they start with `NEXT_PUBLIC_`)

### "Email not sent"
- Check your spam folder
- In Supabase dashboard, go to **Authentication** → **Users** to see if the user was created
- Check **Logs** in Supabase dashboard for errors

### "Redirect URL mismatch"
- Make sure you added `http://localhost:3000/auth/callback` to Redirect URLs in Supabase
- Check that the URL in your `.env.local` matches your Supabase project URL

### Can't find SQL Editor
- Make sure you're in the correct project
- SQL Editor is in the left sidebar, usually near the bottom

## Next Steps

Once authentication is working:
- You can add Google/Facebook OAuth providers later (Phase 3+)
- Set up Row Level Security (RLS) policies (already done in migration)
- Add more database tables as needed

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase Discord](https://discord.supabase.com) - Great for getting help

