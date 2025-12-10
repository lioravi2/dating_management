import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Partner, PartnerNote } from '@/shared';
import PartnerNotes from '@/components/PartnerNotes';

export default async function PartnerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerComponentClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/auth/signin');
  }

  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', session.user.id)
    .single();

  if (!partner) {
    redirect('/partners');
  }

  const { data: notes } = await supabase
    .from('partner_notes')
    .select('*')
    .eq('partner_id', params.id)
    .order('start_time', { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-2xl mr-2">
                🎭
              </Link>
              <Link href="/dashboard" className="text-xl font-semibold">
                Dating Assistant
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/partners"
                className="text-gray-700 hover:text-gray-900"
              >
                Partners
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold">
                {partner.first_name} {partner.last_name || ''}
              </h1>
              <p className="text-gray-600 mt-2">
                Added {new Date(partner.created_at).toLocaleDateString()}
              </p>
            </div>
            <Link
              href={`/partners/${params.id}/edit`}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Edit
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {partner.email && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <p className="text-gray-900">{partner.email}</p>
              </div>
            )}
            {partner.phone_number && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Phone
                </label>
                <p className="text-gray-900">{partner.phone_number}</p>
              </div>
            )}
          </div>

          {partner.description && (
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700">
                Description
              </label>
              <p className="text-gray-900 mt-1">{partner.description}</p>
              {partner.description_time && (
                <p className="text-xs text-gray-500 mt-1">
                  Updated {new Date(partner.description_time).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>

        <PartnerNotes partnerId={params.id} initialNotes={notes || []} />
      </main>
    </div>
  );
}

