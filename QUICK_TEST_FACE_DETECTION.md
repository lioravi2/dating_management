# Quick Test Guide - Face Detection

## Easiest Method: Test via Mobile App

1. **Start the web app** (if not running):
   ```bash
   cd apps/web
   npm run dev
   ```

2. **Start the mobile app**:
   ```bash
   cd apps/mobile
   npm start
   ```

3. **In the mobile app**:
   - Navigate to any partner's detail page
   - Tap "Upload Photo"
   - Select an image with a face
   - Check the console logs for face detection results

## Quick API Test (cURL)

1. **Get an access token** (from browser after logging in, or use dev sign-in):
   ```bash
   curl -X POST http://localhost:3000/api/auth/dev-signin \
     -H "Content-Type: application/json" \
     -d '{"email": "avilior@hotmail.com"}'
   ```
   Copy the `access_token` from the response.

2. **Test face detection**:
   ```bash
   curl -X POST http://localhost:3000/api/face-detection/detect \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
     -F "file=@/path/to/your/image.jpg"
   ```

## Using the Test Script

```bash
cd apps/web

# Option 1: Let script get token automatically (uses dev sign-in)
npm run test-face-detection ./path/to/image.jpg

# Option 2: Provide token manually
SUPABASE_ACCESS_TOKEN="your-token-here" npm run test-face-detection ./path/to/image.jpg
```

## What to Look For

✅ **Success**: Response contains `detections` array with face data
❌ **Error**: Check server logs for details

See `FACE_DETECTION_TESTING.md` for detailed testing guide.

