---
name: social-marketing-and-drop-broadcasting
description: Standard Operating Procedure (SOP), AI persona heuristics, IP/trademark guardrails, multi-channel campaign taxonomy, and fast-packaging patterns for promoting Resale Command across social media.
---

# Social Marketing & Drop Broadcasting Standard Operating Procedure (SOP)

This standard codifies the business heuristics, IP/trademark boundaries, literary persona guidelines, and UI packaging patterns for promoting Resale Command, its physical antique mall booths (**Memory Den**, **Dusty Tiger**), popups, conventions, and e-commerce channels across social media.

---

## 1. Core Philosophy: Fast-Packaging Over Pure Automation

Resale marketing operates on momentum, authenticity, and visual speed. 

### The "Packaging Station" Principle
* Resale Command does **NOT** rely on fragile, black-box third-party social API auto-post bots that require complex OAuth renewals, break frequently, or get accounts flagged.
* Instead, the system operates as a **High-Speed Creative Packaging Engine**:
  1. Pulls or stages photos using our canonical camera & drag-drop patterns.
  2. Synthesizes rich, subculture-authentic copy using our AI Persona Engine.
  3. Previews the complete post in an interactive **Live Phone Simulator**.
  4. Provides **1-Click "Copy Caption"** and **1-Click "Download Photos (.zip)"**.
  5. The curator opens Instagram, TikTok, Facebook, or Threads and publishes natively in **under 15 seconds**.

---

## 2. The 4 Campaign Types

Social marketing in Resale Command is not limited to product drops. The studio supports four distinct post archetypes:

| Campaign Type | Objective | Source in App | Key Information Needed | Example |
| :--- | :--- | :--- | :--- | :--- |
| **1. Fresh Drop & Restock** | Drive foot traffic to physical booths; clear newly placed inventory fast. | Active Drop Manifests (Memory Den, Dusty Tiger) | Selling location, booth number, item titles, prices, shelf photos. | *"🚨 15 fresh gothic & dark academia pieces just landed at Memory Den Booth 42!"* |
| **2. Latest Finds & Hero Grails** | Spotlight exceptional high-ticket or rare treasures; build collector credibility. | Active Inventory Search / High-Value Filter | Maker provenance, era, construction details, condition notes. | *"1993 Tim Burton Nightmare Before Christmas Velvet Jacket — an authentic relic of 90s gothic cinema."* |
| **3. Popups, Conventions & Markets** | Rally local followers to attend in-person events; generate weekend hype. | Event Date / Location Inputs | Event name, venue address, dates/hours, booth/table number. | *"We're setting up at the Portland Oddities & Curiosities Expo this Saturday! Table 14."* |
| **4. Culture, Fashion & Vibe (Ad-Hoc)** | Build community, educate on subcultures, showcase styling, and entertain. | Ad-Hoc Photo Drop / Camera (No DB SKU required) | Theme topic (e.g. 90s Whimsigoth, TTRPG history, styling velvet). | *"Why 1990s velvet outerwear hits differently: a visual breakdown of decadent layering."* |

---

## 3. Intellectual Property (IP) & Commercial Fair Use Playbook

Resale marketing must strike a careful balance: **celebrating authentic brand pedigree while respecting author/creator intellectual property.**

### A. Authentic Brand Naming (Nominative Fair Use & First Sale Doctrine)
Under US Trademark Law (**First Sale Doctrine** and **Nominative Fair Use**), resellers have the absolute legal right to name genuine brands when selling authentic inventory:
* **Completely Legal & Mandatory**: Naming makers like *Pendleton*, *Levi's*, *Carhartt*, *Doc Martens*, *Disney*, *Patagonia*, *TSR*, *Sony*, etc.
* **Why it Matters**: Brand pedigree drives resale discovery, justified pricing, and hashtag traffic (`#vintagependleton`, `#madeinusa`, `#carharttwip`).
* **The Rule**: Always state the genuine brand name accurately. Never imply official corporate sponsorship, endorsement, or licensing.

