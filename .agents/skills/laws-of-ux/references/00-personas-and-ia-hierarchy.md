# Generalized 9-Persona Ecosystem & 4-Tier IA Signal Hierarchy

This reference governs **who** uses each surface of **Works@TheHC** (`Resale Command`), their physical/device posture, their authorization/visibility boundary, and the strict **4-Tier Information Architecture (IA) Signal Hierarchy** that orders alerts, KPIs, tables, and drawers on every route.

---

## 1. The 9-Persona Ecosystem

| # | Persona | Primary Posture & Viewport | Information Class | Core Job-to-Be-Done (JTBD) |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **👑 Founder / Steward** | Desktop split-screen (`>=1024px`) + mobile quick-triage (`375–420px`) | **Voting Collective + Admin** (`canSeeCollectiveFinancials`, `isFounder`) | Respond to applicants & member messages fast, reconcile POS payouts, approve Commons labor, lock monthly settlements, manage role links. |
| **2** | **💎 Curator Partner** *(Universal base hat for voting members)* | Standing in thrift aisle / garage (`375–420px` 1-handed) + home desk lot-splitting | **Voting Collective** (`canSeeCollectiveFinancials`, `usesPrefix: true`) | Quick Scout items in `<5s`, split bulk lots, print clean `HUCK-XXXX`/`PDXGL-XXXX` tags, track cost-basis recovery & `70%` (or `35/35`) profit. |
| **3** | **📣 Promoter** | Mobile-first on booth floor (`375–420px`, camera + vertical video) | **Voting Collective** (`canSeeCollectiveFinancials`, `$0` inv) | Spot fresh booth drops needing reels, package Social Dropcasts without trademark traps, log verified Commons hours (`1h = 1h`), vote on proposals. |
| **4** | **🔥 Surplus Enabler** | On-foot at Memory Den `#0EJ` / Dusty Tiger / `HG` (`375–420px` + laptop w/ Rollo) | **Voting Collective** (`canSeeCollectiveFinancials`, `$0` inv) | Run Ricochet 2-way barcode verification (respecting the 3 Physical Tag Safety Laws), restock bins, pack `📦 Online Ready Bin` orders, log hours. |
| **5** | **🛠️ Builder (Dev, Design & Displays)** | Desktop IDE / CAD / workshop (`>=1024px`) + mobile screenshot bug capture | **Voting Collective** (`canSeeCollectiveFinancials`, `$0` inv) | Triages `💬 Co-op Messages & Bug Reports`, ships web/AI features, designs signage/labels, builds physical booth shelving & lighting, logs Commons hours. |
| **6** | **🏷️ Straight Consignor** | Mobile/tablet check-in (`375–768px`), low frequency (1–2×/mo) | **Isolated Own-Only** (`canVote: false`, **never** sees Collective Financials, Radar, Labor, or Join Queue) | Check personal sold items, verify transparent rent/commission deduction, and download clean monthly payout statements with zero co-op jargon. |
| **7** | **🌱 Prospective Applicant** | Mobile social bio link visitor on `/coop` & `/signup` (`375–420px`) | **Public Guest / Token-Scoped Owner** (`t` view / `v` verify tokens) | Understand how the Collective works in `<60s`, pick combinable hats (`Curator`, `Promoter`, `Enabler`, `Builder`, `Consignor`), verify email, and activate account in 1 click. |
| **8** | **🧪 Public `/demo` Explorer** | Cold visitor evaluating Works@TheHC on `/demo` (`375–1440px`) | **100% Fictional Sandbox** (Zero Appwrite reads/writes — `validate-templates.mjs` §14D) | Switch role lenses (`Curator`, `Promoter`, `Enabler`, `Builder`, `Consignor`, `Founder`) safely with realistic live-computed alerts and zero DB leakage. |
| **9** | **🛒 Physical & Online Shopper** | Standing at Booth `#0EJ`/`DT` reading a thermal tag or viewing an eBay/Dropcast listing | **External Retail Touchpoint** | Read crisp, high-contrast price + `0EJ` SKU + scannable barcode stickers, accurate condition notes, and honest secondary-market pricing. |

---

## 2. The 4-Tier IA Signal Hierarchy (Anti-Burial Contract)

Every dashboard, hub, and workbench MUST order information by **human and financial urgency**, never burying live human communication beneath static inventory lint:

1. **Tier 1 — Human-to-Human Signals *(Highest Priority — Frame 0 / Top Alert + Header/Dock Badges)*:**
   - **Rule `[LINT]`:** Whenever a real person is waiting on the Collective—verified **`📬 Join Requests`** (`join_requests`, `warning` severity), open **`💬 Co-op Messages & Bug Reports`** (`coop_messages`, `warning` severity), or active **`🗳️ Governance Votes`** (`vote_needed`, `warning` severity)—those signals MUST surface at `warning`/`error` priority in `<RoleAlertsGrid>`, display live count badges on the Header / `<DashboardCommandDock>`, and open their interactive review tray in **1 tap** (`#join-queue`, `#coop-messages`) without forcing a page reload or hunting through sub-tabs.
   - When `pendingJoinCount > 0`, `<JoinRequestsPanel>` renders **above** passive metric cards (directly below `<RoleAlertsGrid>`) on Founder / All-Hats lenses.
2. **Tier 2 — Money, Ledger & Physical Tag Safety Signals *(Frame 0–1)*:**
   - Sold items missing sale price (`error`), missing photos (`error`), unlinked POS register tickets (`warning`), stale register sync (`warning`), `MISMATCH_UPC` / `MISSING_IN_MD` physical tag checks, and Commons breakeven shortfalls (`warning`).
3. **Tier 3 — Role Operational Pulse & Primary Data Canvas *(Frame 1)*:**
   - Role-scoped KPI strips (`<KpiStatGrid>`), `My Inventory`, `My Statement`, `Labor This Week`, `Operations Radar`, or the route's primary `<table class="table">` + `<BottomActionDock>` / `<PaginationDock>`.
4. **Tier 4 — Reference Playbooks, Secondary Intakes & Steward Config *(Progressive Disclosure Only)*:**
   - IRS Schedule C Tax Playbook, Role Playbooks, Shared Online Storefront SOPs, manual CSV/demo uploaders (`SalesImportTray`), and global settings. Must stay tucked inside `<SlideOverDrawer>`, `<details>` disclosures, or Command Dock trays—never rendered as tall multi-paragraph explainer cards above operational queues.

---

## 3. Generalized Persona & IA Audit Checks (Required in `laws-of-ux` §4)

Whenever running a `laws-of-ux` audit on any route or component, always verify first:
- **Persona Visibility & Role Isolation `[LINT]`:** Does the view respect `canSeeCollectiveFinancials` so Persona #6 (`Consignor`) and Persona #8 (`/demo`) never leak collective/live records, while Personas #1–#5 (`Founder`, `Curator`, `Promoter`, `Enabler`, `Builder`) share full open-book visibility?
- **Posture-Matched Touch & Density `[LINT]`:** Do mobile/aisle postures (`<768px`) enforce `44×44px` (`h-11` / `btn-lg`) thumb targets and zero horizontal overflow, while desktop table postures (`md:`+) preserve high-density scanability?
- **Tier 1–4 Signal Ordering `[LINT]`:** Are Tier-1 Human-to-Human signals (`Join Requests`, `Co-op Messages`, `Votes`) elevated above static cards and wired to 1-tap trays instead of dead-end links?
