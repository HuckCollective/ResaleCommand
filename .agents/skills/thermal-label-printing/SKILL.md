---
name: thermal-label-printing
description: Comprehensive standards, hardware calibration, barcode authority, and CSS layout guidelines for direct thermal label printing (Rollo, Zebra, Dymo, Munbyn) across antique mall booths (Memory Den Ricochet POS, DustyTiger), jewelry butterfly tags, and backstock bins.
---

# Thermal Label & Barcode Printing Engineering SOP

## 1. Executive Summary & Purpose
In physical resale operations (antique malls, vintage co-ops, consignment boutiques, and warehouse backstock), physical thermal barcode printing is mission-critical. If a barcode is unreadable by optical laser scanners, misaligned on continuous thermal rolls, or encodes the wrong inventory authority ID, cashiers cannot ring up items at POS registers.

This skill establishes the universal hardware profiles, Barcode Authority rules, CSS print-media invariants, and physical tag geometries—specifically standard tags (`2x1"`, `2.25x1.25"`, `3x2"`, `4x6"`) and **Jewelry Barbell / Butterfly Tags** (`2.2x0.5"` compatible with Ricochet POS).

---

## 2. Multi-Venue Barcode Authority Matrix

Each sales channel uses distinct register scanning hardware and backend inventory models:

| Destination Venue | Register Scan Authority | Target Field | Human-Readable Caption | Tag Type Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Memory Den Booth (`MD`)** | **Ricochet POS SKU** (e.g. `0EJ0NO`) | `item.locationSku` | `0EJ0NO • HUCK-1471` | `2x1"` Shelf Tag or `butterfly` (`2.2x0.5"`) |
| **Jewelry / Rings / Chains** | **Ricochet POS SKU** (e.g. `0EJ0NO`) | `item.locationSku` | Left: Price/Title, Right: SKU | **Butterfly Barbell** (`2.2x0.5"`) |
| **DustyTiger (`DT`)** | Custom Vendor Hangtag | `item.sku` / `item.upc` | `DUSTY • Price • Title` | `2.25x1.25"` Hangtag Sticker |
| **Backstock / Warehouse Bin** | Internal HUCK UPC | `item.upc` | `HUCK-XXXX • Bin Loc` | `2x1"` Bin Tag or `3x2"` Tote Tag |
| **Online / E-Commerce** | Master UPC-A / Code128 | `item.upc` | Full Item Title & UPC | `4x6"` Shipping / Pack Slip |

> [!IMPORTANT]
> **The Ricochet POS Invariant**:
> At Memory Den registers, cashiers scan the **6-character Ricochet SKU** (`locationSku`), NOT the internal HUCK UPC. If `locationSku` is missing, the scanner cannot resolve the item in Ricochet's cloud inventory. Barcode generation MUST prefer `locationSku` whenever present.

---

## 3. Label Form Factors & Physical Geometries

```
Standard 2" × 1" Shelf Tag
┌──────────────────────────────────────────────┐
│ MEMORY DEN                          $18.00   │
│ Vintage Brass Candlestick Holders            │
│ █ █ ██ █ ███ ██ █ ██ ███ █ ██ ███ █ ███ █    │
│                 0EJ0MG • HUCK-1471           │
└──────────────────────────────────────────────┘

Ricochet Jewelry Barbell / Butterfly Tag (2.2" × 0.5")
┌─────────────────┬──────────────────┬─────────────────┐
│  LEFT PADDLE    │   CENTER BRIDGE  │  RIGHT PADDLE   │
│  (Wraps Ring)   │  (Non-Adhesive)  │  (Scannable)    │
│ MEMORY DEN      │                  │ █ ██ █ ███ ██ █ │
│ $45.00          │  (EMPTY / CLEAR) │     0EJ0J1      │
│ 14K OPAL RING   │                  │                 │
└─────────────────┴──────────────────┴─────────────────┘
  ◄──── 0.8" ────►◄───── 0.6" ──────►◄──── 0.8" ─────►
```

### A. Supported Form Factors
1. **`butterfly` (`2.2x0.5"` / Dymo 30299 / Zebra 10010064 equivalent)**:
   - **Width**: `2.2in` (56mm), **Height**: `0.5in` (13mm).
   - **Left Wing (0.8in)**: Store Header (7px), Bold Price (11px), Micro Title (7px, max 14–16 characters).
   - **Center Bridge (0.6in)**: **Strictly Empty**. Non-adhesive clear tail wraps around ring band, earring post, or chain.
   - **Right Wing (0.8in)**: Compact 6-char Ricochet SKU Code128 barcode + SKU caption.
