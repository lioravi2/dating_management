---
description: Android migration preparation: use abstraction layers for navigation, environment, file handling, and image picking
alwaysApply: true
---

# Android Migration Preparation - Use Abstractions

**REQUIRED:** All new code MUST use abstraction layers from Android migration preparation to ensure compatibility with both web and mobile platforms.

## Navigation - NEVER use Next.js router directly

```tsx
// ❌ FORBIDDEN
import { useRouter } from 'next/navigation';
const router = useRouter();
router.push('/path');
router.replace('/path');
router.back();

// ✅ REQUIRED
import { useNavigation } from '@/lib/navigation';
const navigation = useNavigation();
navigation.push('/path');
navigation.replace('/path');
navigation.goBack();
```

## Links - Use NavigationLink

```tsx
// ❌ FORBIDDEN
import Link from 'next/link';
<Link href="/path">Link</Link>

// ✅ REQUIRED
import { NavigationLink } from '@/lib/navigation';
<NavigationLink href="/path">Link</NavigationLink>
```

## Environment - NEVER use window.location directly

```tsx
// ❌ FORBIDDEN
window.location.href = '/path';
window.location.reload();
window.location.origin;
window.location.search;
window.location.hash;

// ✅ REQUIRED
import { environment } from '@/lib/environment';
environment.redirect('/path');
environment.reload();
environment.getOrigin();
environment.getQueryParams();
environment.getHashParams();
```

## Image Picker - Use abstraction

```tsx
// ❌ FORBIDDEN
<input type="file" accept="image/*" />
const fileInputRef = useRef<HTMLInputElement>(null);
fileInputRef.current?.click();

// ✅ REQUIRED
import { ImagePicker, ImagePickerRef } from '@/components/ImagePicker';
const imagePickerRef = useRef<ImagePickerRef>(null);
<ImagePicker
  ref={imagePickerRef}
  onSelect={handleFileSelect}
  accept="image/*"
  disabled={loading}
/>
<button onClick={() => imagePickerRef.current?.open()}>
  Select Photo
</button>
```

## File Utils - Use abstraction

```tsx
// ❌ FORBIDDEN
const reader = new FileReader();
reader.readAsDataURL(file);

// ✅ REQUIRED
import { fileUtils } from '@/lib/file-utils';
const base64 = await fileUtils.fileToBase64(file);
const blob = await fileUtils.fileToBlob(file);
```

## Pathname - Use navigation abstraction

```tsx
// ❌ FORBIDDEN
import { usePathname } from 'next/navigation';
const pathname = usePathname();

// ✅ REQUIRED
import { useNavigation } from '@/lib/navigation';
const navigation = useNavigation();
const pathname = navigation.getCurrentPath();
```

## Search Params - Use navigation abstraction

```tsx
// ❌ FORBIDDEN
import { useSearchParams } from 'next/navigation';
const searchParams = useSearchParams();
const value = searchParams.get('key');

// ✅ REQUIRED
import { useNavigation } from '@/lib/navigation';
const navigation = useNavigation();
const params = navigation.getParams();
const value = params.key;
```

## 📋 Code Review Checklist

Before submitting code, verify:

- [ ] No direct `useRouter` from `next/navigation` - use `useNavigation` instead
- [ ] No direct `Link` from `next/link` - use `NavigationLink` instead
- [ ] No direct `window.location` usage - use `environment` helper instead
- [ ] No direct `usePathname` or `useSearchParams` - use `navigation.getCurrentPath()` and `navigation.getParams()` instead
- [ ] No direct HTML file inputs - use `ImagePicker` component instead
- [ ] No direct `FileReader` usage - use `fileUtils` instead

## 🎯 Example: Navigation Usage

```tsx
'use client';

import { useNavigation } from '@/lib/navigation';
import { NavigationLink } from '@/lib/navigation';

export default function MyPage() {
  const navigation = useNavigation();
  const params = navigation.getParams();
  const currentPath = navigation.getCurrentPath();

  return (
    <div>
      <NavigationLink href="/dashboard">Dashboard</NavigationLink>
      <button onClick={() => navigation.push('/partners', { id: '123' })}>
        View Partner
      </button>
      <button onClick={() => navigation.goBack()}>
        Back
      </button>
    </div>
  );
}
```

## 🔍 Common Mistakes to Avoid

1. **Using `router.refresh()`** - Use `environment.reload()` instead
2. **Using `window.location.href`** - Use `environment.redirect()` instead
3. **Direct Next.js imports** - Always use abstraction layers

## 📚 Reference Documentation

- Android Migration Preparation: `PREPARATION_FOR_ANDROID.md`
- Android Migration Guide: `ANDROID_MIGRATION_GUIDE.md`
- Navigation Abstraction: `apps/web/src/lib/navigation/`
- Environment Helper: `apps/web/src/lib/environment/`
- Image Picker: `apps/web/src/components/ImagePicker/`
- File Utils: `apps/web/src/lib/file-utils/`


