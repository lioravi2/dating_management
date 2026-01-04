import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ShareStackParamList } from './types';
import ShareHandlerScreen from '../screens/share/ShareHandlerScreen';

const Stack = createNativeStackNavigator<ShareStackParamList>();

export default function ShareNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ShareHandler" component={ShareHandlerScreen} />
    </Stack.Navigator>
  );
}











