<template>
  <div>
    <!-- TRIGGER BUTTON -->
    <button class="btn btn-primary gap-2" @click="isOpen = true">
        <Icon icon="solar:add-square-linear" class="h-5 w-5" />
        Add New
    </button>

    <!-- DRAWER OVERLAY -->
    <div class="fixed inset-0 z-[100] flex justify-end"
         :class="isOpen ? 'pointer-events-auto' : 'pointer-events-none'">
         
         <!-- Backdrop -->
         <div class="absolute inset-0 bg-black/50 transition-opacity duration-300 ease-in-out"
              :class="isOpen ? 'opacity-100' : 'opacity-0'"
              @click="isOpen = false"></div>

         <!-- Drawer Panel -->
         <div class="relative w-full max-w-sm md:w-96 h-full bg-base-100 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out z-20"
              :class="isOpen ? 'translate-x-0' : 'translate-x-full'">
              
              <!-- HEADER -->
              <div class="p-4 border-b border-base-200 bg-base-100 flex justify-between items-center sticky top-0 z-10 shrink-0">
                  <div class="flex items-center gap-2">
                      <h2 class="text-xl font-bold">{{ mode === 'manual' ? 'Add Item' : 'Import CSV' }}</h2>
                      <div class="badge badge-sm" :class="mode === 'manual' ? 'badge-neutral' : 'badge-primary'">
                        {{ mode === 'manual' ? 'Manual' : 'Bulk' }}
                      </div>
                  </div>
                  <button @click="isOpen = false" class="btn btn-sm btn-circle btn-ghost">✕</button>
              </div>

            <!-- MANUAL FORM -->
            <div v-if="mode === 'manual'" class="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
                
                <!-- IMAGE UPLOAD & SCOUT -->
                <div class="space-y-2">
                     <label class="label pt-0"><span class="label-text font-bold">Photos (Required for AI)</span></label>
                     <div class="flex gap-2 items-center w-full">
                          <button class="btn btn-outline border-dashed flex-1 text-xs" @click="$refs.fileInput.click()">
                              <Icon icon="solar:gallery-add-linear" class="w-4 h-4 mr-1 inline" /> Upload
                          </button>
                          <button class="btn btn-outline border-dashed flex-1 text-xs" @click="scannerWidget?.startCamera()">
                              <Icon icon="solar:camera-linear" class="w-4 h-4 mr-1 inline" /> Camera
                          </button>
                          <input type="file" ref="fileInput" @change="handleFileSelect" accept="image/*" multiple class="hidden" />
                     </div>
                     <ScannerWidget ref="scannerWidget" :photos="imageFiles" :hide-all-triggers="true" @photos-captured="handleCapturedPhotos" @remove-photo="removeImage" />

                     <!-- Thumbnails -->
                     <div v-if="images.length > 0" class="flex gap-2 overflow-x-auto pb-2 mt-2">
                        <div v-for="(img, idx) in images" :key="idx" class="relative w-16 h-16 shrink-0 group rounded overflow-hidden border border-base-300">
                             <img :src="img" class="w-full h-full object-cover" />
                             <button @click="removeImage(idx)" class="btn btn-circle btn-xs btn-error absolute top-0 right-0 w-4 h-4 min-h-0 text-[10px] flex items-center justify-center">✕</button>
                        </div>
                     </div>

                     <!-- ANALYZE BUTTON -->
                     <button v-if="images.length > 0" 
                             @click="analyzeImage" 
                             class="btn btn-secondary w-full btn-sm shadow-sm gap-2" 
                             :disabled="analyzing">
                         <span v-if="analyzing" class="loading loading-spinner loading-xs"></span>
                         <Icon icon="solar:magic-stick-linear" class="w-4 h-4 inline" /> Auto-Fill with AI
                     </button>
                </div>

                <div class="divider my-0"></div>

                <div class="form-control hover:border-primary transition-colors">
                    <label class="label"><span class="label-text font-bold">Item Title</span></label>
                    <input v-model="form.title" type="text" placeholder="e.g. Nike Air Force 1" class="input input-bordered w-full text-lg font-bold" />
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="form-control">
                        <label class="label"><span class="label-text">Cost Basis</span></label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-50">$</span>
                            <input v-model="form.cost" type="number" step="0.01" placeholder="0.00" class="input input-bordered w-full pl-7" />
                        </div>
                    </div>
                    <div class="form-control">
                        <label class="label"><span class="label-text">List Price</span></label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 opacity-50">$</span>
                            <input v-model="form.listPrice" type="number" step="0.01" placeholder="0.00" class="input input-bordered w-full pl-7" />
                        </div>
                    </div>
                </div>

                <div class="form-control">
                    <label class="label"><span class="label-text">Bin / Location</span></label>
                    <input v-model="form.bin" type="text" placeholder="e.g. Bin A-2" class="input input-bordered w-full" />
                </div>
                
                <div class="form-control">
                    <label class="label"><span class="label-text">Description / Notes</span></label>
                    <textarea v-model="form.description" class="textarea textarea-bordered h-32" placeholder="Condition details, measurements..."></textarea>
                </div>
                
                <!-- CSV Option -->
                <div class="divider text-xs">OR IMPORT</div>
                <div class="form-control">
                     <button class="btn btn-outline btn-sm w-full gap-2 border-dashed" @click="mode = 'csv'">
                        <Icon icon="solar:document-text-linear" class="w-4 h-4 mr-1 inline" /> Import CSV (ShopGoodwill)
                     </button>
                </div>
            </div>

            <!-- CSV IMPORT VIEW -->
            <div v-if="mode === 'csv'" class="flex-1 flex flex-col h-full overflow-hidden">
                <CsvImporter @close="isOpen = false" @imported="onImported" />
                <button class="btn btn-ghost btn-xs w-full mt-2" @click="mode = 'manual'">← Back to Manual</button>
            </div>

            <!-- LOCKED BOTTOM FOOTER (Manual Only) -->
            <div v-if="mode === 'manual'" class="p-4 border-t border-base-200 bg-base-100 absolute bottom-0 w-full z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] gap-3 flex flex-col">
                <button class="btn btn-primary w-full shadow-lg" :disabled="loading || !form.title" @click="saveItem">
                    <span v-if="loading" class="loading loading-spinner"></span>
                    {{ loading ? 'Processing...' : 'Purchase Item' }}
                </button>
                 <button class="btn btn-ghost w-full btn-sm" @click="isOpen = false">Cancel</button>
            </div>
         </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useInventory } from '../../composables/useInventory';
