import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { ShareStackParamList, MainTabParamList, PartnersStackParamList } from '../../navigation/types';
import { usePhotoUpload } from '../../hooks/usePhotoUpload';
import { supabase } from '../../lib/supabase/client';
import { resilientFetch } from '../../lib/network-utils';
import PhotoUploadProgressModal from '../../components/PhotoUploadProgressModal';
import FaceSelectionModal from '../../components/FaceSelectionModal';
import NoFaceDetectedModal from '../../components/NoFaceDetectedModal';
import SamePersonWarningModal from '../../components/SamePersonWarningModal';

type ShareHandlerScreenRouteProp = RouteProp<ShareStackParamList, 'ShareHandler'>;
type ShareHandlerScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<ShareStackParamList, 'ShareHandler'>,
  CompositeNavigationProp<
    BottomTabNavigationProp<MainTabParamList>,
    NativeStackNavigationProp<PartnersStackParamList>
  >
>;

export default function ShareHandlerScreen() {
  const navigation = useNavigation<ShareHandlerScreenNavigationProp>();
  const route = useRoute<ShareHandlerScreenRouteProp>();
  const { imageUri } = route.params;
  const hasProcessedRef = useRef(false);

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
    processImageUri,
    handleFaceSelected,
    handleNoFaceProceed: hookHandleNoFaceProceed,
    handleSamePersonProceed,
    cancelUpload,
    uploadData,
  } = usePhotoUpload({
    onSuccess: () => {
      // Navigate to Dashboard after successful upload
      const tabNavigator = navigation.getParent();
      if (tabNavigator) {
        tabNavigator.navigate('Dashboard');
      }
    },
    onCancel: () => {
      // Navigate to Dashboard when canceling
      const tabNavigator = navigation.getParent();
      if (tabNavigator) {
        tabNavigator.navigate('Dashboard');
      }
    },
  });

  // Override handleNoFaceProceed to create partner in background when no partnerId
  const handleNoFaceProceed = async () => {
    if (!uploadData) {
      return;
    }
    
    // Create partner without name and upload photo in background
    // This logic matches PhotoUploadScreen
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
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

      if (response.ok) {
        // Navigate to Dashboard after successful creation
        const tabNavigator = navigation.getParent();
        if (tabNavigator) {
          tabNavigator.navigate('Dashboard');
        }
      }
    } catch (error) {
      console.error('[ShareHandlerScreen] Error creating partner:', error);
    }
  };

  // Start processing image when screen mounts
  useEffect(() => {
    if (!hasProcessedRef.current && imageUri) {
      hasProcessedRef.current = true;
      processImageUri(imageUri);
    }
  }, [imageUri, processImageUri]);

  // Handle navigation when analysis completes (same logic as PhotoUploadScreen)
  useEffect(() => {
    if (analysisData) {
      if (analysisData.decision.type === 'warn_other_partners') {
        // Matches found - navigate to SimilarPartners screen
        const allMatches = analysisData.otherPartnerMatches || [];
        if (uploadData && selectedFaceDescriptor && allMatches.length > 0) {
          // Navigate to Main tab, then Partners stack, then SimilarPartners
          const tabNavigator = navigation.getParent();
          if (tabNavigator) {
            tabNavigator.navigate('Partners', {
              screen: 'SimilarPartners',
              params: {
                currentPartnerId: '', // No current partner when uploading from share
                analysisData: analysisData,
                uploadData: uploadData,
                faceDescriptor: selectedFaceDescriptor,
                imageUri: selectedImageUri || uploadData.optimizedUri,
              },
            });
          }
        }
      } else if (analysisData.decision.type === 'proceed' && analysisData.decision.reason === 'no_matches') {
        // No matches found - create partner in background
        createPartnerInBackground();
      }
    }
  }, [analysisData, uploadData, selectedFaceDescriptor, selectedImageUri, navigation]);

  const createPartnerInBackground = async () => {
    if (!uploadData) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
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

      if (response.ok) {
        // Navigate to Dashboard after successful creation
        const tabNavigator = navigation.getParent();
        if (tabNavigator) {
          tabNavigator.navigate('Dashboard');
        }
      }
    } catch (error) {
      console.error('[ShareHandlerScreen] Error creating partner:', error);
    }
  };

  const handleCancel = () => {
    cancelUpload();
  };

  // Display photo preview and loading indicator (AliExpress style)
  const displayImageUri = selectedImageUri || imageUri;

  return (
    <View style={styles.container}>
      {/* Photo Preview - Top 45% */}
      {displayImageUri && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: displayImageUri }} style={styles.previewImage} resizeMode="contain" />
        </View>
      )}

      {/* Loading Section - Bottom 55% */}
      <View style={styles.loadingContainer}>
        {uploading && !showFaceSelectionModal && !showNoFaceModal && !showSamePersonModal ? (
          <>
            <View style={styles.loadingDots}>
              <View style={[styles.dot, styles.dotActive]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
            <Text style={styles.loadingText}>Searching through your partners...</Text>
          </>
        ) : null}
        
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <PhotoUploadProgressModal
        visible={showProgressModal}
        currentStep={uploadProgress}
        onCancel={handleCancel}
      />

      <FaceSelectionModal
        visible={showFaceSelectionModal}
        imageUri={selectedImageUri || imageUri}
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
    backgroundColor: '#000',
  },
  imageContainer: {
    flex: 0.45,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 0.55,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#ff6600',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 40,
  },
  cancelButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  cancelButtonText: {
    fontSize: 24,
    color: '#000',
    fontWeight: '300',
  },
});

