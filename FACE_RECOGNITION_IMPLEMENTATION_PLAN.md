# Face Recognition Implementation Plan

## Overview

Implement face recognition for photo uploads with the following business logic:

### Use Case 1: Upload Photo to Specific Partner

**Flow:**
1. User uploads photo for a specific partner
2. **Step 1:** Check if any person identified → If not, warn "Photo not clear" (upload anyway / try again / cancel)
3. **Step 2:** Check if multiple persons → If yes, show face selection UI (user selects person, then restart process)
4. **Step 3:** If single face → Proceed to matching
5. **Step 4:** Check matches with partner's photos (4.1: no photos, 4.2: match, 4.3: no match)
6. **Step 5:** Check matches with other partners (5.1: no photos, 5.2: match, 5.3: no match)
7. **Step 6:** Decision tree:
   - ✅ **Proceed**: (4.1 AND 5.1) OR (4.1 AND 5.3) OR (4.2 AND 5.1) OR (4.2 AND 5.3)
   - ⚠️ **Warn "Same Person?"**: (4.3 AND 5.1) OR (4.3 AND 5.3)
   - ⚠️ **Warn "Other Partners"**: (4.1 AND 5.2) OR (4.2 AND 5.2) OR (4.3 AND 5.2)

### Use Case 2: Upload Photo Without Partner Selection

**Flow:**
1. User uploads photo without selecting partner
2. **Step 1:** Face detection (same as Use Case 1)
3. **Step 2:** Check matches with ALL partners
4. **Step 3:** Decision:
   - ⚠️ **No Match**: Warn user, ask to create new partner or cancel
   - ⚠️ **Match Found**: Warn "resembles other partners" with options (view partners / create new anyway / cancel)

---

## Architecture: Modular Design

**Key Principle:** Use provider pattern for easy swapping of face detection libraries.

```
UI Components
    ↓
useFaceDetection Hook (uses interface)
    ↓
IFaceDetectionProvider Interface
    ↓
Provider Implementations:
  - FaceApiProvider (face-api.js) ✅
  - OpenCVProvider (future)
  - CompreFaceProvider (future)
```

**Benefits:**
- Easy to swap providers (change environment variable)
- No code changes needed in UI/API
- Type-safe with TypeScript

---

## Implementation Steps

### Phase 1: Setup & Infrastructure
1. Install dependencies
2. Database migration (add face_descriptor columns)
3. Update TypeScript types
4. Download model files

### Phase 2: Core Functionality
5. Create face detection interface
6. Create face-api.js provider
7. Create provider factory
8. Create React hook
9. Create face matching utilities
10. Create decision engine

### Phase 3: API & UI
11. Create API routes
12. Create UI components
13. Create test page

---

## Solution: 100% Free

- **face-api.js**: Open source, free forever
- **Supabase**: Free tier available
- **Total Cost**: $0

---

## Files to Create

### Database
- `011_add_face_descriptors.sql`

### Core Library
- `lib/face-detection/types.ts`
- `lib/face-detection/factory.ts`
- `lib/face-detection/providers/face-api-provider.ts`
- `lib/hooks/useFaceDetection.ts`
- `lib/face-matching.ts`
- `lib/photo-upload-decision.ts`

### API Routes
- `app/api/partners/[partnerId]/photos/route.ts`
- `app/api/photos/upload/route.ts`

### Components
- `components/FaceSelectionUI.tsx`
- `components/PhotoUploadWithFaceMatch.tsx`

### Test
- `app/test-face-recognition/page.tsx`

---

## Business Logic Decision Matrix

### Use Case 1: Upload to Partner

| Partner Match | Other Partners Match | Decision |
|--------------|---------------------|----------|
| 4.1 (no photos) | 5.1 (no photos) | ✅ Proceed |
| 4.1 (no photos) | 5.2 (matches) | ⚠️ Warn Other Partners |
| 4.1 (no photos) | 5.3 (no match) | ✅ Proceed |
| 4.2 (matches) | 5.1 (no photos) | ✅ Proceed |
| 4.2 (matches) | 5.2 (matches) | ⚠️ Warn Other Partners |
| 4.2 (matches) | 5.3 (no match) | ✅ Proceed |
| 4.3 (no match) | 5.1 (no photos) | ⚠️ Warn Same Person |
| 4.3 (no match) | 5.2 (matches) | ⚠️ Warn Other Partners |
| 4.3 (no match) | 5.3 (no match) | ⚠️ Warn Same Person |

### Use Case 2: Upload Without Partner

| Match Status | Decision |
|-------------|----------|
| No match | ⚠️ Ask to create new partner |
| Match found | ⚠️ Warn about existing partners |

---

## Ready to Implement

Starting with Phase 1: Setup & Infrastructure.














