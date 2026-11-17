<template>
  <nav class="navbar max-w-screen-2xl mx-auto px-2 sm:px-4 lg:px-6 border-b border-base-200/60 flex items-center justify-between gap-2 overflow-visible">
    <!-- Brand / Left (Krug #5 Street Sign #1) -->
    <div class="flex items-center gap-1.5 shrink-0">
      <a :href="showMemberNav ? '/dashboard' : '/'" class="btn btn-ghost px-2 sm:px-2.5 text-lg sm:text-xl font-black tracking-tight text-primary gap-1.5 whitespace-nowrap">
        <Icon icon="solar:compass-big-bold-duotone" class="w-6 h-6 shrink-0" />
        <span class="truncate">{{ siteConfig.shortTitle }}</span>
        <span class="badge badge-primary badge-outline badge-xs sm:badge-sm font-mono font-black tracking-normal whitespace-nowrap shrink-0">{{ siteConfig.badgeText }}</span>
      </a>
      <span
        v-if="alphaMode"
        class="badge badge-warning text-warning-content badge-xs sm:badge-sm font-black uppercase whitespace-nowrap shrink-0 shadow-xs border border-warning"
      >
        Alpha
      </span>
    </div>

    <!-- Desktop Center (Guests): public pages only -->
    <div v-if="!showMemberNav && !loading" class="hidden lg:flex items-center justify-center gap-1 flex-1 min-w-0">
      <a href="/coop" class="btn btn-sm btn-ghost rounded-xl px-3 gap-1.5 font-semibold whitespace-nowrap">
        <Icon icon="solar:shield-star-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
        <span>Collective Charter</span>
      </a>
      <a href="/demo" class="btn btn-sm btn-ghost rounded-xl px-3 gap-1.5 font-semibold whitespace-nowrap">
        <Icon icon="solar:widget-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
        <span>Example Dashboard</span>
      </a>
    </div>

    <!-- Desktop Center: Strict 5-Pillar Reseller Lifecycle Navigation (Enforced by §17: <= 5 pillars, <= 7 items/dropdown) -->
    <div
      v-if="showMemberNav"
      data-rc-nav-center
      class="hidden lg:flex items-center justify-center gap-0.5 xl:gap-1 flex-1 min-w-0 overflow-visible"
    >
      <template v-for="pillar in resellerPillars" :key="pillar.id">
        <!-- Direct Link Pillar (Command, Purchases, Inventory) -->
        <a
          v-if="!pillar.children"
          :href="pillar.href"
          data-rc-nav-pillar
          :aria-current="isPillarActive(pillar) ? 'page' : undefined"
          class="btn btn-sm rounded-xl px-2.5 xl:px-3 gap-1.5 font-semibold border-0 shadow-none whitespace-nowrap shrink-0"
          :class="isPillarActive(pillar) ? 'bg-primary/15 text-primary font-bold' : 'btn-ghost hover:bg-base-200/80'"
        >
          <Icon :icon="pillar.icon" class="w-4 h-4 text-primary shrink-0" />
          <span>{{ pillar.label }}</span>
        </a>

        <!-- Bounded Dropdown Pillar (Booths & Channels <= 7, Sales & Co-op <= 6) -->
        <div v-else data-rc-nav-pillar class="dropdown dropdown-bottom shrink-0">
          <div
            tabindex="0"
            role="button"
            :aria-current="isPillarActive(pillar) ? 'page' : undefined"
            class="btn btn-sm rounded-xl px-2.5 xl:px-3 gap-1 font-semibold border-0 shadow-none whitespace-nowrap"
            :class="isPillarActive(pillar) ? 'bg-primary/15 text-primary font-bold' : 'btn-ghost hover:bg-base-200/80'"
          >
            <Icon :icon="pillar.icon" class="w-4 h-4 text-primary shrink-0" />
            <span>{{ pillar.label }}</span>
            <Icon icon="solar:alt-arrow-down-linear" class="w-3.5 h-3.5 opacity-60 shrink-0" />
          </div>
          <div
            tabindex="0"
            data-rc-nav-dropdown
            class="dropdown-content z-50 mt-2 p-2 shadow-xl bg-base-100 border border-base-200 rounded-2xl w-max min-w-[280px] max-w-[calc(100vw-2rem)] sm:max-w-md space-y-1"
          >
            <a
              v-for="item in pillar.children"
              :key="item.id"
              :href="item.href"
              data-rc-nav-dropdown-link
              class="flex items-center justify-between gap-3 rounded-xl py-2 px-3 hover:bg-base-200 transition-colors"
              :class="isLinkActive(item.href) ? 'bg-primary/15 text-primary font-bold' : ''"
            >
              <span class="flex items-center gap-2.5 min-w-0 flex-1">
                <span v-if="item.emoji" class="text-base leading-none shrink-0">{{ item.emoji }}</span>
                <Icon v-else :icon="item.icon" class="w-4 h-4 shrink-0" :class="item.iconColor || 'text-primary'" />
                <span class="flex flex-col min-w-0 flex-1">
                  <span class="font-bold text-xs truncate">{{ item.label }}</span>
                  <span class="text-[10px] opacity-65 truncate">{{ item.hint }}</span>
                </span>
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
        </div>
      </template>
    </div>

    <!-- Right Reseller Toolbelt (3 Clean Items: 🔭 Scout | 🧰 Studios | Unified [Workspace · Avatar] ▾) -->
    <div data-rc-toolbelt class="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
      <!-- Toolbelt #1: Scout + Trackers Pill -->
      <div class="inline-flex items-center rounded-xl border border-base-300 bg-base-200/60 p-0.5 gap-0.5 shrink-0">
        <a
          href="/scout?quick=true"
          @click="handleScoutClick"
          class="btn btn-xs sm:btn-sm rounded-lg gap-1.5 font-bold px-2.5 h-9 md:h-8 min-h-0 border-0 shadow-none whitespace-nowrap transition-all"
          :class="
            currentPath === '/scout'
              ? 'btn-primary text-primary-content shadow-xs'
              : 'btn-ghost hover:bg-base-100'
          "
          title="Quick Scout & Camera Appraisal (/scout)"
          aria-label="Quick Scout"
        >
          <Icon icon="solar:scanner-bold" class="w-3.5 h-3.5 shrink-0" :class="currentPath === '/scout' ? '' : 'text-primary'" />
          <span class="hidden sm:inline text-xs">Scout</span>
          <span
            v-if="!showMemberNav"
            class="badge badge-secondary badge-xs text-secondary-content font-black whitespace-nowrap shrink-0"
          >
            Preview
          </span>
        </a>

        <a
          v-if="capabilities.canUseBuyTracker && showMemberNav"
          href="/scout/trackers"
          class="btn btn-xs sm:btn-sm rounded-lg gap-1 font-bold px-2 h-9 md:h-8 min-h-0 border-0 shadow-none whitespace-nowrap transition-all"
          :class="
            currentPath.startsWith('/scout/tracker')
              ? 'btn-secondary text-secondary-content shadow-xs'
              : 'btn-ghost hover:bg-base-100'
          "
          title="Active Buy Trackers (/scout/trackers)"
          aria-label="Buy Trackers"
        >
          <span class="text-xs leading-none">📌</span>
          <span class="hidden xl:inline text-xs">Trackers</span>
          <span
            v-if="isAuthenticated && displayTrackedCount > 0"
            class="badge badge-xs font-mono font-black px-1.5 whitespace-nowrap shrink-0"
            :class="
              currentPath.startsWith('/scout/tracker')
                ? 'badge-neutral text-neutral-content'
                : 'badge-secondary text-secondary-content'
            "
          >
            {{ displayTrackedCount }}
          </span>
        </a>
      </div>

      <!-- Toolbelt #2: 🧰 Studios 1-Click Launcher (Label Studio, Appraisal Lab, Bookmarklets, Scanner & AI Vault) -->
      <a
        v-if="showMemberNav"
        href="/studios"
        :aria-current="isStudiosRouteActive ? 'page' : undefined"
        class="hidden md:inline-flex btn btn-sm h-8 rounded-xl px-2.5 gap-1.5 font-bold border border-base-300 whitespace-nowrap shrink-0"
        :class="
          isStudiosRouteActive
            ? 'btn-secondary text-secondary-content border-secondary shadow-xs'
            : 'btn-ghost bg-base-200/50 hover:bg-base-200'
        "
        title="Studios & Reseller Tools (/studios)"
      >
        <Icon icon="solar:magic-stick-3-bold-duotone" class="w-4 h-4 shrink-0" :class="isStudiosRouteActive ? '' : 'text-secondary'" />
        <span class="text-xs">Studios</span>
      </a>

      <!-- Toolbelt #3: Unified [Workspace · Avatar] ▾ Menu (Zero Duplicate Settings Links!) -->
      <div v-if="loading" class="hidden lg:inline-flex items-center">
        <span class="loading loading-spinner loading-sm text-primary mx-2"></span>
      </div>

      <div v-else class="hidden lg:inline-flex items-center">
        <a v-if="!isAuthenticated" href="/login" class="btn btn-primary btn-sm text-primary-content font-bold rounded-xl">
          Sign In
        </a>

        <div v-else class="dropdown dropdown-end">
          <div
            tabindex="0"
            role="button"
            class="btn btn-outline btn-sm h-9 rounded-xl gap-2 border-base-300 hover:border-primary pl-2.5 pr-1.5"
            title="Account, Workspace & Settings"
          >
            <span class="max-w-28 truncate text-xs font-bold text-base-content">
              {{ currentTeam ? currentTeam.name : 'Personal' }}
            </span>
            <div class="bg-neutral text-neutral-content rounded-full w-6 h-6 inline-flex items-center justify-center ring-1 ring-base-300 shrink-0">
              <span class="text-[11px] font-black">{{ userInitial }}</span>
            </div>
          </div>

          <div
            tabindex="0"
            class="dropdown-content z-50 mt-2 p-2 shadow-xl bg-base-100 border border-base-200 rounded-2xl w-max min-w-[280px] max-w-[calc(100vw-2rem)] sm:max-w-sm space-y-1"
          >
            <!-- Member Identity -->
            <div class="px-3 py-2 border-b border-base-200">
              <div class="flex items-center justify-between gap-2">
                <p class="font-bold text-sm truncate text-base-content">{{ user?.name || 'Member' }}</p>
                <span class="badge badge-xs badge-ghost border border-base-300 font-mono font-bold whitespace-nowrap shrink-0">
                  {{ capabilities.roleBadge }}
                </span>
              </div>
              <p class="text-xs opacity-60 truncate text-base-content">{{ user?.email }}</p>
            </div>

            <!-- Workspace Switcher -->
            <div class="px-3 pt-1.5 pb-0.5 text-[10px] uppercase tracking-wider font-extrabold opacity-60">
              Active Workspace
            </div>
            <button
              type="button"
              @click="handleSwitchTeam(null)"
              class="w-full rounded-xl py-2 px-3 flex items-center justify-between gap-2 text-left hover:bg-base-200 transition-colors"
              :class="{ 'bg-primary/15 text-primary font-bold': !currentTeam }"
            >
              <span class="flex items-center gap-2 min-w-0">
                <Icon icon="solar:user-rounded-bold-duotone" class="w-4 h-4 shrink-0" />
                <span class="truncate text-xs">Personal Inventory</span>
              </span>
              <Icon v-if="!currentTeam" icon="solar:check-circle-bold" class="w-4 h-4 text-primary shrink-0" />
            </button>
            <button
              v-for="team in teams"
              :key="team.$id"
              type="button"
              @click="handleSwitchTeam(team)"
              class="w-full rounded-xl py-2 px-3 flex items-center justify-between gap-2 text-left hover:bg-base-200 transition-colors"
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
            </button>

            <div class="divider my-1"></div>

            <!-- Account, Single Settings Entry & Collective Messages -->
            <a href="/profile" class="flex items-center rounded-xl py-2 px-3 gap-2 text-xs font-semibold hover:bg-base-200">
              <Icon icon="solar:user-id-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
              <span>Profile &amp; Member Hats</span>
            </a>
            <a href="/settings" class="flex items-center rounded-xl py-2 px-3 gap-2 text-xs font-semibold hover:bg-base-200">
              <Icon icon="solar:settings-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
              <span>Workspace &amp; Location Settings</span>
            </a>
            <button
              v-if="!ownedTeam"
              type="button"
              @click="showCreateModal = true"
              class="w-full flex items-center rounded-xl py-2 px-3 gap-2 text-xs font-semibold text-primary hover:bg-base-200"
            >
              <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
              <span>Create Organization</span>
            </button>
            <button
              v-if="currentTeam && ownedTeam && currentTeam.$id === ownedTeam.$id"
              type="button"
              @click="showInviteModal = true"
              class="w-full flex items-center rounded-xl py-2 px-3 gap-2 text-xs font-semibold text-secondary hover:bg-base-200"
            >
              <Icon icon="solar:user-plus-bold" class="w-4 h-4 shrink-0" />
              <span>Invite to the Collective</span>
            </button>
            <button
              type="button"
              class="w-full flex items-center rounded-xl py-2 px-3 gap-2 text-xs font-semibold text-warning hover:bg-warning/10"
              @click="openCoopMessages('new_bug')"
            >
              <Icon icon="solar:bug-bold-duotone" class="w-4 h-4 text-warning shrink-0" />
              <span>Messages &amp; Report Bug</span>
            </button>

            <div class="divider my-1"></div>

            <div class="flex flex-row justify-between items-center px-3 py-1.5">
              <span class="text-xs font-semibold opacity-70">Theme</span>
              <ThemeSwitcher />
            </div>

            <div class="divider my-1"></div>

            <button
              type="button"
              @click="logout"
              class="w-full flex items-center rounded-xl py-2 px-3 gap-2 text-xs text-error font-semibold hover:bg-error/10"
            >
              <Icon icon="solar:logout-2-bold-duotone" class="w-4 h-4 text-error shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Menu Button (< 1024px — 44px touch target) -->
      <button
        type="button"
        @click="openMobile = !openMobile"
        class="btn btn-square btn-ghost h-11 w-11 lg:hidden rounded-xl"
        aria-label="Open navigation menu"
      >
        <Icon icon="solar:hamburger-menu-bold" class="w-6 h-6" />
      </button>
    </div>

    <!-- Mobile Menu Backdrop & Slide-Over Drawer (Driven from the Exact Same Shared Nav Config!) -->
    <Teleport to="body" :disabled="!isMounted">
      <Transition name="fade">
        <div
          v-if="openMobile"
          class="fixed inset-0 bg-black/55 backdrop-blur-xs z-100 lg:hidden"
          @click="openMobile = false"
        ></div>
      </Transition>

      <Transition name="slide">
        <aside
          v-if="openMobile"
          data-rc-mobile-drawer
          class="fixed top-0 right-0 h-full w-[88%] max-w-[360px] bg-base-100 border-l border-base-300 shadow-2xl z-101 flex flex-col justify-between overflow-y-auto lg:hidden pb-[env(safe-area-inset-bottom,0px)]"
          aria-label="Mobile Navigation Drawer"
        >
          <div class="px-5 py-3.5 flex justify-between items-center border-b border-base-200 sticky top-0 bg-base-100/95 backdrop-blur-md z-10">
            <div class="flex items-center gap-1.5 min-w-0">
              <Icon icon="solar:compass-big-bold-duotone" class="w-6 h-6 text-primary shrink-0" />
              <span class="text-lg font-black text-primary truncate">{{ siteConfig.shortTitle }}</span>
              <span class="badge badge-primary badge-outline badge-xs font-mono font-black whitespace-nowrap shrink-0">{{ siteConfig.badgeText }}</span>
            </div>
            <button
              type="button"
              @click="openMobile = false"
              class="btn btn-ghost btn-circle h-11 w-11"
              aria-label="Close navigation menu"
            >
              <Icon icon="solar:close-circle-bold" class="w-6 h-6" />
            </button>
          </div>

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
                aria-label="Switch active workspace"
                class="select select-bordered select-sm h-11 w-full font-bold rounded-xl"
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
            </div>

            <template v-if="isAuthenticated">
              <!-- Group 1: Core Reseller Pillars & Studios Launcher (<= 5 links) -->
              <div data-rc-mobile-group class="space-y-1">
                <span class="text-[10px] uppercase font-extrabold opacity-55 tracking-wider px-2">
                  Daily Reseller Flow
                </span>
                <a
                  v-for="item in mobilePrimaryLinks"
                  :key="item.href"
                  :href="item.href"
                  data-rc-mobile-link
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
                  <span
                    v-if="item.badge"
                    class="badge badge-xs font-bold whitespace-nowrap shrink-0"
                    :class="item.badgeClass || 'badge-ghost'"
                  >
                    {{ item.badge }}
                  </span>
                </a>
              </div>

              <!-- Group 2 & 3: Shared Dropdown Pillars (Booths & Channels <= 7, Sales & Co-op <= 6) -->
              <div
                v-for="group in mobileDropdownPillars"
                :key="`mob-${group.id}`"
                data-rc-mobile-group
                class="space-y-1"
              >
                <span class="text-[10px] uppercase font-extrabold opacity-55 tracking-wider px-2">
                  {{ group.label }}
                </span>
                <a
                  v-for="child in group.children"
                  :key="child.id"
                  :href="child.href"
                  data-rc-mobile-link
                  @click="openMobile = false"
                  class="flex items-center justify-between gap-3 px-3 py-2.5 min-h-11 rounded-xl text-sm transition-all"
                  :class="
                    isLinkActive(child.href)
                      ? 'bg-primary/15 text-primary font-bold border-l-4 border-primary'
                      : 'hover:bg-base-200 font-semibold'
                  "
                >
                  <span class="flex items-center gap-3 min-w-0">
                    <span v-if="child.emoji" class="text-base leading-none shrink-0">{{ child.emoji }}</span>
                    <Icon v-else :icon="child.icon" class="w-5 h-5 shrink-0" :class="child.iconColor || 'text-primary'" />
                    <span class="truncate">{{ child.label }}</span>
                  </span>
                  <span
                    v-if="child.badge"
                    class="badge badge-xs font-bold whitespace-nowrap shrink-0"
                    :class="child.badgeClass || 'badge-ghost'"
                  >
                    {{ child.badge }}
                  </span>
                </a>
              </div>
            </template>

            <!-- Guest menu: public pages only -->
            <div v-else class="space-y-1">
              <span class="text-[10px] uppercase font-extrabold opacity-55 tracking-wider px-2">Explore</span>
              <a
                href="/coop"
                @click="openMobile = false"
                class="flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-xl text-sm font-semibold hover:bg-base-200"
              >
                <Icon icon="solar:shield-star-bold-duotone" class="w-5 h-5 text-primary shrink-0" />
                <span>Collective Charter</span>
              </a>
              <a
                href="/demo"
                @click="openMobile = false"
                class="flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-xl text-sm font-semibold hover:bg-base-200"
              >
                <Icon icon="solar:widget-bold-duotone" class="w-5 h-5 text-primary shrink-0" />
                <span>Example Dashboard</span>
              </a>
              <a
                href="/scout"
                @click="openMobile = false"
                class="flex items-center justify-between gap-3 px-3 py-2.5 min-h-11 rounded-xl text-sm font-semibold hover:bg-base-200"
              >
                <span class="flex items-center gap-3">
                  <Icon icon="solar:scanner-bold" class="w-5 h-5 text-primary shrink-0" />
                  <span>AI Scout Preview</span>
                </span>
                <span class="badge badge-secondary text-secondary-content badge-xs font-bold whitespace-nowrap shrink-0">Preview</span>
              </a>
            </div>
          </div>

          <div class="p-4 bg-base-200/80 border-t border-base-300 space-y-3">
            <div v-if="isAuthenticated" class="flex items-center gap-3">
              <div class="avatar placeholder">
                <div class="bg-neutral text-neutral-content rounded-full w-10">
                  <span class="text-xs font-bold">{{ userInitial }}</span>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold truncate text-base-content">{{ user?.name || 'Member' }}</p>
                <p class="text-xs opacity-60 truncate text-base-content">{{ user?.email }}</p>
              </div>
              <span class="badge badge-xs badge-ghost border border-base-300 font-mono font-bold whitespace-nowrap shrink-0">
                {{ capabilities.roleBadge }}
              </span>
            </div>

            <div class="flex items-center justify-between border-t border-base-300/60 pt-2.5">
              <span class="text-xs font-bold opacity-70">Theme</span>
              <ThemeSwitcher />
            </div>

            <button
              v-if="isAuthenticated"
              type="button"
              class="btn btn-outline btn-warning h-11 w-full rounded-xl font-bold gap-1.5"
              @click="openCoopMessages('list')"
            >
              <Icon icon="solar:bug-bold-duotone" class="w-4 h-4" />
              <span>Messages &amp; Report Bug</span>
            </button>

            <div class="grid grid-cols-2 gap-2 pt-1">
              <a
                v-if="!isAuthenticated"
                href="/login"
                class="btn btn-primary h-11 col-span-2 text-primary-content font-bold rounded-xl"
                @click="openMobile = false"
              >
                Sign In
              </a>
              <template v-else>
                <a
                  href="/profile"
                  class="btn btn-outline h-11 rounded-xl font-semibold"
                  @click="openMobile = false"
                >
                  Profile
                </a>
                <button
                  type="button"
                  @click="logout(); openMobile = false"
                  class="btn btn-error h-11 rounded-xl text-error-content font-bold"
                >
                  Sign Out
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

    <!-- Workspace Create / Invite Modals -->
    <dialog class="modal" :class="{ 'modal-open': showCreateModal }">
      <div class="modal-box rounded-2xl">
        <h3 class="font-bold text-lg">Create New Organization</h3>
        <p class="py-2 text-sm opacity-75">Create a shared co-op workspace.</p>
        <div class="py-4">
          <input
            v-model="newTeamName"
            type="text"
            placeholder="Organization Name"
            aria-label="Organization Name"
            class="input input-bordered h-11 w-full rounded-xl"
            @keydown.enter.prevent="handleCreateTeam"
          />
        </div>
        <div class="modal-action">
          <button type="button" class="btn h-11 md:h-9 rounded-xl" @click="showCreateModal = false">Cancel</button>
          <button
            type="button"
            class="btn h-11 md:h-9 btn-primary text-primary-content font-bold rounded-xl"
            :disabled="!newTeamName.trim()"
            @click="handleCreateTeam"
          >
            Create Workspace
          </button>
        </div>
      </div>
    </dialog>

    <dialog class="modal" :class="{ 'modal-open': showInviteModal }">
      <div class="modal-box rounded-2xl">
        <h3 class="font-bold text-lg">Invite to the Collective</h3>
        <p class="py-2 text-sm opacity-75">Send an invitation email to join your workspace.</p>
        <div class="py-4">
          <input
            v-model="inviteEmail"
            type="email"
            autocomplete="email"
            autocapitalize="none"
            spellcheck="false"
            placeholder="member@thehc.llc"
            aria-label="Member email address"
            class="input input-bordered h-11 w-full rounded-xl"
            @keydown.enter.prevent="handleInvite"
          />
        </div>
        <div class="modal-action">
          <button type="button" class="btn h-11 md:h-9 rounded-xl" @click="showInviteModal = false">Cancel</button>
          <button
            type="button"
            class="btn h-11 md:h-9 btn-primary text-primary-content font-bold rounded-xl"
            :disabled="!inviteEmail.trim()"
            @click="handleInvite"
          >
            Send Invite
          </button>
        </div>
      </div>
    </dialog>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useStore } from '@nanostores/vue';
