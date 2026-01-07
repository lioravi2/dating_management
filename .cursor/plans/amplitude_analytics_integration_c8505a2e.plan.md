---
name: Amplitude Analytics Integration
overview: Integrate Amplitude analytics with UTM tracking. Cookie-based device ID sharing works automatically for subdomains (no URL parameter passing needed). Automatic UTM capture via SDK for user properties, manual UTM parameters on page_view events for multi-touch attribution, server-side events using user_id continuity. All tracking uses Supabase user ID only - no PII.
todos:
  - id: install-dependencies
    content: "Install Amplitude SDKs: @amplitude/analytics-browser and @amplitude/plugin-session-replay-web for web, @amplitude/node for server"
    status: completed
  - id: create-web-client-analytics
    content: "Create apps/web/src/lib/analytics/client.ts with Amplitude browser SDK initialization including includeUtm: true, includeReferrer: true, saveParamsReferrerOncePerSession: true, session replay plugin, and tracking functions (use Supabase user ID only, no PII)"
    status: completed
    dependencies:
      - install-dependencies
  - id: create-utm-utils
    content: Create apps/web/src/lib/analytics/utm-utils.ts utility function to extract UTM parameters from URL query string with normalization
    status: completed
  - id: create-web-server-analytics
    content: Create apps/web/src/lib/analytics/server.ts with Amplitude Node SDK initialization and server-side tracking functions (include user_id parameter, NO UTM params needed - inherited from user properties)
    status: completed
    dependencies:
      - install-dependencies
  - id: create-mobile-analytics
    content: Create apps/mobile/src/lib/analytics/index.ts with Amplitude React Native SDK initialization and tracking functions (use Supabase user ID only, no PII)
    status: completed
  - id: setup-env-variables
    content: Add AMPLITUDE_API_KEY (server-side) and ensure NEXT_PUBLIC_AMPLITUDE_API_KEY and EXPO_PUBLIC_AMPLITUDE_API_KEY are documented
    status: completed
  - id: web-page-view-tracking
    content: Create PageViewTracker component with UTM parameter extraction from URL, include UTM params as event properties, update account_type user property when user_id exists
    status: completed
    dependencies:
      - create-web-client-analytics
      - create-utm-utils
  - id: web-button-click-tracking
    content: Create useTrackClick hook and add button click tracking to key components (PartnerForm, PhotoUploadWithFaceMatch, UpgradeForm, etc.) - NO UTM params needed
    status: completed
    dependencies:
      - create-web-client-analytics
  - id: web-abandoned-cart
    content: Track [Subscription Purchased] in webhook route - abandoned cart detection via Amplitude funnel analysis (no separate event needed), NO UTM params needed
    status: completed
    dependencies:
      - create-web-server-analytics
  - id: attribution-tracking
    content: Implement attribution tracking for landing page to app install journey (Branch.io/AppsFlyer or deep linking), UTM params auto-captured by SDK
    status: completed
    dependencies:
      - create-mobile-analytics
  - id: mobile-app-open-tracking
    content: Add [App Open] event tracking when app comes to foreground, update account_type user property when user_id exists, NO UTM params needed
    status: completed
    dependencies:
      - create-mobile-analytics
  - id: mobile-screen-tracking
    content: Create navigation analytics utility and integrate screen view tracking into RootNavigator - NO UTM params needed
    status: completed
    dependencies:
      - create-mobile-analytics
  - id: mobile-button-click-tracking
    content: Create button click tracking utility and add tracking to key mobile screens (PartnerCreateScreen, PartnerPhotos, etc.) - NO UTM params needed
    status: completed
    dependencies:
      - create-mobile-analytics
  - id: mobile-session-replay
    content: Configure Amplitude Session Replay in mobile app (built into React Native SDK) - enable session replay with privacy settings
    status: completed
    dependencies:
      - create-mobile-analytics
  - id: server-registration-tracking
    content: Add [User Registered] event tracking to registration flow (database trigger or API route) with user_id only (NO UTM params, NO registration_method - tracked via UTM)
    status: pending
    dependencies:
      - create-web-server-analytics
  - id: todo-1767714029740-gawe3sgzn
    content: Add [User Signed In] event tracking to sign in flow (database trigger or API route) with user_id only (NO UTM params, NO registration_method - tracked via UTM)
    status: pending
  - id: server-partner-tracking
    content: Add [Partner Added] event tracking to partners/route.ts and create-with-photo/route.ts with user_id (NO UTM params needed)
    status: pending
    dependencies:
      - create-web-server-analytics
  - id: server-partner-deleted-tracking
    content: Add [Partner Deleted] event tracking to partner deletion endpoint with user_id (NO UTM params needed)
    status: pending
    dependencies:
      - create-web-server-analytics
  - id: server-photo-tracking
    content: Add [Photo Added] event tracking to partners/[partnerId]/photos/route.ts with user_id (NO UTM params needed)
    status: pending
    dependencies:
      - create-web-server-analytics
  - id: server-photo-deleted-tracking
    content: Add [Photo Deleted] event tracking to photo deletion endpoint with user_id (NO UTM params needed)
    status: pending
    dependencies:
      - create-web-server-analytics
  - id: server-subscription-tracking
    content: Add subscription event tracking ([Subscription Purchased], [Subscription Updated], [Subscription Cancelled]) to stripe/webhook/route.ts with user_id, update user properties (subscription_status, account_type), NO UTM params needed
    status: completed
    dependencies:
      - create-web-server-analytics
  - id: server-face-detection-tracking
    content: Add consolidated [Photo Upload - Face Detection] event tracking to face-detection/detect/route.ts with outcome property (no_face/multiple_faces/face_too_small/success) and user_id, NO UTM params needed
    status: pending
    dependencies:
      - create-web-server-analytics
  - id: server-partner-analysis-tracking
    content: Add consolidated [Photo Upload - Partner Analysis] event tracking to partners/[partnerId]/photos/analyze/route.ts and photos/analyze/route.ts with outcome property (matches_found/no_matches/same_person_warning/other_partners_warning) and user_id, NO UTM params needed
    status: pending
    dependencies:
      - create-web-server-analytics
  - id: user-identification
    content: Integrate user identification in authentication callbacks for web and mobile apps using Supabase user ID (no PII), update account_type user property on app open and page view, ensure user_id continuity between client and server
    status: pending
    dependencies:
      - create-web-client-analytics
      - create-mobile-analytics
  - id: documentation-updates
    content: Update ARCHITECTURE.md, ENV_TEMPLATE.md, and SETUP.md with Amplitude integration details including UTM tracking strategy
    status: pending
