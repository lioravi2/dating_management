'use client';

import { useEffect, useState, useMemo } from 'react';
import { NavigationLink } from '@/lib/navigation';
import { getVariant, setUserId as setExperimentUserId } from '@/lib/experiment/client';
import { createSupabaseClient } from '@/lib/supabase/client';

/**
 * Client component for "Add Partner" button with feature flag support
 * Uses client-side Experiment SDK to fetch variant
 */
export default function AddPartnerButton() {
  const [variant, setVariant] = useState<{ key: string; value: any } | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createSupabaseClient(), []);

  useEffect(() => {
    let mounted = true;

    async function fetchVariant() {
      try {
        setLoading(true);

        // Get user ID from session
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        if (userId) {
          // Set user ID in Experiment SDK for proper targeting
          setExperimentUserId(userId);

          // Fetch variant with user ID
          const result = await getVariant(
            'showing-not-showing-the-add-partner-button-in-the-homepage',
            userId
          );

          if (mounted) {
            setVariant(result);
          }
        } else {
          // No user ID - default to showing button
          if (mounted) {
            setVariant(undefined);
          }
        }
      } catch (error) {
        console.error('Failed to fetch variant:', error);
        if (mounted) {
          setVariant(undefined);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchVariant();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  // Handle variants: 'on' = show button, 'hiding_add_partner_button' = hide button
  // Default to showing button if flag fails to load (fallback to current behavior)
  const showButton = variant?.value === 'on' || 
    (variant === undefined && !loading); // Show by default if variant is undefined and not loading

  if (!showButton) {
    return null;
  }

  return (
    <NavigationLink
      href="/partners/new"
      className="bg-green-50 border-2 border-green-200 rounded-lg p-4 hover:bg-green-100 transition-colors"
    >
      <h2 className="font-semibold text-lg mb-2">Add Partner</h2>
      <p className="text-sm text-gray-600">Add a new partner</p>
    </NavigationLink>
  );
}
