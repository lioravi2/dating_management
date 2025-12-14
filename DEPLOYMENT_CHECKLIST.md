# Quick Deployment Checklist

Use this checklist when deploying to production.

## Pre-Deployment

- [ ] All code committed to Git
- [ ] All face recognition model files committed (`apps/web/public/models/`)
- [ ] `.env.local` is in `.gitignore` (should be by default)
- [ ] GitHub repository created and code pushed
- [ ] Vercel account created

## Vercel Configuration

- [ ] Project imported from GitHub
- [ ] Root directory set to `apps/web`
- [ ] Framework preset: Next.js (auto-detected)

## Environment Variables (Vercel Dashboard)

### Supabase
- [ ] `NEXT_PUBLIC_SUPABASE_URL` (Production, Preview, Development)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production, Preview, Development)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (Production, Preview, Development)

### Stripe
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (use `pk_live_...` for production)
- [ ] `STRIPE_SECRET_KEY` (use `sk_live_...` for production)
- [ ] `STRIPE_WEBHOOK_SECRET` (set after webhook creation)

### Optional
- [ ] `NEXT_PUBLIC_AMPLITUDE_API_KEY` (if using)
- [ ] `NEXT_PUBLIC_FACE_DETECTION_PROVIDER` (optional, defaults to 'face-api')

## First Deployment

- [ ] Click "Deploy" in Vercel
- [ ] Build completes successfully
- [ ] Deployment URL received (e.g., `https://dating-app-xyz.vercel.app`)

## Supabase Configuration

- [ ] Redirect URLs updated: `https://your-vercel-url.vercel.app/auth/callback`
- [ ] Site URL updated: `https://your-vercel-url.vercel.app`
- [ ] Storage bucket `partner-photos` exists
- [ ] RLS policies configured for storage
- [ ] Database migration `011_add_face_descriptors.sql` applied

## Stripe Configuration

- [ ] Switched to Live mode in Stripe Dashboard
- [ ] Webhook endpoint created: `https://your-vercel-url.vercel.app/api/stripe/webhook`
- [ ] Webhook events configured:
  - [ ] `checkout.session.completed`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.payment_succeeded`
- [ ] Webhook signing secret copied
- [ ] `STRIPE_WEBHOOK_SECRET` added to Vercel environment variables
- [ ] App redeployed after adding webhook secret

## Testing

- [ ] Sign up with real email
- [ ] Login works
- [ ] Create a partner
- [ ] Upload photo (face recognition)
- [ ] Face detection works
- [ ] Photo appears in gallery
- [ ] Face matching works (if multiple photos)
- [ ] Subscription flow (if applicable)
- [ ] Payment processing (if applicable)

## Post-Deployment

- [ ] Custom domain configured (if applicable)
- [ ] Monitoring/logging set up
- [ ] Analytics configured (if applicable)

## Troubleshooting

If something doesn't work:
1. Check Vercel build logs
2. Check Vercel function logs
3. Check browser console
4. Check Supabase logs
5. Check Stripe webhook logs

---

**See `PRODUCTION_DEPLOYMENT.md` for detailed instructions.**

