import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PartnersStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase/client';
import BlackFlagIcon from '../../components/BlackFlagIcon';

type PartnerCreateScreenNavigationProp = NativeStackNavigationProp<PartnersStackParamList, 'PartnerCreate'>;

export default function PartnerCreateScreen() {
  const navigation = useNavigation<PartnerCreateScreenNavigationProp>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [isLimitReached, setIsLimitReached] = useState(false);
  const isSubmitting = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const fieldRefs = useRef<{ [key: string]: View | null }>({});
  const fieldPositions = useRef<{ [key: string]: number }>({});

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    description: '',
    facebook_profile: '',
    x_profile: '',
    linkedin_profile: '',
    instagram_profile: '',
    black_flag: false,
  });

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

  const handleCreate = async () => {
    if (isSubmitting.current || saving) return;

    // Clear previous field errors
    setFieldErrors({});
    setMessage('');
    setIsLimitReached(false);

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
      const fieldRef = fieldRefs.current[firstErrorField];
      
      if (fieldRef && scrollViewRef.current) {
        // Use setTimeout to ensure the error is rendered before scrolling
        setTimeout(() => {
          // Measure the field position
          fieldRef.measure((x, y, width, height, pageX, pageY) => {
            // Get the ScrollView's position on the page
            scrollViewRef.current?.measure((sx, sy, swidth, sheight, spageX, spageY) => {
              // Calculate the relative Y position within the ScrollView
              const relativeY = pageY - spageY;
              scrollViewRef.current?.scrollTo({ y: Math.max(0, relativeY - 20), animated: true });
            });
          });
        }, 150);
      }
      
      return;
    }

    isSubmitting.current = true;
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Not authenticated');
        setSaving(false);
        isSubmitting.current = false;
        return;
      }

      const partnerData: any = {
        user_id: session.user.id,
        first_name: formData.first_name.trim() || null,
        last_name: formData.last_name.trim() || null,
        email: formData.email.trim() || null,
        phone_number: formData.phone_number.trim() || null,
        description: formData.description.trim() || null,
        facebook_profile: formData.facebook_profile.trim() || null,
        x_profile: formData.x_profile.trim() || null,
        linkedin_profile: formData.linkedin_profile.trim() || null,
        instagram_profile: formData.instagram_profile.trim() || null,
        black_flag: formData.black_flag || false,
      };

      // Check partner limit for free users
      const FREE_TIER_PARTNER_LIMIT = 10;
      const { data: userData } = await supabase
        .from('users')
        .select('account_type')
        .eq('id', session.user.id)
        .single();

      if (userData?.account_type === 'free') {
        const { count, error: countError } = await supabase
          .from('partners')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id);

        if (!countError && count !== null && count >= FREE_TIER_PARTNER_LIMIT) {
          const message = count === FREE_TIER_PARTNER_LIMIT
            ? `Your free subscription is limited to ${FREE_TIER_PARTNER_LIMIT} partners. Please upgrade to Pro to add more partners.`
            : `With a free subscription you can't add partners if you already have more than ${FREE_TIER_PARTNER_LIMIT} partners. Please upgrade to Pro and try again.`;
          setMessage(message);
          setIsLimitReached(true);
          setSaving(false);
          isSubmitting.current = false;
          return;
        }
      }

      // Create the partner
      const { data: newPartner, error: createError } = await supabase
        .from('partners')
        .insert(partnerData)
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // Navigate to the new partner's detail page
      if (newPartner?.id) {
        navigation.replace('PartnerDetail', { partnerId: newPartner.id });
      } else {
        // Fallback: navigate to partners list
        navigation.replace('PartnersList');
      }
    } catch (err) {
      console.error('Error creating partner:', err);
      setMessage(err instanceof Error ? err.message : 'Failed to create partner');
      setSaving(false);
      isSubmitting.current = false;
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.headerCard}>
          <Text style={styles.title}>Add New Partner</Text>
        </View>

        {/* General message box - only for non-field-specific errors (success, auth, network, account limits, etc.) */}
        {/* Only show if there are no field errors (field errors are shown inline) */}
        {message && Object.keys(fieldErrors).length === 0 ? (
          <View
            style={[
              styles.messageBox,
              message.includes('successfully') ? styles.successBox : styles.errorBox,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.includes('successfully') ? styles.successText : styles.errorText,
              ]}
            >
              {message}
            </Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <View
            ref={(ref) => (fieldRefs.current.first_name = ref)}
            style={styles.formSection}
            onLayout={(event) => {
              fieldPositions.current.first_name = event.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={[styles.input, fieldErrors.first_name && styles.inputError]}
              value={formData.first_name}
              onChangeText={(text) => {
                setFormData({ ...formData, first_name: text });
                clearFieldError('first_name');
              }}
              placeholder="Enter first name"
              placeholderTextColor="#9ca3af"
            />
            {fieldErrors.first_name && (
              <Text style={styles.fieldError}>{fieldErrors.first_name}</Text>
            )}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={formData.last_name}
              onChangeText={(text) => {
                setFormData({ ...formData, last_name: text });
                setMessage('');
              }}
              placeholder="Enter last name"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.formSection}>
            <View style={styles.switchRow}>
              <Switch
                value={formData.black_flag}
                onValueChange={(value) => {
                  setFormData({ ...formData, black_flag: value });
                  setMessage('');
                }}
                trackColor={{ false: '#d1d5db', true: '#dc2626' }}
                thumbColor={formData.black_flag ? '#fff' : '#f3f4f6'}
              />
              <View style={styles.switchLabelContainer}>
                <View style={styles.switchLabelRow}>
                  <BlackFlagIcon width={20} height={20} color="#000" />
                  <Text style={styles.switchLabel}>Black Flag</Text>
                </View>
                <Text style={styles.switchHint}>
                  Mark this partner with a black flag. When enabled, description becomes mandatory.
                </Text>
              </View>
            </View>
          </View>

          <View
            ref={(ref) => (fieldRefs.current.email = ref)}
            style={styles.formSection}
            onLayout={(event) => {
              fieldPositions.current.email = event.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, fieldErrors.email && styles.inputError]}
              value={formData.email}
              onChangeText={(text) => {
                setFormData({ ...formData, email: text });
                clearFieldError('email');
              }}
              placeholder="Enter email"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {fieldErrors.email && (
              <Text style={styles.fieldError}>{fieldErrors.email}</Text>
            )}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={formData.phone_number}
              onChangeText={(text) => {
                setFormData({ ...formData, phone_number: text });
                setMessage('');
              }}
              placeholder="Enter phone number"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
            />
          </View>

          <View
            ref={(ref) => (fieldRefs.current.description = ref)}
            style={styles.formSection}
            onLayout={(event) => {
              fieldPositions.current.description = event.nativeEvent.layout.y;
            }}
          >
            <View style={styles.labelRow}>
              {formData.black_flag && <BlackFlagIcon width={16} height={16} color="#000" />}
              <Text style={styles.label}>
                Description{formData.black_flag ? ' *' : ''}
              </Text>
            </View>
            <TextInput
              style={[styles.input, styles.textArea, fieldErrors.description && styles.inputError]}
              value={formData.description}
              onChangeText={(text) => {
                setFormData({ ...formData, description: text });
                clearFieldError('description');
              }}
              placeholder="Enter description"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {fieldErrors.description && (
              <Text style={styles.fieldError}>{fieldErrors.description}</Text>
            )}
          </View>

          <View style={styles.socialSection}>
            <Text style={styles.sectionTitle}>Social Media Profiles</Text>

            <View
              ref={(ref) => (fieldRefs.current.facebook_profile = ref)}
              style={styles.formSection}
              onLayout={(event) => {
                fieldPositions.current.facebook_profile = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.label}>Facebook Profile</Text>
              <TextInput
                style={[styles.input, fieldErrors.facebook_profile && styles.inputError]}
                value={formData.facebook_profile}
                onChangeText={(text) => {
                  setFormData({ ...formData, facebook_profile: text });
                  clearFieldError('facebook_profile');
                }}
                placeholder="https://facebook.com/..."
                placeholderTextColor="#9ca3af"
                keyboardType="url"
                autoCapitalize="none"
              />
              {fieldErrors.facebook_profile && (
                <Text style={styles.fieldError}>{fieldErrors.facebook_profile}</Text>
              )}
            </View>

            <View
              ref={(ref) => (fieldRefs.current.x_profile = ref)}
              style={styles.formSection}
              onLayout={(event) => {
                fieldPositions.current.x_profile = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.label}>X (Twitter) Profile</Text>
              <TextInput
                style={[styles.input, fieldErrors.x_profile && styles.inputError]}
                value={formData.x_profile}
                onChangeText={(text) => {
                  setFormData({ ...formData, x_profile: text });
                  clearFieldError('x_profile');
                }}
                placeholder="https://x.com/..."
                placeholderTextColor="#9ca3af"
                keyboardType="url"
                autoCapitalize="none"
              />
              {fieldErrors.x_profile && (
                <Text style={styles.fieldError}>{fieldErrors.x_profile}</Text>
              )}
            </View>

            <View
              ref={(ref) => (fieldRefs.current.linkedin_profile = ref)}
              style={styles.formSection}
              onLayout={(event) => {
                fieldPositions.current.linkedin_profile = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.label}>LinkedIn Profile</Text>
              <TextInput
                style={[styles.input, fieldErrors.linkedin_profile && styles.inputError]}
                value={formData.linkedin_profile}
                onChangeText={(text) => {
                  setFormData({ ...formData, linkedin_profile: text });
                  clearFieldError('linkedin_profile');
                }}
                placeholder="https://linkedin.com/in/..."
                placeholderTextColor="#9ca3af"
                keyboardType="url"
                autoCapitalize="none"
              />
              {fieldErrors.linkedin_profile && (
                <Text style={styles.fieldError}>{fieldErrors.linkedin_profile}</Text>
              )}
            </View>

            <View
              ref={(ref) => (fieldRefs.current.instagram_profile = ref)}
              style={styles.formSection}
              onLayout={(event) => {
                fieldPositions.current.instagram_profile = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.label}>Instagram Profile</Text>
              <TextInput
                style={[styles.input, fieldErrors.instagram_profile && styles.inputError]}
                value={formData.instagram_profile}
                onChangeText={(text) => {
                  setFormData({ ...formData, instagram_profile: text });
                  clearFieldError('instagram_profile');
                }}
                placeholder="https://instagram.com/..."
                placeholderTextColor="#9ca3af"
                keyboardType="url"
                autoCapitalize="none"
              />
              {fieldErrors.instagram_profile && (
                <Text style={styles.fieldError}>{fieldErrors.instagram_profile}</Text>
              )}
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={handleCreate}
              disabled={saving}
              style={[styles.saveButton, saving && styles.buttonDisabled]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Create Partner</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCancel}
              disabled={saving}
              style={[styles.cancelButton, saving && styles.buttonDisabled]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  headerCard: {
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  messageBox: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  successBox: {
    backgroundColor: '#d1fae5',
  },
  errorBox: {
    backgroundColor: '#fee2e2',
  },
  messageText: {
    fontSize: 14,
  },
  successText: {
    color: '#065f46',
  },
  errorText: {
    color: '#dc2626',
  },
  formCard: {
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
  formSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#dc2626',
    borderWidth: 1,
  },
  fieldError: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: 4,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  switchLabelContainer: {
    flex: 1,
  },
  switchLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  switchHint: {
    fontSize: 12,
    color: '#6b7280',
  },
  socialSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#dc2626',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
