import React from 'react';
import { useApp } from '../store/AppContext';
import {
  LayoutDashboard,
  Receipt,
  BookOpen,
  Landmark,
  Menu,
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, setIsMobileMenuOpen } = useApp();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-2 py-1.5 flex items-center justify-around safe-area-bottom">
      <button
        onClick={() => setActiveTab('dashboard')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition ${
          activeTab === 'dashboard'
            ? 'text-emerald-400 font-semibold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <LayoutDashboard className="w-5 h-5 mb-0.5" />
        <span>Dashboard</span>
      </button>

      <button
        onClick={() => setActiveTab('vouchers')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition ${
          activeTab === 'vouchers'
            ? 'text-emerald-400 font-semibold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Receipt className="w-5 h-5 mb-0.5" />
        <span>Vouchers</span>
      </button>

      <button
        onClick={() => setActiveTab('accounts')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition ${
          activeTab === 'accounts'
            ? 'text-emerald-400 font-semibold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <BookOpen className="w-5 h-5 mb-0.5" />
        <span>Accounts</span>
      </button>

      <button
        onClick={() => setActiveTab('gst')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition ${
          activeTab === 'gst'
            ? 'text-emerald-400 font-semibold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Landmark className="w-5 h-5 mb-0.5" />
        <span>GST</span>
      </button>

      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium text-slate-400 hover:text-emerald-400 transition"
      >
        <Menu className="w-5 h-5 mb-0.5" />
        <span>More</span>
      </button>
    </nav>
  );
};
