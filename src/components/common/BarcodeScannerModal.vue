<template>
    <Teleport to="body" v-if="isOpen">
        <Transition name="scanner-fade">
            <div 
                class="fixed inset-0 z-99999 flex flex-col bg-black text-white select-none overflow-hidden touch-none"
                role="dialog"
                aria-modal="true"
                :aria-label="title"
            >
                <!-- TOP CONTROL BAR -->
                <div class="relative z-20 flex items-center justify-between px-4 py-3 bg-linear-to-b from-black/90 via-black/60 to-transparent pt-safe">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                            <Icon icon="solar:barcode-read-bold" class="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 class="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                                {{ title }}
                                <span v-if="mode === 'continuous'" class="badge badge-xs badge-secondary font-mono">Continuous</span>
                            </h2>
                            <p class="text-[10px] text-white/60 font-medium leading-none">{{ subtitle }}</p>
                        </div>
                    </div>

                    <div class="flex items-center gap-1.5">
                        <!-- Torch / Flashlight Toggle -->
                        <button 
                            v-if="hasTorchCapability" 
                            type="button"
                            @click="toggleTorch" 
                            class="btn btn-circle btn-sm transition-all"
                            :class="isTorchOn ? 'bg-warning text-black hover:bg-warning/90 shadow-md shadow-warning/30' : 'btn-ghost text-white/80 bg-white/10 hover:bg-white/20'"
                            :title="isTorchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On'"
                            aria-label="Toggle flashlight"
                        >
                            <Icon :icon="isTorchOn ? 'solar:flashlight-bold' : 'solar:flashlight-linear'" class="w-4 h-4" />
                        </button>

                        <!-- Zoom 1x / 2x Toggle -->
                        <button 
                            v-if="hasZoomCapability" 
                            type="button"
                            @click="toggleZoom" 
                            class="btn btn-circle btn-sm btn-ghost text-white/90 bg-white/10 hover:bg-white/20 font-mono text-xs font-bold"
                            title="Toggle 2x Zoom"
                            aria-label="Toggle camera zoom"
                        >
                            {{ isZoomed ? '2x' : '1x' }}
                        </button>

                        <!-- Camera Flip (Front/Back) -->
                        <button 
                            v-if="videoDevices.length > 1" 
                            type="button"
                            @click="switchCamera" 
                            class="btn btn-circle btn-sm btn-ghost text-white/80 bg-white/10 hover:bg-white/20"
                            title="Switch Camera"
                            aria-label="Switch camera"
                        >
                            <Icon icon="solar:camera-rotate-linear" class="w-4 h-4" />
                        </button>

                        <!-- Close Button -->
                        <button 
                            type="button"
                            @click="handleClose" 
                            class="btn btn-circle btn-sm btn-ghost text-white/90 bg-white/10 hover:bg-white/20 ml-1"
                            title="Close Scanner (Esc)"
                            aria-label="Close scanner"
                        >
                            <Icon icon="solar:close-circle-bold" class="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <!-- MAIN VIEWFINDER VIEWPORT -->
                <div ref="containerRef" class="relative flex-1 w-full h-full overflow-hidden bg-black flex items-center justify-center">
                    <!-- Live Camera Video Feed -->
                    <video 
                        ref="videoRef"
                        class="w-full h-full object-contain"
                        autoplay 
                        playsinline 
                        muted 
                        @loadedmetadata="handleVideoLoaded"
                    ></video>

                    <!-- Real-Time Dynamic Canvas Overlay (projects exact bounding boxes hugging the physical codes) -->
                    <canvas 
                        ref="canvasRef" 
                        class="absolute inset-0 pointer-events-none z-10 w-full h-full"
                    ></canvas>

                    <!-- STATIC TARGETING RETICLE (Aim Guide) -->
                    <div 
                        class="absolute pointer-events-none z-15 flex flex-col items-center justify-center transition-all duration-300"
                        :class="[
                            lastDetectedCode ? 'scale-102 border-success shadow-[0_0_30px_rgba(34,197,94,0.4)]' : 'shadow-[0_0_20px_rgba(0,0,0,0.6)]',
                            'w-[75vw] max-w-xs sm:max-w-sm h-44 sm:h-52 border-2 rounded-2xl relative'
                        ]"
                        :style="{
                            borderColor: lastDetectedCode ? '#22c55e' : 'rgba(255, 255, 255, 0.45)',
                            backgroundColor: lastDetectedCode ? 'rgba(34, 197, 94, 0.08)' : 'rgba(0, 0, 0, 0.15)'
                        }"
                    >
                        <!-- 4 Tech Corner Brackets -->
                        <div class="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 rounded-tl-lg transition-colors duration-200" :class="lastDetectedCode ? 'border-success' : 'border-primary'"></div>
                        <div class="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 rounded-tr-lg transition-colors duration-200" :class="lastDetectedCode ? 'border-success' : 'border-primary'"></div>
                        <div class="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 rounded-bl-lg transition-colors duration-200" :class="lastDetectedCode ? 'border-success' : 'border-primary'"></div>
                        <div class="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 rounded-br-lg transition-colors duration-200" :class="lastDetectedCode ? 'border-success' : 'border-primary'"></div>

                        <!-- Animated Laser Scanner Line (Sweeps up and down) -->
                        <div 
                            v-if="!lastDetectedCode && isStreaming" 
                            class="scanner-laser absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444]"
                        ></div>

                        <!-- Central Lock-On Tag Preview -->
                        <div v-if="lastDetectedCode" class="animate-bounce-in flex flex-col items-center gap-1 p-2 bg-black/85 backdrop-blur-md border border-success/60 rounded-xl shadow-xl px-3.5 max-w-[90%]">
                            <div class="flex items-center gap-1.5 text-success font-mono font-black text-xs sm:text-sm tracking-wider">
                                <Icon icon="solar:check-circle-bold" class="w-4 h-4 shrink-0 text-success" />
                                <span class="truncate">{{ lastDetectedCode.rawValue }}</span>
                            </div>
                            <span class="text-[9px] uppercase tracking-widest text-white/70 font-bold">
                                {{ formatBadgeName(lastDetectedCode.format) }} Detected
                            </span>
                        </div>

                        <!-- Idle Helper Text inside reticle -->
                        <div v-else-if="isStreaming" class="text-center opacity-70 text-[11px] font-medium tracking-wide text-white/80 px-4">
                            Point at <span class="text-primary font-bold">HUCK-</span> barcode, <span class="text-secondary font-bold">0EJ...</span> tag, or <span class="text-accent font-bold">Mini QR</span>
                        </div>
                    </div>

                    <!-- CAMERA LOADING SPINNER -->
                    <div v-if="isLoadingCamera" class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80 gap-3">
                        <span class="loading loading-spinner loading-lg text-primary"></span>
                        <span class="text-xs text-white/70 font-mono tracking-wide">Initializing camera optics...</span>
                    </div>

                    <!-- ERROR / PERMISSION DENIED STATE -->
                    <div v-if="cameraError" class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 p-6 text-center max-w-md mx-auto">
                        <div class="w-12 h-12 rounded-full bg-error/20 text-error flex items-center justify-center mb-3">
                            <Icon icon="solar:videocamera-record-broken" class="w-6 h-6" />
                        </div>
                        <h3 class="font-bold text-base text-white">Camera Access Needed</h3>
                        <p class="text-xs text-white/70 mt-1 mb-4 leading-relaxed">{{ cameraError }}</p>
                        <div class="flex items-center gap-2">
                            <button type="button" @click="startCamera" class="btn btn-sm btn-primary font-bold">
                                <Icon icon="solar:refresh-linear" class="w-4 h-4 mr-1" /> Retry Camera
                            </button>
                            <button type="button" @click="handleClose" class="btn btn-sm btn-ghost text-white">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>

                <!-- BOTTOM DOCK & SCAN HISTORY / RECENT SCANS -->
                <div class="relative z-20 px-4 py-3 bg-linear-to-t from-black/95 via-black/80 to-transparent flex flex-col gap-2 pb-safe">
                    <!-- Continuous Scan History List -->
                    <div v-if="mode === 'continuous' && recentScans.length > 0" class="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                        <span class="text-[10px] uppercase font-bold text-white/40 tracking-wider shrink-0 mr-1">Scanned:</span>
                        <div 
                            v-for="(scan, idx) in recentScans" 
                            :key="idx" 
                            class="badge badge-sm badge-success font-mono font-bold text-[10px] gap-1 shrink-0 shadow-xs"
                        >
                            {{ scan }}
                        </div>
                    </div>

                    <div class="flex items-center justify-between text-xs text-white/60">
                        <div class="flex items-center gap-2">
                            <span class="inline-block w-2 h-2 rounded-full" :class="isStreaming ? 'bg-success animate-pulse' : 'bg-error'"></span>
                            <span class="font-mono text-[11px]">{{ isStreaming ? 'Lens Active (60fps)' : 'Lens Standby' }}</span>
                        </div>

                        <!-- Manual Code Entry Fallback -->
                        <div class="flex items-center gap-2">
                            <button 
                                type="button"
                                @click="promptManualEntry"
                                class="btn btn-xs btn-ghost text-white/70 hover:text-white gap-1 underline font-normal"
                            >
                                <Icon icon="solar:keyboard-linear" class="w-3.5 h-3.5" /> Type Code
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { Icon } from '@iconify/vue';

