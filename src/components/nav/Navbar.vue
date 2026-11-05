<template>
  <header class="sticky top-0 z-40 w-full bg-base-100/95 backdrop-blur-md border-b border-base-200/80">
    <nav class="navbar max-w-screen-2xl mx-auto px-2 sm:px-4 lg:px-8 min-h-16">
      <!-- Brand / Left -->
      <div class="navbar-start w-auto lg:w-1/4 flex items-center gap-1.5">
        <a href="/" class="btn btn-ghost px-2 sm:px-3 text-lg sm:text-xl font-black tracking-tight text-primary gap-2">
          <Icon icon="solar:compass-big-bold-duotone" class="w-6 h-6 shrink-0" />
          <span class="truncate">Resale Command</span>
        </a>
        <span
          v-if="alphaMode"
          class="badge badge-warning badge-xs sm:badge-sm font-black uppercase whitespace-nowrap shrink-0 shadow-xs border border-warning"
        >
          Alpha
        </span>
      </div>

      <!-- Desktop Center: 5-Pillar Lifecycle Navigation -->
      <div v-if="isAuthenticated" class="navbar-center hidden lg:flex items-center">
        <ul class="menu menu-horizontal px-1 gap-1 items-center text-sm font-semibold">
          <!-- 1. Command Center -->
          <li>
            <a
              href="/dashboard"
              :aria-current="isRouteActive('/dashboard') ? 'page' : undefined"
              class="rounded-xl px-3 py-2 gap-1.5 transition-all"
              :class="isRouteActive('/dashboard') ? 'bg-primary/15 text-primary font-bold shadow-2xs' : 'hover:bg-base-200/80'"
            >
              <Icon icon="solar:widget-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
              <span>Command</span>
            </a>
          </li>

          <!-- 2. Purchases / Sourcing -->
          <li>
            <a
              href="/purchases"
              :aria-current="isRouteActive('/purchases') ? 'page' : undefined"
              class="rounded-xl px-3 py-2 gap-1.5 transition-all"
              :class="isRouteActive('/purchases') ? 'bg-primary/15 text-primary font-bold shadow-2xs' : 'hover:bg-base-200/80'"
            >
              <Icon icon="solar:cart-large-2-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
              <span>Purchases</span>
            </a>
          </li>

          <!-- 3. Master Inventory -->
          <li>
            <a
              href="/inventory"
              :aria-current="isRouteActive('/inventory') ? 'page' : undefined"
              class="rounded-xl px-3 py-2 gap-1.5 transition-all"
              :class="isRouteActive('/inventory') ? 'bg-primary/15 text-primary font-bold shadow-2xs' : 'hover:bg-base-200/80'"
            >
              <Icon icon="solar:box-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
              <span>Inventory</span>
            </a>
          </li>

          <!-- 4. Locations & Booth Sync Dropdown -->
          <li class="dropdown dropdown-hover dropdown-bottom">
            <div
              tabindex="0"
              role="button"
              class="rounded-xl px-3 py-2 gap-1.5 flex items-center transition-all"
              :class="isRouteActive('/warehouse') ? 'bg-primary/15 text-primary font-bold shadow-2xs' : 'hover:bg-base-200/80'"
            >
              <Icon icon="solar:shop-2-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
              <span>Locations</span>
              <Icon icon="solar:alt-arrow-down-linear" class="w-3.5 h-3.5 opacity-60 shrink-0" />
            </div>
            <ul
              tabindex="0"
              class="dropdown-content z-50 menu p-2 shadow-xl bg-base-100 border border-base-200 rounded-2xl w-max min-w-[290px] max-w-md space-y-1 pt-2"
            >
              <li class="menu-title px-3 py-1 text-[10px] uppercase tracking-wider font-extrabold opacity-60">
                Hubs &amp; Reconciliation
              </li>
              <li>
                <a
                  href="/warehouse"
                  class="rounded-xl py-2 px-3 flex items-center justify-between gap-3"
                  :class="currentPath === '/warehouse' ? 'bg-primary/15 text-primary font-bold' : ''"
                >
                  <span class="flex items-center gap-2.5 min-w-0">
                    <Icon icon="solar:buildings-2-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
                    <span class="truncate font-semibold">All Locations Hub</span>
                  </span>
                  <span class="badge badge-ghost badge-xs font-mono whitespace-nowrap shrink-0">Overview</span>
                </a>
              </li>
              <li>
                <a
                  :href="'/warehouse/sync/' + defaultSyncLocationCode"
                  class="rounded-xl py-2 px-3 flex items-center justify-between gap-3"
                  :class="isRouteActive('/warehouse/sync') ? 'bg-secondary/15 text-secondary font-bold' : ''"
                >
                  <span class="flex items-center gap-2.5 min-w-0">
                    <Icon icon="solar:round-transfer-horizontal-bold-duotone" class="w-4 h-4 text-secondary shrink-0" />
                    <span class="truncate font-semibold">Location POS &amp; CSV Sync</span>
                  </span>
                  <span class="badge badge-secondary badge-xs text-secondary-content font-bold whitespace-nowrap shrink-0">2-Way</span>
                </a>
              </li>

              <div class="divider my-0.5"></div>
              <li class="menu-title px-3 py-1 text-[10px] uppercase tracking-wider font-extrabold opacity-60">
                Booths &amp; Warehouses
              </li>

              <li v-for="loc in locationMetas" :key="loc.code">
                <div class="flex items-center justify-between gap-1.5 rounded-xl p-1 hover:bg-base-200/60">
                  <a
                    :href="'/warehouse/' + loc.code"
                    class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg flex-1 min-w-0 hover:bg-base-200"
                    :class="currentPath === '/warehouse/' + loc.code ? 'bg-primary/15 text-primary font-bold' : ''"
                  >
                    <span class="text-base leading-none shrink-0">{{ loc.icon }}</span>
                    <span class="flex flex-col min-w-0">
                      <span class="text-xs font-bold truncate">{{ loc.displayName }}</span>
                      <span class="text-[10px] opacity-60 truncate">{{ loc.type }}</span>
                    </span>
                  </a>
                  <a
                    :href="'/warehouse/sync/' + loc.code"
                    class="btn btn-ghost btn-xs rounded-lg gap-1 font-bold text-primary hover:bg-primary/10 shrink-0"
                    :title="'Open ' + loc.shortName + ' Sync'"
                  >
                    <Icon icon="solar:refresh-circle-bold" class="w-3.5 h-3.5" />
                    <span>Sync</span>
                  </a>
                </div>
              </li>
            </ul>
          </li>

          <!-- 5. Finance & Co-op Ledger Dropdown -->
          <li class="dropdown dropdown-hover dropdown-bottom">
            <div
              tabindex="0"
              role="button"
              class="rounded-xl px-3 py-2 gap-1.5 flex items-center transition-all"
              :class="isFinanceRouteActive ? 'bg-primary/15 text-primary font-bold shadow-2xs' : 'hover:bg-base-200/80'"
            >
              <Icon icon="solar:tag-price-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
              <span>Finance</span>
              <Icon icon="solar:alt-arrow-down-linear" class="w-3.5 h-3.5 opacity-60 shrink-0" />
            </div>
            <ul
              tabindex="0"
              class="dropdown-content z-50 menu p-2 shadow-xl bg-base-100 border border-base-200 rounded-2xl w-max min-w-[260px] max-w-sm space-y-1 pt-2"
            >
              <li class="menu-title px-3 py-1 text-[10px] uppercase tracking-wider font-extrabold opacity-60">
                Revenue, Tax &amp; Co-op
              </li>
              <li>
                <a
                  href="/sales"
                  class="rounded-xl py-2 px-3 gap-2.5"
                  :class="isRouteActive('/sales') ? 'bg-primary/15 text-primary font-bold' : ''"
                >
                  <Icon icon="solar:dollar-minimalistic-bold-duotone" class="w-4 h-4 text-success shrink-0" />
                  <div class="flex flex-col min-w-0">
                    <span class="font-bold text-xs">Sales &amp; Payout Ledger</span>
                    <span class="text-[10px] opacity-60">Settlements &amp; 70/30 Waterfall</span>
                  </div>
                </a>
              </li>
              <li>
                <a
                  href="/expenses"
                  class="rounded-xl py-2 px-3 gap-2.5"
                  :class="isRouteActive('/expenses') ? 'bg-primary/15 text-primary font-bold' : ''"
                >
                  <Icon icon="solar:bill-list-bold-duotone" class="w-4 h-4 text-warning shrink-0" />
                  <div class="flex flex-col min-w-0">
                    <span class="font-bold text-xs">Expenses &amp; Receipts</span>
                    <span class="text-[10px] opacity-60">Schedule C / Form 1065 Write-Offs</span>
                  </div>
                </a>
              </li>
              <li>
                <a
                  href="/coop"
                  class="rounded-xl py-2 px-3 gap-2.5"
                  :class="isRouteActive('/coop') ? 'bg-primary/15 text-primary font-bold' : ''"
                >
                  <Icon icon="solar:shield-star-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
                  <div class="flex flex-col min-w-0">
                    <span class="font-bold text-xs">Co-op Charter &amp; Rules</span>
                    <span class="text-[10px] opacity-60">Commons Pool &amp; Consignor Terms</span>
                  </div>
                </a>
              </li>
            </ul>
          </li>

          <!-- 6. Studios & Hardware Dropdown -->
          <li class="dropdown dropdown-hover dropdown-bottom">
            <div
              tabindex="0"
              role="button"
              class="rounded-xl px-3 py-2 gap-1.5 flex items-center transition-all"
              :class="isStudiosRouteActive ? 'bg-primary/15 text-primary font-bold shadow-2xs' : 'hover:bg-base-200/80'"
            >
              <Icon icon="solar:magic-stick-3-bold-duotone" class="w-4 h-4 text-secondary shrink-0" />
              <span>Studios</span>
              <Icon icon="solar:alt-arrow-down-linear" class="w-3.5 h-3.5 opacity-60 shrink-0" />
            </div>
            <ul
              tabindex="0"
              class="dropdown-content z-50 menu p-2 shadow-xl bg-base-100 border border-base-200 rounded-2xl w-max min-w-[260px] max-w-sm space-y-1 pt-2"
            >
              <li class="menu-title px-3 py-1 text-[10px] uppercase tracking-wider font-extrabold opacity-60">
                Marketing &amp; Thermal Tagging
              </li>
              <li>
                <a
                  href="/social"
                  class="rounded-xl py-2 px-3 gap-2.5"
                  :class="isRouteActive('/social') ? 'bg-secondary/15 text-secondary font-bold' : ''"
                >
                  <Icon icon="solar:broadcast-bold-duotone" class="w-4 h-4 text-secondary shrink-0" />
                  <div class="flex flex-col min-w-0">
                    <span class="font-bold text-xs">Social Dropcast Studio</span>
                    <span class="text-[10px] opacity-60">Booth Drops &amp; Social Reels</span>
                  </div>
                </a>
              </li>
              <li>
                <a
                  href="/labels/studio"
                  class="rounded-xl py-2 px-3 gap-2.5"
                  :class="isRouteActive('/labels/studio') ? 'bg-primary/15 text-primary font-bold' : ''"
                >
                  <Icon icon="solar:printer-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
                  <div class="flex flex-col min-w-0">
                    <span class="font-bold text-xs">Thermal Label Studio</span>
                    <span class="text-[10px] opacity-60">Rollo Barcodes &amp; Booth Tags</span>
                  </div>
                </a>
              </li>
              <li>
                <a
                  href="/labels/test"
                  class="rounded-xl py-2 px-3 gap-2.5"
                  :class="isRouteActive('/labels/test') ? 'bg-primary/15 text-primary font-bold' : ''"
                >
                  <Icon icon="solar:ruler-pen-bold-duotone" class="w-4 h-4 text-accent shrink-0" />
                  <div class="flex flex-col min-w-0">
                    <span class="font-bold text-xs">Hardware Calibration</span>
                    <span class="text-[10px] opacity-60">Test Feed &amp; Label Dimensions</span>
                  </div>
                </a>
              </li>
            </ul>
          </li>
        </ul>
      </div>

      <!-- Right Cluster: Speed Scout + Workspace Switcher + User Avatar + Mobile Trigger -->
      <div class="navbar-end flex-1 lg:flex-initial lg:w-1/4 flex items-center justify-end gap-1.5 sm:gap-2">
        <!-- Speed Scout Quick Action Pill (Always Accessible) -->
        <div class="indicator flex items-center">
          <span
            v-if="displayTrackedCount > 0"
            class="indicator-item badge badge-primary badge-xs sm:badge-sm text-primary-content font-black z-10 whitespace-nowrap shrink-0"
          >
            {{ displayTrackedCount }}
          </span>
          <a
            href="/scout?quick=true"
            @click="handleScoutClick"
            class="btn btn-sm rounded-xl gap-1.5 font-bold px-2.5 sm:px-3 transition-all"
            :class="
              isRouteActive('/scout')
                ? 'btn-primary text-primary-content shadow-sm'
                : 'btn-ghost border border-base-300 bg-base-200/60 hover:bg-base-200'
            "
            title="Quick Scout & Camera OCR"
            aria-label="Quick Scout"
          >
            <Icon icon="solar:scanner-bold" class="w-4 h-4" :class="isRouteActive('/scout') ? '' : 'text-primary'" />
            <span class="hidden sm:inline text-xs">Quick Scout</span>
          </a>
        </div>

        <!-- Desktop Auth / Workspace Controls -->
        <div v-if="loading" class="hidden lg:inline-flex items-center">
          <span class="loading loading-spinner loading-sm text-primary mx-2"></span>
        </div>

        <div v-else class="hidden lg:inline-flex items-center gap-2">
          <a v-if="!isAuthenticated" href="/login" class="btn btn-primary btn-sm text-primary-content font-bold rounded-xl">
            Login
          </a>

          <template v-else>
            <!-- Dedicated Workspace / Organization Switcher (Separated from Page Nav) -->
            <div class="dropdown dropdown-end">
              <div
                tabindex="0"
                role="button"
                class="btn btn-outline btn-sm rounded-xl gap-1.5 border-base-300 hover:border-primary px-2.5"
                title="Switch Organization Workspace"
              >
                <Icon icon="solar:users-group-two-rounded-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
                <span class="max-w-32 truncate text-xs font-bold">
                  {{ currentTeam ? currentTeam.name : 'Personal' }}
                </span>
                <Icon icon="solar:alt-arrow-down-linear" class="w-3.5 h-3.5 opacity-60 shrink-0" />
              </div>
              <ul
                tabindex="0"
                class="dropdown-content z-50 menu p-2 shadow-xl bg-base-100 border border-base-200 rounded-2xl w-max min-w-[250px] max-w-[calc(100vw-2rem)] space-y-1 mt-2"
              >
                <li class="menu-title px-3 py-1 text-[10px] uppercase tracking-wider font-extrabold opacity-60">
                  Switch Workspace
                </li>
                <li>
                  <a
                    @click="handleSwitchTeam(null)"
                    class="rounded-xl py-2 px-3 flex items-center justify-between gap-2"
                    :class="{ 'bg-primary/15 text-primary font-bold': !currentTeam }"
                  >
                    <span class="flex items-center gap-2 min-w-0">
                      <Icon icon="solar:user-rounded-bold-duotone" class="w-4 h-4 shrink-0" />
                      <span class="truncate text-xs">Personal Inventory</span>
                    </span>
                    <Icon v-if="!currentTeam" icon="solar:check-circle-bold" class="w-4 h-4 text-primary shrink-0" />
                  </a>
                </li>
                <li v-for="team in teams" :key="team.$id">
                  <a
                    @click="handleSwitchTeam(team)"
                    class="rounded-xl py-2 px-3 flex items-center justify-between gap-2"
                    :class="{ 'bg-primary/15 text-primary font-bold': currentTeam && currentTeam.$id === team.$id }"
                  >
                    <span class="flex items-center gap-2 min-w-0">
                      <Icon icon="solar:users-group-two-rounded-bold-duotone" class="w-4 h-4 shrink-0" />
                      <span class="truncate text-xs">{{ team.name }}</span>
                    </span>
                    <Icon
                      v-if="currentTeam && currentTeam.$id === team.$id"
                      icon="solar:check-circle-bold"
                      class="w-4 h-4 text-primary shrink-0"
                    />
                  </a>
                </li>

                <div class="divider my-0.5"></div>
                <li class="menu-title px-3 py-1 text-[10px] uppercase tracking-wider font-extrabold opacity-60">
                  Organization Admin
                </li>
                <li>
                  <a href="/settings" class="rounded-xl py-2 px-3 gap-2 text-xs font-semibold">
                    <Icon icon="solar:settings-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
                    <span>Organization &amp; Location Settings</span>
                  </a>
                </li>
                <li v-if="!ownedTeam">
                  <a @click="showCreateModal = true" class="rounded-xl py-2 px-3 gap-2 text-xs font-semibold text-primary">
                    <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
                    <span>Create Organization</span>
                  </a>
                </li>
                <li v-if="currentTeam && ownedTeam && currentTeam.$id === ownedTeam.$id">
                  <a @click="showInviteModal = true" class="rounded-xl py-2 px-3 gap-2 text-xs font-semibold text-secondary">
                    <Icon icon="solar:user-plus-bold" class="w-4 h-4 shrink-0" />
                    <span>Invite Co-op Member</span>
                  </a>
                </li>
              </ul>
            </div>

            <!-- User Profile & Theme Dropdown -->
            <div class="dropdown dropdown-end">
              <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar placeholder cursor-pointer">
                <div class="bg-neutral text-neutral-content rounded-full w-9 ring-1 ring-base-300">
                  <span class="text-xs font-bold">{{ userInitial }}</span>
                </div>
              </div>
              <ul
                tabindex="0"
                class="mt-2 z-50 p-2 shadow-xl menu menu-sm dropdown-content bg-base-100 border border-base-200 rounded-2xl w-max min-w-[240px] max-w-[calc(100vw-2rem)] space-y-1"
              >
                <li class="px-3 py-2 border-b border-base-200 pointer-events-none">
                  <div class="flex flex-col items-start gap-0.5 min-w-0">
                    <div class="flex items-center gap-2 w-full">
                      <p class="font-bold text-sm truncate text-base-content">{{ user?.name || 'User' }}</p>
                      <span
                        v-if="isPartner"
                        class="badge badge-secondary badge-xs text-secondary-content font-bold whitespace-nowrap shrink-0"
                      >
                        Partner
                      </span>
                    </div>
                    <p class="text-xs opacity-60 truncate text-base-content w-full">{{ user?.email }}</p>
                  </div>
                </li>

                <li>
                  <a href="/profile" class="rounded-xl py-2 px-3 gap-2">
                    <Icon icon="solar:user-id-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
                    <span>Profile Settings</span>
                  </a>
                </li>
                <li>
                  <a href="/settings" class="rounded-xl py-2 px-3 gap-2">
                    <Icon icon="solar:settings-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
                    <span>Workspace Settings</span>
                  </a>
                </li>

                <div class="divider my-0.5"></div>

                <li class="flex flex-row justify-between items-center px-3 py-1.5 hover:bg-transparent">
                  <span class="text-xs font-semibold opacity-70">Theme</span>
                  <ThemeSwitcher />
                </li>

                <div class="divider my-0.5"></div>

                <li>
                  <a @click="logout" class="rounded-xl py-2 px-3 gap-2 text-error font-semibold">
                    <Icon icon="solar:logout-2-bold-duotone" class="w-4 h-4 text-error shrink-0" />
                    <span>Logout</span>
                  </a>
                </li>
              </ul>
            </div>
          </template>
        </div>

        <!-- Mobile Menu Button (< 1024px) -->
        <button
          @click="openMobile = !openMobile"
          class="btn btn-square btn-ghost btn-sm sm:btn-md lg:hidden rounded-xl"
          aria-label="Open navigation menu"
        >
          <Icon icon="solar:hamburger-menu-bold" class="w-6 h-6" />
        </button>
      </div>

      <!-- Mobile Menu Backdrop -->
      <Teleport to="body">
        <Transition name="fade">
          <div
            v-if="openMobile"
            class="fixed inset-0 bg-black/55 backdrop-blur-xs z-100 lg:hidden"
            @click="openMobile = false"
          ></div>
        </Transition>

        <!-- Mobile Menu Slide-Over Drawer -->
        <Transition name="slide">
          <aside
            v-if="openMobile"
            class="fixed top-0 right-0 h-full w-[88%] max-w-[360px] bg-base-100 border-l border-base-300 shadow-2xl z-101 flex flex-col justify-between overflow-y-auto lg:hidden pb-[env(safe-area-inset-bottom,0px)]"
            aria-label="Mobile Navigation Drawer"
          >
            <!-- Drawer Top Header -->
            <div class="px-5 py-4 flex justify-between items-center border-b border-base-200 sticky top-0 bg-base-100/95 backdrop-blur-md z-10">
              <div class="flex items-center gap-2 min-w-0">
                <Icon icon="solar:compass-big-bold-duotone" class="w-6 h-6 text-primary shrink-0" />
                <span class="text-lg font-black text-primary truncate">Resale Command</span>
                <span
                  v-if="alphaMode"
                  class="badge badge-warning badge-xs font-bold uppercase whitespace-nowrap shrink-0"
                >
                  Alpha
                </span>
              </div>
              <button
                @click="openMobile = false"
                class="btn btn-ghost btn-circle btn-sm"
                aria-label="Close navigation menu"
              >
                <Icon icon="solar:close-circle-bold" class="w-6 h-6" />
              </button>
            </div>

            <!-- Drawer Scrollable Body -->
            <div class="flex-1 p-4 space-y-5">
              <!-- Active Workspace Selector -->
              <div v-if="isAuthenticated" class="bg-base-200/60 border border-base-300/70 rounded-2xl p-3 space-y-2.5">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] uppercase font-extrabold opacity-60 tracking-wider">Active Workspace</span>
                  <a
                    href="/settings"
                    class="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                    @click="openMobile = false"
                  >
                    <Icon icon="solar:settings-bold" class="w-3.5 h-3.5" />
                    <span>Settings</span>
                  </a>
                </div>
                <select
                  class="select select-bordered select-sm w-full font-bold rounded-xl"
                  @change="handleMobileSwitchTeam"
                >
                  <option :selected="!currentTeam" value="personal">Personal Inventory</option>
                  <option
                    v-for="team in teams"
                    :key="team.$id"
                    :value="team.$id"
                    :selected="currentTeam && currentTeam.$id === team.$id"
                  >
                    {{ team.name }}
                  </option>
                </select>
                <div class="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    v-if="!ownedTeam"
                    class="btn btn-xs btn-outline btn-primary flex-1 rounded-lg"
                    @click="showCreateModal = true; openMobile = false"
                  >
                    + Create Org
                  </button>
                  <button
                    v-if="currentTeam && ownedTeam && currentTeam.$id === ownedTeam.$id"
                    class="btn btn-xs btn-outline btn-secondary flex-1 rounded-lg"
                    @click="showInviteModal = true; openMobile = false"
                  >
                    + Invite Member
                  </button>
                </div>
              </div>

              <!-- Quick Action Pair: Quick Scout & Dropcast -->
              <div class="grid grid-cols-2 gap-2">
                <a
                  href="/scout?quick=true"
                  @click="openMobile = false"
                  class="btn btn-primary btn-sm h-11 rounded-xl text-primary-content font-black gap-1.5 justify-center shadow-xs"
                >
                  <Icon icon="solar:scanner-bold" class="w-4 h-4 shrink-0" />
                  <span class="truncate">Quick Scout</span>
                  <span
                    v-if="displayTrackedCount > 0"
                    class="badge badge-xs bg-primary-content text-primary font-black whitespace-nowrap shrink-0"
                  >
                    {{ displayTrackedCount }}
                  </span>
                </a>
                <a
                  href="/social"
                  @click="openMobile = false"
                  class="btn btn-secondary btn-sm h-11 rounded-xl text-secondary-content font-black gap-1.5 justify-center shadow-xs"
                >
                  <Icon icon="solar:broadcast-bold" class="w-4 h-4 shrink-0" />
                  <span class="truncate">Dropcasts</span>
                </a>
              </div>

              <template v-if="isAuthenticated">
                <!-- Section 1: Core Operations Lifecycle -->
                <div class="space-y-1">
                  <span class="text-[10px] uppercase font-extrabold opacity-50 tracking-wider px-2">
                    Core Operations
                  </span>
                  <a
                    v-for="item in mobileCoreLinks"
                    :key="item.url"
                    :href="item.url"
                    @click="openMobile = false"
                    class="flex items-center justify-between gap-3 px-3 py-2.5 min-h-11 rounded-xl text-sm transition-all"
                    :class="
                      item.active
                        ? 'bg-primary/15 text-primary font-bold border-l-4 border-primary'
                        : 'hover:bg-base-200 font-semibold'
                    "
                  >
                    <span class="flex items-center gap-3 min-w-0">
                      <Icon :icon="item.icon" class="w-5 h-5 text-primary shrink-0" />
                      <span class="truncate">{{ item.label }}</span>
                    </span>
                    <span
                      v-if="item.badge"
                      class="badge badge-xs font-bold whitespace-nowrap shrink-0"
                      :class="item.badgeClass || 'badge-ghost'"
                    >
                      {{ item.badge }}
                    </span>
                  </a>
                </div>

                <!-- Section 2: 4 Canonical Locations Quick Grid (Dynamic from warehouses.ts) -->
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between px-2">
                    <span class="text-[10px] uppercase font-extrabold opacity-50 tracking-wider">
                      Locations &amp; Booth Sync
                    </span>
                    <a
                      :href="'/warehouse/sync/' + defaultSyncLocationCode"
                      @click="openMobile = false"
                      class="text-[11px] font-bold text-secondary hover:underline flex items-center gap-1"
                    >
                      <Icon icon="solar:round-transfer-horizontal-bold" class="w-3.5 h-3.5" />
                      <span>Sync Hub</span>
                    </a>
                  </div>
                  <div class="grid grid-cols-2 gap-1.5">
                    <div
                      v-for="loc in locationMetas"
                      :key="loc.code"
                      class="flex items-center justify-between bg-base-200/50 border border-base-300/60 rounded-xl p-1.5"
                    >
                      <a
                        :href="'/warehouse/' + loc.code"
                        @click="openMobile = false"
                        class="flex items-center gap-1.5 min-w-0 flex-1 px-1 py-1 rounded-lg hover:bg-base-200"
                      >
                        <span class="text-sm shrink-0">{{ loc.icon }}</span>
                        <span class="text-xs font-bold truncate">{{ loc.shortName }}</span>
                      </a>
                      <a
                        :href="'/warehouse/sync/' + loc.code"
                        @click="openMobile = false"
                        class="btn btn-ghost btn-xs btn-square rounded-lg text-primary shrink-0"
                        :title="'Sync ' + loc.shortName"
                      >
                        <Icon icon="solar:refresh-circle-bold" class="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>

                <!-- Section 3: Finance, Tax & Co-op Ledger -->
                <div class="space-y-1">
                  <span class="text-[10px] uppercase font-extrabold opacity-50 tracking-wider px-2">
                    Finance &amp; Co-op Ledger
                  </span>
                  <a
                    v-for="item in mobileFinanceLinks"
                    :key="item.url"
                    :href="item.url"
                    @click="openMobile = false"
                    class="flex items-center justify-between gap-3 px-3 py-2.5 min-h-11 rounded-xl text-sm transition-all"
                    :class="
                      item.active
                        ? 'bg-primary/15 text-primary font-bold border-l-4 border-primary'
                        : 'hover:bg-base-200 font-semibold'
                    "
                  >
                    <span class="flex items-center gap-3 min-w-0">
                      <Icon :icon="item.icon" class="w-5 h-5 shrink-0" :class="item.iconColor || 'text-primary'" />
                      <span class="truncate">{{ item.label }}</span>
                    </span>
                  </a>
                </div>

                <!-- Section 4: Studios & Hardware -->
                <div class="space-y-1">
                  <span class="text-[10px] uppercase font-extrabold opacity-50 tracking-wider px-2">
                    Studios &amp; Tagging
                  </span>
                  <a
                    v-for="item in mobileStudioLinks"
                    :key="item.url"
                    :href="item.url"
                    @click="openMobile = false"
                    class="flex items-center justify-between gap-3 px-3 py-2.5 min-h-11 rounded-xl text-sm transition-all"
                    :class="
                      item.active
                        ? 'bg-primary/15 text-primary font-bold border-l-4 border-primary'
                        : 'hover:bg-base-200 font-semibold'
                    "
                  >
                    <span class="flex items-center gap-3 min-w-0">
                      <Icon :icon="item.icon" class="w-5 h-5 shrink-0" :class="item.iconColor || 'text-primary'" />
                      <span class="truncate">{{ item.label }}</span>
                    </span>
                  </a>
                </div>
              </template>
            </div>

            <!-- Drawer Footer (User Profile & Theme Switcher) -->
            <div class="p-4 bg-base-200/80 border-t border-base-300 space-y-3">
              <div v-if="isAuthenticated" class="flex items-center gap-3">
                <div class="avatar placeholder">
                  <div class="bg-neutral text-neutral-content rounded-full w-10">
                    <span class="text-xs font-bold">{{ userInitial }}</span>
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-bold truncate text-base-content">{{ user?.name || 'User' }}</p>
                  <p class="text-xs opacity-60 truncate text-base-content">{{ user?.email }}</p>
                </div>
                <span
                  v-if="isPartner"
                  class="badge badge-secondary badge-sm text-secondary-content font-bold whitespace-nowrap shrink-0"
                >
                  Partner
                </span>
              </div>

              <div class="flex items-center justify-between border-t border-base-300/60 pt-2.5">
                <span class="text-xs font-bold opacity-70">Theme</span>
                <ThemeSwitcher />
              </div>

              <div class="grid grid-cols-2 gap-2 pt-1">
                <a
                  v-if="!isAuthenticated"
                  href="/login"
                  class="btn btn-primary btn-sm col-span-2 text-primary-content font-bold rounded-xl"
                  @click="openMobile = false"
                >
                  Login
                </a>
                <template v-else>
                  <a
                    href="/profile"
                    class="btn btn-outline btn-sm rounded-xl font-semibold"
                    @click="openMobile = false"
                  >
                    Profile
                  </a>
                  <button
                    @click="logout(); openMobile = false"
                    class="btn btn-error btn-sm rounded-xl text-error-content font-bold"
                  >
                    Logout
                  </button>
                </template>
              </div>

              <div class="text-center text-[10px] opacity-40 pt-0.5">
                Copyright © {{ new Date().getFullYear() }} Huckleberry Collective LLC
              </div>
            </div>
          </aside>
        </Transition>
      </Teleport>

      <!-- Modals -->
      <dialog class="modal" :class="{ 'modal-open': showCreateModal }">
        <div class="modal-box rounded-2xl">
          <h3 class="font-bold text-lg">Create New Organization</h3>
          <p class="py-2 text-sm opacity-75">Create a shared co-op workspace.</p>
          <div class="py-4">
            <input
              type="text"
              placeholder="Organization Name"
              class="input input-bordered w-full"
              v-model="newTeamName"
              @keydown.enter.prevent="handleCreateTeam"
            />
          </div>
          <div class="modal-action">
            <button class="btn" @click="showCreateModal = false">Cancel</button>
            <button
              class="btn btn-primary text-primary-content font-bold"
              @click="handleCreateTeam"
              :disabled="!newTeamName"
            >
              Create
            </button>
          </div>
        </div>
      </dialog>

      <dialog class="modal" :class="{ 'modal-open': showInviteModal }">
        <div class="modal-box rounded-2xl">
          <h3 class="font-bold text-lg">Invite New Member</h3>
          <p class="py-2 text-sm opacity-75">Send an invitation email to join your organization.</p>
          <div class="py-4">
            <input
              type="email"
              placeholder="Email Address"
              class="input input-bordered w-full"
              v-model="inviteEmail"
              @keydown.enter.prevent="handleInvite"
            />
          </div>
          <div class="modal-action">
            <button class="btn" @click="showInviteModal = false">Cancel</button>
            <button
              class="btn btn-primary text-primary-content font-bold"
              @click="handleInvite"
              :disabled="!inviteEmail"
            >
              Send Invite
            </button>
          </div>
        </div>
      </dialog>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from '@nanostores/vue';