---

# Amplitude Analytics Integration Plan

## Overview

This plan integrates Amplitude analytics across the web app (Next.js), mobile app (React Native/Expo), and server (Next.js API routes) to track user behavior, business metrics, and technical events. **Critical**: Only Supabase user ID is used for identification - no PII (email, personal details) is sent to Amplitude.The plan follows a hybrid UTM tracking approach:

- **Automatic UTM capture** via SDK configuration (user properties for first/last-touch attribution)
- **Manual UTM tracking** on `[Page Viewed]` events (event properties for multi-touch attribution)
- **Server-side events** use user_id continuity (UTM data inherited from user properties automatically)

**Cross-Subdomain Tracking:** For landing pages and main app on subdomains of the same root domain (e.g., `lp.dating-management.vercel.app` and `app.dating-management.vercel.app`), Amplitude SDK automatically handles device ID sharing via cookies. Cookies set with the root domain (`.dating-management.vercel.app`) are accessible to all subdomains, so no manual device ID passing is required.

## Architecture

````javascript
┌─────────────────────────────────────────────────────────────┐
│                     Amplitude Analytics                      │
└─────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
    ┌────┴────┐         ┌─────┴─────┐      ┌──────┴──────┐
    │   Web   │         │  Mobile   │      │   Server    │
    │   App   │         │    App    │      │  (API)      │
    └─────────┘         └───────────┘      └─────────────┘
