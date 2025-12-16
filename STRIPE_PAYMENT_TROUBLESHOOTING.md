# Stripe Payment Troubleshooting Guide

## Why am I charged ₪1.01 now and ₪0.34 per day after?

**This is normal behavior for daily subscriptions in Stripe.**

When you subscribe to a daily plan:
- **First charge**: Stripe charges for the current period (today) plus the next period (tomorrow) upfront
- **₪1.01** = approximately **$0.30 USD** = **3 days** at $0.10/day
- **After that**: You'll be charged **₪0.34 per day** (which is $0.10 USD converted to ILS)

This is Stripe's standard behavior to ensure continuous service coverage.

## Payment Not Showing in Billing Page

If you've subscribed but don't see the payment in your billing page, try these steps:

### Option 1: Use the "Sync Payments from Stripe" Button

1. Go to your **Billing & Subscription** page
2. Look for the **"Sync Payments from Stripe"** button (usually in the Payment History section)
3. Click it to manually sync payments from Stripe
4. Refresh the page

### Option 2: Verify Subscription

1. After completing checkout, you should be redirected to the profile page
2. The app automatically verifies your subscription
3. If verification fails, try refreshing the page

### Option 3: Check Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Make sure you're in **Test mode** (for testing) or **Live mode** (for production)
3. Go to **Customers** → Find your customer → **Subscriptions**
4. Check if the subscription is active
5. Go to **Invoices** to see if invoices were created
6. Go to **Payments** to see if payments were processed

### Option 4: Set Up Webhooks (For Production)

If you're running in production and payments still don't show:

1. **Go to Stripe Dashboard** → **Developers** → **Webhooks**
2. **Click "Add endpoint"**
3. **Endpoint URL**: `https://your-domain.com/api/stripe/webhook`
   - Replace `your-domain.com` with your actual domain
4. **Events to send**:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
5. **Copy the "Signing secret"** (starts with `whsec_...`)
6. **Add to your environment variables**:
   - In Vercel: Settings → Environment Variables → Add `STRIPE_WEBHOOK_SECRET`
   - In local `.env.local`: Add `STRIPE_WEBHOOK_SECRET=whsec_...`
7. **Redeploy** your app

### Option 5: For Local Development

Webhooks don't work with `localhost` because Stripe can't reach your local server.

**Solution**: Use the **"Sync Payments from Stripe"** button on the billing page, or:

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Run: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
3. Copy the webhook secret it gives you
4. Add it to your `.env.local` as `STRIPE_WEBHOOK_SECRET`

## Why No $0.10 Transactions in Stripe?

If you're looking for individual $0.10 transactions, you won't see them because:

1. **Stripe groups daily charges**: For daily subscriptions, Stripe creates invoices that may include multiple days
2. **Check Invoices, not Payments**: Go to **Invoices** in Stripe Dashboard, not **Payments**
3. **The first invoice**: Will show ~$0.30 (3 days worth) as explained above
4. **Subsequent invoices**: Will show $0.10 per day, but may be grouped

## Still Having Issues?

1. **Check browser console** for any errors
2. **Check server logs** for webhook errors
3. **Verify environment variables** are set correctly:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET` (for production)
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
4. **Contact support** with:
   - Your Stripe customer ID
   - Subscription ID
   - Screenshot of Stripe Dashboard showing the subscription/invoice

