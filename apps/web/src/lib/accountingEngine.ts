import { db } from './db';
import type { Ledger, Voucher, LedgerGroup } from '@newbal/shared';

export interface LedgerBalanceSummary {
  ledger: Ledger;
  group?: LedgerGroup;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  closingBalanceType: 'DR' | 'CR';
}

export interface TrialBalanceItem {
  ledgerId: string;
  ledgerName: string;
  groupName: string;
  category: string;
  debit: number;
  credit: number;
}

export interface ProfitLossReport {
  grossSales: number;
  salesReturns: number;
  netSales: number;
  directIncomes: number;
  openingStock: number;
  purchases: number;
  directExpenses: number;
  closingStock: number;
  costOfGoodsSold: number;
  grossProfit: number;
  indirectIncomes: number;
  indirectExpenses: number;
  netProfit: number;
  incomeLines: { name: string; amount: number }[];
  expenseLines: { name: string; amount: number }[];
}

export interface BalanceSheetReport {
  asOnDate: string;
  liabilities: {
    capitalAccount: { name: string; amount: number }[];
    netProfit: number;
    loans: { name: string; amount: number }[];
    currentLiabilities: { name: string; amount: number }[];
    totalLiabilities: number;
  };
  assets: {
    fixedAssets: { name: string; amount: number }[];
    investments: { name: string; amount: number }[];
    currentAssets: {
      cashAndBank: { name: string; amount: number }[];
      debtors: { name: string; amount: number }[];
      closingStock: number;
      otherCurrentAssets: { name: string; amount: number }[];
    };
    totalAssets: number;
  };
  differenceInBooks: number;
}

export class AccountingEngine {
  /**
   * Calculate closing balance for all ledgers for a given company
   */
  static async getLedgerBalances(companyId: string, upToDate?: string): Promise<Map<string, LedgerBalanceSummary>> {
    const ledgers = await db.ledgers.where('companyId').equals(companyId).toArray();
    const groups = await db.ledgerGroups.where('companyId').equals(companyId).toArray();
    const groupMap = new Map(groups.map((g) => [g.id, g]));

    let voucherQuery = db.vouchers.where('companyId').equals(companyId);
    let vouchers = await voucherQuery.toArray();

    if (upToDate) {
      vouchers = vouchers.filter((v) => v.date <= upToDate && v.status === 'POSTED');
    } else {
      vouchers = vouchers.filter((v) => v.status === 'POSTED');
    }

    const resultMap = new Map<string, LedgerBalanceSummary>();

    for (const led of ledgers) {
      const group = groupMap.get(led.groupId);
      let totalDr = 0;
      let totalCr = 0;

      // Add opening balance
      if (led.openingBalance > 0) {
        if (led.openingBalanceType === 'DR') {
          totalDr += led.openingBalance;
        } else {
          totalCr += led.openingBalance;
        }
      }

      // Add transactions
      for (const vch of vouchers) {
        for (const entry of vch.entries) {
          if (entry.ledgerId === led.id) {
            if (entry.type === 'DR') {
              totalDr += entry.amount;
            } else {
              totalCr += entry.amount;
            }
          }
        }
      }

      // Determine closing balance
      // ASSET & EXPENSE are normally Debit balances
      // LIABILITY, EQUITY & INCOME are normally Credit balances
      let closingBalance = 0;
      let closingType: 'DR' | 'CR' = 'DR';

      if (totalDr >= totalCr) {
        closingBalance = totalDr - totalCr;
        closingType = 'DR';
      } else {
        closingBalance = totalCr - totalDr;
        closingType = 'CR';
      }

      resultMap.set(led.id, {
        ledger: led,
        group,
        totalDebit: totalDr,
        totalCredit: totalCr,
        closingBalance,
        closingBalanceType: closingType,
      });
    }

    return resultMap;
  }