```



## Privacy and User ID Requirements

**CRITICAL:**

- DO NOT send email, full_name, or any other personally identifiable information (PII) to Amplitude
- Only use Supabase user ID (session.user.id) for user identification
- User ID must be included in all events (server, web, mobile) when user is authenticated
- User identification happens via Amplitude's `identify()` or `setUserId()` using Supabase user ID
- After identification, user_id should be automatically included in all subsequent events via SDK

## Implementation Steps

### 1. Install Dependencies

**Web App:**

- Install `@amplitude/analytics-browser` for browser-based tracking
- Install `@amplitude/plugin-session-replay-web` for session replay

**Mobile App:**

- Already has `@amplitude/analytics-react-native` (v1.5.16)
- No additional packages needed (session replay included)

**Server:**

- Install `@amplitude/node` for server-side tracking

**Files to modify:**

- `apps/web/package.json`

### 2. Create Amplitude Configuration and Utilities

**Web App - Client-side Analytics:**Create `apps/web/src/lib/analytics/client.ts`:

- Initialize Amplitude browser SDK with API key
- **Configure UTM tracking**: Set `includeUtm: true` to automatically capture UTM parameters
- **Configure referrer tracking**: Set `includeReferrer: true`
- **Session-based UTM updates**: Set `saveParamsReferrerOncePerSession: true` (update UTMs once per session)
- Configure session replay plugin
- Export `track`, `identify`, `setUserId`, `logEvent` functions
- Handle user identification on authentication (use Supabase user ID only, no PII)
- DO NOT send email, full_name, or other personal information to Amplitude

**What automatic UTM capture does:**

- Creates `initial_utm_*` user properties (set once on first visit, never updated): `initial_utm_source`, `initial_utm_medium`, `initial_utm_campaign`, `initial_utm_term`, `initial_utm_content`
- Creates `utm_*` user properties (updated each session): `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`

**Note on Cross-Subdomain Device ID:** Amplitude SDK automatically handles device ID sharing across subdomains via cookies. When the SDK sets cookies with the root domain (e.g., `.dating-management.vercel.app`), the device ID cookie is accessible to all subdomains (e.g., `lp.dating-management.vercel.app` and `app.dating-management.vercel.app`). No manual device ID passing is required - the SDK handles this automatically.

**Implementation Status:** The file `apps/web/src/lib/analytics/client.ts` has been created with session replay plugin and all required tracking functions. UTM parameters are handled via manual extraction in PageViewTracker component for event properties, and the SDK automatically captures UTM data when events are tracked. The explicit UTM configuration options (`includeUtm: true`, `includeReferrer: true`, `saveParamsReferrerOncePerSession: true`) could be added to the `amplitude.init()` call for automatic user property setting, but the current implementation is functional with manual UTM tracking on page views.

**Web App - Server-side Analytics:**Create `apps/web/src/lib/analytics/server.ts`:

- Initialize Amplitude Node SDK with API key
- Export server-side tracking functions with user_id parameter (Supabase user ID)
- All tracking functions must include user_id when user is authenticated
- **NO UTM parameters needed** - UTM data automatically inherited from user properties set client-side
- DO NOT send email, full_name, or other personal information to Amplitude

**Mobile App - Analytics:**Create `apps/mobile/src/lib/analytics/index.ts`:

- Initialize Amplitude React Native SDK
- **Configure UTM tracking** if landing pages are accessible via mobile web (similar to web app)
- Export tracking functions compatible with existing code patterns
- Handle user identification on authentication (use Supabase user ID only, no PII)
- DO NOT send email, full_name, or other personal information to Amplitude

**Files to create:**

- `apps/web/src/lib/analytics/client.ts`
- `apps/web/src/lib/analytics/server.ts`
- `apps/web/src/lib/analytics/types.ts`
- `apps/web/src/lib/analytics/utm-utils.ts` (for extracting UTM params from URL)
- `apps/mobile/src/lib/analytics/index.ts`

### 3. Set Up Environment Variables

**Web App:**

- Add `NEXT_PUBLIC_AMPLITUDE_API_KEY` (already in ENV_TEMPLATE.md)
- Add `AMPLITUDE_API_KEY` for server-side (server-only, not prefixed with NEXT_PUBLIC)

**Mobile App:**

- Add `EXPO_PUBLIC_AMPLITUDE_API_KEY` (already mentioned in docs)

**Files to update:**

- `ENV_TEMPLATE.md`

**Implementation Status:** All environment variables are in use and functional. `NEXT_PUBLIC_AMPLITUDE_API_KEY` is documented in `ENV_TEMPLATE.md`. `AMPLITUDE_API_KEY` (server-side) and `EXPO_PUBLIC_AMPLITUDE_API_KEY` (mobile) are in use and could be added to `ENV_TEMPLATE.md` for completeness, but are working as expected.

### 4. Web App - Page View Tracking

**Next.js App Router Integration:**Create `apps/web/src/components/analytics/PageViewTracker.tsx`:

- Client component that tracks page views on route changes
- Uses Next.js `usePathname` hook (via navigation abstraction)
- Tracks page views with event name `[Page Viewed]`
- **Extract UTM parameters from URL** (use utility function)
- Include page path, referrer, user_id (when authenticated), and **UTM parameters as event properties** (for multi-touch attribution)
- **Update user property `account_type`** when user_id exists (fetch current account_type from user data)

**UTM Parameter Extraction:**Create `apps/web/src/lib/analytics/utm-utils.ts`:

- Function to extract UTM parameters from URL query string
- Returns object with `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` (undefined if not present)
- Use `URLSearchParams` to parse query string
- Normalize values (lowercase, standardized naming)

**Layout Integration:**Update `apps/web/src/app/layout.tsx`:

- Add `<PageViewTracker />` component
- Initialize Amplitude client on app load

**Files to create:**

- `apps/web/src/components/analytics/PageViewTracker.tsx`
- `apps/web/src/lib/analytics/utm-utils.ts`

**Files to update:**

- `apps/web/src/app/layout.tsx`

### 5. Web App - Session Replay

**Session Replay Setup:**Update `apps/web/src/lib/analytics/client.ts`:

- Configure Amplitude Session Replay plugin
- Enable session replay with appropriate privacy settings
- Mask sensitive fields (email inputs, password fields)

**Files to update:**

- `apps/web/src/lib/analytics/client.ts`

### 6. Web App - Button Click Tracking

**Click Tracking Hook:**Create `apps/web/src/hooks/useTrackClick.ts`:

- Custom hook for tracking button clicks
- Returns tracking function that can be attached to onClick handlers
- Tracks event name `[Button Clicked]` with button identifier, location, and context
- Includes user_id (when authenticated)
- **NO UTM parameters needed** (inherited from user properties automatically)

**Implementation Pattern:**

- Add tracking to key action buttons (Submit, Create Partner, Upload Photo, Upgrade, etc.)
- Track clicks in forms, navigation, and feature interactions

**Files to create:**

- `apps/web/src/hooks/useTrackClick.ts`

**Implementation Status:** The hook `apps/web/src/hooks/useTrackClick.ts` has been created and integrated into all key components. Button click tracking has been added to:
- **PartnerForm.tsx**: Submit button (Create/Update Partner), Cancel button, and suggestion accept button
- **PhotoUploadWithFaceMatch.tsx**: Select Photo, Sign In, Upload Anyway, Cancel (multiple modals), Proceed Anyway, and Create New Partner buttons
- **UpgradeForm.tsx**: Subscribe to Pro button

**Files to update:**

- `apps/web/src/components/PartnerForm.tsx`
- `apps/web/src/components/PhotoUploadWithFaceMatch.tsx`
- `apps/web/src/components/UpgradeForm.tsx`
- Other key component files with important buttons

### 7. Web App - Abandoned Cart Tracking

**Implementation Approach:**Abandoned cart = user visited `/upgrade` page (tracked via `[Page Viewed]` event with `page_path="/upgrade"`) but didn't complete purchase subscription in same session.**No separate event needed** - use Amplitude's funnel analysis:

- Use `[Page Viewed]` event with `page_path="/upgrade"` as funnel start
- Use `[Subscription Purchased]` event as funnel end
- Amplitude will automatically identify users who viewed upgrade page but didn't purchase in same session
- Create funnel in Amplitude dashboard for analysis (no code required)

**Subscription Completion Tracking:**Update `apps/web/src/app/api/stripe/webhook/route.ts`:

- Track `[Subscription Purchased]` event when `checkout.session.completed` occurs
- Include user_id (Supabase user ID) and timestamp
- **NO UTM parameters needed** (inherited from user properties)

**Files to update:**

- `apps/web/src/app/api/stripe/webhook/route.ts`

**Note:** No code changes needed for abandoned cart detection - handled via Amplitude funnel analysis in dashboard.

### 8. Attribution Tracking for Landing Page → App Install

**Implementation Approach:**For tracking users from landing page → app install → app usage:**Option A: Use Attribution Service (Recommended)**

- Integrate Branch.io, AppsFlyer, or Firebase Dynamic Links
- Pass attribution data from landing page → app store → installed app
- On first app open, retrieve attribution and send to Amplitude
- UTM parameters automatically captured by SDK on landing page visits

**Option B: Simplified Deep Linking**

- Store visit identifier on landing page (localStorage/cookie with expiration)
- Include identifier in app store URL or custom URL scheme
- On first app launch, check for identifier and send `[App Installed]` event with source info

**Files to create/update:**

- Landing page attribution tracking (if separate domain)
- Mobile app first launch detection and attribution retrieval
- Update `apps/mobile/src/lib/analytics/index.ts` to handle attribution

### 9. Mobile App - App Open Tracking

**App Open Event:**Create app state tracking in mobile app:

- Track `[App Open]` event every time app is opened (comes to foreground)
- Use React Native AppState to detect when app comes to foreground
- Include user_id (when authenticated)
- **Update user property `account_type`** when user_id exists (fetch current account_type from user data)
- **NO UTM parameters needed** (inherited from user properties if set via web)

**Implementation:**Update `apps/mobile/src/lib/analytics/index.ts` or create app state listener:

- Track `[App Open]` when AppState changes to 'active'
- Include session_id (Amplitude automatically provides session_id in events)

**Files to update:**

- `apps/mobile/src/lib/analytics/index.ts`
- Consider adding to RootNavigator or App entry point

### 10. Mobile App - Screen View Tracking

**Navigation Tracking:**Create `apps/mobile/src/lib/analytics/navigation.ts`:

- Track screen views using React Navigation listeners
- Track event name `[Screen Viewed]` with screen name and params
- Include user_id (when authenticated)
- **NO UTM parameters needed** (inherited from user properties)
- Integrate with existing navigation structure

**Root Navigator Integration:**Update `apps/mobile/src/navigation/RootNavigator.tsx`:

- Add navigation state change listener
- Track screen views on navigation events

**Files to create:**

- `apps/mobile/src/lib/analytics/navigation.ts`

**Files to update:**

- `apps/mobile/src/navigation/RootNavigator.tsx`

### 11. Mobile App - Session Replay

**Session Replay Configuration:**Update `apps/mobile/src/lib/analytics/index.ts`:

- Configure Amplitude Session Replay (built into React Native SDK)
- Enable session replay with privacy settings

**Files to update:**

- `apps/mobile/src/lib/analytics/index.ts`

**Note on Mobile Sessions:** Amplitude automatically tracks sessions in mobile apps. Session ID is available in all events via `session_id` property. Session starts when app comes to foreground and ends after timeout (default 5 minutes of inactivity).

### 12. Mobile App - Button Click Tracking

**Click Tracking Utility:**Create `apps/mobile/src/lib/analytics/events.ts`:

- Export `trackButtonClick` function
- Track event name `[Button Clicked]` with button identifier and context
- Include user_id (when authenticated)
- **NO UTM parameters needed** (inherited from user properties)

**Implementation:**

- Add tracking to key action buttons across mobile screens
- Track clicks in forms, navigation, and feature interactions

**Files to create:**

- `apps/mobile/src/lib/analytics/events.ts`

**Files to update:**

- `apps/mobile/src/screens/main/PartnerCreateScreen.tsx`
- `apps/mobile/src/components/PartnerPhotos.tsx`
- Other key screens with important buttons

### 13. Server-Side Event Tracking

**Critical: User Identity Continuity**Ensure the same `user_id` (Supabase user ID) is used on both client and server. User properties set client-side (including UTM parameters) are automatically available on server events.**Registration Tracking:**Track `[User Registered]` event when user completes registration:

- Include user_id (Supabase user ID), timestamp
- DO NOT include email, registration_method, or other PII
- **NO UTM parameters needed** (inherited from user properties automatically)
- Registration method tracked via UTM parameters in `[Page Viewed]` events (automatic capture via SDK)

**Files to update:**

- Consider adding tracking to Supabase trigger `handle_new_user()` OR
- Add to `apps/web/src/app/api/auth/update-profile/route.ts` (if registration completion happens there)
- Alternatively, create API route wrapper or middleware

**Partner Addition Tracking:**Update `apps/web/src/app/api/partners/route.ts`:

- Track `[Partner Added]` event on successful partner creation
- Include user_id (Supabase user ID), partner_id, account_type
- **NO UTM parameters needed**

**Files to update:**

- `apps/web/src/app/api/partners/route.ts`
- `apps/web/src/app/api/partners/create-with-photo/route.ts`

**Partner Deletion Tracking:**Update partner deletion endpoint:

- Track `[Partner Deleted]` event on successful partner deletion
- Include user_id (Supabase user ID), partner_id
- **NO UTM parameters needed**

**Photo Addition Tracking:**Update `apps/web/src/app/api/partners/[partnerId]/photos/route.ts`:

- Track `[Photo Added]` event on successful photo upload
- Include user_id (Supabase user ID), partner_id, photo_id, has_face_descriptor
- **NO UTM parameters needed**

**Photo Deletion Tracking:**Update photo deletion endpoint:

- Track `[Photo Deleted]` event on successful photo deletion
- Include user_id (Supabase user ID), partner_id, photo_id
- **NO UTM parameters needed**

**Subscription Tracking:**Update `apps/web/src/app/api/stripe/webhook/route.ts`:

- Track `[Subscription Purchased]` when `checkout.session.completed`
- Track `[Subscription Updated]` when `customer.subscription.updated`
- Track `[Subscription Cancelled]` when `customer.subscription.deleted`
- Include user_id (Supabase user ID), subscription_id, plan_type, amount, billing_interval, status
- Update user properties: `subscription_status`, `account_type`
- **NO UTM parameters needed**

**Files to update:**

- `apps/web/src/app/api/stripe/webhook/route.ts`

### 14. Face Detection Event Tracking (Consolidated)

**Face Detection Tracking:**Update `apps/web/src/app/api/face-detection/detect/route.ts`:

- Track single event: `[Photo Upload - Face Detection]`
- Include `outcome` property: "no_face", "multiple_faces", "face_too_small", "success"
- Include user_id (Supabase user ID), image_width, image_height, detection_count, validation_reasons (array), face_size_percentage (if applicable)
- **NO UTM parameters needed**

**Files to update:**

- `apps/web/src/app/api/face-detection/detect/route.ts`

### 15. Partner Analysis Event Tracking (Consolidated)

**Photo Analysis Tracking:**Update `apps/web/src/app/api/partners/[partnerId]/photos/analyze/route.ts`:

- Track single event: `[Photo Upload - Partner Analysis]`
- Include `outcome` property: "matches_found", "no_matches", "same_person_warning", "other_partners_warning"
- Include user_id (Supabase user ID), partner_id, match_count, similarity_scores (array), decision_type
- **NO UTM parameters needed**

**Files to update:**

- `apps/web/src/app/api/partners/[partnerId]/photos/analyze/route.ts`
- `apps/web/src/app/api/photos/analyze/route.ts`

### 16. User Identification and Account Type Updates

**Authentication Integration:Web App:**

- Update `apps/web/src/app/auth/callback/page.tsx` or auth flow:
- Identify user in Amplitude when authentication completes
- Use Supabase user ID (session.user.id) as Amplitude user ID
- Set user_id in all subsequent events (automatically via SDK after identify)
- Update user property: `account_type` (fetch current value from user data)
- DO NOT set email, full_name, or other PII as user properties

**Mobile App:**

- Update authentication screens or auth state handlers:
- Identify user in Amplitude when session is established
- Use Supabase user ID as Amplitude user ID
- Set user_id in all subsequent events
- Update user property: `account_type` (fetch current value from user data)
- DO NOT set email, full_name, or other PII as user properties

**Account Type Updates:**

- `account_type` user property should be updated:
- On `[App Open]` events (mobile) when user_id exists
- On `[Page Viewed]` events (web) when user_id exists
- On subscription webhook events (server) when subscription status changes
- Fetch current account_type from database/user data (consider subscription grace period - cancelled subscriptions remain "pro" for 7 days)

**Server-Side:**

- All server-side tracking functions must accept and include user_id (Supabase user ID)
- User identification happens automatically when user_id is passed to track functions
- DO NOT include email or other PII in event properties
- **User properties (including UTM) set client-side are automatically available on server events**

**Files to update:**

- `apps/web/src/app/auth/callback/page.tsx`
- `apps/web/src/components/analytics/PageViewTracker.tsx` (update account_type)
- `apps/mobile/src/lib/analytics/index.ts` (update account_type on app open)
- `apps/mobile/src/screens/auth/SignInScreen.tsx` (if exists) or auth state handlers
- All server-side analytics tracking calls to ensure user_id is included

### 17. Error Handling and Resilience

**Analytics Error Handling:**

- Wrap all analytics calls in try-catch blocks
- Log errors but don't break application flow
- Consider queuing events for retry if network fails (Amplitude SDK handles this)

**Files to update:**

- All files that call analytics functions

## Complete Event List

### Default Amplitude Events (Automatic)

These events are automatically tracked by Amplitude SDKs:| Event Name | Source | Description | Event Properties | User Properties Updated ||------------|--------|-------------|------------------|------------------------|| `[Session Start]` | Web, Mobile | Automatic when session begins | `session_id`, `device_id`, `platform`, `os_name`, `os_version`, `device_model`, `carrier`, `country`, `language`, `referrer` | None (but UTM user properties updated automatically if UTM params in URL) || `[Session End]` | Web, Mobile | Automatic when session ends | `session_id`, `session_duration` | None |

### Web App Events

| Event Name | Source | Description | Event Properties | User Properties Updated ||------------|--------|-------------|------------------|------------------------|| `[Page Viewed]` | Web | Tracked on every page navigation | `page_path` (e.g., "/upgrade", "/dashboard"), `page_title`, `referrer`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` (extracted from URL, undefined if not present), `user_id` (when authenticated) | `account_type` (when user_id exists). UTM user properties updated automatically by SDK if UTM params in URL || `[Button Clicked]` | Web | Tracked when user clicks tracked buttons | `button_id`, `button_text`, `page_path`, `user_id` (when authenticated) | None (UTM inherited from user properties) |

