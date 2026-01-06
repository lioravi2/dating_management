# Amplitude Analytics Testing Checklist

This checklist covers manual testing of Amplitude analytics integration across web app, mobile app, and server-side events.

**How to use this checklist:**
1. Check off items as you complete them (`- [x]` for completed, `- [ ]` for pending)
2. Note any issues or observations in the "Notes" column
3. Verify events in Amplitude dashboard: **User Lookup** → Search by user_id or device_id → View events
4. For real-time testing, use Amplitude's **Live View** feature (may require paid plan)

---

## Prerequisites

- [ ] Amplitude API keys configured:
  - [ ] `NEXT_PUBLIC_AMPLITUDE_API_KEY` (web client)
  - [ ] `AMPLITUDE_API_KEY` (web server)
  - [ ] `EXPO_PUBLIC_AMPLITUDE_API_KEY` (mobile)
- [ ] Access to Amplitude dashboard
- [ ] Test user accounts (authenticated and unauthenticated)
- [ ] Browser DevTools open (Network tab or Console)
- [ ] Mobile device/emulator with app installed

---

## 1. Initialization & Configuration

### Web App Initialization
- [ ] **Amplitude SDK initializes on page load**
  - **Steps:** Open web app, check browser console for errors
  - **Verify:** No console errors about missing API key, session start and page view events appear in Amplitude
  - **Check in Amplitude:** User appears in dashboard (may be anonymous device_id)

- [ ] **Session Replay plugin loads**
  - **Steps:** Open web app, check Network tab for Amplitude requests
  - **Verify:** Session replay requests are sent, session replays are recorded in Amplitude
  - **Note:** Session replay requires Amplitude paid plan

### Mobile App Initialization
- [ ] **Amplitude SDK initializes on app launch**
  - **Steps:** Launch mobile app, check logs/console
  - **Verify:** No errors about missing API key
  - **Check in Amplitude:** Device appears in dashboard

---

## 2. User Identification & Privacy

### Web App User Identification
- [ ] **User ID set on login**
  - **Steps:** 
    1. Open app (unauthenticated)
    2. Log in with test account
    3. Check Amplitude dashboard
  - **Verify:** Events after login include `user_id` (Supabase user ID)
  - **Check in Amplitude:** User Lookup → Search by user_id → Events show user_id

- [ ] **User ID cleared on logout**
  - **Steps:** Log out, perform action (e.g., navigate to page)
  - **Verify:** Events after logout do NOT include `user_id` (or user_id is null/undefined)

- [ ] **No PII sent to Amplitude**
  - **Steps:** Check all events in Amplitude dashboard
  - **Verify:** 
    - No `email` property in events
    - No `full_name` property in events
    - No other personally identifiable information
    - Only `user_id` (Supabase UUID) is used for identification

### Mobile App User Identification
- [ ] **User ID set on login**
  - **Steps:** Launch app, log in with test account
  - **Verify:** Events after login include `user_id`
  - **Check in Amplitude:** User Lookup → Search by user_id → Events show user_id

- [ ] **User ID cleared on logout**
  - **Steps:** Log out, perform action
  - **Verify:** Events after logout do NOT include `user_id`

- [ ] **No PII sent to Amplitude**
  - **Steps:** Check all mobile events in Amplitude dashboard
  - **Verify:** No email, full_name, or other PII in events

---

## 3. Web App Events

### Page View Tracking
- [ ] **Page views tracked on navigation**
  - **Steps:** Navigate between pages (e.g., `/dashboard`, `/partners`, `/upgrade`)
  - **Verify:** `[Page Viewed]` event appears in Amplitude
  - **Event Properties to Check:**
    - `page_path` (e.g., "/dashboard")
    - `page_title` (if available)
    - `referrer` (if available)
    - `user_id` (when authenticated)

- [ ] **UTM parameters included in page view events**
  - **Steps:** 
    1. Visit page with UTM params: `?utm_source=test&utm_medium=email&utm_campaign=test-campaign`
    2. Check Amplitude event
  - **Verify:** Event includes:
    - `utm_source: "test"`
    - `utm_medium: "email"`
    - `utm_campaign: "test-campaign"`
  - **Note:** UTM params should be normalized (lowercase)

- [ ] **Page views tracked without UTM params**
  - **Steps:** Navigate to page without UTM parameters
  - **Verify:** `[Page Viewed]` event appears, UTM properties are undefined/null or not present

