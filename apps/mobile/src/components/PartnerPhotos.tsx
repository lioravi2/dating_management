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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:optimizeImage:result',message:'Image optimization result',data:{outputWidth:result.width,outputHeight:result.height,uri:result.uri?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      mimeType: 'image/jpeg',
    };
  };

  const performUpload = async (faceDescriptor: number[] | null = null) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:performUpload:entry',message:'Starting photo upload',data:{hasFaceDescriptor:!!faceDescriptor,hasUploadData:!!uploadDataRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
    if (!uploadDataRef.current) {
      throw new Error('Upload data not available');
    }

    // Check if cancelled before upload
    if (abortControllerRef.current?.signal.aborted) {
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    const uploadData = uploadDataRef.current;
    const uploadStartTime = Date.now();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:performUpload:uploadStart',message:'Starting file upload',data:{endpoint:`${apiUrl}/api/partners/${partnerId}/photos`,width:uploadData.width,height:uploadData.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion

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
      signal: abortControllerRef.current?.signal,
    });
    const uploadDuration = Date.now() - uploadStartTime;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:performUpload:uploadResponse',message:'Upload response received',data:{duration:uploadDuration,status:uploadResponse.status,ok:uploadResponse.ok,aborted:abortControllerRef.current?.signal.aborted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion

    // Check if cancelled during fetch
    if (abortControllerRef.current?.signal.aborted) {
      return;
    }

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }));
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:performUpload:uploadError',message:'Upload failed',data:{status:uploadResponse.status,error:errorData.error || errorData.details},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      throw new Error(errorData.error || errorData.details || `Failed to upload photo (${uploadResponse.status})`);
    }

    // Check if cancelled after upload completes
    if (abortControllerRef.current?.signal.aborted) {
      return;
    }

    setUploadProgress('complete');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:performUpload:uploadSuccess',message:'Upload completed successfully',data:{totalDuration:Date.now() - uploadStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
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

  const cancelUpload = () => {
    // Abort any ongoing fetch requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clean up all state
    setShowProgressModal(false);
    setShowFaceSelectionModal(false);
    setShowNoFaceModal(false);
    setShowSamePersonModal(false);
    setShowDifferentPartnerModal(false);
    setUploadProgress('preparing');
    setUploading(false);
    setError(null);
    uploadDataRef.current = null;
    setSelectedImageUri(null);
    setFaceDetections([]);
    setSelectedFaceDescriptor(null);
    setAnalysisData(null);
  };

  const handleUploadPhoto = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:handleUploadPhoto:entry',message:'Upload started',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:handleUploadPhoto:asset',message:'Image selected',data:{width:asset.width,height:asset.height,fileSize:asset.fileSize,uri:asset.uri?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      setError(null);
      setUploading(true);
      setShowProgressModal(true);
      setUploadProgress('preparing');

      // Create abort controller for this upload
      abortControllerRef.current = new AbortController();
      const optimizeStartTime = Date.now();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:handleUploadPhoto:optimizeStart',message:'Starting image optimization',data:{originalWidth:asset.width,originalHeight:asset.height},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion

      // Optimize image first
      const optimized = await optimizeImage(
        asset.uri,
        asset.width,
        asset.height
      );
      const optimizeDuration = Date.now() - optimizeStartTime;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:handleUploadPhoto:optimizeEnd',message:'Image optimization complete',data:{duration:optimizeDuration,optimizedWidth:optimized.width,optimizedHeight:optimized.height,mimeType:optimized.mimeType},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion

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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:handleUploadPhoto:apiUrl',message:'API URL configured',data:{apiUrl:apiUrl,hasToken:!!session.access_token},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
      // #endregion

      // Step 1: Face Detection
      setUploadProgress('detecting_faces');
      let detections: any[] = [];
      const faceDetectStartTime = Date.now();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:handleUploadPhoto:faceDetectStart',message:'Starting face detection',data:{endpoint:`${apiUrl}/api/face-detection/detect`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      try {
        const detectFormData = new FormData();
        detectFormData.append('file', {
          uri: optimized.uri,
          type: optimized.mimeType,
          name: uploadDataRef.current.fileName,
        } as any);

        // Add client-side timeout (25 seconds) to prevent indefinite waiting
        // Server timeout is typically 30 seconds, so we timeout slightly earlier
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
          timeoutController.abort();
        }, 25000); // 25 second client timeout

        // Use the abort controller signal if available, otherwise use timeout signal
        const fetchSignal = abortControllerRef.current?.signal || timeoutController.signal;

        let detectResponse: Response;
        try {
          detectResponse = await fetch(`${apiUrl}/api/face-detection/detect`, {
            method: 'POST',
            body: detectFormData,
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            signal: fetchSignal,
          });
          clearTimeout(timeoutId);
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          // If it's a timeout error from our client-side timeout, throw a specific error
          if (fetchError?.name === 'AbortError' && timeoutController.signal.aborted) {
            throw new Error('CLIENT_TIMEOUT');
          }
          throw fetchError;
        }
        const faceDetectDuration = Date.now() - faceDetectStartTime;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:handleUploadPhoto:faceDetectResponse',message:'Face detection response received',data:{duration:faceDetectDuration,status:detectResponse.status,ok:detectResponse.ok,aborted:abortControllerRef.current?.signal.aborted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion

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

          // Handle response - check for detections array (could be empty array, null, or undefined)
          if (Array.isArray(detectData.detections) && detectData.detections.length > 0) {
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
          // Face detection failed - check if it's a timeout
          const errorText = await detectResponse.text();
          console.log('[PartnerPhotos] Face detection failed:', detectResponse.status, errorText);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:handleUploadPhoto:faceDetectError',message:'Face detection failed',data:{status:detectResponse.status,errorText:errorText.substring(0,200),isTimeout:detectResponse.status === 504 || errorText.includes('TIMEOUT') || errorText.includes('FUNCTION_INVOCATION_TIMEOUT')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:handleUploadPhoto:faceDetectException',message:'Face detection exception',data:{errorName:detectError?.name,errorMessage:detectError?.message?.substring(0,200),isAbort:detectError?.name === 'AbortError',signalAborted:abortControllerRef.current?.signal.aborted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        // Check if error is due to user cancellation
        if (abortControllerRef.current?.signal.aborted && detectError?.name === 'AbortError') {
          console.log('[PartnerPhotos] Face detection cancelled by user');
          return;
        }
        
        // Check if it's a timeout (client-side or server-side)
        const isTimeout = detectError?.message === 'CLIENT_TIMEOUT' || 
                         detectError?.message?.includes('TIMEOUT') ||
                         detectError?.message?.includes('timeout');
        
        // Check if it's a network error
        const isNetworkError = detectError?.message?.includes('Network request failed') || 
                              detectError?.message?.includes('Failed to fetch') ||
                              detectError?.name === 'TypeError';
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PartnerPhotos.tsx:handleUploadPhoto:networkErrorCheck',message:'Network error check',data:{isNetworkError:isNetworkError,isTimeout:isTimeout},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        
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
        
        console.error('[PartnerPhotos] Face detection error:', detectError);
        
        // For other errors, proceed with upload silently
        // Only proceed with upload if we're still in an active upload state
        if (isMountedRef.current && uploading && !abortControllerRef.current?.signal.aborted) {
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
      const analyzeResponse = await fetch(`${apiUrl}/api/partners/${partnerId}/photos/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ faceDescriptor }),
        signal: abortControllerRef.current?.signal,
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
          // Show different partner warning
          setShowProgressModal(false);
          setShowDifferentPartnerModal(true);
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

  const handleFaceSelected = async (detection: any) => {
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
          setError(null);
        }}
        onCancel={cancelUpload}
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

