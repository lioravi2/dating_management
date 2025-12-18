'use client';

import { useState, useEffect, useRef } from 'react';
import { createSupabaseClient } from '@/lib/supabase/client';
import { PartnerPhoto } from '@/shared';
import { PhotoUploadWithFaceMatch } from './PhotoUploadWithFaceMatch';
import { useNavigation } from '@/lib/navigation';
import ConfirmDialog from './ConfirmDialog';

interface PartnerPhotosProps {
  partnerId: string;
}

export default function PartnerPhotos({ partnerId }: PartnerPhotosProps) {
  const navigation = useNavigation();
  const [photos, setPhotos] = useState<PartnerPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; photoId: string | null }>({ open: false, photoId: null });
  const [deleting, setDeleting] = useState(false);
  const supabase = createSupabaseClient();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    loadPhotos();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [partnerId]);

  const loadPhotos = async () => {
    try {
      if (!isMountedRef.current) return;
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('partner_photos')
        .select('*')
        .eq('partner_id', partnerId)
        .order('uploaded_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      if (isMountedRef.current) {
        setPhotos(data || []);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error loading photos:', err);
        setError(err instanceof Error ? err.message : 'Failed to load photos');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleDeleteClick = (photoId: string) => {
    setDeleteConfirm({ open: true, photoId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.photoId || deleting) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/partners/${partnerId}/photos/${deleteConfirm.photoId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete photo');
      }

      // Reload photos - state update will trigger re-render, no need for page reload
      // Removing environment.reload() to prevent hydration mismatch errors
      await loadPhotos();
      
      if (isMountedRef.current) {
        setDeleteConfirm({ open: false, photoId: null });
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error deleting photo:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete photo. Please try again.');
        setTimeout(() => {
          if (isMountedRef.current) {
            setError(null);
          }
        }, 5000);
        setDeleteConfirm({ open: false, photoId: null });
      }
    } finally {
      if (isMountedRef.current) {
        setDeleting(false);
      }
    }
  };

  const getPhotoUrl = (storagePath: string) => {
    const { data } = supabase.storage
      .from('partner-photos')
      .getPublicUrl(storagePath);
    return data.publicUrl;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">Loading photos...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Photos</h2>
        <span className="text-sm text-gray-600">
          {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
        </span>
      </div>

      {/* Upload Section */}
      <div className="mb-6 pb-6 border-b">
        <PhotoUploadWithFaceMatch
          partnerId={partnerId}
          onSuccess={() => {
            // Reload photos - state update will trigger re-render, no need for page reload
            // Removing environment.reload() to prevent hydration mismatch errors
            loadPhotos();
          }}
        />
      </div>

      {/* Photo Gallery */}
      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-800">
          {error}
        </div>
      )}

      {photos.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No photos yet. Upload your first photo above.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <img
                src={getPhotoUrl(photo.storage_path)}
                alt={photo.file_name}
                className="w-full h-48 object-cover rounded-lg border border-gray-200"
              />
              <button
                onClick={() => handleDeleteClick(photo.id)}
                className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded text-xs opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-red-700"
              >
                Delete
              </button>
              <div className="mt-2 text-xs text-gray-500">
                {(() => {
                  // Format date consistently to avoid hydration mismatch
                  // Use a fixed format instead of toLocaleDateString() which can differ between server/client
                  const date = new Date(photo.uploaded_at);
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  return `${month}/${day}/${year}`;
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete Photo"
        message="Are you sure you want to delete this photo?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          if (!deleting) {
            setDeleteConfirm({ open: false, photoId: null });
          }
        }}
        confirmButtonClass="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        loading={deleting}
        loadingLabel="Deleting..."
      />
    </div>
  );
}