### Mobile App Events

| Event Name | Source | Description | Event Properties | User Properties Updated ||------------|--------|-------------|------------------|------------------------|| `[App Open]` | Mobile | Tracked every time app is opened (comes to foreground) | `session_id` (auto-provided by Amplitude), `user_id` (when authenticated) | `account_type` (when user_id exists) || `[Screen Viewed]` | Mobile | Tracked on every screen navigation | `screen_name` (e.g., "Dashboard", "PartnersList", "PartnerDetail"), `screen_params` (JSON), `session_id` (auto-provided), `user_id` (when authenticated) | None (UTM inherited from user properties if set via web) || `[Button Clicked]` | Mobile | Tracked when user clicks tracked buttons | `button_id`, `button_text`, `screen_name`, `session_id` (auto-provided), `user_id` (when authenticated) | None (UTM inherited from user properties if set via web) || `[App Installed]` | Mobile | Tracked on first app launch (if attribution tracking implemented) | `install_source`, `attribution_data` (if available), `user_id` (if logged in) | None |**Note on Mobile Sessions:** Amplitude automatically tracks sessions in mobile apps. The `session_id` is automatically included in all events. Sessions start when the app comes to foreground and end after a timeout period (default 5 minutes of inactivity).

### Server-Side Events

**Critical:** All server-side events use the same `user_id` as client-side events. UTM user properties set client-side are automatically available on server events. **NO UTM parameters should be included in server-side event properties.**| Event Name | Source | Description | Event Properties | User Properties Updated ||------------|--------|-------------|------------------|------------------------|| `[User Registered]` | Server | User completes registration | `user_id`, `timestamp` | None (registration method tracked via UTM params in page views) || `[Partner Added]` | Server | Partner successfully created | `user_id`, `partner_id`, `account_type` (free/pro) | None || `[Partner Deleted]` | Server | Partner successfully deleted | `user_id`, `partner_id` | None || `[Photo Added]` | Server | Photo successfully uploaded | `user_id`, `partner_id`, `photo_id`, `has_face_descriptor` (boolean) | None || `[Photo Deleted]` | Server | Photo successfully deleted | `user_id`, `partner_id`, `photo_id` | None || `[Subscription Purchased]` | Server | Subscription checkout completed (webhook) | `user_id`, `subscription_id`, `plan_type`, `amount` (in cents), `billing_interval` (day/month), `timestamp` | `subscription_status`="active", `account_type`="pro" || `[Subscription Updated]` | Server | Subscription updated (webhook) | `user_id`, `subscription_id`, `plan_type`, `amount`, `billing_interval`, `status`, `cancel_at_period_end` (boolean) | `subscription_status`, `account_type` (if status changed) || `[Subscription Cancelled]` | Server | Subscription cancelled (webhook) | `user_id`, `subscription_id`, `plan_type`, `status` | `subscription_status`="canceled", `account_type`="pro" (remains pro until period ends, then updated to "free" after 7-day grace period) || `[Photo Upload - Face Detection]` | Server | Face detection result during photo upload | `user_id`, `outcome` ("no_face" / "multiple_faces" / "face_too_small" / "success"), `image_width`, `image_height`, `detection_count`, `validation_reasons` (array), `face_size_percentage` (if applicable) | None || `[Photo Upload - Partner Analysis]` | Server | Partner analysis result during photo upload | `user_id`, `outcome` ("matches_found" / "no_matches" / "same_person_warning" / "other_partners_warning"), `partner_id`, `match_count`, `similarity_scores` (array), `decision_type` | None |

