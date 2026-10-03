# Vue 3 Standards & Warning Prevention Rules

1. **Strict Props & Emits Declaration**:
   - Never pass a prop (`:prop="val"`) or event listener (`@event="fn"`) to a Vue component unless that prop is declared in the child's `defineProps` and the event is declared in `defineEmits`.
   - Components rendering `<Teleport>` or Fragment roots (like `ItemDrawer.vue`, modals, drawers) cannot inherit undeclared fallthrough attributes.

2. **Event Naming Consistency**:
   - When supporting both past and new conventions (e.g. `@save` vs `@saved`), declare both in `defineEmits` and emit both in the component handler.

3. **Zero Console Warnings**:
   - Whenever testing in the browser, always inspect the console logs to confirm 0 `[Vue warn]` messages exist.

4. **Pattern Primitive Extraction & Anti-Duplication Rule**:
   - Proactively spot and extract recurring UI patterns into clean, reusable primitives in `src/components/common/` (e.g. `BottomActionDock.vue`, slide-over drawers, modal shells).
   - If a structural UI container or dock appears in 2+ places, never copy-paste inline markup. Extract a slot-driven primitive.
   - For any floating or fixed bottom dock primitive:
     - Always encapsulate `<Teleport to="body">` so it mounts cleanly at the root viewport.
     - Ensure the Astro page passes `hideFooter={true}` to `<Layout>` to prevent footer collisions.
     - Ensure scrollable content has bottom clearance padding (`pb-36 sm:pb-44`).
