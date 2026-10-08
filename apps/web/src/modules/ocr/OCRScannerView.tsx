import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { db } from '../../lib/db';
import { AuditSecurityEngine } from '../../lib/auditSecurity';
import { SmartAccountingEngine, type SmartEntryRecommendation } from '../../lib/smartAccountingEngine';
import type { VoucherType, Ledger } from '@newbal/shared';
import Tesseract from 'tesseract.js';
import {
  FileText,
  Upload,
  CheckCircle2,
  ArrowRight,
  Paperclip,
  X,
  Scan,
  Loader2,
  Sparkles,
  Eye,
  Brain,
  Zap,
  HelpCircle,
} from 'lucide-react';

export const OCRScannerView: React.FC = () => {
  const { activeCompany, triggerRefresh, setActiveTab } = useApp();
  const [uploadedFile, setUploadedFile] = useState<{ name: string; type: string; base64: string } | null>(null);

  // OCR Processing States
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const [showRawText, setShowRawText] = useState(false);

  // Smart Recommendation Engine state
  const [recommendation, setRecommendation] = useState<SmartEntryRecommendation | null>(null);
  const [selectedVoucherType, setSelectedVoucherType] = useState<VoucherType>('PURCHASE');
  const [availableLedgers, setAvailableLedgers] = useState<Ledger[]>([]);

  // Bill metadata fields
  const [partyName, setPartyName] = useState('');
  const [vendorGstin, setVendorGstin] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [taxableAmount, setTaxableAmount] = useState(0);
  const [gstRate, setGstRate] = useState(18);
  const [isInterstate, setIsInterstate] = useState(false);
  const [description, setDescription] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Load ledgers on mount
  useEffect(() => {
    if (!activeCompany) return;
    db.ledgers.where('companyId').equals(activeCompany.id).toArray().then(setAvailableLedgers);
  }, [activeCompany]);

  const halfTaxRate = gstRate / 2;
  const cgst = isInterstate ? 0 : (taxableAmount * halfTaxRate) / 100;
  const sgst = isInterstate ? 0 : (taxableAmount * halfTaxRate) / 100;
  const igst = isInterstate ? (taxableAmount * gstRate) / 100 : 0;
  const grandTotal = taxableAmount + cgst + sgst + igst;

  /**
   * Run Smart Accounting Engine on extracted text
   */
  const processDocumentText = (text: string, filename: string) => {
    if (!availableLedgers.length) return;
    const rec = SmartAccountingEngine.analyzeDocument(
      text,
      filename,
      availableLedgers,
      activeCompany?.gstin
    );

    setRecommendation(rec);
    setSelectedVoucherType(rec.recommendedVoucherType);
    applyRecommendationData(rec);
  };

  /**
   * Apply smart recommendation to form fields
   */
  const applyRecommendationData = (rec: SmartEntryRecommendation) => {
    setSelectedVoucherType(rec.recommendedVoucherType);
    setPartyName(rec.detectedFields.vendorOrPartyName || 'Vendor / Supplier');
    if (rec.detectedFields.vendorGstin) setVendorGstin(rec.detectedFields.vendorGstin);
    if (rec.detectedFields.invoiceNumber) setInvoiceNumber(rec.detectedFields.invoiceNumber);
    if (rec.detectedFields.invoiceDate) setInvoiceDate(rec.detectedFields.invoiceDate);
    setTaxableAmount(rec.detectedFields.taxableAmount);
    setGstRate(rec.detectedFields.gstRate);
    setIsInterstate(rec.detectedFields.isInterstate);
    setDescription(rec.detectedFields.narration);
  };

  // Real File Upload & Trigger Tesseract OCR
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setUploadedFile({
        name: file.name,
        type: file.type,
        base64: base64Data,
      });

      // If it's an image, run real Tesseract OCR on it
      if (file.type.startsWith('image/')) {
        setIsProcessingOcr(true);
        setOcrProgress(5);
        setOcrStatusText('Loading neural OCR recognition engine...');
        setRawOcrText('');
        setRecommendation(null);

        try {
          const result = await Tesseract.recognize(file, 'eng', {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                const pct = Math.round((m.progress || 0) * 100);
                setOcrProgress(pct);
                setOcrStatusText(`Reading text & scanning characters (${pct}%)...`);
              } else if (m.status === 'loading tesseract core') {
                setOcrProgress(15);
                setOcrStatusText('Loading WebAssembly core...');
              } else if (m.status === 'initializing api') {
                setOcrProgress(30);
                setOcrStatusText('Initializing language models...');
              }
            },
          });

          const extracted = result.data.text || '';
          setRawOcrText(extracted);
          processDocumentText(extracted, file.name);
        } catch (err: any) {
          console.error('Tesseract OCR error:', err);
          processDocumentText('', file.name);
        } finally {
          setIsProcessingOcr(false);
        }
      } else {
        // PDF or text file
        processDocumentText(`File ${file.name} inward document`, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  // Convert uploaded bill into appropriate voucher with audit hash
  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany) return;

    try {
      const leds = availableLedgers.length
        ? availableLedgers
        : await db.ledgers.where('companyId').equals(activeCompany.id).toArray();

      let entries: any[] = [];

      if (recommendation && recommendation.recommendedEntries.length > 0) {
        entries = recommendation.recommendedEntries.map((re) => ({
          ledgerId: re.ledgerId,
          ledgerName: re.ledgerName,
          amount: re.amount,
          type: re.type,
        }));
      } else {
        // Fallback default purchase entry
        const party = leds.find((l) => l.name.toLowerCase().includes(partyName.toLowerCase())) || leds[0];
        const purLed = leds.find((l) => l.name.includes('Purchase')) || leds[0];
        const cgstLed = leds.find((l) => l.id === 'led-cgst-in') || leds[0];
        const sgstLed = leds.find((l) => l.id === 'led-sgst-in') || leds[0];

        entries = [
          { ledgerId: purLed.id, ledgerName: purLed.name, amount: taxableAmount, type: 'DR' },
          ...(isInterstate
            ? [{ ledgerId: (leds.find((l) => l.name.includes('Input IGST')) || leds[0]).id, ledgerName: 'Input IGST', amount: igst, type: 'DR' }]
            : [
                { ledgerId: cgstLed.id, ledgerName: cgstLed.name, amount: cgst, type: 'DR' },
                { ledgerId: sgstLed.id, ledgerName: sgstLed.name, amount: sgst, type: 'DR' },
              ]),
          { ledgerId: party.id, ledgerName: party.name, amount: grandTotal, type: 'CR' },
        ];
      }

      const newVoucher: any = {
        id: `vch-smart-${Date.now()}`,
        companyId: activeCompany.id,
        voucherNumber: invoiceNumber || `VCH-${Date.now().toString().slice(-5)}`,
        voucherType: selectedVoucherType,
        date: invoiceDate,
        partyLedgerId: entries[entries.length - 1]?.ledgerId || leds[0]?.id,
        partyName: partyName || entries[entries.length - 1]?.ledgerName || 'Party',
        referenceNumber: 'SMART-AI-INWARD',
        narration: description || `Document inward: ${selectedVoucherType} entry`,
        totalTaxableAmount: taxableAmount,
        totalCgst: cgst,
        totalSgst: sgst,
        totalIgst: igst,
        grandTotal: grandTotal || taxableAmount,
        entries,
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
        details: `Smart AI Inward: Created ${selectedVoucherType} Voucher ${newVoucher.voucherNumber} of ₹${grandTotal} [Audit Hash: ${hash.slice(0, 12)}...]`,
        user: 'Administrator',
      });

      triggerRefresh();
      setSuccessMessage(`Posted ${selectedVoucherType} voucher directly to Day Book with SHA-256 audit hash!`);
      setTimeout(() => {
        setActiveTab('vouchers');
      }, 1500);
    } catch (err) {
      console.error(err);
      alert('Error creating voucher from smart entry');
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center space-x-2">
          <Brain className="w-6 h-6 text-emerald-400 shrink-0" />
          <span>Smart Document Recognition & AI Entry Assistant</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          Upload any bill, receipt, or invoice. NEWBAL recognizes the document and recommends the exact accounting entry.
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
          disabled={isProcessingOcr}
          onChange={handleFileUpload}
          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        {isProcessingOcr ? (
          <div className="space-y-4 py-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-2 max-w-sm mx-auto">
              <div className="text-sm font-semibold text-cyan-200">{ocrStatusText}</div>
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${ocrProgress}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">Real neural OCR running offline in browser (Tesseract.js)</p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-12 sm:w-14 h-12 sm:h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto group-hover:scale-110 transition">
              <Upload className="w-6 sm:w-7 h-6 sm:h-7" />
            </div>

            <div>
              <div className="text-sm sm:text-base font-bold text-slate-200">
                {uploadedFile ? `Attached: ${uploadedFile.name}` : 'Drop or select invoice, receipt, or utility bill'}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Supports Vendor Invoices, Electricity / Utility Bills, Rent Slips, Bank Receipts & Cash Memos
              </p>
            </div>

            {uploadedFile && (
              <div className="pt-2 flex items-center justify-center space-x-2">
                <span className="text-xs font-mono bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center space-x-1">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>Document Ready</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadedFile(null);
                    setRawOcrText('');
                    setRecommendation(null);
                  }}
                  className="p-1 rounded bg-slate-800 text-slate-400 hover:text-rose-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* SMART RECOMMENDATION PANEL */}
      {recommendation && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    AI Recognition Analysis
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono">
                    {recommendation.confidenceScore}% Confidence
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-100">
                  {recommendation.documentTypeName}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400">Recommended Voucher:</span>
              <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {recommendation.recommendedVoucherType} (
                {recommendation.recommendedVoucherType === 'PAYMENT'
                  ? 'F5'
                  : recommendation.recommendedVoucherType === 'RECEIPT'
                  ? 'F6'
                  : recommendation.recommendedVoucherType === 'CONTRA'
                  ? 'F4'
                  : recommendation.recommendedVoucherType === 'SALES'
                  ? 'F8'
                  : 'F9'}
                )
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
            💡 <strong>Why this entry?</strong> {recommendation.reasoning}
          </p>

          {/* Recommended Double-Entry Posting Preview */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center justify-between">
              <span>Automated Double-Entry Journal Breakdown:</span>
              <span className="text-emerald-400">Dr = Cr Balanced</span>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              {recommendation.recommendedEntries.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800/60"
                >
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        entry.type === 'DR'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {entry.type}
                    </span>
                    <span className="font-semibold text-slate-200">{entry.ledgerName}</span>
                    <span className="text-[10px] text-slate-500 hidden sm:inline">
                      ({entry.explanation})
                    </span>
                  </div>
                  <div className="font-bold text-slate-100">
                    ₹{entry.amount.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between pt-2 gap-2">
            {rawOcrText && (
              <button
                type="button"
                onClick={() => setShowRawText(!showRawText)}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showRawText ? 'Hide OCR Raw Text' : 'View OCR Raw Text'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => applyRecommendationData(recommendation)}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 border border-emerald-500/30 transition"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Apply Recommended Entry to Form</span>
            </button>
          </div>
        </div>
      )}

      {/* Raw OCR Text Viewer (Collapsible) */}
      {showRawText && rawOcrText && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Raw Extracted OCR Text from Image:</span>
            <button
              onClick={() => setShowRawText(false)}
              className="text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
          </div>
          <pre className="text-[11px] font-mono bg-slate-900 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-48 text-slate-300 border border-slate-800/80">
            {rawOcrText}
          </pre>
        </div>
      )}

      {/* Interactive Voucher Posting Form */}
      <form onSubmit={handleCreateVoucher} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-slate-100 text-sm sm:text-base">Particulars & Voucher Settings</h3>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs text-slate-400">Voucher Type:</label>
            <select
              value={selectedVoucherType}
              onChange={(e) => setSelectedVoucherType(e.target.value as VoucherType)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
            >
              <option value="PURCHASE">PURCHASE (F9)</option>
              <option value="PAYMENT">PAYMENT (F5)</option>
              <option value="RECEIPT">RECEIPT (F6)</option>
              <option value="CONTRA">CONTRA (F4)</option>
              <option value="SALES">SALES (F8)</option>
              <option value="JOURNAL">JOURNAL (F7)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Party / Vendor / Account Name *</label>
            <input
              type="text"
              required
              value={partyName}
              placeholder="e.g. Apex Hardware Supplies"
              onChange={(e) => setPartyName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Party GSTIN (if applicable)</label>
            <input
              type="text"
              placeholder="e.g. 27AABCG5555L1Z4"
              value={vendorGstin}
              onChange={(e) => setVendorGstin(e.target.value.toUpperCase())}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Bill / Invoice / Ref Number *</label>
            <input
              type="text"
              required
              placeholder="e.g. INV-1049"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Document Date *</label>
            <input
              type="date"
              required
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Base / Taxable Amount (₹) *</label>
            <input
              type="number"
              step="any"
              required
              value={taxableAmount || ''}
              placeholder="0.00"
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
              <option value={0}>0% (Exempt / Utilities / Direct Payment)</option>
              <option value={5}>5%</option>
              <option value={12}>12%</option>
              <option value={18}>18% (Standard Goods & Services)</option>
              <option value={28}>28%</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Narration / Line Description</label>
          <input
            type="text"
            value={description}
            placeholder="e.g. Inward electricity supply / office supplies"
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Tax Breakdown & Grand Total */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="space-y-1 text-slate-400">
            <div>Base: ₹{taxableAmount.toLocaleString('en-IN')}</div>
            {gstRate > 0 && (
              <div>
                GST ({gstRate}%): ₹{(cgst + sgst + igst).toLocaleString('en-IN')}{' '}
                <span className="text-[10px] text-slate-500">
                  ({isInterstate ? `IGST ₹${igst}` : `CGST ₹${cgst} + SGST ₹${sgst}`})
                </span>
              </div>
            )}
          </div>
          <div className="text-left sm:text-right">
            <div className="text-[10px] text-slate-500 font-sans">Total Transaction Amount</div>
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
            <span>Post {selectedVoucherType} Voucher</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
