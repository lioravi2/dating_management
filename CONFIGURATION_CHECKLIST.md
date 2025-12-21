# Configuration Checklist - Mobile App

Please verify each item below and check ✅ or ❌ for each.

## 1. Mobile App Environment Variables (`apps/mobile/.env`)

**Location:** `apps/mobile/.env`

**Required Variables:**
- [ ] `EXPO_PUBLIC_SUPABASE_URL` - Should be your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Should be your Supabase anon/public key (starts with `eyJ...`)
- [ ] `EXPO_PUBLIC_WEB_APP_URL` - Optional, for dev sign-in API (e.g., `http://192.168.10.5:3000` or `http://localhost:3000`)

**How to check:**
1. Open `apps/mobile/.env` file
2. Verify all three variables are present and have values
3. Make sure there are no extra spaces or quotes around values

**Expected format:**
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_WEB_APP_URL=http://192.168.10.5:3000
```

---

## 2. Supabase Project Configuration

**Location:** Supabase Dashboard → Project Settings

### 2.1 API Settings
- [ ] **Project URL** - Should match `EXPO_PUBLIC_SUPABASE_URL` in `.env`
- [ ] **anon/public key** - Should match `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`
- [ ] **service_role key** - Should be in web app's `.env` (for dev-signin API)

### 2.2 Authentication Settings
- [ ] **Site URL** - Should be your web app URL: `https://dating-management.vercel.app` (or your local dev URL)
- [ ] **Redirect URLs** - Should include ALL of these:
  - `datingapp://auth/callback` (for mobile app deep linking)
  - `exp://localhost:8081` (for Expo Go)
  - `https://dating-management.vercel.app/**` (for web app - wildcard allows all paths)
  - `http://localhost:3000/**` (for local web dev - wildcard allows all paths)
- [ ] **Email Provider** - Should be enabled
- [ ] **OAuth Providers** (Google, Facebook) - Should be configured if using

### 2.3 Database
- [ ] **Database exists** - Verify tables are created (partners, partner_notes, etc.)
- [ ] **RLS Policies** - Verify Row Level Security is configured

**How to check:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Compare URLs and keys with `.env` files
5. Go to Authentication → URL Configuration
6. Check Site URL and Redirect URLs

---

## 3. Mobile App Configuration (`apps/mobile/app.json`)

**Location:** `apps/mobile/app.json`

**Current Configuration:**
```json
{
  "expo": {
    "name": "mobile",
    "slug": "mobile",
    "scheme": "datingapp",
    "android": {
      "package": "com.datingapp.mobile"
    }
  }
}
```

**Check:**
- [ ] **No `newArchEnabled` setting** - Should NOT be present (Expo Go always uses new architecture)
- [ ] **`scheme: "datingapp"`** - Should match Supabase redirect URL
- [ ] **`package: "com.datingapp.mobile"`** - Should be set

---

## 4. Android Native Build Configuration (`apps/mobile/android/gradle.properties`)

**Location:** `apps/mobile/android/gradle.properties`

**Current Setting:**
```
newArchEnabled=false
```

**⚠️ POTENTIAL ISSUE:**
- [ ] **`newArchEnabled=false`** - This conflicts with Expo Go (which always uses new architecture)
- [ ] **Action needed:** If using Expo Go, this should be `true` OR the `android/` folder should be deleted and regenerated

**How to check:**
1. Open `apps/mobile/android/gradle.properties`
2. Find line 38: `newArchEnabled=false`
3. If using Expo Go, this might cause issues

---

## 5. Package Dependencies (`apps/mobile/package.json`)

**Location:** `apps/mobile/package.json`

**Critical Dependencies:**
- [ ] `@react-navigation/native`: `^7.1.26`
- [ ] `@react-navigation/native-stack`: `^7.9.0`
- [ ] `@react-navigation/bottom-tabs`: `^7.9.0` (currently installed but not used)
- [ ] `react-native-screens`: `^4.19.0`
- [ ] `react-native-gesture-handler`: `^2.29.1`
- [ ] `@supabase/supabase-js`: `^2.88.0`
- [ ] `expo`: `~54.0.30`

**How to check:**
1. Open `apps/mobile/package.json`
2. Verify all dependencies are listed
3. Run `npm install` to ensure they're installed

---

## 6. Web App Dev Sign-In API (`apps/web/src/app/api/auth/dev-signin/route.ts`)

**Location:** `apps/web/src/app/api/auth/dev-signin/route.ts`

**Check:**
- [ ] **File exists** - Should be present
- [ ] **CORS headers** - Should include `Access-Control-Allow-Origin: *`
- [ ] **Dev email check** - Should check for `avilior@hotmail.com`
- [ ] **Web app running** - Should be accessible at `http://localhost:3000` or your IP

**How to check:**
1. Verify file exists at the path above
2. Start web app: `cd apps/web && npm run dev`
3. Test endpoint: `curl -X POST http://localhost:3000/api/auth/dev-signin -H "Content-Type: application/json" -d '{"email":"avilior@hotmail.com"}'`

---

## 7. React Navigation Configuration

**Location:** `apps/mobile/src/navigation/`

**Check:**
- [ ] **RootNavigator.tsx** - Uses `createNativeStackNavigator` (not bottom tabs)
- [ ] **MainNavigator.tsx** - Simple View component (no Tab Navigator)
- [ ] **AuthNavigator.tsx** - Uses `createNativeStackNavigator`
- [ ] **No Tab Navigator imports** - Should not import `@react-navigation/bottom-tabs` in active code

**How to check:**
1. Open `apps/mobile/src/navigation/MainNavigator.tsx`
2. Verify it's a simple component (no Tab.Navigator)
3. Open `apps/mobile/src/navigation/RootNavigator.tsx`
4. Verify it uses Stack.Navigator only

---

## 8. Expo Go vs Development Build

**Check which you're using:**
- [ ] **Expo Go** - Using the Expo Go app from app store
- [ ] **Development Build** - Using `npx expo run:android` to build native app

**If using Expo Go:**
- [ ] **No `android/` folder needed** - Can delete it
- [ ] **No `newArchEnabled` in app.json** - Should not be present
- [ ] **No `newArchEnabled` in gradle.properties** - Should not matter (but might cause confusion)

**If using Development Build:**
- [ ] **`android/` folder exists** - Should be present
- [ ] **`newArchEnabled` in gradle.properties** - Should match your preference
- [ ] **App rebuilt** - Should run `npx expo prebuild --clean` after config changes

---

## 9. Device/Emulator Configuration

**Check:**
- [ ] **App uninstalled** - Old version completely removed from device
- [ ] **Metro cache cleared** - Run `npx expo start --clear`
- [ ] **Device connected** - Device/emulator is connected and visible in `adb devices`
- [ ] **Network accessible** - Device can reach your computer's IP (for dev-signin API)

---

## 10. Error Details

**Please provide:**
- [ ] **Exact error message** - Copy the full error from Metro console
- [ ] **When it crashes** - On app start? After sign-in? When navigating?
- [ ] **Device type** - Physical device or emulator? Android version?
- [ ] **Expo Go or Dev Build?** - Which are you using?

---

## Summary

After checking all items above, please note:
1. Which items are ✅ (correct)
2. Which items are ❌ (incorrect or missing)
3. Any values that need to be shared (Supabase URL, keys, etc.)

This will help identify the exact configuration issue causing the crash.

