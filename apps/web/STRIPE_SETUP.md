# Stripe Configuration Guide

## Required Environment Variables

Add these to your `.env.local` file:

```env
# Stripe Publishable Key (starts with pk_)
# Get from: https://dashboard.stripe.com/test/apikeys (Test mode)
# or https://dashboard.stripe.com/apikeys (Live mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Secret Key (starts with sk_)
# Get from: https://dashboard.stripe.com/test/apikeys (Test mode)
# or https://dashboard.stripe.com/apikeys (Live mode)
STRIPE_SECRET_KEY=sk_test_...

# Stripe Webhook Secret (starts with whsec_)
# Get from: https://dashboard.stripe.com/test/webhooks (Test mode)
# or https://dashboard.stripe.com/webhooks (Live mode)
# After creating a webhook endpoint pointing to: https://your-domain.com/api/stripe/webhook
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Setup Steps

### 1. Get Stripe API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Make sure you're in **Test mode** (toggle in top right)
3. Go to **Developers** → **API keys**
4. Copy:
   - **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** → `STRIPE_SECRET_KEY` (click "Reveal test key")

### 2. Create Webhook Endpoint

**For Local Development:**
Webhooks don't work directly with `localhost` because Stripe can't reach your local server. The app includes automatic subscription verification when you return from checkout, so webhooks are optional for local testing.

**For Production:**
1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set endpoint URL to: `https://your-domain.com/api/stripe/webhook`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
5. Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`

**Optional: Local Webhook Testing with Stripe CLI**
If you want to test webhooks locally, install [Stripe CLI](https://stripe.com/docs/stripe-cli) and run:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
This will give you a webhook secret to use in `.env.local`.

### 3. Test Mode vs Live Mode

- **Test mode**: Use test API keys (start with `pk_test_` and `sk_test_`)
  - Use test card: `4242 4242 4242 4242`
  - Any future expiry date, any CVC
- **Live mode**: Use live API keys (start with `pk_live_` and `sk_live_`)
  - Real payments will be processed

### 4. Verify Configuration

After adding the environment variables:

1. Restart your dev server
2. Try clicking "Upgrade to Pro"
3. You should be redirected to Stripe Checkout
4. Use test card `4242 4242 4242 4242` to complete test payment
5. After payment, you'll be redirected to the Profile page
6. **The subscription will be automatically verified** - you should see a success message and your account will be upgraded to Pro
7. Check your dashboard - it should now show "Account Type: Pro"

## Troubleshooting

### Error: "Invalid API Key provided" or "Invalid Stripe key format"
- **Common cause**: Keys starting with `mk_` or other invalid prefixes
- **Solution**: Stripe keys MUST start with:
  - `pk_test_` or `pk_live_` for publishable keys
  - `sk_test_` or `sk_live_` for secret keys
- Get your keys from: https://dashboard.stripe.com/test/apikeys
- Make sure you're copying the FULL key, not a partial key
- Restart dev server after updating `.env.local`

### Error: "Stripe not initialized"
- Check that `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set in `.env.local`
- Verify the key starts with `pk_test_` or `pk_live_`
- Restart dev server after adding environment variables

### Error: "Webhook signature verification failed"
- Check that `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint secret
- Make sure webhook URL is correct

### Error: "Cannot read properties of null (reading 'useReducer')"
- This is usually a React/Next.js issue, not Stripe
- Try clearing `.next` folder and restarting: `rm -rf .next && npm run dev`

## Testing Payments (No Real Credit Card Needed!)

**Important**: As long as you're using **Test mode** keys (starting with `pk_test_` and `sk_test_`), you can test payments without using a real credit card.

### How to Test a Payment:

1. **Make sure you're in Test mode**:
   - Check your `.env.local` file
   - Keys should start with `pk_test_` and `sk_test_` (NOT `pk_live_` or `sk_live_`)
   - In Stripe Dashboard, toggle should show "Test mode" (not "Live mode")

2. **Click "Upgrade to Pro"** in your app

3. **On the Stripe Checkout page**, use these test card numbers:

   **✅ Successful Payment:**
   - Card number: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/25`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any 5 digits (e.g., `12345`)

   **❌ Declined Payment (to test error handling):**
   - Card number: `4000 0000 0000 0002`
   - Expiry: Any future date
   - CVC: Any 3 digits

   **🔐 Requires Authentication (3D Secure):**
   - Card number: `4000 0025 0000 3155`
   - Expiry: Any future date
   - CVC: Any 3 digits

### Other Test Cards:

Stripe provides many test cards for different scenarios:
- **Insufficient funds**: `4000 0000 0000 9995`
- **Card declined**: `4000 0000 0000 0002`
- **Processing error**: `4000 0000 0000 0119`

See all test cards: https://stripe.com/docs/testing#cards

### Important Notes:

- ✅ **Test mode is completely safe** - No real money is charged
- ✅ **Use any future expiry date** - Doesn't need to be real
- ✅ **Use any 3-digit CVC** - Doesn't need to match
- ✅ **Use any ZIP code** - Doesn't need to be real
- ⚠️ **Never use test cards in Live mode** - They won't work
- ⚠️ **Never use real cards in Test mode** - They won't be charged, but don't do it

### Verifying Test Payments:

After a successful test payment:
1. Check your Stripe Dashboard → **Payments** (in Test mode)
2. You should see the test payment listed
3. Check your app's billing page - subscription should be active
4. Check your database - `subscriptions` table should show `status: 'active'`