import { Icon } from '@iconify/vue';
import ThemeSwitcher from '../ui/ThemeSwitcher.vue';
import { isAlphaMode } from '../../stores/env';
import { useAuth } from '../../composables/useAuth';
import { useBodyScrollLock } from '../../composables/useBodyScrollLock';
import { useCart } from '../../composables/useCart';
import { useScoutPurchase } from '../../composables/useScoutPurchase';
import { useMemberCapabilities } from '../../lib/memberAccess';
import {
  buildResellerNavConfig,
  MAX_DROPDOWN_ITEMS,
  type NavPillarConfig,
} from '../../lib/studiosCatalog';
import { toUserMessage } from '../../lib/userFacingErrors';
import { addToast } from '../../stores/toast';
import { siteConfig } from '../../site-config';

const props = defineProps({
  initialAuthenticated: {
    type: Boolean,
    default: false,
  },
  initialPath: {
    type: String,
    default: '/',
  },
});

const {
  user,
  isAuthenticated,
  currentTeam,
  teams,
  ownedTeam,
  loading,
  switchTeam,
  createTeam,
  inviteMember,
  logout: authLogout,
} = useAuth();
const { capabilities } = useMemberCapabilities();

const showMemberNav = computed(() => isAuthenticated.value || (loading.value && props.initialAuthenticated));