export interface ScannedResult {
    rawValue: string;
    format: string;
    timestamp: number;
}

const props = withDefaults(defineProps<{
    isOpen: boolean;
    title?: string;
    subtitle?: string;
    mode?: 'single' | 'continuous';
    supportedFormats?: string[];
    allowTorch?: boolean;
    allowZoom?: boolean;
    autoCloseDelay?: number;
}>(), {
    title: 'Scan Barcode or QR',
    subtitle: 'Point camera at any tag or sticker',
    mode: 'single',
    supportedFormats: () => ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'],
    allowTorch: true,
    allowZoom: true,
    autoCloseDelay: 400
});

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'scan', result: ScannedResult): void;
}>();

// Template Refs
const containerRef = ref<HTMLDivElement | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

// State
const isStreaming = ref(false);
const isLoadingCamera = ref(false);
const cameraError = ref<string | null>(null);
const isTorchOn = ref(false);
const hasTorchCapability = ref(false);
const isZoomed = ref(false);
const hasZoomCapability = ref(false);
const videoDevices = ref<MediaDeviceInfo[]>([]);
const currentDeviceIndex = ref(0);
const lastDetectedCode = ref<any | null>(null);
const recentScans = ref<string[]>([]);

let mediaStream: MediaStream | null = null;
let currentTrack: MediaStreamTrack | null = null;
let barcodeDetector: any = null;
let animationFrameId: number | null = null;
let audioContext: AudioContext | null = null;
let lastScannedValue: string | null = null;
let lastScannedTime: number = 0;

