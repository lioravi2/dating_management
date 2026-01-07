'use client';

import { useCallback } from 'react';
import { useNavigation } from '@/lib/navigation';
import { track, isAmplitudeInitialized } from '@/lib/analytics/client';
import { createSupabaseClient } from '@/lib/supabase/client';

/**
 * Custom hook for tracking button clicks
 * Tracks [Button Clicked] events with button identifier, location, and context
 * Includes user_id when authenticated (automatically via SDK)
 * NO UTM parameters needed (inherited from user properties automatically)
 * 
 * @returns Function to track button clicks
 */
export function useTrackClick() {
  const navigation = useNavigation();
  const supabase = createSupabaseClient();

  const trackClick = useCallback(
    async (
      buttonId: string,
      buttonText?: string,
      context?: Record<string, any>
    ) => {
      try {
        // Don't track if Amplitude isn't initialized
        if (!isAmplitudeInitialized()) {
          console.warn('[useTrackClick] Amplitude not initialized, skipping button click tracking');
          return;
        }

        // Get current page path
        const pagePath = navigation.getCurrentPath();

        // Get user ID if authenticated (optional - SDK should include it automatically)
        let userId: string | undefined;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id;
        } catch (error) {
          // Silently fail - user_id will be included automatically by SDK if set
          console.debug('[useTrackClick] Could not get user ID:', error);
        }

        // Build event properties
        const eventProperties: Record<string, any> = {
          button_id: buttonId,
          ...(buttonText && { button_text: buttonText }),
          page_path: pagePath,
          ...(context && context),
          // Include user_id when authenticated (SDK should include this automatically, but include for clarity)
          ...(userId && { user_id: userId }),
        };

        // Track button click event
        track('[Button Clicked]', eventProperties);
      } catch (error) {
        // Log error but don't break application flow
        console.error('[useTrackClick] Failed to track button click:', error);
      }
    },
    [navigation, supabase]
  );

  return trackClick;
}


