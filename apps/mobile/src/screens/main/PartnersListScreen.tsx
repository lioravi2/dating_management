import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { supabase } from '../../lib/supabase/client';
import { Partner, PARTNER_SORT_ORDER } from '@dating-app/shared';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PartnersStackParamList } from '../../navigation/types';
import { getPartnerProfilePictureUrl } from '../../lib/photo-utils';
import BlackFlagIcon from '../../components/BlackFlagIcon';

type PartnersListScreenNavigationProp = NativeStackNavigationProp<PartnersStackParamList, 'PartnersList'>;

export default function PartnersListScreen() {
  const navigation = useNavigation<PartnersListScreenNavigationProp>();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastActivities, setLastActivities] = useState<{ [key: string]: string | null }>({});
  const [deletingPartnerId, setDeletingPartnerId] = useState<string | null>(null);

  const loadPartners = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      // Fetch partners
      const { data: partnersData, error: partnersError } = await supabase
        .from('partners')
        .select('*')
        .eq('user_id', session.user.id)
        .order(PARTNER_SORT_ORDER.field, { ascending: PARTNER_SORT_ORDER.ascending });

      if (partnersError) {
        throw partnersError;
      }

      setPartners(partnersData || []);

      // Fetch last activity descriptions for partners without descriptions
      const partnerIds = partnersData?.map(p => p.id) || [];
      if (partnerIds.length > 0) {
        const { data: activities } = await supabase
          .from('partner_notes')
          .select('partner_id, description')
          .in('partner_id', partnerIds)
          .order('start_time', { ascending: false });

        const activitiesMap: { [key: string]: string | null } = {};
        if (activities) {
          activities.forEach((activity) => {
            if (activity.description && !activitiesMap[activity.partner_id]) {
              activitiesMap[activity.partner_id] = activity.description;
            }
          });
        }
        setLastActivities(activitiesMap);
      }
    } catch (err) {
      console.error('Error loading partners:', err);
      setError(err instanceof Error ? err.message : 'Failed to load partners');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadPartners();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadPartners();
  };

  const renderDescriptionWithLinks = (text: string) => {
    // URL regex pattern (non-global for testing individual parts)
    const urlPattern = /^https?:\/\/[^\s]+$/;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return (
      <Text style={styles.description} numberOfLines={2}>
        {parts.map((part, index) => {
          // Use non-global pattern to test individual parts (avoids lastIndex state issues)
          if (urlPattern.test(part)) {
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

  const renderPartnerCard = ({ item: partner }: { item: Partner }) => {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const profilePictureUrl = getPartnerProfilePictureUrl(partner, supabaseUrl);
    const partnerName = partner.first_name || partner.last_name || 'Unnamed Partner';
    const fullName = partner.first_name && partner.last_name
      ? `${partner.first_name} ${partner.last_name}`
      : partnerName;
    const initials = (partner.first_name?.[0] || partner.last_name?.[0] || '?').toUpperCase();
    const description = partner.description || lastActivities[partner.id] || null;
    // Use device locale for date formatting
    const createdDate = new Date(partner.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const updatedDate = partner.updated_at && partner.updated_at !== partner.created_at
      ? new Date(partner.updated_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

    return (
      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => {
            navigation.navigate('PartnerDetail', { partnerId: partner.id });
          }}
          activeOpacity={0.7}
        >
          {profilePictureUrl ? (
            <Image
              source={{ uri: profilePictureUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={[styles.cardContent, { marginLeft: 16, marginRight: 60 }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.partnerName} numberOfLines={2}>
                {fullName}
              </Text>
            </View>
            {partner.black_flag && (
              <View style={styles.blackFlagContainer}>
                <View style={styles.blackFlagBadge}>
                  <BlackFlagIcon width={12} height={12} color="#fff" />
                </View>
              </View>
            )}
            {partner.email && (
              <Text style={styles.cardText} numberOfLines={1}>{partner.email}</Text>
            )}
            {partner.phone_number && (
              <Text style={styles.cardText}>{partner.phone_number}</Text>
            )}
            {description && renderDescriptionWithLinks(description)}
            <View style={styles.dateContainer}>
              <Text style={styles.dateText}>Added {createdDate}</Text>
              {updatedDate && (
                <Text style={[styles.dateText, { marginTop: 4 }]}>Updated {updatedDate}</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.deleteButton, deletingPartnerId === partner.id && styles.deleteButtonDisabled]}
          onPress={() => {
            if (deletingPartnerId === partner.id) return; // Prevent clicks while deleting
            
            Alert.alert(
              'Delete Partner',
              `Are you sure you want to delete ${partnerName}? This will permanently delete all photos, activities, and the partner record. This action cannot be undone.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    setDeletingPartnerId(partner.id);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session) {
                        Alert.alert('Error', 'Not authenticated');
                        setDeletingPartnerId(null);
                        return;
                      }

                      const apiUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
                      
                      const response = await fetch(`${apiUrl}/api/partners/${partner.id}`, {
                        method: 'DELETE',
                        headers: {
                          'Authorization': `Bearer ${session.access_token}`,
                        },
                      });

                      if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                        throw new Error(errorData.error || 'Failed to delete partner');
                      }

                      // Verify deletion by checking if partner still exists
                      const { data: { session: verifySession } } = await supabase.auth.getSession();
                      if (verifySession) {
                        const { data: verifyData, error: verifyError } = await supabase
                          .from('partners')
                          .select('id')
                          .eq('id', partner.id)
                          .eq('user_id', verifySession.user.id)
                          .maybeSingle(); // Use maybeSingle() instead of single() to avoid throwing on no rows
                        
                        // maybeSingle() returns null data when no rows found (expected after successful deletion)
                        // If verifyData exists, partner still exists (deletion failed)
                        if (verifyData) {
                          // Partner still exists, deletion may have failed
                          throw new Error('Partner deletion verification failed');
                        }
                        // If verifyError exists and it's not a "no rows" error, log it but don't fail
                        // (PGRST116 = no rows returned, which is expected after successful deletion)
                        if (verifyError && verifyError.code !== 'PGRST116') {
                          // Unexpected error during verification, but deletion API call succeeded
                          console.warn('Verification query error (non-critical):', verifyError);
                          // Continue anyway as deletion API call succeeded
                        }
                        // If verifyData is null (and no error or PGRST116 error), deletion succeeded
                      }

                      // Reload partners list after successful deletion and verification
                      await loadPartners();
                    } catch (error) {
                      console.error('Error deleting partner:', error);
                      Alert.alert(
                        'Delete Error',
                        error instanceof Error ? error.message : 'Failed to delete partner'
                      );
                    } finally {
                      setDeletingPartnerId(null);
                    }
                  },
                },
              ]
            );
          }}
          disabled={deletingPartnerId === partner.id}
        >
          {deletingPartnerId === partner.id ? (
            <ActivityIndicator size="small" color="#dc2626" />
          ) : (
            <Text style={styles.deleteButtonText}>Delete</Text>
          )}
        </TouchableOpacity>
      </View>
    );
    } catch (err) {
      console.error('Error rendering partner card:', err);
      return (
        <View style={styles.card}>
          <Text style={styles.errorText}>Error rendering partner</Text>
        </View>
      );
    }
  };

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadPartners}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={styles.loadingText}>Loading partners...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Partners</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('PartnerCreate')}
        >
          <Text style={styles.addButtonText}>+ Add Partner</Text>
        </TouchableOpacity>
      </View>

      {partners.length > 0 ? (
        <FlatList
          data={partners}
          renderItem={renderPartnerCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#dc2626']}
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No partners yet.</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('PartnerCreate')}
          >
            <Text style={styles.emptyButtonText}>Add Your First Partner</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb', // gray-50
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827', // gray-900
  },
  addButton: {
    backgroundColor: '#dc2626', // primary-600
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  cardContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  deleteButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 10,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e5e7eb',
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    color: '#9ca3af', // gray-400
    fontWeight: '500',
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  partnerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827', // gray-900
    flex: 1,
  },
  blackFlagContainer: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  blackFlagBadge: {
    backgroundColor: '#000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
  },
  cardText: {
    fontSize: 14,
    color: '#4b5563', // gray-600
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#374151', // gray-700
    marginTop: 12,
    lineHeight: 20,
  },
  linkText: {
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  dateContainer: {
    marginTop: 12,
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280', // gray-500
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#4b5563', // gray-600
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#dc2626', // primary-600
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
});