- [ ] **Account type updated on page view (authenticated users)**
  - **Steps:** 
    1. Log in as free user, navigate to page
    2. Upgrade to pro, navigate to page
    3. Check Amplitude user properties
  - **Verify:** User property `account_type` is updated to match current account type

### Button Click Tracking
- [ ] **Button clicks tracked**
  - **Steps:** Click tracked buttons (e.g., "Create Partner", "Upload Photo", "Upgrade")
  - **Verify:** `[Button Clicked]` event appears in Amplitude
  - **Event Properties to Check:**
    - `button_id` or `button_text`
    - `page_path`
    - `user_id` (when authenticated)
  - **Note:** Button click tracking may not be fully implemented yet (check plan status)

### Session Events (Automatic)
- [ ] **Session Start tracked**
  - **Steps:** Open web app
  - **Verify:** `[Session Start]` event appears (automatic from SDK)
  - **Event Properties:** `session_id`, `device_id`, `platform`, `os_name`, etc.

- [ ] **Session End tracked**
  - **Steps:** Close browser tab or navigate away
  - **Verify:** `[Session End]` event appears after session timeout
  - **Event Properties:** `session_id`, `session_duration`

---

## 4. Mobile App Events

### App Open Tracking
- [ ] **App open tracked when app comes to foreground**
  - **Steps:** 
    1. Close app completely
    2. Open app (comes to foreground)
    3. Check Amplitude dashboard
  - **Verify:** `[App Open]` event appears
  - **Event Properties to Check:**
    - `session_id` (auto-provided by Amplitude)
    - `user_id` (when authenticated)

- [ ] **Account type updated on app open (authenticated users)**
  - **Steps:** 
    1. Log in, open app
    2. Check Amplitude user properties
  - **Verify:** User property `account_type` is updated

### Screen View Tracking
- [ ] **Screen views tracked on navigation**
  - **Steps:** Navigate between screens (e.g., Dashboard → Partners → Partner Detail)
  - **Verify:** `[Screen Viewed]` event appears
  - **Event Properties to Check:**
    - `screen_name` (e.g., "Dashboard", "PartnersList")
    - `screen_params` (if available)
    - `session_id`
    - `user_id` (when authenticated)
  - **Note:** Screen tracking may not be fully implemented yet (check plan status)

### Button Click Tracking
- [ ] **Button clicks tracked**
  - **Steps:** Click tracked buttons in mobile app
  - **Verify:** `[Button Clicked]` event appears
  - **Event Properties to Check:**
    - `button_id` or `button_text`
    - `screen_name`
    - `session_id`
    - `user_id` (when authenticated)
  - **Note:** Button click tracking may not be fully implemented yet (check plan status)

### Session Events (Automatic)
- [ ] **Session Start tracked**
  - **Steps:** Open mobile app
  - **Verify:** `[Session Start]` event appears (automatic from SDK)
  - **Event Properties:** `session_id`, `device_id`, `platform`, `os_name`, etc.

- [ ] **Session End tracked**
  - **Steps:** Close app or put in background for timeout period
  - **Verify:** `[Session End]` event appears after session timeout
  - **Event Properties:** `session_id`, `session_duration`

---

## 5. Server-Side Events

### User Registration
- [ ] **User registered event tracked**
  - **Steps:** Complete user registration flow
  - **Verify:** `[User Registered]` event appears in Amplitude
  - **Event Properties to Check:**
    - `user_id` (Supabase user ID)
    - `timestamp`
  - **Note:** Registration tracking may not be fully implemented yet (check plan status)

### Partner Events
- [ ] **Partner added event tracked**
  - **Steps:** Create a new partner (via web or mobile)
  - **Verify:** `[Partner Added]` event appears
  - **Event Properties to Check:**
    - `user_id`
    - `partner_id`
    - `account_type` (free/pro)
  - **Note:** Partner tracking may not be fully implemented yet (check plan status)

- [ ] **Partner deleted event tracked**
  - **Steps:** Delete a partner
  - **Verify:** `[Partner Deleted]` event appears
  - **Event Properties to Check:**
    - `user_id`
    - `partner_id`
  - **Note:** Partner deletion tracking may not be fully implemented yet (check plan status)

### Photo Events
- [ ] **Photo added event tracked**
  - **Steps:** Upload a photo for a partner
  - **Verify:** `[Photo Added]` event appears
  - **Event Properties to Check:**
    - `user_id`
    - `partner_id`
    - `photo_id`
    - `has_face_descriptor` (boolean)
  - **Note:** Photo tracking may not be fully implemented yet (check plan status)

