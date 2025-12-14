# Face Recognition Setup Guide

## Overview

Face recognition has been implemented using **face-api.js** (100% free, open-source). The system detects faces in uploaded photos and matches them against existing partner photos to prevent duplicates and identify potential matches.

## Architecture

The implementation uses a **modular provider pattern** that allows easy swapping of face detection libraries:

```
UI Components
    ↓
useFaceDetection Hook
    ↓
IFaceDetectionProvider Interface
    ↓
FaceApiProvider (face-api.js) ✅
```

To switch providers in the future, simply change `NEXT_PUBLIC_FACE_DETECTION_PROVIDER` environment variable.

## Setup Steps

### 1. Database Migration

Run the migration to add face descriptor columns:

```bash
# Apply migration 011
supabase migration up
```

Or manually run:
```sql
-- See apps/web/supabase/migrations/011_add_face_descriptors.sql
```

### 2. Supabase Storage Bucket

Create a storage bucket for partner photos:

1. Go to Supabase Dashboard → Storage
2. Create a new bucket named `partner-photos`
3. Set it to **Public** (or configure RLS policies)
4. Configure RLS policies if needed:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'partner-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read
CREATE POLICY "Users can view own photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'partner-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### 3. Model Files

Model files have been downloaded to `apps/web/public/models/`. These are required for face detection.

If models are missing, run:
```bash
node apps/web/scripts/download-face-models.js
```

### 4. Environment Variables

No additional environment variables are required. The system uses:
- `NEXT_PUBLIC_SUPABASE_URL` (already configured)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (already configured)
- `NEXT_PUBLIC_FACE_DETECTION_PROVIDER` (optional, defaults to 'face-api')

## Usage

### Upload Photo to Partner

```tsx
import { PhotoUploadWithFaceMatch } from '@/components/PhotoUploadWithFaceMatch';

<PhotoUploadWithFaceMatch
  partnerId="partner-uuid"
  onSuccess={() => console.log('Uploaded!')}
  onCancel={() => console.log('Cancelled')}
/>
```

### Upload Photo Without Partner

```tsx
<PhotoUploadWithFaceMatch
  onSuccess={() => console.log('Analyzed!')}
  onCancel={() => console.log('Cancelled')}
/>
```

## Business Logic

### Use Case 1: Upload to Specific Partner

1. **No face detected** → Warn user, allow upload anyway
2. **Multiple faces** → Show face selection UI
3. **Single face** → Analyze:
   - ✅ **Proceed**: Matches partner OR no partner photos exist
   - ⚠️ **Warn "Same Person?"**: Doesn't match partner but partner has photos
   - ⚠️ **Warn "Other Partners"**: Matches other partners

### Use Case 2: Upload Without Partner

1. **No match found** → Suggest creating new partner
2. **Match found** → Warn about existing partners, allow viewing or creating new

## Testing

Visit `/test-face-recognition` to test the feature:

1. Select a photo
2. System detects face(s)
3. Follow prompts based on matches
4. Complete upload

## API Endpoints

### Analyze Photo for Partner
```
POST /api/partners/[partnerId]/photos/analyze
Body: { faceDescriptor: number[] }
Returns: PhotoUploadAnalysis
```

### Upload Photo to Partner
```
POST /api/partners/[partnerId]/photos
Body: FormData (file, faceDescriptor, width, height)
Returns: { photo: PartnerPhoto }
```

### Analyze Photo Without Partner
```
POST /api/photos/analyze
Body: { faceDescriptor: number[] }
Returns: { decision: 'create_new' | 'warn_matches', matches: FaceMatch[] }
```

## Files Created

### Core Library
- `lib/face-detection/types.ts` - Interface definitions
- `lib/face-detection/factory.ts` - Provider factory
- `lib/face-detection/providers/face-api-provider.ts` - face-api.js implementation
- `lib/hooks/useFaceDetection.ts` - React hook
- `lib/face-matching.ts` - Matching utilities
- `lib/photo-upload-decision.ts` - Business logic

### API Routes
- `app/api/partners/[partnerId]/photos/analyze/route.ts`
- `app/api/partners/[partnerId]/photos/route.ts`
- `app/api/photos/analyze/route.ts`

### Components
- `components/FaceSelectionUI.tsx` - Multi-face selection
- `components/PhotoUploadWithFaceMatch.tsx` - Main upload component

### Database
- `supabase/migrations/011_add_face_descriptors.sql`

### Scripts
- `scripts/download-face-models.js` - Model downloader

## Next Steps

1. **Test the implementation** using `/test-face-recognition`
2. **Integrate into partner pages** - Add photo upload to partner detail pages
3. **Configure storage bucket** - Ensure RLS policies are set correctly
4. **Fine-tune similarity threshold** - Adjust in `lib/face-matching.ts` (default: 0.4)

## Troubleshooting

### Models not loading
- Check that model files exist in `public/models/`
- Check browser console for errors
- Verify model URLs are correct

### Face detection fails
- Ensure image is clear and contains a face
- Check browser console for errors
- Verify TensorFlow.js is loaded

### Upload fails
- Check Supabase Storage bucket exists
- Verify RLS policies allow uploads
- Check API route logs for errors

## Cost

**Total Cost: $0** ✅
- face-api.js: Free, open-source
- Supabase: Free tier available
- TensorFlow.js: Free, open-source



