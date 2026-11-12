export interface TaxPlaybookRule {
  title: string;
  line: string;
  icon: string;
  tone: string;
  badge: string;
  body: string;
  warn?: boolean;
}

export const DEFAULT_TAX_PLAYBOOK_RULES: TaxPlaybookRule[] = [
  {
    title: 'Sourcing Mileage & Travel',
    line: 'Line 24a',
    icon: 'solar:routing-2-bold-duotone',
    tone: 'text-success',
    badge: 'badge-success text-success-content',
    body: 'Sourcing trips to thrift stores, estate sales, flea markets, and restocking trips to partner venues qualify for the standard IRS mileage rate. Logging 1,500 sourcing miles generates an immediate $1,000+ write-off against taxable income.',
  },
  {
    title: 'Booth Rent & Mall Fees',
    line: 'Line 20b',
    icon: 'solar:shop-2-bold-duotone',
    tone: 'text-info',
    badge: 'badge-info text-info-content',
    body: 'Monthly booth rental fees and consignment commission percentages deducted by vintage mall operators are 100% tax-deductible Operating Expenses under Rent for Business Property (Line 20b).',
  },
  {
    title: 'Online Marketplace Fees (eBay, Poshmark, Etsy)',
    line: 'Line 10',
    icon: 'solar:ticket-sale-bold-duotone',
    tone: 'text-primary',
    badge: 'badge-primary text-primary-content',
    body: 'Marketplace Final Value fees (10–20%), payment processing charges, insertion fees, and promoted listing ad spend are 100% tax-deductible commissions & fees under Schedule C Line 10.',
  },
  {
    title: 'Shipping Postage & Packaging Supplies',
    line: 'Line 22 & 27a',
    icon: 'solar:box-minimalistic-bold-duotone',
    tone: 'text-success',
    badge: 'badge-success text-success-content',
    body: 'Commercial shipping labels bought via Pirate Ship, eBay, or USPS are deductible under Line 27a (Postage). Boxes, poly mailers, bubble wrap, packing tape, and thermal printer labels are 100% deductible as Supplies (Line 22) in the year purchased.',
  },
  {
    title: 'Form 1099-K Gross vs. Net Tax Trap',
    line: 'Line 1–2',
    icon: 'solar:shield-warning-bold-duotone',
    tone: 'text-warning',
    badge: 'badge-warning text-warning-content',
    warn: true,
    body: 'Online platforms report GROSS buyer payments (including sales tax and buyer-paid shipping) to the IRS. Always reconcile marketplace fees, refunds, and shipping costs against gross receipts so you never pay income tax on money you never kept.',
  },
  {
    title: 'Software, POS & AI API',
    line: 'Line 27a',
    icon: 'solar:cpu-bolt-bold-duotone',
    tone: 'text-primary',
    badge: 'badge-primary text-primary-content',
    body: 'POS subscriptions, website hosting, and AI API usage for item scouting & OCR are 100% tax-deductible under Other Business Expenses (Line 27a).',
  },
  {
    title: 'Cash Purchases Without Receipts (Cohan Rule)',
    line: 'Cohan Rule',
    icon: 'solar:wallet-money-bold-duotone',
    tone: 'text-warning',
    badge: 'badge-warning text-warning-content',
    body: 'Under Cohan v. Commissioner, cash purchases at estate sales or flea markets remain deductible when backed by a contemporaneous 5-point log: Date, Item Description, Cash Amount, Vendor/Location, and Business Purpose + photo evidence.',
  },
  {
    title: 'Booth Fixtures Safe Harbor (<$2,500)',
    line: 'Safe Harbor',
    icon: 'solar:shield-check-bold',
    tone: 'text-accent',
    badge: 'badge-accent text-accent-content',
    body: 'Under the IRS De Minimis Safe Harbor election, tangible business equipment costing up to $2,500 per invoice (display showcases, garment racks, mannequins, thermal label printers) can be expensed immediately in Year 1.',
  },
];