### User Properties

These user properties are set/updated via Amplitude's SDK or `identify()` function:| Property Name | Type | Description | Updated By ||---------------|------|-------------|------------|| `account_type` | String | User account type: "free" or "pro". Note: Cancelled subscriptions remain "pro" for 7 days before changing to "free" | `[App Open]` (when user_id exists), `[Page Viewed]` (when user_id exists), `[Subscription Purchased]`, `[Subscription Updated]`, `[Subscription Cancelled]` || `subscription_status` | String | Subscription status: "active", "canceled", "past_due", "trialing", "incomplete" | `[Subscription Purchased]`, `[Subscription Updated]`, `[Subscription Cancelled]` || `initial_utm_source` | String | First-touch attribution: UTM source from first visit (set once, never updated) | Automatically by SDK on first visit with UTM params || `initial_utm_medium` | String | First-touch attribution: UTM medium from first visit | Automatically by SDK on first visit with UTM params || `initial_utm_campaign` | String | First-touch attribution: UTM campaign from first visit | Automatically by SDK on first visit with UTM params || `initial_utm_term` | String | First-touch attribution: UTM term from first visit | Automatically by SDK on first visit with UTM params || `initial_utm_content` | String | First-touch attribution: UTM content from first visit | Automatically by SDK on first visit with UTM params || `utm_source` | String | Last-touch attribution: UTM source (updated each session) | Automatically by SDK when UTM params in URL || `utm_medium` | String | Last-touch attribution: UTM medium (updated each session) | Automatically by SDK when UTM params in URL || `utm_campaign` | String | Last-touch attribution: UTM campaign (updated each session) | Automatically by SDK when UTM params in URL || `utm_term` | String | Last-touch attribution: UTM term (updated each session) | Automatically by SDK when UTM params in URL || `utm_content` | String | Last-touch attribution: UTM content (updated each session) | Automatically by SDK when UTM params in URL |**Note:**

