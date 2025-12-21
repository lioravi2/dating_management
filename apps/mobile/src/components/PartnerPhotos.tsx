import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase/client';
import { PartnerPhoto } from '@dating-app/shared';
import { getPhotoUrl } from '../lib/photo-utils';

interface PartnerPhotosProps {
  partnerId: string;
  onPhotoUploaded?: () => void;
}

export default function PartnerPhotos({ partnerId, onPhotoUploaded }: PartnerPhotosProps) {
  const [photos, setPhotos] = useState<PartnerPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    loadPhotos(partnerId);
    
    return () => {
      isMountedRef.current = false;
    };
  }, [partnerId]);

  const loadPhotos = async (requestedPartnerId: string) => {
    try {
      if (!isMountedRef.current) return;
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('partner_photos')
        .select('*')
        .eq('partner_id', requestedPartnerId)
        .order('uploaded_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // Verify that the partnerId hasn't changed while the request was in flight
      // Only update state if this is still the current partner
      if (isMountedRef.current && requestedPartnerId === partnerId) {
        setPhotos(data || []);
      }
    } catch (err) {
      // Only update error state if this is still the current partner
      if (isMountedRef.current && requestedPartnerId === partnerId) {
        console.error('Error loading photos:', err);
        setError(err instanceof Error ? err.message : 'Failed to load photos');
      }
    } finally {
      // Only update loading state if this is still the current partner
      if (isMountedRef.current && requestedPartnerId === partnerId) {
        setLoading(false);
      }
    }
  };

  const requestImagePickerPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera roll permissions to upload photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const handleUploadPhoto = async () => {
    const hasPermission = await requestImagePickerPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Disable editing to avoid confusion - user can select photo directly
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      setUploading(true);
      setError(null);

      // Create FormData for React Native
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'photo.jpg',
      } as any);
      if (asset.width) {
        formData.append('width', asset.width.toString());
      }
      if (asset.height) {
        formData.append('height', asset.height.toString());
      }

      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Upload to API
      // Use EXPO_PUBLIC_WEB_APP_URL if available, otherwise fallback to localhost
      const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      
      console.log('[PartnerPhotos] Uploading to:', `${apiUrl}/api/partners/${partnerId}/photos`);
      
      const uploadResponse = await fetch(`${apiUrl}/api/partners/${partnerId}/photos`, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          // Don't set Content-Type, let fetch set it with boundary for FormData
        },
      });

      console.log('[PartnerPhotos] Upload response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[PartnerPhotos] Upload error:', errorData);
        throw new Error(errorData.error || errorData.details || `Failed to upload photo (${uploadResponse.status})`);
      }

      // Reload photos
      await loadPhotos(partnerId);
      onPhotoUploaded?.();
    } catch (err) {
      console.error('Error uploading photo:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to upload photo');
        Alert.alert('Upload Error', err instanceof Error ? err.message : 'Failed to upload photo');
      }
    } finally {
      if (isMountedRef.current) {
        setUploading(false);
      }
    }
  };

  const handleDeleteClick = (photoId: string) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteConfirm(photoId),
        },
      ]
    );
  };

  const handleDeleteConfirm = async (photoId: string) => {
    if (deleting) return;

    try {
      setDeleting(photoId);
      setError(null);

      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Use EXPO_PUBLIC_WEB_APP_URL if available, otherwise fallback to localhost
      const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/partners/${partnerId}/photos/${photoId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Failed to delete photo');
      }

      // Reload photos
      await loadPhotos(partnerId);
      onPhotoUploaded?.();
    } catch (err) {
      console.error('Error deleting photo:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to delete photo');
        Alert.alert('Delete Error', err instanceof Error ? err.message : 'Failed to delete photo');
      }
    } finally {
      if (isMountedRef.current) {
        setDeleting(null);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Photos</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#dc2626" />
          <Text style={styles.loadingText}>Loading photos...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Photos</Text>
        <Text style={styles.count}>
          {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
        </Text>
      </View>

      {/* Upload Button */}
      <TouchableOpacity
        style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
        onPress={handleUploadPhoto}
        disabled={uploading}
      >
        {uploading ? (
          <>
            <ActivityIndicator size="small" color="#fff" style={styles.uploadSpinner} />
            <Text style={styles.uploadButtonText}>Uploading...</Text>
          </>
        ) : (
          <Text style={styles.uploadButtonText}>+ Upload Photo</Text>
        )}
      </TouchableOpacity>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Photo Gallery */}
      {photos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No photos yet. Upload your first photo above.</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.gallery}
          renderItem={({ item }) => {
            const photoUrl = getPhotoUrl(item.storage_path, supabaseUrl);
            const isDeleting = deleting === item.id;

            return (
              <View style={styles.photoContainer}>
                <Image
                  source={{ uri: photoUrl }}
                  style={styles.photo}
                  resizeMode="cover"
                />
                {isDeleting ? (
                  <View style={styles.deleteOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteClick(item.id)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                )}
                <Text style={styles.photoDate}>{formatDate(item.uploaded_at)}</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  count: {
    fontSize: 14,
    color: '#6b7280',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 8,
    color: '#6b7280',
    fontSize: 14,
  },
  uploadButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadSpinner: {
    marginRight: 8,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
  },
  gallery: {
    paddingTop: 8,
  },
  photoContainer: {
    flex: 1,
    margin: 4,
    position: 'relative',
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
});