// Watch isOpen to start/stop camera stream cleanly
watch(() => props.isOpen, (newVal) => {
    if (newVal) {
        lastDetectedCode.value = null;
        lastScannedValue = null;
        recentScans.value = [];
        nextTick(() => {
            startCamera();
        });
    } else {
        stopCamera();
    }
}, { immediate: true });

onMounted(async () => {
    await enumerateCameras();
    initBarcodeDetector();
    window.addEventListener('keydown', handleGlobalKeydown);
});

onBeforeUnmount(() => {
    stopCamera();
    window.removeEventListener('keydown', handleGlobalKeydown);
    if (audioContext) {
        try { audioContext.close(); } catch {}
    }
});

const handleGlobalKeydown = (e: KeyboardEvent) => {
    if (props.isOpen && e.key === 'Escape') {
        handleClose();
    }
};

const handleClose = () => {
    stopCamera();
    emit('close');
};

const formatBadgeName = (format: string) => {
    if (!format) return 'Barcode';
    if (format.toLowerCase().includes('qr')) return 'QR Code';
    if (format.toLowerCase().includes('128')) return 'Code 128 Tag';
    if (format.toLowerCase().includes('upc')) return 'UPC Barcode';
    if (format.toLowerCase().includes('ean')) return 'EAN Barcode';
    return format.replace('_', ' ').toUpperCase();
};

