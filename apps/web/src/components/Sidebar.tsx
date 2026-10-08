import React from 'react';
import { useApp, type ActiveTab } from '../store/AppContext';
import {
  LayoutDashboard,
  Receipt,
  BookOpen,
  Landmark,
  Boxes,
  Users2,
  Building,
  BarChart3,
  ScanLine,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ElementType;
  badge?: string;
  hotkey?: string;
}

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen } = useApp();

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard & AI', icon: LayoutDashboard },
    { id: 'vouchers', label: 'Vouchers / Day Book', icon: Receipt, hotkey: 'V' },
    { id: 'accounts', label: 'Chart of Accounts', icon: BookOpen, hotkey: 'A' },
    { id: 'gst', label: 'GST & Compliance', icon: Landmark, badge: 'GSTR-1/3B' },
    { id: 'inventory', label: 'Inventory & Stock', icon: Boxes, hotkey: 'I' },
    { id: 'payroll', label: 'Payroll & HR', icon: Users2 },
    { id: 'banking', label: 'Banking & BRS', icon: Building },
    { id: 'reports', label: 'Financial Reports', icon: BarChart3, hotkey: 'R' },
    { id: 'ocr', label: 'Smart Receipt Scanner', icon: ScanLine, badge: 'PRO' },
    { id: 'settings', label: 'Settings & Cloud', icon: Settings },
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <span className="text-white font-black text-lg tracking-wider">N</span>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-slate-100 tracking-tight text-base">NEWBAL</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold px-1.5 py-0.2 rounded uppercase">
                  Prime
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Enterprise ERP</p>
            </div>
          </div>

          {/* Mobile close button */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-12rem)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={`w-4 h-4 transition-colors shrink-0 ${
                      isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-300'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-mono font-medium border border-slate-700">
                      {item.badge}
                    </span>
                  )}
                  {item.hotkey && (
                    <span className="hidden group-hover:inline-block text-[10px] text-slate-500 font-mono">
                      [{item.hotkey}]
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Pro Highlights */}
      <div className="p-4 m-3 rounded-xl bg-gradient-to-br from-slate-800/90 to-slate-900 border border-slate-800 text-xs shrink-0">
        <div className="flex items-center space-x-2 text-emerald-400 font-semibold mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Universal & Cloud Ready</span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          Offline local security with optional Supabase cloud sync across all your phones, tablets & PCs.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on screens < 1024px) */}
      <aside className="hidden lg:flex w-64 bg-slate-900/95 border-r border-slate-800 flex-col justify-between shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile Drawer (visible on screens < 1024px when isMobileMenuOpen is true) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Drawer content */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 shadow-2xl z-10 animate-in slide-in-from-left duration-200 flex flex-col">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
