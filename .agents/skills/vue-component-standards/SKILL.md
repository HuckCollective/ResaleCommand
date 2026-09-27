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

## 2. WebRTC & Camera Viewfinder Architecture (Zero Blackout Rule)

When integrating live camera viewfinders (e.g. `ScannerWidget.vue`, `InventoryManager.vue`, receipt scanners):

### The `v-if` DOM Ref Race Condition:
Never use `v-if` on `<video ref="...">` elements that receive live media streams:
```vue
<!-- ❌ WRONG: Ref is null when startCamera() runs synchronously, stream is never bound -->
<video v-if="isCameraOpen" ref="cameraVideoDialog" autoplay playsinline></video>
```
When `isCameraOpen.value = true` is set, Vue's DOM update is **asynchronous**. An immediate assignment `if (cameraVideoDialog.value) cameraVideoDialog.value.srcObject = stream` will evaluate `cameraVideoDialog.value` as `null`. As a result, the modal opens to a solid black box with no console errors!

### Mandatory Camera Implementation Pattern:
1. **Keep `<video>` Persistently Mounted**:
   Control visibility using the parent `<dialog ref="modal">` (`.showModal()` / `.close()`) or CSS visibility, NEVER with `v-if` on the video element:
   ```html
   <!-- ✅ CORRECT: Permanently mounted in modal, ref is always valid -->
   <video ref="cameraVideoDialog" class="absolute inset-0 w-full h-full object-cover" autoplay playsinline muted></video>
   ```
2. **Mandatory Video Attributes**:
   Viewfinder video tags MUST have `autoplay playsinline muted`.
   * Without `muted`, mobile Safari and modern Chrome autoplay policies reject stream playback.
   * Without `playsinline`, iOS Safari forces full-screen native QuickTime player.
3. **Await `nextTick()` and Call `.play().catch(...)`**:
   Always await DOM tick before attaching stream and handle promise rejection:
   ```javascript
   await nextTick();
   if (cameraVideoDialog.value) {
       cameraVideoDialog.value.srcObject = stream;
       cameraVideoDialog.value.play().catch(err => {
           console.warn("Video play error:", err);
       });
   }
   ```
4. **Reactive Watcher for Stream Synchronization**:
   Always include a reactive watcher on `[videoRef, streamRef]` to handle camera flips (`facingMode`), reconnections, or device changes:
   ```javascript
   watch([cameraVideoDialog, cameraStream], ([videoEl, stream]) => {
       if (videoEl && stream && videoEl.srcObject !== stream) {
           videoEl.srcObject = stream;
           videoEl.play().catch(playErr => {
               console.warn("Watcher video play error:", playErr);
           });
       }
   });
   ```
5. **Clean Hardware Resource Release**:
   In `stopCamera()`, stop all stream tracks AND clear `videoEl.srcObject = null` so the hardware camera indicator light turns off immediately:
   ```javascript
   const stopCamera = () => {
       if (cameraStream.value) {
           cameraStream.value.getTracks().forEach(track => track.stop());
           cameraStream.value = null;
       }
       if (cameraVideoDialog.value) {
           cameraVideoDialog.value.srcObject = null;
       }
       isCameraOpen.value = false;
       if (cameraModal.value) cameraModal.value.close();
   };
   ```

---

## 3. Component Auditing Checklist

Before marking any Vue component task complete, verify:
- [ ] Every prop passed in `<ChildComponent :prop="val" />` exists in the child's `defineProps`.
- [ ] Every event listened to in `<ChildComponent @event="fn" />` exists in the child's `defineEmits`.
- [ ] No `[Vue warn]` messages appear in the browser console when opening/closing or interacting with the component.
- [ ] Camera/viewfinder components avoid `v-if` on `<video>` refs, include `autoplay playsinline muted`, and clear `srcObject = null` on close.
- [ ] Responsive design obeys `mobile-ux-standards` (touch targets >= 44px, no horizontal overflows).
