# Deploying to Vercel - Step by Step Guide

## Prerequisites

1. **GitHub account** - Your code needs to be on GitHub
2. **Vercel account** - Sign up at https://vercel.com (free tier works great)
3. **Your code pushed to GitHub** - Make sure all changes are committed and pushed

## Step 1: Push Your Code to GitHub

If you haven't already:

```bash
# Make sure you're in the project root
cd C:\Users\avili\.cursor\dating-app

# Check git status
git status

# Add all files (if needed)
git add .

# Commit changes
git commit -m "Prepare for deployment"

# Push to GitHub
git push origin main
```

**Note:** If you don't have a GitHub repo yet:
1. Go to https://github.com/new
2. Create a new repository
3. Follow the instructions to connect your local repo

## Step 2: Sign Up / Log In to Vercel

1. Go to https://vercel.com
2. Click **"Sign Up"** or **"Log In"**
3. Choose **"Continue with GitHub"** (recommended - easiest way)

## Step 3: Import Your Project

1. In Vercel dashboard, click **"Add New..."** → **"Project"**
2. You'll see a list of your GitHub repositories
3. Find your `dating-app` repository and click **"Import"**

## Step 4: Configure Project Settings

Vercel will auto-detect Next.js, but you need to configure:

### Root Directory
- **Root Directory:** Set to `apps/web` (since your Next.js app is in a subdirectory)
- Click **"Edit"** next to Root Directory
- Enter: `apps/web`
- Click **"Continue"**

### Framework Preset
- Should auto-detect: **Next.js**
- Build Command: `npm run build` (auto-filled)
- Output Directory: `.next` (auto-filled)
- Install Command: `npm install` (auto-filled)

## Step 5: Add Environment Variables

**This is critical!** Click **"Environment Variables"** and add:

### Supabase Variables
```
NEXT_PUBLIC_SUPABASE_URL
```
- Value: Your Supabase project URL (from `.env.local`)

```
NEXT_PUBLIC_SUPABASE_ANON_KEY
```
- Value: Your Supabase anon key (from `.env.local`)

```
SUPABASE_SERVICE_ROLE_KEY
```
- Value: Your Supabase service role key (from `.env.local`)

### Stripe Variables
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```
- Value: Your Stripe publishable key (from `.env.local`)
- **For production:** Use `pk_live_...` keys (not `pk_test_...`)

```
STRIPE_SECRET_KEY
```
- Value: Your Stripe secret key (from `.env.local`)
- **For production:** Use `sk_live_...` keys (not `sk_test_...`)

```
STRIPE_WEBHOOK_SECRET
```
- Value: Will be set after creating webhook (see Step 7)

### Optional Variables
```
NEXT_PUBLIC_AMPLITUDE_API_KEY
```
- Only if you're using Amplitude analytics

**Important:**
- Make sure to add these for **Production**, **Preview**, and **Development** environments
- Click **"Add"** after each variable
- Don't include quotes around the values

## Step 6: Deploy!

1. Click **"Deploy"**
2. Wait 2-3 minutes for the build to complete
3. You'll see a success message with your deployment URL (e.g., `https://dating-app-xyz.vercel.app`)

## Step 7: Set Up Stripe Webhook for Production

**After deployment, you need to configure Stripe webhooks:**

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Make sure you're in **Live mode** (toggle in top right) for production
3. Go to **Developers** → **Webhooks**
4. Click **"Add endpoint"**
5. **Endpoint URL:** `https://your-vercel-url.vercel.app/api/stripe/webhook`
   - Replace `your-vercel-url` with your actual Vercel URL
6. **Description:** "Production webhook"
7. **Events to send:**
   - Select: `checkout.session.completed`
   - Select: `customer.subscription.updated`
   - Select: `customer.subscription.deleted`
   - Select: `invoice.payment_succeeded`
8. Click **"Add endpoint"**
9. **Copy the "Signing secret"** (starts with `whsec_...`)
10. Go back to Vercel → Your Project → Settings → Environment Variables
11. Add/Update `STRIPE_WEBHOOK_SECRET` with the new webhook secret
12. **Redeploy** your app (Vercel will auto-redeploy when you update env vars, or click "Redeploy")

## Step 8: Update Supabase Redirect URLs

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Add to **Redirect URLs:**
   - `https://your-vercel-url.vercel.app/auth/callback`
   - Replace with your actual Vercel URL

## Step 9: Test Your Deployment

1. Visit your Vercel URL
2. Try signing up with a test email
3. Complete a test payment (use test card `4242 4242 4242 4242`)
4. Check that:
   - Authentication works
   - Subscription activates automatically (via webhook)
   - Dashboard shows Pro status

## Step 10: Custom Domain (Optional)

1. In Vercel dashboard, go to your project → **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update Supabase redirect URLs with your custom domain

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Common issues:
  - Missing environment variables
  - TypeScript errors
  - Missing dependencies

### Webhooks Not Working
- Verify webhook URL is correct in Stripe
- Check webhook secret matches in Vercel env vars
- Check Vercel function logs for webhook errors
- Make sure you're using **Live mode** keys in production

### Authentication Redirect Issues
- Verify Supabase redirect URLs include your Vercel URL
- Check that `NEXT_PUBLIC_SUPABASE_URL` is correct

### Subscription Not Activating
- Check Vercel function logs for webhook events
- Verify webhook secret is correct
- Check Stripe dashboard → Webhooks → See event logs

## Next Steps

- Set up **automatic deployments** (already enabled - every push to main deploys)
- Configure **preview deployments** for pull requests
- Set up **analytics** in Vercel dashboard
- Monitor **function logs** for errors

## Important Notes

1. **Test vs Live Mode:**
   - For testing: Use `pk_test_` and `sk_test_` keys
   - For production: Use `pk_live_` and `sk_live_` keys
   - You can have both test and live webhooks configured

2. **Environment Variables:**
   - Never commit `.env.local` to GitHub
   - Always add env vars in Vercel dashboard
   - Update them when you change keys

3. **Database:**
   - Your Supabase database is already set up
   - No need to migrate - it's the same database
   - Just update redirect URLs

4. **Costs:**
   - Vercel free tier: Generous for small apps
   - Supabase free tier: Good for development
   - Stripe: Only pay when processing real payments

## Quick Checklist

- [ ] Code pushed to GitHub
- [ ] Vercel account created
- [ ] Project imported to Vercel
- [ ] Root directory set to `apps/web`
- [ ] All environment variables added
- [ ] First deployment successful
- [ ] Stripe webhook configured
- [ ] Webhook secret added to Vercel
- [ ] Supabase redirect URLs updated
- [ ] Tested sign up/login
- [ ] Tested subscription flow

---

**Need help?** Check Vercel logs or Stripe webhook logs for detailed error messages.