const enumerateCameras = async () => {
    try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices.value = devices.filter(d => d.kind === 'videoinput');
    } catch (e) {
        console.warn('[BarcodeScanner] Camera enumeration error:', e);
    }
};

const initBarcodeDetector = () => {
    try {
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
            const BarcodeDetectorClass = (window as any).BarcodeDetector;
            barcodeDetector = new BarcodeDetectorClass({
                formats: props.supportedFormats
            });
        }
    } catch (e) {
        console.warn('[BarcodeScanner] BarcodeDetector initialization warning:', e);
    }
};

const startCamera = async () => {
    isLoadingCamera.value = true;
    cameraError.value = null;
    isStreaming.value = false;

    // Stop any existing tracks
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
    }

    try {
        const selectedDeviceId = videoDevices.value[currentDeviceIndex.value]?.deviceId;
        const constraints: MediaStreamConstraints = {
            audio: false,
            video: {
                deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                facingMode: selectedDeviceId ? undefined : { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        mediaStream = stream;
        currentTrack = stream.getVideoTracks()[0] || null;

        // Inspect hardware capabilities
        if (currentTrack) {
            const capabilities: any = typeof currentTrack.getCapabilities === 'function' ? currentTrack.getCapabilities() : {};
            hasTorchCapability.value = !!capabilities.torch && props.allowTorch;
            hasZoomCapability.value = !!capabilities.zoom && props.allowZoom;
            isTorchOn.value = false;
            isZoomed.value = false;

            // Try continuous autofocus
            try {
                if (typeof currentTrack.applyConstraints === 'function' && capabilities.focusMode?.includes('continuous')) {
                    await currentTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
                }
            } catch {}
        }

        if (videoRef.value) {
            videoRef.value.srcObject = stream;
            await videoRef.value.play();
        }

        isStreaming.value = true;
        isLoadingCamera.value = false;
        startDetectionLoop();
    } catch (err: any) {
        isLoadingCamera.value = false;
        isStreaming.value = false;
        console.error('[BarcodeScanner] Failed to open camera:', err);

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            cameraError.value = 'Camera permission was denied. Please allow camera permissions in your browser bar.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            cameraError.value = 'No camera found on this device.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            cameraError.value = 'Camera is in use by another application. Please close other camera tabs and retry.';
        } else {
            cameraError.value = err.message || 'Unable to open camera stream.';
        }
    }
};

const stopCamera = () => {
    isStreaming.value = false;
    isTorchOn.value = false;
    isZoomed.value = false;

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }

    currentTrack = null;

    if (videoRef.value) {
        videoRef.value.srcObject = null;
    }

    clearCanvas();
};

const switchCamera = async () => {
    if (videoDevices.value.length < 2) return;
    currentDeviceIndex.value = (currentDeviceIndex.value + 1) % videoDevices.value.length;
    await startCamera();
};

const toggleTorch = async () => {
    if (!currentTrack || !hasTorchCapability.value) return;
    try {
        isTorchOn.value = !isTorchOn.value;
        await currentTrack.applyConstraints({
            advanced: [{ torch: isTorchOn.value } as any]
        });
    } catch (e) {
        console.warn('[BarcodeScanner] Torch toggle error:', e);
        isTorchOn.value = false;
    }
};

