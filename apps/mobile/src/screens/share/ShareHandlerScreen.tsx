import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ShareStackParamList } from '../../navigation/types';

type ShareHandlerScreenRouteProp = RouteProp<ShareStackParamList, 'ShareHandler'>;
type ShareHandlerScreenNavigationProp = NativeStackNavigationProp<ShareStackParamList, 'ShareHandler'>;

export default function ShareHandlerScreen() {
  const navigation = useNavigation<ShareHandlerScreenNavigationProp>();
  const route = useRoute<ShareHandlerScreenRouteProp>();
  const { imageUri } = route.params;
  const hasNavigatedRef = useRef(false);

  // Navigate to PhotoUploadScreen with the shared imageUri
  useEffect(() => {
    if (!hasNavigatedRef.current && imageUri) {
      hasNavigatedRef.current = true;
      // Use CommonActions.reset to navigate to Main -> Partners -> PhotoUpload
      // This ensures we navigate from the root level
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'Main' as never,
              state: {
                routes: [
                  {
                    name: 'Partners' as never,
                    state: {
                      routes: [
                        {
                          name: 'PhotoUpload' as never,
                          params: {
                            imageUri: imageUri,
                            source: 'Share',
                          },
                        },
                      ],
                      index: 0,
                    },
                  },
                ],
                index: 1, // Partners tab index
              },
            },
          ],
        })
      );
    }
  }, [imageUri, navigation]);

  // Show simple loading indicator while navigating
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#dc2626" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

