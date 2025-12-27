import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Linking } from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase/client';
import { usePhotoUpload } from '../../hooks/usePhotoUpload';
import { PartnersStackParamList } from '../../navigation/types';
import { resilientFetch } from '../../lib/network-utils';
import PhotoUploadProgressModal, { UploadStep } from '../../components/PhotoUploadProgressModal';
import FaceSelectionModal from '../../components/FaceSelectionModal';
import NoFaceDetectedModal from '../../components/NoFaceDetectedModal';
import SamePersonWarningModal from '../../components/SamePersonWarningModal';
import { getPartnerProfilePictureUrl } from '../../lib/photo-utils';
import { Partner, PhotoUploadAnalysis, FaceMatch } from '@dating-app/shared';

type PhotoUploadScreenRouteProp = RouteProp<PartnersStackParamList, 'PhotoUpload'>;
type PhotoUploadScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<PartnersStackParamList, 'PhotoUpload'>,
  BottomTabNavigationProp<MainTabParamList>
>;

export default function PhotoUploadScreen() {
  const navigation = useNavigation<PhotoUploadScreenNavigationProp>();
  const route = useRoute<PhotoUploadScreenRouteProp>();
  const { source } = route.params || {};
  
  const [matches, setMatches] = useState<FaceMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  
  const {
    uploading,
    uploadProgress,
    showProgressModal,
    showFaceSelectionModal,
    showNoFaceModal,
    showSamePersonModal,
    faceDetections,
    selectedImageUri,
    analysisData,
    selectedFaceDescriptor,
    faceSizeWarning,
    handleUploadPhoto,
    handleFaceSelected,
    handleNoFaceProceed: hookHandleNoFaceProceed,
    handleSamePersonProceed,
    cancelUpload,
    resetState,
    uploadData,
  } = usePhotoUpload({
    onSuccess: () => {
      // Navigate to Dashboard after successful upload (not goBack which would go to Partners)
      const tabNavigator = navigation.getParent();
      if (tabNavigator) {
        tabNavigator.navigate('Dashboard');
      }
    },
    onCancel: () => {
      // Navigate to Dashboard when canceling (not goBack which would go to Partners)
      const tabNavigator = navigation.getParent();
      if (tabNavigator) {
        tabNavigator.navigate('Dashboard');
      }
    },
  });

  // Wrapper to clear message when canceling
  const handleCancel = useCallback(() => {
    setMessage(''); // Clear any error messages when canceling
    cancelUpload();
  }, [cancelUpload]);

  // Override handleNoFaceProceed to create partner in background when no partnerId
  const handleNoFaceProceed = useCallback(async () => {
    if (!uploadData) {
      Alert.alert('Error', 'Upload data not available');
      return;
    }
    
    // Set loading state immediately before API call
    setLoading(true);
    
    // Create partner without name and upload photo in background
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'Not authenticated');
        setLoading(false);
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      
      const formData = new FormData();
      formData.append('file', {
        uri: uploadData.optimizedUri,
        type: uploadData.mimeType,
        name: uploadData.fileName,
      } as any);
      formData.append('width', uploadData.width.toString());
      formData.append('height', uploadData.height.toString());
      // No faceDescriptor since no face was detected
      // No first_name, last_name - creating partner without name

      const response = await resilientFetch(`${apiUrl}/api/partners/create-with-photo`, {
        method: 'POST',
        body: formData,
        timeout: 60000,
        retryOptions: {
          maxRetries: 2,
          initialDelay: 2000,
          maxDelay: 10000,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        // Check for partner limit error
        if (response.status === 403 && errorData.error === 'PARTNER_LIMIT_REACHED') {
          resetState(); // Clear upload state
          setMessage(errorData.message || 'Partner limit reached');
          setLoading(false);
          return;
        }
        
        throw new Error(errorData.error || errorData.details || 'Failed to create partner');
      }

      const result = await response.json();
      console.log('[PhotoUploadScreen] Partner created and photo uploaded:', result);
      
      // Reset state before navigation to ensure clean state
      resetState();
      
      // Navigate to Dashboard after successful creation (not goBack which would go to Partners)
      const tabNavigator = navigation.getParent();
      if (tabNavigator) {
        tabNavigator.navigate('Dashboard');
      }
    } catch (error) {
      console.error('[PhotoUploadScreen] Error creating partner:', error);
      
      // Check if it's a partner limit error (in case it wasn't caught above)
      if (error instanceof Error && error.message.includes('PARTNER_LIMIT_REACHED')) {
        resetState();
        setMessage(error.message);
      } else {
        Alert.alert(
          'Error',
          error instanceof Error ? error.message : 'Failed to create partner and upload photo'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [uploadData, navigation, resetState]);

  // Track if this is the first focus to avoid clearing state on initial mount
  const isFirstFocus = useRef(true);
  
  // Clear state when screen comes into focus (user navigates to it fresh)
  useFocusEffect(
    useCallback(() => {
      // Only clear state on subsequent focuses (not the first mount)
      // This prevents clearing state when the screen first loads, but clears it
      // when user navigates back to the screen after uploading/cancelling
      if (!isFirstFocus.current && !uploading && !showProgressModal && !loading) {
        // Always reset state when returning to screen (after first mount)
        // This ensures clean state when returning from SimilarPartners or other screens
        resetState();
        // Also clear local state that's not part of the hook
        setMatches([]);
        setMessage('');
      } else {
        isFirstFocus.current = false;
      }
    }, [uploading, showProgressModal, loading, resetState]) // Only depend on loading states, not on the state values themselves
  );

  // Configure back button behavior based on source
  useLayoutEffect(() => {
    if (source === 'Dashboard') {
      navigation.setOptions({
        headerBackTitle: 'Dashboard',
        headerBackTitleVisible: false,
      });
      
      // Override back button behavior
      const unsubscribe = navigation.addListener('beforeRemove', (e) => {
        // Only handle back button if it's the default back action
        if (e.data.action.type === 'GO_BACK') {
          e.preventDefault();
          // Navigate to Dashboard tab instead
          const tabNavigator = navigation.getParent();
          if (tabNavigator) {
            tabNavigator.navigate('Dashboard');
          }
        }
      });
      
      return unsubscribe;
    }
  }, [navigation, source]);

  // When analysis completes without partnerId, handle the decision
  useEffect(() => {
    if (analysisData && !route.params?.partnerId) {
      if (analysisData.decision.type === 'warn_other_partners') {
        // Matches found - extract matches and navigate to SimilarPartners screen
        const allMatches = analysisData.otherPartnerMatches || [];
        setMatches(allMatches);
        if (uploadData && selectedFaceDescriptor && allMatches.length > 0) {
          navigation.navigate('SimilarPartners', {
            currentPartnerId: '', // No current partner when uploading from dashboard
            analysisData: analysisData,
            uploadData: uploadData,
            faceDescriptor: selectedFaceDescriptor,
            imageUri: selectedImageUri || uploadData.optimizedUri,
          });
        }
      } else if (analysisData.decision.type === 'proceed' && analysisData.decision.reason === 'no_matches') {
        // No matches found - create partner in background
        createPartnerInBackground();
      }
    }
  }, [analysisData, route.params?.partnerId, uploadData, selectedFaceDescriptor, selectedImageUri, navigation]);

  const createPartnerInBackground = useCallback(async () => {
    if (!uploadData) {
      Alert.alert('Error', 'Upload data not available');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'Not authenticated');
        setLoading(false);
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      
      const formData = new FormData();
      formData.append('file', {
        uri: uploadData.optimizedUri,
        type: uploadData.mimeType,
        name: uploadData.fileName,
      } as any);
      formData.append('width', uploadData.width.toString());
      formData.append('height', uploadData.height.toString());
      if (selectedFaceDescriptor) {
        formData.append('faceDescriptor', JSON.stringify(selectedFaceDescriptor));
      }

      const response = await resilientFetch(`${apiUrl}/api/partners/create-with-photo`, {
        method: 'POST',
        body: formData,
        timeout: 60000,
        retryOptions: {
          maxRetries: 2,
          initialDelay: 2000,
          maxDelay: 10000,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        // Check for partner limit error
        if (response.status === 403 && errorData.error === 'PARTNER_LIMIT_REACHED') {
          resetState(); // Clear upload state
          setMessage(errorData.message || 'Partner limit reached');
          setLoading(false);
          return;
        }
        
        throw new Error(errorData.error || errorData.details || 'Failed to create partner');
      }

      const result = await response.json();
      console.log('[PhotoUploadScreen] Partner created and photo uploaded:', result);
      
      // Reset state before navigation to ensure clean state
      resetState();
      
      // Navigate to Dashboard after successful creation (not goBack which would go to Partners)
      const tabNavigator = navigation.getParent();
      if (tabNavigator) {
        tabNavigator.navigate('Dashboard');
      }
    } catch (error) {
      console.error('[PhotoUploadScreen] Error creating partner:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create partner and upload photo'
      );
    } finally {
      setLoading(false);
    }
  }, [uploadData, selectedFaceDescriptor, navigation, resetState]);

  const handleCreateNewPartner = async () => {
    if (!uploadData) {
      Alert.alert('Error', 'Upload data not available');
      return;
    }

    // Navigate to create partner screen with upload data
    // faceDescriptor can be null if no face was detected
    navigation.navigate('PartnerCreate', {
      uploadPhoto: true,
      uploadData: uploadData,
      faceDescriptor: selectedFaceDescriptor || null,
      imageUri: selectedImageUri || uploadData.optimizedUri,
    });
  };

  const handleUploadToPartner = async (partnerId: string) => {
    if (!uploadData) {
      Alert.alert('Error', 'Upload data not available');
      return;
    }

    // Navigate to partner detail with upload data
    // faceDescriptor can be null if no face was detected
    navigation.navigate('PartnerDetail', {
      partnerId: partnerId,
      uploadPhoto: true,
      uploadData: uploadData,
      faceDescriptor: selectedFaceDescriptor || null,
      imageUri: selectedImageUri || uploadData.optimizedUri,
    });
  };

  // If analysis shows matches, display them
  const hasMatches = matches.length > 0;
  const showMatches = analysisData && analysisData.decision.type === 'warn_other_partners';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Upload Photo</Text>
          <Text style={styles.subtitle}>
            Upload a photo to find matching partners or create a new partner.
          </Text>
        </View>

        {/* Error message container */}
        {message && (
          <View style={[styles.messageBox, styles.errorBox]}>
            <Text style={[styles.messageText, styles.errorText]}>
              {message}
            </Text>
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => {
                const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL;
                if (webAppUrl) {
                  Linking.openURL(`${webAppUrl}/upgrade`).catch((err) => {
                    console.error('Error opening upgrade page:', err);
                  });
                }
              }}
            >
              <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Face size warning */}
        {faceSizeWarning && (
          <View style={[styles.messageBox, styles.warningBox]}>
            <Text style={[styles.messageText, styles.warningText]}>
              {faceSizeWarning}
            </Text>
          </View>
        )}

        {/* Only show photo preview and controls if we're not in any modal state */}
        {selectedImageUri && !showProgressModal && !showFaceSelectionModal && !showNoFaceModal && !showSamePersonModal && !analysisData && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={handleCancel}
            >
              <Text style={styles.removeButtonText}>Remove Photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Show "Select Photo" button when no image is selected and no modals are showing */}
        {!selectedImageUri && !uploading && !showProgressModal && !showFaceSelectionModal && !showNoFaceModal && !showSamePersonModal && !loading && (
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => {
              setMessage(''); // Clear any previous error messages when starting new upload
              handleUploadPhoto();
            }}
            disabled={uploading}
          >
            <Text style={styles.uploadButtonText}>Select Photo</Text>
          </TouchableOpacity>
        )}

        {showMatches && hasMatches && (
          <View style={styles.matchesSection}>
            <Text style={styles.matchesTitle}>Matching Partners Found</Text>
            <Text style={styles.matchesSubtitle}>
              This photo matches {matches.length} existing partner{matches.length > 1 ? 's' : ''}. 
              Choose a partner to upload to, or create a new partner.
            </Text>
            
            {matches.map((match, index) => {
              return (
                <TouchableOpacity
                  key={match.photo_id || index}
                  style={styles.matchCard}
                  onPress={() => {
                    if (match.partner_id) {
                      handleUploadToPartner(match.partner_id);
                    }
                  }}
                >
                  <Text style={styles.matchText}>
                    {match.partner_name || 'Unknown Partner'} 
                    {match.distance !== undefined && ` (${((1 - match.distance) * 100).toFixed(1)}% match)`}
                  </Text>
                </TouchableOpacity>
              );
            })}
            
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateNewPartner}
            >
              <Text style={styles.createButtonText}>Create New Partner Instead</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading indicator when creating partner in background */}
        {loading && (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color="#dc2626" />
            <Text style={styles.loadingText}>Creating partner and uploading photo...</Text>
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <PhotoUploadProgressModal
        visible={showProgressModal}
        currentStep={uploadProgress}
        onCancel={handleCancel}
      />

      <FaceSelectionModal
        visible={showFaceSelectionModal}
        imageUri={selectedImageUri || ''}
        detections={faceDetections}
        onSelect={handleFaceSelected}
        onCancel={handleCancel}
        warning={faceSizeWarning || undefined}
      />

      <NoFaceDetectedModal
        visible={showNoFaceModal}
        onProceed={handleNoFaceProceed}
        onCancel={handleCancel}
      />

      <SamePersonWarningModal
        visible={showSamePersonModal}
        onProceed={handleSamePersonProceed}
        onCancel={handleCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  imagePreview: {
    marginBottom: 24,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  previewImage: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
  },
  removeButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  matchesSection: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  matchesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  matchesSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  matchCard: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  matchText: {
    fontSize: 14,
    color: '#111827',
  },
  createSection: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  createTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  createSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingSection: {
    marginTop: 24,
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
  },
  messageBox: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
  },
  messageText: {
    fontSize: 14,
    marginBottom: 12,
  },
  errorText: {
    color: '#dc2626',
  },
  upgradeButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  warningBox: {
    backgroundColor: '#fef3c7',
  },
  warningText: {
    color: '#92400e',
  },
});
