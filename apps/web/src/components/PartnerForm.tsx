'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import Link from 'next/link';
import type { Partner } from '@/shared';

interface PartnerFormProps {
  partner?: Partner | null;
}

export default function PartnerForm({ partner }: PartnerFormProps = {}) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    first_name: partner?.first_name || '',
    last_name: partner?.last_name || '',
    email: partner?.email || '',
    phone_number: partner?.phone_number || '',
    description: partner?.description || '',
    facebook_profile: partner?.facebook_profile || '',
    x_profile: partner?.x_profile || '',
    linkedin_profile: partner?.linkedin_profile || '',
    instagram_profile: partner?.instagram_profile || '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [lastActivityDescription, setLastActivityDescription] = useState<string | null>(null);
  const [suggestionText, setSuggestionText] = useState<string>('');
  const [showSuggestion, setShowSuggestion] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionRef = useRef<HTMLSpanElement>(null);
  const touchStartX = useRef<number | null>(null);

  // Fetch last activity description if partner has no description
  useEffect(() => {
    const fetchLastActivity = async () => {
      if (partner && !partner.description) {
        const supabase = createSupabaseClient();
        const { data: activities } = await supabase
          .from('partner_notes')
          .select('description')
          .eq('partner_id', partner.id)
          .order('start_time', { ascending: false })
          .limit(1)
          .single();
        
        if (activities?.description) {
          setLastActivityDescription(activities.description);
        }
      }
    };
    fetchLastActivity();
  }, [partner]);

  // Update suggestion text based on current input
  useEffect(() => {
    if (lastActivityDescription && !partner?.description) {
      // If field is empty, show full suggestion
      if (!formData.description) {
        setSuggestionText(lastActivityDescription);
        setShowSuggestion(true);
      } else {
        // If user has typed something, check if it matches
        const input = formData.description.toLowerCase();
        const suggestion = lastActivityDescription.toLowerCase();
        
        // Check if suggestion starts with input
        if (suggestion.startsWith(input) && input.length < suggestion.length) {
          setSuggestionText(lastActivityDescription.substring(input.length));
          setShowSuggestion(true);
        } else {
          // Input doesn't match, hide suggestion
          setSuggestionText('');
          setShowSuggestion(false);
        }
      }
    } else {
      setSuggestionText('');
      setShowSuggestion(false);
    }
  }, [formData.description, lastActivityDescription, partner?.description]);

  // Handle keyboard events for inline autocomplete
  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Accept suggestion with Tab or Right Arrow
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && showSuggestion && suggestionText) {
      e.preventDefault();
      // If field is empty, accept full suggestion, otherwise append remaining part
      const newDescription = formData.description 
        ? formData.description + suggestionText 
        : lastActivityDescription || '';
      setFormData({ ...formData, description: newDescription });
      setShowSuggestion(false);
      setSuggestionText('');
    }
    // Dismiss suggestion with Escape
    else if (e.key === 'Escape' && showSuggestion) {
      setShowSuggestion(false);
      setSuggestionText('');
    }
  };

  // Handle input changes
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData({ ...formData, description: e.target.value });
  };

  // Handle touch events for right swipe gesture
  const handleTouchStart = (e: React.TouchEvent<HTMLTextAreaElement>) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLTextAreaElement>) => {
    if (touchStartX.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX.current;
    
    // Right swipe gesture (swipe right by at least 50px)
    if (deltaX > 50 && showSuggestion && suggestionText) {
      e.preventDefault();
      const newDescription = formData.description 
        ? formData.description + suggestionText 
        : lastActivityDescription || '';
      setFormData({ ...formData, description: newDescription });
      setShowSuggestion(false);
      setSuggestionText('');
    }
    
    touchStartX.current = null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const supabase = createSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage('Not authenticated');
      setLoading(false);
      return;
    }

    // Auto-update description_time if description changed
    const descriptionChanged = partner && formData.description !== (partner.description || '');
    
    const partnerData: any = {
      user_id: user.id,
      first_name: formData.first_name || null,
      last_name: formData.last_name || null,
      email: formData.email || null,
      phone_number: formData.phone_number || null,
      description: formData.description || null,
      facebook_profile: formData.facebook_profile || null,
      x_profile: formData.x_profile || null,
      linkedin_profile: formData.linkedin_profile || null,
      instagram_profile: formData.instagram_profile || null,
    };

    // Update description_time if description changed (only on update, not create)
    if (partner && descriptionChanged && formData.description) {
      partnerData.description_time = new Date().toISOString();
    }

    if (partner) {
      // Update existing partner
      const { error } = await supabase
        .from('partners')
        .update(partnerData)
        .eq('id', partner.id);

      if (error) {
        setMessage(error.message);
      } else {
        // Use full page reload to ensure fresh data from server
        window.location.href = `/partners/${partner.id}`;
      }
    } else {
      // Create new partner via API route (for server-side validation)
      const response = await fetch('/api/partners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(partnerData),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error === 'PARTNER_LIMIT_REACHED') {
          setMessage(result.message);
          setIsLimitReached(true);
        } else {
          setMessage(result.error || 'Error creating partner');
          setIsLimitReached(false);
        }
      } else {
        // Check if there's a pending photo upload
        const pendingPhotoUpload = sessionStorage.getItem('pendingPhotoUpload');
        if (pendingPhotoUpload && result.data?.id) {
          // Clean up the pendingPhotoUpload flag
          sessionStorage.removeItem('pendingPhotoUpload');
          // Redirect to partner page with upload flag
          window.location.href = `/partners/${result.data.id}?uploadPhoto=true&uploadDataKey=${pendingPhotoUpload}`;
        } else {
          // Use full page reload to ensure fresh data from server
          window.location.href = '/partners';
        }
      }
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="first_name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          First Name *
        </label>
        <input
          id="first_name"
          type="text"
          value={formData.first_name}
          onChange={(e) =>
            setFormData({ ...formData, first_name: e.target.value })
          }
          required
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="last_name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Last Name
        </label>
        <input
          id="last_name"
          type="text"
          value={formData.last_name}
          onChange={(e) =>
            setFormData({ ...formData, last_name: e.target.value })
          }
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) =>
            setFormData({ ...formData, email: e.target.value })
          }
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="phone_number"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Phone Number
        </label>
        <input
          id="phone_number"
          type="tel"
          value={formData.phone_number}
          onChange={(e) =>
            setFormData({ ...formData, phone_number: e.target.value })
          }
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description
        </label>
        <div className="relative">
          {/* Suggestion overlay - positioned behind textarea to show inline autocomplete */}
          {showSuggestion && suggestionText && (
            <div
              className="absolute inset-0 pointer-events-none z-0 border border-transparent rounded-lg px-4 py-2 overflow-hidden"
              style={{
                fontFamily: 'inherit',
                fontSize: '0.875rem',
                lineHeight: '1.5rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              <span className="invisible">{formData.description}</span>
              <span className="text-gray-400">{suggestionText}</span>
            </div>
          )}
          <textarea
            ref={textareaRef}
            id="description"
            value={formData.description}
            onChange={handleDescriptionChange}
            onKeyDown={handleDescriptionKeyDown}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent relative z-10 bg-transparent"
            style={{ 
              caretColor: 'inherit',
            }}
          />
          {/* Mobile tap button to accept suggestion */}
          {showSuggestion && suggestionText && (
            <button
              type="button"
              onClick={() => {
                // If field is empty, accept full suggestion, otherwise append remaining part
                const newDescription = formData.description 
                  ? formData.description + suggestionText 
                  : lastActivityDescription || '';
                setFormData({ ...formData, description: newDescription });
                setShowSuggestion(false);
                setSuggestionText('');
                textareaRef.current?.focus();
              }}
              className="absolute right-2 top-2 z-20 px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors md:hidden"
              aria-label="Accept suggestion"
            >
              Accept
            </button>
          )}
        </div>
        {showSuggestion && suggestionText && (
          <p className="text-xs text-gray-500 mt-1">
            Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">Tab</kbd> or <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">→</kbd> to accept suggestion
          </p>
        )}
        {partner?.description_time && (
          <p className="text-xs text-gray-500 mt-1">
            Last updated: {new Date(partner.description_time).toLocaleString()}
          </p>
        )}
      </div>

      <div className="border-t pt-4 mt-4">
        <h3 className="text-lg font-semibold mb-4">Social Media Profiles</h3>
        
        <div className="space-y-4">
          <div>
            <label
              htmlFor="facebook_profile"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Facebook Profile
            </label>
            <input
              id="facebook_profile"
              type="url"
              value={formData.facebook_profile}
              onChange={(e) =>
                setFormData({ ...formData, facebook_profile: e.target.value })
              }
              placeholder="https://facebook.com/..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="x_profile"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              X (Twitter) Profile
            </label>
            <input
              id="x_profile"
              type="url"
              value={formData.x_profile}
              onChange={(e) =>
                setFormData({ ...formData, x_profile: e.target.value })
              }
              placeholder="https://x.com/..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="linkedin_profile"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              LinkedIn Profile
            </label>
            <input
              id="linkedin_profile"
              type="url"
              value={formData.linkedin_profile}
              onChange={(e) =>
                setFormData({ ...formData, linkedin_profile: e.target.value })
              }
              placeholder="https://linkedin.com/in/..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="instagram_profile"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Instagram Profile
            </label>
            <input
              id="instagram_profile"
              type="url"
              value={formData.instagram_profile}
              onChange={(e) =>
                setFormData({ ...formData, instagram_profile: e.target.value })
              }
              placeholder="https://instagram.com/..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.includes('Error') || message.includes('error') || message.includes('violates') || message.includes('Not authenticated') || message.includes('limited') || message.includes("can't add")
              ? 'bg-red-50 text-red-800'
              : 'bg-green-50 text-green-800'
          }`}
        >
          <div className="flex flex-col gap-2">
            <span>{message}</span>
            {(message.includes('limited') || message.includes("can't add")) && (
              <Link
                href="/upgrade"
                className="inline-block mt-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors text-center"
              >
                Upgrade to Pro
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="flex space-x-4">
        <button
          type="submit"
          disabled={loading || isLimitReached}
          className="flex-1 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : partner ? 'Update Partner' : 'Create Partner'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

