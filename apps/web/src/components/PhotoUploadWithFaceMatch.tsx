'use client';

import { useState, useRef, useEffect } from 'react';
import { useFaceDetection } from '@/lib/hooks/useFaceDetection';
import { FaceSelectionUI } from './FaceSelectionUI';
import { FaceDetectionResult, MultipleFaceDetectionResult } from '@/lib/face-detection/types';
import { PhotoUploadAnalysis, FaceMatch, FREE_TIER_PHOTO_LIMIT } from '@/shared';
import { useNavigation } from '@/lib/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { getPhotoUrl } from '@/lib/photo-utils';
import Link from 'next/link';
import AlertDialog from './AlertDialog';
import { ImagePicker, ImagePickerRef } from './ImagePicker';
import { fileUtils } from '@/lib/file-utils';
import { imageProcessor } from '@/lib/image-processing';

interface PhotoUploadWithFaceMatchProps {
  partnerId?: string; // If provided, upload to this partner. If not, analyze across all partners.
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PhotoUploadWithFaceMatch({
  partnerId,
  onSuccess,
  onCancel,
}: PhotoUploadWithFaceMatchProps) {
  const navigation = useNavigation();
  const imagePickerRef = useRef<ImagePickerRef>(null);
  const { modelsLoaded, loading, error: detectionError, detectFace, detectAllFaces } = useFaceDetection();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  
  // Use refs to preserve file and dimensions across async operations
  const fileRef = useRef<File | null>(null);
  const dimensionsRef = useRef<{ width: number; height: number } | null>(null);
  const [detectionResult, setDetectionResult] = useState<FaceDetectionResult | null>(null);
  const [multipleDetections, setMultipleDetections] = useState<FaceDetectionResult[] | null>(null);
  const [analysis, setAnalysis] = useState<PhotoUploadAnalysis | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userAccountType, setUserAccountType] = useState<'free' | 'pro' | null>(null);
  const [photoLimitMessage, setPhotoLimitMessage] = useState<{ type: 'error'; text: string | React.ReactNode } | null>(null);
  const [mounted, setMounted] = useState(false);

  // Modal states
  const [showNoFaceModal, setShowNoFaceModal] = useState(false);
  const [showMultipleFacesModal, setShowMultipleFacesModal] = useState(false);
  const [showSamePersonModal, setShowSamePersonModal] = useState(false);
  const [showCreateNewPartnerModal, setShowCreateNewPartnerModal] = useState(false);
  
