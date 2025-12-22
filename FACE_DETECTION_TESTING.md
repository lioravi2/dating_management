# Face Detection Testing Guide

This guide explains how to test the face detection endpoint that works for both web and mobile apps.

## Prerequisites

1. **Web app running**: `cd apps/web && npm run dev`
2. **Models available**: Ensure `/public/models` directory exists with face-api.js models
3. **Authentication**: You need a valid Supabase access token

## Testing Methods

### Method 1: Test via Mobile App (Recommended)

The mobile app automatically uses the server-side face detection endpoint.

1. **Start the mobile app**:
   ```bash
   cd apps/mobile
   npm start
   ```

2. **Navigate to a partner's detail page**

3. **Upload a photo**:
   - Tap "Upload Photo"
   - Select an image with a face
   - The app will:
     - Call `/api/face-detection/detect` to detect faces
     - Call `/api/partners/[partnerId]/photos/analyze` to check for matches
     - Upload the photo with face descriptor

4. **Check the logs**:
   - Look for `[PartnerPhotos] Face detected` messages
   - Check for any errors in the console

### Method 2: Test via API Directly (cURL)

#### Step 1: Get an Access Token

**Option A: From Browser DevTools**
1. Log in to the web app
2. Open DevTools → Application → Cookies
3. Copy the `sb-<project-id>-auth-token` cookie value
4. Decode it (it's a JWT) or use the access_token from the session

**Option B: Use Dev Sign-In Endpoint**
```bash
curl -X POST http://localhost:3000/api/auth/dev-signin \
  -H "Content-Type: application/json" \
  -d '{"email": "avilior@hotmail.com"}'
```

This returns an `access_token` you can use.

#### Step 2: Test Face Detection

```bash
# Replace YOUR_ACCESS_TOKEN with the token from step 1
# Replace /path/to/image.jpg with your test image path

curl -X POST http://localhost:3000/api/face-detection/detect \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@/path/to/image.jpg"
```

**Expected Response (Success)**:
```json
{
  "detections": [
    {
      "descriptor": [0.123, -0.456, ...],  // 128-dimensional array
      "boundingBox": {
        "x": 100,
        "y": 150,
        "width": 200,
        "height": 250
      },
      "confidence": 0.95
    }
  ]
}
```

**Expected Response (No Face)**:
```json
{
  "detections": [],
  "error": "No faces detected"
}
```

### Method 3: Test via Postman

1. **Create a new POST request**:
   - URL: `http://localhost:3000/api/face-detection/detect`
   - Method: `POST`

2. **Add Authorization**:
   - Type: `Bearer Token`
   - Token: Your Supabase access token

3. **Add Body**:
   - Type: `form-data`
   - Key: `file` (type: File)
   - Value: Select an image file

4. **Send request** and check the response

### Method 4: Test via Node.js Script

A test script is available at `apps/web/scripts/test-face-detection.ts`.

**Setup**:
```bash
cd apps/web
npm install form-data node-fetch  # If not already installed
```

**Usage**:
```bash
# Set your access token as environment variable
export SUPABASE_ACCESS_TOKEN="your-token-here"

# Run the test script
npx tsx scripts/test-face-detection.ts ./path/to/test-image.jpg
```

Or add to `package.json`:
```json
{
  "scripts": {
    "test-face-detection": "tsx scripts/test-face-detection.ts"
  }
}
```

Then run:
```bash
SUPABASE_ACCESS_TOKEN="your-token" npm run test-face-detection ./test-image.jpg
```

## What to Check

### ✅ Success Indicators

1. **Face Detection Works**:
   - Response contains `detections` array
   - Each detection has `descriptor` (128 numbers), `boundingBox`, and `confidence`
   - Confidence > 0.5 typically indicates a good detection

2. **Mobile App Integration**:
   - Photo uploads successfully
   - Face descriptor is included in upload
   - No errors in console

3. **Server Logs**:
   - `[Face Detection] TensorFlow.js CPU backend initialized`
   - `[Face Detection] Monkey patched face-api.js for Node.js canvas`
   - `[Face Detection] Models loaded successfully`
   - `[Face Detection] Face detected` (if face found)

### ❌ Common Issues

1. **401 Unauthorized**:
   - Check that access token is valid
   - Token might have expired (get a new one)

2. **500 Internal Server Error**:
   - Check server logs for details
   - Models might not be loaded correctly
   - Check that `/public/models` directory exists

3. **No faces detected**:
   - Try a different image with a clear face
   - Ensure image is in supported format (JPEG, PNG)
   - Check image quality (not too blurry, good lighting)

4. **Models not loading**:
   - Verify `/public/models` directory exists
   - Check that model files are present:
     - `ssd_mobilenetv1_model-*.json` and `.shard` files
     - `face_landmark_68_model-*.json` and `.shard` files
     - `face_recognition_model-*.json` and `.shard` files

## Test Images

You can use any image with a clear face. For testing:
- Use photos with single faces first
- Then test with multiple faces
- Test with different angles and lighting
- Test edge cases (side profiles, glasses, etc.)

## Debugging

### Enable Detailed Logging

Check the server console for:
- Model loading progress
- Face detection results
- Any errors or warnings

### Check Model Files

Verify models exist:
```bash
ls -la apps/web/public/models/
```

Should see files like:
- `ssd_mobilenetv1_model-weights_manifest.json`
- `ssd_mobilenetv1_model-shard1`
- `face_landmark_68_model-weights_manifest.json`
- `face_landmark_68_model-shard1`
- `face_recognition_model-weights_manifest.json`
- `face_recognition_model-shard1`
- `face_recognition_model-shard2`

## Next Steps After Testing

Once face detection is working:
1. Test face matching (analyze endpoint)
2. Test multiple faces (should use first face for now)
3. Add face selection UI for multiple faces
4. Add decision dialogs for matches