import { isAlphaMode } from '../../stores/env';
import { useAuth } from '../../composables/useAuth';
import { addToast } from '../../stores/toast';
import ThemeSwitcher from '../ui/ThemeSwitcher.vue';
import { useCart } from '../../composables/useCart';
import { useScoutPurchase } from '../../composables/useScoutPurchase';
import { getAllLocationSettingMetas, resolveDefaultRicochetLocationMeta } from '../../lib/warehouses';
import { Icon } from '@iconify/vue';

const {
  user,
  isAuthenticated,
  currentTeam,
  teams,
  ownedTeam,
  isPartner,
  loading,
  switchTeam,
  createTeam,
  inviteMember,
  logout: authLogout,
} = useAuth();

const { cartItems } = useCart();
const { purchaseItems, activePurchase, pausedTracker, draftPurchases, loadDraftPurchases, toggleTray } =
  useScoutPurchase();

const currentPath = ref('/');

const locationMetas = computed(() => getAllLocationSettingMetas());
const defaultSyncLocationCode = computed(() => resolveDefaultRicochetLocationMeta().code);

const isRouteActive = (prefix: string): boolean => {
  if (!currentPath.value) return false;
  if (prefix === '/warehouse' && currentPath.value.startsWith('/warehouse')) return true;
  return currentPath.value === prefix || currentPath.value.startsWith(prefix + '/');
};

