import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Partner } from '@/shared';
import Header from '@/components/Header';
import Breadcrumbs from '@/components/Breadcrumbs';
import PartnerCard from '@/components/PartnerCard';

export const dynamic = 'force-dynamic';

export default async function PartnersPage() {
  const supabase = createSupabaseServerComponentClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/auth/signin');
  }

  const { data: user } = await supabase
    .from('users')
    .select('account_type')
    .eq('id', session.user.id)
    .single();

  const { data: partners, error: partnersError } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (partnersError) {
    console.error('Error fetching partners:', partnersError);
  }

  // Fetch last activity description for each partner (if partner has no description)
  const partnerIds = partners?.map(p => p.id) || [];
  const lastActivities: { [key: string]: string | null } = {};
  
  if (partnerIds.length > 0) {
    // Get the most recent activity for each partner
    const { data: activities } = await supabase
      .from('partner_notes')
      .select('partner_id, description')
      .in('partner_id', partnerIds)
      .order('start_time', { ascending: false });
    
    // Group by partner_id and get the first (most recent) activity description
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Partners</h1>
          <Link
            href="/partners/new"
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Add Partner
          </Link>
        </div>

        {partnersError && (
          <div className="bg-red-50 text-red-800 p-4 rounded-lg mb-4">
            <p className="font-semibold">Error loading partners:</p>
            <p className="text-sm">{partnersError.message}</p>
          </div>
        )}
        
        {partners && partners.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {partners.map((partner: Partner) => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                lastActivityDescription={lastActivities[partner.id]}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">No partners yet.</p>
            <Link
              href="/partners/new"
              className="inline-block bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Add Your First Partner
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

