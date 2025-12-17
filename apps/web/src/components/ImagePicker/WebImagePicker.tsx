'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { ImagePickerProps, ImagePickerRef } from './types';

export const WebImagePicker = forwardRef<ImagePickerRef, ImagePickerProps>(
  ({ onSelect, accept = 'image/*', multiple = false, disabled = false }, ref) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      open: () => {
        fileInputRef.current?.click();
      },
    }));

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onSelect(file);
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    return (
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />
    );
  }
);

WebImagePicker.displayName = 'WebImagePicker';

