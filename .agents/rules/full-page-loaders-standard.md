# UX Invariant: Full-Page Huckleberry Loaders Over In-Place Spinners

## Core Rule
**ALWAYS use the full-page branded `HuckleberryLoader` via the `useLoader` composable for all asynchronous actions, file reading, CSV parsing, data syncing, batch database mutations, and AI workflows. NEVER use in-place daisyUI spinners (`<span class="loading loading-spinner">`), static button spinners, or plain inline text.**

## Rationale
1. **User Awareness**: In-place spinners (tiny `<span class="loading loading-spinner">` inside a button or a corner div) are easy to miss, provide no feedback on progress or current phase, and make users question whether the application is frozen or if their click registered.
2. **Branded Visual Experience**: The `HuckleberryLoader` is Resale Command's signature brand experience. It features falling berries, a pulsing basket, dynamic message titles, step-by-step progress subtitles, and optional percentage progress bars.
3. **Action Locking**: Full-page loaders prevent accidental double-clicks, duplicate database document creation, and race conditions during critical batch mutations.

## Usage Standards

```typescript
import { useLoader } from '../../composables/useLoader';

const { showLoader, updateLoader, hideLoader } = useLoader();

// 1. Initial invocation with context
showLoader("Committing Sales to Inventory...", {
  step: "Writing transaction records into Appwrite...",
  progress: 5,
  cancelable: false
});

// 2. Real-time sub-step and percentage updates in batch loops
for (let idx = 0; idx < items.length; idx++) {
  const pct = Math.round(((idx + 1) / items.length) * 100);
  updateLoader(undefined, `Saving item ${idx + 1} of ${items.length}: ${items[idx].title}...`, pct);
  await saveItem(items[idx]);
}

// 3. Guaranteed dismissal in finally block
hideLoader();
```

## Prohibited Patterns
- ❌ `<span class="loading loading-spinner loading-sm"></span>` in buttons, headers, or cards.
- ❌ `<div v-if="isProcessing">Loading...</div>` in-place status placeholders.
- ❌ Silent operations where asynchronous operations run without immediate visual feedback.
