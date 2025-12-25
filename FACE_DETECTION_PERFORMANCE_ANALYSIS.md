# Face Detection Performance Analysis

## Issue
Face detection requests are timing out after 25 seconds on the mobile app, indicating the server is taking too long to respond.

## Potential Causes

### 1. **Vercel Serverless Function Timeouts**
- **Hobby Plan**: 10 seconds max
- **Pro Plan**: 60 seconds max
- **Enterprise**: 900 seconds max

**Solution**: Added `maxDuration: 60` to `vercel.json` for the face detection route. This requires a Pro plan or higher.

### 2. **Cold Start Model Loading**
On Vercel serverless functions, each cold start requires:
- Loading TensorFlow.js CPU backend (~1-2s)
- Loading 3 face-api.js models from disk (~5-15s depending on model size)
- Total cold start: **6-17 seconds**

**Current Implementation**: Models are cached in module-level variables, but on cold starts they still need to load.

### 3. **Face Detection Processing Time**
- Image processing and resizing: ~0.5-1s
- Face detection with landmarks and descriptors: ~2-5s (depends on image size)
- Total processing: **2.5-6 seconds**

**Total Request Time**:
- Cold start: 6-17s (model loading) + 2.5-6s (processing) = **8.5-23 seconds**
- Warm start: 2.5-6s (processing only)

## Testing

### Test Locally
```bash
cd apps/web
npm run test-face-detection <path-to-test-image.jpg>
```

This will show:
- Request duration
- Model loading time (first request only)
- Detection time
- Total time

### Test on Vercel
1. Deploy the updated code with timing logs
2. Check Vercel function logs to see:
   - Model loading duration
   - Detection duration
   - Total request time

## Performance Logging Added

The endpoint now logs:
- `[Face Detection] Request received`
- `[Face Detection] Models loaded in X.XXs` (only on cold start)
- `[Face Detection] Detection completed in X.XXs`
- `[Face Detection] Total request time: X.XXs`

## Recommendations

### If on Hobby Plan (10s timeout):
1. **Upgrade to Pro** - Required for 60s timeout
2. **Or**: Use edge functions with smaller models (not currently supported)
3. **Or**: Move face detection to a separate service with longer timeout

### If on Pro Plan:
1. **Verify timeout configuration** - The `vercel.json` should set 60s timeout
2. **Check model sizes** - Large models take longer to load
3. **Consider model optimization** - Use smaller/faster models if accuracy allows

### Optimization Options:
1. **Pre-warm functions** - Keep functions warm with periodic pings
2. **Use edge functions** - Faster cold starts (but may have limitations)
3. **Optimize models** - Use quantized or smaller models
4. **Increase client timeout** - Match server timeout (currently 25s client, 60s server)

## Next Steps

1. Run the test script locally to establish baseline performance
2. Check Vercel logs after deployment to see actual timings
3. Verify Vercel plan supports 60s timeout
4. Consider optimizations if still too slow