- [ ] **Photo deleted event tracked**
  - **Steps:** Delete a photo
  - **Verify:** `[Photo Deleted]` event appears
  - **Event Properties to Check:**
    - `user_id`
    - `partner_id`
    - `photo_id`
  - **Note:** Photo deletion tracking may not be fully implemented yet (check plan status)

### Subscription Events
- [ ] **Subscription purchased event tracked**
  - **Steps:** Complete subscription checkout
  - **Verify:** `[Subscription Purchased]` event appears
  - **Event Properties to Check:**
    - `user_id`
    - `subscription_id`
    - `plan_type`
    - `amount` (in cents)
    - `billing_interval` (day/month)
    - `timestamp`
  - **User Properties Updated:** `subscription_status: "active"`, `account_type: "pro"`
  - **Note:** Subscription tracking may not be fully implemented yet (check plan status)

- [ ] **Subscription updated event tracked**
  - **Steps:** Update subscription (e.g., change plan, update payment method)
  - **Verify:** `[Subscription Updated]` event appears
  - **Event Properties to Check:**
    - `user_id`
    - `subscription_id`
    - `plan_type`
    - `amount`
    - `billing_interval`
    - `status`
    - `cancel_at_period_end` (boolean)
  - **User Properties Updated:** `subscription_status`, `account_type` (if status changed)
  - **Note:** Subscription update tracking may not be fully implemented yet (check plan status)

- [ ] **Subscription cancelled event tracked**
  - **Steps:** Cancel subscription
  - **Verify:** `[Subscription Cancelled]` event appears
  - **Event Properties to Check:**
    - `user_id`
    - `subscription_id`
    - `plan_type`
    - `status`
  - **User Properties Updated:** `subscription_status: "canceled"`, `account_type: "pro"` (remains pro until period ends)
  - **Note:** Subscription cancellation tracking may not be fully implemented yet (check plan status)

### Face Detection Events
- [ ] **Face detection event tracked**
  - **Steps:** Upload photo with face detection
  - **Verify:** `[Photo Upload - Face Detection]` event appears
  - **Event Properties to Check:**
    - `user_id`
    - `outcome` ("no_face" / "multiple_faces" / "face_too_small" / "success")
    - `image_width`
    - `image_height`
    - `detection_count`
    - `validation_reasons` (array)
    - `face_size_percentage` (if applicable)
  - **Note:** Face detection tracking may not be fully implemented yet (check plan status)

### Partner Analysis Events
- [ ] **Partner analysis event tracked**
  - **Steps:** Upload photo and trigger partner analysis
  - **Verify:** `[Photo Upload - Partner Analysis]` event appears
  - **Event Properties to Check:**
    - `user_id`
    - `outcome` ("matches_found" / "no_matches" / "same_person_warning" / "other_partners_warning")
    - `partner_id`
    - `match_count`
    - `similarity_scores` (array)
    - `decision_type`
  - **Note:** Partner analysis tracking may not be fully implemented yet (check plan status)

---

## 6. UTM Tracking & Attribution

### Automatic UTM Capture (User Properties)
- [ ] **Initial UTM properties set on first visit**
  - **Steps:** 
    1. Clear cookies/localStorage
    2. Visit page with UTM params: `?utm_source=google&utm_medium=cpc&utm_campaign=test`
    3. Check Amplitude user properties
  - **Verify:** User properties set:
    - `initial_utm_source: "google"`
    - `initial_utm_medium: "cpc"`
    - `initial_utm_campaign: "test"`
  - **Note:** These should be set once and never updated (first-touch attribution)

- [ ] **Session UTM properties update on new sessions**
  - **Steps:** 
    1. Visit page with UTM params in one session
    2. Start new session (new browser session or after timeout)
    3. Visit page with different UTM params
    4. Check Amplitude user properties
  - **Verify:** User properties updated:
    - `utm_source`, `utm_medium`, `utm_campaign` (last-touch attribution)
  - **Note:** These update each session when UTM params are present

- [ ] **UTM properties persist across subdomains**
  - **Steps:** 
    1. Visit landing page subdomain with UTM params
    2. Navigate to main app subdomain
    3. Check Amplitude user properties
  - **Verify:** Same device_id used, UTM properties available
  - **Note:** Device ID sharing via cookies should work automatically

