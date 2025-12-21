# Android App Migration Guide

This guide outlines the steps to transform your Next.js dating app into a native Android application.

## Overview

Your current app is built with:
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Features**: Authentication, Partner Management, Face Recognition, Google Calendar, Stripe Payments, Analytics

## Migration Strategy Options

### Option 1: React Native with Expo (Recommended)
**Pros:**
- Share codebase with web app (React/TypeScript)
- Faster development
- Cross-platform (iOS + Android)
- Large ecosystem
- Expo simplifies native module integration

**Cons:**
- Slightly larger app size
- Some native features may require custom modules

### Option 2: Native Android (Kotlin/Java)
**Pros:**
- Best performance
- Full access to Android APIs
- Native look and feel
- Smaller app size

**Cons:**
- Complete rewrite required
- Separate codebase maintenance
- Longer development time
- No code sharing with web

### Option 3: Flutter (Dart)
**Pros:**
- Cross-platform (iOS + Android)
- Good performance
- Modern framework

**Cons:**
- Complete rewrite in Dart
- No code sharing with existing React codebase
- Different ecosystem

**Recommendation: React Native with Expo** - Best balance of code reuse, development speed, and native capabilities.

---

## Step-by-Step Migration Plan (React Native with Expo)

### Phase 1: Project Setup & Infrastructure

#### 1.1 Initialize Expo Project
```bash
cd apps/mobile
npx create-expo-app@latest . --template blank-typescript
```

#### 1.2 Install Core Dependencies
```bash
npm install @supabase/supabase-js @react-native-async-storage/async-storage
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm install react-native-safe-area-context react-native-screens
npm install expo-image-picker expo-camera
npm install @stripe/stripe-react-native
npm install @amplitude/analytics-react-native
npm install react-native-gesture-handler
npm install expo-google-app-auth expo-auth-session
```

#### 1.3 Configure TypeScript
- Share types from `packages/shared`
- Set up path aliases matching web app structure

#### 1.4 Environment Configuration
Create `apps/mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_key
EXPO_PUBLIC_AMPLITUDE_API_KEY=your_amplitude_key
```

---

### Phase 2: Authentication Implementation

#### 2.1 Supabase Client Setup
- Create `apps/mobile/src/lib/supabase/client.ts`
- Configure Supabase client with AsyncStorage for session persistence
- Handle deep linking for OAuth callbacks

#### 2.2 Authentication Screens
- **Sign In Screen**: Magic Link, Google, Facebook options
- **Sign Up Screen**: Registration flow
- **Auth Callback Handler**: Deep link handler for OAuth

#### 2.3 Session Management
- Implement session persistence with AsyncStorage
- Auto-refresh tokens
- Handle session expiration

**Key Files to Create:**
```
apps/mobile/src/
├── lib/
│   └── supabase/
│       └── client.ts
├── screens/
│   ├── auth/
│   │   ├── SignInScreen.tsx
│   │   ├── SignUpScreen.tsx
│   │   └── AuthCallbackScreen.tsx
│   └── ...
└── navigation/
    └── AuthNavigator.tsx
```

---

### Phase 3: Core Features Migration

#### 3.1 Navigation Setup
- Set up React Navigation
- Create tab navigator (Dashboard, Partners, Profile, Settings)
- Implement stack navigation for detail screens

#### 3.2 Dashboard Screen
- Partner list view
- Quick actions
- Statistics/summary cards

#### 3.3 Partner Management
- **Partner List**: FlatList with partner cards
- **Partner Detail**: View/edit partner information
- **Partner Form**: Create/edit partner
- **Partner Photos**: Image gallery with face recognition

**Components to Migrate:**
- `PartnerForm.tsx` → React Native form components
- `PartnerPhotos.tsx` → React Native Image components
- `PhotoUploadWithFaceMatch.tsx` → Expo ImagePicker + face detection

#### 3.4 Profile Management
- Profile view/edit screen
- Account settings
- Subscription management

---

### Phase 4: Face Recognition Integration

