import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PartnersStackParamList } from './types';
import PartnersListScreen from '../screens/main/PartnersListScreen';
import PartnerDetailScreen from '../screens/main/PartnerDetailScreen';
import PartnerEditScreen from '../screens/main/PartnerEditScreen';
import PartnerCreateScreen from '../screens/main/PartnerCreateScreen';
import SimilarPartnersScreen from '../screens/main/SimilarPartnersScreen';
import PhotoUploadScreen from '../screens/main/PhotoUploadScreen';

const Stack = createNativeStackNavigator<PartnersStackParamList>();

export default function PartnersNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="PartnersList"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="PartnersList" component={PartnersListScreen} />
      <Stack.Screen name="PartnerDetail" component={PartnerDetailScreen} />
      <Stack.Screen name="PartnerEdit" component={PartnerEditScreen} />
      <Stack.Screen name="PartnerCreate" component={PartnerCreateScreen} />
      <Stack.Screen 
        name="SimilarPartners" 
        component={SimilarPartnersScreen}
        options={{
          headerShown: true,
          title: 'Similar Partners',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="PhotoUpload"
        component={PhotoUploadScreen}
        options={{
          headerShown: true,
          title: 'Upload Photo',
          headerBackTitle: 'Back',
        }}
      />
    </Stack.Navigator>
  );
}

