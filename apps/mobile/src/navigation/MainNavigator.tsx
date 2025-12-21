import { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabParamList } from './types';
import DashboardScreen from '../screens/main/DashboardScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import PartnersNavigator from './PartnersNavigator';
import Header from '../components/Header';
import { supabase } from '../lib/supabase/client';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainNavigator() {
  const [accountType, setAccountType] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const fetchAccountType = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: userData } = await supabase
          .from('users')
          .select('account_type')
          .eq('id', session.user.id)
          .single();
        setAccountType(userData?.account_type || null);
      }
    };
    fetchAccountType();
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        header: () => <Header accountType={accountType} />,
        tabBarActiveTintColor: '#dc2626',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          height: 60 + Math.max(insets.bottom, 8),
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: () => null, // We'll add icons later if needed
        }}
      />
      <Tab.Screen
        name="Partners"
        component={PartnersNavigator}
        options={{
          tabBarLabel: 'Partners',
          tabBarIcon: () => null, // We'll add icons later if needed
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: () => null, // We'll add icons later if needed
        }}
      />
    </Tab.Navigator>
  );
}
