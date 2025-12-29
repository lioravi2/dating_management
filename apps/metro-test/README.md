# Metro Test App

Isolated test app for debugging Metro bundler connection issues.

## Quick Start

### 1. Install Dependencies

```bash
cd apps/metro-test
npm install
```

### 2. Start Metro (in a separate terminal)

You can start Metro from either location (they're compatible):

**Option A: Start from test app**
```bash
cd apps/metro-test
npm start
```

**Option B: Start from main app** (if you want to test both apps)
```bash
cd apps/mobile
npm start
```

Metro will run on port 8082 (different from main app's port 8081).

### 3. Build the APK

```bash
cd apps/metro-test
npm run build:apk
```

The script will:
- Auto-detect your local IP address
- Run `expo prebuild` if Android directory doesn't exist
- Build the APK with Metro host configuration
- Show you the APK location

### 4. Install and Test

1. Copy the APK to your device
2. Install it (enable "Install from unknown sources" if needed)
3. Open the app
4. Enter the Metro host (shown in build output, e.g., `192.168.1.100:8082`)
5. Tap "Test Connection"
6. Review the diagnostic information

## Running in Parallel with Main App

The test app is completely isolated and can run alongside your main app:

- **Different package name**: `com.metrotest.app` vs `com.datingapp.mobile`
- **Different Metro port**: Test app uses port 8082, main app uses 8081 (no conflicts)
- **Independent build**: Test app has its own build process
- **No conflicts**: Test app doesn't reference shared packages

### Workflow

1. **Terminal 1**: Keep your main app running (without Metro)
2. **Terminal 2**: Start Metro for testing
   ```bash
   cd apps/metro-test
   npm start
   ```
3. **Terminal 3**: Build test APK when needed
   ```bash
   cd apps/metro-test
   npm run build:apk
   ```

## Scripts

- `npm start` - Start Metro bundler on port 8082
- `npm run build:apk` - Build APK with auto IP detection

## Troubleshooting

### Metro Connection Issues

1. Check that Metro is running: `http://YOUR_IP:8082/status` should respond
2. Verify device and computer are on the same WiFi network
3. Check firewall settings (port 8082 should be open)
4. Review the debug information panel in the app

### Build Issues

1. Make sure dependencies are installed: `npm install`
2. If Android directory is missing, the build script will run `expo prebuild` automatically
3. Check that you have Android SDK and Gradle installed

## Cleanup

To remove the test app:

```bash
# From project root
rm -rf apps/metro-test
# OR on Windows
rmdir /s apps\metro-test
```

The test app is completely self-contained - deletion won't affect the main app.

