'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { useNavigation } from '@/lib/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getPhotoUrl } from '@/lib/photo-utils';
import { PhotoUploadAnalysis, FaceMatch } from '@/shared';
import BlackFlagIcon from '@/components/BlackFlagIcon';
import AlertDialog from '@/components/AlertDialog';

export const dynamic = 'force-dynamic';

interface SimilarPartner {
  partner_id: string;
  partner_name: string | null;
  partner_profile_picture: string | null;
  confidence: number;
  matchCount: number;
  black_flag?: boolean;
}

export default function SimilarPhotosPage() {
  const navigation = useNavigation();
  const searchParams = useSearchParams();
  const supabase = createSupabaseClient();
  
  // Optional partnerId from query params (for when uploading to a specific partner)
  const partnerId = searchParams.get('partnerId') || null;
  const imageKey = searchParams.get('imageKey');
  const uploadDataKey = searchParams.get('uploadDataKey');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  useEffect(() => {
    // Load image from sessionStorage using the key from URL
    if (imageKey) {
      const storedImage = sessionStorage.getItem(imageKey);
      if (storedImage) {
        console.log('[SimilarPhotos] Image loaded from sessionStorage, length:', storedImage.length);
        setImageUrl(storedImage);
      } else {
        console.log('[SimilarPhotos] Image key found but no image in sessionStorage');
      }
      // Clean up old sessionStorage entries (keep only the current one)
      // Run cleanup regardless of whether current image was found
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('similar-photos-image-') && key !== imageKey) {
          sessionStorage.removeItem(key);
        }
      });
    } else {
      console.log('[SimilarPhotos] No image key in query params');
      // If no imageKey, clean up all similar-photos-image entries
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('similar-photos-image-')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }, [imageKey]);
  
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [similarPartners, setSimilarPartners] = useState<SimilarPartner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [partnerLimitMessage, setPartnerLimitMessage] = useState<string | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      // Get account type
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('account_type')
          .eq('id', user.id)
          .single();
        setAccountType(userData?.account_type || null);
      }

      // Get analysis data from URL params
      const analysisParam = searchParams.get('analysis');
      if (!analysisParam) {
        setError('No analysis data found');
        setLoading(false);
        return;
      }

      try {
        const analysis: PhotoUploadAnalysis = JSON.parse(decodeURIComponent(analysisParam));
        
        if (analysis.otherPartnerMatches && analysis.otherPartnerMatches.length > 0) {
          // Group matches by partner_id to avoid duplicates
          const groupedMatches = new Map<string, FaceMatch[]>();
          analysis.otherPartnerMatches.forEach((match) => {
            const matchPartnerId = match.partner_id;
            if (!groupedMatches.has(matchPartnerId)) {
              groupedMatches.set(matchPartnerId, []);
            }
            groupedMatches.get(matchPartnerId)!.push(match);
          });

          // Get the best match (highest confidence) for each partner
          const uniquePartners: SimilarPartner[] = Array.from(groupedMatches.entries()).map(([matchPartnerId, matches]) => {
            const bestMatch = matches.reduce((best, current) => 
              current.confidence > best.confidence ? current : best
            );
            return {
              partner_id: matchPartnerId,
              partner_name: bestMatch.partner_name,
              partner_profile_picture: bestMatch.partner_profile_picture || null,
              confidence: bestMatch.confidence,
              matchCount: matches.length,
              black_flag: (bestMatch as any).black_flag || false,
            };
          });

          setSimilarPartners(uniquePartners);
        }
      } catch (e) {
        console.error('Error parsing analysis data:', e);
        setError('Invalid analysis data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [searchParams, supabase]);

  const handleUploadAnyway = async () => {
    // Navigate back appropriately
    if (partnerId) {
      // Navigate to partner page with uploadAnyway flag
      // The PhotoUploadWithFaceMatch component will detect this and trigger upload
      navigation.push(`/partners/${partnerId}`, { uploadAnyway: 'true' });
    } else {
      // For no partnerId case, go back to where they came from or home
      navigation.goBack();
    }
  };

  const breadcrumbItems = partnerId
    ? [
        { label: 'Partner', href: `/partners/${partnerId}` },
        { label: 'Similar Photos', href: `/similar-photos?partnerId=${partnerId}` }
      ]
    : [
        { label: 'Similar Photos', href: '/similar-photos' }
      ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header accountType={accountType} />
        <Breadcrumbs customItems={breadcrumbItems} />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p>Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header accountType={accountType} />
        <Breadcrumbs customItems={breadcrumbItems} />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-red-600">{error}</p>
            {partnerId ? (
              <Link
                href={`/partners/${partnerId}`}
                className="mt-4 inline-block text-primary-600 hover:text-primary-700"
              >
                ← Back to Partner
              </Link>
            ) : (
              <button
                onClick={() => navigation.goBack()}
                className="mt-4 text-primary-600 hover:text-primary-700"
              >
                ← Go Back
              </button>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header accountType={accountType} />
      <Breadcrumbs customItems={breadcrumbItems} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          {/* Partner limit error message */}
          {partnerLimitMessage && (
            <div className="mb-4 p-3 rounded bg-red-50 text-red-800 border border-red-200">
              <p className="mb-2">{partnerLimitMessage}</p>
              <Link
                href="/upgrade"
                className="inline-block px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-center text-sm font-semibold"
              >
                Upgrade to Pro
              </Link>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Uploaded photo"
                className="w-16 h-16 rounded-full object-cover flex-shrink-0 border-2 border-gray-300"
                onError={(e) => {
                  console.error('[SimilarPhotos] Failed to load image');
                  console.error('[SimilarPhotos] Image URL length:', imageUrl.length);
                  console.error('[SimilarPhotos] Image URL starts with:', imageUrl.substring(0, 50));
                  console.error('[SimilarPhotos] Image error details:', e);
                  // Hide the image on error
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
                onLoad={() => {
                  console.log('[SimilarPhotos] Image loaded successfully');
                }}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 border-2 border-gray-300">
                <span className="text-gray-400 text-xs">No preview</span>
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold mb-1">This photo resembles other partners</h1>
              <p className="text-sm sm:text-base text-gray-600">
                This photo matches photos from other partners:
              </p>
            </div>
          </div>

          {similarPartners.length > 0 ? (
            <div className="mb-6 space-y-3">
              {similarPartners.map((partner) => {
                const profilePictureUrl = partner.partner_profile_picture
                  ? getPhotoUrl(partner.partner_profile_picture)
                  : null;

                return (
                  <div
                    key={partner.partner_id}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    {profilePictureUrl ? (
                      <img
                        src={profilePictureUrl}
                        alt={partner.partner_name || 'Partner'}
                        className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-600 text-lg">
                          {(partner.partner_name?.[0] || '?').toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/partners/${partner.partner_id}`}
                          className="text-lg font-semibold text-gray-900 hover:text-primary-600 block truncate"
                        >
                          {partner.partner_name || 'Unknown Partner'}
                        </Link>
                        {partner.black_flag && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-black text-white flex-shrink-0" title="Black Flag">
                            <BlackFlagIcon className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {Math.round(partner.confidence)}% match
                        {partner.matchCount > 1 && `, ${partner.matchCount} photos`}
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0 w-full sm:w-auto">
                      <Link
                        href={`/partners/${partner.partner_id}`}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-center text-sm sm:text-base"
                      >
                        View
                      </Link>
                      <button
                        onClick={async () => {
                          // Store upload data and navigate to partner page with upload flag
                          const currentUploadDataKey = uploadDataKey || (() => {
                            // Try to find uploadDataKey in sessionStorage if not in URL
                            const keys = Object.keys(sessionStorage).filter(key => 
                              key.startsWith('upload-photo-data-') || key.startsWith('upload-data-')
                            );
                            return keys.length > 0 ? keys[0] : null;
                          })();
                          
                          if (currentUploadDataKey) {
                            // Store which partner to upload to
                            sessionStorage.setItem(`uploadToPartner-${currentUploadDataKey}`, partner.partner_id);
                            // Store flag to redirect to dashboard after upload (from similar-photos page)
                            sessionStorage.setItem(`redirectToDashboard-${currentUploadDataKey}`, 'true');
                            
                            // Upload directly via API instead of navigating to partner page
                            try {
                              const uploadDataStr = sessionStorage.getItem(currentUploadDataKey);
                              if (!uploadDataStr) {
                                setAlertDialog({
                                  open: true,
                                  title: 'Upload Error',
                                  message: 'Upload data not found. Please try uploading again.',
                                });
                                return;
                              }

                              const uploadData = JSON.parse(uploadDataStr);
                              const { fileBase64, faceDescriptor, width, height } = uploadData;

                              // Convert base64 back to File
                              const base64Data = fileBase64.split(',')[1] || fileBase64;
                              const byteCharacters = atob(base64Data);
                              const byteNumbers = new Array(byteCharacters.length);
                              for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i);
                              }
                              const byteArray = new Uint8Array(byteNumbers);
                              const blob = new Blob([byteArray], { type: 'image/jpeg' });
                              const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });

                              // Create FormData
                              const formData = new FormData();
                              formData.append('file', file);
                              if (faceDescriptor) {
                                formData.append('faceDescriptor', JSON.stringify(faceDescriptor));
                              }
                              if (width) formData.append('width', width.toString());
                              if (height) formData.append('height', height.toString());

                              // Upload photo to partner
                              const response = await fetch(`/api/partners/${partner.partner_id}/photos`, {
                                method: 'POST',
                                body: formData,
                              });

                              if (!response.ok) {
                                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                                throw new Error(error.error || error.details || 'Failed to upload photo');
                              }

                              // Clean up sessionStorage
                              sessionStorage.removeItem(currentUploadDataKey);
                              sessionStorage.removeItem(`uploadToPartner-${currentUploadDataKey}`);
                              sessionStorage.removeItem(`redirectToDashboard-${currentUploadDataKey}`);
                              if (imageKey) {
                                sessionStorage.removeItem(imageKey);
                              }

                              // Redirect to dashboard with refresh
                              const { environment } = require('@/lib/environment');
                              environment.redirect('/dashboard');
                            } catch (error) {
                              console.error('[SimilarPhotos] Error uploading photo:', error);
                              setAlertDialog({
                                open: true,
                                title: 'Upload Error',
                                message: error instanceof Error ? error.message : 'Failed to upload photo',
                              });
                            }
                          } else {
                            console.error('[SimilarPhotos] No uploadDataKey found');
                            setAlertDialog({
                              open: true,
                              title: 'Upload Error',
                              message: 'Upload data not found. Please try uploading again.',
                            });
                          }
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm sm:text-base"
                      >
                        Upload Here
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 mb-6">No similar partners found.</p>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-end pt-4 border-t">
            <button
              onClick={() => {
                // Clean up sessionStorage
                if (imageKey) {
                  sessionStorage.removeItem(imageKey);
                }
                if (uploadDataKey) {
                  sessionStorage.removeItem(uploadDataKey);
                }
                navigation.push('/dashboard');
              }}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 w-full sm:w-auto"
            >
              Cancel
            </button>
            {!partnerId && (
              <button
                onClick={async () => {
                  if (!uploadDataKey || creating) {
                    return;
                  }

                  // Clear any previous error messages
                  setPartnerLimitMessage(null);

                  // Get upload data from sessionStorage
                  const uploadDataStr = sessionStorage.getItem(uploadDataKey);
                  if (!uploadDataStr) {
                    console.error('Upload data not found in sessionStorage');
                    return;
                  }

                  try {
                    setCreating(true);
                    const uploadData = JSON.parse(uploadDataStr);
                    const { fileBase64, faceDescriptor, width, height } = uploadData;

                    // Convert base64 back to File
                    const base64Data = fileBase64.split(',')[1] || fileBase64;
                    const byteCharacters = atob(base64Data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'image/jpeg' });
                    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });

                    // Create FormData
                    const formData = new FormData();
                    formData.append('file', file);
                    if (faceDescriptor) {
                      formData.append('faceDescriptor', JSON.stringify(faceDescriptor));
                    }
                    if (width) formData.append('width', width.toString());
                    if (height) formData.append('height', height.toString());

                    // Create partner with photo via API
                    const response = await fetch('/api/partners/create-with-photo', {
                      method: 'POST',
                      body: formData,
                    });

                    const result = await response.json();

                    if (!response.ok) {
                      console.error('Error creating partner:', result.error);
                      
                      // Check for partner limit error
                      if (response.status === 403 && result.error === 'PARTNER_LIMIT_REACHED') {
                        setPartnerLimitMessage(result.message || 'Partner limit reached');
                        setCreating(false);
                        return;
                      }
                      
                      setAlertDialog({
                        open: true,
                        title: 'Error',
                        message: result.message || result.error || 'Failed to create partner',
                      });
                      setCreating(false);
                      return;
                    }

                    // Clean up sessionStorage
                    sessionStorage.removeItem(uploadDataKey);
                    if (imageKey) {
                      sessionStorage.removeItem(imageKey);
                    }

                    // Redirect to dashboard with refresh (new partner will show first due to latest update date)
                    const { environment } = require('@/lib/environment');
                    environment.redirect('/dashboard');
                  } catch (error) {
                    console.error('Error creating partner:', error);
                    
                    // Check if it's a partner limit error (in case it wasn't caught above)
                    if (error instanceof Error && (error.message.includes('PARTNER_LIMIT_REACHED') || error.message.includes('partner limit'))) {
                      setPartnerLimitMessage(error.message || 'Partner limit reached');
                    } else {
                      setAlertDialog({
                        open: true,
                        title: 'Error',
                        message: 'Failed to create partner. Please try again.',
                      });
                    }
                  } finally {
                    setCreating(false);
                  }
                }}
                disabled={creating}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {creating ? 'Creating...' : 'Create New Partner'}
              </button>
            )}
            {partnerId && (
              <button
                onClick={handleUploadAnyway}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full sm:w-auto"
              >
                Upload Anyway
              </button>
            )}
          </div>
        </div>
      </main>

      <AlertDialog
        open={alertDialog.open}
        title={alertDialog.title}
        message={alertDialog.message}
        onClose={() => setAlertDialog({ open: false, title: '', message: '' })}
      />
    </div>
  );
}

