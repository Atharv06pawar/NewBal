# 🚀 NEWBAL — Free Forever, Lifetime Open-Source ERP & TallyPrime Alternative

> **Universal Double-Entry Accounting, MCA Audit Trail, GST Compliance, Multi-Godown Inventory, Payroll, Banking & Cloud Sync.**
> 
> 🆓 **100% Free Lifetime** · 💳 **No Credit Card Required** · 🎓 **No Student ID Required** · 🔒 **Offline-First with Secure Cloud Sync** · 📱 **100% Responsive on All Devices**

---

## 🌟 Why NEWBAL Beats TallyPrime

| Feature | TallyPrime | NEWBAL |
|---|---|---|
| **Price** | ₹18,000 to ₹54,000+/yr | **₹0 Free Forever for Lifetime** |
| **Credit Card / Subscription** | Mandatory License Renewal | **Never Required** |
| **User Interface** | 1990s DOS-style UI | **Modern Responsive Glassmorphism UI (Mobile, Tablet & Desktop)** |
| **Keyboard Navigation** | F4-F9, Alt+G | **Full Tally Keyboard Shortcuts (<kbd>Alt+G</kbd>, <kbd>F4</kbd>–<kbd>F9</kbd>, <kbd>Esc</kbd>)** |
| **Authentication & Access** | Tally.NET license server | **Supabase Google OAuth, 2FA / Authenticator & Email Auth** |
| **Multi-Device Sync** | Paid Tally on Cloud / RDP | **1 Account Syncs Across All Devices (PC, Mac, iPhone, Android)** |
| **MCA Audit Trail** | Limited edit log add-on | **Built-in SHA-256 Tamper-Proof Cryptographic Verification (MCA Sec 128)** |
| **Tax Invoice PDF** | Monochrome printing | **Beautiful GST Invoices with 1-Click PDF Generation** |
| **GST Portal Export** | Complex JSON add-on | **1-Click Official GSTR-1 Government JSON Export** |
| **Document Vault** | Third-party document DMS | **Attach Genuine Vendor Invoices & Receipts directly to Vouchers** |
| **Manufacturing & BOM** | Add-on module | **Included: Multi-Component Assembly & Production Runs** |
| **Payroll & Payslips** | Costly Silver/Gold module | **Full PF, ESI, PT, Salary Run & PDF Payslips included** |
| **Bank Reconciliation (BRS)** | Manual / Paid Bank Feeds | **Automated Statement Auto-Matching included** |
| **Client Deployment** | Complex serial licensing | **1-Click Clone & `.env` Swap per client** |

---

## ⌨️ Tally-Style Hotkeys & Shortcuts

- <kbd>Alt</kbd> + <kbd>G</kbd> — **Go To Universal Search** (Instant search across all vouchers, ledgers, items, reports, and actions)
- <kbd>F4</kbd> — **Contra Voucher** (Bank to Cash / Cash to Bank / Bank to Bank transfers)
- <kbd>F5</kbd> — **Payment Voucher** (Expense and vendor payments)
- <kbd>F6</kbd> — **Receipt Voucher** (Customer and inward receipts)
- <kbd>F7</kbd> — **Journal Voucher** (Adjustment and depreciation entries)
- <kbd>F8</kbd> — **Sales Voucher** (Tax Invoice with itemized GST & auto PDF print)
- <kbd>F9</kbd> — **Purchase Voucher** (Vendor inward bills with input tax credit)
- <kbd>Esc</kbd> — Close any modal, drawer, or statement

---

## 📦 Core Modules & Production Architecture

1. **Double-Entry Accounting Core**:
   - 28 Standard Tally Account Groups (Capital, Current Assets, Sundry Debtors, Sundry Creditors, Duties & Taxes, etc.)
   - Dynamic Trial Balance (auto-verified DR = CR)
   - Real-time Balance Sheet (T-Shape side-by-side format)
   - Real-time Profit & Loss Statement (Trading Account with COGS + P&L with Net Margin)
   - Ledger Statements / Passbook drilldowns with running balances

2. **MCA Audit Trail & Tamper-Proof Security (MCA Section 128 / Rule 3)**:
   - SHA-256 Cryptographic Hash computed on every voucher creation and modification.
   - Comprehensive Edit Log: Timestamp, user identity, previous state, reason for edit, and hash chain.
   - 1-Click Audit Integrity Verification that validates zero tampering across financial history.