const { cartItems } = useCart();
const { purchaseItems, activePurchase, pausedTracker, draftPurchases, loadDraftPurchases, toggleTray } =
  useScoutPurchase();

const currentPath = ref(props.initialPath || '/');
const isMounted = ref(false);
const openMobile = ref(false);

useBodyScrollLock(openMobile);

const resellerPillars = computed(() => buildResellerNavConfig(capabilities.value));

const mobileDropdownPillars = computed(() =>
  resellerPillars.value.filter((p) => Array.isArray(p.children) && p.children.length > 0)
);

const isRouteActive = (prefix: string): boolean => {
  if (!currentPath.value) return false;
  if (prefix === '/coop') return currentPath.value === '/coop';
  return currentPath.value === prefix || currentPath.value.startsWith(prefix + '/');
};

const isLinkActive = (href: string): boolean => {
  const cleanHref = href.split('?')[0] || '/';
  return isRouteActive(cleanHref);
};

const isPillarActive = (pillar: NavPillarConfig): boolean => {
  if (pillar.id === 'sales_coop' && currentPath.value === '/coop') return true;
  return pillar.activePrefixes.some((p) => isRouteActive(p));
};

const isStudiosRouteActive = computed(() =>
  ['/studios', '/labels', '/scan', '/coop/vault'].some((p) => isRouteActive(p))
);

