# Amplitude Experiment Integration Guide

> **Official Documentation:** [Amplitude Experiment Home](https://amplitude.com/docs/experiment-home)  
> **Quick Start:** [Experiment Quick Start Guide](https://amplitude.com/docs/experiment-home)  
> **SDK Documentation:** [Experiment SDKs](https://amplitude.com/docs/experiment-home)

## Overview

This guide covers integrating Amplitude Experiment (feature flags, web experiments, and feature experiments) into the dating app. It integrates with the existing Amplitude Analytics setup and follows the same privacy principles (Supabase user ID only, no PII).

## Architecture

Amplitude Experiment consists of three main features:

1. **Web Experiments** - A/B test UI elements on web pages (client-side only, for pre-authentication pages primarily)
2. **Feature Flags** - Control feature visibility and behavior dynamically without code deployments
3. **Feature Experiments** - A/B test new features with analytics integration

### Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│                  Amplitude Experiment                       │
│  (Web Experiments, Feature Flags, Feature Experiments)      │
└─────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
    ┌────┴────┐         ┌─────┴─────┐      ┌──────┴──────┐
    │   Web   │         │   Server  │      │   Shared    │
    │   App   │         │    API    │      │   Config    │
    └─────────┘         └───────────┘      └─────────────┘
```

## Setup Requirements

### 1. Install Dependencies

**Web App:**
```bash
npm install @amplitude/experiment-browser --save
```

The Experiment SDK works alongside the existing Analytics SDK (`@amplitude/analytics-browser`).

### 2. Environment Variables

**Web App:**
- `NEXT_PUBLIC_AMPLITUDE_API_KEY` - Already configured (same API key used for Analytics)
- `NEXT_PUBLIC_AMPLITUDE_EXPERIMENT_API_KEY` - Optional: Separate Experiment API key (can use same as Analytics)

**Note:** Amplitude Experiment typically uses the same API key as Analytics, but you can configure a separate one if needed.

### 3. SDK Initialization

The Experiment SDK should be initialized alongside the Analytics SDK in `apps/web/src/lib/analytics/client.ts`:

```typescript
import { init, Variant } from '@amplitude/experiment-browser';
import * as amplitude from '@amplitude/analytics-browser';

// Initialize Experiment SDK after Analytics SDK
export function initAmplitudeExperiment() {
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey) return;
  
  // Initialize Experiment SDK
  init(apiKey, {
    // User context (Supabase user ID when authenticated)
    user: {
      user_id: getUserId(), // From Analytics SDK or session
    },
    // Fetch flags/variants on initialization
    initialFlags: true,
  });
}
```

## Use Cases

### Use Case 1: Web Experiments on Sign-In Page

**Goal:** A/B test different UI elements on the sign-in page (pre-authentication)

**Location:** `apps/web/src/app/auth/signin/page.tsx`

**Examples:**
- Button text variations ("Sign In" vs "Get Started")
- Color scheme variations
- Layout variations (button order, spacing)
- Copy variations (headline, descriptions)

**Implementation Pattern:**
```typescript
'use client';

import { useExperiment } from '@/lib/experiment/client';
import { useEffect, useState } from 'react';

export default function SignInPage() {
  const { variant } = useExperiment('sign-in-button-text');
  const [buttonText, setButtonText] = useState('Sign In');
  
  useEffect(() => {
    if (variant?.value) {
      setButtonText(variant.value); // e.g., "Get Started", "Sign In", "Continue"
    }
  }, [variant]);
  
  return (
    <button>
      {buttonText}
    </button>
  );
}
```

**Limitations:**
- Web experiments are client-side only and work best on pre-authentication pages
- For post-authentication pages (like profile page), feature flags are more appropriate

### Use Case 2: Feature Flag - "Add Partner" Button Visibility

**Goal:** Show/hide "Add Partner" button on homepage (dashboard) for different user segments

**Location:** `apps/web/src/app/dashboard/page.tsx`

**Current Implementation:**
- Dashboard shows "Add Partner" quick action card (lines 162-168)
- Always visible to authenticated users

**Feature Flag Name:** `show-add-partner-button` (or similar, configured in Amplitude dashboard)

**Implementation Pattern:**
```typescript
import { getVariant } from '@/lib/experiment/client';

export default async function DashboardPage() {
  const session = await supabase.auth.getSession();
  const userId = session?.data?.session?.user?.id;
  
  // Fetch feature flag variant for this user
  const addPartnerVariant = userId 
    ? await getVariant('show-add-partner-button', userId)
    : { value: false }; // Default: hidden for anonymous
  
  const showAddPartner = addPartnerVariant?.value !== false;
  
  return (
    <div>
      {showAddPartner && (
        <Link href="/partners/new">
          Add Partner
        </Link>
      )}
    </div>
  );
}
```

**Server-Side Fetch:**
For server components, use Amplitude Experiment API or fetch flags server-side before rendering.

**Client-Side Fetch:**
For client components, use the Experiment SDK directly.

### Use Case 3: Feature Flag - Face Detection Thresholds

**Goal:** Configure different face detection thresholds for different user groups

**Location:** `packages/shared/face-quality.ts` and `apps/web/src/app/api/face-detection/detect/route.ts`

**Current Configuration:**
- Default thresholds in `getDefaultConfig()` (lines 48-58):
  - `minPixelSize: 120`
  - `minFaceAreaPercentage: 2.0`
  - `minRelativeSize: 5.0`
  - `minAspectRatio: 0.6`
  - `maxAspectRatio: 1.8`
  - `minLandmarkCoverage: 0.5`
  - `minConfidence: 0.65`

**Feature Flag Name:** `face-detection-thresholds` (or similar)

**Flag Value Format:**
```json
{
  "minPixelSize": 120,
  "minFaceAreaPercentage": 2.0,
  "minRelativeSize": 5.0,
  "minAspectRatio": 0.6,
  "maxAspectRatio": 1.8,
  "minLandmarkCoverage": 0.5,
  "minConfidence": 0.65
}
```

**Implementation Pattern:**
```typescript
import { getVariant } from '@/lib/experiment/client';
import { getDefaultConfig, FaceQualityConfig } from '@/shared/face-quality';

async function getFaceDetectionConfig(userId: string | undefined): Promise<FaceQualityConfig> {
  const defaultConfig = getDefaultConfig();
  
  if (!userId) {
    return defaultConfig;
  }
  
  // Fetch feature flag variant for this user
  const variant = await getVariant('face-detection-thresholds', userId);
  
  if (variant?.value && typeof variant.value === 'object') {
    // Merge flag values with defaults (flag overrides defaults)
    return {
      ...defaultConfig,
      ...variant.value,
    };
  }
  
  return defaultConfig;
}

// In face detection route:
export async function POST(request: NextRequest) {
  const { userId } = await getAuth(request);
  const config = await getFaceDetectionConfig(userId);
  
  // Use config for face quality validation
  const result = validateFaceQuality(metrics, config);
}
```

**User Segmentation:**
- Control group: Default thresholds
- Experiment group A: Stricter thresholds (higher minPixelSize, minConfidence)
- Experiment group B: More lenient thresholds (lower thresholds)

### Use Case 4: Feature Experiment - AI-Generated Photo Detection

**Goal:** A/B test new AI-generated photo detection feature with some users

**Feature Flag Name:** `ai-photo-detection-enabled`

**Implementation Pattern:**
1. **Feature Flag Check:** Determine if user has access to the feature
2. **UI Changes:** Show/hide AI detection UI elements
3. **Backend Logic:** Enable/disable AI detection processing
4. **Analytics Tracking:** Track feature usage and experiment exposure

**Client-Side (UI):**
```typescript
'use client';

import { useExperiment } from '@/lib/experiment/client';

export default function PhotoUploadComponent() {
  const { variant, exposure } = useExperiment('ai-photo-detection-enabled');
  const isEnabled = variant?.value === true;
  
  // Track exposure to experiment
  useEffect(() => {
    if (exposure) {
      // Track experiment exposure event
      track('[Experiment Exposed]', {
        experiment: 'ai-photo-detection-enabled',
        variant: variant?.key || 'control',
      });
    }
  }, [exposure, variant]);
  
  return (
    <div>
      {isEnabled && (
        <div className="ai-detection-banner">
          AI Detection Enabled
        </div>
      )}
      {/* Photo upload UI */}
    </div>
  );
}
```

**Server-Side (API):**
```typescript
import { getVariant } from '@/lib/experiment/server';

export async function POST(request: NextRequest) {
  const { userId } = await getAuth(request);
  
  // Check feature flag
  const variant = await getVariant('ai-photo-detection-enabled', userId);
  const aiDetectionEnabled = variant?.value === true;
  
  if (aiDetectionEnabled) {
    // Run AI detection
    const aiResult = await detectAIGeneratedPhoto(image);
    
    // Track usage
    await track('[AI Photo Detection Used]', userId, {
      detected: aiResult.isAIGenerated,
      confidence: aiResult.confidence,
      experiment_variant: variant?.key || 'control',
    });
    
    return Response.json({
      ...photoData,
      aiDetection: aiResult,
    });
  }
  
  return Response.json(photoData);
}
```

**Analytics Integration:**
- Track exposure to experiment variant
- Track feature usage events
- Analyze conversion rates by variant
- Measure impact on user behavior

## Implementation Architecture

### File Structure

```
apps/web/src/lib/
├── analytics/
│   ├── client.ts              # Analytics SDK (existing)
│   └── server.ts              # Analytics server SDK (existing)
└── experiment/
    ├── client.ts              # Experiment SDK client utilities
    ├── server.ts              # Experiment server utilities (API calls)
    └── hooks.ts               # React hooks for Experiment SDK
```

### Client-Side Utilities (`apps/web/src/lib/experiment/client.ts`)

```typescript
import { Variant, fetch, exposure } from '@amplitude/experiment-browser';
import { getUserId } from '@/lib/analytics/client';

let experimentClient: any = null;

export function initExperiment() {
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  if (!apiKey) return;
  
  experimentClient = init(apiKey, {
    user: {
      user_id: getUserId(), // From Analytics SDK
    },
  });
}

export async function getVariant(flagKey: string, userId?: string): Promise<Variant | undefined> {
  if (!experimentClient) return undefined;
  
  const user = userId ? { user_id: userId } : {};
  const variants = await fetch(experimentClient, user);
  return variants[flagKey];
}

export function useExperiment(flagKey: string) {
  const [variant, setVariant] = useState<Variant | undefined>();
  const [exposed, setExposed] = useState(false);
  
  useEffect(() => {
    getVariant(flagKey).then(v => {
      setVariant(v);
      if (v) {
        exposure(experimentClient, flagKey, v);
        setExposed(true);
      }
    });
  }, [flagKey]);
  
  return { variant, exposure: exposed };
}
```

### Server-Side Utilities (`apps/web/src/lib/experiment/server.ts`)

```typescript
// Use Amplitude Experiment API for server-side flag fetching
// https://amplitude.com/docs/experiment-home (Experiment APIs section)

export async function getVariant(
  flagKey: string,
  userId: string,
  userProperties?: Record<string, any>
): Promise<Variant | undefined> {
  const apiKey = process.env.AMPLITUDE_API_KEY;
  const experimentApiKey = process.env.AMPLITUDE_EXPERIMENT_API_KEY || apiKey;
  
  // Call Amplitude Experiment API
  // See: https://amplitude.com/docs/experiment-home (Experiment APIs)
  const response = await fetch('https://api2.amplitude.com/v1/vardata', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Api-Key ${experimentApiKey}`,
    },
    body: JSON.stringify({
      user_id: userId,
      user_properties: userProperties || {},
      flag_keys: [flagKey],
    }),
  });
  
  const data = await response.json();
  return data.flags?.[flagKey];
}
```

### React Hook (`apps/web/src/lib/experiment/hooks.ts`)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useExperiment as useExperimentClient } from './client';
import { getUserId } from '@/lib/analytics/client';

export function useExperiment(flagKey: string) {
  return useExperimentClient(flagKey);
}

export function useExperimentFlag(flagKey: string, defaultValue: boolean = false) {
  const { variant } = useExperiment(flagKey);
  return variant?.value === true || defaultValue;
}

export function useExperimentValue<T>(flagKey: string, defaultValue: T): T {
  const { variant } = useExperiment(flagKey);
  return variant?.value ?? defaultValue;
}
```

## Privacy and User Identification

**CRITICAL:**
- Use Supabase user ID (same as Analytics) for user identification
- DO NOT send email, full_name, or other PII to Amplitude Experiment
- User properties can include non-PII like `account_type`, `subscription_status`
- User identification happens automatically when user_id is provided

**User Context Example:**
```typescript
{
  user_id: 'supabase-user-id-123',  // From session.user.id
  user_properties: {
    account_type: 'pro',             // Non-PII
    subscription_status: 'active',   // Non-PII
    // DO NOT include: email, full_name, or other PII
  },
}
```

## Integration with Analytics

The Experiment SDK automatically tracks experiment exposure events to Amplitude Analytics when `exposure()` is called. This allows you to:

1. **Analyze experiment impact:** Compare user behavior between variants
2. **Track conversions:** See which variants drive better outcomes
3. **Segment analysis:** Filter analytics by experiment variant

**Exposure Tracking:**
```typescript
import { exposure } from '@amplitude/experiment-browser';

// After fetching variant
const variant = await getVariant('my-experiment');
if (variant) {
  // Track exposure to Amplitude Analytics
  exposure(experimentClient, 'my-experiment', variant);
  
  // This creates an event like:
  // [Experiment Exposed] {
  //   experiment: 'my-experiment',
  //   variant: 'treatment-a',
  //   user_id: 'supabase-user-id'
  // }
}
```

## Best Practices

### 1. Default Values (Fallbacks)

Always provide default values when feature flags fail to load:

```typescript
const showButton = variant?.value === true || false; // Default: false
const thresholds = variant?.value || getDefaultConfig(); // Default: default config
```

### 2. Server-Side Rendering

For server components, fetch flags server-side before rendering to avoid layout shift:

```typescript
// Server component
export default async function DashboardPage() {
  const variant = await getVariant('my-flag', userId);
  return <div>{variant?.value ? <NewUI /> : <OldUI />}</div>;
}
```

### 3. Client-Side Hydration

For client components, use hooks and handle loading states:

```typescript
'use client';

export default function MyComponent() {
  const { variant } = useExperiment('my-flag');
  
  if (!variant) {
    return <LoadingState />; // Or default UI
  }
  
  return variant.value ? <NewUI /> : <OldUI />;
}
```

### 4. Error Handling

Handle cases where Experiment SDK fails gracefully:

```typescript
try {
  const variant = await getVariant('my-flag', userId);
  // Use variant
} catch (error) {
  console.error('Experiment fetch failed:', error);
  // Fall back to default behavior
}
```

### 5. Caching and Performance

- Experiment SDK caches flags/variants locally
- Flags are fetched on initialization and can be refreshed
- For server-side, consider caching flag values with appropriate TTL

## Configuration in Amplitude Dashboard

### Creating Web Experiments

1. Go to Amplitude Dashboard → Experiment → Create Web Experiment
2. Define experiment name, hypothesis, and variants
3. Configure targeting (user properties, segments)
4. Set allocation percentage (e.g., 50% control, 50% treatment)
5. Deploy experiment

### Creating Feature Flags

1. Go to Amplitude Dashboard → Experiment → Flags
2. Create new flag with key (e.g., `show-add-partner-button`)
3. Configure flag values (boolean, string, JSON, etc.)
4. Set targeting rules (segments, user properties)
5. Enable flag and deploy

### Creating Feature Experiments

1. Go to Amplitude Dashboard → Experiment → Create Feature Experiment
2. Configure feature flag (e.g., `ai-photo-detection-enabled`)
3. Define variants (control: disabled, treatment: enabled)
4. Set targeting and allocation
5. Configure success metrics (conversion events)
6. Deploy experiment

## Testing

### Local Testing

1. Set up test user in Amplitude dashboard
2. Assign user to specific variant in dashboard
3. Test locally with user ID
4. Verify variant values are fetched correctly

### Staging Testing

1. Deploy to staging environment
2. Test with real user accounts
3. Verify experiment exposure tracking
4. Check analytics events in Amplitude

## References

- **Official Docs:** [https://amplitude.com/docs/experiment-home](https://amplitude.com/docs/experiment-home)
- **Quick Start:** Experiment Quick Start Guide (linked from main docs)
- **SDK Docs:** Instrument Feature Experiment (linked from main docs)
- **API Docs:** Experiment APIs (linked from main docs)
- **Feature Flags:** Learn about Flags (linked from main docs)
- **Feature Experiment Guide:** Create Feature Experiment (linked from main docs)
- **Web Experiment Guide:** Create Web Experiment (linked from main docs)

## Integration Checklist

- [ ] Install `@amplitude/experiment-browser` package
- [ ] Create `apps/web/src/lib/experiment/client.ts` with Experiment SDK initialization
- [ ] Create `apps/web/src/lib/experiment/server.ts` for server-side flag fetching
- [ ] Create `apps/web/src/lib/experiment/hooks.ts` with React hooks
- [ ] Initialize Experiment SDK alongside Analytics SDK in `apps/web/src/lib/analytics/client.ts`
- [ ] Update sign-in page to use web experiments (if applicable)
- [ ] Update dashboard page to use feature flag for "Add Partner" button
- [ ] Update face detection API to use feature flag for thresholds
- [ ] Implement AI photo detection feature with feature experiment
- [ ] Test feature flags locally and in staging
- [ ] Verify experiment exposure tracking in Amplitude Analytics
- [ ] Document feature flags and experiments in code comments
