# Resale Command: Tax & Accounting Playbook

A practical guide to resale accounting, IRS tax deductions, pure expense purchase orders, cash purchases without receipts, and booth asset expensing for antique booth and multi-channel resellers.

---

## 1. Core Accounting Architecture: COGS vs. OpEx

Resale accounting hinges on strictly separating **Cost of Goods Sold (COGS)** from **Operating Expenses (OpEx)**.

### A. Cost of Goods Sold (COGS) — Inventory Costs
* **What it includes**:
  * Item purchase cost (winning bid, hammer price, thrift tag price).
  * Inbound shipping fees paid to receive inventory (e.g. ShopGoodwill shipping, freight).
  * Sales tax paid on inventory acquisition.
  * Inbound handling or auction surcharges.
* **Tax Timing (Matching Principle)**:
  * COGS is **NOT** deductible when you buy the inventory.
  * It is **only deducted in the tax year the item actually sells**.
  * Unsold inventory sits on your balance sheet as an asset.

### B. Operating Expenses (OpEx) — Current-Year Deductions
* **What it includes**:
  * Packaging and shipping supplies (bubble wrap, boxes, thermal labels, tape).
  * Cleaning and restoration chemicals (leather conditioner, Goo Gone, brass polish, replacement batteries).
  * Authentication fees (third-party authentication for luxury or collectibles).
  * Mileage and travel (fuel, bridge tolls, parking for sourcing trips or booth restocking).
  * Booth display hardware (shelving, hooks, lighting, mannequins, showcases).
  * Software subscriptions (Ricochet POS, domain, AI API credits).
* **Tax Timing (Immediate Relief)**:
  * Operating expenses are **100% deductible in the tax year incurred**, regardless of whether any inventory has sold!

---

## 2. "Pure Expense" Purchase Orders

Not every Purchase Order in Resale Command must contain resale inventory. Many POs are **Pure Operating Expenses** with zero line items.

### Common Pure Expense Scenarios:
1. **Packaging & Sourcing Supplies**:
   * *Vendor*: Amazon, Uline, Staples, or eBay.
   * *Items*: 1,000 thermal labels, 200 poly mailers, 4 rolls of bubble wrap.
   * *Accounting*: Deductible immediately under Supplies.
2. **Booth Buildout & Displays**:
   * *Vendor*: Home Depot, IKEA, Target, or Craigslist.
   * *Items*: Garment rolling racks, pegboard hooks, puck lights, glass display cases for Memory Den or DustyTiger.
   * *Accounting*: Deductible immediately under Shop Expenses or Safe Harbor.
3. **"Dry" Sourcing Trips (Zero Inventory Purchased)**:
   * *Scenario*: You drive 40 miles to a rural flea market or estate sale. You pay $15 for admission and $25 in gas, but find nothing worth buying.
   * *Accounting*: Create a PO with 0 items and log the $40 in Operating Expenses. This turns a "wasted trip" into a legitimate business tax deduction against your gross sales!

---

## 3. Cash Purchases Without Receipts (IRS Cohan Rule)

In vintage, antique, and estate sourcing, buying display fixtures, glass cases, and garment racks with cash from private individuals (Craigslist, Facebook Marketplace, yard sales, closing boutiques) is standard.

The IRS **does not strictly require a register receipt** under the established **Cohan Rule** (*Cohan v. Commissioner*), provided you maintain **credible, contemporaneous records**.

### The 5-Point Contemporaneous Log
To make cash purchases audit-proof, log the following five data points in Resale Command at the time of purchase:
1. **Date of Transaction**: (Approximate date if past).
2. **Item Description**: (e.g., *"Heavy-duty chrome rolling garment rack and vintage glass countertop case"*).
3. **Amount Paid in Cash**: (e.g., *$140.00 cash*).
4. **Source/Vendor**: (e.g., *"Craigslist private seller in Portland"* or *"Estate sale at 124 Elm St"*).
5. **Business Purpose**: (e.g., *"Retail display fixtures for Memory Den Booth MD1"*).