### B. Aesthetic Personas vs Copyrighted Character Identities
To avoid infringing on living authors, creative estates, or trademarked fictional characters:
* **The Rule**: **Never directly impersonate trademarked character identities** (e.g. do not market as "Lestat de Lioncourt" or quote Anne Rice text word-for-word).
* **The Solution**: **Use Public Literary & Aesthetic Archetypes**. Copyright protects specific expressions and character names, but **does not protect genres, moods, or historical aesthetic movements**.

| Desired Vibe | Trademark Risk | Safe Public Aesthetic Archetype | Literary & Visual Anchor |
| :--- | :--- | :--- | :--- |
| **Anne Rice Vampire** | *Lestat de Lioncourt* | 🥀 **Gothic Decadence / Nocturnal Aristocrat** | 19th-century Romantic Gothic (Lord Byron, Mary Shelley, decadent velvet, antique candelabras, dark romance). |
| **Dark Scholar** | *Dead Poets Society / Harry Potter* | 🏛️ **Dark Academia & Antiquarian** | Moody libraries, leather-bound manuscripts, brass opticals, tweed, Latin marginalia. |
| **Cyber Hacker** | *William Gibson / Cyberpunk 2077* | 💾 **Cyberpunk & Retro-Tech** | Dystopian analog-future, neon, 90s netrunner counterculture, CRT monitors, retro-futurism. |
| **90s Witchy** | *Practical Magic / Charmed* | 🌙 **Whimsigoth & Victorian Oddities** | Celestial velvet, apothecary brass, botanical curiosities, dried florals, antique tarot. |
| **Vintage Curator** | *Antiques Roadshow* | 🍂 **Heritage Curator & Storyteller** | Warm Americana, heirloom patina, industrial workwear, mid-century preservation. |
| **Market / Expo** | Generic promo | 🎪 **Event & Popup Hype** | Warm, inviting, urgent in-person community gathering. |

### C. System Prompt Guardrails for AI Generation
When generating post copy via Gemini, the prompt MUST include these constraints:
1. *"Write 100% original creative prose inspired by the selected aesthetic tradition."*
2. *"Do not quote, scrape, or claim direct affiliation with copyrighted authors, movies, or trademarked character names."*
3. *"Highlight genuine brand names, material composition, and physical craftsmanship accurately under nominative fair use."*

---

## 4. UI Architecture & Canonical Application Patterns

Every screen in the Social Media Hub must strictly adhere to Resale Command's established UX conventions:

### A. The Two Image Paradigms in Resale Social Marketing
Resale social campaigns only ever deal with two types of visual assets:
1. **Item Images**: Inventory product photos (from active manifests or inventory). Attached to SKUs and edited via `ItemDrawer.vue` or direct drop onto cards.
2. **User-Provided (Booth / Context / Vibe) Images**: Real photos of booth shelving, store signage, or haul unboxing. Managed strictly via `PhotoGalleryManager.vue` at the top of the studio.

### B. Canonical Photo Intake: `PhotoGalleryManager.vue` MUST be Used for Booth Displays
* **Strict Anti-Pattern**: NEVER invent custom, ad-hoc photo rails or fragment actions across multiple buttons (e.g. `[Snap Booth Photo]` alongside `[Upload Booth Photo]` alongside an end card `[+ Snap Photo]`).
* **The Rule**: All booth display galleries and location intake MUST reuse `PhotoGalleryManager.vue` (the canonical component from `/scout` and `ItemDrawer`).
* **Why**: Users expect the exact same tactile dropzone, cover-photo starring (⭐), thumbnail reordering, zoom lightbox, and prominent camera trigger across every view.

