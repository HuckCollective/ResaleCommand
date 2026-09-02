<template>
    <div>
        <div v-if="!hideAllTriggers">
            <div v-if="!hideUpload" class="grid grid-cols-2 gap-2 mt-1">
                <button @click="$refs.fileInput.click()" class="btn btn-sm btn-outline border-dashed gap-2">
                    <Icon icon="solar:folder-with-files-linear" class="w-4 h-4 inline" /> Upload
                </button>
                <input type="file" ref="fileInput" multiple accept="image/*" class="hidden" @change="handleFileSelect" />
                
                <button @click="startCamera" class="btn btn-sm btn-outline border-dashed gap-2">
                    <Icon icon="solar:camera-linear" class="w-4 h-4 inline" /> Camera
                </button>
            </div>
            <div v-else class="w-full mt-1">
                <button @click="startCamera" class="btn btn-sm btn-outline border-dashed gap-2 w-full">
                    <Icon icon="solar:camera-linear" class="w-4 h-4 inline" /> Open Camera
                </button>
            </div>
        </div>

        <dialog ref="cameraModal" class="modal">
            <div class="modal-box p-0 bg-black w-full max-w-none h-dvh max-h-none rounded-none flex flex-col overflow-hidden shadow-none relative">
                <video ref="cameraVideoDialog" class="absolute inset-0 w-full h-full object-cover" autoplay playsinline></video>
                
                <!-- Top Bar -->
                <div class="absolute top-0 left-0 right-0 bg-linear-to-b from-black/80 to-transparent p-4 flex justify-between items-center text-white z-10 pt-safe">
                    <span class="font-bold drop-shadow-md">Camera</span>
                    <div class="flex items-center gap-2">
                        <span class="badge" :class="maxPhotos && photos.length >= maxPhotos ? 'badge-error' : 'badge-neutral'">
                            {{ photos.length }}<template v-if="maxPhotos"> / {{ maxPhotos }}</template> Photo(s)
                        </span>
                        <button @click.prevent="stopCamera" class="btn btn-sm btn-circle btn-ghost text-white bg-black/20 backdrop-blur">✕</button>
                    </div>
                </div>
                
                <!-- Receipt Alignment Guide Overlay -->
                <div v-if="overlayMode === 'receipt'" class="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 z-5">
                    <div class="w-full max-w-xs sm:max-w-sm h-[60vh] border-2 border-dashed border-primary/80 rounded-2xl relative flex flex-col items-center justify-between p-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-black/10 backdrop-contrast-105">
                        <!-- 4 Corner Brackets -->
                        <div class="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
                        <div class="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
                        <div class="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
                        <div class="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg"></div>

                        <!-- Top guide tag -->
                        <div class="badge badge-primary font-bold text-xs shadow-md tracking-wide">
                            RECEIPT TOP
                        </div>

                        <!-- Center hint -->
                        <div class="text-center text-white/80 text-xs flex flex-col items-center gap-1 drop-shadow-md">
                            <Icon icon="solar:bill-list-bold-duotone" class="w-8 h-8 opacity-90 text-primary" />
                            <span class="font-bold">Align receipt inside frame</span>
                            <span class="text-[10px] opacity-75">Keep flat & steady</span>
                        </div>

                        <!-- Bottom guide tag -->
                        <div class="badge badge-primary font-bold text-xs shadow-md tracking-wide">
                            RECEIPT BOTTOM
                        </div>
                    </div>
                </div>
                
                <!-- Thumbnails (Bottom Left) -->
                <div v-if="photos.length > 0" class="absolute bottom-32 left-4 right-4 flex gap-2 overflow-x-auto z-10 pointer-events-auto p-2">
                    <div v-for="(photo, idx) in photos" :key="idx" class="relative w-16 h-16 shrink-0 border-2 border-white/50 rounded-md overflow-hidden bg-black/50 shadow-lg group">
                        <img :src="getObjectUrl(photo)" class="w-full h-full object-cover">
                        <button @click.prevent="$emit('remove-photo', idx)" class="btn btn-circle btn-xs btn-error absolute -top-1 -right-1 w-5 h-5 min-h-0 text-[10px] flex items-center justify-center shadow-md z-30 hover:scale-110">✕</button>
                    </div>
                </div>
                
                <!-- Bottom Controls -->
                <div class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-8 flex justify-between items-center z-10 pb-safe">
                    <button @click.prevent="stopCamera" class="btn btn-ghost text-white px-2">Done</button>
                    <button @click.prevent="capturePhoto" 
                            class="btn btn-circle btn-primary btn-lg border-4 border-white w-20 h-20 transform active:scale-95 transition-transform shadow-xl"
                            :class="maxPhotos && photos.length >= maxPhotos ? 'btn-disabled opacity-50 border-gray-500' : ''"
                            :disabled="maxPhotos && photos.length >= maxPhotos"></button>
                    <button @click.prevent="flipCamera" class="btn btn-circle btn-ghost text-white bg-white/20"><Icon icon="solar:refresh-circle-linear" class="w-6 h-6" /></button>
                </div>
            </div>
        </dialog>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import { addToast } from '../../stores/toast';

