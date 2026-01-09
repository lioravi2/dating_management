# Architecture Overview

## Tech Stack

### Frontend
- **Web**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Mobile**: React Native with Expo (to be implemented)

### Backend
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Google, Facebook, Magic Link)
- **Payments**: Stripe
- **Analytics**: Amplitude
- **Calendar**: Google Calendar API (to be fully implemented)

## Project Structure

```
dating-app/
├── apps/
│   ├── web/                    # Next.js web application
│   │   ├── src/
│   │   │   ├── app/            # Next.js App Router pages
│   │   │   ├── components/     # React components
│   │   │   └── lib/            # Utilities (Supabase, Stripe, Amplitude)
│   │   └── supabase/
│   │       └── migrations/     # Database migrations
│   └── mobile/                 # React Native app (placeholder)
├── packages/
│   └── shared/                 # Shared TypeScript types
└── package.json                # Monorepo root
```

## Database Schema

### Tables

1. **users** - User profiles and account types
2. **partners** - Partner information
3. **partner_notes** - Interaction notes with calendar sync
4. **subscriptions** - Stripe subscription tracking

### Row Level Security (RLS)

All tables have RLS enabled with policies ensuring users can only access their own data.

## Authentication Flow

1. User signs in via Supabase Auth (Google, Facebook, or Magic Link)
2. Supabase creates auth.users record
3. Trigger automatically creates public.users record
4. JWT token stored in session
5. All API requests authenticated via Supabase client

## Payment Flow

1. User clicks "Upgrade to Pro"
2. Frontend calls `/api/stripe/create-checkout`
3. Backend creates Stripe Checkout session
4. User redirected to Stripe Checkout
5. After payment, Stripe webhook updates subscription
6. User account type updated to 'pro'

## Google Calendar Sync (Planned)

1. User connects Google account via OAuth
2. Access token stored securely
3. When note created/updated, sync to Google Calendar
4. Webhook from Google Calendar updates notes when events change
5. Bi-directional sync maintained

## Analytics

### Amplitude Integration

Amplitude analytics is integrated across web, mobile, and server to track user behavior, business metrics, and technical events.

#### Architecture

- **Web App**: Client-side tracking using `@amplitude/analytics-browser` SDK
- **Mobile App**: Client-side tracking using `@amplitude/analytics-react-native` SDK
- **Server**: Server-side tracking using `@amplitude/node` SDK for API routes

#### User Identification

**CRITICAL: Privacy Compliance**
- Only Supabase user ID (`session.user.id`) is used for identification
- **NO PII** (email, full_name, personal details) is sent to Amplitude
- User identification happens automatically in authentication callbacks
- Same `user_id` is used on both client and server for identity continuity

#### Event Tracking

**Web App Events:**
- `[Page Viewed]` - Tracked on every page navigation with UTM parameters
- `[Button Clicked]` - Tracked on key user interactions
- Session replay enabled (requires Amplitude paid plan)

**Mobile App Events:**
- `[App Open]` - Tracked when app comes to foreground
- `[Screen Viewed]` - Tracked on every screen navigation
- `[Button Clicked]` - Tracked on key user interactions

**Server-Side Events:**
- `[User Registered]` - User completes registration
- `[User Signed In]` - User signs in (detected via middleware)
- `[Partner Added]` / `[Partner Deleted]` - Partner management
- `[Photo Added]` / `[Photo Deleted]` - Photo management
- `[Subscription Purchased]` / `[Subscription Updated]` / `[Subscription Cancelled]` - Subscription lifecycle
- `[Photo Upload - Face Detection]` - Face detection results
- `[Photo Upload - Partner Analysis]` - Partner matching analysis

#### UTM Tracking Strategy

**Hybrid Approach:**
1. **Automatic UTM Capture** (via SDK configuration):
   - Creates `initial_utm_*` user properties (first-touch attribution, set once)
   - Creates `utm_*` user properties (last-touch attribution, updated each session)
   - Automatically captured when UTM parameters are present in URL

2. **Manual UTM Tracking** (on `[Page Viewed]` events):
   - UTM parameters extracted from URL and included as event properties
   - Enables multi-touch attribution analysis in Amplitude

3. **Server-Side Events**:
   - UTM data automatically inherited from user properties set client-side
   - No UTM parameters needed in server event properties

#### Cross-Subdomain Device ID Sharing

For landing pages and main app on subdomains of the same root domain (e.g., `lp.dating-management.vercel.app` and `app.dating-management.vercel.app`), Amplitude SDK automatically handles device ID sharing via cookies. Cookies set with the root domain (`.dating-management.vercel.app`) are accessible to all subdomains, so no manual device ID passing is required.

#### User Properties

- `account_type` - "free" or "pro" (updated on app open, page view, and subscription changes)
- `subscription_status` - Subscription status (active, canceled, etc.)
- `initial_utm_*` - First-touch attribution UTM parameters
- `utm_*` - Last-touch attribution UTM parameters

#### Implementation Details

- All analytics calls are non-blocking (fire-and-forget)
- Error handling ensures analytics failures don't break application flow
- Session replay configured with privacy settings (masks sensitive fields)
- User properties automatically updated on authentication and subscription changes

## Security

- Row Level Security (RLS) on all database tables
- JWT-based authentication
- Environment variables for secrets
- Stripe webhook signature verification
- CORS configured for production domains

## Deployment

### Web App
- **Recommended**: Vercel (optimized for Next.js)
- **Alternatives**: Render, Railway, AWS, GCP

### Database
- Supabase (hosted PostgreSQL)

### Environment Variables
- Set in deployment platform
- Never commit secrets to git

## Future Enhancements

1. Complete Google Calendar bi-directional sync
2. React Native mobile app
3. Push notifications
4. Email notifications
5. Advanced analytics dashboard
6. Export functionality
7. Partner photos/attachments

