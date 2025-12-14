# Testing Scripts

Scripts to help manage test accounts and subscriptions for development/testing purposes.

## Prerequisites

1. Make sure you have `.env.local` in `apps/web/` with:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY` (for subscription scripts)

2. Install dependencies:
   ```bash
   cd apps/web
   npm install
   ```

## Available Scripts

### 1. List Test Accounts

List all PRO accounts in the database:

```bash
npx tsx scripts/list-test-accounts.ts
```

This will show:
- Email addresses
- Account types
- Subscription status
- Stripe subscription IDs (if any)

### 2. Change Account to FREE

Change a PRO account to FREE and cancel any active subscriptions:

```bash
npx tsx scripts/change-account-to-free.ts <email>
```

**Example:**
```bash
npx tsx scripts/change-account-to-free.ts test@example.com
```

**What it does:**
- Sets `account_type` to `'free'` in the database
- Cancels the Stripe subscription (if exists)
- Updates subscription status to `'canceled'` in the database

### 3. Change Subscription to Daily Billing

Change an existing subscription from monthly to daily billing (for testing):

```bash
npx tsx scripts/change-subscription-to-daily.ts <email>
```

**Example:**
```bash
npx tsx scripts/change-subscription-to-daily.ts test@example.com
```

**What it does:**
- Creates a new Stripe price: $0.10/day (for testing)
- Updates the subscription to use daily billing
- Updates the database with new billing period dates

**Note:** The user must have an active subscription first. If they don't, you'll need to create one through the app first.

## Common Workflows

### Convert PRO Account to FREE

```bash
# 1. List all PRO accounts
npx tsx scripts/list-test-accounts.ts

# 2. Change specific account to FREE
npx tsx scripts/change-account-to-free.ts user@example.com
```

### Set Up Daily Billing for Testing

```bash
# 1. List all PRO accounts
npx tsx scripts/list-test-accounts.ts

# 2. Change subscription to daily billing
npx tsx scripts/change-subscription-to-daily.ts user@example.com
```

## Notes

- All scripts use the **service role key** to bypass RLS, so they can modify any user's data
- Stripe operations are performed in **test mode** (make sure your `STRIPE_SECRET_KEY` starts with `sk_test_`)
- Daily billing is set to **$0.10/day** for testing purposes
- Scripts will show clear error messages if something goes wrong

## Troubleshooting

**Error: "User not found"**
- Make sure the email address is correct
- Check that the user exists in Supabase Auth

**Error: "No active subscription found"**
- The user needs to have an active subscription first
- Create a subscription through the app's upgrade flow first

**Error: "Missing environment variables"**
- Make sure `.env.local` exists in `apps/web/`
- Verify all required variables are set




