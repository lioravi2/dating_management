'use client';

import { useEffect } from 'react';
import { extractUtmParamsFromWindow } from '@/lib/analytics/utm-utils';
import { storeAttributionData } from '@/lib/attribution';

/**
 * AttributionTracker component
 * Tracks landing page visits and stores attribution data for app install tracking
 * 
 * This component should be added to the landing page to automatically capture
 * UTM parameters and store them for attribution when the user installs the app.
 */
export default function AttributionTracker() {
  useEffect(() => {
    // Only track on client-side
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // Extract UTM parameters from current URL
      const utmParams = extractUtmParamsFromWindow();
      
      // Get referrer
      const referrer = document.referrer || undefined;

      // Store attribution data if we have UTM parameters or a referrer
      // This ensures we capture attribution even if user doesn't have UTM params
      if (Object.keys(utmParams).length > 0 || referrer) {
        storeAttributionData(utmParams, referrer);
      }
    } catch (error) {
      console.error('Failed to track attribution:', error);
    }
  }, []);

  // This component doesn't render anything
  return null;
}