const displayTrackedCount = computed(() => {
  return (
    purchaseItems.value.length ||
    activePurchase.value?.itemCount ||
    pausedTracker.value?.itemCount ||
    draftPurchases.value[0]?.itemCount ||
    cartItems.value.length
  );
});

const mobilePrimaryLinks = computed(() => {
  const direct = resellerPillars.value
    .filter((p) => !p.children && p.href)
    .map((p) => ({
      label: p.label,
      href: p.href!,
      icon: p.icon,
      iconColor: 'text-primary',
      active: isPillarActive(p),
      badge: undefined as string | undefined,
      badgeClass: undefined as string | undefined,
    }));

  if (capabilities.value.canUseBuyTracker) {
    direct.push({
      label: 'Active Buy Trackers',
      href: '/scout/trackers',
      icon: 'solar:bookmark-square-minimalistic-bold-duotone',
      iconColor: 'text-secondary',
      active: currentPath.value.startsWith('/scout/tracker'),
      badge: displayTrackedCount.value > 0 ? `${displayTrackedCount.value}` : undefined,
      badgeClass: 'badge-secondary text-secondary-content',
    });
  }

  direct.push({
    label: 'Studios & Reseller Tools',
    href: '/studios',
    icon: 'solar:magic-stick-3-bold-duotone',
    iconColor: 'text-secondary',
    active: isStudiosRouteActive.value,
    badge: 'All Tools',
    badgeClass: 'badge-ghost',
  });

  return direct.slice(0, MAX_DROPDOWN_ITEMS);
});