2. **`2x1` (`2.0in × 1.0in`)**:
   - Standard vintage booth price sticker. Fits 30–38 char tag titles, bold price, store header, and Code128 barcode.
3. **`2.25x1.25` (`2.25in × 1.25in`)**:
   - Standard retail apparel hangtag sticker.
4. **`3x2` (`3.0in × 2.0in`)**:
   - Boxed lots, bundle packs, framed art, and shelf bins.
5. **`4x6` (`4.0in × 6.0in`)**:
   - Master carton labels, shipping labels (USPS / UPS / Pirate Ship).

---

## 4. Thermal Print CSS & Hardware Invariants

Direct thermal printers (Rollo, Zebra, Munbyn, Dymo) print on continuous roll or fan-fold media using heat-sensitive paper (no ink or toner). Web-based printing must follow strict CSS rules to avoid feed stutter, blank skips, or raster fuzziness.

### A. Zero-Margin @page Directives
```css
@page {
  size: 2.2in 0.5in; /* Must match exact label stock */
  margin: 0;
}

* {
  box-sizing: border-box;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

.rollo-label {
  page-break-after: always;
  break-after: page;
  overflow: hidden;
}
```

### B. Pure 1-Bit Vector Barcode Rendering (`src/lib/barcode128.ts`)
- Thermal print heads operate at 203 DPI (8 dots/mm) or 300 DPI (12 dots/mm).
- Anti-aliased grayscale edges cause optical red laser scanners to reject barcodes.
- **Rule**: Barcodes MUST be rendered as crisp, pure 1-bit SVG vectors with exact module bar widths (`barWidth: 1.5` to `2.0px`) and mandatory 10x quiet zones on left and right borders.

---

## 5. Mac & Chrome Print Dialog Protocol (The 90° Rotation Fix)

When printing from Chrome on macOS to Rollo, Zebra, or Dymo:

### The Known macOS CUPS Bug:
The Rollo macOS CUPS driver contains `*LandscapeOrientation: Plus90`. Because a `2x1"` or `2.2x0.5"` tag has a width greater than its height, CUPS treats it as "landscape" and automatically rotates the job +90 degrees clockwise, which splits the label across two consecutive stickers on the roll.

### The Verified Solution:
1. **Force CUPS Defaults in macOS Terminal**:
   ```bash
   lpoptions -p Printer_ThermalPrinter -o PageSize=2x1 -o orientation-requested=3
   ```
   *(Setting `orientation-requested=3` forces 0° portrait orientation, overriding the automatic 90° tilt).*

2. **Bypass Chrome's Cached Dark-Mode Dialog with System Print Dialog**:
   - In Chrome, press **`Option + Command + P`** (<kbd>⌥ ⌘ P</kbd>) or click *"Print using system dialog..."* at the bottom of More Settings.
   - **Destination**: Select your Rollo thermal printer (`Printer_ThermalPrinter`).
   - **Paper Size**: Set to `2x1` (or `Den Label`).
   - **Margins**: Set to **None**.
   - **Orientation**: Ensure **Portrait** (0° rotation) is selected.
   - **Headers and Footers**: **Unchecked**.

---

## 6. Software Architecture & Verification Workbench

- **Print Generation Service**: [`src/lib/rolloLabelPrint.ts`](file:///Users/michaelstanley/Projects/ResaleCommand/src/lib/rolloLabelPrint.ts)
- **Vector Code128 Engine**: [`src/lib/barcode128.ts`](file:///Users/michaelstanley/Projects/ResaleCommand/src/lib/barcode128.ts)
- **UPC Authority Manager**: [`src/lib/upcAuthority.ts`](file:///Users/michaelstanley/Projects/ResaleCommand/src/lib/upcAuthority.ts)
- **Isolated Hardware Test Workbench**: Hosted at `/labels/test` ([`src/components/labels/RolloLabelTestWorkbench.vue`](file:///Users/michaelstanley/Projects/ResaleCommand/src/components/labels/RolloLabelTestWorkbench.vue)). Provides:
  - Quick test presets (Jewelry Opal Ring, Gothic Skull, Velvet Bolero, Pirate Hat)
  - Real-time physical preview mockup for both standard tags and butterfly jewelry barbell tags
  - 1-click test printing with calibration feed runs (3 continuous labels) to confirm gap sensor tracking
