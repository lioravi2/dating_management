import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainTabParamList } from '../navigation/types';

interface HeaderProps {
  accountType?: string | null;
}

type HeaderNavigationProp = NativeStackNavigationProp<MainTabParamList>;

export default function Header({ accountType }: HeaderProps) {
  const navigation = useNavigation<HeaderNavigationProp>();

  const handleLogoPress = () => {
    // Navigate to Dashboard tab
    navigation.navigate('Dashboard');
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.leftSection}
          onPress={handleLogoPress}
          activeOpacity={0.7}
        >
          <Text style={styles.logo}>🎭</Text>
          <Text style={styles.title}>Dating Assistant</Text>
        </TouchableOpacity>
        {accountType && (
          <View style={[styles.badge, accountType === 'pro' && styles.badgePro]}>
            <Text style={[styles.badgeText, accountType === 'pro' && styles.badgeTextPro]}>
              {accountType === 'pro' ? 'PRO' : 'FREE'}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    fontSize: 24,
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  badge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgePro: {
    backgroundColor: '#dc2626',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  badgeTextPro: {
    color: '#fff',
  },
});

