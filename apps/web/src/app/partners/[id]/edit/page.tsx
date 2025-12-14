'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Partner } from '@/shared';
import Header from '@/components/Header';
import Breadcrumbs from '@/components/Breadcrumbs';
import PartnerForm from '@/components/PartnerForm';

export const dynamic = 'force-dynamic';

export default function EditPartnerPage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params.id as string;
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [deleting, setDeleting] = useState(false);

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

    const partnerName = partner.first_name || partner.last_name || 'this partner';
    const confirmMessage = `Are you sure you want to delete ${partnerName}? This will permanently delete all photos and activities associated with this partner. This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

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
        { label: 'Edit', href: `/partners/${partnerId}/edit` }
      ]} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4">
          <Link
            href={`/partners/${partnerId}`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <span className="mr-2">←</span>
            Back to Partner
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Edit Partner</h1>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting...' : 'Delete Partner'}
            </button>
          </div>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <PartnerForm partner={partner} />
          )}
        </div>
      </main>
    </div>
  );
}

