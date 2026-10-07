import React from 'react';
import { useApp } from '../store/AppContext';
import {
  Building2,
  Search,
  PlusCircle,
  HardDriveDownload,
  Calendar,
  Menu,
  User,
  ShieldCheck,
} from 'lucide-react';
import { ExportEngine } from '../lib/exportEngine';

export const Header: React.FC = () => {
  const {
    activeCompany,
    setIsGoToOpen,
    setIsMasterAccountOpen,
    setIsMobileMenuOpen,
    setIsAuthModalOpen,
    authUser,
    openNewVoucher,
    companies,
    setActiveCompany,
  } = useApp();

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
      {/* Left: Mobile Hamburger + Active Company & Fiscal Year */}
      <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
        {/* Mobile Hamburger Menu */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition shrink-0"
          title="Open Menu"
        >
          <Menu className="w-5 h-5 text-emerald-400" />
        </button>

        <div className="flex items-center space-x-2 bg-slate-800/80 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-700 min-w-0">
          <Building2 className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-400 shrink-0" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
              <select
                aria-label="Active Company"
                value={activeCompany?.id || ''}
                onChange={(e) => {
                  const comp = companies.find((c) => c.id === e.target.value);
                  if (comp) setActiveCompany(comp);
                }}
                className="bg-transparent text-xs sm:text-sm font-semibold text-slate-100 focus:outline-none cursor-pointer max-w-[120px] sm:max-w-[200px] md:max-w-xs truncate"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-800 text-white">
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono shrink-0">
                {activeCompany?.stateCode ? `GST: ${activeCompany.stateCode}` : 'PRO'}
              </span>
            </div>
            <div className="hidden sm:flex items-center space-x-1.5 text-[10px] text-slate-400 font-mono">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>FY 2024-2025</span>
              <span>•</span>
              <span className="text-emerald-400 font-medium">Books Active</span>
            </div>
          </div>
        </div>

        {/* Offline / Cloud Status Badge */}
        <div className="hidden xl:flex items-center space-x-1.5 text-xs bg-slate-800/40 text-slate-300 px-3 py-1 rounded-full border border-slate-700/60">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{authUser?.isCloudSynced ? 'Cloud Synced (Supabase)' : 'Local Offline Safe'}</span>
          <span className="text-slate-500">•</span>
          <span className="text-emerald-400 font-medium">100% Free Forever</span>
        </div>
      </div>

      {/* Middle: Tally Shortcut Bar (Desktop only) */}
      <div className="hidden 2xl:flex items-center space-x-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800 text-xs font-mono">
        <button
          onClick={() => openNewVoucher('CONTRA')}
          className="px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          title="Contra Voucher"
        >
          <span className="text-amber-400 font-bold">F4</span> Contra
        </button>
        <button
          onClick={() => openNewVoucher('PAYMENT')}
          className="px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          title="Payment Voucher"
        >
          <span className="text-amber-400 font-bold">F5</span> Payment
        </button>
        <button
          onClick={() => openNewVoucher('RECEIPT')}
          className="px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          title="Receipt Voucher"
        >
          <span className="text-amber-400 font-bold">F6</span> Receipt
        </button>
        <button
          onClick={() => openNewVoucher('JOURNAL')}
          className="px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          title="Journal Voucher"
        >
          <span className="text-amber-400 font-bold">F7</span> Journal
        </button>
        <button
          onClick={() => openNewVoucher('SALES')}
          className="px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          title="Sales Invoice"
        >
          <span className="text-emerald-400 font-bold">F8</span> Sales
        </button>
        <button
          onClick={() => openNewVoucher('PURCHASE')}
          className="px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          title="Purchase Invoice"
        >
          <span className="text-emerald-400 font-bold">F9</span> Purchase
        </button>
      </div>

      {/* Right Actions: Auth, Alt+G Search, New Voucher, Backup */}
      <div className="flex items-center space-x-1.5 sm:space-x-2.5">
        {/* User Auth Button */}
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="flex items-center space-x-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-medium transition shadow-sm"
          title={authUser ? `Logged in as ${authUser.email}` : 'Sign In / Cloud Sync'}
        >
          <User className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline font-mono text-[11px] max-w-[100px] truncate">
            {authUser ? authUser.fullName.split(' ')[0] : 'Sign In'}
          </span>
        </button>

        {/* Alt+G Search */}
        <button
          onClick={() => setIsGoToOpen(true)}
          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700/80 text-slate-300 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-700 text-xs sm:text-sm transition"
          title="Universal Search (Alt+G)"
        >
          <Search className="w-4 h-4 text-slate-400" />
          <span className="hidden md:inline">Go To</span>
          <kbd className="hidden lg:inline-block bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-700">
            Alt+G
          </kbd>
        </button>

        {/* Voucher Button */}
        <button
          onClick={() => openNewVoucher('SALES')}
          className="flex items-center space-x-1 sm:space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium shadow-sm shadow-emerald-900/40 transition shrink-0"
        >
          <PlusCircle className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
          <span>Voucher</span>
        </button>

        {/* Backup Button */}
        <button
          onClick={() => ExportEngine.exportFullBackupJSON()}
          className="hidden sm:flex p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 border border-slate-700 transition shrink-0"
          title="Instant 1-Click JSON Backup"
        >
          <HardDriveDownload className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
