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

Amplitude tracks:
- User authentication events
- Partner creation/updates
- Note creation
- Subscription upgrades
- Feature usage

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

