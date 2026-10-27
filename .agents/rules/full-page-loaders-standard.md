# UX Standard: The 3-Bucket UX Timing Standard & Full-Page Loaders

## Overview & NN/g Hierarchy
User perceived performance in Resale Command is strictly governed by the Nielsen Norman Group (NN/g) Response Time Limits. Every asynchronous operation belongs to one of three strict buckets.

---

### Bucket 1: Micro-Actions (< 1s)
- **Use Case**: Inline toggles, dropdown selections, checkbox checks, quantity increments, status tag updates.
- **Pattern**: **Optimistic UI + Toast notifications**.
- **Rule**: **ZERO blocking modal**. Never display a full-page loader or freeze the user's viewport for micro-actions.
- **Anti-Strobe Debounce**: `useLoader` includes a 150ms debounce (`debounceMs: 150`) so that if a quick operation accidentally calls `showLoader`, it clears before flashing or strobing on the user's screen.

---

### Bucket 2: Scoped Asset Loads (1s – 3s)
- **Use Case**: Loading an individual image preview, fetching one item's details card, uploading a single small photo, refreshing a table row.
- **Pattern**: **Localized Skeleton Shimmer / Scoped Spinner**.
- **Rule**: Do not lock the whole screen. Use `setScopedLoading(key, true)` and `isScopedLoading(key)` from `useLoader` to show a skeleton shimmer on that specific card or thumbnail while the rest of the application remains fully interactive.
- **Example**:
  ```typescript
  import { useLoader } from '../../composables/useLoader';

  const { setScopedLoading, isScopedLoading } = useLoader();

  async function refreshRow(id: string) {
    setScopedLoading(`row-${id}`, true);
    try {
      await fetchRowData(id);
    } finally {
      setScopedLoading(`row-${id}`, false);
    }
  }
  ```

---

### Bucket 3: Heavy Operations (> 3s)
- **Use Case**: AI Vision Analysis, Auto-Cropping gallery photos, Lot Splitting, CSV Bulk Import/Sync, Batch Database Commit.
- **Pattern**: **Full-Page Branded HuckleberryLoader**.
- **Rule**: **Mandatory full-page loader**. Must provide:
  1. Branded animated huckleberries & basket.
  2. Clear top title (e.g., `"Auto-Cropping Item Photos..."`).
  3. Contextual sub-step description (e.g., `"Matching front, back & detail views across gallery photos..."`).
  4. Percentage progress bar where deterministic loop counts are available.
  5. **5-Second Safety Timer**: `useLoader` automatically enables `cancelable: true` after 5 seconds to ensure the user can always dismiss or abort any stalled network request.
- **Example**:
  ```typescript
  import { useLoader } from '../../composables/useLoader';

  const { showLoader, updateLoader, hideLoader } = useLoader();

  async function executeHeavyWorkflow() {
    showLoader("Auto-Cropping Item Photos...", {
      step: "Matching front, back & detail views across gallery photos...",
      progress: 45,
      cancelable: true,
      onCancel: () => {
        abortController.abort();
      }
    });

    try {
      await runWorkflow();
    } finally {
      hideLoader();
    }
  }
  ```

---

## Prohibited Anti-Patterns
- ❌ In-place button spinners (`<span class="loading loading-spinner">`) on primary heavy operations (> 3s).
- ❌ Blocking modal flash on instantaneous or sub-second actions (< 150ms).
- ❌ Silent operations where asynchronous operations run without immediate visual feedback.
- ❌ Non-cancelable full-page loaders that permanently hang if an external AI API times out.
