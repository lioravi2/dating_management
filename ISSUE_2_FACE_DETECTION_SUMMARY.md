# Issue 2: False Positive Face Detection - Bottom Half Face

## Problem Description

When uploading a photo with multiple faces in the mobile app, the face detection API incorrectly identifies the bottom half of a face (partial face) as a valid face detection. This false positive does not occur in the web app when using the same photo.

## Current Behavior

- **Mobile App**: Detects the bottom half of a face as a valid face (shown as "Face 4" in the selection modal)
- **Web App**: Correctly ignores the bottom half face and only shows valid full faces

## Technical Details

### Face Detection API Endpoint
- **Location**: `apps/web/src/app/api/face-detection/detect/route.ts`
- **Used by**: Both mobile app and web app (mobile calls API, web uses client-side provider)

### Current Filtering Logic

The API endpoint applies two filters:

1. **Confidence Threshold**: `MIN_CONFIDENCE = 0.65` (65%)
   - Filters out detections with confidence score below 0.65
   - Location: Lines 190-202 in `route.ts`

2. **Minimum Face Size**: `MIN_FACE_SIZE = 120px`
   - Filters out faces where the minimum dimension (width or height) is less than 120px
   - Location: Lines 214-238 in `route.ts`
   - Coordinates are scaled back to original image dimensions before size check

### Image Processing Flow

**Mobile App**:
1. Original image → `prepareImageForFaceDetection()` resizes to max 3000px (if needed)
2. Sends resized image to API endpoint
3. API resizes to max 600px for detection (if needed)
4. API scales coordinates back to the 3000px image dimensions
5. Returns detections with bounding boxes

**Web App**:
1. Original image → Client-side `FaceApiProvider` resizes to max 600px (if needed)
2. Detects faces using same thresholds
3. Scales coordinates back to original image dimensions

### Key Observation

Both implementations use **identical filtering logic**:
- Same confidence threshold (0.65)
- Same minimum face size (120px)
- Same face-api.js model (ssdMobilenetv1)

However, the web app correctly filters out the bottom half face while the mobile app does not.

## Hypothesis

The bottom half face detection likely:
1. **Passes the confidence threshold** (score >= 0.65) - the model recognizes it as face-like
2. **Passes the size threshold** (min dimension >= 120px) - the bounding box is large enough

But it should be filtered out because:
- It's not a complete face (only bottom half visible)
- The aspect ratio might be unusual (very wide or very tall)
- It lacks key facial features (eyes, nose) that would be in the top half

## Suggested Solution

Add **aspect ratio validation** to filter out partial faces:

- Human faces are roughly square to slightly tall
- Valid aspect ratio range: width/height between 0.6 and 1.8
- Bottom half faces would likely have extreme aspect ratios (very tall/narrow or very wide/short)

### Implementation Location

Add the aspect ratio filter in `apps/web/src/app/api/face-detection/detect/route.ts` after the size filter (around line 238):

```typescript
// Filter by aspect ratio to filter out partial faces (like bottom halves)
const ASPECT_RATIO_MIN = 0.6; // Minimum width/height ratio
const ASPECT_RATIO_MAX = 1.8; // Maximum width/height ratio

const aspectRatioFilteredDetections = sizeFilteredDetections.filter(detection => {
  const box = detection.detection.box;
  const faceWidth = box.width * scaleX;
  const faceHeight = box.height * scaleY;
  const aspectRatio = faceWidth / faceHeight;
  
  if (aspectRatio < ASPECT_RATIO_MIN || aspectRatio > ASPECT_RATIO_MAX) {
    return false;
  }
  
  return true;
});
```

### Consistency Note

The same filter should also be added to the web app's client-side provider (`apps/web/src/lib/face-detection/providers/face-api-provider.ts`) to ensure consistency, even though the web app currently works correctly (possibly due to different image preprocessing or resolution).

## Files to Review

1. `apps/web/src/app/api/face-detection/detect/route.ts` - API endpoint (used by mobile)
2. `apps/web/src/lib/face-detection/providers/face-api-provider.ts` - Client-side provider (used by web)
3. `apps/mobile/src/hooks/usePhotoUpload.ts` - Mobile image preparation (line 127-158)

## Test Case

- Photo: Screenshot from social media feed showing three men's faces
- Expected: 3 faces detected (the three men)
- Actual (Mobile): 4 faces detected (includes bottom half of one face)
- Actual (Web): 3 faces detected (correct)

## Questions for Face Detection Algorithm Agent

1. Why does the bottom half face pass both confidence (0.65) and size (120px) thresholds?
2. Is aspect ratio validation the best approach, or should we use face landmarks validation instead?
3. Should we also validate that detected faces have expected facial features (eyes, nose) using landmarks?
4. Are there other heuristics we should apply to filter partial faces?





