'use client';

import { useState, useRef, useEffect } from 'react';
import { useFaceDetection } from '@/lib/hooks/useFaceDetection';
import { FaceSelectionUI } from './FaceSelectionUI';
import { FaceDetectionResult, MultipleFaceDetectionResult } from '@/lib/face-detection/types';
import { PhotoUploadAnalysis, FaceMatch, FREE_TIER_PHOTO_LIMIT } from '@/shared';
import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { getPhotoUrl } from '@/lib/photo-utils';

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
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [showPhotoLimitModal, setShowPhotoLimitModal] = useState(false);

  // Modal states
  const [showNoFaceModal, setShowNoFaceModal] = useState(false);
  const [showMultipleFacesModal, setShowMultipleFacesModal] = useState(false);
  const [showSamePersonModal, setShowSamePersonModal] = useState(false);
  const [showOtherPartnersModal, setShowOtherPartnersModal] = useState(false);
  const [showCreateNewPartnerModal, setShowCreateNewPartnerModal] = useState(false);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
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
          alert('Unable to verify photo limit. Please try again or contact support.');
          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
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
            alert('Unable to verify photo limit. Please try again or contact support.');
            // Reset file input
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            return;
          }

          if (count !== null && count >= FREE_TIER_PHOTO_LIMIT) {
            setShowPhotoLimitModal(true);
            // Reset file input
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
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
        alert(`Face detection error: ${allFacesResult.error}`);
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
      alert('Failed to load image');
      setSelectedFile(null);
      setImageUrl(null);
    };

    img.src = url;
  };

  const cropImageToFace = async (
    imageUrl: string,
    boundingBox: { x: number; y: number; width: number; height: number },
    originalFileName?: string
  ): Promise<{ file: File; dimensions: { width: number; height: number } }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        // Create a canvas for the cropped face
        const canvas = document.createElement('canvas');
        canvas.width = boundingBox.width;
        canvas.height = boundingBox.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Draw the cropped region
        ctx.drawImage(
          img,
          boundingBox.x,
          boundingBox.y,
          boundingBox.width,
          boundingBox.height,
          0,
          0,
          boundingBox.width,
          boundingBox.height
        );
        
        // Convert canvas to blob, then to File
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob from canvas'));
            return;
          }
          
          // Get original file name and extension
          const fileName = originalFileName || 'face.jpg';
          const fileExt = fileName.split('.').pop() || 'jpg';
          const croppedFileName = `cropped_face.${fileExt}`;
          
          const file = new File([blob], croppedFileName, {
            type: blob.type || 'image/jpeg',
            lastModified: Date.now(),
          });
          
          resolve({
            file,
            dimensions: { width: boundingBox.width, height: boundingBox.height },
          });
        }, 'image/jpeg', 0.95); // Use JPEG with 95% quality
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image for cropping'));
      };
      
      img.src = imageUrl;
    });
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
        alert('Failed to crop image. Using original photo instead.');
        // Continue with original file if cropping fails
      }
    }
    
    await analyzeFace(detection);
  };

  const analyzeFace = async (detection: FaceDetectionResult) => {
    if (!detection.descriptor) {
      alert('No face descriptor available');
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
          console.log('[PhotoUpload] Showing other partners warning modal');
          setShowOtherPartnersModal(true);
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
          setShowCreateNewPartnerModal(true);
        } else if (result.decision === 'warn_matches') {
          // Set analysis for displaying matches
          setAnalysis({
            decision: {
              type: 'warn_other_partners',
              matches: result.matches || [],
              reason: 'matches_other_partners',
            },
            partnerMatches: [],
            otherPartnerMatches: result.matches || [],
            partnerHasOtherPhotos: false,
          });
          setShowOtherPartnersModal(true);
        }
      }
    } catch (error) {
      console.error('Error analyzing face:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Full error details:', error);
      alert(`Failed to analyze photo: ${errorMessage}. Please check the console for details.`);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
    if (detectionResult?.descriptor) {
      await uploadPhoto(
        detectionResult.descriptor, 
        fileRef.current || selectedFile || undefined, 
        dimensionsRef.current || imageDimensions || undefined
      );
    }
    setShowSamePersonModal(false);
    setShowOtherPartnersModal(false);
  };

  // Removed handleViewPartners - now each match has its own button in the modal

  const handleCreateNewPartner = () => {
    router.push('/partners/new');
    setShowCreateNewPartnerModal(false);
  };

  if (isAuthenticated === null) {
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
          onClick={() => router.push('/auth/signin')}
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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || analyzing}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {uploading ? 'Uploading...' : analyzing ? 'Analyzing face...' : 'Select Photo'}
      </button>

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
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Try Again
              </button>
              <button
                onClick={async () => {
                  // Upload without face descriptor when no face is detected
                  await uploadPhoto(
                    null, // No face descriptor
                    fileRef.current || selectedFile || undefined,
                    dimensionsRef.current || imageDimensions || undefined
                  );
                  setShowNoFaceModal(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Upload Anyway
              </button>
              {onCancel && (
                <button
                  onClick={() => {
                    setShowNoFaceModal(false);
                    onCancel();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
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
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleProceedAnyway}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Upload Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Other Partners Warning Modal */}
      {showOtherPartnersModal && (() => {
        // Group matches by partner_id to avoid duplicates
        const groupedMatches = new Map<string, FaceMatch[]>();
        analysis?.otherPartnerMatches?.forEach((match) => {
          const partnerId = match.partner_id;
          if (!groupedMatches.has(partnerId)) {
            groupedMatches.set(partnerId, []);
          }
          groupedMatches.get(partnerId)!.push(match);
        });

        // Get the best match (highest confidence) for each partner
        const uniquePartners = Array.from(groupedMatches.entries()).map(([partnerId, matches]) => {
          const bestMatch = matches.reduce((best, current) => 
            current.confidence > best.confidence ? current : best
          );
          return {
            partner_id: partnerId,
            partner_name: bestMatch.partner_name,
            partner_profile_picture: bestMatch.partner_profile_picture || null,
            confidence: bestMatch.confidence,
            matchCount: matches.length, // Number of photos that matched
          };
        });

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">This photo resembles other partners</h2>
              <p className="text-gray-600 mb-4">
                This photo matches photos from other partners:
              </p>
              {uniquePartners.length > 0 && (
                <div className="mb-4 space-y-2">
                  {uniquePartners.map((partner) => {
                    // Get profile picture URL
                    const profilePictureUrl = partner.partner_profile_picture
                      ? getPhotoUrl(partner.partner_profile_picture)
                      : null;
                    
                    return (
                      <div
                        key={partner.partner_id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        {profilePictureUrl ? (
                          <img
                            src={profilePictureUrl}
                            alt={partner.partner_name || 'Partner'}
                            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                            <span className="text-gray-600 text-sm">
                              {(partner.partner_name?.[0] || '?').toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-700 block truncate">
                            {partner.partner_name || 'Unknown Partner'}
                          </span>
                          <span className="text-sm text-gray-500">
                            {Math.round(partner.confidence)}% match
                            {partner.matchCount > 1 && `, ${partner.matchCount} photos`}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            router.push(`/partners/${partner.partner_id}`);
                            setShowOtherPartnersModal(false);
                          }}
                          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex-shrink-0"
                        >
                          View
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-4 justify-end mt-4">
                <button
                  onClick={() => {
                    setShowOtherPartnersModal(false);
                    resetState();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProceedAnyway}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Upload Anyway
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewPartner}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create New Partner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Limit Modal */}
      {showPhotoLimitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold mb-4">Photo Limit Reached</h2>
            <p className="text-gray-600 mb-4">
              Your free subscription is limited to {FREE_TIER_PHOTO_LIMIT} photos. Please upgrade to Pro to upload more photos.
            </p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => {
                  setShowPhotoLimitModal(false);
                  resetState();
                }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowPhotoLimitModal(false);
                  resetState();
                  router.push('/upgrade');
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
