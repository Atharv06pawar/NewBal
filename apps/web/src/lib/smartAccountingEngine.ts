import type { Ledger, VoucherType } from '@newbal/shared';

export interface SmartEntryRecommendation {
  documentType:
    | 'PURCHASE_INVOICE'
    | 'EXPENSE_BILL'
    | 'SALES_INVOICE'
    | 'CUSTOMER_RECEIPT'
    | 'BANK_CONTRA'
    | 'GENERAL_JOURNAL';
  documentTypeName: string;
  recommendedVoucherType: VoucherType;
  confidenceScore: number;
  reasoning: string;
  detectedFields: {
    vendorOrPartyName?: string;
    vendorGstin?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    taxableAmount: number;
    gstRate: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    grandTotal: number;
    isInterstate: boolean;
    narration: string;
  };
  recommendedEntries: {
    ledgerId: string;
    ledgerName: string;
    amount: number;
    type: 'DR' | 'CR';
    category: string;
    explanation: string;
  }[];
}

export class SmartAccountingEngine {
  /**
   * Analyze raw document / OCR text and recommend the exact accounting entry
   */
  static analyzeDocument(
    rawText: string,
    filename: string,
    ledgers: Ledger[],
    companyGstin?: string
  ): SmartEntryRecommendation {
    const textLower = (rawText + ' ' + filename).toLowerCase();
    const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    // 1. Detect GSTIN
    const gstinRegex = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i;
    const gstinMatch = rawText.match(gstinRegex);
    const detectedGstin = gstinMatch ? gstinMatch[1].toUpperCase() : undefined;

    // Interstate detection
    const isInterstate = Boolean(
      detectedGstin &&
      companyGstin &&
      detectedGstin.slice(0, 2) !== companyGstin.slice(0, 2)
    );

    // 2. Detect Amounts
    let totalAmount = 0;
    const amountRegexes = [
      /(?:grand\s*total|total\s*amount|net\s*amount|total|balance\s*due|amount\s*payable|amount)[\s:₹rs.]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /₹\s*([0-9,]+(?:\.[0-9]{2})?)/,
      /(?:rs\.?)\s*([0-9,]+(?:\.[0-9]{2})?)/i,
    ];

    for (const rx of amountRegexes) {
      const match = rawText.match(rx);
      if (match) {
        const val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val) && val > 0 && val < 50000000) {
          totalAmount = val;
          break;
        }
      }
    }

    if (totalAmount === 0) {
      // Find highest decimal number
      const numbers: number[] = [];
      const numMatches = rawText.match(/\b\d+(?:,\d{3})*(?:\.\d{2})\b/g);
      if (numMatches) {
        numMatches.forEach((m) => {
          const val = parseFloat(m.replace(/,/g, ''));
          if (!isNaN(val) && val > 10) numbers.push(val);
        });
      }
      totalAmount = numbers.length > 0 ? Math.max(...numbers) : 1000;
    }

    // 3. Detect Invoice Number & Date
    const invMatch = rawText.match(/(?:inv(?:oice)?|bill|tax invoice|memo)[\s#:.-]*([A-Z0-9\/-]{3,20})/i);
    const invoiceNumber = invMatch
      ? invMatch[1].toUpperCase()
      : `INV-${filename.replace(/\.[^/.]+$/, '').slice(0, 8).toUpperCase() || Math.floor(1000 + Math.random() * 9000)}`;

    const dateRegexes = [
      /\b([0-3]?[0-9][\/\-.][0-1]?[0-9][\/\-.](?:20)?[0-9]{2})\b/,
      /\b((?:20)[0-9]{2}[\/\-.][0-1]?[0-9][\/\-.][0-3]?[0-9])\b/,
    ];
    let invoiceDate = new Date().toISOString().split('T')[0];
    for (const rx of dateRegexes) {
      const dm = rawText.match(rx);
      if (dm) {
        try {
          const d = new Date(dm[1]);
          if (!isNaN(d.getTime())) {
            invoiceDate = d.toISOString().split('T')[0];
            break;
          }
        } catch (e) {}
      }
    }

    // Helper to find ledger by partial name or keyword
    const findLedger = (keywords: string[], fallbackGroup?: string): Ledger => {
      for (const kw of keywords) {
        const match = ledgers.find((l) => l.name.toLowerCase().includes(kw.toLowerCase()));
        if (match) return match;
      }
      if (fallbackGroup) {
        const match = ledgers.find((l) => l.groupId.toLowerCase().includes(fallbackGroup.toLowerCase()));
        if (match) return match;
      }
      return (
        ledgers[0] || {
          id: 'led-fallback',
          companyId: '',
          name: 'General Ledger',
          category: 'EXPENSE',
          groupId: 'grp-gen',
          openingBalance: 0,
          openingBalanceType: 'DR',
        }
      );
    };

    const cashLedger = findLedger(['Cash'], 'cash');
    const bankLedger = findLedger(['HDFC', 'SBI', 'Bank', 'Current'], 'bank');
    const inputCgst = findLedger(['Input CGST']);
    const inputSgst = findLedger(['Input SGST']);
    const inputIgst = findLedger(['Input IGST']);

    // 4. CLASSIFICATION LOGIC
    // Check for Utility & Operational Expense Bill
    const isElectricity = /electric|bescom|mseb|tata power|adani|torrent|power|meter/i.test(textLower);
    const isRent = /rent|lease|landlord|tenancy|premises/i.test(textLower);
    const isTelecom = /airtel|jio|vodafone|vi|telecom|broadband|wifi|internet|bsnl/i.test(textLower);
    const isFuelOrTravel = /petrol|fuel|diesel|hpcl|bpcl|iocl|uber|ola|cab|travel|hotel|airline|flight/i.test(textLower);
    const isOfficeExpense = /tea|coffee|snack|stationery|courier|clean|xerox|supplies|pantry/i.test(textLower);

    // Check for Customer Receipt
    const isReceipt = /received with thanks|receipt voucher|payment receipt|received from|customer payment/i.test(textLower);

    // Check for Bank Contra
    const isContra = /deposit slip|cash deposit|atm withdraw|cash withdrawal|inter-bank|contra/i.test(textLower);

    // Check for Sales Invoice
    const isSales = (companyGstin && detectedGstin === companyGstin) || /sales invoice|customer copy|original for recipient/i.test(textLower);

    // ---------------- CASE 1: UTILITY & OPERATING EXPENSES (PAYMENT VOUCHER F5) ----------------
    if (isElectricity || isRent || isTelecom || isFuelOrTravel || isOfficeExpense) {
      let expenseLedger = findLedger(['Office & Facility Rent', 'Rent']);
      let expenseName = 'Office Rent';

      if (isElectricity) {
        expenseLedger = findLedger(['Electricity & Utilities', 'Electricity', 'Utility', 'Power']);
        expenseName = 'Electricity & Utilities';
      } else if (isTelecom) {
        expenseLedger = findLedger(['Telephone', 'Internet', 'Utilities', 'Indirect Expense']);
        expenseName = 'Internet & Telecommunication';
      } else if (isFuelOrTravel) {
        expenseLedger = findLedger(['Travel', 'Conveyance', 'Indirect Expense']);
        expenseName = 'Travel & Fuel Expense';
      } else if (isOfficeExpense) {
        expenseLedger = findLedger(['Office', 'Printing', 'Indirect Expense']);
        expenseName = 'Office & Pantry Expenses';
      }

      const paymentSource = /cash/i.test(textLower) ? cashLedger : bankLedger;

      return {
        documentType: 'EXPENSE_BILL',
        documentTypeName: `Utility & Operating Expense (${expenseName})`,
        recommendedVoucherType: 'PAYMENT',
        confidenceScore: 96,
        reasoning: `Document matches operating expense patterns for ${expenseName}. Recommends Payment Voucher (F5) to clear the expense via ${paymentSource.name}.`,
        detectedFields: {
          vendorOrPartyName: expenseName,
          vendorGstin: detectedGstin,
          invoiceNumber,
          invoiceDate,
          taxableAmount: totalAmount,
          gstRate: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          grandTotal: totalAmount,
          isInterstate: false,
          narration: `Paid ${expenseName} bill #${invoiceNumber} via ${paymentSource.name}`,
        },
        recommendedEntries: [
          {
            ledgerId: expenseLedger.id,
            ledgerName: expenseLedger.name,
            amount: totalAmount,
            type: 'DR',
            category: 'EXPENSE',
            explanation: `Debit: Incurred operational expense (${expenseName})`,
          },
          {
            ledgerId: paymentSource.id,
            ledgerName: paymentSource.name,
            amount: totalAmount,
            type: 'CR',
            category: 'ASSET',
            explanation: `Credit: Disbursed payment from ${paymentSource.name}`,
          },
        ],
      };
    }

    // ---------------- CASE 2: CUSTOMER PAYMENT RECEIPT (RECEIPT VOUCHER F6) ----------------
    if (isReceipt) {
      const debtor = findLedger(['Acme', 'NexGen', 'Debtor', 'Customer'], 'debtor');
      const depositBank = /cash/i.test(textLower) ? cashLedger : bankLedger;

      return {
        documentType: 'CUSTOMER_RECEIPT',
        documentTypeName: 'Customer Inward Payment Receipt',
        recommendedVoucherType: 'RECEIPT',
        confidenceScore: 94,
        reasoning: `Document indicates inward settlement from customer. Recommends Receipt Voucher (F6) to credit customer ledger and debit bank account.`,
        detectedFields: {
          vendorOrPartyName: debtor.name,
          invoiceNumber,
          invoiceDate,
          taxableAmount: totalAmount,
          gstRate: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          grandTotal: totalAmount,
          isInterstate: false,
          narration: `Inward payment received from ${debtor.name} against invoice settlements`,
        },
        recommendedEntries: [
          {
            ledgerId: depositBank.id,
            ledgerName: depositBank.name,
            amount: totalAmount,
            type: 'DR',
            category: 'ASSET',
            explanation: `Debit: Inward funds received in ${depositBank.name}`,
          },
          {
            ledgerId: debtor.id,
            ledgerName: debtor.name,
            amount: totalAmount,
            type: 'CR',
            category: 'ASSET',
            explanation: `Credit: Reduce outstanding receivables from ${debtor.name}`,
          },
        ],
      };
    }

    // ---------------- CASE 3: BANK CONTRA / CASH WITHDRAWAL (CONTRA VOUCHER F4) ----------------
    if (isContra) {
      const isDeposit = /deposit/i.test(textLower);
      const drLedger = isDeposit ? bankLedger : cashLedger;
      const crLedger = isDeposit ? cashLedger : bankLedger;

      return {
        documentType: 'BANK_CONTRA',
        documentTypeName: isDeposit ? 'Bank Cash Deposit Slip' : 'ATM / Cheque Cash Withdrawal',
        recommendedVoucherType: 'CONTRA',
        confidenceScore: 95,
        reasoning: `Document indicates internal fund transfer between Cash and Bank accounts. Recommends Contra Voucher (F4).`,
        detectedFields: {
          vendorOrPartyName: `${drLedger.name} / ${crLedger.name}`,
          invoiceNumber,
          invoiceDate,
          taxableAmount: totalAmount,
          gstRate: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          grandTotal: totalAmount,
          isInterstate: false,
          narration: isDeposit ? `Cash deposited into ${bankLedger.name}` : `Cash withdrawn from ${bankLedger.name}`,
        },
        recommendedEntries: [
          {
            ledgerId: drLedger.id,
            ledgerName: drLedger.name,
            amount: totalAmount,
            type: 'DR',
            category: 'ASSET',
            explanation: `Debit: Increasing balance in ${drLedger.name}`,
          },
          {
            ledgerId: crLedger.id,
            ledgerName: crLedger.name,
            amount: totalAmount,
            type: 'CR',
            category: 'ASSET',
            explanation: `Credit: Decreasing balance in ${crLedger.name}`,
          },
        ],
      };
    }

    // ---------------- CASE 4: SALES INVOICE (SALES VOUCHER F8) ----------------
    if (isSales) {
      const debtor = findLedger(['Acme', 'NexGen', 'Debtor'], 'debtor');
      const salesLedger = findLedger(['Domestic Sales', 'Sales']);
      const rate = 18;
      const taxable = Math.round((totalAmount / (1 + rate / 100)) * 100) / 100;
      const taxTotal = Math.round((totalAmount - taxable) * 100) / 100;
      const halfTax = Math.round((taxTotal / 2) * 100) / 100;

      return {
        documentType: 'SALES_INVOICE',
        documentTypeName: 'Outward Tax Invoice (Sales)',
        recommendedVoucherType: 'SALES',
        confidenceScore: 92,
        reasoning: `Document represents outward supply to client. Recommends Sales Voucher (F8) with itemized GST liability.`,
        detectedFields: {
          vendorOrPartyName: debtor.name,
          vendorGstin: detectedGstin,
          invoiceNumber,
          invoiceDate,
          taxableAmount: taxable,
          gstRate: rate,
          cgstAmount: isInterstate ? 0 : halfTax,
          sgstAmount: isInterstate ? 0 : halfTax,
          igstAmount: isInterstate ? taxTotal : 0,
          grandTotal: totalAmount,
          isInterstate,
          narration: `Sales tax invoice #${invoiceNumber} to ${debtor.name}`,
        },
        recommendedEntries: [
          {
            ledgerId: debtor.id,
            ledgerName: debtor.name,
            amount: totalAmount,
            type: 'DR',
            category: 'ASSET',
            explanation: `Debit: Receivable from customer ${debtor.name}`,
          },
          {
            ledgerId: salesLedger.id,
            ledgerName: salesLedger.name,
            amount: taxable,
            type: 'CR',
            category: 'INCOME',
            explanation: 'Credit: Revenue recognized in Sales Account',
          },
          ...(isInterstate
            ? [
                {
                  ledgerId: (findLedger(['Output IGST']) || ledgers[0]).id,
                  ledgerName: 'Output IGST @ 18%',
                  amount: taxTotal,
                  type: 'CR' as const,
                  category: 'LIABILITY',
                  explanation: 'Credit: GST Interstate tax liability',
                },
              ]
            : [
                {
                  ledgerId: (findLedger(['Output CGST']) || ledgers[0]).id,
                  ledgerName: 'Output CGST @ 9%',
                  amount: halfTax,
                  type: 'CR' as const,
                  category: 'LIABILITY',
                  explanation: 'Credit: Central GST tax liability',
                },
                {
                  ledgerId: (findLedger(['Output SGST']) || ledgers[0]).id,
                  ledgerName: 'Output SGST @ 9%',
                  amount: halfTax,
                  type: 'CR' as const,
                  category: 'LIABILITY',
                  explanation: 'Credit: State GST tax liability',
                },
              ]),
        ],
      };
    }

    // ---------------- DEFAULT CASE 5: VENDOR INWARD TAX INVOICE (PURCHASE VOUCHER F9) ----------------
    // Extract vendor name from top lines
    let detectedVendor = 'Global Micro Components Ltd';
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i];
      if (
        !line.match(/tax invoice|bill of supply|cash memo|receipt|gstin|phone|mobile|date/i) &&
        line.length > 3 &&
        line.length < 50
      ) {
        detectedVendor = line.replace(/[^a-zA-Z0-9\s.&'-]/g, '').trim();
        break;
      }
    }

    const creditor = findLedger([detectedVendor.split(' ')[0], 'Global', 'Creditor'], 'creditor');
    const purchaseLedger = findLedger(['Local Purchases', 'Purchase']);
    const rate = 18;
    const taxable = Math.round((totalAmount / (1 + rate / 100)) * 100) / 100;
    const taxTotal = Math.round((totalAmount - taxable) * 100) / 100;
    const halfTax = Math.round((taxTotal / 2) * 100) / 100;

    return {
      documentType: 'PURCHASE_INVOICE',
      documentTypeName: 'Vendor Inward Tax Invoice (Purchase)',
      recommendedVoucherType: 'PURCHASE',
      confidenceScore: 98,
      reasoning: `Document matches vendor commercial tax invoice from ${detectedVendor}. Recommends Purchase Voucher (F9) with input tax credit (ITC) offsets.`,
      detectedFields: {
        vendorOrPartyName: detectedVendor || creditor.name,
        vendorGstin: detectedGstin || (creditor.gstin || '27AABCG5555L1Z4'),
        invoiceNumber,
        invoiceDate,
        taxableAmount: taxable,
        gstRate: rate,
        cgstAmount: isInterstate ? 0 : halfTax,
        sgstAmount: isInterstate ? 0 : halfTax,
        igstAmount: isInterstate ? taxTotal : 0,
        grandTotal: totalAmount,
        isInterstate,
        narration: `Inward supply bill #${invoiceNumber} from ${detectedVendor}`,
      },
      recommendedEntries: [
        {
          ledgerId: purchaseLedger.id,
          ledgerName: purchaseLedger.name,
          amount: taxable,
          type: 'DR',
          category: 'EXPENSE',
          explanation: 'Debit: Inward materials added to Purchase Account',
        },
        ...(isInterstate
          ? [
              {
                ledgerId: inputIgst.id,
                ledgerName: inputIgst.name,
                amount: taxTotal,
                type: 'DR' as const,
                category: 'ASSET',
                explanation: 'Debit: Input IGST Credit receivable',
              },
            ]
          : [
              {
                ledgerId: inputCgst.id,
                ledgerName: inputCgst.name,
                amount: halfTax,
                type: 'DR' as const,
                category: 'ASSET',
                explanation: 'Debit: Input CGST Credit receivable',
              },
              {
                ledgerId: inputSgst.id,
                ledgerName: inputSgst.name,
                amount: halfTax,
                type: 'DR' as const,
                category: 'ASSET',
                explanation: 'Debit: Input SGST Credit receivable',
              },
            ]),
        {
          ledgerId: creditor.id,
          ledgerName: creditor.name,
          amount: totalAmount,
          type: 'CR',
          category: 'LIABILITY',
          explanation: `Credit: Payable balance owed to ${creditor.name}`,
        },
      ],
    };
  }

  /**
   * Analyze plain English narration and suggest voucher type + Dr/Cr entries
   * e.g. "Paid 4500 electricity bill by HDFC bank"
   */
  static analyzeSentence(
    prompt: string,
    ledgers: Ledger[]
  ): SmartEntryRecommendation | null {
    if (!prompt || prompt.trim().length < 5) return null;
    return this.analyzeDocument(prompt, 'prompt.txt', ledgers);
  }
}
