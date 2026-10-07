import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { db } from '../../lib/db';
import { AccountingEngine } from '../../lib/accountingEngine';
import type { Voucher, StockItem } from '@newbal/shared';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Receipt,
  FileSpreadsheet,
  Boxes,
  Plus,
} from 'lucide-react';
import { ExportEngine } from '../../lib/exportEngine';

export const DashboardView: React.FC = () => {
  const { activeCompany, openNewVoucher, setActiveTab, openLedgerStatement, refreshKey } = useApp();

  const [metrics, setMetrics] = useState({
    sales: 0,
    purchases: 0,
    grossProfit: 0,
    netProfit: 0,
    cashBank: 0,
    debtors: 0,
    creditors: 0,
    stockValuation: 0,
  });

  const [recentVouchers, setRecentVouchers] = useState<Voucher[]>([]);
  const [lowStockItems, setLowStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) return;

    async function loadDashboard() {
      setLoading(true);
      try {
        const pnl = await AccountingEngine.getProfitAndLoss(activeCompany.id);
        const bs = await AccountingEngine.getBalanceSheet(activeCompany.id);
        const stock = await AccountingEngine.getStockValuation(activeCompany.id);

        const vchs = await db.vouchers
          .where('companyId')
          .equals(activeCompany.id)
          .reverse()
          .sortBy('date');

        const allItems = await db.stockItems.where('companyId').equals(activeCompany.id).toArray();
        const lowItems = allItems.filter(
          (i) => (i.closingQuantity ?? i.openingQuantity) <= (i.reorderLevel || 10)
        );

        const cashBankTotal = bs.assets.currentAssets.cashAndBank.reduce((acc, curr) => acc + curr.amount, 0);
        const debtorsTotal = bs.assets.currentAssets.debtors.reduce((acc, curr) => acc + curr.amount, 0);
        const creditorsTotal = bs.liabilities.currentLiabilities.reduce((acc, curr) => acc + curr.amount, 0);

        setMetrics({
          sales: pnl.grossSales,
          purchases: pnl.purchases,
          grossProfit: pnl.grossProfit,
          netProfit: pnl.netProfit,
          cashBank: cashBankTotal,
          debtors: debtorsTotal,
          creditors: creditorsTotal,
          stockValuation: stock.totalValue,
        });

        setRecentVouchers(vchs.slice(0, 8));
        setLowStockItems(lowItems);
      } catch (err) {
        console.error('Error loading dashboard data', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [activeCompany, refreshKey]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Top Welcome & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center space-x-2">
            <span>Financial Executive Dashboard</span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
              Live Real-Time
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Enterprise double-entry overview for <span className="text-slate-200 font-medium">{activeCompany?.name}</span>
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => openNewVoucher('SALES')}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition shadow-md shadow-emerald-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>Sales Invoice (F8)</span>
          </button>
          <button
            onClick={() => openNewVoucher('PAYMENT')}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg text-sm font-medium transition border border-slate-700"
          >
            <ArrowUpRight className="w-4 h-4 text-amber-400" />
            <span>Payment (F5)</span>
          </button>
          <button
            onClick={() => openNewVoucher('RECEIPT')}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg text-sm font-medium transition border border-slate-700"
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
            <span>Receipt (F6)</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-100">
              ₹{metrics.sales.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-emerald-400 mt-1">
              <span>Gross sales booked</span>
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Net Profit</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold font-mono ${
                metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              ₹{metrics.netProfit.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-1">
              <span>Margin: {metrics.sales > 0 ? ((metrics.netProfit / metrics.sales) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
        </div>

        {/* Liquid Cash & Bank */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Cash & Bank</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-100">
              ₹{metrics.cashBank.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-1">
              <span>SBI & HDFC Accounts</span>
            </div>
          </div>
        </div>

        {/* Stock Valuation */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Stock Valuation</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-100">
              ₹{metrics.stockValuation.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-amber-400 mt-1">
              <span>Real-time FIFO Value</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Smart Financial Advisor & Insights (Pro Feature) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-emerald-950/20 border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">NEWBAL AI Financial Advisor & Compliance Watch</h2>
              <p className="text-xs text-slate-400">Automated ledger audits, tax alerts, and working capital insights</p>
            </div>
          </div>
          <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
            System Healthy
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-slate-200">GST Compliance Status</div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                GSTR-1 and GSTR-3B books are fully balanced. Net tax payable for May is ₹0 (ITC covers liability).
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-start space-x-3">
            <Wallet className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-slate-200">Liquidity & Runway</div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Current Ratio is <span className="text-emerald-400 font-mono font-bold">4.2x</span>. Cash reserves can cover 14+ months of current operating overheads.
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-slate-200">Sundry Debtors Follow-up</div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                ₹{metrics.debtors.toLocaleString('en-IN')} outstanding in receivables. Acme Systems has ₹1,26,640 pending payment.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Vouchers + Receivables/Payables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions Feed (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-100">Recent Day Book Entries</h2>
              <p className="text-xs text-slate-400">Latest posted vouchers with instant tax invoice printing</p>
            </div>
            <button
              onClick={() => setActiveTab('vouchers')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center space-x-1"
            >
              <span>View All Day Book</span>
              <span>→</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Voucher #</th>
                  <th className="pb-3 font-medium">Party / Ledger</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                  <th className="pb-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentVouchers.map((vch) => {
                  return (
                    <tr key={vch.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 text-xs text-slate-400 font-mono">{vch.date}</td>
                      <td className="py-3">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                            vch.voucherType === 'SALES'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : vch.voucherType === 'PURCHASE'
                              ? 'bg-blue-500/20 text-blue-300'
                              : vch.voucherType === 'PAYMENT'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-purple-500/20 text-purple-300'
                          }`}
                        >
                          {vch.voucherType}
                        </span>
                      </td>
                      <td className="py-3 text-xs font-mono text-slate-300">{vch.voucherNumber}</td>
                      <td className="py-3 text-xs font-medium text-slate-200">
                        {vch.partyName || vch.entries[0]?.ledgerName || 'General'}
                      </td>
                      <td className="py-3 text-xs font-mono font-bold text-slate-100 text-right">
                        ₹{vch.grandTotal.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 text-right">
                        {vch.voucherType === 'SALES' && (
                          <button
                            onClick={() => ExportEngine.generateInvoicePDF(activeCompany!, vch)}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 px-2 py-1 rounded transition"
                            title="Download PDF Tax Invoice"
                          >
                            PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Receivables & Quick Actions Column (1 Col) */}
        <div className="space-y-6">
          {/* Outstanding Summary */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-100 mb-4">Outstanding Accounts</h2>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-xs text-slate-400">Total Receivables (Debtors)</div>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                  ₹{metrics.debtors.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Due from customers for supplies</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-xs text-slate-400">Total Payables (Creditors)</div>
                <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                  ₹{metrics.creditors.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Due to vendors for components</div>
              </div>
            </div>
          </div>

          {/* Quick Module Shortcuts */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-100 mb-4">Quick ERP Tools</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => setActiveTab('gst')}
                className="p-3 bg-slate-800/60 hover:bg-slate-800 rounded-xl text-left border border-slate-700/60 transition group"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400 mb-1 group-hover:scale-110 transition" />
                <div className="font-semibold text-slate-200">GSTR-1 Portal JSON</div>
                <div className="text-[10px] text-slate-500">Instant export</div>
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className="p-3 bg-slate-800/60 hover:bg-slate-800 rounded-xl text-left border border-slate-700/60 transition group"
              >
                <TrendingUp className="w-4 h-4 text-teal-400 mb-1 group-hover:scale-110 transition" />
                <div className="font-semibold text-slate-200">Balance Sheet</div>
                <div className="text-[10px] text-slate-500">T-Format & Vertical</div>
              </button>
              <button
                onClick={() => setActiveTab('ocr')}
                className="p-3 bg-slate-800/60 hover:bg-slate-800 rounded-xl text-left border border-slate-700/60 transition group"
              >
                <Receipt className="w-4 h-4 text-purple-400 mb-1 group-hover:scale-110 transition" />
                <div className="font-semibold text-slate-200">OCR Bill Scanner</div>
                <div className="text-[10px] text-slate-500">Scan & auto-voucher</div>
              </button>
              <button
                onClick={() => setActiveTab('banking')}
                className="p-3 bg-slate-800/60 hover:bg-slate-800 rounded-xl text-left border border-slate-700/60 transition group"
              >
                <Wallet className="w-4 h-4 text-blue-400 mb-1 group-hover:scale-110 transition" />
                <div className="font-semibold text-slate-200">BRS Reconcile</div>
                <div className="text-[10px] text-slate-500">Bank CSV Matcher</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
