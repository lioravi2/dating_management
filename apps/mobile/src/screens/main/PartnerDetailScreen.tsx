import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PartnersStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase/client';
import { Partner } from '@dating-app/shared';
import { getPartnerProfilePictureUrl } from '../../lib/photo-utils';
import BlackFlagIcon from '../../components/BlackFlagIcon';
import PartnerPhotos from '../../components/PartnerPhotos';

type PartnerDetailScreenRouteProp = RouteProp<PartnersStackParamList, 'PartnerDetail'>;
type PartnerDetailScreenNavigationProp = NativeStackNavigationProp<PartnersStackParamList, 'PartnerDetail'>;

export default function PartnerDetailScreen() {
  const navigation = useNavigation<PartnerDetailScreenNavigationProp>();
  const route = useRoute<PartnerDetailScreenRouteProp>();
  const { partnerId } = route.params;

  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh when screen comes into focus (e.g., returning from edit screen)
  useFocusEffect(
    useCallback(() => {
      loadPartner();
    }, [partnerId])
  );

  useEffect(() => {
    loadPartner();
  }, [partnerId]);

  const loadPartner = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .select('*')
        .eq('id', partnerId)
        .eq('user_id', session.user.id)
        .single();

      if (partnerError) {
        throw partnerError;
      }

      if (!partnerData) {
        setError('Partner not found');
        return;
      }

      setPartner(partnerData);
    } catch (err) {
      console.error('Error loading partner:', err);
      setError(err instanceof Error ? err.message : 'Failed to load partner');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadPartner(true);
  };

  const handleEdit = () => {
    navigation.navigate('PartnerEdit', { partnerId });
  };

  const handleSocialLink = (url: string) => {
    Linking.openURL(url).catch((err) => {
      console.error('Error opening link:', err);
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderDescriptionWithLinks = (text: string) => {
    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return (
      <Text style={styles.descriptionText}>
        {parts.map((part, index) => {
          if (urlRegex.test(part)) {
            return (
              <Text
                key={index}
                style={styles.linkText}
                onPress={() => {
                  Linking.openURL(part).catch((err) => {
                    console.error('Error opening URL:', err);
                  });
                }}
              >
                {part}
              </Text>
            );
          }
          return <Text key={index}>{part}</Text>;
        })}
      </Text>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#dc2626" />
          <Text style={styles.loadingText}>Loading partner...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !partner) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error || 'Partner not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPartner}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const partnerName = partner.first_name || partner.last_name || 'Unnamed Partner';
  const fullName = partner.first_name && partner.last_name
    ? `${partner.first_name} ${partner.last_name}`
    : partnerName;
  const initials = (partner.first_name?.[0] || partner.last_name?.[0] || '?').toUpperCase();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const profilePictureUrl = getPartnerProfilePictureUrl(partner, supabaseUrl);

  const hasSocialProfiles = partner.facebook_profile || partner.x_profile || 
    partner.linkedin_profile || partner.instagram_profile;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#dc2626']}
          />
        }
      >
        {/* Partner Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              {profilePictureUrl ? (
                <Image
                  source={{ uri: profilePictureUrl }}
                  style={styles.profilePicture}
                />
              ) : (
                <View style={styles.profilePicturePlaceholder}>
                  <Text style={styles.profilePictureText}>{initials}</Text>
                </View>
              )}
              <View style={styles.nameContainer}>
                <View style={styles.nameRow}>
                  <Text style={styles.partnerName}>{fullName}</Text>
                  {partner.black_flag && (
                    <View style={styles.blackFlagBadge}>
                      <BlackFlagIcon width={14} height={14} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={styles.addedDate}>
                  Added {formatDate(partner.created_at)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEdit}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* Contact Information */}
          <View style={styles.infoGrid}>
            {partner.email && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{partner.email}</Text>
              </View>
            )}
            {partner.phone_number && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{partner.phone_number}</Text>
              </View>
            )}
          </View>

          {/* Description */}
          {partner.description && (
            <View style={styles.descriptionSection}>
              <Text style={styles.infoLabel}>Description</Text>
              {renderDescriptionWithLinks(partner.description)}
              {partner.description_time && (
                <Text style={styles.descriptionTime}>
                  Updated {formatDateTime(partner.description_time)}
                </Text>
              )}
            </View>
          )}

          {/* Social Media Profiles */}
          {hasSocialProfiles && (
            <View style={styles.socialSection}>
              <Text style={styles.socialTitle}>Social Media Profiles</Text>
              <View style={styles.socialLinks}>
                {partner.facebook_profile && (
                  <TouchableOpacity
                    style={styles.socialLink}
                    onPress={() => handleSocialLink(partner.facebook_profile!)}
                  >
                    <Text style={styles.socialLinkText}>Facebook Profile</Text>
                  </TouchableOpacity>
                )}
                {partner.x_profile && (
                  <TouchableOpacity
                    style={styles.socialLink}
                    onPress={() => handleSocialLink(partner.x_profile!)}
                  >
                    <Text style={styles.socialLinkText}>X (Twitter) Profile</Text>
                  </TouchableOpacity>
                )}
                {partner.linkedin_profile && (
                  <TouchableOpacity
                    style={styles.socialLink}
                    onPress={() => handleSocialLink(partner.linkedin_profile!)}
                  >
                    <Text style={styles.socialLinkText}>LinkedIn Profile</Text>
                  </TouchableOpacity>
                )}
                {partner.instagram_profile && (
                  <TouchableOpacity
                    style={styles.socialLink}
                    onPress={() => handleSocialLink(partner.instagram_profile!)}
                  >
                    <Text style={styles.socialLinkText}>Instagram Profile</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Photos Section */}
        <PartnerPhotos
          partnerId={partnerId}
          onPhotoUploaded={() => {
            // Reload partner data to refresh profile picture if needed
            loadPartner(true);
          }}
        />

        {/* Activities Section - Placeholder */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Activities</Text>
          <Text style={styles.placeholderText}>
            Activity timeline will be available in a future update.
          </Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  profilePicture: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e5e7eb',
  },
  profilePicturePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePictureText: {
    fontSize: 24,
    color: '#9ca3af',
    fontWeight: '500',
  },
  nameContainer: {
    marginLeft: 16,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  partnerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  blackFlagBadge: {
    backgroundColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  addedDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  editButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 16,
  },
  infoItem: {
    flex: 1,
    minWidth: '45%',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#111827',
  },
  descriptionSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  descriptionText: {
    fontSize: 16,
    color: '#111827',
    lineHeight: 24,
    marginTop: 8,
  },
  linkText: {
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  descriptionTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
  },
  socialSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  socialTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  socialLinks: {
    gap: 12,
  },
  socialLink: {
    paddingVertical: 8,
  },
  socialLinkText: {
    fontSize: 16,
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  sectionCard: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
});