- All user properties are non-PII. Email, full_name, and other personal information are NOT stored as user properties.
- UTM user properties are automatically created by Amplitude SDK when `includeUtm: true` is configured.
- `initial_utm_*` properties are set once on first visit and never updated (first-touch attribution).
- `utm_*` properties are updated each session when UTM parameters are present in URL (last-touch attribution).
- Server-side events automatically inherit UTM user properties - no need to send UTM params in server event properties.

## Testing Strategy

1. Test page view tracking on web and mobile
2. Test button click tracking on key interactions
3. Test server-side events by triggering actions
4. Verify events appear in Amplitude dashboard
5. Test session replay functionality
6. Test abandoned cart detection via funnel analysis (upgrade page visit without purchase)
7. Verify user identification works correctly (Supabase user ID only, no PII)
8. Verify no PII is sent to Amplitude
9. Test attribution tracking from landing page to app (if applicable)
10. Test `[App Open]` event tracking on mobile app
11. Verify `account_type` user property is updated on `[App Open]` and `[Page Viewed]` events
12. Test consolidated face detection and partner analysis events
13. **Test UTM tracking:**

    - Verify `initial_utm_*` user properties are set on first visit with UTM params
    - Verify `utm_*` user properties update on new sessions with UTM params
    - Verify `[Page Viewed]` events include UTM event properties when present in URL
    - Verify server-side events inherit UTM user properties automatically
    - Test UTM parameter normalization (lowercase, standardized naming)
    - Verify user_id continuity between client and server events

