import React, { useState, useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import { db } from '../../lib/db';
import type { VoucherType, Voucher, Ledger, StockItem, Godown } from '@newbal/shared';
import { X, Plus, Trash2, Printer, Check, AlertCircle, Paperclip, ShieldCheck, Sparkles, Zap, Brain } from 'lucide-react';
import { ExportEngine } from '../../lib/exportEngine';
import { AuditSecurityEngine } from '../../lib/auditSecurity';
import { SmartAccountingEngine, type SmartEntryRecommendation } from '../../lib/smartAccountingEngine';

export const NewVoucherModal: React.FC = () => {
  const { isNewVoucherOpen, closeNewVoucher, newVoucherType, activeCompany, triggerRefresh } = useApp();

  const [vchType, setVchType] = useState<VoucherType>(newVoucherType);
  const [voucherNumber, setVoucherNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [partyLedgerId, setPartyLedgerId] = useState('');
  const [narration, setNarration] = useState('');
  const [isInterstate, setIsInterstate] = useState(false);
  const [autoPrintPDF, setAutoPrintPDF] = useState(true);
  const [attachedFile, setAttachedFile] = useState<{ name: string; type: string; base64: string } | null>(null);

  // Smart Assistant state
  const [smartPrompt, setSmartPrompt] = useState('');
  const [smartRec, setSmartRec] = useState<SmartEntryRecommendation | null>(null);

  const handleSmartPromptChange = (val: string) => {
    setSmartPrompt(val);
    if (val.trim().length > 3) {
      const rec = SmartAccountingEngine.analyzeSentence(val, allLedgers);
      setSmartRec(rec);
    } else {
      setSmartRec(null);
    }
  };

  const applySmartAssistant = (rec: SmartEntryRecommendation) => {
    setVchType(rec.recommendedVoucherType);
    setNarration(rec.detectedFields.narration);
    if (rec.detectedFields.invoiceNumber) setReferenceNumber(rec.detectedFields.invoiceNumber);

    if (rec.recommendedVoucherType === 'SALES' || rec.recommendedVoucherType === 'PURCHASE') {
      const party = allLedgers.find((l) =>
        l.name.toLowerCase().includes((rec.detectedFields.vendorOrPartyName || '').toLowerCase().split(' ')[0])
      ) || allLedgers[0];
      if (party) setPartyLedgerId(party.id);
    } else {
      setLedgerEntries(
        rec.recommendedEntries.map((e) => ({
          ledgerId: e.ledgerId,
          ledgerName: e.ledgerName,
          amount: e.amount,
          type: e.type,
        }))
      );
    }
    setSmartPrompt('');
    setSmartRec(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFile({
        name: file.name,
        type: file.type,
        base64: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  // Lists from DB
  const [allLedgers, setAllLedgers] = useState<Ledger[]>([]);
  const [allStockItems, setAllStockItems] = useState<StockItem[]>([]);
  const [allGodowns, setAllGodowns] = useState<Godown[]>([]);

  // Item rows for Sales / Purchase
  const [itemRows, setItemRows] = useState<
    {
      stockItemId: string;
      itemName: string;
      hsnCode: string;
      godownId: string;
      quantity: number;
      unit: string;
      rate: number;
      taxableAmount: number;
      gstRate: number;
      cgstAmount: number;
      sgstAmount: number;
      igstAmount: number;
      totalAmount: number;
    }[]
  >([]);

  // Direct Ledger entries for Payment, Receipt, Contra, Journal
  const [ledgerEntries, setLedgerEntries] = useState<
    { ledgerId: string; ledgerName: string; amount: number; type: 'DR' | 'CR' }[]
  >([]);

  useEffect(() => {
    setVchType(newVoucherType);
  }, [newVoucherType]);

  // Load Ledgers, Stock Items, Godowns and auto-generate voucher number
  useEffect(() => {
    if (!activeCompany || !isNewVoucherOpen) return;

    async function loadData() {
      const leds = await db.ledgers.where('companyId').equals(activeCompany!.id).toArray();
      const items = await db.stockItems.where('companyId').equals(activeCompany!.id).toArray();
      const gdns = await db.godowns.where('companyId').equals(activeCompany!.id).toArray();

      setAllLedgers(leds);
      setAllStockItems(items);
      setAllGodowns(gdns);

      // Auto voucher number
      const existing = await db.vouchers
        .where('companyId')
        .equals(activeCompany!.id)
        .filter((v) => v.voucherType === vchType)
        .count();

      const prefix =
        vchType === 'SALES'
          ? 'INV'
          : vchType === 'PURCHASE'
          ? 'PUR'
          : vchType === 'PAYMENT'
          ? 'PMT'
          : vchType === 'RECEIPT'
          ? 'RCT'
          : vchType === 'CONTRA'
          ? 'CTR'
          : 'JRN';

      setVoucherNumber(`${prefix}/24-25/${String(existing + 1).padStart(3, '0')}`);

      // Initialize default rows
      if (vchType === 'SALES' || vchType === 'PURCHASE') {
        if (items.length > 0) {
          const first = items[0];
          const rate = vchType === 'SALES' ? first.standardSalesRate : first.standardPurchaseRate;
          const taxable = rate * 1;
          const gst = first.gstRate || 18;
          const halfGst = (taxable * (gst / 2)) / 100;
          setItemRows([
            {
              stockItemId: first.id,
              itemName: first.name,
              hsnCode: first.hsnCode || '',
              godownId: gdns[0]?.id || '',
              quantity: 1,
              unit: first.unit,
              rate,
              taxableAmount: taxable,
              gstRate: gst,
              cgstAmount: halfGst,
              sgstAmount: halfGst,
              igstAmount: 0,
              totalAmount: taxable + halfGst * 2,
            },
          ]);
        }
      } else {
        // Cash / Bank default for payment/receipt
        const cashBank = leds.find((l) => l.isBankOrCash);
        const otherLedger = leds.find((l) => !l.isBankOrCash);
        if (cashBank && otherLedger) {
          if (vchType === 'PAYMENT') {
            setLedgerEntries([
              { ledgerId: otherLedger.id, ledgerName: otherLedger.name, amount: 1000, type: 'DR' },
              { ledgerId: cashBank.id, ledgerName: cashBank.name, amount: 1000, type: 'CR' },
            ]);
          } else if (vchType === 'RECEIPT') {
            setLedgerEntries([
              { ledgerId: cashBank.id, ledgerName: cashBank.name, amount: 1000, type: 'DR' },
              { ledgerId: otherLedger.id, ledgerName: otherLedger.name, amount: 1000, type: 'CR' },
            ]);
          } else {
            setLedgerEntries([
              { ledgerId: leds[0]?.id || '', ledgerName: leds[0]?.name || '', amount: 1000, type: 'DR' },
              { ledgerId: leds[1]?.id || '', ledgerName: leds[1]?.name || '', amount: 1000, type: 'CR' },
            ]);
          }
        }
      }
    }

    loadData();
  }, [activeCompany, isNewVoucherOpen, vchType]);

  if (!isNewVoucherOpen || !activeCompany) return null;

  // Handle Item Row change
  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...itemRows];
    const row = { ...updated[index], [field]: value };

    if (field === 'stockItemId') {
      const selectedItem = allStockItems.find((i) => i.id === value);
      if (selectedItem) {
        row.itemName = selectedItem.name;
        row.hsnCode = selectedItem.hsnCode || '';
        row.unit = selectedItem.unit;
        row.rate = vchType === 'SALES' ? selectedItem.standardSalesRate : selectedItem.standardPurchaseRate;
        row.gstRate = selectedItem.gstRate || 18;
      }
    }

    // Recompute taxable and GST
    row.taxableAmount = Number(row.quantity) * Number(row.rate);
    const gstPct = Number(row.gstRate);

    if (isInterstate) {
      row.igstAmount = (row.taxableAmount * gstPct) / 100;
      row.cgstAmount = 0;
      row.sgstAmount = 0;
      row.totalAmount = row.taxableAmount + row.igstAmount;
    } else {
      row.cgstAmount = (row.taxableAmount * (gstPct / 2)) / 100;
      row.sgstAmount = (row.taxableAmount * (gstPct / 2)) / 100;
      row.igstAmount = 0;
      row.totalAmount = row.taxableAmount + row.cgstAmount + row.sgstAmount;
    }

    updated[index] = row;
    setItemRows(updated);
  };

  const addItemRow = () => {
    if (allStockItems.length === 0) return;
    const first = allStockItems[0];
    const rate = vchType === 'SALES' ? first.standardSalesRate : first.standardPurchaseRate;
    const taxable = rate * 1;
    const halfGst = (taxable * ((first.gstRate || 18) / 2)) / 100;

    setItemRows([
      ...itemRows,
      {
        stockItemId: first.id,
        itemName: first.name,
        hsnCode: first.hsnCode || '',
        godownId: allGodowns[0]?.id || '',
        quantity: 1,
        unit: first.unit,
        rate,
        taxableAmount: taxable,
        gstRate: first.gstRate || 18,
        cgstAmount: halfGst,
        sgstAmount: halfGst,
        igstAmount: 0,
        totalAmount: taxable + halfGst * 2,
      },
    ]);
  };

  const removeItemRow = (idx: number) => {
    setItemRows(itemRows.filter((_, i) => i !== idx));
  };

  // Totals for Item Vouchers
  const totalTaxable = itemRows.reduce((s, r) => s + r.taxableAmount, 0);
  const totalCgst = itemRows.reduce((s, r) => s + r.cgstAmount, 0);
  const totalSgst = itemRows.reduce((s, r) => s + r.sgstAmount, 0);
  const totalIgst = itemRows.reduce((s, r) => s + r.igstAmount, 0);
  const grandTotalItems = totalTaxable + totalCgst + totalSgst + totalIgst;

  // Totals for Direct Ledger Vouchers
  const totalDr = ledgerEntries.filter((e) => e.type === 'DR').reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalCr = ledgerEntries.filter((e) => e.type === 'CR').reduce((s, e) => s + Number(e.amount || 0), 0);
  const isDirectBalanced = Math.abs(totalDr - totalCr) < 0.01;

  // Save Voucher Handler
  const handleSaveVoucher = async () => {
    try {
      const party = allLedgers.find((l) => l.id === partyLedgerId);
      const isInventoryVoucher = vchType === 'SALES' || vchType === 'PURCHASE';

      let finalEntries: any[] = [];
      let finalGrandTotal = 0;

      if (isInventoryVoucher) {
        if (!partyLedgerId) {
          alert('Please select a Party / Customer Ledger');
          return;
        }

        finalGrandTotal = grandTotalItems;

        if (vchType === 'SALES') {
          // Debit Party, Credit Sales, Credit Output GST
          finalEntries.push({
            ledgerId: party!.id,
            ledgerName: party!.name,
            amount: grandTotalItems,
            type: 'DR',
          });
          const salesLedger =
            allLedgers.find((l) => l.id === 'led-sales-dom') ||
            allLedgers.find((l) => l.name.toLowerCase().includes('sales')) ||
            allLedgers[0];
          finalEntries.push({
            ledgerId: salesLedger.id,
            ledgerName: salesLedger.name,
            amount: totalTaxable,
            type: 'CR',
          });

          if (isInterstate && totalIgst > 0) {
            const igstLed = allLedgers.find((l) => l.id === 'led-igst-out') || allLedgers[0];
            finalEntries.push({ ledgerId: igstLed.id, ledgerName: igstLed.name, amount: totalIgst, type: 'CR' });
          } else {
            if (totalCgst > 0) {
              const cgstLed = allLedgers.find((l) => l.id === 'led-cgst-out') || allLedgers[0];
              finalEntries.push({ ledgerId: cgstLed.id, ledgerName: cgstLed.name, amount: totalCgst, type: 'CR' });
            }
            if (totalSgst > 0) {
              const sgstLed = allLedgers.find((l) => l.id === 'led-sgst-out') || allLedgers[0];
              finalEntries.push({ ledgerId: sgstLed.id, ledgerName: sgstLed.name, amount: totalSgst, type: 'CR' });
            }
          }
        } else {
          // Purchase: Debit Purchase, Debit Input GST, Credit Vendor
          const purLedger =
            allLedgers.find((l) => l.id === 'led-purchase-dom') ||
            allLedgers.find((l) => l.name.toLowerCase().includes('purchase')) ||
            allLedgers[0];
          finalEntries.push({
            ledgerId: purLedger.id,
            ledgerName: purLedger.name,
            amount: totalTaxable,
            type: 'DR',
          });

          if (isInterstate && totalIgst > 0) {
            const igstLed = allLedgers.find((l) => l.name.includes('Input IGST')) || allLedgers[0];
            finalEntries.push({ ledgerId: igstLed.id, ledgerName: igstLed.name, amount: totalIgst, type: 'DR' });
          } else {
            if (totalCgst > 0) {
              const cgstLed = allLedgers.find((l) => l.id === 'led-cgst-in') || allLedgers[0];
              finalEntries.push({ ledgerId: cgstLed.id, ledgerName: cgstLed.name, amount: totalCgst, type: 'DR' });
            }
            if (totalSgst > 0) {
              const sgstLed = allLedgers.find((l) => l.id === 'led-sgst-in') || allLedgers[0];
              finalEntries.push({ ledgerId: sgstLed.id, ledgerName: sgstLed.name, amount: totalSgst, type: 'DR' });
            }
          }

          finalEntries.push({
            ledgerId: party!.id,
            ledgerName: party!.name,
            amount: grandTotalItems,
            type: 'CR',
          });
        }
      } else {
        // Direct Ledgers
        if (!isDirectBalanced) {
          alert('Total Debit must equal Total Credit!');
          return;
        }
        finalEntries = ledgerEntries;
        finalGrandTotal = totalDr;
      }

      const newVoucher: Voucher = {
        id: `vch-${Date.now()}`,
        companyId: activeCompany.id,
        voucherNumber,
        voucherType: vchType,
        date,
        referenceNumber,
        narration: narration || `Being ${vchType.toLowerCase()} transaction recorded`,
        partyLedgerId: partyLedgerId || undefined,
        partyName: party?.name,
        isInterstate,
        totalTaxableAmount: isInventoryVoucher ? totalTaxable : undefined,
        totalCgst: isInventoryVoucher ? totalCgst : undefined,
        totalSgst: isInventoryVoucher ? totalSgst : undefined,
        totalIgst: isInventoryVoucher ? totalIgst : undefined,
        grandTotal: finalGrandTotal,
        entries: finalEntries,
        inventoryItems: isInventoryVoucher ? itemRows : undefined,
        attachedDocument: attachedFile || undefined,
        status: 'POSTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Cryptographic MCA Audit Trail Hash
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
        details: `Created ${vchType} Voucher ${voucherNumber} of ₹${finalGrandTotal} [Hash: ${hash.slice(0, 12)}...]`,
        user: 'Administrator',
      });

      triggerRefresh();

      if (autoPrintPDF && vchType === 'SALES') {
        ExportEngine.generateInvoicePDF(activeCompany, newVoucher, party);
      }

      closeNewVoucher();
    } catch (err) {
      console.error('Save voucher error', err);
      alert('Error saving voucher');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[96vh] sm:max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-900/90">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:space-x-3">
            <span className="font-bold text-slate-100 text-sm sm:text-base">Accounting Voucher Entry</span>
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto max-w-full">
              {(['SALES', 'PURCHASE', 'PAYMENT', 'RECEIPT', 'CONTRA', 'JOURNAL'] as VoucherType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setVchType(t)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition whitespace-nowrap ${
                    vchType === t
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={closeNewVoucher}
            className="self-end sm:self-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 text-xs sm:text-sm">
          {/* Smart AI Entry Assistant */}
          <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Smart Entry Assistant</span>
                <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">
                  — Type naturally to auto-fill voucher type, ledgers & amounts
                </span>
              </div>
              <div className="flex items-center space-x-1.5 overflow-x-auto text-[10px]">
                <span className="text-slate-500">Try:</span>
                <button
                  type="button"
                  onClick={() => handleSmartPromptChange('Paid 4500 electricity bill by HDFC bank')}
                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-300 transition whitespace-nowrap"
                >
                  ⚡ Paid 4500 Electricity (HDFC)
                </button>
                <button
                  type="button"
                  onClick={() => handleSmartPromptChange('Paid 35000 office rent by SBI')}
                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-300 transition whitespace-nowrap"
                >
                  🏢 Rent 35000 (SBI)
                </button>
                <button
                  type="button"
                  onClick={() => handleSmartPromptChange('Received 50000 from Acme Systems into SBI')}
                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-300 transition whitespace-nowrap"
                >
                  💰 Received 50k from Acme
                </button>
                <button
                  type="button"
                  onClick={() => handleSmartPromptChange('Withdrew 10000 cash from HDFC')}
                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-300 transition whitespace-nowrap"
                >
                  🏦 Cash 10k from HDFC
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                value={smartPrompt}
                onChange={(e) => handleSmartPromptChange(e.target.value)}
                placeholder="Describe your transaction in plain English (e.g. 'Paid 4500 electricity bill by HDFC' or 'Received 50000 from Acme')..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 pr-24"
              />
              {smartRec && (
                <button
                  type="button"
                  onClick={() => applySmartAssistant(smartRec)}
                  className="absolute right-1 top-1 bottom-1 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium flex items-center space-x-1 transition shadow"
                >
                  <Zap className="w-3 h-3" />
                  <span>Apply</span>
                </button>
              )}
            </div>

            {smartRec && (
              <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-emerald-400">
                      Recommendation: {smartRec.recommendedVoucherType} ({smartRec.recommendedVoucherType === 'PAYMENT' ? 'F5' : smartRec.recommendedVoucherType === 'RECEIPT' ? 'F6' : smartRec.recommendedVoucherType === 'CONTRA' ? 'F4' : smartRec.recommendedVoucherType === 'SALES' ? 'F8' : 'F9'})
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {smartRec.confidenceScore}% match
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    {smartRec.reasoning}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => applySmartAssistant(smartRec)}
                  className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded text-xs font-semibold border border-emerald-500/30 whitespace-nowrap transition"
                >
                  Apply Entry
                </button>
              </div>
            )}
          </div>

          {/* Metadata Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Voucher Number</label>
              <input
                type="text"
                value={voucherNumber}
                onChange={(e) => setVoucherNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Voucher Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Ref / Order No</label>
              <input
                type="text"
                placeholder="PO / Chq / Ref #"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isInterstate}
                  onChange={(e) => {
                    setIsInterstate(e.target.checked);
                    // Trigger recalculation of items
                    setTimeout(() => {
                      if (itemRows.length > 0) handleItemChange(0, 'quantity', itemRows[0].quantity);
                    }, 50);
                  }}
                  className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-xs text-slate-300 font-medium">Interstate Supply (IGST)</span>
              </label>
            </div>
          </div>

          {/* Party Selector for Sales & Purchase */}
          {(vchType === 'SALES' || vchType === 'PURCHASE') && (
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  {vchType === 'SALES' ? 'Party / Customer A/c (Debtor)' : 'Vendor / Supplier A/c (Creditor)'}
                </label>
                {partyLedgerId && (
                  <span className="text-xs font-mono text-emerald-400">
                    GSTIN: {allLedgers.find((l) => l.id === partyLedgerId)?.gstin || 'Unregistered'}
                  </span>
                )}
              </div>
              <select
                value={partyLedgerId}
                onChange={(e) => setPartyLedgerId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Select Party Ledger --</option>
                {allLedgers
                  .filter((l) =>
                    vchType === 'SALES'
                      ? l.category === 'ASSET' || l.groupId.includes('debtor')
                      : l.category === 'LIABILITY' || l.groupId.includes('creditor')
                  )
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.state ? `(${l.state})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Line Items Table for Sales & Purchase */}
          {vchType === 'SALES' || vchType === 'PURCHASE' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 text-sm">Itemized Stock Details</span>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 px-3 py-1 rounded-lg border border-slate-700 flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400">
                    <tr>
                      <th className="p-3 font-medium">Stock Item</th>
                      <th className="p-3 font-medium w-24">Godown</th>
                      <th className="p-3 font-medium w-20">Qty</th>
                      <th className="p-3 font-medium w-24">Rate (₹)</th>
                      <th className="p-3 font-medium w-28 text-right">Taxable</th>
                      <th className="p-3 font-medium w-20 text-center">GST %</th>
                      <th className="p-3 font-medium w-28 text-right">Total (₹)</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {itemRows.map((row, index) => (
                      <tr key={index} className="bg-slate-900/60">
                        <td className="p-2">
                          <select
                            value={row.stockItemId}
                            onChange={(e) => handleItemChange(index, 'stockItemId', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                          >
                            {allStockItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.unit})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            value={row.godownId}
                            onChange={(e) => handleItemChange(index, 'godownId', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                          >
                            {allGodowns.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono text-center"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={row.rate}
                            onChange={(e) => handleItemChange(index, 'rate', Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono text-right"
                          />
                        </td>
                        <td className="p-2 text-right font-mono text-slate-300">
                          ₹{row.taxableAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-2 text-center font-mono text-slate-400">{row.gstRate}%</td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-400">
                          ₹{row.totalAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-2 text-center">
                          {itemRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItemRow(index)}
                              className="text-slate-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* GST & Grand Total Summary Box */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-end space-y-1.5 text-xs font-mono">
                <div className="flex justify-between w-64 text-slate-400">
                  <span>Taxable Amount:</span>
                  <span>₹{totalTaxable.toLocaleString('en-IN')}</span>
                </div>
                {isInterstate ? (
                  <div className="flex justify-between w-64 text-slate-400">
                    <span>IGST Output:</span>
                    <span>₹{totalIgst.toLocaleString('en-IN')}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between w-64 text-slate-400">
                      <span>CGST (Central Tax):</span>
                      <span>₹{totalCgst.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between w-64 text-slate-400">
                      <span>SGST (State Tax):</span>
                      <span>₹{totalSgst.toLocaleString('en-IN')}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between w-64 text-base font-bold text-emerald-400 pt-2 border-t border-slate-800">
                  <span>Grand Total:</span>
                  <span>₹{grandTotalItems.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Direct Ledgers Table for Payment, Receipt, Contra, Journal */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 text-sm">Double Entry Ledgers</span>
                <button
                  type="button"
                  onClick={() =>
                    setLedgerEntries([
                      ...ledgerEntries,
                      {
                        ledgerId: allLedgers[0]?.id || '',
                        ledgerName: allLedgers[0]?.name || '',
                        amount: 0,
                        type: 'CR',
                      },
                    ])
                  }
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 px-3 py-1 rounded-lg border border-slate-700 flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line</span>
                </button>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400">
                    <tr>
                      <th className="p-3 font-medium w-24">By/To (Dr/Cr)</th>
                      <th className="p-3 font-medium">Ledger Name</th>
                      <th className="p-3 font-medium w-36 text-right">Debit (₹)</th>
                      <th className="p-3 font-medium w-36 text-right">Credit (₹)</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {ledgerEntries.map((entry, index) => (
                      <tr key={index} className="bg-slate-900/60">
                        <td className="p-2">
                          <select
                            value={entry.type}
                            onChange={(e) => {
                              const updated = [...ledgerEntries];
                              updated[index].type = e.target.value as 'DR' | 'CR';
                              setLedgerEntries(updated);
                            }}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono font-bold"
                          >
                            <option value="DR">Dr</option>
                            <option value="CR">Cr</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            value={entry.ledgerId}
                            onChange={(e) => {
                              const updated = [...ledgerEntries];
                              const found = allLedgers.find((l) => l.id === e.target.value);
                              if (found) {
                                updated[index].ledgerId = found.id;
                                updated[index].ledgerName = found.name;
                                setLedgerEntries(updated);
                              }
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                          >
                            {allLedgers.map((led) => (
                              <option key={led.id} value={led.id}>
                                {led.name} ({led.category})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 text-right">
                          {entry.type === 'DR' ? (
                            <input
                              type="number"
                              value={entry.amount}
                              onChange={(e) => {
                                const updated = [...ledgerEntries];
                                updated[index].amount = Number(e.target.value);
                                setLedgerEntries(updated);
                              }}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono text-right"
                            />
                          ) : (
                            <span className="text-slate-600 font-mono">-</span>
                          )}
                        </td>
                        <td className="p-2 text-right">
                          {entry.type === 'CR' ? (
                            <input
                              type="number"
                              value={entry.amount}
                              onChange={(e) => {
                                const updated = [...ledgerEntries];
                                updated[index].amount = Number(e.target.value);
                                setLedgerEntries(updated);
                              }}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-100 font-mono text-right"
                            />
                          ) : (
                            <span className="text-slate-600 font-mono">-</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {ledgerEntries.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setLedgerEntries(ledgerEntries.filter((_, i) => i !== index))}
                              className="text-slate-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Direct Balance Check */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center space-x-2">
                  {isDirectBalanced ? (
                    <span className="text-emerald-400 flex items-center space-x-1">
                      <Check className="w-4 h-4" />
                      <span>Books Balanced (Total Dr = Total Cr)</span>
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center space-x-1">
                      <AlertCircle className="w-4 h-4" />
                      <span>Unbalanced! Diff: ₹{Math.abs(totalDr - totalCr).toFixed(2)}</span>
                    </span>
                  )}
                </div>
                <div className="space-x-4">
                  <span>Total Dr: ₹{totalDr.toLocaleString('en-IN')}</span>
                  <span>Total Cr: ₹{totalCr.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Real Document / Bill Attachment */}
          <div className="bg-slate-950/60 p-3 sm:p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                <span>Original Bill / Document Attachment</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Attach scanned vendor bill or invoice (PNG, JPG, PDF) to preserve audit trail
              </p>
            </div>
            <div>
              {attachedFile ? (
                <div className="flex items-center space-x-2 text-xs font-mono bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
                  <span className="text-emerald-400 truncate max-w-[150px]">{attachedFile.name}</span>
                  <button type="button" onClick={() => setAttachedFile(null)} className="text-slate-400 hover:text-rose-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition">
                  <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Attach Document</span>
                  <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Narration */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Narration</label>
            <textarea
              rows={2}
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="Being payment made / invoice generated against..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          {vchType === 'SALES' && (
            <div className="flex items-center space-x-2 pt-1">
              <label className="flex items-center space-x-2 cursor-pointer select-none text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={autoPrintPDF}
                  onChange={(e) => setAutoPrintPDF(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                />
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Automatically download Tax Invoice PDF upon save</span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between">
          <button
            onClick={closeNewVoucher}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition"
          >
            Cancel [Esc]
          </button>
          <button
            onClick={handleSaveVoucher}
            className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition shadow-md shadow-emerald-950/40 flex items-center space-x-2"
          >
            <Check className="w-4 h-4" />
            <span>Accept & Post Voucher [Enter]</span>
          </button>
        </div>
      </div>
    </div>
  );
};
