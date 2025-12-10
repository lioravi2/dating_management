# Setup Guide

## Prerequisites

1. **Node.js 18+** and npm
2. **Supabase account** - https://supabase.com (free tier works)
3. **Stripe account** - https://stripe.com
4. **Amplitude account** - https://amplitude.com
5. **Google Cloud project** (for Calendar API - optional for now)

## Step 1: Install Dependencies

```bash
cd dating-app
npm install
```

## Step 2: Set Up Supabase

1. Create a new project at https://supabase.com
2. Go to Settings → API to get your:
   - Project URL
   - `anon` key (public)
   - `service_role` key (keep secret!)
3. Run the database migration:
   - Go to SQL Editor in Supabase dashboard
   - Copy contents of `apps/web/supabase/migrations/001_initial_schema.sql`
   - Paste and run it
4. Enable Auth providers:
   - Go to Authentication → Providers
   - Enable Google OAuth (requires Google Cloud setup)
   - Enable Facebook OAuth (requires Facebook App setup)
   - Email provider is enabled by default (for magic links)

## Step 3: Set Up Stripe

1. Create a Stripe account at https://stripe.com
2. Get your API keys from Dashboard → Developers → API keys
3. Set up webhook endpoint:
   - Go to Developers → Webhooks
   - Add endpoint: `https://your-domain.com/api/stripe/webhook`
   - Select events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy the webhook signing secret

## Step 4: Set Up Amplitude

1. Create account at https://amplitude.com
2. Create a new project
3. Get your API key from Settings → Projects

## Step 5: Configure Environment Variables

Create `apps/web/.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Amplitude
NEXT_PUBLIC_AMPLITUDE_API_KEY=your_amplitude_key
```

## Step 6: Run the App

```bash
npm run dev:web
```

Visit http://localhost:3000

## Google Calendar Integration (Future)

The Google Calendar sync requires additional OAuth setup:

1. Create a Google Cloud project
2. Enable Google Calendar API
3. Set up OAuth 2.0 credentials
4. Implement OAuth flow to store access tokens
5. Use Google Calendar API for bi-directional sync

See `apps/web/src/app/api/calendar/sync/route.ts` for the placeholder implementation.

## Testing

1. **Sign up** with email (magic link) or OAuth providers
2. **Create a partner** from the Partners page
3. **Add notes** to partners (free tier limited to 20)
4. **Upgrade to Pro** via Stripe checkout
5. **Test webhook** using Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

## Deployment

### Vercel (Recommended for Next.js)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy!

### Other Platforms

- **Render**: Use Node.js buildpack
- **Railway**: Auto-detects Next.js
- **AWS/GCP**: Use Docker or serverless functions

## Troubleshooting

### Supabase RLS Issues
- Make sure you've run the migration SQL
- Check that RLS policies are enabled
- Verify user is authenticated

### Stripe Webhook Issues
- Use Stripe CLI for local testing
- Verify webhook secret matches
- Check webhook endpoint is accessible

### Auth Issues
- Verify Supabase auth providers are enabled
- Check redirect URLs are whitelisted
- Ensure environment variables are set correctly

