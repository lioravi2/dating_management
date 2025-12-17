import { IEnvironment } from './types';
import { WebEnvironment } from './web-environment';
// import { NativeEnvironment } from './native-environment'; // For mobile later

export function createEnvironment(): IEnvironment {
  // For now, always use web version
  // Later: if (Platform.OS === 'web') return new WebEnvironment();
  return new WebEnvironment();
}

// Singleton instance
export const environment = createEnvironment();

