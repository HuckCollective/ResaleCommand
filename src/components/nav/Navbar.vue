<template>
  <nav class="navbar max-w-screen-lx mx-auto">
    <div class="navbar-start md:pl-2 lg:pl-8 items-center flex">
      <a href="/" class="btn btn-ghost text-xl font-bold text-primary">Resale Command</a>
      <div v-if="alphaMode" class="badge badge-warning badge-sm font-bold uppercase ml-2 shadow border border-warning">Alpha Mode</div>
    </div>
    <div class="navbar-center"></div>
    <div class="navbar-end md:pr-2 lg:pr-8">
      <!-- Nav Links -->
      <a v-for="link in navLinks" 
         :key="link.url"
         :href="link.url"
         class="hidden md:inline-flex btn btn-ghost hover:bg-base-200">
        {{ link.text }}
      </a>
      
      <!-- Tracker Drawer Toggle (Fast Open for Mobile/Tablet) -->
      <div class="indicator" v-if="isAuthenticated">
        <span v-if="cartItems.length > 0" class="indicator-item badge badge-primary badge-sm font-bold">{{ cartItems.length }}</span>
        <button @click="toggleTracker" class="btn btn-ghost btn-circle hover:bg-base-200" aria-label="Open Tracker">
          <!-- Tracker Icon -->
          <Icon icon="solar:object-scan-linear" class="w-6 h-6" />
        </button>
      </div>
      
      <!-- Auth Section -->
      <div v-if="loading" class="hidden md:inline-flex items-center gap-2">
         <button class="btn btn-ghost">
           <span class="loading loading-spinner loading-sm"></span>
         </button>
      </div>

      <div v-else class="hidden md:inline-flex items-center gap-2">
        <!-- Not Authenticated -->
        <a v-if="!isAuthenticated" href="/login" class="btn btn-ghost">Login</a>

        <!-- Authenticated -->
        <div v-else class="flex items-center gap-2">
           
           <ThemeSwitcher />
           
           <!-- Team Selector -->
           <div class="dropdown dropdown-end mr-2">
              <div tabindex="0" role="button" class="btn btn-ghost btn-sm gap-2">
                 <span>{{ currentTeam ? currentTeam.name : 'Personal Inventory' }}</span>
                 <!-- Chevron Icon -->
                 <Icon icon="solar:alt-arrow-down-linear" class="w-4 h-4" />
              </div>
              <ul tabindex="0" class="dropdown-content z-[50] menu p-2 shadow bg-base-100 rounded-box w-52">
                 <li v-for="team in teams" :key="team.$id">
                    <a @click="handleSwitchTeam(team)" :class="{ active: currentTeam && currentTeam.$id === team.$id }">{{ team.name }}</a>
                 </li>
                 <div class="divider my-0"></div>
                 <li v-if="!ownedTeam"><a @click="showCreateModal = true">+ Create Organization</a></li>
                 <li v-if="currentTeam && ownedTeam && currentTeam.$id === ownedTeam.$id">
                    <a @click="showInviteModal = true">+ Invite Member</a>
                 </li>
              </ul>
           </div>

           <!-- User Avatar -->
           <div class="dropdown dropdown-end">
              <div tabindex="0" role="button" class="btn btn-ghost avatar placeholder cursor-pointer">
                <div class="bg-neutral text-neutral-content rounded-full w-10">
                  <span class="text-xs">{{ userInitial }}</span>
                </div>
              </div>
              <ul tabindex="0" class="mt-3 z-50 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
                <li v-if="isPartner"><div class="badge badge-secondary w-full">Partner</div></li>
                
                <div class="divider my-0" v-if="isPartner"></div>
                <li><a href="/profile">Profile Settings</a></li>
                <li><a @click="showCreateModal = true">+ Create Organization</a></li>
                <div class="divider my-0"></div>

                <li><a @click="logout">Logout</a></li>
              </ul>
           </div>

        </div>
      </div>

      <!-- Mobile Menu Button -->
      <button @click="openMobile = !openMobile" class="btn btn-square btn-ghost md:hidden" aria-label="Menü öffnen">
          <Icon icon="solar:hamburger-menu-linear" class="w-6 h-6" />
      </button>

      <!-- Mobile Menu -->
      <div v-show="openMobile" class="fixed inset-0 bg-primary flex flex-col items-center justify-center space-y-6 z-50 transition-all">
          <button @click="openMobile = false" class="absolute top-6 right-6 text-4xl focus:outline-none">&times;</button>
          
          <a v-for="link in navLinks" :key="link.url" :href="link.url" class="text-2xl text-primary-content hover:text-accent" @click="openMobile = false">
             {{ link.text }}
          </a>

          <!-- Mobile Tracker Toggle -->
          <label v-if="isAuthenticated" for="tracker-drawer" class="text-2xl text-primary-content hover:text-accent cursor-pointer lg:hidden" @click="openMobile = false">
             Tracker
          </label>

          <div v-if="!loading" class="flex flex-col items-center gap-4">
             <a v-if="!isAuthenticated" href="/login" class="text-2xl text-primary-content hover:text-accent" @click="openMobile = false">Login</a>
             <div v-else class="flex flex-col items-center gap-2">
                 <span class="text-lg font-bold text-primary-content">Hello, {{ user ? user.name : 'User' }}</span>
                 <span v-if="isPartner" class="badge badge-secondary">Partner</span>
                 <a href="/profile" class="text-2xl text-primary-content hover:text-accent" @click="openMobile = false">Profile Settings</a>
                 <a @click="logout(); openMobile = false" class="text-2xl text-primary-content hover:text-accent cursor-pointer">Logout</a>
             </div>
          </div>
      </div>

    </div>

    <!-- Modals -->
    <!-- Create Team Modal -->
    <dialog class="modal" :class="{ 'modal-open': showCreateModal }">
       <div class="modal-box">
          <h3 class="font-bold text-lg">Create New Organization</h3>
          <p class="py-2 text-sm">Create a shared workspace.</p>
          <div class="py-4">
             <input type="text" placeholder="Organization Name" class="input input-bordered w-full" v-model="newTeamName" @keydown.enter.prevent="handleCreateTeam" />
          </div>
          <div class="modal-action">
             <button class="btn" @click="showCreateModal = false">Cancel</button>
             <button class="btn btn-primary" @click="handleCreateTeam" :disabled="!newTeamName">Create</button>
          </div>
       </div>
    </dialog>

    <!-- Invite Member Modal -->
    <dialog class="modal" :class="{ 'modal-open': showInviteModal }">
       <div class="modal-box">
          <h3 class="font-bold text-lg">Invite New Member</h3>
          <p class="py-2 text-sm">Send an invitation email.</p>
          <div class="py-4">
             <input type="email" placeholder="Email Address" class="input input-bordered w-full" v-model="inviteEmail" @keydown.enter.prevent="handleInvite" />
          </div>
          <div class="modal-action">
             <button class="btn" @click="showInviteModal = false">Cancel</button>
             <button class="btn btn-primary" @click="handleInvite" :disabled="!inviteEmail">Send Invite</button>
          </div>
       </div>
    </dialog>

  </nav>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStore } from '@nanostores/vue';