  /**
   * Compute full Trial Balance
   */
  static async getTrialBalance(companyId: string, asOnDate?: string): Promise<{ items: TrialBalanceItem[]; totalDebit: number; totalCredit: number; isBalanced: boolean }> {
    const balances = await this.getLedgerBalances(companyId, asOnDate);
    const items: TrialBalanceItem[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const summary of balances.values()) {
      if (summary.closingBalance === 0) continue;

      const dr = summary.closingBalanceType === 'DR' ? summary.closingBalance : 0;
      const cr = summary.closingBalanceType === 'CR' ? summary.closingBalance : 0;

      totalDebit += dr;
      totalCredit += cr;

      items.push({
        ledgerId: summary.ledger.id,
        ledgerName: summary.ledger.name,
        groupName: summary.group?.name || 'General',
        category: summary.ledger.category,
        debit: dr,
        credit: cr,
      });
    }

    // Sort by Category then Name
    items.sort((a, b) => a.ledgerName.localeCompare(b.ledgerName));

    const diff = Math.abs(totalDebit - totalCredit);
    const isBalanced = diff < 0.01;

    return { items, totalDebit, totalCredit, isBalanced };
  }

  /**
   * Compute Stock-in-hand valuation
   */
  static async getStockValuation(companyId: string): Promise<{ totalValue: number; itemsCount: number }> {
    const items = await db.stockItems.where('companyId').equals(companyId).toArray();
    let totalValue = 0;
    for (const item of items) {
      const qty = item.closingQuantity ?? item.openingQuantity;
      const rate = item.closingRate ?? item.openingRate;
      totalValue += qty * rate;
    }
    return { totalValue, itemsCount: items.length };
  }

  /**
   * Compute Profit and Loss Statement
   */
  static async getProfitAndLoss(companyId: string, toDate?: string): Promise<ProfitLossReport> {
    const balances = await this.getLedgerBalances(companyId, toDate);
    const stock = await this.getStockValuation(companyId);

    let grossSales = 0;
    let directIncomes = 0;
    let purchases = 0;
    let directExpenses = 0;
    let indirectIncomes = 0;
    let indirectExpenses = 0;

    const incomeLines: { name: string; amount: number }[] = [];
    const expenseLines: { name: string; amount: number }[] = [];

    for (const b of balances.values()) {
      const amt = b.closingBalance;
      if (amt === 0) continue;

      if (b.group?.id === 'grp-sales-acc' || b.ledger.name.toLowerCase().includes('sales')) {
        grossSales += amt;
      } else if (b.group?.id === 'grp-purchase-acc' || b.ledger.name.toLowerCase().includes('purchase')) {
        purchases += amt;
      } else if (b.ledger.category === 'INCOME') {
        if (b.group?.affectsGrossProfit) {
          directIncomes += amt;
        } else {
          indirectIncomes += amt;
          incomeLines.push({ name: b.ledger.name, amount: amt });
        }
      } else if (b.ledger.category === 'EXPENSE') {
        if (b.group?.affectsGrossProfit) {
          directExpenses += amt;
        } else {
          indirectExpenses += amt;
          expenseLines.push({ name: b.ledger.name, amount: amt });
        }
      }
    }

    const openingStock = 0; // standard start
    const closingStock = stock.totalValue;
    const costOfGoodsSold = openingStock + purchases + directExpenses - closingStock;
    const grossProfit = grossSales + directIncomes - (purchases + directExpenses);
    const netProfit = grossProfit + indirectIncomes - indirectExpenses;

    return {
      grossSales,
      salesReturns: 0,
      netSales: grossSales,
      directIncomes,
      openingStock,
      purchases,
      directExpenses,
      closingStock,
      costOfGoodsSold,
      grossProfit,
      indirectIncomes,
      indirectExpenses,
      netProfit,
      incomeLines,
      expenseLines,
    };
  }

