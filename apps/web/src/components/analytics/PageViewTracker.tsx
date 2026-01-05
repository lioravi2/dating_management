'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import { useNavigation } from '@/lib/navigation';
import { track, setUserId, setUserProperties, isAmplitudeInitialized } from '@/lib/analytics/client';
import { extractUtmParamsFromWindow } from '@/lib/analytics/utm-utils';
import { createSupabaseClient } from '@/lib/supabase/client';

/**
 * Client component that tracks page views on route changes
 * - Tracks [Page Viewed] events with page path, referrer, UTM parameters, and user_id
 * - Updates account_type user property when user_id exists
 * - Uses navigation abstraction to get current path
 * - Waits for Amplitude initialization before tracking to prevent race conditions
 */
export default function PageViewTracker() {
  const navigation = useNavigation();
  const pathnameRef = useRef<string | null>(null);
  const [amplitudeReady, setAmplitudeReady] = useState(false);
  
  // Memoize supabase client to avoid recreating on every render
  const supabase = useMemo(() => createSupabaseClient(), []);

  // Get current pathname from navigation
  const currentPath = navigation.getCurrentPath();

  // Wait for Amplitude to be initialized
  useEffect(() => {
    // Check immediately
    if (isAmplitudeInitialized()) {
      setAmplitudeReady(true);
      return;
    }

    // Poll for initialization (check every 50ms for up to 5 seconds)
    let attempts = 0;
    const maxAttempts = 100; // 5 seconds max wait (100 * 50ms)
    
    const checkAmplitude = () => {
      if (isAmplitudeInitialized()) {
        setAmplitudeReady(true);
        return;
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(checkAmplitude, 50);
      } else {
        console.warn('[PageViewTracker] Amplitude not initialized after 5 seconds - page views may not be tracked');
      }
    };
    
    // Start checking after a small delay to allow AmplitudeInit to run
    const timeoutId = setTimeout(checkAmplitude, 50);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    // Don't track if Amplitude isn't ready yet
    if (!amplitudeReady) {
      return;
    }

    // Skip if pathname hasn't changed (initial mount or same path)
    if (pathnameRef.current === currentPath) {
      return;
    }

    // Update ref to track current path
    pathnameRef.current = currentPath;

    // Track page view asynchronously
    const trackPageView = async () => {
      try {
        // Double-check Amplitude is initialized before tracking
        if (!isAmplitudeInitialized()) {
          console.warn('[PageViewTracker] Amplitude not initialized, skipping page view tracking');
          return;
        }

        // Get current session and user
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        // Set user ID in Amplitude if authenticated
        if (userId) {
          setUserId(userId);

          // Fetch account_type from users table
          const { data: userData } = await supabase
            .from('users')
            .select('account_type')
            .eq('id', userId)
            .single();

          // Update account_type user property if user data exists
          if (userData?.account_type) {
            setUserProperties({
              account_type: userData.account_type,
            });
          }
        } else {
          // Clear user ID if not authenticated
          setUserId(undefined);
        }

        // Extract UTM parameters from current URL
        const utmParams = extractUtmParamsFromWindow();

        // Get page title and referrer
        const pageTitle = typeof document !== 'undefined' ? document.title : undefined;
        const referrer = typeof document !== 'undefined' ? document.referrer : undefined;

        // Build event properties
        const eventProperties: Record<string, any> = {
          page_path: currentPath,
          ...(pageTitle && { page_title: pageTitle }),
          ...(referrer && { referrer }),
          // Include UTM parameters as event properties (for multi-touch attribution)
          ...(utmParams.utm_source && { utm_source: utmParams.utm_source }),
          ...(utmParams.utm_medium && { utm_medium: utmParams.utm_medium }),
          ...(utmParams.utm_campaign && { utm_campaign: utmParams.utm_campaign }),
          ...(utmParams.utm_term && { utm_term: utmParams.utm_term }),
          ...(utmParams.utm_content && { utm_content: utmParams.utm_content }),
          // Include user_id when authenticated (SDK should include this automatically, but include for clarity)
          ...(userId && { user_id: userId }),
        };

        // Track page view event
        track('[Page Viewed]', eventProperties);
      } catch (error) {
        // Log error but don't break application flow
        console.error('Failed to track page view:', error);
      }
    };

    // Small delay to ensure page is fully loaded
    const timeoutId = setTimeout(trackPageView, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [currentPath, supabase, amplitudeReady]);

  // This component doesn't render anything
  return null;
}