const isFinanceRouteActive = computed(() =>
  ['/sales', '/expenses', '/coop'].some((p) => isRouteActive(p))
);

const isStudiosRouteActive = computed(() =>
  ['/social', '/labels'].some((p) => isRouteActive(p))
);

const mobileCoreLinks = computed(() => [
  {
    label: 'Command Center',
    url: '/dashboard',
    icon: 'solar:widget-bold-duotone',
    active: isRouteActive('/dashboard'),
  },
  {
    label: 'Purchases & Hauls',
    url: '/purchases',
    icon: 'solar:cart-large-2-bold-duotone',
    active: isRouteActive('/purchases'),
  },
  {
    label: 'Master Inventory',
    url: '/inventory',
    icon: 'solar:box-bold-duotone',
    active: isRouteActive('/inventory'),
  },
  {
    label: 'Locations Hub',
    url: '/warehouse',
    icon: 'solar:shop-2-bold-duotone',
    active: currentPath.value === '/warehouse',
    badge: `${locationMetas.value.length} Locations`,
    badgeClass: 'badge-ghost',
  },
]);

const mobileFinanceLinks = computed(() => [
  {
    label: 'Sales & Payout Ledger',
    url: '/sales',
    icon: 'solar:dollar-minimalistic-bold-duotone',
    iconColor: 'text-success',
    active: isRouteActive('/sales'),
  },
  {
    label: 'Expenses & Receipts',
    url: '/expenses',
    icon: 'solar:bill-list-bold-duotone',
    iconColor: 'text-warning',
    active: isRouteActive('/expenses'),
  },
  {
    label: 'Co-op Charter & Rules',
    url: '/coop',
    icon: 'solar:shield-star-bold-duotone',
    iconColor: 'text-primary',
    active: isRouteActive('/coop'),
  },
]);