import CsvImporter from './CsvImporter.vue';
import { storage, databases, ID } from '../../lib/appwrite';
import { Permission, Role } from 'appwrite';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import { Icon } from '@iconify/vue';
import { getSafeRawAnalysis } from '../../lib/inventory';
import ScannerWidget from '../common/ScannerWidget.vue';

const BUCKET_ID = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID;
const DB = import.meta.env.PUBLIC_APPWRITE_DB_ID;

const { addLocalItem } = useInventory(); // Keep hook if needed
const { user, currentTeam } = useAuth();

const isOpen = ref(false);
const mode = ref<'manual' | 'csv'>('manual');
const loading = ref(false);
const analyzing = ref(false);
const aiAnalysisResult = ref<any>(null);

const images = ref<string[]>([]);
const imageFiles = ref<File[]>([]);
const scannerWidget = ref<any>(null);

const form = reactive({
    title: '',
    cost: '',
    listPrice: '',
    bin: '',
    description: ''
});

function onImported() {
    // Optionally trigger a refresh or toast
}

// -- IMAGE LOGIC --
function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) {
        Array.from(input.files).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    images.value.push(ev.target.result as string);
                    imageFiles.value.push(file);
                }
            };
            reader.readAsDataURL(file);
        });
    }
}

function removeImage(idx: number) {
    images.value.splice(idx, 1);
    imageFiles.value.splice(idx, 1);
}

