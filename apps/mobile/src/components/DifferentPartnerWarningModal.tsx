import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FaceMatch } from '@dating-app/shared';
import { getPartnerProfilePictureUrl } from '../lib/photo-utils';
import BlackFlagIcon from './BlackFlagIcon';
import { MainTabParamList } from '../navigation/types';
import { PartnersStackParamList } from '../navigation/types';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<PartnersStackParamList>
>;

interface DifferentPartnerWarningModalProps {
  visible: boolean;
  matches: FaceMatch[];
  onUploadAnyway: () => void;
  onUploadToPartner: (partnerId: string) => void;
  onCancel: () => void;
  onViewPartner?: (partnerId: string) => void;
}

export default function DifferentPartnerWarningModal({
  visible,
  matches,
  onUploadAnyway,
  onUploadToPartner,
  onCancel,
  onViewPartner,
}: DifferentPartnerWarningModalProps) {
  const navigation = useNavigation<NavigationProp>();
  const [viewingPartnerId, setViewingPartnerId] = useState<string | null>(null);
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

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

  // Note: Modal visibility is controlled by parent component
  // React Native Modal components persist across navigation automatically

  const handleViewPartner = (partnerId: string) => {
    setViewingPartnerId(partnerId);
    // Notify parent that we're viewing a partner (so it can track state)
    if (onViewPartner) {
      onViewPartner(partnerId);
    }
    // Navigate to Partners tab, then to PartnerDetail
    navigation.navigate('Partners', {
      screen: 'PartnerDetail',
      params: { partnerId },
    });
  };

  const handleUploadToPartner = (partnerId: string) => {
    setViewingPartnerId(null);
    onUploadToPartner(partnerId);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>This photo resembles other partners</Text>
          <Text style={styles.message}>
            This photo matches photos from other partners:
          </Text>

          <ScrollView style={styles.matchesContainer}>
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
                    >
                      <Text style={styles.viewButtonText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.uploadHereButton}
                      onPress={() => handleUploadToPartner(partner.partner_id)}
                    >
                      <Text style={styles.uploadHereButtonText}>Upload Here</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={onUploadAnyway}
            >
              <Text style={styles.uploadButtonText}>Upload Anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  matchesContainer: {
    maxHeight: 300,
    marginBottom: 24,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  partnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
  },
  partnerAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerAvatarText: {
    fontSize: 18,
    color: '#9ca3af',
    fontWeight: '500',
  },
  partnerInfo: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  partnerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  partnerName: {
    fontSize: 16,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#6b7280',
    minWidth: 80,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  uploadHereButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#10b981',
    minWidth: 80,
  },
  uploadHereButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: 20,
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#dc2626',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

