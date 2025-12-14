# How to Run Database Migration 011

## Method: Supabase SQL Editor (Recommended)

This project uses the Supabase Dashboard SQL Editor to run migrations.

### Step-by-Step Instructions

1. **Open Supabase Dashboard**
   - Go to https://supabase.com
   - Sign in and select your project

2. **Open SQL Editor**
   - Click **SQL Editor** in the left sidebar
   - Click **New query** (or use an existing query tab)

3. **Copy the Migration SQL**
   - Open the file: `apps/web/supabase/migrations/011_add_face_descriptors.sql`
   - Copy the entire contents (see below)

4. **Paste and Run**
   - Paste the SQL into the SQL Editor
   - Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)
   - You should see: "Success. No rows returned"

5. **Verify**
   - Go to **Table Editor** → `partner_photos` table
   - Check that the new columns exist:
     - `face_descriptor` (JSONB)
     - `face_detection_attempted` (BOOLEAN)

## Migration SQL (Copy This)

```sql
-- Add face descriptor column to partner_photos table
ALTER TABLE public.partner_photos
ADD COLUMN IF NOT EXISTS face_descriptor JSONB;

-- Add index for efficient similarity searches (using GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_partner_photos_face_descriptor 
ON public.partner_photos USING GIN (face_descriptor);

-- Add column to track if face detection was attempted
ALTER TABLE public.partner_photos
ADD COLUMN IF NOT EXISTS face_detection_attempted BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.partner_photos.face_descriptor IS 
'128-dimensional face descriptor vector from face-api.js. Stored as JSON array of numbers.';

COMMENT ON COLUMN public.partner_photos.face_detection_attempted IS 
'Whether face detection was attempted on this photo. False if no face found or detection failed.';
```

## What This Migration Does

- ✅ Adds `face_descriptor` column (JSONB) to store 128-dimensional face vectors
- ✅ Adds `face_detection_attempted` column (BOOLEAN) to track detection attempts
- ✅ Creates a GIN index for efficient similarity searches
- ✅ Adds documentation comments

## Safety

- Uses `IF NOT EXISTS` - safe to run multiple times
- Won't delete or modify existing data
- Only adds new columns

## Troubleshooting

### "Column already exists"
- This is fine! The migration uses `IF NOT EXISTS`
- The migration is idempotent (safe to run multiple times)

### "Table partner_photos does not exist"
- Make sure you've run previous migrations first
- Check that `partner_photos` table exists in your database

### "Permission denied"
- Make sure you're using the correct Supabase project
- Check that you have admin access to the project

## Alternative: Using Supabase CLI (If You Have It Set Up)

If you have Supabase CLI configured locally:

```bash
cd apps/web
supabase db push
```

But the SQL Editor method is simpler and doesn't require CLI setup.


