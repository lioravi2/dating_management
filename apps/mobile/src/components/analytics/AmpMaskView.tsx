import React from 'react';
import { StyleProp, ViewStyle, View } from 'react-native';

interface AmpMaskViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Session replay plugin - optional (may not be available in all builds)
let BaseAmpMaskView: any = null;
try {
  const sessionReplayModule = require('@amplitude/plugin-session-replay-react-native');
  BaseAmpMaskView = sessionReplayModule.AmpMaskView || sessionReplayModule.default?.AmpMaskView;
} catch (error) {
  // Session replay plugin not available - will fall back to regular View
  console.warn('[AmpMaskView] Session replay plugin not available - using fallback View');
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
 * Note: The React Native Session Replay plugin does not support global maskLevel
 * configuration. Use this component to explicitly mask sensitive content that should
 * not appear in session replays.
 * 
 * If session replay is not available, this component will fall back to a regular View.
 */
export default function AmpMaskView({ children, style }: AmpMaskViewProps) {
  // If session replay plugin is available, use it; otherwise fall back to regular View
  if (BaseAmpMaskView) {
    return (
      <BaseAmpMaskView mask="amp-mask" style={style}>
        {children}
      </BaseAmpMaskView>
    );
  }
  
  // Fallback to regular View if session replay is not available
  return <View style={style}>{children}</View>;
}

