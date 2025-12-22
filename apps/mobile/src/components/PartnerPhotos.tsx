import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../lib/supabase/client';
import { PartnerPhoto, PhotoUploadAnalysis, FaceMatch } from '@dating-app/shared';
import { getPhotoUrl } from '../lib/photo-utils';
import PhotoUploadProgressModal, { UploadStep } from './PhotoUploadProgressModal';
import FaceSelectionModal from './FaceSelectionModal';
import NoFaceDetectedModal from './NoFaceDetectedModal';
import SamePersonWarningModal from './SamePersonWarningModal';
import DifferentPartnerWarningModal from './DifferentPartnerWarningModal';

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

  // Progress and modal states
  const [uploadProgress, setUploadProgress] = useState<UploadStep>('preparing');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showFaceSelectionModal, setShowFaceSelectionModal] = useState(false);
  const [showNoFaceModal, setShowNoFaceModal] = useState(false);
  const [showSamePersonModal, setShowSamePersonModal] = useState(false);
  const [showDifferentPartnerModal, setShowDifferentPartnerModal] = useState(false);
  
  // Face detection data
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [faceDetections, setFaceDetections] = useState<any[]>([]);
  const [selectedFaceDescriptor, setSelectedFaceDescriptor] = useState<number[] | null>(null);
  const [analysisData, setAnalysisData] = useState<PhotoUploadAnalysis | null>(null);
  
  // Upload data (stored for "upload anyway" scenarios)
  const uploadDataRef = useRef<{
    optimizedUri: string;
    width: number;
    height: number;
    mimeType: string;
    fileName: string;
  } | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    loadPhotos(partnerId);
    
    return () => {
      isMountedRef.current = false;
    };
  }, [partnerId]);

  const loadPhotos = async (requestedPartnerId: string) => {
    try {
      // Check mount and partner ID before setting loading state
      if (!isMountedRef.current || requestedPartnerId !== partnerId) return;
      
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
      // Only clear loading state if this request is still for the current partner
      // This prevents stale requests from clearing loading state while a new request is in progress
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

  const optimizeImage = async (uri: string, width?: number, height?: number): Promise<{
    uri: string;
    width: number;
    height: number;
    mimeType: string;
  }> => {
    // Resize image to max 1200px on longest side for faster uploads
    // This maintains quality while significantly reducing file size
    const MAX_DIMENSION = 1200;
    
    let actions: ImageManipulator.Action[] = [];
    
    if (width && height) {
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        const newWidth = Math.round(width * scale);
        const newHeight = Math.round(height * scale);
        actions.push({ resize: { width: newWidth, height: newHeight } });
      }
    } else {
      // If dimensions not provided, resize to max dimension
      actions.push({ resize: { width: MAX_DIMENSION } });
    }

    const result = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      mimeType: 'image/jpeg',
    };
  };

  const performUpload = async (faceDescriptor: number[] | null = null) => {
    if (!uploadDataRef.current) {
      throw new Error('Upload data not available');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    const uploadData = uploadDataRef.current;

    setUploadProgress('uploading');

    const formData = new FormData();
    formData.append('file', {
      uri: uploadData.optimizedUri,
      type: uploadData.mimeType,
      name: uploadData.fileName,
    } as any);
    formData.append('width', uploadData.width.toString());
    formData.append('height', uploadData.height.toString());
    if (faceDescriptor) {
      formData.append('faceDescriptor', JSON.stringify(faceDescriptor));
    }

    const uploadResponse = await fetch(`${apiUrl}/api/partners/${partnerId}/photos`, {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || errorData.details || `Failed to upload photo (${uploadResponse.status})`);
    }

    setUploadProgress('complete');
    setTimeout(() => {
      setShowProgressModal(false);
      setUploadProgress('preparing');
      setUploading(false);
      uploadDataRef.current = null;
      setSelectedImageUri(null);
      setFaceDetections([]);
      setSelectedFaceDescriptor(null);
      setAnalysisData(null);
    }, 1000);

    await loadPhotos(partnerId);
    onPhotoUploaded?.();
  };

  const handleUploadPhoto = async () => {
    const hasPermission = await requestImagePickerPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1.0, // Use full quality, we'll optimize ourselves
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      setError(null);
      setUploading(true);
      setShowProgressModal(true);
      setUploadProgress('preparing');

      // Optimize image first
      const optimized = await optimizeImage(
        asset.uri,
        asset.width,
        asset.height
      );

      // Store upload data for later use
      uploadDataRef.current = {
        optimizedUri: optimized.uri,
        width: optimized.width,
        height: optimized.height,
        mimeType: optimized.mimeType,
        fileName: asset.fileName || 'photo.jpg',
      };

      setSelectedImageUri(optimized.uri);

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

      // Step 1: Face Detection
      setUploadProgress('detecting_faces');
      let detections: any[] = [];
      try {
        const detectFormData = new FormData();
        detectFormData.append('file', {
          uri: optimized.uri,
          type: optimized.mimeType,
          name: uploadDataRef.current.fileName,
        } as any);

        const detectResponse = await fetch(`${apiUrl}/api/face-detection/detect`, {
          method: 'POST',
          body: detectFormData,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (detectResponse.ok) {
          const detectData = await detectResponse.json();
          if (detectData.detections && detectData.detections.length > 0) {
            detections = detectData.detections;
            setFaceDetections(detections);

            // Handle multiple faces - show selection modal
            if (detections.length > 1) {
              setShowProgressModal(false);
              setShowFaceSelectionModal(true);
              return; // Wait for user to select face
            }

            // Single face - proceed with analysis
            const faceDescriptor = detections[0].descriptor;
            await handleFaceAnalysis(faceDescriptor);
          } else {
            // No face detected - show modal
            setShowProgressModal(false);
            setShowNoFaceModal(true);
            return;
          }
        } else {
          // Face detection failed - proceed without it
          console.log('[PartnerPhotos] Face detection failed, proceeding without face descriptor');
          setShowProgressModal(false);
          await performUpload(null);
        }
      } catch (detectError) {
        console.error('[PartnerPhotos] Face detection error:', detectError);
        setShowProgressModal(false);
        await performUpload(null);
      }
    } catch (err) {
      console.error('Error uploading photo:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to upload photo');
        setShowProgressModal(false);
        setUploadProgress('preparing');
        setUploading(false);
        Alert.alert('Upload Error', err instanceof Error ? err.message : 'Failed to upload photo');
      }
    }
  };

  const handleFaceAnalysis = async (faceDescriptor: number[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    setUploadProgress('analyzing_matches');

    try {
      const analyzeResponse = await fetch(`${apiUrl}/api/partners/${partnerId}/photos/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ faceDescriptor }),
      });

      if (analyzeResponse.ok) {
        const analysis: PhotoUploadAnalysis = await analyzeResponse.json();
        setAnalysisData(analysis);
        setSelectedFaceDescriptor(faceDescriptor);

        // Handle decision
        if (analysis.decision.type === 'proceed') {
          // Proceed with upload
          await performUpload(faceDescriptor);
        } else if (analysis.decision.type === 'warn_same_person') {
          // Show same person warning
          setShowProgressModal(false);
          setShowSamePersonModal(true);
        } else if (analysis.decision.type === 'warn_other_partners') {
          // Show different partner warning
          setShowProgressModal(false);
          setShowDifferentPartnerModal(true);
        }
      } else {
        // Analysis failed - proceed with upload
        await performUpload(faceDescriptor);
      }
    } catch (analyzeError) {
      console.error('[PartnerPhotos] Analysis error:', analyzeError);
      // Proceed with upload on error
      await performUpload(faceDescriptor);
    }
  };

  const handleFaceSelected = async (detection: any) => {
    setShowFaceSelectionModal(false);
    setSelectedFaceDescriptor(detection.descriptor);
    // Reopen progress modal before analysis to maintain user feedback
    setShowProgressModal(true);
    setUploadProgress('analyzing_matches');
    await handleFaceAnalysis(detection.descriptor);
  };

  const handleNoFaceProceed = async () => {
    setShowNoFaceModal(false);
    setShowProgressModal(true);
    setUploadProgress('uploading');
    await performUpload(null);
  };

  const handleSamePersonConfirm = async () => {
    setShowSamePersonModal(false);
    setShowProgressModal(true);
    setUploadProgress('uploading');
    if (selectedFaceDescriptor) {
      await performUpload(selectedFaceDescriptor);
    }
  };

  const handleDifferentPartnerUploadAnyway = async () => {
    setShowDifferentPartnerModal(false);
    setShowProgressModal(true);
    setUploadProgress('uploading');
    if (selectedFaceDescriptor) {
      await performUpload(selectedFaceDescriptor);
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
        <View style={styles.gallery}>
          {photos.map((item) => {
            const photoUrl = getPhotoUrl(item.storage_path, supabaseUrl);
            const isDeleting = deleting === item.id;

            return (
              <View key={item.id} style={styles.photoContainer}>
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
          })}
        </View>
      )}

      {/* Progress Modal */}
      <PhotoUploadProgressModal
        visible={showProgressModal}
        currentStep={uploadProgress}
        error={error}
        onDismiss={() => {
          setShowProgressModal(false);
          setUploadProgress('preparing');
          setUploading(false);
          setError(null);
          uploadDataRef.current = null;
          setSelectedImageUri(null);
          setFaceDetections([]);
          setSelectedFaceDescriptor(null);
          setAnalysisData(null);
        }}
      />

      {/* Face Selection Modal */}
      {selectedImageUri && (
        <FaceSelectionModal
          visible={showFaceSelectionModal}
          imageUri={selectedImageUri}
          detections={faceDetections}
          onSelect={handleFaceSelected}
          onCancel={() => {
            setShowFaceSelectionModal(false);
            setShowProgressModal(false);
            setUploadProgress('preparing');
            setUploading(false);
            uploadDataRef.current = null;
            setSelectedImageUri(null);
            setFaceDetections([]);
          }}
        />
      )}

      {/* No Face Detected Modal */}
      <NoFaceDetectedModal
        visible={showNoFaceModal}
        onProceed={handleNoFaceProceed}
        onCancel={() => {
          setShowNoFaceModal(false);
          setShowProgressModal(false);
          setUploadProgress('preparing');
          setUploading(false);
          uploadDataRef.current = null;
          setSelectedImageUri(null);
        }}
      />

      {/* Same Person Warning Modal */}
      <SamePersonWarningModal
        visible={showSamePersonModal}
        onConfirm={handleSamePersonConfirm}
        onCancel={() => {
          setShowSamePersonModal(false);
          setShowProgressModal(false);
          setUploadProgress('preparing');
          setUploading(false);
          uploadDataRef.current = null;
          setSelectedImageUri(null);
          setSelectedFaceDescriptor(null);
          setAnalysisData(null);
        }}
      />

      {/* Different Partner Warning Modal */}
      {analysisData && analysisData.decision.type === 'warn_other_partners' && (
        <DifferentPartnerWarningModal
          visible={showDifferentPartnerModal}
          matches={analysisData.otherPartnerMatches}
          onUploadAnyway={handleDifferentPartnerUploadAnyway}
          onCancel={() => {
            setShowDifferentPartnerModal(false);
            setShowProgressModal(false);
            setUploadProgress('preparing');
            setUploading(false);
            uploadDataRef.current = null;
            setSelectedImageUri(null);
            setSelectedFaceDescriptor(null);
            setAnalysisData(null);
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 8,
  },
  photoContainer: {
    width: '48%', // 2 columns with margin
    margin: '1%',
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

