import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { AccountingEngine } from '../../lib/accountingEngine';
import { X, FileSpreadsheet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { ExportEngine } from '../../lib/exportEngine';

export const LedgerStatementModal: React.FC = () => {
  const { selectedLedgerForStatement, closeLedgerStatement, activeCompany } = useApp();
  const [statement, setStatement] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedLedgerForStatement || !activeCompany) return;

    async function loadStatement() {
      setLoading(true);
      const res = await AccountingEngine.getLedgerStatement(activeCompany!.id, selectedLedgerForStatement!);
      setStatement(res);
      setLoading(false);
    }
    loadStatement();
  }, [selectedLedgerForStatement, activeCompany]);

  if (!selectedLedgerForStatement) return null;

  const handleExport = () => {
    if (!statement) return;
    const data = statement.entries.map((e: any) => ({
      Date: e.date,
      'Voucher Type': e.voucherType,
      'Voucher Number': e.voucherNumber,
      Particulars: e.particulars,
      Debit: e.debit,
      Credit: e.credit,
      'Running Balance': e.runningBalance,
      Type: e.balanceType,
    }));
    ExportEngine.exportToExcel(data, `Statement_${statement.ledger.name.replace(/\s+/g, '_')}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <span>{statement?.ledger.name || 'Ledger Statement'}</span>
              <span className="text-xs bg-slate-800 text-emerald-400 font-mono px-2 py-0.5 rounded border border-slate-700">
                {statement?.ledger.category}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Account passbook statement for {activeCompany?.name}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExport}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export</span>
            </button>
            <button
              onClick={closeLedgerStatement}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Statement Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm">Computing account ledger entries...</div>
          ) : !statement ? (
            <div className="text-center py-12 text-slate-500 text-sm">No ledger found.</div>
          ) : (
            <>
              {/* Opening Balance Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-xs text-slate-400">Opening Balance</div>
                  <div className="text-lg font-bold font-mono text-slate-200 mt-1">
                    ₹{statement.openingBalance.toLocaleString('en-IN')}{' '}
                    <span className="text-xs text-emerald-400">{statement.openingBalanceType}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-xs text-slate-400">Total Movements</div>
                  <div className="text-xs font-mono space-y-0.5 mt-1">
                    <div className="text-emerald-400 flex items-center justify-between">
                      <span>Total Debit:</span>
                      <span>₹{statement.totalDebit.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-amber-400 flex items-center justify-between">
                      <span>Total Credit:</span>
                      <span>₹{statement.totalCredit.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-xs text-slate-400">Closing Balance</div>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                    ₹{statement.closingBalance.toLocaleString('en-IN')}{' '}
                    <span className="text-xs text-slate-300">{statement.closingBalanceType}</span>
                  </div>
                </div>
              </div>

              {/* Entries Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Vch Type</th>
                      <th className="p-3">Vch #</th>
                      <th className="p-3 font-sans">Particulars</th>
                      <th className="p-3 text-right">Debit (₹)</th>
                      <th className="p-3 text-right">Credit (₹)</th>
                      <th className="p-3 text-right">Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {statement.entries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-500 font-sans">
                          No transactions recorded for this ledger.
                        </td>
                      </tr>
                    ) : (
                      statement.entries.map((e: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="p-3 text-slate-400">{e.date}</td>
                          <td className="p-3">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              {e.voucherType}
                            </span>
                          </td>
                          <td className="p-3 text-slate-200">{e.voucherNumber}</td>
                          <td className="p-3 font-sans text-slate-300 font-medium">{e.particulars}</td>
                          <td className="p-3 text-right text-emerald-400">
                            {e.debit > 0 ? `₹${e.debit.toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="p-3 text-right text-amber-400">
                            {e.credit > 0 ? `₹${e.credit.toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="p-3 text-right font-bold text-slate-100">
                            ₹{e.runningBalance.toLocaleString('en-IN')}{' '}
                            <span className="text-[10px] text-slate-400">{e.balanceType}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex justify-end">
          <button
            onClick={closeLedgerStatement}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
          >
            Close [Esc]
          </button>
        </div>
      </div>
    </div>
  );
};
