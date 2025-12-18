import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Partner, PartnerActivity } from '@/shared';
import PartnerActivities from '@/components/PartnerActivities';
import PartnerPhotos from '@/components/PartnerPhotos';
import Header from '@/components/Header';
import Breadcrumbs from '@/components/Breadcrumbs';
import BlackFlagIcon from '@/components/BlackFlagIcon';

export const dynamic = 'force-dynamic';

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

  const { data: user } = await supabase
    .from('users')
    .select('account_type')
    .eq('id', session.user.id)
    .single();

  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', session.user.id)
    .single();

  if (!partner) {
    redirect('/partners');
  }

  const { data: activities } = await supabase
    .from('partner_notes')
    .select('*')
    .eq('partner_id', params.id)
    .order('start_time', { ascending: false });

  const partnerDisplayName = partner.first_name && partner.last_name
    ? `${partner.first_name} ${partner.last_name}`
    : partner.first_name || partner.last_name || 'Unnamed Partner';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header accountType={user?.account_type} />
      <Breadcrumbs customItems={[
        { label: partnerDisplayName, href: `/partners/${params.id}` }
      ]} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">
                  {partner.first_name || partner.last_name || 'Unnamed Partner'}
                  {partner.first_name && partner.last_name && ` ${partner.last_name}`}
                </h1>
                {partner.black_flag && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-black text-white" title="Black Flag">
                    <BlackFlagIcon className="w-4 h-4" />
                  </span>
                )}
              </div>
              <p className="text-gray-600 mt-2">
                Added {(() => {
                  const date = new Date(partner.created_at);
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  return `${month}/${day}/${year}`;
                })()}
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
                  Updated {(() => {
                    const date = new Date(partner.description_time);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours24 = date.getHours();
                    const hours12 = hours24 % 12 || 12;
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const seconds = String(date.getSeconds()).padStart(2, '0');
                    const ampm = hours24 >= 12 ? 'PM' : 'AM';
                    return `${month}/${day}/${year}, ${String(hours12).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
                  })()}
                </p>
              )}
            </div>
          )}

          {(partner.facebook_profile || partner.x_profile || partner.linkedin_profile || partner.instagram_profile) && (
            <div className="mt-6 pt-6 border-t">
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                Social Media Profiles
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {partner.facebook_profile && (
                  <div>
                    <a
                      href={partner.facebook_profile}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Facebook Profile
                    </a>
                  </div>
                )}
                {partner.x_profile && (
                  <div>
                    <a
                      href={partner.x_profile}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      X (Twitter) Profile
                    </a>
                  </div>
                )}
                {partner.linkedin_profile && (
                  <div>
                    <a
                      href={partner.linkedin_profile}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      LinkedIn Profile
                    </a>
                  </div>
                )}
                {partner.instagram_profile && (
                  <div>
                    <a
                      href={partner.instagram_profile}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Instagram Profile
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <PartnerPhotos partnerId={params.id} />

        <PartnerActivities partnerId={params.id} initialActivities={activities || []} />
      </main>
    </div>
  );
}

