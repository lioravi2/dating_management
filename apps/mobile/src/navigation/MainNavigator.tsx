import { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
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
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            try {
              // Reset the Partners stack to PartnersList when tab is pressed
              const state = navigation.getState();
              
              // Validate navigation state structure
              if (!state || !state.routes || !Array.isArray(state.routes)) {
                console.warn('[MainNavigator] Invalid navigation state structure');
                return;
              }
              
              const partnersTab = state.routes.find((r) => r && r.name === 'Partners');
              if (partnersTab && partnersTab.state) {
                const partnersStackState = partnersTab.state;
                
                // Validate stack state structure
                if (!partnersStackState || typeof partnersStackState.index !== 'number' || !Array.isArray(partnersStackState.routes)) {
                  console.warn('[MainNavigator] Invalid Partners stack state structure');
                  return;
                }
                
                // If we're not already on PartnersList, reset the entire stack
                const isOnPartnersList = partnersStackState.index === 0 && 
                                         partnersStackState.routes[0]?.name === 'PartnersList';
                
                if (!isOnPartnersList) {
                  // Use CommonActions.reset to completely reset the Partners stack
                  const resetAction = CommonActions.reset({
                    index: 0,
                    routes: [
                      {
                        name: 'Partners',
                        state: {
                          routes: [{ name: 'PartnersList' }],
                          index: 0,
                        },
                      },
                    ],
                  });
                  
                  // Dispatch and validate the action was created successfully
                  if (resetAction) {
                    navigation.dispatch(resetAction);
                    
                    // Verify the reset succeeded by checking the new state
                    // Note: getState() may not immediately reflect changes, so we check after a brief delay
                    setTimeout(() => {
                      try {
                        const newState = navigation.getState();
                        const newPartnersTab = newState?.routes?.find((r) => r && r.name === 'Partners');
                        const newStackState = newPartnersTab?.state;
                        
                        if (newStackState && 
                            newStackState.index === 0 && 
                            newStackState.routes?.[0]?.name === 'PartnersList') {
                          // Reset succeeded
                        } else {
                          console.warn('[MainNavigator] Navigation reset may not have succeeded - state verification failed');
                        }
                      } catch (verifyError) {
                        console.warn('[MainNavigator] Error verifying navigation reset:', verifyError);
                      }
                    }, 100);
                  } else {
                    console.warn('[MainNavigator] Failed to create reset action');
                  }
                }
              }
            } catch (error) {
              console.error('[MainNavigator] Error resetting Partners navigation:', error);
              // Don't prevent tab navigation on error - allow default behavior
            }
          },
        })}
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
