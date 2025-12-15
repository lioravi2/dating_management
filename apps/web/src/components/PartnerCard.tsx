'use client';

import Link from 'next/link';
import { Partner } from '@/shared';
import { getPartnerProfilePictureUrl } from '@/lib/photo-utils';

interface PartnerCardProps {
  partner: Partner;
  lastActivityDescription?: string | null;
  showDelete?: boolean;
}

export default function PartnerCard({ partner, lastActivityDescription, showDelete = true }: PartnerCardProps) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const profilePictureUrl = getPartnerProfilePictureUrl(partner, supabaseUrl);

  return (
    <div className="relative group">
      <Link
        href={`/partners/${partner.id}`}
        className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow flex gap-4"
      >
        {profilePictureUrl ? (
          <img
            src={profilePictureUrl}
            alt={`${partner.first_name || partner.last_name || 'Partner'}`}
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <span className="text-gray-400 text-xl">
              {(partner.first_name?.[0] || partner.last_name?.[0] || '?').toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold mb-2">
            {partner.first_name || partner.last_name || 'Unnamed Partner'}
            {partner.first_name && partner.last_name && ` ${partner.last_name}`}
          </h2>
          {partner.email && (
            <p className="text-sm text-gray-600 mb-1 truncate">{partner.email}</p>
          )}
          {partner.phone_number && (
            <p className="text-sm text-gray-600 mb-1">
              {partner.phone_number}
            </p>
          )}
          {(partner.description || lastActivityDescription) && (
            <p className="text-sm text-gray-700 mt-3 line-clamp-2">
              {partner.description || lastActivityDescription}
            </p>
          )}
          <div className="text-xs text-gray-500 mt-4 space-y-1">
            <p>Added {new Date(partner.created_at).toLocaleDateString()}</p>
            {partner.updated_at && partner.updated_at !== partner.created_at && (
              <p>Updated {new Date(partner.updated_at).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      </Link>
      {showDelete && (
        <Link
          href={`/partners/${partner.id}/delete`}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-6 right-6 text-red-600 hover:text-red-800 text-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          Delete
        </Link>
      )}
    </div>
  );
}

