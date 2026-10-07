import Dexie, { type Table } from 'dexie';
import type {
  Company,
  LedgerGroup,
  Ledger,
  Voucher,
  StockGroup,
  StockItem,
  Godown,
  UnitOfMeasure,
  BillOfMaterials,
  Employee,
  SalaryStructure,
  PayrollRun,
  Payslip,
  BankAccount,
  BankStatementRow,
} from '@newbal/shared';

export interface AuditLog {
  id: string;
  companyId: string;
  timestamp: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'EXPORT';
  entity: string;
  entityId?: string;
  details: string;
  user: string;
}

export interface AppSetting {
  key: string;
  value: any;
}

export class NewbalDatabase extends Dexie {
  companies!: Table<Company, string>;
  ledgerGroups!: Table<LedgerGroup, string>;
  ledgers!: Table<Ledger, string>;
  vouchers!: Table<Voucher, string>;
  stockGroups!: Table<StockGroup, string>;
  stockItems!: Table<StockItem, string>;
  godowns!: Table<Godown, string>;
  unitsOfMeasure!: Table<UnitOfMeasure, string>;
  billOfMaterials!: Table<BillOfMaterials, string>;
  employees!: Table<Employee, string>;
  salaryStructures!: Table<SalaryStructure, string>;
  payrollRuns!: Table<PayrollRun, string>;
  payslips!: Table<Payslip, string>;
  bankAccounts!: Table<BankAccount, string>;
  bankStatementRows!: Table<BankStatementRow, string>;
  auditLogs!: Table<AuditLog, string>;
  settings!: Table<AppSetting, string>;

  constructor() {
    super('NewbalDB');
    this.version(1).stores({
      companies: 'id, name, gstin',
      ledgerGroups: 'id, companyId, name, parentGroupId, category',
      ledgers: 'id, companyId, name, groupId, category, gstin',
      vouchers: 'id, companyId, voucherNumber, voucherType, date, partyLedgerId, status',
      stockGroups: 'id, companyId, name',
      stockItems: 'id, companyId, name, groupId, hsnCode',
      godowns: 'id, companyId, name',
      unitsOfMeasure: 'id, symbol',
      billOfMaterials: 'id, companyId, finishedGoodItemId',
      employees: 'id, companyId, employeeCode, name, department, status',
      salaryStructures: 'id, employeeId',
      payrollRuns: 'id, companyId, month',
      payslips: 'id, payrollRunId, employeeId, month',
      bankAccounts: 'id, companyId, ledgerId',
      bankStatementRows: 'id, bankAccountId, date, isReconciled',
      auditLogs: 'id, companyId, timestamp, action, entity',
      settings: 'key',
    });
  }
}

export const db = new NewbalDatabase();