#### 4.1 Face Detection Library
**Option A: TensorFlow.js (Recommended)**
```bash
npm install @tensorflow/tfjs @tensorflow/tfjs-react-native
npm install @react-native-community/async-storage
npm install expo-gl expo-gl-cpp
```

**Option B: React Native Vision (Native)**
```bash
npm install react-native-vision-camera
npm install vision-camera-face-detector
```

#### 4.2 Face Detection Implementation
- Port face detection logic from `lib/face-detection/`
- Adapt for React Native environment
- Handle model loading (bundle models or download on first use)

#### 4.3 Photo Upload with Face Match
- Use `expo-image-picker` for photo selection
- Implement face detection UI
- Show face selection interface
- Upload to Supabase Storage
- Save face descriptors to database

**Key Adaptations:**
- Replace `face-api.js` DOM-based API with React Native compatible solution
- Use `expo-image-picker` instead of HTML file input
- Adapt canvas operations for React Native

---

### Phase 5: Google Calendar Integration

#### 5.1 OAuth Setup
- Use `expo-auth-session` or `expo-google-app-auth`
- Configure OAuth redirect URIs
- Store tokens securely (Expo SecureStore)

#### 5.2 Calendar Sync
- Port calendar sync logic from `lib/calendar/`
- Use Google Calendar API REST calls
- Implement background sync (Expo TaskManager)

**Implementation:**
```typescript
// Use expo-auth-session for OAuth
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
```

---

### Phase 6: Payment Integration

#### 6.1 Stripe Setup
- Install `@stripe/stripe-react-native`
- Configure Stripe provider
- Set up payment sheet

#### 6.2 Subscription Flow
- Upgrade screen
- Payment sheet integration
- Subscription status checking
- Webhook handling (server-side, no changes needed)

**Key Implementation:**
```typescript
import { useStripe } from '@stripe/stripe-react-native';

// Use Stripe Payment Sheet for native checkout
```

---

### Phase 7: UI/UX Adaptation

#### 7.1 Design System
- Replace Tailwind CSS with React Native StyleSheet or styled-components
- Create reusable component library
- Implement theme system (light/dark mode)

#### 7.2 Component Migration
- Convert web components to React Native equivalents:
  - `div` → `View`
  - `button` → `Pressable` or `TouchableOpacity`
  - `input` → `TextInput`
  - `img` → `Image` or `expo-image`
  - `a` → `Link` or navigation

#### 7.3 Responsive Design
- Use Flexbox (React Native default)
- Handle different screen sizes
- Implement safe area handling

**Styling Options:**
- **StyleSheet**: Built-in, performant
- **styled-components**: Familiar if using on web
- **NativeWind**: Tailwind for React Native (if you want to keep Tailwind)

---

### Phase 8: Native Features

#### 8.1 Push Notifications
```bash
npm install expo-notifications
```
- Set up push notification service
- Handle notification permissions
- Deep linking from notifications

#### 8.2 Background Tasks
- Use Expo TaskManager for background sync
- Calendar sync in background
- Photo upload queue

#### 8.3 File System
- Use Expo FileSystem for local storage
- Cache images
- Store temporary files

#### 8.4 Permissions
- Camera permission (for photo upload)
- Photo library permission
- Calendar permission (for sync)
- Notification permission

---

### Phase 9: Testing & Optimization

#### 9.1 Testing
- Unit tests (Jest)
- Integration tests
- E2E tests (Detox or Maestro)
- Test on physical devices

#### 9.2 Performance Optimization
- Image optimization
- List virtualization (FlatList)
- Lazy loading
- Code splitting

#### 9.3 Error Handling
- Global error boundary
- Network error handling
- Offline mode support

---

### Phase 10: Build & Deployment

#### 10.1 Android Build Configuration
- Configure `app.json` for Android
- Set app icon and splash screen
- Configure permissions
- Set up signing keys

#### 10.2 Build Process
```bash
# Development build
npx expo run:android

# Production build
eas build --platform android
```

