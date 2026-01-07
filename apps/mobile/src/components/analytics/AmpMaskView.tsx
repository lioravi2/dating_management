import React from 'react';
import { AmpMaskView as BaseAmpMaskView } from '@amplitude/plugin-session-replay-react-native';
import { StyleProp, ViewStyle } from 'react-native';

interface AmpMaskViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wrapper component for masking sensitive content in Amplitude Session Replay
 * 
 * Use this component to wrap any sensitive content that should be masked in session replays,
 * such as:
 * - Password input fields
 * - Email addresses
 * - Credit card information
 * - Personal information
 * - API keys or tokens
 * 
 * Example usage:
 * ```tsx
 * <AmpMaskView style={{ flex: 1 }}>
 *   <TextInput 
 *     placeholder="Password" 
 *     secureTextEntry 
 *   />
 * </AmpMaskView>
 * ```
 * 
 * Note: The global maskLevel setting in analytics/index.ts is set to 'medium',
 * which already masks all editable text views. Use this component for additional
 * explicit masking of specific UI elements.
 */
export default function AmpMaskView({ children, style }: AmpMaskViewProps) {
  return (
    <BaseAmpMaskView mask="amp-mask" style={style}>
      {children}
    </BaseAmpMaskView>
  );
}

