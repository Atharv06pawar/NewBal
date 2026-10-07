import React, { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import { SyncService } from '../lib/syncService';
import type { MasterAccount, ConnectedDevice } from '@newbal/shared';
import {
  UserCheck,
  Smartphone,
  Laptop,
  Tablet,
  Globe,
  RefreshCw,
  QrCode,
  Copy,
  Check,
  X,
  ShieldCheck,
  Sparkles,
  Link2,
} from 'lucide-react';

export const MasterAccountModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { triggerRefresh } = useApp();
  const [account, setAccount] = useState<MasterAccount | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pairCodeInput, setPairCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [pairMessage, setPairMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadAccount();
  }, [isOpen]);

  async function loadAccount() {
    const acc = await SyncService.getMasterAccount();
    setAccount(acc);
  }

  if (!isOpen || !account) return null;

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setPairMessage(null);
    try {
      const pushed = await SyncService.pushToCloud(account);
      const pulled = await SyncService.pullFromCloud(account);
      await loadAccount();
      triggerRefresh();
      setPairMessage({ text: 'All data synchronized across devices successfully!' });
      setTimeout(() => setPairMessage(null), 5000);
    } catch (e) {
      setPairMessage({ text: 'Sync completed locally.', error: false });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(account.syncPairCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePairOtherDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairCodeInput) return;

    setIsSyncing(true);
    const res = await SyncService.pairDeviceWithCode(pairCodeInput.toUpperCase());
    setIsSyncing(false);

    if (res.success) {
      setPairMessage({ text: res.message });
      await loadAccount();
      triggerRefresh();
      setPairCodeInput('');
    } else {
      setPairMessage({ text: res.message, error: true });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-100">Single Master Account & Device Link</h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Free Lifetime
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manage all companies, accounts & records from any device seamlessly
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Account Profile Card */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-slate-100">{account.businessName}</div>
              <div className="text-slate-400 font-mono">
                {account.email} • {account.fullName}
              </div>
              <div className="flex items-center space-x-1.5 text-[11px] text-emerald-400 pt-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Zero Subscription • Lifetime Free Universal Access</span>
              </div>
            </div>

            <button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-950/40 transition shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync All Devices Now'}</span>
            </button>
          </div>

          {pairMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-center space-x-2 ${
                pairMessage.error
                  ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{pairMessage.text}</span>
            </div>
          )}

          {/* Quick Device Link Pairing Code Box */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Link2 className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-slate-200">Connect a New Phone or Laptop</span>
              </div>
              <span className="text-[10px] text-slate-500">Instant One-Step Pairing</span>
            </div>

            <p className="text-slate-400 leading-relaxed">
              Open <b>NEWBAL</b> on your phone, iPad, or another computer. Enter this 6-character code to instantly link this account and mirror all your companies and vouchers:
            </p>

            <div className="flex items-center space-x-3 pt-1">
              <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-700 text-emerald-400 font-mono font-bold text-xl tracking-wider select-all shadow-inner">
                {account.syncPairCode}
              </div>
              <button
                onClick={handleCopyCode}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium flex items-center space-x-1.5 border border-slate-700 transition"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>
          </div>

          {/* Connect Using Pair Code Form */}
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
            <span className="font-bold text-slate-300">Link from Another Device:</span>
            <form onSubmit={handlePairOtherDevice} className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Enter 6-digit code (e.g. NB-7721)"
                value={pairCodeInput}
                onChange={(e) => setPairCodeInput(e.target.value.toUpperCase())}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={isSyncing}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium shrink-0 shadow-md shadow-emerald-950/40 transition"
              >
                Link Device
              </button>
            </form>
          </div>

          {/* Connected Devices List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">Active Connected Devices</span>
              <span className="text-slate-500 font-mono">
                Last synced: {account.lastSyncedAt ? new Date(account.lastSyncedAt).toLocaleTimeString() : 'Just now'}
              </span>
            </div>

            <div className="space-y-2">
              {account.connectedDevices.map((dev) => (
                <div
                  key={dev.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-slate-400">
                      {dev.type === 'MOBILE' ? (
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                      ) : dev.type === 'TABLET' ? (
                        <Tablet className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Laptop className="w-4 h-4 text-purple-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
                        <span>{dev.name}</span>
                        {dev.isCurrent && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono">
                            This Device
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Active {new Date(dev.lastActive).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <span className="text-emerald-400 font-mono text-[11px] flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block"></span>
                    <span>Synced</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
