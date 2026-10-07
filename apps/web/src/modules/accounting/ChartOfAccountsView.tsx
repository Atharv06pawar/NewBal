import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { db } from '../../lib/db';
import { AccountingEngine, type LedgerBalanceSummary } from '../../lib/accountingEngine';
import type { Ledger, LedgerGroup, AccountCategory } from '@newbal/shared';
import {
  BookOpen,
  Plus,
  Search,
  ExternalLink,
  X,
  Check,
} from 'lucide-react';
import { LedgerStatementModal } from './LedgerStatementModal';

export const ChartOfAccountsView: React.FC = () => {
  const { activeCompany, openLedgerStatement, triggerRefresh, refreshKey } = useApp();
  const [balances, setBalances] = useState<Map<string, LedgerBalanceSummary>>(new Map());
  const [groups, setGroups] = useState<LedgerGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isNewLedgerModalOpen, setIsNewLedgerModalOpen] = useState(false);

  // New Ledger Form state
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [category, setCategory] = useState<AccountCategory>('ASSET');
  const [openingBalance, setOpeningBalance] = useState(0);
  const [openingBalanceType, setOpeningBalanceType] = useState<'DR' | 'CR'>('DR');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (!activeCompany) return;

    async function loadData() {
      const bMap = await AccountingEngine.getLedgerBalances(activeCompany!.id);
      const grps = await db.ledgerGroups.where('companyId').equals(activeCompany!.id).toArray();
      setBalances(bMap);
      setGroups(grps);
      if (grps.length > 0 && !groupId) {
        setGroupId(grps[0].id);
      }
    }
    loadData();
  }, [activeCompany, refreshKey]);

  const ledgerList = Array.from(balances.values());

  const filteredLedgers = ledgerList.filter(({ ledger, group }) => {
    if (selectedCategory !== 'ALL' && ledger.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = ledger.name.toLowerCase().includes(q);
      const matchGroup = group?.name.toLowerCase().includes(q);
      const matchGstin = ledger.gstin?.toLowerCase().includes(q);
      return matchName || matchGroup || matchGstin;
    }
    return true;
  });

  const handleCreateLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !activeCompany) return;

    const newLedger: Ledger = {
      id: `led-${Date.now()}`,
      companyId: activeCompany.id,
      name,
      groupId: groupId || groups[0]?.id || 'grp-current-assets',
      category,
      openingBalance: Number(openingBalance),
      openingBalanceType,
      gstin: gstin || undefined,
      pan: pan || undefined,
      email: email || undefined,
      phone: phone || undefined,
      address: address || undefined,
    };

    await db.ledgers.add(newLedger);
    await db.auditLogs.add({
      id: `log-${Date.now()}`,
      companyId: activeCompany.id,
      timestamp: new Date().toISOString(),
      action: 'CREATE',
      entity: 'LEDGER',
      entityId: newLedger.id,
      details: `Created Ledger "${newLedger.name}" under ${category}`,
      user: 'Administrator',
    });

    triggerRefresh();
    setIsNewLedgerModalOpen(false);
    setName('');
    setOpeningBalance(0);
    setGstin('');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center space-x-2">
            <BookOpen className="w-6 h-6 text-emerald-400" />
            <span>Chart of Accounts & Ledgers</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Standard double-entry chart of accounts for {activeCompany?.name}
          </p>
        </div>

        <button
          onClick={() => setIsNewLedgerModalOpen(true)}
          className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition shadow-md shadow-emerald-950/40"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Ledger</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as (string | AccountCategory)[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search ledger name, group, GSTIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Ledgers Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-medium">Ledger Name</th>
                <th className="py-3 px-4 font-medium">Account Group</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium text-right">Debit Movements</th>
                <th className="py-3 px-4 font-medium text-right">Credit Movements</th>
                <th className="py-3 px-4 font-medium text-right">Closing Balance</th>
                <th className="py-3 px-4 font-medium text-center">Passbook</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {filteredLedgers.map(({ ledger, group, totalDebit, totalCredit, closingBalance, closingBalanceType }) => (
                <tr
                  key={ledger.id}
                  onClick={() => openLedgerStatement(ledger.id)}
                  className="hover:bg-slate-800/40 cursor-pointer transition"
                >
                  <td className="py-3.5 px-4 font-sans font-medium text-slate-200">
                    <div>{ledger.name}</div>
                    {ledger.gstin && (
                      <span className="text-[10px] text-emerald-400 font-mono">GSTIN: {ledger.gstin}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 font-sans">{group?.name || 'General Group'}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        ledger.category === 'ASSET'
                          ? 'bg-blue-500/20 text-blue-300'
                          : ledger.category === 'LIABILITY'
                          ? 'bg-amber-500/20 text-amber-300'
                          : ledger.category === 'INCOME'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : ledger.category === 'EXPENSE'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-purple-500/20 text-purple-300'
                      }`}
                    >
                      {ledger.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-400">
                    {totalDebit > 0 ? `₹${totalDebit.toLocaleString('en-IN')}` : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-400">
                    {totalCredit > 0 ? `₹${totalCredit.toLocaleString('en-IN')}` : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-100">
                    ₹{closingBalance.toLocaleString('en-IN')}{' '}
                    <span
                      className={`text-[10px] ${
                        closingBalanceType === 'DR' ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {closingBalanceType}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openLedgerStatement(ledger.id);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 transition"
                      title="Drilldown Passbook"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Ledger Modal */}
      {isNewLedgerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">Create New Ledger Account</h3>
              <button
                onClick={() => setIsNewLedgerModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLedger} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Ledger Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Tech Solutions / HDFC Bank"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Parent Group *</label>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.category})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Account Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AccountCategory)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ASSET">ASSET</option>
                    <option value="LIABILITY">LIABILITY</option>
                    <option value="EQUITY">EQUITY</option>
                    <option value="INCOME">INCOME</option>
                    <option value="EXPENSE">EXPENSE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Dr / Cr</label>
                  <select
                    value={openingBalanceType}
                    onChange={(e) => setOpeningBalanceType(e.target.value as 'DR' | 'CR')}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="DR">DR (Debit)</option>
                    <option value="CR">CR (Credit)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Party GSTIN (Optional)</label>
                  <input
                    type="text"
                    placeholder="27AABCA1234F1Z5"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Email / Phone (Optional)</label>
                  <input
                    type="text"
                    placeholder="contact@party.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewLedgerModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 shadow-md shadow-emerald-950/40"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Ledger</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drilldown modal render */}
      <LedgerStatementModal />
    </div>
  );
};
