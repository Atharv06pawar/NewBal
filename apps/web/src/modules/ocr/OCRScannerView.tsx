import React, { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { db } from '../../lib/db';
import { AuditSecurityEngine } from '../../lib/auditSecurity';
import {
  FileText,
  Upload,
  CheckCircle2,
  ArrowRight,
  Paperclip,
  X,
  FileCheck2,
} from 'lucide-react';

export const OCRScannerView: React.FC = () => {
  const { activeCompany, triggerRefresh, setActiveTab } = useApp();
  const [uploadedFile, setUploadedFile] = useState<{ name: string; type: string; base64: string } | null>(null);

  // Bill metadata fields
  const [vendorName, setVendorName] = useState('Global Micro Components Ltd');
  const [vendorGstin, setVendorGstin] = useState('27AABCG5555L1Z4');
  const [invoiceNumber, setInvoiceNumber] = useState(`BILL-${Math.floor(1000 + Math.random() * 9000)}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [taxableAmount, setTaxableAmount] = useState(25000);
  const [gstRate, setGstRate] = useState(18);
  const [isInterstate, setIsInterstate] = useState(false);
  const [description, setDescription] = useState('Procurement of electronic modules and spares');
  const [successMessage, setSuccessMessage] = useState('');

  const halfTaxRate = gstRate / 2;
  const cgst = isInterstate ? 0 : (taxableAmount * halfTaxRate) / 100;
  const sgst = isInterstate ? 0 : (taxableAmount * halfTaxRate) / 100;
  const igst = isInterstate ? (taxableAmount * gstRate) / 100 : 0;
  const grandTotal = taxableAmount + cgst + sgst + igst;

  // Real File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedFile({
        name: file.name,
        type: file.type,
        base64: reader.result as string,
      });
      // Prepopulate invoice number from filename if applicable
      const cleanName = file.name.replace(/\.[^/.]+$/, '').toUpperCase();
      if (cleanName.length > 3) {
        setInvoiceNumber(`INV-${cleanName.slice(0, 8)}`);
      }
    };
    reader.readAsDataURL(file);
  };

  // Convert uploaded bill directly into a Purchase Voucher with attached document and audit hash
  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany) return;

    try {
      const leds = await db.ledgers.where('companyId').equals(activeCompany.id).toArray();
      const party = leds.find((l) => l.name.toLowerCase().includes(vendorName.toLowerCase().split(' ')[0])) || leds.find(l => l.groupId.includes('creditor')) || leds[0];
      const purLed = leds.find((l) => l.name.includes('Purchase')) || leds[0];
      const cgstLed = leds.find((l) => l.id === 'led-cgst-in') || leds[0];
      const sgstLed = leds.find((l) => l.id === 'led-sgst-in') || leds[0];

      const newVoucher: any = {
        id: `vch-doc-${Date.now()}`,
        companyId: activeCompany.id,
        voucherNumber: invoiceNumber,
        voucherType: 'PURCHASE',
        date: invoiceDate,
        partyLedgerId: party.id,
        partyName: party.name,
        referenceNumber: 'ATTACHED-BILL',
        narration: `Inward supply bill: ${description}`,
        totalTaxableAmount: taxableAmount,
        totalCgst: cgst,
        totalSgst: sgst,
        totalIgst: igst,
        grandTotal,
        entries: [
          { ledgerId: purLed.id, ledgerName: purLed.name, amount: taxableAmount, type: 'DR' },
          ...(isInterstate
            ? [{ ledgerId: (leds.find(l => l.name.includes('Input IGST')) || leds[0]).id, ledgerName: 'Input IGST', amount: igst, type: 'DR' }]
            : [
                { ledgerId: cgstLed.id, ledgerName: cgstLed.name, amount: cgst, type: 'DR' },
                { ledgerId: sgstLed.id, ledgerName: sgstLed.name, amount: sgst, type: 'DR' },
              ]),
          { ledgerId: party.id, ledgerName: party.name, amount: grandTotal, type: 'CR' },
        ],
        attachedDocument: uploadedFile || undefined,
        status: 'POSTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Real SHA-256 Tamper-Proof Audit Hash
      const hash = await AuditSecurityEngine.computeVoucherHash(newVoucher);
      newVoucher.auditHash = hash;

      await db.vouchers.add(newVoucher);

      // Audit Log with verification hash
      await db.auditLogs.add({
        id: `log-${Date.now()}`,
        companyId: activeCompany.id,
        timestamp: new Date().toISOString(),
        action: 'CREATE',
        entity: 'VOUCHER',
        entityId: newVoucher.id,
        details: `Document Inward: Created Purchase Voucher ${invoiceNumber} of ₹${grandTotal} [Audit Hash: ${hash.slice(0, 12)}...]`,
        user: 'Administrator',
      });

      triggerRefresh();
      setSuccessMessage('Purchase voucher posted to Day Book with document attachment and SHA-256 audit hash!');
      setTimeout(() => {
        setActiveTab('vouchers');
      }, 1500);
    } catch (err) {
      console.error(err);
      alert('Error creating purchase voucher');
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center space-x-2">
          <FileCheck2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <span>Document & Receipt Inward Manager</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Attach vendor invoices and receipts, verify tax details, and post verified purchase vouchers
        </p>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Real Document Upload Box */}
      <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-6 sm:p-8 text-center space-y-4 bg-slate-900/60 transition group cursor-pointer relative">
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileUpload}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />

        <div className="w-12 sm:w-14 h-12 sm:h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto group-hover:scale-110 transition">
          <Upload className="w-6 sm:w-7 h-6 sm:h-7" />
        </div>

        <div>
          <div className="text-sm sm:text-base font-bold text-slate-200">
            {uploadedFile ? `Attached: ${uploadedFile.name}` : 'Click or drop bill receipt image / PDF here'}
          </div>
          <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, PDF up to 25MB with audit trail storage</p>
        </div>

        {uploadedFile && (
          <div className="pt-2 flex items-center justify-center space-x-2">
            <span className="text-xs font-mono bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center space-x-1">
              <Paperclip className="w-3.5 h-3.5" />
              <span>Document Loaded</span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setUploadedFile(null);
              }}
              className="p-1 rounded bg-slate-800 text-slate-400 hover:text-rose-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Bill Inward Form */}
      <form onSubmit={handleCreateVoucher} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-slate-100 text-sm sm:text-base">Inward Invoice Particulars</h3>
          </div>
          <span className="text-[10px] sm:text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Audit Trail Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Vendor / Supplier Name *</label>
            <input
              type="text"
              required
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Vendor GSTIN</label>
            <input
              type="text"
              value={vendorGstin}
              onChange={(e) => setVendorGstin(e.target.value.toUpperCase())}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Bill / Invoice Number *</label>
            <input
              type="text"
              required
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Invoice Date *</label>
            <input
              type="date"
              required
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Taxable Amount (₹) *</label>
            <input
              type="number"
              required
              value={taxableAmount}
              onChange={(e) => setTaxableAmount(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">GST Tax Slab</label>
            <select
              value={gstRate}
              onChange={(e) => setGstRate(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value={0}>0% (Exempt / Nil)</option>
              <option value={5}>5%</option>
              <option value={12}>12%</option>
              <option value={18}>18% (Standard Goods & Services)</option>
              <option value={28}>28%</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Line Item Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Tax Breakdown & Grand Total */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="space-y-1 text-slate-400">
            <div>Taxable: ₹{taxableAmount.toLocaleString('en-IN')}</div>
            <div>
              GST ({gstRate}%): ₹{(cgst + sgst + igst).toLocaleString('en-IN')}{' '}
              <span className="text-[10px] text-slate-500">
                ({isInterstate ? `IGST ₹${igst}` : `CGST ₹${cgst} + SGST ₹${sgst}`})
              </span>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-[10px] text-slate-500 font-sans">Grand Total Payable</div>
            <div className="text-lg font-bold text-emerald-400">
              ₹{grandTotal.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium flex items-center justify-center space-x-2 shadow-md shadow-emerald-950/40 transition"
          >
            <span>Post Verified Purchase Voucher</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