  /**
   * Compute Balance Sheet
   */
  static async getBalanceSheet(companyId: string, asOnDate?: string): Promise<BalanceSheetReport> {
    const balances = await this.getLedgerBalances(companyId, asOnDate);
    const pnl = await this.getProfitAndLoss(companyId, asOnDate);
    const stock = await this.getStockValuation(companyId);

    const capitalAccount: { name: string; amount: number }[] = [];
    const loans: { name: string; amount: number }[] = [];
    const currentLiabilities: { name: string; amount: number }[] = [];

    const fixedAssets: { name: string; amount: number }[] = [];
    const investments: { name: string; amount: number }[] = [];
    const cashAndBank: { name: string; amount: number }[] = [];
    const debtors: { name: string; amount: number }[] = [];
    const otherCurrentAssets: { name: string; amount: number }[] = [];

    for (const b of balances.values()) {
      const amt = b.closingBalance;
      if (amt === 0) continue;

      const groupName = b.group?.name.toLowerCase() || '';

      // Liabilities & Equity
      if (b.ledger.category === 'EQUITY' || groupName.includes('capital')) {
        capitalAccount.push({ name: b.ledger.name, amount: amt });
      } else if (groupName.includes('loan')) {
        loans.push({ name: b.ledger.name, amount: amt });
      } else if (b.ledger.category === 'LIABILITY' || groupName.includes('liabilit') || groupName.includes('creditor') || groupName.includes('duties')) {
        currentLiabilities.push({ name: b.ledger.name, amount: amt });
      }

      // Assets
      if (groupName.includes('fixed asset')) {
        fixedAssets.push({ name: b.ledger.name, amount: amt });
      } else if (groupName.includes('investment')) {
        investments.push({ name: b.ledger.name, amount: amt });
      } else if (b.ledger.isBankOrCash || groupName.includes('bank') || groupName.includes('cash')) {
        cashAndBank.push({ name: b.ledger.name, amount: amt });
      } else if (groupName.includes('debtor')) {
        debtors.push({ name: b.ledger.name, amount: amt });
      } else if (b.ledger.category === 'ASSET' && !groupName.includes('capital')) {
        otherCurrentAssets.push({ name: b.ledger.name, amount: amt });
      }
    }

    const totalCap = capitalAccount.reduce((s, i) => s + i.amount, 0) + pnl.netProfit;
    const totalLoans = loans.reduce((s, i) => s + i.amount, 0);
    const totalCurrLiab = currentLiabilities.reduce((s, i) => s + i.amount, 0);
    const totalLiabilities = totalCap + totalLoans + totalCurrLiab;

    const totalFixed = fixedAssets.reduce((s, i) => s + i.amount, 0);
    const totalInv = investments.reduce((s, i) => s + i.amount, 0);
    const totalCashBank = cashAndBank.reduce((s, i) => s + i.amount, 0);
    const totalDebtors = debtors.reduce((s, i) => s + i.amount, 0);
    const totalOtherCA = otherCurrentAssets.reduce((s, i) => s + i.amount, 0);
    const totalAssets = totalFixed + totalInv + totalCashBank + totalDebtors + stock.totalValue + totalOtherCA;

    return {
      asOnDate: asOnDate || new Date().toISOString().split('T')[0],
      liabilities: {
        capitalAccount,
        netProfit: pnl.netProfit,
        loans,
        currentLiabilities,
        totalLiabilities,
      },
      assets: {
        fixedAssets,
        investments,
        currentAssets: {
          cashAndBank,
          debtors,
          closingStock: stock.totalValue,
          otherCurrentAssets,
        },
        totalAssets,
      },
      differenceInBooks: Math.abs(totalLiabilities - totalAssets),
    };
  }