const toggleZoom = async () => {
    if (!currentTrack || !hasZoomCapability.value) return;
    try {
        isZoomed.value = !isZoomed.value;
        const capabilities: any = currentTrack.getCapabilities();
        const targetZoom = isZoomed.value ? Math.min(2.0, capabilities.zoom?.max || 2.0) : 1.0;
        await currentTrack.applyConstraints({
            advanced: [{ zoom: targetZoom } as any]
        });
    } catch (e) {
        console.warn('[BarcodeScanner] Zoom toggle error:', e);
        isZoomed.value = false;
    }
};

const handleVideoLoaded = () => {
    syncCanvasSize();
};

const syncCanvasSize = () => {
    if (!canvasRef.value || !containerRef.value) return;
    canvasRef.value.width = containerRef.value.clientWidth;
    canvasRef.value.height = containerRef.value.clientHeight;
};

const clearCanvas = () => {
    if (!canvasRef.value) return;
    const ctx = canvasRef.value.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
};

// -------------------------------------------------------------
// DETECTION LOOP & SPATIAL BOUNDING BOX PROJECTION
// -------------------------------------------------------------
const startDetectionLoop = () => {
    if (!isStreaming.value || !videoRef.value) return;

    const detectFrame = async () => {
        if (!props.isOpen || !isStreaming.value || !videoRef.value) return;

        if (videoRef.value.readyState >= 2 && barcodeDetector) {
            try {
                const barcodes = await barcodeDetector.detect(videoRef.value);
                if (barcodes && barcodes.length > 0) {
                    handleBarcodesDetected(barcodes);
                } else {
                    clearCanvas();
                }
            } catch (err) {
                // Intermittent decode error; continue frame loop
            }
        }

        animationFrameId = requestAnimationFrame(detectFrame);
    };

    animationFrameId = requestAnimationFrame(detectFrame);
};

const handleBarcodesDetected = (barcodes: any[]) => {
    if (!barcodes || barcodes.length === 0) return;
    const primary = barcodes[0];
    const rawVal = (primary.rawValue || '').trim();

    if (!rawVal) return;

    // Render spatial bounding box hugging the code
    renderBoundingBoxes(barcodes);

    // Debounce detections (avoid rapid multi-fires for the exact same value within 1.5s)
    const now = Date.now();
    if (lastScannedValue === rawVal && (now - lastScannedTime) < 1500) {
        return;
    }

    lastScannedValue = rawVal;
    lastScannedTime = now;
    lastDetectedCode.value = primary;

    // Audio beep + haptic feedback
    playBeepSound();
    triggerHapticPulse();

    const scanResult: ScannedResult = {
        rawValue: rawVal,
        format: primary.format || 'unknown',
        timestamp: now
    };

    if (props.mode === 'continuous') {
        if (!recentScans.value.includes(rawVal)) {
            recentScans.value.unshift(rawVal);
        }
        emit('scan', scanResult);
    } else {
        // Single mode: Lock-on, show bounding box, and close after brief visual pause
        emit('scan', scanResult);
        setTimeout(() => {
            if (props.isOpen) {
                handleClose();
            }
        }, props.autoCloseDelay);
    }
};

/**
 * Calculates exact spatial projection mapping between video stream resolution
 * and responsive container size to draw the neon bounding box directly over the tag!
 */
