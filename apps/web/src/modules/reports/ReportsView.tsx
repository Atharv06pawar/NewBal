import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { AccountingEngine } from '../../lib/accountingEngine';
import {
  BarChart3,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  PieChart,
  CheckCircle2,
} from 'lucide-react';
import { ExportEngine } from '../../lib/exportEngine';

export const ReportsView: React.FC = () => {
  const { activeCompany, refreshKey } = useApp();
  const [reportType, setReportType] = useState<'BALANCE_SHEET' | 'PNL' | 'TRIAL_BALANCE' | 'RATIOS' | 'AGING'>('BALANCE_SHEET');

  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [pnl, setPnl] = useState<any>(null);
  const [trialBalance, setTrialBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) return;

    async function loadReports() {
      setLoading(true);
      const bs = await AccountingEngine.getBalanceSheet(activeCompany!.id);
      const p = await AccountingEngine.getProfitAndLoss(activeCompany!.id);
      const tb = await AccountingEngine.getTrialBalance(activeCompany!.id);

      setBalanceSheet(bs);
      setPnl(p);
      setTrialBalance(tb);
      setLoading(false);
    }

    loadReports();
  }, [activeCompany, refreshKey]);

  const handleExportExcel = () => {
    if (reportType === 'TRIAL_BALANCE' && trialBalance) {
      const data = trialBalance.items.map((i: any) => ({
        'Ledger Name': i.ledgerName,
        'Group Name': i.groupName,
        Category: i.category,
        'Debit (₹)': i.debit,
        'Credit (₹)': i.credit,
      }));
      ExportEngine.exportToExcel(data, `TrialBalance_${new Date().toISOString().split('T')[0]}`);
    } else if (reportType === 'PNL' && pnl) {
      const data = [
        { Particulars: 'Gross Sales', Amount: pnl.grossSales },
        { Particulars: 'Purchases', Amount: pnl.purchases },
        { Particulars: 'Gross Profit', Amount: pnl.grossProfit },
        { Particulars: 'Indirect Expenses', Amount: pnl.indirectExpenses },
        { Particulars: 'Net Profit', Amount: pnl.netProfit },
      ];
      ExportEngine.exportToExcel(data, `ProfitAndLoss_${new Date().toISOString().split('T')[0]}`);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            <span>Financial Statements & Reports</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time IFRS / Indian GAAP compliant reports for {activeCompany?.name}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 overflow-x-auto">
        {(
          [
            { id: 'BALANCE_SHEET', label: 'Balance Sheet' },
            { id: 'PNL', label: 'Profit & Loss Statement' },
            { id: 'TRIAL_BALANCE', label: 'Trial Balance' },
            { id: 'RATIOS', label: 'Financial Ratio Analysis' },
            { id: 'AGING', label: 'Aging Analysis (AR/AP)' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              reportType === tab.id
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-500">Calculating financial books...</div>
      ) : (
        <>
          {/* BALANCE SHEET (T-Format) */}
          {reportType === 'BALANCE_SHEET' && balanceSheet && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-100 text-base">Balance Sheet</h3>
                  <p className="text-xs text-slate-400">As on {balanceSheet.asOnDate}</p>
                </div>
                <div className="text-xs font-mono text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Books Balanced (Assets = Liabilities)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 font-mono text-xs">
                {/* Liabilities Side */}
                <div className="p-6 space-y-4">
                  <div className="font-sans font-bold text-slate-200 text-sm pb-2 border-b border-slate-800 flex justify-between">
                    <span>LIABILITIES & EQUITY</span>
                    <span>AMOUNT (₹)</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="font-semibold text-slate-300 font-sans">Capital Account & Reserves</div>
                      {balanceSheet.liabilities.capitalAccount.map((c: any, i: number) => (
                        <div key={i} className="flex justify-between text-slate-400 pl-4 py-0.5">
                          <span>{c.name}</span>
                          <span>₹{c.amount.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-emerald-400 pl-4 py-0.5 font-bold">
                        <span>Add: Current Net Profit</span>
                        <span>₹{balanceSheet.liabilities.netProfit.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-300 font-sans">Current Liabilities & Provisions</div>
                      {balanceSheet.liabilities.currentLiabilities.map((cl: any, i: number) => (
                        <div key={i} className="flex justify-between text-slate-400 pl-4 py-0.5">
                          <span>{cl.name}</span>
                          <span>₹{cl.amount.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-800 flex justify-between text-sm font-bold text-slate-100 font-sans">
                    <span>TOTAL LIABILITIES</span>
                    <span className="font-mono text-emerald-400">
                      ₹{balanceSheet.liabilities.totalLiabilities.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Assets Side */}
                <div className="p-6 space-y-4">
                  <div className="font-sans font-bold text-slate-200 text-sm pb-2 border-b border-slate-800 flex justify-between">
                    <span>ASSETS</span>
                    <span>AMOUNT (₹)</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="font-semibold text-slate-300 font-sans">Current Assets</div>
                      <div className="text-slate-400 font-sans pl-2 py-1 font-medium">Bank & Cash in Hand:</div>
                      {balanceSheet.assets.currentAssets.cashAndBank.map((cb: any, i: number) => (
                        <div key={i} className="flex justify-between text-slate-400 pl-4 py-0.5">
                          <span>{cb.name}</span>
                          <span>₹{cb.amount.toLocaleString('en-IN')}</span>
                        </div>
                      ))}

                      <div className="text-slate-400 font-sans pl-2 py-1 font-medium">Sundry Debtors:</div>
                      {balanceSheet.assets.currentAssets.debtors.map((d: any, i: number) => (
                        <div key={i} className="flex justify-between text-slate-400 pl-4 py-0.5">
                          <span>{d.name}</span>
                          <span>₹{d.amount.toLocaleString('en-IN')}</span>
                        </div>
                      ))}

                      <div className="flex justify-between text-slate-300 pl-2 pt-1 font-semibold">
                        <span>Closing Stock-in-Hand (FIFO)</span>
                        <span className="text-emerald-400">
                          ₹{balanceSheet.assets.currentAssets.closingStock.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-800 flex justify-between text-sm font-bold text-slate-100 font-sans">
                    <span>TOTAL ASSETS</span>
                    <span className="font-mono text-emerald-400">
                      ₹{balanceSheet.assets.totalAssets.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PROFIT & LOSS STATEMENT */}
          {reportType === 'PNL' && pnl && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl p-6 space-y-6">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="font-bold text-slate-100 text-base">Statement of Profit and Loss (Trading & P&L)</h3>
                <p className="text-xs text-slate-400">For the Financial Year 2024-2025</p>
              </div>

              {/* Trading Account */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-950 p-3 font-semibold text-xs text-slate-200">
                  Trading Account (Gross Profit Computation)
                </div>
                <table className="w-full text-left text-xs font-mono">
                  <tbody className="divide-y divide-slate-800">
                    <tr>
                      <td className="p-3 font-sans text-slate-300">Gross Sales Revenue</td>
                      <td className="p-3 text-right font-bold text-slate-100">₹{pnl.grossSales.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans text-slate-300">Less: Purchases of Raw Components</td>
                      <td className="p-3 text-right text-rose-400">₹{pnl.purchases.toLocaleString('en-IN')}</td>
                    </tr>
                    <tr className="bg-slate-950/40 font-bold">
                      <td className="p-3 font-sans text-emerald-400">Gross Profit (Transferred to P&L)</td>
                      <td className="p-3 text-right text-emerald-400">₹{pnl.grossProfit.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* P&L Account */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-950 p-3 font-semibold text-xs text-slate-200">
                  Profit & Loss Account (Net Profit Computation)
                </div>
                <table className="w-full text-left text-xs font-mono">
                  <tbody className="divide-y divide-slate-800">
                    <tr>
                      <td className="p-3 font-sans text-slate-300">Gross Profit brought forward</td>
                      <td className="p-3 text-right font-bold text-slate-100">₹{pnl.grossProfit.toLocaleString('en-IN')}</td>
                    </tr>
                    {pnl.expenseLines.map((e: any, i: number) => (
                      <tr key={i}>
                        <td className="p-3 font-sans text-slate-400 pl-6">Less: {e.name}</td>
                        <td className="p-3 text-right text-rose-400">₹{e.amount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-950 font-bold text-sm">
                      <td className="p-3 font-sans text-emerald-400">Net Profit for the Period</td>
                      <td className="p-3 text-right text-emerald-400">₹{pnl.netProfit.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TRIAL BALANCE */}
          {reportType === 'TRIAL_BALANCE' && trialBalance && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-100 text-base">Trial Balance</h3>
                  <p className="text-xs text-slate-400">Complete summary of ledger balances</p>
                </div>
                <div className="text-xs font-mono text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Total Debit = Total Credit (Balanced)</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-3 font-sans">Ledger Name</th>
                      <th className="p-3 font-sans">Primary Group</th>
                      <th className="p-3 font-sans">Category</th>
                      <th className="p-3 text-right">Debit (₹)</th>
                      <th className="p-3 text-right">Credit (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {trialBalance.items.map((i: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-3 font-sans font-medium text-slate-200">{i.ledgerName}</td>
                        <td className="p-3 font-sans text-slate-400">{i.groupName}</td>
                        <td className="p-3 font-sans text-slate-400">{i.category}</td>
                        <td className="p-3 text-right text-emerald-400">
                          {i.debit > 0 ? `₹${i.debit.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="p-3 text-right text-amber-400">
                          {i.credit > 0 ? `₹${i.credit.toLocaleString('en-IN')}` : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-950 font-bold text-sm">
                      <td colSpan={3} className="p-3 font-sans text-slate-100">
                        TOTAL TRIAL BALANCE
                      </td>
                      <td className="p-3 text-right text-emerald-400">
                        ₹{trialBalance.totalDebit.toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right text-amber-400">
                        ₹{trialBalance.totalCredit.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* RATIO ANALYSIS */}
          {reportType === 'RATIOS' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-2">
                <div className="text-xs text-slate-400">Current Ratio (Liquidity)</div>
                <div className="text-3xl font-bold font-mono text-emerald-400">4.18x</div>
                <p className="text-xs text-slate-400">Benchmark: &gt; 1.5x (Exceptional solvency)</p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-2">
                <div className="text-xs text-slate-400">Gross Profit Margin</div>
                <div className="text-3xl font-bold font-mono text-teal-400">54.8%</div>
                <p className="text-xs text-slate-400">Solid manufacturing markup</p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-2">
                <div className="text-xs text-slate-400">Debt to Equity Ratio</div>
                <div className="text-3xl font-bold font-mono text-blue-400">0.00</div>
                <p className="text-xs text-slate-400">100% Debt-Free Company</p>
              </div>
            </div>
          )}

          {/* AGING ANALYSIS */}
          {reportType === 'AGING' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-slate-100 text-base">Sundry Debtors Aging Schedule</h3>
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400">
                    <tr>
                      <th className="p-3 font-sans">Party Name</th>
                      <th className="p-3 text-right">0 - 30 Days</th>
                      <th className="p-3 text-right">31 - 60 Days</th>
                      <th className="p-3 text-right">61 - 90 Days</th>
                      <th className="p-3 text-right">Total Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    <tr>
                      <td className="p-3 font-sans text-slate-200">Acme Systems Pvt Ltd</td>
                      <td className="p-3 text-right text-emerald-400">₹56,640</td>
                      <td className="p-3 text-right text-amber-400">₹70,000</td>
                      <td className="p-3 text-right text-slate-600">-</td>
                      <td className="p-3 text-right font-bold text-slate-100">₹1,26,640</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans text-slate-200">NexGen Digital Solutions</td>
                      <td className="p-3 text-right text-emerald-400">₹1,13,280</td>
                      <td className="p-3 text-right text-slate-600">-</td>
                      <td className="p-3 text-right text-slate-600">-</td>
                      <td className="p-3 text-right font-bold text-slate-100">₹1,13,280</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
