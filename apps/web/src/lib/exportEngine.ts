import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { db } from './db';
import type { Company, Voucher, Ledger } from '@newbal/shared';

export class ExportEngine {
  /**
   * Generate Tax Invoice PDF
   */
  static generateInvoicePDF(company: Company, voucher: Voucher, party?: Ledger) {
    const doc = new jsPDF();

    // Header & Company Info
    doc.setFontSize(18);
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text(company.name, 14, 20);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(company.address, 14, 26);
    doc.text(`GSTIN: ${company.gstin || 'N/A'} | State: ${company.state} (${company.stateCode})`, 14, 31);
    doc.text(`Email: ${company.email} | Phone: ${company.phone}`, 14, 36);

    // Title & Invoice Meta Box
    doc.setDrawColor(200);
    doc.line(14, 40, 196, 40);

    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text('TAX INVOICE', 150, 20);

    doc.setFontSize(9);
    doc.text(`Invoice No: ${voucher.voucherNumber}`, 140, 26);
    doc.text(`Date: ${voucher.date}`, 140, 31);
    doc.text(`Ref / PO: ${voucher.referenceNumber || 'N/A'}`, 140, 36);

    // Party Details (Bill To)
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text('Bill To (Buyer Details):', 14, 48);

    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(`Name: ${voucher.partyName || party?.name || 'Cash Customer'}`, 14, 54);
    doc.text(`GSTIN: ${party?.gstin || 'Unregistered'}`, 14, 59);
    doc.text(`Address: ${party?.address || 'N/A'}`, 14, 64);
    doc.text(`State: ${party?.state || company.state} (${party?.stateCode || company.stateCode})`, 14, 69);

    // Table of Items
    const tableData: any[] = [];
    if (voucher.inventoryItems && voucher.inventoryItems.length > 0) {
      voucher.inventoryItems.forEach((item, index) => {
        tableData.push([
          index + 1,
          item.itemName,
          item.hsnCode || '-',
          `${item.quantity} ${item.unit}`,
          `₹${item.rate.toLocaleString('en-IN')}`,
          `₹${item.taxableAmount.toLocaleString('en-IN')}`,
          `${item.gstRate}%`,
          voucher.isInterstate
            ? `₹${item.igstAmount.toLocaleString('en-IN')}`
            : `₹${(item.cgstAmount + item.sgstAmount).toLocaleString('en-IN')}`,
          `₹${item.totalAmount.toLocaleString('en-IN')}`,
        ]);
      });
    } else {
      // Voucher without itemized inventory (e.g. Service or direct entry)
      voucher.entries.forEach((e, idx) => {
        tableData.push([
          idx + 1,
          e.ledgerName,
          '-',
          '1 Unit',
          `₹${e.amount.toLocaleString('en-IN')}`,
          `₹${e.amount.toLocaleString('en-IN')}`,
          '18%',
          '-',
          `₹${e.amount.toLocaleString('en-IN')}`,
        ]);
      });
    }

    autoTable(doc, {
      startY: 75,
      head: [
        [
          '#',
          'Description',
          'HSN',
          'Qty',
          'Rate',
          'Taxable',
          'GST %',
          voucher.isInterstate ? 'IGST' : 'CGST+SGST',
          'Total (₹)',
        ],
      ],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Totals Box
    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.text(`Taxable Amount: ₹${(voucher.totalTaxableAmount || 0).toLocaleString('en-IN')}`, 130, finalY);
    if (voucher.isInterstate) {
      doc.text(`Output IGST: ₹${(voucher.totalIgst || 0).toLocaleString('en-IN')}`, 130, finalY + 5);
    } else {
      doc.text(`Output CGST: ₹${(voucher.totalCgst || 0).toLocaleString('en-IN')}`, 130, finalY + 5);
      doc.text(`Output SGST: ₹${(voucher.totalSgst || 0).toLocaleString('en-IN')}`, 130, finalY + 10);
    }

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(
      `Grand Total: ₹${voucher.grandTotal.toLocaleString('en-IN')}`,
      130,
      finalY + (voucher.isInterstate ? 12 : 17)
    );

    // Terms & Signatory
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('Terms & Conditions:', 14, finalY);
    doc.text('1. Goods once sold will not be taken back.', 14, finalY + 5);
    doc.text('2. Subject to Mumbai Jurisdiction.', 14, finalY + 10);
    doc.text(`For ${company.name}`, 140, finalY + 30);
    doc.text('Authorized Signatory', 140, finalY + 45);

    // Download PDF
    doc.save(`${voucher.voucherNumber.replace(/[\/\\]/g, '_')}.pdf`);
  }

  /**
   * Export JSON Database Backup
   */
  static async exportFullBackupJSON(): Promise<void> {
    const data = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      companies: await db.companies.toArray(),
      ledgerGroups: await db.ledgerGroups.toArray(),
      ledgers: await db.ledgers.toArray(),
      vouchers: await db.vouchers.toArray(),
      stockGroups: await db.stockGroups.toArray(),
      stockItems: await db.stockItems.toArray(),
      godowns: await db.godowns.toArray(),
      unitsOfMeasure: await db.unitsOfMeasure.toArray(),
      employees: await db.employees.toArray(),
      salaryStructures: await db.salaryStructures.toArray(),
      bankAccounts: await db.bankAccounts.toArray(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEWBAL_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Import Database from JSON Backup
   */
  static async importBackupJSON(file: File): Promise<boolean> {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.companies || !data.ledgers) {
        throw new Error('Invalid NEWBAL backup file');
      }

      await db.transaction('rw', [
        db.companies,
        db.ledgerGroups,
        db.ledgers,
        db.vouchers,
        db.stockGroups,
        db.stockItems,
        db.godowns,
        db.unitsOfMeasure,
        db.employees,
        db.salaryStructures,
        db.bankAccounts,
      ], async () => {
        if (data.companies?.length) await db.companies.bulkPut(data.companies);
        if (data.ledgerGroups?.length) await db.ledgerGroups.bulkPut(data.ledgerGroups);
        if (data.ledgers?.length) await db.ledgers.bulkPut(data.ledgers);
        if (data.vouchers?.length) await db.vouchers.bulkPut(data.vouchers);
        if (data.stockGroups?.length) await db.stockGroups.bulkPut(data.stockGroups);
        if (data.stockItems?.length) await db.stockItems.bulkPut(data.stockItems);
        if (data.godowns?.length) await db.godowns.bulkPut(data.godowns);
        if (data.unitsOfMeasure?.length) await db.unitsOfMeasure.bulkPut(data.unitsOfMeasure);
        if (data.employees?.length) await db.employees.bulkPut(data.employees);
        if (data.salaryStructures?.length) await db.salaryStructures.bulkPut(data.salaryStructures);
        if (data.bankAccounts?.length) await db.bankAccounts.bulkPut(data.bankAccounts);
      });

      return true;
    } catch (err) {
      console.error('Import failed', err);
      return false;
    }
  }

  /**
   * Export Table to Excel (.xlsx)
   */
  static exportToExcel(data: any[], fileName: string, sheetName = 'Sheet1') {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }

  /**
   * Export Tally XML Format (Universal Tally Compatibility)
   */
  static async exportTallyXML(companyId: string): Promise<void> {
    const vouchers = await db.vouchers.where('companyId').equals(companyId).toArray();
    const ledgers = await db.ledgers.where('companyId').equals(companyId).toArray();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters and Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
`;

    // Ledgers in Tally XML format
    for (const l of ledgers) {
      xml += `          <LEDGER NAME="${escapeXml(l.name)}" ACTION="Create">
            <NAME>${escapeXml(l.name)}</NAME>
            <PARENT>Sundry Debtors</PARENT>
            <OPENINGBALANCE>${l.openingBalance * (l.openingBalanceType === 'DR' ? -1 : 1)}</OPENINGBALANCE>
            <ISBILLWISEON>Yes</ISBILLWISEON>
          </LEDGER>\n`;
    }

    // Vouchers in Tally XML format
    for (const v of vouchers) {
      xml += `          <VOUCHER VCHTYPE="${escapeXml(v.voucherType)}" ACTION="Create">
            <DATE>${v.date.replace(/-/g, '')}</DATE>
            <VOUCHERNUMBER>${escapeXml(v.voucherNumber)}</VOUCHERNUMBER>
            <NARRATION>${escapeXml(v.narration || '')}</NARRATION>
`;
      for (const e of v.entries) {
        xml += `            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(e.ledgerName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${e.type === 'DR' ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
              <AMOUNT>${e.type === 'DR' ? -e.amount : e.amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>\n`;
      }
      xml += `          </VOUCHER>\n`;
    }

    xml += `        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TALLY_EXPORT_${new Date().toISOString().split('T')[0]}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}
