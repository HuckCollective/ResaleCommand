# Vue 3 Standards & Warning Prevention Rules

1. **Strict Props & Emits Declaration**:
   - Never pass a prop (`:prop="val"`) or event listener (`@event="fn"`) to a Vue component unless that prop is declared in the child's `defineProps` and the event is declared in `defineEmits`.
   - Components rendering `<Teleport>` or Fragment roots (like `ItemDrawer.vue`, modals, drawers) cannot inherit undeclared fallthrough attributes.

2. **Event Naming Consistency**:
   - When supporting both past and new conventions (e.g. `@save` vs `@saved`), declare both in `defineEmits` and emit both in the component handler.

3. **Zero Console Warnings**:
   - Whenever testing in the browser, always inspect the console logs to confirm 0 `[Vue warn]` messages exist.
