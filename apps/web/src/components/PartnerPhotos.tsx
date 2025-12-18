'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/lib/supabase/client';
import { PartnerPhoto } from '@/shared';
import { PhotoUploadWithFaceMatch } from './PhotoUploadWithFaceMatch';
import { useNavigation } from '@/lib/navigation';
import { environment } from '@/lib/environment';
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

  useEffect(() => {
    loadPhotos();
  }, [partnerId]);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('partner_photos')
        .select('*')
        .eq('partner_id', partnerId)
        .order('uploaded_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setPhotos(data || []);
    } catch (err) {
      console.error('Error loading photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      setLoading(false);
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

      // Reload photos
      await loadPhotos();
      // Note: router.refresh() is Next.js specific, using environment.reload() instead
      environment.reload();
      setDeleteConfirm({ open: false, photoId: null });
    } catch (err) {
      console.error('Error deleting photo:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete photo. Please try again.');
      setTimeout(() => setError(null), 5000);
      setDeleteConfirm({ open: false, photoId: null });
    } finally {
      setDeleting(false);
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
            loadPhotos();
            // Note: router.refresh() is Next.js specific, using environment.reload() instead
      environment.reload();
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
                {new Date(photo.uploaded_at).toLocaleDateString()}
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
