'use client';

import { useState, useEffect, useRef } from 'react';
import { useNavigation } from '@/lib/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { environment } from '@/lib/environment';
import Link from 'next/link';
import type { Partner } from '@/shared';
import BlackFlagIcon from '@/components/BlackFlagIcon';

interface PartnerFormProps {
  partner?: Partner | null;
}

export default function PartnerForm({ partner }: PartnerFormProps = {}) {
  const navigation = useNavigation();
  const getInitialFormData = () => ({
    first_name: partner?.first_name || '',
    last_name: partner?.last_name || '',
    email: partner?.email || '',
    phone_number: partner?.phone_number || '',
    description: partner?.description || '',
    facebook_profile: partner?.facebook_profile || '',
    x_profile: partner?.x_profile || '',
    linkedin_profile: partner?.linkedin_profile || '',
    instagram_profile: partner?.instagram_profile || '',
    black_flag: partner?.black_flag || false,
  });

  const [formData, setFormData] = useState(getInitialFormData());
  const [initialFormData, setInitialFormData] = useState(getInitialFormData());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [lastActivityDescription, setLastActivityDescription] = useState<string | null>(null);
  const [suggestionText, setSuggestionText] = useState<string>('');
  const [showSuggestion, setShowSuggestion] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionRef = useRef<HTMLSpanElement>(null);
  const touchStartX = useRef<number | null>(null);
  const isNavigatingRef = useRef(false); // Prevent double submission during navigation
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Store timeout for cleanup
  const isMountedRef = useRef(true); // Track component mount state
  const fieldRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Clear navigation timeout on unmount
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
    };
  }, []);

  // Fetch last activity description if partner has no description
  useEffect(() => {
    const fetchLastActivity = async () => {
      if (partner && !partner.description) {
        const supabase = createSupabaseClient();
        // Use maybeSingle() instead of single() to handle cases where no activities exist
        // Also select id to avoid 406 errors with single-column selects
        const { data: activity } = await supabase
          .from('partner_notes')
          .select('id, description')
          .eq('partner_id', partner.id)
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (activity?.description) {
          setLastActivityDescription(activity.description);
        }
      }
    };
    fetchLastActivity();
  }, [partner]);

  // Update initial form data when partner changes
  useEffect(() => {
    const initial = getInitialFormData();
    setFormData(initial);
    setInitialFormData(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner?.id]);

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
    clearFieldError('description');
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

  // Check if form has changes (only for edit mode)
  const hasChanges: boolean = partner ? (
    formData.first_name !== initialFormData.first_name ||
    formData.last_name !== initialFormData.last_name ||
    formData.email !== initialFormData.email ||
    formData.phone_number !== initialFormData.phone_number ||
    formData.description !== initialFormData.description ||
    formData.facebook_profile !== initialFormData.facebook_profile ||
    formData.x_profile !== initialFormData.x_profile ||
    formData.linkedin_profile !== initialFormData.linkedin_profile ||
    formData.instagram_profile !== initialFormData.instagram_profile ||
    formData.black_flag !== initialFormData.black_flag
  ) : true; // Always allow submission for new partners

  // Validation functions
  const isValidEmail = (email: string): boolean => {
    if (!email.trim()) return true; // Empty is valid (optional field)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const isValidUrl = (url: string): boolean => {
    if (!url.trim()) return true; // Empty is valid (optional field)
    try {
      new URL(url.trim());
      return true;
    } catch {
      return false;
    }
  };

  const clearFieldError = (fieldName: string) => {
    if (fieldErrors[fieldName]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission during navigation
    if (isNavigatingRef.current) {
      return;
    }
    
    // Prevent submission if no changes (edit mode only)
    if (partner && !hasChanges) {
      return;
    }
    
    // Clear previous field errors
    setFieldErrors({});
    setMessage('');

    // Validate all fields and collect errors
    const errors: { [key: string]: string } = {};

    // Validate: first_name is required
    if (!formData.first_name.trim()) {
      errors.first_name = 'First name is required.';
    }

    // Validate: description is mandatory when black_flag is enabled
    if (formData.black_flag && !formData.description?.trim()) {
      errors.description = 'Description is required when black flag is enabled.';
    }

    // Validate: email format
    if (formData.email && !isValidEmail(formData.email)) {
      errors.email = 'Please enter a valid email address.';
    }

    // Validate: social media URLs
    if (formData.facebook_profile && !isValidUrl(formData.facebook_profile)) {
      errors.facebook_profile = 'Please enter a valid Facebook profile URL (e.g., https://facebook.com/username).';
    }

    if (formData.x_profile && !isValidUrl(formData.x_profile)) {
      errors.x_profile = 'Please enter a valid X (Twitter) profile URL (e.g., https://x.com/username).';
    }

    if (formData.linkedin_profile && !isValidUrl(formData.linkedin_profile)) {
      errors.linkedin_profile = 'Please enter a valid LinkedIn profile URL (e.g., https://linkedin.com/in/username).';
    }

    if (formData.instagram_profile && !isValidUrl(formData.instagram_profile)) {
      errors.instagram_profile = 'Please enter a valid Instagram profile URL (e.g., https://instagram.com/username).';
    }

    // If there are validation errors, set them and scroll to first error
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      
      // Scroll to first error field
      const firstErrorField = Object.keys(errors)[0];
      const fieldElement = fieldRefs.current[firstErrorField];
      
      if (fieldElement) {
        // Use setTimeout to ensure the error is rendered before scrolling
        setTimeout(() => {
          fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Focus the input field if it's an input element
          const inputElement = fieldElement.querySelector('input, textarea') as HTMLElement;
          if (inputElement) {
            inputElement.focus();
          }
        }, 100);
      }
      
      return;
    }
    
    setLoading(true);

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
      black_flag: formData.black_flag || false,
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
        setLoading(false);
        return;
      } else {
        // Mark as navigating to prevent double submission
        isNavigatingRef.current = true;
        // Keep loading state true - component will unmount on successful navigation
        // Use navigation.replace to avoid hydration mismatch errors
        // Use setTimeout to ensure navigation happens after state updates complete
        setTimeout(() => {
          // Check if component is still mounted before proceeding
          if (!isMountedRef.current) {
            return;
          }
          
          try {
            // Add timestamp to force Next.js to refresh the server component data
            navigation.replace(`/partners/${partner.id}?t=${Date.now()}`);
            // Reset flag after a delay to handle navigation failures
            // If navigation succeeds, component will unmount anyway
            // Store timeout ID for cleanup - check mounted state first
            if (isMountedRef.current) {
              navigationTimeoutRef.current = setTimeout(() => {
                // Only update state if component is still mounted
                if (isMountedRef.current && isNavigatingRef.current) {
                  // Navigation didn't complete - reset flag and loading state
                  isNavigatingRef.current = false;
                  setLoading(false);
                  setMessage('Navigation failed. Please refresh the page or try again.');
                }
                navigationTimeoutRef.current = null;
              }, 5000); // 5 second timeout for navigation
            }
          } catch (error) {
            // Navigation failed - reset flag and loading state only if mounted
            if (isMountedRef.current) {
              isNavigatingRef.current = false;
              setLoading(false);
              setMessage('Failed to navigate. Please try again.');
            }
          }
        }, 0);
        return;
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
          environment.redirect(`/partners/${result.data.id}?uploadPhoto=true&uploadDataKey=${pendingPhotoUpload}`);
        } else {
          // Use full page reload to ensure fresh data from server
          environment.redirect('/partners');
        }
      }
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        ref={(ref) => { fieldRefs.current.first_name = ref; }}
      >
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
          onChange={(e) => {
            setFormData({ ...formData, first_name: e.target.value });
            clearFieldError('first_name');
          }}
          required
          className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
            fieldErrors.first_name
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300'
          }`}
        />
        {fieldErrors.first_name && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.first_name}</p>
        )}
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

      {/* Black Flag - Only show when editing, placed after last name */}
      {partner && (
        <div>
          <div className="flex items-start gap-3">
            <input
              id="black_flag"
              type="checkbox"
              checked={formData.black_flag}
              onChange={(e) =>
                setFormData({ ...formData, black_flag: e.target.checked })
              }
              className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <div className="flex-1">
              <label
                htmlFor="black_flag"
                className="block text-sm font-medium text-gray-700 mb-1 cursor-pointer flex items-center gap-2"
              >
                <BlackFlagIcon className="w-5 h-5 text-black" />
                Black Flag
              </label>
              <p className="text-xs text-gray-500">
                Mark this partner with a black flag. When enabled, description becomes mandatory.
              </p>
            </div>
          </div>
        </div>
      )}

      <div
        ref={(ref) => { fieldRefs.current.email = ref; }}
      >
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
          onChange={(e) => {
            setFormData({ ...formData, email: e.target.value });
            clearFieldError('email');
          }}
          className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
            fieldErrors.email
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300'
          }`}
        />
        {fieldErrors.email && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
        )}
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

      <div
        ref={(ref) => { fieldRefs.current.description = ref; }}
      >
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2"
        >
          {formData.black_flag && <BlackFlagIcon className="w-4 h-4 text-black" />}
          Description{formData.black_flag ? ' *' : ''}
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
            required={formData.black_flag}
            className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent relative z-10 bg-transparent ${
              fieldErrors.description
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300'
            }`}
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
        {fieldErrors.description && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.description}</p>
        )}
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
          <div
            ref={(ref) => { fieldRefs.current.facebook_profile = ref; }}
          >
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
              onChange={(e) => {
                setFormData({ ...formData, facebook_profile: e.target.value });
                clearFieldError('facebook_profile');
              }}
              placeholder="https://facebook.com/..."
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                fieldErrors.facebook_profile
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300'
              }`}
            />
            {fieldErrors.facebook_profile && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.facebook_profile}</p>
            )}
          </div>

          <div
            ref={(ref) => { fieldRefs.current.x_profile = ref; }}
          >
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
              onChange={(e) => {
                setFormData({ ...formData, x_profile: e.target.value });
                clearFieldError('x_profile');
              }}
              placeholder="https://x.com/..."
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                fieldErrors.x_profile
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300'
              }`}
            />
            {fieldErrors.x_profile && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.x_profile}</p>
            )}
          </div>

          <div
            ref={(ref) => { fieldRefs.current.linkedin_profile = ref; }}
          >
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
              onChange={(e) => {
                setFormData({ ...formData, linkedin_profile: e.target.value });
                clearFieldError('linkedin_profile');
              }}
              placeholder="https://linkedin.com/in/..."
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                fieldErrors.linkedin_profile
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300'
              }`}
            />
            {fieldErrors.linkedin_profile && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.linkedin_profile}</p>
            )}
          </div>

          <div
            ref={(ref) => { fieldRefs.current.instagram_profile = ref; }}
          >
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
              onChange={(e) => {
                setFormData({ ...formData, instagram_profile: e.target.value });
                clearFieldError('instagram_profile');
              }}
              placeholder="https://instagram.com/..."
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                fieldErrors.instagram_profile
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300'
              }`}
            />
            {fieldErrors.instagram_profile && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.instagram_profile}</p>
            )}
          </div>
        </div>
      </div>

      {/* General message box - only for non-field-specific errors (success, auth, network, account limits, etc.) */}
      {message && !message.includes('required') && !message.includes('valid') ? (
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
      ) : null}

      <div className="flex space-x-4">
        <button
          type="submit"
          disabled={loading || isLimitReached || (partner ? !hasChanges : false)}
          className="flex-1 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading && (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {loading ? 'Saving...' : partner ? 'Update Partner' : 'Create Partner'}
        </button>
        <button
          type="button"
          onClick={() => navigation.goBack()}
          disabled={loading}
          className="flex-1 bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

