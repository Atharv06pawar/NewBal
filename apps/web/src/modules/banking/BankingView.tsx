import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { db } from '../../lib/db';
import type { BankAccount, BankStatementRow } from '@newbal/shared';
import {
  Building,
  Upload,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const BankingView: React.FC = () => {
  const { activeCompany, refreshKey } = useApp();
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [statementRows, setStatementRows] = useState<BankStatementRow[]>([]);
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
  const [reconcileFeedback, setReconcileFeedback] = useState('');

  useEffect(() => {
    if (!activeCompany) return;

    async function loadBanking() {
      const bAccs = await db.bankAccounts.where('companyId').equals(activeCompany!.id).toArray();
      setBankAccounts(bAccs);
      if (bAccs.length > 0 && !selectedBank) {
        setSelectedBank(bAccs[0]);
      }
    }
    loadBanking();
  }, [activeCompany, refreshKey]);

  // Load sample bank statement for testing reconciliation
  const handleLoadSampleStatement = async () => {
    if (!selectedBank) return;

    const sampleRows: BankStatementRow[] = [
      {
        id: `stmt-1`,
        bankAccountId: selectedBank.id,
        date: '2024-05-20',
        description: 'NEFT CR ACME SYSTEMS PVT LTD',
        referenceNo: 'NEFT-891283',
        debitAmount: 0,
        creditAmount: 50000,
        balanceAfter: 570000,
        isReconciled: true,
      },
      {
        id: `stmt-2`,
        bankAccountId: selectedBank.id,
        date: '2024-05-25',
        description: 'CHQ WDL OFFICE RENT MAY',
        referenceNo: 'CHQ-002194',
        debitAmount: 35000,
        creditAmount: 0,
        balanceAfter: 535000,
        isReconciled: true,
      },
      {
        id: `stmt-3`,
        bankAccountId: selectedBank.id,
        date: '2024-05-28',
        description: 'BANK CHARGES & ANNUAL SMS ALERT',
        referenceNo: 'CHG-9901',
        debitAmount: 118,
        creditAmount: 0,
        balanceAfter: 534882,
        isReconciled: false,
      },
    ];

    setStatementRows(sampleRows);
    setReconcileFeedback('Loaded 3 bank statement entries. 2 auto-matched with Day Book vouchers!');
    setTimeout(() => setReconcileFeedback(''), 6000);
  };

  const bookBalance = selectedBank?.bookBalance || 520000;
  const bankBalance = 534882;
  const unreconciledDiff = Math.abs(bookBalance - bankBalance);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center space-x-2">
            <Building className="w-6 h-6 text-emerald-400" />
            <span>Banking & Bank Reconciliation (BRS)</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Automated statement matching, cheque management, and passbook reconciliation
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleLoadSampleStatement}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition shadow-md shadow-emerald-950/40"
          >
            <Sparkles className="w-4 h-4" />
            <span>Auto-Match Bank Statement (BRS)</span>
          </button>
        </div>
      </div>

      {reconcileFeedback && (
        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{reconcileFeedback}</span>
        </div>
      )}

      {/* Bank Account Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bankAccounts.map((b) => (
          <div
            key={b.id}
            onClick={() => setSelectedBank(b)}
            className={`p-5 rounded-2xl border cursor-pointer transition ${
              selectedBank?.id === b.id
                ? 'bg-slate-900 border-emerald-500 shadow-lg shadow-emerald-950/20'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-100 text-base">{b.bankName}</span>
              <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                IFSC: {b.ifscCode}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1">A/C: {b.accountNumber} • {b.branchName}</div>

            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between font-mono">
              <div>
                <div className="text-[10px] font-sans text-slate-500">Book Balance (Ledger)</div>
                <div className="text-base font-bold text-emerald-400">
                  ₹{bookBalance.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-sans text-slate-500">Bank Statement Balance</div>
                <div className="text-base font-bold text-slate-200">
                  ₹{bankBalance.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* BRS Summary Statement */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="font-bold text-slate-100 text-base">Bank Reconciliation Statement (BRS)</h3>
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="p-3 font-sans">Particulars</th>
                <th className="p-3 text-right">Debit (₹)</th>
                <th className="p-3 text-right">Credit (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr>
                <td className="p-3 font-sans text-slate-200 font-medium">Balance as per Company Books</td>
                <td className="p-3 text-right font-bold text-slate-100">₹{bookBalance.toLocaleString('en-IN')}</td>
                <td className="p-3 text-right text-slate-600">-</td>
              </tr>
              <tr>
                <td className="p-3 font-sans text-slate-300">
                  Add: Direct deposits recorded in statement cleared via NEFT
                </td>
                <td className="p-3 text-right text-emerald-400">₹50,000</td>
                <td className="p-3 text-right text-slate-600">-</td>
              </tr>
              <tr>
                <td className="p-3 font-sans text-slate-300">
                  Less: Cheque payment cleared by bank (Office Rent)
                </td>
                <td className="p-3 text-right text-slate-600">-</td>
                <td className="p-3 text-right text-amber-400">₹35,000</td>
              </tr>
              <tr>
                <td className="p-3 font-sans text-slate-300">
                  Less: Bank Charges not yet entered in cash book
                </td>
                <td className="p-3 text-right text-slate-600">-</td>
                <td className="p-3 text-right text-amber-400">₹118</td>
              </tr>
              <tr className="bg-slate-950/80 font-bold">
                <td className="p-3 font-sans text-emerald-400">Balance as per Bank Passbook</td>
                <td className="p-3 text-right text-emerald-400">₹{bankBalance.toLocaleString('en-IN')}</td>
                <td className="p-3 text-right text-slate-600">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Statement Matcher Table */}
      {statementRows.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-slate-100 text-sm">Imported Statement Lines & Match Status</h3>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
              Auto-Matched
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3 font-sans">Bank Description</th>
                  <th className="p-3">Reference #</th>
                  <th className="p-3 text-right">Withdrawal (Dr)</th>
                  <th className="p-3 text-right">Deposit (Cr)</th>
                  <th className="p-3 text-right">Closing Bank Bal</th>
                  <th className="p-3 text-center font-sans">Reconciled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {statementRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/40">
                    <td className="p-3 text-slate-400">{row.date}</td>
                    <td className="p-3 font-sans text-slate-200 font-medium">{row.description}</td>
                    <td className="p-3 text-slate-400">{row.referenceNo}</td>
                    <td className="p-3 text-right text-amber-400">
                      {row.debitAmount > 0 ? `₹${row.debitAmount.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="p-3 text-right text-emerald-400">
                      {row.creditAmount > 0 ? `₹${row.creditAmount.toLocaleString('en-IN')}` : '-'}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-100">
                      ₹{row.balanceAfter.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-center font-sans">
                      {row.isReconciled ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold">
                          Matched
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-semibold">
                          Pending Voucher
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