### C. The Edit Drawer Pattern for Products (No Heavy Canvas Modals)
* **Anti-Pattern**: Do NOT build bespoke, heavy client-side canvas crop/editor modals for items.
* **Canonical Pattern**: Clicking "Edit Item & Photos" on any product card slides open the standard **`ItemDrawer.vue`**.
* Inside `ItemDrawer`, the user gets the full, battle-tested `PhotoGalleryManager.vue` with:
  - Setting the **Main Cover Photo (⭐)**.
  - Multi-photo gallery thumbnail strip.
  - Camera capture and high-res zoom lightbox.

### C. Social Grid Presentation
* Each product card on the social grid displays its **set Main Cover Photo (⭐)**.
* Cards include:
  - High-contrast multi-select checkbox (top-left).
  - Main Cover Photo star badge & photo count indicator (`📷 3 photos`).
  - Retail price badge (`$xx.xx`).
  - Action buttons: `✏️ Edit Item & Photos` (opens `ItemDrawer`), `📸 Camera`, `💾 Download Single`.

### D. Promotion vs. Logistics Separation & Mutual Exclusivity
* **Promotion (Dropcasts)** vs. **Logistics (Outbound Drops)**:
  - **Drop Manifests** (`LocationManifestTray.vue`) handle physical inventory movement: mutating status from `in-stock` $\rightarrow$ `placed`, updating warehouse bins to booth locations, exporting Ricochet CSVs, and driving Rollo label printing.
  - **Dropcasts** (`DropcastStagingTray.vue`) handle creative storytelling: bundling photos and AI-crafted captions for Instagram, TikTok, or Threads. **A Dropcast never moves items or modifies database storage locations.**
* **Mutual Exclusivity of Selection Trays**:
  - Curating a Dropcast tray automatically hides/pauses any open Outbound Drop manifest. The user is strictly focused on creative media selection rather than physical box packing.
* **The "Post-Drop" Broadcast Workflow**:
  - Once an Outbound Drop is successfully confirmed at a booth (`status: 'placed'`), the user can launch a Dropcast seeded with all items from that completed drop in 1 click, packaging fresh shelf photos with hero inventory for an immediate social announcement.

---

## 5. The DropCast Phone Simulator & Live Preview

The right column of the studio provides a realistic **Smartphone Simulator Frame**:
1. **Device Shell**: Rounded iPhone/mobile frame with top dynamic island notch, status bar, and home indicator.
2. **Profile Bar**: Store avatar, location handle (`@memorydenvintage` or `@dustytiger`), and physical location tag.
3. **Carousel Viewport**:
   * Interactive `<` and `>` arrow buttons to slide through all selected product photos and booth display photos in sequence.
   * Slide indicator pill (`1 / 8`).
4. **Social Action Bar**: Interactive like heart, comment bubble, share arrow, and bookmark ribbon.
5. **Formatted Caption Viewport**:
   * Displays the generated copy with actual line breaks, bullet points, price tags, and highlighted hashtags.
6. **Bottom Packaging Controls**:
   * `📋 Copy Caption` (instant clipboard copy with toast feedback).
   * `📦 Download All Photos (.zip)` (bundles products + booth photos with clean sanitized filenames).

---

## 6. Implementation Checklist for Agents

When implementing or modifying social media tools in Resale Command:
- [ ] Ensure **all 4 Campaign Modes** (Drop, Inventory, Event, Ad-hoc) are accessible.
- [ ] Wire item editing directly to **`ItemDrawer.vue`**; never introduce separate canvas crop modals.
- [ ] Provide high-contrast **multi-select checkboxes** on all cards with batch ZIP download.
- [ ] Use **IP-safe Aesthetic Archetypes** in persona pickers (Gothic Decadence, Dark Academia, Cyberpunk, Whimsigoth, Heritage).
- [ ] Actively celebrate genuine **brands** under nominative fair use in prompts and hashtags.
- [ ] Include the **Phone Simulator Preview** with live carousel swiping.
- [ ] Verify zero linter/compiler errors with `node scripts/validate-templates.mjs`.
