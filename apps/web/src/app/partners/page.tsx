import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Partner } from '@/shared';
import Header from '@/components/Header';
import Breadcrumbs from '@/components/Breadcrumbs';

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

  const { data: partners } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

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

        {partners && partners.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {partners.map((partner: Partner) => (
              <Link
                key={partner.id}
                href={`/partners/${partner.id}`}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
              >
                <h2 className="text-xl font-semibold mb-2">
                  {partner.first_name || partner.last_name || partner.internal_id || 'Unnamed Partner'}
                  {partner.first_name && partner.last_name && ` ${partner.last_name}`}
                </h2>
                {partner.email && (
                  <p className="text-sm text-gray-600 mb-1">{partner.email}</p>
                )}
                {partner.phone_number && (
                  <p className="text-sm text-gray-600 mb-1">
                    {partner.phone_number}
                  </p>
                )}
                {partner.description && (
                  <p className="text-sm text-gray-700 mt-3 line-clamp-2">
                    {partner.description}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-4">
                  Added {new Date(partner.created_at).toLocaleDateString()}
                </p>
              </Link>
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

