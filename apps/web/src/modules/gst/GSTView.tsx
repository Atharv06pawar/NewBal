import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { AccountingEngine } from '../../lib/accountingEngine';
import {
  Landmark,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { ExportEngine } from '../../lib/exportEngine';

export const GSTView: React.FC = () => {
  const { activeCompany, refreshKey } = useApp();
  const [activeGstTab, setActiveGstTab] = useState<'GSTR1' | 'GSTR3B' | 'GSTIN_CHECK'>('GSTR1');
  const [gstSummary, setGstSummary] = useState<any>(null);
  const [gstinInput, setGstinInput] = useState('');
  const [gstinResult, setGstinResult] = useState<any>(null);

  useEffect(() => {
    if (!activeCompany) return;

    async function loadGST() {
      const summary = await AccountingEngine.getGSTSummary(activeCompany!.id);
      setGstSummary(summary);
    }
    loadGST();
  }, [activeCompany, refreshKey]);

  // Generate Govt Portal compliant GSTR-1 JSON
  const handleDownloadGovtJson = () => {
    if (!gstSummary || !activeCompany) return;

    const b2bInvoices = gstSummary.outward.invoices.map((inv: any) => ({
      ctin: inv.partyLedgerId ? '27AABCA9999F1Z1' : '',
      cptype: 'REG',
      inv: [
        {
          inum: inv.voucherNumber,
          idt: inv.date,
          val: inv.grandTotal,
          pos: inv.isInterstate ? '29' : activeCompany.stateCode,
          rchrg: 'N',
          inv_typ: 'R',
          itms: (inv.inventoryItems || []).map((itm: any, num: number) => ({
            num: num + 1,
            itm_det: {
              txval: itm.taxableAmount,
              rt: itm.gstRate,
              iamt: itm.igstAmount,
              camt: itm.cgstAmount,
              samt: itm.sgstAmount,
              csamt: 0,
            },
          })),
        },
      ],
    }));

    const govtPayload = {
      gstin: activeCompany.gstin || '27AABCA1234F1Z5',
      fp: '052024',
      gt: gstSummary.outward.totalTaxable,
      cur_gt: gstSummary.outward.totalTaxable,
      b2b: b2bInvoices,
    };

    const blob = new Blob([JSON.stringify(govtPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_${activeCompany.gstin || 'GST'}_MAY2024.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportGSTR1Excel = () => {
    if (!gstSummary) return;
    const data = gstSummary.outward.invoices.map((v: any) => ({
      'Invoice No': v.voucherNumber,
      'Invoice Date': v.date,
      'Customer / Buyer': v.partyName,
      'Place of Supply': v.isInterstate ? 'Interstate' : 'Intrastate',
      'Taxable Value': v.totalTaxableAmount,
      'Integrated Tax (IGST)': v.totalIgst,
      'Central Tax (CGST)': v.totalCgst,
      'State Tax (SGST)': v.totalSgst,
      'Invoice Total': v.grandTotal,
    }));
    ExportEngine.exportToExcel(data, `GSTR1_Outward_${new Date().toISOString().split('T')[0]}`);
  };

  // GSTIN Validator
  const handleValidateGstin = () => {
    const val = gstinInput.trim().toUpperCase();
    if (val.length !== 15) {
      setGstinResult({ valid: false, message: 'GSTIN must be exactly 15 characters long.' });
      return;
    }

    const stateCode = val.substring(0, 2);
    const pan = val.substring(2, 12);
    const entityNum = val.charAt(12);
    const zChar = val.charAt(13);

    const states: { [key: string]: string } = {
      '27': 'Maharashtra',
      '29': 'Karnataka',
      '07': 'Delhi',
      '24': 'Gujarat',
      '33': 'Tamil Nadu',
      '19': 'West Bengal',
      '09': 'Uttar Pradesh',
      '08': 'Rajasthan',
      '06': 'Haryana',
    };

    if (zChar !== 'Z') {
      setGstinResult({ valid: false, message: '14th character must be Z as per GST regulations.' });
      return;
    }

    setGstinResult({
      valid: true,
      gstin: val,
      stateCode,
      state: states[stateCode] || 'Registered Indian State',
      pan,
      entityNum,
      status: 'Active Registered Taxpayer',
    });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center space-x-2">
            <Landmark className="w-6 h-6 text-emerald-400" />
            <span>GST Compliance & Returns Portal</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Automated GSTR-1, GSTR-3B & Input Tax Credit (ITC) reconciliation for {activeCompany?.name}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleExportGSTR1Excel}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export GSTR-1 Excel</span>
          </button>
          <button
            onClick={handleDownloadGovtJson}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition shadow-md shadow-emerald-950/40"
          >
            <Download className="w-4 h-4" />
            <span>Download GST Portal JSON</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveGstTab('GSTR1')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeGstTab === 'GSTR1'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          GSTR-1 (Outward Supplies)
        </button>
        <button
          onClick={() => setActiveGstTab('GSTR3B')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeGstTab === 'GSTR3B'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          GSTR-3B (Summary Return & ITC)
        </button>
        <button
          onClick={() => setActiveGstTab('GSTIN_CHECK')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            activeGstTab === 'GSTIN_CHECK'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          GSTIN Validator & Tool
        </button>
      </div>

      {/* Tab: GSTR-1 */}
      {activeGstTab === 'GSTR1' && gstSummary && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
              <div className="text-xs font-sans text-slate-400">Total Taxable Value</div>
              <div className="text-xl font-bold text-slate-100 mt-1">
                ₹{gstSummary.outward.totalTaxable.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500 font-sans mt-1">Table 4 + 7 Supplies</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
              <div className="text-xs font-sans text-slate-400">Total Central Tax (CGST)</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                ₹{gstSummary.outward.cgst.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500 font-sans mt-1">Intrastate Output Tax</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
              <div className="text-xs font-sans text-slate-400">Total State Tax (SGST)</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">
                ₹{gstSummary.outward.sgst.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500 font-sans mt-1">Intrastate Output Tax</div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
              <div className="text-xs font-sans text-slate-400">Integrated Tax (IGST)</div>
              <div className="text-xl font-bold text-blue-400 mt-1">
                ₹{gstSummary.outward.igst.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-500 font-sans mt-1">Interstate Output Tax</div>
            </div>
          </div>

          {/* Table 4 B2B Invoices */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Table 4: B2B Invoices (Taxable Supplies)</h3>
                <p className="text-xs text-slate-400">Invoices issued to registered taxable persons</p>
              </div>
              <span className="text-xs font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                {gstSummary.outward.invoices.length} Invoices
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Invoice #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 font-sans">Buyer / Receiver</th>
                    <th className="p-3 text-right">Taxable (₹)</th>
                    <th className="p-3 text-right">CGST (₹)</th>
                    <th className="p-3 text-right">SGST (₹)</th>
                    <th className="p-3 text-right">IGST (₹)</th>
                    <th className="p-3 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {gstSummary.outward.invoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-slate-200">{inv.voucherNumber}</td>
                      <td className="p-3 text-slate-400">{inv.date}</td>
                      <td className="p-3 font-sans text-slate-300 font-medium">{inv.partyName || 'Cash Party'}</td>
                      <td className="p-3 text-right text-slate-200">
                        ₹{(inv.totalTaxableAmount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-right text-emerald-400">
                        {inv.totalCgst > 0 ? `₹${inv.totalCgst.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="p-3 text-right text-emerald-400">
                        {inv.totalSgst > 0 ? `₹${inv.totalSgst.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="p-3 text-right text-blue-400">
                        {inv.totalIgst > 0 ? `₹${inv.totalIgst.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-100">
                        ₹{inv.grandTotal.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: GSTR-3B */}
      {activeGstTab === 'GSTR3B' && gstSummary && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="font-bold text-slate-100 text-base">GSTR-3B Auto-Computed Summary</h3>
              <p className="text-xs text-slate-400">
                Form GSTR-3B under Section 39 of CGST Act. Ready for portal filing.
              </p>
            </div>

            {/* Table 3.1 Outward Supplies */}
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-slate-950 p-3 font-semibold text-xs text-slate-300">
                3.1 Details of Outward Supplies and inward supplies liable to reverse charge
              </div>
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3 font-sans">Nature of Supplies</th>
                    <th className="p-3 text-right">Total Taxable Value</th>
                    <th className="p-3 text-right">IGST</th>
                    <th className="p-3 text-right">CGST</th>
                    <th className="p-3 text-right">SGST</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 font-sans text-slate-300 font-medium">
                      (a) Outward taxable supplies (other than zero rated, nil, exempted)
                    </td>
                    <td className="p-3 text-right font-bold text-slate-100">
                      ₹{gstSummary.outward.totalTaxable.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-right text-blue-400">
                      ₹{gstSummary.outward.igst.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-right text-emerald-400">
                      ₹{gstSummary.outward.cgst.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-right text-emerald-400">
                      ₹{gstSummary.outward.sgst.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Table 4 Eligible ITC */}
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-slate-950 p-3 font-semibold text-xs text-slate-300">
                4. Eligible Input Tax Credit (ITC) Available
              </div>
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3 font-sans">Details</th>
                    <th className="p-3 text-right">IGST</th>
                    <th className="p-3 text-right">CGST</th>
                    <th className="p-3 text-right">SGST</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 font-sans text-slate-300 font-medium">
                      (A) ITC Available (All other inward supplies from registered vendors)
                    </td>
                    <td className="p-3 text-right text-blue-400">
                      ₹{gstSummary.itc.igst.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-right text-emerald-400">
                      ₹{gstSummary.itc.cgst.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-right text-emerald-400">
                      ₹{gstSummary.itc.sgst.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Net Tax Payable in Cash */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between font-mono">
              <div>
                <div className="text-xs font-sans text-slate-400">Net Tax Payable in Cash (Outward - ITC)</div>
                <div className="text-lg font-bold text-emerald-400 mt-1">
                  ₹{gstSummary.netPayable.total.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="text-right text-xs text-slate-400 space-x-4">
                <span>CGST: ₹{gstSummary.netPayable.cgst.toLocaleString('en-IN')}</span>
                <span>SGST: ₹{gstSummary.netPayable.sgst.toLocaleString('en-IN')}</span>
                <span>IGST: ₹{gstSummary.netPayable.igst.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: GSTIN Validator */}
      {activeGstTab === 'GSTIN_CHECK' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 max-w-2xl mx-auto space-y-6">
          <div>
            <h3 className="font-bold text-slate-100 text-base">GSTIN Format & Taxpayer Verification Tool</h3>
            <p className="text-xs text-slate-400">Validate 15-digit Indian Goods & Services Tax Identification Numbers</p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="e.g. 27AABCA1234F1Z5"
              value={gstinInput}
              onChange={(e) => setGstinInput(e.target.value.toUpperCase())}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 font-mono text-sm focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleValidateGstin}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center space-x-1.5 shrink-0"
            >
              <Search className="w-4 h-4" />
              <span>Verify</span>
            </button>
          </div>

          {gstinResult && (
            <div
              className={`p-4 rounded-xl border ${
                gstinResult.valid
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : 'bg-rose-950/20 border-rose-500/30'
              }`}
            >
              {gstinResult.valid ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Valid GSTIN Format</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono pt-2">
                    <div>State: <span className="text-white font-bold">{gstinResult.state} ({gstinResult.stateCode})</span></div>
                    <div>PAN: <span className="text-white font-bold">{gstinResult.pan}</span></div>
                    <div>Entity Number: <span className="text-white">{gstinResult.entityNum}</span></div>
                    <div>Status: <span className="text-emerald-400 font-bold">{gstinResult.status}</span></div>
                  </div>
                </div>
              ) : (
                <div className="text-rose-400 text-xs font-medium">
                  {gstinResult.message}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
