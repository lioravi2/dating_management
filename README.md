# Dating Management App 🍎

**Phase 1-2: Infrastructure + Authentication (Magic Link Only)**

This is a fresh start with only the essential infrastructure and magic link authentication.

## Current Phase

✅ **Phase 1**: Infrastructure setup  
✅ **Phase 2**: Authentication (Magic Link only)

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Supabase:**
   - Follow instructions in `SUPABASE_SETUP.md`
   - Create `.env.local` with your Supabase credentials

3. **Run the app:**
   ```bash
   npm run dev
   ```

4. **Visit:** http://localhost:3000

## Project Structure

```
dating-app/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── lib/              # Utilities (Supabase client)
├── supabase/
│   └── migrations/       # Database migrations
├── package.json
└── .env.local            # Environment variables (create this)
```

## Next Phases

- Phase 3: Basic Profile
- Phase 4: Subscription Infrastructure
- Phase 5: Payment Integration
- Phase 6: Core Features

