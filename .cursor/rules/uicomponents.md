---
description: Critical UI component standards: no window modals, always show loading states on action buttons
alwaysApply: true
---

# UI Component Standards

## 🚫 NO WINDOW MODALS - Use React Components Only

**FORBIDDEN:**
- `window.alert()` - NEVER use
- `window.confirm()` - NEVER use  
- `window.prompt()` - NEVER use

**REQUIRED:**
- Use `<AlertDialog>` component from `@/components/AlertDialog` for alerts
- Use `<ConfirmDialog>` component from `@/components/ConfirmDialog` for confirmations
- All user-facing dialogs must be React components

**Example:**
```tsx
// ❌ FORBIDDEN
if (confirm('Are you sure?')) { ... }
alert('Error occurred');

// ✅ REQUIRED
import AlertDialog from '@/components/AlertDialog';
import ConfirmDialog from '@/components/ConfirmDialog';

<ConfirmDialog
  open={showConfirm}
  onConfirm={handleConfirm}
  onCancel={() => setShowConfirm(false)}
  title="Are you sure?"
  message="This action cannot be undone."
  loading={processing}
/>

<AlertDialog
  open={showAlert}
  onClose={() => setShowAlert(false)}
  title="Error"
  message="An error occurred."
/>
```

## ⏳ ACTION BUTTONS - Always Show Loading State

**REQUIREMENTS:**
- Every action button MUST have a `loading` state
- When `loading` is true:
  - The button MUST be `disabled={loading}`
  - A loading spinner MUST be visible
  - Loading text (e.g., "Uploading...", "Processing...") SHOULD be shown
  - ALL other action buttons in the same form/page MUST also be disabled
  - Cancel buttons in forms/dialogs MUST be disabled when `loading` is true

**Pattern:**
```tsx
const [loading, setLoading] = useState(false);

const handleAction = async () => {
  setLoading(true);
  try {
    await performAction();
  } catch (error) {
    // Handle error
  } finally {
    setLoading(false);
  }
};

// ✅ REQUIRED
<button
  onClick={handleAction}
  disabled={loading}
  className="..."
>
  {loading ? (
    <>
      <svg className="animate-spin h-4 w-4 inline-block mr-2" ...>
        {/* spinner */}
      </svg>
      Processing...
    </>
  ) : (
    'Submit'
  )}
</button>

// In forms, disable ALL buttons:
<button type="submit" disabled={loading}>Save</button>
<button type="button" disabled={loading}>Cancel</button>
```

**For ConfirmDialog:**
```tsx
<ConfirmDialog
  open={showConfirm}
  onConfirm={handleConfirm}
  onCancel={() => setShowConfirm(false)}
  loading={deleting}  // ✅ REQUIRED
  loadingLabel="Deleting..."  // ✅ REQUIRED
/>
```

## 📋 Code Review Checklist

Before submitting code, verify:

- [ ] No `window.alert()`, `window.confirm()`, or `window.prompt()` calls
- [ ] All action buttons have `loading` state and show spinner when loading
- [ ] All buttons in forms/dialogs are disabled when `loading` is true

## 🎯 Example: Form with Loading State

```tsx
'use client';

import { useState } from 'react';
import { useNavigation } from '@/lib/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function MyForm() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await submitData();
      navigation.push('/success');
    } catch (error) {
      // Show AlertDialog, not alert()
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form>
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <>
              <Spinner />
              Saving...
            </>
          ) : (
            'Save'
          )}
        </button>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={loading}
        >
          Delete
        </button>
        <button
          type="button"
          onClick={() => navigation.goBack()}
          disabled={loading}
        >
          Cancel
        </button>
      </form>

      <ConfirmDialog
        open={showConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowConfirm(false)}
        loading={loading}
        loadingLabel="Deleting..."
      />
    </>
  );
}
```

## 🔍 Common Mistakes to Avoid

1. **Forgetting to disable Cancel buttons** - They must be disabled when `loading` is true
2. **Not showing loading spinner** - Always show visual feedback
3. **Using browser modals** - Always use React dialog components


