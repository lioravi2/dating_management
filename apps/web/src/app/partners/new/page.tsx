'use client';

import { useState, useEffect } from 'react';
import { useNavigation } from '@/lib/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { NavigationLink } from '@/lib/navigation';
import Header from '@/components/Header';
import Breadcrumbs from '@/components/Breadcrumbs';
import PartnerForm from '@/components/PartnerForm';
import { FREE_TIER_PARTNER_LIMIT } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default function NewPartnerPage() {
  const navigation = useNavigation();
  const supabase = createSupabaseClient();
  const [accountType, setAccountType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [limitReached, setLimitReached] = useState(false);
  const [partnerCount, setPartnerCount] = useState<number | null>(null);

  useEffect(() => {
    const checkLimit = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('account_type')
            .eq('id', user.id)
            .single();
          setAccountType(userData?.account_type || null);

          // Check partner limit for free users before showing form
          if (userData?.account_type === 'free') {
            const { count, error: countError } = await supabase
              .from('partners')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id);

            if (!countError && count !== null) {
              setPartnerCount(count);
              if (count >= FREE_TIER_PARTNER_LIMIT) {
                setLimitReached(true);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking partner limit:', error);
        // On error, allow user to proceed (fail open)
        // They'll get an error from the API if limit is actually reached
      } finally {
        setLoading(false);
      }
    };
    checkLimit();
  }, [supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header accountType={accountType} />
        <Breadcrumbs customItems={[
          { label: 'Add New Partner', href: '/partners/new' }
        ]} />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p>Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  if (limitReached) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header accountType={accountType} />
        <Breadcrumbs customItems={[
          { label: 'Add New Partner', href: '/partners/new' }
        ]} />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold mb-6">Add New Partner</h1>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-yellow-800 font-semibold mb-2">
                Partner Limit Reached
              </p>
              <p className="text-yellow-700 text-sm mb-4">
                {partnerCount !== null && partnerCount >= FREE_TIER_PARTNER_LIMIT
                  ? partnerCount > FREE_TIER_PARTNER_LIMIT
                    ? `To add more partners, please upgrade to Pro.`
                    : `Your free subscription is limited to ${FREE_TIER_PARTNER_LIMIT} partners. You currently have ${partnerCount} partners.`
                  : `Your free subscription is limited to ${FREE_TIER_PARTNER_LIMIT} partners.`}
              </p>
              <NavigationLink
                href="/upgrade"
                className="inline-block bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
              >
                Upgrade to Pro
              </NavigationLink>
            </div>
            <NavigationLink
              href="/partners"
              className="text-primary-600 hover:text-primary-700"
            >
              ← Back to Partners
            </NavigationLink>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header accountType={accountType} />
      <Breadcrumbs customItems={[
        { label: 'Add New Partner', href: '/partners/new' }
      ]} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">Add New Partner</h1>
          <PartnerForm />
        </div>
      </main>
    </div>
  );
}

