'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Breadcrumbs from '@/components/Breadcrumbs';
import { PhotoUploadWithFaceMatch } from '@/components/PhotoUploadWithFaceMatch';
import { createSupabaseClient } from '@/lib/supabase/client';

export default function UploadPhotoPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [accountType, setAccountType] = useState<string | null>(null);

  // Get account type
  useEffect(() => {
    const fetchAccountType = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('account_type')
          .eq('id', user.id)
          .single();
        setAccountType(userData?.account_type || null);
      }
    };
    fetchAccountType();
  }, [supabase]);

  const handleSuccess = () => {
    // This will be handled by the PhotoUploadWithFaceMatch component
    // which will navigate based on the analysis result
  };

  const handleCancel = () => {
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header accountType={accountType} />
      <Breadcrumbs customItems={[
        { label: 'Upload Photo', href: '/upload-photo' }
      ]} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">Upload Photo</h1>
          <p className="text-gray-600 mb-6">
            Upload a photo to find matching partners or create a new partner.
          </p>
          <PhotoUploadWithFaceMatch
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </main>
    </div>
  );
}

