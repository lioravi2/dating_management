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
  const [creating, setCreating] = useState(false);
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

  const handleCreateNewPartner = async () => {
    if (!uploadDataKey || creating) {
      return;
    }

    // Get upload data from sessionStorage
    const uploadDataStr = sessionStorage.getItem(uploadDataKey);
    if (!uploadDataStr) {
      console.error('Upload data not found in sessionStorage');
      return;
    }

    try {
      setCreating(true);
      const uploadData = JSON.parse(uploadDataStr);
      const { fileBase64, faceDescriptor, width, height } = uploadData;

      // Convert base64 back to File
      const base64Data = fileBase64.split(',')[1] || fileBase64;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      if (faceDescriptor) {
        formData.append('faceDescriptor', JSON.stringify(faceDescriptor));
      }
      if (width) formData.append('width', width.toString());
      if (height) formData.append('height', height.toString());

      // Create partner with photo via API
      const response = await fetch('/api/partners/create-with-photo', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error creating partner:', result.error);
        alert(result.message || result.error || 'Failed to create partner');
        setCreating(false);
        return;
      }

      // Clean up sessionStorage
      sessionStorage.removeItem(uploadDataKey);
      if (imageKey) {
        sessionStorage.removeItem(imageKey);
      }

      // Redirect to partner page (not edit mode)
      router.push(`/partners/${result.partner.id}`);
    } catch (error) {
      console.error('Error creating partner:', error);
      alert('Failed to create partner. Please try again.');
    } finally {
      setCreating(false);
    }
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
              disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {creating && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {creating ? 'Creating...' : 'Create New Partner'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