const mobileStudioLinks = computed(() => [
  {
    label: 'Social Dropcast Studio',
    url: '/social',
    icon: 'solar:broadcast-bold-duotone',
    iconColor: 'text-secondary',
    active: isRouteActive('/social'),
  },
  {
    label: 'Thermal Label Studio',
    url: '/labels/studio',
    icon: 'solar:printer-bold-duotone',
    iconColor: 'text-primary',
    active: isRouteActive('/labels/studio'),
  },
  {
    label: 'Rollo Calibration Test',
    url: '/labels/test',
    icon: 'solar:ruler-pen-bold-duotone',
    iconColor: 'text-accent',
    active: isRouteActive('/labels/test'),
  },
]);

const displayTrackedCount = computed(() => {
  return (
    purchaseItems.value.length ||
    activePurchase.value?.itemCount ||
    pausedTracker.value?.itemCount ||
    draftPurchases.value[0]?.itemCount ||
    cartItems.value.length
  );
});

onMounted(() => {
  if (typeof window !== 'undefined') {
    currentPath.value = window.location.pathname;
  }
  if (isAuthenticated.value) {
    loadDraftPurchases().catch((err) => console.warn('[Navbar] Failed to load draft purchases:', err));
  }
});

watch(
  isAuthenticated,
  (authed) => {
    if (authed) {
      loadDraftPurchases().catch((err) => console.warn('[Navbar] Failed to load draft purchases:', err));
    }
  },
  { immediate: true }
);