### Manual UTM Tracking (Event Properties)
- [ ] **UTM params included in [Page Viewed] events**
  - **Steps:** Visit page with UTM params in URL
  - **Verify:** `[Page Viewed]` event includes UTM params as event properties
  - **Purpose:** Multi-touch attribution analysis

- [ ] **UTM params normalized (lowercase)**
  - **Steps:** Visit page with UTM params: `?utm_source=GOOGLE&utm_medium=CPC`
  - **Verify:** Event properties show lowercase: `utm_source: "google"`, `utm_medium: "cpc"`

### Server-Side UTM Inheritance
- [ ] **Server events inherit UTM user properties**
  - **Steps:** 
    1. Visit page with UTM params (sets user properties)
    2. Trigger server-side event (e.g., create partner)
    3. Check server event in Amplitude
  - **Verify:** Server event shows UTM data in user properties (not event properties)
  - **Note:** Server events should NOT include UTM params in event properties (inherited automatically)

---

## 7. User Properties

### Account Type Property
- [ ] **Account type set on page view (web)**
  - **Steps:** Log in, navigate to page
  - **Verify:** User property `account_type` is set to "free" or "pro"

- [ ] **Account type set on app open (mobile)**
  - **Steps:** Log in, open app
  - **Verify:** User property `account_type` is set

- [ ] **Account type updated on subscription purchase**
  - **Steps:** Purchase subscription
  - **Verify:** User property `account_type` changes to "pro"

- [ ] **Account type remains "pro" after cancellation (grace period)**
  - **Steps:** Cancel subscription
  - **Verify:** User property `account_type` remains "pro" (not immediately changed to "free")
  - **Note:** Should change to "free" after 7-day grace period

### Subscription Status Property
- [ ] **Subscription status set on purchase**
  - **Steps:** Purchase subscription
  - **Verify:** User property `subscription_status` is set to "active"

- [ ] **Subscription status updated on cancellation**
  - **Steps:** Cancel subscription
  - **Verify:** User property `subscription_status` is set to "canceled"

---

## 8. Session Replay

### Web App Session Replay
- [ ] **Session replay records user interactions**
  - **Steps:** 
    1. Enable session replay in Amplitude dashboard (if available)
    2. Perform actions in web app (click buttons, navigate, fill forms)
    3. Check Amplitude dashboard for session replay
  - **Verify:** Session replay is available in Amplitude dashboard
  - **Note:** Requires Amplitude paid plan

- [ ] **Sensitive fields masked**
  - **Steps:** Fill form with email/password fields
  - **Verify:** Email and password inputs are masked in session replay

### Mobile App Session Replay
- [ ] **Session replay records mobile interactions**
  - **Steps:** 
    1. Perform actions in mobile app
    2. Check Amplitude dashboard for session replay
  - **Verify:** Session replay is available for mobile sessions
  - **Note:** Requires Amplitude paid plan

---

## 9. Abandoned Cart Detection

### Funnel Analysis Setup
- [ ] **Upgrade page visits tracked**
  - **Steps:** Navigate to `/upgrade` page
  - **Verify:** `[Page Viewed]` event with `page_path: "/upgrade"` appears

- [ ] **Subscription purchases tracked**
  - **Steps:** Complete subscription checkout
  - **Verify:** `[Subscription Purchased]` event appears

- [ ] **Abandoned cart funnel works**
  - **Steps:** 
    1. Create funnel in Amplitude dashboard:
       - Start: `[Page Viewed]` where `page_path="/upgrade"`
       - End: `[Subscription Purchased]`
    2. View funnel results
  - **Verify:** Funnel shows users who visited upgrade page but didn't purchase
  - **Note:** No separate abandoned cart event needed - handled via funnel analysis

---

## 10. Cross-Platform User Continuity

### User ID Consistency
- [ ] **Same user_id used across web and mobile**
  - **Steps:** 
    1. Log in on web app (note user_id)
    2. Log in on mobile app with same account
    3. Check Amplitude events
  - **Verify:** Both web and mobile events use same `user_id` (Supabase user ID)

### Device ID Sharing (Subdomains)
- [ ] **Device ID shared across subdomains**
  - **Steps:** 
    1. Visit landing page subdomain (e.g., `lp.dating-management.vercel.app`)
    2. Navigate to main app subdomain (e.g., `app.dating-management.vercel.app`)
    3. Check Amplitude events
  - **Verify:** Same `device_id` used across subdomains
  - **Note:** Should work automatically via cookies with root domain

---

## 11. Error Handling & Resilience

