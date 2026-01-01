import { useState, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase/client';
import { PhotoUploadAnalysis, FaceMatch } from '@dating-app/shared';
import { resilientFetch } from '../lib/network-utils';
import { PartnersStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<PartnersStackParamList>;

export interface UsePhotoUploadOptions {
  partnerId?: string; // If provided, upload to this partner. If not, analyze across all partners.
  onSuccess?: () => void;
  onCancel?: () => void;
}

export interface UsePhotoUploadReturn {
  // State
  uploading: boolean;
  uploadProgress: 'preparing' | 'detecting_faces' | 'analyzing_matches' | 'uploading' | 'complete';
  showProgressModal: boolean;
  showFaceSelectionModal: boolean;
  showNoFaceModal: boolean;
  showSamePersonModal: boolean;
  faceDetections: any[];
  selectedImageUri: string | null;
  analysisData: PhotoUploadAnalysis | null;
  selectedFaceDescriptor: number[] | null;
  faceSizeWarning: string;
  noFaceErrorMessage: string | undefined;
  
  // Actions
  handleUploadPhoto: () => Promise<void>;
  processImageUri: (uri: string, width?: number, height?: number, fileName?: string) => Promise<void>;
  handleFaceSelected: (detection: any) => Promise<void>;
  handleNoFaceProceed: () => Promise<void>;
  handleSamePersonProceed: () => Promise<void>;
  cancelUpload: () => void;
  resetState: () => void; // Reset state without calling onCancel
  
  // Upload data (for external use, e.g., SimilarPartnersScreen)
  uploadData: {
    optimizedUri: string;
    width: number;
    height: number;
    mimeType: string;
    fileName: string;
  } | null;
}

export function usePhotoUpload(options: UsePhotoUploadOptions = {}): UsePhotoUploadReturn {
  const { partnerId, onSuccess, onCancel } = options;
  const navigation = useNavigation<NavigationProp>();
  
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<'preparing' | 'detecting_faces' | 'analyzing_matches' | 'uploading' | 'complete'>('preparing');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showFaceSelectionModal, setShowFaceSelectionModal] = useState(false);
  const [showNoFaceModal, setShowNoFaceModal] = useState(false);
  const [showSamePersonModal, setShowSamePersonModal] = useState(false);
  const [faceDetections, setFaceDetections] = useState<any[]>([]);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<PhotoUploadAnalysis | null>(null);
  const [selectedFaceDescriptor, setSelectedFaceDescriptor] = useState<number[] | null>(null);
  const [faceSizeWarning, setFaceSizeWarning] = useState<string>('');
  const [noFaceErrorMessage, setNoFaceErrorMessage] = useState<string | undefined>(undefined);
  
  const uploadDataRef = useRef<{
    optimizedUri: string;
    width: number;
    height: number;
    mimeType: string;
    fileName: string;
  } | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const requestImagePickerPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant photo library access to upload photos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const optimizeImage = async (
    uri: string,
    width: number,
    height: number
  ): Promise<{ uri: string; width: number; height: number; mimeType: string }> => {
    // Resize if too large (max 2000px on longest side)
    const MAX_DIMENSION = 2000;
    let resize: { width: number; height: number } | undefined;
    
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      resize = {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
      };
    }

    const result = await ImageManipulator.manipulateAsync(
      uri,
      resize ? [{ resize }] : [],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      mimeType: 'image/jpeg',
    };
  };

  // Prepare image for face detection with higher quality to avoid detection issues
  // This uses less compression (0.95) and larger max size to preserve detail for face detection
  const prepareImageForFaceDetection = async (
    uri: string,
    width: number,
    height: number
  ): Promise<{ uri: string; width: number; height: number; mimeType: string }> => {
    // Resize if too large (max 3000px on longest side for face detection)
    // This is larger than the upload optimization to preserve more detail
    const MAX_DIMENSION = 3000;
    let resize: { width: number; height: number } | undefined;
    
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      resize = {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
      };
    }

    // Use higher quality (0.95) for face detection to preserve detail
    const result = await ImageManipulator.manipulateAsync(
      uri,
      resize ? [{ resize }] : [],
      { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
    );

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      mimeType: 'image/jpeg',
    };
  };

  const cropImageToFace = async (
    imageUri: string,
    boundingBox: { x: number; y: number; width: number; height: number },
    originalDimensions: { width: number; height: number }
  ): Promise<{ uri: string; width: number; height: number }> => {
    // API now returns coordinates in original image space, so use them directly
    // But we need to validate and clamp to ensure they're within image bounds
    const cropX = Math.max(0, Math.min(Math.round(boundingBox.x), originalDimensions.width - 1));
    const cropY = Math.max(0, Math.min(Math.round(boundingBox.y), originalDimensions.height - 1));
    
    // Calculate maximum allowed width and height
    const maxWidth = originalDimensions.width - cropX;
    const maxHeight = originalDimensions.height - cropY;
    
    // Clamp width and height to ensure they don't exceed image bounds
    const cropWidth = Math.max(1, Math.min(Math.round(boundingBox.width), maxWidth));
    const cropHeight = Math.max(1, Math.min(Math.round(boundingBox.height), maxHeight));
    
    console.log('[usePhotoUpload] Cropping image to face:', {
      original: originalDimensions,
      boundingBox,
      crop: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
    });

    // Validate crop parameters
    if (cropX < 0 || cropY < 0 || cropWidth <= 0 || cropHeight <= 0) {
      throw new Error(`Invalid crop parameters: x=${cropX}, y=${cropY}, width=${cropWidth}, height=${cropHeight}`);
    }
    
    if (cropX + cropWidth > originalDimensions.width || cropY + cropHeight > originalDimensions.height) {
      throw new Error(`Crop rectangle extends beyond image bounds: crop(${cropX}, ${cropY}, ${cropWidth}, ${cropHeight}) vs image(${originalDimensions.width}, ${originalDimensions.height})`);
    }

    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ crop: { originX: cropX, originY: cropY, width: cropWidth, height: cropHeight } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
    };
  };

  const performUpload = async (faceDescriptor: number[] | null) => {
    if (!uploadDataRef.current) {
      throw new Error('Upload data not available');
    }

    if (!partnerId) {
      // Without partnerId, we need to navigate to create partner or show matches
      // This will be handled by the analysis result
      return;
    }

    const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    
    setUploadProgress('uploading');

    const uploadFormData = new FormData();
    uploadFormData.append('file', {
      uri: uploadDataRef.current.optimizedUri,
      type: uploadDataRef.current.mimeType,
      name: uploadDataRef.current.fileName,
    } as any);

    if (faceDescriptor) {
      uploadFormData.append('faceDescriptor', JSON.stringify(faceDescriptor));
    }

    const uploadResponse = await resilientFetch(`${apiUrl}/api/partners/${partnerId}/photos`, {
      method: 'POST',
      body: uploadFormData,
      signal: abortControllerRef.current?.signal,
      timeout: 60000, // 60 second timeout for upload
      retryOptions: {
        maxRetries: 2,
        initialDelay: 2000,
        maxDelay: 10000,
      },
    });

    if (abortControllerRef.current?.signal.aborted) {
      return;
    }

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || errorData.details || `Failed to upload photo (${uploadResponse.status})`);
    }

    setUploadProgress('complete');
    setShowProgressModal(false);
    setUploadProgress('preparing');
    setUploading(false);
    uploadDataRef.current = null;
    setSelectedImageUri(null);
    setFaceDetections([]);
    setSelectedFaceDescriptor(null);
    setAnalysisData(null);
    setFaceSizeWarning('');
    
    onSuccess?.();
  };

  const handleFaceAnalysis = async (faceDescriptor: number[]) => {
    if (abortControllerRef.current?.signal.aborted) {
      setShowProgressModal(false);
      setUploadProgress('preparing');
      setUploading(false);
      return;
    }

    const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    setUploadProgress('analyzing_matches');

    try {
      let analyzeResponse: Response;
      
      if (partnerId) {
        // Analyze for specific partner
        analyzeResponse = await resilientFetch(`${apiUrl}/api/partners/${partnerId}/photos/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ faceDescriptor }),
          signal: abortControllerRef.current?.signal,
          timeout: 30000,
          retryOptions: {
            maxRetries: 2,
            initialDelay: 1000,
            maxDelay: 5000,
          },
        });
      } else {
        // Analyze across all partners
        analyzeResponse = await resilientFetch(`${apiUrl}/api/photos/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ faceDescriptor }),
          signal: abortControllerRef.current?.signal,
          timeout: 30000,
          retryOptions: {
            maxRetries: 2,
            initialDelay: 1000,
            maxDelay: 5000,
          },
        });
      }

      if (abortControllerRef.current?.signal.aborted) {
        setShowProgressModal(false);
        setUploadProgress('preparing');
        setUploading(false);
        return;
      }

      if (analyzeResponse.ok) {
        const responseData = await analyzeResponse.json();
        
        if (abortControllerRef.current?.signal.aborted) {
          setShowProgressModal(false);
          setUploadProgress('preparing');
          setUploading(false);
          return;
        }

        setSelectedFaceDescriptor(faceDescriptor);

        // Handle decision
        if (partnerId) {
          // With partnerId: response is PhotoUploadAnalysis
          const analysis: PhotoUploadAnalysis = responseData;
          setAnalysisData(analysis);

          if (analysis.decision.type === 'proceed') {
            await performUpload(faceDescriptor);
          } else if (analysis.decision.type === 'warn_same_person') {
            setShowProgressModal(false);
            setShowSamePersonModal(true);
          } else if (analysis.decision.type === 'warn_other_partners') {
            setShowProgressModal(false);
            if (!uploadDataRef.current || !faceDescriptor) {
              Alert.alert('Error', 'Upload data not available');
              return;
            }
            navigation.navigate('SimilarPartners', {
              currentPartnerId: partnerId,
              analysisData: analysis,
              uploadData: uploadDataRef.current,
              faceDescriptor: faceDescriptor,
              imageUri: selectedImageUri || uploadDataRef.current.optimizedUri,
            });
            return;
          }
        } else {
          // Without partnerId: response is { decision: 'create_new' | 'warn_matches', matches: FaceMatch[] }
          if (responseData.decision === 'create_new') {
            // No matches found - create partner in background and upload photo
            setShowProgressModal(false);
            // The screen component will handle creating partner in background
            // Set analysisData to indicate "create_new" decision
            const analysis: PhotoUploadAnalysis = {
              decision: {
                type: 'proceed',
                reason: 'no_matches',
              },
              partnerMatches: [],
              otherPartnerMatches: [],
              partnerHasOtherPhotos: false,
            };
            setAnalysisData(analysis);
          } else if (responseData.decision === 'warn_matches') {
            // Matches found - show SimilarPartners screen
            const analysis: PhotoUploadAnalysis = {
              decision: {
                type: 'warn_other_partners',
                reason: 'matches_other_partners',
                matches: responseData.matches || [],
              },
              partnerMatches: [],
              otherPartnerMatches: responseData.matches || [],
              partnerHasOtherPhotos: false,
            };
            setAnalysisData(analysis);
            setShowProgressModal(false);
            // The screen component will handle displaying matches
          }
        }
      } else {
        // Analysis failed - proceed with upload if partnerId exists
        if (!abortControllerRef.current?.signal.aborted && partnerId) {
          await performUpload(faceDescriptor);
        }
      }
    } catch (analyzeError: any) {
      if (analyzeError?.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        setShowProgressModal(false);
        setUploadProgress('preparing');
        setUploading(false);
        return;
      }
      console.error('[usePhotoUpload] Analysis error:', analyzeError);
      if (!abortControllerRef.current?.signal.aborted && partnerId) {
        await performUpload(faceDescriptor);
      }
    }
  };

  // Process image from URI (for share intents or direct image processing)
  const processImageUri = async (uri: string, width?: number, height?: number, fileName: string = 'photo.jpg') => {
    try {
      setUploading(true);
      setShowProgressModal(true);
      setUploadProgress('preparing');

      abortControllerRef.current = new AbortController();

      // Get image dimensions if not provided
      let imageWidth = width;
      let imageHeight = height;
      if (!imageWidth || !imageHeight) {
        const imageInfo = await ImageManipulator.manipulateAsync(uri, [], { format: ImageManipulator.SaveFormat.JPEG });
        imageWidth = imageInfo.width;
        imageHeight = imageInfo.height;
      }

      // Optimize image
      const optimized = await optimizeImage(
        uri,
        imageWidth,
        imageHeight
      );

      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      uploadDataRef.current = {
        optimizedUri: optimized.uri,
        width: optimized.width,
        height: optimized.height,
        mimeType: optimized.mimeType,
        fileName: fileName,
      };

      setSelectedImageUri(optimized.uri);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

      // Face Detection
      setUploadProgress('detecting_faces');
      let detections: any[] = [];
      try {
        // Prepare high-quality image for face detection (better than optimized version)
        const faceDetectionImage = await prepareImageForFaceDetection(
          uri,
          imageWidth,
          imageHeight
        );

        const detectFormData = new FormData();
        detectFormData.append('file', {
          uri: faceDetectionImage.uri,
          type: faceDetectionImage.mimeType,
          name: uploadDataRef.current.fileName,
        } as any);

        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
          timeoutController.abort();
        }, 50000);

        let combinedSignal: AbortSignal;
        let cleanup: (() => void) | null = null;
        
        if (abortControllerRef.current) {
          const combinedController = new AbortController();
          const abortListener = () => combinedController.abort();
          abortControllerRef.current.signal.addEventListener('abort', abortListener);
          timeoutController.signal.addEventListener('abort', abortListener);
          cleanup = () => {
            abortControllerRef.current?.signal.removeEventListener('abort', abortListener);
            timeoutController.signal.removeEventListener('abort', abortListener);
          };
          combinedSignal = combinedController.signal;
        } else {
          combinedSignal = timeoutController.signal;
        }

        const detectResponse = await resilientFetch(`${apiUrl}/api/face-detection/detect`, {
          method: 'POST',
          body: detectFormData,
          signal: combinedSignal,
          timeout: 50000,
          retryOptions: {
            maxRetries: 1,
            initialDelay: 3000,
            maxDelay: 5000,
          },
        });
        clearTimeout(timeoutId);
        cleanup?.();

        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        if (detectResponse.ok) {
          const detectData = await detectResponse.json();
          
          if (abortControllerRef.current?.signal.aborted) {
            return;
          }

          // Store warning if present (some faces filtered but valid ones remain)
          if (detectData.warning) {
            setFaceSizeWarning(detectData.warning);
          } else {
            setFaceSizeWarning('');
          }

          // Check for error first (e.g., all faces too small)
          if (detectData.error) {
            // Check if it's a face size error (all faces filtered) - show no face modal (same behavior: cancel or upload anyway)
            if (detectData.error.includes('too small') || detectData.error.includes('minimum')) {
              setNoFaceErrorMessage(detectData.error);
              setShowProgressModal(false);
              setShowNoFaceModal(true);
              return;
            }
            // For "No faces detected" error with no detections, show no face modal
            if ((detectData.error === 'No faces detected' || detectData.error.includes('No faces')) && 
                (!Array.isArray(detectData.detections) || detectData.detections.length === 0)) {
              setNoFaceErrorMessage(undefined); // No custom message for actual "no face" case
              setShowProgressModal(false);
              setShowNoFaceModal(true);
              return;
            }
          }

          // Process detections if available
          if (Array.isArray(detectData.detections) && detectData.detections.length > 0) {
            detections = detectData.detections;
            
            const validDetections = detections.filter(d => 
              d && 
              d.boundingBox && 
              d.descriptor && 
              Array.isArray(d.descriptor) &&
              typeof d.boundingBox.x === 'number' &&
              typeof d.boundingBox.y === 'number' &&
              typeof d.boundingBox.width === 'number' &&
              typeof d.boundingBox.height === 'number'
            );
            
            if (validDetections.length === 0) {
              setNoFaceErrorMessage(undefined); // No custom message for this case
              setShowProgressModal(false);
              setShowNoFaceModal(true);
              return;
            }
            
            setFaceDetections(validDetections);

            if (validDetections.length > 1) {
              setShowProgressModal(false);
              setShowFaceSelectionModal(true);
              return;
            }

            const faceDescriptor = validDetections[0].descriptor;
            await handleFaceAnalysis(faceDescriptor);
          } else {
            // No detections and no error (or error was already handled above)
            setNoFaceErrorMessage(undefined); // No custom message for this case
            setShowProgressModal(false);
            setShowNoFaceModal(true);
            return;
          }
        } else {
          // Face detection API returned non-200 status
          // Show no face modal to let user decide
          setNoFaceErrorMessage(undefined); // No custom message for API errors
          setShowProgressModal(false);
          setShowNoFaceModal(true);
          return;
        }
      } catch (detectError: any) {
        const isTimeout = detectError?.message === 'CLIENT_TIMEOUT' || 
                         detectError?.message?.includes('TIMEOUT') ||
                         detectError?.message?.includes('timeout');
        
        const isNetworkError = detectError?.message?.includes('Network request failed') || 
                              detectError?.message?.includes('Failed to fetch') ||
                              detectError?.name === 'TypeError';
        
        if (isTimeout || isNetworkError) {
          Alert.alert(
            isTimeout ? 'Face Detection Timeout' : 'Network Error',
            isTimeout 
              ? 'Face detection is taking longer than expected. Would you like to upload the photo anyway?'
              : 'Unable to connect to face detection service. Would you like to upload the photo anyway?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: cancelUpload,
              },
              {
                text: 'Upload Anyway',
                onPress: async () => {
                  setShowProgressModal(false);
                  if (partnerId) {
                    await performUpload(null);
                  } else {
                    Alert.alert('Error', 'Please select a partner to upload the photo.');
                    cancelUpload();
                  }
                },
              },
            ]
          );
          return;
        }
        
        if (detectError?.name === 'AbortError' && !isTimeout) {
          return;
        }
        
        if (abortControllerRef.current?.signal.aborted && !isTimeout) {
          return;
        }
        
        console.error('[usePhotoUpload] Face detection error:', detectError);
        
        // Show no face modal to let user decide (same as when no face is detected)
        setNoFaceErrorMessage(undefined); // No custom message for detection errors
        setShowProgressModal(false);
        setShowNoFaceModal(true);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        return;
      }
      console.error('Error uploading photo:', err);
      Alert.alert('Upload Error', err instanceof Error ? err.message : 'Failed to upload photo');
      cancelUpload();
    }
  };

  const handleUploadPhoto = async () => {
    const hasPermission = await requestImagePickerPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: false,
        quality: 1.0,
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      // Use processImageUri with asset data
      await processImageUri(
        asset.uri,
        asset.width,
        asset.height,
        asset.fileName || 'photo.jpg'
      );
    } catch (err: any) {
      if (err?.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        return;
      }
      console.error('Error uploading photo:', err);
      Alert.alert('Upload Error', err instanceof Error ? err.message : 'Failed to upload photo');
      cancelUpload();
    }
  };

  const handleFaceSelected = async (detection: any) => {
    setShowFaceSelectionModal(false);
    setSelectedFaceDescriptor(detection.descriptor);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setShowProgressModal(false);
      setUploadProgress('preparing');
      setUploading(false);
      Alert.alert('Authentication Error', 'Please sign in again to upload photos.');
      return;
    }
    
    if (detection.boundingBox && uploadDataRef.current) {
      try {
        setShowProgressModal(true);
        setUploadProgress('preparing');
        
        const cropped = await cropImageToFace(
          uploadDataRef.current.optimizedUri,
          detection.boundingBox,
          { width: uploadDataRef.current.width, height: uploadDataRef.current.height }
        );
        
        uploadDataRef.current.optimizedUri = cropped.uri;
        uploadDataRef.current.width = cropped.width;
        uploadDataRef.current.height = cropped.height;
        setSelectedImageUri(cropped.uri);
      } catch (error) {
        console.error('[usePhotoUpload] Error cropping image:', error);
        Alert.alert(
          'Crop Failed',
          'Failed to crop image. Using original photo instead.',
          [{ text: 'OK' }]
        );
      }
    }
    
    setShowProgressModal(true);
    setUploadProgress('analyzing_matches');
    await handleFaceAnalysis(detection.descriptor);
  };

  const handleNoFaceProceed = async () => {
    setShowNoFaceModal(false);
    if (partnerId) {
      await performUpload(null);
    } else {
      // Without partnerId, create partner in background and upload photo
      // This will be handled by the screen component
    }
  };

  const handleSamePersonProceed = async () => {
    setShowSamePersonModal(false);
    if (selectedFaceDescriptor && partnerId) {
      await performUpload(selectedFaceDescriptor);
    }
  };

  const resetState = useCallback(() => {
    // Reset all state without calling onCancel (useful for clearing state on screen focus)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setShowProgressModal(false);
    setShowFaceSelectionModal(false);
    setShowNoFaceModal(false);
    setShowSamePersonModal(false);
    setUploadProgress('preparing');
    setUploading(false);
    uploadDataRef.current = null;
    setSelectedImageUri(null);
    setFaceDetections([]);
    setSelectedFaceDescriptor(null);
    setAnalysisData(null);
    setFaceSizeWarning('');
    // Note: Don't call onCancel here - this is just for resetting state
  }, []); // Empty deps - this function doesn't depend on any props or state

  const cancelUpload = () => {
    resetState();
    onCancel?.();
  };

  return {
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
    noFaceErrorMessage,
    handleUploadPhoto,
    processImageUri,
    handleFaceSelected,
    handleNoFaceProceed,
    handleSamePersonProceed,
    cancelUpload,
    resetState,
    uploadData: uploadDataRef.current,
  };
}