  // Alert dialog state
  const [alertDialog, setAlertDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: '', message: '' });

  // Fetch user account type on mount
  useEffect(() => {
    const fetchAccountType = async () => {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('account_type')
          .eq('id', user.id)
          .single();
        if (data) {
          setUserAccountType(data.account_type as 'free' | 'pro');
        }
      }
    };
    fetchAccountType();
  }, []);

  // Handle file selection from ImagePicker (receives File directly)
  const handleFileSelect = async (file: File) => {
    if (!file) return;
    
    // Prevent multiple file selections while processing
    if (uploading || analyzing) {
      console.log('[PhotoUpload] Ignoring file selection - already processing');
      return;
    }

    // Clear any existing modal state from sessionStorage when selecting a new photo
    sessionStorage.removeItem('photoUploadModal');

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setAlertDialog({
        open: true,
        title: 'Invalid File Type',
        message: 'Please select an image file',
      });
      return;
    }

    // Check photo limit for free users BEFORE face detection
    if (userAccountType === 'free') {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Get all partner IDs for this user
        const { data: partners, error: partnersError } = await supabase
          .from('partners')
          .select('id')
          .eq('user_id', user.id);

        // FIXED: Handle error case - fail-safe: block upload if we can't verify photo count
        if (partnersError) {
          console.error('Error fetching partners for photo limit check:', partnersError);
          setPhotoLimitMessage({
            type: 'error',
            text: 'Unable to verify photo limit. Please try again or contact support.'
          });
          setTimeout(() => setPhotoLimitMessage(null), 5000);
          return;
        }

        if (partners && partners.length > 0) {
          const partnerIds = partners.map(p => p.id);
          const { count, error: countError } = await supabase
            .from('partner_photos')
            .select('*', { count: 'exact', head: true })
            .in('partner_id', partnerIds);

          // FIXED: Handle count error - fail-safe: block upload if we can't verify photo count
          if (countError) {
            console.error('Error counting photos for limit check:', countError);
            setPhotoLimitMessage({
              type: 'error',
              text: 'Unable to verify photo limit. Please try again or contact support.'
            });
            setTimeout(() => setPhotoLimitMessage(null), 5000);
            return;
          }

          if (count !== null && count >= FREE_TIER_PHOTO_LIMIT) {
            setPhotoLimitMessage({
              type: 'error',
              text: (
                <>
                  Your free subscription is limited to {FREE_TIER_PHOTO_LIMIT} photos. Please{' '}
                  <Link href="/upgrade" className="underline font-semibold">
                    upgrade to Pro
                  </Link>{' '}
                  to upload more photos.
                </>
              ),
            });
            // Clear message after 10 seconds
            setTimeout(() => setPhotoLimitMessage(null), 10000);
            return;
          }
        } else {
          // No partners yet, so count is 0 - allow upload
        }
      }
    }

    setSelectedFile(file);
    fileRef.current = file; // Store in ref immediately
    setUploadError(null);
    setPhotoLimitMessage(null); // Clear any previous photo limit messages
    setDetectionResult(null);
    setMultipleDetections(null);
    setAnalysis(null);

    // Create image URL for preview
    const url = URL.createObjectURL(file);
    setImageUrl(url);

    // Get image dimensions
    const img = new Image();
    img.onload = async () => {
      const dims = { width: img.width, height: img.height };
      setImageDimensions(dims);
      dimensionsRef.current = dims; // Store in ref immediately

      // Wait for models to load
      if (!modelsLoaded) {
        alert('Face detection models are still loading. Please wait...');
        setImageUrl(null);
        setSelectedFile(null);
        return;
      }

      // Show analyzing state
      setAnalyzing(true);

      // Detect all faces first
      console.log('[PhotoUpload] Detecting faces in image...');
      const allFacesResult: MultipleFaceDetectionResult = await detectAllFaces(img);
      console.log('[PhotoUpload] Face detection result:', { 
        detectionsCount: allFacesResult.detections.length, 
        error: allFacesResult.error 
      });
      
      if (allFacesResult.error) {
        setAnalyzing(false);
        setAlertDialog({
          open: true,
          title: 'Face Detection Error',
          message: allFacesResult.error || 'Unknown face detection error',
        });
        return;
      }
      
      setAnalyzing(false);

      if (allFacesResult.detections.length === 0) {
        // No face detected
        console.log('[PhotoUpload] No faces detected');
        setAnalyzing(false);
        setShowNoFaceModal(true);
        return;
      }

      if (allFacesResult.detections.length > 1) {
        // Multiple faces - show selection UI
        console.log('[PhotoUpload] Multiple faces detected:', allFacesResult.detections.length);
        setAnalyzing(false);
        setMultipleDetections(allFacesResult.detections);
        setShowMultipleFacesModal(true);
        return;
      }

      // Single face detected - proceed with analysis
      console.log('[PhotoUpload] Single face detected, proceeding to analysis');
      const singleDetection = allFacesResult.detections[0];
      setDetectionResult(singleDetection);
      await analyzeFace(singleDetection);
    };

    img.onerror = () => {
      setAlertDialog({
        open: true,
        title: 'Image Load Error',
        message: 'Failed to load image',
      });
      setSelectedFile(null);
      setImageUrl(null);
    };

    img.src = url;
  };

  // Handle clipboard paste events
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle paste if component is ready and not currently processing
      if (uploading || analyzing || !modelsLoaded) {
        return;
      }

      // Check if clipboard contains image data
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Check if the item is an image
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (!blob) continue; // Skip this item and check the next one
          
          e.preventDefault(); // Only prevent default if we have a valid blob

          // Convert blob to File object with appropriate name
          const fileExtension = blob.type.split('/')[1] || 'png';
          const fileName = `pasted-image-${Date.now()}.${fileExtension}`;
          const file = new File([blob], fileName, {
            type: blob.type || 'image/png'
          });

          // Call handleFileSelect directly with the File
          await handleFileSelect(file);
          break; // Successfully processed an image, exit loop
        }
      }
    };

    // Add paste event listener to document
    document.addEventListener('paste', handlePaste);
    
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [uploading, analyzing, modelsLoaded]);

  const cropImageToFace = async (
    imageUrl: string,
    boundingBox: { x: number; y: number; width: number; height: number },
    originalFileName?: string
  ): Promise<{ file: File; dimensions: { width: number; height: number } }> => {
    try {
      // Load image using abstraction with crossOrigin for CORS support
      const webImage = await imageProcessor.loadImage(imageUrl, 'anonymous');
      
      // Create canvas for the cropped face using abstraction
      const canvas = imageProcessor.createCanvas(boundingBox.width, boundingBox.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      // Draw the cropped region using abstraction
      ctx.drawImage(
        webImage,
        boundingBox.x,
        boundingBox.y,
        boundingBox.width,
        boundingBox.height,
        0,
        0,
        boundingBox.width,
        boundingBox.height
      );
      
      // Convert canvas to blob using abstraction
      const blob = await canvas.toBlob('image/jpeg', 0.95); // Use JPEG with 95% quality
      
      // Get original file name and extension
      const fileName = originalFileName || 'face.jpg';
      const fileExt = fileName.split('.').pop() || 'jpg';
      const croppedFileName = `cropped_face.${fileExt}`;
      
      const file = new File([blob], croppedFileName, {
        type: blob.type || 'image/jpeg',
        lastModified: Date.now(),
      });
      
      return {
        file,
        dimensions: { width: boundingBox.width, height: boundingBox.height },
      };
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to crop face from image');
    }
  };

  const handleFaceSelection = async (detection: FaceDetectionResult) => {
    setShowMultipleFacesModal(false);
    setDetectionResult(detection);
    
    // If we have a bounding box, crop the image to just the selected face
    if (detection.boundingBox && imageUrl) {
      try {
        console.log('[PhotoUpload] Cropping image to selected face...', detection.boundingBox);
        const originalFileName = fileRef.current?.name || selectedFile?.name;
        const { file: croppedFile, dimensions: croppedDims } = await cropImageToFace(
          imageUrl,
          detection.boundingBox,
          originalFileName
        );
        
        // Update refs and state with cropped file
        fileRef.current = croppedFile;
        setSelectedFile(croppedFile);
        dimensionsRef.current = croppedDims;
        setImageDimensions(croppedDims);
        
        // Update preview to show cropped image
        const croppedUrl = URL.createObjectURL(croppedFile);
        setImageUrl(croppedUrl);
        
        console.log('[PhotoUpload] Image cropped successfully', {
          fileName: croppedFile.name,
          size: croppedFile.size,
          dimensions: croppedDims
        });
      } catch (error) {
        console.error('[PhotoUpload] Error cropping image:', error);
        setAlertDialog({
          open: true,
          title: 'Crop Failed',
          message: 'Failed to crop image. Using original photo instead.',
        });
        // Continue with original file if cropping fails
      }
    }
    
    await analyzeFace(detection);
  };

  const analyzeFace = async (detection: FaceDetectionResult) => {
    if (!detection.descriptor) {
      setAlertDialog({
        open: true,
        title: 'Face Detection Error',
        message: 'No face descriptor available',
      });
      return;
    }

    console.log('[PhotoUpload] Starting face analysis...', { partnerId, descriptorLength: detection.descriptor.length });
    setAnalyzing(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      if (partnerId) {
        // Use Case 1: Upload to specific partner
        console.log('[PhotoUpload] Calling analyze API for partner:', partnerId);
        const response = await fetch(`/api/partners/${partnerId}/photos/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ faceDescriptor: detection.descriptor }),
        });

        console.log('[PhotoUpload] Analyze API response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[PhotoUpload] Analyze API error:', errorData);
          throw new Error(errorData.error || `HTTP ${response.status}: Failed to analyze photo`);
        }

        const analysis: PhotoUploadAnalysis = await response.json();
        console.log('[PhotoUpload] Analysis result:', analysis);
        setAnalysis(analysis);

        // Handle decision
        console.log('[PhotoUpload] Decision type:', analysis.decision.type);
        if (analysis.decision.type === 'proceed') {
          console.log('[PhotoUpload] Proceeding with upload...', { 
            hasSelectedFile: !!selectedFile,
            hasFileRef: !!fileRef.current,
            hasImageDimensions: !!imageDimensions,
            hasDimsRef: !!dimensionsRef.current
          });
          // Pass file and dimensions from refs (most reliable) or state
          await uploadPhoto(
            detection.descriptor, 
            fileRef.current || selectedFile || undefined, 
            dimensionsRef.current || imageDimensions || undefined
          );
        } else if (analysis.decision.type === 'warn_same_person') {
          console.log('[PhotoUpload] Showing same person warning modal');
          setShowSamePersonModal(true);
        } else if (analysis.decision.type === 'warn_other_partners') {
          console.log('[PhotoUpload] Navigating to similar photos page');
          // Navigate to dedicated page instead of showing modal
          const analysisParam = encodeURIComponent(JSON.stringify(analysis));
          // Store image and upload data in sessionStorage for "Upload Anyway" functionality
          const fileToConvert = fileRef.current || selectedFile;
          const uploadDataKey = `upload-data-${partnerId}-${Date.now()}`;
          
          if (fileToConvert && detection.descriptor) {
            try {
              console.log('[PhotoUpload] Storing upload data for "Upload Anyway" functionality');
              // Convert file to base64 for storage
              const base64Url = await fileUtils.fileToBase64(fileToConvert);
              const imageKey = `similar-photos-image-${Date.now()}`;
              sessionStorage.setItem(imageKey, base64Url);
              
              // Store upload data (file as base64, descriptor, dimensions)
              const uploadData = {
                fileBase64: base64Url,
                faceDescriptor: detection.descriptor,
                dimensions: dimensionsRef.current || imageDimensions,
                fileName: fileToConvert.name,
                fileType: fileToConvert.type,
              };
              sessionStorage.setItem(uploadDataKey, JSON.stringify(uploadData));
              
              // Pass keys in URL
              navigation.push(`/partners/${partnerId}/similar-photos`, { analysis: analysisParam, imageKey, uploadDataKey });
            } catch (error) {
              console.error('[PhotoUpload] Failed to store upload data:', error);
              console.warn('[PhotoUpload] Navigating without upload data');
              navigation.push(`/partners/${partnerId}/similar-photos`, { analysis: analysisParam });
            }
          } else {
            console.log('[PhotoUpload] No file or descriptor available for storage');
            navigation.push(`/partners/${partnerId}/similar-photos`, { analysis: analysisParam });
          }
        }
      } else {
        // Use Case 2: Upload without partner selection
        const response = await fetch('/api/photos/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ faceDescriptor: detection.descriptor }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `HTTP ${response.status}: Failed to analyze photo`);
        }

        const result = await response.json();
        if (result.decision === 'create_new') {
          // If no partnerId, navigate to no-matches page instead of showing modal
          if (!partnerId) {
            // Store image and upload data for later use
            const fileToConvert = fileRef.current || selectedFile;
            if (fileToConvert) {
              try {
                const base64Url = await fileUtils.fileToBase64(fileToConvert);
                const imageKey = `upload-photo-image-${Date.now()}`;
                sessionStorage.setItem(imageKey, base64Url);
                
                // Store upload data for creating partner and uploading photo
                const uploadDataKey = `upload-photo-data-${Date.now()}`;
                const uploadData = {
                  fileBase64: base64Url,
                  faceDescriptor: detection.descriptor,
                  width: imageDimensions?.width || 0,
                  height: imageDimensions?.height || 0,
                };
                sessionStorage.setItem(uploadDataKey, JSON.stringify(uploadData));
                
                navigation.push('/upload-photo/no-matches', { imageKey, uploadDataKey });
              } catch (error) {
                console.error('[PhotoUpload] Failed to convert image to base64:', error);
                navigation.push('/upload-photo/no-matches');
              }
            } else {
              navigation.push('/upload-photo/no-matches');
            }
          } else {
            // If partnerId exists, show modal (existing behavior)
            setShowCreateNewPartnerModal(true);
          }
        } else if (result.decision === 'warn_matches') {
          // Set analysis for displaying matches
          const analysis: PhotoUploadAnalysis = {
            decision: {
              type: 'warn_other_partners',
              matches: result.matches || [],
              reason: 'matches_other_partners',
            },
            partnerMatches: [],
            otherPartnerMatches: result.matches || [],
            partnerHasOtherPhotos: false,
          };
          setAnalysis(analysis);
          // Navigate to generic similar photos page (no partnerId required)
          const analysisParam = encodeURIComponent(JSON.stringify(analysis));
          // Store image in sessionStorage instead of URL params (base64 URLs are too long)
          const fileToConvert = fileRef.current || selectedFile;
          if (fileToConvert) {
            try {
              console.log('[PhotoUpload] Converting image to base64, file size:', fileToConvert.size);
              const base64Url = await fileUtils.fileToBase64(fileToConvert);
              console.log('[PhotoUpload] Base64 conversion successful, length:', base64Url.length);
              // Store in sessionStorage with a unique key
              const imageKey = `similar-photos-image-${Date.now()}`;
              sessionStorage.setItem(imageKey, base64Url);
              
              // Store upload data for uploading to selected partner
              const uploadDataKey = `upload-photo-data-${Date.now()}`;
              const uploadData = {
                fileBase64: base64Url,
                faceDescriptor: detection.descriptor,
                width: imageDimensions?.width || 0,
                height: imageDimensions?.height || 0,
              };
              sessionStorage.setItem(uploadDataKey, JSON.stringify(uploadData));
              
              // Pass both keys in URL
              navigation.push('/similar-photos', { analysis: analysisParam, imageKey, uploadDataKey });
            } catch (error) {
              console.error('[PhotoUpload] Failed to convert image to base64:', error);
              console.warn('[PhotoUpload] Navigating without image preview due to conversion failure');
              navigation.push('/similar-photos', { analysis: analysisParam });
            }
          } else {
            console.log('[PhotoUpload] No file available for conversion');
            navigation.push('/similar-photos', { analysis: analysisParam });
          }
        }
      }
    } catch (error) {
      console.error('Error analyzing face:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Full error details:', error);
      setAlertDialog({
        open: true,
        title: 'Analysis Error',
        message: `Failed to analyze photo: ${errorMessage}. Please check the console for details.`,
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const uploadPhoto = async (
    faceDescriptor: number[] | null,
    file?: File,
    dimensions?: { width: number; height: number }
  ) => {
    // Use provided parameters, then refs, then state (in that order)
    const fileToUpload = file || fileRef.current || selectedFile;
    const dims = dimensions || dimensionsRef.current || imageDimensions;

    if (!fileToUpload || !dims) {
      console.error('[PhotoUpload] Cannot upload: missing file or dimensions', { 
        hasFile: !!fileToUpload, 
        hasDimensions: !!dims,
        fileParam: !!file,
        dimsParam: !!dimensions,
        stateFile: !!selectedFile,
        stateDims: !!imageDimensions
      });
      return;
    }

    console.log('[PhotoUpload] Starting photo upload...', { partnerId, fileName: fileToUpload.name, fileSize: fileToUpload.size });
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      if (faceDescriptor) {
        formData.append('faceDescriptor', JSON.stringify(faceDescriptor));
      }
      formData.append('width', dims.width.toString());
      formData.append('height', dims.height.toString());

      console.log('[PhotoUpload] Sending upload request to API...');
      const response = await fetch(`/api/partners/${partnerId}/photos`, {
        method: 'POST',
        body: formData,
      });

      console.log('[PhotoUpload] Upload API response status:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = error.details || error.error || `HTTP ${response.status}: Failed to upload photo`;
        console.error('[PhotoUpload] Upload error response:', error);
        throw new Error(errorMessage);
      }

      const { photo } = await response.json();
      console.log('[PhotoUpload] Photo uploaded successfully:', photo);

      // Show success message
      setUploadSuccess(true);
      
      // Reset state after a short delay
      setTimeout(() => {
        resetState();
        setUploadSuccess(false);
        onSuccess?.();
      }, 2000);
    } catch (error) {
      console.error('Error uploading photo:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const resetState = () => {
    setSelectedFile(null);
    fileRef.current = null; // Clear ref too
    setImageUrl(null);
    setImageDimensions(null);
    dimensionsRef.current = null; // Clear ref too
    setDetectionResult(null);
    setMultipleDetections(null);
    setAnalysis(null);
    setUploadError(null);
    setUploadSuccess(false);
    setAnalyzing(false);
    setUploading(false);
    setPhotoLimitMessage(null);
  };

  // Set mounted state to prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check for uploadPhoto query param with uploadDataKey and restore/upload if needed
  useEffect(() => {
    if (!mounted || !partnerId) return;
    
    const params = navigation.getParams();
    const uploadPhotoParam = params.uploadPhoto;
    const uploadDataKey = params.uploadDataKey as string | undefined;
    
    if (uploadPhotoParam === 'true' && uploadDataKey) {
      // Add a small delay to ensure navigation has completed and sessionStorage is accessible
      const checkAndUpload = () => {
      console.log('[PhotoUpload] uploadPhoto=true with uploadDataKey detected, checking for stored upload data');
      console.log('[PhotoUpload] Looking for key:', uploadDataKey);
      console.log('[PhotoUpload] All sessionStorage keys:', Object.keys(sessionStorage));
      
      let storedData = sessionStorage.getItem(uploadDataKey);
      let actualKey = uploadDataKey;
      
      // If exact key not found, try to find any upload data key
      if (!storedData) {
        console.log('[PhotoUpload] Exact key not found, searching for any upload data...');
        const allKeys = Object.keys(sessionStorage);
        const uploadDataKeys = allKeys.filter(key => 
          key.startsWith('upload-photo-data-') || key.startsWith('upload-data-')
        );
        console.log('[PhotoUpload] Found upload data keys:', uploadDataKeys);
        
        if (uploadDataKeys.length > 0) {
          // Try the most recent one (highest timestamp)
          const sortedKeys = uploadDataKeys.sort((a, b) => {
            const timestampA = parseInt(a.split('-').pop() || '0');
            const timestampB = parseInt(b.split('-').pop() || '0');
            return timestampB - timestampA;
          });
          const fallbackKey = sortedKeys[0];
          console.log('[PhotoUpload] Using fallback key:', fallbackKey);
          storedData = sessionStorage.getItem(fallbackKey);
          actualKey = fallbackKey;
          
          // If we found data with fallback key, update the URL to use it
          if (storedData) {
            navigation.replace(`/partners/${partnerId}`, { uploadPhoto: 'true', uploadDataKey: fallbackKey });
          }
        }
      }
      
      if (storedData) {
        (async () => {
          try {
            const uploadData = JSON.parse(storedData);
            console.log('[PhotoUpload] Restoring upload data from sessionStorage');
            
            // Convert base64 back to File
            const base64Data = uploadData.fileBase64.split(',')[1] || uploadData.fileBase64;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            // Try to detect MIME type from base64 or default to image/jpeg
            const mimeType = uploadData.fileBase64.startsWith('data:') 
              ? uploadData.fileBase64.split(';')[0].split(':')[1] 
              : 'image/jpeg';
            const blob = new Blob([byteArray], { type: mimeType });
            const file = new File([blob], `photo-${Date.now()}.jpg`, { type: mimeType });
            
            // Restore state
            fileRef.current = file;
            setSelectedFile(file);
            const dims = { width: uploadData.width, height: uploadData.height };
            dimensionsRef.current = dims;
            setImageDimensions(dims);
            
            // Create detection result from stored descriptor
            const restoredDetection: FaceDetectionResult = {
              descriptor: uploadData.faceDescriptor,
              boundingBox: null,
              confidence: 1.0,
              error: null,
            };
            setDetectionResult(restoredDetection);
            
            // Trigger upload
            console.log('[PhotoUpload] Triggering upload with restored data');
            await uploadPhoto(
              restoredDetection.descriptor,
              file,
              dims
            );
            
            // Clean up sessionStorage after successful upload
            // Don't clean up immediately - wait a bit to ensure upload completes
            setTimeout(() => {
              sessionStorage.removeItem(actualKey);
              // Clean up related image key if exists
              const imageKey = params.imageKey as string | undefined;
              if (imageKey) {
                sessionStorage.removeItem(imageKey);
              }
              // Clean up any other related keys
              Object.keys(sessionStorage).forEach(key => {
                if (key.startsWith(`uploadToPartner-${actualKey}`)) {
                  sessionStorage.removeItem(key);
                }
              });
            }, 1000);
            
            // Remove query params from URL and navigate to partner page
            navigation.replace(`/partners/${partnerId}`);
          } catch (error) {
            console.error('[PhotoUpload] Failed to restore and upload:', error);
            setAlertDialog({
              open: true,
              title: 'Upload Failed',
              message: 'Failed to restore upload data. Please try uploading again.',
            });
            // Remove query params from URL
            navigation.replace(`/partners/${partnerId}`);
          }
        })();
      } else {
        console.warn('[PhotoUpload] uploadPhoto=true but no stored data found for key:', uploadDataKey);
        console.warn('[PhotoUpload] Available sessionStorage keys:', Object.keys(sessionStorage));
        setAlertDialog({
          open: true,
          title: 'Upload Data Not Found',
          message: 'The upload data could not be found. Please try uploading the photo again from the similar photos page.',
        });
        // Remove query params from URL
        navigation.replace(`/partners/${partnerId}`);
      }
      };
      
      // Small delay to ensure sessionStorage is accessible after navigation
      setTimeout(checkAndUpload, 100);
      return;
    }
    
    const uploadAnyway = params.uploadAnyway;
    if (uploadAnyway === 'true') {
      console.log('[PhotoUpload] uploadAnyway=true detected, checking for stored upload data');
      
      // Find the most recent upload data key for this partner
      const uploadDataKeys = Object.keys(sessionStorage)
        .filter(key => key.startsWith(`upload-data-${partnerId}-`))
        .sort((a, b) => {
          // Extract timestamp and sort descending (newest first)
          const timestampA = parseInt(a.split('-').pop() || '0');
          const timestampB = parseInt(b.split('-').pop() || '0');
          return timestampB - timestampA;
        });
      
      if (uploadDataKeys.length > 0) {
        const latestKey = uploadDataKeys[0];
        const storedData = sessionStorage.getItem(latestKey);
        
        if (storedData) {
          (async () => {
            try {
              const uploadData = JSON.parse(storedData);
              console.log('[PhotoUpload] Restoring upload data from sessionStorage');
              
              // Convert base64 back to File
              // base64 data URL format: data:image/jpeg;base64,/9j/4AAQ...
              const base64Data = uploadData.fileBase64.split(',')[1] || uploadData.fileBase64;
              const byteCharacters = atob(base64Data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: uploadData.fileType });
              const file = new File([blob], uploadData.fileName, { type: uploadData.fileType });
              
              // Restore state
              fileRef.current = file;
              setSelectedFile(file);
              dimensionsRef.current = uploadData.dimensions;
              setImageDimensions(uploadData.dimensions);
              
              // Create detection result from stored descriptor
              const restoredDetection: FaceDetectionResult = {
                descriptor: uploadData.faceDescriptor,
                boundingBox: null, // We don't need bounding box for upload
                confidence: 1.0,
                error: null, // No error for restored detection
              };
              setDetectionResult(restoredDetection);
              
              // Trigger upload
              console.log('[PhotoUpload] Triggering upload with restored data');
              await uploadPhoto(
                restoredDetection.descriptor,
                file,
                uploadData.dimensions
              );
              
              // Clean up sessionStorage
              sessionStorage.removeItem(latestKey);
              // Clean up all other upload data keys for this partner
              uploadDataKeys.slice(1).forEach(key => sessionStorage.removeItem(key));
              
              // Remove uploadAnyway from URL
              navigation.replace(`/partners/${partnerId}`);
            } catch (error) {
              console.error('[PhotoUpload] Failed to restore and upload:', error);
              setAlertDialog({
                open: true,
                title: 'Upload Failed',
                message: 'Failed to restore upload data. Please try uploading again.',
              });
              // Remove uploadAnyway from URL
              navigation.replace(`/partners/${partnerId}`);
            }
          })();
        } else {
          console.warn('[PhotoUpload] uploadAnyway=true but no stored data found');
          // Clean up orphaned key before navigating
          sessionStorage.removeItem(latestKey);
          uploadDataKeys.slice(1).forEach(key => sessionStorage.removeItem(key));
          navigation.replace(`/partners/${partnerId}`);
        }
      } else {
        console.warn('[PhotoUpload] uploadAnyway=true but no upload data keys found');
        navigation.replace(`/partners/${partnerId}`);
      }
    }
  }, [mounted, partnerId, navigation]);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();
  }, []);

  const handleProceedAnyway = async () => {
    if (uploading) return; // Prevent double-clicks
    if (detectionResult?.descriptor) {
      await uploadPhoto(
        detectionResult.descriptor, 
        fileRef.current || selectedFile || undefined, 
        dimensionsRef.current || imageDimensions || undefined
      );
    }
    setShowSamePersonModal(false);
  };

  // Removed handleViewPartners - now each match has its own button in the modal

  const handleCreateNewPartner = () => {
    navigation.push('/partners/new');
    setShowCreateNewPartnerModal(false);
  };

  // Prevent hydration errors by not rendering until mounted
  if (!mounted || isAuthenticated === null) {
    return (
      <div className="p-4">
        <p>Checking authentication...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-yellow-800 font-semibold mb-2">Authentication Required</p>
        <p className="text-yellow-700 text-sm mb-4">
          You need to be logged in to upload photos. Please sign in first.
        </p>
        <button
          onClick={() => navigation.push('/auth/signin')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4">
        <p>Loading face detection models...</p>
      </div>
    );
  }

  if (detectionError) {
    return (
      <div className="p-4 text-red-600">
        <p>Error loading face detection: {detectionError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {photoLimitMessage && (
        <div
          className={`mb-4 p-3 rounded ${
            photoLimitMessage.type === 'error'
              ? 'bg-red-50 text-red-800'
              : 'bg-green-50 text-green-800'
          }`}
        >
          {photoLimitMessage.text}
        </div>
      )}

      <ImagePicker
        ref={imagePickerRef}
        onSelect={handleFileSelect}
        accept="image/*"
        disabled={uploading || analyzing}
      />

      <div className="space-y-2">
        <button
          onClick={() => {
            // Prevent opening file picker if already processing
            if (uploading || analyzing) {
              console.log('[PhotoUpload] Ignoring button click - already processing');
              return;
            }
            imagePickerRef.current?.open();
          }}
          disabled={uploading || analyzing}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {(uploading || analyzing) && (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {uploading ? 'Uploading...' : analyzing ? 'Analyzing face...' : 'Select Photo'}
        </button>
        <p className="text-xs text-gray-500 text-center">
          Or paste an image from clipboard (Ctrl+V / Cmd+V)
        </p>
      </div>

      {(analyzing || uploading) && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-blue-800">
            {analyzing ? 'Analyzing face and checking for matches...' : 'Uploading photo...'}
          </p>
        </div>
      )}

      {uploadSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-green-800 font-semibold">✅ Photo uploaded successfully!</p>
        </div>
      )}

      {imageUrl && (
        <div className="mt-4">
          <img
            src={imageUrl}
            alt="Preview"
            className="max-w-full h-auto rounded border"
          />
        </div>
      )}

      {uploadError && (
        <div className="p-4 bg-red-50 text-red-600 rounded">
          {uploadError}
        </div>
      )}

      {/* No Face Modal */}
      {showNoFaceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold mb-4">No Face Detected</h2>
            <p className="text-gray-600 mb-4">
              We couldn't detect a face in this photo. The photo may not be clear enough.
            </p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => {
                  setShowNoFaceModal(false);
                  resetState();
                }}
                disabled={uploading}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Try Again
              </button>
              <button
                onClick={async () => {
                  if (uploading) return; // Prevent double-clicks
                  // Upload without face descriptor when no face is detected
                  await uploadPhoto(
                    null, // No face descriptor
                    fileRef.current || selectedFile || undefined,
                    dimensionsRef.current || imageDimensions || undefined
                  );
                  setShowNoFaceModal(false);
                }}
                disabled={uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {uploading ? 'Uploading...' : 'Upload Anyway'}
              </button>
              {onCancel && (
                <button
                  onClick={() => {
                    setShowNoFaceModal(false);
                    onCancel();
                  }}
                  disabled={uploading}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Multiple Faces Modal */}
      {showMultipleFacesModal && multipleDetections && (
        <FaceSelectionUI
          imageUrl={imageUrl!}
          detections={multipleDetections}
          onSelect={handleFaceSelection}
          onCancel={() => {
            setShowMultipleFacesModal(false);
            resetState();
          }}
        />
      )}

      {/* Same Person Warning Modal */}
      {showSamePersonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold mb-4">Are you sure it's the same person?</h2>
            <p className="text-gray-600 mb-4">
              This photo doesn't match other photos of this partner. Please confirm this is the same person.
            </p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => {
                  setShowSamePersonModal(false);
                  resetState();
                }}
                disabled={uploading}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleProceedAnyway}
                disabled={uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {uploading ? 'Uploading...' : 'Upload Anyway'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Create New Partner Modal */}
      {showCreateNewPartnerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold mb-4">No Match Found</h2>
            <p className="text-gray-600 mb-4">
              This photo doesn't match any existing partners. Would you like to create a new partner?
            </p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => {
                  setShowCreateNewPartnerModal(false);
                  resetState();
                }}
                disabled={uploading || analyzing}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewPartner}
                disabled={uploading || analyzing}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {(uploading || analyzing) && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {(uploading || analyzing) ? 'Processing...' : 'Create New Partner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Dialog */}
      <AlertDialog
        open={alertDialog.open}
        title={alertDialog.title}
        message={alertDialog.message}
        onClose={() => setAlertDialog({ open: false, title: '', message: '' })}
      />

    </div>
  );
}