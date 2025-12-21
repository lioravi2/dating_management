import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PartnersStackParamList } from './types';
import PartnersListScreen from '../screens/main/PartnersListScreen';
import PartnerDetailScreen from '../screens/main/PartnerDetailScreen';
import PartnerEditScreen from '../screens/main/PartnerEditScreen';
// TODO: Import PartnerCreate screen when it's created

const Stack = createNativeStackNavigator<PartnersStackParamList>();

export default function PartnersNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="PartnersList" component={PartnersListScreen} />
      <Stack.Screen name="PartnerDetail" component={PartnerDetailScreen} />
      <Stack.Screen name="PartnerEdit" component={PartnerEditScreen} />
      {/* TODO: Add PartnerCreate screen when it's created */}
    </Stack.Navigator>
  );
}