watch(currentTeam, () => {
  if (isAuthenticated.value) {
    loadDraftPurchases().catch((err) => console.warn('[Navbar] Failed to load draft purchases on team switch:', err));
  }
});

const handleScoutClick = (e: MouseEvent) => {
  if (typeof window !== 'undefined' && window.location.pathname === '/scout' && (activePurchase.value || pausedTracker.value)) {
    e.preventDefault();
    toggleTray();
  }
};

const alphaMode = useStore(isAlphaMode);

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
  await switchTeam(team);
};

const handleMobileSwitchTeam = async (event: Event) => {
  const select = event.target as HTMLSelectElement;
  if (select.value === 'personal') {
    await switchTeam(null);
  } else {
    const team = teams.value.find((t) => t.$id === select.value);
    if (team) {
      await switchTeam(team);
    }
  }
};

const handleCreateTeam = async () => {
  if (!newTeamName.value) return;
  try {
    await createTeam(newTeamName.value);
    showCreateModal.value = false;
    newTeamName.value = '';
  } catch (e: any) {
    addToast({ type: 'error', message: e.message });
  }
};

const handleInvite = async () => {
  if (!inviteEmail.value || !currentTeam.value) return;
  try {
    await inviteMember(currentTeam.value.$id, inviteEmail.value);
    showInviteModal.value = false;
    inviteEmail.value = '';
    addToast({ type: 'success', message: 'Invitation sent!' });
  } catch (e: any) {
    if (e.message.includes('unique') || e.code === 409) {
      addToast({ type: 'warning', message: 'This user is already a member or has a pending invitation.' });
    } else {
      addToast({ type: 'error', message: e.message });
    }
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
