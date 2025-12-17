export interface ImagePickerProps {
  onSelect: (file: File) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
}

export interface ImagePickerRef {
  open: () => void;
}

