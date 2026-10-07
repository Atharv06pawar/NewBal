import React from 'react';
import { useApp } from './store/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { QuickSearchModal } from './components/QuickSearchModal';
import { NewVoucherModal } from './modules/accounting/NewVoucherModal';
import { MasterAccountModal } from './components/MasterAccountModal';
import { AuthModal } from './components/AuthModal';

import { DashboardView } from './modules/dashboard/DashboardView';
import { VouchersView } from './modules/accounting/VouchersView';
import { ChartOfAccountsView } from './modules/accounting/ChartOfAccountsView';
import { GSTView } from './modules/gst/GSTView';
import { InventoryView } from './modules/inventory/InventoryView';
import { PayrollView } from './modules/payroll/PayrollView';
import { BankingView } from './modules/banking/BankingView';
import { ReportsView } from './modules/reports/ReportsView';
import { OCRScannerView } from './modules/ocr/OCRScannerView';
import { SettingsView } from './modules/settings/SettingsView';

export const App: React.FC = () => {
  const {
    activeTab,
    isLoading,
    isMasterAccountOpen,
    setIsMasterAccountOpen,
    isAuthModalOpen,
    setIsAuthModalOpen,
    authUser,
    setAuthUser,
  } = useApp();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center animate-pulse shadow-xl shadow-emerald-500/20">
          <span className="text-white font-black text-xl">N</span>
        </div>
        <div className="text-slate-400 text-sm font-mono animate-pulse">Initializing NEWBAL Universal ERP...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Responsive Left Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />

        {/* Content with bottom safe area for mobile navigation */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'vouchers' && <VouchersView />}
          {activeTab === 'accounts' && <ChartOfAccountsView />}
          {activeTab === 'gst' && <GSTView />}
          {activeTab === 'inventory' && <InventoryView />}
          {activeTab === 'payroll' && <PayrollView />}
          {activeTab === 'banking' && <BankingView />}
          {activeTab === 'reports' && <ReportsView />}
          {activeTab === 'ocr' && <OCRScannerView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>

        {/* Mobile Thumb Navigation Bar */}
        <BottomNav />
      </div>

      {/* Global Modals */}
      <QuickSearchModal />
      <NewVoucherModal />
      <MasterAccountModal isOpen={isMasterAccountOpen} onClose={() => setIsMasterAccountOpen(false)} />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={authUser}
        onAuthSuccess={(user) => setAuthUser(user)}
      />
    </div>
  );
};