const renderBoundingBoxes = (barcodes: any[]) => {
    if (!canvasRef.value || !videoRef.value || !containerRef.value) return;
    const canvas = canvasRef.value;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const video = videoRef.value;
    const container = containerRef.value;

    syncCanvasSize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    if (!videoW || !videoH) return;

    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    const videoRatio = videoW / videoH;
    const containerRatio = containerW / containerH;

    let renderW = containerW;
    let renderH = containerH;
    let offsetX = 0;
    let offsetY = 0;

    if (containerRatio > videoRatio) {
        renderW = containerH * videoRatio;
        offsetX = (containerW - renderW) / 2;
    } else {
        renderH = containerW / videoRatio;
        offsetY = (containerH - renderH) / 2;
    }

    const scaleX = renderW / videoW;
    const scaleY = renderH / videoH;

    for (const b of barcodes) {
        const box = b.boundingBox;
        if (!box) continue;

        const x = offsetX + (box.x * scaleX);
        const y = offsetY + (box.y * scaleY);
        const w = box.width * scaleX;
        const h = box.height * scaleY;

        // 1. Neon Glowing Outer Frame
        ctx.save();
        ctx.strokeStyle = '#22c55e';
        ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 12;

        // Rounded Box
        ctx.beginPath();
        const r = 8;
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 2. Corner Target Brackets (Thicker emphasis)
        const arm = Math.min(16, Math.min(w, h) / 3);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#4ade80';

        // Top-Left
        ctx.beginPath();
        ctx.moveTo(x, y + arm);
        ctx.lineTo(x, y);
        ctx.lineTo(x + arm, y);
        ctx.stroke();

        // Top-Right
        ctx.beginPath();
        ctx.moveTo(x + w - arm, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + arm);
        ctx.stroke();

        // Bottom-Right
        ctx.beginPath();
        ctx.moveTo(x + w, y + h - arm);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + w - arm, y + h);
        ctx.stroke();

        // Bottom-Left
        ctx.beginPath();
        ctx.moveTo(x + arm, y + h);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x, y + h - arm);
        ctx.stroke();

        // 3. Floating Label Badge Above Box
        if (b.rawValue) {
            ctx.shadowBlur = 4;
            const text = String(b.rawValue);
            ctx.font = 'bold 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
            const metrics = ctx.measureText(text);
            const padding = 8;
            const tagW = metrics.width + (padding * 2);
            const tagH = 22;
            const tagX = Math.max(8, x + (w / 2) - (tagW / 2));
            const tagY = Math.max(tagH + 4, y - 8);

            // Pill Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(tagX, tagY - tagH, tagW, tagH, 6);
            ctx.fill();
            ctx.stroke();

            // Pill Text
            ctx.fillStyle = '#4ade80';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, tagX + padding, tagY - (tagH / 2));
        }

        ctx.restore();
    }
};

// -------------------------------------------------------------
// FEEDBACK: SYNTHETIC BEEP & HAPTICS
// -------------------------------------------------------------
const playBeepSound = () => {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioContext || audioContext.state === 'closed') {
            audioContext = new AudioCtx();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1800, audioContext.currentTime + 0.06);

        gain.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.07);

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.start();
        osc.stop(audioContext.currentTime + 0.07);
    } catch (e) {
        // Audio playback restricted by browser policy
    }
};

const triggerHapticPulse = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
            navigator.vibrate([60, 40, 60]);
        } catch {}
    }
};

const promptManualEntry = () => {
    const val = window.prompt('Enter or paste barcode / SKU manually:');
    if (val && val.trim()) {
        const cleaned = val.trim();
        emit('scan', {
            rawValue: cleaned,
            format: 'manual',
            timestamp: Date.now()
        });
        if (props.mode === 'single') {
            handleClose();
        }
    }
};
</script>

<style scoped>
.scanner-fade-enter-active,
.scanner-fade-leave-active {
    transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.scanner-fade-enter-from,
.scanner-fade-leave-to {
    opacity: 0;
}

@keyframes laser-sweep {
    0% {
        top: 8%;
        opacity: 0.8;
    }
    50% {
        top: 88%;
        opacity: 1;
    }
    100% {
        top: 8%;
        opacity: 0.8;
    }
}

.scanner-laser {
    animation: laser-sweep 2.2s infinite ease-in-out;
}

@keyframes bounce-in {
    0% {
        transform: scale(0.85);
        opacity: 0;
    }
    60% {
        transform: scale(1.05);
        opacity: 1;
    }
    100% {
        transform: scale(1);
    }
}

.animate-bounce-in {
    animation: bounce-in 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

.pt-safe {
    padding-top: max(0.75rem, env(safe-area-inset-top));
}

.pb-safe {
    padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}
</style>
