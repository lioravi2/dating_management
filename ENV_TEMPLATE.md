# Environment Variables Template

Copy this to `apps/web/.env.local` and fill in your values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Amplitude
# Client-side API key (web app - exposed to browser)
NEXT_PUBLIC_AMPLITUDE_API_KEY=your_amplitude_api_key
# Server-side API key (API routes - server-only, not prefixed with NEXT_PUBLIC)
AMPLITUDE_API_KEY=your_amplitude_api_key
# Mobile app API key (React Native/Expo)
EXPO_PUBLIC_AMPLITUDE_API_KEY=your_amplitude_api_key

# Amplitude Experiment
# Client deployment key for Experiment SDK (prefixed with "client-")
# This is DIFFERENT from the Analytics API key - get it from Amplitude Experiment > Deployments
NEXT_PUBLIC_AMPLITUDE_EXPERIMENT_CLIENT_KEY=client-your_deployment_key_here

# Google Calendar (for future implementation)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## How to Get Each Value

### Supabase
1. Go to https://supabase.com
2. Create/select your project
3. Go to Settings → API
4. Copy Project URL and keys

### Stripe
1. Go to https://stripe.com
2. Dashboard → Developers → API keys
3. Copy Secret key and Publishable key
4. For webhook secret: Developers → Webhooks → Add endpoint → Copy signing secret

### Amplitude

**Web App (Client-side):**
1. Go to https://amplitude.com
2. Settings → Projects → Select project
3. Copy API Key
4. Set as `NEXT_PUBLIC_AMPLITUDE_API_KEY` in `apps/web/.env.local`

**Web App (Server-side):**
- Use the same API key as client-side
- Set as `AMPLITUDE_API_KEY` in `apps/web/.env.local` (no `NEXT_PUBLIC_` prefix - server-only)

**Mobile App:**
- Use the same API key as web app
- Set as `EXPO_PUBLIC_AMPLITUDE_API_KEY` in `apps/mobile/.env` or Expo environment configuration

**Amplitude Experiment (Web App):**
1. Go to https://amplitude.com
2. Navigate to **Experiment** → **Deployments**
3. Find or create a **Client** deployment (this is different from Server deployment)
4. Copy the deployment key (it should start with `client-`)
5. Set as `NEXT_PUBLIC_AMPLITUDE_EXPERIMENT_CLIENT_KEY` in `apps/web/.env.local`
6. **Important:** This key is different from the Analytics API key - it's specifically for Experiment SDK and Web Experiments

### Google Calendar
1. Go to https://console.cloud.google.com
2. APIs & Services → Credentials
3. Create OAuth 2.0 Client ID
4. Copy Client ID and Client Secret

