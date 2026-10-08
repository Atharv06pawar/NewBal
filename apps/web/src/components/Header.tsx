import React, { useState } from 'react';
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
  Cloud,
  CloudOff,
  RefreshCw,
  CheckCircle,
  Database,
  Copy,
  Check,
  X,
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
    syncState,
    syncMessage,
    needsSqlSetup,
    triggerCloudSync,
  } = useApp();

  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const sqlSetupScript = `-- NEWBAL Multi-Device Cloud Sync Table Setup
-- Copy and run this in your Supabase SQL Editor (1-click):

create table if not exists public.user_sync_data (
  user_id text primary key,
  email text,
  data jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security and allow full read/write for sync:
alter table public.user_sync_data enable row level security;

drop policy if exists "Enable all operations for user_sync_data" on public.user_sync_data;
create policy "Enable all operations for user_sync_data" on public.user_sync_data
  for all using (true) with check (true);
`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlSetupScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

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

        {/* Live Cloud Sync Status Badge */}
        <div className="flex items-center">
          {needsSqlSetup ? (
            <button
              onClick={() => setShowSqlModal(true)}
              className="flex items-center space-x-1.5 text-xs bg-cyan-950/60 text-cyan-300 hover:text-white px-2.5 py-1 rounded-full border border-cyan-500/40 transition animate-pulse"
              title="Click to run 1-click SQL setup in Supabase to sync across phone and laptop"
            >
              <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-[11px] font-medium hidden md:inline">Enable Multi-Device Sync</span>
              <span className="text-[10px] font-mono bg-cyan-500/20 px-1 rounded">1-Click SQL</span>
            </button>
          ) : syncState === 'SYNCING' ? (
            <div className="flex items-center space-x-1.5 text-xs bg-amber-950/40 text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/30">
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
              <span className="text-[11px] font-medium hidden sm:inline">Syncing...</span>
            </div>
          ) : syncState === 'OFFLINE' ? (
            <div
              className="flex items-center space-x-1.5 text-xs bg-amber-950/40 text-amber-300 px-2.5 py-1 rounded-full border border-amber-500/30"
              title="No internet connection. All changes are securely saved on your device and will automatically sync when connected."
            >
              <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-[11px] font-medium hidden sm:inline">Offline (Will sync when connected)</span>
            </div>
          ) : authUser ? (
            <button
              onClick={triggerCloudSync}
              className="flex items-center space-x-1.5 text-xs bg-emerald-950/40 text-emerald-300 hover:text-white px-2.5 py-1 rounded-full border border-emerald-500/30 transition group"
              title="Logged in. Click to force instant cloud refresh."
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition shrink-0" />
              <span className="text-[11px] font-medium hidden sm:inline">Cloud Synced</span>
            </button>
          ) : (
            <div className="hidden xl:flex items-center space-x-1.5 text-xs bg-slate-800/40 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700/60">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[11px]">Local Device Storage</span>
            </div>
          )}
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

      {/* Right: Actions */}
      <div className="flex items-center space-x-1.5 sm:space-x-3">
        {/* Universal Search / Tally Go-To */}
        <button
          onClick={() => setIsGoToOpen(true)}
          className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-800 hover:bg-slate-750 text-slate-200 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-mono transition"
          title="Alt+G: Go To Universal Search"
        >
          <Search className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-emerald-400" />
          <span className="hidden md:inline">Go To</span>
          <kbd className="hidden lg:inline bg-slate-900 px-1.5 py-0.5 rounded text-[10px] text-slate-400 border border-slate-800">
            Alt+G
          </kbd>
        </button>

        {/* Quick New Voucher */}
        <button
          onClick={() => openNewVoucher('SALES')}
          className="flex items-center space-x-1 sm:space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-md shadow-emerald-950/40"
          title="Create New Voucher"
        >
          <PlusCircle className="w-4 h-4" />
          <span className="hidden sm:inline">New Voucher</span>
        </button>

        {/* Export Tally XML & Backup */}
        <button
          onClick={async () => {
            if (activeCompany) {
              await ExportEngine.exportTallyXML(activeCompany.id);
            }
          }}
          className="hidden md:flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 text-xs transition"
          title="Export Tally-Compatible XML"
        >
          <HardDriveDownload className="w-4 h-4 text-slate-400" />
          <span>Tally XML</span>
        </button>

        {/* Master Account / Cloud Profile */}
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="flex items-center space-x-2 bg-slate-800/80 hover:bg-slate-750 text-slate-200 px-2 sm:px-3 py-1.5 rounded-lg border border-slate-700 text-xs transition"
          title="Account & Cloud Sync"
        >
          <User className="w-4 h-4 text-emerald-400" />
          <div className="hidden sm:flex flex-col items-start text-left">
            <span className="text-[11px] font-semibold leading-tight truncate max-w-[100px]">
              {authUser ? authUser.fullName || authUser.email.split('@')[0] : 'Account'}
            </span>
            <span className="text-[9px] text-emerald-400 leading-tight">
              {authUser ? 'Online' : 'Sign In'}
            </span>
          </div>
        </button>
      </div>

      {/* SQL Setup Modal for Supabase Sync */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 w-full max-w-xl rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <Database className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-slate-100 text-base">Enable Multi-Device Cloud Sync</h3>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              To keep your data synced across your phone and laptop in real-time, your Supabase project needs one sync table. Run this command in your Supabase project dashboard:
            </p>

            <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside bg-slate-950 p-3 rounded-xl border border-slate-800">
              <li>Open your <strong>Supabase Dashboard</strong>.</li>
              <li>Click <strong>SQL Editor</strong> in the left sidebar.</li>
              <li>Click <strong>New query</strong>, paste the snippet below, and click <strong>Run</strong>.</li>
            </ol>

            <div className="relative">
              <pre className="text-[11px] font-mono bg-slate-950 p-3.5 rounded-xl text-cyan-300 border border-slate-800 overflow-x-auto max-h-40">
                {sqlSetupScript}
              </pre>
              <button
                onClick={copySql}
                className="absolute top-2 right-2 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 transition shadow"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copied!' : 'Copy SQL'}</span>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setShowSqlModal(false);
                  triggerCloudSync();
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition"
              >
                Done! Test Sync Now
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
