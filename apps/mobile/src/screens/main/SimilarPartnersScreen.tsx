import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PartnersStackParamList } from '../../navigation/types';
import { FaceMatch, PhotoUploadAnalysis } from '@dating-app/shared';
import { getPartnerProfilePictureUrl } from '../../lib/photo-utils';
import BlackFlagIcon from '../../components/BlackFlagIcon';
import { supabase } from '../../lib/supabase/client';
import { resilientFetch } from '../../lib/network-utils';

type SimilarPartnersScreenRouteProp = RouteProp<PartnersStackParamList, 'SimilarPartners'>;
type SimilarPartnersScreenNavigationProp = NativeStackNavigationProp<PartnersStackParamList, 'SimilarPartners'>;

export default function SimilarPartnersScreen() {
  const navigation = useNavigation<SimilarPartnersScreenNavigationProp>();
  const route = useRoute<SimilarPartnersScreenRouteProp>();
  const { 
    currentPartnerId, 
    analysisData, 
    uploadData,
    faceDescriptor,
    imageUri,
  } = route.params;

  const [loading, setLoading] = useState(false);
  const [uploadingPartnerId, setUploadingPartnerId] = useState<string | null>(null);
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  // Extract matches from analysis data
  const matches = analysisData?.otherPartnerMatches || [];
  
  // Group matches by partner_id to avoid duplicates (like web app)
  const groupedMatches = new Map<string, FaceMatch[]>();
  matches.forEach((match) => {
    const partnerId = match.partner_id;
    if (!groupedMatches.has(partnerId)) {
      groupedMatches.set(partnerId, []);
    }
    groupedMatches.get(partnerId)!.push(match);
  });

  // Get best match (highest similarity) for each partner
  const uniquePartners = Array.from(groupedMatches.entries()).map(([partnerId, partnerMatches]) => {
    const bestMatch = partnerMatches.reduce((best, current) => 
      (current.similarity || current.confidence || 0) > (best.similarity || best.confidence || 0) ? current : best
    );
    return {
      partner_id: partnerId,
      partner_name: bestMatch.partner_name,
      partner_profile_picture: (bestMatch as any).partner_profile_picture || null,
      similarity: bestMatch.similarity || bestMatch.confidence || 0,
      matchCount: partnerMatches.length,
      black_flag: (bestMatch as any).black_flag || false,
    };
  });

  const handleViewPartner = (partnerId: string) => {
    // Navigate to partner detail - when back is pressed, will return to this screen
    navigation.navigate('PartnerDetail', { partnerId });
  };

  const performUpload = async (targetPartnerId: string) => {
    if (!uploadData) {
      Alert.alert('Error', 'Upload data not available');
      return;
    }

    setLoading(true);
    setUploadingPartnerId(targetPartnerId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

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

      // Use resilientFetch with retry logic
      const uploadResponse = await resilientFetch(`${apiUrl}/api/partners/${targetPartnerId}/photos`, {
        method: 'POST',
        body: formData,
        timeout: 60000, // 60 second timeout for upload
        retryOptions: {
          maxRetries: 2,
          initialDelay: 2000,
          maxDelay: 10000,
        },
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.details || `Failed to upload photo (${uploadResponse.status})`);
      }

      // Navigate to Dashboard after successful upload (not goBack which would go to PhotoUpload)
      // Get the tab navigator (parent) and navigate to Dashboard
      const tabNavigator = navigation.getParent();
      if (tabNavigator) {
        // Navigate to Dashboard tab
        tabNavigator.navigate('Dashboard');
      }
    } catch (error) {
      console.error('Error uploading to partner:', error);
      Alert.alert(
        'Upload Error',
        error instanceof Error ? error.message : 'Failed to upload photo'
      );
    } finally {
      setLoading(false);
      setUploadingPartnerId(null);
    }
  };

  const handleUploadToPartner = async (partnerId: string) => {
    if (loading || uploadingPartnerId) return; // Prevent multiple clicks
    await performUpload(partnerId);
  };

  const handleUploadAnyway = async () => {
    if (loading || uploadingPartnerId) return; // Prevent multiple clicks
    
    // If no currentPartnerId (uploading from dashboard), create new partner
    if (!currentPartnerId) {
      await createNewPartner();
    } else {
      await performUpload(currentPartnerId);
    }
  };

  const createNewPartner = async () => {
    if (!uploadData || !faceDescriptor) {
      Alert.alert('Error', 'Upload data not available');
      return;
    }

    setLoading(true);
    setUploadingPartnerId('create-new'); // Use special ID for create new
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      
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

      const response = await resilientFetch(`${apiUrl}/api/partners/create-with-photo`, {
        method: 'POST',
        body: formData,
        timeout: 60000,
        retryOptions: {
          maxRetries: 2,
          initialDelay: 2000,
          maxDelay: 10000,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.details || 'Failed to create partner');
      }

      const result = await response.json();
      console.log('[SimilarPartnersScreen] Partner created and photo uploaded:', result);
      
      // Navigate to Dashboard after successful creation (not goBack which would go to PhotoUpload)
      // Get the tab navigator (parent) and navigate to Dashboard
      const tabNavigator = navigation.getParent();
      if (tabNavigator) {
        // Navigate to Dashboard tab
        tabNavigator.navigate('Dashboard');
      }
    } catch (error) {
      console.error('[SimilarPartnersScreen] Error creating partner:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create partner and upload photo'
      );
    } finally {
      setLoading(false);
      setUploadingPartnerId(null);
    }
  };

  const handleCancel = () => {
    if (loading) {
      // If uploading, show confirmation
      Alert.alert(
        'Cancel Upload?',
        'Upload is in progress. Are you sure you want to cancel?',
        [
          {
            text: 'Continue Upload',
            style: 'cancel',
          },
          {
            text: 'Cancel',
            style: 'destructive',
            onPress: () => {
              setLoading(false);
              navigation.goBack();
            },
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.previewImagePlaceholder}>
                <Text style={styles.previewImagePlaceholderText}>No preview</Text>
              </View>
            )}
            <View style={styles.headerText}>
              <Text style={styles.title}>This photo resembles other partners</Text>
              <Text style={styles.subtitle}>
                This photo matches photos from other partners:
              </Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {uniquePartners.map((partner) => {
            const profilePictureUrl = partner.partner_profile_picture
              ? getPartnerProfilePictureUrl({ profile_picture_storage_path: partner.partner_profile_picture }, supabaseUrl)
              : null;
            const initials = (partner.partner_name?.[0] || '?').toUpperCase();

            return (
              <View key={partner.partner_id} style={styles.partnerCard}>
                {profilePictureUrl ? (
                  <Image
                    source={{ uri: profilePictureUrl }}
                    style={styles.partnerAvatar}
                  />
                ) : (
                  <View style={styles.partnerAvatarPlaceholder}>
                    <Text style={styles.partnerAvatarText}>{initials}</Text>
                  </View>
                )}
                <View style={styles.partnerInfo}>
                  <View style={styles.partnerNameRow}>
                    <Text style={styles.partnerName} numberOfLines={1}>
                      {partner.partner_name || 'Unknown Partner'}
                    </Text>
                    {partner.black_flag && (
                      <View style={styles.blackFlagBadge}>
                        <BlackFlagIcon width={12} height={12} color="#fff" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.matchSimilarity}>
                    {Math.round(partner.similarity * 100)}% match
                    {partner.matchCount > 1 && `, ${partner.matchCount} photos`}
                  </Text>
                </View>
                <View style={styles.partnerActions}>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => handleViewPartner(partner.partner_id)}
                    disabled={loading || uploadingPartnerId !== null}
                  >
                    <Text style={styles.viewButtonText}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.uploadHereButton, uploadingPartnerId === partner.partner_id && styles.uploadHereButtonDisabled]}
                    onPress={() => handleUploadToPartner(partner.partner_id)}
                    disabled={loading || uploadingPartnerId !== null}
                  >
                    {uploadingPartnerId === partner.partner_id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.uploadHereButtonText}>Upload Here</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={loading || uploadingPartnerId !== null}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          {!currentPartnerId && (
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={createNewPartner}
              disabled={loading || uploadingPartnerId !== null}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.uploadButtonText}>Create New Partner</Text>
              )}
            </TouchableOpacity>
          )}
          {currentPartnerId && (
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={handleUploadAnyway}
              disabled={loading || uploadingPartnerId !== null}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.uploadButtonText}>Upload Anyway</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  previewImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  previewImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e5e7eb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImagePlaceholderText: {
    fontSize: 10,
    color: '#9ca3af',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  partnerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e5e7eb',
  },
  partnerAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerAvatarText: {
    fontSize: 20,
    color: '#9ca3af',
    fontWeight: '500',
  },
  partnerInfo: {
    flex: 1,
    marginLeft: 16,
    minWidth: 0,
  },
  partnerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  partnerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  blackFlagBadge: {
    backgroundColor: '#000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  matchSimilarity: {
    fontSize: 14,
    color: '#6b7280',
  },
  partnerActions: {
    flexDirection: 'column',
    gap: 8,
    marginLeft: 12,
  },
  viewButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#6b7280',
    minWidth: 90,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  uploadHereButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#10b981',
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadHereButtonDisabled: {
    opacity: 0.6,
  },
  uploadHereButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    minWidth: 140,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