### Analytics Failures Don't Break App
- [ ] **App works when Amplitude API key missing**
  - **Steps:** Remove API key, restart app
  - **Verify:** App functions normally, console shows warning (not error)

- [ ] **App works when Amplitude API is down**
  - **Steps:** Block Amplitude API requests (via network throttling or firewall)
  - **Verify:** App functions normally, analytics calls fail silently

- [ ] **Events queued for retry**
  - **Steps:** 
    1. Block network temporarily
    2. Perform actions that trigger events
    3. Restore network
  - **Verify:** Events are sent after network restored (Amplitude SDK handles queuing)

---

## 12. Performance & Data Quality

### Event Latency
- [ ] **Events appear in Amplitude within reasonable time**
  - **Steps:** Perform action, check Amplitude dashboard
  - **Verify:** Events appear within 1-2 minutes (real-time may require paid plan)

### Event Data Quality
- [ ] **All required event properties present**
  - **Steps:** Review sample events in Amplitude dashboard
  - **Verify:** Events include all expected properties (no missing required fields)

- [ ] **Event property values are correct**
  - **Steps:** Compare event properties with actual user actions
  - **Verify:** Values match what actually happened (e.g., correct page_path, correct button_id)

- [ ] **No duplicate events**
  - **Steps:** Perform single action, check Amplitude
  - **Verify:** Only one event appears for each action

---

## Testing Notes Template

Use this section to document issues, observations, or questions:

### Issue 1: [Title]
- **Date:** [Date]
- **Severity:** [High/Medium/Low]
- **Description:** [What happened]
- **Steps to Reproduce:** [How to reproduce]
- **Expected:** [What should happen]
- **Actual:** [What actually happened]
- **Status:** [Open/Fixed/Deferred]

---

## Quick Reference: Event Names

### Web App Events
- `[Page Viewed]` - Page navigation tracking
- `[Button Clicked]` - Button click tracking
- `[Session Start]` - Automatic session start
- `[Session End]` - Automatic session end

### Mobile App Events
- `[App Open]` - App comes to foreground
- `[Screen Viewed]` - Screen navigation tracking
- `[Button Clicked]` - Button click tracking
- `[Session Start]` - Automatic session start
- `[Session End]` - Automatic session end

### Server-Side Events
- `[User Registered]` - User completes registration
- `[Partner Added]` - Partner created
- `[Partner Deleted]` - Partner deleted
- `[Photo Added]` - Photo uploaded
- `[Photo Deleted]` - Photo deleted
- `[Subscription Purchased]` - Subscription checkout completed
- `[Subscription Updated]` - Subscription updated
- `[Subscription Cancelled]` - Subscription cancelled
- `[Photo Upload - Face Detection]` - Face detection result
- `[Photo Upload - Partner Analysis]` - Partner analysis result

---

## Quick Reference: User Properties

- `account_type` - "free" or "pro"
- `subscription_status` - "active", "canceled", "past_due", "trialing", "incomplete"
- `initial_utm_source` - First-touch UTM source (set once, never updated)
- `initial_utm_medium` - First-touch UTM medium
- `initial_utm_campaign` - First-touch UTM campaign
- `initial_utm_term` - First-touch UTM term
- `initial_utm_content` - First-touch UTM content
- `utm_source` - Last-touch UTM source (updated each session)
- `utm_medium` - Last-touch UTM medium
- `utm_campaign` - Last-touch UTM campaign
- `utm_term` - Last-touch UTM term
- `utm_content` - Last-touch UTM content

---

## How to Verify Events in Amplitude Dashboard

1. **User Lookup:**
   - Go to Amplitude dashboard → **User Lookup**
   - Search by `user_id` (Supabase UUID) or `device_id`
   - View all events for that user/device

2. **Live View (if available):**
   - Go to **Live View** in Amplitude dashboard
   - See events in real-time as they occur

3. **Event Stream:**
   - Go to **Data** → **Event Stream**
   - Filter by event name or user_id
   - View event properties and user properties

4. **User Properties:**
   - In User Lookup, click on user profile
   - View **User Properties** tab
   - Check UTM properties, account_type, subscription_status, etc.

---

## Testing Checklist Status

**Last Updated:** [Date]
**Tested By:** [Name]
**Overall Status:** [ ] Complete [ ] In Progress [ ] Not Started

**Summary:**
- Total Tests: [Number]
- Passed: [Number]
- Failed: [Number]
- Skipped: [Number] (not yet implemented)