const props = defineProps({
    photos: {
        type: Array,
        default: () => []
    },
    hideUpload: {
        type: Boolean,
        default: false
    },
    hideAllTriggers: {
        type: Boolean,
        default: false
    },
    maxPhotos: {
        type: Number,
        default: 0
    },
    overlayMode: {
        type: String,
        default: 'none' // 'none' | 'receipt' | 'item'
    }
});

const emit = defineEmits(['photos-captured', 'remove-photo']);

const objectUrls = new WeakMap();
const getObjectUrl = (photo) => {
    if (!photo) return '';
    if (typeof photo === 'string') return photo;
    if (photo && typeof photo === 'object' && photo.url) return photo.url;
    if (photo instanceof File) {
        if (!objectUrls.has(photo)) objectUrls.set(photo, URL.createObjectURL(photo));
        return objectUrls.get(photo);
    }
    return '';
};

const cameraVideoDialog = ref(null);
const cameraModal = ref(null);
const isCameraOpen = ref(false);
const cameraStream = ref(null);
const cameraFacing = ref('environment');

const handleFileSelect = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    emit('photos-captured', Array.from(files));
    e.target.value = ''; // Reset
};

const startCamera = async () => {
    if (!cameraModal.value) return;
    cameraModal.value.showModal();
    isCameraOpen.value = true;
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Camera API is blocked. Please ensure you are on HTTPS or localhost.");
        }
        if (cameraStream.value) {
            cameraStream.value.getTracks().forEach(track => track.stop());
        }
        
        try {
            cameraStream.value = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: cameraFacing.value,
                    width: { ideal: 3840, min: 1920 },
                    height: { ideal: 2160, min: 1080 }
                }
            });
        } catch (facingError) {
            // Fallback for laptops/desktops or cameras without 4K support
            console.warn("Requested high-res/facingMode not found, falling back to standard video");
            try {
                cameraStream.value = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1920, min: 1280 },
                        height: { ideal: 1080, min: 720 }
                    }
                });
            } catch (fallbackErr) {
                cameraStream.value = await navigator.mediaDevices.getUserMedia({ video: true });
            }
        }

        if (cameraVideoDialog.value) {
             cameraVideoDialog.value.srcObject = cameraStream.value;
        }
    } catch (err) {
        addToast({ type: 'error', message: "Could not access camera: " + err.message });
        stopCamera();
    }
};

const stopCamera = () => {
    if (cameraStream.value) {
         cameraStream.value.getTracks().forEach(track => track.stop());
         cameraStream.value = null;
    }
    isCameraOpen.value = false;
    if (cameraModal.value) cameraModal.value.close();
};

const flipCamera = () => {
    cameraFacing.value = cameraFacing.value === 'user' ? 'environment' : 'user';
    stopCamera();
    startCamera();
};

const capturePhoto = () => {
    if (props.maxPhotos && props.photos.length >= props.maxPhotos) return;
    
    const videoEl = cameraVideoDialog.value;
    if (!videoEl) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 1920; 
    canvas.height = videoEl.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    }
    
    canvas.toBlob(blob => {
        if (!blob) return;
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        emit('photos-captured', [file]);
        
        // Visual feedback
        const btn = document.activeElement;
        if(btn) btn.classList.add('scale-90');
        setTimeout(() => btn && btn.classList.remove('scale-90'), 100);
    }, 'image/jpeg', 0.95);
};

onUnmounted(() => {
    stopCamera();
});

defineExpose({
    startCamera,
    stopCamera
});

</script>