#### 10.3 Google Play Store
- Create Google Play Developer account
- Prepare store listing
- Set up app signing
- Submit for review

---

## Code Sharing Strategy

### Shared Code
- **Types**: `packages/shared/index.ts` (already shared)
- **Business Logic**: Face matching, photo upload decision logic
- **API Client**: Supabase client configuration
- **Utilities**: Date formatting, validation, etc.

### Platform-Specific Code
- **UI Components**: Separate implementations
- **Navigation**: React Navigation (mobile) vs Next.js routing (web)
- **Storage**: AsyncStorage (mobile) vs cookies/localStorage (web)
- **File Upload**: Expo ImagePicker (mobile) vs HTML input (web)

---

## Key Technical Challenges & Solutions

### 1. Face Recognition on Mobile
**Challenge**: `face-api.js` uses DOM APIs not available in React Native

**Solutions:**
- Use TensorFlow.js React Native package
- Use native face detection (ML Kit or Vision Framework)
- Pre-process images server-side

**Recommended**: TensorFlow.js React Native for code reuse

### 2. Image Processing
**Challenge**: Canvas operations differ in React Native

**Solutions:**
- Use `expo-gl` for WebGL operations
- Use `react-native-image-manipulator` for image processing
- Process images server-side via API

### 3. Deep Linking
**Challenge**: OAuth callbacks need deep link handling

**Solution**: Configure Expo deep linking and handle in navigation

### 4. Offline Support
**Challenge**: App should work offline

**Solution**: 
- Use Supabase offline mode
- Implement local caching
- Queue actions for sync when online

### 5. Large Bundle Size
**Challenge**: Face recognition models are large

**Solution**:
- Download models on first use
- Use smaller models for mobile
- Consider server-side processing

---

## Migration Timeline Estimate

- **Phase 1-2** (Setup + Auth): 1-2 weeks
- **Phase 3** (Core Features): 2-3 weeks
- **Phase 4** (Face Recognition): 2-3 weeks
- **Phase 5** (Calendar): 1 week
- **Phase 6** (Payments): 1 week
- **Phase 7** (UI/UX): 2 weeks
- **Phase 8** (Native Features): 1-2 weeks
- **Phase 9** (Testing): 1-2 weeks
- **Phase 10** (Build/Deploy): 1 week

**Total: 12-18 weeks** (3-4.5 months) for a complete migration

---

## Recommended Project Structure

```
apps/mobile/
├── src/
│   ├── app/                    # App entry point
│   ├── screens/                # Screen components
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── partners/
│   │   └── profile/
│   ├── components/             # Reusable components
│   │   ├── ui/                # Basic UI components
│   │   └── features/          # Feature-specific components
│   ├── navigation/             # Navigation setup
│   ├── lib/                    # Utilities
│   │   ├── supabase/
│   │   ├── face-detection/
│   │   ├── calendar/
│   │   └── stripe/
│   ├── hooks/                  # Custom hooks
│   └── types/                  # TypeScript types
├── assets/                     # Images, fonts, etc.
├── app.json                    # Expo configuration
├── package.json
└── tsconfig.json
```

---

## Next Steps

1. **Choose migration strategy** (React Native recommended)
2. **Set up development environment**:
   - Install Node.js, npm
   - Install Android Studio
   - Install Expo CLI
   - Set up Android emulator or physical device
3. **Start with Phase 1**: Initialize Expo project
4. **Iterate through phases**: Build incrementally
5. **Test frequently**: On real devices throughout development

---

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Supabase React Native Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [Stripe React Native SDK](https://stripe.dev/stripe-react-native/)
- [React Navigation](https://reactnavigation.org/)

---

## Alternative: Progressive Migration

Instead of a complete rewrite, consider:

1. **Start with Expo Go** for rapid prototyping
2. **Build core features first** (auth, partner list)
3. **Add complex features incrementally** (face recognition, payments)
4. **Test with beta users** before full release
5. **Iterate based on feedback**

This approach allows you to validate the mobile experience before investing in all features.