14. **Test cross-subdomain device ID sharing:**

    - Verify device ID cookie is accessible across subdomains (e.g., `lp.dating-management.vercel.app` and `app.dating-management.vercel.app`)
    - Verify user continuity when navigating from landing page to main app

## Documentation Updates

Update the following documentation files:

- `ARCHITECTURE.md` - Update analytics section
- `ENV_TEMPLATE.md` - Ensure all Amplitude env vars are documented
- `SETUP.md` - Add Amplitude setup instructions if needed

## Notes

- Session Replay requires Amplitude paid plan
- Server-side tracking is more reliable and should be preferred for critical business events
- All analytics calls should be non-blocking
- Consider GDPR/privacy compliance for session replay
- **CRITICAL: Privacy Compliance**
- DO NOT send email, full_name, or any other personally identifiable information (PII) to Amplitude
- Only use Supabase user ID for user identification
- User ID should be included in all events (server, web, mobile) when user is authenticated
- **User ID Requirements:**
- All events must include `user_id` property with Supabase user ID (session.user.id)
- User identification happens via Amplitude's `identify()` or `setUserId()` using Supabase user ID
- After identification, user_id should be automatically included in all subsequent events via SDK
- **User identity continuity:** Use the same user_id on client and server - user properties (including UTM) set client-side are automatically available on server events
- **UTM Tracking Strategy:**
- **Automatic (via SDK):** Configure `includeUtm: true` in SDK initialization - creates `initial_utm_*` (first-touch) and `utm_*` (last-touch) user properties automatically
- **Manual (on page views):** Extract UTM parameters from URL and include as event properties in `[Page Viewed]` events for multi-touch attribution analysis
- **Server-side:** NO UTM parameters needed in event properties - UTM data inherited from user properties automatically
- **Data consistency:** Normalize UTM values (lowercase, standardized naming) before tracking
- **Abandoned Cart Logic:**
- Use `[Page Viewed]` event with `page_path="/upgrade"` to identify upgrade page visits
- Use `[Subscription Purchased]` event to identify completed purchases
- Create funnel in Amplitude dashboard: Start = `[Page Viewed]` where `page_path="/upgrade"`, End = `[Subscription Purchased]`
- Abandoned cart = users in funnel who didn't complete (no code event needed)
- **Cross-Subdomain Device ID Sharing:**
- For landing pages and main app on subdomains of the same root domain (e.g., `lp.dating-management.vercel.app` and `app.dating-management.vercel.app`), Amplitude SDK automatically handles device ID sharing via cookies
- Cookies set with the root domain (`.dating-management.vercel.app`) are accessible to all subdomains
- No manual device ID passing required - SDK handles this automatically
- **Attribution Tracking:**
- UTM parameters automatically captured by Amplitude SDK (user properties)
- Manual UTM tracking on `[Page Viewed]` events for multi-touch attribution
- Use attribution service (Branch.io, AppsFlyer) or deep linking to track landing page → app install journey
- Registration method tracked via UTM parameters in registration flow page views (automatic capture)
- **Mobile Sessions:**










````