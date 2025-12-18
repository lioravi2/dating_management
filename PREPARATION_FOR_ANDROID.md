# Preparing Codebase for Android Migration

This document identifies web-specific code that should be refactored to make Android migration easier. **Do not implement these changes yet** - use this as a reference when you're ready to begin migration.

## 📋 Table of Contents

1. [Critical Abstractions Needed](#critical-abstractions-needed)
2. [Component Updates](#component-updates)
3. [Navigation & Routing](#navigation--routing)
4. [Styling Migration](#styling-migration)
5. [Implementation Order](#implementation-order)
6. [Testing Strategy](#testing-strategy)

---

## 🔴 Critical Abstractions Needed

### 1. Image Picker Component

**Current State**: Direct HTML file input usage

**Location**: `apps/web/src/components/PhotoUploadWithFaceMatch.tsx` (lines 1055-1061)

**Current Code**:
```tsx
<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  onChange={handleFileSelect}
  className="hidden"
/>

// Triggered by:
<button onClick={() => fileInputRef.current?.click()}>
  Select Photo
</button>
```

**Problem**: 
- HTML `<input type="file">` doesn't exist in React Native
- `fileInputRef.current?.click()` won't work on mobile
- File selection API is completely different

**Proposed Solution**:

**Step 1**: Create abstraction interface
```typescript
// apps/web/src/components/ImagePicker/types.ts
export interface ImagePickerProps {
  onSelect: (file: File) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
}

export interface ImagePickerRef {
  open: () => void;
}
```

**Step 2**: Create web implementation
```typescript
// apps/web/src/components/ImagePicker/WebImagePicker.tsx
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
```

**Step 3**: Create platform-aware wrapper (for future mobile)
```typescript
// apps/web/src/components/ImagePicker/ImagePicker.tsx
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
```

**Step 4**: Export from index
```typescript
// apps/web/src/components/ImagePicker/index.ts
export { ImagePicker } from './ImagePicker';
export type { ImagePickerProps, ImagePickerRef } from './types';
```

**Step 5**: Update usage in PhotoUploadWithFaceMatch.tsx
```typescript
// Replace:
const fileInputRef = useRef<HTMLInputElement>(null);
// With:
const imagePickerRef = useRef<ImagePickerRef>(null);

// Replace the <input> element with:
<ImagePicker
  ref={imagePickerRef}
  onSelect={handleFileSelect}
  accept="image/*"
/>

// Replace button onClick:
<button onClick={() => imagePickerRef.current?.open()}>
  Select Photo
</button>
```

**Files to Create**:
- `apps/web/src/components/ImagePicker/types.ts`
- `apps/web/src/components/ImagePicker/WebImagePicker.tsx`
- `apps/web/src/components/ImagePicker/ImagePicker.tsx`
- `apps/web/src/components/ImagePicker/index.ts`

**Files to Modify**:
- `apps/web/src/components/PhotoUploadWithFaceMatch.tsx`

---

### 2. File Utilities Abstraction

**Current State**: Direct FileReader API usage

**Location**: `apps/web/src/components/PhotoUploadWithFaceMatch.tsx` (lines 83-96)

**Current Code**:
```typescript
const convertBlobToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
};
```

**Problem**: FileReader API doesn't exist in React Native

**Proposed Solution**:

**Step 1**: Create interface
```typescript
// apps/web/src/lib/file-utils/types.ts
export interface IFileUtils {
  fileToBase64(file: File | Blob): Promise<string>;
  fileToBlob(file: File | Blob): Promise<Blob>;
  getFileSize(file: File | Blob): number;
  getFileType(file: File | Blob): string;
}
```

**Step 2**: Create web implementation
```typescript
// apps/web/src/lib/file-utils/web-file-utils.ts
import { IFileUtils } from './types';

export class WebFileUtils implements IFileUtils {
  async fileToBase64(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(file);
    });
  }

  async fileToBlob(file: File | Blob): Promise<Blob> {
    if (file instanceof Blob) {
      return file;
    }
    return new Blob([file], { type: file.type });
  }

  getFileSize(file: File | Blob): number {
    return file.size;
  }

  getFileType(file: File | Blob): string {
    if (file instanceof File) {
      return file.type;
    }
    return 'application/octet-stream';
  }
}
```

**Step 3**: Create factory
```typescript
// apps/web/src/lib/file-utils/factory.ts
import { IFileUtils } from './types';
import { WebFileUtils } from './web-file-utils';
// import { NativeFileUtils } from './native-file-utils'; // For mobile later

export function createFileUtils(): IFileUtils {
  // For now, always use web version
  // Later: if (Platform.OS === 'web') return new WebFileUtils();
  return new WebFileUtils();
}

// Singleton instance
export const fileUtils = createFileUtils();
```

**Step 4**: Update usage
```typescript
// Replace:
import { fileUtils } from '@/lib/file-utils';

// Replace convertBlobToBase64 function with:
const base64 = await fileUtils.fileToBase64(file);
```

**Files to Create**:
- `apps/web/src/lib/file-utils/types.ts`
- `apps/web/src/lib/file-utils/web-file-utils.ts`
- `apps/web/src/lib/file-utils/factory.ts`
- `apps/web/src/lib/file-utils/index.ts`

**Files to Modify**:
- `apps/web/src/components/PhotoUploadWithFaceMatch.tsx`

---

### 3. Canvas/Image Processing Abstraction

**Current State**: Direct Canvas API usage throughout face detection

**Locations**:
- `apps/web/src/lib/face-detection/providers/face-api-provider.ts` (multiple locations)
- `apps/web/src/components/FaceSelectionUI.tsx`
- `apps/web/src/components/PhotoUploadWithFaceMatch.tsx` (line 347)

**Current Code Examples**:
```typescript
// face-api-provider.ts
createdCanvas = document.createElement('canvas');
createdCanvas.width = image.width;
createdCanvas.height = image.height;
const ctx = createdCanvas.getContext('2d');
ctx.putImageData(image, 0, 0);

// FaceSelectionUI.tsx
const canvas = canvasRef.current;
const ctx = canvas.getContext('2d');
ctx.clearRect(0, 0, canvas.width, canvas.height);
ctx.drawImage(img, 0, 0);

// PhotoUploadWithFaceMatch.tsx
const canvas = document.createElement('canvas');
canvas.width = boundingBox.width;
canvas.height = boundingBox.height;
const ctx = canvas.getContext('2d');
ctx.drawImage(img, ...);
canvas.toBlob((blob) => { ... });
```

**Problem**: Canvas API doesn't exist in React Native - need expo-gl or native image processing

**Proposed Solution**:

**Step 1**: Create comprehensive interface
```typescript
// apps/web/src/lib/image-processing/types.ts
export interface IImage {
  width: number;
  height: number;
  getData(): Promise<ImageData | Uint8Array>;
}

export interface ICanvas {
  width: number;
  height: number;
  getContext(type: '2d'): ICanvasContext | null;
  toBlob(type?: string, quality?: number): Promise<Blob>;
  toDataURL(type?: string, quality?: number): string;
}

export interface ICanvasContext {
  clearRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: IImage | ICanvas, dx: number, dy: number): void;
  drawImage(image: IImage | ICanvas, dx: number, dy: number, dw: number, dh: number): void;
  putImageData(imageData: ImageData, dx: number, dy: number): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
}

export interface IImageProcessor {
  createCanvas(width: number, height: number): ICanvas;
  loadImage(src: string | File | Blob): Promise<IImage>;
  createImageData(width: number, height: number): ImageData;
  resizeImage(image: IImage, maxWidth: number, maxHeight: number): Promise<IImage>;
  cropImage(image: IImage, x: number, y: number, width: number, height: number): Promise<Blob>;
}
```

**Step 2**: Create web implementation
```typescript
// apps/web/src/lib/image-processing/web-processor.ts
import { IImageProcessor, ICanvas, IImage, ICanvasContext } from './types';

class WebCanvas implements ICanvas {
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  get width() { return this.canvas.width; }
  get height() { return this.canvas.height; }
  set width(v) { this.canvas.width = v; }
  set height(v) { this.canvas.height = v; }

  getContext(type: '2d'): ICanvasContext | null {
    const ctx = this.canvas.getContext('2d');
    return ctx ? new WebCanvasContext(ctx) : null;
  }

  async toBlob(type?: string, quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Failed to create blob')),
        type,
        quality
      );
    });
  }

  toDataURL(type?: string, quality?: number): string {
    return this.canvas.toDataURL(type, quality);
  }
}

class WebCanvasContext implements ICanvasContext {
  constructor(private ctx: CanvasRenderingContext2D) {}

  clearRect(x: number, y: number, w: number, h: number): void {
    this.ctx.clearRect(x, y, w, h);
  }

  drawImage(image: IImage | ICanvas, ...args: number[]): void {
    // Implementation for different drawImage overloads
    if (image instanceof WebCanvas) {
      this.ctx.drawImage(image['canvas'], ...args);
    } else if (image instanceof WebImage) {
      this.ctx.drawImage(image['img'], ...args);
    }
  }

  putImageData(imageData: ImageData, dx: number, dy: number): void {
    this.ctx.putImageData(imageData, dx, dy);
  }

  getImageData(sx: number, sy: number, sw: number, sh: number): ImageData {
    return this.ctx.getImageData(sx, sy, sw, sh);
  }
}

class WebImage implements IImage {
  constructor(private img: HTMLImageElement) {}

  get width() { return this.img.naturalWidth || this.img.width; }
  get height() { return this.img.naturalHeight || this.img.height; }

  async getData(): Promise<ImageData> {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get context');
    ctx.drawImage(this.img, 0, 0);
    return ctx.getImageData(0, 0, this.width, this.height);
  }
}

export class WebImageProcessor implements IImageProcessor {
  createCanvas(width: number, height: number): ICanvas {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return new WebCanvas(canvas);
  }

  async loadImage(src: string | File | Blob): Promise<IImage> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(new WebImage(img));
      img.onerror = reject;
      
      if (src instanceof File || src instanceof Blob) {
        img.src = URL.createObjectURL(src);
      } else {
        img.src = src;
      }
    });
  }

  createImageData(width: number, height: number): ImageData {
    return new ImageData(width, height);
  }

  async resizeImage(image: IImage, maxWidth: number, maxHeight: number): Promise<IImage> {
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    const newWidth = Math.round(image.width * scale);
    const newHeight = Math.round(image.height * scale);
    
    const canvas = this.createCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get context');
    
    ctx.drawImage(image, 0, 0, newWidth, newHeight);
    // Convert canvas back to image... (implementation details)
    return image; // Simplified
  }

  async cropImage(image: IImage, x: number, y: number, width: number, height: number): Promise<Blob> {
    const canvas = this.createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get context');
    
    ctx.drawImage(image, -x, -y);
    return canvas.toBlob();
  }
}
```

**Step 3**: Create factory
```typescript
// apps/web/src/lib/image-processing/factory.ts
import { IImageProcessor } from './types';
import { WebImageProcessor } from './web-processor';
// import { NativeImageProcessor } from './native-processor'; // For mobile later

export function createImageProcessor(): IImageProcessor {
  return new WebImageProcessor();
}

export const imageProcessor = createImageProcessor();
```

**Note**: This is a large refactor. Consider doing it incrementally:
1. Start with face-api-provider.ts
2. Then FaceSelectionUI.tsx
3. Finally PhotoUploadWithFaceMatch.tsx

**Files to Create**:
- `apps/web/src/lib/image-processing/types.ts`
- `apps/web/src/lib/image-processing/web-processor.ts`
- `apps/web/src/lib/image-processing/factory.ts`
- `apps/web/src/lib/image-processing/index.ts`

**Files to Modify**:
- `apps/web/src/lib/face-detection/providers/face-api-provider.ts`
- `apps/web/src/components/FaceSelectionUI.tsx`
- `apps/web/src/components/PhotoUploadWithFaceMatch.tsx`

---

### 4. Navigation Abstraction

**Current State**: Direct Next.js router and window.location usage

**Locations**: 66 files use Next.js routing

**Current Code Examples**:
```typescript
// Using Next.js router
import { useRouter } from 'next/navigation';
const router = useRouter();
router.push('/partners');
router.replace('/dashboard');

// Using window.location
window.location.href = `/partners/${partner.id}`;
window.location.reload();

// Using Next.js Link
import Link from 'next/link';
<Link href="/partners">Partners</Link>

// Using search params
import { useSearchParams } from 'next/navigation';
const searchParams = useSearchParams();
const param = searchParams.get('key');
```

**Problem**: Next.js-specific APIs won't work in React Native

**Proposed Solution**:

**Step 1**: Create navigation interface
```typescript
// apps/web/src/lib/navigation/types.ts
export interface NavigationParams {
  [key: string]: string | number | boolean | undefined;
}

export interface INavigation {
  push(path: string, params?: NavigationParams): void;
  replace(path: string, params?: NavigationParams): void;
  goBack(): void;
  canGoBack(): boolean;
  getCurrentPath(): string;
  getParams(): NavigationParams;
  setParams(params: NavigationParams): void;
}

export interface ILinkProps {
  href: string;
  params?: NavigationParams;
  children: React.ReactNode;
  className?: string;
  replace?: boolean;
}
```

**Step 2**: Create web implementation
```typescript
// apps/web/src/lib/navigation/web-navigation.tsx
'use client';

import { useRouter, usePathname, useSearchParams as useNextSearchParams } from 'next/navigation';
import { createContext, useContext, ReactNode } from 'react';
import Link from 'next/link';
import { INavigation, NavigationParams, ILinkProps } from './types';

class WebNavigation implements INavigation {
  constructor(
    private router: ReturnType<typeof useRouter>,
    private pathname: string,
    private searchParams: URLSearchParams
  ) {}

  push(path: string, params?: NavigationParams): void {
    const url = this.buildUrl(path, params);
    this.router.push(url);
  }

  replace(path: string, params?: NavigationParams): void {
    const url = this.buildUrl(path, params);
    this.router.replace(url);
  }

  goBack(): void {
    this.router.back();
  }

  canGoBack(): boolean {
    // Next.js doesn't have a direct way to check this
    // Could use window.history.length > 1
    return typeof window !== 'undefined' && window.history.length > 1;
  }

  getCurrentPath(): string {
    return this.pathname;
  }

  getParams(): NavigationParams {
    const params: NavigationParams = {};
    this.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  setParams(params: NavigationParams): void {
    const current = new URLSearchParams(this.searchParams);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) {
        current.delete(key);
      } else {
        current.set(key, String(value));
      }
    });
    const newPath = `${this.pathname}?${current.toString()}`;
    this.router.replace(newPath);
  }

  private buildUrl(path: string, params?: NavigationParams): string {
    if (!params || Object.keys(params).length === 0) {
      return path;
    }
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });
    return `${path}?${searchParams.toString()}`;
  }
}

const NavigationContext = createContext<INavigation | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useNextSearchParams();
  
  const navigation = new WebNavigation(router, pathname, searchParams);

  return (
    <NavigationContext.Provider value={navigation}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): INavigation {
  const navigation = useContext(NavigationContext);
  if (!navigation) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return navigation;
}

export function NavigationLink({ href, params, children, className, replace }: ILinkProps) {
  const navigation = useNavigation();
  
  const handlePress = (e: React.MouseEvent) => {
    e.preventDefault();
    if (replace) {
      navigation.replace(href, params);
    } else {
      navigation.push(href, params);
    }
  };

  return (
    <Link href={href} className={className} onClick={handlePress}>
      {children}
    </Link>
  );
}
```

**Step 3**: Update app layout to include provider
```typescript
// apps/web/src/app/layout.tsx
import { NavigationProvider } from '@/lib/navigation/web-navigation';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavigationProvider>
          {children}
        </NavigationProvider>
      </body>
    </html>
  );
}
```

**Step 4**: Update usage examples
```typescript
// Replace:
import { useRouter } from 'next/navigation';
const router = useRouter();
router.push('/partners');

// With:
import { useNavigation } from '@/lib/navigation';
const navigation = useNavigation();
navigation.push('/partners');

// Replace:
window.location.href = `/partners/${id}`;

// With:
navigation.replace(`/partners/${id}`);

// Replace:
import Link from 'next/link';
<Link href="/partners">Partners</Link>

// With:
import { NavigationLink } from '@/lib/navigation';
<NavigationLink href="/partners">Partners</NavigationLink>
```

**Files to Create**:
- `apps/web/src/lib/navigation/types.ts`
- `apps/web/src/lib/navigation/web-navigation.tsx`
- `apps/web/src/lib/navigation/index.ts`

**Files to Modify**:
- `apps/web/src/app/layout.tsx` (add provider)
- All 66 files using Next.js routing (gradual migration)

---

### 5. Environment/URL Helper

**Current State**: Direct window.location usage

**Locations**: Multiple files

**Current Code Examples**:
```typescript
// apps/web/src/components/ProfileForm.tsx:133
window.location.href = data.authUrl;

// apps/web/src/app/auth/signin/page.tsx:75
emailRedirectTo: `${window.location.origin}/auth/callback`,

// apps/web/src/app/auth/callback/page.tsx:85
window.location.hash = '';
window.location.href = '/dashboard';

// apps/web/src/components/VerifySubscriptionButton.tsx:24
window.location.reload();
```

**Problem**: window.location doesn't exist in React Native

**Proposed Solution**:

**Step 1**: Create interface
```typescript
// apps/web/src/lib/environment/types.ts
export interface IEnvironment {
  getOrigin(): string;
  getCurrentUrl(): string;
  redirect(url: string): void;
  reload(): void;
  getQueryParams(): Record<string, string>;
  getHashParams(): Record<string, string>;
  clearHash(): void;
}
```

**Step 2**: Create web implementation
```typescript
// apps/web/src/lib/environment/web-environment.ts
import { IEnvironment } from './types';

export class WebEnvironment implements IEnvironment {
  getOrigin(): string {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.location.origin;
  }

  getCurrentUrl(): string {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.location.href;
  }

  redirect(url: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.location.href = url;
  }

  reload(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.location.reload();
  }

  getQueryParams(): Record<string, string> {
    if (typeof window === 'undefined') {
      return {};
    }
    const params: Record<string, string> = {};
    new URLSearchParams(window.location.search).forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  getHashParams(): Record<string, string> {
    if (typeof window === 'undefined') {
      return {};
    }
    const params: Record<string, string> = {};
    const hash = window.location.hash.substring(1);
    new URLSearchParams(hash).forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  clearHash(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.location.hash = '';
  }
}
```

**Step 3**: Create factory
```typescript
// apps/web/src/lib/environment/factory.ts
import { IEnvironment } from './types';
import { WebEnvironment } from './web-environment';
// import { NativeEnvironment } from './native-environment'; // For mobile later

export function createEnvironment(): IEnvironment {
  return new WebEnvironment();
}

export const environment = createEnvironment();
```

**Step 4**: Update usage
```typescript
// Replace:
window.location.href = data.authUrl;

// With:
import { environment } from '@/lib/environment';
environment.redirect(data.authUrl);

// Replace:
emailRedirectTo: `${window.location.origin}/auth/callback`,

// With:
emailRedirectTo: `${environment.getOrigin()}/auth/callback`,

// Replace:
window.location.reload();

// With:
environment.reload();
```

**Files to Create**:
- `apps/web/src/lib/environment/types.ts`
- `apps/web/src/lib/environment/web-environment.ts`
- `apps/web/src/lib/environment/factory.ts`
- `apps/web/src/lib/environment/index.ts`

**Files to Modify**:
- `apps/web/src/components/ProfileForm.tsx`
- `apps/web/src/app/auth/signin/page.tsx`
- `apps/web/src/app/auth/callback/page.tsx`
- `apps/web/src/components/VerifySubscriptionButton.tsx`
- Other files using window.location

---

## 🟡 Component Updates

### 6. Form Components

**Current State**: Direct HTML form elements

**Locations**: 
- `PartnerForm.tsx`
- `PartnerActivities.tsx`
- `PartnerNotes.tsx`
- `ProfileForm.tsx`

**Current Elements**:
- `<input type="text">`
- `<input type="email">`
- `<input type="datetime-local">`
- `<select>`
- `<textarea>`
- `<form>`

**Proposed Solution**: Create reusable form components (can be done during migration, not critical now)

**Note**: These can be migrated incrementally during Android development. The HTML versions will continue to work on web.

---

### 7. Image Component

**Current State**: Direct `<img>` usage

**Proposed Solution**: Create Image wrapper (simple find/replace during migration)

```typescript
// apps/web/src/components/Image.tsx
'use client';

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

export function Image({ src, alt, ...props }: ImageProps) {
  return <img src={src} alt={alt} {...props} />;
}
```

**Priority**: Low - can be done during migration

---

### 8. Modal Components

**Current State**: Already React components, just need styling updates

**Locations**:
- `ConfirmDialog.tsx`
- `AlertDialog.tsx`

**Current**: Uses Tailwind classes and fixed positioning

**Note**: These are already good! Just need to:
- Replace `div` → `View`
- Replace `button` → `Pressable`
- Replace Tailwind → StyleSheet
- Use React Native `Modal` component

**Priority**: Low - styling can be done during migration

---

## 📊 Implementation Order

### Phase 1: Core Abstractions (Do First)
1. ✅ **ImagePicker Component** - Easiest, used in one place
2. ✅ **File Utils** - Simple abstraction, used in one place
3. ✅ **Environment Helper** - Medium complexity, used in several places
4. ✅ **Navigation Abstraction** - High impact, used everywhere (do incrementally)

### Phase 2: Complex Abstractions
5. ✅ **Image Processing/Canvas** - Most complex, critical for face detection
   - Start with face-api-provider.ts
   - Then FaceSelectionUI.tsx
   - Finally PhotoUploadWithFaceMatch.tsx

### Phase 3: Component Library (During Migration)
6. ✅ **Form Components** - Can be done during mobile development
7. ✅ **Image Component** - Simple wrapper
8. ✅ **Modal Updates** - Styling changes

---

## 🧪 Testing Strategy

### For Each Abstraction:

1. **Unit Tests**: Test the abstraction interface
2. **Integration Tests**: Test with existing components
3. **E2E Tests**: Ensure no regressions
4. **Visual Regression**: Ensure UI looks the same

### Testing Checklist:

- [ ] ImagePicker works with file selection
- [ ] File utils convert files correctly
- [ ] Navigation works with all routes
- [ ] Environment helpers return correct values
- [ ] Image processing works for face detection
- [ ] All existing features still work
- [ ] No console errors
- [ ] Performance is acceptable

---

## 📝 Notes

- **Don't break existing functionality** - All changes should be backward compatible
- **Test incrementally** - Test each abstraction as you create it
- **Keep web version working** - Mobile version can be added later
- **Use feature flags** if needed - To gradually roll out changes
- **Document changes** - Update this doc as you implement

---

## 🚀 When Ready to Start

1. Start with **ImagePicker** (easiest win)
2. Then **File Utils** (simple, used once)
3. Then **Environment Helper** (medium complexity)
4. Then **Navigation** (high impact, do incrementally)
5. Finally **Image Processing** (most complex, save for last)

Each abstraction should:
- Have TypeScript interfaces
- Have web implementation
- Be tested
- Be documented
- Not break existing code

Good luck! 🎉