function handleCapturedPhotos(files: File[]) {
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (ev.target?.result) {
                images.value.push(ev.target.result as string);
                imageFiles.value.push(file);
            }
        };
        reader.readAsDataURL(file);
    });
}

// -- AI ANALYSIS --
async function analyzeImage() {
    if (images.value.length === 0) return;
    analyzing.value = true;
    aiAnalysisResult.value = null;
    try {
        const payload = JSON.stringify({ 
            images: images.value,
            notes: form.description 
        });

        // Reusing the same endpoint as Scout
        const response = await fetch(`/api/identify-item`, {
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' },
            body: payload
        });

        if (!response.ok) throw new Error("Analysis failed");
        
        const data = await response.json();
        
        // Auto-fill form
        if (data.items && data.items.length > 0) {
            const item = data.items[0];
            aiAnalysisResult.value = item;
            form.title = item.title || item.identity;
            form.description = (item.condition_notes || '') + '\n' + (form.description || '');
            if(item.price_breakdown?.fair) {
                // Parse price range string "10-20"
                const matches = item.price_breakdown.fair.match(/[0-9.]+/g);
                if (matches && matches.length >= 2) {
                     form.listPrice = ((parseFloat(matches[0]) + parseFloat(matches[1])) / 2).toFixed(2);
                } else if (matches && matches.length === 1) {
                     form.listPrice = parseFloat(matches[0]).toFixed(2);
                }
            }
        } else if (data.identity) { // Legacy single item response
             aiAnalysisResult.value = data;
             form.title = data.title || data.identity;
             // ... map other fields if needed
        }
        
    } catch (e: any) {
        addToast({ type: 'error', message: "Failed to analyze: " + e.message });
    } finally {
        analyzing.value = false;
    }
}

async function saveItem() {
    if (loading.value) return;
    if (!form.title) return;
    if (!user.value) {
        addToast({ type: 'warning', message: "Please login first" });
        return;
    }
    loading.value = true;
    
    try {
        // 1. Upload Images First
        let galleryIds: string[] = [];
        if (imageFiles.value.length > 0 && BUCKET_ID) {
             const uploads = await Promise.all(imageFiles.value.map(file => 
                 storage.createFile(BUCKET_ID, ID.unique(), file)
             ));
             galleryIds = uploads.map(u => u.$id);
        }

        // 2. Construct Payload
        const payload = {
            title: form.title,
            cost: parseFloat(form.cost) || 0,
            resalePrice: form.listPrice, 
            storageLocation: form.bin,
            conditionNotes: form.description,
            status: 'acquired', 
            keywords: [],
            redFlags: [],
            galleryImageIds: galleryIds,
            imageId: galleryIds[0] || null,
            rawAnalysis: aiAnalysisResult.value ? getSafeRawAnalysis(aiAnalysisResult.value) : undefined
        };
        
        await createItem(payload);
        
        // Success
        isOpen.value = false;
        // Reset
        form.title = '';
        form.cost = '';
        form.listPrice = '';
        form.bin = '';
        form.description = '';
        images.value = [];
        imageFiles.value = [];
        aiAnalysisResult.value = null;
        
        window.location.reload();

    } catch (e: any) {
        addToast({ type: 'error', message: "Error saving: " + e.message });
    } finally {
        loading.value = false;
    }
}

async function createItem(data: any) {
    if(!user.value) return; 
    
    let permissions: string[] = [];
    if (currentTeam.value) {
        const teamRole = Role.team(currentTeam.value.$id);
        permissions = [
            Permission.read(teamRole),
            Permission.update(teamRole),
            Permission.delete(teamRole),
        ];
    } else {
        const userRole = Role.user(user.value.$id);
        permissions = [
            Permission.read(userRole),
            Permission.update(userRole),
            Permission.delete(userRole),
        ];
    }
    
    await databases.createDocument(
        DB,
        'items', 
        ID.unique(),
        {
            ...data,
            userId: user.value.$id,
            teamId: currentTeam.value?.$id || 'default',
            tenantId: currentTeam.value?.$id || 'default'
        },
        permissions
    );
}
</script>
