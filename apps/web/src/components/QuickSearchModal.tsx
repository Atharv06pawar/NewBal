import React, { useState, useEffect } from 'react';
import { useApp, type ActiveTab } from '../store/AppContext';
import { Search, ArrowRight, CornerDownLeft, Sparkles } from 'lucide-react';
import { db } from '../lib/db';

interface SearchResult {
  title: string;
  category: string;
  action: () => void;
  badge?: string;
}

export const QuickSearchModal: React.FC = () => {
  const { isGoToOpen, setIsGoToOpen, setActiveTab, openNewVoucher, openLedgerStatement, activeCompany } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!isGoToOpen) {
      setQuery('');
      setSelectedIndex(0);
      return;
    }

    async function search() {
      const q = query.toLowerCase().trim();
      const list: SearchResult[] = [];

      // Standard Navigation Targets
      const tabs: { id: ActiveTab; title: string; category: string }[] = [
        { id: 'dashboard', title: 'Dashboard & AI Advisor', category: 'Navigation' },
        { id: 'vouchers', title: 'Vouchers & Day Book', category: 'Navigation' },
        { id: 'accounts', title: 'Chart of Accounts (Ledgers & Groups)', category: 'Navigation' },
        { id: 'gst', title: 'GST Compliance (GSTR-1, GSTR-3B)', category: 'Navigation' },
        { id: 'inventory', title: 'Inventory & Stock Summary', category: 'Navigation' },
        { id: 'payroll', title: 'Payroll & HR Management', category: 'Navigation' },
        { id: 'banking', title: 'Banking & Bank Reconciliation (BRS)', category: 'Navigation' },
        { id: 'reports', title: 'Balance Sheet, P&L, Trial Balance', category: 'Reports' },
        { id: 'ocr', title: 'Smart OCR Bill Scanner', category: 'Tools' },
        { id: 'settings', title: 'Company Settings & Backups', category: 'Settings' },
      ];

      tabs.forEach((tab) => {
        if (!q || tab.title.toLowerCase().includes(q) || tab.category.toLowerCase().includes(q)) {
          list.push({
            title: tab.title,
            category: tab.category,
            action: () => {
              setActiveTab(tab.id);
              setIsGoToOpen(false);
            },
          });
        }
      });

      // Quick Voucher Creation Actions
      const voucherActions = [
        { title: 'Create Sales Invoice (F8)', type: 'SALES' as const },
        { title: 'Create Purchase Invoice (F9)', type: 'PURCHASE' as const },
        { title: 'Record Payment (F5)', type: 'PAYMENT' as const },
        { title: 'Record Receipt (F6)', type: 'RECEIPT' as const },
        { title: 'Record Contra (Bank/Cash) (F4)', type: 'CONTRA' as const },
        { title: 'Create Journal Voucher (F7)', type: 'JOURNAL' as const },
      ];

      voucherActions.forEach((v) => {
        if (!q || v.title.toLowerCase().includes(q)) {
          list.push({
            title: v.title,
            category: 'Quick Action',
            badge: 'Voucher',
            action: () => {
              openNewVoucher(v.type);
              setIsGoToOpen(false);
            },
          });
        }
      });

      // Search Ledgers from DB
      if (activeCompany) {
        const ledgers = await db.ledgers.where('companyId').equals(activeCompany.id).toArray();
        ledgers.forEach((led) => {
          if (q && (led.name.toLowerCase().includes(q) || (led.gstin && led.gstin.toLowerCase().includes(q)))) {
            list.push({
              title: `Ledger: ${led.name}`,
              category: 'Ledger Statement',
              badge: led.category,
              action: () => {
                openLedgerStatement(led.id);
                setIsGoToOpen(false);
              },
            });
          }
        });

        // Search Stock Items from DB
        const items = await db.stockItems.where('companyId').equals(activeCompany.id).toArray();
        items.forEach((item) => {
          if (q && (item.name.toLowerCase().includes(q) || (item.hsnCode && item.hsnCode.includes(q)))) {
            list.push({
              title: `Stock: ${item.name}`,
              category: 'Inventory',
              badge: `₹${item.standardSalesRate}`,
              action: () => {
                setActiveTab('inventory');
                setIsGoToOpen(false);
              },
            });
          }
        });
      }

      setResults(list.slice(0, 10));
      setSelectedIndex(0);
    }

    search();
  }, [query, isGoToOpen]);

  if (!isGoToOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Bar Input */}
        <div className="p-4 border-b border-slate-800 flex items-center space-x-3">
          <Search className="w-5 h-5 text-emerald-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Go To: Type a report, ledger, voucher, or action..."
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-base font-medium"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
              } else if (e.key === 'Enter' && results[selectedIndex]) {
                e.preventDefault();
                results[selectedIndex].action();
              }
            }}
          />
          <kbd className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono border border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No matching reports or masters found for "{query}".
            </div>
          ) : (
            results.map((res, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={index}
                  onClick={res.action}
                  className={`w-full text-left px-3.5 py-2.5 rounded-lg flex items-center justify-between text-sm transition-colors ${
                    isSelected ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-[11px] font-mono uppercase text-slate-500 px-1.5 py-0.5 rounded bg-slate-800">
                      {res.category}
                    </span>
                    <span className="font-medium">{res.title}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {res.badge && (
                      <span className="text-xs text-slate-400 font-mono px-2 py-0.5 bg-slate-800 rounded">
                        {res.badge}
                      </span>
                    )}
                    {isSelected && <CornerDownLeft className="w-4 h-4 text-emerald-400" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 font-mono">
          <div className="flex items-center space-x-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <div className="flex items-center space-x-1 text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>TallyPrime Go To Powered by NEWBAL</span>
          </div>
        </div>
      </div>
    </div>
  );
};