3. **GST Compliance Engine**:
   - GSTR-1 Outward Supplies (Table 4 B2B, Table 7 B2C, HSN/SAC breakdowns)
   - 1-Click Official Government GST Portal JSON Download
   - GSTR-3B Auto-Calculated Summary (Outward tax vs Input Tax Credit offset)
   - 15-Digit GSTIN Format & State Code Validator

4. **Multi-Godown Inventory & Manufacturing**:
   - Stock items with HSN codes, UOM (Pieces, Box, Kilograms), tax rates (0%, 5%, 12%, 18%, 28%)
   - Real-time FIFO Stock Valuation
   - Multiple Godowns / Warehouses
   - Bill of Materials (BOM) & Manufacturing Production Journals

5. **Payroll & HR Management**:
   - Employee Master with designations, PAN, and UAN PF numbers
   - CTC Salary Structure (Basic, HRA, Allowances, PF 12%, ESI, PT)
   - 1-Click Monthly Payroll processing that auto-computes deductions and auto-posts Salary Payment Vouchers to books
   - Official PDF Payslip generation and download

6. **Banking & Bank Reconciliation (BRS)**:
   - Multiple bank accounts tracking
   - Statement import & Auto-matching against Day Book vouchers
   - Standard Bank Reconciliation Statement (BRS) calculation

7. **Universal Document Attachment Vault**:
   - Genuine file attachment for vendor invoices, receipts, and proofs (PDF, JPEG, PNG).
   - Direct voucher embedding with quick preview and audit verification.

---

## 📱 Seamless Mobile & Multi-Device Responsiveness

NEWBAL is built from the ground up to adapt flawlessly to any screen size:
- **Mobile Phones (< 640px)**: Bottom thumb navigation bar, touch-friendly hamburger drawer, compact financial card views.
- **Tablets (640px – 1024px)**: Collapsible sidebar, flexible grids, adaptive modal layouts.
- **Laptops & Desktops (> 1024px)**: Full dual-column T-shape financial statements, split ledger view, and keyboard hotkeys.

---

## ☁️ 100% Free Forever Cloud Stack (Zero Cards, Zero Cost)

You do **not** need a credit card or student ID. Every service used has a generous perpetual free tier:

| Service | Purpose | Free Tier Limit | Requires Card? |
|---|---|---|---|
| **Supabase** | Cloud Auth, PostgreSQL & Realtime Sync | 500 MB DB, 50,000 MAU Auth | ❌ **No Card Needed** |
| **Cloudflare Pages** | Frontend Web Hosting (Global CDN) | Unlimited bandwidth & requests | ❌ **No Card Needed** |
| **Vercel** | Alternative Web Hosting | 100 GB Bandwidth, Unlimited SSL | ❌ **No Card Needed** |
| **GitHub** | Code Repository & CI/CD Pipelines | Unlimited public/private repos | ❌ **No Card Needed** |

---

## 🛠️ Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Start development servers
npm run dev
```

- Web App: `http://localhost:3000`
- Sync Server: `http://localhost:4000`

---

## 🚀 How to Deploy for New Clients (Multi-Tenant Made Simple)

When onboarding a new client, you don't need complex server setups:

### Step 1: Create a Free Supabase Project for the Client
1. Visit [supabase.com](https://supabase.com) and create a free account (no card needed).
2. Click **New Project** and name it after your client (e.g. `client-acme-books`).
3. In **Authentication -> Providers**, enable **Google** (or Email/Password).
4. Go to **Project Settings -> API** and copy:
   - `Project URL`
   - `anon public key`

### Step 2: Clone the Repo & Set Client `.env`
```bash
git clone https://github.com/Atharv06pawar/NewBal.git client-name
cd client-name
cp .env.example apps/web/.env
```

Edit `apps/web/.env`:
```env
VITE_SUPABASE_URL=https://your-client-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-client-anon-key
```

### Step 3: Deploy to Cloudflare Pages (Free Forever)
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) -> **Workers & Pages** -> **Create application** -> **Pages**.
2. Connect your GitHub repository.
3. Configure build settings:
   - **Framework preset**: `Vite`
   - **Build command**: `npm --workspace=apps/web run build`
   - **Build output directory**: `apps/web/dist`
   - **Environment variables**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Click **Save and Deploy**. Your client has their own secure, private accounting cloud in under 2 minutes!

---

## 📜 Quality Assurance & Verification
Run the automated test suites at any time:
```bash
# Accounting double-entry, GST and payroll test suite:
node scripts/verify-accounting.mjs

# Cross-device cloud sync test suite:
node scripts/verify-sync.mjs
```

---

## 📄 License
MIT License — 100% Free and Open Source forever.
