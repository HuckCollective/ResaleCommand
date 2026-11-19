<template>
  <nav class="navbar max-w-screen-2xl mx-auto px-2 sm:px-4 lg:px-6 border-b border-base-200/60 flex items-center justify-between gap-2 overflow-visible">
    <!-- Brand / Left (Krug #5 Street Sign #1) -->
    <div class="flex items-center gap-1.5 shrink-0 min-w-0">
      <a :href="showMemberNav ? '/dashboard' : '/'" class="btn btn-ghost px-2 sm:px-2.5 text-lg sm:text-xl font-black tracking-tight text-primary gap-1.5 whitespace-nowrap">
        <Icon icon="solar:compass-big-bold-duotone" class="w-6 h-6 shrink-0" />
        <span class="truncate">{{ siteConfig.shortTitle }}</span>
        <span class="badge badge-primary badge-outline badge-xs sm:badge-sm font-mono font-black tracking-normal whitespace-nowrap shrink-0 hidden sm:inline-flex">{{ siteConfig.badgeText }}</span>
      </a>
      <span
        v-if="alphaMode"
        class="badge badge-warning text-warning-content badge-xs sm:badge-sm font-black uppercase whitespace-nowrap shrink-0 shadow-xs border border-warning hidden sm:inline-flex"
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
              @click="closeDropdownFocus"
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

    <!-- Right Reseller Toolbelt (Simplified: 📷 Scout (+Tracker Badge) | Wide Studios 2xl:+ | Unified [Hat Name · Prefix] ⌄) -->
    <div data-rc-toolbelt class="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
      <!-- Toolbelt #1: Scout + Trackers Pill (Trackers hidden on <640px mobile so 375px header never overflows) -->
      <div class="inline-flex items-center rounded-xl border border-base-300 bg-base-200/60 p-0.5 gap-0.5 shrink-0">
        <a
          href="/scout?quick=true"
          @click="handleScoutClick"
          class="btn btn-xs sm:btn-sm rounded-lg gap-1.5 font-bold px-2.5 h-11 md:h-8 min-h-0 border-0 shadow-none whitespace-nowrap transition-all"
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
          class="hidden sm:inline-flex btn btn-xs sm:btn-sm rounded-lg gap-1 font-bold px-2 h-11 md:h-8 min-h-0 border-0 shadow-none whitespace-nowrap transition-all"
          :class="
            currentPath.startsWith('/scout/tracker')
              ? 'btn-secondary text-secondary-content shadow-xs'
              : 'btn-ghost hover:bg-base-100'
          "
          title="Active Buy Trackers (/scout/trackers)"
          aria-label="Buy Trackers"
        >
          <span class="text-xs leading-none">📌</span>
          <span class="hidden 2xl:inline text-xs">Trackers</span>
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

      <!-- Toolbelt #2: Wide-Screen Studios Launcher (>=1536px; inside Account menu on <=1440px) -->
      <a
        v-if="showMemberNav && !capabilities.isConsignor"
        href="/studios"
        :aria-current="isStudiosRouteActive ? 'page' : undefined"
        class="hidden 2xl:inline-flex btn btn-sm h-8 rounded-xl px-2.5 gap-1.5 font-bold border border-base-300 whitespace-nowrap shrink-0"
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

      <!-- Toolbelt #3: Unified Account Pill (Shows Member Name + Resolved Hat & Barcode Prefix) -->
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
            class="btn btn-outline btn-sm h-9 rounded-xl gap-1.5 border-base-300 hover:border-primary pl-2.5 pr-1.5"
            title="Account, Member Hats & Settings"
          >
            <template v-if="capabilitiesResolved">
              <span aria-hidden="true" class="text-sm leading-none shrink-0">{{ roleIcon }}</span>
              <span class="max-w-24 truncate text-xs font-bold text-base-content">{{ shortFirstName }}</span>
              <span class="badge badge-2xs badge-ghost font-mono font-bold whitespace-nowrap shrink-0">{{ capabilities.prefix }}</span>
            </template>
            <span v-else class="max-w-24 truncate text-xs font-bold text-base-content">{{ shortFirstName }}</span>
            <div class="bg-neutral text-neutral-content rounded-full w-6 h-6 inline-flex items-center justify-center ring-1 ring-base-300 shrink-0">
              <span class="text-[11px] font-black">{{ userInitial }}</span>
            </div>
          </div>

          <div
            tabindex="0"
            class="dropdown-content z-50 mt-2 p-2 shadow-xl bg-base-100 border border-base-200 rounded-2xl w-max min-w-[272px] max-w-[calc(100vw-2rem)] sm:max-w-sm space-y-1"
          >
            <!-- Member Identity Header -->
            <div class="px-3 py-2 border-b border-base-200 space-y-0.5">
              <div class="flex items-center justify-between gap-2">
                <p class="font-bold text-sm truncate text-base-content">{{ user?.name || 'Member' }}</p>
                <span
                  v-if="capabilitiesResolved"
                  class="badge badge-xs badge-ghost border border-base-300 font-mono font-bold whitespace-nowrap shrink-0"
                >
                  {{ capabilities.roleBadge }} · {{ capabilities.prefix }}
                </span>
              </div>
              <p class="text-xs opacity-60 truncate text-base-content">{{ user?.email }}</p>
              <p v-if="currentTeam?.name && teams.length <= 1" class="text-[11px] font-semibold text-base-content/70 truncate">
                {{ currentTeam.name }}
              </p>
            </div>

            <!-- Multi-Team Switcher (Only when user belongs to 2+ organizations; zero Personal Inventory trap) -->
            <template v-if="teams.length > 1">
              <div class="px-3 pt-1.5 pb-0.5 text-[10px] uppercase tracking-wider font-extrabold opacity-60">
                Active Workspace
              </div>
              <button
                v-for="team in teams"
                :key="team.$id"
                type="button"
                @click="handleSwitchTeam(team); closeDropdownFocus()"
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
            </template>

            <!-- First-Run Escape Hatch ONLY when user has 0 teams and is not a Consignor -->
            <button
              v-if="teams.length === 0 && capabilitiesResolved && !capabilities.isConsignor"
              type="button"
              @click="showCreateModal = true"
              class="w-full flex items-center rounded-xl py-2 px-3 gap-2 text-xs font-semibold text-primary hover:bg-base-200"
            >
              <Icon icon="solar:add-circle-bold" class="w-4 h-4 shrink-0" />
              <span>Create Organization</span>
            </button>

            <!-- Clean Role-Aware Actions (<= 1 exact href="/settings" in desktop markup for §17) -->
            <a
              href="/profile"
              class="flex items-center rounded-xl py-2 px-3 gap-2 text-xs font-semibold hover:bg-base-200"
              @click="closeDropdownFocus"
            >
              <Icon icon="solar:user-id-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
              <span>Account &amp; Member Hats</span>
            </a>

            <template v-if="capabilitiesResolved">
              <template v-if="capabilities.role === 'founder'">
                <a
                  href="/settings"
                  class="flex items-center rounded-xl py-2 px-3 gap-2 text-xs font-semibold hover:bg-base-200"
                  @click="closeDropdownFocus"
                >
                  <Icon icon="solar:settings-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
                  <span>Collective &amp; Location Settings</span>
                </a>
                <a
                  href="/coop/governance?tab=roster"
                  class="flex items-center rounded-xl py-2 px-3 gap-2 text-xs font-semibold hover:bg-base-200"
                  @click="closeDropdownFocus"
                >
                  <Icon icon="solar:user-plus-bold" class="w-4 h-4 text-secondary shrink-0" />
                  <span>Member Hats &amp; Invites</span>
                </a>
              </template>
              <a
                v-else-if="capabilities.role === 'curator'"
                href="/settings?tab=hardware"
                class="flex items-center rounded-xl py-2 px-3 gap-2 text-xs font-semibold hover:bg-base-200"
                @click="closeDropdownFocus"
              >
                <Icon icon="solar:printer-bold-duotone" class="w-4 h-4 text-primary shrink-0" />
                <span>Printer &amp; Bookmarklet Setup</span>
              </a>
            </template>

            <a
              v-if="!capabilities.isConsignor"
              href="/studios"
              class="flex items-center rounded-xl py-2 px-3 gap-2 text-xs font-semibold hover:bg-base-200"
              @click="closeDropdownFocus"
            >
              <Icon icon="solar:magic-stick-3-bold-duotone" class="w-4 h-4 text-secondary shrink-0" />
              <span>Studios &amp; Reseller Tools</span>
            </a>

            <button
              v-if="capabilities.canViewCollectiveTools"
              type="button"
              class="w-full flex items-center rounded-xl py-2 px-3 gap-2 text-xs font-semibold text-warning hover:bg-warning/10"
              @click="openCoopMessages('new_bug'); closeDropdownFocus()"
            >
              <Icon icon="solar:bug-bold-duotone" class="w-4 h-4 text-warning shrink-0" />
              <span>Messages &amp; Report Bug</span>
            </button>

            <div class="divider my-1"></div>

            <div class="flex flex-row justify-between items-center gap-2 px-3 py-1">
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

    <!-- Mobile Menu Backdrop & Slide-Over Drawer (Pinned Header/Footer + Collapsible Accordions) -->
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
          class="fixed top-0 right-0 h-full w-[88%] max-w-[360px] bg-base-100 border-l border-base-300 shadow-2xl z-101 flex flex-col overflow-hidden lg:hidden pb-[env(safe-area-inset-bottom,0px)]"
          aria-label="Mobile Navigation Drawer"
        >
          <!-- Pinned Drawer Header -->
          <div class="px-4 py-3 flex justify-between items-center border-b border-base-200 bg-base-100 shrink-0">
            <div class="flex items-center gap-1.5 min-w-0">
              <Icon icon="solar:compass-big-bold-duotone" class="w-6 h-6 text-primary shrink-0" />
              <span class="text-lg font-black text-primary truncate">{{ siteConfig.shortTitle }}</span>
              <span class="badge badge-primary badge-outline badge-xs font-mono font-black whitespace-nowrap shrink-0">{{ siteConfig.badgeText }}</span>
              <span
                v-if="alphaMode"
                class="badge badge-warning text-warning-content badge-xs font-black uppercase whitespace-nowrap shrink-0"
              >
                Alpha
              </span>
            </div>
            <button
              type="button"
              @click="openMobile = false"
              class="btn btn-ghost btn-circle h-11 w-11 shrink-0"
              aria-label="Close navigation menu"
            >
              <Icon icon="solar:close-circle-bold" class="w-6 h-6" />
            </button>
          </div>

          <!-- Scrollable Middle Body -->
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            <!-- Workspace Selector ONLY when user belongs to 2+ organizations -->
            <div v-if="isAuthenticated && teams.length > 1" class="bg-base-200/60 border border-base-300/70 rounded-2xl p-3 space-y-2">
              <span class="text-[10px] uppercase font-extrabold opacity-60 tracking-wider block">Active Workspace</span>
              <select
                aria-label="Switch active workspace"
                class="select select-bordered select-sm h-11 w-full font-bold rounded-xl"
                @change="handleMobileSwitchTeam"
              >
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
            <div
              v-else-if="isAuthenticated && teams.length === 0 && capabilitiesResolved && !capabilities.isConsignor"
              class="bg-base-200/60 border border-base-300/70 rounded-2xl p-3"
            >
              <button
                type="button"
                class="btn btn-sm h-11 btn-primary text-primary-content rounded-xl font-bold w-full"
                @click="showCreateModal = true"
              >
                + Create Organization
              </button>
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

              <!-- Groups 2 & 3: Collapsible Native <details> Accordions (non-reactive initial open) -->
              <details
                v-for="group in mobileDropdownPillars"
                :key="`mob-${group.id}`"
                data-rc-mobile-group
                :open="defaultOpenGroupIds[group.id] ? true : undefined"
                class="group rounded-2xl border border-base-300/80 bg-base-200/35 overflow-hidden"
              >
                <summary class="flex items-center justify-between px-3.5 py-2.5 min-h-11 cursor-pointer select-none list-none text-xs font-extrabold uppercase tracking-wider text-base-content/80 hover:bg-base-200/60">
                  <span class="flex items-center gap-2">
                    <Icon :icon="group.icon" class="w-4 h-4 text-primary shrink-0" />
                    <span>{{ group.label }}</span>
                  </span>
                  <Icon
                    icon="solar:alt-arrow-down-linear"
                    class="w-4 h-4 opacity-60 transition-transform duration-150 group-open:rotate-180 shrink-0"
                  />
                </summary>
                <div class="px-2 pb-2 pt-1 space-y-1">
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
              </details>
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

          <!-- Compact Pinned Footer -->
          <div class="p-3.5 bg-base-200/85 border-t border-base-300 space-y-2.5 shrink-0">
            <div v-if="isAuthenticated" class="flex items-center gap-2.5">
              <div class="bg-neutral text-neutral-content rounded-full w-9 h-9 inline-flex items-center justify-center shrink-0">
                <span class="text-xs font-bold">{{ userInitial }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold truncate text-base-content">{{ user?.name || 'Member' }}</p>
                <p class="text-[11px] opacity-60 truncate text-base-content">{{ user?.email }}</p>
              </div>
              <span
                v-if="capabilitiesResolved"
                class="badge badge-xs badge-ghost border border-base-300 font-mono font-bold whitespace-nowrap shrink-0"
              >
                {{ capabilities.roleBadge }} · {{ capabilities.prefix }}
              </span>
            </div>

            <div class="flex items-center justify-between gap-2 border-t border-base-300/60 pt-2">
              <span class="text-xs font-bold opacity-70">Theme</span>
              <ThemeSwitcher />
            </div>

            <div v-if="!isAuthenticated">
              <a
                href="/login"
                class="btn btn-primary h-11 w-full text-primary-content font-bold rounded-xl"
                @click="openMobile = false"
              >
                Sign In
              </a>
            </div>
            <div v-else class="grid grid-cols-2 gap-2">
              <a
                href="/profile"
                class="btn btn-outline btn-sm h-11 rounded-xl font-semibold"
                @click="openMobile = false"
              >
                👤 Account
              </a>
              <template v-if="capabilitiesResolved">
                <a
                  v-if="capabilities.role === 'founder'"
                  href="/settings"
                  class="btn btn-outline btn-sm h-11 rounded-xl font-semibold"
                  @click="openMobile = false"
                >
                  ⚙️ Settings
                </a>
                <a
                  v-else-if="capabilities.role === 'curator'"
                  href="/settings?tab=hardware"
                  class="btn btn-outline btn-sm h-11 rounded-xl font-semibold"
                  @click="openMobile = false"
                >
                  🖨️ Printer
                </a>
              </template>
              <button
                v-if="capabilities.canViewCollectiveTools"
                type="button"
                class="btn btn-outline btn-warning btn-sm h-11 rounded-xl font-bold"
                @click="openCoopMessages('list')"
              >
                💬 Messages
              </button>
              <button
                type="button"
                @click="logout(); openMobile = false"
                class="btn btn-error btn-sm h-11 rounded-xl text-error-content font-bold"
                :class="!capabilities.canViewCollectiveTools && !capabilitiesResolved ? 'col-span-2' : ''"
              >
                Sign Out
              </button>
            </div>

            <div class="text-center text-[10px] opacity-40">
              Copyright © {{ new Date().getFullYear() }} {{ siteConfig.legalEntity }}
            </div>
          </div>
        </aside>
      </Transition>
    </Teleport>

    <!-- Canonical Slide-Over Drawer for First-Run Workspace Creation (zero teams only) -->
    <SlideOverDrawer
      v-model="showCreateModal"
      title="Create New Organization"
      subtitle="Create a shared Collective workspace."
    >
      <div class="space-y-2">
        <label for="rc-nav-org-name" class="text-xs font-bold text-base-content/80 block">Organization Name</label>
        <input
          id="rc-nav-org-name"
          v-model="newTeamName"
          type="text"
          placeholder="e.g. The Huckleberry Collective"
          class="input input-bordered h-11 md:h-9 w-full rounded-xl"
          @keydown.enter.prevent="handleCreateTeam"
        />
      </div>
      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button type="button" class="btn btn-sm h-11 md:h-9 btn-ghost rounded-xl font-bold" @click="showCreateModal = false">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-sm h-11 md:h-9 btn-primary text-primary-content font-black rounded-xl px-4"
            :disabled="submittingTeamAction || !newTeamName.trim()"
            @click="handleCreateTeam"
          >
            <span v-if="submittingTeamAction" class="loading loading-spinner loading-xs"></span>
            <span>Create Workspace</span>
          </button>
        </div>
      </template>
    </SlideOverDrawer>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useStore } from '@nanostores/vue';
import { Icon } from '@iconify/vue';
import SlideOverDrawer from '../common/SlideOverDrawer.vue';
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
  loading,
  switchTeam,
  createTeam,
  logout: authLogout,
} = useAuth();
const { capabilities, capabilitiesResolved } = useMemberCapabilities();

