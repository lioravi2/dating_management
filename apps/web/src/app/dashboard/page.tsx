import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import Header from '@/components/Header';
import PartnerCard from '@/components/PartnerCard';
import { Partner } from '@/shared';
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

  // Get user profile and subscription
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

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
  const { data: recentPartners } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false })
    .limit(3);

  // Fetch last activity descriptions for partners without descriptions
  const partnerIds = recentPartners?.map(p => p.id) || [];
  const lastActivities: { [key: string]: string | null } = {};
  
  if (partnerIds.length > 0) {
    const { data: activities } = await supabase
      .from('partner_notes')
      .select('partner_id, description')
      .in('partner_id', partnerIds)
      .order('start_time', { ascending: false });
    
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
            <Link
              href="/partners/new"
              className="bg-green-50 border-2 border-green-200 rounded-lg p-4 hover:bg-green-100 transition-colors"
            >
              <h2 className="font-semibold text-lg mb-2">Add Partner</h2>
              <p className="text-sm text-gray-600">Add a new partner</p>
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
}



