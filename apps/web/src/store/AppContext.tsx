import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Company, VoucherType } from '@newbal/shared';
import { db } from '../lib/db';
import { checkAndSeedInitialData } from '../lib/seed';
import { AuthService, type AuthUserProfile } from '../lib/supabase';

export type ActiveTab =
  | 'dashboard'
  | 'vouchers'
  | 'accounts'
  | 'inventory'
  | 'payroll'
  | 'banking'
  | 'gst'
  | 'reports'
  | 'ocr'
  | 'settings';

interface AppContextType {
  activeCompany: Company | null;
  companies: Company[];
  setActiveCompany: (company: Company) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isGoToOpen: boolean;
  setIsGoToOpen: (open: boolean) => void;
  isMasterAccountOpen: boolean;
  setIsMasterAccountOpen: (open: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authUser: AuthUserProfile | null;
  setAuthUser: (user: AuthUserProfile | null) => void;
  isNewVoucherOpen: boolean;
  newVoucherType: VoucherType;
  openNewVoucher: (type?: VoucherType) => void;
  closeNewVoucher: () => void;
  selectedLedgerForStatement: string | null;
  openLedgerStatement: (ledgerId: string) => void;
  closeLedgerStatement: () => void;
  refreshKey: number;
  triggerRefresh: () => void;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isGoToOpen, setIsGoToOpen] = useState(false);
  const [isMasterAccountOpen, setIsMasterAccountOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUserProfile | null>(null);
  const [isNewVoucherOpen, setIsNewVoucherOpen] = useState(false);
  const [newVoucherType, setNewVoucherType] = useState<VoucherType>('SALES');
  const [selectedLedgerForStatement, setSelectedLedgerForStatement] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const triggerRefresh = () => setRefreshKey((prev) => prev + 1);

  // Initialize and load company data
  useEffect(() => {
    async function init() {
      try {
        const defaultComp = await checkAndSeedInitialData();
        const allComps = await db.companies.toArray();
        setCompanies(allComps);
        setActiveCompany(defaultComp);

        const currentAuth = await AuthService.getCurrentUser();
        setAuthUser(currentAuth);
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [refreshKey]);

  // Keyboard shortcut listener (Tally style F4-F9, Alt+G, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + G: Tally Go To
      if (e.altKey && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        setIsGoToOpen((prev) => !prev);
        return;
      }

      // Escape: close modal
      if (e.key === 'Escape') {
        if (isGoToOpen) setIsGoToOpen(false);
        if (isMasterAccountOpen) setIsMasterAccountOpen(false);
        if (isMobileMenuOpen) setIsMobileMenuOpen(false);
        if (isAuthModalOpen) setIsAuthModalOpen(false);
        if (isNewVoucherOpen) setIsNewVoucherOpen(false);
        if (selectedLedgerForStatement) setSelectedLedgerForStatement(null);
        return;
      }

      // Tally Function Key Shortcuts
      if (!e.altKey && !e.ctrlKey && !e.metaKey) {
        switch (e.key) {
          case 'F4':
            e.preventDefault();
            openNewVoucher('CONTRA');
            break;
          case 'F5':
            e.preventDefault();
            openNewVoucher('PAYMENT');
            break;
          case 'F6':
            e.preventDefault();
            openNewVoucher('RECEIPT');
            break;
          case 'F7':
            e.preventDefault();
            openNewVoucher('JOURNAL');
            break;
          case 'F8':
            e.preventDefault();
            openNewVoucher('SALES');
            break;
          case 'F9':
            e.preventDefault();
            openNewVoucher('PURCHASE');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGoToOpen, isNewVoucherOpen, selectedLedgerForStatement]);

  const openNewVoucher = (type: VoucherType = 'SALES') => {
    setNewVoucherType(type);
    setIsNewVoucherOpen(true);
  };

  const closeNewVoucher = () => setIsNewVoucherOpen(false);
  const openLedgerStatement = (ledgerId: string) => setSelectedLedgerForStatement(ledgerId);
  const closeLedgerStatement = () => setSelectedLedgerForStatement(null);

  return (
    <AppContext.Provider
      value={{
        activeCompany,
        companies,
        setActiveCompany,
        activeTab,
        setActiveTab,
        isGoToOpen,
        setIsGoToOpen,
        isMasterAccountOpen,
        setIsMasterAccountOpen,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authUser,
        setAuthUser,
        isNewVoucherOpen,
        newVoucherType,
        openNewVoucher,
        closeNewVoucher,
        selectedLedgerForStatement,
        openLedgerStatement,
        closeLedgerStatement,
        refreshKey,
        triggerRefresh,
        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