onMounted(() => {
  isMounted.value = true;
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
  if (
    typeof window !== 'undefined' &&
    window.location.pathname === '/scout' &&
    (activePurchase.value || pausedTracker.value)
  ) {
    e.preventDefault();
    toggleTray();
  }
};

const alphaMode = useStore(isAlphaMode);

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
  const name = newTeamName.value.trim();
  if (!name) return;
  try {
    await createTeam(name);
    showCreateModal.value = false;
    newTeamName.value = '';
  } catch (e: any) {
    addToast({ type: 'error', message: toUserMessage(e, "Couldn't create workspace — please try again.") });
  }
};

const handleInvite = async () => {
  const cleanEmail = inviteEmail.value.trim().toLowerCase();
  if (!cleanEmail || !currentTeam.value) return;
  try {
    await inviteMember(currentTeam.value.$id, cleanEmail);
    showInviteModal.value = false;
    inviteEmail.value = '';
    addToast({ type: 'success', message: '✅ Invitation sent!' });
  } catch (e: any) {
    if (String(e?.message || '').includes('unique') || e?.code === 409) {
      addToast({ type: 'warning', message: 'This member already has an active or pending invitation.' });
    } else {
      addToast({ type: 'error', message: toUserMessage(e, "Couldn't send invitation — please try again.") });
    }
  }
};

const openCoopMessages = (mode: 'list' | 'new_bug' | 'new_message' = 'list') => {
  openMobile.value = false;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-coop-messages-tray', { detail: { mode } }));
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
