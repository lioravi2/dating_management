'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Header from '@/components/Header';
import Breadcrumbs from '@/components/Breadcrumbs';

export default function NoMatchesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseClient();
  const [accountType, setAccountType] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const imageKey = searchParams.get('imageKey');
  const uploadDataKey = searchParams.get('uploadDataKey');

  useEffect(() => {
    // Get account type
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

    // Load image from sessionStorage
    if (imageKey) {
      const storedImage = sessionStorage.getItem(imageKey);
      if (storedImage) {
        setImageUrl(storedImage);
      }
      // Clean up old sessionStorage entries
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('upload-photo-image-') && key !== imageKey) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }, [imageKey, supabase]);

  const handleCreateNewPartner = () => {
    // Store upload data key in sessionStorage so the partner form can access it
    if (uploadDataKey) {
      sessionStorage.setItem('pendingPhotoUpload', uploadDataKey);
    }
    router.push('/partners/new?fromPhotoUpload=true');
  };

  const handleCancel = () => {
    // Clean up sessionStorage
    if (imageKey) {
      sessionStorage.removeItem(imageKey);
    }
    if (uploadDataKey) {
      sessionStorage.removeItem(uploadDataKey);
    }
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header accountType={accountType} />
      <Breadcrumbs customItems={[
        { label: 'Upload Photo', href: '/upload-photo' },
        { label: 'No Matches', href: '/upload-photo/no-matches' }
      ]} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Uploaded photo"
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover flex-shrink-0 border-2 border-gray-300"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 border-2 border-gray-300">
                <span className="text-gray-400 text-xs">No preview</span>
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold mb-1">No Matching Partners Found</h1>
              <p className="text-sm sm:text-base text-gray-600">
                This photo doesn't match any existing partners. Create a new partner to upload this photo.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-end pt-4 border-t">
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 w-full sm:w-auto"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateNewPartner}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full sm:w-auto"
            >
              Create New Partner
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

