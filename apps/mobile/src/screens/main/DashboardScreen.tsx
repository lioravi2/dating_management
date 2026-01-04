import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, RefreshControl, Linking } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { supabase } from '../../lib/supabase/client';
import { Partner, PARTNER_SORT_ORDER } from '@dating-app/shared';
import { getPartnerProfilePictureUrl } from '../../lib/photo-utils';
import BlackFlagIcon from '../../components/BlackFlagIcon';
import { MainTabParamList } from '../../navigation/types';
import { PartnersStackParamList } from '../../navigation/types';
import { BUILD_NUMBER } from '../../lib/build-info';

type DashboardScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Dashboard'>,
  NativeStackNavigationProp<PartnersStackParamList>
>;

// Homepage - shows welcome, recent partners, and quick actions
export default function DashboardScreen() {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const [user, setUser] = useState<any>(null);
  const [recentPartners, setRecentPartners] = useState<Partner[]>([]);
  const [lastActivities, setLastActivities] = useState<{ [key: string]: string | null }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);

        // Fetch user profile
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userData) {
          setUser({ ...session.user, ...userData });
        }

        // Fetch recent partners (3 most recently updated)
        const { data: partners, error: partnersError } = await supabase
          .from('partners')
          .select('*')
          .eq('user_id', session.user.id)
          .order(PARTNER_SORT_ORDER.field, { ascending: PARTNER_SORT_ORDER.ascending })
          .limit(3);

        if (!partnersError && partners) {
          setRecentPartners(partners);

          // Fetch last activity descriptions for partners without descriptions
          const partnerIds = partners.map(p => p.id);
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
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = useCallback(() => {
    loadData(true);
  }, []);

  const renderDescriptionWithLinks = (text: string) => {
    // URL regex pattern (non-global for testing individual parts)
    const urlPattern = /^https?:\/\/[^\s]+$/;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return (
      <Text style={styles.partnerDescription} numberOfLines={2}>
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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <View style={styles.container}>
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
      {/* Welcome Section */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeTitle}>
          Welcome{userName !== 'User' ? `, ${userName}` : ''}! 👋
        </Text>
        <Text style={styles.welcomeSubtitle}>
          Here's your dashboard overview
        </Text>
      </View>

      {/* Recent Partners Section */}
      {recentPartners.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Partners</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Partners', { screen: 'PartnersList' })}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllButtonText}>View all partners →</Text>
            </TouchableOpacity>
          </View>
          {recentPartners.map((partner) => {
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
              <TouchableOpacity
                key={partner.id}
                style={styles.partnerCard}
                onPress={() => {
                  // Navigate to Partners tab, then to PartnerDetail
                  navigation.navigate('Partners', {
                    screen: 'PartnerDetail',
                    params: { partnerId: partner.id, source: 'Dashboard' },
                  });
                }}
                activeOpacity={0.7}
              >
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
                  <View style={styles.partnerHeader}>
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
                    <Text style={styles.partnerEmail} numberOfLines={1}>
                      {partner.email}
                    </Text>
                  )}
                  {description && renderDescriptionWithLinks(description)}
                  <View style={styles.partnerDates}>
                    <Text style={styles.partnerDateText}>
                      Added {createdDate}
                    </Text>
                    {updatedDate && (
                      <Text style={styles.partnerDateText}>
                        Updated {updatedDate}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Quick Actions Section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={[styles.actionCard, styles.actionCardGreen]}>
            <Text style={styles.actionTitle}>Add Partner</Text>
            <Text style={styles.actionSubtitle}>Add a new partner</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionCard, styles.actionCardPurple]}
            onPress={() => {
              // Navigate to Partners tab first, then to PhotoUpload screen
              // Use setTimeout to ensure navigation stack is ready
              // Add timestamp to ensure fresh navigation each time
              setTimeout(() => {
                navigation.navigate('Partners', {
                  screen: 'PhotoUpload',
                  params: { source: 'Dashboard', timestamp: Date.now() },
                });
              }, 100);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.actionTitle}>Upload Photo</Text>
            <Text style={styles.actionSubtitle}>Find or create a partner</Text>
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>
      {/* Build number in bottom right corner */}
      <View style={styles.buildNumberContainer}>
        <Text style={styles.buildNumberText}>{BUILD_NUMBER}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  contentContainer: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
  },
  welcomeCard: {
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
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllButton: {
    paddingVertical: 4,
  },
  viewAllButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
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
  partnerHeader: {
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
  partnerEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  partnerDescription: {
    fontSize: 14,
    color: '#374151',
    marginTop: 12,
    lineHeight: 20,
  },
  linkText: {
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  partnerDates: {
    marginTop: 12,
  },
  partnerDateText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  actionsGrid: {
    gap: 12,
  },
  actionCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 12,
  },
  actionCardGreen: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  actionCardPurple: {
    backgroundColor: '#faf5ff',
    borderColor: '#e9d5ff',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  buildNumberContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  buildNumberText: {
    fontSize: 10,
    color: '#fff',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
});