import { isAlphaMode } from '../../stores/env';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import ThemeSwitcher from '../ui/ThemeSwitcher.vue';
import { useCart } from '../../composables/useCart';
import { Icon } from '@iconify/vue';

const { 
  user, isAuthenticated, currentTeam, teams, ownedTeam, isPartner, loading,
  switchTeam, createTeam, inviteMember, logout: authLogout 
} = useAuth();

const { cartItems } = useCart();

const alphaMode = useStore(isAlphaMode);

// Dynamic Nav Links
const navLinks = computed(() => {
  const links = [
     // Scout is public
    { text: 'Scout', url: '/scout' }
  ];
  
  // Protected Routes
  if (isAuthenticated.value) {
    links.push(
      { text: 'Dashboard', url: '/dashboard' },
      { text: 'Inventory', url: '/inventory' },
      { text: 'Organization', url: '/org/settings' }
    );
  }
  return links;
});

const openMobile = ref(false);
const showCreateModal = ref(false);
const showInviteModal = ref(false);
const newTeamName = ref('');
const inviteEmail = ref('');

const userInitial = computed(() => {
   return user.value && user.value.name ? user.value.name.charAt(0).toUpperCase() : '?';
});

const logout = async () => {
    await authLogout();
};

const handleSwitchTeam = async (team: any) => {
    // Dropdown closes automatically or we force close? 
    // Usually daisyui dropdown closes on blur.
    await switchTeam(team);
};

const handleCreateTeam = async () => {
    if(!newTeamName.value) return;
    try {
        await createTeam(newTeamName.value);
        showCreateModal.value = false;
        newTeamName.value = '';
    } catch(e: any) {
        addToast({ type: 'error', message: e.message });
    }
};

const handleInvite = async () => {
    if(!inviteEmail.value || !currentTeam.value) return;
    try {
        await inviteMember(currentTeam.value.$id, inviteEmail.value);
        showInviteModal.value = false;
        inviteEmail.value = '';
        addToast({ type: 'success', message: 'Invitation sent!' });
    } catch(e: any) {
        if (e.message.includes('unique') || e.code === 409) {
            addToast({ type: 'warning', message: 'This user is already a member or has a pending invitation.' });
        } else {
            addToast({ type: 'error', message: e.message });
        }
    }
};

const toggleTracker = () => {
    if (window.innerWidth >= 1024) {
        // Desktop: toggle static side-by-side pane
        const drawer = document.getElementById('app-drawer');
        if (drawer) {
            drawer.classList.toggle('lg:drawer-open');
            setTimeout(() => window.dispatchEvent(new Event('resize')), 50); // Help graphs/masonry recalculate
        }
    } else {
        // Mobile/Tablet: toggle overlay checkbox
        const cb = document.getElementById('tracker-drawer') as HTMLInputElement;
        if (cb) cb.checked = !cb.checked;
    }
};

</script>