### Corroborating Secondary Evidence (Best Practices)
* **In-App Photo**: Take a quick photo of the rack or display case inside your booth or workshop. A timestamped photo proves the physical asset exists and is actively used for your resale business.
* **Message Thread Screenshot**: Save a screenshot of the Craigslist email, Marketplace chat, or SMS confirming the cash price and pickup.
* **Bank/ATM Record**: Note the date and amount of your cash withdrawal from your business or personal account.

---

## 4. Immediate Asset Write-Off (*De Minimis Safe Harbor*)

Under **Treasury Regulation § 1.263(a)-1(f)** (the IRS *De Minimis Safe Harbor Election*):
* Small business owners can immediately expense tangible property costing **up to $2,500 per invoice or item** rather than depreciating it over 5 to 7 years.
* **Qualifying Booth Assets**:
  * Glass showcases and counter displays (<$2,500)
  * Chrome garment racks and shelving units
  * Mannequins and dress forms
  * Thermal label printers and barcode scanners
* **How to Claim**: Your tax preparer attaches a simple one-page statement electing the *De Minimis Safe Harbor* to your annual Form 1040 Schedule C.

---

## 5. Multi-Channel Sales Matrix: Booths vs. Online Marketplaces vs. Cash

Different sales channels generate distinct tax deduction opportunities and reporting requirements for Huckleberry Collective LLC:

| Sales Channel | Schedule C Line | What's Deductible | Key IRS / Reporting Rule |
| :--- | :--- | :--- | :--- |
| **Online Marketplaces** *(eBay, Poshmark, Etsy, Mercari)* | **Line 10** (Commissions & Fees)<br>**Line 27a** (Shipping & Postage)<br>**Line 22** (Supplies)<br>**Line 2** (Returns & Allowances) | Final Value fees (10-20%), payment processing, Pirate Ship/USPS postage labels, boxes, poly mailers, bubble wrap, promoted ad spend | **1099-K Gross Trap**: Platforms report *gross customer charges*. You must deduct all seller fees, shipping postage, and refunds, or you pay tax on income you never received. |
| **Antique Malls / Booths** *(Memory Den, DustyTiger)* | **Line 20b** (Rent for Business Property)<br>**Line 10** (Commissions)<br>**Line 22 / Safe Harbor** (Fixtures) | Fixed monthly booth rent, consignment commission percentage cuts (10–15%), display shelving, chrome racks, price tags, barcode labels | Operating expenses are deductible immediately in current tax year regardless of item sell-through. |
| **Direct & Pop-up Sales** *(Craigslist, Flea Markets, Cash)* | **Line 27a** (Other Expenses / Event Fees)<br>**Line 10** (Payment Processing)<br>**Cohan Rule Log** | Flea market table admission fees, vendor permits, Square/Stripe/Venmo business payment fees (2.9% + $0.30) | No 1099-K issued. Maintain contemporaneous 5-point log and photo evidence for audit defense. |

---

## 6. Resale Command Feature Roadmap

Future app features to embed this knowledge directly into the user experience:

1. **Contextual Help Modal in PO Editor**:
   * An **"Accounting & Deductions Playbook"** modal button beside the *Operating Expenses* header.
2. **"Cash / No Receipt" Logging Assistant**:
   * A checkbox or badge in the PO expense form for *"Cash / No Receipt"*.
   * Prompts the user to snap a photo and auto-fills a structured Cohan Rule log entry.
3. **Sourcing Trip Mileage Calculator**:
   * A mileage input field (miles × $0.67 IRS rate) that automatically computes and populates the travel deduction for sourcing runs.
4. **1099-K Marketplace Reconciliation Tool**:
   * Automatic cross-referencing between eBay/Poshmark 1099-K Gross amounts and logged platform fees + postage expenses.
5. **Schedule C Tax Export**:
   * A one-click tax report separating **Cost of Goods Sold (Line 4)**, **Commissions & Fees (Line 10)**, **Supplies (Line 22)**, **Travel/Mileage (Line 24a)**, and **Other Expenses (Line 27a)**.
