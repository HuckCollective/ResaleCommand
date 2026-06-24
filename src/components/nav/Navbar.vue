<template>
  <nav class="navbar max-w-screen-lx mx-auto">
    <div class="navbar-start md:pl-2 lg:pl-8 items-center flex">
      <a href="/" class="btn btn-ghost text-xl font-bold text-primary">Resale Command</a>
      <div v-if="alphaMode" class="badge badge-warning badge-sm font-bold uppercase ml-2 shadow border border-warning">Alpha Mode</div>
    </div>
    <div class="navbar-center"></div>
    <div class="navbar-end md:pr-2 lg:pr-8">
      <!-- Nav Links / Combined Scout & Tracker -->
      <template v-if="isAuthenticated">
        <!-- Desktop & Mobile: Unified Scout Page / Toggle Tracker Link -->
        <div class="indicator flex items-center mr-2 md:mr-4">
          <span v-if="cartItems.length > 0" class="indicator-item badge badge-primary badge-sm font-bold z-10">{{ cartItems.length }}</span>
          <a href="/scout" 
             @click="handleScoutClick"
             class="btn btn-ghost btn-sm border border-base-300 bg-base-200/50 rounded-lg gap-1.5 normal-case font-semibold hover:bg-base-200 flex items-center px-3"
             aria-label="Go to Scout">
            <Icon icon="solar:object-scan-linear" class="w-4 h-4 text-primary" />
            <span class="hidden sm:inline">Scout</span>
          </a>
        </div>
      </template>
      <template v-else>
        <a href="/scout" class="hidden md:inline-flex btn btn-ghost hover:bg-base-200 mr-2">
          Scout
        </a>
      </template>
      
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
        <div v-else class="flex items-center gap-3">
           
           <!-- Team Selector -->
           <div class="dropdown dropdown-end">
              <div tabindex="0" role="button" class="btn btn-outline btn-sm gap-2 border-base-300 hover:border-primary-focus">
                 <Icon icon="solar:users-group-two-rounded-linear" class="w-4 h-4 text-primary" />
                 <span class="max-w-[120px] truncate font-semibold">{{ currentTeam ? currentTeam.name : 'Personal Inventory' }}</span>
                 <Icon icon="solar:alt-arrow-down-linear" class="w-3.5 h-3.5 opacity-60" />
              </div>
              <ul tabindex="0" class="dropdown-content z-[50] menu p-2 shadow bg-base-100 rounded-box w-56 space-y-1">
                  <!-- Workspaces Header -->
                  <span class="text-[10px] uppercase font-bold opacity-50 tracking-wider px-3 py-1 border-b border-base-200/50 mb-1">Workspaces</span>
                  
                  <!-- Personal Inventory choice -->
                  <li>
                     <a @click="handleSwitchTeam(null)" :class="{ active: !currentTeam }">
                        <Icon icon="solar:user-linear" class="w-4 h-4" />
                        Personal Inventory
                     </a>
                  </li>

                  <!-- Teams list -->
                  <li v-for="team in teams" :key="team.$id">
                     <a @click="handleSwitchTeam(team)" :class="{ active: currentTeam && currentTeam.$id === team.$id }">
                        <Icon icon="solar:users-group-two-rounded-linear" class="w-4 h-4" />
                        {{ team.name }}
                     </a>
                  </li>

                  <div class="divider my-0"></div>

                  <!-- Workspace Tools Header -->
                  <span class="text-[10px] uppercase font-bold opacity-50 tracking-wider px-3 py-1 border-b border-base-200/50 mb-1">Workspace Tools</span>
                  
                  <li>
                     <a href="/dashboard" class="gap-2 font-semibold">
                         <Icon icon="solar:widget-linear" class="w-4 h-4 text-primary" />
                         Dashboard
                     </a>
                  </li>
                  <li>
                     <a href="/inventory" class="gap-2 font-semibold">
                         <Icon icon="solar:box-linear" class="w-4 h-4 text-primary" />
                         Inventory
                     </a>
                  </li>
                  
                  <!-- Organization Settings Link (if team is selected) -->
                  <li v-if="currentTeam">
                     <a href="/org/settings" class="gap-2 font-semibold text-secondary">
                         <Icon icon="solar:settings-linear" class="w-4 h-4" />
                         Manage Settings
                     </a>
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
               <ul tabindex="0" class="mt-3 z-50 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-56 space-y-1">
                 <li class="px-4 py-2 border-b border-base-200">
                    <p class="font-bold text-sm truncate text-base-content">{{ user?.name || 'User' }}</p>
                    <p class="text-xs opacity-60 truncate text-base-content">{{ user?.email }}</p>
                 </li>
                 <li v-if="isPartner"><div class="badge badge-secondary w-full">Partner</div></li>
                 
                 <li><a href="/profile"><Icon icon="solar:user-id-linear" class="w-4 h-4" /> Profile Settings</a></li>
                 
                 <div class="divider my-0"></div>
                 
                 <!-- Inline Theme switcher -->
                 <li class="flex flex-row justify-between items-center px-4 py-1 hover:bg-transparent">
                    <span class="text-xs font-semibold opacity-70">Theme</span>
                    <ThemeSwitcher />
                 </li>
                 
                 <div class="divider my-0"></div>
                 
                 <li><a @click="showCreateModal = true"><Icon icon="solar:users-group-two-rounded-linear" class="w-4 h-4" /> Create Organization</a></li>
                 <li><a @click="logout" class="text-error"><Icon icon="solar:logout-linear" class="w-4 h-4 text-error" /> Logout</a></li>
               </ul>
            </div>

        </div>
      </div>

      <!-- Mobile Menu Button -->
      <button @click="openMobile = !openMobile" class="btn btn-square btn-ghost md:hidden" aria-label="Open mobile menu">
          <Icon icon="solar:hamburger-menu-linear" class="w-6 h-6" />
      </button>

      <!-- Mobile Menu Backdrop -->
      <Transition name="fade">
        <div v-if="openMobile" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]" @click="openMobile = false"></div>
      </Transition>

      <!-- Mobile Menu Side Drawer -->
      <Transition name="slide">
        <div v-if="openMobile" class="fixed top-0 right-0 h-full w-[85%] max-w-[320px] bg-base-100 border-l border-base-300 shadow-2xl z-[101] flex flex-col justify-between overflow-y-auto">
            <!-- Header -->
            <div class="p-6 pb-4 flex justify-between items-center border-b border-base-200">
                <span class="text-xl font-bold text-primary">Resale Command</span>
                <button @click="openMobile = false" class="btn btn-ghost btn-circle btn-sm" aria-label="Close menu">
                    <Icon icon="solar:close-circle-linear" class="w-6 h-6" />
                </button>
            </div>

            <!-- Content Area -->
            <div class="flex-1 p-6 space-y-6">
                <!-- Navigation -->
                <div class="flex flex-col gap-2">
                    <span class="text-xs uppercase font-bold opacity-50 tracking-wider">Navigation</span>
                    <a v-for="link in navLinks" :key="link.url" :href="link.url" 
                       class="btn btn-ghost justify-start gap-3 w-full normal-case text-base hover:bg-base-200"
                       @click="openMobile = false">
                       <Icon v-if="link.text === 'Scout'" icon="solar:object-scan-linear" class="w-5 h-5 text-primary" />
                       <Icon v-else-if="link.text === 'Dashboard'" icon="solar:widget-linear" class="w-5 h-5 text-primary" />
                       <Icon v-else-if="link.text === 'Inventory'" icon="solar:box-linear" class="w-5 h-5 text-primary" />
                       <Icon v-else-if="link.text === 'Organization'" icon="solar:settings-linear" class="w-5 h-5 text-primary" />
                       <span class="grow text-left">{{ link.text }}</span>
                       <span v-if="link.text === 'Scout' && cartItems.length > 0" class="badge badge-primary font-bold">{{ cartItems.length }}</span>
                    </a>
                </div>

                <div class="divider my-0"></div>

                <!-- Team Workspace Selector -->
                <div v-if="isAuthenticated" class="flex flex-col gap-2">
                    <span class="text-xs uppercase font-bold opacity-50 tracking-wider">Active Workspace</span>
                    <div class="form-control w-full">
                        <select class="select select-bordered w-full select-sm font-semibold" @change="handleMobileSwitchTeam">
                            <option :selected="!currentTeam" value="personal">Personal Inventory</option>
                            <option v-for="team in teams" :key="team.$id" :value="team.$id" :selected="currentTeam && currentTeam.$id === team.$id">
                                {{ team.name }}
                            </option>
                        </select>
                    </div>
                    
                    <div class="divider my-1"></div>
                    <span class="text-[10px] uppercase font-bold opacity-50 tracking-wider px-1">Workspace Tools</span>
                    
                    <!-- Mobile Dashboard & Inventory Links -->
                    <a href="/dashboard" class="btn btn-ghost justify-start gap-3 w-full normal-case text-sm" @click="openMobile = false">
                        <Icon icon="solar:widget-linear" class="w-5 h-5 text-primary" /> Dashboard
                    </a>
                    <a href="/inventory" class="btn btn-ghost justify-start gap-3 w-full normal-case text-sm" @click="openMobile = false">
                        <Icon icon="solar:box-linear" class="w-5 h-5 text-primary" /> Inventory
                    </a>
                    
                    <div class="flex flex-wrap gap-2 mt-1">
                        <a v-if="currentTeam" href="/org/settings" class="btn btn-xs btn-outline btn-accent flex-1 justify-center gap-1.5" @click="openMobile = false">
                            <Icon icon="solar:settings-linear" class="w-3.5 h-3.5" /> Settings
                        </a>
                        <button class="btn btn-xs btn-outline btn-primary flex-1" @click="showCreateModal = true; openMobile = false">+ Create Org</button>
                        <button v-if="currentTeam && ownedTeam && currentTeam.$id === ownedTeam.$id" class="btn btn-xs btn-outline btn-secondary flex-1" @click="showInviteModal = true; openMobile = false">+ Invite</button>
                    </div>
                </div>
            </div>

            <!-- Footer Area (User Profile & Switcher) -->
            <div class="p-6 bg-base-200 border-t border-base-300 space-y-4">
                <div v-if="isAuthenticated" class="flex items-center gap-3">
                    <div class="avatar placeholder">
                        <div class="bg-neutral text-neutral-content rounded-full w-10">
                            <span class="text-xs">{{ userInitial }}</span>
                        </div>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold truncate text-base-content">{{ user?.name || 'User' }}</p>
                        <p class="text-xs opacity-60 truncate text-base-content">{{ user?.email }}</p>
                    </div>
                    <span v-if="isPartner" class="badge badge-secondary badge-sm">Partner</span>
                </div>

                <div class="flex items-center justify-between border-t border-base-300/50 pt-3">
                    <span class="text-sm font-semibold opacity-70">Theme</span>
                    <ThemeSwitcher />
                </div>

                <div class="flex flex-col gap-2 pt-2">
                    <a v-if="!isAuthenticated" href="/login" class="btn btn-primary btn-sm w-full" @click="openMobile = false">Login</a>
                    <template v-else>
                        <a href="/profile" class="btn btn-outline btn-sm w-full" @click="openMobile = false">Profile Settings</a>
                        <button @click="logout(); openMobile = false" class="btn btn-error btn-sm w-full">Logout</button>
                    </template>
                </div>
            </div>
        </div>
      </Transition>

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
  return [
     // Scout is public
    { text: 'Scout', url: '/scout' }
  ];
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

const handleMobileSwitchTeam = async (event: Event) => {
    const select = event.target as HTMLSelectElement;
    if (select.value === 'personal') {
        await switchTeam(null);
    } else {
        const team = teams.value.find(t => t.$id === select.value);
        if (team) {
            await switchTeam(team);
        }
    }
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

const handleScoutClick = (e: MouseEvent) => {
    if (window.location.pathname === '/scout') {
        e.preventDefault();
        toggleTracker();
    }
};

</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
