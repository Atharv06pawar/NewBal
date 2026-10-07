import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { db } from '../../lib/db';
import type { Company } from '@newbal/shared';
import {
  Settings,
  Building2,
  HardDriveDownload,
  Upload,
  FileCode,
  ShieldCheck,
  Plus,
  Clock,
  CheckCircle2,
  X,
  Check,
  UserCheck,
  Link2,
} from 'lucide-react';
import { ExportEngine } from '../../lib/exportEngine';

export const SettingsView: React.FC = () => {
  const { activeCompany, companies, setActiveCompany, triggerRefresh, refreshKey, setIsMasterAccountOpen } = useApp();
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isNewCompanyModalOpen, setIsNewCompanyModalOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  // New Company fields
  const [compName, setCompName] = useState('');
  const [gstin, setGstin] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [stateCode, setStateCode] = useState('27');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    async function loadLogs() {
      const logs = await db.auditLogs.reverse().sortBy('timestamp');
      setAuditLogs(logs.slice(0, 15));
    }
    loadLogs();
  }, [refreshKey]);

  // Handle Create Company
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName) return;

    const newComp: Company = {
      id: `comp-${Date.now()}`,
      name: compName,
      gstin: gstin || undefined,
      email: email || 'accounts@company.com',
      phone: phone || '+91 99999 88888',
      address: address || 'Commercial Hub',
      state,
      stateCode,
      pincode: '400001',
      financialYearStart: '2024-04-01',
      booksBeginningFrom: '2024-04-01',
      currencySymbol: '₹',
      currencyCode: 'INR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.companies.add(newComp);

    // Seed standard chart of accounts for the new company
    await db.ledgerGroups.bulkAdd([
      { id: `grp-cap-${newComp.id}`, companyId: newComp.id, name: 'Capital Account', category: 'EQUITY', isPrimary: true },
      { id: `grp-ca-${newComp.id}`, companyId: newComp.id, name: 'Current Assets', category: 'ASSET', isPrimary: true },
      { id: `grp-cl-${newComp.id}`, companyId: newComp.id, name: 'Current Liabilities', category: 'LIABILITY', isPrimary: true },
      { id: `grp-sales-${newComp.id}`, companyId: newComp.id, name: 'Sales Accounts', category: 'INCOME', isPrimary: true, affectsGrossProfit: true },
      { id: `grp-pur-${newComp.id}`, companyId: newComp.id, name: 'Purchase Accounts', category: 'EXPENSE', isPrimary: true, affectsGrossProfit: true },
    ]);

    await db.ledgers.bulkAdd([
      {
        id: `led-cash-${newComp.id}`,
        companyId: newComp.id,
        name: 'Cash A/c',
        groupId: `grp-ca-${newComp.id}`,
        category: 'ASSET',
        openingBalance: 10000,
        openingBalanceType: 'DR',
        isBankOrCash: true,
      },
      {
        id: `led-sales-${newComp.id}`,
        companyId: newComp.id,
        name: 'General Sales',
        groupId: `grp-sales-${newComp.id}`,
        category: 'INCOME',
        openingBalance: 0,
        openingBalanceType: 'CR',
      },
    ]);

    await db.auditLogs.add({
      id: `log-${Date.now()}`,
      companyId: newComp.id,
      timestamp: new Date().toISOString(),
      action: 'CREATE',
      entity: 'COMPANY',
      entityId: newComp.id,
      details: `Created new Company "${newComp.name}"`,
      user: 'Administrator',
    });

    setActiveCompany(newComp);
    triggerRefresh();
    setIsNewCompanyModalOpen(false);
    setFeedback(`Company "${newComp.name}" created and set as active.`);
    setTimeout(() => setFeedback(''), 5000);
  };

  // Restore JSON backup
  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ok = await ExportEngine.importBackupJSON(file);
    if (ok) {
      setFeedback('Database successfully restored from JSON backup!');
      triggerRefresh();
      setTimeout(() => setFeedback(''), 5000);
    } else {
      alert('Failed to restore backup file');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center space-x-2">
          <Settings className="w-6 h-6 text-emerald-400" />
          <span>System Settings, Multi-Company & Backups</span>
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Manage companies, perform zero-cost offline backups, and audit system activities
        </p>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Single Master Account & Cross-Device Section */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-emerald-950/20 border border-emerald-500/30 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-100 text-base">Single Master Account & Cross-Device Control</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manage all your businesses, vouchers, and accounts from any phone, laptop, or tablet using one account
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsMasterAccountOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 shadow-md shadow-emerald-950/40 transition shrink-0"
          >
            <Link2 className="w-4 h-4" />
            <span>Manage Devices & Sync</span>
          </button>
        </div>
      </div>

      {/* Companies Management Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-slate-100 text-base">Registered Companies ({companies.length})</h3>
          </div>
          <button
            onClick={() => setIsNewCompanyModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 shadow-md shadow-emerald-950/40"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Company</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {companies.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveCompany(c)}
              className={`p-5 rounded-xl border cursor-pointer transition ${
                activeCompany?.id === c.id
                  ? 'bg-slate-950 border-emerald-500 shadow-md shadow-emerald-950/20'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-100 text-sm">{c.name}</span>
                {activeCompany?.id === c.id && (
                  <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                    Active Company
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-1 font-mono">
                GSTIN: {c.gstin || 'Unregistered'} • State: {c.state} ({c.stateCode})
              </div>
              <div className="text-xs text-slate-500 mt-1">{c.address}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Backup & Data Portability Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-slate-100 text-base">Offline Backup & Data Portability</h3>
        </div>
        <p className="text-xs text-slate-400">
          Your data is stored 100% locally on your machine in IndexedDB. You can export or restore anytime.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* JSON Full Backup */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <div className="font-bold text-xs text-slate-200 flex items-center space-x-1.5">
              <HardDriveDownload className="w-4 h-4 text-emerald-400" />
              <span>Full Offline JSON Backup</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Downloads all ledgers, vouchers, inventory items, payroll and settings as a portable JSON file.
            </p>
            <button
              onClick={() => ExportEngine.exportFullBackupJSON()}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
            >
              Download JSON Backup
            </button>
          </div>

          {/* JSON Restore */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <div className="font-bold text-xs text-slate-200 flex items-center space-x-1.5">
              <Upload className="w-4 h-4 text-blue-400" />
              <span>Restore from Backup</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Restore previously downloaded backup JSON file onto any device with zero server dependency.
            </p>
            <label className="block text-center w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 cursor-pointer transition">
              <span>Select File to Restore</span>
              <input type="file" accept=".json" onChange={handleRestoreFile} className="hidden" />
            </label>
          </div>

          {/* Tally XML Export */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <div className="font-bold text-xs text-slate-200 flex items-center space-x-1.5">
              <FileCode className="w-4 h-4 text-amber-400" />
              <span>Universal Tally XML Export</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Export standard Tally XML vouchers and ledgers so your external CA or auditor can open it in Tally.
            </p>
            <button
              onClick={() => ExportEngine.exportTallyXML(activeCompany!.id)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-medium rounded-lg border border-slate-700 transition"
            >
              Export Tally XML
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-slate-100 text-base">System Audit Trail</h3>
        </div>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3 font-sans">Details</th>
                <th className="p-3">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40">
                  <td className="p-3 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="p-3 font-bold text-emerald-400">{log.action}</td>
                  <td className="p-3 text-slate-300">{log.entity}</td>
                  <td className="p-3 font-sans text-slate-300">{log.details}</td>
                  <td className="p-3 text-slate-400">{log.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Company Modal */}
      {isNewCompanyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">Create New Company</h3>
              <button
                onClick={() => setIsNewCompanyModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Company Legal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zenith Tech Ventures Pvt Ltd"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    placeholder="27AABCA1234F1Z5"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">State</label>
                  <select
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      if (e.target.value === 'Maharashtra') setStateCode('27');
                      else if (e.target.value === 'Karnataka') setStateCode('29');
                      else if (e.target.value === 'Delhi') setStateCode('07');
                      else if (e.target.value === 'Gujarat') setStateCode('24');
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Maharashtra">Maharashtra (27)</option>
                    <option value="Karnataka">Karnataka (29)</option>
                    <option value="Delhi">Delhi (07)</option>
                    <option value="Gujarat">Gujarat (24)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="accounts@zenith.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+91 98000 00000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Plot 10, MIDC Industrial Area"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewCompanyModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 shadow-md shadow-emerald-950/40"
                >
                  <Check className="w-4 h-4" />
                  <span>Create Company</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
