import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import Header from '@/components/Header';
import PartnerCard from '@/components/PartnerCard';
import AddPartnerButton from '@/components/dashboard/AddPartnerButton';
import { Partner, PARTNER_SORT_ORDER } from '@/shared';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createSupabaseServerComponentClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/auth/signin');
  }

  try {
    // Get user profile and subscription
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      // Continue with null user - will show fallback UI
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (subscriptionError) {
      console.error('Error fetching subscription:', subscriptionError);
      // Continue without subscription
    }

    // Check if subscription has expired and update user account type if needed
    if (subscription && user?.account_type === 'pro') {
      const now = new Date();
      const periodEnd = subscription.current_period_end 
        ? new Date(subscription.current_period_end)
        : null;

      // If subscription is canceled at period end and period has passed, set user to free
      if (
        subscription.cancel_at_period_end &&
        periodEnd &&
        now >= periodEnd
      ) {
        const supabaseAdmin = createSupabaseAdminClient();
        await supabaseAdmin
          .from('users')
          .update({ account_type: 'free' })
          .eq('id', session.user.id);
        
        // Refresh user data
        const { data: updatedUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (updatedUser) {
          user.account_type = updatedUser.account_type;
        }
      }
    }

    // Fetch recent partners (3 most recently updated)
    const { data: recentPartners, error: partnersError } = await supabase
      .from('partners')
      .select('*')
      .eq('user_id', session.user.id)
      .order(PARTNER_SORT_ORDER.field, { ascending: PARTNER_SORT_ORDER.ascending })
      .limit(3);

    if (partnersError) {
      console.error('Error fetching partners:', partnersError);
    }

    // Fetch last activity descriptions for partners without descriptions
    const partnerIds = recentPartners?.map(p => p.id) || [];
    const lastActivities: { [key: string]: string | null } = {};
    
    if (partnerIds.length > 0) {
      const { data: activities, error: activitiesError } = await supabase
        .from('partner_notes')
        .select('partner_id, description')
        .in('partner_id', partnerIds)
        .order('start_time', { ascending: false });
      
      if (activitiesError) {
        console.error('Error fetching activities:', activitiesError);
      }
      
      if (activities) {
        activities.forEach((activity) => {
          if (activity.description && !lastActivities[activity.partner_id]) {
            lastActivities[activity.partner_id] = activity.description;
          }
        });
      }
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <Header accountType={user?.account_type} />

        <Breadcrumbs />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h1 className="text-3xl font-bold mb-2">
              Welcome{user?.full_name ? `, ${user.full_name}` : ' back'}! 👋
            </h1>
            <p className="text-gray-600">
              Here's your dashboard overview
            </p>
          </div>

          {recentPartners && recentPartners.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Recent Partners</h2>
                <Link
                  href="/partners"
                  className="text-primary-600 hover:text-primary-800 font-medium"
                >
                  View all partners →
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recentPartners.map((partner: Partner) => (
                  <PartnerCard
                    key={partner.id}
                    partner={partner}
                    lastActivityDescription={lastActivities[partner.id]}
                    showDelete={false}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AddPartnerButton />
              <Link
                href="/upload-photo"
                className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 hover:bg-purple-100 transition-colors"
              >
                <h2 className="font-semibold text-lg mb-2">Upload Photo</h2>
                <p className="text-sm text-gray-600">Upload a photo to find or create a partner</p>
              </Link>
              {user?.account_type === 'pro' && (
                <Link
                  href="/billing"
                  className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors"
                >
                  <h2 className="font-semibold text-lg mb-2">Billing</h2>
                  <p className="text-sm text-gray-600">Manage subscription</p>
                </Link>
              )}
              {(!user?.account_type || user.account_type === 'free') && (
                <Link
                  href="/upgrade"
                  className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 hover:bg-yellow-100 transition-colors"
                >
                  <h2 className="font-semibold text-lg mb-2">Upgrade to Pro</h2>
                  <p className="text-sm text-gray-600">Unlock premium features</p>
                </Link>
              )}
            </div>
          </div>
        </main>
    </div>
    );
  } catch (error) {
    console.error('Dashboard error:', error);
    return (
      <div className="min-h-screen bg-gray-50">
        <Header accountType={null} />
        <Breadcrumbs />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-red-800 mb-2">Error Loading Dashboard</h1>
            <p className="text-red-600">
              {error instanceof Error ? error.message : 'An unexpected error occurred. Please try refreshing the page.'}
            </p>
          </div>
        </main>
      </div>
    );
  }
}

