---
name: vue-component-standards
description: Best practices and strict rules for Vue 3 SFCs in Resale Command, focusing on defineProps, defineEmits, fragment/Teleport fallthrough attributes, and zero console warnings.
---

# Vue 3 Component Standards & Warning Prevention

This skill provides mandatory architectural rules and patterns for building and refactoring Vue 3 components in Resale Command to eliminate `[Vue warn]` console warnings and runtime issues.

---

## 1. The Fallthrough Attribute & Fragment Rule

In Vue 3, when a parent component passes an attribute or event listener to a child component, Vue automatically applies it to the root DOM element of the child.

### The Fragment / Teleport Problem:
If a child component has:
* Multiple root nodes (Fragment template)
* A `<Teleport>` root node (like modal dialogs or slide-out drawers, e.g. `ItemDrawer.vue`)

Vue **CANNOT automatically inherit fallthrough attributes or listeners**.

When an undeclared prop or listener is passed to such a component, Vue emits warnings:
```text
[Vue warn]: Extraneous non-emits event listeners (saved) were passed to component...
[Vue warn]: Extraneous non-props attributes (isOpen) were passed to component...
```

### Prevention Rules:
1. **Always Declare Every Prop in `defineProps`**:
   If a parent passes `:isOpen="true"`, the child MUST have `isOpen` in `defineProps`:
   ```javascript
   const props = defineProps({
       item: { type: Object, default: null },
       isOpen: { type: Boolean, default: false }
   });
   ```
2. **Always Declare Every Emitted Event in `defineEmits`**:
   If a parent listens to `@save` and `@saved`, the child MUST declare both:
   ```javascript
   const emit = defineEmits(['close', 'save', 'saved']);
   ```
   And whenever a save occurs, emit both:
   ```javascript
   emit('save', payload);
   emit('saved', payload);
   ```
3. **Explicit `inheritAttrs: false` When Appropriate**:
   If a component is a wrapper around an underlying element, explicitly set:
   ```javascript
   defineOptions({ inheritAttrs: false });
   ```

---

## 2. Component Auditing Checklist

Before marking any Vue component task complete, verify:
- [ ] Every prop passed in `<ChildComponent :prop="val" />` exists in the child's `defineProps`.
- [ ] Every event listened to in `<ChildComponent @event="fn" />` exists in the child's `defineEmits`.
- [ ] No `[Vue warn]` messages appear in the browser console when opening/closing or interacting with the component.
- [ ] Responsive design obeys `mobile-ux-standards` (touch targets >= 44px, no horizontal overflows).
