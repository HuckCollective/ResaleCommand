<template>
  <div class="dropdown dropdown-end z-[100]">
    <div tabindex="0" role="button" class="btn btn-ghost">
      <span class="text-xl">🎨</span>
      <span class="hidden sm:inline font-bold">Theme</span>
      <Icon icon="solar:alt-arrow-down-linear" class="w-3.5 h-3.5 opacity-60 inline-block" />
    </div>
    <ul tabindex="0" class="dropdown-content bg-base-200 text-base-content rounded-box z-[1] w-52 p-2 shadow-2xl h-80 overflow-y-auto outline outline-1 outline-base-300">
      <li v-for="theme in themes" :key="theme">
        <button 
          @click="setTheme(theme)" 
          class="btn btn-sm btn-ghost w-full justify-start capitalize mb-1"
          :class="{'bg-primary/20 text-primary border-primary': currentTheme === theme}"
          :data-theme="theme"
        >
          <span class="inline-block w-4">{{ currentTheme === theme ? '✓' : '' }}</span>
          {{ theme }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';

const themes = [
  'emerald', 'light', 'dark', 'cupcake', 'bumblebee', 
  'corporate', 'synthwave', 'retro', 'cyberpunk', 'valentine',
  'halloween', 'garden', 'forest', 'aqua', 'lofi', 
  'pastel', 'fantasy', 'wireframe', 'black', 'luxury', 
  'dracula', 'cmyk', 'autumn', 'business', 'acid', 
  'lemonade', 'night', 'coffee', 'winter', 'dim', 
  'nord', 'sunset', 'caramellatte', 'abyss', 'silk'
].sort();

const currentTheme = ref('emerald');

onMounted(() => {
  const stored = localStorage.getItem('theme');
  if (stored && themes.includes(stored)) {
    setTheme(stored); 
  } else {
    // defaults to emerald on first load but verify against html tag
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current || 'emerald');
  }
});

const setTheme = (theme) => {
  currentTheme.value = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  document.activeElement?.blur(); // close dropdown
};
</script>
