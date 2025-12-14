'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Partner } from '@/shared';
import Header from '@/components/Header';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getPartnerProfilePictureUrl } from '@/lib/photo-utils';

export const dynamic = 'force-dynamic';

export default function DeletePartnerPage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params.id as string;
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch user account type
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('account_type')
          .eq('id', user.id)
          .single();
        setAccountType(userData?.account_type || null);
      }

      // Fetch partner
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('id', partnerId)
        .single();

      if (error || !data) {
        router.push('/partners');
        return;
      }

      setPartner(data);
      setLoading(false);
    };

    fetchData();
  }, [partnerId, supabase, router]);

  const handleDelete = async () => {
    if (!partner) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/partners/${partnerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete partner');
      }

      // Redirect to partners list after successful deletion
      router.push('/partners');
    } catch (error) {
      console.error('Error deleting partner:', error);
      alert(`Failed to delete partner: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  const partnerDisplayName = partner
    ? (partner.first_name && partner.last_name
        ? `${partner.first_name} ${partner.last_name}`
        : partner.first_name || partner.last_name || 'Unnamed Partner')
    : 'Partner';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header accountType={accountType} />
      <Breadcrumbs customItems={[
        { label: partnerDisplayName, href: `/partners/${partnerId}` },
        { label: 'Edit', href: `/partners/${partnerId}/edit` },
        { label: 'Delete', href: `/partners/${partnerId}/delete` }
      ]} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4">
          <Link
            href={`/partners/${partnerId}/edit`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <span className="mr-2">←</span>
            Back to Edit
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Delete Partner</h1>
          
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              {partner && (() => {
                const profilePictureUrl = getPartnerProfilePictureUrl(partner);
                return profilePictureUrl ? (
                  <img
                    src={profilePictureUrl}
                    alt={`${partnerDisplayName}'s profile`}
                    className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-400 text-xl">
                      {(partner.first_name?.[0] || partner.last_name?.[0] || '?').toUpperCase()}
                    </span>
                  </div>
                );
              })()}
              <p className="text-gray-700">
                Are you sure you want to delete <strong>{partnerDisplayName}</strong>?
              </p>
            </div>
            <p className="text-gray-600 mb-2">
              This will permanently delete:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 ml-4">
              <li>All photos associated with this partner</li>
              <li>All activities associated with this partner</li>
              <li>The partner record itself</li>
            </ul>
            <p className="text-red-600 font-semibold">
              This action cannot be undone.
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
            >
              {deleting ? 'Deleting...' : 'Yes, Delete Partner'}
            </button>
            <Link
              href={`/partners/${partnerId}/edit`}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-center font-semibold"
            >
              Cancel
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

