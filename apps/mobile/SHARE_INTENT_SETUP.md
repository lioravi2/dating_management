# Share Intent Setup Instructions

## Important Notes

1. **Rebuild Required**: After adding the intent filter configuration, you MUST rebuild the app (not just reload). The intent filter changes only take effect after a native rebuild.

2. **Development Build**: If you're using Expo Go, share intents won't work. You need to create a development build or production build.

## Steps to Enable Share Intent

### Configuration Complete

The following changes have been made:
- ✅ Removed `SEND_MULTIPLE` intent filter from `app.json`
- ✅ Verified `SEND` intent filter configuration in `app.json`
- ✅ Added `SEND` intent filter to `AndroidManifest.xml`

### Rebuild and Test

1. **Uninstall the existing app** from your device/emulator (if it exists):
   ```bash
   # On device: Settings > Apps > [Your App] > Uninstall
   # Or via ADB:
   adb uninstall com.datingapp.mobile
   ```

2. **Rebuild the app**:
   ```bash
   # From the apps/mobile directory
   cd apps/mobile
   
   # Build and run on Android
   npx expo run:android
   
   # Or create a development build
   eas build --profile development --platform android
   ```

3. **Verify the build**:
   - The app should install successfully on your device/emulator
   - Check that the app launches normally

4. **Test the share intent**:
   - Open the Gallery/Photos app on your Android device
   - Select any image
   - Tap the **Share** button
   - Your app should now appear in the share sheet
   - Tap your app to open it (note: receiving the actual image data requires additional native code implementation)

### Troubleshooting

If the app doesn't appear in the share sheet:
- Ensure you've uninstalled the old app completely
- Verify the build completed successfully
- Check that the device/emulator has the new build installed
- Try restarting the device/emulator
- Verify `AndroidManifest.xml` contains the SEND intent filter (should be at `apps/mobile/android/app/src/main/AndroidManifest.xml`)

## Current Implementation Status

The intent filter is configured in both `app.json` and `AndroidManifest.xml` to receive `ACTION_SEND` intents with `image/*` MIME type.

**Configuration in app.json:**
- Action: `SEND`
- Data mimeType: `image/*`
- Category: `DEFAULT`

**Configuration in AndroidManifest.xml:**
- Action: `android.intent.action.SEND`
- Data mimeType: `image/*`
- Category: `android.intent.category.DEFAULT`

However, **receiving the actual intent data** requires native code handling. The current implementation uses `expo-linking`, which won't work for Android share intents (they don't come through URLs).

## Next Steps for Full Implementation

To properly receive share intent data, you'll need one of these approaches:

1. **Use a native module** (requires ejecting or using a development build):
   - Create a native module to receive the intent in MainActivity
   - Pass the image URI to React Native

2. **Use expo-intent-launcher** (if available):
   - Check if this package can help receive intents

3. **Handle through App.js initial props**:
   - Modify App.js to receive initial intent data
   - Pass it to RootNavigator

For now, the app should appear in the share sheet after rebuilding, but receiving the image data will need additional native code implementation.

