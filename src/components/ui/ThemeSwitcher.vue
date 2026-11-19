<template>
  <label class="inline-flex items-center gap-1.5 min-w-0">
    <span aria-hidden="true" class="text-sm leading-none shrink-0">🎨</span>
    <select
      aria-label="Color theme"
      :value="currentTheme"
      class="select select-bordered select-xs h-11 md:h-8 rounded-xl font-bold capitalize text-xs w-36 max-w-full bg-base-100"
      @change="onThemeSelect"
    >
      <option v-for="theme in THEME_OPTIONS" :key="theme" :value="theme" class="capitalize">
        {{ theme }}
      </option>
    </select>
  </label>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const OTHER_THEMES = [
  'emerald', 'light', 'dark', 'cupcake', 'bumblebee',
  'corporate', 'synthwave', 'retro', 'cyberpunk', 'valentine',
  'halloween', 'garden', 'forest', 'aqua', 'lofi',
  'pastel', 'fantasy', 'wireframe', 'black', 'luxury',
  'dracula', 'cmyk', 'autumn', 'business', 'acid',
  'lemonade', 'night', 'coffee', 'winter', 'dim',
  'nord', 'sunset', 'caramellatte', 'abyss', 'silk',
].sort();

const THEME_OPTIONS = ['huckleberry', ...OTHER_THEMES];
const currentTheme = ref('huckleberry');

function applyTheme(theme: string, persist = true) {
  const clean = THEME_OPTIONS.includes(theme) ? theme : 'huckleberry';
  currentTheme.value = clean;
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', clean);
  }
  if (persist && typeof window !== 'undefined') {
    try {
      localStorage.setItem('theme', clean);
    } catch {}
    window.dispatchEvent(new CustomEvent('rc-theme-changed', { detail: clean }));
  }
}

function onThemeSelect(e: Event) {
  const val = (e.target as HTMLSelectElement)?.value || 'huckleberry';
  applyTheme(val, true);
}

function onExternalThemeChange(e: Event) {
  const next = (e as CustomEvent)?.detail;
  if (typeof next === 'string' && THEME_OPTIONS.includes(next)) {
    currentTheme.value = next;
  }
}

onMounted(() => {
  try {
    if (!localStorage.getItem('rc_huckleberry_default_v1')) {
      if (!localStorage.getItem('theme') || localStorage.getItem('theme') === 'emerald') {
        localStorage.setItem('theme', 'huckleberry');
      }
      localStorage.setItem('rc_huckleberry_default_v1', '1');
    }
    const stored = localStorage.getItem('theme');
    if (stored && THEME_OPTIONS.includes(stored)) {
      applyTheme(stored, false);
    } else {
      const domTheme = document.documentElement.getAttribute('data-theme');
      applyTheme(domTheme || 'huckleberry', false);
    }
  } catch {
    applyTheme('huckleberry', false);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('rc-theme-changed', onExternalThemeChange);
  }
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('rc-theme-changed', onExternalThemeChange);
  }
});
</script>