const showMemberNav = computed(() => isAuthenticated.value || (loading.value && props.initialAuthenticated));

const { cartItems } = useCart();
const { purchaseItems, activePurchase, pausedTracker, draftPurchases, loadDraftPurchases, toggleTray } =
  useScoutPurchase();

const currentPath = ref(props.initialPath || '/');
const isMounted = ref(false);
const openMobile = ref(false);
const defaultOpenGroupIds = ref<Record<string, boolean>>({});

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

// Snapshot active group ONCE when mobile drawer opens so manual <details> toggles are never overwritten
watch(openMobile, (isOpen) => {
  if (isOpen) {
    const next: Record<string, boolean> = {};
    for (const grp of mobileDropdownPillars.value) {
      if (isPillarActive(grp)) {
        next[grp.id] = true;
      }
    }
    defaultOpenGroupIds.value = next;
  }
});

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

  if (!capabilities.value.isConsignor) {
    direct.push({
      label: 'Studios & Reseller Tools',
      href: '/studios',
      icon: 'solar:magic-stick-3-bold-duotone',
      iconColor: 'text-secondary',
      active: isStudiosRouteActive.value,
      badge: 'All Tools',
      badgeClass: 'badge-ghost',
    });
  }

  return direct.slice(0, MAX_DROPDOWN_ITEMS);
});

