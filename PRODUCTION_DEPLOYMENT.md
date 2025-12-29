# Production Deployment Guide - Complete Checklist

This guide covers deploying your dating app with face recognition to production on Vercel.

## Prerequisites

- ✅ GitHub account
- ✅ Vercel account (sign up at https://vercel.com)
- ✅ Supabase project (already set up)
- ✅ Stripe account (for payments)
- ✅ All code changes committed

## Step 1: Prepare Your Code

### 1.1 Commit All Changes

```bash
# Check what needs to be committed
git status

# Add all new files (face recognition implementation)
git add .

# Commit with descriptive message
git commit -m "Add face recognition feature with photo upload and matching"

# Push to GitHub
git push origin master
```

**Important:** Make sure `.env.local` is in `.gitignore` (it should be by default).

### 1.2 Verify Model Files Are Included

The face recognition model files should be in `apps/web/public/models/`:
- `ssd_mobilenetv1_model-weights_manifest.json`
- `ssd_mobilenetv1_model-shard1`
- `ssd_mobilenetv1_model-shard2`
- `face_landmark_68_model-weights_manifest.json`
- `face_landmark_68_model-shard1`
- `face_recognition_model-weights_manifest.json`
- `face_recognition_model-shard1`
- `face_recognition_model-shard2`

These files are **required** for face detection to work. They should be committed to Git.

## Step 2: Set Up GitHub Repository

### 2.1 Create Repository (if not exists)

1. Go to https://github.com/new
2. Repository name: `dating-app` (or your preferred name)
3. Set to **Private** (recommended for production)
4. **Don't** initialize with README (you already have one)
5. Click **"Create repository"**

### 2.2 Connect Local Repository

```bash
# If you haven't set up remote yet
git remote add origin https://github.com/YOUR_USERNAME/dating-app.git

# Push to GitHub
git push -u origin master
```

## Step 3: Deploy to Vercel

### 3.1 Sign Up / Log In to Vercel

1. Go to https://vercel.com
2. Click **"Sign Up"** or **"Log In"**
3. Choose **"Continue with GitHub"** (recommended)

### 3.2 Import Project

1. In Vercel dashboard, click **"Add New..."** → **"Project"**
2. Find your `dating-app` repository
3. Click **"Import"**

### 3.3 Configure Project Settings

**Root Directory:**
- Click **"Edit"** next to Root Directory
- Enter: `apps/web`
- Click **"Continue"**

**Framework Preset:**
- Should auto-detect: **Next.js**
- Build Command: `npm run build` (auto-filled)
- Output Directory: `.next` (auto-filled)
- Install Command: `npm install` (auto-filled)

**Note:** The `vercel.json` file already configures the install command for the monorepo structure.

## Step 4: Configure Environment Variables

**Critical:** Add all environment variables in Vercel dashboard.

### 4.1 Supabase Variables

Go to **Settings** → **Environment Variables** and add:

```
NEXT_PUBLIC_SUPABASE_URL
```
- Value: Your Supabase project URL (from `.env.local`)
- Example: `https://tpidbrwziqoujspvradj.supabase.co`
- Add for: **Production**, **Preview**, **Development**

```
NEXT_PUBLIC_SUPABASE_ANON_KEY
```
- Value: Your Supabase anon key (from `.env.local`)
- Add for: **Production**, **Preview**, **Development**

```
SUPABASE_SERVICE_ROLE_KEY
```
- Value: Your Supabase service role key (from `.env.local`)
- Add for: **Production**, **Preview**, **Development**

### 4.2 Stripe Variables

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```
- **For production:** Use `pk_live_...` keys (not `pk_test_...`)
- Add for: **Production**, **Preview**, **Development**

```
STRIPE_SECRET_KEY
```
- **For production:** Use `sk_live_...` keys (not `sk_test_...`)
- Add for: **Production**, **Preview**, **Development**

```
STRIPE_WEBHOOK_SECRET
```
- Will be set after creating webhook (see Step 6)
- Add for: **Production** only (initially)

### 4.3 Optional Variables

```
NEXT_PUBLIC_AMPLITUDE_API_KEY
```
- Only if using Amplitude analytics
- Add for: **Production**, **Preview**, **Development**

```
NEXT_PUBLIC_FACE_DETECTION_PROVIDER
```
- Optional, defaults to `face-api`
- Add for: **Production**, **Preview**, **Development** (if you want to override)

**Important:**
- Click **"Add"** after each variable
- Don't include quotes around values
- Make sure to select the correct environment (Production/Preview/Development)

## Step 5: Update Next.js Config for Production

The `next.config.js` needs to include your Supabase domain for image optimization:

```javascript
images: {
  domains: ['localhost', 'your-supabase-project-id.supabase.co'],
}
```

**Action Required:** Update `apps/web/next.config.js` to include your actual Supabase domain.

## Step 6: Deploy!

1. Click **"Deploy"** in Vercel
2. Wait 2-3 minutes for the build
3. You'll get a deployment URL (e.g., `https://dating-app-xyz.vercel.app`)

**Note:** The first deployment might fail if environment variables are missing. Fix and redeploy.

## Step 7: Configure Supabase

### 7.1 Update Redirect URLs

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Add to **Redirect URLs:**
   - `https://your-vercel-url.vercel.app/auth/callback`
   - Replace with your actual Vercel URL
5. Add to **Site URL:**
   - `https://your-vercel-url.vercel.app`

### 7.2 Verify Storage Bucket

1. Go to **Storage** in Supabase Dashboard
2. Verify `partner-photos` bucket exists
3. Check RLS policies are configured:
   - Users can upload to their own folder (`userId/partnerId/...`)
   - Users can view their own photos

### 7.3 Verify Database Migrations

All migrations should already be applied. Verify in **Database** → **Migrations**:
- ✅ `011_add_face_descriptors.sql` (for face recognition)

## Step 8: Configure Stripe Webhook

### 8.1 Create Production Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. **Switch to Live mode** (toggle in top right)
3. Go to **Developers** → **Webhooks**
4. Click **"Add endpoint"**
5. **Endpoint URL:** `https://your-vercel-url.vercel.app/api/stripe/webhook`
   - Replace with your actual Vercel URL
6. **Description:** "Production webhook"
7. **Events to send:**
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
8. Click **"Add endpoint"**
9. **Copy the "Signing secret"** (starts with `whsec_...`)

### 8.2 Add Webhook Secret to Vercel

1. Go to Vercel → Your Project → **Settings** → **Environment Variables**
2. Add/Update `STRIPE_WEBHOOK_SECRET` with the webhook secret
3. Select **Production** environment
4. Click **"Save"**
5. **Redeploy** your app (Vercel will auto-redeploy, or click "Redeploy")

## Step 9: Test Production Deployment

### 9.1 Basic Functionality

1. Visit your Vercel URL
2. Test sign up with a real email
3. Test login
4. Create a partner
5. Upload a photo (test face recognition)

### 9.2 Face Recognition

1. Go to a partner's page
2. Click "Select Photo"
3. Upload a photo with a face
4. Verify:
   - ✅ Face detection works
   - ✅ Photo uploads successfully
   - ✅ Photo appears in gallery
   - ✅ Face matching works (if you have multiple photos)

### 9.3 Payments (if applicable)

1. Test subscription flow
2. Use Stripe test cards in test mode, or real cards in live mode
3. Verify webhook processes payment

## Step 10: Custom Domain (Optional)

1. In Vercel dashboard → **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update Supabase redirect URLs with custom domain

## Troubleshooting

### Build Fails

**Check:**
- Environment variables are set correctly
- All dependencies are in `package.json`
- TypeScript errors (check build logs)
- Model files are committed to Git

**Common Issues:**
- Missing environment variables → Add them in Vercel
- TypeScript errors → Fix locally, commit, push
- Missing models → Ensure `public/models/` is committed

### Face Recognition Not Working

**Check:**
- Model files are in `public/models/` (check Vercel build logs)
- Browser console for errors
- Network tab for model file requests
- Supabase storage bucket exists and is accessible

**Fix:**
- Verify model files are committed
- Check browser console for 404 errors on model files
- Verify Supabase storage bucket configuration

### Authentication Issues

**Check:**
- Supabase redirect URLs include your Vercel URL
- `NEXT_PUBLIC_SUPABASE_URL` is correct
- Environment variables are set for Production

**Fix:**
- Update Supabase redirect URLs
- Verify environment variables in Vercel

### Photo Upload Fails

**Check:**
- Supabase storage bucket `partner-photos` exists
- RLS policies allow uploads
- Storage path format is correct (`userId/partnerId/uuid.ext`)

**Fix:**
- Create storage bucket if missing
- Update RLS policies
- Check Vercel function logs for errors

### Webhooks Not Working

**Check:**
- Webhook URL is correct in Stripe
- Webhook secret matches in Vercel
- You're using Live mode keys in production
- Vercel function logs for webhook events

**Fix:**
- Verify webhook URL in Stripe dashboard
- Update webhook secret in Vercel
- Check Vercel function logs

## Production Checklist

Before going live, verify:

- [ ] All code committed and pushed to GitHub
- [ ] Vercel project created and configured
- [ ] Root directory set to `apps/web`
- [ ] All environment variables added (Supabase, Stripe)
- [ ] First deployment successful
- [ ] Supabase redirect URLs updated
- [ ] Supabase storage bucket `partner-photos` exists
- [ ] Stripe webhook configured (Live mode)
- [ ] Webhook secret added to Vercel
- [ ] Tested sign up/login
- [ ] Tested photo upload with face recognition
- [ ] Tested subscription flow (if applicable)
- [ ] Custom domain configured (if applicable)
- [ ] Monitoring/logging set up

## Post-Deployment

### Monitor

1. **Vercel Analytics** - Set up in Vercel dashboard
2. **Function Logs** - Check for errors in Vercel dashboard
3. **Stripe Webhook Logs** - Monitor in Stripe dashboard
4. **Supabase Logs** - Check in Supabase dashboard

### Maintenance

- **Database Migrations:** Run new migrations in Supabase SQL Editor
- **Environment Variables:** Update in Vercel when needed
- **Dependencies:** Update via GitHub, Vercel auto-deploys
- **Model Files:** If updating face-api.js, re-download models

## Cost Estimates

**Free Tier (Development):**
- Vercel: Free (generous limits)
- Supabase: Free tier
- Stripe: No cost (only when processing payments)

**Production (Small Scale):**
- Vercel: Free tier usually sufficient
- Supabase: Free tier or Pro ($25/month)
- Stripe: 2.9% + $0.30 per transaction

## Support

- **Vercel Docs:** https://vercel.com/docs
- **Supabase Docs:** https://supabase.com/docs
- **Stripe Docs:** https://stripe.com/docs
- **Face Recognition:** See `FACE_RECOGNITION_SETUP.md`

---

**Ready to deploy?** Follow the steps above and you'll be live in ~15 minutes! 🚀
















