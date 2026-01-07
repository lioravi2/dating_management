import { useState, useEffect, useRef, useCallback } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase/client';
import { PartnerPhoto, PhotoUploadAnalysis, FaceMatch } from '@dating-app/shared';
import { getPhotoUrl } from '../lib/photo-utils';
import { resilientFetch } from '../lib/network-utils';
import PhotoUploadProgressModal, { UploadStep } from './PhotoUploadProgressModal';
import FaceSelectionModal from './FaceSelectionModal';
import NoFaceDetectedModal from './NoFaceDetectedModal';
import SamePersonWarningModal from './SamePersonWarningModal';
import { PartnersStackParamList } from '../navigation/types';
import { trackButtonClick } from '../lib/analytics/events';

type NavigationProp = NativeStackNavigationProp<PartnersStackParamList>;

interface PartnerPhotosProps {
  partnerId: string;
  onPhotoUploaded?: () => void;
}

export default function PartnerPhotos({ partnerId, onPhotoUploaded }: PartnerPhotosProps) {
  const navigation = useNavigation<NavigationProp>();
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
  const [noFaceErrorMessage, setNoFaceErrorMessage] = useState<string | undefined>(undefined);
  
  // Face detection data
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [faceDetectionImageUri, setFaceDetectionImageUri] = useState<string | null>(null);
  const [faceDetectionImageDimensions, setFaceDetectionImageDimensions] = useState<{ width: number; height: number } | null>(null);
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

  // Abort controller for cancelling uploads
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // Prepare image for face detection with higher quality to avoid detection issues
  // This uses less compression (0.95) and larger max size to preserve detail for face detection
  const prepareImageForFaceDetection = async (uri: string, width: number, height: number): Promise<{
    uri: string;
    width: number;
    height: number;
    mimeType: string;
  }> => {
    // Resize if too large (max 3000px on longest side for face detection)
    // This is larger than the upload optimization to preserve more detail
    const MAX_DIMENSION = 3000;
    let actions: ImageManipulator.Action[] = [];
    
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      const newWidth = Math.round(width * scale);
      const newHeight = Math.round(height * scale);
      actions.push({ resize: { width: newWidth, height: newHeight } });
    }

    // Use higher quality (0.95) for face detection to preserve detail
    const result = await ImageManipulator.manipulateAsync(
      uri,
      actions,
      { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
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

    // Check if cancelled before upload
    if (abortControllerRef.current?.signal.aborted) {
      return;
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

    // Use resilientFetch with retry logic and timeout
    const uploadResponse = await resilientFetch(`${apiUrl}/api/partners/${partnerId}/photos`, {
      method: 'POST',
      body: formData,
      signal: abortControllerRef.current?.signal,
      timeout: 60000, // 60 second timeout for upload (larger files)
      retryOptions: {
        maxRetries: 2, // Fewer retries for upload (it's expensive)
        initialDelay: 2000, // 2 second initial delay
        maxDelay: 10000, // 10 second max delay
      },
    });

    // Check if cancelled during fetch
    if (abortControllerRef.current?.signal.aborted) {
      return;
    }

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || errorData.details || `Failed to upload photo (${uploadResponse.status})`);
    }

    // Check if cancelled after upload completes
    if (abortControllerRef.current?.signal.aborted) {
      return;
    }

    setUploadProgress('complete');
    
    // Close modal first, then reload photos and notify parent
    setShowProgressModal(false);
    setUploadProgress('preparing');
    setUploading(false);
    uploadDataRef.current = null;
    setSelectedImageUri(null);
    setFaceDetectionImageUri(null);
    setFaceDetectionImageDimensions(null);
    setFaceDetections([]);
    setSelectedFaceDescriptor(null);
    setAnalysisData(null);
    
    // Reload photos
    await loadPhotos(partnerId);
    
    // Delay callback to prevent parent refresh flicker
    setTimeout(() => {
      onPhotoUploaded?.();
    }, 300);
  };

  const cancelUpload = () => {
    trackButtonClick('cancel_upload', 'Cancel', 'PartnerPhotos', { partner_id: partnerId });
    
    // Abort any ongoing fetch requests
    // Note: Keep the reference so signal.aborted checks work in catch blocks
    // The abort controller will be reset when a new upload starts
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      // Don't set to null here - keep it so abort checks in catch blocks can work
      // It will be reset when handleUploadPhoto creates a new AbortController
    }

    // Clean up all state
    setShowProgressModal(false);
    setShowFaceSelectionModal(false);
    setShowNoFaceModal(false);
    setShowSamePersonModal(false);
    setUploadProgress('preparing');
    setUploading(false);
    setError(null);
    setNoFaceErrorMessage(undefined);
    uploadDataRef.current = null;
    setSelectedImageUri(null);
    setFaceDetectionImageUri(null);
    setFaceDetectionImageDimensions(null);
    setFaceDetections([]);
    setSelectedFaceDescriptor(null);
    setAnalysisData(null);
  };

  const handleUploadPhoto = async () => {
    trackButtonClick('upload_photo', '+ Upload Photo', 'PartnerPhotos', { partner_id: partnerId });
    
    const hasPermission = await requestImagePickerPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
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

      // Create abort controller for this upload
      abortControllerRef.current = new AbortController();

      // Optimize image first
      const optimized = await optimizeImage(
        asset.uri,
        asset.width,
        asset.height
      );

      // Check if cancelled during optimization
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

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

      // Check if cancelled before face detection
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      
      // Validate API URL - localhost won't work on physical devices
      if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
        console.warn('[PartnerPhotos] Warning: Using localhost API URL. This will not work on physical devices.');
      }

      // Step 1: Face Detection
      setUploadProgress('detecting_faces');
      let detections: any[] = [];
      try {
        // Prepare high-quality image for face detection (better than optimized version)
        const faceDetectionImage = await prepareImageForFaceDetection(
          asset.uri,
          asset.width,
          asset.height
        );

        // Store face detection image data for use in FaceSelectionModal
        setFaceDetectionImageUri(faceDetectionImage.uri);
        setFaceDetectionImageDimensions({ width: faceDetectionImage.width, height: faceDetectionImage.height });

        const detectFormData = new FormData();
        detectFormData.append('file', {
          uri: faceDetectionImage.uri,
          type: faceDetectionImage.mimeType,
          name: uploadDataRef.current.fileName,
        } as any);

        // Add client-side timeout (50 seconds) to prevent indefinite waiting
        // Server timeout is 60 seconds (Vercel Pro), so we timeout slightly earlier
        // Cold starts can take 6-17s (model loading) + 2.5-6s (processing) = 8.5-23s
        // With network latency, 50s gives enough buffer while still failing before server timeout
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log('[PartnerPhotos] Face detection timeout triggered (50s)');
          timeoutController.abort();
        }, 50000); // 50 second client timeout for face detection

        // Combine both signals: user cancellation and timeout
        // If either is aborted, the fetch will be cancelled
        let combinedSignal: AbortSignal;
        let cleanup: (() => void) | null = null;
        
        if (abortControllerRef.current) {
          // Create a combined signal that aborts if either controller aborts
          const combinedController = new AbortController();
          
          // Listen to both signals and abort combined controller if either aborts
          const abortListener = () => combinedController.abort();
          abortControllerRef.current.signal.addEventListener('abort', abortListener);
          timeoutController.signal.addEventListener('abort', abortListener);
          
          // Clean up listeners when fetch completes
          cleanup = () => {
            abortControllerRef.current?.signal.removeEventListener('abort', abortListener);
            timeoutController.signal.removeEventListener('abort', abortListener);
          };
          
          combinedSignal = combinedController.signal;
        } else {
          // No user cancellation controller, just use timeout
          combinedSignal = timeoutController.signal;
        }

        console.log('[PartnerPhotos] Starting face detection request to:', `${apiUrl}/api/face-detection/detect`);
        let detectResponse: Response;
        try {
          // Use resilientFetch but respect the existing combinedSignal (includes timeout)
          // Note: resilientFetch will add its own timeout, but combinedSignal takes precedence
          detectResponse = await resilientFetch(`${apiUrl}/api/face-detection/detect`, {
            method: 'POST',
            body: detectFormData,
            signal: combinedSignal,
            timeout: 50000, // 50 second timeout (matches timeoutController)
            retryOptions: {
              maxRetries: 1, // Only 1 retry for face detection (it's slow)
              initialDelay: 3000,
              maxDelay: 5000,
            },
          });
          clearTimeout(timeoutId);
          cleanup?.();
          console.log('[PartnerPhotos] Face detection response received:', detectResponse.status, detectResponse.ok);
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          cleanup?.();
          console.error('[PartnerPhotos] Face detection fetch error:', fetchError?.name, fetchError?.message);
          // If it's a timeout error from our client-side timeout, throw a specific error
          if (fetchError?.name === 'AbortError' && timeoutController.signal.aborted) {
            throw new Error('CLIENT_TIMEOUT');
          }
          throw fetchError;
        }

        // Check if cancelled during fetch
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        if (detectResponse.ok) {
          const detectData = await detectResponse.json();
          
          // Check if cancelled during JSON parsing
          if (abortControllerRef.current?.signal.aborted) {
            return;
          }

          // Check for error first (e.g., all faces too small)
          if (detectData.error) {
            // Check if it's a face size error (all faces filtered) - show no face modal with error message
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

          // Handle response - check for detections array (could be empty array, null, or undefined)
          if (Array.isArray(detectData.detections) && detectData.detections.length > 0) {
            detections = detectData.detections;
            console.log(`[PartnerPhotos] Received ${detections.length} face detection(s)`, detections);
            
            // Validate detections have required properties
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
              console.error('[PartnerPhotos] No valid detections found:', detections);
              setNoFaceErrorMessage(undefined); // No custom message for this case
              setShowProgressModal(false);
              setShowNoFaceModal(true);
              return;
            }
            
            setFaceDetections(validDetections);

            // Handle multiple faces - show selection modal
            if (validDetections.length > 1) {
              console.log(`[PartnerPhotos] Showing face selection modal for ${validDetections.length} faces`);
              setShowProgressModal(false);
              setShowFaceSelectionModal(true);
              return; // Wait for user to select face
            }

            // Single face - proceed with analysis
            const faceDescriptor = validDetections[0].descriptor;
            await handleFaceAnalysis(faceDescriptor);
          } else {
            // No face detected - show modal
            setNoFaceErrorMessage(undefined); // No custom message for this case
            setShowProgressModal(false);
            setShowNoFaceModal(true);
            return;
          }
        } else {
          // Face detection failed - check if it's a timeout
          const errorText = await detectResponse.text();
          console.log('[PartnerPhotos] Face detection failed:', detectResponse.status, errorText);
          
          const isTimeout = detectResponse.status === 504 || errorText.includes('TIMEOUT') || errorText.includes('FUNCTION_INVOCATION_TIMEOUT');
          
          if (isTimeout) {
            // Show timeout error to user and allow them to proceed
            Alert.alert(
              'Face Detection Timeout',
              'Face detection is taking longer than expected. Would you like to upload the photo anyway?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => {
                    cancelUpload();
                  },
                },
                {
                  text: 'Upload Anyway',
                  onPress: async () => {
                    trackButtonClick('upload_anyway_timeout', 'Upload Anyway', 'PartnerPhotos', { partner_id: partnerId });
                    setShowProgressModal(false);
                    await performUpload(null);
                  },
                },
              ]
            );
            return;
          }
          
          // For other errors, proceed with upload silently
          setShowProgressModal(false);
          await performUpload(null);
        }
      } catch (detectError: any) {
        // Check if it's a timeout FIRST (before checking for cancellation)
        // This ensures timeout errors are handled even if they're AbortErrors
        const isTimeout = detectError?.message === 'CLIENT_TIMEOUT' || 
                         detectError?.message?.includes('TIMEOUT') ||
                         detectError?.message?.includes('timeout');
        
        // Check if it's a network error
        const isNetworkError = detectError?.message?.includes('Network request failed') || 
                              detectError?.message?.includes('Failed to fetch') ||
                              detectError?.name === 'TypeError';
        
        if (isTimeout || isNetworkError) {
          // Show error to user and allow them to proceed without face detection
          Alert.alert(
            isTimeout ? 'Face Detection Timeout' : 'Network Error',
            isTimeout 
              ? 'Face detection is taking longer than expected. Would you like to upload the photo anyway?'
              : 'Unable to connect to face detection service. Would you like to upload the photo anyway?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  cancelUpload();
                },
              },
              {
                text: 'Upload Anyway',
                onPress: async () => {
                  setShowProgressModal(false);
                  await performUpload(null);
                },
              },
            ]
          );
          return;
        }
        
        // Check if error is due to user cancellation (only if not a timeout)
        // Check error name first (AbortError) - this works even if abortControllerRef is null
        if (detectError?.name === 'AbortError' && !isTimeout) {
          console.log('[PartnerPhotos] Face detection cancelled by user');
          return;
        }
        // Also check signal state as fallback (only if ref is still available)
        if (abortControllerRef.current?.signal.aborted && !isTimeout) {
          console.log('[PartnerPhotos] Face detection cancelled by user (signal check)');
          return;
        }
        
        console.error('[PartnerPhotos] Face detection error:', detectError);
        
        // For other errors, proceed with upload silently
        // Only proceed with upload if we're still in an active upload state and not cancelled
        const isCancelled = (detectError?.name === 'AbortError' && !isTimeout) || 
                           (abortControllerRef.current?.signal.aborted && !isTimeout);
        if (isMountedRef.current && uploading && !isCancelled) {
          setShowProgressModal(false);
          await performUpload(null);
        }
      }
    } catch (err: any) {
      // Check if error is due to abort
      if (err?.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        console.log('[PartnerPhotos] Upload cancelled');
        return;
      }
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
    console.log('[PartnerPhotos] Starting face analysis with descriptor length:', faceDescriptor?.length);
    // Check if cancelled before analysis
    if (abortControllerRef.current?.signal.aborted) {
      // Clean up modal state if cancelled
      setShowProgressModal(false);
      setUploadProgress('preparing');
      setUploading(false);
      return;
    }

    const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

    setUploadProgress('analyzing_matches');

    try {
      // Use resilientFetch for analysis with retry logic
      const analyzeResponse = await resilientFetch(`${apiUrl}/api/partners/${partnerId}/photos/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ faceDescriptor }),
        signal: abortControllerRef.current?.signal,
        timeout: 30000, // 30 second timeout for analysis
        retryOptions: {
          maxRetries: 2,
          initialDelay: 1000,
          maxDelay: 5000,
        },
      });

      // Check if cancelled during fetch
      if (abortControllerRef.current?.signal.aborted) {
        // Clean up modal state if cancelled
        setShowProgressModal(false);
        setUploadProgress('preparing');
        setUploading(false);
        return;
      }

      if (analyzeResponse.ok) {
        const analysis: PhotoUploadAnalysis = await analyzeResponse.json();
        
        // Check if cancelled during JSON parsing
        if (abortControllerRef.current?.signal.aborted) {
          // Clean up modal state if cancelled
          setShowProgressModal(false);
          setUploadProgress('preparing');
          setUploading(false);
          return;
        }

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
          // Navigate to SimilarPartners screen instead of showing modal
          setShowProgressModal(false);
          setAnalysisData(analysis);
          
          // Ensure upload data is available - use faceDescriptor parameter directly (not state)
          if (!uploadDataRef.current || !faceDescriptor) {
            Alert.alert('Error', 'Upload data not available');
            return;
          }
          
          navigation.navigate('SimilarPartners', {
            currentPartnerId: partnerId,
            analysisData: analysis,
            uploadData: uploadDataRef.current,
            faceDescriptor: faceDescriptor, // Use parameter directly, not state
            imageUri: selectedImageUri || uploadDataRef.current.optimizedUri, // Pass image URI for preview
          });
          return; // Don't proceed with upload
        }
      } else {
        // Analysis failed - proceed with upload
        if (!abortControllerRef.current?.signal.aborted) {
          await performUpload(faceDescriptor);
        }
      }
    } catch (analyzeError: any) {
      // Check if error is due to abort
      if (analyzeError?.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        console.log('[PartnerPhotos] Analysis cancelled');
        // Clean up modal state if cancelled
        setShowProgressModal(false);
        setUploadProgress('preparing');
        setUploading(false);
        return;
      }
      console.error('[PartnerPhotos] Analysis error:', analyzeError);
      // Proceed with upload on error (only if not cancelled)
      if (!abortControllerRef.current?.signal.aborted) {
        await performUpload(faceDescriptor);
      }
    }
  };

  const cropImageToFace = async (
    imageUri: string,
    boundingBox: { x: number; y: number; width: number; height: number },
    originalDimensions: { width: number; height: number }
  ): Promise<{ uri: string; width: number; height: number }> => {
    try {
      // API now returns coordinates in original image space, so use them directly
      // But we need to validate and clamp to ensure they're within image bounds
      
      // Validate aspect ratio before cropping to catch any partial faces that slipped through
      const aspectRatio = boundingBox.width / boundingBox.height;
      if (aspectRatio < 0.75 || aspectRatio > 1.4) {
        throw new Error(`Invalid face aspect ratio (${aspectRatio.toFixed(2)}). This may be a partial face.`);
      }
      
      const cropX = Math.max(0, Math.min(Math.round(boundingBox.x), originalDimensions.width - 1));
      const cropY = Math.max(0, Math.min(Math.round(boundingBox.y), originalDimensions.height - 1));
      
      // Calculate maximum allowed width and height
      const maxWidth = originalDimensions.width - cropX;
      const maxHeight = originalDimensions.height - cropY;
      
      // Clamp width and height to ensure they don't exceed image bounds
      const cropWidth = Math.max(1, Math.min(Math.round(boundingBox.width), maxWidth));
      const cropHeight = Math.max(1, Math.min(Math.round(boundingBox.height), maxHeight));

      console.log('[PartnerPhotos] Cropping image to face:', {
        original: originalDimensions,
        boundingBox,
        crop: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
        aspectRatio: aspectRatio.toFixed(2),
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
    } catch (error) {
      console.error('[PartnerPhotos] Error cropping image:', error);
      throw error;
    }
  };

  const handleFaceSelected = async (detection: any) => {
    console.log('[PartnerPhotos] Face selected:', {
      hasDescriptor: !!detection.descriptor,
      descriptorLength: detection.descriptor?.length,
      boundingBox: detection.boundingBox,
    });
    setShowFaceSelectionModal(false);
    setSelectedFaceDescriptor(detection.descriptor);
    
    // Check session before opening progress modal
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Clean up state if session is missing
      setShowProgressModal(false);
      setUploadProgress('preparing');
      setUploading(false);
      setError('Not authenticated. Please sign in again.');
      Alert.alert('Authentication Error', 'Please sign in again to upload photos.');
      return;
    }
    
    // Crop image to selected face if bounding box is available
    // IMPORTANT: Use faceDetectionImageUri and faceDetectionImageDimensions because
    // the bounding boxes are in the coordinate space of the face detection image
    if (detection.boundingBox && faceDetectionImageUri && faceDetectionImageDimensions) {
      try {
        setShowProgressModal(true);
        setUploadProgress('preparing');
        
        console.log('[PartnerPhotos] Cropping image to selected face...', {
          boundingBox: detection.boundingBox,
          imageUri: faceDetectionImageUri,
          imageDimensions: faceDetectionImageDimensions,
        });
        const cropped = await cropImageToFace(
          faceDetectionImageUri,
          detection.boundingBox,
          faceDetectionImageDimensions
        );
        
        // Update upload data with cropped image
        uploadDataRef.current.optimizedUri = cropped.uri;
        uploadDataRef.current.width = cropped.width;
        uploadDataRef.current.height = cropped.height;
        
        // Update selected image URI for preview
        setSelectedImageUri(cropped.uri);
        
        console.log('[PartnerPhotos] Image cropped successfully', {
          width: cropped.width,
          height: cropped.height,
        });
      } catch (error) {
        console.error('[PartnerPhotos] Error cropping image:', error);
        Alert.alert(
          'Crop Failed',
          'Failed to crop image. Using original photo instead.',
          [{ text: 'OK' }]
        );
        // Continue with original image if cropping fails
      }
    }
    
    // Reopen progress modal before analysis to maintain user feedback
    setShowProgressModal(true);
    setUploadProgress('analyzing_matches');
    await handleFaceAnalysis(detection.descriptor);
  };

  const handleNoFaceProceed = async () => {
    trackButtonClick('upload_anyway_no_face', 'Upload Anyway', 'PartnerPhotos', { partner_id: partnerId });
    setShowNoFaceModal(false);
    setShowProgressModal(true);
    setUploadProgress('uploading');
    await performUpload(null);
  };

  const handleSamePersonConfirm = async () => {
    trackButtonClick('upload_anyway_same_person', 'Proceed Anyway', 'PartnerPhotos', { partner_id: partnerId });
    setShowSamePersonModal(false);
    setShowProgressModal(true);
    setUploadProgress('uploading');
    if (selectedFaceDescriptor) {
      await performUpload(selectedFaceDescriptor);
    }
  };

  const handleDifferentPartnerUploadAnyway = async () => {
    setShowProgressModal(true);
    setUploadProgress('uploading');
    if (selectedFaceDescriptor) {
      await performUpload(selectedFaceDescriptor);
    }
  };

  const handleUploadToDifferentPartner = async (targetPartnerId: string) => {
    
    if (!uploadDataRef.current || !selectedFaceDescriptor) {
      Alert.alert('Error', 'Upload data not available');
      return;
    }

    // Upload to the target partner instead
    setShowProgressModal(true);
    setUploadProgress('uploading');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const uploadData = uploadDataRef.current;

      const formData = new FormData();
      formData.append('file', {
        uri: uploadData.optimizedUri,
        type: uploadData.mimeType,
        name: uploadData.fileName,
      } as any);
      formData.append('width', uploadData.width.toString());
      formData.append('height', uploadData.height.toString());
      formData.append('faceDescriptor', JSON.stringify(selectedFaceDescriptor));

      // Use resilientFetch instead of basic fetch for retry logic, timeout handling, and session refresh
      const uploadResponse = await resilientFetch(`${apiUrl}/api/partners/${targetPartnerId}/photos`, {
        method: 'POST',
        body: formData,
        timeout: 60000, // 60 second timeout for upload
        retryOptions: {
          maxRetries: 2,
          initialDelay: 2000,
          maxDelay: 10000,
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
        setFaceDetectionImageUri(null);
        setFaceDetectionImageDimensions(null);
        setFaceDetections([]);
        setSelectedFaceDescriptor(null);
        setAnalysisData(null);
      }, 1000);

      // Reload photos for current partner (they might want to come back)
      await loadPhotos(partnerId);
      
      // Delay callback to prevent parent refresh flicker
      setTimeout(() => {
        onPhotoUploaded?.();
      }, 300);
    } catch (err) {
      console.error('Error uploading to different partner:', err);
      setShowProgressModal(false);
      setUploadProgress('preparing');
      setUploading(false);
      Alert.alert('Upload Error', err instanceof Error ? err.message : 'Failed to upload photo');
    }
  };

  const handleDeleteClick = (photoId: string) => {
    trackButtonClick('delete_photo_click', 'Delete', 'PartnerPhotos', { partner_id: partnerId, photo_id: photoId });
    
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => trackButtonClick('delete_photo_cancel', 'Cancel', 'PartnerPhotos', { partner_id: partnerId, photo_id: photoId }),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            trackButtonClick('delete_photo_confirm', 'Delete', 'PartnerPhotos', { partner_id: partnerId, photo_id: photoId });
            handleDeleteConfirm(photoId);
          },
        },
      ]
    );
  };

  const handleDeleteConfirm = async (photoId: string) => {
    if (deleting) return;

    try {
      setDeleting(photoId);
      setError(null);

      // Get session token for authentication - refresh if needed
      let { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // If session is invalid or expired, try to refresh it
      if (!session || sessionError) {
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshedSession) {
          throw new Error('Not authenticated. Please sign in again.');
        }
        session = refreshedSession;
      }

      if (!session) {
        throw new Error('Not authenticated');
      }

      // Use EXPO_PUBLIC_WEB_APP_URL if available, otherwise fallback to localhost
      const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      
      // Add timeout to prevent indefinite hanging (15 seconds should be enough for delete)
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[PartnerPhotos] Delete photo timeout triggered (15s)');
        timeoutController.abort();
      }, 15000); // 15 second timeout for delete
      
      const response = await fetch(`${apiUrl}/api/partners/${partnerId}/photos/${photoId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        signal: timeoutController.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Failed to delete photo');
      }

      // Reload photos (don't call onPhotoUploaded to avoid parent refresh flicker)
      await loadPhotos(partnerId);
    } catch (err: any) {
      console.error('Error deleting photo:', err);
      if (isMountedRef.current) {
        // Check if it's a timeout error
        const isTimeout = err?.name === 'AbortError' || err?.message?.includes('timeout') || err?.message?.includes('TIMEOUT');
        const errorMessage = isTimeout 
          ? 'Delete request timed out. Please try again.'
          : (err instanceof Error ? err.message : 'Failed to delete photo');
        setError(errorMessage);
        Alert.alert('Delete Error', errorMessage);
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
        style={[styles.uploadButton, (uploading || deleting) && styles.uploadButtonDisabled]}
        onPress={handleUploadPhoto}
        disabled={uploading || !!deleting}
      >
        {uploading ? (
          <>
            <ActivityIndicator size="small" color="#fff" style={styles.uploadSpinner} />
            <Text style={styles.uploadButtonText}>Uploading...</Text>
          </>
        ) : deleting ? (
          <>
            <ActivityIndicator size="small" color="#fff" style={styles.uploadSpinner} />
            <Text style={styles.uploadButtonText}>Deleting...</Text>
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
                    style={[styles.deleteButton, deleting !== null && styles.deleteButtonDisabled]}
                    onPress={() => handleDeleteClick(item.id)}
                    disabled={deleting !== null}
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
          setError(null);
        }}
        onCancel={cancelUpload}
      />

      {/* Face Selection Modal */}
      {(faceDetectionImageUri || selectedImageUri) && (
        <FaceSelectionModal
          visible={showFaceSelectionModal}
          imageUri={faceDetectionImageUri || selectedImageUri || ''}
          detections={faceDetections}
          onSelect={handleFaceSelected}
          imageDimensions={faceDetectionImageDimensions || undefined}
          onCancel={() => {
            setShowFaceSelectionModal(false);
            setShowProgressModal(false);
            setUploadProgress('preparing');
            setUploading(false);
            uploadDataRef.current = null;
            setSelectedImageUri(null);
            setFaceDetectionImageUri(null);
            setFaceDetectionImageDimensions(null);
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
          setFaceDetectionImageUri(null);
          setFaceDetectionImageDimensions(null);
          setNoFaceErrorMessage(undefined);
        }}
        partnerId={partnerId}
        errorMessage={noFaceErrorMessage}
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
          setFaceDetectionImageUri(null);
          setFaceDetectionImageDimensions(null);
          setSelectedFaceDescriptor(null);
          setAnalysisData(null);
        }}
      />

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
  deleteButtonDisabled: {
    opacity: 0.5,
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