const closeDropdownFocus = () => {
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
};

const onMobileEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && openMobile.value) {
    openMobile.value = false;
  }
};

onMounted(() => {
  isMounted.value = true;
  if (typeof window !== 'undefined') {
    currentPath.value = window.location.pathname;
    window.addEventListener('keydown', onMobileEscape);
  }
  if (isAuthenticated.value) {
    loadDraftPurchases().catch((err) => console.warn('[Navbar] Failed to load draft purchases:', err));
  }
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onMobileEscape);
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
const submittingTeamAction = ref(false);
const newTeamName = ref('');

watch(showCreateModal, (open) => {
  if (open) {
    openMobile.value = false;
  }
});

const userInitial = computed(() => {
  return user.value && user.value.name ? user.value.name.charAt(0).toUpperCase() : '?';
});

const shortFirstName = computed(() => {
  const raw = String(user.value?.name || '').trim();
  if (!raw) return 'Account';
  return raw.split(/\s+/)[0] || 'Account';
});

const roleIcon = computed(() => {
  if (capabilities.value.role === 'founder') return '👑';
  if (capabilities.value.role === 'curator') return '💎';
  if (capabilities.value.isConsignor) return '🤝';
  return '🌱';
});

const logout = async () => {
  await authLogout();
};

const handleSwitchTeam = async (team: any) => {
  await switchTeam(team);
};

const handleMobileSwitchTeam = async (event: Event) => {
  const select = event.target as HTMLSelectElement;
  const team = teams.value.find((t) => t.$id === select.value);
  if (team) {
    await switchTeam(team);
  }
};

const handleCreateTeam = async () => {
  const name = newTeamName.value.trim();
  if (!name || submittingTeamAction.value) return;
  submittingTeamAction.value = true;
  try {
    await createTeam(name);
    showCreateModal.value = false;
    newTeamName.value = '';
  } catch (e: any) {
    addToast({ type: 'error', message: toUserMessage(e, "Couldn't create workspace — please try again.") });
  } finally {
    submittingTeamAction.value = false;
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
