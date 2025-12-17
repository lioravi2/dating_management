'use client';

import { forwardRef } from 'react';
import { WebImagePicker } from './WebImagePicker';
// import { NativeImagePicker } from './NativeImagePicker'; // For mobile later
import { ImagePickerProps, ImagePickerRef } from './types';

export const ImagePicker = forwardRef<ImagePickerRef, ImagePickerProps>(
  (props, ref) => {
    // For now, always use web version
    // Later: if (Platform.OS === 'web') return <WebImagePicker {...props} ref={ref} />;
    return <WebImagePicker {...props} ref={ref} />;
  }
);

ImagePicker.displayName = 'ImagePicker';

