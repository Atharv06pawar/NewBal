import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Company, VoucherType } from '@newbal/shared';
import { db } from '../lib/db';
import { checkAndSeedInitialData } from '../lib/seed';
import { AuthService, type AuthUserProfile } from '../lib/supabase';
import { CloudSyncEngine, type SyncState } from '../lib/cloudSyncEngine';

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
  syncState: SyncState;
  syncMessage: string;
  needsSqlSetup: boolean;
  triggerCloudSync: () => void;
  handleLoginSuccess: (user: AuthUserProfile) => Promise<void>;
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

  // Live Cloud Sync State
  const [syncState, setSyncState] = useState<SyncState>('IDLE');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [needsSqlSetup, setNeedsSqlSetup] = useState<boolean>(false);

  const triggerRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    // Push activity immediately on every update
    CloudSyncEngine.pushActivity();
  };

  const triggerCloudSync = () => {
    CloudSyncEngine.syncAll(() => triggerRefresh());
  };

  const handleLoginSuccess = async (user: AuthUserProfile) => {
    setAuthUser(user);
    if (user?.id) {
      CloudSyncEngine.setupRealtime(user.id, () => {
        setRefreshKey((prev) => prev + 1);
      });
      await CloudSyncEngine.syncAll(() => {
        setRefreshKey((prev) => prev + 1);
      });
      setRefreshKey((prev) => prev + 1);
    }
  };

  // Subscribe to CloudSyncEngine state changes
  useEffect(() => {
    const unsub = CloudSyncEngine.subscribe((state, msg) => {
      setSyncState(state);
      setSyncMessage(msg || '');
      setNeedsSqlSetup(CloudSyncEngine.getState().needsSqlSetup);
    });
    return unsub;
  }, []);

  // Initialize and load company data + CloudSyncEngine once on mount
  useEffect(() => {
    async function init() {
      try {
        const defaultComp = await checkAndSeedInitialData();
        const allComps = await db.companies.toArray();
        setCompanies(allComps);
        setActiveCompany(defaultComp);

        const currentAuth = await AuthService.getCurrentUser();
        setAuthUser(currentAuth);

        // Start background cloud sync engine
        CloudSyncEngine.init(() => {
          setRefreshKey((prev) => prev + 1);
        });

        if (currentAuth?.id) {
          CloudSyncEngine.setupRealtime(currentAuth.id, () => {
            setRefreshKey((prev) => prev + 1);
          });
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Reload company data when refreshKey updates without re-running initialization
  useEffect(() => {
    async function reloadOnRefresh() {
      try {
        const allComps = await db.companies.toArray();
        if (allComps.length > 0) {
          setCompanies(allComps);
          setActiveCompany((prev) => {
            if (!prev) return allComps[0];
            const match = allComps.find((c) => c.id === prev.id);
            return match || allComps[0];
          });
        }
      } catch (e) {}
    }
    reloadOnRefresh();
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
        syncState,
        syncMessage,
        needsSqlSetup,
        triggerCloudSync,
        handleLoginSuccess,
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
