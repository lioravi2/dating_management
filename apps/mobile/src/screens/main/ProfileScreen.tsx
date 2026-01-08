import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { supabase } from '../../lib/supabase/client';

// Common timezones list (matching web app)
const COMMON_TIMEZONES = [
  { value: 'Asia/Jerusalem', label: 'Jerusalem (GMT+2)' },
  { value: 'America/New_York', label: 'New York (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8)' },
  { value: 'Europe/London', label: 'London (GMT+0)' },
  { value: 'Europe/Paris', label: 'Paris (GMT+1)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (GMT+8)' },
  { value: 'Australia/Sydney', label: 'Sydney (GMT+10)' },
  { value: 'America/Chicago', label: 'Chicago (GMT-6)' },
  { value: 'America/Denver', label: 'Denver (GMT-7)' },
  { value: 'America/Phoenix', label: 'Phoenix (GMT-7)' },
  { value: 'America/Toronto', label: 'Toronto (GMT-5)' },
  { value: 'Europe/Berlin', label: 'Berlin (GMT+1)' },
  { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
  { value: 'Europe/Rome', label: 'Rome (GMT+1)' },
  { value: 'Asia/Dubai', label: 'Dubai (GMT+4)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (GMT+8)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (GMT+2)' },
];

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [formData, setFormData] = useState({
    full_name: '',
    timezone: 'Asia/Jerusalem',
  });
  const [calendarConnections, setCalendarConnections] = useState<Array<{ provider: string; connected: boolean }>>([]);

  useEffect(() => {
    loadUserData();
    loadCalendarConnections();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);

        // Fetch user profile from users table
        const { data: profileData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileData) {
          setUserData(profileData);
          setFormData({
            full_name: profileData.full_name || '',
            timezone: profileData.timezone || 'Asia/Jerusalem',
          });
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarConnections = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from('calendar_connections')
        .select('provider')
        .eq('user_id', session.user.id);

      const connected = data?.map((c) => c.provider) || [];
      setCalendarConnections([
        { provider: 'google', connected: connected.includes('google') },
        { provider: 'outlook', connected: connected.includes('outlook') },
      ]);
    } catch (error) {
      console.error('Error loading calendar connections:', error);
      // Set default connections if table doesn't exist yet
      setCalendarConnections([
        { provider: 'google', connected: false },
        { provider: 'outlook', connected: false },
      ]);
    }
  };

  const handleSave = async () => {
    if (!userData) return;

    setSaving(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          timezone: formData.timezone,
        })
        .eq('id', userData.id);

      if (error) {
        setMessage('Error updating profile: ' + error.message);
      } else {
        setMessage('Profile updated successfully!');
        // Reload user data
        await loadUserData();
        setIsEditing(false);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error: any) {
      setMessage('Error: ' + (error.message || 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original values
    if (userData) {
      setFormData({
        full_name: userData.full_name || '',
        timezone: userData.timezone || 'Asia/Jerusalem',
      });
    }
    setIsEditing(false);
    setMessage('');
  };

  const handleSignOut = async () => {
    try {
      // Get session before signing out (needed for server-side tracking)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.access_token) {
        // Call server endpoint to trigger server-side [User Signed Out] tracking
        // This ensures the event is tracked server-side (consistent with web app)
        const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || process.env.EXPO_PUBLIC_API_URL;
        if (webAppUrl) {
          try {
            await fetch(`${webAppUrl}/auth/signout`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
            }).catch((error) => {
              // Ignore errors - tracking is best effort, don't block sign out
              console.log('[ProfileScreen] Server signout tracking failed (non-blocking):', error);
            });
          } catch (error) {
            // Ignore errors - tracking is best effort
            console.log('[ProfileScreen] Error calling server signout endpoint (non-blocking):', error);
          }
        } else {
          console.warn('[ProfileScreen] EXPO_PUBLIC_WEB_APP_URL not set - skipping server-side tracking');
        }
      }
      
      // Now do client-side sign out
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // Use device locale for date formatting
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#dc2626" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const userName = userData?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';
  const accountType = userData?.account_type || 'free';
  const hasChanges = isEditing && (
    formData.full_name !== (userData?.full_name || '') ||
    formData.timezone !== (userData?.timezone || 'Asia/Jerusalem')
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.profileCard}>
          <View style={styles.headerRow}>
            <Text style={styles.profileTitle}>Profile</Text>
            {!isEditing && (
              <TouchableOpacity
                onPress={() => setIsEditing(true)}
                style={styles.editButton}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {message ? (
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

          <View style={styles.infoSection}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{userEmail}</Text>
            <Text style={styles.hint}>Email cannot be changed</Text>
          </View>

          {userData?.created_at && (
            <View style={styles.infoSection}>
              <Text style={styles.label}>Member Since</Text>
              <Text style={styles.value}>{formatDate(userData.created_at)}</Text>
            </View>
          )}

          <View style={styles.infoSection}>
            <Text style={styles.label}>Full Name</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={formData.full_name}
                onChangeText={(text) => setFormData({ ...formData, full_name: text })}
                placeholder="Enter your full name"
                placeholderTextColor="#9ca3af"
              />
            ) : (
              <Text style={styles.value}>{userName}</Text>
            )}
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.label}>Timezone</Text>
            {isEditing ? (
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.timezone}
                  onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                  style={styles.picker}
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <Picker.Item key={tz.value} label={tz.label} value={tz.value} />
                  ))}
                </Picker>
              </View>
            ) : (
              <Text style={styles.value}>
                {COMMON_TIMEZONES.find((tz) => tz.value === (userData?.timezone || 'Asia/Jerusalem'))?.label ||
                  userData?.timezone ||
                  'Asia/Jerusalem'}
              </Text>
            )}
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.label}>Account Type</Text>
            <View style={styles.accountTypeBadge}>
              <Text style={[styles.accountTypeText, accountType === 'pro' && styles.accountTypePro]}>
                {accountType === 'pro' ? 'PRO' : 'FREE'}
              </Text>
            </View>
          </View>

          {isEditing && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={handleCancel}
                disabled={saving}
                style={[styles.cancelButton, saving && styles.buttonDisabled]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving || !hasChanges}
                style={[
                  styles.saveButton,
                  (saving || !hasChanges) && styles.buttonDisabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Calendar Connections Section */}
        <View style={styles.profileCard}>
          <Text style={styles.sectionTitle}>Calendar Connections</Text>
          <Text style={styles.sectionDescription}>
            Connect your calendar to sync activities automatically. Calendar connections will be available in a future update.
          </Text>
          <View style={styles.calendarConnectionsList}>
            {calendarConnections.map((connection) => (
              <View key={connection.provider} style={styles.calendarConnectionItem}>
                <View style={styles.calendarConnectionInfo}>
                  <Text style={styles.calendarProviderName}>
                    {connection.provider.charAt(0).toUpperCase() + connection.provider.slice(1)}
                  </Text>
                  {connection.connected ? (
                    <View style={styles.connectedBadge}>
                      <Text style={styles.connectedBadgeText}>Connected</Text>
                    </View>
                  ) : (
                    <View style={styles.notConnectedBadge}>
                      <Text style={styles.notConnectedBadgeText}>Not connected</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.comingSoonText}>Coming soon</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Debug Section */}
        <View style={styles.profileCard}>
          <Text style={styles.sectionTitle}>Debug</Text>
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => navigation.navigate('AmplitudeDebug' as any)}
          >
            <Text style={styles.debugButtonText}>Debug Amplitude</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
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
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 14,
  },
  profileCard: {
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  editButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
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
    color: '#991b1b',
  },
  infoSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },
  accountTypeBadge: {
    alignSelf: 'flex-start',
  },
  accountTypeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  accountTypePro: {
    color: '#dc2626',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  calendarConnectionsList: {
    gap: 12,
  },
  calendarConnectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
  },
  calendarConnectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarProviderName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    textTransform: 'capitalize',
  },
  connectedBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  connectedBadgeText: {
    fontSize: 12,
    color: '#065f46',
    fontWeight: '600',
  },
  notConnectedBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  notConnectedBadgeText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  comingSoonText: {
    fontSize: 12,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  signOutButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugButton: {
    backgroundColor: '#2196f3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