  /**
   * Ledger Statement (Drilldown / Passbook)
   */
  static async getLedgerStatement(companyId: string, ledgerId: string): Promise<{
    ledger: Ledger;
    openingBalance: number;
    openingBalanceType: 'DR' | 'CR';
    entries: {
      date: string;
      voucherNumber: string;
      voucherType: string;
      particulars: string;
      debit: number;
      credit: number;
      runningBalance: number;
      balanceType: 'DR' | 'CR';
      narration: string;
    }[];
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
    closingBalanceType: 'DR' | 'CR';
  } | null> {
    const ledger = await db.ledgers.get(ledgerId);
    if (!ledger) return null;

    const vouchers = await db.vouchers
      .where('companyId')
      .equals(companyId)
      .filter((v) => v.status === 'POSTED')
      .sortBy('date');

    const entries: any[] = [];
    let runningBalance = ledger.openingBalance;
    let balanceType = ledger.openingBalanceType;
    let totalDebit = ledger.openingBalanceType === 'DR' ? ledger.openingBalance : 0;
    let totalCredit = ledger.openingBalanceType === 'CR' ? ledger.openingBalance : 0;

    for (const v of vouchers) {
      const match = v.entries.find((e) => e.ledgerId === ledgerId);
      if (match) {
        const opposingEntries = v.entries.filter((e) => e.ledgerId !== ledgerId);
        const particulars = opposingEntries.map((e) => e.ledgerName).join(', ') || v.narration;

        const debit = match.type === 'DR' ? match.amount : 0;
        const credit = match.type === 'CR' ? match.amount : 0;

        totalDebit += debit;
        totalCredit += credit;

        // compute running balance
        if (balanceType === 'DR') {
          runningBalance = runningBalance + debit - credit;
          if (runningBalance < 0) {
            runningBalance = Math.abs(runningBalance);
            balanceType = 'CR';
          }
        } else {
          runningBalance = runningBalance + credit - debit;
          if (runningBalance < 0) {
            runningBalance = Math.abs(runningBalance);
            balanceType = 'DR';
          }
        }

        entries.push({
          date: v.date,
          voucherNumber: v.voucherNumber,
          voucherType: v.voucherType,
          particulars,
          debit,
          credit,
          runningBalance,
          balanceType,
          narration: v.narration,
        });
      }
    }

    let closingBalance = 0;
    let closingBalanceType: 'DR' | 'CR' = 'DR';
    if (totalDebit >= totalCredit) {
      closingBalance = totalDebit - totalCredit;
      closingBalanceType = 'DR';
    } else {
      closingBalance = totalCredit - totalDebit;
      closingBalanceType = 'CR';
    }

    return {
      ledger,
      openingBalance: ledger.openingBalance,
      openingBalanceType: ledger.openingBalanceType,
      entries,
      totalDebit,
      totalCredit,
      closingBalance,
      closingBalanceType,
    };
  }

  /**
   * GST Return Summaries (GSTR-1 and GSTR-3B)
   */
  static async getGSTSummary(companyId: string, monthYear?: string) {
    const vouchers = await db.vouchers
      .where('companyId')
      .equals(companyId)
      .filter((v) => v.status === 'POSTED')
      .toArray();

    const salesVouchers = vouchers.filter((v) => v.voucherType === 'SALES');
    const purchaseVouchers = vouchers.filter((v) => v.voucherType === 'PURCHASE');

    // Outward Supplies (GSTR-1 / GSTR-3B Table 3.1)
    let outwardTaxable = 0;
    let outwardCgst = 0;
    let outwardSgst = 0;
    let outwardIgst = 0;
    let b2bCount = 0;
    let b2cCount = 0;

    for (const s of salesVouchers) {
      outwardTaxable += s.totalTaxableAmount || 0;
      outwardCgst += s.totalCgst || 0;
      outwardSgst += s.totalSgst || 0;
      outwardIgst += s.totalIgst || 0;

      if (s.partyLedgerId) {
        b2bCount++;
      } else {
        b2cCount++;
      }
    }

    // Input Tax Credit (ITC - GSTR-3B Table 4)
    let itcTaxable = 0;
    let itcCgst = 0;
    let itcSgst = 0;
    let itcIgst = 0;

    for (const p of purchaseVouchers) {
      itcTaxable += p.totalTaxableAmount || 0;
      itcCgst += p.totalCgst || 0;
      itcSgst += p.totalSgst || 0;
      itcIgst += p.totalIgst || 0;
    }

    // Net Tax Payable
    const netCgstPayable = Math.max(0, outwardCgst - itcCgst);
    const netSgstPayable = Math.max(0, outwardSgst - itcSgst);
    const netIgstPayable = Math.max(0, outwardIgst - itcIgst);
    const totalNetPayable = netCgstPayable + netSgstPayable + netIgstPayable;

    return {
      period: monthYear || 'Current Fiscal Year',
      outward: {
        totalTaxable: outwardTaxable,
        cgst: outwardCgst,
        sgst: outwardSgst,
        igst: outwardIgst,
        totalTax: outwardCgst + outwardSgst + outwardIgst,
        b2bCount,
        b2cCount,
        invoices: salesVouchers,
      },
      itc: {
        totalTaxable: itcTaxable,
        cgst: itcCgst,
        sgst: itcSgst,
        igst: itcIgst,
        totalItc: itcCgst + itcSgst + itcIgst,
        purchases: purchaseVouchers,
      },
      netPayable: {
        cgst: netCgstPayable,
        sgst: netSgstPayable,
        igst: netIgstPayable,
        total: totalNetPayable,
      },
    };
  }
}
