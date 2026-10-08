// NEWBAL - Universal Types & Interfaces for Accounting, GST, Inventory, Payroll, Banking

export type AccountCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export interface Company {
  id: string;
  name: string;
  tradeName?: string;
  gstin?: string;
  pan?: string;
  email: string;
  phone: string;
  address: string;
  state: string;
  stateCode: string;
  pincode: string;
  financialYearStart: string; // YYYY-MM-DD
  booksBeginningFrom: string; // YYYY-MM-DD
  currencySymbol: string;
  currencyCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerGroup {
  id: string;
  companyId: string;
  name: string;
  parentGroupId?: string | null;
  category: AccountCategory;
  isPrimary: boolean;
  affectsGrossProfit?: boolean;
}

export interface Ledger {
  id: string;
  companyId: string;
  name: string;
  groupId: string;
  category: AccountCategory;
  openingBalance: number;
  openingBalanceType: 'DR' | 'CR';
  currentBalance?: number;
  currentBalanceType?: 'DR' | 'CR';
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  address?: string;
  state?: string;
  stateCode?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
  isBankOrCash?: boolean;
  creditPeriodDays?: number;
  creditLimit?: number;
}

export type VoucherType =
  | 'SALES'
  | 'PURCHASE'
  | 'PAYMENT'
  | 'RECEIPT'
  | 'CONTRA'
  | 'JOURNAL'
  | 'DEBIT_NOTE'
  | 'CREDIT_NOTE'
  | 'PAYROLL_VOUCHER';

export interface VoucherItemDetail {
  stockItemId: string;
  itemName: string;
  hsnCode?: string;
  godownId?: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPercent?: number;
  taxableAmount: number;
  gstRate: number; // e.g. 18 for 18%
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface VoucherEntry {
  id?: string;
  ledgerId: string;
  ledgerName: string;
  amount: number;
  type: 'DR' | 'CR';
  narration?: string;
}

export interface Voucher {
  id: string;
  companyId: string;
  voucherNumber: string;
  voucherType: VoucherType;
  date: string; // YYYY-MM-DD
  referenceNumber?: string;
  narration: string;
  partyLedgerId?: string;
  partyName?: string;
  isInterstate?: boolean;
  totalTaxableAmount?: number;
  totalCgst?: number;
  totalSgst?: number;
  totalIgst?: number;
  grandTotal: number;
  entries: VoucherEntry[];
  inventoryItems?: VoucherItemDetail[];
  status: 'POSTED' | 'DRAFT' | 'CANCELLED';
  eInvoiceDetails?: {
    irn?: string;
    ackNo?: string;
    ackDate?: string;
    signedQrCode?: string;
  };
  attachments?: string[];
  attachedDocument?: { name: string; type: string; base64: string };
  auditHash?: string;
  createdAt: string;
  updatedAt: string;
}

// Inventory
export interface StockGroup {
  id: string;
  companyId: string;
  name: string;
  parentGroupId?: string | null;
}

export interface UnitOfMeasure {
  id: string;
  symbol: string;
  formalName: string;
  decimalPlaces: number;
}

export interface Godown {
  id: string;
  companyId: string;
  name: string;
  address?: string;
  isDefault?: boolean;
}

export interface StockItem {
  id: string;
  companyId: string;
  name: string;
  groupId: string;
  unit: string;
  hsnCode?: string;
  gstRate: number; // 0, 5, 12, 18, 28
  openingQuantity: number;
  openingRate: number;
  openingValue: number;
  closingQuantity?: number;
  closingRate?: number;
  closingValue?: number;
  standardPurchaseRate: number;
  standardSalesRate: number;
  reorderLevel?: number;
  minimumStockLevel?: number;
  valuationMethod: 'FIFO' | 'AVG_COST' | 'LAST_PURCHASE';
  batchTrackingEnabled?: boolean;
}

export interface BillOfMaterialItem {
  stockItemId: string;
  quantity: number;
  unit: string;
}

export interface BillOfMaterials {
  id: string;
  companyId: string;
  finishedGoodItemId: string;
  bomName: string;
  outputQuantity: number;
  outputUnit: string;
  rawMaterials: BillOfMaterialItem[];
}

// Payroll
export interface Employee {
  id: string;
  companyId: string;
  employeeCode: string;
  name: string;
  designation: string;
  department: string;
  dateOfJoining: string;
  email: string;
  phone: string;
  pan?: string;
  aadhaar?: string;
  bankAccount?: string;
  bankIfsc?: string;
  bankName?: string;
  uanPf?: string;
  esiNumber?: string;
  status: 'ACTIVE' | 'RESIGNED' | 'ON_LEAVE';
}

export interface SalaryStructure {
  id: string;
  employeeId: string;
  effectiveFrom: string;
  basicSalary: number;
  hra: number;
  conveyanceAllowance: number;
  specialAllowance: number;
  medicalAllowance: number;
  pfDeductionRate: number; // usually 12%
  esiDeductionRate: number; // usually 0.75%
  professionalTax: number;
  tdsMonthly: number;
}

export interface PayrollRun {
  id: string;
  companyId: string;
  month: string; // YYYY-MM
  paymentDate: string;
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  recordsCount: number;
  status: 'COMPLETED' | 'DRAFT';
}

export interface Payslip {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  month: string;
  presentDays: number;
  totalDaysInMonth: number;
  basic: number;
  hra: number;
  conveyance: number;
  specialAllowance: number;
  grossEarnings: number;
  pfEmployee: number;
  esiEmployee: number;
  profTax: number;
  tds: number;
  totalDeductions: number;
  netSalary: number;
  status: 'PAID' | 'PENDING';
}

// Banking
export interface BankAccount {
  id: string;
  companyId: string;
  ledgerId: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  bookBalance: number;
  bankBalance?: number;
}

export interface BankStatementRow {
  id: string;
  bankAccountId: string;
  date: string;
  description: string;
  referenceNo?: string;
  debitAmount: number;
  creditAmount: number;
  balanceAfter: number;
  isReconciled: boolean;
  reconciledVoucherId?: string;
}

// GST Compliance
export interface GSTR1Summary {
  period: string;
  b2bInvoicesCount: number;
  b2bTaxableValue: number;
  b2bIgst: number;
  b2bCgst: number;
  b2bSgst: number;
  b2cLargeCount: number;
  b2cSmallCount: number;
  hsnSummaryCount: number;
  totalTaxLiability: number;
}

export interface GSTR3BSummary {
  period: string;
  outwardTaxableSupplies: number;
  outwardIgst: number;
  outwardCgst: number;
  outwardSgst: number;
  itcAvailableIgst: number;
  itcAvailableCgst: number;
  itcAvailableSgst: number;
  netTaxPayableIgst: number;
  netTaxPayableCgst: number;
  netTaxPayableSgst: number;
}

// Single Master Account & Cross-Device Sync
export interface ConnectedDevice {
  id: string;
  name: string;
  type: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'WEB';
  lastActive: string;
  isCurrent?: boolean;
}

export interface MasterAccount {
  id: string;
  email: string;
  fullName: string;
  businessName: string;
  syncPairCode: string; // 6-character fast device link pairing code, e.g. "NB-8842"
  plan: 'STANDARD' | 'ENTERPRISE' | 'LIFETIME_FREE';
  connectedDevices: ConnectedDevice[];
  lastSyncedAt?: string;
  autoSyncEnabled: boolean;
}

export interface SyncPayload {
  accountId: string;
  deviceId: string;
  timestamp: string;
  companies: Company[];
  ledgerGroups: LedgerGroup[];
  ledgers: Ledger[];
  vouchers: Voucher[];
  stockGroups: StockGroup[];
  stockItems: StockItem[];
  godowns: Godown[];
  unitsOfMeasure: UnitOfMeasure[];
  employees: Employee[];
  salaryStructures: SalaryStructure[];
  bankAccounts: BankAccount[];
}

