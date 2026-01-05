'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useNavigation } from '@/lib/navigation';
import { track, setUserId, setUserProperties } from '@/lib/analytics/client';
import { extractUtmParamsFromWindow } from '@/lib/analytics/utm-utils';
import { createSupabaseClient } from '@/lib/supabase/client';

/**
 * Client component that tracks page views on route changes
 * - Tracks [Page Viewed] events with page path, referrer, UTM parameters, and user_id
 * - Updates account_type user property when user_id exists
 * - Uses navigation abstraction to get current path
 */
export default function PageViewTracker() {
  const navigation = useNavigation();
  const pathnameRef = useRef<string | null>(null);
  
  // Memoize supabase client to avoid recreating on every render
  const supabase = useMemo(() => createSupabaseClient(), []);

  // Get current pathname from navigation
  const currentPath = navigation.getCurrentPath();

  useEffect(() => {
    // Skip if pathname hasn't changed (initial mount or same path)
    if (pathnameRef.current === currentPath) {
      return;
    }

    // Update ref to track current path
    pathnameRef.current = currentPath;

    // Track page view asynchronously
    const trackPageView = async () => {
      try {
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
  }, [currentPath, supabase]);

  // This component doesn't render anything
  return null;
}

