'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Header from '@/components/Header';
import Breadcrumbs from '@/components/Breadcrumbs';
import { getPhotoUrl } from '@/lib/photo-utils';
import { PhotoUploadAnalysis, FaceMatch } from '@/shared';

export const dynamic = 'force-dynamic';

interface SimilarPartner {
  partner_id: string;
  partner_name: string | null;
  partner_profile_picture: string | null;
  confidence: number;
  matchCount: number;
}

export default function SimilarPhotosPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const partnerId = params.id as string;
  const supabase = createSupabaseClient();
  
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [similarPartners, setSimilarPartners] = useState<SimilarPartner[]>([]);
  const [error, setError] = useState<string | null>(null);

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
  }, [partnerId, searchParams, supabase]);

  const handleUploadAnyway = async () => {
    // Navigate back to partner page and trigger upload
    router.push(`/partners/${partnerId}?uploadAnyway=true`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header accountType={accountType} />
        <Breadcrumbs customItems={[
          { label: 'Partner', href: `/partners/${partnerId}` },
          { label: 'Similar Photos', href: `/partners/${partnerId}/similar-photos` }
        ]} />
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
        <Breadcrumbs customItems={[
          { label: 'Partner', href: `/partners/${partnerId}` },
          { label: 'Similar Photos', href: `/partners/${partnerId}/similar-photos` }
        ]} />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-red-600">{error}</p>
            <Link
              href={`/partners/${partnerId}`}
              className="mt-4 inline-block text-primary-600 hover:text-primary-700"
            >
              ← Back to Partner
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header accountType={accountType} />
      <Breadcrumbs customItems={[
        { label: 'Partner', href: `/partners/${partnerId}` },
        { label: 'Similar Photos', href: `/partners/${partnerId}/similar-photos` }
      ]} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">This photo resembles other partners</h1>
          <p className="text-gray-600 mb-6">
            This photo matches photos from other partners:
          </p>

          {similarPartners.length > 0 ? (
            <div className="mb-6 space-y-3">
              {similarPartners.map((partner) => {
                const profilePictureUrl = partner.partner_profile_picture
                  ? getPhotoUrl(partner.partner_profile_picture)
                  : null;

                return (
                  <div
                    key={partner.partner_id}
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
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
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/partners/${partner.partner_id}`}
                        className="text-lg font-semibold text-gray-900 hover:text-primary-600 block truncate"
                      >
                        {partner.partner_name || 'Unknown Partner'}
                      </Link>
                      <p className="text-sm text-gray-500">
                        {Math.round(partner.confidence)}% match
                        {partner.matchCount > 1 && `, ${partner.matchCount} photos`}
                      </p>
                    </div>
                    <Link
                      href={`/partners/${partner.partner_id}`}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex-shrink-0"
                    >
                      View
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 mb-6">No similar partners found.</p>
          )}

          <div className="flex gap-4 justify-end pt-4 border-t">
            <Link
              href={`/partners/${partnerId}`}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              onClick={handleUploadAnyway}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Upload Anyway
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

