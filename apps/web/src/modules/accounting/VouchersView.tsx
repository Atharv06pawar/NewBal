import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { db } from '../../lib/db';
import type { Voucher, VoucherType } from '@newbal/shared';
import {
  Search,
  Plus,
  FileSpreadsheet,
  Printer,
  Trash2,
  Receipt,
} from 'lucide-react';
import { ExportEngine } from '../../lib/exportEngine';

export const VouchersView: React.FC = () => {
  const { activeCompany, openNewVoucher, triggerRefresh, refreshKey } = useApp();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);

  useEffect(() => {
    if (!activeCompany) return;

    async function loadVouchers() {
      const vchs = await db.vouchers
        .where('companyId')
        .equals(activeCompany!.id)
        .reverse()
        .sortBy('date');
      setVouchers(vchs);
    }
    loadVouchers();
  }, [activeCompany, refreshKey]);

  const filteredVouchers = vouchers.filter((v) => {
    if (filterType !== 'ALL' && v.voucherType !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchNo = v.voucherNumber.toLowerCase().includes(q);
      const matchParty = v.partyName?.toLowerCase().includes(q);
      const matchNarration = v.narration?.toLowerCase().includes(q);
      return matchNo || matchParty || matchNarration;
    }
    return true;
  });

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this voucher? All books will be updated.')) {
      await db.vouchers.delete(id);
      triggerRefresh();
    }
  };

  const handleExportExcel = () => {
    const data = filteredVouchers.map((v) => ({
      Date: v.date,
      'Voucher Type': v.voucherType,
      'Voucher Number': v.voucherNumber,
      'Party / Particulars': v.partyName || v.entries[0]?.ledgerName,
      'Taxable Amount': v.totalTaxableAmount || 0,
      'Total Tax': (v.totalCgst || 0) + (v.totalSgst || 0) + (v.totalIgst || 0),
      'Grand Total': v.grandTotal,
      Narration: v.narration,
    }));
    ExportEngine.exportToExcel(data, `DayBook_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center space-x-2">
            <Receipt className="w-6 h-6 text-emerald-400" />
            <span>Day Book & Voucher Register</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Complete chronological audit journal for {activeCompany?.name}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={() => openNewVoucher('SALES')}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition shadow-md shadow-emerald-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>Create Voucher</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'SALES', 'PURCHASE', 'PAYMENT', 'RECEIPT', 'CONTRA', 'JOURNAL'] as (string | VoucherType)[]).map(
            (t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                  filterType === t
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {t}
              </button>
            )
          )}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search voucher #, party..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">Voucher #</th>
                <th className="py-3 px-4 font-medium">Particulars / Party</th>
                <th className="py-3 px-4 font-medium text-right">Taxable</th>
                <th className="py-3 px-4 font-medium text-right">Grand Total</th>
                <th className="py-3 px-4 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500 font-sans">
                    No vouchers found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredVouchers.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => setSelectedVoucher(v)}
                    className="hover:bg-slate-800/40 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4 text-slate-400">{v.date}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          v.voucherType === 'SALES'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : v.voucherType === 'PURCHASE'
                            ? 'bg-blue-500/20 text-blue-300'
                            : v.voucherType === 'PAYMENT'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-purple-500/20 text-purple-300'
                        }`}
                      >
                        {v.voucherType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-200">{v.voucherNumber}</td>
                    <td className="py-3.5 px-4 font-sans text-slate-300 font-medium">
                      {v.partyName || v.entries[0]?.ledgerName || 'General Entry'}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-400">
                      ₹{(v.totalTaxableAmount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-100">
                      ₹{v.grandTotal.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2" onClick={(e) => e.stopPropagation()}>
                        {v.voucherType === 'SALES' && (
                          <button
                            onClick={() => ExportEngine.generateInvoicePDF(activeCompany!, v)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 transition"
                            title="Print Tax Invoice PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(v.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 transition"
                          title="Delete Voucher"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Voucher Detail Drilldown Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  {selectedVoucher.voucherType} Voucher: {selectedVoucher.voucherNumber}
                </h3>
                <p className="text-xs text-slate-400 font-mono">Date: {selectedVoucher.date}</p>
              </div>
              <button
                onClick={() => setSelectedVoucher(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                Close [Esc]
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="font-semibold text-slate-300">Accounting Ledger Entries:</div>
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left font-mono">
                  <thead className="bg-slate-950 text-slate-400">
                    <tr>
                      <th className="p-2">Type</th>
                      <th className="p-2">Ledger</th>
                      <th className="p-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {selectedVoucher.entries.map((e, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-bold text-slate-300">{e.type}</td>
                        <td className="p-2 text-slate-200">{e.ledgerName}</td>
                        <td className="p-2 text-right font-bold text-emerald-400">
                          ₹{e.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedVoucher.narration && (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-400">
                  <span className="font-semibold text-slate-300">Narration:</span> {selectedVoucher.narration}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              {selectedVoucher.voucherType === 'SALES' && (
                <button
                  onClick={() => ExportEngine.generateInvoicePDF(activeCompany!, selectedVoucher)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Download PDF Invoice</span>
                </button>
              )}
              <button
                onClick={() => setSelectedVoucher(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
