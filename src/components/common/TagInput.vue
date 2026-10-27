<template>
    <div class="form-control w-full relative">
        <label v-if="label" class="label"><span class="label-text">{{ label }}</span></label>
        
        <!-- Tags Container -->
        <div class="flex flex-wrap gap-2 items-center mb-2" v-if="modelValue.length > 0">
            <!-- Selected Badges -->
            <span v-for="(tag, idx) in modelValue" :key="idx" class="badge gap-1 cursor-default items-center flex" :class="badgeClass">
                {{ tag }}
                <button @click.stop="removeTag(idx)" class="hover:text-error hover:font-bold ml-1 flex items-center justify-center rounded-full hover:bg-black/10 w-4 h-4 min-h-0 text-[10px]">✕</button>
            </span>
        </div>
            
        <!-- Type-ahead Input -->
        <input 
            ref="inputRef"
            type="text" 
            v-model="inputValue" 
            :placeholder="modelValue.length === 0 ? placeholder || 'Add...' : 'Add...'" 
            class="input input-sm w-full input-bordered" 
            @keydown.enter.prevent="addTag"
            @keydown.delete="handleDeleteKey"
            @focus="showSuggestions = true"
            @blur="handleBlur"
            @input="fetchSuggestions"
        />

        <!-- Suggestions Dropdown (Existing Tags in DB) -->
        <div v-if="showSuggestions && filteredSuggestions.length > 0" class="absolute z-50 mt-1 bg-base-100 border border-base-300 rounded-box shadow-xl max-h-48 overflow-y-auto w-full left-0 top-full">
            <ul class="menu menu-sm p-1">
                <li v-for="suggestion in filteredSuggestions" :key="suggestion.$id">
                    <a @mousedown.prevent="selectSuggestion(suggestion.label)" class="flex justify-between">
                        <span>{{ suggestion.label }}</span>
                        <span class="opacity-30 text-[10px] uppercase">{{ type }}</span>
                    </a>
                </li>
            </ul>
        </div>
        
        <!-- AI Recommended Badges (Quick Add) -->
        <div v-if="visibleRecommendedTags && visibleRecommendedTags.length > 0" class="mt-2 text-xs flex flex-wrap gap-1 items-center">
            <span class="font-bold opacity-50 uppercase text-[10px] mr-1">AI Suggests:</span>
            <button 
                v-for="rec in visibleRecommendedTags" 
                :key="rec" 
                @click.prevent="addSpecificTag(rec)"
                class="badge badge-sm badge-outline hover:badge-primary transition-colors cursor-pointer">
                + {{ rec }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { databases, Query, ID } from '../../lib/appwrite';
import { isAlphaMode } from '../../stores/env';

// Configuration for Tag DB
const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
const COLLECTION_ID = 'tags'; // We are adding this collection

const props = defineProps<{
    modelValue: string[];
    label?: string;
    placeholder?: string;
    type: 'keyword' | 'sellingLocations';
    badgeClass?: string;
    recommendedTags?: string[];
}>();

const emit = defineEmits(['update:modelValue']);

const inputRef = ref<HTMLInputElement | null>(null);
const inputValue = ref('');
const showSuggestions = ref(false);
const knownTags = ref<{ $id: string, label: string, type: string }[]>([]);

// Fetch existing tags from Appwrite for this type on mount
onMounted(async () => {
    try {
        const res = await databases.listDocuments(DB_ID, COLLECTION_ID, [
            Query.equal('type', props.type),
            Query.limit(100), // Get top 100
        ]);
        if (res.documents) {
            knownTags.value = res.documents as any;
        }
    } catch (e) {
        // Silently fail if collection doesn't exist yet, we will just have empty suggestions
    }
});

// Filter suggestions based on what user is typing
const filteredSuggestions = computed(() => {
    if (!inputValue.value) return knownTags.value.filter(t => !props.modelValue.includes(t.label)).slice(0, 10);
    const lowerQ = inputValue.value.toLowerCase();
    return knownTags.value
        .filter(t => t.label.toLowerCase().includes(lowerQ) && !props.modelValue.includes(t.label))
        .slice(0, 10);
});

// Hide any suggested tag in "AI Suggests" that is already present in the active tags array
const visibleRecommendedTags = computed(() => {
    if (!props.recommendedTags || !Array.isArray(props.recommendedTags)) return [];
    const activeLower = (props.modelValue || []).map(t => String(t).trim().toLowerCase());
    return props.recommendedTags.filter(rec => rec && !activeLower.includes(String(rec).trim().toLowerCase()));
});

const focusInput = () => {
    inputRef.value?.focus();
};

const handleBlur = () => {
    // Timeout allows mousedown on suggestion to fire before blur hides it
    setTimeout(() => { 
        showSuggestions.value = false;
        
        // Auto-commit any hanging text into a tag when user clicks away (e.g., clicking Save)
        if (inputValue.value && inputValue.value.trim().length > 0) {
            addSpecificTag(inputValue.value);
        }
    }, 150);
};

const removeTag = (idx: number) => {
    const updated = [...props.modelValue];
    updated.splice(idx, 1);
    emit('update:modelValue', updated);
};

const handleDeleteKey = () => {
    if (inputValue.value === '' && props.modelValue.length > 0) {
        // If backspace is pressed heavily while empty, delete the last tag
        removeTag(props.modelValue.length - 1);
    }
};

const selectSuggestion = (label: string) => {
    addSpecificTag(label);
    showSuggestions.value = false;
};

const addTag = () => {
    addSpecificTag(inputValue.value);
};

const addSpecificTag = (tagStr: string) => {
    const cleanTag = tagStr.trim();
    if (!cleanTag) return;
    
    // Prevent duplicates
    if (!props.modelValue.some(t => t.toLowerCase() === cleanTag.toLowerCase())) {
        const updated = [...props.modelValue, cleanTag];
        emit('update:modelValue', updated);
        
        // Push secretly to tags collection if it's completely new to our local known list
        if (!knownTags.value.some(t => t.label.toLowerCase() === cleanTag.toLowerCase())) {
             saveNewTagToDB(cleanTag, props.type);
             // Optimistically add to local list
             knownTags.value.push({ $id: 'temp_' + Date.now(), label: cleanTag, type: props.type });
        }
    }
    
    inputValue.value = ''; // Clear input
    inputRef.value?.focus();
};

const saveNewTagToDB = async (label: string, type: string) => {
     try {
         await databases.createDocument(DB_ID, COLLECTION_ID, ID.unique(), {
             label: label,
             type: type
         });
     } catch (e) {
         // Silently fail locally so it doesn't alarm user
     }
};

const fetchSuggestions = () => {
    showSuggestions.value = true;
};
</script>
